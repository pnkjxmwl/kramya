package app.kramya.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicText
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.pulltorefresh.PullToRefreshBox
import androidx.compose.material3.pulltorefresh.rememberPullToRefreshState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import app.kramya.core.Theme
import app.kramya.core.calendarDate
import app.kramya.core.istClock
import app.kramya.nav.NavBar
import app.kramya.net.MyQueueEntry
import app.kramya.net.Paginated
import app.kramya.net.useApi
import app.kramya.ui.EntryStatusPill
import app.kramya.ui.QueryState
import app.kramya.ui.Segmented
import app.kramya.ui.pressable

/**
 * My Visits - the second tab.
 * Mirror of apps/mobile/app/(app)/(visits)/visits.tsx.
 *
 * This is also the crash-recovery screen (docs/Architecture.md 12 case B): if the app died
 * between paying and seeing the token, the server still issued it from the webhook, and
 * opening this tab is how the patient finds it.
 *
 * Each row is the handoff's confirmation sheet in miniature - the eyebrow, then the token
 * as the largest thing in the card, then who it is for. A patient scanning this list is
 * looking for a number, and the number is what they find first.
 */

/** Active visits move on their own, so this screen polls like the session screen. */
private const val LIVE_POLL_MS = 15_000L

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun VisitsScreen(onOpenVisit: (String) -> Unit) {
    var scope by remember { mutableStateOf("active") }

    val query = useApi<Paginated<MyQueueEntry>>(
        "/me/queue-entries?scope=$scope&limit=50",
        refetchMs = if (scope == "active") LIVE_POLL_MS else null,
    )
    val items = query.data?.items.orEmpty()

    Column(Modifier.fillMaxSize().background(Theme.Colors.Canvas)) {
        NavBar("My Visits")

        // One control with two halves, not two loose pills. The pills read as two
        // independent buttons, so it was never obvious that choosing one deselected the
        // other - and the unselected half looked disabled rather than available.
        Column(
            Modifier
                .fillMaxWidth()
                .background(Theme.Colors.Bar)
                .padding(horizontal = Theme.Gutter, vertical = Theme.Space.x3),
        ) {
            Segmented(
                options = listOf("active" to "Upcoming", "past" to "Past"),
                value = scope,
                onChange = { scope = it },
            )
        }
        app.kramya.ui.Hairline()

        PullToRefreshBox(
            isRefreshing = query.isFetching && !query.isPending,
            onRefresh = query.refetch,
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
                verticalArrangement = Arrangement.spacedBy(Theme.Space.x3),
            ) {
                QueryState(
                    pending = query.isPending,
                    error = query.error,
                    isEmpty = items.isEmpty(),
                    emptyText = if (scope == "active") {
                        "No upcoming visits. Find a doctor from the Discover tab to book one."
                    } else {
                        "No past visits yet."
                    },
                )

                items.forEach { entry ->
                    Column(
                        Modifier
                            .fillMaxWidth()
                            .shadow(Theme.Elevation.Card, RoundedCornerShape(Theme.Radius.Group))
                            .clip(RoundedCornerShape(Theme.Radius.Group))
                            .background(Theme.Colors.Surface)
                            .pressable(
                                radius = Theme.Radius.Group,
                                onClick = { onOpenVisit(entry.id) },
                            )
                            .padding(Theme.Space.x5),
                    ) {
                        Row(
                            Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically,
                        ) {
                            BasicText(
                                text = if (scope == "active") "YOUR TOKEN" else "TOKEN",
                                style = Theme.Font.Micro.copy(
                                    letterSpacing = 1.2.sp,
                                    color = Theme.Colors.InkTertiary,
                                ),
                            )
                            EntryStatusPill(entry.status)
                        }

                        BasicText(
                            text = entry.tokenLabel,
                            modifier = Modifier.padding(top = 4.dp),
                            // Tabular numerals so a column of token numbers does not
                            // jitter.
                            style = Theme.Font.TokenSm.copy(
                                color = Theme.Colors.Ink,
                                fontFeatureSettings = "tnum",
                            ),
                        )

                        /*
                          WHO the booking is for, first and labelled.

                          An account holds a whole family (docs/PRD.md 3.1), so two bookings
                          can share a token label, a doctor, a department and a date and
                          differ only in this. Without it they are indistinguishable, which
                          is exactly how a father gets taken to his daughter's appointment.

                          "For " is not decoration: the patient and the doctor are both
                          people's names, stacked, and the label is what says which is which.
                        */
                        BasicText(
                            text = "For ${entry.patientName}",
                            modifier = Modifier.padding(top = Theme.Space.x3),
                            style = Theme.Font.H3.copy(color = Theme.Colors.Ink),
                        )
                        BasicText(
                            text = "${entry.doctorName} · ${entry.departmentName}",
                            modifier = Modifier.padding(top = 2.dp),
                            style = Theme.Font.Caption.copy(color = Theme.Colors.InkTertiary),
                        )
                        BasicText(
                            text = "${entry.hospitalName} · " +
                                "${calendarDate(entry.scheduledStart)}  ·  " +
                                istClock(entry.scheduledStart),
                            modifier = Modifier.padding(top = 2.dp),
                            style = Theme.Font.Caption.copy(color = Theme.Colors.InkTertiary),
                        )
                    }
                }
            }
        }
    }
}
