package app.kramya.ui

import androidx.compose.runtime.Composable
import app.kramya.core.IconName
import app.kramya.core.Icons
import app.kramya.net.MyQueueEntry
import app.kramya.net.QueueEntryStatus
import java.time.Instant

// Mirror of apps/mobile/lib/visits.tsx.

/**
 * How a patient's own entry is described on screen.
 *
 * docs/Design.md 5.3 and 8: status is never colour alone - every value carries a written
 * label AND an icon, so it still reads for a colour-blind user or on a phone in bright
 * sunlight outside a hospital.
 *
 * The wording is the PATIENT's, not the system's. "SKIPPED" is a state machine value;
 * "Missed - see reception" is what a person needs to be told, and it says what to do
 * rather than what happened.
 *
 * **A `when` with no `else`.** The RN counterpart is a `Record<QueueEntryStatus, ...>`,
 * which TypeScript checks at compile time but which renders `undefined` at runtime if the
 * server ever sends a value the map lacks. This will not compile if a state is unhandled,
 * which is the same guarantee one step earlier.
 */
fun entryLabel(status: QueueEntryStatus): Triple<String, Tone, IconName> = when (status) {
    QueueEntryStatus.RESERVED -> Triple("Awaiting payment", Tone.Warning, Icons.CLOCK)
    QueueEntryStatus.CONFIRMED -> Triple("Booked", Tone.Info, Icons.CHECK_CIRCLE)
    QueueEntryStatus.VIRTUAL_WAITING -> Triple("Waiting from home", Tone.Info, Icons.HOME)
    QueueEntryStatus.CHECKED_IN -> Triple("Checked in", Tone.Success, Icons.CHECK_CIRCLE)
    // Reserved and unreachable in v1, but the map must be total for the type to hold.
    QueueEntryStatus.READY -> Triple("Ready", Tone.Success, Icons.CHECK_CIRCLE)
    QueueEntryStatus.CALLED -> Triple("Your turn - go in", Tone.Success, Icons.BELL)
    QueueEntryStatus.IN_CONSULTATION -> Triple("With the doctor", Tone.Success, Icons.ACTIVITY)
    QueueEntryStatus.COMPLETED -> Triple("Completed", Tone.Neutral, Icons.CHECK)
    QueueEntryStatus.CANCELLED -> Triple("Cancelled", Tone.Neutral, Icons.SLASH)
    QueueEntryStatus.NO_SHOW -> Triple("Missed", Tone.Warning, Icons.USER_X)
    QueueEntryStatus.SKIPPED -> Triple("Missed - see reception", Tone.Warning, Icons.ALERT_TRIANGLE)
    QueueEntryStatus.RESCHEDULED -> Triple("To be rescheduled", Tone.Warning, Icons.CALENDAR)
}

@Composable
fun EntryStatusPill(status: QueueEntryStatus) {
    val (label, tone, icon) = entryLabel(status)
    Pill(label = label, tone = tone, icon = icon)
}

/**
 * The one line that answers "what do I do now?".
 *
 * Every string here is derived from server state and never from a client-side rule about
 * the queue (docs/CLAUDE.md 9). It only rephrases what the server said.
 */
fun nextStepFor(entry: MyQueueEntry): String = when (entry.status) {
    QueueEntryStatus.RESERVED ->
        "Your place is held until you pay. Finish the payment to get your token."

    QueueEntryStatus.CONFIRMED, QueueEntryStatus.VIRTUAL_WAITING ->
        if (entry.checkedInAheadCount == 0 && entry.bookedAheadCount == 0) {
            "You are first in line. Reach the hospital and check in at reception."
        } else {
            "Wait comfortably. Reach the hospital in time to check in at reception."
        }

    QueueEntryStatus.CHECKED_IN, QueueEntryStatus.READY ->
        "You are checked in. Stay nearby - you will be called by token number."

    QueueEntryStatus.CALLED -> "You have been called. Please go in now."
    QueueEntryStatus.IN_CONSULTATION -> "You are with the doctor."
    QueueEntryStatus.SKIPPED ->
        "Your turn was missed. Speak to reception to be put back in the queue."

    QueueEntryStatus.NO_SHOW -> "This visit was marked as missed."
    QueueEntryStatus.RESCHEDULED ->
        "The session ended before your turn. The hospital will rebook you."

    QueueEntryStatus.CANCELLED -> "This booking was cancelled."
    QueueEntryStatus.COMPLETED -> "This visit is complete."
}

/**
 * Minutes and seconds left on an unpaid hold, or null once it has lapsed.
 *
 * Counted from the server's instant rather than from a timer started at join: a phone
 * that was backgrounded, or whose clock is wrong, would otherwise disagree with the
 * server about whether the slot is gone.
 */
fun holdRemaining(expiresAt: String?, now: Long): String? {
    if (expiresAt == null) return null
    val remaining = runCatching { Instant.parse(expiresAt).toEpochMilli() - now }.getOrNull()
        ?: return null
    if (remaining <= 0) return null
    val seconds = remaining / 1000
    return "${seconds / 60}:${(seconds % 60).toString().padStart(2, '0')}"
}

// ---------------------------------------------------------------------------
// "Have I already booked this session?"
// ---------------------------------------------------------------------------

/**
 * What this account holds in one session.
 *
 * `Reserved` outranks `Booked` deliberately: an unfinished payment is the thing the
 * patient needs to act on, and burying it behind a token they have not paid for is how a
 * hold quietly lapses.
 */
sealed interface BookingState {
    data object None : BookingState
    data class Reserved(val entry: MyQueueEntry) : BookingState
    data class Booked(val entry: MyQueueEntry, val count: Int) : BookingState
}

fun bookingStateFor(entries: List<MyQueueEntry>?): BookingState {
    if (entries.isNullOrEmpty()) return BookingState.None

    val reserved = entries.firstOrNull { it.status == QueueEntryStatus.RESERVED }
    if (reserved != null) return BookingState.Reserved(reserved)

    // Lowest token first, so a family with two bookings always sees the same one named
    // rather than whichever the API happened to return first.
    val sorted = entries.sortedBy { it.tokenNumber }
    return BookingState.Booked(sorted.first(), sorted.size)
}

/**
 * Every active entry this account holds, grouped by session.
 *
 * Used by discovery screens to answer "have I already booked this?" without the server
 * having to tell them. Both halves of that answer are server truth - this only joins them
 * for rendering, which is not the client deciding queue state (docs/Rules.md 1).
 *
 * **The discovery response deliberately does NOT carry this.** `SessionCard` is
 * impersonal by design, and Phase 9 plans to CACHE discovery; a per-account field would
 * make every response caller-specific and destroy that, for a fact the client can derive
 * from data it already holds.
 */
fun entriesBySession(entries: List<MyQueueEntry>?): Map<String, List<MyQueueEntry>> =
    entries.orEmpty().groupBy { it.sessionId }
