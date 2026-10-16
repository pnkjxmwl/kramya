# Kramya final acceptance checklist

Updated 17 October 2026 (Asia/Kolkata). The founder asked to defer hands-on phone testing and the full UI/workflow review until the final phase. Work through this file one item at a time after production safeguards and implementation are ready. Automated build, security and regression checks continue during development.

## Current evidence

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
- [ ] Prove an encrypted hosted backup and restoration into an isolated target. Record artifact, key custody, recovery time, row counts and application smoke checks.
- [ ] Decide clinic-hour availability, recovery objectives, support and clinic fallback procedures. No paid hosting changes have been authorized.
- [ ] Verify Firebase project matching, server delivery credentials, release signing and distribution.
- [ ] Verify Razorpay test mode and webhook configuration before checkout tests. No synthetic SUCCESS payment records were inserted into hosted staging.

## Final phase: Android UI and navigation

- [ ] Install the candidate APK on the Android phone; record commit, version and Android version.
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
