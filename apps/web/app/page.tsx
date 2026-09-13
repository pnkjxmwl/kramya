import type { Metadata, Viewport } from 'next';
import Link from 'next/link';
import { Mark } from '../components/mark';
import { QueueDemo, Reveal } from './reveal';
import { WaitingRoom } from './waiting-room';

/**
 * The public landing page - the only page on this domain a signed-out visitor sees.
 *
 * **It sells to hospitals, not to patients.** A hospital administrator signs the
 * contract; the patient downloads an app. Those are two different pages, and trying
 * to write one that does both produces a page that persuades neither. The patient
 * app gets one honest section near the end and nothing more.
 *
 * **It is on the brand palette, and so is the console now.** Kramya is the ink system
 * the patient app was redrawn onto and the black K of the logo; the console behind
 * /login moved onto the same palette in the same pass. It keeps its own tighter type
 * scale and spacing, which is a deliberate divergence recorded in docs/Design.md 3 -
 * a receptionist reads it on a monitor for a whole shift, and the phone's roomier
 * scale would waste a third of the screen.
 *
 * **The hero is the product, drawn.** Every queue company's site opens on a stock
 * photograph of a smiling receptionist. This one opens on an actual queue: the same
 * bar strip the app draws, the same two honest numbers, the same token. It is the one
 * image no competitor can copy without building the thing first.
 *
 * **Server component except for the motion.** `./reveal` is the only `'use client'`
 * boundary, and it exists for two browser APIs - IntersectionObserver and
 * matchMedia - not for a framework. Everything above renders on the server and ships
 * no JavaScript; the CTAs are anchors, and the waitlist is a mailto for the reason
 * given at its call site.
 */

export const metadata: Metadata = {
  // No `title` - the root layout's plain "Kramya" governs every tab. Setting one
  // here is what would put a suffix back in the tab bar.
  description:
    'Kramya turns a hospital OPD into a live queue patients can join remotely. They watch their place move and arrive when their turn is near, so your waiting room stops being the waiting room.',
  // Overrides the root layout's `index: false`. That default is right for the
  // console, which holds patient names and has no business in a search index; this
  // page is the one thing on the domain that does.
  robots: { index: true, follow: true },
};

/**
 * The brand canvas, not the console's.
 *
 * The root layout paints `#F7FAFC` so a tablet's browser chrome matches the console
 * rail. On this page that is a visible seam above a `#F7F7F8` header, which is
 * exactly the tell the root layout's own comment is trying to avoid.
 */
export const viewport: Viewport = {
  themeColor: '#F7F7F8',
  colorScheme: 'light',
};

export default function Landing() {
  return (
    // `landing-root` is not styled itself - it is the hook `html:has(.landing-root)`
    // in globals.css uses to drop the scrollbar on this page and nowhere else.
    <div className="landing-root min-h-screen bg-brand-canvas font-sans text-brand-ink antialiased">
      {/*
        Header and hero share one ink block.

        The page used to open on the same pale canvas as everything below it, so the
        first screenful had no more presence than the footer. Opening dark and landing
        on light is the oldest trick in a premium marketing page for a reason: the fold
        becomes an object rather than the top of a scroll, and it carries the same
        language as the sign-in screen, which is the next thing a hospital sees.
      */}
      <div className="bg-brand-ink">
        <Header />
        <Hero />
      </div>
      <main>
        <Proof />
        <HowItWorks />
        <ForStaff />
        <Fairness />
        <PatientApp />
      </main>
      <Footer />
    </div>
  );
}

/* ------------------------------------------------------------------ header */

