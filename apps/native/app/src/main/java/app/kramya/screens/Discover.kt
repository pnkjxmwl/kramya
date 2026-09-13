package app.kramya.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicText
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import app.kramya.LocalCity
import app.kramya.core.Icon
import app.kramya.core.Icons
import app.kramya.core.Theme
import app.kramya.net.HospitalCard
import app.kramya.net.Paginated
import app.kramya.net.Patient
import app.kramya.net.PatientRelation
import app.kramya.net.PublicDoctor
import app.kramya.net.encodeQuery
import app.kramya.net.useApi
import app.kramya.ui.Avatar
import app.kramya.ui.Button
import app.kramya.ui.Dot
import app.kramya.ui.Hairline
import app.kramya.ui.ListGroup
import app.kramya.ui.MoreNote
import app.kramya.ui.PAGE
import app.kramya.ui.Photo
import app.kramya.ui.QueryState
import app.kramya.ui.Row
import app.kramya.ui.Screen
import app.kramya.ui.Scrim
import app.kramya.ui.SectionLabel
import app.kramya.ui.minTouchTarget
import app.kramya.ui.pressable
import kotlinx.coroutines.launch

/**
 * Discover - screen 1 of docs/design_handoff_opd_queue.
 * Mirror of apps/mobile/app/(app)/(discover)/index.tsx.
 *
 * Top to bottom: the city eyebrow and the account avatar, the large title, the search
 * well, one featured hospital as a full-bleed photo card, then NEARBY as
 * hairline-separated rows on the bare background.
 *
 * **The featured card is the SELECTED hospital, and NEARBY lists them all.** Tapping a row
 * selects it - the card above swaps to that hospital and the row marks itself VIEWING. The
 * card is the way in: tapping IT opens the hospital.
 *
 * **Selecting scrolls back to the top**, because the card is 236pt tall and sits under a
 * header - by the time a row is in reach the thing it updates is off-screen, and an
 * interaction whose only feedback is invisible is indistinguishable from a dead tap.
 *
 * While searching there is no featured card at all: typing filters the list, and promoting
 * whichever result sorted first to a 236pt photograph would be the screen picking a
 * favourite out of a set the user is still narrowing.
 *
 * The search box searches BOTH doctors and hospitals. A box that only filtered hospitals
 * would return nothing for "Sharma" and read as broken.
 */
