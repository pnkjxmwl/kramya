# Staging runbook — refreshing the data, and replacing the database

Operational companion to `render.yaml`. Covers the two things that will be needed
repeatedly on the Render staging environment: **putting fresh data in**, and **rebuilding
the database after Render deletes it**.

Part of `P10-TEST-01`. The other half of that subtask — the full patient journey on a real
phone — is not this document and is still not done.

---

## 0. The distinction that matters

**Render's 30-day clock is on the database instance, not on the rows inside it.**

Emptying the tables and pushing new data does not reset it. The expiry date is fixed at the
moment the instance was created, and on that date Render suspends and then deletes the whole
Postgres server — schema, rows, connection string and all. Nothing done to the contents
moves that date; the only thing that does is upgrading to a paid compute plan before
deletion.

So there are two separate procedures and they answer two different questions:

| Question | Procedure |
|---|---|
| "The demo data is stale / wrong / I want it clean" | **§1 — refresh the data.** Same database, no new anything. |
| "Render deleted the database" | **§2 — replace the database.** New instance, then §1. |

Do not reach for §2 to solve a §1 problem. Recreating the instance to get fresh rows is
slower, riskier, and fixes nothing that §1 does not.

---

## 1. Refresh the data (living database)

`scripts/demo-data.mjs` builds four hospitals — Sunrise Multispeciality, Lotus Care
Hospital, Green Valley Clinic, Nirmal Health Point — with departments, doctors, today's
sessions and partly-worked queues. It does it through the real API: onboard script →
`POST /auth/accept-invite` → ordinary authenticated calls, so every write passes Zod, the
guard pipeline, tenant scoping and the queue domain commands. It is a live smoke test of
those paths as well as a fixture.

Credentials live in **`.env.staging-demo`** at the repo root (gitignored): the four admin
emails, the shared `ADMIN_PASSWORD`, `API_URL`, `CONSOLE_URL`.

### 1a. Top up — the normal case

Run it again. It is idempotent: a duplicate hospital name+city is treated as success and it
logs in as the existing admin; departments and doctors are matched by name; sessions are
unique on (doctor, date, start) and a duplicate is recovered rather than dropped; walk-ins
top up to a target depth; a queue is only advanced if nobody has worked it yet.

```sh
set -a; . apps/api/.env.render; set +a       # DATABASE_URL, gitignored — needed for onboarding only
set -a; . .env.staging-demo;   set +a        # API_URL, ADMIN_PASSWORD
node scripts/demo-data.mjs
```

Sessions are dated for the day the script runs and go stale at IST midnight, so **this is
the routine you run before any demo or walkthrough**, not an exceptional repair.

`DATABASE_URL` is needed only for step 1 (hospital creation has no endpoint — `Role` is
ADMIN | RECEPTION | DOCTOR with nothing above it, by design). Omit it and the script skips
straight to populating existing tenants over HTTP.

Stale sessions from previous days are left behind, completed and harmless. If that is all
that is wrong, stop here.

### 1b. Wipe to empty — the escape hatch

Only if you genuinely need an empty schema. **`prisma migrate reset` drops every row**, and
`scripts/no-migrate-dev.mjs` refuses it against any non-local host on purpose. The bypass is
to call prisma directly — acceptable *only* because this staging database is throwaway and
holds no real patient:

```sh
set -a; . apps/api/.env.render; set +a
pnpm --filter @opd/api exec prisma migrate reset --force    # DROPS EVERYTHING
```

No `prisma.seed` is configured, so this leaves a migrated, empty database — then run §1a.

Never run this against anything a hospital uses. On that day the honest answer is a
compensating migration, not a reset.

---

## 2. Replace the database (after expiry)

Render deletes the free Postgres 30 days after creation, with a 14-day grace period first.
During the grace period it is suspended and unusable; **upgrading before deletion is the only
way to keep that instance and its data.** Assume you did not.

1. **Create the new instance named `opd-postgres`**, region Singapore, Postgres 16,
   `databaseName: opd` — exactly as in `render.yaml`. The name is load-bearing: the API's
   `DATABASE_URL` is wired as `fromDatabase: name: opd-postgres`, so a matching name
   rewires itself and any other name means editing that env var by hand in the dashboard.
2. **Redeploy the API.** `pnpm --filter @opd/api prisma:deploy` is the last step of
   `buildCommand`, so migrations apply themselves against the empty database. Nothing to run
   locally. (It sits in `buildCommand` rather than `preDeployCommand` because pre-deploy
   commands are paid-only and would be silently ignored on free — see `render.yaml`.)
3. **Update `apps/api/.env.render`** with the new connection string. This file is only ever
   read by `demo-data.mjs`; never pass a connection string on the command line, where it
   lands in shell history.
4. **Run §1a** to repopulate.
5. **Restart the service if you edited any env var by hand.** `env()` memoises at first
   call, so a saved change does nothing until a restart.

### What is unaffected

- **The API URL.** `https://opd-api-koes.onrender.com` does not change, so no client needs
  rebuilding — not the console on Vercel, not the Expo app, not the native APK. Nothing
  about a replaced database reaches a phone.
- **Secrets.** `JWT_*`, `CHECKIN_SECRET` (Render-generated), the Razorpay test keys and
  `PUBLIC_BASE_URL` all stay as they are.
- **Redis.** Holds Socket.IO pub/sub and rate-limit counters, neither durable. Ignore it.

### What is lost, permanently

Every account, hospital, session, queue entry, payment, `QueueEvent` and `AuditLog`. The
JWT secrets survive, which means old refresh tokens still verify but point at accounts that
no longer exist — everyone signs in again, and the admins are recreated by §1a with the
same emails and password.

---

## 3. Verify, in this order

Cheapest checks first; each one rules out the layer below it.

```sh
curl -s  https://opd-api-koes.onrender.com/health      # cold start takes ~30s on free — not a failure
curl -si https://opd-api-koes.onrender.com/ready       # 200 means migrations applied and the DB answers
```

Then sign in to `https://kramya.vercel.app` with an admin from `.env.staging-demo` and open a
queue board. If the board renders a doctor, a token and a live count, the database, the
migrations, the API, the console and the socket are all proven in one look.

Two things that are asleep, not broken: the first request after 15 minutes idle cold-starts,
and while the service is down there are no WebSockets and no sweepers — no ETA ticks, no
reservation expiry, no no-show timers, no arrival nudges. Do not judge Phase 7 or Phase 8
behaviour on the free plan.

---

## 4. When to stop doing this

This whole document exists because staging is disposable. It stops being true the day a real
hospital is onboarded: that needs a paid, always-on instance in an **India** region (Render
has none — Singapore is a recorded deviation, fine for test keys, never for real patients),
backups with a restore actually tested once, and expand-then-contract migrations. At that
point `render.yaml` is replaced rather than upgraded, and §1b is deleted from this file.
