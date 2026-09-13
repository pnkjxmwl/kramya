package app.kramya.core

import java.text.NumberFormat
import java.time.Instant
import java.time.ZoneOffset
import java.util.Locale

// Display formatting for values the API sends as UTC instants and integer paise.
// Mirror of apps/mobile/lib/format.ts.
//
// docs/Rules.md 5: the server stores UTC and paise; converting for Asia/Kolkata is the
// client's job.

// IST is UTC+05:30 with no DST, ever, so the offset is arithmetic rather than a timezone
// database lookup. This deliberately mirrors apps/api/src/common/ist.ts AND
// apps/mobile/lib/format.ts: all three do the same fixed-offset maths. A hospital in
// Mumbai must read 10:00 on a phone set to London.
//
// Android has a real tzdb and could use ZoneId.of("Asia/Kolkata") - and that is exactly
// why this does not. The RN app cannot (Hermes ships no Intl timeZone data), so if this
// one used the zone database the two clients would be computing IST by different routes
// and could disagree at a boundary. Same arithmetic, same answer, always.
private const val IST_OFFSET_MS = 330L * 60_000L

private fun istShifted(iso: String) =
    Instant.ofEpochMilli(Instant.parse(iso).toEpochMilli() + IST_OFFSET_MS)
        .atZone(ZoneOffset.UTC)

/**
 * A UTC instant as its IST clock face, the way it is said out loud in India:
 * "7 PM", "6 AM", "10:30 AM".
 *
 * **12-hour, and the ":00" is dropped on the hour.** Clinics run on whole and half
 * hours, and "7 PM" is what a receptionist says to a patient - "19:00" is what a server
 * log says. This is a patient-facing app in a country that reads the clock in twelve
 * hours, so the display follows the country, not the storage.
 */
fun istClock(iso: String): String {
    val at = istShifted(iso)
    val hours = at.hour
    val minutes = at.minute
    val meridiem = if (hours < 12) "AM" else "PM"
    // 0 and 12 both read as 12 - midnight is "12 AM", noon is "12 PM".
    val twelve = if (hours % 12 == 0) 12 else hours % 12

    return if (minutes == 0) {
        "$twelve $meridiem"
    } else {
        "$twelve:${minutes.toString().padStart(2, '0')} $meridiem"
    }
}

/**
 * A session's working block, e.g. "10 AM–1 PM", or "10–11:30 AM" when both ends fall in
 * the same half of the day.
 *
 * Collapsing the repeated AM/PM is how a person writes it, and on a session card every
 * character competes with the doctor's name for the same line.
 */
fun istRange(startIso: String, endIso: String): String {
    val start = istClock(startIso)
    val end = istClock(endIso)
    val startMeridiem = start.takeLast(2)

    // An en dash, matching format.ts. Not a hyphen: these sit between two numbers.
    return if (startMeridiem == end.takeLast(2)) {
        "${start.dropLast(3)}–$end"
    } else {
        "$start–$end"
    }
}

private val DAYS = listOf("Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat")
private val MONTHS = listOf(
    "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
)

private val DATE_ONLY = Regex("""^\d{4}-\d{2}-\d{2}$""")

/**
 * "Sun 30 Aug", from EITHER a calendar date ("2026-08-30") or a UTC instant.
 *
 * It accepts both on purpose. The RN version used to take only the date-only form, and
 * passing an instant produced an Invalid Date whose parts rendered as
 * **"undefined NaN undefined"** rather than throwing. That reached a device. A formatter
 * that silently prints nonsense for a plausible input is a trap, and the fix belongs
 * here rather than at each caller, because every caller would otherwise have to remember
 * which shape it is holding.
 *
 * An instant is converted to IST BEFORE the date is read: a session at 19:30 UTC is the
 * next day in Mumbai, and showing the UTC day would be off by one all evening - every
 * evening, which is exactly when an OPD clinic runs.
 */
fun calendarDate(date: String): String {
    // A date-only string is pinned to UTC midnight so it can never shift a day; an
    // instant is shifted into IST so the day is the one the patient is living in.
    val at = if (DATE_ONLY.matches(date)) {
        Instant.parse("${date}T00:00:00.000Z").atZone(ZoneOffset.UTC)
    } else {
        istShifted(date)
    }
    // DayOfWeek is MONDAY=1..SUNDAY=7; the table above is JS's Sunday-first order.
    val day = DAYS[at.dayOfWeek.value % 7]
    return "$day ${at.dayOfMonth} ${MONTHS[at.monthValue - 1]}"
}

// Grouping in threes, pinned to US rather than the device locale.
//
// format.ts calls toLocaleString() with no locale, which in Hermes groups in threes -
// and matches Indian grouping for every value below one lakh. An OPD consultation fee
// never gets near that. Pinning the locale here is what stops a phone set to hi-IN from
// rendering a different fee string than the same phone running the RN app.
private val GROUPED: NumberFormat = NumberFormat.getIntegerInstance(Locale.US)

/**
 * Paise to rupees. Fees are whole rupees in practice, and the decimal is noise on a
 * card, so it is dropped unless there really are paise.
 */
fun rupees(paise: Int): String {
    val whole = paise / 100.0
    return if (whole % 1.0 == 0.0) {
        "₹${GROUPED.format(whole.toLong())}"
    } else {
        "₹${String.format(Locale.US, "%.2f", whole)}"
    }
}
