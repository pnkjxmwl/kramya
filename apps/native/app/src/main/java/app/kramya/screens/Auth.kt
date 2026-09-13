package app.kramya.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
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
import androidx.compose.ui.draw.clip
import androidx.compose.ui.text.input.KeyboardCapitalization
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import app.kramya.core.Icon
import app.kramya.core.Icons
import app.kramya.core.Theme
import app.kramya.net.LocalAuth
import app.kramya.ui.Button
import app.kramya.ui.ButtonVariant
import app.kramya.ui.ErrorNote
import app.kramya.ui.Field
import app.kramya.ui.pressable
import kotlinx.coroutines.launch

// Mirror of apps/mobile/app/(auth)/login.tsx and signup.tsx.
//
// White ground, not canvas: the fields are recessed wells, and a grey ground makes a
// recessed well look like a card sitting on something - one surface too many for a page
// with four elements on it.

@Composable
fun LoginScreen(onSignup: () -> Unit) {
    val auth = LocalAuth.current
    val scope = rememberCoroutineScope()

    var email by remember { mutableStateOf("") }
    var password by remember { mutableStateOf("") }
    var error by remember { mutableStateOf<String?>(null) }
    var pending by remember { mutableStateOf(false) }

    fun submit() {
        pending = true
        error = null
        scope.launch {
            try {
                auth.signIn(email.trim(), password)
                // No navigation here - the gate swaps the tree once signedIn flips.
            } catch (failure: Throwable) {
                error = failure.message ?: "Sign-in failed"
                pending = false
            }
        }
    }

    AuthScaffold {
        // Brand mark, then the greeting - both left-aligned, at the handoff's large title
        // size. A centred wordmark over a centred subtitle is a splash screen; this is a
        // form, and a form starts at the left margin like every other screen in the app.
        Row(
            horizontalArrangement = Arrangement.spacedBy(Theme.Space.x3),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Box(
                Modifier
                    .size(34.dp)
                    .clip(RoundedCornerShape(percent = 50))
                    .background(Theme.Colors.Ink),
                contentAlignment = Alignment.Center,
            ) { Icon(Icons.ACTIVITY, size = 22.dp, tint = androidx.compose.ui.graphics.Color.White) }
            BasicText(
                text = "KRAMYA",
                style = Theme.Font.Overline.copy(color = Theme.Colors.InkTertiary),
            )
        }

        Column(
            Modifier.padding(top = Theme.Space.x6, bottom = Theme.Space.x4),
            verticalArrangement = Arrangement.spacedBy(6.dp),
        ) {
            BasicText("Welcome back", style = Theme.Font.Display.copy(color = Theme.Colors.Ink))
            BasicText(
                text = "Join a doctor's queue from home and arrive when it is nearly your turn.",
                style = Theme.Font.Body.copy(color = Theme.Colors.InkTertiary),
            )
        }

        Field(
            label = "Email",
            value = email,
            onValueChange = { email = it },
            keyboardType = KeyboardType.Email,
            icon = Icons.MAIL,
        )
        Field(
            label = "Password",
            value = password,
            onValueChange = { password = it },
            secure = true,
            icon = Icons.LOCK,
        )

        error?.let { ErrorNote(it) }

        Button("Sign in", onClick = ::submit, pending = pending)

        Box(
            Modifier
                .fillMaxWidth()
                .padding(top = Theme.Space.x3)
                .pressable(radius = Theme.Radius.Sm, onClick = onSignup)
                .padding(vertical = Theme.Space.x3),
            contentAlignment = Alignment.Center,
        ) {
            BasicText(
                text = "New here? Create an account",
                style = Theme.Font.Body.copy(
                    color = Theme.Colors.Ink,
                    fontWeight = androidx.compose.ui.text.font.FontWeight.Medium,
                    textAlign = TextAlign.Center,
                ),
            )
        }
    }
}

@Composable
fun SignupScreen(onBack: () -> Unit) {
    val auth = LocalAuth.current
    val scope = rememberCoroutineScope()

    var name by remember { mutableStateOf("") }
    var email by remember { mutableStateOf("") }
    var password by remember { mutableStateOf("") }
    var error by remember { mutableStateOf<String?>(null) }
    var pending by remember { mutableStateOf(false) }

    fun submit() {
        pending = true
        error = null
        scope.launch {
            try {
                // The name creates the account holder's own SELF patient profile
                // server-side.
                auth.signUp(email.trim(), password, name.trim().ifBlank { null })
            } catch (failure: Throwable) {
                error = failure.message ?: "Sign-up failed"
                pending = false
            }
        }
    }

    AuthScaffold {
        Column(
            Modifier.padding(bottom = Theme.Space.x4),
            verticalArrangement = Arrangement.spacedBy(6.dp),
        ) {
            BasicText(
                "Create your account",
                style = Theme.Font.Display.copy(color = Theme.Colors.Ink),
            )
            BasicText(
                text = "Your name becomes your first patient profile — you can add family later.",
                style = Theme.Font.Body.copy(color = Theme.Colors.InkTertiary),
            )
        }

        Field(
            label = "Your name",
            value = name,
            onValueChange = { name = it },
            capitalization = KeyboardCapitalization.Words,
            icon = Icons.USER,
        )
        Field(
            label = "Email",
            value = email,
            onValueChange = { email = it },
            keyboardType = KeyboardType.Email,
            icon = Icons.MAIL,
        )
        Field(
            label = "Password",
            value = password,
            onValueChange = { password = it },
            secure = true,
            icon = Icons.LOCK,
            helper = "At least 10 characters.",
        )

        error?.let { ErrorNote(it) }

        Button("Create account", onClick = ::submit, pending = pending)
        Button("Back to sign in", onClick = onBack, variant = ButtonVariant.Secondary)
    }
}

/**
 * The shared frame: a white, vertically-centred, scrollable column.
 *
 * `imePadding` is the Compose answer to what `windowSoftInputMode=adjustResize` plus a
 * ScrollView does for the RN screens - the content lifts above the keyboard instead of
 * being covered by it.
 */
@Composable
private fun AuthScaffold(content: @Composable () -> Unit) {
    Column(
        Modifier
            .fillMaxSize()
            .background(Theme.Colors.Surface)
            .verticalScroll(rememberScrollState())
            .imePadding()
            .padding(horizontal = Theme.Gutter, vertical = Theme.Space.x8),
        verticalArrangement = Arrangement.spacedBy(Theme.Space.x4, Alignment.CenterVertically),
    ) { content() }
}