@Composable
fun DiscoverScreen(
    onOpenHospital: (String) -> Unit,
    onOpenDoctor: (String) -> Unit,
    onOpenAllDoctors: (String) -> Unit,
    onChangeCity: () -> Unit,
    onOpenProfile: () -> Unit,
) {
    val cityStore = LocalCity.current
    val city by cityStore.city.collectAsStateWithLifecycle()
    val ready = cityStore.ready

    var q by remember { mutableStateOf("") }
    // Which hospital the featured card is showing. Null until a row is tapped -
    // deliberately not seeded with an id, because the list has not loaded yet and seeding
    // it would mean tracking every way that list can change.
    var selectedId by remember { mutableStateOf<String?>(null) }

    val listState = rememberLazyListState()
    val scope = rememberCoroutineScope()

    val query = q.trim()
    val searching = query.isNotEmpty()

    // The SELF profile is where a real name lives; it also supplies the avatar initials.
    // One query, one cache key, shared with the Profile tab.
    val patients = useApi<List<Patient>>("/patients")
    val self = patients.data?.firstOrNull { it.relation == PatientRelation.SELF }

    val scopeParam = if (city != null) "city=${encodeQuery(city!!)}" else ""
    val search = if (searching) "&q=${encodeQuery(query)}" else ""

    val hospitals = useApi<Paginated<HospitalCard>>(
        "/hospitals?$scopeParam&limit=$PAGE$search",
        enabled = ready && city != null,
    )
    // Only fetched while searching - an empty box is a hospital list, not a doctor list.
    val doctors = useApi<Paginated<PublicDoctor>>(
        "/doctors?$scopeParam&limit=3$search",
        enabled = ready && city != null && searching,
    )

    val items = hospitals.data?.items.orEmpty()

    /*
      Before anything is tapped, lead with a hospital that is actually running OPD today.

      The list arrives in the server's order, which is alphabetical - so the card was
      whichever clinic sorted first, open or not. In Mumbai that was a leftover called
      "Demo Hospital" with no photograph and no sessions, and the app opened on a 236pt
      initials block advertising NO OPD TODAY. That is the worst possible first frame, and
      it was not a data accident: any city can have a closed clinic sort first.

      "Open today" and not "has a photo", because the reason to lead with a hospital is
      that a patient can do something there.
    */
    val featured = if (searching) {
        null
    } else {
        items.firstOrNull { it.id == selectedId }
            ?: items.firstOrNull { it.openSessionCount > 0 }
            ?: items.firstOrNull()
    }
    // Hospitals you could book into right now, not hospitals with a programme today.
    val openNow = items.count { it.openSessionCount > 0 }

    // First run: no city stored. A prompt, deliberately NOT an automatic redirect - the
    // auth gate already swaps trees, and a second automatic navigation is how a loop
    // starts.
    if (ready && city == null) {
        Screen {
            Column(
                Modifier.fillMaxSize().padding(horizontal = Theme.Gutter),
                verticalArrangement = Arrangement.spacedBy(Theme.Space.x2, Alignment.CenterVertically),
                horizontalAlignment = Alignment.CenterHorizontally,
            ) {
                BasicText(
                    "Choose your city",
                    style = Theme.Font.H1.copy(
                        color = Theme.Colors.Ink,
                        textAlign = TextAlign.Center,
                    ),
                )
                BasicText(
                    "We'll show the hospitals running OPD near you today.",
                    style = Theme.Font.Body.copy(
                        color = Theme.Colors.InkTertiary,
                        textAlign = TextAlign.Center,
                    ),
                )
                Box(Modifier.fillMaxWidth().padding(top = Theme.Space.x4)) {
                    Button("Select city", onClick = onChangeCity)
                }
            }
        }
        return
    }

    Screen {
        LazyColumn(
            state = listState,
            modifier = Modifier.fillMaxSize(),
            contentPadding = androidx.compose.foundation.layout.PaddingValues(
                start = Theme.Gutter,
                end = Theme.Gutter,
                bottom = Theme.Space.x8,
            ),
        ) {
            item(key = "header") {
                Column {
                    Row(
                        Modifier.fillMaxWidth().padding(top = Theme.Space.x2),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically,
                    ) {
                        Row(
                            Modifier
                                // The eyebrow is 14pt of type; the touch target is what
                                // takes it past the 44x44 floor in docs/Design.md 8.
                                .minTouchTarget()
                                .pressable(
                                    radius = Theme.Radius.Sm,
                                    label = city?.let { "Change city, currently $it" }
                                        ?: "Choose your city",
                                    onClick = onChangeCity,
                                )
                                .padding(vertical = 6.dp),
                            horizontalArrangement = Arrangement.spacedBy(5.dp),
                            verticalAlignment = Alignment.CenterVertically,
                        ) {
                            BasicText(
                                text = (city ?: "Choose city").uppercase(),
                                style = Theme.Font.Overline.copy(color = Theme.Colors.InkTertiary),
                            )
                            Icon(
                                Icons.CHEVRON_DOWN,
                                size = 13.dp,
                                tint = Theme.Colors.InkTertiary,
                            )
                        }

                        // Crossing to the Profile TAB, not pushing a screen onto this
                        // stack.
                        Box(
                            Modifier
                                .minTouchTarget()
                                .pressable(
                                    radius = Theme.Radius.Full,
                                    label = "Your profile",
                                    onClick = onOpenProfile,
                                ),
                            contentAlignment = Alignment.Center,
                        ) { Avatar(self?.name ?: "?", size = 30.dp) }
                    }

                    BasicText(
                        "Hospitals",
                        modifier = Modifier.padding(top = Theme.Space.x6),
                        style = Theme.Font.Display.copy(color = Theme.Colors.Ink),
                    )
                    BasicText(
                        text = if (searching) {
                            "${hospitals.data?.total ?: 0} matching “$query”"
                        } else {
                            "$openNow open near you right now"
                        },
                        modifier = Modifier.padding(top = 6.dp),
                        style = Theme.Font.Body.copy(color = Theme.Colors.InkTertiary),
                    )

                    SearchWell(
                        value = q,
                        onValueChange = { q = it },
                        placeholder = "Hospitals, doctors, specialities",
                        label = "Search doctors and hospitals",
                        modifier = Modifier.padding(top = Theme.Space.x5),
                    )

                    if (featured != null) {
                        FeaturedCard(featured, onClick = { onOpenHospital(featured.id) })
                    }

                    val doctorPage = doctors.data
                    if (searching && doctorPage != null && doctorPage.total > 0) {
                        Column(
                            Modifier.padding(top = Theme.Space.x8),
                            verticalArrangement = Arrangement.spacedBy(Theme.Space.x3),
                        ) {
                            SectionLabel("Doctors")
                            ListGroup(inset = 66.dp) {
                                doctorPage.items.forEach { doctor ->
                                    row {
                                        Row(
                                            avatar = doctor.name,
                                            title = doctor.name,
                                            subtitle = "${doctor.specialization ?: doctor.departmentName} · ${doctor.hospitalName}",
                                            padH = 18.dp,
                                            onClick = { onOpenDoctor(doctor.id) },
                                        )
                                    }
                                }
                                if (doctorPage.total > doctorPage.items.size) {
                                    row {
                                        Row(
                                            icon = Icons.USERS,
                                            title = "See all ${doctorPage.total} doctors",
                                            padH = 18.dp,
                                            onClick = { onOpenAllDoctors(query) },
                                        )
                                    }
                                }
                            }
                        }
                    }

                    if (items.isNotEmpty() || hospitals.isPending) {
                        Box(
                            Modifier.padding(
                                top = Theme.Space.x8,
                                bottom = Theme.Space.x1,
                            ),
                        ) { SectionLabel(if (searching) "Hospitals" else "Nearby") }
                    }
                }
            }

            if (items.isEmpty()) {
                item(key = "state") {
                    QueryState(
                        pending = !ready || hospitals.isPending,
                        error = hospitals.error,
                        // NEARBY lists every hospital, so an empty list means there are
                        // none.
                        isEmpty = hospitals.isSuccess,
                        emptyText = if (searching) {
                            "Nothing matches “$query”"
                        } else {
                            "No hospitals are listed in $city yet."
                        },
                        // Four, because Mumbai has four - the placeholder should be the
                        // shape of the answer, not an arbitrary count that resizes the
                        // page.
                        skeletonRows = 4,
                        onRetry = hospitals.refetch,
                    )
                }
            } else {
                itemsIndexed(items, key = { _, item -> item.id }) { index, hospital ->
                    val viewing = hospital.id == featured?.id
                    // FlatList's ItemSeparatorComponent: strictly BETWEEN rows.
                    if (index > 0) Hairline()
                    Row(
                        hasPhoto = true,
                        photoUrl = hospital.photoUrl,
                        avatar = hospital.name,
                        title = hospital.name,
                        subtitle = "${hospital.area ?: hospital.city} · " + when {
                            hospital.openSessionCount > 0 -> "${hospital.openSessionCount} open now"
                            hospital.todaySessionCount > 0 -> "Closed for today"
                            else -> "No OPD today"
                        },
                        trailing = if (!viewing) null else {
                            {
                                // The handoff's marker on the selected row: 11/600 in ink,
                                // where the chevron would be. Ink rather than tertiary on
                                // purpose - it is the one row that is not "tap me to go
                                // somewhere", so it should not look like the others.
                                BasicText(
                                    "VIEWING",
                                    style = Theme.Font.Micro.copy(color = Theme.Colors.Ink),
                                )
                            }
                        },
                        // Selecting, not navigating - but only while there is a card to
                        // update. A search hides the featured card, so a row tap there has
                        // nothing to change and must still lead somewhere.
                        onClick = {
                            if (searching) {
                                onOpenHospital(hospital.id)
                            } else {
                                selectedId = hospital.id
                                scope.launch { listState.animateScrollToItem(0) }
                            }
                        },
                    )
                }
            }

            hospitals.data?.let { page ->
                item(key = "more") { MoreNote(page.items.size, page.total) }
            }
        }
    }
}

