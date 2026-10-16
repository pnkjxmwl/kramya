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
        // Stable Android/Firebase identity; retain it when retiring the other client.
        applicationId = "com.kramya.native"
        minSdk = 26
        targetSdk = 36
        versionCode = 1
        versionName = "0.0.1"

        testInstrumentationRunner = "androidx.test.runner.AndroidJUnitRunner"
        vectorDrawables { useSupportLibrary = true }

        // Read by push/Push.kt, so the app can say "push is not configured in this build"
        // rather than throwing when Firebase was never initialised.
        buildConfigField("boolean", "PUSH_ENABLED", firebaseConfigured.toString())
    }

    buildTypes {
        debug {
            versionNameSuffix = "-debug"
            buildConfigField("String", "API_URL", "\"${prop("apiUrlDebug")}\"")
        }
        release {
            // Keep shrinker changes separate until device verification is complete.
            isMinifyEnabled = false
            proguardFiles(getDefaultProguardFile("proguard-android-optimize.txt"), "proguard-rules.pro")
            buildConfigField("String", "API_URL", "\"${prop("apiUrlRelease")}\"")
            // Release artifacts remain unsigned until a private upload key is configured.
            // Use assembleDebug for development/device installation.
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
