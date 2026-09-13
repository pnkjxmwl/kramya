package app.kramya.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicText
import androidx.compose.foundation.verticalScroll
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import app.kramya.LocalCity
import app.kramya.core.Icon
import app.kramya.core.Icons
import app.kramya.core.Theme
import app.kramya.nav.BarAction
import app.kramya.nav.NavBar
import app.kramya.net.City
import app.kramya.net.Paginated
import app.kramya.net.useApi
import app.kramya.ui.ListGroup
import app.kramya.ui.MoreNote
import app.kramya.ui.QueryState
import app.kramya.ui.Row

/**
 * Pick the city to browse. Reached on first run and from the eyebrow on Discover.
 * Mirror of apps/mobile/app/(app)/(discover)/location.tsx.
 *
 * The list is server-derived (GET /cities counts only listable hospitals), so a city with
 * nothing to show never appears and the choice can never be a dead end.
 *
 * **It is presented as a task, not a place.** The RN version went through two wrong shapes
 * first: as a pushed screen with a small nav title it read as a sub-page of nothing; given
 * a 34pt title in the content instead, the back chevron sat in a bar directly above it and
 * the two stacked into separate zones. Picking a city is a self-contained task, so the bar
 * carries Cancel rather than a back chevron and the title has the bar to itself.
 *
 * **This one composable serves two routes.** `location` belongs to the Discover tab and
 * `profile/city` to Profile, because a route belongs to exactly one tab - pushing
 * Discover's from Profile would switch tabs and strand the Profile stack behind it. Two
 * doors, one screen, exactly as apps/mobile/app/(app)/profile/city.tsx arranges it.
 */
@Composable
fun LocationScreen(onClose: () -> Unit) {
    val cityStore = LocalCity.current
    val city by cityStore.city.collectAsStateWithLifecycle()
    var q by remember { mutableStateOf("") }

    val cities = useApi<Paginated<City>>("/cities?limit=${app.kramya.ui.PAGE}")

    /*
      Filtered here, not on the server.

      `GET /cities` takes PageQuery and nothing else - no `q`. Adding one would mean
      changing packages/contracts, which is out of scope, and it would buy nothing: the
      endpoint groups every listable hospital into one row per city and returns the whole
      set in a single page, so the full list is already in memory. `MoreNote` below still
      reports the true total honestly if the platform ever outgrows one page - that is the
      signal to move this server-side.
    */
    val all = cities.data?.items.orEmpty()
    val needle = q.trim().lowercase()
    val items = if (needle.isEmpty()) all else all.filter { it.name.lowercase().contains(needle) }

    Column(Modifier.fillMaxSize().background(Theme.Colors.Canvas)) {
        NavBar(
            title = "Your city",
            // Nothing to go back to on first run - a Cancel that strands someone on a
            // city-less app is worse than no Cancel at all.
            left = if (city == null) null else {
                { BarAction("Cancel", onClick = onClose) }
            },
        )

        Column(
            Modifier
                .fillMaxSize()
                .verticalScroll(rememberScrollState())
                .padding(
                    start = Theme.Gutter,
                    end = Theme.Gutter,
                    top = Theme.Space.x5,
                    bottom = Theme.Space.x8,
                ),
        ) {
            BasicText(
                text = if (city == null) {
                    "Choose where you want to be seen. We will show the hospitals running OPD there today."
                } else {
                    "You can change this any time from the home screen."
                },
                modifier = Modifier.padding(bottom = Theme.Space.x5),
                style = Theme.Font.Body.copy(color = Theme.Colors.InkTertiary),
            )

            SearchWell(
                value = q,
                onValueChange = { q = it },
                placeholder = "Search cities",
                label = "Search cities",
                capitalize = true,
                modifier = Modifier.padding(bottom = Theme.Space.x5),
            )

            if (items.isNotEmpty()) {
                ListGroup(inset = Theme.Gutter) {
                    items.forEach { item ->
                        row {
                            val selected = item.name == city
                            Row(
                                title = item.name,
                                subtitle = "${item.hospitalCount} hospital" +
                                    if (item.hospitalCount == 1) " listed" else "s listed",
                                padH = Theme.Gutter,
                                trailing = {
                                    // A fixed 22pt slot on every row, filled only on the
                                    // chosen one. Holding the width is what stops the list
                                    // shifting sideways when the selection moves.
                                    Box(Modifier.width(22.dp), contentAlignment = Alignment.CenterEnd) {
                                        if (selected) {
                                            Box(
                                                Modifier
                                                    .size(22.dp)
                                                    .clip(RoundedCornerShape(percent = 50))
                                                    .background(Theme.Colors.Ink),
                                                contentAlignment = Alignment.Center,
                                            ) { Icon(Icons.CHECK, size = 13.dp, tint = Color.White) }
                                        }
                                    }
                                },
                                onClick = {
                                    cityStore.setCity(item.name)
                                    onClose()
                                },
                            )
                        }
                    }
                }

                BasicText(
                    text = "Only cities with a hospital already on the platform are listed. " +
                        "More are being added.",
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(top = Theme.Space.x4, start = 4.dp, end = 4.dp),
                    style = Theme.Font.Caption.copy(
                        fontSize = 12.sp,
                        color = Theme.Colors.InkTertiary,
                    ),
                )
            } else {
                QueryState(
                    pending = cities.isPending,
                    error = cities.error,
                    isEmpty = cities.isSuccess,
                    // Two different emptinesses. "Nothing matched what you typed" is a
                    // recoverable state you fix by typing less; "nothing is listed" is the
                    // platform having no cities at all. One message for both would tell a
                    // searching user the product is empty.
                    emptyText = if (needle.isEmpty()) {
                        "No hospitals are listed yet. Please check back soon."
                    } else {
                        "No city matches “${q.trim()}”"
                    },
                    onRetry = cities.refetch,
                )
            }

            // Counted against the UNFILTERED list: MoreNote reports what the SERVER
            // truncated, and a local filter is not truncation.
            cities.data?.let { MoreNote(all.size, it.total) }
        }
    }
}