function Header() {
  return (
    // Not sticky. A dark bar following you down a light page is a strip of the hero
    // that refused to leave; the way back up is the browser's own scroll.
    <header className="relative z-20">
      <div className="mx-auto flex h-[72px] max-w-6xl items-center justify-between px-6">
        <Link
          href="/"
          className="flex items-center gap-2.5 text-white transition-opacity hover:opacity-75"
          aria-label="Kramya home"
        >
          <Mark />
          <span className="text-[17px] font-semibold tracking-[-0.4px]">Kramya</span>
        </Link>
        <nav className="flex items-center gap-1">
          <Link
            href="/demo"
            className="hidden rounded-xl px-4 py-2 text-[14px] font-medium text-white/70 transition-colors hover:bg-white/10 hover:text-white sm:block"
          >
            Demo
          </Link>
          <Link
            href="/login"
            className="rounded-xl px-4 py-2 text-[14px] font-medium text-white/70 transition-colors hover:bg-white/10 hover:text-white"
          >
            Staff sign-in
          </Link>
          <a
            href={DEMO_MAILTO}
            className="ml-1 rounded-xl bg-white px-4 py-2 text-[14px] font-medium text-brand-ink transition-opacity hover:opacity-85"
          >
            Book a demo
          </a>
        </nav>
      </div>
    </header>
  );
}

/* -------------------------------------------------------------------- hero */

/**
 * Sentence left, room right.
 *
 * Four folds got tried. Copy beside a product screenshot; a centred headline over a
 * glowing card - the composition every AI-assisted page converges on; then the drawing
 * beneath the words, and behind them. The last two failed the same way: a background
 * has to be faint enough to read through, which makes it a texture, and it gets
 * covered by the very sentence it sits under.
 *
 * So it is a column of its own. What keeps this from being the first, generic version
 * is what is IN the right-hand column - not a screenshot of a dashboard, but a room
 * that draws itself and empties while you read the claim that it will.
 *
 * **The headline no longer describes the picture.** "Your waiting room, mostly empty"
 * said in words exactly what the chairs say in lines, so one of them was redundant.
 * The drawing shows the room; the sentence says where those people went.
 */
