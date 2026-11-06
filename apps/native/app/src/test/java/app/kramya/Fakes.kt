package app.kramya

import app.kramya.net.AuthTokens
import app.kramya.net.TokenStorage
import app.kramya.net.LogoutRequest

/** An in-memory TokenStorage - the reason `TokenStorage` is an interface at all. */
class FakeTokenStorage(private var tokens: AuthTokens? = null) : TokenStorage {
    var pushToken: String? = null
    var pendingLogouts = emptyList<LogoutRequest>()
    override fun loadPushToken(): String? = pushToken
    override fun savePushToken(token: String?) { pushToken = token }
    override fun loadPendingLogouts(): List<LogoutRequest> = pendingLogouts
    override fun savePendingLogouts(requests: List<LogoutRequest>) { pendingLogouts = requests }
    var saveCount = 0
        private set

    override fun load(): AuthTokens? = tokens

    override fun save(tokens: AuthTokens?) {
        this.tokens = tokens
        saveCount++
    }
}

/** An auth token pair, as the API would return it. */
fun tokensJson(access: String, refresh: String): String =
    """{"accessToken":"$access","refreshToken":"$refresh","expiresIn":900}"""

/** The API's error envelope (contracts/common/error.ts). */
fun errorJson(code: String, message: String): String =
    """{"error":{"code":"$code","message":"$message"}}"""
