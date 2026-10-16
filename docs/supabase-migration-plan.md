# Fresh Postgres migration: Render to Supabase

Prepared 15 October 2026 for Kramya's first 3–4 clinics. **Verified cutover baseline (16 October): the free `Kramya` project is healthy in Mumbai; the first 15 Prisma migrations are applied; the application schema is present and empty; Render is live and the database/Redis readiness probe passes.** The Data API is disabled. The subsequent permission-hardening migration and its verification are described below. The founder confirmed the previous data was fictional and a fresh start is acceptable. The old Render database is suspended/expired and is not a rollback target.

Read the [architecture and pilot review](reviews/2026-10-15-architecture-and-pilot-review.md) first. Its account/payment/session-closure code blockers were addressed in PR #11; the remaining operating and security gates below still apply before real patients or live payments use this environment.

## Decision and limits

Use Supabase as **hosted PostgreSQL only**. Retain Prisma, the existing NestJS authorization, queue transactions, Razorpay integration, and Socket.IO. No Supabase client SDK, Auth migration, or Realtime replacement is needed for this database move.

Choose Mumbai (`ap-south-1`) to meet the project's database-location preference. Render currently runs in Singapore, so benchmark the additional network round trips; ultimately co-locate the API/workers/database. This selection alone does not establish legal compliance or keep all third-party processing in India. [Supabase regions](https://supabase.com/docs/guides/platform/regions), [Render regions](https://render.com/docs/regions).

Supabase Free is available without a card. It includes 500 MB database storage, two active projects, and 5 GB egress; inactive projects may pause after a week, and automatic backups/PITR are not included. Use one shared pilot project for hospitals and the second for staging if needed. Do not use Supabase Auth's MAU allowance as a capacity guarantee for this custom NestJS application. [Pricing](https://supabase.com/pricing), [official no-card statement](https://supabase.com/blog/observability-for-every-supabase-project-with-grafana-cloud), [backup guidance](https://supabase.com/docs/guides/platform/backups).

Render Free Postgres expires after 30 days, with a further 14-day upgrade grace before deletion. Its free plan does not provide managed recovery. The Render workspace now reports this project's expiry as October 7, 2026 and its status as suspended. Since the data is disposable, no paid recovery is necessary for this plan. [Render limits](https://render.com/docs/free), [recovery policy](https://render.com/docs/postgresql-backups).

