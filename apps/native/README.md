# Kramya patient app — Android

Kotlin and Jetpack Compose are the sole patient-client implementation. `apps/api`
owns queue state, authorization, prices and ETA calculations; the app displays its
contracts using Kotlin serialization models in `net/Models.kt`. Keep those models
in sync with `packages/contracts` when changing API responses.

## Build and test

Use JDK 17 and Android SDK platform 36/build-tools 36. Configure the local SDK path
in ignored `local.properties` using forward slashes on Windows.

```sh
./gradlew testDebugUnitTest assembleDebug
```

Windows uses `gradlew.bat`. The installable development artifact is
`app/build/outputs/apk/debug/app-debug.apk`. Release artifacts require a private
upload/signing key before distribution; they are not signed with the debug key.

The stable Android/Firebase package ID remains `com.kramya.native`; the launcher
label is **Kramya**. Do not change the package ID without planning Firebase and
installed-app migration.

## API targets and a USB-connected phone

Debug defaults to `http://10.0.2.2:3000` for an Android emulator. Release defaults to
the deployed API in `gradle.properties`. Override either at build time:

```sh
./gradlew assembleDebug -PapiUrlDebug=https://opd-api-koes.onrender.com
adb install -r app/build/outputs/apk/debug/app-debug.apk
```

For local API testing on a USB-connected Android phone:

```sh
adb reverse tcp:3000 tcp:3000
./gradlew assembleDebug -PapiUrlDebug=http://127.0.0.1:3000
```

Only debug permits cleartext traffic. Use fictional staging records until security,
payment recovery, device behavior and operating-readiness gates have passed.

## Firebase notifications

The ignored `app/google-services.json` must belong to the same Firebase project as
the backend's private `FIREBASE_SERVICE_ACCOUNT`. Never commit private service-account
credentials. The client configuration is applied only when the file is present;
builds without it set `PUSH_ENABLED=false` and can still exercise the other flows.

The API sends FCM directly through its notification outbox. Configure the server
credential in deployment secrets; registration alone does not prove push delivery.
On a physical device verify notification permission, foreground/background delivery,
tap-to-booking, token refresh and logout/account switching.

## ETA and acceptance

The API supplies an estimated window; the app must not invent a precise appointment
time or tell a patient to travel when no estimate is available. Estimates currently
depend on doctor history, today's pace, queue position and room handover times.
Validate them against actual consultation starts during a supervised pilot; build
and unit-test success alone do not establish accuracy or physical waiting-time savings.

`PARITY.md` is the historical audit of the retired client. Real device rendering,
checkout and push delivery remain separate acceptance checks.
