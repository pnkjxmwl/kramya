import type { Metadata, Viewport } from 'next';
import { ConsoleChrome, type NavLink } from '../(console)/nav';
import { HOSPITAL } from './fixtures';

/**
 * The demo shell - the REAL console shell, with fixture props.
 *
 * The first version of this page imitated the console: a hand-rolled header, a
 * hand-rolled table, a tab strip that looked nothing like the rail. It read as a
 * screenshot of a different product, which is the opposite of what a demo is for.
 *
 * This renders `ConsoleChrome` itself - the same component `(console)/layout.tsx`
 * mounts - and the same wrapper classes. What it passes is fake: three links that
 * point inside `/demo`, and a viewer whose email says what it is. Everything visual
 * is therefore correct by construction and stays correct when the console changes,
 * which is the drift problem the fixture approach otherwise has.
 *
 * **The links point at `/demo/...`, not `/queue`.** Real hrefs would send a visitor
 * with no session straight into the middleware and out to /login, which is precisely
 * the experience this page exists to avoid. They are separate routes rather than
 * query params so `isActive` in the rail lights the right one - it compares pathnames.
 *
 * Public because `middleware.ts` excludes anything under `demo`; safe to expose
 * because nothing here touches an API, a session or a tenant. See ./fixtures.ts.
 */

export const metadata: Metadata = {
  title: 'Kramya — see the console, no sign-in',
  description:
    'A working demonstration of the Kramya console with sample data. Call the next patient, check someone in, register a walk-in — no account needed.',
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  themeColor: '#F7FAFC',
  colorScheme: 'light',
};

const DEMO_LINKS: NavLink[] = [
  { href: '/demo', label: 'Overview', icon: 'overview' },
  { href: '/demo/queue', label: 'Queue', icon: 'queue' },
];

export default function DemoLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      {/*
        Said once, at the top, in plain words - and OUTSIDE the console frame, so it
        reads as a label on the demo rather than as a banner the product shows its
        own staff. A demo that looks exactly like the product and does not admit it
        is how a vendor gets distrusted the first time a buyer finds out.
      */}
      <div className="flex flex-wrap items-center justify-center gap-x-2 bg-ink px-6 py-2 text-center text-caption text-white/80">
        <span>Demonstration with sample data — nothing here is saved.</span>
        <a href="/" className="font-medium text-white underline underline-offset-2">
          Back to kramya.app
        </a>
      </div>

      {/* The console layout's own wrapper, copied deliberately rather than imported:
          that file is a server component that calls getMe(), which a signed-out
          visitor cannot do. The structure is what matters and it is three classes. */}
      <div className="min-h-screen bg-canvas lg:flex lg:h-screen lg:overflow-hidden">
        <ConsoleChrome
          links={DEMO_LINKS}
          // The site root, not /overview: a visitor here has no session, and the
          // wordmark is the most-clicked way out of any product tour.
          homeHref="/"
          viewer={{
            email: 'demo@kramya.app',
            hospitalName: HOSPITAL.name,
            role: 'ADMIN',
          }}
        />

        <main className="min-w-0 flex-1 lg:overflow-y-auto">
          <div className="mx-auto w-full max-w-[1440px] px-4 py-5 sm:px-6 lg:px-8 lg:py-7">
            {children}
          </div>
        </main>
      </div>
    </>
  );
}
