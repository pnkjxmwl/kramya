import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { JwtService } from '@nestjs/jwt';
import { createHash, createHmac, randomBytes, randomUUID } from 'node:crypto';
import type { AuthTokens } from '@opd/contracts';
import { PrismaService } from '../../prisma/prisma.service';
import { env } from '../../config/env';
import { UnauthorizedError } from '../../common/errors';

/** Refresh tokens are opaque random strings; only their hash is stored. */
const hash = (token: string): string => createHash('sha256').update(token).digest('hex');

@Injectable()
export class TokenService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
  ) {}

  /** Start a new session (login/signup): a fresh token family. */
  async issue(account: { id: string; email: string }): Promise<AuthTokens> {
    return this.mint(account, randomUUID());
  }

  /** Same client retries share one successor for 60 seconds; other replay revokes the family. */
  async rotate(presented: string, rotationKey?: string): Promise<AuthTokens> {
    const tokenHash = hash(presented);
    const existing = await this.prisma.refreshToken.findUnique({
      where: { tokenHash }, include: { account: { select: { id: true, email: true } } },
    });
    if (!existing) throw new UnauthorizedError('Invalid refresh token');
    const derived = rotationKey ? {
      refreshToken: createHmac('sha256', env().JWT_REFRESH_SECRET).update(`refresh:${presented}:${rotationKey}`).digest('base64url'),
      rotationKey: createHmac('sha256', env().JWT_REFRESH_SECRET).update(`binding:${presented}:${rotationKey}`).digest('base64url'),
    } : undefined;
    const rotated = await this.prisma.$transaction(async (tx) => {
      // Stable parent lock also serializes logout; newly inserted token rows cannot
      // fall outside the lock as they could with a SELECT over the current family.
      await tx.$queryRaw`SELECT "id" FROM "Account" WHERE "id" = ${existing.accountId} FOR UPDATE`;
      const current = await tx.refreshToken.findUniqueOrThrow({ where: { tokenHash } });
      if (current.expiresAt <= new Date()) return null;
      const bound = rotationKey !== undefined && current.rotationKeyHash === hash(rotationKey);
      if (current.revokedAt !== null) {
        if (bound && derived && Date.now() - current.revokedAt.getTime() < 60_000) {
          const successor = await tx.refreshToken.findUnique({ where: { tokenHash: hash(derived.refreshToken) } });
          if (successor && successor.revokedAt === null && successor.expiresAt > new Date()) {
            return { ...derived, accessToken: await this.accessToken(existing.account), expiresIn: env().JWT_ACCESS_TTL_SEC };
          }
        }
        await tx.refreshToken.updateMany({ where: { familyId: current.familyId, revokedAt: null }, data: { revokedAt: new Date() } });
        return null;
      }
      if (rotationKey !== undefined && !bound) return null;
      await tx.refreshToken.update({ where: { id: current.id }, data: { revokedAt: new Date() } });
      return this.mint(existing.account, existing.familyId, tx, derived);
    });
    if (!rotated) throw new UnauthorizedError('Refresh token expired or reused; sign in again');
    return rotated;
  }

  /** Log out: kill the whole family, not just the presented token. */
  async revoke(presented: string): Promise<string | null> {
    const existing = await this.prisma.refreshToken.findUnique({
      where: { tokenHash: hash(presented) },
      select: { familyId: true, accountId: true },
    });
    // Unknown token: succeed anyway. Logout is idempotent and must not leak
    // whether a token was real.
    if (existing) await this.revokeFamily(existing.familyId);
    return existing?.accountId ?? null;
  }

  private async revokeFamily(familyId: string): Promise<void> {
    const row = await this.prisma.refreshToken.findFirst({ where: { familyId }, select: { accountId: true } });
    if (!row) return;
    await this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT "id" FROM "Account" WHERE "id" = ${row.accountId} FOR UPDATE`;
      await tx.refreshToken.updateMany({ where: { familyId, revokedAt: null }, data: { revokedAt: new Date() } });
    });
  }

  private accessToken(account: { id: string; email: string }): Promise<string> {
    return this.jwt.signAsync({ sub: account.id, email: account.email }, {
      secret: env().JWT_ACCESS_SECRET, expiresIn: env().JWT_ACCESS_TTL_SEC,
    });
  }

  private async mint(
    account: { id: string; email: string },
    familyId: string,
    /** The rotation's transaction, so the new token lands under the family lock. */
    client: Prisma.TransactionClient | PrismaService = this.prisma,
    derived?: { refreshToken: string; rotationKey: string },
  ): Promise<AuthTokens> {
    const config = env();

    const accessToken = await this.accessToken(account);
    const refreshToken = derived?.refreshToken ?? randomBytes(48).toString('base64url');
    const rotationKey = derived?.rotationKey ?? randomBytes(32).toString('base64url');
    await client.refreshToken.create({
      data: {
        accountId: account.id,
        familyId,
        tokenHash: hash(refreshToken),
        rotationKeyHash: hash(rotationKey),
        expiresAt: new Date(Date.now() + config.JWT_REFRESH_TTL_SEC * 1000),
      },
    });

    return { accessToken, refreshToken, rotationKey, expiresIn: config.JWT_ACCESS_TTL_SEC };
  }
}
