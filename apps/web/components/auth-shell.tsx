import Link from 'next/link';
import { Mark } from './mark';
import { HeroScene } from '../app/hero-scene';

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
    <div className="min-h-screen bg-canvas lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(0,540px)]">
      {/* ------------------------------------------------------------------
          The panel. Hidden below `lg` - on a phone it would be three screens
          of scrolling in front of a password field.

          It carries the landing page's hero scene rather than a still copy of
          it. The still version drew two cards pushed half off the panel's edge,
          which read as cropped rather than as bleeding; the live one fits, and it
          makes sign-in and the public site one continuous thing.
      ------------------------------------------------------------------- */}
      <aside className="relative hidden min-h-screen flex-col overflow-hidden bg-brand-ink px-12 py-10 text-white lg:flex">
        <div aria-hidden="true" className="ledger-grid pointer-events-none absolute inset-0" />

        <div className="relative z-10">
          <Brand dark />
        </div>

        <div className="relative z-10 flex flex-1 items-center justify-center py-8">
          <HeroScene />
        </div>

        <div className="relative z-10 max-w-xl">
          <h2 className="text-balance text-[34px] font-semibold leading-[1.1] tracking-[-1.3px]">
            Your clinic, as it is{' '}
            <span className="font-serif text-[1.08em] font-normal italic tracking-[-0.5px]">
              actually
            </span>{' '}
            running.
          </h2>
          <p className="mt-4 max-w-[48ch] text-[15px] leading-[1.6] text-white/55">
            Who is waiting, who is next, and how fast today is really moving — on one board,
            updating as it happens.
          </p>
          <p className="mt-8 flex max-w-[52ch] items-start gap-2 border-t border-white/10 pt-5 text-caption text-white/40">
            <LockIcon />
            This console shows patient names. Access is logged, and you are signed out automatically
            when your session expires.
          </p>
        </div>
      </aside>

      {/* ------------------------------------------------------------------
          The form. White, so it reads as the surface being acted on.
      ------------------------------------------------------------------- */}
      <main className="flex min-h-screen flex-col border-line bg-surface px-6 py-8 sm:px-12 lg:border-l">
        <div className="flex items-center justify-between">
          <span className="lg:hidden">
            <Brand />
          </span>
          <Link
            href="/"
            className="ml-auto inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-caption font-medium text-ink-muted transition-colors hover:bg-sunken hover:text-ink"
          >
            <span aria-hidden="true">←</span> kramya.app
          </Link>
        </div>

        <div className="mx-auto flex w-full max-w-[380px] flex-1 flex-col justify-center py-10">
          <h1 className="text-[30px] font-semibold leading-[1.15] tracking-[-0.8px] text-ink">
            {title}
          </h1>
          <p className="mt-2 text-body-lg text-ink-muted">{intro}</p>

          <div className="mt-8">{children}</div>

          {footer !== undefined && (
            <div className="mt-6 border-t border-line-soft pt-5 text-caption text-ink-muted">
              {footer}
            </div>
          )}
        </div>

        {/* For whoever pressed "Staff sign-in" to see what it is: the demo needs no
            account, so say so here instead of letting them guess a password. */}
        <p className="text-center text-caption text-ink-muted">
          Not on a hospital&rsquo;s staff?{' '}
          <Link
            href="/demo"
            className="font-medium text-ink underline decoration-line-strong underline-offset-4 hover:decoration-ink"
          >
            Explore the live demo
          </Link>
        </p>
      </main>
    </div>
  );
}

function LockIcon() {
  return (
    <svg viewBox="0 0 24 24" className="mt-px h-3.5 w-3.5 shrink-0" aria-hidden="true">
      <path
        d="M6 11h12v9H6zM8.5 11V8a3.5 3.5 0 0 1 7 0v3"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

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
