package app.kramya.ui

import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.defaultMinSize
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicText
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ripple
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.focus.onFocusChanged
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.selected
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.input.KeyboardCapitalization
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.text.input.VisualTransformation
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import app.kramya.core.Icon
import app.kramya.core.IconName
import app.kramya.core.Icons
import app.kramya.core.Theme
import coil3.compose.AsyncImage

// The app's primitives, on the ink system in docs/design_handoff_opd_queue/README.md.
// Mirror of apps/mobile/lib/ui.tsx.
//
// Every export keeps its counterpart's shape and behaviour, so a screen ported from
// there reads the same and comes out looking the same. Where Compose offers a better
// mechanism than React Native for the same visual result, it is used and said so - the
// contract being preserved is what appears on the glass, not the implementation.

/**
 * Press feedback that matches the platform.
 *
 * lib/ui.tsx's `pressable()` returns an Android ripple AND an iOS opacity fade, and
 * picks between them at runtime. Android only ever took the ripple, so that is all this
 * is - `ripple()` from material3, tinted ink at 6%.
 *
 * Ink at 6%, not a grey: on the near-white surfaces this system uses, a grey ripple reads
 * as a dirty smear and an ink one reads as pressure.
 *
 * `clip` before `clickable` so the ripple is bounded by the same radius the thing is
 * drawn with - an unclipped ripple squaring off the corners of a 28dp card is the single
 * most common way a Compose app looks unfinished.
 */
@Composable
fun Modifier.pressable(
    radius: Dp = Theme.Radius.Control,
    enabled: Boolean = true,
    role: Role? = Role.Button,
    label: String? = null,
    onClick: () -> Unit,
): Modifier {
    val shape = remember(radius) { RoundedCornerShape(radius) }
    return this
        .clip(shape)
        .clickable(
            interactionSource = remember { MutableInteractionSource() },
            indication = ripple(color = Theme.Colors.FillSecondary),
            enabled = enabled,
            role = role,
            onClickLabel = label,
            onClick = onClick,
        )
}

/** Screen background plus the status-bar inset. Every screen sits inside one of these. */
@Composable
fun Screen(modifier: Modifier = Modifier, content: @Composable () -> Unit) {
    Box(
        modifier
            .fillMaxSize()
            .background(Theme.Colors.Canvas)
            .statusBarsPadding(),
    ) { content() }
}

/**
 * The gradient that keeps white text legible over a photograph.
 *
 * handoff: `linear-gradient(to top, rgba(8,10,12,.74), rgba(8,10,12,.30) 42%,
 * rgba(8,10,12,.02) 74%)`.
 *
 * lib/ui.tsx has to reach for react-native-svg to draw this, because React Native has no
 * gradient and a stack of translucent Views banded visibly against a sky - which is
 * precisely the upper third of every hospital photo. Compose has `Brush`, so the exact
 * gradient costs nothing and needs no dependency.
 *
 * The stops are the SVG's, re-expressed: that gradient runs bottom-to-top for `up`, and
 * Compose's vertical brush always runs top-to-bottom, so the offsets are mirrored.
 */
@Composable
fun Scrim(
    /** `Up` darkens the bottom (text sits low); `Down` darkens the top (a back button sits high). */
    direction: ScrimDirection = ScrimDirection.Up,
    modifier: Modifier = Modifier,
) {
    val ink = Color(0xFF080A0C)
    val stops = when (direction) {
        ScrimDirection.Up -> arrayOf(
            0.00f to ink.copy(alpha = 0f),
            0.26f to ink.copy(alpha = 0.02f),
            0.58f to ink.copy(alpha = 0.30f),
            1.00f to ink.copy(alpha = 0.74f),
        )
        ScrimDirection.Down -> arrayOf(
            0.00f to ink.copy(alpha = 0.50f),
            0.42f to ink.copy(alpha = 0.30f),
            0.74f to ink.copy(alpha = 0.02f),
            1.00f to ink.copy(alpha = 0f),
        )
    }
    // No pointer input of its own, so it never eats a tap meant for the card underneath.
    Box(modifier.fillMaxSize().background(Brush.verticalGradient(colorStops = stops)))
}

enum class ScrimDirection { Up, Down }

/**
 * A status dot. Six pixels, and never on its own.
 *
 * docs/Design.md 8: colour is never the whole message. Every call site pairs this with a
 * word - "Live", "Open until 8 PM", "4 OPD OPEN NOW" - so the dot is emphasis rather than
 * information, and a colour-blind reader loses nothing.
 */
