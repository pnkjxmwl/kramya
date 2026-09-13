package app.kramya.screens

import android.app.AlertDialog
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.text.BasicText
import androidx.compose.foundation.verticalScroll
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import app.kramya.BuildConfig
import app.kramya.LocalCity
import app.kramya.core.Icon
import app.kramya.core.Icons
import app.kramya.core.Theme
import app.kramya.nav.BarAction
import app.kramya.nav.NavBar
import app.kramya.net.Api
import app.kramya.net.CreatePatientRequest
import app.kramya.net.LocalAuth
import app.kramya.net.LocalQueryClient
import app.kramya.net.MeResponse
import app.kramya.net.Patient
import app.kramya.net.PatientRelation
import app.kramya.net.useApi
import app.kramya.ui.Avatar
import app.kramya.ui.ErrorNote
import app.kramya.ui.Field
import app.kramya.ui.Hairline
import app.kramya.ui.ListGroup
import app.kramya.ui.QueryState
import app.kramya.ui.Row
import app.kramya.ui.Screen
import app.kramya.ui.SectionLabel
import app.kramya.ui.minTouchTarget
import app.kramya.ui.pressable
import androidx.compose.ui.text.input.KeyboardCapitalization
import kotlinx.coroutines.launch

/**
 * The account: who you are, who you book for, and the way out.
 * Mirror of apps/mobile/app/(app)/profile/index.tsx.
 *
 * **Direction C, chosen from the mockups** - the quietest of the five, and the only one
 * with nothing decorative on it. No card, no stats trio: an avatar, the name AS the screen
 * title, the email under it, then grouped rows.
 *
 * The four rejected directions all differed only in the top quarter and kept an identical
 * list underneath, which is what finally showed that the header was never the problem.
 * What makes this version work where an earlier centred one did not is the rows: each
 * carries its value as a SECOND LINE rather than right-aligned against the chevron, so
 * "Family profiles / You, Aarav" answers the question the row asks instead of just
 * labelling it. A settings row that names the people is worth more than one that counts
 * them.
 */
