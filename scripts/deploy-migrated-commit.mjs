// The owner database credential belongs to the migration step, never Render runtime.
let hook;
try {
  hook = new URL(process.env.DEPLOY_HOOK ?? '');
} catch {
  process.stderr.write('Missing or invalid opd-api deploy hook secret.\n');
  process.exit(1);
}
const commit = process.env.DEPLOY_COMMIT ?? '';
if (
  hook.protocol !== 'https:' ||
  hook.username ||
  hook.password ||
  hook.hash ||
  hook.port ||
  hook.hostname !== 'api.render.com' ||
  hook.pathname !== '/deploy/srv-dafjqtf40ujc73bk2a8g' ||
  !hook.searchParams.get('key') ||
  hook.searchParams.getAll('key').length !== 1 ||
  !/^[a-f0-9]{40}$/.test(commit)
) {
  process.stderr.write('Expected the opd-api HTTPS deploy hook and an exact commit SHA.\n');
  process.exit(1);
}
hook.searchParams.set('ref', commit);
try {
  const response = await fetch(hook, {
    method: 'POST',
    redirect: 'error',
    signal: AbortSignal.timeout(30_000),
  });
  if (!response.ok) throw new Error('Deploy hook rejected');
  process.stdout.write(
    `Render deployment requested for ${commit}. Verify live status and readiness separately.\n`,
  );
} catch {
  // Never print the hook, response body, request error or its private query key.
  process.stderr.write('Render deploy request failed; inspect the service dashboard.\n');
  process.exitCode = 1;
}
