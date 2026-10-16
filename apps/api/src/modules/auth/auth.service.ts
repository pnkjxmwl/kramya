import { Injectable } from "@nestjs/common";
import { hash as argonHash, verify as argonVerify } from "@node-rs/argon2";
import { OAuth2Client } from "google-auth-library";
import type {
  AcceptInviteRequest,
  AuthTokens,
  GoogleAuthRequest,
  LoginRequest,
  MeResponse,
  Role,
  SignupRequest,
  StaffStatus,
} from "@opd/contracts";
import { PrismaService } from "../../prisma/prisma.service";
import { TokenService } from "./token.service";
import { env } from "../../config/env";
import {
  EmailAlreadyRegisteredError,
  InvalidCredentialsError,
  NotFoundError,
  UnauthorizedError,
} from "../../common/errors";
import { StaffService } from "../staff/staff.service";
import {
  DatabaseIdentityFor,
  setDatabaseIdentity,
} from "../../prisma/database-context";
import { createHash } from "node:crypto";

@Injectable()
export class AuthService {
  private readonly googleClient = new OAuth2Client();

  constructor(
    private readonly prisma: PrismaService,
    private readonly tokens: TokenService,
    private readonly staff: StaffService,
  ) {}

  @DatabaseIdentityFor((input: SignupRequest) => ({
    purpose: "auth",
    email: input.email,
  }))
  async signup(input: SignupRequest): Promise<AuthTokens> {
    const passwordHash = await argonHash(input.password);

    try {
      const account = await this.prisma.account.create({
        data: {
          email: input.email,
          passwordHash,
          // Signing up for yourself creates your own profile; family is added later.
          patients: input.name
            ? { create: { name: input.name, relation: "SELF" } }
            : undefined,
        },
        select: { id: true, email: true },
      });
      return this.tokens.issue(account);
    } catch (e) {
      if (isUniqueViolation(e, "email"))
        throw new EmailAlreadyRegisteredError();
      throw e;
    }
  }

  /**
   * Accept a staff invitation: prove you received the token, then get a session.
   *
   * Three deliberate choices:
   *
   *  - **The password is set only if the account has none.** An existing user
   *    invited to a second hospital keeps the password they already have. Letting
   *    an invitation overwrite a live credential would turn "invite someone" into
   *    "reset their password", which is an account-takeover primitive.
   *  - **The token is cleared in the same transaction that activates the
   *    membership**, so it is single-use by construction rather than by a flag.
   *  - **Every failure returns the same UnauthorizedError.** Distinguishing
   *    "no such token" from "expired" from "already used" tells an attacker which
   *    guesses were close.
   */
  @DatabaseIdentityFor((input: AcceptInviteRequest) => ({
    purpose: "invite",
    inviteHash: createHash("sha256").update(input.token).digest("hex"),
  }))
  async acceptInvite(input: AcceptInviteRequest): Promise<AuthTokens> {
    const invalid = new UnauthorizedError("This invitation is not valid");

    // HospitalStaff belongs to the staff module; this asks it rather than reading
    // the table (docs/CLAUDE.md 3).
    const invitation = await this.staff.findOpenInvitation(input.token);
    if (!invitation) throw invalid;
    setDatabaseIdentity({
      accountId: invitation.accountId,
      invitationId: invitation.membershipId,
    });

    const account = await this.prisma.account.findUnique({
      where: { id: invitation.accountId },
      select: { id: true, email: true, passwordHash: true, googleId: true },
    });
    if (!account) throw invalid;

    // Hashed outside the transaction: Argon2id is deliberately slow, and holding a
    // transaction open across it holds locks for no reason.
    // The inviter knows this token. It authorizes membership, never a login to an
    // existing identity. Google-only accounts must use their existing sign-in.
    if (account.passwordHash) {
      if (!(await argonVerify(account.passwordHash, input.password)))
        throw invalid;
    } else if (account.googleId) {
      throw invalid;
    }
    const passwordHash =
      account.passwordHash ?? (await argonHash(input.password));

    await this.prisma.$transaction(async (tx) => {
      if (
        !(await this.staff.consumeInvitation(
          invitation.membershipId,
          input.token,
          tx,
        ))
      )
        throw invalid;

      if (!account.passwordHash) {
        // A concurrent Google login or another invitation must not have established
        // an identity since our read. Losing this claim rolls back activation too.
        const claimed = await tx.account.updateMany({
          where: { id: account.id, passwordHash: null, googleId: null },
          data: { passwordHash },
        });
        if (claimed.count !== 1) throw invalid;
      }
    });

    return this.tokens.issue({ id: account.id, email: account.email });
  }

