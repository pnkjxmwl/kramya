/**
 * React Native mirror of docs/Design.md - the iOS-native "ink" system from
 * docs/design_handoff_opd_queue/README.md.
 *
 * **This replaced the teal system in one pass, deliberately.** The handoff is a
 * complete visual language - palette, type scale, radii, spacing, bar chrome - and
 * half-adopting it gives you an app with two of them. Every value below traces to a
 * row in that README's token tables; nothing here is invented, and no screen should
 * hardcode a colour or a radius.
 *
 * The web console (apps/web) is deliberately NOT in scope: a dense staff console
 * wants different conventions than a patient's phone, and the two have never shared
 * a stylesheet, only a doc.
 */
export const theme = {
  color: {
    /**
     * The ink ramp. iOS label colours in all but name, which is the point: the
     * handoff is built on Apple HIG conventions and these are the greys that make a
     * screen read as a system screen rather than as a themed one.
     */
    ink: '#0B0B0C',
    inkSecondary: '#48484A',
    /**
     * **This is the one token in the file that fails WCAG AA, and it is the
     * handoff's own value.**
     *
     * #8A8A8E on the #F7F7F8 canvas measures **3.21:1**. AA wants 4.5:1 for text
     * below 24px (or 18.66px bold), so every row subtitle, caption and eyebrow drawn
     * in it is short - while docs/CLAUDE.md 9 asks for AA. Apple ships the same grey
     * as its own tertiaryLabel, which is why the handoff specifies it and why it
     * looks right; that does not make it compliant.
     *
     * It is left at the handoff value because the handoff was signed off as final
     * and high-fidelity, and quietly darkening a specified colour is not a decision
     * to make on a doc's behalf. **Every screen reads this one token**, so the fix is
     * this line and nothing else:
     *
     *   #72727A -> 4.5:1 (AA for all text)
     *   #6A6A72 -> 5.0:1 (comfortable)
     *
     * `inkSecondary` above already passes at 8.5:1 and is the right home for
     * anything that must be read rather than glanced at.
     */
    inkTertiary: '#8A8A8E',
    inkQuaternary: '#C6C6CA',

    /**
     * The same four, under the role names every screen already imports.
     *
     * Kept as aliases rather than renamed across forty call sites: `text` and
     * `textMuted` say what a colour is FOR, which is the useful thing at a call
     * site, and `primary` is still the one colour a primary action is painted in -
     * it is simply ink now instead of teal.
     */
    primary: '#0B0B0C',
    /** Ink under the finger on a filled button (handoff hover: #26262A). */
    primaryPressed: '#26262A',
    text: '#0B0B0C',
    textMuted: '#48484A',
    textDisabled: '#8A8A8E',
    /** Chevrons and dividing dots - lighter than any text colour, on purpose. */
    chevron: '#C6C6CA',

    canvas: '#F7F7F8',
    surface: '#FFFFFF',

    /**
     * Hairlines are a TINT OF INK, never a grey.
     *
     * A solid #E2E8F0 slab sat visibly on top of white; ink at 8% disappears into
     * whatever it is drawn on and reads as an edge rather than as a line, which is
     * the whole difference between an iOS separator and a web one.
     */
    border: 'rgba(10,10,12,0.08)',
    /** The slightly heavier hairline the handoff uses between list rows. */
    separator: 'rgba(10,10,12,0.09)',

    /** Search fields and other recessed wells. */
    fillSubtle: 'rgba(10,10,12,0.045)',
    /** Secondary buttons and ghost pills. */
    fillSecondary: 'rgba(10,10,12,0.06)',
    /** A ghost pill under the finger. */
    fillStrong: 'rgba(10,10,12,0.11)',
    /** Avatar grounds. */
    fillAvatar: '#F0F0F2',
    /** Photograph placeholder grounds. */
    fillPhoto: '#E6E6E8',

    /**
     * Bar chrome. The handoff asks for rgba(247,247,248,0.86) over blur(24px).
     *
     * **We have no blur.** expo-blur is a native module and is not installed, and
     * docs/CLAUDE.md 2 forbids adding a dependency for a decoration. A translucent
     * bar with nothing blurring behind it is worse than an opaque one - content
     * shows through at full sharpness and the bar looks broken - so the bar is
     * opaque canvas plus the hairline that does the actual separating.
     *
     * ponytail: swap for a BlurView the first time this app needs a development
     * build for some other reason anyway.
     */
    bar: '#F7F7F8',

    /** Floating buttons over photography (handoff: white at 22% + blur 12). */
    glass: 'rgba(255,255,255,0.22)',
    /** The status pill over the featured photo (handoff: white at 20% + blur 8). */
    glassPill: 'rgba(255,255,255,0.20)',

    /**
     * Live / open. The only colour in the system, and it is four values because a
     * green that reads on white is not the green that reads over a photograph.
     *
     * docs/Design.md 8 still holds: status is NEVER the dot alone. Every use of
     * these pairs the colour with a written word - "Live", "Open", "4 OPD OPEN NOW".
     */
    success: {
      fg: '#1F7A4D',
      bg: 'rgba(31,157,98,0.10)',
      /** The 6px status dot. */
      dot: '#1F9D62',
      /** The same dot over imagery, where it has to survive a scrim. */
      onPhoto: '#5DD39E',
    },
    /**
     * Warning and danger are NOT in the handoff - it has no error states - so they
     * are Apple's system colours muted to sit in this palette, rather than the
     * saturated web reds and ambers the teal system carried.
     */
    warning: { fg: '#8A6100', bg: 'rgba(180,120,0,0.10)' },
    danger: { fg: '#C4291E', bg: 'rgba(196,41,30,0.08)' },
    /** Neutral-informational. Ink, because this system does not have a blue. */
    info: { fg: '#48484A', bg: 'rgba(10,10,12,0.06)' },

    /**
     * The neutral ramp, retuned from Tailwind slate to Apple's system greys.
     *
     * The teal system's twin, `teal`, is GONE rather than remapped. Every one of its
     * twenty call sites was a tinted brand surface - a teal-50 empty-state circle, a
     * teal-100 avatar - and in an ink system those are all the same neutral fill.
     * Leaving a `teal` key holding grey values is how the next person paints
     * something teal by accident.
     */
    slate: {
      50: '#FAFAFB',
      100: '#F0F0F2',
      200: '#E6E6E8',
      300: '#C6C6CA',
      400: '#AEAEB2',
      500: '#8A8A8E',
      600: '#636366',
      700: '#48484A',
      800: '#2C2C2E',
      900: '#0B0B0C',
    },
  },

  space: { 1: 4, 2: 8, 3: 12, 4: 16, 5: 20, 6: 24, 8: 32, 10: 40, 12: 48, 16: 64 },

  /**
   * The handoff's screen gutter, named because it is a rule rather than a step on
   * the spacing scale: every screen in this app is 24 from each edge, and the screen
   * that reaches for space[4] for its gutter is the one that will look wrong.
   */
  gutter: 24,

  /**
   * Handoff geometry, verbatim.
   *
   * These are NOT a t-shirt scale any more - they are named after the thing they
   * belong to, because that is how the handoff specifies them and because "the list
   * group radius" is a fact about list groups rather than a point on a curve
   * somebody can slide.
   */
  radius: {
    sm: 6,
    /** Small rectangles - a QR frame, an inline chip. */
    md: 9,
    /** Rectangular buttons and form controls. */
    control: 14,
    /** Thumbnails and the search field. */
    lg: 15,
    /** A grouped white list. */
    group: 22,
    /** The featured photo card on Discover. */
    hero: 26,
    /** The primary card - the lead doctor's live queue. */
    card: 28,
    /** A bottom sheet, and the place card pulled up over a photo header. */
    sheet: 30,
    full: 9999,
  },

  /**
   * Inter, standing in for SF Pro.
   *
   * The handoff names -apple-system with Geist as the web fallback. Inter is already
   * bundled, already gated on the splash in app/_layout.tsx, and is the closest
   * widely-available neo-grotesque to SF Text - so the SIZES, WEIGHTS and TRACKING
   * below come from the handoff and only the family does not. Switching to the
   * platform font would mean an unbundled face on Android and the flat-fallback
   * failure described below, for a difference nobody can name.
   */
  fontFamily: {
    regular: 'Inter_400Regular',
    medium: 'Inter_500Medium',
    semibold: 'Inter_600SemiBold',
    bold: 'Inter_700Bold',
  },

  /**
   * **`fontWeight` is set alongside `fontFamily` on every token, deliberately.**
   *
   * React Native has no `fontWeight` once a real family is named - each weight is a
   * separate loaded face - so the weight here is redundant when Inter loads. It is
   * not redundant when Inter does NOT: a bundler cache, a dev client without the
   * asset, or useFonts erroring and the app rendering anyway all fall back to the
   * system font, and with no weight that fallback is REGULAR EVERYWHERE. The whole
   * app goes flat with nothing in the code to say why. The failure mode of a
   * redundant weight is a slightly heavy glyph; the failure mode of a missing one is
   * an app with no typographic hierarchy at all.
   *
   * The handoff's "550" - SF's variable weight between medium and semibold - maps to
   * Inter_500Medium. Inter at 600 is visibly heavier than SF at 550 and turns every
   * row title into a heading.
   */
  font: {
    /** Large title: the screen's name. "Hospitals". */
    display: {
      fontSize: 34,
      lineHeight: 39,
      fontFamily: 'Inter_600SemiBold',
      fontWeight: '600',
      letterSpacing: -1.2,
    },
    /** Card title: a hospital's name on its own screen. */
    h1: {
      fontSize: 28,
      lineHeight: 33,
      fontFamily: 'Inter_600SemiBold',
      fontWeight: '600',
      letterSpacing: -0.9,
    },
    /** Hero title: a name set over photography. */
    h2: {
      fontSize: 25,
      lineHeight: 30,
      fontFamily: 'Inter_600SemiBold',
      fontWeight: '600',
      letterSpacing: -0.7,
    },
    /** Row title. The most-used size in the app. */
    h3: {
      fontSize: 17,
      lineHeight: 22,
      fontFamily: 'Inter_500Medium',
      fontWeight: '500',
      letterSpacing: -0.4,
    },
    bodyLg: {
      fontSize: 16,
      lineHeight: 22,
      fontFamily: 'Inter_400Regular',
      fontWeight: '400',
      letterSpacing: -0.35,
    },
    body: {
      fontSize: 15,
      lineHeight: 21,
      fontFamily: 'Inter_400Regular',
      fontWeight: '400',
      letterSpacing: -0.3,
    },
    label: {
      fontSize: 15,
      lineHeight: 20,
      fontFamily: 'Inter_500Medium',
      fontWeight: '500',
      letterSpacing: -0.3,
    },
    /** Row subtitle / caption. */
    caption: {
      fontSize: 13,
      lineHeight: 18,
      fontFamily: 'Inter_400Regular',
      fontWeight: '400',
      letterSpacing: -0.1,
    },
    /** Eyebrow. Always UPPERCASE - SectionLabel does the transform for you. */
    overline: {
      fontSize: 11,
      lineHeight: 14,
      fontFamily: 'Inter_600SemiBold',
      fontWeight: '600',
      letterSpacing: 1.4,
    },
    /** The tighter tracked label inside a pill, or over a stat figure. */
    micro: {
      fontSize: 11,
      lineHeight: 14,
      fontFamily: 'Inter_600SemiBold',
      fontWeight: '600',
      letterSpacing: 0.6,
    },
    /** A stat figure. */
    stat: {
      fontSize: 20,
      lineHeight: 24,
      fontFamily: 'Inter_600SemiBold',
      fontWeight: '600',
      letterSpacing: -0.5,
    },
    /** Now-serving. Deliberately quieter than the reader's own token. */
    tokenSm: {
      fontSize: 32,
      lineHeight: 38,
      fontFamily: 'Inter_600SemiBold',
      fontWeight: '600',
      letterSpacing: -1.3,
    },
    /** The reader's own token, in context. The loudest number on the screen. */
    tokenLg: {
      fontSize: 46,
      lineHeight: 50,
      fontFamily: 'Inter_600SemiBold',
      fontWeight: '600',
      letterSpacing: -2.2,
    },
    /** The reader's own token, on the screen that exists only to show it. */
    tokenXl: {
      fontSize: 64,
      lineHeight: 68,
      fontFamily: 'Inter_600SemiBold',
      fontWeight: '600',
      letterSpacing: -3,
    },
    /** Tab bar label. */
    tab: {
      fontSize: 10,
      lineHeight: 13,
      fontFamily: 'Inter_600SemiBold',
      fontWeight: '600',
      letterSpacing: 0.2,
    },
  },

  /**
   * The handoff's two shadows.
   *
   * It specifies each as TWO layers - a 1px contact shadow plus a wide soft one -
   * and React Native draws exactly one. `card` is the single-layer equivalent: the
   * wide layer pulled slightly tighter, so a card still holds an edge without the
   * contact layer beneath it.
   *
   * Both families are set on every level on purpose: iOS reads shadowColor/Offset/
   * Opacity/Radius and ignores elevation; Android reads only elevation. Setting one
   * gives a card that is raised on one platform and flat on the other.
   */
  elevation: {
    sm: {
      shadowColor: '#0B0C0D',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.05,
      shadowRadius: 2,
      elevation: 1,
    },
    /** handoff card: 0 1px 2px rgba(11,12,13,.05), 0 14px 36px rgba(11,12,13,.05) */
    card: {
      shadowColor: '#0B0C0D',
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.06,
      shadowRadius: 22,
      elevation: 2,
    },
    md: {
      shadowColor: '#0B0C0D',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.07,
      shadowRadius: 12,
      elevation: 3,
    },
    /** handoff hero: 0 12px 30px rgba(11,12,13,.12) */
    lg: {
      shadowColor: '#0B0C0D',
      shadowOffset: { width: 0, height: 12 },
      shadowOpacity: 0.12,
      shadowRadius: 24,
      elevation: 8,
    },
  },
} as const;