@Composable
fun ProfileScreen(
    onOpenPatients: () -> Unit,
    onOpenCity: () -> Unit,
) {
    val auth = LocalAuth.current
    val queryClient = LocalQueryClient.current
    val cityStore = LocalCity.current
    val city by cityStore.city.collectAsStateWithLifecycle()
    val scope = rememberCoroutineScope()

    val me = useApi<MeResponse>("/me")
    // Same cache key Discover uses, so this costs nothing on a warm app.
    val patients = useApi<List<Patient>>("/patients")
    val people = patients.data.orEmpty()
    val self = people.firstOrNull { it.relation == PatientRelation.SELF }

    // "You, Aarav" - the first names, with SELF spoken as "You". First names only because
    // the row is one line and a family shares a surname.
    val who = people.joinToString(", ") { person ->
        if (person.relation == PatientRelation.SELF) {
            "You"
        } else {
            person.name.substringBefore(' ').ifEmpty { person.name }
        }
    }

    Screen {
        Column(
            Modifier
                .fillMaxSize()
                .verticalScroll(rememberScrollState())
                .padding(
                    start = Theme.Gutter,
                    end = Theme.Gutter,
                    top = Theme.Space.x6,
                    bottom = Theme.Space.x8,
                ),
        ) {
            /*
              One unit, not three stacked pieces.

              It was an avatar with the name and the email centred under it - three separate
              objects floating on the canvas while every other element on the screen sat on
              a white surface. Grouping them into a single row on that same surface is the
              shape iOS uses at the top of Settings, and it gives the screen one thing to
              start with instead of three.

              **No chevron, and not pressable.** The iOS row it borrows from opens an
              account detail screen; this app has none, and a row that looks tappable and
              goes nowhere is a defect already fixed twice in this codebase. It is a header
              that happens to live in a group.
            */
            ListGroup {
                row {
                    Row(
                        Modifier.fillMaxWidth().padding(horizontal = 18.dp, vertical = 18.dp),
                        horizontalArrangement = Arrangement.spacedBy(14.dp),
                        verticalAlignment = Alignment.CenterVertically,
                    ) {
                        Avatar(self?.name ?: me.data?.email ?: "?", size = 54.dp)
                        Column(
                            Modifier.weight(1f),
                            verticalArrangement = Arrangement.spacedBy(2.dp),
                        ) {
                            BasicText(
                                text = self?.name ?: "Your account",
                                maxLines = 1,
                                overflow = TextOverflow.Ellipsis,
                                // 19, not the h2's 25. The name is still the loudest thing
                                // on the screen, but it now shares a row with the avatar
                                // rather than sitting alone under it, and at display size
                                // it overpowered the group it lives in.
                                style = Theme.Font.H3.copy(
                                    fontSize = 19.sp,
                                    lineHeight = 24.sp,
                                    letterSpacing = (-0.5).sp,
                                    fontWeight = FontWeight.SemiBold,
                                    color = Theme.Colors.Ink,
                                ),
                            )
                            BasicText(
                                text = me.data?.email ?: " ",
                                maxLines = 1,
                                overflow = TextOverflow.Ellipsis,
                                style = Theme.Font.Caption.copy(color = Theme.Colors.InkTertiary),
                            )
                        }
                    }
                }
            }

            QueryState(pending = me.isPending, error = me.error, onRetry = me.refetch)

            Column(Modifier.padding(top = 30.dp, bottom = 10.dp)) { SectionLabel("Booking") }
            // 18 of row padding + a 36 glyph + the row's own 14 gap: the hairline starts
            // where the text does, which is the whole point of an inset separator.
            ListGroup(inset = 68.dp) {
                row {
                    Row(
                        icon = Icons.USERS,
                        title = "Family profiles",
                        subtitle = who.ifEmpty { "Add the people you book for" },
                        padH = 18.dp,
                        onClick = onOpenPatients,
                    )
                }
                row {
                    Row(
                        icon = Icons.MAP_PIN,
                        title = "City",
                        subtitle = city ?: "Not set",
                        padH = 18.dp,
                        // This tab's OWN copy of the picker. The Discover route belongs to
                        // that tab, so opening it from here would cross tabs and dismiss
                        // back onto the Discover home screen.
                        onClick = onOpenCity,
                    )
                }
            }

            Column(Modifier.padding(top = 30.dp, bottom = 10.dp)) { SectionLabel("About") }
            ListGroup(inset = 68.dp) {
                row {
                    // A real version, from the build this bundle came from. It earns its
                    // row: it is the first thing any support conversation asks for, and an
                    // app with no way to answer makes the person guess.
                    Row(
                        icon = Icons.INFO,
                        title = "Version",
                        meta = BuildConfig.VERSION_NAME,
                        padH = 18.dp,
                        // Reports, does not navigate - so no chevron, and the tap does
                        // nothing.
                        onClick = { },
                        trailing = { Box(Modifier.width(0.dp)) },
                    )
                }
            }

            Column(Modifier.padding(top = 30.dp, bottom = 10.dp)) { SectionLabel("Account") }
            ListGroup {
                row {
                    // Centred, red, no chevron: iOS puts the destructive action in its own
                    // group and gives it no destination, because it has none.
                    Box(
                        Modifier
                            .fillMaxWidth()
                            .pressable(radius = 0.dp, label = "Sign out") {
                                scope.launch {
                                    auth.signOut()
                                    // The next account must not inherit this one's cached
                                    // patients, visits or queue numbers.
                                    queryClient.clear()
                                }
                            }
                            .heightIn(min = 52.dp),
                        contentAlignment = Alignment.Center,
                    ) {
                        BasicText(
                            "Sign out",
                            style = Theme.Font.Label.copy(
                                fontSize = 16.sp,
                                letterSpacing = (-0.4).sp,
                                color = Theme.Colors.Danger.Fg,
                            ),
                        )
                    }
                }
            }
        }
    }
}

/**
 * The people this account books for (docs/PRD.md 6.1, family profiles).
 * Mirror of apps/mobile/app/(app)/profile/patients.tsx.
 *
 * **This screen is only the list.** It went through two shapes first: a permanently
 * expanded form above the list it added to, then the same form folded behind a button at
 * the bottom. Both kept a task and a record on one screen, so the common case (who do I
 * book for?) paid for the rare one (add someone), and the add button sat below a list of
 * unknown length where it could not be found.
 *
 * Adding is a `+` in the bar opening a separate screen - the iOS list-and-detail shape,
 * where the collection screen holds only the collection.
 *
 * **Deleting asks first.** It used to be one tap on a trash glyph, unconfirmed and
 * unrecoverable, on a row holding a family member's name - the only destructive control in
 * the patient app and the easiest to hit by accident.
 */