@Composable
fun Dot(color: Color = Theme.Colors.Success.Dot, size: Dp = 6.dp) {
    Box(Modifier.size(size).clip(RoundedCornerShape(percent = 50)).background(color))
}

/**
 * A hairline separator. The handoff's only line.
 *
 * **One physical pixel, computed from the density** - RN's `StyleSheet.hairlineWidth`. On
 * a 3x screen a 1dp line is three pixels and reads as a rule rather than as an edge.
 *
 * Not `Dp.Hairline`, which is the trap here: it is `Dp(0f)`, and it only means "the
 * thinnest line the platform can draw" to APIs that stroke, like `Modifier.border`. Given
 * to `height()` it means exactly zero, and every separator in the app silently vanishes -
 * a bug that compiles, runs, and can only be seen.
 */
@Composable
fun Hairline(modifier: Modifier = Modifier) {
    val thickness = with(LocalDensity.current) { 1.toDp() }
    Box(
        modifier
            .fillMaxWidth()
            .height(thickness)
            .background(Theme.Colors.Separator),
    )
}

/** Initials on the neutral fill - the stand-in for a photo we do not have. */
fun initialsOf(name: String): String = name
    .replace(Regex("^Dr\\.?\\s+", RegexOption.IGNORE_CASE), "")
    .split(Regex("\\s+"))
    .filter { it.isNotEmpty() }
    .take(2)
    .mapNotNull { it.firstOrNull()?.uppercaseChar() }
    .joinToString("")

@Composable
fun Avatar(name: String, size: Dp = 40.dp) {
    val initials = initialsOf(name).ifEmpty { "?" }
    Box(
        Modifier
            .size(size)
            .clip(RoundedCornerShape(percent = 50))
            .background(Theme.Colors.FillAvatar),
        contentAlignment = Alignment.Center,
    ) {
        BasicText(
            text = initials,
            style = Theme.Font.Label.copy(
                fontSize = (size.value * 0.34f).sp,
                fontWeight = FontWeight.SemiBold,
                color = Theme.Colors.InkSecondary,
                // Two capitals alone in a circle read as one glyph without this.
                letterSpacing = 0.3.sp,
            ),
        )
    }
}

/**
 * A photograph from the API, with the initials fallback built in.
 *
 * **The fallback lives here, not at each call site.** `photoUrl` is nullable by design -
 * most clinics at pilot will never upload one - and a remote image can also simply fail
 * on a hospital's wifi. Both are ordinary states, so every screen gets the same graceful
 * answer without having to remember.
 *
 * The initials sit UNDERNEATH the image rather than instead of it, and the photo fades in
 * over them. The loading state, the null state and the error state are therefore all the
 * same thing, and it is a thing that looks deliberate.
 */
@Composable
fun Photo(
    uri: String?,
    /** Used for the initials shown while loading, and kept if there is no image. */
    name: String,
    modifier: Modifier = Modifier,
    radius: Dp = Theme.Radius.Lg,
    initialsSize: Dp = 16.dp,
) {
    Box(
        modifier
            .clip(RoundedCornerShape(radius))
            // Neutral, and never a hole: the initials sit on it until the photo lands.
            .background(Theme.Colors.FillPhoto),
        contentAlignment = Alignment.Center,
    ) {
        BasicText(
            text = initialsOf(name).ifEmpty { "?" },
            style = Theme.Font.Label.copy(
                fontSize = initialsSize.value.sp,
                fontWeight = FontWeight.SemiBold,
                color = Theme.Colors.InkSecondary,
                letterSpacing = 0.3.sp,
            ),
        )
        if (!uri.isNullOrEmpty()) {
            AsyncImage(
                model = uri,
                contentDescription = null,
                modifier = Modifier.fillMaxSize(),
                contentScale = ContentScale.Crop,
            )
        }
    }
}

/**
 * A pulsing placeholder block.
 *
 * **This exists to kill the centred spinner**, which is the most reliable "hobby app"
 * signal a screen can send. A spinner says "something is happening somewhere"; a skeleton
 * says "a list of hospitals is arriving, and it will be shaped like this". It also
 * removes the layout jump.
 */
@Composable
fun Skeleton(modifier: Modifier = Modifier, radius: Dp = Theme.Radius.Sm) {
    val transition = rememberInfiniteTransition(label = "skeleton")
    val pulse by transition.animateFloat(
        initialValue = 0.5f,
        targetValue = 1f,
        animationSpec = infiniteRepeatable(tween(700), RepeatMode.Reverse),
        label = "pulse",
    )
    Box(
        modifier
            .alpha(pulse)
            .clip(RoundedCornerShape(radius))
            .background(Theme.Colors.FillSecondary),
    )
}

