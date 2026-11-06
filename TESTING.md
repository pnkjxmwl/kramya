# Kramya final acceptance checklist

Updated 19 October 2026 (Asia/Kolkata). Hands-on acceptance testing has started. Scheduled backups, retention automation and backup failure alerts are deferred at the founder's request; the existing manual encrypted backup and restore evidence remains valid. Demo UI testing is excluded from this pass. Work through the real Kotlin patient application and backend one item at a time.

## Acceptance run: 19 October 2026

- **Passed:** shared contract tests (42), workspace type checks and lint (two existing seed console warnings). Deployment destination safety tests passed (3).
- **Regression found and fixed locally:** the broad backend run passed 434 tests but failed one ETA case before its assertions because random fixture token numbers collided with the session/token uniqueness constraint. The consultation fixture now assigns deterministic unique numbers, reset per test. The subsequent ETA integration, engine and evaluation run passed all 57 cases. This is a focused rerun, not a new full-suite pass.
- **Passed separately:** all 12 actual restricted-login tenant isolation tests against a dedicated local database, with no skipped cases. These are intentionally skipped in the owner-backed suite and must be run separately.
- **Passed:** fresh staging-targeted debug APK build and all 47 Android JVM tests. APK updated in place on a Motorola Edge 50 Neo running Android 16. This is a debug acceptance build, not a store release.
- **Passed (founder observed):** patient sign-in, Mumbai TEST clinic browsing, doctors and available sessions on the phone. Hosted API checks independently confirmed login, visit-list access, database/Redis readiness, and three Andheri/two Bandra doctors with sessions for 19 October. The hosted check created no bookings.
- **Fixed and verified on the phone:** Pay opened a gray WebView with only Razorpay's TEST ribbon. Debug measurements showed a zero-height payment iframe despite a 776px viewport. Setting document root height alone passed 47 JVM tests but did not repair the device. Further inspection found Razorpay's inline `max-height:100dvh` computed as `0px`. Removing that cap immediately restored both container and iframe to 776.53px; the founder confirmed that the payment form became visible. The checkout document now overrides that cap while retaining the gateway's fixed 100%-height container. The permanent APK passed all 47 JVM tests and was installed. The existing Finish payment → Pay flow was exercised again without a debugger layout patch, Razorpay TEST Netbanking completed, and the app returned to token C001 with its check-in QR. Independent patient/reception API reads both returned CONFIRMED with payment SUCCESS; a signed check-in code was issued. Proof is privately retained in `.backups/acceptance-payment-20261019.proof.json`. This proves server confirmation; the originating webhook request was not independently traced in provider delivery logs.
- **Scope:** no demo UI acceptance, paid hosting change, automatic backup setup or clinic accuracy claim is included. The founder reports configuring a five-minute external health monitor; this is not an availability guarantee.
- **Failed-return regression fixed on the phone:** Razorpay's TEST mock-bank Failure returned a POST that bypassed Android's GET navigation callback and exposed the backend's missing POST route. The app now intercepts the exact server-provided return endpoint for POST as well, consults server status and offers a cautious retry message for a failed payment. A real TEST Failure in Bandra returned to booking without raw JSON; the API independently showed the hold still RESERVED and payment FAILED, with existing confirmed visits unchanged. The header is reduced from 76dp to 48dp while preserving a 44dp Close target and system-bar insets. All 50 Android tests and 41 local payment/route authorization tests passed. GET and POST backend fallbacks return neutral static HTML and cannot confirm a forged payment; hosted deployment is tracked separately.

## Current evidence