function Hero() {
  return (
    <section className="relative overflow-hidden">
      <div className="mx-auto max-w-6xl px-6 pb-16 pt-14 sm:pt-20">
        {/*
          Words left, room right - and the room is an ELEMENT now, not a background.

          It spent two versions as a layer behind the text, which meant it had to be
          faint enough to read through and kept getting covered by the very words it
          was under. Beside the sentence instead of beneath it, it needs no apology:
          at 50% it is a drawing somebody is meant to look at.

          The right column is the only thing in the fold that bleeds. Cutting the room
          off at the viewport edge says it continues, which is the point - it is a
          room, not a picture of one.
        */}
        <div className="grid items-center gap-y-14 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)] lg:gap-x-12">
          <div>
            {/* A rule and a label, not a pill. A bordered rounded-full chip is the
                default badge every page opens with; a hairline running out of the
                text is the same information set like an editorial standfirst - and
                it rhymes with the line art rather than fighting it. */}
            <span className="flex items-center gap-3 text-[11px] font-semibold uppercase tracking-[1.6px] text-white/45">
              <span aria-hidden="true" className="h-px w-9 bg-white/25" />
              <span className="h-1.5 w-1.5 rounded-full bg-brand-live" />
              OPD queue management
            </span>

            {/*
              Two sentences, two lines, no cleverness.

              The drawing carries the feeling - a room emptying - so the words do not
              have to. Earlier versions tried: "Your waiting room, mostly empty" said
              in words what the chairs already say in lines, and "The waiting happens
              at home" was a turn of phrase where a plain fact reads better.

              The second line is the half a hospital cares about. "Queue from home" on
              its own is a patient convenience; "walk in on time" is the thing that
              empties a corridor, so it gets the white.
            */}
            <h1 className="mt-7 text-balance text-[44px] font-semibold leading-[1.04] tracking-[-2px] text-white sm:text-[64px] sm:tracking-[-3px]">
              <span className="type-outline">Queue from home.</span>
              <br />
              Walk in on time.
            </h1>

            <p className="mt-7 max-w-[44ch] text-[17px] leading-[1.65] text-white/60">
              Your OPD runs exactly as it does today — same queue, same order, same
              desk. Patients simply stop spending the morning in a corridor to hold
              their place.
            </p>

            {/* The demo leads, not the mailto: somebody who can see the board working
                in one click is a better lead than somebody asked to write an email. */}
            {/*
              One filled button and one underlined link, not two buttons.

              Two equally-weighted pills is the default, and it makes a visitor choose
              between them before they know what either does. The demo is the thing
              worth clicking, so it is the only object; "Book a demo" is a sentence you
              can read past. The arrow moves on hover - the one piece of motion in the
              fold that responds to a person rather than a timer.
            */}
            <div className="mt-9 flex flex-wrap items-center gap-x-8 gap-y-4">
              <Link
                href="/demo"
                className="group inline-flex items-center gap-2 rounded-full bg-white px-7 py-3.5 text-[15px] font-medium text-brand-ink transition-opacity hover:opacity-85"
              >
                See the console
                <span aria-hidden="true" className="transition-transform group-hover:translate-x-0.5">
                  →
                </span>
              </Link>
              <a
                href={DEMO_MAILTO}
                className="text-[15px] font-medium text-white/70 underline decoration-white/25 underline-offset-[6px] transition-colors hover:text-white hover:decoration-white/60"
              >
                Book a demo
              </a>
            </div>

            <p className="mt-6 text-[13px] text-white/35">
              No sign-in needed — the demo runs on sample data.
            </p>
          </div>

          <div
            aria-hidden="true"
            className="h-[240px] text-white/50 sm:h-[300px] lg:-mr-[16vw] lg:h-[360px]"
          >
            <WaitingRoom />
          </div>
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------- proof */

/**
 * One idea, at full width, with nothing beside it to dilute it.
 *
 * Deliberately carries no invented statistic. Every "hospitals see a 40% reduction"
 * on a pre-pilot site is a number somebody made up, and a hospital administrator has
 * read a hundred of them. What we can say without inventing anything is what the
 * product does differently, so that is what it says.
 */
function Proof() {
  return (
    <section className="border-y border-brand-line bg-white py-24">
      <Reveal className="mx-auto max-w-3xl px-6 text-center">
        <p className="text-balance text-[28px] font-semibold leading-[1.25] tracking-[-1px] sm:text-[36px] sm:tracking-[-1.4px]">
          A token is a promise about <em className="not-italic text-brand-muted">when</em>, not a
          licence to sit in a corridor for three hours.
        </p>
        <p className="mx-auto mt-6 max-w-[54ch] text-[16px] leading-[1.65] text-brand-soft">
          Every OPD already issues numbers. What it cannot issue is a believable time — so
          everybody arrives at opening and waits. Kramya computes that time continuously
          from the queue as it actually moves, and tells the patient when to leave home.
        </p>
      </Reveal>
    </section>
  );
}

/* ------------------------------------------------------------- how it works */

function HowItWorks() {
  return (
    <section className="mx-auto max-w-6xl px-6 py-24">
      <Reveal>
        <SectionLabel>How it works</SectionLabel>
        <h2 className="mt-4 max-w-[20ch] text-balance text-[32px] font-semibold leading-[1.15] tracking-[-1.2px] sm:text-[42px] sm:tracking-[-1.8px]">
          Watch a queue actually move.
        </h2>
        <p className="mt-5 max-w-[52ch] text-[16px] leading-[1.65] text-brand-soft">
          This is the patient&rsquo;s screen, running. Nothing here is a mockup of a
          feature we are planning — it is the card the app draws, with the numbers the
          queue engine produces.
        </p>
      </Reveal>

      {/* The demonstration replaces what used to be three paragraphs describing it.
          A queue is a thing that moves, and three static bullets about movement is
          the one format guaranteed not to convey it. */}
      <Reveal delay={120} className="mt-14">
        <QueueDemo />
      </Reveal>
    </section>
  );
}

/* ---------------------------------------------------------------- for staff */

function ForStaff() {
  const items = [
    {
      title: 'One board per session',
      body: 'Who is here, who is booked, who is next. Call, start, complete, skip — every action on one screen.',
    },
    {
      title: 'Check-in by QR',
      body: 'Scan the patient’s token at the desk. The code is signed and carries no personal data. Camera declined? Search by name or number.',
    },
    {
      title: 'Walk-ins still walk in',
      body: 'Register someone at the counter and they take their place in the same queue — no second system, no parallel list.',
    },
    {
      title: 'Emergencies jump, on the record',
      body: 'Priority insertion is one action and it is audited. Other patients are told the queue changed, never why.',
    },
  ];

  return (
    <section className="border-y border-brand-line bg-white py-24">
      <div className="mx-auto max-w-6xl px-6">
        <div className="grid gap-14 lg:grid-cols-[minmax(0,380px)_minmax(0,1fr)]">
          <Reveal>
            <SectionLabel>For your staff</SectionLabel>
            <h2 className="mt-4 text-balance text-[32px] font-semibold leading-[1.15] tracking-[-1.2px] sm:text-[40px] sm:tracking-[-1.6px]">
              The desk keeps working the way the desk works.
            </h2>
            <p className="mt-5 text-[16px] leading-[1.65] text-brand-soft">
              Reception is not asked to learn a new job. The console runs in a browser,
              needs no install, and is designed to be readable across a counter.
            </p>
            <Link
              href="/login"
              className="mt-7 inline-flex rounded-2xl bg-brand-fill px-5 py-3 text-[15px] font-medium transition-colors hover:bg-brand-line"
            >
              Staff sign-in
            </Link>
          </Reveal>

          <dl className="grid gap-x-10 gap-y-9 sm:grid-cols-2">
            {items.map((it, i) => (
              <Reveal key={it.title} delay={i * 70}>
                <dt className="text-[17px] font-semibold tracking-[-0.4px]">{it.title}</dt>
                <dd className="mt-2 text-[15px] leading-[1.6] text-brand-soft">{it.body}</dd>
              </Reveal>
            ))}
          </dl>
        </div>
      </div>
    </section>
  );
}

/* ----------------------------------------------------------------- fairness */

/**
 * The objection section.
 *
 * The first question any hospital asks about a remote queue is "so people with the
 * app skip the line?". Answering it early, in the product's own terms, is worth more
 * than another feature grid.
 */
/**
 * The objection, answered - and not as three cards in a row.
 *
 * It was a generic eyebrow ("The part that matters" - which says nothing) over three
 * equal bordered boxes, which is the layout every SaaS page uses for every trio of
 * anything. Three boxes side by side also flatten these into peers, and they are not:
 * the first is a promise, the second is why the promise holds, and the third is how
 * you would catch us breaking it. That is a sequence, so it is set as one.
 *
 * Sticky statement on the left, hairline-separated answers on the right. No boxes -
 * on a page that already has a token card and a board, three more rounded rectangles
 * is the point at which everything starts looking like a card.
 */
function Fairness() {
  return (
    <section className="border-y border-brand-line bg-white py-24">
      <div className="mx-auto grid max-w-6xl gap-12 px-6 lg:grid-cols-[minmax(0,420px)_minmax(0,1fr)] lg:gap-20">
        <Reveal>
          <div className="lg:sticky lg:top-16">
            <SectionLabel>The first question we get</SectionLabel>
            <h2 className="mt-4 text-balance text-[34px] font-semibold leading-[1.1] tracking-[-1.4px] sm:text-[46px] sm:tracking-[-2px]">
              &ldquo;So people with the app skip the line?&rdquo;
            </h2>
            <p className="mt-6 max-w-[42ch] text-[17px] leading-[1.65] text-brand-soft">
              No. Booking from home buys you the right to wait somewhere else — never an
              earlier turn. Here is what that rests on.
            </p>
          </div>
        </Reveal>

        <dl className="flex flex-col">
          {FACTS.map((f, i) => (
            <Reveal key={f.title} delay={i * 90}>
              <div className="border-t border-brand-line py-8 first:border-t-0 first:pt-0 lg:py-9">
                <dt className="flex items-baseline gap-4">
                  <span className="text-[12px] font-semibold tabular-nums tracking-[1px] text-brand-faint">
                    {String(i + 1).padStart(2, '0')}
                  </span>
                  <span className="text-[21px] font-semibold tracking-[-0.6px]">{f.title}</span>
                </dt>
                <dd className="mt-3 pl-[28px] text-[16px] leading-[1.65] text-brand-soft">
                  {f.body}
                </dd>
              </div>
            </Reveal>
          ))}
        </dl>
      </div>
    </section>
  );
}

const FACTS = [
  {
    title: 'One queue, not two',
    body: 'Online bookings and walk-ins sit in the same line, in token order. Booking from home buys you the right to wait somewhere else — not an earlier turn.',
  },
  {
    title: 'The server decides, always',
    body: 'No phone and no browser can change a queue. Every call, check-in and cancellation is a command the backend validates, inside a lock, or refuses.',
  },
  {
    title: 'Every change is on the record',
    body: 'Priority insertions, no-shows and refunds all write an audit entry with who did it and why. Accountability is a feature, not a log file.',
  },
];

/* `Fact` is gone with the card layout it existed for - the answers are a definition
   list now, set inline in Fairness, because a <dt>/<dd> pair is what they are. */

/* -------------------------------------------------------------- patient app */

function PatientApp() {
  return (
    <section className="border-t border-brand-line bg-brand-ink py-24 text-white">
      <div className="mx-auto max-w-3xl px-6 text-center">
        <Mark className="mx-auto h-8 w-8 text-white" />
        <h2 className="mt-7 text-balance text-[32px] font-semibold leading-[1.15] tracking-[-1.2px] sm:text-[40px] sm:tracking-[-1.6px]">
          The patient app is coming.
        </h2>
        <p className="mx-auto mt-5 max-w-[50ch] text-[16px] leading-[1.65] text-white/65">
          Kramya is in pilot with its first hospitals. The iOS and Android apps arrive with
          them — if you would like to know when, tell us where to write.
        </p>

        {/*
          A mailto, not a form.

          "Notify me" needs somewhere to put the address, and the API has no waitlist
          table or endpoint. A styled input that quietly dropped what people typed
          would be the worst option on this page - so until that endpoint exists, the
          button opens a real message to a real person, which loses nothing.

          Upgrading it is a small, separate job: one Prisma model, one public rate-
          limited POST, one server action here.
        */}
        <a
          href={WAITLIST_MAILTO}
          className="mt-9 inline-flex rounded-2xl bg-white px-6 py-3.5 text-[15px] font-medium text-brand-ink transition-opacity hover:opacity-90"
        >
          Tell me when it launches
        </a>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ footer */

function Footer() {
  return (
    <footer className="border-t border-brand-line bg-brand-canvas py-12">
      <div className="mx-auto flex max-w-6xl flex-col items-start justify-between gap-6 px-6 sm:flex-row sm:items-center">
        <div className="flex items-center gap-2.5">
          <Mark className="h-[18px] w-[18px]" />
          <span className="text-[14px] font-semibold tracking-[-0.3px]">Kramya</span>
          <span className="text-[13px] text-brand-muted">
            · OPD queues for Indian hospitals
          </span>
        </div>
        <nav className="flex items-center gap-6 text-[14px] text-brand-soft">
          <Link href="/login" className="transition-colors hover:text-brand-ink">
            Staff sign-in
          </Link>
          <a href={DEMO_MAILTO} className="transition-colors hover:text-brand-ink">
            Book a demo
          </a>
        </nav>
      </div>
    </footer>
  );
}

/* ------------------------------------------------------------------- utils */

function SectionLabel({ children }: { children: string }) {
  return (
    <span className="text-[11px] font-semibold uppercase tracking-[1.4px] text-brand-muted">
      {children}
    </span>
  );
}

/*
  One address, two subjects. A placeholder that has to be replaced before this page is
  pointed at a real domain - which is why it is a named constant at the bottom of the
  file rather than inlined into four anchors.
*/
const CONTACT = 'hello@kramya.app';
const DEMO_MAILTO = `mailto:${CONTACT}?subject=${encodeURIComponent('Kramya demo for our hospital')}`;
const WAITLIST_MAILTO = `mailto:${CONTACT}?subject=${encodeURIComponent('Tell me when the Kramya app launches')}`;
