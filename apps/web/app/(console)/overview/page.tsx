import Link from 'next/link';
import type { Doctor, OPDSession, Paginated } from '@opd/contracts';
import { apiGet } from '../../../lib/api';
import { getMe } from '../../../lib/tenant';
import { Icon } from '../../../components/icon';
import { Badge, Card, EmptyState, PageHeader, btn } from '../../../components/ui';
import {
  SessionStatusBadge,
  SESSION_FINISHED,
  istDateLabel,
  istMinutes,
  istToday,
  istTime,
} from '../queue/ui';
import { DayTimeline, LiveSessionCard, StatStrip, type TimelineKind } from './parts';

/**
 * The overview - **what is happening in this hospital right now**, rather than a
 * receipt for having signed in.
 *
 * It used to say who you were and what you could theoretically do next, in two
 * paragraphs, above a list of your memberships. That is a page you read once. The
 * console's landing screen is opened at the start of every shift by someone who
 * wants one thing: which clinics are running, and how do I get to the one I am
 * about to work on.
 *
 * **Everything here is already on endpoints the queue screens use.** No new API, no
 * new aggregate - today's sessions and the hospital's doctors, the same two requests
 * `/queue` makes, in the same round trip.
 */

const NEXT_STEP: Record<string, string> = {
  ADMIN:
    'Run a session from the board, or set up departments, doctors, schedules and queue rules under Configuration.',
  DOCTOR: 'Open your session to call the next patient and run consultations.',
  RECEPTION: 'Open a session to check patients in and register walk-ins.',
};

