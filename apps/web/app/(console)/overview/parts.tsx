import Link from 'next/link';
import { Icon, type IconName } from '../../../components/icon';

/**
 * The overview's furniture, shared by the real page and the demo so they cannot
 * drift - the same reason the board's pieces live in queue/stage.tsx.
 *
 * Everything here is a server component and takes plain numbers: times are minutes
 * since IST midnight, computed by the caller (`istMinutes`), so this file never has
 * to know whether it is drawing a live hospital or a fixture.
 */

/* ------------------------------------------------------------------ stats */

/**
 * Four counts in one strip, not four cards.
 *
 * Four equal boxes gave "doctors listed" the same weight as "running now", and the
 * gaps between them read as four unrelated facts. One surface with hairlines between
 * the cells says "this is one summary", and the live cell is the only one that moves.
 */
export function StatStrip({
  items,
}: {
  items: { label: string; value: number; icon: IconName; live?: boolean }[];
}) {
  return (
    <dl className="mb-7 grid grid-cols-2 overflow-hidden rounded-xl border border-line bg-surface shadow-xs sm:grid-cols-4">
      {items.map((item, i) => (
        <div
          key={item.label}
          className={
            'px-5 py-4 ' +
            (i % 2 === 1 ? 'border-l border-line-soft ' : '') +
            (i >= 2 ? 'border-t border-line-soft sm:border-t-0 ' : '') +
            (i >= 1 ? 'sm:border-l ' : '')
          }
        >
          <dt className="flex items-center gap-1.5 text-eyebrow uppercase text-ink-muted">
            {item.live === true && item.value > 0 ? (
              <span className="live-dot mx-0.5 text-success" aria-hidden="true" />
            ) : (
              <Icon name={item.icon} className="h-3.5 w-3.5 text-ink-disabled" />
            )}
            {item.label}
          </dt>
          <dd className="mt-2 text-[34px] font-semibold leading-none tracking-[-0.03em] tabular-nums text-ink">
            {item.value}
          </dd>
        </div>
      ))}
    </dl>
  );
}

/* -------------------------------------------------------------- live now */

/**
 * A running session, as a way in.
 *
 * The bar is the session's own clock - how far through its window it is - which
 * answers "are we near the end?" without anyone doing arithmetic on "10 AM–1 PM".
 */
export function LiveSessionCard({
  href,
  doctor,
  sub,
  windowLabel,
  startMin,
  endMin,
  nowMin,
  waiting,
}: {
  href: string;
  doctor: string;
  sub?: string;
  windowLabel: string;
  startMin: number;
  endMin: number;
  nowMin: number;
  waiting?: number;
}) {
  const span = Math.max(1, endMin - startMin);
  const done = Math.min(Math.max(nowMin - startMin, 0), span);
  const pct = Math.round((done / span) * 100);

  return (
    <Link
      href={href}
      className="group flex flex-col rounded-xl border border-line bg-surface p-5 shadow-xs transition-[box-shadow,border-color,transform] duration-200 hover:-translate-y-0.5 hover:border-line-strong hover:shadow-raised"
    >
      <div className="flex items-center justify-between gap-3">
        <span className="inline-flex items-center gap-2 text-caption font-semibold text-success">
          <span className="live-dot" aria-hidden="true" />
          Running
        </span>
        <span className="text-caption tabular-nums text-ink-muted">{windowLabel}</span>
      </div>

      <p className="mt-3 truncate text-h2 text-ink">{doctor}</p>
      <p className="mt-0.5 truncate text-caption text-ink-muted">
        {sub}
        {sub !== undefined && waiting !== undefined && ' · '}
        {waiting !== undefined && `${waiting} waiting`}
      </p>

      <div className="mt-4">
        <div
          className="h-1.5 overflow-hidden rounded-full bg-sunken"
          role="img"
          aria-label={`${pct}% of the session window has passed`}
        >
          <div className="h-full rounded-full bg-ink" style={{ width: `${pct}%` }} />
        </div>
        <div className="mt-2 flex items-center justify-between text-caption tabular-nums text-ink-muted">
          <span>{duration(done)} in</span>
          <span>{duration(span - done)} left</span>
        </div>
      </div>

      <span className="mt-4 inline-flex items-center gap-1 border-t border-line-soft pt-3.5 text-label font-semibold text-ink">
        Open board
        <Icon
          name="arrow-right"
          className="h-3.5 w-3.5 transition-transform duration-200 group-hover:translate-x-1"
        />
      </span>
    </Link>
  );
}

