package app.kramya.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.asPaddingValues
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBars
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicText
import androidx.compose.foundation.verticalScroll
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import app.kramya.core.Icon
import app.kramya.core.Icons
import app.kramya.core.Theme
import app.kramya.net.HospitalDetail
import app.kramya.net.Paginated
import app.kramya.net.PublicDepartment
import app.kramya.net.useApi
import app.kramya.ui.Dot
import app.kramya.ui.Hairline
import app.kramya.ui.ListGroup
import app.kramya.ui.MoreNote
import app.kramya.ui.PAGE
import app.kramya.ui.Photo
import app.kramya.ui.QueryState
import app.kramya.ui.Row
import app.kramya.ui.Scrim
import app.kramya.ui.ScrimDirection
import app.kramya.ui.SectionLabel
import app.kramya.ui.pressable

/**
 * Hospital - screen 2 of docs/design_handoff_opd_queue.
 * Mirror of apps/mobile/app/(app)/(discover)/hospital/[id].tsx.
 *
 * A 300pt photograph bleeding under the status bar, a floating glass back button over it,
 * and a white place card pulled 34pt up over the photo's bottom edge. Then the departments
 * as a grouped table.
 *
 * **No nav bar** - the photograph IS the header. The back button below replaces it; the
 * system back gesture is untouched.
 *
 * **What the handoff has and this does not: the Call and Directions buttons, the rating,
 * the distance and the average wait.** Every one of them needs a field that does not exist
 * in packages/contracts - no phone number, no coordinates, no reviews, no historical wait.
 * Inventing them here would put a number on screen that no server ever sent, which is the
 * one thing docs/CLAUDE.md 1 rules out. The stats row instead carries the two figures this
 * app genuinely knows, plus the department count.
 */