@Composable
fun PatientsScreen(onBack: () -> Unit, onAdd: () -> Unit) {
    val auth = LocalAuth.current
    val queryClient = LocalQueryClient.current
    val context = LocalContext.current
    val scope = rememberCoroutineScope()

    val patients = useApi<List<Patient>>("/patients")
    var removeError by remember { mutableStateOf<String?>(null) }

    fun remove(patient: Patient) {
        scope.launch {
            removeError = null
            val response = runCatching {
                auth.authedFetch("/patients/${patient.id}", method = "DELETE")
            }.getOrNull()

            /*
              Say why, when the server says why.

              `QueueEntry.patient` and `Consultation.patient` are both `onDelete: Restrict`,
              so removing someone who has ever held a token is refused by the database. The
              old copy - "Could not remove this profile" - described that as a failure of
              the app. It is the record being protected, and the person deserves the reason.
            */
            if (response == null || !response.isSuccessful) {
                removeError = if (response?.code == 409) {
                    "This person has a booking or a past visit, so their profile has to stay."
                } else {
                    "Could not remove this profile"
                }
                response?.close()
                return@launch
            }
            response.close()
            queryClient.invalidate { it == "/patients" }
        }
    }

    val list = patients.data.orEmpty()

    Column(Modifier.fillMaxSize().background(Theme.Colors.Canvas)) {
        NavBar(
            title = "Family profiles",
            onBack = onBack,
            right = {
                Box(
                    Modifier
                        .minTouchTarget()
                        .size(44.dp)
                        .pressable(
                            radius = Theme.Radius.Full,
                            label = "Add a profile",
                            onClick = onAdd,
                        ),
                    contentAlignment = Alignment.Center,
                ) { Icon(Icons.PLUS, size = 22.dp, tint = Theme.Colors.Ink) }
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
                "Every token names one of these people. Add anyone you book on behalf of.",
                modifier = Modifier.padding(bottom = Theme.Space.x5),
                style = Theme.Font.Body.copy(color = Theme.Colors.InkTertiary),
            )

            if (list.isNotEmpty()) {
                ListGroup(inset = 66.dp) {
                    list.forEach { person ->
                        row {
                            Row(
                                Modifier
                                    .fillMaxWidth()
                                    .heightIn(min = 62.dp)
                                    .padding(horizontal = 14.dp, vertical = 12.dp),
                                horizontalArrangement = Arrangement.spacedBy(14.dp),
                                verticalAlignment = Alignment.CenterVertically,
                            ) {
                                Avatar(person.name, size = 38.dp)
                                Column(
                                    Modifier.weight(1f),
                                    verticalArrangement = Arrangement.spacedBy(2.dp),
                                ) {
                                    BasicText(
                                        text = person.name,
                                        maxLines = 1,
                                        overflow = TextOverflow.Ellipsis,
                                        style = Theme.Font.H3.copy(
                                            fontSize = 16.sp,
                                            lineHeight = 21.sp,
                                            color = Theme.Colors.Ink,
                                        ),
                                    )
                                    BasicText(
                                        text = relationLabel(person.relation),
                                        style = Theme.Font.Caption.copy(
                                            color = Theme.Colors.InkTertiary,
                                        ),
                                    )
                                }
                                Box(
                                    Modifier
                                        .size(44.dp)
                                        .pressable(
                                            radius = Theme.Radius.Full,
                                            label = "Remove ${person.name}",
                                        ) {
                                            AlertDialog.Builder(context)
                                                .setTitle("Remove ${person.name}?")
                                                .setMessage(
                                                    "Their profile is deleted from your account. " +
                                                        "Tokens they already hold are not cancelled.",
                                                )
                                                .setNegativeButton("Cancel", null)
                                                .setPositiveButton("Remove") { _, _ -> remove(person) }
                                                .show()
                                        },
                                    contentAlignment = Alignment.Center,
                                ) {
                                    // Tertiary, not danger red. Seven red glyphs down the
                                    // right edge of a list of your own family reads as
                                    // seven warnings; the confirm is where the stakes
                                    // belong.
                                    Icon(
                                        Icons.TRASH_2,
                                        size = 16.dp,
                                        tint = Theme.Colors.InkTertiary,
                                    )
                                }
                            }
                        }
                    }
                }
            } else {
                QueryState(
                    pending = patients.isPending,
                    error = patients.error,
                    isEmpty = patients.isSuccess,
                    emptyText = "No profiles yet. Tap + to add yourself first.",
                    onRetry = patients.refetch,
                )
            }

            removeError?.let {
                Box(Modifier.padding(top = Theme.Space.x5)) { ErrorNote(it) }
            }

            Hairline(Modifier.padding(top = 30.dp))
            BasicText(
                "A profile is who a booking is for — it is not a separate login. Everyone here " +
                    "books through this one account.",
                modifier = Modifier.padding(top = Theme.Space.x4),
                style = Theme.Font.Caption.copy(color = Theme.Colors.InkTertiary),
            )
        }
    }
}

private val RELATIONS = listOf(
    PatientRelation.SELF,
    PatientRelation.SPOUSE,
    PatientRelation.MOTHER,
    PatientRelation.FATHER,
    PatientRelation.CHILD,
    PatientRelation.SIBLING,
    PatientRelation.OTHER,
)

