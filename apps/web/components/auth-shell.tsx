import Link from "next/link";
import { Mark } from "./mark";
import { Icon } from "./icon";

/** Shared staff sign-in/invitation shell. Real forms are passed through unchanged. */
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
      <aside className="hidden flex-col justify-between border-r border-line bg-sunken p-12 lg:flex">
        <Link
          href="/"
          className="inline-flex w-fit items-center gap-1 font-display text-[28px] font-semibold tracking-[-.05em]"
          aria-label="Kramya home"
        >
          <Mark className="h-10 w-10 text-primary" />
          Kramya
        </Link>
        <div className="max-w-lg py-20">
          <p className="text-eyebrow uppercase text-ink-muted">
            Your clinic workspace
          </p>
          <h2 className="mt-6 font-display text-[52px] font-semibold leading-[1.04] tracking-[-.05em] text-ink">
            The clinic day,
            <br />
            <span className="text-primary">in clear view.</span>
          </h2>
          <p className="mt-6 max-w-[40ch] text-body-lg leading-7 text-ink-muted">
            Bookings, arrivals and consultations, connected in one place. Sign
            in to your clinic’s workspace to get started.
          </p>
          <div className="mt-10 flex items-center gap-4 border-t border-line pt-6">
            <span className="grid h-12 w-12 place-items-center rounded-control bg-brand-100 text-primary">
              <Icon name="building" className="h-6 w-6" />
            </span>
            <div>
              <p className="text-label text-ink">
                The right clinic. The right access.
              </p>
              <p className="mt-1 text-caption text-ink-muted">
                Your membership determines the workspace you can open.
              </p>
            </div>
          </div>
        </div>
        <p className="max-w-[55ch] text-caption leading-6 text-ink-muted">
          For authorised clinic teams. Need access? Contact your clinic
          administrator. Patient accounts use the Android app.
        </p>
      </aside>
      <main className="flex min-h-screen flex-col bg-surface px-6 py-10 sm:px-12 lg:justify-center lg:px-14">
        <Link
          href="/"
          className="mb-10 inline-flex w-fit items-center gap-1 font-display text-[26px] font-semibold tracking-tight lg:hidden"
          aria-label="Kramya home"
        >
          <Mark className="h-9 w-9 text-primary" />
          Kramya
        </Link>
        <div className="mx-auto w-full max-w-sm">
          <p className="text-eyebrow uppercase text-ink-muted">
            Kramya / Clinic team
          </p>
          <h1 className="mt-3 text-display text-ink">{title}</h1>
          <p className="mb-8 mt-3 text-body-lg leading-7 text-ink-muted">
            {intro}
          </p>
          {children}
          {footer && (
            <div className="mt-7 border-t border-line pt-5 text-body text-ink-muted">
              {footer}
            </div>
          )}
          <div className="mt-10 flex flex-wrap gap-5 text-caption text-ink-muted">
            <Link className="inline-flex min-h-10 items-center" href="/support">
              Get help
            </Link>
            <Link className="inline-flex min-h-10 items-center" href="/privacy">
              Privacy
            </Link>
            <Link className="inline-flex min-h-10 items-center" href="/">
              Back to Kramya
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}
