package app.kramya.net

import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Deferred
import kotlinx.coroutines.async
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import kotlinx.serialization.KSerializer
import java.util.concurrent.ConcurrentHashMap

/**
 * The cache. Kotlin's stand-in for TanStack Query, which is what apps/mobile runs on.
 *
 * **This file exists because every screen's behaviour IS TanStack's behaviour.** Which
 * request fires, when a skeleton shows, whether a pull-to-refresh spins, how a socket
 * event reaches a screen - all of it is the query client's semantics, not the screen's.
 * Getting this subtly wrong makes fifteen screens subtly wrong at once, which is why it
 * was built and unit-tested before a single pixel.
 *
 * What is reproduced, and why each one matters:
 *
 *  - **The path IS the key** (`useApi(path)` in lib/api.ts), query string included. One
 *    character of drift silently becomes a second cache entry and a second poller for the
 *    same data - the reason `MY_ACTIVE_ENTRIES` is a shared constant over there.
 *  - **In-flight dedupe.** Five screens read `MY_ACTIVE_ENTRIES` at once; they must issue
 *    one request between them.
 *  - **staleTime 30s, retry 1** - the defaults set in app/_layout.tsx. Thirty seconds is
 *    chosen against what these queries are: hospitals, departments, doctors and a
 *    patient's own profiles, none of which change while somebody browses. It does NOT
 *    make the live screens stale; those pass their own poll interval, and the socket
 *    invalidates directly. Neither path is gated by staleness.
 *  - **Predicate invalidation**, because lib/realtime.tsx invalidates on key prefixes.
 *  - **isPending / isFetching / isSuccess as distinct signals.** Screens branch on the
 *    difference: `pending` draws a skeleton, `isFetching && !isPending` spins the
 *    pull-to-refresh, `isSuccess && items.isEmpty()` is the empty state.
 *
 * What is deliberately NOT reproduced: garbage collection of unobserved entries. This app
 * holds at most a few dozen small JSON objects for the life of a process, and a cache
 * eviction policy nobody can observe is complexity with no reader.
 */
