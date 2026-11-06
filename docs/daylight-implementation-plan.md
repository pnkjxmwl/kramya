# Daylight implementation — patient app, clinic console and public site

Started 6 November 2026. Founder approved implementing the chosen designs in the actual Kotlin/Next.js products and pushing the changes. This replaces the HTML-only scope of the preceding study.

## Goals and boundaries

- Carry the refined `ui-lab/android-daylight` identity into every existing patient route: paper/ink/moss, Manrope/Bricolage, ticket mark, clear actions and readable queue information.
- Apply the selected `ui-lab/merge-daylight` console direction to the authenticated staff/doctor workspace, including empty, loading, failure, permission and narrow-screen layouts.
- Replace the landing-page narrative and composition with an original, product-led SaaS presentation. Explain what patients, reception and doctors actually do. Show clearly labelled illustrative UI; never invent clinic logos, customer counts, reviews, uptime, clinical outcomes, exact ETA accuracy or a publicly available store download.
- Preserve server truth, authentication, tenant boundaries, online-payment verification, booking limits, deletion, notification recipient checks, QR security and ETA freshness. No schema or API change is required for the visual work.
- Do not turn proposed mockup-only features into nonfunctional production controls. Existing routes use actual API data and supported commands. No fictional fixtures enter authenticated production screens.
- Keep Back/tab navigation immediate. Respect reduced motion and preserve keyboard, focus, touch targets, long names and small-screen readability.

## Reference decisions

Read the current primary pages at [Linear](https://linear.app/), [Attio](https://attio.com/), [Stripe](https://stripe.com/) and [Mercury](https://mercury.com/), alongside the first-party studies linked in `ui-lab/android-daylight/DESIGN-RESEARCH.md`. Use product-first explanation, clear role-based sections, editorial hierarchy and detailed interface previews. These are design interpretations, not copied artwork, copy, proprietary components or evidence that Kramya achieves their business results. This is a focused selection from the founder's list, not a claim to have analysed all 50 sites.

## Work and acceptance

- [x] Inspect existing routes, shared components and selected HTML references; preserve the pre-existing work.
- [x] Implement shared identity/fonts/tokens for Kotlin and Next.js.
- [x] Patient discovery: direct clinic entry, provider search, readable dates/sessions and supported navigation.
- [x] Patient booking/payment/token/visits/account: coherent Daylight surfaces with existing state handling intact.
- [x] Staff shell, overview, queue board, reception/check-in and configuration.
- [x] Doctor session: ticket, patient identity and distinct action cluster, including the empty-room state.
- [x] Public landing: new positioning, original product presentation, responsive navigation, pilot contact, FAQ, privacy/support links and honest app availability.
- [ ] Build/typecheck/lint/tests; inspect the actual local web UI and native build evidence. Record limits when no phone is available.
- [ ] Review the diff and required prior release dependencies; create focused commits and push the implementation branch.
- [ ] Verify hosted web rollout if the connected deployment is available; produce signed Android artifacts without claiming an APK is automatically installed or published to Play.

## Delivery notes

The working tree already contains the earlier payment/privacy/clinic release work. Preserve it and distinguish required release dependencies from new visual changes. Keep secrets, local signing material, `.env*`, build artifacts, unrelated plans and caches out of commits. Stage explicit paths, review the staged content and keep deployment credentials out of logs. User approval to push/deploy is already supplied in the current request and earlier deployment requests.

Acceptance means working supported journeys, not pixel-identical HTML at the expense of native accessibility or invented backend support. Live release must continue to identify staging/test payments and must not bypass the separate production-environment gates.
