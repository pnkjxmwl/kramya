# Restore payment before token confirmation

Decision: 5 November 2026. The founder reversed the reservation-only booking change. This plan supersedes the payment decision in reservation-release-plan.md; independent privacy, ETA, account, clinic and environment work is retained. Work is local until explicitly recorded as deployed.

1. Restore ONLINE as the default and reject /reserve in that mode before any mutation. AT_CLINIC is explicit compatibility/testing only. Preserve existing confirmed clinic reservations and historical payments; do not create fake payments or retroactive charges.
2. Restore the corrected full-screen Kotlin Razorpay checkout from commit aa3813c, including compact header, Android WebView height correction, exact GET/POST callback interception and static backend return fallback. Payment callbacks/JavaScript are navigation signals only.
3. Resume unpaid holds on the same order, allow payment retry, and recover status after relaunch, configuration change, app handoff, network loss or delayed webhook. Confirm from server state, including terminal history, before showing a usable QR. Keep My Visits access when confirmation is delayed.
4. Apply account limits, overlap prevention, human clinic review pauses and existing identity/deletion/environment gates to online JOIN as well as clinic reservation. Count live unpaid holds in quotas; resuming a valid existing hold does not create an extra booking.
5. Exercise successful capture, forged/replayed callbacks, duplicate requests, failed attempt then success, gateway outage, abandonment/expiry, cancelled/stale checkout, capacity/closure, late capture/refunds and refund reconciliation. Free/sub-INR-1 sessions return a clear unsupported-online-booking outcome without a hold or gateway call; no artificial charge or fake success.
6. Build/test the Kotlin app and API/web. Update privacy/support/arrival wording. Phone and actual gateway TEST acceptance remain deferred because no phone is available. Never submit a real charge or activate live keys during restoration.

Release configuration: the deployed API must explicitly use ONLINE (remove any older AT_CLINIC override), correct matching Razorpay TEST keys/webhook secret and public callback URL. Retain protected migration/production separation and recovery gates. This source change does not configure merchant live-payment eligibility or publish the app. Existing database migrations are preserved.

Progress: implementation and focused acceptance complete locally. All 49 payment cases, 18 restricted-login cases and 59 Android tests in each debug/release variant pass. API/web builds, API type/lint, native release lint (0 errors/41 warnings), signature and 16 KB packaging checks pass. The broad API regression and its one setup timeout observed during memory pressure are recorded transparently in TESTING.md; the full payment-file retry passes. No hosted deployment or device acceptance is implied.

Provider reference for the minimum INR order amount: [Razorpay Create Order](https://razorpay.com/docs/api/orders/create/). The current source rejects unsupported smaller fees instead of creating a failing payment hold.
