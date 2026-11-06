import { PrismaClient } from '@prisma/client';
import { z } from 'zod';
import { env } from './config/env';

/** Operator-only approval after clinic/founder verification; never an email-proof claim. */
async function main(): Promise<void> {
  const at = (name: string) => { const i = process.argv.indexOf(name); return i < 0 ? undefined : process.argv[i + 1]; };
  const accountId = z.string().uuid().parse(at('--account'));
  const reason = z.string().trim().min(10).max(500).parse(at('--reason'));
  const approve = process.argv.includes('--approve'), revoke = process.argv.includes('--revoke');
  if (approve === revoke) throw new Error('Choose exactly one of --approve or --revoke.');
  const db = new PrismaClient();
  try {
    await db.$transaction(async tx => {
      const [role] = await tx.$queryRaw<{ privileged: boolean }[]>`SELECT (rolsuper OR rolbypassrls) AS privileged FROM pg_roles WHERE rolname=current_user`;
      if (!role?.privileged) throw new Error('Pilot approval requires the migration owner. Runtime credentials are refused.');
      const identity = await tx.deploymentIdentity.findUnique({ where: { id: 'singleton' } });
      if (identity?.environment !== env().DEPLOYMENT_ENVIRONMENT) throw new Error('Wrong database environment.');
      await tx.$queryRaw`SELECT id FROM "Account" WHERE id=${accountId} FOR UPDATE`;
      const account = await tx.account.findFirst({ where: { id: accountId, deletedAt: null, deletionRequestedAt: null } });
      if (!account) throw new Error('No active account is eligible for pilot approval.');
      const now = new Date();
      await tx.account.update({ where: { id: accountId }, data: { remoteBookingApprovedAt: approve ? now : null } });
      await tx.auditLog.create({ data: { actorType: 'SYSTEM', action: approve ? 'account.PILOT_APPROVED' : 'account.PILOT_REVOKED',
        entityType: 'Account', entityId: accountId, reason, metadata: { approvalMethod: 'OPERATOR_REVIEW', environment: identity.environment }, createdAt: now } });
    });
    process.stdout.write('Pilot booking access updated. Existing reservations are unchanged; no email/phone verification was asserted.\n');
  } finally { await db.$disconnect(); }
}
void main().catch(() => { console.error('Pilot access update failed. Check the account, explicit action/reason, environment and owner credentials; no credential values are printed.'); process.exitCode = 1; });
