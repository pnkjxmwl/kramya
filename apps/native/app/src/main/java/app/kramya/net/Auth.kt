package app.kramya.net

import android.content.Context
import android.content.SharedPreferences
import androidx.security.crypto.EncryptedSharedPreferences
import androidx.security.crypto.MasterKey
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import kotlinx.coroutines.withContext
import okhttp3.Response
import java.io.IOException

/** What the rest of the app knows about the session. Mirror of AuthState in lib/auth.tsx. */
data class AuthSnapshot(
    /** False until the keystore has been read; screens must not decide before this. */
    val ready: Boolean = false,
    val signedIn: Boolean = false,
    /**
     * The current access token, for the realtime handshake.
     *
     * Exposed here rather than re-read from the store by the socket, so there is one copy
     * and it is always the one `authedFetch` is using - including right after a refresh,
     * when a second reader would still be holding the old one.
     */
    val accessToken: String? = null,
)

/**
 * The session. Mirror of apps/mobile/lib/auth.tsx.
 *
 * Tokens go in the OS keystore, never plain preferences (docs/Rules.md 10) - the same
 * guarantee `expo-secure-store` gives the RN app.
 */
class AuthStore(private val store: TokenStorage) {

    private val _state = MutableStateFlow(AuthSnapshot())
    val state: StateFlow<AuthSnapshot> = _state.asStateFlow()

    /**
     * The tokens, readable without suspending.
     *
     * `authedFetch` runs concurrently from a dozen screens, and a request that has been
     * in flight for a second must not decide what to do about a 401 using the tokens that
     * were current when it started. The StateFlow is for rendering; this is what the
     * network path reads. Same split as `tokensRef` vs `tokens` in lib/auth.tsx.
     */
    @Volatile
    private var tokens: AuthTokens? = null

    /**
     * Exactly one rotation at a time - the fix for a bug that signed patients out every
     * fifteen minutes.
     *
     * Refresh tokens rotate, and the API revokes the whole family when one is presented
     * twice. That is correct and is the entire security value of a token family. But this
     * app issues several requests at once as a matter of course - Discover alone asks for
     * patients, hospitals and doctors together, and the token screen polls - so when the
     * access token expires they all get a 401 in the same instant. Without this lock each
     * one would independently post the SAME refresh token: the first rotates it, the rest
     * are read as replay, and the family dies. The patient is thrown back to the sign-in
     * screen while watching their place in a queue.
     *
     * lib/auth.tsx solves this by sharing one in-flight Promise, because JavaScript has
     * no lock. Kotlin does, so this holds the mutex across the whole rotation and every
     * other caller re-checks the token after acquiring it - fewer moving parts, same
     * guarantee: the server never sees one refresh token presented twice.
     */
    private val rotation = Mutex()

    init {
        // Read synchronously in the constructor rather than in a coroutine.
        //
        // EncryptedSharedPreferences does its key unwrap on first open, which is disk +
        // keystore work - but it happens once, at process start, before any screen exists.
        // The RN app has to do this asynchronously and show a splash for it; here the
        // whole app is constructed after it, so `ready` is true from the first frame and
        // there is no window in which a signed-in user sees the login screen flash.
        tokens = store.load()
        _state.value =
            AuthSnapshot(ready = true, signedIn = tokens != null, accessToken = tokens?.accessToken)
    }

    // -----------------------------------------------------------------------------
    // Commands
    // -----------------------------------------------------------------------------

    suspend fun signIn(email: String, password: String) {
        persist(post("/auth/login", Api.json.encodeToString(LoginRequest.serializer(), LoginRequest(email, password))))
    }

    suspend fun signUp(email: String, password: String, name: String?) {
        // The name creates the account holder's own SELF patient profile server-side.
        val body = SignupRequest(email, password, name?.takeIf { it.isNotBlank() })
        persist(post("/auth/signup", Api.json.encodeToString(SignupRequest.serializer(), body)))
    }

    suspend fun signOut() {
        val held = tokens
        if (held != null) {
            // Revoke server-side so the token FAMILY dies, not just this device's copy.
            // Failure is ignored on purpose: a patient who taps Sign out must end up
            // signed out of this phone whatever the network is doing.
            runCatching {
                post("/auth/logout", Api.json.encodeToString(LogoutRequest.serializer(), LogoutRequest(held.refreshToken)))
            }
        }
        persist(null)
    }

    // -----------------------------------------------------------------------------
    // The authenticated call
    // -----------------------------------------------------------------------------

    /**
     * A call against the API with the access token attached, refreshing once on a 401.
     *
     * The caller owns the returned Response and must close it.
     */
    suspend fun authedFetch(path: String, method: String = "GET", body: String? = null): Response {
        // Read at the moment of sending, not from a captured value: several of these run
        // concurrently and one of them may rotate while the others are in flight.
        val sent = tokens?.accessToken
        val first = call(path, method, body, sent)
        if (first.code != 401 || tokens == null) return first

        val current = tokens?.accessToken
        if (current != sent) {
            // Somebody else already rotated while this request was on the wire, so the
            // token it used is simply out of date. Retry with the current one - asking for
            // another rotation here would present a refresh token that has been consumed
            // and would be read, correctly, as replay.
            first.close()
            return call(path, method, body, current)
        }

        return try {
            val refreshed = rotate(staleAccessToken = sent)
            first.close()
            call(path, method, body, refreshed.accessToken)
        } catch (_: Exception) {
            // `rotate` has already cleared the session; hand back the original 401 so the
            // caller surfaces the server's own message rather than inventing one.
            first
        }
    }

