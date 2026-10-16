import { CanActivate, ExecutionContext, Injectable } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import {
  ForbiddenError,
  TenantMismatchError,
  UnauthorizedError,
} from "../errors";
import type { AuthedRequest } from "../auth-context";
import type { Role } from "@opd/contracts";
import {
  setDatabaseIdentity,
  withDatabaseIdentity,
} from "../../prisma/database-context";

/**
 * Resolves the tenant for any route carrying a :hospitalId OR a :sessionId
 * parameter, by looking up the caller's HospitalStaff membership (docs/Rules.md 1.3).
 *
 * Registered GLOBALLY and keyed off the route parameter, so every hospital-scoped
 * route added in any later phase is scoped automatically. There is no per-controller
 * decorator to forget - which is the failure mode that leaks another hospital's data.
 *
 * **:sessionId was added by Phase 4.** The queue commands are addressed as
 * `POST /sessions/:sessionId/<command>` (docs/Architecture.md 6.4) and carry no
 * hospital segment, so without this they would have resolved no tenant at all and
 * `@Roles` would have rejected every one of them as a wiring bug. The hospital comes
 * from the SESSION ROW, never from the request: the client names a session, the
 * server decides which hospital that is and whether the caller belongs to it.
 *
 * The parameter NAME is load-bearing, exactly as in trap 12: patient-facing
 * discovery uses `GET /sessions/:id` and must NOT be tenant-scoped, so it keeps
 * `:id`. A route that wants scoping opts in by naming the parameter `:sessionId`.
 *
 * Routes with neither are account-scoped and pass through untouched.
 */
@Injectable()
export class TenantGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const req = ctx.switchToHttp().getRequest<AuthedRequest>();
    const params = req.params as Record<string, string> | undefined;
    const hospitalId =
      params?.hospitalId ?? (await this.hospitalOfSession(params?.sessionId));
    if (!hospitalId) return true;

    if (!req.account) throw new UnauthorizedError();

    const membership = await this.prisma.hospitalStaff.findUnique({
      where: {
        hospitalId_accountId: { hospitalId, accountId: req.account.id },
      },
      select: { role: true, permissions: true, status: true },
    });

    // Same answer for "no such hospital" and "not your hospital": a 404-vs-403
    // difference would let a caller enumerate which hospital ids exist.
    if (!membership) throw new TenantMismatchError();
    if (membership.status !== "ACTIVE")
      throw new ForbiddenError("Membership is not active");

    req.tenant = {
      hospitalId,
      role: membership.role as Role,
      permissions: membership.permissions,
    };
    setDatabaseIdentity({
      hospitalId,
      role: membership.role,
      purpose: "staff",
    });
    return true;
  }

  /**
   * The hospital a session belongs to, or undefined when there is no :sessionId.
   *
   * An unknown session id returns a sentinel that no membership can match, so the
   * caller gets the same TenantMismatch as an unknown hospital. Returning 404 here
   * would let anyone enumerate which session ids exist across every hospital on the
   * platform, one request at a time.
   */
  private async hospitalOfSession(
    sessionId: string | undefined,
  ): Promise<string | undefined> {
    if (!sessionId) return undefined;
    const session = await withDatabaseIdentity(
      { purpose: "resolve-session", sessionId },
      () =>
        this.prisma.oPDSession.findUnique({
          where: { id: sessionId },
          select: { hospitalId: true },
        }),
    );
    return session?.hospitalId ?? NO_SUCH_HOSPITAL;
  }
}

/**
 * Never a real id, so the membership lookup always misses and 403s.
 *
 * **It must not contain a NUL byte.** This was a literal NUL followed by the phrase
 * below, which looked airtight - nothing can collide with a string containing a byte
 * no id may hold. But Postgres rejects NUL in text outright (SQLSTATE 22021, "invalid
 * byte sequence for encoding UTF8: 0x00"), so the membership query THREW instead of
 * returning null, and every unknown session id on a tenant-scoped route answered 500
 * rather than the 403 promised above.
 *
 * That is the enumerable difference the sentinel exists to prevent, and it announced
 * itself as an unhandled server error on every probe. The NUL also made this file read
 * as binary to grep.
 *
 * Hospital ids are UUIDs, so a plain lowercase phrase can never be one. The
 * impossibility does not need an unrepresentable byte to hold.
 */
const NO_SUCH_HOSPITAL = "no-such-hospital";
