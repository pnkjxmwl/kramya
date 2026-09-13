package app.kramya.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.text.BasicText
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.pulltorefresh.PullToRefreshBox
import androidx.compose.material3.pulltorefresh.rememberPullToRefreshState
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import app.kramya.core.Icon
import app.kramya.core.Icons
import app.kramya.core.Theme
import app.kramya.core.calendarDate
import app.kramya.core.istRange
import app.kramya.core.rupees
import app.kramya.net.Patient
import app.kramya.net.SessionDetail
import app.kramya.net.asCard
import app.kramya.net.useApi
import app.kramya.nav.NavBar
import app.kramya.ui.BookingState
import app.kramya.ui.Card
import app.kramya.ui.KeyValue
import app.kramya.ui.LiveState
import app.kramya.ui.PresencePill
import app.kramya.ui.QueryState
import app.kramya.ui.SectionLabel
import app.kramya.ui.SessionCardView
import app.kramya.ui.bookingStateFor
import app.kramya.ui.pressable
import app.kramya.ui.useLiveSession
import app.kramya.ui.useMyActiveEntries

/**
 * One session in full.
 * Mirror of apps/mobile/app/(app)/(discover)/session/[id].tsx.
 *
 * Everything shown here is decided by the server. `registrationOpen` in particular is
 * never recomputed on the phone (docs/Rules.md 1, docs/CLAUDE.md 9).
 *
 * This screen is a LEAF: it links nowhere. It briefly carried a "see this doctor's other
 * sessions" link back to the doctor screen, which made session <-> doctor the only cycle
 * in the app - every round trip pushed two more screens. Deleted rather than bounded,
 * because the link was also redundant: a doctor has exactly one department, so that
 * doctor's sessions are always a SUBSET of the department list the user came from. The
 * navigation graph is a DAG.
 *
 * **No sticky bottom action bar.** It existed because this screen's numbers were a flat
 * list of label/value rows with nothing to act on, so the action had to be pinned
 * somewhere. The head of the screen is now the handoff's primary card, which carries its
 * own join button - and two competing primary actions on one short screen is worse than
 * one that is three lines further up.
 */
/**
 * The safety net behind the socket, not the way this screen stays current.
 *
 * `useLiveSession` subscribes to this session's room and every command in it invalidates
 * this query, so the numbers move when the QUEUE moves rather than when a timer fires. A
 * slow poll stays because a phone's socket dies in ways a phone does not notice - a lift,
 * a hospital basement, an OS that suspended the app. Ninety seconds is invisible when the
 * socket is healthy and is the difference between "briefly stale" and "silently wrong"
 * when it is not.
 */
