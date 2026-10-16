import { parseArgs } from 'node:util';
import { PrismaClient } from '@prisma/client';
import { z } from 'zod';
import { evaluateForecasts } from './modules/eta/eta.evaluation';
import { loadRecordedForecasts } from './modules/eta/eta.evaluation.query';

/** Read-only aggregate report; never boots API workers or prints patient identifiers. */
async function main(): Promise<void> {
  const argv = process.argv.slice(2);
  const { values } = parseArgs({
    args: argv[0] === '--' ? argv.slice(1) : argv,
    options: {
      'hospital-id': { type: 'string' },
      from: { type: 'string' },
      to: { type: 'string' },
    },
  });
  const hospitalId = z.string().uuid().parse(values['hospital-id']);
  const from = new Date(z.string().datetime({ offset: true }).parse(values.from));
  const to = new Date(z.string().datetime({ offset: true }).parse(values.to));
  if (to <= from || to.getTime() - from.getTime() > 31 * 86_400_000) {
    throw new Error('Use a positive reporting interval of at most 31 days.');
  }
  try {
    process.loadEnvFile?.();
  } catch {
    /* Hosting may inject environment variables. */
  }
  const prisma = new PrismaClient();
  try {
    const report = evaluateForecasts(await loadRecordedForecasts(prisma, hospitalId, from, to));
    process.stdout.write(
      JSON.stringify(
        {
          cohort: {
            from: from.toISOString(),
            toExclusive: to.toISOString(),
            basis: 'session scheduled start',
          },
          limitations: [
            'Frozen leave-now forecasts only; does not evaluate all estimates displayed in the app.',
            'Provider submission is not device delivery or patient acknowledgement.',
            'No per-provider attribution: provider changes at prediction time are not recorded.',
            'Zero completed samples means no accuracy evidence yet.',
          ],
          ...report,
        },
        null,
        2,
      ) + '\n',
    );
  } finally {
    await prisma.$disconnect();
  }
}

void main().catch(() => {
  // Do not print Prisma errors, which can include connection or patient details.
  process.stderr.write(
    'ETA report failed. Check DATABASE_URL and use --hospital-id UUID --from ISO_TIMESTAMP --to ISO_TIMESTAMP (maximum 31 days, 10000 entries).\n',
  );
  process.exitCode = 1;
});
