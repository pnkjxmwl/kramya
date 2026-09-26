import type { Config } from 'tailwindcss';

/**
 * The console's design tokens. `docs/Design.md` is the source; this is the web
 * mirror and `apps/mobile/theme.ts` is the React Native one.
 *
 * **The two mirrors share a palette and a spacing rhythm, not a type scale.** They
 * are different machines used by different people: the console is a dense desktop
 * tool a receptionist stares at for a whole shift on a 1440px monitor, and the app
 * is a phone held at arm's length by a patient who may be sixty. 28px screen titles
 * and 16px body are right on the phone and waste a third of the console's vertical
 * space. The scale below is therefore one step tighter throughout, and that
 * divergence is deliberate - recorded in docs/Design.md 3.
 */
export default {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}', './lib/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        /**
         * The console's own ramp, now neutral rather than teal.
         *
         * It kept the numeric shape (50 -> 900) on purpose: the console used
         * `teal-50` for a selected row's tint, `teal-200` for its border and
         * `teal-800` for its text, and those relationships are correct - only the hue
         * was. Renaming the scale rather than recolouring it in place means no file
         * is left calling something "teal" that renders black.
         */
        /**
         * `primary` and `accent` keep their names and change their values.
         *
         * They are semantic, not colour-named - "the colour of the thing you act on"
         * - so pointing them at ink is a one-line change that moves every button,
         * every active nav item and every focus ring at once. A token called
         * `primary` was always the right abstraction; it was just pointed at teal.
         */
        primary: '#0B0B0C',
        accent: '#0B0B0C',

        /**
         * The BRAND palette - the marketing surface only, never the console.
         *
         * Kramya's identity is the ink system the patient app was redrawn onto in
         * September (`apps/mobile/theme.ts`) and the black K of the logo. The console
         * moved onto the same ink in the 2026-09-13 pass (`primary` above) - this
         * comment used to say it was "still teal", which had stopped being true.
         *
         * Kept as its own group so the public page can reach for marketing-only
         * values (`live`, `canvas`) without widening what the console can use.
         *
         * The greens are the handoff's own success pair, used here for one thing
         * only: something that is live.
         */
        brand: {
          // Named keys - the marketing page reads these.
          ink: '#0B0B0C',
          soft: '#48484A',
          muted: '#8A8A8E',
          faint: '#C6C6CA',
          canvas: '#F7F7F8',
          line: 'rgba(10,10,12,0.09)',
          fill: 'rgba(10,10,12,0.045)',
          live: '#1F9D62',
          'live-ink': '#1F7A4D',

          /*
            Numeric ramp - the CONSOLE reads these, and it is the same scale the teal
            one had so the relationships it encodes survive: 50 tints a selected row,
            200 borders it, 800 sets its text. One group rather than two, because a
            second `brand:` key in this object would silently overwrite the first and
            take the marketing page's colours with it.
          */
          50: '#F2F2F3',
          100: '#E7E7E9',
          200: '#D6D6DA',
          300: '#C6C6CA',
          400: '#9A9AA0',
          500: '#6E6E75',
          600: '#48484A',
          700: '#2E2E32',
          800: '#1A1A1D',
          900: '#0B0B0C',
        },

        /**
         * Four surfaces, not two.
         *
         * The console used `canvas` for the page, the sidebar, every table hover,
         * every neutral pill and every skeleton block, so a hovered row, an inactive
         * status and a loading placeholder were all literally the same colour as the
         * page behind them. `sunken` is the recessed one (rails, table heads, inert
         * pills); `raised` is a card lifted off the page; `hover` is the interaction
         * tint. They are close together on purpose - a console is not a landing
         * page - but they are no longer the same value.
         */
        /*
          Neutral, not slate. These were blue-tinted greys chosen to sit under teal;
          under ink they read as a faint cast on every surface. The four-surface
          structure above is unchanged and still correct - only the hue is gone.
        */
        canvas: '#F7F7F8',
        surface: '#FFFFFF',
        sunken: '#F1F1F3',
        hover: '#FAFAFB',

        ink: {
          DEFAULT: '#0B0B0C',
          soft: '#48484A',
          muted: '#8A8A8E',
          disabled: '#B0B0B6',
        },
        line: {
          DEFAULT: '#E3E3E6',
          soft: '#EDEDEF',
          strong: '#C6C6CA',
        },

        // Semantic - docs/Design.md 2.3. `line` is the hairline that goes with the
        // fill, so a banner never has to reach for an arbitrary opacity.
        success: { DEFAULT: '#16A34A', bg: '#DCFCE7', line: '#BBF7D0' },
        warning: { DEFAULT: '#B45309', bg: '#FEF3C7', line: '#FDE68A' },
        danger: { DEFAULT: '#DC2626', bg: '#FEE2E2', line: '#FECACA' },
        info: { DEFAULT: '#2563EB', bg: '#DBEAFE', line: '#BFDBFE' },
      },
      fontFamily: {
        /** The variable next/font sets in app/layout.tsx, NOT the literal "Inter". */
        sans: ['var(--font-inter)', '-apple-system', 'Roboto', 'Segoe UI', 'sans-serif'],
        mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
        /**
         * Instrument Serif, for display accents on the public pages only - one or
         * two words in a headline, never a paragraph, never the console. A single
         * italic serif word beside Inter is what gives the marketing type a voice of
         * its own; an all-sans hero is the look every generated landing page has.
         */
        serif: ['var(--font-serif)', 'Georgia', 'serif'],
      },
      fontSize: {
        /**
         * Negative tracking on everything above 18px. Inter is drawn a little loose
         * for display sizes, and headings set at 0 are the single most reliable tell
         * that a UI was assembled from defaults rather than typeset.
         */
        display: ['30px', { lineHeight: '36px', fontWeight: '700', letterSpacing: '-0.02em' }],
        h1: ['26px', { lineHeight: '32px', fontWeight: '600', letterSpacing: '-0.025em' }],
        h2: ['17px', { lineHeight: '24px', fontWeight: '600', letterSpacing: '-0.014em' }],
        h3: ['15px', { lineHeight: '20px', fontWeight: '600', letterSpacing: '-0.008em' }],
        'body-lg': ['15px', { lineHeight: '24px' }],
        body: ['13.5px', { lineHeight: '20px' }],
        label: ['13px', { lineHeight: '16px', fontWeight: '500' }],
        caption: ['12px', { lineHeight: '16px', fontWeight: '500' }],
        /** UPPERCASE section markers and column heads. docs/Design.md 3, Overline. */
        eyebrow: ['11px', { lineHeight: '14px', fontWeight: '600', letterSpacing: '0.06em' }],
      },
      borderRadius: {
        xs: '4px',
        sm: '6px',
        md: '8px',
        lg: '14px',
        xl: '20px',
      },
      boxShadow: {
        /**
         * Borders do the work; shadows only say "this floats above the page".
         *
         * The old scale put a 12px blur under every card, which on a screen holding
         * nine of them reads as haze rather than as hierarchy. Cards now take a
         * hairline plus `xs`; `md` and `lg` are reserved for things that genuinely
         * overlay - menus, the mobile nav drawer.
         */
        /*
          Neutral ink, not slate. These were rgba(15,23,42) - Tailwind's slate-900,
          picked to sit under teal - and under ink every card carried a faint blue
          cast in its shadow. Same weights, no hue.
        */
        xs: '0 1px 2px rgba(10,10,12,0.04)',
        sm: '0 1px 3px rgba(10,10,12,0.06), 0 1px 2px rgba(10,10,12,0.04)',
        md: '0 4px 12px rgba(10,10,12,0.08)',
        lg: '0 16px 40px -8px rgba(10,10,12,0.18)',
        /**
         * A card that has been lifted off the page - the "now serving" stage, a
         * hovered session. Two layers: a tight contact shadow and a soft, offset
         * ambient one, which is what reads as depth rather than as blur.
         */
        raised: '0 1px 2px rgba(10,10,12,0.06), 0 12px 32px -12px rgba(10,10,12,0.22)',
        /**
         * The primary button's bevel: a 1px highlight on the top edge and a contact
         * shadow below. On a near-black fill that highlight is what makes it read as
         * an object you press rather than a black rectangle.
         */
        button: 'inset 0 1px 0 rgba(255,255,255,0.14), 0 1px 2px rgba(10,10,12,0.24)',
        /** A token chip's keycap edge - it is a physical ticket, drawn as one. */
        keycap: 'inset 0 -1px 0 rgba(10,10,12,0.06), 0 1px 1px rgba(10,10,12,0.04)',
        /**
         * The focus ring, as a shadow so it can sit outside an overflow-hidden row.
         * It was teal at 55% - the last teal value in the console, and 1.9:1 against
         * white, under the 3:1 a focus indicator needs (WCAG 2.4.11). Ink passes.
         */
        focus: '0 0 0 2px #FFFFFF, 0 0 0 4px rgba(11,11,12,0.85)',
      },
      keyframes: {
        'fade-up': {
          from: { opacity: '0', transform: 'translateY(3px)' },
          to: { opacity: '1', transform: 'none' },
        },
        breathe: {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.35' },
        },
        /** Content arriving: a short rise and a fade, never a bounce. */
        rise: {
          from: { opacity: '0', transform: 'translateY(8px)' },
          to: { opacity: '1', transform: 'none' },
        },
        /** A live indicator's halo - the dot stays put, a ring leaves it. */
        ping: {
          '0%': { transform: 'scale(1)', opacity: '0.55' },
          '80%, 100%': { transform: 'scale(2.6)', opacity: '0' },
        },
        /** A value that just changed settles into place. */
        tick: {
          from: { opacity: '0', transform: 'translateY(35%)' },
          to: { opacity: '1', transform: 'none' },
        },
        /** A notification arriving from above on the hero's phone. */
        drop: {
          from: { opacity: '0', transform: 'translateY(-10px) scale(0.98)' },
          to: { opacity: '1', transform: 'none' },
        },
      },
      animation: {
        'fade-up': 'fade-up 180ms cubic-bezier(0.16, 1, 0.3, 1)',
        breathe: 'breathe 2s ease-in-out infinite',
        rise: 'rise 520ms cubic-bezier(0.16, 1, 0.3, 1) both',
        ping: 'ping 2s cubic-bezier(0, 0, 0.2, 1) infinite',
        tick: 'tick 420ms cubic-bezier(0.16, 1, 0.3, 1) both',
        drop: 'drop 480ms cubic-bezier(0.16, 1, 0.3, 1) both',
      },
    },
  },
  plugins: [],
} satisfies Config;
