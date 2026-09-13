# Parity audit — `apps/native` against `apps/mobile`

The native Android client is a re-implementation of the patient app, not a redesign. This
file records what was checked, what matches, and — more usefully — what does **not**.

**Read the "Not verified" section first.** It is short and it matters more than the rest.

---

## Not verified

No screen in this app has been rendered by anybody. There was no device and no emulator
attached during the build; verification was compilation plus 46 JVM unit tests in
`apps/native`, and 7 new + 28 existing tests in `apps/api` for the push router.

Unproven, and to be treated as unproven until someone runs the APK:

- that any screen renders correctly, or at all
- fonts, icon glyphs, gradients, shadows, safe-area insets, scroll, keyboard, touch targets
- the socket against a real server
- the Razorpay WebView against real Checkout
- image loading end to end
- any push actually arriving on a device (the build wiring was proven; delivery was not)

Compilation proves types. It does not prove pixels, and it does not prove a network.

---

## File map

One file per RN file, same order of declarations, so a side-by-side read is mechanical.

| `apps/mobile` | `apps/native` |
|---|---|
| `theme.ts` | `core/Theme.kt` |
| `lib/format.ts` | `core/Format.kt` |
| `lib/icon.tsx` | `core/Icons.kt` |
| `lib/api.ts` | `net/Api.kt` + `net/Query.kt` + `net/QueryHooks.kt` |
| `lib/auth.tsx` | `net/Auth.kt` |
| `lib/realtime.tsx` | `net/Realtime.kt` + `ui/Hooks.kt` |
| `lib/city.tsx` | `net/CityStore.kt` |
| `lib/ui.tsx` | `ui/Primitives.kt` |
| `lib/discovery.tsx` | `ui/Discovery.kt` |
| `lib/visits.tsx` | `ui/Visits.kt` + `net/Paths.kt` |
| `packages/contracts` | `net/Models.kt` |
| `app/_layout.tsx`, `(app)/_layout.tsx`, `(discover)/_layout.tsx` | `Providers.kt`, `nav/Nav.kt`, `nav/AppNav.kt` |
| `(auth)/login.tsx`, `signup.tsx` | `screens/Auth.kt` |
| `(discover)/index.tsx` | `screens/Discover.kt` |
| `(discover)/location.tsx` + `profile/city.tsx` | `screens/Location.kt` (one screen, two routes — as in RN) |
| `(discover)/doctors.tsx`, `doctor/[id].tsx` | `screens/Doctors.kt` |
| `(discover)/hospital/[id].tsx` | `screens/Hospital.kt` |
| `(discover)/department/[id].tsx` | `screens/Department.kt` |
| `(discover)/session/[id].tsx` | `screens/Session.kt` |
| `(visits)/visits.tsx` | `screens/Visits.kt` |
| `(visits)/visit/[id].tsx` | `screens/Token.kt` + `ui/Qr.kt` |
| `(visits)/join.tsx` | `screens/Join.kt` |
| `profile/index.tsx`, `patients.tsx`, `add.tsx` | `screens/Profile.kt` |
| `lib/push.tsx` | `push/Push.kt` + `push/KramyaMessagingService.kt` |

---

## Server contract

Every path, extracted from both trees and compared literally.

| Path | RN | Native |
|---|---|---|
| `/auth/{signup,login,refresh,logout}` | ✓ | ✓ |
| `/me` | ✓ | ✓ |
| `/patients` (GET, POST), `/patients/:id` (DELETE) | ✓ | ✓ |
| `/cities?limit=50` | ✓ | ✓ |
| `/hospitals?{scope}&limit=50{search}` | ✓ | ✓ |
| `/hospitals/:id` | ✓ | ✓ |
| `/departments?hospitalId=:id&limit=50` | ✓ | ✓ |
| `/departments/:id/sessions?limit=50` | ✓ | ✓ |
| `/doctors?{scope}&limit=3{search}` (Discover) | ✓ | ✓ |
| `/doctors?{scope}limit=50{search}` (Doctors) | ✓ | ✓ |
| `/doctors/:id`, `/doctors/:id/sessions?limit=50` | ✓ | ✓ |
| `/sessions/:id`, `/sessions/:id/join` | ✓ | ✓ |
| `/me/queue-entries?scope={active,past}&limit=50` | ✓ | ✓ |
| `/queue-entries/:id/cancel` | ✓ | ✓ |
| `/me/push-tokens` | ✓ | ✓ (dormant until Firebase is configured — §1) |