    /**
     * Rotate the refresh token - at most one rotation at a time, however many callers ask.
     *
     * A failure here means the session really is dead - expired, or revoked because
     * somebody else replayed it - so the tokens are cleared and the throw propagates.
     */
    private suspend fun rotate(staleAccessToken: String?): AuthTokens = rotation.withLock {
        // Re-check under the lock. If we waited behind another caller's rotation, the
        // token in hand is already fresh and asking again would burn a second one.
        val held = tokens ?: throw ApiException("Signed out")
        if (held.accessToken != staleAccessToken) return@withLock held

        try {
            val next = post("/auth/refresh", Api.json.encodeToString(RefreshRequest.serializer(), RefreshRequest(held.refreshToken)))
            persist(next)
            next
        } catch (error: Exception) {
            persist(null)
            throw error
        }
    }

    // -----------------------------------------------------------------------------
    // Plumbing
    // -----------------------------------------------------------------------------

    private suspend fun call(
        path: String,
        method: String,
        body: String?,
        accessToken: String?,
    ): Response = withContext(Dispatchers.IO) {
        try {
            Api.client.newCall(Api.request(path, method, body, accessToken)).execute()
        } catch (_: IOException) {
            // OkHttp throws only on a transport failure, which on a phone almost always
            // means no signal. Saying so beats "Unable to resolve host".
            throw ApiException(OFFLINE_MESSAGE)
        }
    }

    /** An unauthenticated POST that expects a token pair back. */
    private suspend fun post(path: String, body: String): AuthTokens =
        call(path, "POST", body, accessToken = null).use { response ->
            if (!response.isSuccessful) throw response.toApiException()
            Api.json.decodeFromString(AuthTokens.serializer(), response.body!!.string())
        }

    private fun persist(next: AuthTokens?) {
        // The volatile field first: a concurrent request checking whether its token is
        // already stale must see the new one immediately, not after a flow has emitted.
        tokens = next
        store.save(next)
        _state.value = AuthSnapshot(
            ready = true,
            signedIn = next != null,
            accessToken = next?.accessToken,
        )
    }

}

/**
 * Where the two tokens live.
 *
 * An interface with exactly one production implementation, which is normally the kind of
 * abstraction that earns nothing. It earns its place here: `AuthStore`'s single-flight
 * rotation is the most important concurrency code in the app - it is what stops a burst
 * of simultaneous 401s from killing the refresh-token family and signing a patient out
 * mid-queue - and `EncryptedSharedPreferences` needs a real Android Context, so without
 * this seam that logic could not be tested on the JVM at all.
 */
interface TokenStorage {
    fun load(): AuthTokens?
    fun save(tokens: AuthTokens?)
}

/**
 * The OS keystore, with a plain-preferences fallback.
 *
 * **The fallback is not a security shortcut, it is an "the app must open" guarantee.**
 * EncryptedSharedPreferences fails hard on a small number of real devices - a corrupted
 * keystore entry after a restore-from-backup is the usual cause - and it throws on OPEN,
 * which would mean an app that crashes on launch and cannot even be signed out of.
 * Dropping to plain preferences degrades token storage to what most apps do anyway, and
 * these tokens are short-lived and server-revocable.
 *
 * ponytail: androidx.security.crypto is an alpha and Jetpack Security is no longer
 * actively developed. If it is withdrawn, the replacement is ~60 lines - generate an
 * AES-GCM key in the AndroidKeyStore and wrap the two strings by hand.
 */
class KeystoreTokenStorage(context: Context) : TokenStorage {

    private val prefs: SharedPreferences = try {
        val key = MasterKey.Builder(context)
            .setKeyScheme(MasterKey.KeyScheme.AES256_GCM)
            .build()
        EncryptedSharedPreferences.create(
            context,
            "kramya.session",
            key,
            EncryptedSharedPreferences.PrefKeyEncryptionScheme.AES256_SIV,
            EncryptedSharedPreferences.PrefValueEncryptionScheme.AES256_GCM,
        )
    } catch (_: Exception) {
        context.getSharedPreferences("kramya.session.fallback", Context.MODE_PRIVATE)
    }

    override fun load(): AuthTokens? {
        val access = prefs.getString(ACCESS_KEY, null) ?: return null
        val refresh = prefs.getString(REFRESH_KEY, null) ?: return null
        // expiresIn is not persisted: it is a duration, and a duration read back after the
        // process was killed for an hour is a lie. Expiry is discovered from a 401.
        return AuthTokens(access, refresh)
    }

    override fun save(tokens: AuthTokens?) {
        prefs.edit().apply {
            if (tokens == null) {
                remove(ACCESS_KEY)
                remove(REFRESH_KEY)
            } else {
                putString(ACCESS_KEY, tokens.accessToken)
                putString(REFRESH_KEY, tokens.refreshToken)
            }
        }.apply()
    }

    private companion object {
        // The same key names the RN app uses. They live in a different, app-private store,
        // so the two builds cannot see each other's session - which is what makes it
        // possible to be signed in as different patients in each while comparing them.
        const val ACCESS_KEY = "opd.accessToken"
        const val REFRESH_KEY = "opd.refreshToken"
    }
}
