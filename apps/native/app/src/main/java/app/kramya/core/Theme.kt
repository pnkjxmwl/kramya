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

// Kramya Android design tokens. Teal identifies actions and navigation;
// warm neutral surfaces keep queue information readable and status colours semantic.
object Theme {

    object Colors {
        val Ink = Color(0xFF15332F)
        val InkSecondary = Color(0xFF405C56)
        val InkTertiary = Color(0xFF5F706B)
        val InkQuaternary = Color(0xFFADBEB7)
        val Primary = Color(0xFF0D6259)
        val PrimaryPressed = Color(0xFF084C45)
        val PrimarySoft = Color(0xFFE0F1EA)
        val BrandDeep = Color(0xFF073F39)
        val BrandLight = Color(0xFF237B6C)
        // Apricot is decorative orientation, never the only signal for a queue state.
        val Accent = Color(0xFFF1B98A)
        val Text = Ink
        val TextMuted = InkSecondary
        val TextDisabled = Color(0xFF7C8C85)
        val Chevron = Color(0xFF81958C)
        val Canvas = Color(0xFFF6F8F4)
        val Surface = Color(0xFFFFFFFF)
        val Border = Color(0xFFDCE6DF)
        val Separator = Color(0xFFE4EBE5)
        val FillSubtle = Color(0xFFEDF2EC)
        val FillSecondary = Color(0xFFE7EEE7)
        val FillStrong = Color(0xFFD8E7DC)
        val FillAvatar = PrimarySoft
        val FillPhoto = Color(0xFFDCEDE5)
        val Bar = Surface
        val GlassPill = BrandDeep.copy(alpha = 0.88f)
        object Success {
            val Fg = Color(0xFF21633D)
            val Bg = Color(0xFFE8F4E9)
            val Dot = Color(0xFF2B8050)
            val OnPhoto = Color(0xFF95E6B1)
        }
        object Warning {
            val Fg = Color(0xFF7A4C00)
            val Bg = Color(0xFFFFF2DA)
        }
        object Danger {
            val Fg = Color(0xFFB52E31)
            val Bg = Color(0xFFFCEBEC)
        }
        object Info {
            val Fg = Primary
            val Bg = PrimarySoft
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

    // Shared screen gutter; use consistently across patient screens.
    val Gutter = 20.dp

    // Shape tokens are named for the controls and surfaces they belong to.
    object Radius {
        val Sm = 6.dp

        /** Small rectangles - a QR frame, an inline chip. */
        val Md = 9.dp

        /** Rectangular buttons and form controls. */
        val Control = 14.dp

        /** Thumbnails and the search field. */
        val Lg = 15.dp

        /** A grouped white list. */
        val Group = 20.dp

        /** The featured photo card on Discover. */
        val Hero = 26.dp

        /** The primary card - the lead doctor's live queue. */
        val Card = 24.dp

        /** A bottom sheet, and the place card pulled up over a photo header. */
        val Sheet = 30.dp

        val Full = 9999.dp
    }

    // Bundled font weights keep rendering consistent without a network font download.
    val Inter = FontFamily(
        Font(R.font.inter_regular, FontWeight.Normal),
        Font(R.font.inter_medium, FontWeight.Medium),
        Font(R.font.inter_semibold, FontWeight.SemiBold),
        Font(R.font.inter_bold, FontWeight.Bold),
    )

    // Centre glyphs within explicit line heights and omit Android's extra font padding.
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
        letterSpacing = tracking.sp,
        lineHeightStyle = LineBox,
        platformStyle = PlatformTextStyle(includeFontPadding = false),
    )

    object Font {
        /** Large title: the screen's name. "Hospitals". */
        val Display = style(30.0, 36.0, FontWeight.SemiBold, -1.2)

        /** Card title: a hospital's name on its own screen. */
        val H1 = style(26.0, 32.0, FontWeight.SemiBold, -0.9)

        /** Hero title: a name set over photography. */
        val H2 = style(23.0, 29.0, FontWeight.SemiBold, -0.7)

        // Medium weight distinguishes row titles from larger section headings.
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
        val Tab = style(11.0, 14.0, FontWeight.SemiBold, 0.2)
    }

    // Restrained elevations preserve the hierarchy without heavy floating cards.
    object Elevation {
        val Sm = 1.dp

        val Card = 2.dp

        val Md = 3.dp

        val Lg = 3.dp
    }
}
