package app.kramya.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.text.BasicText
import androidx.compose.foundation.verticalScroll
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import app.kramya.LocalCity
import app.kramya.core.Theme
import app.kramya.nav.NavBar
import app.kramya.net.Paginated
import app.kramya.net.PublicDoctor
import app.kramya.net.SessionCard
import app.kramya.net.encodeQuery
import app.kramya.net.useApi
import app.kramya.ui.Avatar
import app.kramya.ui.Hairline
import app.kramya.ui.ListGroup
import app.kramya.ui.LiveState
import app.kramya.ui.MoreNote
import app.kramya.ui.PAGE
import app.kramya.ui.QueryState
import app.kramya.ui.Row
import app.kramya.ui.SectionLabel
import app.kramya.ui.SessionCardView
import app.kramya.ui.bookingStateFor
import app.kramya.ui.useLiveSessions
import app.kramya.ui.useMyActiveEntries

/**
 * Doctor search - the secondary browse path (docs/PRD.md 5.1). It exists to lead back to a
 * session, which is the only joinable unit, so every result navigates to that doctor's
 * profile and their sessions.
 *
 * Mirror of apps/mobile/app/(app)/(discover)/doctors.tsx.
 *
 * Scoped to the chosen city, like Discover: a patient in Mumbai searching "Sharma" means a
 * Sharma they can actually reach today.
 *
 * **Note the path is built differently from Discover's**, and that is not a slip - it is
 * what the RN file does: `city=...&` then `limit=`, where Discover writes `city=...` then
 * `&limit=`. Both produce a valid query and each is its own cache key, so the two are
 * copied verbatim rather than tidied into one helper.
 */
@Composable
fun DoctorsScreen(initialQuery: String, onBack: () -> Unit, onOpenDoctor: (String) -> Unit) {
    val cityStore = LocalCity.current
    val city by cityStore.city.collectAsStateWithLifecycle()

    var q by remember { mutableStateOf(initialQuery) }
    val query = q.trim()

    val scope = if (city != null) "city=${encodeQuery(city!!)}&" else ""
    val search = if (query.isNotEmpty()) "&q=${encodeQuery(query)}" else ""
    val doctors = useApi<Paginated<PublicDoctor>>("/doctors?${scope}limit=$PAGE$search")

    val items = doctors.data?.items.orEmpty()

    Column(Modifier.fillMaxSize().background(Theme.Colors.Canvas)) {
        NavBar("Doctors", onBack = onBack)

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
            SearchWell(
                value = q,
                onValueChange = { q = it },
                placeholder = "Name or speciality",
                label = "Search doctors",
            )

            if (city != null) {
                BasicText(
                    text = "Searching in $city",
                    modifier = Modifier.padding(top = Theme.Space.x3),
                    style = Theme.Font.Caption.copy(color = Theme.Colors.InkTertiary),
                )
            }

            if (items.isNotEmpty()) {
                ListGroup(inset = 66.dp, modifier = Modifier.padding(top = Theme.Space.x5)) {
                    items.forEach { doctor ->
                        row {
                            Row(
                                avatar = doctor.name,
                                title = doctor.name,
                                subtitle = listOf(
                                    doctor.specialization ?: doctor.departmentName,
                                    doctor.hospitalName,
                                ).joinToString(" · "),
                                padH = 18.dp,
                                onClick = { onOpenDoctor(doctor.id) },
                            )
                        }
                    }
                }
            } else {
                QueryState(
                    pending = doctors.isPending,
                    error = doctors.error,
                    isEmpty = doctors.isSuccess,
                    emptyText = if (query.isNotEmpty()) {
                        "Nothing matches “$query”"
                    } else {
                        "No doctors are listed here yet."
                    },
                    onRetry = doctors.refetch,
                )
            }

            doctors.data?.let { MoreNote(it.items.size, it.total) }
        }
    }
}

