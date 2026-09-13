package app.kramya.push

import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.util.Log
import androidx.core.app.NotificationCompat
import app.kramya.KramyaApp
import app.kramya.MainActivity
import app.kramya.R
import com.google.firebase.messaging.FirebaseMessagingService
import com.google.firebase.messaging.RemoteMessage
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.launch

/**
 * Receives pushes from FCM.
 *
 * The server sends a `notification` block AND a `data` block, so Android's own tray renders
 * the message whatever state this app is in - including not running at all, which is the
 * case this whole feature exists for. This class therefore only has to handle two things:
 * a rotated token, and a message that arrives while the app is in the foreground.
 */
class KramyaMessagingService : FirebaseMessagingService() {

    /**
     * Its own scope, not the app's.
     *
     * A service can be created and destroyed independently of any Activity or composition,
     * and this work must finish even if nothing is on screen.
     */
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)

    /**
     * Firebase rotated this device's token.
     *
     * Happens on reinstall, on restore-from-backup, and occasionally for its own reasons. A
     * rotated token that never reaches the server is a device that stops receiving
     * anything, silently - the server keeps sending to a token FCM will reject, and the
     * pruning then disables a perfectly live device.
     *
     * Registration needs a session. If nobody is signed in, this does nothing and
     * `RegisterForPush` picks it up at the next sign-in.
     */
    override fun onNewToken(token: String) {
        val auth = (application as? KramyaApp)?.services?.auth ?: return
        if (!auth.state.value.signedIn) return
        scope.launch { registerDeviceToken(applicationContext, auth) }
    }

    /**
     * A message arrived while the app is in the foreground.
     *
     * Android does NOT render the tray notification in this state - it hands the whole
     * message here instead - so without this, the one message that means "stand up and
     * walk" is the one a patient staring at their token screen would never see.
     *
     * The RN app makes the same choice explicitly, via `setNotificationHandler` with
     * `shouldShowBanner: true`, and for the same reason.
     */
    override fun onMessageReceived(message: RemoteMessage) {
        val notification = message.notification
        val title = notification?.title ?: return
        val body = notification.body.orEmpty()

        // The only field read from the payload, and only to decide where a tap goes.
        // Everything the screen then shows is fetched over REST (docs/Rules.md 8).
        val entryId = message.data["entryId"]

        ensureQueueChannel(this)

        val intent = Intent(this, MainActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_SINGLE_TOP or Intent.FLAG_ACTIVITY_CLEAR_TOP
            if (entryId != null) putExtra(EXTRA_ENTRY_ID, entryId)
        }

        val pending = PendingIntent.getActivity(
            this,
            // The entry id as the request code, so two notifications about two different
            // bookings do not collapse into one PendingIntent pointing at whichever
            // arrived first.
            entryId?.hashCode() ?: 0,
            intent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
        )

        val built = NotificationCompat.Builder(this, QUEUE_CHANNEL_ID)
            .setContentTitle(title)
            .setContentText(body)
            .setStyle(NotificationCompat.BigTextStyle().bigText(body))
            .setSmallIcon(R.mipmap.ic_launcher)
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setDefaults(NotificationCompat.DEFAULT_ALL)
            .setAutoCancel(true)
            .setContentIntent(pending)
            .build()

        val manager = getSystemService(Context.NOTIFICATION_SERVICE) as? NotificationManager
        if (manager == null) {
            Log.w("kramya.push", "no NotificationManager - foreground push not shown")
            return
        }
        // Keyed on the entry, so a second update about the SAME booking replaces the first
        // rather than stacking. A patient does not need four rows about one token.
        manager.notify(entryId?.hashCode() ?: 0, built)
    }

    companion object {
        /** The intent extra a tap carries into MainActivity. */
        const val EXTRA_ENTRY_ID = "kramya.entryId"
    }
}
