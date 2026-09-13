package app.kramya

import app.kramya.net.MyQueueEntry
import app.kramya.net.QueueEntryStatus
import app.kramya.net.QueueEntryType
import app.kramya.ui.BookingState
import app.kramya.ui.bookingStateFor
import app.kramya.ui.entriesBySession
import app.kramya.ui.holdRemaining
import app.kramya.ui.nextStepFor
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test
import java.time.Instant

/** A minimal entry. Only the fields a given test cares about are ever varied. */
private fun entry(
    id: String = "e1",
    sessionId: String = "s1",
    status: QueueEntryStatus = QueueEntryStatus.CONFIRMED,
    tokenNumber: Int = 1,
    checkedInAhead: Int = 0,
    bookedAhead: Int = 0,
    reservationExpiresAt: String? = null,
) = MyQueueEntry(
    id = id,
    sessionId = sessionId,
    status = status,
    type = QueueEntryType.ONLINE,
    tokenNumber = tokenNumber,
    tokenLabel = "A%03d".format(tokenNumber),
    patientId = "p1",
    patientName = "Aarav Semwal",
    hospitalId = "h1",
    hospitalName = "Lotus Care",
    departmentName = "General Medicine",
    doctorName = "Dr. Sharma",
    scheduledStart = "2026-08-30T04:30:00.000Z",
    scheduledEnd = "2026-08-30T07:30:00.000Z",
    feePaise = 50_000,
    reservationExpiresAt = reservationExpiresAt,
    checkedInAheadCount = checkedInAhead,
    bookedAheadCount = bookedAhead,
    joinedAt = "2026-08-30T04:00:00.000Z",
    cancellable = true,
    refundPctIfCancelledNow = 100,
)

class VisitsLogicTest {

    // -----------------------------------------------------------------------------
    // bookingStateFor
    // -----------------------------------------------------------------------------

    @Test
    fun `nothing held is None`() {
        assertEquals(BookingState.None, bookingStateFor(null))
        assertEquals(BookingState.None, bookingStateFor(emptyList()))
    }

    @Test
    fun `an unpaid hold outranks a paid token`() {
        // Reserved beats Booked deliberately: an unfinished payment is the thing the
        // patient needs to act on, and burying it behind a token they have not paid for is
        // how a hold quietly lapses.
        val state = bookingStateFor(
            listOf(
                entry(id = "paid", status = QueueEntryStatus.CONFIRMED, tokenNumber = 3),
                entry(id = "held", status = QueueEntryStatus.RESERVED, tokenNumber = 9),
            ),
        )
        assertTrue(state is BookingState.Reserved)
        assertEquals("held", (state as BookingState.Reserved).entry.id)
    }

    @Test
    fun `the lowest token is the one named`() {
        // A family with two bookings must always see the SAME one named, rather than
        // whichever the API happened to return first.
        val state = bookingStateFor(
            listOf(
                entry(id = "second", tokenNumber = 12),
                entry(id = "first", tokenNumber = 4),
            ),
        )
        assertTrue(state is BookingState.Booked)
        state as BookingState.Booked
        assertEquals("first", state.entry.id)
        assertEquals(2, state.count)
    }

    // -----------------------------------------------------------------------------
    // holdRemaining
    // -----------------------------------------------------------------------------

    @Test
    fun `a live hold counts down in minutes and seconds`() {
        val now = Instant.parse("2026-08-30T05:00:00.000Z").toEpochMilli()
        assertEquals("9:05", holdRemaining("2026-08-30T05:09:05.000Z", now))
        assertEquals("0:07", holdRemaining("2026-08-30T05:00:07.000Z", now))
        assertEquals("10:00", holdRemaining("2026-08-30T05:10:00.000Z", now))
    }

    @Test
    fun `a lapsed or absent hold is null`() {
        val now = Instant.parse("2026-08-30T05:00:00.000Z").toEpochMilli()
        assertNull(holdRemaining(null, now))
        assertNull(holdRemaining("2026-08-30T04:59:59.000Z", now))
        // Exactly expired counts as gone, not as "0:00" - showing a zero timer implies
        // there is still something to act on.
        assertNull(holdRemaining("2026-08-30T05:00:00.000Z", now))
    }

    @Test
    fun `an unparseable instant is null rather than a crash`() {
        assertNull(holdRemaining("not-a-date", 0L))
    }

    // -----------------------------------------------------------------------------
    // nextStepFor - the one line that answers "what do I do now?"
    // -----------------------------------------------------------------------------

    @Test
    fun `every status has a sentence and none is blank`() {
        // The RN counterpart is a switch that TypeScript checks; this is a `when` with no
        // `else`, so a missing case would not compile. This asserts the other half: that
        // no branch returns something useless.
        QueueEntryStatus.entries.forEach { status ->
            val line = nextStepFor(entry(status = status))
            assertTrue("$status produced a blank next step", line.isNotBlank())
            assertTrue("$status should end in a full stop", line.endsWith("."))
        }
    }

    @Test
    fun `being first in line is said differently`() {
        val first = nextStepFor(entry(status = QueueEntryStatus.CONFIRMED))
        val notFirst = nextStepFor(
            entry(status = QueueEntryStatus.CONFIRMED, checkedInAhead = 2),
        )
        assertEquals("You are first in line. Reach the hospital and check in at reception.", first)
        assertEquals(
            "Wait comfortably. Reach the hospital in time to check in at reception.",
            notFirst,
        )

        // Booked-ahead counts too: somebody with an earlier token who has not arrived is
        // still ahead of you, so "first in line" would be a lie.
        assertEquals(
            notFirst,
            nextStepFor(entry(status = QueueEntryStatus.CONFIRMED, bookedAhead = 1)),
        )
    }

    // -----------------------------------------------------------------------------

    @Test
    fun `entries group by session`() {
        val grouped = entriesBySession(
            listOf(
                entry(id = "a", sessionId = "s1"),
                entry(id = "b", sessionId = "s2"),
                entry(id = "c", sessionId = "s1"),
            ),
        )
        assertEquals(2, grouped.size)
        assertEquals(listOf("a", "c"), grouped["s1"]?.map { it.id })
        assertEquals(listOf("b"), grouped["s2"]?.map { it.id })
    }
}
