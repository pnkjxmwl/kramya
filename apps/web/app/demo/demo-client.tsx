'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Mark } from '../../components/mark';
import {
  DEMO_DEPARTMENTS,
  DEMO_SESSIONS,
  HOSPITAL,
  INITIAL_QUEUE,
  NEXT_WALK_IN,
  STATUS_LABEL,
  type DemoEntry,
} from './fixtures';

/**
 * The interactive demo. Two views, a guide caption on each, and no network at all.
 *
 * **Every action is `setState` on a local array.** Pressing "Call next" here does not
 * hit `/sessions/:id/call-next`, does not take a lock and does not write an audit row.
 * It is a showreel of the console, and the banner at the top says so - a visitor who
 * believes they are driving a real hospital is a visitor we have misled.
 *
 * The ORDER the buttons enforce is real, though, and that is the part worth
 * demonstrating: you cannot call someone while a patient is in the room, and you
 * cannot call a patient who has not arrived. Those are the queue engine's own rules
 * (docs/PRD.md 8), and a demo that let you break them would be teaching the wrong
 * thing about the product.
 */

type View = 'reception' | 'admin';

export function Demo() {
  const [view, setView] = useState<View>('reception');

  return (
    <div className="min-h-screen bg-brand-canvas font-sans text-brand-ink antialiased">
      <DemoHeader view={view} onView={setView} />
      <main className="mx-auto max-w-6xl px-6 pb-24 pt-8">
        {view === 'reception' ? <Reception /> : <Admin />}
      </main>
    </div>
  );
}

/* ------------------------------------------------------------------ chrome */

function DemoHeader({ view, onView }: { view: View; onView: (v: View) => void }) {
  return (
    <>
      {/*
        Said once, at the top, in plain words. A demo that looks exactly like the
        product and does not admit it is a demo is the thing that gets a vendor
        distrusted the first time a buyer finds out.
      */}
      <div className="bg-brand-ink px-6 py-2.5 text-center text-[13px] text-white/80">
        This is a demonstration with sample data. Nothing you do here is saved, and no
        real patient information is shown.
      </div>

      <header className="sticky top-0 z-50 border-b border-brand-line bg-brand-canvas/95 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-6">
          <Link href="/" className="flex items-center gap-2.5" aria-label="Kramya home">
            <Mark className="h-[20px] w-[20px]" />
            <span className="text-[16px] font-semibold tracking-[-0.4px]">Kramya</span>
            <span className="hidden text-[13px] text-brand-muted sm:inline">· Demo</span>
          </Link>

          <div className="flex items-center gap-1 rounded-xl bg-brand-fill p-1">
            {(['reception', 'admin'] as const).map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => onView(v)}
                aria-pressed={view === v}
                className={
                  'rounded-lg px-3.5 py-1.5 text-[13px] font-medium capitalize transition-colors ' +
                  (view === v ? 'bg-white text-brand-ink shadow-sm' : 'text-brand-soft hover:text-brand-ink')
                }
              >
                {v}
              </button>
            ))}
          </div>
        </div>
      </header>
    </>
  );
}

/** The guide line above each view - what this person is doing, and why. */
function Guide({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-7 max-w-[62ch]">
      <h1 className="text-[26px] font-semibold tracking-[-1px]">{title}</h1>
      <p className="mt-2 text-[15px] leading-[1.6] text-brand-soft">{children}</p>
    </div>
  );
}

/* --------------------------------------------------------------- reception */