/** The 236pt photo card. The handoff's hero. */
@Composable
private fun FeaturedCard(hospital: HospitalCard, onClick: () -> Unit) {
    Box(
        Modifier
            .fillMaxWidth()
            .padding(top = Theme.Space.x6)
            .height(236.dp)
            .shadow(Theme.Elevation.Lg, RoundedCornerShape(Theme.Radius.Hero))
            .clip(RoundedCornerShape(Theme.Radius.Hero))
            .background(Theme.Colors.FillPhoto)
            .pressable(
                radius = Theme.Radius.Hero,
                label = "Open ${hospital.name}, ${hospital.openSessionCount} OPD open now",
                onClick = onClick,
            ),
    ) {
        Photo(
            uri = hospital.photoUrl,
            name = hospital.name,
            modifier = Modifier.fillMaxSize(),
            radius = Theme.Radius.Hero,
            initialsSize = 44.dp,
        )
        Scrim()

        Column(
            Modifier
                .align(Alignment.BottomStart)
                .padding(start = 20.dp, end = 20.dp, bottom = 18.dp),
        ) {
            /*
              Three states, because there are three - and the middle one is the reason this
              changed. "8 OPD OPEN NOW" was `todaySessionCount`, which counts today's
              PROGRAMME including finished clinics, so the hero card was measured
              advertising eight open sessions at a hospital where every one had ended. A
              hospital whose day is over is not the same as a hospital with no OPD, and
              neither is "open now".
            */
            Row(
                Modifier
                    .clip(RoundedCornerShape(9.dp))
                    // The handoff blurs what is behind this pill. With no blur available
                    // the tint has to carry it alone, so it sits a little heavier than the
                    // specified 20% - at 20% flat, white 11px type over a bright sky is
                    // unreadable.
                    .background(Color.White.copy(alpha = 0.26f))
                    .padding(horizontal = 10.dp, vertical = 5.dp),
                horizontalArrangement = Arrangement.spacedBy(6.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                if (hospital.openSessionCount > 0) Dot(color = Theme.Colors.Success.OnPhoto)
                BasicText(
                    text = when {
                        hospital.openSessionCount > 0 ->
                            "${hospital.openSessionCount} OPD OPEN NOW"
                        hospital.todaySessionCount > 0 ->
                            "${hospital.todaySessionCount} OPD TODAY · CLOSED"
                        else -> "NO OPD TODAY"
                    },
                    style = Theme.Font.Micro.copy(color = Color.White),
                )
            }
            BasicText(
                text = hospital.name,
                modifier = Modifier.padding(top = 10.dp),
                maxLines = 2,
                overflow = TextOverflow.Ellipsis,
                style = Theme.Font.H2.copy(color = Color.White),
            )
            BasicText(
                text = hospital.area ?: hospital.city,
                modifier = Modifier.padding(top = 3.dp),
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
                style = Theme.Font.Caption.copy(color = Color.White.copy(alpha = 0.82f)),
            )
        }
    }
}

/**
 * The handoff's recessed search well: 46pt, radius 15, the subtle fill.
 *
 * ONE search control in the app, shared by Discover, the doctor list and the city picker -
 * not three that merely resemble each other, which is the kind of seam that makes an app
 * feel assembled.
 */
@Composable
fun SearchWell(
    value: String,
    onValueChange: (String) -> Unit,
    placeholder: String,
    label: String,
    modifier: Modifier = Modifier,
    capitalize: Boolean = false,
) {
    Row(
        modifier
            .fillMaxWidth()
            .height(46.dp)
            .clip(RoundedCornerShape(Theme.Radius.Lg))
            .background(Theme.Colors.FillSubtle)
            .padding(horizontal = 14.dp),
        horizontalArrangement = Arrangement.spacedBy(Theme.Space.x2),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Icon(Icons.SEARCH, size = 15.dp, tint = Theme.Colors.InkTertiary)
        Box(Modifier.weight(1f), contentAlignment = Alignment.CenterStart) {
            if (value.isEmpty()) {
                BasicText(
                    placeholder,
                    style = Theme.Font.Body.copy(color = Theme.Colors.InkTertiary),
                )
            }
            BasicTextField(
                value = value,
                onValueChange = onValueChange,
                modifier = Modifier
                    .fillMaxWidth()
                    .semantics { contentDescription = label },
                singleLine = true,
                textStyle = Theme.Font.Body.copy(color = Theme.Colors.Ink),
                cursorBrush = SolidColor(Theme.Colors.Ink),
                keyboardOptions = KeyboardOptions(
                    capitalization = if (capitalize) {
                        androidx.compose.ui.text.input.KeyboardCapitalization.Words
                    } else {
                        androidx.compose.ui.text.input.KeyboardCapitalization.None
                    },
                    autoCorrectEnabled = false,
                ),
            )
        }
        if (value.isNotEmpty()) {
            Box(
                Modifier
                    .minTouchTarget()
                    .pressable(
                        radius = Theme.Radius.Full,
                        label = "Clear search",
                        onClick = { onValueChange("") },
                    ),
                contentAlignment = Alignment.Center,
            ) { Icon(Icons.X, size = 16.dp, tint = Theme.Colors.InkTertiary) }
        }
    }
}

