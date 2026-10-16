import { spawn } from 'node:child_process';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { prepareMigrationUrl } from './verify-migration-target.mjs';

export function runMigrations(databaseUrl, start = spawn) {
  const normalized = prepareMigrationUrl(databaseUrl);
  if (process.env.GITHUB_ACTIONS === 'true') {
    const url = new URL(normalized);
    // Mask the normalized URI and both password encodings before Prisma starts.
    // The stored secret may differ by whitespace or the added TLS parameter.
    for (const secret of [normalized, url.password, decodeURIComponent(url.password)])
      process.stdout.write(
        `::add-mask::${secret.replaceAll('%', '%25').replaceAll('\r', '%0D').replaceAll('\n', '%0A')}\n`,
      );
  }
  process.stdout.write(
    'Running Prisma migrations for the validated staging project with TLS required.\n',
  );
  const child = start('pnpm', ['--filter', '@opd/api', 'prisma:deploy'], {
    env: { ...process.env, DATABASE_URL: normalized },
    stdio: 'inherit',
    windowsHide: true,
  });
  return new Promise((resolve, reject) => {
    child.once('error', () => reject(new Error('Could not start the migration command.')));
    child.once('close', (code) =>
      code === 0 ? resolve() : reject(new Error('Prisma migration deployment failed.')),
    );
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  Promise.resolve()
    .then(() => runMigrations(process.env.DATABASE_URL))
    .catch((error) => {
      process.stderr.write(error.message + '\n');
      process.exitCode = 1;
    });
}
