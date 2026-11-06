# Daylight release — 6 November 2026

The actual Kotlin patient app, staff/doctor console and public landing page now use Daylight. [PR #25](https://github.com/pnkjxmwl/kramya/pull/25) is merged. Application release commit: `8a8cfe87b07a9ee21dcecc02b58399aee8f7e7ba`.

## Hosted release

- Website: https://kramya.vercel.app/ — new copy, product-role previews, pilot contact, responsive navigation and public privacy/support/deletion links.
- Staff/doctor sign-in: https://kramya.vercel.app/login — existing membership and tenant authorization remain in force.
- API: https://opd-api-koes.onrender.com — Render deploy `dep-dbmu2butlv9c73c0378g` reached **live** at 14:18:04 UTC, on the exact application release commit.
- [Main CI 42231557047](https://github.com/pnkjxmwl/kramya/actions/runs/42231557047) passed verify/native. [Protected deployment 42232303569](https://github.com/pnkjxmwl/kramya/actions/runs/42232303569) applied the five previously local release migrations and triggered that exact Render commit. All **25** migrations are complete; no unfinished migration remains.
- Read-only SQL verification confirms **STAGING**, RLS on all public tables, restricted runtime privileges, hidden migration history and no client-role SELECT grants on the three new private tables. No reset or hosted seed occurred.
- Security advisors return only the intentional informational notice for `_prisma_migrations`: RLS is enabled with no runtime policy. Do not add a public policy to clear that notice. [Advisor explanation](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy).

## Verification

- Final PR CI [42230656777](https://github.com/pnkjxmwl/kramya/actions/runs/42230656777) and merged main CI pass. Checks include lint/typecheck/production builds, 42 contracts cases, 483 API cases, 72 HTTP console checks, then a separate actual restricted-login RLS suite. The owner-backed API run deliberately skips its 18 restricted-role cases; the separate restricted-login run has no failures or skips. No timeout or security setting was relaxed.
- Local Kotlin debug and signed release variants each pass **59 JVM tests**. Debug build/lint and signed release APK/AAB build succeed. Android lint reports **0 errors / 42 warnings**; this is not a zero-warning build.
- Signed APK: `apps/native/app/build/outputs/apk/release/app-release.apk`. Bundle: `apps/native/app/build/outputs/bundle/release/app-release.aab`. Both are version code **4**, version **0.2.0-staging**, package **com.kramya.native**, target API **36**.
- APK signing, 64-bit ELF 16 KB alignment and ZIP 16 KB alignment checks pass. APK SHA-256: `7631c278b70faf543f5508100b6513703c330addec204f9a44f001dbd190d735`. The AAB's JAR signature verifies; the local staging key is self-signed. Play-generated split/device checks remain separate acceptance work.
- Actual reception and doctor workspaces were inspected against existing fictional staging accounts: overview, dated sessions, queue board, empty/disabled actions, booked/terminal rows, 390px layout without horizontal overflow, drawer focus wrap/Escape, and sign-out/sign-in. No demo route was used and no queue data was changed.
- Hosted landing, role previews, mobile navigation selection, FAQ and sign-in render correctly. The hosted doctor board was rechecked after API deployment; its live connection indicator is visible. Browser proof is saved locally under `.env.ui-proof/daylight-live/` and stays out of Git.
- **25 hosted smoke requests** pass: liveness/readiness, authenticated discovery, patient profiles/visits, reception/doctor queue reads, denied patient staff-queue access, session logout, safe GET/POST checkout-return HTML, and five public web routes. Database and Redis both report up. A separate authenticated reservation probe against a SQL-confirmed nonexistent session returns the explicit **online payment required** response before any mutation. It creates no hold, order or charge.
- Render returned no errors in the initial short deployment log window. A later log query returned provider HTTP 503; do not interpret that unavailable query as a clean log result. Successful hosted smoke checks are independent evidence.

## What the design changes

Paper/ink/moss foundations, Manrope body type and Bricolage headings, an original ticket K, adaptive launcher assets, readable native controls, direct clinic entry, separate booking/payment states, a notched token with contextual ETA, and a focused doctor/reception workspace. Existing account, family, booking, checkout, QR, refund and clinic configuration routes use the shared foundation. Unsupported prototype-only features are not exposed as working app controls.

Primary references were a focused selection, not all 50 supplied sites: [Linear](https://linear.app/), [Attio](https://attio.com/), [Stripe](https://stripe.com/) and [Mercury](https://mercury.com/). Product presentation, hierarchy and role-based explanation informed an original layout. Earlier patient-study decisions drew on [Swiggy's DLS](https://medium.com/swiggy-bytes/swiggy-design-language-system-1ef9cca11186), [Linear's redesign account](https://linear.app/now/how-we-redesigned-the-linear-ui), [Monzo's writing system](https://monzo.com/blog/weve-made-our-writing-system-available-to-all) and [Android accessibility guidance](https://developer.android.com/guide/topics/ui/accessibility/views/apps-views). These are design interpretations, not endorsements or patient research results.

## Remaining acceptance gates

No Android phone/emulator is available. Install the APK and check native typography at large text sizes, TalkBack, keyboard/insets, Back/tab behavior, family selection, actual Razorpay TEST success/failure/pending/cancel and external UPI return, process death/reconnection, notifications and logout isolation. Automated coverage does not establish those device passes.

The hosted product remains fictional **staging**, online payments remain **TEST**, and the app is **not published to Play**. Commercial merchant approval, production environment/reviewer readiness, real clinic onboarding and the supervised ETA pilot remain separate gates in TESTING.md. Scheduled backups stay deferred at the founder's request. Docker's local launcher registration issue remains a development-environment limitation; isolated PostgreSQL/Redis CI supplied the integration evidence for this release.
