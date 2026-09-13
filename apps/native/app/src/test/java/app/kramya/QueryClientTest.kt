package app.kramya

import app.kramya.net.Api
import app.kramya.net.AuthStore
import app.kramya.net.AuthTokens
import app.kramya.net.City
import app.kramya.net.Paginated
import app.kramya.net.QueryClient
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.async
import kotlinx.coroutines.awaitAll
import kotlinx.coroutines.cancel
import kotlinx.coroutines.runBlocking
import kotlinx.coroutines.withContext
import kotlinx.serialization.builtins.serializer
import okhttp3.mockwebserver.Dispatcher
import okhttp3.mockwebserver.MockResponse
import okhttp3.mockwebserver.MockWebServer
import okhttp3.mockwebserver.RecordedRequest
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test
import java.util.concurrent.TimeUnit
import java.util.concurrent.atomic.AtomicInteger

/**
 * The cache semantics every screen in the app inherits.
 *
 * These assert the four behaviours that apps/mobile gets from TanStack Query and that
 * fifteen screens silently depend on: dedupe, staleTime, retry, and predicate-scoped
 * invalidation. A divergence here does not look like a bug in this file - it looks like a
 * screen that flickers, or polls twice, or shows a stale queue position.
 */
class QueryClientTest {

    private lateinit var server: MockWebServer
    private lateinit var scope: CoroutineScope
    private lateinit var client: QueryClient
    private val hits = mutableMapOf<String, AtomicInteger>()

    /** A page of cities - a real contract shape, so the decode is exercised too. */
    private val citySerializer = Paginated.serializer(City.serializer())

    private fun countFor(path: String) = hits.getOrPut(path) { AtomicInteger(0) }

    @Before
    fun setUp() {
        server = MockWebServer()
        server.start()
        Api.baseUrl = server.url("/").toString().trimEnd('/')
        hits.clear()

        server.dispatcher = object : Dispatcher() {
            override fun dispatch(request: RecordedRequest): MockResponse {
                val path = request.path.orEmpty()
                countFor(path).incrementAndGet()
                return MockResponse()
                    .setResponseCode(200)
                    .setBody("""{"items":[{"name":"Mumbai","hospitalCount":4}],"total":1,"limit":50,"offset":0}""")
                    // Slow enough that two concurrent callers genuinely overlap, rather
                    // than the second arriving after the first has already finished.
                    .setBodyDelay(120, TimeUnit.MILLISECONDS)
            }
        }

        scope = CoroutineScope(SupervisorJob() + Dispatchers.Default)
        client = QueryClient(AuthStore(FakeTokenStorage(AuthTokens("a", "b"))), scope)
    }

    @After
    fun tearDown() {
        scope.cancel()
        server.shutdown()
    }

    // -----------------------------------------------------------------------------

    @Test
    fun `concurrent readers of one path make one request`() = runBlocking {
        // The reason this matters: MY_ACTIVE_ENTRIES is read by five screens at once -
        // the token card, My Visits, the join screen and both card lists. Five requests
        // for one answer, every time any of them mounts, is the bug this prevents.
        withContext(Dispatchers.IO) {
            (1..5).map { async { client.fetch("/cities?limit=50", citySerializer) } }.awaitAll()
        }
        assertEquals(1, countFor("/cities?limit=50").get())
    }

    @Test
    fun `a fresh entry is not refetched`() = runBlocking {
        client.ensure("/cities?limit=50", citySerializer)
        assertEquals(1, countFor("/cities?limit=50").get())

        // Navigating back to a list read a moment ago must show it immediately and issue
        // nothing - the whole point of staleTime, and what stops a skeleton flashing over
        // data the patient was already looking at.
        client.ensure("/cities?limit=50", citySerializer)
        client.ensure("/cities?limit=50", citySerializer)
        assertEquals(1, countFor("/cities?limit=50").get())
    }

    @Test
    fun `an entry older than the stale time is refetched`() = runBlocking {
        var now = 1_000_000L
        client.clock = { now }

        client.ensure("/cities?limit=50", citySerializer)
        assertEquals(1, countFor("/cities?limit=50").get())

        now += QueryClient.STALE_TIME_MS - 1
        client.ensure("/cities?limit=50", citySerializer)
        assertEquals("still fresh one millisecond early", 1, countFor("/cities?limit=50").get())

        now += 2
        client.ensure("/cities?limit=50", citySerializer)
        assertEquals(2, countFor("/cities?limit=50").get())
    }

    @Test
    fun `the query string is part of the key`() = runBlocking {
        // Two cities are two cache entries. If the key were the path without its query,
        // switching city would show the previous city's hospitals.
        client.ensure("/hospitals?city=Mumbai&limit=50", citySerializer)
        client.ensure("/hospitals?city=Pune&limit=50", citySerializer)
        assertEquals(1, countFor("/hospitals?city=Mumbai&limit=50").get())
        assertEquals(1, countFor("/hospitals?city=Pune&limit=50").get())
    }

