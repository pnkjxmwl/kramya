package app.kramya.screens

import android.app.AlertDialog
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.border
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicText
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.pulltorefresh.PullToRefreshBox
import androidx.compose.material3.pulltorefresh.rememberPullToRefreshState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableLongStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import app.kramya.core.Theme
import app.kramya.core.calendarDate
import app.kramya.core.istClock
import app.kramya.core.istRange
import app.kramya.core.rupees
import app.kramya.nav.NavBar
import app.kramya.net.CancelEntryRequest
import app.kramya.net.CancelEntryResponse
import app.kramya.net.MY_ACTIVE_ENTRIES
import app.kramya.net.MyQueueEntry
import app.kramya.net.Paginated
import app.kramya.net.useApi
import app.kramya.net.useApiPost
import app.kramya.ui.Button
import app.kramya.ui.ButtonVariant
import app.kramya.ui.Card
import app.kramya.ui.EntryStatusPill
import app.kramya.ui.ErrorNote
import app.kramya.ui.Hairline
import app.kramya.ui.KeyValue
import app.kramya.ui.LiveState
import app.kramya.ui.QrCode
import app.kramya.ui.QueryState
import app.kramya.ui.QueueStrip
import app.kramya.ui.SectionLabel
import app.kramya.ui.holdRemaining
import app.kramya.ui.nextStepFor
import app.kramya.ui.useLiveSession
import kotlinx.coroutines.delay

/**
 * The token card - the hero after joining, and the screen the handoff draws as its
 * confirmation sheet.
 *
 * Mirror of apps/mobile/app/(app)/(visits)/visit/[id].tsx.
 *
 * That sheet is the model for the top of this screen, laid out exactly as it is there: the
 * eyebrow, the token at 64pt, who it is for, then hairline rows for the two facts a
 * patient actually came back to check. This app has no sheet and does not need one - the
 * join flow ends at a payment the server has to confirm, so the confirmation IS a screen
 * you can return to rather than a panel that slides away.
 *
 * Every number on it comes from the server. The two "ahead" counts are the honest
 * two-number model: people physically here and ahead of you, and people booked ahead who
 * may or may not turn up. Nothing here recomputes a queue position.
 *
 * `entry.updated` arrives on this account's own private room the instant their booking
 * moves - called, skipped, cancelled - and `useLiveSession` keeps the queue numbers and
 * the ETA window moving with the room they are waiting in. The poll below is only the
 * safety net for a socket that died without saying so.
 */