@Composable
fun HospitalScreen(
    hospitalId: String,
    onBack: () -> Unit,
    onOpenDepartment: (String) -> Unit,
) {
    val hospital = useApi<HospitalDetail>("/hospitals/$hospitalId")
    val departments = useApi<Paginated<PublicDepartment>>(
        "/departments?hospitalId=$hospitalId&limit=$PAGE",
    )

    val data = hospital.data
    // Two different facts, and the screen states both. "OPD today" is the programme;
    // "open now" is what you can actually act on, and a hospital whose day has finished
    // reads 0 there while still showing the 8 it ran.
    val todayCount = data?.todaySessionCount ?: 0
    val openNow = data?.openSessionCount ?: 0

    val statusInset = WindowInsets.statusBars.asPaddingValues().calculateTopPadding()

    Box(Modifier.fillMaxSize().background(Theme.Colors.Canvas)) {
        Column(
            Modifier
                .fillMaxSize()
                .verticalScroll(rememberScrollState())
                .padding(bottom = Theme.Space.x8),
        ) {
            Box(Modifier.fillMaxWidth().height(300.dp).background(Theme.Colors.FillPhoto)) {
                Photo(
                    uri = data?.photoUrl,
                    name = data?.name ?: "",
                    modifier = Modifier.fillMaxSize(),
                    radius = 0.dp,
                    initialsSize = 54.dp,
                )
                // Only the top band is darkened - so the glass back button holds against a
                // bright sky. The bottom of the photograph needs no scrim: the place card
                // is pulled up over it.
                Box(Modifier.fillMaxWidth().height(140.dp)) {
                    Scrim(direction = ScrimDirection.Down)
                }
            }

            // Everything below the photograph is lifted ONCE, as a group.
            //
            // The place card is pulled up over the photo's bottom edge (the handoff's
            // -34) and the departments have to come with it - three separate offsets on
            // three siblings would leave a 34dp hole at the foot of the scroll and would
            // drift apart the moment one was edited.
            Column(Modifier.fillMaxWidth().offset(y = (-34).dp)) {
            Column(
                Modifier
                    .fillMaxWidth()
                    .clip(
                        RoundedCornerShape(
                            topStart = Theme.Radius.Sheet,
                            topEnd = Theme.Radius.Sheet,
                        ),
                    )
                    .background(Theme.Colors.Surface)
                    .padding(
                        start = Theme.Gutter,
                        end = Theme.Gutter,
                        top = 26.dp,
                        bottom = 24.dp,
                    ),
            ) {
                if (data != null) {
                    BasicText(
                        text = (data.area ?: data.city).uppercase(),
                        style = Theme.Font.Overline.copy(color = Theme.Colors.InkTertiary),
                    )
                    BasicText(
                        text = data.name,
                        modifier = Modifier.padding(top = Theme.Space.x2),
                        style = Theme.Font.H1.copy(color = Theme.Colors.Ink),
                    )

                    // The dot means "you can book here now", so it follows openNow - it
                    // used to follow the day's programme and stayed green over a hospital
                    // that had closed hours earlier.
                    Row(
                        Modifier.padding(top = Theme.Space.x3),
                        horizontalArrangement = Arrangement.spacedBy(6.dp),
                        verticalAlignment = Alignment.CenterVertically,
                    ) {
                        if (openNow > 0) Dot()
                        BasicText(
                            text = buildString {
                                append(
                                    when {
                                        openNow > 0 -> "$openNow OPD open now"
                                        todayCount > 0 -> "Closed for today"
                                        else -> "No OPD today"
                                    },
                                )
                                append("  ·  ")
                                append(data.city)
                            },
                            style = Theme.Font.Body.copy(
                                fontSize = 14.sp,
                                lineHeight = 19.sp,
                                letterSpacing = (-0.2).sp,
                                color = Theme.Colors.InkSecondary,
                            ),
                        )
                    }

                    data.address?.let { address ->
                        BasicText(
                            text = address,
                            modifier = Modifier.padding(top = 6.dp),
                            maxLines = 2,
                            overflow = TextOverflow.Ellipsis,
                            style = Theme.Font.Caption.copy(color = Theme.Colors.InkTertiary),
                        )
                    }

                    Hairline(Modifier.padding(top = 20.dp))

                    Row(Modifier.fillMaxWidth().padding(top = 20.dp)) {
                        Stat(openNow.toString(), "OPEN NOW", Modifier.weight(1f))
                        Stat(todayCount.toString(), "OPD TODAY", Modifier.weight(1f))
                        Stat(
                            (departments.data?.total ?: 0).toString(),
                            "DEPARTMENTS",
                            Modifier.weight(1f),
                        )
                    }
                } else {
                    QueryState(
                        pending = hospital.isPending,
                        error = hospital.error,
                        onRetry = hospital.refetch,
                        skeletonRows = 2,
                    )
                }
            }

            Column(
                Modifier
                    .padding(
                        start = Theme.Gutter,
                        end = Theme.Gutter,
                        top = Theme.Space.x8,
                        bottom = Theme.Space.x3,
                    ),
            ) { SectionLabel("Departments") }

            Column(Modifier.padding(horizontal = Theme.Gutter)) {
                val page = departments.data
                if (page != null && page.items.isNotEmpty()) {
                    ListGroup(inset = Theme.Gutter) {
                        page.items.forEach { department ->
                            row {
                                Row(
                                    title = department.name,
                                    subtitle = if (department.todaySessionCount == 0) {
                                        "No OPD today"
                                    } else {
                                        "${department.todaySessionCount} OPD today"
                                    },
                                    padH = Theme.Gutter,
                                    onClick = { onOpenDepartment(department.id) },
                                )
                            }
                        }
                    }
                } else {
                    QueryState(
                        pending = departments.isPending,
                        error = departments.error,
                        isEmpty = departments.isSuccess,
                        emptyText = "This hospital has no departments listed yet.",
                        onRetry = departments.refetch,
                    )
                }
                page?.let { MoreNote(it.items.size, it.total) }
            }
            }
        }

        // Outside the scroll on purpose so it stays put while the photograph scrolls away.
        // The handoff floats it, and a back button that scrolls off the top is a back
        // button you cannot reach from the bottom of a long department list.
        Box(
            Modifier
                .padding(start = 18.dp, top = statusInset + 8.dp)
                // The tap target is 44; the visible glass circle inside it is the
                // handoff's 36.
                .size(44.dp)
                .pressable(radius = Theme.Radius.Full, label = "Back", onClick = onBack),
            contentAlignment = Alignment.Center,
        ) {
            Box(
                Modifier
                    .size(36.dp)
                    .clip(RoundedCornerShape(percent = 50))
                    // The handoff blurs behind this. With no blur the tint has to hold the
                    // glyph on its own, so it sits heavier than the specified 22%.
                    .background(Color(0xFF14161A).copy(alpha = 0.36f)),
                contentAlignment = Alignment.Center,
            ) { Icon(Icons.CHEVRON_LEFT, size = 20.dp, tint = Color.White) }
        }
    }
}

/** One figure and its tracked caps label. The handoff's stats trio. */
@Composable
private fun Stat(figure: String, label: String, modifier: Modifier = Modifier) {
    Column(modifier, verticalArrangement = Arrangement.spacedBy(3.dp)) {
        BasicText(
            text = figure,
            style = Theme.Font.Stat.copy(
                color = Theme.Colors.Ink,
                fontFeatureSettings = "tnum",
            ),
        )
        BasicText(label, style = Theme.Font.Micro.copy(color = Theme.Colors.InkTertiary))
    }
}
