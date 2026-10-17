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

On 18 October 2026, the Firebase console confirmed project `kramya-39390`,
Android package `com.kramya.native` and Cloud Messaging V1 enabled. Both public
fingerprints of the locally signed staging APK were registered and verified:

- SHA-1: `60:DB:A0:B6:71:C7:1A:23:0D:8F:87:29:85:FE:15:B1:23:9F:28:5E`
- SHA-256: `1D:CE:65:FC:A2:61:92:78:85:BD:6E:68:B2:9B:7F:1C:C6:23:81:E8:4E:31:44:80:A3:9A:55:23:C4:15:D1:8E`

Certificate registration does not implement Google sign-in. The Kotlin app
currently uses API account authentication and Firebase Messaging; it has no
Google sign-in client flow. Server credential authentication and actual device
notification receipt remain separate checks. These staging fingerprints are
also not a future Google Play app-signing certificate.
