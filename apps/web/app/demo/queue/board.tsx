'use client';

import { useEffect, useState } from 'react';
import type { SessionEta } from '@opd/contracts';
import { Icon } from '../../../components/icon';
import { Badge, Card, EmptyState, PageHeader, TokenChip, btn } from '../../../components/ui';
import { Pace } from '../../(console)/queue/pace';
import { StatusPill } from '../../(console)/queue/ui';
import { RosterShell, Stage, UpNext } from '../../(console)/queue/stage';
import { HOSPITAL, INITIAL_QUEUE, NEXT_WALK_IN, demoEta, type DemoEntry } from '../fixtures';

/**
 * The reception board, built from the console's own parts.
 *
 * **`Pace` and `StatusPill` are imported from `(console)`, not reimplemented.** The
 * pace panel in particular is the piece a hospital most wants to see - it is the
 * answer to "is the queue on time and why" - and a hand-drawn imitation of it would
 * be the demo's biggest lie. Passing it a `SessionEta` shaped exactly as the contract
 * demands means the panel renders itself, including the wording it chooses for the
 * basis and the handover count.
 *
 * The layout is the real board's: a sticky 380px column carrying the one dominant
 * action, the pace and the session controls, beside the rosters that actually move.
 *
 * **Every action is `setState`.** Nothing here calls an API, holds a session or
 * touches a tenant - which is the whole reason this page can be public. What IS real
 * is the order the buttons enforce: no calling while somebody is in the room, and no
 * calling somebody who has not arrived. A demo that let a visitor break the queue
 * engine's rules would teach the wrong thing about the product.
 */
export function Board() {
  const [queue, setQueue] = useState<DemoEntry[]>(INITIAL_QUEUE);
  const [walkInAdded, setWalkInAdded] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  /*
    The ETA window is two absolute timestamps, so it is computed after mount rather
    than at build time - a statically prerendered "seen 11:40" is wrong by breakfast.
    Null until then, and the panel simply waits one frame rather than flashing a
    placeholder time that is not the one it settles on.
  */
  const [eta, setEta] = useState<SessionEta | null>(null);
  useEffect(() => setEta(demoEta()), []);

  const inRoom = queue.find((e) => e.status === 'IN_CONSULTATION') ?? null;
  const waiting = queue.filter((e) => e.status === 'CHECKED_IN');
  const notArrived = queue.filter((e) => e.status === 'CONFIRMED');
  const seen = queue.filter((e) => e.status === 'COMPLETED');

  const callBlocked =
    inRoom !== null
      ? 'Someone is already with the doctor'
      : waiting.length === 0
        ? 'Nobody has checked in yet'
        : undefined;

  function callNext() {
    const next = waiting[0];
    if (next === undefined) return;
    setQueue((q) => q.map((e) => (e.id === next.id ? { ...e, status: 'IN_CONSULTATION' } : e)));
    setNote(`${next.token} called — now with ${HOSPITAL.doctor}.`);
  }

  function complete() {
    if (inRoom === null) return;
    setQueue((q) => q.map((e) => (e.id === inRoom.id ? { ...e, status: 'COMPLETED' } : e)));
    setNote(`${inRoom.token} completed. Everyone waiting moved up one place.`);
  }

  function checkIn(entry: DemoEntry) {
    setQueue((q) =>
      q.map((e) => (e.id === entry.id ? { ...e, status: 'CHECKED_IN', waitingMins: 0 } : e)),
    );
    setNote(`${entry.token} checked in — in the waiting list now, in token order.`);
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
    setNote(`${NEXT_WALK_IN.token} registered at the counter — same queue, same order.`);
  }

  return (
    <>
      <PageHeader
        eyebrow={`${HOSPITAL.name} · ${HOSPITAL.department}`}
        title={HOSPITAL.doctor}
        description={
          <>
            {HOSPITAL.window} · ₹{HOSPITAL.feeRupees} consultation
          </>
        }
        actions={
          <>
            <Badge tone="success" icon="check-circle">
              Doctor in
            </Badge>
            <button
              type="button"
              onClick={addWalkIn}
              disabled={walkInAdded}
              className={btn('quiet')}
            >
              <Icon name="plus" className="h-4 w-4" />
              Walk-in
            </button>
          </>
        }
      />

      {note !== null && (
        // Keyed on the message so each new one arrives rather than silently replacing
        // the last - the only feedback a demo visitor gets that their press worked.
        <p
          key={note}
          role="status"
          className="mb-4 flex animate-fade-up items-center gap-2 rounded-xl border border-line bg-surface px-4 py-2.5 text-body text-ink-soft shadow-xs"
        >
          <Icon name="check-circle" className="h-4 w-4 text-success" />
          {note}
        </p>
      )}

      {/* The real board's split: the thing you came here to do stays put on the left
          while only the rosters move. */}
      {/* minmax(0,1fr) below lg - see the real board: without it the column grows to
          the widest row and a phone scrolls sideways. */}
      <div className="grid grid-cols-[minmax(0,1fr)] items-start gap-5 lg:grid-cols-[minmax(0,380px)_minmax(0,1fr)]">
        {/* Dissolves below lg so the rosters follow the stage - see the real board. */}
        <div className="flex flex-col gap-4 max-lg:contents">
          {/* Exactly one of these two states is true, and each has one obvious next
              step - the real board's rule (docs/Design.md 5.7). */}
          {inRoom !== null ? (
            <Stage
              state={{
                label: 'In consultation',
                icon: 'stethoscope',
                live: true,
              }}
              token={inRoom.token}
              name={inRoom.patient}
              meta={
                <>
                  {inRoom.type === 'ONLINE' ? 'Booked on the app' : 'Registered at the counter'}
                  {inRoom.waitingMins !== null && ` · waited ${inRoom.waitingMins}m`}
                </>
              }
            >
              <button type="button" onClick={complete} className={btn('primary', 'lg') + ' w-full'}>
                <Icon name="check" className="h-4 w-4" />
                Complete consultation
              </button>
              <UpNext
                entries={waiting.map((e) => ({
                  id: e.id,
                  token: e.token,
                  name: e.patient,
                }))}
              />
            </Stage>
          ) : (
            <Stage
              state={
                waiting.length > 0
                  ? { label: 'Ready to call', icon: 'bell' }
                  : { label: 'Nobody waiting', icon: 'clock' }
              }
              token={waiting[0]?.token ?? null}
              name={waiting[0]?.patient ?? 'Nobody checked in yet'}
              meta={
                waiting.length > 0
                  ? `Next up · ${waiting.length} checked in`
                  : 'Check somebody in to make them callable'
              }
              dim
            >
              <button
                type="button"
                onClick={callNext}
                disabled={callBlocked !== undefined}
                title={callBlocked}
                className={btn('primary', 'lg') + ' w-full'}
              >
                <Icon name="bell" className="h-4 w-4" />
                Call next patient
              </button>
              <UpNext
                entries={waiting.map((e) => ({ id: e.id, token: e.token, name: e.patient }))}
              />
            </Stage>
          )}

          <div className="flex flex-col gap-4 max-lg:order-1">
            {/* The console's own pace panel, rendered from a contract-shaped fixture. */}
            {eta !== null && <Pace eta={eta} />}

            <Card title="Session controls">
              <div className="flex flex-col gap-3">
                <button type="button" disabled className={btn('quiet') + ' w-full'}>
                  <Icon name="pause" className="h-4 w-4" />
                  Pause queue
                </button>
                <button type="button" disabled className={btn('danger') + ' w-full'}>
                  <Icon name="x" className="h-4 w-4" />
                  End session
                </button>
                <p className="text-caption text-ink-muted">
                  Disabled in the demo — ending a session is irreversible, and there is nothing here
                  to end.
                </p>
              </div>
            </Card>
          </div>
        </div>

        <div className="flex flex-col gap-5">
          <Roster
            emphasis
            title="Waiting here"
            icon="check-circle"
            entries={waiting}
            empty={
              <EmptyState icon="user-plus" title="Nobody is checked in">
                Patients become callable once reception checks them in at the desk.
              </EmptyState>
            }
          />

          <Roster
            title="Booked, not arrived"
            icon="home"
            entries={notArrived}
            onCheckIn={checkIn}
            empty={
              <EmptyState icon="check" title="Everyone who booked has arrived">
                Nothing to wait for on this list.
              </EmptyState>
            }
          />

          <Roster title="Seen today" icon="check" entries={seen} />
        </div>
      </div>
    </>
  );
}

