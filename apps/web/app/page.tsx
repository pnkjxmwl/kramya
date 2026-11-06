import type { Metadata } from "next";
import Link from "next/link";
import { Mark } from "../components/mark";
import { Icon } from "../components/icon";
import { ProductPreview } from "./product-preview";
import { MarketingNavigation } from "./marketing-navigation";
import "./marketing.css";

const CONTACT = "pankajsemwal.careers@gmail.com";
const PILOT = `mailto:${CONTACT}?subject=${encodeURIComponent("A Kramya pilot for our clinic")}`;
export const metadata: Metadata = {
  title: "Kramya — A clearer wait. A better clinic day.",
  description:
    "Clinic booking and live queue visibility for patients, reception teams and doctors. Explore Kramya and discuss a clinic pilot.",
  robots: {
    index: process.env.NEXT_PUBLIC_DEPLOYMENT_ENVIRONMENT === "PRODUCTION",
    follow: true,
  },
};
const questions = [
  [
    "What does Kramya do?",
    "Kramya connects patient bookings with the clinic’s queue. Patients can book for themselves or family, follow their token and check the current estimate. Reception manages arrival and walk-ins; doctors manage consultation flow.",
  ],
  [
    "Is the estimated time a fixed appointment?",
    "No. It is a time window that changes with the queue. Doctor availability, consultation length and arrivals can change it. Patients should check the latest update and follow their clinic’s arrival instructions.",
  ],
  [
    "How does a patient confirm a booking?",
    "The current online flow confirms a token after payment is verified. Razorpay checkout, pending payments, cancellations and refunds have separate statuses. Pilot testing uses test payments; live online collection needs the appropriate approved merchant setup.",
  ],
  [
    "Can reception still add walk-ins?",
    "Yes. Staff can add walk-ins and check in patients arriving with an online token. The clinic’s queue policy determines the resulting order; the app does not promise an online booking can bypass people already waiting.",
  ],
  [
    "Can patients download the Android app now?",
    "The native Android app is being prepared for clinic pilots. There is no public Play Store release announced yet. Contact us to discuss access for your clinic and its patients.",
  ],
  [
    "What is involved in a pilot?",
    "We agree the clinic, departments, doctors, session schedules and arrival rules, then walk through the booking and reception workflow with your team. Pilot scope and any commercial terms are discussed directly before onboarding.",
  ],
  [
    "Does Kramya provide medical advice?",
    "No. Your clinic provides medical care. Kramya provides booking and queue information. For urgent care, contact a clinic or local emergency services directly.",
  ],
];
export default function HomePage() {
  return (
    <div className="marketing-site">
      <a className="marketing-skip" href="#main">
        Skip to content
      </a>
      <header className="marketing-header">
        <div className="marketing-nav">
          <Link href="/" aria-label="Kramya home" className="marketing-brand">
            <Mark />
            <span>Kramya</span>
          </Link>
          <nav className="marketing-desktop-nav" aria-label="Main navigation">
            <a href="#product">Product</a>
            <a href="#workflow">For your team</a>
            <a href="#questions">Questions</a>
          </nav>
          <Link href="/login" className="marketing-signin">
            Staff sign in <Icon name="arrow-right" />
          </Link>
          <MarketingNavigation />
        </div>
      </header>
      <main id="main">
        <section className="marketing-hero marketing-container">
          <div className="marketing-hero-copy">
            <p className="marketing-eyebrow">
              <span className="marketing-dot" /> BOOKING & LIVE QUEUES FOR
              CLINICS
            </p>
            <h1>
              A clearer wait.
              <br />
              <span>A better clinic day.</span>
            </h1>
            <p className="marketing-lead">
              Give patients a place in the queue and a clearer sense of when to
              arrive. Keep reception and doctors working from the same picture.
            </p>
            <div className="marketing-actions">
              <a href={PILOT} className="marketing-button">
                Discuss a clinic pilot <Icon name="arrow-right" />
              </a>
              <a href="#product" className="marketing-button secondary">
                Explore the product <Icon name="chevron-down" />
              </a>
            </div>
            <p className="marketing-availability">
              Preparing our first clinic pilots · Native Android + web console
            </p>
          </div>
          <aside
            className="marketing-hero-aside"
            aria-label="The clinic journey"
          >
            <span className="marketing-margin-label">A VISIT, CONNECTED.</span>
            <ol>
              <li>
                <span>01</span>
                <div>
                  <strong>Book before you leave.</strong>
                  <p>A token for the right patient.</p>
                </div>
              </li>
              <li>
                <span>02</span>
                <div>
                  <strong>Know what’s changing.</strong>
                  <p>A queue estimate, with context.</p>
                </div>
              </li>
              <li>
                <span>03</span>
                <div>
                  <strong>Arrive. Check in. Be seen.</strong>
                  <p>One flow through the clinic.</p>
                </div>
              </li>
            </ol>
            <p className="marketing-aside-note">
              Less uncertainty starts with information people can act on.
            </p>
          </aside>
        </section>
        <section
          className="marketing-container marketing-product"
          id="product"
          aria-labelledby="product-heading"
        >
          <div className="marketing-section-top">
            <h2 id="product-heading">One queue. The whole day in view.</h2>
            <span>THE KRAMYA WORKSPACE</span>
          </div>
          <ProductPreview />
          <div className="marketing-product-caption">
            <p>Booking, arrival and consultation, connected.</p>
            <p>Illustrative product views · fictional clinic data</p>
          </div>
        </section>
        <section
          className="marketing-container marketing-workflow"
          id="workflow"
        >
          <div className="marketing-section-heading">
            <p className="marketing-eyebrow">DESIGNED AROUND THE VISIT</p>
            <h2>
              The right view.
              <br />
              For each part of the day.
            </h2>
            <p>
              A patient needs a next step. A receptionist needs the arrivals. A
              doctor needs the person in front of them. Kramya gives each role a
              focused workspace.
            </p>
          </div>
          <div className="marketing-role-grid">
            <article>
              <span className="marketing-role-icon">
                <Icon name="user" />
              </span>
              <span className="marketing-eyebrow">
                01 / PATIENTS & FAMILIES
              </span>
              <h3>A visit you can plan around.</h3>
              <p>
                Find your clinic and doctor, choose who is visiting and keep the
                token close. Check the estimate before travelling and show the
                QR at reception.
              </p>
              <div className="marketing-inline-ticket">
                <span>
                  YOUR TOKEN<strong>A024</strong>
                </span>
                <div>
                  <small>Estimated turn</small>
                  <b>11:40–12:00</b>
                  <small>A moving window, not a fixed time.</small>
                </div>
              </div>
            </article>
            <article>
              <span className="marketing-role-icon">
                <Icon name="users" />
              </span>
              <span className="marketing-eyebrow">02 / RECEPTION</span>
              <h3>An organised arrival desk.</h3>
              <p>
                Find a booking, scan a token and check the patient in. Add
                walk-ins and handle missed turns through the clinic’s rules,
                with a visible record of changes.
              </p>
              <div className="marketing-arrival">
                <span className="marketing-initials">MK</span>
                <div>
                  <b>Meera Kapoor</b>
                  <small>Token A024 · Online booking</small>
                </div>
                <span>
                  <Icon name="check-circle" /> Checked in
                </span>
              </div>
            </article>
            <article>
              <span className="marketing-role-icon">
                <Icon name="stethoscope" />
              </span>
              <span className="marketing-eyebrow">
                03 / DOCTORS & CLINIC TEAMS
              </span>
              <h3>Keep attention on the visit.</h3>
              <p>
                See the current patient and who is next. Call, start and
                complete consultations, and make availability changes clear to
                the rest of the clinic.
              </p>
              <div className="marketing-consultation">
                <span className="marketing-initials apricot">AS</span>
                <div>
                  <b>Anita Shah</b>
                  <small>In consultation · A021</small>
                </div>
                <span className="marketing-current-dot" />
              </div>
            </article>
          </div>
        </section>
        <section className="marketing-time-section">
          <div className="marketing-container marketing-time-grid">
            <div>
              <p className="marketing-eyebrow">CLARITY WHEN PLANS CHANGE</p>
              <h2>
                A queue can change.
                <br />
                The interface should say so.
              </h2>
              <p>
                Some visits take longer. Doctors step away. Phones lose signal.
                A useful estimate comes with its status and a clear next step.
              </p>
              <a className="marketing-text-link" href={PILOT}>
                Talk through your clinic’s workflow <Icon name="arrow-right" />
              </a>
            </div>
            <div className="marketing-time-states">
              <article>
                <span>
                  <Icon name="clock" /> Current estimate
                </span>
                <strong>11:40–12:00</strong>
                <p>Check the latest update before you leave.</p>
              </article>
              <article>
                <span>
                  <Icon name="pause" /> Doctor delayed
                </span>
                <strong>Your token stays with you.</strong>
                <p>The estimate can change. Follow reception’s guidance.</p>
              </article>
              <article>
                <span>
                  <Icon name="wifi-off" /> Connection interrupted
                </span>
                <strong>A saved token. A clear warning.</strong>
                <p>A stale estimate should never look current.</p>
              </article>
              <small>
                Examples show interface behaviour, not a promise of exact
                waiting time.
              </small>
            </div>
          </div>
        </section>
        <section className="marketing-container marketing-operations">
          <p className="marketing-eyebrow">DETAILS THAT MATTER IN A CLINIC</p>
          <div className="marketing-operations-grid">
            <h2>
              Built for the real
              <br />
              work around the queue.
            </h2>
            <div>
              {[
                [
                  "The patient is explicit.",
                  "Separate family profiles keep it clear who a booking belongs to.",
                ],
                [
                  "Arrival is a real step.",
                  "A booking and a checked-in patient are different facts. Both remain visible.",
                ],
                [
                  "Money has its own status.",
                  "Payment pending, booking confirmed and refund processing are shown separately.",
                ],
                [
                  "Access follows the role.",
                  "Clinic membership and permissions govern staff access. Patient accounts see their own visits.",
                ],
              ].map(([title, body], i) => (
                <article key={title}>
                  <span>0{i + 1}</span>
                  <div>
                    <h3>{title}</h3>
                    <p>{body}</p>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>
        <section className="marketing-container marketing-faq" id="questions">
          <div>
            <p className="marketing-eyebrow">A FEW PRACTICAL QUESTIONS</p>
            <h2>Before we meet.</h2>
            <p>
              Something specific to your clinic?
              <br />
              <a href={`mailto:${CONTACT}`}>
                Talk to us <Icon name="arrow-right" />
              </a>
            </p>
          </div>
          <div>
            {questions.map(([q, a]) => (
              <details key={q}>
                <summary>
                  {q}
                  <Icon name="plus" />
                </summary>
                <p>{a}</p>
              </details>
            ))}
          </div>
        </section>
        <section className="marketing-container marketing-final">
          <div>
            <p className="marketing-eyebrow">LET’S START WITH YOUR CLINIC</p>
            <h2>
              A calmer queue starts
              <br />
              with a conversation.
            </h2>
            <p>
              Show us how your OPD works. We’ll walk through where Kramya fits,
              and what a small, supervised pilot would involve.
            </p>
          </div>
          <a href={PILOT} className="marketing-button">
            Discuss a clinic pilot <Icon name="arrow-right" />
          </a>
        </section>
      </main>
      <footer className="marketing-footer marketing-container">
        <div className="marketing-footer-top">
          <Link href="/" className="marketing-brand" aria-label="Kramya home">
            <Mark />
            <span>Kramya</span>
          </Link>
          <p>
            Clinic booking.
            <br />A clearer view of the wait.
          </p>
          <nav aria-label="Footer navigation">
            <Link href="/privacy">Privacy</Link>
            <Link href="/support">Support</Link>
            <Link href="/delete-account">Account deletion</Link>
            <Link href="/login">Staff sign in</Link>
          </nav>
        </div>
        <div className="marketing-footer-bottom">
          <span>© {new Date().getFullYear()} Kramya · Pankaj Semwal</span>
          <span>
            Care is provided by your clinic. Kramya provides booking and queue
            information.
          </span>
        </div>
      </footer>
    </div>
  );
}