function Reception() {
  const [queue, setQueue] = useState<DemoEntry[]>(INITIAL_QUEUE);
  const [walkInAdded, setWalkInAdded] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  const inRoom = queue.find((e) => e.status === 'IN_CONSULTATION') ?? null;
  const waiting = queue.filter((e) => e.status === 'CHECKED_IN');
  const booked = queue.filter((e) => e.status === 'CONFIRMED');

  /*
    The real rule, enforced: one patient in the room at a time, and only somebody who
    has physically arrived can be called. The queue engine refuses both of these with
    a typed error; here the button is simply disabled and says why.
  */
  const canCallNext = inRoom === null && waiting.length > 0;

  function callNext() {
    const next = waiting[0];
    if (next === undefined) return;
    setQueue((q) => q.map((e) => (e.id === next.id ? { ...e, status: 'IN_CONSULTATION' } : e)));
    setNote(`${next.token} called. They are with ${HOSPITAL.doctor} now.`);
  }

  function complete() {
    if (inRoom === null) return;
    setQueue((q) => q.map((e) => (e.id === inRoom.id ? { ...e, status: 'COMPLETED' } : e)));
    setNote(`${inRoom.token} finished. The queue moved up by one.`);
  }

  function checkIn(entry: DemoEntry) {
    setQueue((q) => q.map((e) => (e.id === entry.id ? { ...e, status: 'CHECKED_IN', waitingMins: 0 } : e)));
    setNote(`${entry.token} checked in at the desk — they are now in the waiting list.`);
  }

  function addWalkIn() {
    setQueue((q) => [
      ...q,
      {
        id: 'walkin',
        token: NEXT_WALK_IN.token,
        patient: NEXT_WALK_IN.patient,
        type: 'WALK_IN',
        status: 'CHECKED_IN',
        waitingMins: 0,
      },
    ]);
    setWalkInAdded(true);
    setNote(`${NEXT_WALK_IN.token} registered at the counter — same queue, in token order.`);
  }

  return (
    <>
      <Guide title="Reception">
        This is the board your front desk works from. Call the next patient, finish a
        consultation, check somebody in when they arrive, or register a walk-in. The
        buttons enforce the same rules the real queue engine does.
      </Guide>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,300px)]">
        <div className="rounded-2xl border border-line bg-surface shadow-xs">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line-soft px-5 py-4">
            <div>
              <h2 className="text-[17px] font-semibold tracking-[-0.3px]">{HOSPITAL.doctor}</h2>
              <p className="mt-0.5 text-[13px] text-ink-muted">
                {HOSPITAL.department} · {HOSPITAL.window}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={callNext}
                disabled={!canCallNext}
                title={
                  inRoom !== null
                    ? 'Someone is already with the doctor'
                    : waiting.length === 0
                      ? 'Nobody has checked in yet'
                      : undefined
                }
                className="rounded-lg bg-primary px-3.5 py-2 text-[13px] font-medium text-white transition-opacity hover:opacity-85 disabled:cursor-not-allowed disabled:opacity-35"
              >
                Call next
              </button>
              <button
                type="button"
                onClick={complete}
                disabled={inRoom === null}
                className="rounded-lg bg-sunken px-3.5 py-2 text-[13px] font-medium transition-colors hover:bg-brand-100 disabled:cursor-not-allowed disabled:opacity-35"
              >
                Complete
              </button>
              <button
                type="button"
                onClick={addWalkIn}
                disabled={walkInAdded}
                className="rounded-lg bg-sunken px-3.5 py-2 text-[13px] font-medium transition-colors hover:bg-brand-100 disabled:cursor-not-allowed disabled:opacity-35"
              >
                Add walk-in
              </button>
            </div>
          </div>

          {note !== null && (
            <p className="border-b border-line-soft bg-brand-50 px-5 py-2.5 text-[13px] text-ink-soft">
              {note}
            </p>
          )}

          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-line-soft">
                <Th>Token</Th>
                <Th>Patient</Th>
                <Th>Source</Th>
                <Th>Waiting</Th>
                <Th>Status</Th>
                <Th> </Th>
              </tr>
            </thead>
            <tbody>
              {queue.map((e) => (
                <tr
                  key={e.id}
                  className={
                    'border-b border-line-soft last:border-0 ' +
                    (e.status === 'IN_CONSULTATION' ? 'bg-brand-50' : '')
                  }
                >
                  <Td className="font-medium tabular-nums">{e.token}</Td>
                  <Td>{e.patient}</Td>
                  <Td className="text-ink-muted">
                    {e.type === 'ONLINE' ? 'App' : 'Counter'}
                  </Td>
                  <Td className="tabular-nums text-ink-muted">
                    {e.waitingMins === null ? '—' : `${e.waitingMins}m`}
                  </Td>
                  <Td>
                    <StatusPill status={e.status} />
                  </Td>
                  <Td className="text-right">
                    {e.status === 'CONFIRMED' && (
                      <button
                        type="button"
                        onClick={() => checkIn(e)}
                        className="rounded-md px-2.5 py-1 text-[12px] font-medium text-ink-soft underline-offset-2 transition-colors hover:bg-sunken hover:text-ink"
                      >
                        Check in
                      </button>
                    )}
                  </Td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* The two honest numbers, which is the thing this product is actually about. */}
        <aside className="flex flex-col gap-3">
          <Stat label="Checked in, waiting" value={waiting.length} />
          <Stat label="Booked, not arrived" value={booked.length} />
          <div className="rounded-2xl border border-line bg-surface p-5 shadow-xs">
            <h3 className="text-[13px] font-semibold uppercase tracking-[1px] text-ink-muted">
              Why two numbers
            </h3>
            <p className="mt-2.5 text-[13.5px] leading-[1.6] text-ink-soft">
              People who are here and people who merely hold a token are different
              facts. Only the first drives the estimate — which is why an ETA from
              Kramya does not collapse the moment somebody books and stays home.
            </p>
          </div>
        </aside>
      </div>
    </>
  );
}

