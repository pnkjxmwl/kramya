# Production safeguard rollout

Updated 17 October 2026 (Asia/Kolkata). The hosted service remains fictional staging. Phone acceptance, visual review and the complete patient/staff journey are deliberately deferred to [TESTING.md](../TESTING.md). Development security/build checks continue now.

## Database credentials and deployment boundary

Migration `202610160005_runtime_database_role` initially prepared `kramya_runtime` as **NOLOGIN**, with explicit access to the 18 current app tables. The operator has now enabled LOGIN with a separate generated password and saved its Session Pooler URI directly in Render. It cannot own app objects, inherit role memberships, create app schema objects, manage roles/databases, replicate, bypass RLS, read `_prisma_migrations`, truncate tables, or acquire automatic access to future tables. Audit/event/consultation history permits SELECT/INSERT only. New models require explicit grant migrations.

This does **not** add tenant RLS. API guards and scoped queries still enforce account/clinic boundaries. The hosted API now uses `kramya_runtime`; the owner credential is stored in GitHub's migration environment. The operator rotated the previous runtime-exposed owner password and updated the GitHub secret. [Workflow attempt 2](https://github.com/pnkjxmwl/kramya/actions/runs/38958710636/attempts/2) verified migration authentication with the replacement credential; API readiness and actual restricted-role connections remained healthy. See [the data-access design](security/data-access-model.md) for the separate RLS/context work.

