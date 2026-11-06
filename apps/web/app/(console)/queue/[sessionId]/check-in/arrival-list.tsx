'use client';
import { useState } from 'react';
import type { QueueEntryView } from '@opd/contracts';
import { EmptyState, TokenChip, btn, input, label } from '../../../../../components/ui';
import { FormSubmit } from '../../../../../components/form-submit';
import { StatusPill } from '../../ui';
import { checkInByToken } from './actions';

/** Search stays in this page's memory, never in URLs, storage or server logs. */
export function ArrivalList({ entries, sessionId, hasMore }: { entries: QueueEntryView[]; sessionId: string; hasMore: boolean }) {
  const [search, setSearch] = useState('');
  const term = search.trim().toLowerCase();
  const awaiting = entries.filter(e => ['CONFIRMED', 'VIRTUAL_WAITING'].includes(e.status))
    .filter(e => !term || e.patientName.toLowerCase().includes(term) || e.tokenLabel.toLowerCase().includes(term));
  const here = entries.filter(e => ['CHECKED_IN', 'READY'].includes(e.status));
  return <section className="overflow-hidden rounded-lg border border-line bg-surface shadow-xs">
    <header className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3 border-b border-line-soft px-4 py-3">
      <h2 className="text-h3 text-ink">Or find them in the list</h2>
      <form className="flex items-end gap-2" onSubmit={e => e.preventDefault()}>
        <div className="w-full min-w-[12rem] sm:w-64">
          <label className={label + ' sr-only'} htmlFor="private-patient-search">Search by name or token</label>
          <input id="private-patient-search" autoComplete="off" spellCheck={false} maxLength={100} value={search} onChange={e => setSearch(e.target.value)} placeholder="Name, or A027" className={input} />
        </div>
        {search && <button type="button" className={btn('ghost')} onClick={() => setSearch('')}>Clear</button>}
      </form>
    </header>
    {hasMore && <p className="border-b border-line p-4 text-body">Showing one page of this session. Use the signed QR or token lookup above for any booking not listed here.</p>}
    {awaiting.length === 0 ? <EmptyState icon={term ? 'search' : 'check'} title={term ? 'No matching arrival on this page' : hasMore ? 'No arrivals on this page' : 'Everyone who booked has arrived'}>
      {term ? 'They may already be checked in, or the booking may be under a relative’s name.' : hasMore ? 'This is not the whole session. Use token lookup or QR check-in.' : 'Nothing left to check in for this session.'}
    </EmptyState> : <ul className="divide-y divide-line-soft">{awaiting.map(entry => <li key={entry.id} className="flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-3 transition-colors hover:bg-hover">
      <TokenChip>{entry.tokenLabel}</TokenChip><span className="min-w-0 flex-1 truncate text-body font-medium text-ink">{entry.patientName}</span><StatusPill status={entry.status} />
      <form action={checkInByToken}><input type="hidden" name="sessionId" value={sessionId} /><input type="hidden" name="tokenNumber" value={entry.tokenNumber} />
        <FormSubmit className={btn('quiet', 'sm')} pendingLabel="Checking in…">Check in</FormSubmit>
      </form>
    </li>)}</ul>}
    {here.length > 0 && <div className="border-t border-line bg-canvas px-4 py-3"><p className="mb-2 text-eyebrow uppercase text-ink-muted">Already checked in{hasMore ? ' on this page' : ''} · {here.length}</p><div className="flex flex-wrap gap-1.5">{here.map(entry => <TokenChip key={entry.id} size="sm">{entry.tokenLabel}</TokenChip>)}</div></div>}
  </section>;
}