private const val FALLBACK_POLL_MS = 90_000L

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun TokenScreen(entryId: String, onBack: () -> Unit) {
    val context = LocalContext.current

    // There is no GET /me/queue-entries/:id: the active list is small and already carries
    // every field this screen needs, so one cached request serves both screens rather than
    // adding an endpoint for a single reader.
    val active = useApi<Paginated<MyQueueEntry>>(MY_ACTIVE_ENTRIES, refetchMs = FALLBACK_POLL_MS)
    val past = useApi<Paginated<MyQueueEntry>>("/me/queue-entries?scope=past&limit=50")

    val entry: MyQueueEntry? = active.data?.items?.firstOrNull { it.id == entryId }
        ?: past.data?.items?.firstOrNull { it.id == entryId }

    // Watch the queue this token is in, so the ETA and "ahead of you" move with it.
    val connected = useLiveSession(entry?.sessionId)

    val cancel = useApiPost<CancelEntryRequest, CancelEntryResponse>(
        "/queue-entries/$entryId/cancel",
    )

    // A ticking clock for the hold countdown. One second is the smallest unit shown.
    var now by remember { mutableLongStateOf(System.currentTimeMillis()) }
    LaunchedEffect(entry?.reservationExpiresAt) {
        if (entry?.reservationExpiresAt == null) return@LaunchedEffect
        while (true) {
            delay(1_000)
            now = System.currentTimeMillis()
        }
    }

    val hold = holdRemaining(entry?.reservationExpiresAt, now)

    Column(Modifier.fillMaxSize().background(Theme.Colors.Canvas)) {
        NavBar(entry?.tokenLabel ?: "Your token", onBack = onBack)

        PullToRefreshBox(
            isRefreshing = active.isFetching && !active.isPending,
            onRefresh = active.refetch,
            state = rememberPullToRefreshState(),
            modifier = Modifier.fillMaxSize(),
        ) {
            Column(
                Modifier
                    .fillMaxSize()
                    .verticalScroll(rememberScrollState())
                    .padding(
                        start = Theme.Gutter,
                        end = Theme.Gutter,
                        top = 22.dp,
                        bottom = Theme.Space.x10,
                    ),
            ) {
                QueryState(
                    pending = active.isPending,
                    error = active.error,
                    isEmpty = !active.isPending && entry == null,
                    emptyText = "This booking is no longer available.",
                )

                if (entry != null) {
                    /*
                      1. The handoff's sheet: the eyebrow, the token, who it is for, and
                      the two facts underneath it on hairline rows.

                      White, not a filled brand surface. The teal system painted this card
                      teal-50 on the argument that the token is the one object the whole
                      product hands over and should be what your eye lands on. That
                      argument was right and the fill was the wrong way to serve it: the
                      token is SIXTY-FOUR POINTS of ink on white, which is louder than any
                      tint, and a tinted card would only dilute it.
                    */
                    Column(
                        Modifier
                            .fillMaxWidth()
                            .shadow(Theme.Elevation.Card, RoundedCornerShape(Theme.Radius.Card))
                            .clip(RoundedCornerShape(Theme.Radius.Card))
                            .background(Theme.Colors.Surface)
                            .padding(
                                start = Theme.Gutter,
                                end = Theme.Gutter,
                                top = Theme.Space.x6,
                                bottom = Theme.Space.x5,
                            ),
                    ) {
                        BasicText(
                            "YOU'RE IN THE QUEUE",
                            style = Theme.Font.Overline.copy(color = Theme.Colors.InkTertiary),
                        )
                        BasicText(
                            text = entry.tokenLabel,
                            modifier = Modifier.padding(top = 10.dp),
                            // The number must not shift as it changes.
                            style = Theme.Font.TokenXl.copy(
                                color = Theme.Colors.Ink,
                                fontFeatureSettings = "tnum",
                            ),
                        )
                        BasicText(
                            text = "${entry.patientName} · ${entry.doctorName}",
                            modifier = Modifier.padding(top = 6.dp),
                            style = Theme.Font.BodyLg.copy(color = Theme.Colors.InkSecondary),
                        )

                        Row(
                            Modifier.fillMaxWidth().padding(top = Theme.Space.x4),
                            horizontalArrangement = Arrangement.spacedBy(Theme.Space.x2),
                            verticalAlignment = Alignment.CenterVertically,
                        ) {
                            EntryStatusPill(entry.status)
                            /*
                              The most important place in the app for this. Every number
                              below - both "ahead" counts and the ETA window - is only true
                              while updates are arriving. A dropped socket freezes them
                              rather than clearing them, so a patient reading "2 checked in
                              ahead" on a phone that lost signal will sit down and wait for
                              a turn that has already passed. Nothing renders while
                              connected.
                            */
                            LiveState(connected)
                        }

                        // The same strip the department screen draws, from the same
                        // numbers. A patient who joined from that card should recognise
                        // their place in the queue here without having to re-read it.
                        QueueStrip(
                            ahead = entry.checkedInAheadCount,
                            started = entry.nowServingToken != null,
                            modifier = Modifier.padding(top = Theme.Space.x6),
                        )

                        Hairline(Modifier.padding(top = Theme.Space.x5))

                        Column(
                            Modifier.padding(top = Theme.Space.x3),
                            verticalArrangement = Arrangement.spacedBy(Theme.Space.x3),
                        ) {
                            KeyValue(
                                label = "Expected",
                                // Saying nothing is better than a guess: the ETA is the
                                // server's.
                                value = run {
                                    val from = entry.etaFrom
                                    val to = entry.etaTo
                                    if (from != null && to != null) "~${istRange(from, to)}"
                                    else "Not available yet"
                                },
                                emphasis = true,
                            )
                            Hairline()
                            KeyValue("Now serving", entry.nowServingToken ?: "Not started")
                            Hairline()
                            KeyValue(
                                label = "Ahead of you",
                                // docs/PRD.md: the two counts stay separate and stay
                                // labelled. Collapsing them into one number is the lie
                                // that makes an ETA feel arbitrary.
                                value = "${entry.checkedInAheadCount} here · " +
                                    "${entry.bookedAheadCount} booked",
                            )
                        }

                        BasicText(
                            text = nextStepFor(entry),
                            modifier = Modifier.padding(top = Theme.Space.x5),
                            style = Theme.Font.Caption.copy(color = Theme.Colors.InkSecondary),
                        )
                    }

                    // 2. The QR, sized to be scanned across a reception desk.
                    Column(Modifier.padding(top = 30.dp, bottom = 10.dp)) {
                        SectionLabel("Checking in")
                    }
                    Card {
                        val code = entry.checkInCode
                        if (code != null) {
                            Column(
                                Modifier.fillMaxWidth(),
                                horizontalAlignment = Alignment.CenterHorizontally,
                                verticalArrangement = Arrangement.spacedBy(Theme.Space.x3),
                            ) {
                                Box(
                                    Modifier
                                        .clip(RoundedCornerShape(Theme.Radius.Control))
                                        .background(Color.White)
                                        .border(
                                            width = Dp.Hairline,
                                            color = Theme.Colors.Separator,
                                            shape = RoundedCornerShape(Theme.Radius.Control),
                                        )
                                        .padding(Theme.Space.x3),
                                ) {
                                    QrCode(
                                        value = code,
                                        size = 172.dp,
                                        color = Theme.Colors.Ink,
                                        background = Color.White,
                                    )
                                }
                                BasicText(
                                    "Show this at reception to check in",
                                    style = Theme.Font.Caption.copy(
                                        color = Theme.Colors.InkTertiary,
                                        textAlign = TextAlign.Center,
                                    ),
                                )
                            }
                        } else {
                            BasicText(
                                text = if (hold != null) {
                                    "Your place is held for $hold. Your QR code appears once payment is confirmed."
                                } else {
                                    "Your QR code appears once payment is confirmed."
                                },
                                style = Theme.Font.Caption.copy(color = Theme.Colors.Warning.Fg),
                            )
                        }
                    }

                    // 3. Everything that does not change, last, and quietly.
                    Column(Modifier.padding(top = 30.dp, bottom = 10.dp)) {
                        SectionLabel("Appointment")
                    }
                    Card {
                        KeyValue("Department", entry.departmentName)
                        KeyValue("Hospital", entry.hospitalName)
                        KeyValue("Date", calendarDate(entry.scheduledStart))
                        KeyValue("Session starts", istClock(entry.scheduledStart))
                        KeyValue("Fee", rupees(entry.feePaise))
                    }

                    cancel.error?.let {
                        Box(Modifier.padding(top = Theme.Space.x3)) {
                            ErrorNote(it.message ?: "Could not cancel this booking")
                        }
                    }

                    if (entry.cancellable) {
                        Box(Modifier.padding(top = Theme.Space.x5)) {
                            Button(
                                title = "Cancel booking",
                                pending = cancel.isPending,
                                variant = ButtonVariant.Ghost,
                                onClick = {
                                    // Android's own dialog, which is exactly what RN's
                                    // `Alert.alert` renders - same shape, same buttons,
                                    // same destructive emphasis. Building a Compose lookalike
                                    // would be a different dialog that merely resembles it.
                                    AlertDialog.Builder(context)
                                        .setTitle("Cancel this booking?")
                                        .setMessage(
                                            if (entry.refundPctIfCancelledNow > 0) {
                                                "You will be refunded ${entry.refundPctIfCancelledNow}% of " +
                                                    "${rupees(entry.feePaise)}. Refunds take a few working days."
                                            } else {
                                                "This booking is past the free cancellation window, so no refund is due."
                                            },
                                        )
                                        .setNegativeButton("Keep booking", null)
                                        .setPositiveButton("Cancel booking") { _, _ ->
                                            cancel.mutate(CancelEntryRequest()) {
                                                active.refetch()
                                                past.refetch()
                                                onBack()
                                            }
                                        }
                                        .show()
                                },
                            )
                        }
                    }
                }
            }
        }
    }
}