Neon is a valid alternative, but its free 100 CU-hours/month is a poor fit for always-running 15–30-second sweepers: at minimum 0.25 CU, that is about 400 active hours/month. The current free storage is 1 GB/project, increased on October 2, 2026; older 0.5 GB comparisons are stale. [Neon limits](https://neon.com/docs/introduction/plans), [storage announcement](https://neon.com/blog/neon-free-plan-1-gb-per-project).

## Current cloud state

- Supabase project [`Kramya`](https://supabase.com/dashboard/project/ejbrtjcioolhtyklhwly) exists in the approved free organization, Mumbai region, and reports healthy. Its `public` schema contains 18 application tables and `_prisma_migrations`; the 15-migration cutover baseline was verified complete with no application rows. Confirm subsequent migrations against `_prisma_migrations` after each release.
- The owner disabled the unused Data API and automatic exposure of new tables. Render has the Supabase Session Pooler connection configured privately. The owner confirmed that the password placeholder previously shared in chat was masked, not the real password. Never put the URI or password in chat or source control.
- Render's `opd-api` remains on Free in Singapore, and its existing free `opd-keyvalue` remains available. At the cutover baseline, commit `1808372` (PR #12) was live and `GET /health/ready` returned `200` with database and Redis up. Verify the latest Render deployment and readiness after each release. The old `opd-postgres` is suspended after its October 7 expiry.
- The Render dashboard browser requires the owner to sign in with its configured login method; this GitHub account is configured for deployments only. The owner must enter the database URI directly in the Render service environment so it never passes through chat.
- `render.yaml` retains the expired database declaration temporarily so the first Blueprint sync does not remove that resource. The API declaration no longer derives `DATABASE_URL` from Render Postgres.

## Prepare the Supabase project

1. Create a Free project in Mumbai. Store its generated password in a password manager/deployment secret store. Do not put credentials in chat, Git, command history, screenshots, or an `EXPO_PUBLIC_`/`NEXT_PUBLIC_` variable.
2. **Disable the Data API before applying the application migrations.** Done. Kramya already exposes a server API; an extra autogenerated database API is unnecessary. Automatic exposure of new tables is also off. SQL/Prisma-created tables do not automatically get dashboard-created RLS protections. Do not expose the `public` application tables to anonymous/client database access. [Securing/disable Data API](https://supabase.com/docs/guides/api/securing-your-api#disable-the-data-api).
3. In Connect, use the **Session pooler** Postgres URI, port **5432**, with the exact host and username shown for this project. This connection is configured in Render. Supabase's free direct endpoint is IPv6; its compatibility guide lists Render as requiring the IPv4 pooler. [Connection modes](https://supabase.com/docs/guides/database/connecting-to-postgres), [IPv4 guidance](https://supabase.com/docs/guides/troubleshooting/supabase--your-network-ipv4-and-ipv6-compatibility-cHe3BP).
4. Require TLS. Start with a small Prisma pool, for example `connection_limit=5`, then tune from measured pool waits and concurrent worker/API demand. Preserve/merge existing query parameters correctly. `sslmode=require` requests encryption; certificate verification and trust settings should follow the provider/Prisma connection guidance, with no disabled TLS validation workaround.
5. Session mode is intentional for this long-running Prisma 6 API and migration session. Do not accidentally use the transaction-pooler port 6543 or paste a Prisma 7 adapter recipe into this Prisma 6 repository. A separate migration URL is optional, not required for the simplest session-pooler setup. If introducing `DIRECT_URL`, also wire schema `directUrl`, environment validation, Turbo pass-through, deployment secrets, and tests together.

At this small scale, one Prisma client/pool per process is appropriate. A session pooler still holds backend connections for sessions; it does not create unlimited database capacity. Budget pools across every API/worker process and deployment overlap. Before real data, use a suitably restricted runtime DB role and keep schema-changing credentials in the deployment path; do not assume application authorization is backed by database RLS unless it is explicitly designed and tested.

## Apply the existing schema

Use the repository's pinned package manager and a supported Node version. Ensure dependencies are installed and workspace links point to the actual checkout. Set the **new project's** `DATABASE_URL` securely in the command environment. Verify the destination in the dashboard without printing the full URI.

From the repository root:

```powershell
corepack pnpm --filter @opd/api prisma:generate
corepack pnpm --filter @opd/api prisma:deploy
corepack pnpm --filter @opd/api exec prisma migrate status
```

`prisma:deploy` runs `prisma migrate deploy`. This applies committed migrations; it does not generate a new migration. **Never run `migrate reset`, `migrate dev`, `db push`, the integration suite, or an unrestricted TRUNCATE against this hosted project.** The test suite creates/truncates test databases and belongs on isolated local/CI PostgreSQL.

Confirm all committed migrations are applied and that the application tables/enums and `_prisma_migrations` exist. Verify compatibility with the Postgres version provisioned by Supabase; do not assume it is the same major version as local Postgres 16. If migration fails, inspect the specific failure and correct it before continuing; do not reset the project as a generic remedy.

## Connect the existing API

The existing `render.yaml` obtains `DATABASE_URL` from the managed Render database. Replace that binding in the eventual deployment change with an externally supplied secret:

```yaml
- key: DATABASE_URL
  sync: false
```

[render.supabase.example.yaml](deployment/render.supabase.example.yaml) is a complete **review template**, preserving existing service names and startup/build behavior while omitting creation of another expiring Render database. It is not the active root Blueprint and has not been applied. Inspect the Render Blueprint diff before applying it; do not create duplicate services, rotate credentials unintentionally, or delete resources as an incidental migration step.

For an already-existing service, `sync: false` does not automatically prompt again: set the new value in the Render dashboard/environment settings and redeploy/restart. Keep the API public URL unchanged. Then web `API_URL` / `NEXT_PUBLIC_API_URL`, the patient build API URLs, and Razorpay's webhook URL do not change merely because Postgres moved.

Keep JWT/check-in secrets intentional and consistent with that environment. A fresh DB invalidates stored refresh-token rows and removes old demo accounts anyway. Retain Razorpay **test** credentials until integrity and operational gates pass. Free hosting does not make live payment processing fee-free.

The existing free Render build runs migrations after building because a separate pre-deploy command is unavailable there. For a real production rollout, use an ordered migration stage and backward-compatible schema changes; avoid two deployments racing schema updates. Do not promote this free staging template as the final production deployment.

## Bootstrap and validate fictional data

Build the API/contracts, then use the existing onboarding command with fictional contact details and the actual console origin:

```powershell
corepack pnpm exec turbo run build --filter=@opd/api
corepack pnpm --filter @opd/api onboard -- --name "Pilot Demo Clinic" --city Mumbai --admin admin@pilot.example --console-url https://YOUR-CONSOLE-ORIGIN
```

Replace the placeholder origin before running. The CLI outputs a sensitive invitation link; do not paste it into logs/reports. Fix the invitation flaw before using this process with real identities. The regular development seed is intentionally unsuitable for a public environment with real patients; do not bypass its guards. `scripts/demo-data.mjs` is available for fictional staging data through the normal API, after its environment and target are explicitly checked.

Validate with dedicated fictional accounts:

- `GET /health`: process liveness. **`GET /health/ready`**: database/Redis readiness. The old staging runbook's `/ready` example is incorrect for this controller. A healthy liveness result alone does not prove database availability.
- Login; create/configure two fictional hospitals; confirm tenant-isolated reads and commands.
- Create a session, mark the doctor present, add walk-in, scan/manual check-in, call/start/complete, and end with every possible outstanding state covered.
- Join/payment/test webhook/token, capture replay, lost webhook reconciliation, refund recovery, and session-ended payment resolution.
- Open board for more than one access-token lifetime; disconnect/reconnect; confirm fresh snapshot and renewed auth.
- Run a real-phone patient journey: family selection, checkout return, background/resume, push tap, and account switching.
- Restart API and verify timer catch-up; inspect oldest pending payment/refund/notification, not just “server running.”

These are acceptance gates, not tests claimed as executed by this migration document.

## Backup, cutover, and recovery

Before real patient data, define who owns backups, where encrypted exports are stored, how keys are protected, acceptable data loss (RPO), and restoration time (RTO). A daily export can lose nearly a day of work; decide whether that is acceptable with the clinic. Export using a Postgres-compatible `pg_dump` or documented Supabase tooling over the suitable connection and restore into a separate empty environment. Record timing, row counts, and successful sign-in/booking verification. Keep at least one backup outside the primary project/account failure domain. Retain events/audit history according to an explicit policy, not quota pressure.

For this fresh demo cutover, keep existing config available until verification succeeds. If the new API fails before any genuine data exists, revert its environment/config to a known working staging destination or keep the pilot closed while repairing. **An expired/deleted Render database is not a working rollback target.**

Once new patient writes have started, do not simply point back at an older empty database: that loses bookings and breaks payment reconciliation. Stop new bookings, preserve both datasets and webhook receipts, reconcile money and queue state, and follow the agreed recovery procedure. Deploy rollback and data rollback are different operations.

## Hosting and spending triggers

Replacing Postgres does not stop Render Free from sleeping after 15 idle minutes. Its workers pause, push/reconciliation are late, and reconnect may wait for a cold start. Treat it as a demonstration/supervised validation bridge; arrange always-on execution before a clinic relies on it. No no-card free host has been verified here to guarantee this app's required uptime.

Vercel's [Hobby policy](https://vercel.com/docs/plans/hobby) restricts personal/non-commercial use. Evaluate [Netlify Free](https://www.netlify.com/blog/introducing-netlify-free-plan/) for the commercial console: its [Next.js adapter](https://docs.netlify.com/build/frameworks/framework-setup-guides/nextjs/overview/) supports the relevant framework features, but a preview needs to prove this app's session cookies, middleware, Server Actions, and socket origin. Current free accounts have [300 credits/month with pausing at the limit](https://www.netlify.com/pricing/), so meter actual usage.

Review storage/egress, DB connections, p95 query/command latency, oldest unresolved payments/refunds, worker lag, and hosting credits at least weekly during the pilot. Set alerts before quota exhaustion. Upgrade or change the arrangement when reliable clinic-hour execution, backup needs, measured workload, or contractual obligations require it—not only after a free account stops serving traffic.

## Cutover checklist

- [x] Account/payment/session-integrity blockers repaired and regression-tested locally.
- [x] Supabase project created; correct region and Data API disabled.
- [x] Supabase connection configured privately in Render; API readiness confirms DB and Redis are reachable.
- [x] All 14 committed migrations applied; no destructive command used; app tables are empty.
- [x] Render API deployed against Supabase; public service URL preserved.
- [ ] Fictional two-tenant functional checks pass on a supervised staging dataset.
- [ ] Payment recovery, real-device push, auth expiry, offline/reconnect verified.
- [ ] Independent backup restored successfully; RPO/RTO agreed.
- [ ] Commercial web hosting and clinic-hour API uptime suitable.
- [ ] One clinic supervised before expanding to the other three.

The API's database connection is working, but this is not a patient-ready release. Supabase's inventory flags RLS disabled on all 19 tables. The Data API is disabled, and a direct privilege audit found no table CRUD grants to `anon` or `authenticated`; migration `202610160004_restrict_supabase_api_roles` removes their remaining table/sequence grants and future defaults. They retain `USAGE` on the `public` schema, which by itself does not grant table access. The backend's `postgres` role bypasses RLS, so this does not provide row-level database isolation for Prisma. Keep the Data API disabled and complete a restricted runtime-role and tenant-context design before real patient data or direct client access. Render Free sleeps and is not suitable for clinic-hour availability.

The permission-hardening migration is verified in CI with simulated Supabase roles and broad legacy defaults, including a rolled-back future table/sequence probe. After deployment, confirm the migration is finished and `has_table_privilege` reports no table permissions for either client role. Default privileges are scoped to the migration owner; create application objects through Prisma migrations, not as `supabase_admin` in the Dashboard. See the [data access model](security/data-access-model.md) for the role split and row-policy rollout design.

Migration `202610160003_covering_fk_indexes` is applied. The `OPDSession.currentProviderDoctorId` and `Notification.entryId` foreign-key indexes are present in the hosted schema.
