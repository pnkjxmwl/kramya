package app.kramya

import android.app.Application
import app.kramya.net.Api
import coil3.ImageLoader
import coil3.PlatformContext
import coil3.SingletonImageLoader
import coil3.network.okhttp.OkHttpNetworkFetcherFactory
import coil3.request.crossfade

/**
 * The process.
 *
 * Two jobs: own `Services` for the life of the app - the cache, the session and the socket
 * all have to outlive any one Activity or composition - and build the image loader.
 */
class KramyaApp : Application(), SingletonImageLoader.Factory {

    val services: Services by lazy { Services(this) }

    /**
     * Coil, with a network fetcher wired in **explicitly**.
     *
     * This is not boilerplate. Coil 3 does not register a network fetcher on its own:
     * without this, every `AsyncImage` fails to load and the app degrades to the initials
     * fallback everywhere. It fails SILENTLY and it fails to a state that looks
     * deliberate - `Photo` is designed so a missing image shows initials - so a hospital
     * with a perfectly good photograph would just quietly never show it, on every screen,
     * with nothing in the logs to say why.
     *
     * The call factory is the app's ONE OkHttpClient, so images share its connection pool,
     * its timeouts and its DNS cache rather than standing up a second HTTP stack.
     */
    override fun newImageLoader(context: PlatformContext): ImageLoader =
        ImageLoader.Builder(context)
            .components { add(OkHttpNetworkFetcherFactory(callFactory = { Api.client })) }
            // 220ms, matching the fade `lib/ui.tsx` runs by hand with Animated.timing.
            .crossfade(220)
            .build()
}