- [x] Checkout release `391904dac0f4f6a7ac09465f762ec35733cc2f2a` ([PR #24](https://github.com/pnkjxmwl/kramya/pull/24)) is live on 19 October. Main CI [39176992153](https://github.com/pnkjxmwl/kramya/actions/runs/39176992153) and protected deployment [39177273690](https://github.com/pnkjxmwl/kramya/actions/runs/39177273690) passed; Render `dep-dbalgftg1s2s73cii2i0` reached live. Hosted GET and POST returns both served neutral 200 HTML without reflecting forged fields; database/Redis readiness passed. Phone TEST failure returned to a cautious retry screen without raw JSON, with payment FAILED and its hold unpaid. The compact 48dp header and full-screen presentation are installed. Fifty Android tests, 41 focused API cases and full CI passed. Further queue/refund/push and clinic pilot acceptance remains pending.
- [x] Baseline live release before the checkout fixes was `b34465f50ccc15f9b3a6474da6f029dbefa235ea` (PRs #21–22). Main CI [39073557659](https://github.com/pnkjxmwl/kramya/actions/runs/39073557659) passed verify/native, including all twelve actual restricted-login cases with no skipped cases. Protected deployment [39073841972](https://github.com/pnkjxmwl/kramya/actions/runs/39073841972) applied all 20 migrations; Render deploy `dep-db9v405g1s2s73a5eslg` reached live. Final hosted login, discovery, temporary profile CRUD, queue reads and access denials passed; no runtime error logs were returned in the short post-deploy check window.
- [x] On 18 October 2026, Firebase project `kramya-39390` showed Android app `com.kramya.native` and Cloud Messaging V1 enabled. The staging APK signature was verified locally; its SHA-1 and SHA-256 fingerprints are both registered in Firebase. This does not prove server credential authentication, phone notification receipt or Google sign-in.
- [x] Kotlin is the sole patient app; Expo was removed in PR #15.
- [x] PR #15 passed 426 API tests, 42 contract tests, 72 web-console checks and 47 Android JVM tests. These are historical results, not automatic evidence for later changes.
- [x] Supabase/Redis readiness and the hosted web deployment were checked after PR #15.
- [x] Fictional hosted fixtures: two TEST clinics in Mumbai, five doctors, six accounts, six walk-ins, and 35 sessions for 16–22 October 2026.
- [x] Patient login/browsing on Android 16 and reception/doctor/admin web pages were checked with those fixtures. Android push registration succeeded; receipt of an actual notification has not been proved.
- [x] API checks rejected cross-clinic staff access and patient access to staff queues.
- [x] This safeguard/design change passed 426 API tests, 47 Android JVM tests and an Android debug build locally. Restricted-role SQL checks and eight backup/deployment safety checks passed. CI results are recorded on its PR.
- [x] Encrypted fictional local backup restored into an isolated PostgreSQL 17 database with matching table counts, foreign keys and indexes. This does not satisfy the hosted-backup recovery gate below.
- [x] Main-only GitHub migration environment has both private secrets. The final cutover workflow [38958710636](https://github.com/pnkjxmwl/kramya/actions/runs/38958710636) migrated and deployed checked commit `6b2dd2da6ab4653f2c2b5e07b4009ec121a2c264`; Render deploy `dep-db983j8m7kps73bglleg` reached live. Postgres showed actual `kramya_runtime` connections, with no privileged role attributes.
- [x] Limited hosted server checks after cutover passed: dependency readiness, patient login, clinic/department/doctor discovery, temporary profile create/update/delete, staff queue read, and 403 rejection of patient/staff and cross-clinic queue access. Existing profile count was unchanged; temporary sessions were logged out. This does not replace final phone/workflow acceptance.

Credentials are in the local, Git-ignored `.env.staging-test-access.md`. Never copy passwords, tokens or database URLs into this file. Test tenants are Andheri and Bandra; primary staff accounts belong to Andheri. Refresh or create sessions when the fixture dates expire. Never repurpose fictional patients as real clinic records.

## Before the final acceptance phase

- [x] Separate migration and API runtime database credentials; verify the deployed API actually uses the restricted role.
- [x] Move migrations out of the Render API build into the main-only migration workflow, turn automatic commit deploys off, and deploy the exact migrated commit.
- [x] Verify runtime grants and append-only history using a non-owner connection in isolated PostgreSQL; independently verify hosted role attributes, grants and runtime app behavior. Do not treat role restrictions as tenant RLS.
- [x] The operator rotated the old runtime-exposed postgres owner password and updated only GitHub's migration secret. [Workflow attempt 2](https://github.com/pnkjxmwl/kramya/actions/runs/38958710636/attempts/2) successfully authenticated and checked all 17 migrations with the replacement credential. Render retained its separate runtime URI; readiness and actual runtime-role connections remained healthy after rotation.
- [x] Final post-RLS hosted backup [39073924423](https://github.com/pnkjxmwl/kramya/actions/runs/39073924423) restored into fresh isolated PostgreSQL 17 on 18 October. All 19 table counts, 20 migration names/checksums, 37 foreign keys, 80 indexes, two views, six private helpers, 55 policies and three provenance triggers matched the captured source. Source counts were stable across export. Decryption/restore/comparison took 5.746 seconds; restore start through successful restricted-login API smoke took 24.374 seconds, excluding provisioning and incident detection. This single rehearsal is not an RTO guarantee. Login, discovery, temporary profile CRUD, queue reads and access denials passed; no temporary plaintext files remained. Proof is privately retained in `.backups/hosted-rls-recovery-20261018.proof.json`. No automatic backup schedule is active.
- [x] The founder confirmed private off-computer copies of the backup recipient key and staging Android signing files. This records custody, not a successful hosted restore.
- [x] Context/projections were deployed first in `f6f0748`, followed by RLS activation in `7611df6` and per-action policy cleanup in the final release above. All 19 tables have forced RLS, with 55 policies and three provenance triggers. Actual runtime connections remain unprivileged; public client roles cannot access projections/private helpers. Hosted checks passed and all twelve non-owner cases pass in CI. The database advisor reports no overlapping policies; migration-history no-policy and unused-index notices are informational and reviewed in the security runbook.
- [ ] Decide clinic-hour availability, recovery objectives, support and clinic fallback procedures. No paid hosting changes have been authorized.
- [x] Firebase project/package matching, server credential authentication, local staging release signing and both registered certificate fingerprints are verified. The signed staging APK passed signature verification and its build passed 47 release JVM tests. Private key custody was confirmed separately. Phone installation, delivery and any store-signing/distribution setup remain final acceptance work; this staging key is not a confirmed existing Play identity.
- [x] On 18 October, the deployed admin-only operations preflight authenticated Razorpay in TEST mode and Firebase with matching project `kramya-39390`. Database/Redis readiness passed and the payment/refund backlog older than ten minutes was zero. This proves credential authentication only; real webhook delivery and phone receipt remain unchecked. Proof is privately retained in `.backups/hosted-provider-preflight-20261018.proof.json`.
- [x] On 18 October, Razorpay TEST dashboard showed the Render webhook enabled at `https://opd-api-koes.onrender.com/webhooks/razorpay`, subscribed to `payment.captured`, `payment.failed`, `refund.processed` and `refund.failed`, with a secret supplied. The old development tunnel webhook was disabled. Secret equality and actual signed delivery remain untested; final checkout must prove them. No synthetic SUCCESS payment records were inserted into hosted staging.

## Final phase: Android UI and navigation

- [x] Install the debug acceptance candidate on Motorola Edge 50 Neo / Android 16, version `0.0.1-debug`, with the staging API target. Source is the working tree based on `f6f0748`, including the local checkout viewport fix. This is not a published release; its installed booking flow was exercised successfully above.
- [x] Full-screen checkout verified on the Android 16 phone on 19 October: a separate modal window covers all three app tabs, payment methods render with the prior viewport fix, Android Back and the Close button both return to booking, and the same unpaid checkout reopens successfully. The updated APK passed all 47 JVM tests. This presentation test used the fictional Paediatrics session and submitted no payment; the earlier C001 payment confirmation evidence belongs to the preceding build. Local screenshot: `.env.checkout-fullscreen-20261019.png`.
- [ ] Verify forward navigation, Back, tab changes and returning to each tab's saved stack have no fade transition or artificial delay. Distinguish navigation from a real network/loading wait.
- [ ] Review Kramya colours, typography, spacing, navigation selection, primary buttons and clinic/doctor cards across Discover, Visits, Profile and authentication.
- [ ] Check small screens, large fonts, long names, keyboard visibility, touch targets, TalkBack labels and selected-tab announcements.
- [ ] Check missing images, empty lists, validation failures, offline/stale states, retry, loading placeholders and permission denial.
- [ ] Review web reception/doctor/admin screens on desktop and narrow layouts. Confirm prices, state labels and ETA language agree with Android.

## Final phase: one complete patient/staff journey

- [ ] Sign up/log in; create and select self/family profiles; restart the app and restore a session.
- [ ] Choose Mumbai, a TEST clinic, department, doctor and current session.
- [ ] Book with a verified test-mode payment; verify server webhook confirmation, token and receipt. A client success screen alone is insufficient.
- [ ] Check in from reception using QR and token number. Verify the patient's visit and staff queue update.
- [ ] Call, start and complete consultation from the doctor account. Check all views and the event/audit history.
- [ ] Test pause/resume, doctor absent/on break/left, substitution, emergency priority, skip/recall/requeue, registration closure and session closure.
- [ ] Test cancellation, refund, duplicate webhook, abandoned checkout, delayed capture and recovery after interrupted requests.
- [ ] Switch accounts and clinics; verify cache, sockets and push registration follow the current identity and cannot expose the previous account.

## Final phase: notifications and reconnect

- [ ] Test leave-now, called, recalled and cancellation notifications in foreground, background, killed-app and locked-phone states.
- [ ] Verify tap-to-visit, correct account ownership, permission denied/re-enabled and token refresh. Provider submission is not proof of device receipt.
- [ ] Disconnect/reconnect Wi-Fi/mobile data, resume after inactivity and rotate expired access tokens. Check stale-data warnings and refreshed queue/ETA.
- [ ] Exercise a sleeping free backend; measure the effect on API startup, workers, sockets and timely notifications before deciding clinic readiness.

## Final phase: supervised ETA pilot

- [ ] Agree numeric error, window-width/coverage, patient waiting and missed-turn targets with one clinic before the pilot.
- [ ] Capture a baseline from the existing clinic process. Train reception to record presence, pauses, check-ins, calls and consultation starts promptly.
- [ ] Run `eta:report` for a bounded clinic/date cohort; review first-call and consultation-start errors, exclusions, notification timing and sample count.
- [ ] Observe arrival-to-consultation waiting and patient/staff satisfaction separately. Do not infer time saved from forecast error alone.
- [ ] Investigate early calls, late starts, missed turns and missing pushes. Tune on one set of days and validate on held-out days.
- [ ] Expand from one supervised clinic to 3–4 clinics only after the agreed acceptance targets are met. See [the ETA pilot guide](docs/pilot-eta-validation.md).

## Result record

For each checked item record date, commit, role/TEST clinic, expected result, observed result and an issue link when it fails. Use fictional identifiers and redact screenshots. Mark **passed**, **failed**, **blocked** or **not run** explicitly; an unchecked box is not a pass.

## Reservation-first rollout acceptance (2026-11-01)

Plan: docs/reservation-release-plan.md. These checks are pending unless an explicit result is recorded below/in PROGRESS.md. Use fictional patients and isolated local databases. Exclude demo UI.

- [ ] AT_CLINIC default rejects legacy /join without creating an order; /reserve works without gateway configuration. Historical signed capture/refund recovery still works.
- [ ] Simultaneous /reserve retries return one token/QR. Competing patients cannot exceed the session cap; account limits hold across concurrent sessions, family bookings and separate API instances.
- [ ] Another patient's ID, another clinic's staff, unsigned/tampered check-in QR and anonymous requests are rejected. Repeat under the actual restricted database login.
- [ ] Same patient cannot reserve overlapping sessions; genuine family bookings remain possible under the configured active-account ceiling. Expired/cancelled visits do not consume the active-account ceiling.
- [ ] New token is CONFIRMED with no Payment/order and no hold expiry. It appears after navigation, refresh, relaunch and offline→online recovery; duplicate retries do not create extra tokens.
- [ ] Discovery and booking say reserve/pay at clinic. No Android checkout is reachable. Legacy unpaid holds can be reviewed/cancelled, with clear caution about any prior bank debit.
- [ ] Reception scans/looks up the session-specific token, verifies the person, collects clinic payment under clinic policy and checks them in. Duplicate check-in preserves the original arrival timestamp.
- [ ] Absent reservations cannot be called or hold up present patients. Validate walk-ins, emergency priority, early/late arrival, skip/recall/requeue, doctor absence/break, pause/resume, cancellation and end-of-session.
- [ ] Cancelling a clinic-payment reservation produces no gateway refund and makes no refund promise. Any cash/external-UPI issue is directed to the clinic.
- [ ] Confirmed reservations are not expired by the old unpaid-hold sweeper. Session-end outcomes and patient messages accurately explain unserved/no-show visits.
- [ ] Verify phone ownership and repeat-abuse policy before public remote booking; account/IP rate limits alone are not proof of identity.
- [ ] Complete the separate Play readiness gates: push logout/account switch/offline, account deletion/recovery, public privacy/support, production separation, maintained reviewer access and current signed internal-distribution release.

Local verification: TypeScript across API/web/contracts passed; 43 pure API tests and 42 contract tests passed; API lint has no errors (two pre-existing seed warnings). New reservation database tests, restricted-role tests and Android/phone acceptance remain pending. Initial Android build failed because the previously installed SDK was deleted; founder authorized reinstall.

Android tooling update (2026-11-01): founder authorized SDK reinstall. Project-local .env.android-sdk now supplies API 36/platform-tools/build-tools; local.properties points there. Reservation debug build passed and all 40 remaining Android JVM tests passed (ten removed checkout-only tests no longer apply). Do not install/distribute against the unchanged hosted backend: /reserve must be deployed and verified first. Database/phone/staff and release privacy acceptance are still open.

Database acceptance update (2026-11-01): Docker Desktop/WSL restored; PostgreSQL/Redis healthy. Five local suites passed all 85 tests (41 reservation/payment, 14 queue scenarios, 7 locking, 15 ETA, 8 authorization). Actual restricted-login suite passed all 14 tests, including concurrent account ceilings across clinics and reservation→QR/token check-in→consultation completion with no Payment record. Private reproducible runner: .env.run-reservation-tests.ps1; logs: .env.reservation-database-tests.log and .env.reservation-rls-tests.log. Tests use only dedicated local *_test databases. These results supersede the earlier local-runtime blocker; manual clinic/phone acceptance and later release/privacy gates remain open.

## Account and notification acceptance update (2026-11-01)

Automated local evidence (not hosted or phone acceptance):
- [x] Hash-only, expiring, purpose-bound and single-use account proofs; concurrent password reset has one winner; old access/refresh credentials stop working.
- [x] Disabled email delivery returns the same unavailable response for known/unknown addresses, issues no proof and sends nothing.
- [x] Password-confirmed deletion scrubs account/family details, revokes access/devices, cancels eligible reservations through audited queue commands and records clinical/staff handover requests for retry.
- [x] Actual restricted database login: 15 tests passed after the realtime fix, including account proof isolation and reservation-to-consultation without a Payment.
- [x] All 21 realtime tests passed after fixing immediate subscription racing asynchronous authentication; all 8 account-control tests passed in the same targeted run. Earlier full API run passed 450 tests and found 7 realtime failures; other 32 test files passed. A second complete run after the fix has not been performed.
- [x] API/web type checks and API lint passed (two existing seed warnings); web production build passed. New public privacy/support/delete-account/account-action routes returned 200 without login. Subsequent copy edits clarify that delivery is disabled.
- [x] Android debug build and 45 JVM tests passed for guarded push, logout retry and account UI. No updated APK was installed during this unit.
- [ ] Verify on two fictional phone accounts: foreground/background/locked/delayed push, offline logout, restart, reassigned device, notification tap and account switch. Older clients retain legacy notification-format delivery and must be updated before claiming the local privacy guard covers every install.
- [ ] Select and explicitly authorize an email sender; verify actual reset/verification/deletion delivery and safe one-time links. No Brevo/Gmail integration or paid SMS is enabled. Keep REQUIRE_VERIFIED_EMAIL_FOR_RESERVATIONS=false until delivery works.
- [ ] Verify passwordless/external account deletion fulfilment, publish reviewed retention/privacy disclosures, and test native deletion/recovery against the coordinated deployed backend.
- [ ] Agree repeat-misuse evidence, review/appeal rules and clinic arrival policy. Session closure alone must not trigger an automatic misuse sanction.
- [ ] Coordinate migration/API/web/native rollout, production/reviewer separation, final device/staff acceptance, signed internal-distribution release and supervised clinic ETA pilot.

Logs are ignored local files: .env.release-account-full-tests.log, .env.release-account-realtime-tests.log, .env.release-account-rls-final.log, .env.release-account-web-build.log and .env.release-account-final-types.log. All database suites used explicitly isolated localhost test databases. The public-page HTTP check excluded demo routes.

## 1 November final local evidence and remaining acceptance

Current source only; no hosted deployment. Tests used explicit loopback *_test Postgres and isolated Redis. Demo UI excluded.

| Check | Result |
|---|---|
| Full API regression | 473 passed; 18 restricted-role cases skipped here and run separately |
| Final actual non-owner RLS | 18 passed, including tenant isolation, owner-only approval/listing control, observed advisory-lock waiting and post-erasure review refusal |
| Final focused regressions | 22 account/release/clinic/public-deletion cases plus 48 queue-lock/payment cases passed; overlapping, not unique totals |
| Public deletion | 3 real web-route-to-local-API tests pass; credentials/proofs never returned to browser |
| Staff private feedback | 2 encryption/expiry/tamper/cross-login/session tests pass |
| Runtime grants | SQL probe passes, changes rolled back |
| Android debug/release | 48 unit tests per variant; signed staging APK/AAB passes |
| Native release lint | 0 errors, 41 warnings; not store acceptance |
| Packaging | Current APK signature, 16 KB ZIP and APK/AAB 64-bit ELF alignment pass |
| Production boundary | Release without explicit distinct production API/web URLs refuses as intended |
| Real local reception UI | Clinic/policy save+reload, booking pause/lift, reservation(no Payment), check-in/call/start/complete, walk-in and name-free search/confirmation URL pass |

Ignored local evidence: .env.release-complete-api-tests.log, .env.release-coordination-rls-tests.log, .env.release-booking-coordination-tests.log, .env.release-coordination-queue-tests.log, .env.release-complete-android.log and .env.release-native-artifact-proof.json. Do not publish these private local files.

Remaining explicit acceptance:

- [ ] Coordinated exact-SHA staging CI, owner migrations, API/console deployment and compatible native installation.
- [ ] Phone reserve/retry/relaunch/offline cancellation; native layout, large font, TalkBack and back navigation.
- [ ] Foreground/background/locked/force-stop push; account A, offline logout, account B with delayed pushes; token reassignment and deep links.
- [ ] Camera QR scan with approved permission. Manual token/list check-in passes locally.
- [ ] Separate empty production dataset, hosts/secrets, correctly tagged clients and invited APPROVED_ONLY accounts; actual clinic-hour API/worker/realtime availability.
- [ ] Verified lost-password/Google-only deletion fulfilment, final retention/disclosures and production public pages. Automatic mail disabled.
- [ ] Play account/verification/signing/internal track, reviewer access, disclosures and actual 16 KB device.
- [ ] Complete roster navigation/aggregates before sessions exceed 200 records. Truncation warnings are not full large-hospital acceptance.
- [ ] One-clinic staff agreement/training, outage fallback and supervised held-out ETA/waiting/missed-turn targets before expansion.

No live email/SMS, payment, provider signup, production setup or scheduled backup automation was performed.

### Final console/build checkpoint (1 November)

The existing full staff-console HTTP/server-action walkthrough passed **72 checks, zero failures** against a freshly migrated/seeded local kramya_console_release_test database; provider credentials and workers were disabled. Final API build/typecheck/lint and Next production build/typecheck/lint pass. API lint retains two existing seed console warnings; Next notes the existing ESLint plugin configuration. The first final Next build caught a Windows-encoding error in a new save-label character; corrected to UTF-8-compatible source and the full build passed. The populated-production initializer was also exercised against a populated isolated local test database: it refused initialization and its marker remained STAGING. No hosted environment changed.

### Device availability update (1 November)

Founder confirmed no Android phone is available. Physical-device acceptance is deferred, not passed; do not repeatedly request a USB connection. The local SDK contains build/platform tools but no emulator executable, system image or configured AVD. Existing automated/native build and local reception results remain valid. Emulator setup may cover native functional/UI checks later, but physical push/background behavior and Play-delivered acceptance still require appropriate devices. Continue release preparation independently of phone availability.

## Razorpay restoration acceptance — 5 November 2026

This supersedes the new-booking pay-at-clinic decision in the 1 November section. ONLINE is the default; AT_CLINIC is explicit compatibility only. Plan: docs/payment-restoration-plan.md. Existing confirmed clinic reservations remain valid and are not marked paid or charged retroactively.

Covered by payment regressions: server-derived fee, no-payment endpoint refusal, no QR before signed capture, forged callback/signature rejection, repeated/concurrent requests, same-order resume, failed attempt then success, gateway order error/retry, account cap including unpaid holds, profile ownership/overlap/review pauses, expiry/abandonment, cancelled or stale second checkout, late capture/capacity/session closure, duplicate refund safety, historical reservation preservation and read-after-relaunch. Gateway interactions are faked; database transactions, HMAC and authorization are real. Sub-INR-1 fees are unsupported for online checkout and refuse without allocating a hold/payment.

- Initial focused API run: 65 passed.
- Actual restricted-role suite: 18 passed separately.
- Complete API, final debug/release Android tests/lint/signature and web build results will be recorded below after completion.
- Still deferred: real Android full-screen/UPI handoff/back/cancel, offline/process-death/payment return, Razorpay TEST checkout/webhook delivery and real phone push acceptance. No phone/emulator is available. Automated results do not establish these manual passes.
- Before hosted rollout: explicitly set BOOKING_PAYMENT_MODE=ONLINE (remove AT_CLINIC overrides), use matching TEST credentials/webhook secret and reachable callback URL, verify exact-SHA CI/migrations/API/web then install the compatible build. This change activates no live keys or merchant payment setup.

### Payment restoration final build and targeted acceptance

- All **49 payment integration cases pass** on the isolated local console-release test database, including unsupported-fee refusal and the previously timed-out paid-duplicate setup/case. Log: .env.payment-restoration-payments-retry.log.
- All **18 restricted-login cases pass**, including actual signed capture/refund and tenant/account privacy controls. Log: .env.payment-restoration-rls.log.
- All **59 Android tests pass in each debug/release variant**. Signed APK/AAB **code 3 / 0.1.1-staging**, target API 36 built; native release lint **0 errors / 41 warnings**. APK signing verification, ZIP 16 KB and APK/AAB 64-bit ELF alignment pass. Logs: .env.payment-restoration-android-final.log, .env.payment-restoration-artifacts.json and .env.payment-restoration-signature.log.
- Final Nest build/typecheck/lint and Next production build/typecheck/lint pass. Existing two seed console warnings and Next ESLint plugin notice remain. Logs: .env.payment-restoration-api-build.log and .env.payment-restoration-web-final.log.
- The broad API run encountered one 30-second **beforeEach setup hook timeout** while Android/Next builds were running on the 8 GB host with less than 1 GB free RAM. The initial focused run passed this scenario, and the full payment-file rerun after heavy builds finished passes all 49. Do not call the original broad run completely green or hide its timeout. No test timeout or security setting was relaxed. The broad run's final aggregate is recorded separately below.

No physical phone, actual Razorpay TEST transaction/webhook delivery, hosted rollout or real charge occurred. The fake provider verifies actual HMAC and real database transactions; it does not establish real gateway availability or device behavior. Existing pay-at-clinic bookings remain uncharged and unchanged.

### Broad regression outcome — payment restoration

Final broad run: **482 passed, 1 setup-hook timeout, 18 intentionally skipped restricted-role checks** (501 total; 36 files passed, one payment file failed, one restricted-role file skipped). The skipped restricted-role file separately passed all 18 cases. The only broad-run failure was beforeEach timing out after 30 seconds for the already-paid duplicate-booking case during heavy local build contention. The complete payment file was rerun without the heavy builds and **all 49 cases passed**, including that setup/case; no source or timeout relaxation was used to obtain that pass. The broad suite itself was not rerun a second time. Preserve this distinction when reporting results. No payment/booking domain assertion remains failing in the completed payment acceptance run.