/**
 * A placeholder shaped like a hospital row.
 *
 * The handoff's list row is a 52pt thumbnail and two lines on the bare background. A
 * skeleton that holds the wrong geometry reintroduces exactly the layout jump it exists
 * to remove.
 */
@Composable
fun RowSkeleton() {
    Row(
        Modifier.fillMaxWidth().padding(vertical = 14.dp),
        horizontalArrangement = Arrangement.spacedBy(14.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Skeleton(Modifier.size(52.dp), radius = Theme.Radius.Lg)
        Column(
            Modifier.fillMaxWidth(),
            verticalArrangement = Arrangement.spacedBy(Theme.Space.x2),
        ) {
            Skeleton(Modifier.fillMaxWidth(0.62f).height(16.dp), radius = 5.dp)
            Skeleton(Modifier.fillMaxWidth(0.38f).height(13.dp), radius = 5.dp)
        }
    }
}

/**
 * A section heading - the handoff's **eyebrow**: 11px, 600, tracked +1.4, uppercase,
 * tertiary.
 *
 * **Uppercased here rather than at the call site**, which is also the guard: a screen
 * cannot accidentally ship a sentence-case section heading in a system that has none.
 */
@Composable
fun SectionLabel(text: String, modifier: Modifier = Modifier) {
    BasicText(
        text = text.uppercase(),
        modifier = modifier,
        style = Theme.Font.Overline.copy(color = Theme.Colors.InkTertiary),
    )
}

/**
 * The standard surface: white, a 22pt group radius, and the handoff's soft card shadow.
 *
 * **No hairline border.** The teal system paired a border with the shadow because its
 * shadow was too faint to hold an edge. The handoff's is wider and darker and does hold;
 * a border on top of it draws a visible ring around every card.
 */
@Composable
fun Card(
    modifier: Modifier = Modifier,
    title: String? = null,
    content: @Composable () -> Unit,
) {
    Column(
        modifier
            .fillMaxWidth()
            .shadow(Theme.Elevation.Card, RoundedCornerShape(Theme.Radius.Group))
            .clip(RoundedCornerShape(Theme.Radius.Group))
            .background(Theme.Colors.Surface)
            .padding(Theme.Space.x5),
        verticalArrangement = Arrangement.spacedBy(Theme.Space.x3),
    ) {
        if (title != null) SectionLabel(title)
        content()
    }
}

/** Collects the rows of a [ListGroup], so separators can go strictly BETWEEN them. */
class ListGroupScope {
    internal val rows = mutableListOf<@Composable () -> Unit>()

    fun row(content: @Composable () -> Unit) {
        rows += content
    }
}

/**
 * A white grouped list, hairline-separated, with the separator inset past the leading
 * edge - the iOS grouped-table shape the handoff uses for departments, for "also in
 * cardiology", and for every settings-like list in the app.
 *
 * It collects rows rather than taking arbitrary children so the separators can go BETWEEN
 * them: a trailing hairline under the last row is the single most common way a grouped
 * list gives itself away as hand-rolled.
 *
 * lib/ui.tsx solves the same problem with `Children.toArray`, which flattens the nested
 * arrays a `{items.map(...)}` produces. Compose cannot count its children at all, so the
 * builder is explicit - and it handles loops and conditionals identically.
 */
@Composable
fun ListGroup(
    modifier: Modifier = Modifier,
    /** How far the separator is inset from the left, past an avatar or an icon. */
    inset: Dp = Theme.Gutter,
    content: ListGroupScope.() -> Unit,
) {
    val scope = ListGroupScope().apply(content)
    Column(
        modifier
            .fillMaxWidth()
            .shadow(Theme.Elevation.Sm, RoundedCornerShape(Theme.Radius.Group))
            // clip AFTER the background so a selected row's full-bleed rail takes the
            // group's corner rather than poking past it.
            .clip(RoundedCornerShape(Theme.Radius.Group))
            .background(Theme.Colors.Surface),
    ) {
        scope.rows.forEachIndexed { index, row ->
            if (index > 0) Hairline(Modifier.padding(start = inset))
            row()
        }
    }
}

/**
 * A label and its value on one line - the shape of every detail list in the app.
 *
 * `emphasis` is what a flat version was missing: "Fee" and "Seen by" were the same size
 * and weight, so the number a patient actually opened the app for sat in a column of
 * things they did not.
 */
@Composable
fun KeyValue(label: String, value: String, emphasis: Boolean = false) {
    Row(
        Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.spacedBy(Theme.Space.x4),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        BasicText(
            text = label,
            modifier = Modifier.weight(1f, fill = false),
            style = Theme.Font.Body.copy(color = Theme.Colors.InkTertiary),
        )
        Box(Modifier.weight(1f), contentAlignment = Alignment.CenterEnd) {
            BasicText(
                text = value,
                maxLines = 2,
                overflow = TextOverflow.Ellipsis,
                style = (if (emphasis) Theme.Font.H3 else Theme.Font.Body).copy(
                    color = Theme.Colors.Ink,
                    fontWeight = FontWeight.Medium,
                    textAlign = TextAlign.End,
                    // These numbers change live and must not jitter.
                    fontFeatureSettings = "tnum",
                ),
            )
        }
    }
}

@Composable
fun ErrorNote(message: String) {
    Row(
        Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(Theme.Radius.Control))
            .background(Theme.Colors.Danger.Bg)
            .padding(Theme.Space.x3)
            .semantics { contentDescription = message },
        horizontalArrangement = Arrangement.spacedBy(Theme.Space.x2),
        verticalAlignment = Alignment.Top,
    ) {
        Icon(Icons.ALERT_CIRCLE, size = 17.dp, tint = Theme.Colors.Danger.Fg)
        BasicText(
            text = message,
            style = Theme.Font.Caption.copy(color = Theme.Colors.Danger.Fg),
        )
    }
}

