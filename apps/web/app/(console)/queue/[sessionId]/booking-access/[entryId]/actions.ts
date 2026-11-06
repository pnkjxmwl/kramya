'use server';
import { apiSend } from '../../../../../../lib/api';
import { runQueueAction, text } from '../../../_run';

export async function reviewBookingAccess(form: FormData): Promise<void> {
  const sessionId = text(form, 'sessionId'), entryId = text(form, 'entryId');
  const path = `/queue/${encodeURIComponent(sessionId)}/booking-access/${encodeURIComponent(entryId)}`;
  await runQueueAction(path, async () => {
    const hours = Number(text(form, 'hours'));
    if (![0, 1, 24, 72, 168].includes(hours)) throw new Error('Invalid pause duration');
    await apiSend('POST', `/sessions/${encodeURIComponent(sessionId)}/booking-access/${encodeURIComponent(entryId)}`, {
      pausedUntil: hours === 0 ? null : new Date(Date.now() + hours * 3_600_000).toISOString(), reason: text(form, 'reason'),
    });
    return 'saved=1';
  });
}
