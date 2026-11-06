package app.kramya.core

import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.ExperimentalTextApi
import androidx.compose.ui.text.PlatformTextStyle
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.Font
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontVariation
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.LineHeightStyle
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import app.kramya.R

/** Daylight: shared identity with the clinic console, sized for a patient's phone. */
@OptIn(ExperimentalTextApi::class)
object Theme {
    object Colors {
        val Ink = Color(0xFF211D18)
        val InkSecondary = Color(0xFF4A443B)
        val InkTertiary = Color(0xFF6E675C)
        val InkQuaternary = Color(0xFFADA496)
        val Primary = Color(0xFF2E6B4F)
        val PrimaryPressed = Color(0xFF24543D)
        val PrimarySoft = Color(0xFFE4EFE7)
        val BrandDeep = Color(0xFF24543D)
        val BrandLight = Color(0xFF46805D)
        val Accent = Color(0xFFE8A13C)
        val Text = Ink
        val TextMuted = InkSecondary
        val TextDisabled = Color(0xFF81776A)
        val Chevron = Color(0xFF81776A)
        val Canvas = Color(0xFFFAF7F2)
        val Surface = Color.White
        val Border = Color(0xFFE4DDD2)
        val Separator = Color(0xFFE9E3D9)
        val FillSubtle = Color(0xFFF3EEE5)
        val FillSecondary = Color(0xFFEEE7DC)
        val FillStrong = Color(0xFFE2D8C9)
        val FillAvatar = PrimarySoft
        val FillPhoto = Color(0xFFE7EBDD)
        val Bar = Canvas
        val GlassPill = Ink.copy(alpha = 0.88f)
        object Success {
            val Fg = Color(0xFF24543D)
            val Bg = Color(0xFFE4EFE7)
            val Dot = Color(0xFF2E6B4F)
            val OnPhoto = Color(0xFFBCE0C4)
        }
        object Warning {
            val Fg = Color(0xFF80500F)
            val Bg = Color(0xFFFBEEDC)
        }
        object Danger {
            val Fg = Color(0xFFA63A26)
            val Bg = Color(0xFFF8E3DE)
        }
        object Info { val Fg = Primary; val Bg = PrimarySoft }
    }
    object Space {
        val x1=4.dp; val x2=8.dp; val x3=12.dp; val x4=16.dp
        val x5=20.dp; val x6=24.dp; val x8=32.dp; val x10=40.dp
        val x12=48.dp; val x16=64.dp
    }
    val Gutter = 22.dp
    object Radius {
        val Sm=6.dp; val Md=8.dp; val Control=10.dp; val Lg=12.dp
        val Group=14.dp; val Hero=16.dp; val Card=16.dp; val Sheet=20.dp; val Full=9999.dp
    }
    // Min SDK 26 supports bundled variable fonts. Explicit weight axes avoid faux bold.
    private fun family(resource: Int) = FontFamily(
        *listOf(400,500,600,700,800).map { weight ->
            Font(resource, weight=FontWeight(weight),
                variationSettings=FontVariation.Settings(FontVariation.weight(weight)))
        }.toTypedArray()
    )
    val BodyFamily = family(R.font.manrope)
    val DisplayFamily = family(R.font.bricolage_grotesque)
    private val lineBox = LineHeightStyle(LineHeightStyle.Alignment.Center, LineHeightStyle.Trim.None)
    private fun style(size: Double, line: Double, weight: FontWeight, tracking: Double,
                      display: Boolean = false) = TextStyle(
        fontFamily=if(display) DisplayFamily else BodyFamily,
        fontSize=size.sp,lineHeight=line.sp,fontWeight=weight,letterSpacing=tracking.sp,
        lineHeightStyle=lineBox,platformStyle=PlatformTextStyle(includeFontPadding=false),
    )
    object Font {
        val Display=style(32.0,37.0,FontWeight.SemiBold,-1.2,true)
        val H1=style(28.0,33.0,FontWeight.SemiBold,-0.9,true)
        val H2=style(23.0,29.0,FontWeight.SemiBold,-0.6,true)
        val H3=style(17.0,23.0,FontWeight.SemiBold,-0.35)
        val BodyLg=style(16.0,24.0,FontWeight.Normal,-0.2)
        val Body=style(15.0,23.0,FontWeight.Normal,-0.15)
        val Label=style(15.0,21.0,FontWeight.SemiBold,-0.2)
        val Caption=style(13.0,19.0,FontWeight.Normal,0.0)
        val Overline=style(11.0,16.0,FontWeight.Bold,0.9)
        val Micro=style(12.0,17.0,FontWeight.SemiBold,0.2)
        val Stat=style(24.0,30.0,FontWeight.SemiBold,-0.5,true)
        val TokenSm=style(30.0,36.0,FontWeight.SemiBold,-1.0,true)
        val TokenLg=style(46.0,52.0,FontWeight.SemiBold,-1.8,true)
        val TokenXl=style(64.0,70.0,FontWeight.SemiBold,-2.5,true)
        val Tab=style(11.0,16.0,FontWeight.SemiBold,0.0)
    }
    object Elevation { val Sm=0.dp; val Card=0.dp; val Md=2.dp; val Lg=4.dp }
}
