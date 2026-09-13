package app.kramya.nav

import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.navigation.NavBackStackEntry
import androidx.navigation.NavGraphBuilder
import androidx.navigation.NavHostController
import androidx.navigation.NavType
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.rememberNavController
import androidx.navigation.navArgument
import androidx.navigation.navigation
import app.kramya.net.LocalAuth
import app.kramya.push.PendingDeepLink
import app.kramya.push.RegisterForPush
import app.kramya.screens.AddPatientScreen
import app.kramya.screens.DepartmentScreen
import app.kramya.screens.DiscoverScreen
import app.kramya.screens.DoctorScreen
import app.kramya.screens.DoctorsScreen
import app.kramya.screens.HospitalScreen
import app.kramya.screens.JoinScreen
import app.kramya.screens.LocationScreen
import app.kramya.screens.LoginScreen
import app.kramya.screens.PatientsScreen
import app.kramya.screens.ProfileScreen
import app.kramya.screens.SessionScreen
import app.kramya.screens.SignupScreen
import app.kramya.screens.TokenScreen
import app.kramya.screens.VisitsScreen

/**
 * The whole app's navigation.
 *
 * Two trees, swapped on the session - the Compose equivalent of the `Gate` in
 * apps/mobile/app/_layout.tsx, which redirects between the `(auth)` and `(app)` groups so
 * a signed-out user can never land on an app screen and vice versa. Swapping the tree
 * rather than redirecting means there is no frame in which the wrong one is mounted.
 *
 * **No splash.** The RN gate shows a spinner while it reads the keychain and loads Inter.
 * Neither wait exists here: `AuthStore` reads its tokens synchronously at construction,
 * and the fonts are Android resources the framework has already resolved. A splash that
 * waits for nothing is a splash a user notices.
 */
@Composable
fun AppNav() {
    val auth = LocalAuth.current
    val session by auth.state.collectAsStateWithLifecycle()

    if (!session.signedIn) AuthNav() else SignedInNav()
}

@Composable
private fun AuthNav() {
    val nav = rememberNavController()
    NavHost(nav, startDestination = Routes.LOGIN) {
        composable(Routes.LOGIN) {
            LoginScreen(onSignup = { nav.navigate(Routes.SIGNUP) })
        }
        composable(Routes.SIGNUP) {
            Column(Modifier.fillMaxSize()) {
                NavBar("Create account", onBack = { nav.popBackStack() })
                SignupScreen(onBack = { nav.popBackStack() })
            }
        }
    }
}

@Composable
private fun SignedInNav() {
    val nav = rememberNavController()

    // Permission, channel, token registration. Inside the signed-in tree because it needs a
    // session, and once for the whole app.
    RegisterForPush()

    /*
      A notification tap, taken as soon as there is a navigator to take it.

      `navigateAcrossTabs` rather than a bare navigate: the token screen belongs to the
      Visits tab, and arriving there from a cold start must leave My Visits underneath it -
      or Back from a notification exits the app.

      Consumed once, so returning to the app later does not re-navigate to a booking the
      patient has already dealt with.
    */
    val pendingEntryId by PendingDeepLink.entryId.collectAsStateWithLifecycle()
    LaunchedEffect(pendingEntryId) {
        val entryId = pendingEntryId ?: return@LaunchedEffect
        nav.navigateAcrossTabs(Tab.Visits, Routes.visit(entryId))
        PendingDeepLink.consume()
    }

    Column(Modifier.fillMaxSize()) {
        Box(Modifier.weight(1f)) {
            NavHost(nav, startDestination = Routes.DISCOVER_GRAPH) {
                discoverGraph(nav)
                visitsGraph(nav)
                profileGraph(nav)
            }
        }
        TabBar(nav)
    }
}

/** A required path argument. Empty rather than null, so a screen never has to check twice. */
private fun NavBackStackEntry.arg(name: String): String = arguments?.getString(name).orEmpty()

// ---------------------------------------------------------------------------
// Discover
// ---------------------------------------------------------------------------

