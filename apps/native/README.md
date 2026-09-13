# Kramya — native Android client

A second patient client, written in Kotlin and Jetpack Compose, built to behave identically
to `apps/mobile` (Expo / React Native).

`apps/mobile` is the reference and is **not modified by anything here**. Neither is
`packages/contracts`.

`apps/api` **is** touched, in exactly one place and only additively: it learned to send
push via FCM alongside Expo, so this client can receive the same notifications. Nothing
about the Expo path changed — see "Turning push on" below, and PARITY.md §1.

See [PARITY.md](PARITY.md) for the audit — including what is deliberately different and
what has never been run.

> **Nothing in this app has been seen on a screen.** It compiles and its logic is unit
> tested; no screen has been rendered. Read the top of PARITY.md before trusting it.

---

## Build

```bash
cd apps/native

./gradlew assembleDebug        # -> app/build/outputs/apk/debug/app-debug.apk
./gradlew assembleRelease      # -> app/build/outputs/apk/release/app-release.apk
./gradlew testDebugUnitTest    # 46 JVM tests
```

Install:

```bash
adb install -r app/build/outputs/apk/release/app-release.apk
```

It installs **beside** the Expo build — different `applicationId`
(`com.kramya.native`), labelled **Kramya Native** — so the two can be opened side by side
and compared screen for screen.

### Requirements

JDK 17 (`JAVA_HOME`), Android SDK with platform 36 and build-tools 36, and a
`local.properties` holding the SDK path:

```properties
sdk.dir=C:/Users/you/AppData/Local/Android/Sdk
```

**Forward slashes.** Java's properties parser treats `\U`, `\A`, `\L` as unknown escapes
and drops the backslash, turning a Windows path into `C:UsersyouAppData...`. The only
symptom is `IOException: The filename, directory name, or volume label syntax is incorrect`
from a task with no path in its name.

---

## Which server it talks to

Baked in at build time, from `gradle.properties` — the same split `apps/mobile/eas.json`
uses between its development and production profiles:

| Build | API |
|---|---|
| debug | `http://10.0.2.2:3000` (emulator's view of the host) |
| release | `https://opd-api-koes.onrender.com` |

Override without editing a file:

```bash
./gradlew assembleRelease -PapiUrlRelease=https://staging.example.com
```

There is no runtime setting, deliberately: a build that can be aimed at another server by
whoever is holding the phone is a build that can be aimed at a server that is not ours.

Debug builds carry `usesCleartextTraffic` via `src/debug/AndroidManifest.xml` so the
localhost URL works. Release builds never get that flag.

---

## Layout

```
app/src/main/java/app/kramya/
  KramyaApp.kt        Application: owns Services, builds the Coil loader
  MainActivity.kt     the single Activity (expo-router uses one too)
  Providers.kt        the singletons + the two app-wide effects
  core/               Theme, Format, Icons        <- theme.ts, format.ts, icon.tsx
  net/                Api, Auth, Query, Realtime, CityStore, Models, Paths
  ui/                 Primitives, Discovery, Visits, Hooks, Qr
  nav/                Nav (routes, tab bar, nav bar), AppNav (the graph)
  screens/            the fifteen screens
```

One file per RN file, same names, same order of declarations — which is what makes the
parity audit a read rather than a hunt.

### The part worth understanding first

`net/Query.kt` is the port's real work. Every screen's behaviour *is* TanStack Query's
behaviour — which request fires, when a skeleton shows, whether pull-to-refresh spins, how
a socket event reaches a screen. It reproduces path-as-key (query string included),
in-flight dedupe, `staleTime` 30s, `retry: 1`, and predicate-scoped invalidation. It was
written and tested before any UI, because getting it subtly wrong makes fifteen screens
subtly wrong at once and none of them looks like this file.

`net/Auth.kt` is second: the single-flight refresh is what stops a burst of simultaneous
401s from killing the refresh-token family and signing a patient out mid-queue.

---

## Turning push on

Push is **written and wired, and switches itself on when the credentials arrive.** Until
then `BuildConfig.PUSH_ENABLED` is false, nothing touches Firebase, and the app behaves
exactly as it does today.

Three steps, two of which only you can do:

**1. Register the app in Firebase.** Console → project `opd-queue-b047e` → Add app →
Android → package name **`com.kramya.native`**. Download `google-services.json` and put it
at `apps/native/app/google-services.json`. That is the whole client side — the Gradle
plugin applies itself when the file is present, and the next build has push in it.

> One registration is enough. The debug build deliberately has **no** `applicationIdSuffix`,
> so both variants are `com.kramya.native`. The obvious `.debug` suffix would demand a
> second Firebase registration and fail the build with *"No matching client found for
> package name 'com.kramya.native.debug'"* — a baffling first error to meet right after
> setting Firebase up.

**2. Give the API a service account.** Console → Project settings → Service accounts →
Generate new private key. Base64 the JSON and set it on Render as:

```
FIREBASE_SERVICE_ACCOUNT=<base64 of the service-account JSON>
```

Base64 because the credential contains newlines inside `private_key` and hosting panels
mangle those differently. Leave it unset and the FCM half stays inert — the API still
boots, still records every notification, and still reaches every Expo device.

**3. Nothing.** `PushRouter` in `apps/api` picks a provider per token: `ExponentPushToken[…]`
goes to Expo, anything else to FCM. `apps/mobile` is unaffected either way.

### What it does once on

The nine `NotificationType` messages, on a `queue` channel at HIGH importance with the
vibration pattern from `push.tsx`. Tapping one opens that booking — from a cold start as
well as while running, which is the case the whole feature exists for.

**Nothing is read from the payload except `entryId`, and only to decide where to
navigate.** The token screen then fetches the truth over REST like every other screen. A
notification that carried status would be a third source of it, arriving out of order, on
a device that may have been asleep for an hour (docs/Rules.md 8).

Declining the permission is a supported outcome. The queue still works; the socket and the
polls do not care.

---

## House rules that apply here too

- The **backend is the only source of truth**. Nothing in this app decides queue state,
  token order, prices or permissions. `registrationOpen` and `cancellable` are the
  server's answers and are advisory even so.
- The client **never** creates a token and **never** decides a payment happened. Only the
  signature-verified webhook issues a token; this app opens Checkout and then asks the
  server.
- The client never sends an amount. Razorpay takes it from the order.
- `net/Models.kt` is a **mirror** of `packages/contracts`, never a second definition. When
  the contract changes, it changes second.
