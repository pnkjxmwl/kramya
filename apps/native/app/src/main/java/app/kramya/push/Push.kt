package app.kramya.push

import android.Manifest
import android.app.NotificationChannel
import android.app.NotificationManager
import android.content.Context
import android.content.pm.PackageManager
import android.os.Build
import android.util.Log
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.platform.LocalContext
import androidx.core.content.ContextCompat
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import app.kramya.BuildConfig
import app.kramya.net.AuthStore
import app.kramya.net.LocalAuth
import com.google.firebase.FirebaseApp
import com.google.android.gms.tasks.Task
import com.google.firebase.messaging.FirebaseMessaging
import kotlinx.coroutines.suspendCancellableCoroutine
import kotlin.coroutines.resumeWithException
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive

// Push notifications. Mirror of apps/mobile/lib/push.tsx.
//
// Three jobs, and they are deliberately all that this does:
//   1. ask for permission, once, and take no for an answer
//   2. register the device's token with the API
//   3. open the right screen when a notification is tapped
//
// **It reads nothing from the payload except where to navigate.** The push says
// "something changed, here is which booking"; the token screen then fetches the truth over
// REST like every other screen. A notification that carried status would be a third source
// of it, arriving out of order, on a device that may have been asleep for an hour
// (docs/Rules.md 8).
//
// **Declining is a supported outcome, not an error.** A patient who says no to
// notifications still has a live queue on screen and a working app; the socket and the
// polls do not care. Nothing here blocks, retries or nags.

private const val TAG = "kramya.push"

/**
 * The channel every queue notification is delivered on.
 *
 * Android needs a channel before anything is shown at all on API 26+, and the default one
 * is silent. A queue call is worth a sound. The id and the vibration pattern match
 * `push.tsx` exactly, and the server names this same id in its FCM payload - a mismatch
 * means the system shows nothing, with no error anywhere.
 */
const val QUEUE_CHANNEL_ID = "queue"

fun ensureQueueChannel(context: Context) {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
    val manager = context.getSystemService(NotificationManager::class.java) ?: return
    val channel = NotificationChannel(
        QUEUE_CHANNEL_ID,
        "Queue updates",
        NotificationManager.IMPORTANCE_HIGH,
    ).apply {
        vibrationPattern = longArrayOf(0, 250, 250, 250)
        enableVibration(true)
    }
    manager.createNotificationChannel(channel)
}

/**
 * Where a notification tap wants to go, held until the navigator is ready to take it.
 *
 * Two paths lead here and BOTH are needed: the app was already running when the tap
 * happened, or it was cold and the tap is what started it. Missing the second means a
 * patient who taps "you are being called" from a locked phone lands on the home screen -
 * which is the one moment this whole feature exists for.
 *
 * A flow rather than a direct navigation call because the tap arrives in `onNewIntent`,
 * outside composition, possibly before the NavHost exists.
 */
object PendingDeepLink {
    private val _entryId = MutableStateFlow<String?>(null)
    val entryId: StateFlow<String?> = _entryId.asStateFlow()

    fun offer(entryId: String?) {
        if (!entryId.isNullOrBlank()) _entryId.value = entryId
    }

    /** Taken exactly once, so returning to the app does not re-navigate. */
    fun consume() {
        _entryId.value = null
    }
}

/**
 * Registers this device for push, once per signed-in session.
 *
 * Mirror of `usePushRegistration`. Every failure path is silent to the patient and loud in
 * logcat - the queue works without push, and an error about notifications on a booking
 * screen is noise about something they cannot fix. But it IS logged, because swallowing it
 * entirely made the RN version undiagnosable: push silently did nothing for a whole
 * testing session and the only evidence anywhere was `no registered device` on the server,
 * which names the symptom rather than the cause.
 */
@Composable
fun RegisterForPush() {
    val context = LocalContext.current
    val auth = LocalAuth.current
    val session by auth.state.collectAsStateWithLifecycle()

    // Register once per signed-in session, not on every recomposition.
    val registered = remember { mutableSetOf<String>() }

    val permission = rememberLauncherForActivityResult(
        ActivityResultContracts.RequestPermission(),
    ) { granted ->
        // Declined. That is their choice and the app carries on without it. The token is
        // still worth registering: a patient who later enables notifications in settings
        // then starts receiving them with no further prompt.
        if (!granted) Log.i(TAG, "notification permission declined - the queue still works")
    }

    LaunchedEffect(session.signedIn, session.accessToken) {
        val token = session.accessToken
        if (!session.signedIn || token == null) return@LaunchedEffect
        if (!registered.add(token)) return@LaunchedEffect

        ensureQueueChannel(context)

        // Android 13+ needs an explicit grant before anything is shown. Asked here rather
        // than at launch so the prompt lands on a patient who has already signed in and
        // has some idea what the app is for.
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            val granted = ContextCompat.checkSelfPermission(
                context,
                Manifest.permission.POST_NOTIFICATIONS,
            ) == PackageManager.PERMISSION_GRANTED
            if (!granted) permission.launch(Manifest.permission.POST_NOTIFICATIONS)
        }

        registerDeviceToken(context, auth)
    }
}

/**
 * Fetches the FCM token and hands it to the API.
 *
 * Separate from the composable above so `KramyaMessagingService.onNewToken` can call the
 * same path when Firebase rotates a token - which it does on reinstall, on restore from
 * backup, and occasionally for its own reasons. A rotated token that never reaches the
 * server is a device that stops receiving anything, silently.
 */
suspend fun registerDeviceToken(context: Context, auth: AuthStore) {
    if (!BuildConfig.PUSH_ENABLED) {
        Log.i(
            TAG,
            "push is not configured in this build - no google-services.json was present " +
                "when it was compiled. See apps/native/README.md, \"Turning push on\".",
        )
        return
    }

    try {
        // Belt and braces: PUSH_ENABLED says the plugin ran, this says Firebase actually
        // came up. Touching FirebaseMessaging without it throws.
        if (FirebaseApp.getApps(context).isEmpty()) {
            Log.w(TAG, "Firebase did not initialise - push is off for this install")
            return
        }

        val token = FirebaseMessaging.getInstance().token.await()

        val body = Json.encodeToString(
            JsonObject.serializer(),
            JsonObject(
                mapOf(
                    "token" to JsonPrimitive(token),
                    "platform" to JsonPrimitive("android"),
                ),
            ),
        )

        auth.authedFetch("/me/push-tokens", method = "POST", body = body).use { response ->
            if (!response.isSuccessful) {
                Log.w(TAG, "the API refused this device token: HTTP ${response.code}")
            }
        }
    } catch (error: Exception) {
        // Never surfaced to the patient.
        Log.w(TAG, "this device did not register, so it will receive nothing", error)
    }
}

/**
 * A Play Services `Task`, awaited.
 *
 * `kotlinx-coroutines-play-services` exists for exactly this and is eight lines' worth of
 * dependency. firebase-messaging already brings play-services-tasks, so this borrows the
 * type and skips the adapter.
 */
private suspend fun <T> Task<T>.await(): T = suspendCancellableCoroutine { continuation ->
    addOnSuccessListener { continuation.resume(it) { _, _, _ -> } }
    addOnFailureListener { continuation.resumeWithException(it) }
}
