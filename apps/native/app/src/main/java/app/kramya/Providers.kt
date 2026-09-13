package app.kramya

import android.content.Context
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.staticCompositionLocalOf
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.LifecycleEventObserver
import androidx.lifecycle.compose.LocalLifecycleOwner
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import app.kramya.net.AuthStore
import app.kramya.net.CityStore
import app.kramya.net.KeystoreTokenStorage
import app.kramya.net.LocalAuth
import app.kramya.net.LocalQueryClient
import app.kramya.net.QueryClient
import app.kramya.net.RealtimeClient
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob

/**
 * The app's singletons, built once and held by the process.
 *
 * apps/mobile builds these as nested React providers in app/_layout.tsx - QueryClient,
 * AuthProvider, RealtimeProvider, CityProvider - and the nesting there is load-bearing:
 * realtime needs the token AND the cache, so it has to sit inside both. The same
 * dependency order is expressed here by construction order, which makes it a compile
 * error to get wrong rather than a runtime one.
 *
 * No DI framework. Four objects, constructed in one place, in an app with no variants to
 * swap between.
 */
class Services(context: Context) {

    /**
     * A scope that outlives every screen.
     *
     * The cache must not be tied to a composition: a fetch started by a screen that is
     * navigated away from mid-flight should still land in the cache, because the next
     * screen probably wants it. SupervisorJob so one failed query cannot cancel the rest.
     */
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.Default)

    val auth = AuthStore(KeystoreTokenStorage(context))
    val query = QueryClient(auth, scope)
    val realtime = RealtimeClient(query)
    val city = CityStore(context)
}

val LocalCity = staticCompositionLocalOf<CityStore> {
    error("No CityStore. Wrap the app in Providers().")
}

val LocalRealtime = staticCompositionLocalOf<RealtimeClient> {
    error("No RealtimeClient. Wrap the app in Providers().")
}

/**
 * Publishes the singletons to the tree, and owns the two app-wide effects that
 * app/_layout.tsx and lib/realtime.tsx own in the RN app.
 */
@Composable
fun Providers(services: Services, content: @Composable () -> Unit) {
    val session by services.auth.state.collectAsStateWithLifecycle()

    // The socket follows the session, and is REBUILT when the token changes.
    //
    // That means a reconnect roughly every fifteen minutes, when the access token rotates.
    // It looks wasteful and it is what lib/realtime.tsx does - its effect depends on
    // [accessToken, signedIn] - and the reconnect is not a gap: the connect handler
    // re-joins every watched room and then invalidates everything, so a change that
    // happened during the swap is picked up rather than missed.
    LaunchedEffect(session.signedIn, session.accessToken) {
        val token = session.accessToken
        services.realtime.stop()
        if (session.signedIn && token != null) services.realtime.start(token)
    }

    // Coming back to the foreground refetches everything.
    //
    // A phone that has been in a pocket for an hour comes back with a socket that may or
    // may not still be alive, and a screen full of numbers that are certainly wrong. The
    // snapshot is the source of truth, and this is the one moment a patient is definitely
    // about to read it.
    val lifecycleOwner = LocalLifecycleOwner.current
    DisposableEffect(lifecycleOwner, services) {
        // Skip the first RESUME. React Native's AppState listener only fires on a CHANGE,
        // so it never sees the launch; ON_RESUME does, and invalidating an empty cache at
        // startup would fire every screen's query twice.
        var seenFirstResume = false
        val observer = LifecycleEventObserver { _, event ->
            if (event == Lifecycle.Event.ON_RESUME) {
                if (seenFirstResume) services.query.invalidate() else seenFirstResume = true
            }
        }
        lifecycleOwner.lifecycle.addObserver(observer)
        onDispose { lifecycleOwner.lifecycle.removeObserver(observer) }
    }

    CompositionLocalProvider(
        LocalAuth provides services.auth,
        LocalQueryClient provides services.query,
        LocalCity provides services.city,
        LocalRealtime provides services.realtime,
        content = content,
    )
}