/**
 * Add one person to the account's family profiles.
 * Mirror of apps/mobile/app/(app)/profile/add.tsx.
 *
 * **This used to be a card wedged above the list, and the relation was seven pills.** Both
 * were wrong for the same reason: a form is a task, and a task gets a screen. Pills made a
 * single-choice field look like multi-select tags, wrapped to three ragged rows at seven
 * options, and put a row of small targets where iOS puts a labelled row you tap. The choice
 * is now a checkmark list - the same control iOS uses everywhere for "pick exactly one of a
 * short set" - with Cancel and Save in the bar, which is where a form's verbs belong.
 *
 * No Add button in the content either. `Save` in the header is the single commit point,
 * disabled until there is a name, so the screen cannot be submitted empty.
 */
@Composable
fun AddPatientScreen(onClose: () -> Unit) {
    val auth = LocalAuth.current
    val queryClient = LocalQueryClient.current
    val scope = rememberCoroutineScope()

    var name by remember { mutableStateOf("") }
    var relation by remember { mutableStateOf(PatientRelation.CHILD) }
    var error by remember { mutableStateOf<String?>(null) }
    var saving by remember { mutableStateOf(false) }

    val trimmed = name.trim()
    val canSave = trimmed.isNotEmpty() && !saving

    fun save() {
        if (!canSave) return
        saving = true
        error = null
        scope.launch {
            val body = Api.json.encodeToString(
                CreatePatientRequest.serializer(),
                CreatePatientRequest(trimmed, relation),
            )
            val response = runCatching {
                auth.authedFetch("/patients", method = "POST", body = body)
            }.getOrNull()

            if (response == null || !response.isSuccessful) {
                response?.close()
                error = "Could not add this profile"
                saving = false
                return@launch
            }
            response.close()
            // Same key as useApi("/patients"), so the list, the greeting and the Discover
            // avatar all refresh from this one invalidation.
            queryClient.invalidate { it == "/patients" }
            onClose()
        }
    }

    Column(Modifier.fillMaxSize().background(Theme.Colors.Canvas)) {
        NavBar(
            title = "New profile",
            left = { BarAction("Cancel", onClick = onClose) },
            right = {
                BarAction(
                    label = if (saving) "Saving…" else "Save",
                    onClick = ::save,
                    enabled = canSave,
                    emphasis = true,
                )
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
                    bottom = Theme.Space.x10,
                ),
        ) {
            // The avatar the list will show, built from what has been typed so far. It is
            // the one piece of feedback this form can give before it is submitted.
            Column(
                Modifier.fillMaxWidth().padding(bottom = Theme.Space.x8),
                horizontalAlignment = Alignment.CenterHorizontally,
                verticalArrangement = Arrangement.spacedBy(2.dp),
            ) {
                Avatar(trimmed.ifEmpty { "?" }, size = 64.dp)
                BasicText(
                    text = trimmed.ifEmpty { "New profile" },
                    modifier = Modifier.padding(top = Theme.Space.x4),
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                    style = Theme.Font.H2.copy(color = Theme.Colors.Ink),
                )
                BasicText(
                    relationLabel(relation),
                    style = Theme.Font.Caption.copy(color = Theme.Colors.InkTertiary),
                )
            }

            Field(
                label = "Full name",
                value = name,
                onValueChange = { name = it },
                capitalization = KeyboardCapitalization.Words,
                placeholder = "e.g. Aarav Semwal",
            )

            Column(Modifier.padding(top = 26.dp, bottom = 10.dp)) {
                SectionLabel("Relation to you")
            }
            ListGroup(inset = Theme.Gutter) {
                RELATIONS.forEach { option ->
                    row {
                        Row(
                            title = relationLabel(option),
                            padH = Theme.Gutter,
                            trailing = {
                                Box(Modifier.width(18.dp), contentAlignment = Alignment.CenterEnd) {
                                    if (option == relation) {
                                        Icon(Icons.CHECK, size = 18.dp, tint = Theme.Colors.Ink)
                                    }
                                }
                            },
                            onClick = { relation = option },
                        )
                    }
                }
            }

            error?.let {
                Box(Modifier.padding(top = Theme.Space.x5)) { ErrorNote(it) }
            }

            BasicText(
                "A profile is who a booking is for — it is not a separate login. Everyone here " +
                    "books through your account.",
                modifier = Modifier.padding(top = Theme.Space.x6, start = 4.dp, end = 4.dp),
                style = Theme.Font.Caption.copy(
                    fontSize = 12.sp,
                    color = Theme.Colors.InkTertiary,
                ),
            )
        }
    }
}

/** SELF -> "Myself", MOTHER -> "Mother". */
private fun relationLabel(relation: PatientRelation): String =
    if (relation == PatientRelation.SELF) {
        "Myself"
    } else {
        relation.name.first() + relation.name.drop(1).lowercase()
    }
