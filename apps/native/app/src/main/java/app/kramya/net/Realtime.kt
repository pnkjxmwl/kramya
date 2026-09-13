package app.kramya.net

import io.socket.client.IO
import io.socket.client.Socket
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import org.json.JSONObject
import java.net.URI
import java.util.Collections

/**
 * The live connection. Mirror of apps/mobile/lib/realtime.tsx.
 *
 * **An event invalidates a query. It never carries state into one.** docs/Rules.md 8: on
 * (re)connect the client fetches the REST snapshot and never replays events - and this
 * applies that rule to the steady state too, so there is exactly one path by which a
 * screen learns anything, whether it has been open for a second or an hour. A dropped
 * event costs a stale second; a dropped event in a delta-applying client costs
 * correctness, silently.
 *
 * The socket lives at the root and follows the session: one connection for the whole app
 * rather than one per screen, because a patient flicking between a session card and their
 * token would otherwise reconnect on every navigation.
 */
class RealtimeClient(private val query: QueryClient) {

    private val _connected = MutableStateFlow(false)
    val connected: StateFlow<Boolean> = _connected.asStateFlow()

    private var socket: Socket? = null

    /**
     * Rooms this client wants to be in, so they can be re-joined after a reconnect.
     *
     * Synchronised because it is written from Compose effects on the main thread and read
     * from socket.io's own IO thread inside the connect handler.
     */
    private val watched: MutableSet<String> = Collections.synchronizedSet(mutableSetOf())

    /** Opens the socket for a signed-in session. Safe to call when one is already open. */
    fun start(accessToken: String) {
        if (socket != null) return

        val options = IO.Options().apply {
            // The token goes in the handshake `auth` payload rather than a query string:
            // query strings end up in access logs and proxy logs, and this is a bearer
            // credential. The gateway reads `handshake.auth.token`.
            auth = mapOf("token" to accessToken)
            transports = arrayOf("websocket")
            // A phone loses signal in a lift and in a hospital basement. Reconnecting is
            // the normal case here, not the exception.
            reconnection = true
            reconnectionDelay = 1_000
            reconnectionDelayMax = 10_000
        }

        val created = IO.socket(URI.create(Api.baseUrl), options)
        socket = created

        created.on(Socket.EVENT_CONNECT) {
            _connected.value = true
            // Re-join every room, THEN refetch everything on screen. In that order: a
            // change that happened while the socket was down would otherwise sit on the
            // screen until the next navigation. This IS the reconnect contract.
            synchronized(watched) { watched.toList() }.forEach { subscribe(created, it) }
            query.invalidate()
        }

        created.on(Socket.EVENT_DISCONNECT) { _connected.value = false }
        created.on(Socket.EVENT_CONNECT_ERROR) { _connected.value = false }

        // Their own booking moved: called, skipped, cancelled, refunded.
        created.on(RealtimeEvent.ENTRY_UPDATED) {
            query.invalidate { key -> key == MY_ACTIVE_ENTRIES }
        }

        // The queue they are watching moved - including the ETA tick, which fires with no
        // change at all, because time passing is the change.
        created.on(RealtimeEvent.SESSION_UPDATED) { args ->
            val sessionId = (args.firstOrNull() as? JSONObject)?.optString("sessionId").orEmpty()
            query.invalidate { key ->
                (sessionId.isNotEmpty() && key.startsWith("/sessions/$sessionId")) ||
                    // The card lists carry this session's live numbers too.
                    key.startsWith("/departments/") ||
                    key.startsWith("/doctors/") ||
                    key == MY_ACTIVE_ENTRIES
            }
        }

        created.connect()
    }

    /** Closes the socket. Called on sign-out and when the token changes. */
    fun stop() {
        socket?.off()
        socket?.close()
        socket = null
        _connected.value = false
    }

    /**
     * Watch one session's queue. Returns the function that stops watching.
     *
     * A socket that is not up yet is fine: the id is in `watched`, and the connect handler
     * re-joins everything there.
     */
    fun watch(sessionId: String): () -> Unit {
        watched.add(sessionId)
        socket?.let { subscribe(it, sessionId) }
        return {
            watched.remove(sessionId)
            socket?.emit("unsubscribe", JSONObject().put("sessionId", sessionId))
        }
    }

    /**
     * Sent WITH an ack callback even though the answer is discarded.
     *
     * The RN app calls `emitWithAck`, so the server sees a packet that requests one. The
     * result is ignored in both: a refusal means the session is not visible to this
     * account, and the REST read for that screen will say so in language a patient can
     * read - which is the only place that message belongs.
     */
    private fun subscribe(on: Socket, sessionId: String) {
        on.emit("subscribe", arrayOf<Any>(JSONObject().put("sessionId", sessionId))) { }
    }
}
