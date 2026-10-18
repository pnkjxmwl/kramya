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

- [x] Latest live release is `b34465f50ccc15f9b3a6474da6f029dbefa235ea` (PRs #21–22). Main CI [39073557659](https://github.com/pnkjxmwl/kramya/actions/runs/39073557659) passed verify/native, including all twelve actual restricted-login cases with no skipped cases. Protected deployment [39073841972](https://github.com/pnkjxmwl/kramya/actions/runs/39073841972) applied all 20 migrations; Render deploy `dep-db9v405g1s2s73a5eslg` reached live. Final hosted login, discovery, temporary profile CRUD, queue reads and access denials passed; no runtime error logs were returned in the short post-deploy check window.
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
