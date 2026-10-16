import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const marker = 'private-marker-never-print-this';
const migrationUrl = `postgresql://postgres.ejbrtjcioolhtyklhwly:${marker}@aws-0-ap-south-1.pooler.supabase.com:5432/postgres?sslmode=require`;
const hook = `https://api.render.com/deploy/srv-dafjqtf40ujc73bk2a8g?key=${marker}`;
function run(script, variables) {
  const result = spawnSync(
    process.execPath,
    [fileURLToPath(new URL(`../${script}`, import.meta.url))],
    {
      env: { ...process.env, ...variables },
      encoding: 'utf8',
      timeout: 5000,
      windowsHide: true,
    },
  );
  assert.ifError(result.error);
  assert.ok(!`${result.stdout}${result.stderr}`.includes(marker), 'private input leaked');
  return result.status;
}

test('migration preflight accepts only the intended project, owner path and TLS', () => {
  assert.equal(run('verify-migration-target.mjs', { DATABASE_URL: migrationUrl }), 0);
  for (const value of [
    `invalid-${marker}`,
    migrationUrl.replace('ejbrtjcioolhtyklhwly', 'anotherproject'),
    migrationUrl.replace('postgres.ejbr', 'kramya_runtime.ejbr'),
    migrationUrl.replace(':5432/', ':6543/'),
    migrationUrl.replace('sslmode=require', 'sslmode=disable'),
    `${migrationUrl}&sslmode=disable`,
    `${migrationUrl}&schema=private`,
    migrationUrl.replace('pooler.supabase.com', 'example.com'),
  ])
    assert.equal(run('verify-migration-target.mjs', { DATABASE_URL: value }), 1);
});

test('bad deployment destinations and non-exact refs fail before any network request', () => {
  for (const value of [
    `invalid-${marker}`,
    hook.replace('https:', 'http:'),
    hook.replace('api.render.com', 'example.com'),
    hook.replace('api.render.com', 'api.render.com:444'),
    hook.replace('srv-dafjqtf40ujc73bk2a8g', 'srv-other'),
    `${hook}&key=second`,
    `${hook}#fragment`,
  ])
    assert.equal(
      run('deploy-migrated-commit.mjs', { DEPLOY_HOOK: value, DEPLOY_COMMIT: 'a'.repeat(40) }),
      1,
    );
  assert.equal(run('deploy-migrated-commit.mjs', { DEPLOY_HOOK: hook, DEPLOY_COMMIT: 'main' }), 1);
});