class QueryClient(
    private val auth: AuthStore,
    private val scope: CoroutineScope,
) {

    /** One cached path. `data` survives a failed refetch, exactly as TanStack's does. */
    data class Entry(
        val data: Any? = null,
        val error: Throwable? = null,
        /** When `data` last landed. 0 means never. */
        val updatedAt: Long = 0L,
        val fetching: Boolean = false,
        val hasData: Boolean = false,
    )

    private val _entries = MutableStateFlow<Map<String, Entry>>(emptyMap())
    val entries: StateFlow<Map<String, Entry>> = _entries.asStateFlow()

    /**
     * In-flight requests by key, so N readers of one path make one call.
     *
     * Concurrent rather than mutex-guarded: `computeIfAbsent` is atomic, which is exactly
     * and only what the dedupe needs, and it lets `observe` below be an ordinary function.
     */
    private val inFlight = ConcurrentHashMap<String, Deferred<Unit>>()

    /**
     * Keys with at least one mounted reader, and how to decode each.
     *
     * This is what makes invalidation work the way TanStack's does: invalidating refetches
     * the ACTIVE observers and merely marks everything else stale. Without the registry
     * there would be nothing to refetch with - the serializer lives at the call site.
     */
    private val observers = ConcurrentHashMap<String, ObserverEntry>()

    private data class ObserverEntry(val serializer: KSerializer<*>, val count: Int)

    /** Now, in millis. Overridable so a test can advance time without sleeping. */
    var clock: () -> Long = { System.currentTimeMillis() }

    // -----------------------------------------------------------------------------
    // Reading
    // -----------------------------------------------------------------------------

    /** A single path's state, for a screen to collect. */
    fun entryOf(key: String): Entry? = _entries.value[key]

    /**
     * Fetch unless the cached value is still fresh.
     *
     * This is the mount path: a screen that navigates back to a list it read ten seconds
     * ago shows it immediately and issues nothing, which is the whole point of staleTime.
     */
    suspend fun ensure(key: String, serializer: KSerializer<*>) {
        val entry = _entries.value[key]
        val fresh = entry != null && entry.hasData && clock() - entry.updatedAt < STALE_TIME_MS
        if (fresh) return
        fetch(key, serializer)
    }

    /**
     * Fetch now, joining an in-flight request for the same key if there is one.
     *
     * Joining rather than starting a second call is the dedupe: it is why five screens
     * reading the patient's active entries produce one request, not five.
     */
    suspend fun fetch(key: String, serializer: KSerializer<*>) {
        val job = inFlight.computeIfAbsent(key) { scope.async { run(key, serializer) } }
        // await(), not join(): a failure inside `run` is already recorded on the entry, so
        // this rethrows nothing - but awaiting means a caller knows the fetch is finished.
        runCatching { job.await() }
    }

    private suspend fun run(key: String, serializer: KSerializer<*>) {
        update(key) { it.copy(fetching = true) }
        var lastError: Throwable? = null

        // One retry, not three: a patient on a hospital's wi-fi would otherwise wait
        // through three silent backoffs before being told anything is wrong, and the
        // request path already turns a transport failure into "you appear to be offline".
        repeat(RETRY_COUNT + 1) {
            try {
                val value = request(key, serializer)
                update(key) {
                    Entry(
                        data = value,
                        error = null,
                        updatedAt = clock(),
                        fetching = false,
                        hasData = true,
                    )
                }
                inFlight.remove(key)
                return
            } catch (cancelled: CancellationException) {
                inFlight.remove(key)
                throw cancelled
            } catch (error: Throwable) {
                lastError = error
            }
        }

        // The previous data is kept. A background refetch that fails must not blank a
        // screen a patient is reading - it should say so and leave the numbers up.
        update(key) { it.copy(error = lastError, fetching = false) }
        inFlight.remove(key)
    }

    /**
     * One GET, decoded.
     *
     * The error mapping is lib/api.ts's, line for line: a transport failure becomes the
     * offline sentence, and a non-2xx surfaces the API's own message - which is written
     * to be shown to a patient and carries no internals (docs/Rules.md 7).
     */
    private suspend fun request(path: String, serializer: KSerializer<*>): Any {
        val response = auth.authedFetch(path)
        response.use {
            if (!it.isSuccessful) throw it.toApiException()
            val body = it.body?.string() ?: throw ApiException(GENERIC_ERROR_MESSAGE)
            return Api.json.decodeFromString(serializer, body) as Any
        }
    }

    // -----------------------------------------------------------------------------
    // Writing
    // -----------------------------------------------------------------------------

    /**
     * Mark matching keys stale and refetch the ones something is currently looking at.
     *
     * `predicate` null means everything - the no-argument `invalidateQueries()` that
     * lib/realtime.tsx calls on socket connect and on app foreground.
     *
     * Staleness is expressed by zeroing `updatedAt` rather than by dropping the data: a
     * screen that is about to be refetched should keep showing what it has until the new
     * answer lands, not flash a skeleton over numbers that were right a second ago.
     */
    fun invalidate(predicate: ((String) -> Boolean)? = null) {
        val keys = _entries.value.keys.filter { predicate?.invoke(it) ?: true }
        if (keys.isEmpty()) return

        _entries.value = _entries.value.toMutableMap().apply {
            for (key in keys) this[key]?.let { this[key] = it.copy(updatedAt = 0L) }
        }

        scope.launch {
            for (key in keys) {
                val observed = observers[key] ?: continue
                fetch(key, observed.serializer)
            }
        }
    }

    /** Drops everything. Used on sign-out, so the next account starts from nothing. */
    fun clear() {
        _entries.value = emptyMap()
    }

    // -----------------------------------------------------------------------------
    // Observer registry
    // -----------------------------------------------------------------------------

    /**
     * Registers a mounted reader. Returns the function that unregisters it.
     *
     * **Not a suspend function, and that is the point.** It used to take a mutex, so a
     * screen had to register from a coroutine - and a screen that was disposed before that
     * coroutine ran left an observer behind forever, which meant a closed screen still
     * costing a request on every socket event. An ordinary function called straight from
     * the effect cannot get out of step with its own disposal.
     */
    fun observe(key: String, serializer: KSerializer<*>): () -> Unit {
        observers.compute(key) { _, existing ->
            ObserverEntry(serializer, (existing?.count ?: 0) + 1)
        }
        return {
            observers.compute(key) { _, existing ->
                when {
                    existing == null -> null
                    existing.count <= 1 -> null
                    else -> existing.copy(count = existing.count - 1)
                }
            }
            Unit
        }
    }

    private fun update(key: String, transform: (Entry) -> Entry) {
        _entries.value = _entries.value.toMutableMap().apply {
            this[key] = transform(this[key] ?: Entry())
        }
    }

    companion object {
        /**
         * app/_layout.tsx: `staleTime: 30_000`.
         *
         * A bare client leaves this at 0, so every screen mount, every back-navigation and
         * every return to the foreground refires the request - and on a phone that is not
         * just load, it is a skeleton flashing over data the user was already looking at.
         */
        const val STALE_TIME_MS = 30_000L

        /** app/_layout.tsx: `retry: 1`. One retry, so two attempts in total. */
        const val RETRY_COUNT = 1
    }
}

/**
 * What a screen sees. Mirror of the fields lib/api.ts's callers actually read.
 *
 * The three status flags are mutually exclusive, as TanStack's are:
 *  - `isPending`  - nothing has resolved yet. Draw a skeleton.
 *  - `isSuccess`  - there is data and the last fetch succeeded.
 *  - `error`      - the last fetch failed. `data` may still be present and still worth
 *                   showing; the screen decides.
 *
 * `isFetching` is orthogonal: it is true during a background refetch too, which is what
 * `isFetching && !isPending` keys the pull-to-refresh spinner off.
 */
data class QueryResult<T>(
    val data: T?,
    val error: Throwable?,
    val isFetching: Boolean,
    val isPending: Boolean,
    val isSuccess: Boolean,
    val refetch: () -> Unit,
)

/** What a write looks like. Mirror of `useApiPost` in lib/api.ts. */
data class MutationResult<B, R>(
    val isPending: Boolean,
    val error: Throwable?,
    /**
     * Fire the write.
     *
     * A rejected command must be SURFACED, never swallowed - the server is the only thing
     * that decides whether a join or a cancel is allowed, and a screen that silently
     * ignores its answer is the failure docs/CLAUDE.md 9 names. So the error lands in
     * `error` and `onSuccess` simply does not run.
     */
    val mutate: (B, ((R) -> Unit)?) -> Unit,
)
