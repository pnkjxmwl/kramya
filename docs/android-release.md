# Android release preparation

Kotlin (`com.kramya.native`) is the only patient app. Firebase project
`kramya-39390` must match its client and the server service account. The server's
admin-only operations preflight checks the project and OAuth credential without
sending a notification. It does not prove device receipt.

The repository previously configured no release signing. Only a local debug
keystore was found. A separate **local staging key** is now generated in
`.env.android-staging.p12`, with its private settings in
`.env.android-signing.json`. Both are Git-ignored; they are not a confirmed
existing Play Store upload identity. Never replace a published app's established
key with this one. No app has been published by this change.

Build a locally signed staging APK and App Bundle:

```powershell
node scripts/android-release.mjs build
```

This checks Firebase's project/package, uses the installed JDK/SDK and supplies
signing values only through child environment variables. It runs release JVM
tests, `assembleRelease` and `bundleRelease`. Gradle refuses unsigned release
packaging, partial signing configuration, missing Firebase or a non-HTTPS release
API. Debug builds continue without release secrets.

For another private signing system, supply all of `KRAMYA_UPLOAD_STORE_FILE`,
`KRAMYA_UPLOAD_STORE_PASSWORD`, `KRAMYA_UPLOAD_KEY_ALIAS` and
`KRAMYA_UPLOAD_KEY_PASSWORD` directly to Gradle. Do not put them in tracked
properties or workflow command arguments. Configure the release API using
`-PapiUrlRelease=https://...`.

Before distribution, save the keystore **and** its passwords in a recoverable,
private location off this computer; record certificate SHA-256 with `apksigner
verify --print-certs`. Add that certificate in Firebase/Google sign-in settings
where required. Confirm ownership of any existing Play Console application and
its upload-key procedure before using an AAB there. Increase `versionCode` for
each uploaded release. Store publication, actual phone push receipt, sign-in and
the full UI/workflow review remain final acceptance tasks in `TESTING.md`.