private fun NavGraphBuilder.discoverGraph(nav: NavHostController) {
    navigation(startDestination = Routes.DISCOVER, route = Routes.DISCOVER_GRAPH) {
        composable(Routes.DISCOVER) {
            DiscoverScreen(
                onOpenHospital = { nav.navigate(Routes.hospital(it)) },
                onOpenDoctor = { nav.navigate(Routes.doctor(it)) },
                onOpenAllDoctors = { nav.navigate(Routes.doctors(it)) },
                onChangeCity = { nav.navigate(Routes.LOCATION) },
                // Crossing to the Profile TAB, not pushing onto this stack.
                onOpenProfile = { nav.switchTab(Tab.Profile) },
            )
        }

        composable(Routes.LOCATION) {
            LocationScreen(onClose = { nav.popBackStack() })
        }

        composable(
            Routes.DOCTORS,
            arguments = listOf(
                navArgument("q") {
                    type = NavType.StringType
                    defaultValue = ""
                },
            ),
        ) { entry ->
            DoctorsScreen(
                initialQuery = entry.arg("q"),
                onBack = { nav.popBackStack() },
                onOpenDoctor = { nav.navigate(Routes.doctor(it)) },
            )
        }

        composable(Routes.DOCTOR) { entry ->
            DoctorScreen(
                doctorId = entry.arg("id"),
                onBack = { nav.popBackStack() },
                onOpenSession = { nav.navigate(Routes.session(it)) },
                onJoin = { nav.navigateAcrossTabs(Tab.Visits, Routes.join(it)) },
                onOpenToken = { nav.navigateAcrossTabs(Tab.Visits, Routes.visit(it)) },
            )
        }

        composable(Routes.HOSPITAL) { entry ->
            HospitalScreen(
                hospitalId = entry.arg("id"),
                onBack = { nav.popBackStack() },
                onOpenDepartment = { nav.navigate(Routes.department(it)) },
            )
        }

        composable(Routes.DEPARTMENT) { entry ->
            DepartmentScreen(
                departmentId = entry.arg("id"),
                onBack = { nav.popBackStack() },
                onOpenSession = { nav.navigate(Routes.session(it)) },
                onJoin = { nav.navigateAcrossTabs(Tab.Visits, Routes.join(it)) },
                onOpenToken = { nav.navigateAcrossTabs(Tab.Visits, Routes.visit(it)) },
            )
        }

        composable(Routes.SESSION) { entry ->
            SessionScreen(
                sessionId = entry.arg("id"),
                onBack = { nav.popBackStack() },
                onJoin = { nav.navigateAcrossTabs(Tab.Visits, Routes.join(it)) },
                onOpenToken = { nav.navigateAcrossTabs(Tab.Visits, Routes.visit(it)) },
            )
        }
    }
}

// ---------------------------------------------------------------------------
// Visits
// ---------------------------------------------------------------------------

private fun NavGraphBuilder.visitsGraph(nav: NavHostController) {
    navigation(startDestination = Routes.VISITS, route = Routes.VISITS_GRAPH) {
        composable(Routes.VISITS) {
            VisitsScreen(onOpenVisit = { nav.navigate(Routes.visit(it)) })
        }

        composable(
            Routes.JOIN,
            arguments = listOf(
                navArgument("sessionId") {
                    type = NavType.StringType
                    defaultValue = ""
                },
            ),
        ) { entry ->
            JoinScreen(
                sessionId = entry.arg("sessionId"),
                onBack = { nav.popBackStack() },
                onOpenToken = { entryId ->
                    /*
                      REPLACE, not push.

                      The join screen has done its job the moment a token exists, and it is
                      holding a Razorpay order that must never be re-opened. Popping it off
                      as the token is pushed is what `router.replace` does in the RN app,
                      and it is what makes Back from the token card land on My Visits rather
                      than on a dead checkout.
                    */
                    nav.navigate(Routes.visit(entryId)) {
                        popUpTo(Routes.JOIN) { inclusive = true }
                    }
                },
            )
        }

        composable(Routes.VISIT) { entry ->
            TokenScreen(
                entryId = entry.arg("id"),
                onBack = { nav.popBackStack() },
            )
        }
    }
}

// ---------------------------------------------------------------------------
// Profile
// ---------------------------------------------------------------------------

private fun NavGraphBuilder.profileGraph(nav: NavHostController) {
    navigation(startDestination = Routes.PROFILE, route = Routes.PROFILE_GRAPH) {
        composable(Routes.PROFILE) {
            ProfileScreen(
                onOpenPatients = { nav.navigate(Routes.PATIENTS) },
                // This tab's own copy of the picker - see Routes.PROFILE_CITY.
                onOpenCity = { nav.navigate(Routes.PROFILE_CITY) },
            )
        }

        composable(Routes.PATIENTS) {
            PatientsScreen(
                onBack = { nav.popBackStack() },
                onAdd = { nav.navigate(Routes.ADD_PATIENT) },
            )
        }

        composable(Routes.ADD_PATIENT) {
            AddPatientScreen(onClose = { nav.popBackStack() })
        }

        composable(Routes.PROFILE_CITY) {
            LocationScreen(onClose = { nav.popBackStack() })
        }
    }
}
