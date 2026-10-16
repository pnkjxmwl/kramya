# Staging runbook — Supabase + Render

This describes the current disposable staging setup. The previous Render Postgres expired;
the `Kramya` Supabase project now holds the application schema. Keep all records fictional.
This free setup is for supervised demos and verification, not clinic-hour availability or
real patient/payment data.

## Current services

- Web console: Vercel deployment at `https://kramya.vercel.app`.
- API: Render `opd-api` at `https://opd-api-koes.onrender.com` (Free, Singapore; it sleeps).
- Database: Supabase `Kramya` in Mumbai. The API uses the Session Pooler URI configured as
  the private Render `DATABASE_URL`; never copy that value into chat, Git, logs, or a
  client-side variable.
- Redis-compatible Key Value: existing Render `opd-keyvalue` service.
- Database state: 15 Prisma migrations complete; all application tables empty. The current Render API deployment reports the database and Redis healthy at `/health/ready`.

## Read-only health checks

Use the API's actual liveness and readiness routes:

```sh
curl -i https://opd-api-koes.onrender.com/health
curl -i https://opd-api-koes.onrender.com/health/ready
```

The readiness route should return `200` and report both `database: up` and `redis: up`.
The first request can take time while Render wakes the free service. Liveness alone does not
prove the database connection is usable.

The web demo uses local fictional fixtures and explicitly says that changes are not saved:

- `https://kramya.vercel.app/demo`
- `https://kramya.vercel.app/demo/queue`

These pages verify the demo UI only; they do not exercise a deployed account, database
write, payment provider, or real-time session.

## Isolated integration testing

Run API integration tests only against the dedicated local/CI PostgreSQL test database.
The suite creates and truncates test data. Never point its `DATABASE_URL` at Supabase or the
Render API's configured database. Do not run `prisma migrate reset`, `migrate dev`, `db push`,
or an unrestricted `TRUNCATE` against the hosted project.

Before running a hosted functional test, create a dedicated fictional staging tenant and
accounts using the supported onboarding path. Confirm the target project and tenant first;
do not use real patient names, phone numbers, payment details, or invitation links in
reports. Keep credentials in a password manager or deployment secret store. Remove demo
records only through an explicit, reviewed cleanup procedure after verifying that the
target contains no real activity.

## Deployment and migration changes

Render deploys the API from `main`. The build command generates Prisma Client, builds the
API, and runs `prisma migrate deploy`. Keep migration changes additive and backward
compatible with the currently running API; do not edit a migration that has already run.
Review the Render Blueprint diff before syncing it, and preserve the existing service names
and public URLs.

After deployment, check `/health/ready`, inspect Render deployment status/logs, and verify
that the expected migration is complete. A successful build alone is not a functional
clinic workflow test.

## Before onboarding a clinic

The current environment still has release gates:

- Supabase reports Row Level Security disabled on the application tables. The Data API is
  disabled, but database policies still need a deliberate design and review before direct
  client access or real patient data.
- Render Free can sleep after inactivity; API workers and WebSockets stop while it sleeps.
- Backups and restore have not been proven. Agree an RPO/RTO and rehearse a restore outside
  the primary project before patient data is entrusted to the service.
- Run a fictional two-tenant authorization check, payment/webhook recovery checks, session
  closure checks, real-device auth/push/reconnect tests, and a complete clinic workflow.
- Use a commercially appropriate web hosting plan and an always-on API before clinics rely
  on the product during operating hours.
- Establish privacy, access logging, retention, deletion/export, support, incident response,
  and clinic fallback procedures with qualified advice for the applicable requirements.

See [the architecture and pilot review](reviews/2026-10-15-architecture-and-pilot-review.md)
and [the Supabase migration plan](supabase-migration-plan.md) for detail.
