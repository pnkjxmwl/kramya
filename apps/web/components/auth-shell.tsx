import Link from 'next/link';
import { Mark } from './mark';

/**
 * The frame around the two screens reached before anyone is signed in: sign-in, and
 * accepting a staff invitation.
 *
 * **They looked like two different products.** Sign-in was a card with 40px controls
 * and an ink focus ring; the invite page was bare type on white with 48px controls,
 * 6px radii and a different ring. Both are the first screen a new hospital's staff
 * ever see, and the first thing that makes software feel unfinished is a front door
 * that does not match the room behind it.
 *
 * The left panel is not decoration and it is not a testimonial: it says, in the
 * product's own words, what the thing on the right is for. Below `lg` it collapses
 * to the brand mark alone, because on a phone the form is the entire job.
 *
 * **No gradient (docs/Design.md 2.5), but there IS a motif now.** That rule forbids
 * gradients and colour-as-decoration, and this file used to read it as forbidding
 * illustration too. The background is the queue strip in one ink at 6% - no hue, no
 * gradient, nothing that could be mistaken for a status. See `QueueMotif`.
 *
 * The panel is otherwise the pale canvas with a hairline against the white form - the
 * same two surfaces the console itself is built from, so signing in is visibly the
 * same product.
 */

/**
 * **The panel stopped selling.**
 *
 * It used to carry "The queue is the product. Everything else supports it." over three
 * feature bullets - One live board, Check in three ways, Honest waiting times. That
 * first line is an engineering slogan out of docs/CLAUDE.md: it means something to the
 * people who built this and nothing to a receptionist opening a laptop at 8:55. And
 * the bullets are marketing, shown to somebody who has already bought the product and
 * is trying to start a shift. Nobody has ever read a feature list on a sign-in screen.
 *
 * What replaced it is what this person actually wants to know at this moment: what
 * they are about to open. One sentence, in their language - who is waiting, who is
 * next - rather than three cards restating the pitch.
 *
 * The practical help moved to the FOOTER, which is deliberate: this panel is hidden
 * below `lg`, and somebody locked out on a phone is exactly who needs it most.
 */

