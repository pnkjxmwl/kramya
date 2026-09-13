package app.kramya.core

import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.PlatformTextStyle
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.Font
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.LineHeightStyle
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import app.kramya.R

// Compose mirror of apps/mobile/theme.ts - the iOS-native "ink" system from
// docs/design_handoff_opd_queue/README.md.
//
// Every value below is copied from that file, not re-derived. Where the RN theme carries
// a comment explaining WHY a value is what it is, the comment comes with it: the two
// files have to be edited together, and a number with no reason attached is a number
// the next person will round.
//
// The one structural difference is elevation. theme.ts sets BOTH families on every
// level - iOS reads shadowColor/Offset/Opacity/Radius, Android reads only `elevation` -
// so on the device this app runs on, only the elevation number was ever doing anything.
// Only that number is carried across.
object Theme {

    object Colors {
        // The ink ramp. iOS label colours in all but name, which is the point: the
        // handoff is built on Apple HIG conventions and these are the greys that make a
        // screen read as a system screen rather than as a themed one.
        val Ink = Color(0xFF0B0B0C)
        val InkSecondary = Color(0xFF48484A)

        // The one token in the system that fails WCAG AA, and it is the handoff's own
        // value: #8A8A8E on the #F7F7F8 canvas measures 3.21:1 against AA's 4.5:1.
        // Left at the handoff value for the reason theme.ts gives - quietly darkening a
        // signed-off colour is not a decision to make on a doc's behalf. Every screen
        // reads this one token, so the fix is this line and nothing else:
        //   #72727A -> 4.5:1 (AA for all text)   #6A6A72 -> 5.0:1 (comfortable)
        val InkTertiary = Color(0xFF8A8A8E)
        val InkQuaternary = Color(0xFFC6C6CA)

        // The same four under the role names the screens use. `Primary` is still the
        // colour a primary action is painted in - it is simply ink now, not teal.
        val Primary = Color(0xFF0B0B0C)
        val PrimaryPressed = Color(0xFF26262A)
        val Text = Color(0xFF0B0B0C)
        val TextMuted = Color(0xFF48484A)
        val TextDisabled = Color(0xFF8A8A8E)

        /** Chevrons and dividing dots - lighter than any text colour, on purpose. */
        val Chevron = Color(0xFFC6C6CA)

        val Canvas = Color(0xFFF7F7F8)
        val Surface = Color(0xFFFFFFFF)

        // Hairlines are a TINT OF INK, never a grey. A solid slab sits visibly on top of
        // white; ink at 8% disappears into whatever it is drawn on and reads as an edge
        // rather than a line - the difference between an iOS separator and a web one.
        private val InkBase = Color(0xFF0A0A0C)
        val Border = InkBase.copy(alpha = 0.08f)
        val Separator = InkBase.copy(alpha = 0.09f)

        /** Search fields and other recessed wells. */
        val FillSubtle = InkBase.copy(alpha = 0.045f)
        /** Secondary buttons and ghost pills. */
        val FillSecondary = InkBase.copy(alpha = 0.06f)
        /** A ghost pill under the finger. */
        val FillStrong = InkBase.copy(alpha = 0.11f)
        /** Avatar grounds. */
        val FillAvatar = Color(0xFFF0F0F2)
        /** Photograph placeholder grounds. */
        val FillPhoto = Color(0xFFE6E6E8)

        // Bar chrome. The handoff asks for rgba(247,247,248,0.86) over blur(24px); there
        // is no blur in either app, and a translucent bar with nothing blurring behind it
        // is worse than an opaque one - content shows through at full sharpness. Opaque
        // canvas, and the hairline does the separating.
        val Bar = Color(0xFFF7F7F8)

        /** The status pill over the featured photo (handoff: white at 20% + blur 8). */
        val GlassPill = Color(0xFFFFFFFF).copy(alpha = 0.20f)

        // Live / open. The only colour in the system, and it is four values because a
        // green that reads on white is not the green that reads over a photograph.
        // Never the dot alone - every use pairs it with a written word.
        object Success {
            val Fg = Color(0xFF1F7A4D)
            val Bg = Color(0xFF1F9D62).copy(alpha = 0.10f)

            /** The 6px status dot. */
            val Dot = Color(0xFF1F9D62)

            /** The same dot over imagery, where it has to survive a scrim. */
            val OnPhoto = Color(0xFF5DD39E)
        }

        // Warning and danger are NOT in the handoff - it has no error states - so they
        // are Apple's system colours muted to sit in this palette, rather than the
        // saturated web reds and ambers the teal system carried.
        object Warning {
            val Fg = Color(0xFF8A6100)
            val Bg = Color(0xFFB47800).copy(alpha = 0.10f)
        }

        object Danger {
            val Fg = Color(0xFFC4291E)
            val Bg = Color(0xFFC4291E).copy(alpha = 0.08f)
        }

        /** Neutral-informational. Ink, because this system does not have a blue. */
        object Info {
            val Fg = Color(0xFF48484A)
            val Bg = InkBase.copy(alpha = 0.06f)
        }
    }

    object Space {
        val x1 = 4.dp
        val x2 = 8.dp
        val x3 = 12.dp
        val x4 = 16.dp
        val x5 = 20.dp
        val x6 = 24.dp
        val x8 = 32.dp
        val x10 = 40.dp
        val x12 = 48.dp
        val x16 = 64.dp
    }

    // The handoff's screen gutter, named because it is a RULE rather than a step on the
    // spacing scale: every screen in this app is 24 from each edge, and the screen that
    // reaches for Space.x4 for its gutter is the one that will look wrong.
    val Gutter = 24.dp

