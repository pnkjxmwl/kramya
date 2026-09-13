package app.kramya.net

/**
 * The ONE path every screen uses for "my active visits".
 *
 * A constant rather than a literal per screen, because the path IS the cache key: a
 * single character of drift silently becomes a second cache entry and a second poller for
 * the same data.
 *
 * apps/mobile keeps this in lib/visits.tsx, next to the UI that reads it. It lives in
 * `net` here because the realtime client invalidates it on `entry.updated`, and a
 * network-layer file importing a UI file to learn a URL is the wrong direction for the
 * dependency to run.
 */
const val MY_ACTIVE_ENTRIES = "/me/queue-entries?scope=active&limit=50"

/**
 * `encodeURIComponent`, exactly.
 *
 * Every discovery path in apps/mobile is built with it, and the path IS the cache key -
 * so a city or a search term that encodes differently here would be a different key for
 * the same data, silently doubling requests and splitting the cache.
 *
 * `URLEncoder` is close but not the same: it encodes a space as `+` rather than `%20`,
 * and it escapes `!`, `'`, `(`, `)` and `~`, which encodeURIComponent leaves alone.
 */
fun encodeQuery(value: String): String =
    java.net.URLEncoder.encode(value, "UTF-8")
        .replace("+", "%20")
        .replace("%21", "!")
        .replace("%27", "'")
        .replace("%28", "(")
        .replace("%29", ")")
        .replace("%7E", "~")