private const val FALLBACK_POLL_MS = 90_000L

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun SessionScreen(
    sessionId: String,
    onBack: () -> Unit,
    onJoin: (String) -> Unit,
    onOpenToken: (String) -> Unit,
) {
    val session = useApi<SessionDetail>("/sessions/$sessionId", refetchMs = FALLBACK_POLL_MS)
    val data = session.data

    // Live for as long as this screen is open. Unsubscribes on dispose, so a patient
    // browsing ten doctors does not end up listening to ten queues.
    val connected = useLiveSession(sessionId)

    // What this account already holds here, and whether anyone is left to book for. Both
    // are server data; joining them is rendering, not a queue decision.
    val myEntries = useMyActiveEntries()
    val patients = useApi<List<Patient>>("/patients")
    val mine = myEntries[sessionId]
    val booking = bookingStateFor(mine)
    val bookedPatientIds = mine.orEmpty().map { it.patientId }.toSet()
    val unbookedProfiles = patients.data.orEmpty().count { it.id !in bookedPatientIds }

    Column(Modifier.fillMaxSize().background(Theme.Colors.Canvas)) {
        NavBar(data?.doctorName ?: "Session", onBack = onBack)

        PullToRefreshBox(
            // The socket covers the ordinary case; this is for the patient who wants to
            // know NOW, and it is the gesture they will try first regardless.
            isRefreshing = session.isFetching && !session.isPending,
            onRefresh = session.refetch,
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
                        bottom = Theme.Space.x8,
                    ),
            ) {
                QueryState(
                    pending = session.isPending,
                    error = session.error,
                    onRetry = session.refetch,
                    skeletonRows = 3,
                )

                if (data != null) {
                    // Above the numbers it invalidates. A dropped socket freezes this card
                    // rather than clearing it, and a frozen queue position is
                    // indistinguishable from a true one.
                    if (!connected) {
                        Row(Modifier.padding(bottom = Theme.Space.x3)) { LiveState(connected) }
                    }

                    SessionCardView(
                        card = data.asCard(),
                        onJoin = { onJoin(sessionId) },
                        onOpenToken = onOpenToken,
                        booking = booking,
                    )

                    /*
                      Booking a SECOND patient into a session you are already in is allowed
                      - the server's check is scoped to (session, patient), not to the
                      account - so a family can hold two tokens. Shown only when there is
                      genuinely someone left to book for AND the server still says
                      registration is open, because an action that leads to a refusal is
                      worse than no action.

                      Only on this screen, never on the cards: a list has no room to
                      explain a second action, and the card is itself a tap target.
                    */
                    if (booking is BookingState.Booked &&
                        unbookedProfiles > 0 &&
                        data.snapshot.registrationOpen
                    ) {
                        Row(
                            Modifier
                                .fillMaxWidth()
                                .padding(top = Theme.Space.x3)
                                .heightIn(min = 44.dp)
                                .pressable(
                                    radius = Theme.Radius.Full,
                                    label = "Book this session for another patient",
                                    onClick = { onJoin(sessionId) },
                                )
                                .background(Theme.Colors.FillSecondary),
                            horizontalArrangement = Arrangement.spacedBy(
                                Theme.Space.x2,
                                Alignment.CenterHorizontally,
                            ),
                            verticalAlignment = Alignment.CenterVertically,
                        ) {
                            Icon(Icons.USER_PLUS, size = 16.dp, tint = Theme.Colors.Ink)
                            BasicText(
                                text = "Book for someone else · ${rupees(data.feePaise)}",
                                style = Theme.Font.Label.copy(color = Theme.Colors.Ink),
                            )
                        }
                    }

                    Column(Modifier.padding(top = 30.dp, bottom = 10.dp)) {
                        SectionLabel("This session")
                    }
                    Card {
                        KeyValue("Date", calendarDate(data.date))
                        KeyValue("Hours", istRange(data.scheduledStart, data.scheduledEnd))
                        // docs/PRD.md 7.3: two numbers, because "8 waiting" would be a
                        // half-truth when five of them are still at home.
                        KeyValue(
                            "Checked in and waiting",
                            data.snapshot.checkedInCount.toString(),
                        )
                        KeyValue(
                            "Booked, not arrived",
                            data.snapshot.bookedNotArrivedCount.toString(),
                        )
                        KeyValue(
                            label = "You would be seen",
                            value = run {
                                val from = data.snapshot.joinNowEtaFrom
                                val to = data.snapshot.joinNowEtaTo
                                if (from != null && to != null) "~${istRange(from, to)}"
                                else "Not available yet"
                            },
                            emphasis = true,
                        )
                        KeyValue("Consultation fee", rupees(data.feePaise))
                        Row(
                            Modifier.padding(top = Theme.Space.x1),
                            horizontalArrangement = Arrangement.spacedBy(Theme.Space.x2),
                        ) { PresencePill(data.doctorPresence) }
                        if (data.isSubstitute) {
                            BasicText(
                                "Covering for the doctor this session was booked with.",
                                style = Theme.Font.Caption.copy(color = Theme.Colors.InkTertiary),
                            )
                        }
                    }

                    Column(Modifier.padding(top = 30.dp, bottom = 10.dp)) {
                        SectionLabel("Where")
                    }
                    Card {
                        BasicText(
                            data.hospitalName,
                            style = Theme.Font.H3.copy(color = Theme.Colors.Ink),
                        )
                        data.hospitalAddress?.let {
                            BasicText(
                                it,
                                style = Theme.Font.Caption.copy(color = Theme.Colors.InkSecondary),
                            )
                        }
                        data.hospitalArea?.let {
                            BasicText(
                                it,
                                style = Theme.Font.Caption.copy(color = Theme.Colors.InkSecondary),
                            )
                        }
                        BasicText(
                            text = "${data.doctorName} usually spends about " +
                                "${data.doctorDefaultConsultMins} minutes per patient.",
                            style = Theme.Font.Caption.copy(color = Theme.Colors.InkTertiary),
                        )
                    }
                }
            }
        }
    }
}