    // Handoff geometry, verbatim. NOT a t-shirt scale - each is named after the thing it
    // belongs to, because that is how the handoff specifies them and because "the list
    // group radius" is a fact about list groups rather than a point on a curve somebody
    // can slide.
    object Radius {
        val Sm = 6.dp

        /** Small rectangles - a QR frame, an inline chip. */
        val Md = 9.dp

        /** Rectangular buttons and form controls. */
        val Control = 14.dp

        /** Thumbnails and the search field. */
        val Lg = 15.dp

        /** A grouped white list. */
        val Group = 22.dp

        /** The featured photo card on Discover. */
        val Hero = 26.dp

        /** The primary card - the lead doctor's live queue. */
        val Card = 28.dp

        /** A bottom sheet, and the place card pulled up over a photo header. */
        val Sheet = 30.dp

        val Full = 9999.dp
    }

    // Inter, standing in for SF Pro. The handoff names -apple-system; Inter is the
    // closest widely-available neo-grotesque, so the SIZES, WEIGHTS and TRACKING below
    // are the handoff's and only the family is not.
    //
    // ONE FontFamily with four weights, rather than theme.ts's four separate family
    // names. React Native has no real weight resolution once a family is named, which is
    // exactly why that file sets fontFamily AND fontWeight on every token - a bundler
    // cache or a missing asset there silently renders the whole app at regular. Compose
    // resolves weight against the family properly, so a weight alone is unambiguous here
    // and cannot fall back flat.
    val Inter = FontFamily(
        Font(R.font.inter_regular, FontWeight.Normal),
        Font(R.font.inter_medium, FontWeight.Medium),
        Font(R.font.inter_semibold, FontWeight.SemiBold),
        Font(R.font.inter_bold, FontWeight.Bold),
    )

    // How a line box is measured.
    //
    // React Native, given an explicit lineHeight, centres the glyphs within that box.
    // Compose defaults to the font's own ascent/descent, so the same numbers put text
    // slightly high in its line - visible the moment two differently-sized labels share
    // a row, which in this app is most of them. Centre alignment with no trim is the
    // configuration that reproduces RN's box, and includeFontPadding=false removes the
    // extra leading Android adds on top of it.
    private val LineBox = LineHeightStyle(
        alignment = LineHeightStyle.Alignment.Center,
        trim = LineHeightStyle.Trim.None,
    )

    private fun style(
        size: Double,
        lineHeight: Double,
        weight: FontWeight,
        tracking: Double,
    ) = TextStyle(
        fontFamily = Inter,
        fontSize = size.sp,
        lineHeight = lineHeight.sp,
        fontWeight = weight,
        // RN letterSpacing is in the same density-independent units as fontSize, so sp
        // is the faithful unit here - not em, which would rescale with the size.
        letterSpacing = tracking.sp,
        lineHeightStyle = LineBox,
        platformStyle = PlatformTextStyle(includeFontPadding = false),
    )

    object Font {
        /** Large title: the screen's name. "Hospitals". */
        val Display = style(34.0, 39.0, FontWeight.SemiBold, -1.2)

        /** Card title: a hospital's name on its own screen. */
        val H1 = style(28.0, 33.0, FontWeight.SemiBold, -0.9)

        /** Hero title: a name set over photography. */
        val H2 = style(25.0, 30.0, FontWeight.SemiBold, -0.7)

        // Row title. The most-used size in the app - and Medium, not SemiBold: the
        // handoff's "550" is SF's variable weight between the two, and Inter at 600
        // turns every row title into a heading.
        val H3 = style(17.0, 22.0, FontWeight.Medium, -0.4)

        val BodyLg = style(16.0, 22.0, FontWeight.Normal, -0.35)
        val Body = style(15.0, 21.0, FontWeight.Normal, -0.3)
        val Label = style(15.0, 20.0, FontWeight.Medium, -0.3)

        /** Row subtitle / caption. */
        val Caption = style(13.0, 18.0, FontWeight.Normal, -0.1)

        /** Eyebrow. Always UPPERCASE - SectionLabel does the transform for you. */
        val Overline = style(11.0, 14.0, FontWeight.SemiBold, 1.4)

        /** The tighter tracked label inside a pill, or over a stat figure. */
        val Micro = style(11.0, 14.0, FontWeight.SemiBold, 0.6)

        /** A stat figure. */
        val Stat = style(20.0, 24.0, FontWeight.SemiBold, -0.5)

        /** Now-serving. Deliberately quieter than the reader's own token. */
        val TokenSm = style(32.0, 38.0, FontWeight.SemiBold, -1.3)

        /** The reader's own token, in context. The loudest number on the screen. */
        val TokenLg = style(46.0, 50.0, FontWeight.SemiBold, -2.2)

        /** The reader's own token, on the screen that exists only to show it. */
        val TokenXl = style(64.0, 68.0, FontWeight.SemiBold, -3.0)

        /** Tab bar label. */
        val Tab = style(10.0, 13.0, FontWeight.SemiBold, 0.2)
    }

    // The handoff's two shadows, as Android sees them.
    //
    // theme.ts specifies each as an iOS shadow AND an elevation, because iOS ignores
    // elevation and Android ignores everything else. Only these numbers ever reached an
    // Android screen, so only these are carried over.
    object Elevation {
        val Sm = 1.dp

        /** handoff card: 0 1px 2px rgba(11,12,13,.05), 0 14px 36px rgba(11,12,13,.05) */
        val Card = 2.dp

        val Md = 3.dp

        /** handoff hero: 0 12px 30px rgba(11,12,13,.12) */
        val Lg = 8.dp
    }
}
