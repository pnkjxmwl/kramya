# Kramya data access model

Reviewed 16 October 2026. This is a rollout design; the row policies and runtime-role
split below have not been implemented. The deployed API currently enforces ownership
through NestJS authorization and scoped Prisma queries.

## Verified boundaries

- Clients talk to NestJS, not to Supabase REST, GraphQL, Auth, or Realtime. The Data API
  is disabled. Supabase documents that disabled Data API endpoints do not respond,
  regardless of table grants or RLS: [Securing your API](https://supabase.com/docs/guides/api/securing-your-api).
- The pre-hardening privilege audit found zero SELECT/INSERT/UPDATE/DELETE table
  grants for `anon` and `authenticated`. Both retained TRUNCATE, REFERENCES, TRIGGER
  and MAINTAIN privileges on all 19 public tables; migration `202610160004` removes
  all table/sequence grants for these unused roles, plus the migration owner's
  per-schema defaults for future objects. It leaves Supabase-managed roles and
  schema USAGE alone. That is a grant boundary, not tenant row isolation.
- `postgres` has BYPASSRLS. The current backend connection uses that project role.
  Enabling RLS alone therefore would not constrain backend requests.
- `TenantGuard` resolves active membership from hospital/session route parameters.
  `RolesGuard` checks the role within that membership. Patient services scope by
  authenticated account. Existing tenant/config/payment tests cover several
  cross-account and cross-hospital cases; they run as the test database owner and
  do not prove RLS enforcement.

## Intended row boundaries

These rules describe access intent, not a blanket SQL policy. Role-specific commands
must retain their current API checks even after database policies are introduced.

| Tables | Required scope |
| --- | --- |
| Account | Own account profile; credential lookup and staff invitations require a narrowly defined auth path. Never expose password/Google identity fields through discovery. |
| Patient | Account-owned profiles belong to that account. Walk-in profiles have no account; hospital access must follow a booking/consultation relationship, not `accountId IS NULL`. A visit at one clinic must not expose another clinic's history. |
| RefreshToken, PushToken, Notification | Own account, plus explicitly scoped token/notification processing. Refresh-token exchange must work before an access token is available. |
| Hospital, Department, Doctor, OPDSession | Staff see their hospital's configuration. Discovery sees only the verified/active/listable subset and existing public response fields. Row access does not restrict columns. |
| HospitalStaff | Own memberships for tenant selection; hospital admins manage memberships within their hospital. Invitation-token acceptance is a separate, single-use authorization path. |
| DoctorSchedule, QueuePolicy | Hospital-scoped configuration. Discovery reads only the policy information it needs through the API. |
| QueueEntry, Payment | Account owners see their bookings/payments; staff operate the selected hospital under current role rules. Owner, hospital, session and patient relations must agree on inserts and updates. |
| Refund | Follow the owning Payment's account/hospital and allowed financial commands. |
| QueueEvent, Consultation | Staff access within hospital; patient access only through their own booking and the API's allowed response fields. Raw event metadata and other patients' histories stay private. |
| AuditLog | Append-only operational writes; hospital records restricted to authorized staff, platform records to operators. No general patient read policy. |
| _prisma_migrations | Migration/operator access only. Runtime code needs no access. |

## Runtime-role and RLS implementation sequence

1. Separate migration credentials from runtime credentials. The migration owner runs
   DDL; a dedicated non-owner runtime role must have no CREATE, role-management,
   TRUNCATE or BYPASSRLS privileges. Keep both credentials in deployment secrets.
   The current Render build runs Prisma migrations using DATABASE_URL, so change the
   deploy path at the same time; swapping only the runtime URI would break migrations.
2. Implement trusted database context for every caller. It must include the verified
   account, resolved hospital and operation class. Nest guards, public auth endpoints,
   discovery, WebSocket subscription checks, signed payment webhooks and background
   sweepers need explicit coverage. HTTP controller middleware alone is insufficient.
3. Bind context to the same Prisma transaction/connection as each protected query.
   Use transaction-local settings and fail closed when context is missing. Never SET
   persistent connection state and assume the next pooled query uses that connection.
   Existing services contain both interactive transactions and standalone queries;
   the context design must preserve their locks, atomicity and post-commit emits.
4. Add policies with SELECT/INSERT/UPDATE/DELETE permissions separately and both USING
   and WITH CHECK for updates. Match the table scopes above. Do not use auth.uid():
   Kramya uses its own JWT system, so Supabase Auth identity is not present.
5. Exercise a non-owner, non-BYPASSRLS connection in isolated PostgreSQL. Test two
   clinics, two patient accounts, a multi-clinic staff member, disabled membership,
   walk-ins, invitation/login/refresh, public discovery, jobs and payment recovery.
   Test missing context, forged hospital/owner changes, and alternating concurrent
   requests through a small pool for context leakage. Include policy query plans.
6. Roll out to disposable staging, run those workflows with fictional fixtures and
   verify permissions plus app behavior. Only then promote for a supervised clinic
   pilot. Keep the Data API off; direct client database access is not part of this design.

Custom session settings are supplied by trusted backend code, not end-user SQL.
They do not protect a compromised backend/credential from impersonating a context.
Parameterized queries, application authorization, restricted grants and secret
handling remain necessary.

## Verification of the current grant change

CI creates the otherwise absent Supabase client roles and broad per-schema default
grants before applying all Prisma migrations. It then verifies no table/sequence
privileges remain, including on a newly created probe that is rolled back. Hosted
verification must independently confirm migration completion, effective ACLs/default
ACLs and API readiness. No hosted application records are needed for this check.
