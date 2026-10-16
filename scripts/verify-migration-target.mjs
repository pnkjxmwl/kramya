import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

// This workflow is for one explicitly selected staging project, not arbitrary URLs.
export function prepareMigrationUrl(value) {
  let url, user;
  try {
    const input = (value ?? '').trim();
    if (/[\u0000-\u0020]/.test(input)) throw new Error();
    url = new URL(input);
    user = decodeURIComponent(url.username);
    decodeURIComponent(url.password);
  } catch {
    throw new Error(
      'MIGRATION_DATABASE_URL must contain the full PostgreSQL connection URI, without surrounding quotes.',
    );
  }
  if (
    !['postgres:', 'postgresql:'].includes(url.protocol) ||
    !url.hostname.endsWith('.pooler.supabase.com') ||
    url.port !== '5432' ||
    !user.endsWith('.ejbrtjcioolhtyklhwly') ||
    user.startsWith('kramya_runtime.') ||
    url.pathname !== '/postgres' ||
    url.hash ||
    !url.password ||
    url.searchParams.getAll('schema').length > 1 ||
    (url.searchParams.has('schema') && url.searchParams.get('schema') !== 'public')
  )
    throw new Error(
      'Expected the selected Kramya project owner/migrator Session Pooler URI on port 5432, database postgres, schema public.',
    );

  // Render's existing URL may omit TLS. Require it on the connection actually
  // passed to Prisma, without changing the stored secret or its password.
  if (!url.searchParams.has('sslmode')) url.searchParams.set('sslmode', 'require');
  if (
    url.searchParams.getAll('sslmode').length !== 1 ||
    !['require', 'verify-full'].includes(url.searchParams.get('sslmode'))
  )
    throw new Error(
      'Migration connection must use sslmode=require or verify-full exactly once; explicit TLS downgrades are rejected.',
    );
  return url.toString();
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    prepareMigrationUrl(process.env.DATABASE_URL);
    process.stdout.write(
      'Migration target matches the selected Kramya staging project and requires TLS.\n',
    );
  } catch (error) {
    // Never echo the connection URI or URL parser exception's input field.
    process.stderr.write(error.message + '\n');
    process.exitCode = 1;
  }
}
