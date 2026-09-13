package app.kramya.net

import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.staticCompositionLocalOf
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.compose.LocalLifecycleOwner
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.repeatOnLifecycle
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.distinctUntilChanged
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.launch
import kotlinx.serialization.KSerializer
import kotlinx.serialization.serializer

// The Compose half of the cache - the direct equivalent of `useApi` and `useApiPost` in
// apps/mobile/lib/api.ts.
//
// Kept apart from Query.kt so that file stays plain Kotlin with no Compose imports, which
// is what lets the cache semantics - dedupe, staleness, retry, invalidation - be tested
// on the JVM without an Android device.

val LocalQueryClient = staticCompositionLocalOf<QueryClient> {
    error("No QueryClient. Wrap the app in Providers().")
}

val LocalAuth = staticCompositionLocalOf<AuthStore> {
    error("No AuthStore. Wrap the app in Providers().")
}

/**
 * A GET against the API, with the access token attached and errors turned into something
 * a patient can read.
 *
 * The path IS the cache key, so two screens asking for the same URL share one fetch and
 * one cache entry - including the query string, which is what varies.
 *
 * docs/Rules.md 9: server state lives in the query cache, never in component state.
 *
 * `refetchMs` polls while the screen is on and the app is in the foreground. Opt-in per
 * screen, and only worth it where the answer changes on its own - a live queue does, a
 * hospital's address does not.
 */
@Composable
inline fun <reified T : Any> useApi(
    path: String,
    enabled: Boolean = true,
    refetchMs: Long? = null,
): QueryResult<T> = useApiWith(path, enabled, refetchMs, serializer<T>())

/** The non-inline body. Public only because the reified wrapper above inlines into callers. */
@Composable
fun <T : Any> useApiWith(
    path: String,
    enabled: Boolean,
    refetchMs: Long?,
    serializer: KSerializer<T>,
): QueryResult<T> {
    val client = LocalQueryClient.current
    val scope = rememberCoroutineScope()

    // One key's slice of the cache, not the whole map.
    //
    // Collecting `client.entries` directly would recompose every screen in the app
    // whenever any query anywhere changed - and with a 2-second payment poll running,
    // that is constantly.
    val entry by remember(path) {
        client.entries.map { it[path] }.distinctUntilChanged()
    }.collectAsStateWithLifecycle(initialValue = client.entryOf(path))

    // Register as an active reader, and fetch if what we hold is stale.
    //
    // The registration is what makes invalidation work: `QueryClient.invalidate` refetches
    // the keys something is currently looking at, and it needs the serializer to do it.
    DisposableEffect(path, enabled, client) {
        var unregister: (() -> Unit)? = null
        val job = scope.launch {
            if (enabled) {
                unregister = client.observe(path, serializer)
                client.ensure(path, serializer)
            }
        }
        onDispose {
            job.cancel()
            unregister?.invoke()
        }
    }

    // The poll.
    //
    // `repeatOnLifecycle(RESUMED)` is what gives us TanStack's
    // `refetchIntervalInBackground: false` for free: the loop is cancelled the moment the
    // app leaves the foreground and restarted when it comes back. A phone in someone's
    // pocket must not poll a hospital API every two seconds for a screen nobody is
    // looking at.
    val lifecycleOwner = LocalLifecycleOwner.current
    LaunchedEffect(path, refetchMs, enabled, lifecycleOwner, client) {
        if (!enabled || refetchMs == null) return@LaunchedEffect
        lifecycleOwner.lifecycle.repeatOnLifecycle(Lifecycle.State.RESUMED) {
            while (true) {
                delay(refetchMs)
                client.fetch(path, serializer)
            }
        }
    }

    val refetch = remember(path, client) {
        { scope.launch { client.fetch(path, serializer) }; Unit }
    }

    val hasData = entry?.hasData == true
    val error = entry?.error

    @Suppress("UNCHECKED_CAST")
    return QueryResult(
        data = entry?.data as? T,
        error = error,
        isFetching = entry?.fetching == true,
        // Nothing has resolved yet, either way. This is the skeleton state.
        isPending = !hasData && error == null,
        isSuccess = hasData && error == null,
        refetch = refetch,
    )
}

/**
 * A write. Gives a screen `isPending` and `error` without it inventing its own loading
 * state (docs/Rules.md 9).
 *
 * Errors carry the server's message, which is written to be shown to a patient and
 * contains no internals. A rejected command must be SURFACED, never swallowed.
 */
@Composable
inline fun <reified B : Any, reified R : Any> useApiPost(
    path: String,
): MutationResult<B, R> = useApiPostWith(path, serializer<B>(), serializer<R>())

/** The non-inline body. Public only because the reified wrapper above inlines into callers. */
@Composable
fun <B : Any, R : Any> useApiPostWith(
    path: String,
    bodySerializer: KSerializer<B>,
    resultSerializer: KSerializer<R>,
): MutationResult<B, R> {
    val auth = LocalAuth.current
    val scope = rememberCoroutineScope()

    // Held as state objects rather than read through `by`, so the remembered lambda below
    // writes to the same instances across recompositions rather than to a stale capture.
    val pending = remember(path) { mutableStateOf(false) }
    val error = remember(path) { mutableStateOf<Throwable?>(null) }

    val mutate = remember(path, auth) {
        { body: B, onSuccess: ((R) -> Unit)? ->
            scope.launch {
                pending.value = true
                error.value = null
                try {
                    val payload = Api.json.encodeToString(bodySerializer, body)
                    auth.authedFetch(path, "POST", payload).use { response ->
                        if (!response.isSuccessful) throw response.toApiException()
                        val parsed = Api.json.decodeFromString(
                            resultSerializer,
                            response.body?.string() ?: throw ApiException(GENERIC_ERROR_MESSAGE),
                        )
                        pending.value = false
                        onSuccess?.invoke(parsed)
                    }
                } catch (failure: Throwable) {
                    error.value = failure
                    pending.value = false
                }
            }
            Unit
        }
    }

    return MutationResult(
        isPending = pending.value,
        error = error.value,
        mutate = mutate,
    )
}