/* ------------------------------------------------------------------- admin */

function Admin() {
  return (
    <>
      <Guide title="Administrator">
        What the person running the hospital sees. Today&rsquo;s programme across every
        department, and the configuration behind it — departments, doctors, schedules
        and the queue rules that decide no-shows, refunds and priority.
      </Guide>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,320px)]">
        <div className="rounded-2xl border border-line bg-surface shadow-xs">
          <div className="border-b border-line-soft px-5 py-4">
            <h2 className="text-[17px] font-semibold tracking-[-0.3px]">Today</h2>
            <p className="mt-0.5 text-[13px] text-ink-muted">
              {HOSPITAL.name} · {DEMO_SESSIONS.length} sessions
            </p>
          </div>
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-line-soft">
                <Th>Doctor</Th>
                <Th>Department</Th>
                <Th>Window</Th>
                <Th>Waiting</Th>
                <Th>Status</Th>
              </tr>
            </thead>
            <tbody>
              {DEMO_SESSIONS.map((s) => (
                <tr key={s.doctor} className="border-b border-line-soft last:border-0">
                  <Td className="font-medium">{s.doctor}</Td>
                  <Td className="text-ink-muted">{s.dept}</Td>
                  <Td className="tabular-nums text-ink-muted">{s.window}</Td>
                  <Td className="tabular-nums">{s.waiting === 0 ? '—' : s.waiting}</Td>
                  <Td>
                    <span
                      className={
                        'inline-flex rounded-full px-2 py-0.5 text-[11.5px] font-medium ring-1 ' +
                        (s.status === 'Running'
                          ? 'bg-success-bg text-success ring-success-line'
                          : 'bg-sunken text-ink-muted ring-line')
                      }
                    >
                      {s.status}
                    </span>
                  </Td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <aside className="rounded-2xl border border-line bg-surface p-5 shadow-xs">
          <h3 className="text-[13px] font-semibold uppercase tracking-[1px] text-ink-muted">
            Departments
          </h3>
          <ul className="mt-3 flex flex-col divide-y divide-line-soft">
            {DEMO_DEPARTMENTS.map((d) => (
              <li key={d.name} className="flex items-center justify-between gap-3 py-2.5 first:pt-0 last:pb-0">
                <span className="text-[14px] font-medium">{d.name}</span>
                <span className="text-[13px] tabular-nums text-ink-muted">
                  {d.openToday}/{d.doctors} today
                </span>
              </li>
            ))}
          </ul>
          <p className="mt-4 border-t border-line-soft pt-3.5 text-[13px] leading-[1.55] text-ink-muted">
            Departments, doctors, weekly schedules and queue policy are all configured
            here. We set them up with you during onboarding.
          </p>
        </aside>
      </div>
    </>
  );
}

/* ------------------------------------------------------------------- bits */

function Th({ children }: { children: React.ReactNode }) {
  return (
    <th className="px-5 py-2.5 text-[11.5px] font-semibold uppercase tracking-[0.6px] text-ink-muted">
      {children}
    </th>
  );
}

function Td({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <td className={'px-5 py-3 text-[14px] ' + className}>{children}</td>;
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl border border-line bg-surface p-5 shadow-xs">
      <div className="text-[11.5px] font-semibold uppercase tracking-[1px] text-ink-muted">
        {label}
      </div>
      <div className="mt-1.5 text-[32px] font-semibold leading-none tabular-nums">{value}</div>
    </div>
  );
}

function StatusPill({ status }: { status: DemoEntry['status'] }) {
  const tone =
    status === 'IN_CONSULTATION'
      ? 'bg-brand-900 text-white'
      : status === 'CHECKED_IN'
        ? 'bg-success-bg text-success ring-1 ring-success-line'
        : status === 'COMPLETED'
          ? 'bg-sunken text-ink-muted ring-1 ring-line'
          : 'bg-surface text-ink-soft ring-1 ring-line';
  return (
    <span className={'inline-flex rounded-full px-2 py-0.5 text-[11.5px] font-medium ' + tone}>
      {STATUS_LABEL[status]}
    </span>
  );
}
