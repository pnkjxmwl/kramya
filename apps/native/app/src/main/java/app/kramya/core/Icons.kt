package app.kramya.core

import androidx.compose.foundation.text.BasicText
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.text.PlatformTextStyle
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.Font
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import app.kramya.R

// The app's only icon import - the mirror of apps/mobile/lib/icon.tsx.
//
// docs/Design.md 6 asks for line icons at ~1.75px stroke with rounded caps, and names
// Lucide. Lucide is a fork of Feather, and Feather is what @expo/vector-icons ships and
// what the RN app actually renders - so this bundles THE SAME Feather.ttf, copied out of
// node_modules, and addresses it by the same codepoints.
//
// Every screen imports Icon, never the font, so the set can be swapped in one file.

/**
 * One glyph.
 *
 * It carries the Feather name alongside the codepoint purely so a stack trace or a
 * layout inspector says "chevron-right" instead of 61744.
 */
data class IconName(val key: String, val code: Int)

/**
 * The 33 glyphs the patient app actually uses - no more.
 *
 * **Generated from the shipped `Feather.json` glyphmap, not typed by hand.** A codepoint
 * transposed by eye renders a plausible-looking wrong icon rather than a crash, which is
 * the kind of mistake that survives every review and ships.
 *
 * Feather has ~280 glyphs; bundling the whole font costs 55KB and bundling a subset
 * would cost a build step, so the font is whole and only the constants are narrowed. The
 * narrowing is the useful half: it means an icon that is not in this list is a compile
 * error rather than a silently-empty box, which is exactly what a string-typed icon name
 * gives you in the RN app.
 */
object Icons {
    val ACTIVITY = IconName("activity", 61696)
    val ALERT_CIRCLE = IconName("alert-circle", 61698)
    val ALERT_TRIANGLE = IconName("alert-triangle", 61700)
    val BELL = IconName("bell", 61726)
    val CALENDAR = IconName("calendar", 61735)
    val CHECK = IconName("check", 61739)
    val CHECK_CIRCLE = IconName("check-circle", 61740)
    val CHEVRON_DOWN = IconName("chevron-down", 61742)
    val CHEVRON_LEFT = IconName("chevron-left", 61743)
    val CHEVRON_RIGHT = IconName("chevron-right", 61744)
    val CIRCLE = IconName("circle", 61751)
    val CLIPBOARD = IconName("clipboard", 61752)
    val CLOCK = IconName("clock", 61753)
    val COFFEE = IconName("coffee", 61763)
    val COMPASS = IconName("compass", 61766)
    val CREDIT_CARD = IconName("credit-card", 61777)
    val HOME = IconName("home", 61828)
    val INFO = IconName("info", 61831)
    val LOCK = IconName("lock", 61843)
    val LOG_OUT = IconName("log-out", 61845)
    val MAIL = IconName("mail", 61846)
    val MAP_PIN = IconName("map-pin", 61848)
    val PLUS = IconName("plus", 61888)
    val SEARCH = IconName("search", 61904)
    val SLASH = IconName("slash", 61919)
    val TRASH_2 = IconName("trash-2", 61942)
    val USER = IconName("user", 61957)
    val USER_CHECK = IconName("user-check", 61958)
    val USER_PLUS = IconName("user-plus", 61960)
    val USER_X = IconName("user-x", 61961)
    val USERS = IconName("users", 61962)
    val WIFI_OFF = IconName("wifi-off", 61972)
    val X = IconName("x", 61974)
}

private val Feather = FontFamily(Font(R.font.feather))

/**
 * A Feather glyph.
 *
 * Size defaults to 20 (docs/Design.md 6: "20 default, 24 for primary actions").
 *
 * **The size is a Dp that becomes an sp.** react-native-vector-icons renders a `<Text>`
 * whose fontSize is the given number, and RN Text scales with the OS font setting by
 * default - so on the RN app these glyphs already grow with a patient's accessibility
 * font size, and they grow in step with the label beside them. Taking Dp keeps the call
 * sites reading like layout (`size = 17.dp`) while the conversion preserves that
 * behaviour. A straight `.toSp()` against density would freeze them instead.
 *
 * Hidden from screen readers, exactly as icon.tsx does: docs/Design.md 8 requires a
 * written label beside every status icon in this app, so announcing the glyph as well
 * would read the same thing twice.
 */
@Composable
fun Icon(
    name: IconName,
    size: Dp = 20.dp,
    tint: Color = Theme.Colors.Text,
    modifier: Modifier = Modifier,
) {
    BasicText(
        text = String(Character.toChars(name.code)),
        modifier = modifier.clearAndSetSemantics { },
        style = TextStyle(
            fontFamily = Feather,
            fontSize = size.value.sp,
            color = tint,
            // No lineHeight and no font padding: the glyph should occupy exactly its em
            // box, or a row of icons and labels stops sharing a baseline.
            platformStyle = PlatformTextStyle(includeFontPadding = false),
        ),
    )
}
