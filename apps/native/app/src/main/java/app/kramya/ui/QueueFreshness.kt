package app.kramya.ui

/** Receipt age uses the cache's monotonic clock, not the phone's wall-clock date. */
data class QueueFreshness(val current: Boolean, val message: String)

fun queueFreshness(receivedAt: Long, now: Long, connected: Boolean, refreshFailed: Boolean): QueueFreshness {
    if (receivedAt == 0L) return QueueFreshness(false, "Waiting for a queue update. Refresh before relying on the estimate.")
    val age = (now - receivedAt).coerceAtLeast(0L)
    val whenText = if (age < 60_000) "less than a minute ago" else if (age < 120_000) "1 minute ago" else "${age / 60_000} minutes ago"
    val prefix = when {
        refreshFailed -> "Refresh failed. Showing the last known queue."
        age >= 120_000 -> "Queue information is out of date."
        !connected -> "Live connection interrupted; checking periodically."
        else -> "Queue updates connected."
    }
    return QueueFreshness(!refreshFailed && age < 120_000, "$prefix Refreshed $whenText.")
}
