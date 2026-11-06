import { randomBytes } from 'node:crypto';
import { AlreadyInQueueError } from '../../../common/errors';
import { nextTokenNumber, tokenLabel } from '../call-order';
import { HOLDS_A_SLOT } from '../state-machine';
import type { QueueActor, QueueEntryRow, QueueService } from '../queue.service';
import { assertPatientBelongsToAccount, assertRegistrationOpen, assertRemoteBookingAllowed } from './join';

const ENTRY_INCLUDE = { patient: { select: { id: true, name: true } } } as const;

/** A confirmed reservation is not a financial transaction. No gateway is called. */
export function reserveAtClinic(
  queue: QueueService,
  sessionId: string,
  actor: QueueActor,
  input: { patientId: string; accountId: string },
): Promise<QueueEntryRow> {
  return queue.runCommand({
    sessionId, actor, command: 'RESERVE_AT_CLINIC',
    handler: async (ctx) => {
      await assertPatientBelongsToAccount(ctx, input.patientId, input.accountId);
      // The session lock serializes retries and competing bookings/capacity checks.
      const existing = await ctx.tx.queueEntry.findFirst({
        where: { sessionId, patientId: input.patientId, status: { in: [...HOLDS_A_SLOT] },
          NOT: { status: 'RESERVED', reservationExpiresAt: { lte: ctx.now } } },
        orderBy: { joinedAt: 'desc' }, include: ENTRY_INCLUDE,
      });
      if (existing) {
        // Never convert a legacy payment hold or a terminal visit into a new booking.
        if (['CONFIRMED', 'VIRTUAL_WAITING', 'CHECKED_IN', 'READY', 'CALLED', 'IN_CONSULTATION', 'SKIPPED'].includes(existing.status)
          && existing.checkInCode !== null) return existing;
        throw new AlreadyInQueueError(existing.id);
      }
      await assertRemoteBookingAllowed(ctx, input.patientId, input.accountId);
      await assertRegistrationOpen(ctx);
      const tokenNumber = await nextTokenNumber(ctx);
      const entry = await ctx.tx.queueEntry.create({
        data: { hospitalId: ctx.session.hospitalId, sessionId, patientId: input.patientId,
          accountId: input.accountId, tokenNumber, tokenLabel: tokenLabel(ctx.session.tokenPrefix, tokenNumber),
          type: 'ONLINE', status: 'CONFIRMED', checkInCode: randomBytes(24).toString('base64url'),
          reservationExpiresAt: null },
        include: ENTRY_INCLUDE,
      });
      ctx.record({ type: 'ENTRY_RESERVED', entryId: entry.id,
        metadata: { tokenLabel: entry.tokenLabel, tokenNumber, paymentCollection: 'AT_CLINIC', feePaise: ctx.session.feePaise } });
      ctx.record({ type: 'ENTRY_CONFIRMED', entryId: entry.id,
        metadata: { to: 'CONFIRMED', via: 'RESERVE_AT_CLINIC', paymentCollection: 'AT_CLINIC' } });
      return entry;
    },
  });
}