    @Test
    fun `one retry, then the error is recorded`() = runBlocking {
        val attempts = AtomicInteger(0)
        server.dispatcher = object : Dispatcher() {
            override fun dispatch(request: RecordedRequest): MockResponse {
                attempts.incrementAndGet()
                return MockResponse().setResponseCode(500)
                    .setBody(errorJson("INTERNAL_ERROR", "Something went wrong. Please try again."))
            }
        }

        client.fetch("/cities?limit=50", citySerializer)

        // retry: 1 in app/_layout.tsx means two attempts in total - not three. A patient
        // on hospital wi-fi should not wait through three silent backoffs to be told
        // anything is wrong.
        assertEquals(2, attempts.get())

        val entry = client.entryOf("/cities?limit=50")
        assertNotNull(entry?.error)
        assertEquals(false, entry?.fetching)
        assertEquals(false, entry?.hasData)
    }

    @Test
    fun `a failed refetch keeps the data it already had`() = runBlocking {
        client.fetch("/cities?limit=50", citySerializer)
        assertNotNull(client.entryOf("/cities?limit=50")?.data)

        server.dispatcher = object : Dispatcher() {
            override fun dispatch(request: RecordedRequest) =
                MockResponse().setResponseCode(503).setBody(errorJson("INTERNAL_ERROR", "down"))
        }
        client.fetch("/cities?limit=50", citySerializer)

        // A background refetch that fails must not blank a screen a patient is reading.
        // The numbers stay up and the error is reported alongside them.
        val entry = client.entryOf("/cities?limit=50")
        assertNotNull("data survives a failed refetch", entry?.data)
        assertNotNull(entry?.error)
    }

    @Test
    fun `invalidate refetches only the observed keys that match`() = runBlocking {
        val watched = "/sessions/abc"
        val other = "/hospitals?city=Mumbai&limit=50"

        client.observe(watched, citySerializer)
        client.observe(other, citySerializer)
        client.fetch(watched, citySerializer)
        client.fetch(other, citySerializer)
        assertEquals(1, countFor(watched).get())
        assertEquals(1, countFor(other).get())

        // This is exactly what lib/realtime.tsx does on `session.updated`: a prefix match,
        // not a blanket refetch.
        client.invalidate { key -> key.startsWith("/sessions/abc") }
        waitFor { countFor(watched).get() == 2 }

        assertEquals(2, countFor(watched).get())
        assertEquals("an unrelated key is untouched", 1, countFor(other).get())
    }

    @Test
    fun `invalidate does not refetch a key nothing is looking at`() = runBlocking {
        // TanStack refetches ACTIVE observers and merely marks the rest stale. Refetching
        // an unobserved key would mean a screen the patient closed an hour ago still
        // costing them a request on every socket event.
        client.fetch("/cities?limit=50", citySerializer)
        assertEquals(1, countFor("/cities?limit=50").get())

        client.invalidate()
        Thread.sleep(250)
        assertEquals(1, countFor("/cities?limit=50").get())

        // But it IS marked stale, so the next mount refetches rather than serving a value
        // the server has just told us is out of date.
        assertEquals(0L, client.entryOf("/cities?limit=50")?.updatedAt)
        client.ensure("/cities?limit=50", citySerializer)
        assertEquals(2, countFor("/cities?limit=50").get())
    }

    @Test
    fun `an unregistered observer stops being refetched`() = runBlocking {
        val key = "/sessions/abc"
        val stop = client.observe(key, citySerializer)
        client.fetch(key, citySerializer)

        stop()
        // `stop` unregisters on the client's own scope, so give it a moment to land.
        Thread.sleep(150)

        client.invalidate { it == key }
        Thread.sleep(250)
        assertEquals(1, countFor(key).get())
    }

    @Test
    fun `clear drops everything`() = runBlocking {
        client.fetch("/cities?limit=50", citySerializer)
        assertNotNull(client.entryOf("/cities?limit=50"))
        client.clear()
        assertNull(client.entryOf("/cities?limit=50"))
    }

    @Test
    fun `a non-contract body surfaces as an error rather than corrupt data`() = runBlocking {
        server.dispatcher = object : Dispatcher() {
            override fun dispatch(request: RecordedRequest) =
                MockResponse().setResponseCode(200).setBody("""{"unexpected":true}""")
        }
        client.fetch("/cities?limit=50", String.serializer())

        val entry = client.entryOf("/cities?limit=50")
        assertNotNull(entry?.error)
        assertEquals(false, entry?.hasData)
    }

    /** Polls a condition rather than sleeping a fixed time, so the test is not flaky-slow. */
    private fun waitFor(timeoutMs: Long = 3_000, condition: () -> Boolean) {
        val deadline = System.currentTimeMillis() + timeoutMs
        while (System.currentTimeMillis() < deadline) {
            if (condition()) return
            Thread.sleep(20)
        }
        assertTrue("condition never became true within ${timeoutMs}ms", condition())
    }
}
