// This workflow is for one explicitly selected staging project, not arbitrary URLs.
try {
  const url = new URL(process.env.DATABASE_URL ?? '');
  const user = decodeURIComponent(url.username);
  if (
    !['postgres:', 'postgresql:'].includes(url.protocol) ||
    !url.hostname.endsWith('.pooler.supabase.com') ||
    url.port !== '5432' ||
    !user.endsWith('.ejbrtjcioolhtyklhwly') ||
    user.startsWith('kramya_runtime.') ||
    url.pathname !== '/postgres' ||
    url.hash ||
    !url.password ||
    url.searchParams.getAll('sslmode').length !== 1 ||
    url.searchParams.getAll('schema').length > 1 ||
    (url.searchParams.has('schema') && url.searchParams.get('schema') !== 'public') ||
    !['require', 'verify-full'].includes(url.searchParams.get('sslmode'))
  )
    throw new Error();
  process.stdout.write(
    'Migration target matches the selected Kramya staging project and requires TLS.\n',
  );
} catch {
  // Never echo a connection URL or a URL parser exception's input field.
  process.stderr.write(
    'Expected the selected Kramya project owner/migrator Session Pooler URI on port 5432 with TLS.\n',
  );
  process.exitCode = 1;
}
