import Link from 'next/link';
import { Icon } from '../../components/icon';
import {
  Badge,
  Card,
  PageHeader,
  TableCard,
  btn,
  table,
  td,
  th,
  tr,
} from '../../components/ui';
import { DEMO_DEPARTMENTS, DEMO_SESSIONS, HOSPITAL } from './fixtures';

/**
 * The demo Overview - deliberately the same page as `(console)/overview/page.tsx`,
 * built from the same components, with fixtures where that one has API calls.
 *
 * Kept as a sibling rather than a shared component, because the real one is a server
 * component that calls `getMe()` and `apiGet()` - neither of which a signed-out
 * visitor can do. What IS shared is everything visual: `PageHeader`, `Card`,
 * `TableCard`, `Badge`, `btn`, and the table primitives. A restyle of those reaches
 * this page for free, which is the only kind of drift-proofing available here.
 *
 * The section order matches the real page on purpose - counts, then what is running,
 * then the day's table - so a buyer who later signs in recognises the screen.
 */
export default function DemoOverview() {
  const running = DEMO_SESSIONS.filter((s) => s.status === 'Running');
  const upcoming = DEMO_SESSIONS.filter((s) => s.status === 'Not started');
  const done = DEMO_SESSIONS.filter((s) => s.status === 'Finished');

  return (
    <>
      <PageHeader
        eyebrow={HOSPITAL.name}
        title="Today"
        description="Friday, 13 September · Run a session from the board, or set up departments, doctors, schedules and queue rules under Configuration."
        actions={
          <Link href="/demo/queue" className={btn('quiet')}>
            <Icon name="queue" className="h-4 w-4" />
            All sessions
          </Link>
        }
      />

      {/* Three counts, not a chart - the real page's comment, and its reasoning: the
          question at 9am is "is anything running yet", and a number answers it in
          less time than a bar does. */}
      <dl className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Tile label="Running now" value={running.length} icon="activity" tone="success" />
        <Tile label="Still to start" value={upcoming.length} icon="clock" />
        <Tile label="Finished" value={done.length} icon="check" />
        <Tile label="Doctors listed" value={6} icon="users" />
      </dl>

      {running.length > 0 && (
        <div className="mb-5">
          <h2 className="mb-2.5 text-eyebrow uppercase text-ink-muted">In progress</h2>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {running.map((session) => (
              <Link
                key={session.doctor}
                href="/demo/queue"
                className="group flex flex-col rounded-lg border border-brand-200 bg-surface p-4 shadow-xs ring-1 ring-brand-100 transition-colors hover:border-brand-300 hover:bg-brand-50/40"
              >
                <div className="flex items-start justify-between gap-3">
                  <span className="min-w-0 truncate text-h3 text-ink">{session.doctor}</span>
                  <Badge tone="success" icon="activity">
                    In progress
                  </Badge>
                </div>
                <span className="mt-1 text-caption tabular-nums text-ink-muted">
                  {session.window} · {session.waiting} waiting
                </span>
                <span className="mt-3 inline-flex items-center gap-1 text-label font-semibold text-primary">
                  Open board
                  <Icon
                    name="arrow-right"
                    className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5"
                  />
                </span>
              </Link>
            ))}
          </div>
        </div>
      )}

      <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,320px)]">
        <TableCard
          title="Today's sessions"
          description={`${DEMO_SESSIONS.length} on Friday, 13 September`}
        >
          <table className={table}>
            <thead>
              <tr>
                <th className={th}>Doctor</th>
                <th className={th}>Department</th>
                <th className={th}>Window</th>
                <th className={th}>Status</th>
                <th className={th}>
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {DEMO_SESSIONS.map((session) => (
                <tr key={session.doctor} className={tr}>
                  <td className={td + ' font-medium'}>{session.doctor}</td>
                  <td className={td + ' text-ink-muted'}>{session.dept}</td>
                  <td className={td + ' whitespace-nowrap tabular-nums text-ink-muted'}>
                    {session.window}
                  </td>
                  <td className={td}>
                    <Badge
                      tone={
                        session.status === 'Running'
                          ? 'success'
                          : session.status === 'Finished'
                            ? 'neutral'
                            : 'info'
                      }
                    >
                      {session.status}
                    </Badge>
                  </td>
                  <td className={td + ' text-right'}>
                    {session.status === 'Finished' ? (
                      <span className="text-caption text-ink-disabled">Finished</span>
                    ) : (
                      <Link className={btn('quiet', 'sm')} href="/demo/queue">
                        Open board
                      </Link>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </TableCard>

        <Card title="Departments" description="What this hospital runs">
          <ul className="flex flex-col divide-y divide-line-soft">
            {DEMO_DEPARTMENTS.map((d) => (
              <li
                key={d.name}
                className="flex items-center justify-between gap-3 py-2.5 first:pt-0 last:pb-0"
              >
                <span className="min-w-0 truncate text-body font-medium text-ink">{d.name}</span>
                <Badge tone={d.openToday > 0 ? 'brand' : 'neutral'}>
                  {d.openToday}/{d.doctors} today
                </Badge>
              </li>
            ))}
          </ul>
          <p className="mt-3 border-t border-line-soft pt-3 text-caption text-ink-muted">
            Departments, doctors, weekly schedules and queue policy are configured here.
            We set them up with you during onboarding.
          </p>
        </Card>
      </div>
    </>
  );
}

/** The real Overview's tile, copied for the same reason the page is: tabular, so a
 *  row of them stays aligned as the numbers change rather than shuffling sideways. */
function Tile({
  label,
  value,
  icon,
  tone = 'neutral',
}: {
  label: string;
  value: number;
  icon: 'activity' | 'clock' | 'check' | 'users';
  tone?: 'neutral' | 'success';
}) {
  return (
    <div className="rounded-lg border border-line bg-surface p-3.5 shadow-xs">
      <dt className="flex items-center gap-1.5 text-eyebrow uppercase text-ink-muted">
        <Icon
          name={icon}
          className={'h-3.5 w-3.5 ' + (tone === 'success' && value > 0 ? 'text-success' : '')}
        />
        {label}
      </dt>
      <dd className="mt-1.5 text-display tabular-nums leading-none text-ink">{value}</dd>
    </div>
  );
}