@Composable
fun Button(
    title: String,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    /** Busy: shows a spinner and blocks taps. */
    pending: Boolean = false,
    /**
     * Not ready: blocks taps and LOOKS blocked, with no spinner.
     *
     * Distinct from `pending` because they mean different things to the person looking at
     * it - "wait" versus "you still have to do something".
     */
    enabled: Boolean = true,
    variant: ButtonVariant = ButtonVariant.Primary,
    icon: IconName? = null,
) {
    val inert = pending || !enabled
    val fill = when {
        // Disabled is the neutral fill, never a faded ink - a 40%-opacity black pill
        // still reads as "press me", just badly printed.
        inert -> Theme.Colors.FillSecondary
        variant == ButtonVariant.Primary -> Theme.Colors.Ink
        variant == ButtonVariant.Danger -> Theme.Colors.Danger.Bg
        variant == ButtonVariant.Ghost -> Color.Transparent
        else -> Theme.Colors.FillSecondary
    }
    val foreground = when {
        inert -> Theme.Colors.InkTertiary
        variant == ButtonVariant.Primary -> Color.White
        variant == ButtonVariant.Danger -> Theme.Colors.Danger.Fg
        else -> Theme.Colors.Ink
    }

    // A pill, because in this system the full-width primary action always is
    // (handoff: 52px, radius height/2).
    Row(
        modifier
            .fillMaxWidth()
            .height(52.dp)
            .pressable(radius = 26.dp, enabled = !inert, onClick = onClick)
            .background(fill),
        horizontalArrangement = Arrangement.spacedBy(Theme.Space.x2, Alignment.CenterHorizontally),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        if (pending) {
            CircularProgressIndicator(
                modifier = Modifier.size(20.dp),
                color = Theme.Colors.InkTertiary,
                strokeWidth = 2.dp,
            )
        } else {
            if (icon != null) Icon(icon, size = 17.dp, tint = foreground)
            BasicText(
                text = title,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
                style = Theme.Font.Label.copy(
                    fontSize = 16.sp,
                    letterSpacing = (-0.2).sp,
                    color = foreground,
                ),
            )
        }
    }
}

enum class ButtonVariant { Primary, Secondary, Ghost, Danger }