export default async function Overview() {
  // Shares the layout's call, rather than repeating it. Still NOT
  // `requireStaffHospital()` - see the note below, that would loop.
  const me = await getMe();
  const active = me.memberships.find((m) => m.status === 'ACTIVE');

  /*
    An account with no active membership is a real state - an invitation accepted
    but not yet approved, or access revoked while the tab was open - and it is the
    only path through this page that must not fetch a hospital's sessions.

    Deliberately handled HERE rather than by `requireStaffHospital()`, which
    redirects to this very page: calling it from the overview is an infinite loop.
  */
  if (active === undefined) {
    return (
      <>
        <PageHeader title="Overview" description={`Signed in as ${me.email}.`} />
        <Card>
          <EmptyState icon="building" title="No hospital yet">
            This account is not an active member of any hospital. An administrator has to invite you
            before the queue and configuration appear.
          </EmptyState>
        </Card>
      </>
    );
  }

  const date = istToday();
  const [page, doctors] = await Promise.all([
    apiGet<Paginated<OPDSession>>(
      `/hospitals/${active.hospitalId}/sessions?date=${date}&limit=100`,
    ),
    apiGet<Paginated<Doctor>>(`/hospitals/${active.hospitalId}/doctors?limit=100`),
  ]);

  const doctorName = new Map(doctors.items.map((d) => [d.id, d.name] as const));

  // A doctor sees the sessions they are actually providing - including any they are
  // covering for someone else, which is why this matches `currentProviderDoctorId`
  // and not `originalDoctorId` (docs/PRD.md 8.11, substitution).
  const sessions =
    active.role === 'DOCTOR' && active.doctorId !== null
      ? page.items.filter((s) => s.currentProviderDoctorId === active.doctorId)
      : page.items;

  const running = sessions.filter((s) => s.status === 'ACTIVE');
  const upcoming = sessions.filter(
    (s) => s.status === 'SCHEDULED' || s.status === 'OPEN_FOR_REGISTRATION',
  );
  const done = sessions.filter((s) => SESSION_FINISHED.includes(s.status));
  const nowMin = istMinutes(new Date());

  return (
    <>
      <PageHeader
        eyebrow={active.hospitalName}
        title="Today"
        description={
          <>
            {istDateLabel(date)} · {NEXT_STEP[active.role]}
          </>
        }
        actions={
          <Link href="/queue" className={btn('quiet')}>
            <Icon name="queue" className="h-4 w-4" />
            All sessions
          </Link>
        }
      />

      {/*
        Counts, not a chart. The question at 9am is "is anything running yet", and a
        number answers it in less time than a bar does.
      */}
      <StatStrip
        items={[
          { label: 'Running now', value: running.length, icon: 'activity', live: true },
          { label: 'Still to start', value: upcoming.length, icon: 'clock' },
          { label: 'Finished', value: done.length, icon: 'check' },
          {
            label: active.role === 'DOCTOR' ? 'Your sessions' : 'Doctors listed',
            value: active.role === 'DOCTOR' ? sessions.length : doctors.total,
            icon: 'users',
          },
        ]}
      />

      {running.length > 0 && (
        <section aria-labelledby="live-now" className="mb-7">
          <h2 id="live-now" className="mb-3 text-eyebrow uppercase text-ink-muted">
            Live now
          </h2>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {running.map((session) => (
              <LiveSessionCard
                key={session.id}
                href={`/queue/${session.id}`}
                doctor={doctorName.get(session.currentProviderDoctorId) ?? 'Unknown doctor'}
                sub={session.pausedAt !== null ? 'Queue paused' : undefined}
                windowLabel={`${istTime(session.scheduledStart)}–${istTime(session.scheduledEnd)}`}
                startMin={istMinutes(session.scheduledStart)}
                endMin={istMinutes(session.scheduledEnd)}
                nowMin={nowMin}
              />
            ))}
          </div>
        </section>
      )}

      <div className="grid grid-cols-[minmax(0,1fr)] items-start gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,300px)]">
        <DayTimeline
          title={active.role === 'DOCTOR' ? 'Your sessions today' : 'Today’s sessions'}
          description={`${sessions.length} session${sessions.length === 1 ? '' : 's'} · ${istDateLabel(date)} · times in IST`}
          nowMin={nowMin}
          rows={[...sessions]
            .sort((a, b) => a.scheduledStart.localeCompare(b.scheduledStart))
            .map((session) => ({
              key: session.id,
              href: SESSION_FINISHED.includes(session.status) ? null : `/queue/${session.id}`,
              doctor: doctorName.get(session.currentProviderDoctorId) ?? 'Unknown doctor',
              windowLabel: `${istTime(session.scheduledStart)}–${istTime(session.scheduledEnd)}`,
              startMin: istMinutes(session.scheduledStart),
              endMin: istMinutes(session.scheduledEnd),
              kind: KIND[session.status] ?? 'scheduled',
              badge: <SessionStatusBadge status={session.status} />,
            }))}
          empty={
            <EmptyState
              icon="calendar"
              title="Nothing scheduled today"
              action={
                active.role === 'ADMIN' ? (
                  <Link href="/config/sessions" className={btn('primary')}>
                    <Icon name="plus" className="h-4 w-4" />
                    Generate sessions
                  </Link>
                ) : undefined
              }
            >
              {active.role === 'ADMIN'
                ? 'Sessions are generated from the weekly schedules, or added one at a time.'
                : 'An administrator generates the day’s sessions from the schedules.'}
            </EmptyState>
          }
        />

        <Card title="Your access" description="Where this account can act">
          <ul className="flex flex-col divide-y divide-line-soft">
            {me.memberships.map((m) => (
              <li
                key={m.hospitalId}
                className="flex items-center justify-between gap-3 py-2.5 first:pt-0 last:pb-0"
              >
                <span className="min-w-0 truncate text-body font-medium text-ink">
                  {m.hospitalName}
                </span>
                <Badge tone={m.hospitalId === active.hospitalId ? 'brand' : 'neutral'}>
                  {m.role}
                </Badge>
              </li>
            ))}
          </ul>
          <p className="mt-3 border-t border-line-soft pt-3 text-caption text-ink-muted">
            Signed in as {me.email}.
          </p>
        </Card>
      </div>
    </>
  );
}

/** How a session status is drawn on the timeline - the badge beside it carries the words. */
const KIND: Record<string, TimelineKind> = {
  ACTIVE: 'running',
  OPEN_FOR_REGISTRATION: 'open',
  SCHEDULED: 'scheduled',
  COMPLETED: 'finished',
  ENDED_EARLY: 'finished',
  CANCELLED: 'cancelled',
};