/**
 * A doctor and the sessions they are running today.
 * Mirror of apps/mobile/app/(app)/(discover)/doctor/[id].tsx.
 *
 * "Running", not "booked for": after a substitution (docs/PRD.md 8.11) the API matches on
 * the current provider, so a covering doctor's page shows the clinic they are actually
 * taking.
 *
 * The header borrows the place card from the hospital screen - a name at card-title size
 * over a tracked eyebrow, with the facts as one quiet line - so a doctor and a hospital
 * read as the same kind of object at the top of a screen.
 */
@Composable
fun DoctorScreen(
    doctorId: String,
    onBack: () -> Unit,
    onOpenSession: (String) -> Unit,
    onJoin: (String) -> Unit,
    onOpenToken: (String) -> Unit,
) {
    // What this account already holds, for every card on the page at once.
    val myEntries = useMyActiveEntries()

    val doctor = useApi<PublicDoctor>("/doctors/$doctorId")
    val sessions = useApi<Paginated<SessionCard>>("/doctors/$doctorId/sessions?limit=$PAGE")

    val items = sessions.data?.items.orEmpty()
    // Live for every session this doctor is running, not just one a patient has opened.
    // Without this the numbers sit frozen until the screen is navigated away from and back.
    val connected = useLiveSessions(items.map { it.id })

    val data = doctor.data

    Column(Modifier.fillMaxSize().background(Theme.Colors.Canvas)) {
        NavBar(data?.name ?: "Doctor", onBack = onBack)

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
            app.kramya.ui.Card {
                if (data != null) {
                    Avatar(data.name, size = 56.dp)
                    BasicText(
                        text = (data.specialization ?: data.departmentName).uppercase(),
                        modifier = Modifier.padding(top = Theme.Space.x4),
                        style = Theme.Font.Overline.copy(color = Theme.Colors.InkTertiary),
                    )
                    BasicText(
                        text = data.name,
                        modifier = Modifier.padding(top = Theme.Space.x2),
                        style = Theme.Font.H1.copy(color = Theme.Colors.Ink),
                    )
                    BasicText(
                        text = "${data.hospitalName} · ${data.hospitalCity}",
                        modifier = Modifier.padding(top = Theme.Space.x2),
                        style = Theme.Font.Body.copy(
                            fontSize = 14.sp,
                            color = Theme.Colors.InkSecondary,
                        ),
                    )
                    Hairline(Modifier.padding(top = 20.dp))
                    BasicText(
                        text = "About ${data.defaultConsultMins} minutes per patient.",
                        modifier = Modifier.padding(top = Theme.Space.x4),
                        style = Theme.Font.Caption.copy(color = Theme.Colors.InkTertiary),
                    )
                } else {
                    QueryState(
                        pending = doctor.isPending,
                        error = doctor.error,
                        onRetry = doctor.refetch,
                        skeletonRows = 1,
                    )
                }
            }

            Column(Modifier.padding(top = 30.dp, bottom = 10.dp)) {
                SectionLabel("Today's sessions")
            }

            if (!connected && items.isNotEmpty()) {
                Column(Modifier.padding(bottom = Theme.Space.x3)) { LiveState(connected) }
            }

            Column(verticalArrangement = Arrangement.spacedBy(Theme.Space.x4)) {
                items.forEach { card ->
                    SessionCardView(
                        card = card,
                        onOpen = { onOpenSession(card.id) },
                        onJoin = { onJoin(card.id) },
                        onOpenToken = onOpenToken,
                        // One request for the whole list, sliced per card - never one
                        // request per card.
                        booking = bookingStateFor(myEntries[card.id]),
                    )
                }
            }

            if (items.isEmpty()) {
                QueryState(
                    pending = sessions.isPending,
                    error = sessions.error,
                    isEmpty = sessions.isSuccess,
                    emptyText = "This doctor has no OPD today.",
                    onRetry = sessions.refetch,
                )
            }

            sessions.data?.let { MoreNote(it.items.size, it.total) }
        }
    }
}
