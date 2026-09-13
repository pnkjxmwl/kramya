package app.kramya.nav

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.text.BasicText
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.navigation.NavDestination.Companion.hierarchy
import androidx.navigation.NavGraph.Companion.findStartDestination
import androidx.navigation.NavHostController
import androidx.navigation.compose.currentBackStackEntryAsState
import app.kramya.core.Icon
import app.kramya.core.IconName
import app.kramya.core.Icons
import app.kramya.core.Theme
import app.kramya.ui.Hairline
import app.kramya.ui.minTouchTarget
import app.kramya.ui.pressable

// The route graph, and the two pieces of chrome every screen sits inside.
// Mirror of apps/mobile/app/(app)/_layout.tsx and (discover)/_layout.tsx.

/**
 * Every destination, as a constant.
 *
 * expo-router derives routes from the filesystem; Compose Navigation needs them spelled
 * out. The names below are the RN paths with their tab prefix made explicit - and the
 * duplication of the city picker is deliberate and matches the RN app exactly: `location`
 * belongs to Discover and `profile/city` to Profile, because a route belongs to exactly
 * one tab and pushing Discover's from Profile would switch tabs and strand the Profile
 * stack behind it. Same screen, two doors. See apps/mobile/app/(app)/profile/city.tsx.
 */
object Routes {
    const val LOGIN = "login"
    const val SIGNUP = "signup"

    /** The three tab graphs. A tab is selected when the current destination is inside one. */
    const val DISCOVER_GRAPH = "graph/discover"
    const val VISITS_GRAPH = "graph/visits"
    const val PROFILE_GRAPH = "graph/profile"

    // Discover
    const val DISCOVER = "discover"
    const val LOCATION = "location"
    const val DOCTORS = "doctors?q={q}"
    const val DOCTOR = "doctor/{id}"
    const val HOSPITAL = "hospital/{id}"
    const val DEPARTMENT = "department/{id}"
    const val SESSION = "session/{id}"

    // Visits
    const val VISITS = "visits"
    const val JOIN = "join?sessionId={sessionId}"
    const val VISIT = "visit/{id}"

    // Profile
    const val PROFILE = "profile"
    const val PATIENTS = "profile/patients"
    const val ADD_PATIENT = "profile/add"
    const val PROFILE_CITY = "profile/city"

    fun doctors(q: String) = "doctors?q=${java.net.URLEncoder.encode(q, "UTF-8")}"
    fun doctor(id: String) = "doctor/$id"
    fun hospital(id: String) = "hospital/$id"
    fun department(id: String) = "department/$id"
    fun session(id: String) = "session/$id"
    fun join(sessionId: String) = "join?sessionId=$sessionId"
    fun visit(id: String) = "visit/$id"
}

/** The three tabs, in the order the bar draws them. */
enum class Tab(val graph: String, val start: String, val label: String, val icon: IconName) {
    Discover(Routes.DISCOVER_GRAPH, Routes.DISCOVER, "Discover", Icons.COMPASS),

    // "Visits", the handoff's word. The SCREEN is still titled "My Visits" - a tab label
    // has ten pixels of height and no room for a possessive.
    Visits(Routes.VISITS_GRAPH, Routes.VISITS, "Visits", Icons.CLIPBOARD),

    Profile(Routes.PROFILE_GRAPH, Routes.PROFILE, "Profile", Icons.USER),
}

/**
 * Switch tabs, keeping each tab's own stack.
 *
 * `saveState`/`restoreState` is what makes each tab remember where it was - the property
 * expo-router gets from giving every tab its own Stack navigator, and the whole reason a
 * patient five screens into city -> hospital -> department -> session can still reach the
 * other tabs and come back.
 */
fun NavHostController.switchTab(tab: Tab) {
    navigate(tab.graph) {
        popUpTo(graph.findStartDestination().id) { saveState = true }
        launchSingleTop = true
        restoreState = true
    }
}

/**
 * Navigate to a destination that lives in ANOTHER tab.
 *
 * Booking is the case that matters: `join` belongs to the Visits tab, and tapping Join on
 * a department card in Discover must land there. expo-router does this implicitly -
 * pushing a route switches to whichever tab owns it - and the consequence, which this
 * reproduces, is that BACK from the join screen returns to My Visits rather than to the
 * card you tapped.
 *
 * That is not the obvious behaviour, and it is the RN app's, so it is this app's.
 */
fun NavHostController.navigateAcrossTabs(tab: Tab, route: String) {
    val alreadyThere = currentBackStackEntry?.destination?.hierarchy?.any { it.route == tab.graph }
    if (alreadyThere != true) switchTab(tab)
    navigate(route)
}

/**
 * The signed-in shell: a bottom tab bar.
 *
 * Redrawn to the handoff's bar - 64pt on Android, 22pt line glyphs, 10pt labels, ink for
 * the active item and #8A8A8E for the rest, over a 0.5px top hairline.
 *
 * **No blur.** The handoff specifies `rgba(247,247,248,0.86)` over `blur(24px)`. A
 * translucent bar with nothing blurring behind it is worse than an opaque one - content
 * shows through at full sharpness - so the bar is opaque canvas and the hairline does the
 * separating, exactly as in the RN app.
 */
