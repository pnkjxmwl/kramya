import java.util.Properties

plugins {
    alias(libs.plugins.android.application)
    alias(libs.plugins.kotlin.android)
    alias(libs.plugins.kotlin.compose)
    alias(libs.plugins.kotlin.serialization)
}

/** Reads a value from gradle.properties, so the API URL is configurable without a code edit. */
fun prop(name: String): String = providers.gradleProperty(name).get()

/**
 * Push is wired in, and switches itself on when the credentials arrive.
 *
 * The google-services plugin FAILS THE BUILD if `google-services.json` is absent or does
 * not list this applicationId - so applying it unconditionally would mean nobody can build
 * this app at all until someone has been through the Firebase console. Applying it only
 * when the file is there means the app builds today (without push) and gains push the
 * moment the file is dropped in, with no code change.
 *
 * A placeholder google-services.json was deliberately NOT committed: `mobilesdk_app_id` is
 * a real identifier only Firebase issues, and a fake one produces a build that LOOKS
 * configured and silently delivers nothing - which is strictly worse than not having it.
 *
 * See README.md, "Turning push on".
 */
val firebaseConfigured = file("google-services.json").exists()
if (firebaseConfigured) apply(plugin = "com.google.gms.google-services")

android {
    namespace = "app.kramya"
    compileSdk = 36

    defaultConfig {
        /*
          `com.kramya.native`, NOT `com.kramya.app`.

          A different applicationId is what lets this sit on a phone next to the Expo
          build, which is the only way the two can be compared screen for screen. It
          also means this app is invisible to the google-services.json in apps/mobile -
          irrelevant, because push is deliberately not implemented here (see README).
        */
        applicationId = "com.kramya.native"
        /*
          26, not 23.

          EncryptedSharedPreferences needs 23, but Expo SDK 54 ships minSdk 26 - so
          matching it keeps the two apps installable on exactly the same set of devices,
          which is a precondition for comparing them.
        */
        minSdk = 26
        targetSdk = 36
        versionCode = 1
        // Tracks apps/mobile/app.json so a tester can tell at a glance which pair of
        // builds they are holding.
        versionName = "0.0.1"

        testInstrumentationRunner = "androidx.test.runner.AndroidJUnitRunner"
        vectorDrawables { useSupportLibrary = true }

        // Read by push/Push.kt, so the app can say "push is not configured in this build"
        // rather than throwing when Firebase was never initialised.
        buildConfigField("boolean", "PUSH_ENABLED", firebaseConfigured.toString())
    }

    buildTypes {
        debug {
            /*
              NO applicationIdSuffix, deliberately.

              The obvious `.debug` suffix costs more than it buys here. This app exists to
              sit beside the EXPO build (`com.kramya.app`) - a different package already -
              and the suffix only separates it from its own release build, which is
              marginal. What it does cost is a second Firebase registration: the
              google-services plugin fails the build outright with "No matching client
              found for package name 'com.kramya.native.debug'", which is a baffling first
              error to meet immediately after setting Firebase up.

              Both variants are debug-signed, so one replaces the other cleanly on a device.
              `versionNameSuffix` still tells them apart in the Profile > Version row.
            */
            versionNameSuffix = "-debug"
            buildConfigField("String", "API_URL", "\"${prop("apiUrlDebug")}\"")
        }
        release {
            /*
              Minification is OFF.

              Not laziness - kotlinx.serialization, OkHttp and socket.io-client all need
              keep rules, and a ProGuard rule that is subtly wrong fails at RUNTIME on a
              screen nobody has watched, in a build nobody has debugged. This app is an
              evaluation build with no size pressure; turning it on before anyone has
              seen the app render would be trading a real risk for an imaginary saving.
            */
            isMinifyEnabled = false
            proguardFiles(getDefaultProguardFile("proguard-android-optimize.txt"), "proguard-rules.pro")
            buildConfigField("String", "API_URL", "\"${prop("apiUrlRelease")}\"")
            /*
              Signed with the DEBUG key on purpose.

              `assembleRelease` otherwise produces an unsigned APK that a phone refuses
              to install, which is the exact artifact this whole plan is for. A debug-
              signed release build installs, runs un-debuggable and non-minified, and is
              honest about being a test build. A real upload key is a Play Store
              question, and this app is not going to the Play Store.
            */
            signingConfig = signingConfigs.getByName("debug")
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
    kotlinOptions { jvmTarget = "17" }
    buildFeatures {
        compose = true
        buildConfig = true
    }
    packaging {
        resources.excludes += setOf("/META-INF/{AL2.0,LGPL2.1}")
    }
}

dependencies {
    implementation(libs.core.ktx)
    implementation(libs.activity.compose)
    implementation(libs.lifecycle.runtime)
    implementation(libs.lifecycle.viewmodel)
    implementation(libs.navigation.compose)

    implementation(platform(libs.compose.bom))
    implementation(libs.compose.ui)
    implementation(libs.compose.graphics)
    implementation(libs.compose.foundation)
    implementation(libs.compose.material3)
    implementation(libs.compose.tooling.prev)
    debugImplementation(libs.compose.tooling)

    implementation(libs.okhttp)
    implementation(libs.serialization.json)
    implementation(libs.coroutines.android)
    implementation(libs.coil.compose)
    implementation(libs.coil.okhttp)
    implementation(libs.socketio)
    implementation(libs.zxing)
    implementation(libs.security.crypto)

    // Always on the classpath so the push code compiles whether or not a
    // google-services.json is present; Firebase simply never initialises without one.
    implementation(platform(libs.firebase.bom))
    implementation(libs.firebase.messaging)

    testImplementation(libs.junit)
    testImplementation(libs.coroutines.test)
    testImplementation(libs.mockwebserver)
}