export function AuthShell({
  title,
  intro,
  children,
  footer,
}: {
  title: string;
  intro: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-canvas lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(0,520px)]">
      {/* ------------------------------------------------------------------
          The panel. Hidden below `lg` - on a phone it would be three screens
          of scrolling in front of a password field.
      ------------------------------------------------------------------- */}
      <aside className="relative hidden flex-col justify-between overflow-hidden bg-brand-ink px-12 py-12 lg:flex">
        <Composition />

        <div className="relative z-10">
          <Brand dark />
        </div>

        <div className="relative z-10 max-w-lg">
          <h2 className="text-h1 text-white">Your clinic, as it is actually running.</h2>
          <p className="mt-4 max-w-[44ch] text-body text-white/60">
            Who is waiting, who is next, and how fast today is really moving — on one
            board, updating as it happens.
          </p>
        </div>

        <p className="relative z-10 max-w-[46ch] text-caption text-white/45">
          This console shows patient names. Access is logged, and you are signed out
          automatically when your session expires.
        </p>
      </aside>

      {/* ------------------------------------------------------------------
          The form. White, so it reads as the surface being acted on.
      ------------------------------------------------------------------- */}
      <main className="flex min-h-screen flex-col justify-center border-line bg-surface px-6 py-12 sm:px-10 lg:border-l">
        <div className="mx-auto w-full max-w-[380px]">
          <div className="lg:hidden">
            <Brand />
          </div>

          <h1 className="mt-8 text-h1 text-ink lg:mt-0">{title}</h1>
          <p className="mt-1.5 text-body text-ink-muted">{intro}</p>

          <div className="mt-7">{children}</div>

          {footer !== undefined && (
            <div className="mt-6 border-t border-line-soft pt-5 text-caption text-ink-muted">
              {footer}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

/**
 * The panel's graphic: the product itself, floating.
 *
 * **This is the composition every good sign-in screen uses and none of them draw with
 * stock art** - Linear, Raycast, Height all put their own interface on the dark half
 * of the page, tilted, layered and bleeding off the edge. It works because it is the
 * one image no competitor can borrow, and because the person signing in recognises
 * what they are about to open.
 *
 * Two earlier attempts were wrong in the same direction. Feature bullets sold to
 * somebody who had already bought. A 6% bar texture was a *texture* - safe, and not
 * design. This is a composition: a real token card at the front, a board fragment
 * behind it, both rotated off-axis so they read as objects rather than as screenshots
 * pasted flat.
 *
 * **Still no gradient (docs/Design.md 2.5).** The panel is flat ink; the cards are
 * flat white and flat ink; depth comes from shadow, rotation and overlap, which are
 * structure rather than decoration. The single green dot is the one thing colour is
 * allowed to do here - mark a state - and it marks the only live thing on screen.
 *
 * `aria-hidden`: every word in it is repeated in the text beside it, and a screen
 * reader announcing a decorative token number would be noise.
 */
function Composition() {
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
      {/*
        A single soft pool of light behind the cards. Not a gradient background - it
        is a radial fade whose only job is to stop two white cards floating on flat
        black looking like they were cut out with scissors.
      */}
      <div className="absolute -right-24 top-1/4 h-[520px] w-[520px] rounded-full bg-white/[0.05] blur-3xl" />

      {/* The board fragment, behind and further away: smaller type, lower contrast. */}
      <div className="absolute -right-16 top-[26%] w-[300px] rotate-[5deg] rounded-2xl border border-white/10 bg-white/[0.07] p-5 backdrop-blur-sm">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-semibold uppercase tracking-[1.2px] text-white/40">
            Waiting here
          </span>
          <span className="text-[10px] font-semibold tabular-nums text-white/40">4</span>
        </div>
        <div className="mt-3 flex flex-col gap-2.5">
          {[
            ['G004', 'Deepa Nair'],
            ['G005', 'Harpreet Singh'],
            ['G006', 'Lata Mishra'],
          ].map(([token, name]) => (
            <div key={token} className="flex items-center gap-2.5">
              <span className="rounded-md bg-white/10 px-1.5 py-0.5 text-[11px] font-semibold tabular-nums text-white/70">
                {token}
              </span>
              <span className="truncate text-[12px] text-white/50">{name}</span>
            </div>
          ))}
        </div>
      </div>

      {/*
        The token card, at the front and squarely lit. This is the object the whole
        product exists to produce, so it is the one that is fully legible.
      */}
      <div className="absolute right-24 top-[42%] w-[264px] -rotate-[7deg] rounded-[22px] bg-white p-6 shadow-[0_30px_70px_rgba(0,0,0,0.55)]">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-semibold uppercase tracking-[1.3px] text-brand-live-ink">
            In the queue
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-brand-live" />
            <span className="text-[11px] font-semibold text-brand-live-ink">Live</span>
          </span>
        </div>

        <div className="mt-2 text-[42px] font-semibold leading-none tracking-[-2px] tabular-nums text-brand-ink">
          G012
        </div>
        <p className="mt-1.5 text-[12px] text-brand-soft">Dr Anjali Rao</p>

        {/* The strip, at card scale: four seen, three ahead, then you. */}
        <div className="mt-5 flex items-end gap-[4px]">
          {[0, 1, 2, 3].map((i) => (
            <span key={`s${i}`} className="h-[12px] w-[5px] rounded-full bg-brand-ink/75" />
          ))}
          {[0, 1, 2].map((i) => (
            <span key={`w${i}`} className="h-[9px] w-[5px] rounded-full bg-brand-faint" />
          ))}
          <span className="h-[24px] w-[5px] rounded-full bg-brand-ink" />
        </div>

        <div className="mt-3 flex items-center justify-between text-[11.5px] text-brand-muted">
          <span>
            <strong className="font-semibold text-brand-ink">3</strong> ahead
          </span>
          <span className="tabular-nums">11:40 – 12:05</span>
        </div>
      </div>
    </div>
  );
}

/**
 * The real mark. See the note in (console)/nav.tsx - same reason, same component.
 *
 * Links to the site root, not to the console: nobody reading this screen has a
 * session yet, so `/overview` would put them through the middleware and straight
 * back here. This is also the only way out of sign-in for somebody who arrived by
 * mistake and wants to know what the product is.
 */
function Brand({ dark = false }: { dark?: boolean }) {
  return (
    <Link
      href="/"
      className={
        'flex items-center gap-2.5 rounded-md transition-opacity hover:opacity-70 ' +
        (dark ? 'text-white' : 'text-ink')
      }
      aria-label="Kramya home"
    >
      {/* `currentColor` is what makes one component work on both grounds - the panel
          is ink now, the form beside it is still white. */}
      <Mark className="h-[26px] w-[26px] shrink-0" />
      <span className="text-h3 tracking-tight">Kramya</span>
    </Link>
  );
}
