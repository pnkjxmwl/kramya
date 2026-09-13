import type { Metadata, Viewport } from 'next';
import Link from 'next/link';
import { Mark } from '../components/mark';
import { QueueDemo, Reveal } from './reveal';

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
  title: 'Kramya — the queue your patients wait in from home',
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
    <div className="min-h-screen bg-brand-canvas font-sans text-brand-ink antialiased">
      <Header />
      <main>
        <Hero />
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
    <header className="sticky top-0 z-50 border-b border-brand-line bg-brand-canvas/95 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
        <Link href="/" className="flex items-center gap-2.5" aria-label="Kramya home">
          <Mark />
          <span className="text-[17px] font-semibold tracking-[-0.4px]">Kramya</span>
        </Link>
        <nav className="flex items-center gap-1.5">
          <Link
            href="/demo"
            className="hidden rounded-xl px-4 py-2 text-[14px] font-medium text-brand-soft transition-colors hover:bg-brand-fill hover:text-brand-ink sm:block"
          >
            Demo
          </Link>
          <Link
            href="/login"
            className="rounded-xl px-4 py-2 text-[14px] font-medium text-brand-soft transition-colors hover:bg-brand-fill hover:text-brand-ink"
          >
            Staff sign-in
          </Link>
          <a
            href={DEMO_MAILTO}
            className="rounded-xl bg-brand-ink px-4 py-2 text-[14px] font-medium text-white transition-opacity hover:opacity-85"
          >
            Book a demo
          </a>
        </nav>
      </div>
    </header>
  );
}

/* -------------------------------------------------------------------- hero */

function Hero() {
  return (
    <section className="mx-auto max-w-6xl px-6 pb-24 pt-20 sm:pt-28">
      <div className="grid items-center gap-16 lg:grid-cols-[minmax(0,1fr)_minmax(0,420px)]">
        <div>
          <span className="inline-flex items-center gap-2 rounded-full bg-brand-fill px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[1.2px] text-brand-soft">
            OPD queue management
          </span>

          {/* The whole pitch, in one sentence, at a size that admits it is the pitch. */}
          <h1 className="mt-7 max-w-[15ch] text-balance text-[44px] font-semibold leading-[1.04] tracking-[-1.8px] sm:text-[60px] sm:tracking-[-2.6px]">
            Your waiting room, mostly empty.
          </h1>

          <p className="mt-6 max-w-[52ch] text-[17px] leading-[1.6] text-brand-soft">
            Patients join your OPD queue from home, watch their place move in real time,
            and arrive when their turn is near. The queue still runs exactly as your
            reception runs it — there is just nobody sitting in it.
          </p>

          {/* The demo leads, not the mailto. Someone who can see the board working in
              one click is a better lead than someone asked to compose an email first. */}
          <div className="mt-9 flex flex-wrap items-center gap-3">
            <Link
              href="/demo"
              className="rounded-2xl bg-brand-ink px-6 py-3.5 text-[15px] font-medium text-white transition-opacity hover:opacity-85"
            >
              See the console
            </Link>
            <a
              href={DEMO_MAILTO}
              className="rounded-2xl bg-brand-fill px-6 py-3.5 text-[15px] font-medium text-brand-ink transition-colors hover:bg-brand-line"
            >
              Book a demo
            </a>
          </div>

          <p className="mt-5 text-[13px] text-brand-muted">
            No sign-in needed — it runs on sample data. Onboarding is white-glove: we set
            your departments, doctors and schedules up with you.
          </p>
        </div>

        <QueueCard />
      </div>
    </section>
  );
}

/**
 * The hero image, which is not an image.
 *
 * This is the app's own token card - the bar strip, the two honest counts, the ETA
 * window - rendered in HTML at the size a phone draws it. Every number on it is one
 * the product genuinely produces; none is invented for the page.
 */
function QueueCard() {
  return (
    <div className="relative">
      <div className="rounded-[28px] bg-white p-7 shadow-[0_1px_2px_rgba(11,12,13,0.05),0_24px_60px_rgba(11,12,13,0.10)]">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-semibold uppercase tracking-[1.4px] text-brand-live-ink">
            You&rsquo;re in the queue
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-brand-live" />
            <span className="text-[12px] font-semibold text-brand-live-ink">Live</span>
          </span>
        </div>

        <div className="mt-3 text-[56px] font-semibold leading-none tracking-[-2.8px] tabular-nums">
          G012
        </div>
        <p className="mt-2 text-[14px] text-brand-soft">Aarav · Dr Nikhil Save · General Medicine</p>

        {/* Four seen, three ahead, then you. The light-bar count always equals the
            stated number - that agreement is the whole reason the strip is readable
            at a glance instead of being a sparkline. */}
        <div className="mt-7 flex items-end gap-[5px]" aria-hidden="true">
          {[0, 1, 2, 3].map((i) => (
            <span key={`seen-${i}`} className="h-[15px] w-[6px] rounded-full bg-brand-ink/80" />
          ))}
          {[0, 1, 2].map((i) => (
            <span key={`wait-${i}`} className="h-[11px] w-[6px] rounded-full bg-brand-faint" />
          ))}
          <span className="h-[30px] w-[6px] rounded-full bg-brand-ink" />
        </div>

        <div className="mt-3.5 flex items-center justify-between text-[13px] text-brand-muted">
          <span>
            <strong className="font-semibold text-brand-ink">3</strong> ahead of you
          </span>
          <span>
            Seen <strong className="font-semibold text-brand-ink">11:40 – 12:05</strong>
          </span>
        </div>

        <div className="mt-6 space-y-0 border-t border-brand-line pt-1">
          <Row label="Now serving" value="G009" />
          <Row label="Reach hospital by" value="11:30 AM" />
        </div>
      </div>

      <p className="mt-4 text-center text-[12px] text-brand-muted">
        What a patient sees while they wait at home.
      </p>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between border-b border-brand-line py-3 last:border-0 text-[14px]">
      <span className="text-brand-muted">{label}</span>
      <span className="font-medium tabular-nums">{value}</span>
    </div>
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
function Fairness() {
  return (
    <section className="mx-auto max-w-6xl px-6 py-24">
      <Reveal>
        <SectionLabel>The part that matters</SectionLabel>
        <h2 className="mt-4 max-w-[22ch] text-balance text-[32px] font-semibold leading-[1.15] tracking-[-1.2px] sm:text-[42px] sm:tracking-[-1.8px]">
          Nobody skips the line.
        </h2>
      </Reveal>

      <div className="mt-12 grid gap-9 sm:grid-cols-3">
        {FACTS.map((f, i) => (
          <Reveal key={f.title} delay={i * 90}>
            <Fact title={f.title} body={f.body} />
          </Reveal>
        ))}
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

function Fact({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-3xl border border-brand-line bg-white p-7">
      <h3 className="text-[18px] font-semibold tracking-[-0.4px]">{title}</h3>
      <p className="mt-3 text-[15px] leading-[1.6] text-brand-soft">{body}</p>
    </div>
  );
}

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
