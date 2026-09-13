package app.kramya.net

import kotlinx.serialization.json.Json
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import okhttp3.Response
import java.util.concurrent.TimeUnit

/**
 * The HTTP boundary. Mirror of the transport half of apps/mobile/lib/api.ts.
 *
 * One OkHttpClient for the whole app, because it owns the connection pool and the thread
 * pool - a second one would silently double both.
 */
object Api {

    /**
     * Where the app talks to, baked in at build time.
     *
     * `BuildConfig.API_URL` comes from gradle.properties (apiUrlDebug / apiUrlRelease),
     * the same split apps/mobile/eas.json uses between its `development` and `production`
     * profiles. There is no runtime setting: a build that can be pointed at another
     * server by anyone holding the phone is a build that can be pointed at a server that
     * is not ours.
     */
    /**
     * A `var`, and the only mutable global in the app.
     *
     * It exists so a JVM unit test can point the client at a MockWebServer. Nothing in
     * the app ever writes it - there is no runtime setting, because a build that can be
     * aimed at another server by whoever is holding the phone is a build that can be
     * aimed at a server that is not ours.
     */
    var baseUrl: String = app.kramya.BuildConfig.API_URL

    /**
     * `ignoreUnknownKeys` because Models.kt is deliberately partial, and because the API
     * may add a field in a phase this app has not been rebuilt for - which must be a
     * no-op, not a crash on a screen a patient is reading.
     *
     * `explicitNulls = false` so an omitted optional serialises as absent rather than
     * `"field": null`. The API validates request bodies with Zod, and `.optional()` is
     * not the same as `.nullable()` - sending an explicit null where the schema expects
     * a missing key is a 400.
     */
    val json = Json {
        ignoreUnknownKeys = true
        explicitNulls = false
    }

    val client: OkHttpClient = OkHttpClient.Builder()
        // The API is on a free Render dyno that cold-starts. A patient opening the app
        // to check their place in a queue will wait 20 seconds before they will wait
        // for a spinner that never resolves, and the RN app's fetch has no timeout at
        // all - so these are generous on purpose, not tuned.
        .connectTimeout(30, TimeUnit.SECONDS)
        .readTimeout(30, TimeUnit.SECONDS)
        .writeTimeout(30, TimeUnit.SECONDS)
        // A phone changes network constantly. Retrying an idempotent GET on a dropped
        // connection is what stops a lift ride from surfacing as an error banner.
        .retryOnConnectionFailure(true)
        .build()

    private val JSON_MEDIA = "application/json; charset=utf-8".toMediaType()

    /** Builds a request against the API, with the usual headers and an optional body. */
    fun request(
        path: String,
        method: String = "GET",
        body: String? = null,
        accessToken: String? = null,
    ): Request {
        val builder = Request.Builder()
            .url(baseUrl + path)
            .header("Content-Type", "application/json")

        if (accessToken != null) builder.header("Authorization", "Bearer $accessToken")

        // `method("GET", null)` is required - OkHttp rejects a body on GET and requires
        // one on POST, so the null/empty split has to be explicit.
        return when (method) {
            "GET" -> builder.get()
            "DELETE" -> builder.delete()
            else -> builder.method(method, (body ?: "{}").toRequestBody(JSON_MEDIA))
        }.build()
    }
}

/**
 * A failed call, carrying everything a screen or a support conversation might need.
 *
 * Mirrors what `withRequestId` attaches to the Error in lib/api.ts.
 *
 * **`code` is what a screen branches on, never `message`** (docs/Rules.md 7). The message
 * is written by the API to be shown to a patient and contains no internals; the code is
 * the stable identifier.
 */
class ApiException(
    message: String,
    /** The API's error code, e.g. ALREADY_IN_QUEUE. Null on a transport failure. */
    val code: String? = null,
    /** HTTP status, or 0 if the request never got an answer. */
    val status: Int = 0,
    /**
     * The server's `x-request-id`.
     *
     * The API stamps every response with it and repeats it in the error envelope, and
     * nothing on the phone was reading it. Without it, "it said something went wrong" is
     * unmatchable against the logs - there is no shared identifier between the two halves
     * of one failure. Carried on the exception rather than shown: a patient does not need
     * a UUID, and a support conversation does.
     */
    val requestId: String? = null,
) : Exception(message)

/** What a transport failure says. On a phone this almost always means no signal. */
const val OFFLINE_MESSAGE = "You appear to be offline. Check your connection and try again."

/** What an unreadable failure says. */
const val GENERIC_ERROR_MESSAGE = "Something went wrong. Please try again."

/**
 * Turns a non-2xx response into an ApiException carrying the server's own message.
 *
 * The API's envelope is written to be shown to a human and carries no internals
 * (docs/Rules.md 7), so it is surfaced verbatim. A body that will not parse falls back to
 * the generic line rather than leaking whatever the proxy returned.
 */
fun Response.toApiException(): ApiException {
    val raw = runCatching { body?.string() }.getOrNull()
    val parsed = raw?.let {
        runCatching { Api.json.decodeFromString(ApiErrorBody.serializer(), it) }.getOrNull()
    }
    return ApiException(
        message = parsed?.error?.message ?: GENERIC_ERROR_MESSAGE,
        code = parsed?.error?.code,
        status = this.code,
        requestId = parsed?.error?.requestId ?: header("x-request-id"),
    )
}
