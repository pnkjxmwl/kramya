import { ArrivalList } from './arrival-list';
import { readQueueNotice } from '../../../../../lib/queue-notice';
import Link from 'next/link';
import type { Paginated, QueueEntryView } from '@opd/contracts';
import { requireStaffHospital } from '../../../../../lib/tenant';
import { queueGet } from '../../_run';
import { Icon } from '../../../../../components/icon';
import {
  Badge,
  Card,
  ErrorBanner,
  SuccessBanner,
  btn,
  input,
  label,
} from '../../../../../components/ui';
import { checkInByToken } from './actions';
import { Scanner } from './scanner';

/**
 * P6-WEB-02 · the check-in desk. docs/Design.md 5.8.
 *
 * **Three ways in, and only one of them needs a camera.** docs/PRD.md 6.3 asks for
 * QR-first with a manual fallback; the third - tapping the patient in the list - is
 * what actually saves the desk when a phone is flat, the app will not open, or the
 * booking is in a relative's name. All three end at the same idempotent command.
 *
 * The scanner is deliberately not the whole page. A desk with no camera, no HTTPS or
 * a declined permission still has a complete, working screen.
 *
 * **Laid out as a desk, not as a stack.** The three methods were four full-width
 * cards down a 1400px page, so the typed field - the one a receptionist falls back
 * to twenty times a day - sat below the fold under a camera they may not even have.
 * The camera and the two typed methods are now side by side, and the roster of who
 * is still to arrive is the tall column, because that is the list being worked
 * through.
 */

const LIMIT = 200;

/** Who reception can still check in. Presentational grouping; the server decides. */
const AWAITING = ['CONFIRMED', 'VIRTUAL_WAITING'];

export default async function CheckInPage({
  params,
  searchParams,
}: {
  params: Promise<{ sessionId: string }>;
  searchParams: Promise<{ error?: string; notice?: string }>;
}) {
  const { sessionId } = await params;
  const query = await searchParams;
  await requireStaffHospital();

  const queue = await queueGet<Paginated<QueueEntryView>>(
    `/sessions/${sessionId}/queue?limit=${LIMIT}`,
  );

  const outstanding = queue.items.filter((e) => AWAITING.includes(e.status)).length;
  const alreadyHere = queue.items.filter((e) => e.status === 'CHECKED_IN' || e.status === 'READY');

  return (
    <>
      <header className="mb-4">
        <Link
          href={`/queue/${sessionId}`}
          className="mb-1.5 inline-flex items-center gap-1 text-caption text-ink-muted transition-colors hover:text-ink"
        >
          <Icon name="arrow-left" className="h-3 w-3" />
          Back to the board
        </Link>
        <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2">
          <h1 className="text-h1 text-ink">Check in</h1>
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={outstanding > 0 ? 'info' : 'success'} icon={outstanding > 0 ? 'home' : 'check'}>
              {outstanding} still to arrive{queue.total > queue.items.length ? ' on this page' : ''}
            </Badge>
            <Badge tone="brand" icon="check-circle">
              {alreadyHere.length} here{queue.total > queue.items.length ? ' on this page' : ''}
            </Badge>
          </div>
        </div>
      </header>

      {/*
        A confirmation names the token AND the patient, so a mis-scan is visible
        before the wrong person is called in. Full width and above everything else,
        because a receptionist glances up from the patient in front of them.
      */}
      {(query.error !== undefined || query.notice !== undefined) && (
        <div className="mb-4 flex flex-col gap-2">
          <ErrorBanner message={query.error} />
          <SuccessBanner message={query.notice === '1' ? await readQueueNotice(sessionId) ?? 'Action completed. Confirm the updated patient record below.' : undefined} />
        </div>
      )}

      <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,380px)_minmax(0,1fr)]">
        <div className="flex flex-col gap-4">
          <Card title="Scan the token QR">
            <p className="mb-3 text-caption text-ink-muted">
              Your browser will ask for permission to use the camera the first time. If you decline
              it, or there is no camera, the two methods below still work.
            </p>
            <Scanner sessionId={sessionId} />
          </Card>

          <Card title="Or type the token number">
            <form action={checkInByToken} className="flex items-end gap-2">
              <input type="hidden" name="sessionId" value={sessionId} />
              <div className="min-w-0 flex-1">
                <label className={label + ' mb-1 block'} htmlFor="token-number">
                  Token
                </label>
                <input
                  id="token-number"
                  name="tokenNumber"
                  autoFocus
                  autoComplete="off"
                  placeholder="27 or A027"
                  className={input + ' tabular-nums'}
                />
              </div>
              <button type="submit" className={btn('primary')}>
                Check in
              </button>
            </form>
            <p className="mt-2.5 text-caption text-ink-muted">
              Works with a flat battery and with no camera. Scanning the same patient twice is safe
              — it says so again and changes nothing.
            </p>
          </Card>
        </div>

        <ArrivalList key={sessionId} sessionId={sessionId} entries={queue.items} hasMore={queue.total > queue.items.length} />
      </div>
    </>
  );
}
