package app.kramya

import app.kramya.core.calendarDate
import app.kramya.core.istClock
import app.kramya.core.istRange
import app.kramya.core.rupees
import org.junit.Assert.assertEquals
import org.junit.Test
import java.util.Locale
import java.util.TimeZone

/**
 * Every expected value here was produced by RUNNING apps/mobile/lib/format.ts, not by
 * reasoning about what it ought to return. That is the whole point of this file: it is a
 * differential test against the reference implementation, so a divergence shows up as a
 * failing assertion rather than as a patient reading the wrong time.
 */
class FormatTest {

    // -----------------------------------------------------------------------------
    // istClock - UTC instant to an IST clock face
    // -----------------------------------------------------------------------------

    @Test
    fun `drops the minutes on the hour`() {
        // 04:30Z is 10:00 IST. A receptionist says "10 AM", not "10:00 AM".
        assertEquals("10 AM", istClock("2026-08-30T04:30:00.000Z"))
        assertEquals("7 PM", istClock("2026-08-30T13:30:00.000Z"))
    }

    @Test
    fun `keeps the minutes off the hour`() {
        assertEquals("4:57 PM", istClock("2026-08-31T11:27:30.000Z"))
    }

    @Test
    fun `midnight is 12 AM and noon is 12 PM`() {
        // The hours % 12 == 0 branch. Getting this wrong yields "0 AM", which looks
        // enough like a real time that nobody questions it.
        assertEquals("12 AM", istClock("2026-08-30T18:30:00.000Z"))
        assertEquals("12 PM", istClock("2026-08-30T06:30:00.000Z"))
    }

    @Test
    fun `is fixed-offset, not the device timezone`() {
        // The same instant must render identically whatever the JVM default zone is.
        // A phone in London showing a Mumbai clinic's hours in GMT is the bug this
        // guards - and it is invisible to anyone testing in IST.
        val original = TimeZone.getDefault()
        try {
            TimeZone.setDefault(TimeZone.getTimeZone("Europe/London"))
            assertEquals("10 AM", istClock("2026-08-30T04:30:00.000Z"))
            TimeZone.setDefault(TimeZone.getTimeZone("America/Los_Angeles"))
            assertEquals("10 AM", istClock("2026-08-30T04:30:00.000Z"))
        } finally {
            TimeZone.setDefault(original)
        }
    }

    // -----------------------------------------------------------------------------
    // istRange
    // -----------------------------------------------------------------------------

    @Test
    fun `collapses a repeated meridiem`() {
        assertEquals(
            "10–11:30 AM",
            istRange("2026-08-30T04:30:00.000Z", "2026-08-30T06:00:00.000Z"),
        )
    }

    @Test
    fun `keeps both when the range crosses noon`() {
        assertEquals(
            "10 AM–1 PM",
            istRange("2026-08-30T04:30:00.000Z", "2026-08-30T07:30:00.000Z"),
        )
    }

    @Test
    fun `uses an en dash, not a hyphen`() {
        val range = istRange("2026-08-30T04:30:00.000Z", "2026-08-30T07:30:00.000Z")
        assertEquals(true, range.contains('–'))
        assertEquals(false, range.contains('-'))
    }

    // -----------------------------------------------------------------------------
    // calendarDate - accepts BOTH shapes
    // -----------------------------------------------------------------------------

    @Test
    fun `formats a calendar date`() {
        assertEquals("Sun 30 Aug", calendarDate("2026-08-30"))
    }

    @Test
    fun `formats an instant, and shifts the day into IST first`() {
        // 19:30Z on the 30th is 01:00 IST on the 31st. Reading the UTC day here would be
        // off by one all evening - every evening, which is when an OPD clinic runs.
        assertEquals("Mon 31 Aug", calendarDate("2026-08-30T19:30:00.000Z"))
        assertEquals("Sun 30 Aug", calendarDate("2026-08-30T04:30:00.000Z"))
    }

    @Test
    fun `a date-only string never shifts a day`() {
        // Pinned to UTC midnight rather than run through the IST shift: the string is
        // already a calendar date, and shifting it would move it to the 29th.
        assertEquals("Sun 30 Aug", calendarDate("2026-08-30"))
        assertEquals("Thu 1 Jan", calendarDate("2026-01-01"))
        assertEquals("Thu 31 Dec", calendarDate("2026-12-31"))
    }

    // -----------------------------------------------------------------------------
    // rupees
    // -----------------------------------------------------------------------------

    @Test
    fun `drops the decimal on a whole rupee amount`() {
        assertEquals("₹500", rupees(50_000))
        assertEquals("₹2,500", rupees(250_000))
        assertEquals("₹0", rupees(0))
    }

    @Test
    fun `keeps two decimals when there really are paise`() {
        assertEquals("₹123.45", rupees(12_345))
    }

    @Test
    fun `groups the same way whatever locale the phone is set to`() {
        // The reason Locale.US is pinned in Format.kt.
        //
        // The RN app runs on Hermes, whose toLocaleString() has no ICU data and groups in
        // threes. A device set to en-IN has full ICU here and would render Indian
        // grouping instead - so the same fee would read differently in the two apps on
        // the same phone. Every OPD fee is far below a lakh, where the two conventions
        // agree; this asserts the app does not depend on that luck.
        val original = Locale.getDefault()
        try {
            Locale.setDefault(Locale.forLanguageTag("en-IN"))
            assertEquals("₹2,500", rupees(250_000))
            Locale.setDefault(Locale.GERMANY)
            assertEquals("₹2,500", rupees(250_000))
        } finally {
            Locale.setDefault(original)
        }
    }
}
