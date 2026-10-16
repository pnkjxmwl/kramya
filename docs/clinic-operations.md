# Clinic operations and recovery

The hosted environment contains fictional TEST clinics. It remains staging.
Render Free can sleep; its timers, sockets, ETA refresh and notifications then stop.
No code change can promise clinic-hour availability on that plan. Do not use
artificial keep-alive traffic as an availability guarantee. No paid upgrade is
authorized or activated.

Before a real clinic pilot, the founder and clinic must agree opening hours,
support ownership and fallback contacts. Proposed starting targets for approval:
backup recovery point at most 24 hours, restoration within 60 minutes, and
99.9% availability during agreed clinic hours. These are **targets, not achieved
service levels**. An always-on API/worker host and external monitoring must be
selected and demonstrated first. `DEPLOYMENT_AVAILABILITY=always-on` records a
verified hosting choice; the default is `best-effort` and changing the label alone
does not improve the service.

An active clinic admin can read `GET /hospitals/:hospitalId/operations`. It reports
worker successes/failures/staleness and counts of that clinic's payments/refunds
older than ten minutes. It includes no patient records or secret values.
`POST .../operations/preflight` performs a read-only Razorpay test credential
check and Firebase service-account/project authentication. It does not create
orders, send pushes, verify a real webhook delivery or clear the release gate.
Neither endpoint is available to patients or another clinic's staff.

The default `RAZORPAY_MODE=test` accepts only `rzp_test_` keys. Live payment keys
require an explicit mode change and are outside the staging rehearsal. Register
the test webhook at `https://opd-api-koes.onrender.com/webhooks/razorpay`, with
`payment.captured`, `payment.failed`, `refund.processed` and `refund.failed`.
The webhook secret differs from the API secret. A client checkout success does
not confirm payment; only verified server/provider state does.

At clinic opening, verify dependency readiness and worker progress, inspect stale
payments/refunds, and confirm the doctor/reception workflow is available. Alert
on a failed dependency, three missed worker intervals (at least 90 seconds), or
unresolved money-state backlog. A worker heartbeat proves sweeps ran, not that a
phone received a notification. This change supplies diagnostics, not an external
alert delivery service.

During an outage, reception owns a manual numbered queue. Stop offering online
booking, tell waiting patients to follow reception, and avoid giving a confident
ETA from stale data. Do not mark payments successful by hand. After recovery,
reconcile captured payments and owed refunds with Razorpay before reopening;
timers catch up from persisted state but cannot undo a missed clinic call. Record
the incident, affected time range and corrective action without copying patient
records into logs/issues.

Use the manual **Encrypted staging backup** workflow on a checked main commit.
It uses the existing protected migration credential and uploads only encrypted
archives/manifests for seven days. GitHub receives a public RSA recipient, never
the restore private key. The local `.env.backup-recipient.pem` must have a
recoverable, separately stored private copy. This retention is temporary staging
storage, not a complete long-term retention policy or an automatic daily schedule.

Download the encrypted artifact into `.backups`, create a new empty local
PostgreSQL 17 database `kramya_restore_<label>`, privately set
`RESTORE_DATABASE_URL`, then run `node scripts/hosted-backup.mjs restore LABEL`.
The export covers `public` plus `kramya_private` policy helpers, not Supabase Auth,
Storage files, Redis, secrets or payment-provider state. Roles/ACLs are excluded:
re-establish the restricted role and projection/helper grants before app smoke
testing. Compare table counts, migration checksums, constraints and projections.
Record the exact artifact hash and measured recovery time. Rehearse again after
RLS activation, because policies add role dependencies to restoration.