@Composable
fun Field(
    label: String,
    value: String,
    onValueChange: (String) -> Unit,
    modifier: Modifier = Modifier,
    placeholder: String? = null,
    secure: Boolean = false,
    capitalization: KeyboardCapitalization = KeyboardCapitalization.None,
    keyboardType: KeyboardType = KeyboardType.Text,
    icon: IconName? = null,
    helper: String? = null,
) {
    var focused by remember { mutableStateOf(false) }

    Column(modifier.fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(Theme.Space.x2)) {
        BasicText(
            text = label.uppercase(),
            style = Theme.Font.Overline.copy(color = Theme.Colors.InkTertiary),
        )

        Row(
            Modifier
                .fillMaxWidth()
                .height(50.dp)
                .clip(RoundedCornerShape(Theme.Radius.Control))
                // A recessed well, not a bordered box - the handoff's search field at
                // form size.
                //
                // **Colour only on focus.** No width, no elevation, no background swap
                // that changes geometry. Both fancier versions of this broke the auth
                // screens on a real phone: an elevation change made Android rebuild the
                // shadow layer under a focused input, which drops focus, which fires
                // blur, which removes the elevation - the keyboard opened and shut on a
                // loop. Even a 0->1 border is suspect on a centred, scrolling form.
                .background(if (focused) Theme.Colors.FillSecondary else Theme.Colors.FillSubtle)
                .padding(horizontal = Theme.Space.x4),
            horizontalArrangement = Arrangement.spacedBy(Theme.Space.x2),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            if (icon != null) Icon(icon, size = 17.dp, tint = Theme.Colors.InkTertiary)

            Box(Modifier.weight(1f), contentAlignment = Alignment.CenterStart) {
                if (value.isEmpty() && placeholder != null) {
                    BasicText(
                        text = placeholder,
                        style = Theme.Font.BodyLg.copy(color = Theme.Colors.InkTertiary),
                    )
                }
                BasicTextField(
                    value = value,
                    onValueChange = onValueChange,
                    modifier = Modifier
                        .fillMaxWidth()
                        .onFocusChanged { focused = it.isFocused },
                    singleLine = true,
                    textStyle = Theme.Font.BodyLg.copy(color = Theme.Colors.Ink),
                    cursorBrush = SolidColor(Theme.Colors.Ink),
                    visualTransformation =
                        if (secure) PasswordVisualTransformation() else VisualTransformation.None,
                    keyboardOptions = KeyboardOptions(
                        capitalization = capitalization,
                        autoCorrectEnabled = false,
                        keyboardType = keyboardType,
                        imeAction = ImeAction.Next,
                    ),
                )
            }
        }

        if (helper != null) {
            BasicText(
                text = helper,
                style = Theme.Font.Caption.copy(color = Theme.Colors.InkTertiary),
            )
        }
    }
}

/**
 * A two-or-three-way switch between views of the same list.
 *
 * A recessed track with a raised white thumb - iOS's segmented control, and the same
 * `fill-subtle` well the handoff's search field uses.
 */
@Composable
fun <T> Segmented(
    options: List<Pair<T, String>>,
    value: T,
    onChange: (T) -> Unit,
    modifier: Modifier = Modifier,
) {
    Row(
        modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(Theme.Radius.Control))
            .background(Theme.Colors.FillSubtle)
            .padding(3.dp),
        horizontalArrangement = Arrangement.spacedBy(Theme.Space.x1),
    ) {
        options.forEach { (optionValue, label) ->
            val on = optionValue == value
            Box(
                Modifier
                    .weight(1f)
                    // 44 is the floor in docs/Design.md 8; the track's own padding takes
                    // it past that.
                    .heightIn(min = 40.dp)
                    .then(
                        if (on) {
                            Modifier
                                .shadow(Theme.Elevation.Sm, RoundedCornerShape(Theme.Radius.Md))
                                .clip(RoundedCornerShape(Theme.Radius.Md))
                                .background(Theme.Colors.Surface)
                        } else {
                            Modifier
                        },
                    )
                    .pressable(radius = Theme.Radius.Md, role = Role.Tab) { onChange(optionValue) }
                    .semantics { selected = on },
                contentAlignment = Alignment.Center,
            ) {
                BasicText(
                    text = label,
                    style = Theme.Font.Label.copy(
                        color = if (on) Theme.Colors.Ink else Theme.Colors.InkTertiary,
                        fontWeight = if (on) FontWeight.SemiBold else FontWeight.Medium,
                    ),
                )
            }
        }
    }
}

/**
 * An empty placeholder that occupies a tap target without announcing anything.
 *
 * Used where a Row has a trailing slot that should stay empty and hold its width - the
 * version row on Profile, the unticked cities in the picker. Holding the width is what
 * stops a list shifting sideways when a selection moves.
 */
@Composable
fun TrailingSpacer(width: Dp) {
    Box(Modifier.width(width).clearAndSetSemantics { })
}

/** A minimum touch target. docs/Design.md 8: 44x44, never less. */
fun Modifier.minTouchTarget(): Modifier = this.defaultMinSize(minWidth = 44.dp, minHeight = 44.dp)
