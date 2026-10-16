import { randomBytes } from 'node:crypto';
import { HOLDS_A_SLOT, nextEntryStatus } from '../state-machine';
import type { CommandContext, QueueEntryRow } from '../queue.service';

const ENTRY_INCLUDE = { patient: { select: { id: true, name: true } } } as const;

/**
 * The check-in reference printed as a QR on the token card.
 *
 * Opaque and non-enumerable (docs/Rules.md 10): 24 random bytes, so it carries no
 * PII, is not derived from the entry id, and cannot be walked. **Phase 6 replaces
 * this with a SIGNED payload** so a tampered code is rejected without a database
 * lookup; until then the code's only property is that it is unguessable, which is
 * enough for the `unique` lookup `check-in` already does.
 *
 * base64url so it survives a URL, a QR encoder and a receptionist reading it aloud.
 */
const newCheckInCode = (): string => randomBytes(24).toString('base64url');

/**
 * P5-BE-02 · turn a paid hold into a booking.
 *
 * **Not a whole command - a step inside one.** The payments module runs this within
 * its own `runCommand`, so the entry transition and the `Payment` row commit
 * together or not at all. Anything else has a failure mode where the patient has
 * paid and has no token, or has a token we have no record of paying for.
 *
 * The queue module keeps ownership of the entry write (docs/CLAUDE.md 3); the
 * payments module writes only `Payment`, through the same `ctx.tx`.
 *
 * `command` is chosen by the caller from the entry's current status:
 *   - `CONFIRM_PAYMENT` - the ordinary path, RESERVED -> CONFIRMED, and the
 *     idempotent CONFIRMED -> CONFIRMED that a replayed webhook takes.
 *   - `REINSTATE` - the hold had already lapsed and the money arrived anyway. Its
 *     own command so the audit trail says which of the two happened.
 *
 * If the status changes between that choice and this write, the state machine
 * rejects it and the webhook is answered non-2xx, so Razorpay retries and the next
 * attempt sees the settled state. A retry is the right outcome there; guessing is
 * not.
 */
export async function applyPaymentConfirmation(
  ctx: CommandContext,
  entryId: string,
  command: 'CONFIRM_PAYMENT' | 'REINSTATE',
): Promise<QueueEntryRow> {
  const entry = await ctx.entryInSession(entryId);
  const status = nextEntryStatus(command, entry.status);

  if (entry.status === status && entry.checkInCode !== null) {
    // A duplicate webhook. Already confirmed, already has its code: write nothing,
    // record nothing. Re-stamping would move the join time and mint a second code,
    // invalidating the QR the patient is already holding on screen.
    return entry;
  }

  const updated = await ctx.tx.queueEntry.update({
    where: { id: entry.id },
    data: {
      status,
      // Issued once and never rotated - the patient may already have screenshotted it.
      checkInCode: entry.checkInCode ?? newCheckInCode(),
      // The hold is over; it either became a booking or it never expires again.
      reservationExpiresAt: null,
    },
    include: ENTRY_INCLUDE,
  });

  ctx.record({
    type: 'ENTRY_CONFIRMED',
    entryId: entry.id,
    metadata: { from: entry.status, to: status, tokenLabel: entry.tokenLabel, via: command },
  });

  return updated;
}

/**
 * Why a captured payment must NOT become (or revive) a booking - or null when it may.
 *
 * Asked under the session lock, before `applyPaymentConfirmation`, by the one
 * caller that turns money into tokens. A non-null answer means the caller refunds
 * the capture in full instead. Both rules are "would join have allowed this?",
 * asked again at the moment the money lands:
 *
 * **A person withdrew it.** `REINSTATE` exists for the hold that LAPSED while the
 * patient was paying - the webhook wins that race, because nobody decided anything.
 * It never existed for a booking a patient or the desk cancelled on purpose. The
 * state machine's own comment promised "a manually cancelled entry cannot be
 * resurrected by a stray webhook", and nothing enforced it: a patient who cancelled
 * an unpaid hold and whose UPI debit then went through got the booking back, now
 * cancellable only at the late-cancellation tier. Worse, a REPLAYED capture for a
 * booking already cancelled and refunded revived it, and the patient kept both the
 * refund and the token. The cancellation event says which command did it.
 *
 * **They already hold a place.** Join refuses a second booking with
 * `AlreadyInQueue`, but only while the first hold is live. Once it has expired (and
 * before the sweeper gets to it) a fresh join opens a second hold with its own
 * order - and both orders stay payable. Pay the old checkout still open in one tab
 * and the new one in another, and the same patient held two tokens.
 */
export async function whyPaymentCannotBook(
  ctx: CommandContext,
  entry: QueueEntryRow,
): Promise<string | null> {
  if (entry.status === 'CANCELLED') {
    const cancellation = await ctx.tx.queueEvent.findFirst({
      where: { entryId: entry.id, type: 'ENTRY_CANCELLED' },
      orderBy: { createdAt: 'desc' },
      select: { metadata: true },
    });
    const via = (cancellation?.metadata as { via?: unknown } | null)?.via;
    if (via !== 'EXPIRE_RESERVATION') {
      return 'The booking was cancelled before the payment arrived';
    }
  }

  const other = await ctx.tx.queueEntry.findFirst({
    where: {
      sessionId: entry.sessionId,
      patientId: entry.patientId,
      id: { not: entry.id },
      // Every place join would have refused a second booking for. A RESERVED hold is
      // not a booking - whichever of two holds is paid first wins.
      status: { in: HOLDS_A_SLOT.filter((s) => s !== 'RESERVED') },
    },
    select: { tokenLabel: true },
  });
  if (other !== null) {
    return `This patient already holds ${other.tokenLabel} in this session`;
  }

  return null;
}
