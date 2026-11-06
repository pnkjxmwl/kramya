import { Prisma, PrismaClient } from '@prisma/client';
import { env } from './config/env';

/** Operator-only, one-time initializer. Never cleans or relabels a populated dataset. */
async function main(): Promise<void> {
  if (!process.argv.includes('--initialize-empty-production') || env().DEPLOYMENT_ENVIRONMENT !== 'PRODUCTION') {
    throw new Error('Requires DEPLOYMENT_ENVIRONMENT=PRODUCTION and --initialize-empty-production. Use only a new, separate production database.');
  }
  const db = new PrismaClient();
  try {
    await db.$transaction(async tx => {
      const [role] = await tx.$queryRaw<{ privileged: boolean }[]>`SELECT (rolsuper OR rolbypassrls) AS privileged FROM pg_roles WHERE rolname=current_user`;
      if (!role?.privileged) throw new Error('Initialization requires the migration owner with full visibility; the restricted runtime credential is refused.');
      const models = Prisma.dmmf.datamodel.models.filter(m => m.name !== 'DeploymentIdentity');
      // Model names are generated metadata, never command-line input.
      const tables = models.map(m => `public."${(m.dbName ?? m.name).replaceAll('"', '""')}"`);
      await tx.$executeRawUnsafe(`LOCK TABLE ${tables.join(', ')} IN ACCESS EXCLUSIVE MODE`);
      for (const table of tables) {
        const [row] = await tx.$queryRawUnsafe<{ count: bigint }[]>(`SELECT count(*) AS count FROM ${table}`);
        if (row && row.count > 0n) throw new Error('Initialization refused: application data already exists. Create a separate empty database; no records were changed.');
      }
      await tx.deploymentIdentity.update({ where: { id: 'singleton' }, data: { environment: 'PRODUCTION' } });
    }, { timeout: 30_000 });
    process.stdout.write('Empty production database identity initialized. Configure distinct production secrets and URLs before starting the service.\n');
  } finally { await db.$disconnect(); }
}
void main().catch(error => { console.error(error instanceof Error ? error.message : 'Initialization failed'); process.exitCode = 1; });
