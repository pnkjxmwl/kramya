import type { Prisma } from '@prisma/client';

/** Cross-session coordination without exposing private Account rows to reception.
 * Always acquire before any account/session row lock. Hash collisions only serialize
 * unrelated work; identifiers and access checks still use the original UUID.
 */
export async function lockBookingAccount(tx: Prisma.TransactionClient, accountId: string): Promise<void> {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${accountId}, 20261101))`;
}