The manual **Migrate and deploy staging** GitHub workflow checks passing `verify` and `native` checks on the exact main commit, applies migrations, then triggers Render with that same SHA. Owner credentials are scoped to its migration step. GitHub environment `staging-database` is restricted to the main branch; both required secrets were saved privately. Run [38956356781](https://github.com/pnkjxmwl/kramya/actions/runs/38956356781) proved the migration connection and deploy hook for `ef476f37636b6a2afa8e0814d440977503538f2f`. Never expose migration secrets to PR workflows. Additional reviewer protection can be configured according to operator ownership.

Cutover order:

1. Configure GitHub environment `staging-database`, restricted to main and trusted operators. Add `MIGRATION_DATABASE_URL` and `RENDER_DEPLOY_HOOK_URL` directly through GitHub's secret UI. The first is the existing migration-owner Session Pooler URL with TLS; the second must be the private hook for existing `opd-api`. Never put the owner URL in the Render service under another variable name: runtime could still read it there.
2. Run the workflow on a passing main commit while the existing staging connection still works. The migration runner trims surrounding whitespace and adds `sslmode=require` when absent on the URI passed to Prisma; it rejects explicit TLS downgrades and duplicate TLS parameters. It does not change the stored GitHub secret or password. Verify migrations, exact Render deployment SHA and readiness. Check that database secrets never enter artifacts/logs.
3. Set a strong password for `kramya_runtime` and enable LOGIN through a secure operator connection. Use its Session Pooler username (`kramya_runtime.ejbrtjcioolhtyklhwly`) and role-specific password for Render `DATABASE_URL`. Do not reuse or publish the owner password.
4. Use the Render API build command `corepack enable && pnpm install --frozen-lockfile --prod=false && pnpm --filter @opd/api prisma:generate && pnpm exec turbo run build --filter=@opd/api`. Migrations are absent from the app build, and `render.yaml` sets automatic commit deploys off so deployment cannot race ahead of the protected migration step. The live service settings must match the Blueprint before recording the cutover complete. These deployment settings can be activated after step 2 while the existing runtime connection still works; step 3 remains required for actual credential separation.
5. Deploy through the workflow. Verify readiness, actual connected database role, exact SHA, role grants and app/job behavior with fictional fixtures. Run the runtime-grant SQL on an isolated database, not on hosted patient data. Keep the owner credential only in the protected migration environment/operator secret store.
6. Revoke/rotate the old runtime-exposed owner credential after the migration environment has its replacement and both paths are proven. Recheck secrets, rollback instructions and the API's limited grants.

The SQL checks in CI exercise allowed reads/inserts/updates/deletes and denied history edits, DDL and migration access under `SET LOCAL ROLE kramya_runtime`; all probes roll back. A second probe runs the canonical migration with a non-superuser owner, reflecting [Supabase's owner restrictions](https://supabase.com/docs/guides/database/postgres/roles-superuser). CI alone does not prove a live credential cutover or tenant RLS.

Live cutover evidence: workflow [38958710636](https://github.com/pnkjxmwl/kramya/actions/runs/38958710636) deployed commit `6b2dd2da6ab4653f2c2b5e07b4009ec121a2c264` through the hook; Render deploy `dep-db983j8m7kps73bglleg` reached live. The API build command contains no migration command and automatic deploys are off. Postgres showed actual runtime-role connections; readiness reported database/Redis up. Fictional-account API checks passed login, discovery, temporary profile CRUD, staff queue reads and cross-account/clinic rejection. Proof JSON is local and Git-ignored in `.backups/hosted-runtime-cutover-20261017.proof.json`. No owner credential, generated runtime URL or password is stored in these documents.

## Encrypted backup and isolated restore

`scripts/database-backup.mjs` uses the official PostgreSQL 17 Docker client. Hosted Supabase was verified as PostgreSQL 17.11. The tool exports only the `public` app schema/data, including Prisma migration history; it excludes role ownership and ACLs. It does not back up Supabase Auth, Storage objects, platform roles, external payment state, Redis, secrets or infrastructure settings.

Initialize a local key without printing it:

```powershell
node scripts/database-backup.mjs init-key .env.backup-key
$env:BACKUP_KEY_FILE = '.env.backup-key'
# Set BACKUP_DATABASE_URL privately; never paste it into chat or commit it.
node scripts/database-backup.mjs backup .backups/staging-20261016.kdb
```

The key file and `.backups/` are ignored by Git. Store a recoverable key copy in a password manager separately from an off-machine copy of each encrypted archive. Local files alone do not satisfy off-site backup or recovery objectives. Remote connections require TLS; `sslmode=verify-full` additionally needs a client-trusted server certificate chain. Do not claim `sslmode=require` verifies server identity.

The archive uses AES-256-GCM with a random nonce and authenticates its header. A backup is published only after `pg_dump` and encryption finish successfully; existing archives cannot be overwritten. The printed SHA-256 identifies the encrypted artifact without exposing records or credentials.

For a rehearsal, first create a **new, empty, local PostgreSQL 17 database** named `kramya_restore_<label>`, then privately set `RESTORE_DATABASE_URL` for it:

```powershell
node scripts/database-backup.mjs restore .backups/staging-20261016.kdb
```

The tool refuses hosted restore targets, ordinary database names and targets with existing public tables. It authenticates/decrypts the entire archive before connecting the restore client, uses an isolated temporary plaintext file, then restores in one transaction without `--clean`. It omits only the archive's `CREATE SCHEMA public` entry because a fresh database already has that schema. The temporary plaintext is removed on success/failure; use a machine and disk appropriate for the data. If restoration fails, do not retry against a primary project. Fix the cause and use a fresh empty rehearsal target.

Roles and ACLs are deliberately excluded. After a disaster restore, reapply the reviewed role/grant SQL as the restore owner (including `202610160004` where Supabase client roles exist, and `202610160005` for runtime), then set a new runtime password securely and verify grants before app reconnection. Restored Prisma history alone does not recreate cluster roles or restore their permissions.

After restoration, compare row counts, migration history and representative relations, then run an isolated app smoke check. Record measured recovery time and recovery point. Back up the hosted project and rehearse that exact artifact before marking the production recovery gate complete. A rehearsal using local fictional data proves the tooling only.

Local rehearsal, 16 October 2026: an encrypted fictional development snapshot restored into a separate PostgreSQL 17 container. All 19 table row counts and migration names/checksums matched, including 17 migration records, nine clinics and 25 doctor/hospital joins; 37 foreign keys and 80 indexes matched. A second restore into the occupied database was rejected and temporary plaintext was removed. A real API recovery smoke check then passed with a restricted local-role login (workers disabled). The proof JSON, encrypted archive and separate key are Git-ignored local files. Hosted backup, off-machine custody and recovery from that hosted artifact remain unchecked in `TESTING.md`.

## Remaining operational gates

- Define and demonstrate clinic-hour API/worker availability; current Render Free sleeps.
- Agree recovery point/time objectives, backup frequency, retention, operator ownership and failure escalation. No scheduled backup or paid upgrade is activated by this change.
- Rotate the old owner password and complete the database context/RLS design, access review, privacy/retention operations and clinic fallback procedure. The least-privilege live connection is now verified.
- Verify release signing, Firebase delivery, test-mode checkout/webhooks and the final acceptance file before a supervised clinic pilot.
