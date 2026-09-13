package app.kramya.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.text.BasicText
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.pulltorefresh.PullToRefreshBox
import androidx.compose.material3.pulltorefresh.rememberPullToRefreshState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.getValue
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import app.kramya.core.Theme
import app.kramya.nav.NavBar
import app.kramya.net.Paginated
import app.kramya.net.SessionCard
import app.kramya.net.useApi
import app.kramya.ui.DoctorQueueRow
import app.kramya.ui.ListGroup
import app.kramya.ui.LiveState
import app.kramya.ui.MoreNote
import app.kramya.ui.PAGE
import app.kramya.ui.QueryState
import app.kramya.ui.SectionLabel
import app.kramya.ui.SessionCardView
import app.kramya.ui.bookingStateFor
import app.kramya.ui.useLiveSessions
import app.kramya.ui.useMyActiveEntries
import kotlinx.coroutines.launch

/**
 * Department queue - screen 3 of docs/design_handoff_opd_queue, and the screen the whole
 * browse path exists to reach.
 *
 * Mirror of apps/mobile/app/(app)/(discover)/department/[id].tsx.
 *
 * The handoff's shape: one doctor gets the primary card - avatar, hours, the live mark,
 * both tokens, the queue strip and the join action - and the whole department is listed as
 * compact rows beneath it, the current one tinted.
 *
 * **Tapping a row shows it on the card above**; it does not navigate, and it does not
 * remove the row from the list - the list is the department and it stays put. Discover
 * selects a hospital the same way, and a screen where the big card is a fixed
 * first-of-list while identical rows beneath it jump elsewhere teaches two rules for one
 * layout. The lead card is the way out: tapping IT opens the session screen, and its own
 * button joins. The row's trailing pill still joins directly, which is the handoff's
 * design for it.
 *
 * No date picker: "today" is the server's IST today. A phone's own clock is wrong for the
 * half hour after IST midnight, so the date is deliberately not sent.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun DepartmentScreen(
    departmentId: String,
    onBack: () -> Unit,
    onOpenSession: (String) -> Unit,
    onJoin: (String) -> Unit,
    onOpenToken: (String) -> Unit,
) {
    var selectedId by remember { mutableStateOf<String?>(null) }
    val scrollState = rememberScrollState()
    val scope = rememberCoroutineScope()

    // What this account already holds, for every card on the page at once.
    val myEntries = useMyActiveEntries()
    val sessions = useApi<Paginated<SessionCard>>("/departments/$departmentId/sessions?limit=$PAGE")

    val items = sessions.data?.items.orEmpty()
    // Live for every session in this department, not just the one a patient has opened.
    // Each card carries a queue that moves on its own; without this the numbers sit frozen
    // until the screen is navigated away from and back.
    val connected = useLiveSessions(items.map { it.id })

    // Which session the lead card is showing. Falls back to the first, which also covers
    // the selected one leaving the list on a refetch - a session that ended, say.
    val lead = items.firstOrNull { it.id == selectedId } ?: items.firstOrNull()

    /*
      EVERY session is listed, including the one on the card above.

      The list used to exclude the lead, so selecting the second doctor swapped the two:
      the one you tapped rose out of the list and the previous lead dropped into its place.
      The list you were reading reordered itself underneath your finger, and with six
      sessions it was impossible to keep track of which you had already looked at.

      A stable list with the current one tinted is what Discover already does with its
      VIEWING marker, and it is the handoff's own device - a selected department is marked
      in place, not lifted out.
    */
    val all = items

    Column(Modifier.fillMaxSize().background(Theme.Colors.Canvas)) {
        NavBar(lead?.departmentName ?: "Today", onBack = onBack)

        PullToRefreshBox(
            isRefreshing = sessions.isFetching && !sessions.isPending,
            onRefresh = sessions.refetch,
            state = rememberPullToRefreshState(),
            modifier = Modifier.fillMaxSize(),
        ) {
            Column(
                Modifier
                    .fillMaxSize()
                    .verticalScroll(scrollState)
                    .padding(
                        start = Theme.Gutter,
                        end = Theme.Gutter,
                        top = 22.dp,
                        bottom = Theme.Space.x8,
                    ),
            ) {
                // Above the numbers it invalidates, not below them. A dropped socket
                // freezes this card rather than clearing it, and a frozen "3 ahead of you"
                // is indistinguishable from a true one.
                if (!connected && items.isNotEmpty()) {
                    Row(Modifier.padding(bottom = Theme.Space.x3)) { LiveState(connected) }
                }

                if (lead != null) {
                    SessionCardView(
                        card = lead,
                        onOpen = { onOpenSession(lead.id) },
                        onJoin = { onJoin(lead.id) },
                        onOpenToken = onOpenToken,
                        // One request for the whole list, sliced per card.
                        booking = bookingStateFor(myEntries[lead.id]),
                    )
                } else {
                    QueryState(
                        pending = sessions.isPending,
                        error = sessions.error,
                        isEmpty = sessions.isSuccess,
                        emptyText = "No OPD sessions here today. Try another department.",
                        onRetry = sessions.refetch,
                    )
                }

                if (all.size > 1) {
                    Column(Modifier.padding(top = 30.dp, bottom = 10.dp)) {
                        // "Also in" was right when the lead was excluded. The list is now
                        // the whole department, so it says so - and the count is worth
                        // stating, because it is the thing the screen exists to answer.
                        SectionLabel("All ${all.size} today")
                    }
                    ListGroup(inset = 66.dp) {
                        all.forEach { card ->
                            row {
                                DoctorQueueRow(
                                    card = card,
                                    selected = card.id == lead?.id,
                                    // Same reason as Discover: the card this updates is
                                    // above the fold by the time these rows are in reach,
                                    // and silent feedback reads as a dead tap.
                                    onOpen = {
                                        selectedId = card.id
                                        scope.launch { scrollState.animateScrollTo(0) }
                                    },
                                    onJoin = { onJoin(card.id) },
                                    onOpenToken = onOpenToken,
                                    booking = bookingStateFor(myEntries[card.id]),
                                )
                            }
                        }
                    }
                }

                sessions.data?.let { MoreNote(it.items.size, it.total) }

                if (lead != null) {
                    Box(
                        Modifier.fillMaxWidth().padding(top = Theme.Space.x5),
                        contentAlignment = Alignment.Center,
                    ) {
                        BasicText(
                            text = if (all.size > 1) {
                                "Tap a doctor to see their queue. Tap the card above for full details."
                            } else {
                                "Tap the card above for full session details."
                            },
                            style = Theme.Font.Caption.copy(
                                fontSize = 12.sp,
                                color = Theme.Colors.InkTertiary,
                                textAlign = TextAlign.Center,
                            ),
                        )
                    }
                }
            }
        }
    }
}
