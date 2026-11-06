import { NestFactory } from '@nestjs/core';
import { z } from 'zod';
import { AppModule } from './app.module';
import { AccountPrivacyService } from './modules/auth/account-privacy.service';

/** Operator retry after clinic handover. Refuses accounts without a verified request. */
async function main() {
  const [flag, value, extra] = process.argv.slice(2);
  if (flag === '--help') { process.stdout.write('Usage: pnpm --filter @opd/api fulfil-deletion -- --account <uuid>\nOnly retries an already verified deletion request.\n'); return; }
  const accountId = z.string().uuid().parse(flag === '--account' && !extra ? value : undefined);
  const app = await NestFactory.createApplicationContext(AppModule, { logger: ['error'] });
  try { process.stdout.write(JSON.stringify(await app.get(AccountPrivacyService).finishRequest(accountId)) + '\n'); }
  finally { await app.close(); }
}
main().catch(() => { process.stderr.write('Deletion retry failed. Check the request and clinic handover; no credentials should be printed.\n'); process.exitCode = 1; });
