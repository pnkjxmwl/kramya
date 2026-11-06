package app.kramya.push

import app.kramya.net.Api
import java.util.Base64
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import kotlinx.serialization.json.contentOrNull

fun matchesPushEnvironment(delivered: String?, expected: String): Boolean = (delivered ?: "STAGING") == expected

/** Local privacy filter only. Server guards still verify all API authorization. */
fun matchesPushRecipient(accessToken: String?, accountId: String?): Boolean {
    if (accessToken.isNullOrBlank() || accountId.isNullOrBlank()) return false
    return runCatching {
        val parts = accessToken.split('.')
        if (parts.size != 3) return false
        val claims = Api.json.parseToJsonElement(String(Base64.getUrlDecoder().decode(parts[1]), Charsets.UTF_8)).jsonObject
        claims["sub"]?.jsonPrimitive?.contentOrNull == accountId
    }.getOrDefault(false)
}