**The two `/doctors` paths differ from each other in both apps, and that is copied
deliberately.** Discover builds `city=X` then `&limit=`; the Doctors screen builds
`city=X&` then `limit=`. Each is its own cache key. Tidying them into one helper would
have merged two cache entries that the RN app keeps separate.

`encodeQuery` reproduces `encodeURIComponent` exactly — space as `%20`, and `!'()~`
unescaped — because the path IS the cache key and a different encoding is a different key.

**Socket:** same URL, same `auth: { token }` handshake, same `subscribe`/`unsubscribe`
messages sent with an ack, same `session.updated` / `entry.updated` names, same
invalidation predicates (`/sessions/{id}` prefix, `/departments/`, `/doctors/`,
`MY_ACTIVE_ENTRIES`).

---

## Timing and cache behaviour

Every constant, compared by grep across both trees.

| | RN | Native |
|---|---|---|
| `staleTime` | 30 000 ms | 30 000 ms |
| `retry` | 1 (two attempts) | 1 (two attempts) |
| Payment confirm poll | 2 000 ms | 2 000 ms |
| Payment confirm timeout | 90 000 ms | 90 000 ms |
| My Visits (active) poll | 15 000 ms | 15 000 ms |
| Session / token fallback poll | 90 000 ms | 90 000 ms |
| Page size | 50 | 50 |
| Queue-strip bar cap | 14 | 14 |
| Polls while backgrounded | no | no (`repeatOnLifecycle(RESUMED)`) |
| Refetch on app foreground | yes | yes |
| In-flight dedupe | yes | yes (tested) |
| Refresh-token single-flight | yes | yes (tested with 8 concurrent 401s) |

---

## Deliberate differences

Each of these is a decision, not a gap.

### 1. Push is implemented, and dormant until credentials exist

Originally skipped. Built afterwards, on both sides:

- **`apps/api`** — `FcmClient` implements the same `ExpoApi` interface as `ExpoClient`, and
  `PushRouter` picks per token: `ExponentPushToken[…]` → Expo, anything else → FCM.
  `NotificationsService` changed by one line (it injects the interface now). All 28
  existing notification e2e tests pass unchanged, plus 7 new router tests.
- **`apps/native`** — `FirebaseMessagingService`, the `queue` channel at HIGH importance
  with `push.tsx`'s vibration pattern, the Android 13 permission, token registration and
  re-registration on rotation, and tap-to-booking from both a cold start and a warm one.

**It cannot send yet.** `FIREBASE_SERVICE_ACCOUNT` is unset on the server and no
`google-services.json` exists in the client, so `BuildConfig.PUSH_ENABLED` is false and
nothing touches Firebase. Both halves are inert rather than broken — the API still records
every notification and still reaches every Expo device. See README.md, "Turning push on".

**Unverified, like everything else here:** no push has been delivered to a device. The
build wiring *was* proven — a probe config was dropped in, the plugin applied,
`PUSH_ENABLED` flipped to true and the Firebase resources generated, then the probe was
deleted.

### 2. Cross-tab back behaviour is reproduced, not improved

Tapping Join on a department card lands on the join screen in the **Visits** tab, so Back
returns to My Visits rather than to the card you tapped. That is expo-router's behaviour —
a route belongs to one tab, and navigating to it switches tabs — and `navigateAcrossTabs`
reproduces it on purpose. The "nicer" behaviour would have been a divergence.

### 3. Strict enum decoding

Kotlin enums give exhaustive `when` with no `else`, so an unhandled status is a **compile**
error rather than a runtime `undefined` — strictly better than the RN `Record<>` maps.

