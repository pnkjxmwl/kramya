import type { Metadata, Viewport } from 'next';
import Link from 'next/link';
import { Mark } from '../components/mark';
import { HeroScene } from './hero-scene';
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
    <div className="landing-root min-h-screen bg-brand-canvas font-sans text-brand-ink antialiased">
      {/*
        The header is sticky and frosted, outside the hero so it can stay with the
        reader down the page. It used to live inside the ink block and scroll away
        with it, which left the long white middle of the page with no way to the
        demo or to sign-in short of scrolling back to the top.
      */}
      <Header />
      <Hero />
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
    <header className="sticky top-0 z-40 border-b border-white/[0.07] bg-brand-ink/80 backdrop-blur-md supports-[backdrop-filter]:bg-brand-ink/70">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
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
            className="hidden rounded-full px-4 py-2 text-[14px] font-medium text-white/65 transition-colors hover:text-white sm:block"
          >
            Live demo
          </Link>
          <Link
            href="/login"
            className="whitespace-nowrap rounded-full px-3 py-2 text-[14px] font-medium text-white/65 transition-colors hover:text-white sm:px-4"
          >
            Staff sign-in
          </Link>
          <a
            href={DEMO_MAILTO}
            className="ml-1 whitespace-nowrap rounded-full bg-white px-3.5 py-2 text-[14px] font-medium text-brand-ink transition-[opacity,transform] hover:opacity-90 active:scale-[0.97] sm:px-4"
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
 * Sentence left, the product running on the right.
 *
 * Earlier versions tried a centred headline over a glowing card (the composition
 * every generated page converges on), a line drawing behind the words, and then the
 * drawing beside them. The drawing said "empty corridor" but not how; the scene on
 * the right now shows how - a desk calling people in and a phone telling one of them
 * to leave home - and the drawing has moved down to the section that makes that claim.
 *
 * **One serif word.** "on time." is set in Instrument Serif italic, and nothing else
 * in the fold is. It is the half of the sentence a hospital is buying, and a single
 * change of voice is how an editorial page puts weight on a phrase without reaching
 * for colour or a gradient. The outlined first line it replaces measured about 2.4:1.
 */
function Hero() {
  return (
    <section className="relative -mt-16 overflow-hidden bg-brand-ink pt-16 text-white">
      <div aria-hidden="true" className="ledger-grid pointer-events-none absolute inset-0" />
      <div className="relative mx-auto max-w-6xl px-6 pb-20 pt-14 sm:pt-20 lg:pb-24">
        <div className="grid items-center gap-y-16 lg:grid-cols-[minmax(0,1.12fr)_minmax(0,0.88fr)] lg:gap-x-8">
          <div>
            <span className="inline-flex items-center gap-2.5 rounded-full border border-white/10 bg-white/[0.04] py-1 pl-2.5 pr-3.5 text-[12px] font-medium text-white/70">
              <span className="live-dot text-brand-live" style={{ height: 6, width: 6 }} />
              Live OPD queues for Indian hospitals
            </span>

            <h1 className="mt-7 text-balance text-[46px] font-semibold leading-[1.02] tracking-[-2px] sm:text-[62px] sm:tracking-[-2.8px]">
              Queue from home.
              <br />
              Walk in{' '}
              <span className="font-serif text-[1.08em] font-normal italic tracking-[-1px]">
                on time.
              </span>
            </h1>

            <p className="mt-7 max-w-[44ch] text-[17px] leading-[1.65] text-white/60">
              Your OPD runs exactly as it does today — same queue, same order, same desk. Patients
              simply stop spending the morning in a corridor to hold their place.
            </p>

            {/* One filled button and one underlined link: the demo is the thing worth
                clicking, so it is the only object. */}
            <div className="mt-9 flex flex-wrap items-center gap-x-7 gap-y-4">
              <Link
                href="/demo"
                className="group inline-flex items-center gap-2 rounded-full bg-white py-3.5 pl-6 pr-5 text-[15px] font-medium text-brand-ink shadow-[0_8px_30px_-8px_rgba(255,255,255,0.35)] transition-[opacity,transform] hover:opacity-90 active:scale-[0.98]"
              >
                See the live console
                <span
                  aria-hidden="true"
                  className="grid h-6 w-6 place-items-center rounded-full bg-brand-ink text-[13px] text-white transition-transform duration-200 group-hover:translate-x-0.5"
                >
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

            {/* Three things true today, not a trust-badge row. */}
            <ul className="mt-10 flex flex-wrap gap-x-6 gap-y-2 text-[13px] text-white/45">
              {['No sign-in for the demo', 'Runs in any browser', 'UPI & cards via Razorpay'].map(
                (fact) => (
                  <li key={fact} className="flex items-center gap-2">
                    <Check />
                    {fact}
                  </li>
                ),
              )}
            </ul>
          </div>

          <HeroScene />
        </div>
      </div>
      {/* The fold ends on a hairline, not a hard colour change. */}
      <div
        aria-hidden="true"
        className="h-px bg-gradient-to-r from-transparent via-white/15 to-transparent"
      />
    </section>
  );
}