const duration = (mins: number): string => {
  const h = Math.floor(mins / 60);
  const m = Math.round(mins % 60);
  return h === 0 ? `${m}m` : m === 0 ? `${h}h` : `${h}h ${m}m`;
};

/* --------------------------------------------------------------- timeline */

export type TimelineKind = 'running' | 'open' | 'scheduled' | 'finished' | 'cancelled';

export interface TimelineRow {
  key: string;
  href: string | null;
  doctor: string;
  sub?: string;
  windowLabel: string;
  startMin: number;
  endMin: number;
  kind: TimelineKind;
  /** The session's status badge - label and icon, so the bar's colour is never alone. */
  badge: React.ReactNode;
}

const BAR: Record<TimelineKind, string> = {
  running: 'bg-ink text-white',
  open: 'bg-surface text-ink ring-1 ring-inset ring-line-strong',
  scheduled: 'bg-sunken text-ink-muted ring-1 ring-inset ring-line',
  finished: 'bg-line text-ink-muted',
  cancelled: 'bg-danger-bg text-danger ring-1 ring-inset ring-danger-line',
};

/**
 * Today, drawn as a day.
 *
 * This replaces a table of "10 AM–1 PM" strings, which made a person build the day
 * in their head: which sessions overlap, what is on right now, how long until the
 * afternoon starts. On a shared time axis with a line at now, those are things you
 * see rather than work out.
 *
 * Still a list underneath - each row is a link with its badge and window in text -
 * so it degrades to exactly that below `md`, where there is no room for an axis.
 */
