package app.kramya

import android.content.Intent
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.SystemBarStyle
import androidx.activity.enableEdgeToEdge
import android.graphics.Color as AndroidColor
import app.kramya.nav.AppNav
import app.kramya.push.KramyaMessagingService
import app.kramya.push.PendingDeepLink

/**
 * The only Activity.
 *
 * expo-router runs the whole RN app inside a single Android activity and swaps React
 * trees; navigation-compose does the same with composables. Matching that keeps the
 * back-button and task-switching behaviour identical, which a multi-activity design would
 * not.
 *
 * `enableEdgeToEdge` is not a style choice: from Android 15 the system draws behind the
 * bars whether an app opts in or not, so the only question is whether the app knows. It
 * does - `Screen` and `NavBar` take the status inset, `TabBar` takes the navigation one.
 */
class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        /*
          Light bars, explicitly, on both ends.

          A bare `enableEdgeToEdge()` picks the bar icon colour from the SYSTEM theme, so a
          phone in dark mode would get white status icons over this app's near-white
          canvas - invisible. app.json pins `userInterfaceStyle: "light"` and the ink system
          has no dark palette, so the bars are pinned to match.
        */
        enableEdgeToEdge(
            statusBarStyle = SystemBarStyle.light(AndroidColor.TRANSPARENT, AndroidColor.TRANSPARENT),
            navigationBarStyle = SystemBarStyle.light(AndroidColor.TRANSPARENT, AndroidColor.TRANSPARENT),
        )
        super.onCreate(savedInstanceState)
        // The tap that STARTED the app. Without this, a patient who taps "you are being
        // called" on a locked phone lands on the home screen - the one moment push exists
        // for. `onNewIntent` below covers the app-already-running case.
        PendingDeepLink.offer(intent?.getStringExtra(KramyaMessagingService.EXTRA_ENTRY_ID))

        val services = (application as KramyaApp).services
        setContent {
            Providers(services) { AppNav() }
        }
    }

    /** A tap while the app was already running. `launchMode="singleTask"` routes it here. */
    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        setIntent(intent)
        PendingDeepLink.offer(intent.getStringExtra(KramyaMessagingService.EXTRA_ENTRY_ID))
    }
}