function Check() {
  return (
    <svg viewBox="0 0 16 16" className="h-3.5 w-3.5 text-brand-live" aria-hidden="true">
      <path
        d="M3.5 8.5l3 3 6-7"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/* ------------------------------------------------------------------- proof */

/**
 * One idea, at full width - and now the drawing that illustrates it.
 *
 * Deliberately carries no invented statistic. Every "hospitals see a 40% reduction"
 * on a pre-pilot site is a number somebody made up, and a hospital administrator has
 * read a hundred of them. The waiting room drawing itself empties as it scrolls into
 * view: six people sit down, five of them leave. That is the claim, drawn.
 */
function Proof() {
  return (
    <section className="border-b border-brand-line bg-white pb-10 pt-24">
      <Reveal className="mx-auto max-w-3xl px-6 text-center">
        <p className="text-balance text-[30px] font-semibold leading-[1.2] tracking-[-1.1px] sm:text-[40px] sm:tracking-[-1.6px]">
          A token is a promise about{' '}
          <span className="font-serif text-[1.1em] font-normal italic tracking-[-0.5px]">when</span>
          , not a licence to sit in a corridor for three hours.
        </p>
        <p className="mx-auto mt-6 max-w-[54ch] text-[16px] leading-[1.65] text-brand-soft">
          Every OPD already issues numbers. What it cannot issue is a believable time — so everybody
          arrives at opening and waits. Kramya computes that time continuously from the queue as it
          actually moves, and tells the patient when to leave home.
        </p>
      </Reveal>
      <Reveal delay={120} className="mx-auto mt-10 max-w-4xl px-6">
        <div aria-hidden="true" className="h-[200px] text-brand-ink/35 sm:h-[260px]">
          <WaitingRoom />
        </div>
      </Reveal>
    </section>
  );
}

/* ------------------------------------------------------------- how it works */

function HowItWorks() {
  return (
    <section className="mx-auto max-w-6xl px-6 py-28">
      <Reveal>
        <SectionLabel>How it works</SectionLabel>
        <h2 className="mt-4 max-w-[20ch] text-balance text-[34px] font-semibold leading-[1.1] tracking-[-1.3px] sm:text-[46px] sm:tracking-[-2px]">
          Watch a queue{' '}
          <span className="font-serif text-[1.08em] font-normal italic tracking-[-0.5px]">
            actually
          </span>{' '}
          move.
        </h2>
        <p className="mt-5 max-w-[52ch] text-[16px] leading-[1.65] text-brand-soft">
          This is the patient&rsquo;s screen, running. Nothing here is a mockup of a feature we are
          planning — it is the card the app draws, with the numbers the queue engine produces.
        </p>
      </Reveal>

      <Reveal delay={120} className="mt-14">
        <QueueDemo />
      </Reveal>
    </section>
  );
}

/* ---------------------------------------------------------------- for staff */

const STAFF_FEATURES = [
  {
    title: 'One board per session',
    body: 'Who is here, who is booked, who is next. Call, start, complete, skip — every action on one screen.',
    icon: 'M4 5h16M4 12h16M4 19h10',
  },
  {
    title: 'Check-in by QR',
    body: 'Scan the patient’s token at the desk. The code is signed and carries no personal data.',
    icon: 'M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h2v2h-2zM18 18h2v2h-2zM14 18h2',
  },
  {
    title: 'Walk-ins still walk in',
    body: 'Register someone at the counter and they join the same queue — no second system.',
    icon: 'M12 5v14M5 12h14',
  },
  {
    title: 'Emergencies jump, on the record',
    body: 'Priority insertion is one action, and it is audited. Other patients are told the queue changed, never why.',
    icon: 'M12 3l9 16H3zM12 10v4M12 17h.01',
  },
];

function ForStaff() {
  return (
    <section className="border-y border-brand-line bg-white py-28">
      <div className="mx-auto max-w-6xl px-6">
        <div className="grid items-center gap-14 lg:grid-cols-[minmax(0,400px)_minmax(0,1fr)] lg:gap-16">
          <Reveal>
            <SectionLabel>For your staff</SectionLabel>
            <h2 className="mt-4 text-balance text-[34px] font-semibold leading-[1.1] tracking-[-1.3px] sm:text-[44px] sm:tracking-[-1.9px]">
              The desk keeps working the way the desk{' '}
              <span className="font-serif text-[1.08em] font-normal italic tracking-[-0.5px]">
                works.
              </span>
            </h2>
            <p className="mt-5 text-[16px] leading-[1.65] text-brand-soft">
              Reception is not asked to learn a new job. The console runs in a browser, needs no
              install, and is designed to be readable across a counter — the patient being seen is
              the biggest thing on the screen.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Link
                href="/demo/queue"
                className="group inline-flex items-center gap-2 rounded-full bg-brand-ink px-5 py-3 text-[15px] font-medium text-white transition-[opacity,transform] hover:opacity-90 active:scale-[0.98]"
              >
                Try the board
                <span
                  aria-hidden="true"
                  className="transition-transform group-hover:translate-x-0.5"
                >
                  →
                </span>
              </Link>
              <Link
                href="/login"
                className="rounded-full px-5 py-3 text-[15px] font-medium text-brand-soft transition-colors hover:bg-brand-fill hover:text-brand-ink"
              >
                Staff sign-in
              </Link>
            </div>
          </Reveal>

          <Reveal delay={120}>
            <ConsolePreview />
          </Reveal>
        </div>

        <dl className="mt-20 grid gap-x-10 gap-y-10 border-t border-brand-line pt-12 sm:grid-cols-2 lg:grid-cols-4">
          {STAFF_FEATURES.map((it, i) => (
            <Reveal key={it.title} delay={i * 70}>
              <span className="grid h-9 w-9 place-items-center rounded-xl bg-brand-fill text-brand-ink">
                <svg viewBox="0 0 24 24" className="h-[18px] w-[18px]" aria-hidden="true">
                  <path
                    d={it.icon}
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.75"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </span>
              <dt className="mt-4 text-[16px] font-semibold tracking-[-0.3px]">{it.title}</dt>
              <dd className="mt-2 text-[14.5px] leading-[1.6] text-brand-soft">{it.body}</dd>
            </Reveal>
          ))}
        </dl>
      </div>
    </section>
  );
}

/**
 * The board, in miniature, inside a browser frame.
 *
 * Static markup, not a screenshot: a PNG of the console goes stale the day the
 * console changes, and it is blurry on every screen but the one it was taken on. This
 * is drawn with the same shapes the real board uses - the ticket stub for who is in
 * the room, keycap tokens, labelled status pills - so it cannot drift far from it.
 */
function ConsolePreview() {
  const rows = [
    { token: 'G004', name: 'Deepa Nair', via: 'App' },
    { token: 'G005', name: 'Harpreet Singh', via: 'Walk-in' },
    { token: 'G006', name: 'Lata Mishra', via: 'App' },
  ];
  return (
    <div className="overflow-hidden rounded-2xl border border-brand-line bg-brand-canvas shadow-[0_1px_2px_rgba(11,12,13,0.05),0_30px_70px_-30px_rgba(11,12,13,0.35)]">
      {/* Browser chrome */}
      <div className="flex items-center gap-3 border-b border-brand-line bg-white px-4 py-3">
        <span className="flex gap-1.5" aria-hidden="true">
          <span className="h-2.5 w-2.5 rounded-full bg-brand-faint" />
          <span className="h-2.5 w-2.5 rounded-full bg-brand-faint" />
          <span className="h-2.5 w-2.5 rounded-full bg-brand-faint" />
        </span>
        <span className="mx-auto rounded-md bg-brand-canvas px-10 py-1 text-[11px] text-brand-muted">
          kramya.app/queue
        </span>
      </div>

      <div className="grid gap-4 p-4 sm:grid-cols-[minmax(0,200px)_minmax(0,1fr)] sm:p-5">
        {/* The stub */}
        <div className="overflow-hidden rounded-xl border border-brand-ink bg-white">
          <div className="bg-brand-ink px-4 pb-4 pt-3 text-white">
            <div className="flex items-center justify-between">
              <span className="text-[9px] font-semibold uppercase tracking-[1.2px] text-white/50">
                With doctor
              </span>
              <span className="live-dot text-brand-live" style={{ height: 6, width: 6 }} />
            </div>
            <p className="mt-3 text-[36px] font-semibold leading-none tracking-[-1.5px] tabular-nums">
              G003
            </p>
            <p className="mt-1.5 text-[12px] text-white/70">Imtiaz Khan</p>
          </div>
          <div className="p-3">
            <span className="flex h-8 items-center justify-center gap-1.5 rounded-lg bg-brand-ink text-[11px] font-semibold text-white">
              ✓ Complete consultation
            </span>
          </div>
        </div>

        {/* The roster */}
        <div className="rounded-xl border border-brand-line bg-white">
          <div className="flex items-center gap-2 border-b border-brand-line px-4 py-2.5">
            <span className="text-[12px] font-semibold">Waiting here</span>
            <span className="rounded-full bg-brand-fill px-1.5 text-[10px] font-semibold tabular-nums text-brand-soft">
              3
            </span>
          </div>
          <ul className="divide-y divide-brand-line">
            {rows.map((r) => (
              <li key={r.token} className="flex items-center gap-2.5 px-4 py-2.5">
                <span className="rounded-md border border-brand-line px-1.5 py-0.5 text-[10.5px] font-semibold tabular-nums shadow-[inset_0_-1px_0_rgba(10,10,12,0.06)]">
                  {r.token}
                </span>
                <span className="min-w-0 flex-1 truncate text-[12px]">{r.name}</span>
                <span className="hidden text-[10.5px] text-brand-muted sm:inline">{r.via}</span>
                <span className="inline-flex items-center gap-1 rounded-full bg-brand-fill px-1.5 py-0.5 text-[10px] font-medium text-brand-soft">
                  ✓ Checked in
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

/* ----------------------------------------------------------------- fairness */

/**
 * The objection, answered - the first question any hospital asks about a remote
 * queue. Sticky statement on the left, hairline-separated answers on the right: the
 * first is a promise, the second is why the promise holds, and the third is how you
 * would catch us breaking it. That is a sequence, so it is set as one, not as three
 * equal cards.
 */
function Fairness() {
  return (
    <section className="py-28">
      <div className="mx-auto grid max-w-6xl gap-12 px-6 lg:grid-cols-[minmax(0,420px)_minmax(0,1fr)] lg:gap-20">
        <Reveal>
          <div className="lg:sticky lg:top-28">
            <SectionLabel>The first question we get</SectionLabel>
            <h2 className="mt-4 text-balance text-[36px] font-semibold leading-[1.08] tracking-[-1.4px] sm:text-[48px] sm:tracking-[-2px]">
              &ldquo;So people with the app{' '}
              <span className="font-serif text-[1.08em] font-normal italic tracking-[-0.5px]">
                skip the line?
              </span>
              &rdquo;
            </h2>
            <p className="mt-6 max-w-[42ch] text-[17px] leading-[1.65] text-brand-soft">
              No. Booking from home buys you the right to wait somewhere else — never an earlier
              turn. Here is what that rests on.
            </p>
          </div>
        </Reveal>

        <dl className="flex flex-col">
          {FACTS.map((f, i) => (
            <Reveal key={f.title} delay={i * 90}>
              <div className="border-t border-brand-line py-8 first:border-t-0 first:pt-0 lg:py-10">
                <dt className="flex items-baseline gap-4">
                  <span className="font-serif text-[22px] italic tabular-nums text-brand-faint">
                    {String(i + 1).padStart(2, '0')}
                  </span>
                  <span className="text-[22px] font-semibold tracking-[-0.6px]">{f.title}</span>
                </dt>
                <dd className="mt-3 pl-[42px] text-[16px] leading-[1.65] text-brand-soft">
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

/* -------------------------------------------------------------- patient app */

function PatientApp() {
  return (
    <section className="relative overflow-hidden bg-brand-ink py-28 text-white">
      <div
        aria-hidden="true"
        className="ledger-grid pointer-events-none absolute inset-0 opacity-70"
      />
      <div className="relative mx-auto max-w-3xl px-6 text-center">
        <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl border border-white/10 bg-white/[0.05]">
          <Mark className="h-7 w-7 text-white" />
        </span>
        <h2 className="mt-8 text-balance text-[36px] font-semibold leading-[1.1] tracking-[-1.4px] sm:text-[48px] sm:tracking-[-2px]">
          The patient app is{' '}
          <span className="font-serif text-[1.08em] font-normal italic tracking-[-0.5px]">
            coming.
          </span>
        </h2>
        <p className="mx-auto mt-5 max-w-[50ch] text-[16px] leading-[1.65] text-white/60">
          Kramya is in pilot with its first hospitals. The iOS and Android apps arrive with them —
          if you would like to know when, tell us where to write.
        </p>

        {/*
          A mailto, not a form. "Notify me" needs somewhere to put the address, and
          the API has no waitlist table or endpoint. A styled input that quietly
          dropped what people typed would be the worst option on this page.
        */}
        <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
          <a
            href={WAITLIST_MAILTO}
            className="inline-flex rounded-full bg-white px-6 py-3.5 text-[15px] font-medium text-brand-ink transition-[opacity,transform] hover:opacity-90 active:scale-[0.98]"
          >
            Tell me when it launches
          </a>
          <Link
            href="/demo"
            className="inline-flex rounded-full px-6 py-3.5 text-[15px] font-medium text-white/70 ring-1 ring-inset ring-white/15 transition-colors hover:bg-white/[0.06] hover:text-white"
          >
            Explore the demo
          </Link>
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ footer */

function Footer() {
  return (
    <footer className="bg-brand-canvas">
      <div className="mx-auto grid max-w-6xl gap-10 px-6 py-14 sm:grid-cols-[minmax(0,1fr)_auto_auto] sm:gap-16">
        <div>
          <div className="flex items-center gap-2.5">
            <Mark className="h-5 w-5" />
            <span className="text-[16px] font-semibold tracking-[-0.3px]">Kramya</span>
          </div>
          <p className="mt-3 max-w-[34ch] text-[14px] leading-[1.6] text-brand-soft">
            Live OPD queues for Indian hospitals. Patients wait at home and arrive when their turn
            is near.
          </p>
          {/* Where the name comes from - said once, quietly, at the bottom. */}
          <p className="mt-5 text-[13px] text-brand-muted">
            <span lang="sa" className="text-brand-soft">
              क्रम
            </span>{' '}
            <span className="font-serif italic">krama</span> — order, sequence.
          </p>
        </div>
        <FooterColumn
          title="Product"
          links={[
            { href: '/demo', label: 'Live demo' },
            { href: '/demo/queue', label: 'Queue board' },
            { href: '/login', label: 'Staff sign-in' },
          ]}
        />
        <FooterColumn
          title="Company"
          links={[
            { href: DEMO_MAILTO, label: 'Book a demo' },
            { href: `mailto:${CONTACT}`, label: CONTACT },
          ]}
        />
      </div>
      <div className="border-t border-brand-line">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-6 py-6 text-[13px] text-brand-muted">
          <span>© {new Date().getFullYear()} Kramya</span>
          <span>Built for OPDs in India</span>
        </div>
      </div>
    </footer>
  );
}

function FooterColumn({
  title,
  links,
}: {
  title: string;
  links: { href: string; label: string }[];
}) {
  return (
    <div>
      <p className="text-[11px] font-semibold uppercase tracking-[1.4px] text-brand-muted">
        {title}
      </p>
      <ul className="mt-4 flex flex-col gap-2.5">
        {links.map((l) => (
          <li key={l.label}>
            {l.href.startsWith('/') ? (
              <Link
                href={l.href}
                className="text-[14px] text-brand-soft transition-colors hover:text-brand-ink"
              >
                {l.label}
              </Link>
            ) : (
              <a
                href={l.href}
                className="text-[14px] text-brand-soft transition-colors hover:text-brand-ink"
              >
                {l.label}
              </a>
            )}
          </li>
        ))}
      </ul>
    </div>
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