  @DatabaseIdentityFor((input: LoginRequest) => ({
    purpose: "auth",
    email: input.email,
  }))
  async login(input: LoginRequest): Promise<AuthTokens> {
    const account = await this.prisma.account.findUnique({
      where: { email: input.email },
      select: { id: true, email: true, passwordHash: true },
    });

    // Google-only accounts have no passwordHash and must not be loggable by password.
    if (!account?.passwordHash) throw new InvalidCredentialsError();

    if (!(await argonVerify(account.passwordHash, input.password))) {
      throw new InvalidCredentialsError();
    }

    return this.tokens.issue({ id: account.id, email: account.email });
  }

  /** Google-only and password accounts prove identity through their existing session. */
  @DatabaseIdentityFor((accountId: string, token: string) => ({
    accountId,
    purpose: "invite",
    inviteHash: createHash("sha256").update(token).digest("hex"),
  }))
  async acceptMembership(
    accountId: string,
    token: string,
  ): Promise<AuthTokens> {
    const invitation = await this.staff.findOpenInvitation(token);
    const invalid = new UnauthorizedError("This invitation is not valid");
    if (!invitation || invitation.accountId !== accountId) throw invalid;
    setDatabaseIdentity({ invitationId: invitation.membershipId });
    const account = await this.prisma.account.findUniqueOrThrow({
      where: { id: accountId },
      select: { id: true, email: true },
    });
    if (!(await this.staff.consumeInvitation(invitation.membershipId, token)))
      throw invalid;
    return this.tokens.issue(account);
  }

  /**
   * Exchange a Google ID token for our own tokens. The token is verified against
   * Google's keys server-side - a client-supplied email or subject is never trusted.
   */
  @DatabaseIdentityFor(() => ({ purpose: "auth-google" }))
  async google(input: GoogleAuthRequest): Promise<AuthTokens> {
    const audience = env().GOOGLE_CLIENT_IDS;
    if (!audience.length)
      throw new UnauthorizedError("Google sign-in is not configured");

    const payload = await this.verifyGoogleToken(input.idToken, audience);
    const sub = payload.sub;
    const email = payload.email.toLowerCase();
    setDatabaseIdentity({ email, googleSub: sub });

    // ponytail: read-then-write, not an upsert. Two concurrent first-time logins for
    // the same account would race; the unique constraint rejects the loser and the
    // client retries. Wrap in a transaction if that ever shows up in the logs.
    const existing = await this.prisma.account.findFirst({
      where: { OR: [{ googleId: sub }, { email }] },
      select: { id: true, email: true, googleId: true },
    });

    if (!existing) {
      const created = await this.prisma.account.create({
        data: { googleId: sub, email },
        select: { id: true, email: true },
      });
      return this.tokens.issue(created);
    }

    // Same verified email as an existing password account: link, don't duplicate.
    if (!existing.googleId) {
      await this.prisma.account.update({
        where: { id: existing.id },
        data: { googleId: sub },
      });
    }

    return this.tokens.issue({ id: existing.id, email: existing.email });
  }

  async me(accountId: string): Promise<MeResponse> {
    const account = await this.prisma.account.findUnique({
      where: { id: accountId },
      select: {
        id: true,
        email: true,
        passwordHash: true,
        googleId: true,
        memberships: {
          select: {
            hospitalId: true,
            role: true,
            status: true,
            permissions: true,
            hospital: { select: { name: true } },
          },
        },
        // 1:1 - `Doctor.accountId` is unique. Matched to the membership by hospital
        // below, so a doctor at one hospital who is also reception at another does
        // not appear to be a doctor at both.
        doctor: { select: { id: true, hospitalId: true } },
      },
    });
    if (!account) throw new NotFoundError("Account not found");

    return {
      id: account.id,
      email: account.email,
      hasPassword: account.passwordHash !== null,
      linkedGoogle: account.googleId !== null,
      memberships: account.memberships.map((m) => ({
        hospitalId: m.hospitalId,
        hospitalName: m.hospital.name,
        role: m.role as Role,
        status: m.status as StaffStatus,
        permissions: m.permissions,
        doctorId:
          account.doctor?.hospitalId === m.hospitalId
            ? account.doctor.id
            : null,
      })),
    };
  }

  private async verifyGoogleToken(
    idToken: string,
    audience: string[],
  ): Promise<{ sub: string; email: string }> {
    try {
      const ticket = await this.googleClient.verifyIdToken({
        idToken,
        audience,
      });
      const payload = ticket.getPayload();
      // An unverified Google email must not be able to claim an existing account.
      if (payload?.sub && payload.email && payload.email_verified) {
        return { sub: payload.sub, email: payload.email };
      }
    } catch {
      // fall through to one generic error
    }
    throw new UnauthorizedError("Invalid Google token");
  }
}

/** Prisma's unique-constraint violation, narrowed to one field. */
function isUniqueViolation(e: unknown, field: string): boolean {
  const err = e as { code?: string; meta?: { target?: string[] | string } };
  if (err?.code !== "P2002") return false;
  const target = err.meta?.target;
  return Array.isArray(target) ? target.includes(field) : target === field;
}