@Composable
fun TabBar(navController: NavHostController) {
    val backStackEntry by navController.currentBackStackEntryAsState()
    val hierarchy = backStackEntry?.destination?.hierarchy

    Column(
        Modifier
            .fillMaxWidth()
            .background(Theme.Colors.Bar)
            // The handoff's bar sits above the home indicator. On Android 15 the app is
            // edge-to-edge whether it asks to be or not, so the gesture bar's inset is
            // added to the specified padding rather than being drawn under.
            .navigationBarsPadding(),
    ) {
        Hairline()
        Row(
            Modifier
                .fillMaxWidth()
                .height(64.dp)
                .padding(top = 10.dp, bottom = 8.dp),
        ) {
            Tab.entries.forEach { tab ->
                val selected = hierarchy?.any { it.route == tab.graph } == true
                val tint = if (selected) Theme.Colors.Ink else Theme.Colors.InkTertiary

                Column(
                    Modifier
                        .weight(1f)
                        .fillMaxSize()
                        .pressable(radius = 0.dp, role = null) {
                            /*
                              Visits always opens on the LIST.

                              Booking pushes `join` onto this tab and then replaces it with
                              the token, so without this the tab is left parked on a single
                              token card - tapping Visits showed that one token instead of
                              the list, and with two bookings there was no way to the second
                              without pressing back.
                            */
                            if (tab == Tab.Visits && selected) {
                                navController.popBackStack(Routes.VISITS, inclusive = false)
                            } else {
                                navController.switchTab(tab)
                            }
                        },
                    horizontalAlignment = Alignment.CenterHorizontally,
                    verticalArrangement = Arrangement.Top,
                ) {
                    Icon(tab.icon, size = 22.dp, tint = tint)
                    BasicText(
                        text = tab.label,
                        modifier = Modifier.padding(top = 4.dp),
                        style = Theme.Font.Tab.copy(
                            color = tint,
                            // `tabBarLabelStyle` in RN is one style for both states, so
                            // the RN app renders the label itself to carry the handoff's
                            // weight change. Same reason here.
                            fontWeight = if (selected) FontWeight.SemiBold else FontWeight.Normal,
                        ),
                    )
                }
            }
        }
    }
}

/**
 * The nav bar every pushed screen carries.
 *
 * The handoff's: a 44pt bar over the status inset, the title at 16/600/-0.4 in ink, a back
 * chevron in ink, and a 0.5px bottom hairline.
 *
 * **The hairline is on.** The teal system switched it off because that bar was white
 * against a grey canvas and had its own edge. This bar is the SAME colour as the content
 * beneath it (both #F7F7F8, per the handoff), so without the hairline it simply dissolves
 * and titles float over scrolling content with nothing between them.
 *
 * **No back label.** iOS puts the previous screen's title beside the chevron - the
 * handoff's "‹ Sunrise" - and Android never has. The RN app sets `headerBackTitle` and
 * Android ignores it, so this ignores it too.
 */
@Composable
fun NavBar(
    title: String,
    onBack: (() -> Unit)? = null,
    left: (@Composable () -> Unit)? = null,
    right: (@Composable () -> Unit)? = null,
) {
    Column(Modifier.fillMaxWidth().background(Theme.Colors.Bar).statusBarsPadding()) {
        Box(Modifier.fillMaxWidth().height(44.dp)) {
            // The title is centred in the BAR, not between the controls, so it does not
            // shift when a right-hand action appears.
            BasicText(
                text = title,
                modifier = Modifier.align(Alignment.Center).padding(horizontal = 72.dp),
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
                style = Theme.Font.Label.copy(
                    fontSize = 16.sp,
                    fontWeight = FontWeight.SemiBold,
                    letterSpacing = (-0.4).sp,
                    color = Theme.Colors.Ink,
                    textAlign = TextAlign.Center,
                ),
            )

            Box(Modifier.align(Alignment.CenterStart).padding(start = Theme.Space.x2)) {
                when {
                    left != null -> left()
                    onBack != null -> Box(
                        Modifier
                            .minTouchTarget()
                            .size(44.dp)
                            .pressable(radius = Theme.Radius.Full, label = "Back", onClick = onBack),
                        contentAlignment = Alignment.Center,
                    ) { Icon(Icons.CHEVRON_LEFT, size = 22.dp, tint = Theme.Colors.Ink) }
                }
            }

            if (right != null) {
                Box(
                    Modifier.align(Alignment.CenterEnd).padding(end = Theme.Space.x2),
                ) { right() }
            }
        }
        Hairline()
    }
}

/** A bar action rendered as text - "Cancel", "Save". The iOS form verbs. */
@Composable
fun BarAction(
    label: String,
    onClick: () -> Unit,
    enabled: Boolean = true,
    emphasis: Boolean = false,
) {
    Box(
        Modifier
            .minTouchTarget()
            .pressable(radius = Theme.Radius.Sm, enabled = enabled, onClick = onClick)
            .padding(horizontal = Theme.Space.x3),
        contentAlignment = Alignment.Center,
    ) {
        BasicText(
            text = label,
            style = Theme.Font.BodyLg.copy(
                color = if (enabled) Theme.Colors.Ink else Theme.Colors.InkTertiary,
                fontWeight = if (emphasis) FontWeight.SemiBold else FontWeight.Normal,
            ),
        )
    }
}

/** A screen body that sits under a NavBar: canvas ground, no status inset of its own. */
@Composable
fun ScreenBody(modifier: Modifier = Modifier, content: @Composable () -> Unit) {
    Box(modifier.fillMaxSize().background(Theme.Colors.Canvas)) { content() }
}

/** Transparent, so a photo screen can bleed under the status bar. */
val Transparent = Color.Transparent
