package app.kramya

import app.kramya.net.Api
import app.kramya.net.AuthStore
import app.kramya.net.AuthTokens
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.async
import kotlinx.coroutines.awaitAll
import kotlinx.coroutines.runBlocking
import kotlinx.coroutines.withContext
import okhttp3.mockwebserver.Dispatcher
import okhttp3.mockwebserver.MockResponse
import okhttp3.mockwebserver.MockWebServer
import okhttp3.mockwebserver.RecordedRequest
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test
import java.util.concurrent.TimeUnit
import java.util.concurrent.atomic.AtomicInteger

/**
 * The single most important test in this app.
 *
 * `AuthStore.rotate` is the port of the fix described at length in apps/mobile/lib/auth.tsx:
 * refresh tokens rotate, the API revokes the entire family when one is presented twice,
 * and this app fires several requests at once as a matter of course - so when the access
 * token expires they all get a 401 in the same instant. Without single-flighting, each
 * one posts the SAME refresh token, the first rotates it, the rest are read as replay,
 * the family dies, and the patient is thrown back to the sign-in screen while watching
 * their place in a queue.
 *
 * That bug is invisible in manual testing (you have to be unlucky, and it only bites
 * after fifteen minutes) and catastrophic in the field. It gets a test.
 */
class AuthStoreTest {

    private lateinit var server: MockWebServer
    private val refreshCount = AtomicInteger(0)

    @Before
    fun setUp() {
        server = MockWebServer()
        server.start()
        Api.baseUrl = server.url("/").toString().trimEnd('/')
        refreshCount.set(0)
    }

    @After
    fun tearDown() {
        server.shutdown()
    }

    /**
     * Every request with the stale token 401s; the fresh one succeeds. The refresh
     * endpoint is deliberately SLOW, so concurrent callers really do pile up behind the
     * rotation rather than finishing one after another by luck of scheduling.
     */
    private fun rotatingServer(refreshResponse: MockResponse? = null) {
        server.dispatcher = object : Dispatcher() {
            override fun dispatch(request: RecordedRequest): MockResponse {
                if (request.path == "/auth/refresh") {
                    refreshCount.incrementAndGet()
                    return refreshResponse ?: MockResponse()
                        .setResponseCode(200)
                        .setBody(tokensJson("fresh-access", "fresh-refresh"))
                        .setBodyDelay(150, TimeUnit.MILLISECONDS)
                }
                return if (request.getHeader("Authorization") == "Bearer fresh-access") {
                    MockResponse().setResponseCode(200).setBody("""{"ok":true}""")
                } else {
                    MockResponse().setResponseCode(401)
                        .setBody(errorJson("UNAUTHORIZED", "Token expired"))
                }
            }
        }
    }

    @Test
    fun `eight simultaneous 401s cause exactly one refresh`() = runBlocking {
        rotatingServer()
        val auth = AuthStore(FakeTokenStorage(AuthTokens("stale-access", "the-refresh-token")))

        val responses = withContext(Dispatchers.IO) {
            (1..8).map { async { auth.authedFetch("/patients") } }.awaitAll()
        }

        // The whole point: the server saw the refresh token ONCE. A second presentation
        // is what the API reads as replay, and it kills the family.
        assertEquals(1, refreshCount.get())

        // And every caller got a real answer, not an error.
        responses.forEach { response ->
            assertEquals(200, response.code)
            response.close()
        }
        assertTrue(auth.state.value.signedIn)
        assertEquals("fresh-access", auth.state.value.accessToken)
    }

    @Test
    fun `a request that raced a completed rotation retries instead of refreshing again`() =
        runBlocking {
            rotatingServer()
            val auth = AuthStore(FakeTokenStorage(AuthTokens("stale-access", "the-refresh-token")))

            // First call rotates.
            auth.authedFetch("/patients").close()
            assertEquals(1, refreshCount.get())

            // A second call now holds the fresh token from the start, so it never 401s.
            auth.authedFetch("/patients").close()
            assertEquals(1, refreshCount.get())
        }

    @Test
    fun `a refused refresh clears the session exactly once, for everyone waiting`() =
        runBlocking {
            // The API revoked the family - the session really is dead.
            rotatingServer(
                MockResponse().setResponseCode(401)
                    .setBody(errorJson("UNAUTHORIZED", "Refresh token reused"))
                    .setBodyDelay(150, TimeUnit.MILLISECONDS),
            )
            val storage = FakeTokenStorage(AuthTokens("stale-access", "replayed"))
            val auth = AuthStore(storage)

            val responses = withContext(Dispatchers.IO) {
                (1..4).map { async { auth.authedFetch("/patients") } }.awaitAll()
            }

            assertEquals(1, refreshCount.get())

            // The original 401 is handed back, so the caller surfaces the server's own
            // message rather than inventing one.
            responses.forEach { response ->
                assertEquals(401, response.code)
                response.close()
            }

            assertEquals(false, auth.state.value.signedIn)
            assertNull(auth.state.value.accessToken)
            assertNull(storage.load())
        }

    @Test
    fun `a transport failure reads as offline, not as a crash`() = runBlocking {
        // Nothing is listening on this port.
        server.shutdown()
        val auth = AuthStore(FakeTokenStorage(AuthTokens("a", "b")))

        val failure = runCatching { auth.authedFetch("/patients") }.exceptionOrNull()
        assertTrue(failure is app.kramya.net.ApiException)
        assertEquals(
            "You appear to be offline. Check your connection and try again.",
            failure?.message,
        )

        // Restarted so tearDown has something to shut down.
        server = MockWebServer().also { it.start() }
    }

    @Test
    fun `a restored session is signed in from the first frame`() {
        // No splash-and-flash: the RN app reads SecureStore asynchronously and has to gate
        // on it, which is why lib/auth.tsx carries a `ready` flag. Here the read is
        // synchronous, so a returning patient never sees the login screen appear first.
        val auth = AuthStore(FakeTokenStorage(AuthTokens("saved-access", "saved-refresh")))
        assertTrue(auth.state.value.ready)
        assertTrue(auth.state.value.signedIn)
        assertEquals("saved-access", auth.state.value.accessToken)
    }

    @Test
    fun `no stored tokens means ready and signed out`() {
        val auth = AuthStore(FakeTokenStorage(null))
        assertTrue(auth.state.value.ready)
        assertEquals(false, auth.state.value.signedIn)
    }
}
