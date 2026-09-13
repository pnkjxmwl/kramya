package app.kramya.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicText
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.text.SpanStyle
import androidx.compose.ui.text.buildAnnotatedString
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.text.withStyle
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import app.kramya.core.Icon
import app.kramya.core.IconName
import app.kramya.core.Icons
import app.kramya.core.Theme
import app.kramya.core.istRange
import app.kramya.core.rupees
import app.kramya.net.DoctorPresence
import app.kramya.net.SessionCard
import app.kramya.net.SessionStatus

// Shared discovery UI, on docs/design_handoff_opd_queue.
// Mirror of apps/mobile/lib/discovery.tsx.
//
// The two shapes this file owns are the handoff's two ways of listing things: `Row` - a
// bare list row, either hairline-separated on the background or stacked inside a white
// `ListGroup` - and `SessionCardView`, the handoff's PRIMARY card: the doctor, the two
// tokens, the queue strip and the join action.

/**
 * How many rows a discovery screen asks for. The API caps a page at 100 (docs/Rules.md 6);
 * we fetch one large page and say so when it truncates, rather than shipping infinite
 * scroll for lists that hold two hospitals today.
 */
const val PAGE = 50

enum class Tone { Success, Info, Warning, Neutral }

private fun toneColors(tone: Tone): Pair<Color, Color> = when (tone) {
    Tone.Success -> Theme.Colors.Success.Fg to Theme.Colors.Success.Bg
    Tone.Warning -> Theme.Colors.Warning.Fg to Theme.Colors.Warning.Bg
    // Neutral takes the info palette, exactly as lib/discovery.tsx does - this system has
    // no blue, so "informational" and "neutral" are already the same grey.
    Tone.Info, Tone.Neutral -> Theme.Colors.Info.Fg to Theme.Colors.Info.Bg
}

/**
 * docs/Design.md 8 and the handoff agree: status is NEVER colour alone. Every pill carries
 * an icon AND a written label, so it still reads for a colour-blind user or in bright
 * sunlight outside a hospital.
 *
 * A low-contrast tinted ground with the label in the tone's own colour. Success is the
 * only one that keeps a real colour, because "open" is the only status this product wants
 * to shout.
 */