/** One roster, the shape the real board draws them in. */
function Roster({
  title,
  icon,
  entries,
  onCheckIn,
  empty,
  emphasis = false,
}: {
  title: string;
  icon: 'check-circle' | 'home' | 'check';
  entries: DemoEntry[];
  onCheckIn?: (entry: DemoEntry) => void;
  empty?: React.ReactNode;
  emphasis?: boolean;
}) {
  // The real board's rows, not a table: the same shape a receptionist will meet on
  // the day, which is the point of a demo.
  return (
    <RosterShell title={title} icon={icon} count={entries.length} emphasis={emphasis}>
      {entries.length === 0 ? (
        (empty ?? <EmptyState icon={icon} title="Nothing here yet" />)
      ) : (
        <ul className="divide-y divide-line-soft">
          {entries.map((e) => (
            <li
              key={e.id}
              className="flex animate-fade-up flex-wrap items-center gap-x-3 gap-y-2 px-5 py-3 transition-colors last:rounded-b-xl hover:bg-hover"
            >
              <TokenChip>{e.token}</TokenChip>
              <span className="min-w-[8rem] flex-1 truncate text-body font-medium text-ink">
                {e.patient}
              </span>
              <span className="hidden text-caption text-ink-disabled sm:inline">
                {e.type === 'ONLINE' ? 'App' : 'Walk-in'}
                {e.waitingMins !== null && e.status === 'CHECKED_IN' && ` · ${e.waitingMins}m`}
              </span>
              <StatusPill status={e.status} />
              {onCheckIn !== undefined && (
                <button type="button" onClick={() => onCheckIn(e)} className={btn('quiet', 'sm')}>
                  Check in
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </RosterShell>
  );
}