The cost: an enum value the API adds and this app has not been rebuilt for throws at parse
time, where the RN app would render blank. Both contracts enums document additions as
deliberate and removals as breaking, so this is a coordinated change either way.

### 4. No splash screen

The RN gate shows a spinner while it reads the keychain asynchronously and loads Inter.
Neither wait exists here: tokens are read synchronously at construction and the fonts are
Android resources. The trade is a small amount of disk + keystore work on the main thread
at cold start, in exchange for no flash of the login screen for a signed-in user.

### 5. iOS-only options dropped

`headerBackTitle` and the `Platform.OS === 'ios'` tab-bar heights and press opacity are
dead code on Android in the RN app. Not carried over.

### 6. Autofill hints

The RN `Field` passes `autoComplete` (email / password / name), which drives Android
autofill. Not wired here — password managers will not offer to fill the sign-in form.
Small, real, and worth closing.

### 7. Release signing

`assembleRelease` is signed with the **debug** key so the APK installs. An unsigned release
APK is the one artifact this whole exercise is for and a phone refuses it. Not a Play Store
build.

---

## Design system

Every value in `core/Theme.kt` is copied from `theme.ts`, including the comments explaining
why. Three mechanical differences:

- **Elevation:** `theme.ts` sets an iOS shadow *and* an `elevation` on every level because
  each platform ignores the other. Only the `elevation` number ever reached Android, so
  only that is carried.
- **Font weights:** RN needs `fontFamily` *and* `fontWeight` on every token because it has
  no real weight resolution. Compose resolves weight against the family, so one `FontFamily`
  with four faces is unambiguous.
- **Line boxes:** every token sets `LineHeightStyle(Center, Trim.None)` and
  `includeFontPadding = false`, because Compose measures a line box differently from RN and
  the same numbers otherwise sit text high in its line.

Icons are the **same Feather.ttf**, copied from `node_modules`, addressed by codepoints
generated from the shipped `Feather.json` — 33 glyphs, the exact set the RN app uses.

`Locale.US` is pinned for rupee grouping: Hermes groups in threes, and a device set to
`en-IN` would otherwise render `₹10,00,000` where the RN app renders `₹1,000,000`. Tested.

---

## Bugs found and fixed during the port

Three that compile cleanly and fail only at runtime:

| | |
|---|---|
| `Dp.Hairline` is `Dp(0f)` | Correct for `Modifier.border`, zero for `height()`. Every separator in the app was invisible. Now one physical pixel from the density. |
| Coil 3 registers no network fetcher | Every remote image would have failed *silently*, falling back to initials — which looks deliberate, because `Photo` is designed that way. Now wired to the app's one OkHttpClient. |
| Observer registration raced disposal | `observe` took a mutex, so it had to be called from a coroutine; a screen disposed before that ran leaked an observer and kept costing requests on every socket event. Now an ordinary function. |

And one caught before it shipped: `Modifier.padding` with a negative value compiles and
**throws at runtime** — on the payment screen.

---

## Tests

46 JVM tests, all passing.

| Suite | | Covers |
|---|---|---|
| `FormatTest` | 13 | IST fixed-offset, the evening day-rollover, meridiem collapse, dual-input `calendarDate`, locale-independent rupees |
| `QueryClientTest` | 11 | dedupe, staleTime, query-string keying, retry count, data surviving a failed refetch, predicate invalidation, observer lifecycle |
| `AuthStoreTest` | 6 | **eight concurrent 401s produce exactly one refresh**, the already-rotated retry path, session cleared once for all waiters, offline mapping |
| `VisitsLogicTest` | 9 | reserved-outranks-booked, lowest token wins, hold countdown, every status has a next step |
| `CheckoutHtmlTest` | 7 | `redirect: true`, server-supplied callback URL, **no amount ever sent**, script-injection safety |

Expected values in `FormatTest` were produced by **running** `apps/mobile/lib/format.ts`,
not by reasoning about it — it is a differential test against the reference.