@Composable
fun Pill(label: String, tone: Tone, icon: IconName) {
    val (foreground, background) = toneColors(tone)
    Row(
        Modifier
            .clip(RoundedCornerShape(9.dp))
            .background(background)
            .padding(horizontal = 9.dp, vertical = 4.dp),
        horizontalArrangement = Arrangement.spacedBy(5.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Icon(icon, size = 11.dp, tint = foreground)
        BasicText(
            text = label,
            style = Theme.Font.Micro.copy(color = foreground, letterSpacing = 0.3.sp),
        )
    }
}

private fun sessionLabel(status: SessionStatus): Triple<String, Tone, IconName> = when (status) {
    SessionStatus.SCHEDULED -> Triple("Scheduled", Tone.Info, Icons.CLOCK)
    SessionStatus.OPEN_FOR_REGISTRATION -> Triple("Open", Tone.Success, Icons.CHECK_CIRCLE)
    SessionStatus.ACTIVE -> Triple("In progress", Tone.Success, Icons.ACTIVITY)
    SessionStatus.COMPLETED -> Triple("Finished", Tone.Neutral, Icons.CHECK)
    SessionStatus.ENDED_EARLY -> Triple("Ended early", Tone.Warning, Icons.ALERT_TRIANGLE)
    // Never listed by the API, but the map has to be total for the type to hold.
    SessionStatus.CANCELLED -> Triple("Cancelled", Tone.Warning, Icons.SLASH)
}

/** docs/PRD.md 8.10 - presence is a separate fact from the session's status. */
private fun presenceLabel(presence: DoctorPresence): Triple<String, Tone, IconName> =
    when (presence) {
        DoctorPresence.NOT_PRESENT -> Triple("Doctor not arrived", Tone.Neutral, Icons.USER_X)
        DoctorPresence.PRESENT -> Triple("Doctor in", Tone.Success, Icons.USER_CHECK)
        DoctorPresence.ON_BREAK -> Triple("On a break", Tone.Warning, Icons.COFFEE)
        DoctorPresence.LEFT -> Triple("Doctor has left", Tone.Warning, Icons.LOG_OUT)
    }

@Composable
fun SessionStatusPill(status: SessionStatus) {
    val (label, tone, icon) = sessionLabel(status)
    Pill(label, tone, icon)
}

@Composable
fun PresencePill(presence: DoctorPresence) {
    val (label, tone, icon) = presenceLabel(presence)
    Pill(label, tone, icon)
}

/**
 * Presence at caption size, for the session card's head.
 *
 * **Why the card needs this at all.** Its only marker was `LiveMark`, which reports the
 * SESSION's status - and session status and doctor presence are separate facts on purpose
 * (docs/PRD.md 8.10). A session reads "Live" while the doctor is on a break or has gone
 * home. Whether there is a doctor in the room is the single most decision-shaping thing
 * on the card, and it was the one thing the card did not say.
 *
 * A pill would have been the reusable answer and is too heavy here: the head already
 * carries a name, the hours and the live marker, and a fourth tinted block turns the
 * card's most important line into a row of badges.
 */
@Composable
fun PresenceNote(presence: DoctorPresence, modifier: Modifier = Modifier) {
    val (label, tone, icon) = presenceLabel(presence)
    // Neutral is the "not arrived" case: true, but not a warning and not good news, so it
    // stays in the caption's own grey rather than borrowing a status colour.
    val color = if (tone == Tone.Neutral) Theme.Colors.InkTertiary else toneColors(tone).first

    Row(
        modifier,
        horizontalArrangement = Arrangement.spacedBy(4.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Icon(icon, size = 12.dp, tint = color)
        BasicText(
            text = label,
            maxLines = 1,
            overflow = TextOverflow.Ellipsis,
            style = Theme.Font.Caption.copy(color = color, fontWeight = FontWeight.Medium),
        )
    }
}

/**
 * The handoff's live marker: a 6px dot and the word "Live".
 *
 * Only for a session that is genuinely running. Everything else falls back to the pill,
 * which spells the state out - "Scheduled", "Ended early" - because those are states a
 * patient has to read rather than glance at.
 */
@Composable
fun LiveMark(status: SessionStatus) {
    if (status != SessionStatus.ACTIVE) {
        SessionStatusPill(status)
        return
    }
    Row(
        horizontalArrangement = Arrangement.spacedBy(6.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Dot()
        BasicText(
            text = "Live",
            style = Theme.Font.Caption.copy(
                fontSize = 12.sp,
                letterSpacing = 0.3.sp,
                fontWeight = FontWeight.SemiBold,
                color = Theme.Colors.Success.Fg,
            ),
        )
    }
}

/**
 * Whether the numbers on this screen are still arriving.
 *
 * **The one thing a live screen owes the person reading it.** A dropped socket does not
 * blank the screen - it freezes it, and a frozen queue position is indistinguishable from
 * a true one. A patient reading "3 ahead of you" while the phone has been out of signal in
 * a hospital basement will sit down and wait, and miss the turn that has already passed.
 * Saying so is the difference between a stale number and a lie.
 *
 * Renders nothing while connected: a permanent green "Live" badge trains people to stop
 * seeing it, and then it cannot warn them.
 */
@Composable
fun LiveState(connected: Boolean) {
    if (connected) return
    Pill("Not live - reconnecting", Tone.Warning, Icons.WIFI_OFF)
}

/**
 * Loading, error and empty in one place, because every screen owes all three and writing
 * them per screen is how one of them goes missing.
 *
 * Returns true when it rendered something, so a caller can skip its own content - the
 * Compose equivalent of the RN version returning null.
 */
@Composable
fun QueryState(
    pending: Boolean,
    error: Throwable?,
    isEmpty: Boolean = false,
    emptyText: String? = null,
    onRetry: (() -> Unit)? = null,
    /**
     * How many placeholder rows to draw while loading. Set it to the number the screen
     * usually shows, so the page does not visibly grow as data lands.
     */
    skeletonRows: Int = 3,
) {
    if (pending) {
        // A skeleton, not a spinner. A centred spinner says "something is happening
        // somewhere" and reserves no space, so the whole screen jumps when the list
        // arrives. Placeholders shaped like the rows that are coming say what is arriving
        // AND hold its geometry.
        Column(Modifier.fillMaxWidth()) {
            repeat(skeletonRows) { RowSkeleton() }
        }
        return
    }

    if (error != null) {
        Column(
            Modifier.fillMaxWidth().padding(vertical = Theme.Space.x6),
            verticalArrangement = Arrangement.spacedBy(Theme.Space.x3),
        ) {
            ErrorNote(error.message ?: "Something went wrong. Please try again.")
            if (onRetry != null) {
                Button("Try again", onClick = onRetry, variant = ButtonVariant.Secondary)
            }
        }
        return
    }

    if (isEmpty) {
        // One line of tertiary text with 44pt of air above and below. A 56px tinted disc
        // with an icon in it was a teal-system flourish that, restyled to grey, read as a
        // broken image rather than as a friendly nudge.
        Box(
            Modifier.fillMaxWidth().padding(vertical = 44.dp, horizontal = Theme.Space.x6),
            contentAlignment = Alignment.Center,
        ) {
            BasicText(
                text = emptyText ?: "Nothing here yet.",
                style = Theme.Font.Body.copy(
                    fontSize = 14.sp,
                    lineHeight = 20.sp,
                    letterSpacing = (-0.2).sp,
                    color = Theme.Colors.InkTertiary,
                    textAlign = TextAlign.Center,
                ),
            )
        }
    }
}

/**
 * Honest note when a page was truncated. We fetch one large page rather than paging - the
 * API paginates, so saying so beats silently hiding rows.
 *
 * ponytail: swap for paging the first time a real city has more than a page of hospitals.
 */
@Composable
fun MoreNote(shown: Int, total: Int) {
    if (shown >= total) return
    Box(
        Modifier.fillMaxWidth().padding(vertical = Theme.Space.x4),
        contentAlignment = Alignment.Center,
    ) {
        BasicText(
            text = "Showing $shown of $total. Narrow your search to see more.",
            style = Theme.Font.Caption.copy(
                color = Theme.Colors.InkTertiary,
                textAlign = TextAlign.Center,
            ),
        )
    }
}

/**
 * A tappable list row - the hospital / department / doctor / city unit.
 *
 * **It carries no background, no border and no radius of its own.** That is what lets one
 * component cover every list in the handoff: a row is bare, and its CONTAINER decides what
 * kind of list it is. Dropped onto the canvas with `Hairline` between rows it is
 * Discover's NEARBY list; stacked inside `ListGroup` it is the departments table.
 *
 * `padH` exists because those two containers differ by exactly one thing: a bare row is
 * already inside the screen gutter, and a grouped row has to pad itself.
 */
@Composable
fun Row(
    title: String,
    onClick: () -> Unit,
    subtitle: String? = null,
    /** A short right-aligned value before the chevron. */
    meta: String? = null,
    icon: IconName? = null,
    /** Name to derive initials from. Takes precedence over `icon`. */
    avatar: String? = null,
    /**
     * A photograph for this row. Passing it (even as null) opts the row into the 52pt
     * thumbnail the handoff uses for a hospital - so `hasPhoto` is the opt-in, and
     * `photoUrl` being null still means "draw the thumbnail, with initials in it".
     */
    hasPhoto: Boolean = false,
    photoUrl: String? = null,
    /** Horizontal padding. 0 on the canvas (the screen gutter has it), 18 in a group. */
    padH: Dp = 0.dp,
    /** Replaces the chevron - a status dot, a ghost pill, a word. */
    trailing: (@Composable () -> Unit)? = null,
) {
    Row(
        Modifier
            .fillMaxWidth()
            .pressable(radius = 0.dp, onClick = onClick)
            // 14pt of air top and bottom around a 52pt thumbnail is the handoff's NEARBY
            // row; with a 36pt avatar it is the grouped table row, and both clear 44x44.
            .heightIn(min = 60.dp)
            .padding(horizontal = padH, vertical = 14.dp),
        horizontalArrangement = Arrangement.spacedBy(14.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        when {
            hasPhoto -> Photo(
                uri = photoUrl,
                name = avatar ?: title,
                modifier = Modifier.size(52.dp),
                radius = Theme.Radius.Lg,
                initialsSize = 17.dp,
            )

            avatar != null -> Avatar(avatar, size = 36.dp)

            icon != null -> Box(
                Modifier
                    .size(36.dp)
                    .clip(RoundedCornerShape(percent = 50))
                    .background(Theme.Colors.FillSecondary),
                contentAlignment = Alignment.Center,
            ) { Icon(icon, size = 17.dp, tint = Theme.Colors.InkSecondary) }
        }

        Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(2.dp)) {
            BasicText(
                text = title,
                maxLines = 2,
                overflow = TextOverflow.Ellipsis,
                style = Theme.Font.H3.copy(
                    fontSize = 16.sp,
                    lineHeight = 21.sp,
                    color = Theme.Colors.Ink,
                ),
            )
            if (subtitle != null) {
                BasicText(
                    text = subtitle,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                    style = Theme.Font.Caption.copy(color = Theme.Colors.InkTertiary),
                )
            }
        }

        if (meta != null) {
            BasicText(
                text = meta,
                style = Theme.Font.Caption.copy(
                    color = Theme.Colors.InkTertiary,
                    fontFeatureSettings = "tnum",
                ),
            )
        }

        if (trailing != null) {
            trailing()
        } else {
            Icon(Icons.CHEVRON_RIGHT, size = 17.dp, tint = Theme.Colors.Chevron)
        }
    }
}

/**
 * The queue, drawn.
 *
 * The handoff's strip, exactly: four 15pt ink bars for people recently seen, one 11pt pale
 * bar per person waiting ahead, and a 30pt ink bar at the end that is you. Six wide, five
 * apart, sitting on a 30pt baseline.
 *
 * **The pale bars are the ahead count, not a decoration** - the handoff is explicit that
 * the bar count and the stated number must agree, which is the whole reason the strip is
 * trustworthy at a glance rather than being a sparkline.
 *
 * ponytail: capped at 14 bars, because a 40-person queue would otherwise run off the card.
 * Past the cap the strip stops being a count and becomes "a lot", while the legend beneath
 * still states the true number. Swap for a two-row wrap if real OPD queues sit above 14.
 */
private const val AHEAD_BAR_CAP = 14

@Composable
fun QueueStrip(ahead: Int, started: Boolean, modifier: Modifier = Modifier) {
    val waiting = ahead.coerceIn(0, AHEAD_BAR_CAP)
    Row(
        modifier.height(30.dp).clearAndSetSemantics { },
        horizontalArrangement = Arrangement.spacedBy(5.dp),
        verticalAlignment = Alignment.Bottom,
    ) {
        // Nobody has been seen yet in a session that has not started - so no history.
        if (started) {
            repeat(4) { Bar(height = 15.dp, color = Color(0xFF0A0A0C).copy(alpha = 0.78f)) }
        }
        repeat(waiting) { Bar(height = 11.dp, color = Color(0xFF0A0A0C).copy(alpha = 0.14f)) }
        Bar(height = 30.dp, color = Theme.Colors.Ink)
    }
}

@Composable
private fun Bar(height: Dp, color: Color) {
    Box(Modifier.width(6.dp).height(height).clip(RoundedCornerShape(3.dp)).background(color))
}

/**
 * The handoff's primary card: one doctor's live queue, and the way into it.
 *
 * The layout is the handoff's, top to bottom - doctor row, the token pair, the strip, the
 * legend, the action - and the hierarchy is the point of it. The reader's own number is
 * 46px and ink; the number being served is 32px and tertiary. A patient scanning this card
 * in a corridor should find their own token first and everything else second.
 *
 * **What the right-hand figure is when you have not joined.** The handoff assumes a token
 * you already hold. Before you have one there is no such number - and inventing "your
 * token would be 25" would be the client predicting queue state, which docs/Rules.md 1
 * forbids outright. So the slot holds the number that actually drives the decision to
 * join: how many people are checked in and waiting.
 */
@Composable
fun SessionCardView(
    card: SessionCard,
    /**
     * Where the card leads. **Omitted on the session screen**, which IS that destination -
     * a card that is visibly tappable and goes nowhere is worse than one that is plainly
     * not.
     */
    onOpen: (() -> Unit)? = null,
    /** Book straight from the card. */
    onJoin: (() -> Unit)? = null,
    /** Open the token this account already holds here. */
    onOpenToken: ((String) -> Unit)? = null,
    /**
     * What this account holds in THIS session, resolved by the list screen.
     *
     * Passed in rather than derived here, so the card stays presentational and the list
     * fetches once instead of once per card.
     */
    booking: BookingState = BookingState.None,
) {
    val snapshot = card.snapshot
    val booked = booking is BookingState.Booked
    val reserved = booking is BookingState.Reserved
    val started = snapshot.nowServingToken != null

    val outer = Modifier
        .fillMaxWidth()
        .shadow(Theme.Elevation.Card, RoundedCornerShape(Theme.Radius.Card))
        .clip(RoundedCornerShape(Theme.Radius.Card))
        .background(Theme.Colors.Surface)
        .let { base ->
            if (onOpen != null) base.pressable(radius = Theme.Radius.Card, onClick = onOpen)
            else base
        }
        .padding(start = 22.dp, end = 22.dp, top = Theme.Space.x6, bottom = 22.dp)

    Column(outer) {
        Row(
            Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.spacedBy(Theme.Space.x3),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Avatar(card.doctorName, size = 42.dp)
            Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(1.dp)) {
                BasicText(
                    text = card.doctorName,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                    style = Theme.Font.H3.copy(color = Theme.Colors.Ink),
                )
                Row(
                    Modifier.padding(top = 1.dp),
                    horizontalArrangement = Arrangement.spacedBy(5.dp),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    // `weight(1f, fill = false)` on the hours, nothing on the presence: if
                    // the head is tight, the time range truncates and "Doctor has left"
                    // stays whole. Losing the warning to an ellipsis is the one failure
                    // this line must not have.
                    BasicText(
                        text = istRange(card.scheduledStart, card.scheduledEnd),
                        modifier = Modifier.weight(1f, fill = false),
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis,
                        style = Theme.Font.Caption.copy(color = Theme.Colors.InkTertiary),
                    )
                    BasicText(
                        text = "·",
                        style = Theme.Font.Caption.copy(color = Theme.Colors.InkQuaternary),
                    )
                    PresenceNote(card.doctorPresence)
                }
            }
            LiveMark(card.status)
        }

        if (card.isSubstitute) {
            BasicText(
                text = "Covering for the booked doctor",
                modifier = Modifier.padding(top = Theme.Space.x2),
                style = Theme.Font.Caption.copy(color = Theme.Colors.InkTertiary),
            )
        }

        Row(
            Modifier.fillMaxWidth().padding(top = 26.dp),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.Top,
        ) {
            Column {
                BasicText(
                    text = "NOW SERVING",
                    style = Theme.Font.Micro.copy(
                        letterSpacing = 1.2.sp,
                        color = Theme.Colors.InkTertiary,
                    ),
                )
                BasicText(
                    text = snapshot.nowServingToken ?: "—",
                    modifier = Modifier.padding(top = 4.dp),
                    // Tabular figures throughout: these numbers change live and must not
                    // jitter.
                    style = Theme.Font.TokenSm.copy(
                        color = Theme.Colors.InkTertiary,
                        fontFeatureSettings = "tnum",
                    ),
                )
            }
            Column(horizontalAlignment = Alignment.End) {
                BasicText(
                    text = if (booked) "YOUR TOKEN" else "WAITING",
                    style = Theme.Font.Micro.copy(
                        letterSpacing = 1.2.sp,
                        color = Theme.Colors.InkTertiary,
                    ),
                )
                BasicText(
                    text = when (booking) {
                        is BookingState.Booked -> booking.entry.tokenLabel
                        else -> snapshot.checkedInCount.toString()
                    },
                    modifier = Modifier.padding(top = 4.dp),
                    maxLines = 1,
                    style = Theme.Font.TokenLg.copy(
                        color = Theme.Colors.Ink,
                        fontFeatureSettings = "tnum",
                    ),
                )
            }
        }

        QueueStrip(
            ahead = snapshot.checkedInCount,
            started = started,
            modifier = Modifier.padding(top = Theme.Space.x6),
        )

        Row(
            Modifier.fillMaxWidth().padding(top = Theme.Space.x3),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically,
        ) {
            BasicText(
                text = buildAnnotatedString {
                    withStyle(
                        SpanStyle(
                            color = Theme.Colors.Ink,
                            fontWeight = FontWeight.Medium,
                            fontFeatureSettings = "tnum",
                        ),
                    ) { append(snapshot.checkedInCount.toString()) }
                    append(" ahead of you")
                },
                style = Theme.Font.Caption.copy(color = Theme.Colors.InkTertiary),
            )
            val from = snapshot.joinNowEtaFrom
            val to = snapshot.joinNowEtaTo
            if (from != null && to != null) {
                BasicText(
                    text = buildAnnotatedString {
                        append("Seen ")
                        withStyle(
                            SpanStyle(color = Theme.Colors.Ink, fontWeight = FontWeight.Medium),
                        ) { append(istRange(from, to)) }
                    },
                    style = Theme.Font.Caption.copy(color = Theme.Colors.InkTertiary),
                )
            }
        }

        // Nested inside the card's own clickable on purpose: the nested control captures
        // its own touch, so tapping the action joins and tapping anywhere else opens the
        // session.
        Box(Modifier.padding(top = Theme.Space.x6)) {
            Button(
                title = when {
                    reserved -> "Finish payment"
                    booking is BookingState.Booked ->
                        "View your token · ${booking.entry.tokenLabel}"
                    snapshot.registrationOpen -> "Join queue · ${rupees(card.feePaise)}"
                    else -> "Registration closed"
                },
                // `registrationOpen` is the SERVER's answer (docs/PRD.md 8.12) - the client
                // never works it out for itself. Advisory, though: the last slot can go
                // while this screen is open, so the join screen surfaces the server's
                // rejection rather than assuming this was still true.
                enabled = snapshot.registrationOpen || booking !is BookingState.None,
                onClick = {
                    when (booking) {
                        is BookingState.None -> onJoin?.invoke()
                        is BookingState.Reserved -> onJoin?.invoke()
                        is BookingState.Booked -> onOpenToken?.invoke(booking.entry.id)
                    }
                },
            )
        }
    }
}

/**
 * A doctor in the same department, compactly - the handoff's "ALSO IN CARDIOLOGY" group.
 *
 * The trailing control is a ghost pill rather than a filled one: there is already a filled
 * ink button on this screen, and two of them would leave the reader with no idea which one
 * the screen wants.
 */
@Composable
fun DoctorQueueRow(
    card: SessionCard,
    onOpen: () -> Unit,
    onJoin: () -> Unit,
    onOpenToken: ((String) -> Unit)? = null,
    /**
     * This is the session the card above is showing.
     *
     * **Three signals, because one was not enough.** The first version tinted the row with
     * a 4.5% black fill alone, which is invisible in daylight on a phone and was reported
     * as "which one is highlighted?". Tint carries almost no weight at that strength and
     * cannot be pushed much harder either: a strongly greyed row sitting among tappable
     * ones stops reading as *chosen* and starts reading as *disabled*, which is the
     * opposite meaning.
     *
     * So: a 3pt ink rail on the leading edge, the name in semibold ink, and the tint kept
     * as support. The rail is drawn in a Box behind the content, so nothing in the row
     * shifts when the selection moves.
     */
    selected: Boolean = false,
    booking: BookingState = BookingState.None,
) {
    val booked = booking is BookingState.Booked
    val reserved = booking is BookingState.Reserved
    val open = card.snapshot.registrationOpen
    val label = when {
        booking is BookingState.Booked -> booking.entry.tokenLabel
        reserved -> "Pay"
        open -> "Join"
        else -> "Closed"
    }

    Box(
        Modifier
            .fillMaxWidth()
            .pressable(radius = 0.dp, onClick = onOpen)
            .background(if (selected) Theme.Colors.FillSecondary else Color.Transparent),
    ) {
        // Full-bleed to the row's edges: ListGroup clips it to the group's radius, so on
        // the first and last row it takes the corner rather than poking past it.
        if (selected) {
            Box(
                Modifier
                    .width(3.dp)
                    .fillMaxHeight()
                    .align(Alignment.CenterStart)
                    .background(Theme.Colors.Ink),
            )
        }

        Row(
            Modifier.fillMaxWidth().padding(horizontal = 18.dp, vertical = 15.dp),
            horizontalArrangement = Arrangement.spacedBy(Theme.Space.x3),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Avatar(card.doctorName, size = 36.dp)
            Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(2.dp)) {
                BasicText(
                    text = card.doctorName,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                    style = Theme.Font.Body.copy(
                        color = Theme.Colors.Ink,
                        // 500 -> 600. The unselected rows are already ink, so weight is
                        // what separates them - colour cannot, on a list where every row
                        // is a live control.
                        fontWeight = if (selected) FontWeight.SemiBold else FontWeight.Medium,
                    ),
                )
                BasicText(
                    text = "${istRange(card.scheduledStart, card.scheduledEnd)} · " +
                        "${card.snapshot.checkedInCount} waiting",
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                    style = Theme.Font.Caption.copy(
                        fontSize = 12.5.sp,
                        lineHeight = 17.sp,
                        letterSpacing = (-0.1).sp,
                        color = Theme.Colors.InkTertiary,
                    ),
                )
            }

            // The pill goes where the label promises.
            //
            // It used to fall back to `onOpen` whenever the account already held a token
            // here, so tapping a pill that reads "T-12" took you to a page about the
            // doctor rather than to T-12. A control labelled with a token has exactly one
            // correct destination.
            val act: () -> Unit = when {
                booking is BookingState.Booked -> {
                    { onOpenToken?.invoke(booking.entry.id) }
                }
                reserved || open -> onJoin
                else -> onOpen
            }
            val inert = !open && !booked && !reserved

            Box(
                Modifier
                    // The handoff draws this pill 32pt tall; the surrounding tap target is
                    // what keeps it legal without changing a specified dimension.
                    .height(32.dp)
                    .pressable(
                        radius = 16.dp,
                        role = Role.Button,
                        label = when {
                            booking is BookingState.Booked ->
                                "Your token ${booking.entry.tokenLabel}"
                            reserved -> "Finish paying for ${card.doctorName}"
                            open -> "Join ${card.doctorName}"
                            else -> "Registration closed for ${card.doctorName}"
                        },
                        onClick = act,
                    )
                    .background(if (inert) Color.Transparent else Theme.Colors.FillSecondary)
                    .padding(horizontal = 16.dp),
                contentAlignment = Alignment.Center,
            ) {
                BasicText(
                    text = label,
                    style = Theme.Font.Label.copy(
                        fontSize = 14.sp,
                        lineHeight = 18.sp,
                        letterSpacing = (-0.2).sp,
                        color = if (inert) Theme.Colors.InkTertiary else Theme.Colors.Ink,
                    ),
                )
            }
        }
    }
}
