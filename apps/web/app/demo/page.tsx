import Link from 'next/link';
import { Icon } from '../../components/icon';
import { Badge, Card, PageHeader, btn } from '../../components/ui';
import {
  DayTimeline,
  LiveSessionCard,
  StatStrip,
  type TimelineKind,
} from '../(console)/overview/parts';
import { DEMO_DEPARTMENTS, DEMO_SESSIONS, HOSPITAL } from './fixtures';

/**
 * The demo's "now". The fixtures describe a morning mid-clinic - two sessions
 * running, one finished at 11, one starting at 2 - so the clock is pinned to a
 * moment that story is true at, rather than to the visitor's real time, which
 * would put the Now line through the middle of the night half the time.
 */
const DEMO_NOW = 11 * 60 + 20;

/** "10:30 – 13:30" -> minutes since midnight at each end. */
const minutesOf = (window: string): [number, number] => {
  const [from = 0, to = 0] = window.split('–').map((part) => {
    const [h = 0, m = 0] = part.trim().split(':').map(Number);
    return h * 60 + m;
  });
  return [from, to];
};

/** 13:30 -> "1:30 PM", matching the real console's time format. */
const clock = (min: number): string => {
  const h = Math.floor(min / 60);
  const m = min % 60;
  const suffix = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return m === 0 ? `${h12} ${suffix}` : `${h12}:${String(m).padStart(2, '0')} ${suffix}`;
};

const KIND: Record<string, TimelineKind> = {
  Running: 'running',
  Finished: 'finished',
  'Not started': 'scheduled',
};

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

      <StatStrip
        items={[
          { label: 'Running now', value: running.length, icon: 'activity', live: true },
          { label: 'Still to start', value: upcoming.length, icon: 'clock' },
          { label: 'Finished', value: done.length, icon: 'check' },
          { label: 'Doctors listed', value: 6, icon: 'users' },
        ]}
      />

      <section aria-labelledby="live-now" className="mb-7">
        <h2 id="live-now" className="mb-3 text-eyebrow uppercase text-ink-muted">
          Live now
        </h2>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {running.map((session) => {
            const [startMin, endMin] = minutesOf(session.window);
            return (
              <LiveSessionCard
                key={session.doctor}
                href="/demo/queue"
                doctor={session.doctor}
                sub={session.dept}
                windowLabel={`${clock(startMin)}–${clock(endMin)}`}
                startMin={startMin}
                endMin={endMin}
                nowMin={DEMO_NOW}
                waiting={session.waiting}
              />
            );
          })}
        </div>
      </section>

      <div className="grid grid-cols-[minmax(0,1fr)] items-start gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,300px)]">
        <DayTimeline
          title="Today’s sessions"
          description={`${DEMO_SESSIONS.length} sessions · Friday, 13 September · times in IST`}
          nowMin={DEMO_NOW}
          rows={DEMO_SESSIONS.map((session) => {
            const [startMin, endMin] = minutesOf(session.window);
            return {
              key: session.doctor,
              href: session.status === 'Finished' ? null : '/demo/queue',
              doctor: session.doctor,
              sub: session.dept,
              windowLabel: `${clock(startMin)}–${clock(endMin)}`,
              startMin,
              endMin,
              kind: KIND[session.status] ?? 'scheduled',
              badge: (
                <Badge
                  tone={
                    session.status === 'Running'
                      ? 'success'
                      : session.status === 'Finished'
                        ? 'neutral'
                        : 'info'
                  }
                  icon={
                    session.status === 'Running'
                      ? 'activity'
                      : session.status === 'Finished'
                        ? 'check'
                        : 'calendar'
                  }
                >
                  {session.status}
                </Badge>
              ),
            };
          }).sort((a, b) => a.startMin - b.startMin)}
        />

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
            Departments, doctors, weekly schedules and queue policy are configured here. We set them
            up with you during onboarding.
          </p>
        </Card>
      </div>
    </>
  );
}
