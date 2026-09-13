package app.kramya.ui

import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import app.kramya.LocalRealtime
import app.kramya.net.MY_ACTIVE_ENTRIES
import app.kramya.net.MyQueueEntry
import app.kramya.net.Paginated
import app.kramya.net.useApi

/**
 * Every active entry this account holds, grouped by session.
 *
 * Mirror of `useMyActiveEntries` in apps/mobile/lib/visits.tsx.
 *
 * **No extra request.** This is the same path - and therefore the same cache entry - that
 * My Visits and the token card already use, and the query client dedupes concurrent
 * readers, so five screens asking at once produce one call.
 */
@Composable
fun useMyActiveEntries(enabled: Boolean = true): Map<String, List<MyQueueEntry>> {
    val query = useApi<Paginated<MyQueueEntry>>(MY_ACTIVE_ENTRIES, enabled = enabled)
    val items = query.data?.items
    return remember(items) { entriesBySession(items) }
}

/**
 * Watch one session's queue for as long as this screen is mounted.
 *
 * Mirror of `useLiveSession` in apps/mobile/lib/realtime.tsx. Unsubscribes on dispose, so
 * a patient browsing ten doctors does not end up listening to ten queues.
 */
@Composable
fun useLiveSession(sessionId: String?): Boolean {
    val realtime = LocalRealtime.current
    val connected by realtime.connected.collectAsStateWithLifecycle()

    DisposableEffect(sessionId, realtime) {
        if (sessionId.isNullOrEmpty()) return@DisposableEffect onDispose { }
        val leave = realtime.watch(sessionId)
        onDispose { leave() }
    }

    return connected
}

/**
 * Watch EVERY session on a list screen.
 *
 * A subscription is per session room, so a screen showing a dozen session cards was
 * subscribed to none of them: the numbers on those cards - now serving, checked in,
 * booked - sat frozen until the patient navigated away and back. The provider was already
 * invalidating these queries on `session.updated`; nothing was ever sending one, because
 * nobody had joined the rooms.
 *
 * Found by a tester on the department screen, and it applies to every list of cards.
 *
 * **The ids are joined into a string for the effect key.** The list is rebuilt on every
 * recomposition by `.map()`, so keying on it directly would unsubscribe and resubscribe
 * the whole list each time - a wasted round trip and a window in which an event is missed.
 */
@Composable
fun useLiveSessions(sessionIds: List<String>): Boolean {
    val realtime = LocalRealtime.current
    val connected by realtime.connected.collectAsStateWithLifecycle()
    val key = sessionIds.joinToString(",")

    DisposableEffect(key, realtime) {
        if (key.isEmpty()) return@DisposableEffect onDispose { }
        val leaves = key.split(",").map { realtime.watch(it) }
        onDispose { leaves.forEach { it() } }
    }

    return connected
}