export function DayTimeline({
  title,
  description,
  rows,
  nowMin,
  empty,
}: {
  title: string;
  description: string;
  rows: TimelineRow[];
  nowMin: number;
  empty?: React.ReactNode;
}) {
  const earliest = Math.min(nowMin, ...rows.map((r) => r.startMin));
  const latest = Math.max(nowMin, ...rows.map((r) => r.endMin));
  let from = Math.floor(earliest / 60) * 60;
  let to = Math.ceil(latest / 60) * 60;
  // Never narrower than six hours, or one short session fills the axis and reads as
  // "all day".
  if (to - from < 360) {
    const pad = Math.ceil((360 - (to - from)) / 120) * 60;
    from = Math.max(0, from - pad);
    to = Math.min(24 * 60, to + pad);
  }
  const span = to - from;
  const at = (min: number) => `${((Math.min(Math.max(min, from), to) - from) / span) * 100}%`;
  const step = span > 8 * 60 ? 120 : 60;
  const ticks: number[] = [];
  for (let t = from; t <= to; t += step) ticks.push(t);
  const nowVisible = nowMin >= from && nowMin <= to;

  return (
    <section className="rounded-xl border border-line bg-surface shadow-xs">
      <header className="flex flex-wrap items-end justify-between gap-x-4 gap-y-2 border-b border-line-soft px-5 py-3.5">
        <div className="min-w-0">
          <h2 className="text-h3 text-ink">{title}</h2>
          <p className="mt-0.5 text-caption text-ink-muted">{description}</p>
        </div>
        <Legend />
      </header>

      {rows.length === 0 ? (
        empty
      ) : (
        <>
          {/* The axis. Same three columns as the rows so the ticks sit over the tracks. */}
          <div className="hidden grid-cols-[minmax(0,210px)_minmax(0,1fr)_132px] gap-x-4 border-b border-line-soft px-5 pb-2 pt-3 md:grid">
            <span className="text-eyebrow uppercase text-ink-disabled">Doctor</span>
            <div className="relative h-4">
              {/* Interior ticks only: a label centred on either edge of the axis either
                  overflows it or has to be nudged into its neighbour. And none within
                  a few percent of Now, whose chip would sit on top of it. */}
              {ticks
                .filter((t) => t !== from && t !== to)
                .filter((t) => !nowVisible || Math.abs(t - nowMin) > span * 0.09)
                .map((t) => (
                  <span
                    key={t}
                    className="absolute -translate-x-1/2 whitespace-nowrap text-[11px] font-medium tabular-nums text-ink-disabled"
                    style={{ left: at(t) }}
                  >
                    {hourLabel(t)}
                  </span>
                ))}
              {nowVisible && (
                <span
                  className="absolute -top-0.5 z-10 -translate-x-1/2 rounded-full bg-danger px-1.5 py-px text-[10px] font-semibold uppercase tracking-wide text-white"
                  style={{ left: at(nowMin) }}
                >
                  Now
                </span>
              )}
            </div>
            <span />
          </div>

          <ul className="divide-y divide-line-soft">
            {rows.map((row) => {
              const body = (
                <>
                  <div className="min-w-0">
                    <p className="truncate text-body font-medium text-ink">{row.doctor}</p>
                    <p className="truncate text-caption tabular-nums text-ink-muted">
                      {row.sub !== undefined && `${row.sub} · `}
                      {row.windowLabel}
                    </p>
                  </div>

                  <div className="relative hidden h-8 md:block" aria-hidden="true">
                    {/* Hour guides, faint, so a bar can be read against the axis. */}
                    {ticks.map((t) => (
                      <span
                        key={t}
                        className="absolute inset-y-0 w-px bg-line-soft"
                        style={{ left: at(t) }}
                      />
                    ))}
                    {/* Now sits UNDER the bars: drawn over them it struck through the
                        window printed inside, and the axis chip already marks it. */}
                    {nowVisible && (
                      <span
                        className="absolute inset-y-0 w-0.5 -translate-x-1/2 rounded-full bg-danger/70"
                        style={{ left: at(nowMin) }}
                      />
                    )}
                    <span
                      className={
                        'absolute inset-y-1 flex items-center overflow-hidden whitespace-nowrap rounded-md px-2 text-[11px] font-semibold tabular-nums transition-transform duration-200 group-hover:scale-y-110 ' +
                        BAR[row.kind]
                      }
                      style={{
                        left: at(row.startMin),
                        width: `calc(${at(row.endMin)} - ${at(row.startMin)})`,
                      }}
                    >
                      {row.kind === 'running' && (
                        <span className="live-dot mr-1.5 text-brand-live" />
                      )}
                      <span className="truncate">{row.windowLabel}</span>
                    </span>
                  </div>

                  <div className="flex items-center justify-end gap-2">
                    {row.badge}
                    {row.href !== null && (
                      <Icon
                        name="chevron-right"
                        className="h-4 w-4 text-ink-disabled transition-transform duration-200 group-hover:translate-x-0.5 group-hover:text-ink"
                      />
                    )}
                  </div>
                </>
              );
              const cls =
                'group grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 px-5 py-3 md:grid-cols-[minmax(0,210px)_minmax(0,1fr)_132px]';
              return (
                <li key={row.key} className="last:rounded-b-xl">
                  {row.href !== null ? (
                    <Link
                      href={row.href}
                      className={cls + ' transition-colors hover:bg-hover'}
                      aria-label={`Open ${row.doctor}'s board, ${row.windowLabel}`}
                    >
                      {body}
                    </Link>
                  ) : (
                    <div className={cls}>{body}</div>
                  )}
                </li>
              );
            })}
          </ul>
        </>
      )}
    </section>
  );
}

function Legend() {
  const item = (cls: string, label: string) => (
    <span className="inline-flex items-center gap-1.5">
      <span className={'h-2.5 w-4 rounded-sm ' + cls} />
      {label}
    </span>
  );
  return (
    <div className="hidden flex-wrap items-center gap-x-4 gap-y-1 text-caption text-ink-muted md:flex">
      {item(BAR.running, 'Running')}
      {item(BAR.open, 'Taking bookings')}
      {item(BAR.scheduled, 'Scheduled')}
      {item(BAR.finished, 'Finished')}
    </div>
  );
}

const hourLabel = (min: number): string => {
  const h = Math.floor(min / 60) % 24;
  if (h === 0) return '12 AM';
  if (h === 12) return '12 PM';
  return h < 12 ? `${h} AM` : `${h - 12} PM`;
};
