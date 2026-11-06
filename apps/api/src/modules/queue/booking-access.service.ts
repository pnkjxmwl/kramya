import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import type { BookingAccessReview, ReviewBookingAccessRequest } from '@opd/contracts';
import { PrismaService } from '../../prisma/prisma.service';
import { NotFoundError, ValidationFailedError } from '../../common/errors';
import { lockBookingAccount } from './booking-account-lock';

@Injectable()
export class BookingAccessService {
  constructor(private readonly prisma: PrismaService) {}

  private async entry(sessionId: string, entryId: string, hospitalId: string) {
    const row = await this.prisma.queueEntry.findFirst({ where: { id: entryId, sessionId, hospitalId },
      select: { patientId: true, accountId: true, patient: { select: { name: true, erasedAt: true } } } });
    if (!row || !row.accountId) throw new NotFoundError('No app reservation matches this clinic session.');
    return row;
  }

  async read(sessionId: string, entryId: string, hospitalId: string): Promise<BookingAccessReview> {
    const entry = await this.entry(sessionId, entryId, hospitalId);
    const control = await this.prisma.bookingAccess.findUnique({ where: { hospitalId_patientId: { hospitalId, patientId: entry.patientId } } });
    // A report over this clinic only. Session closure is shown separately and never
    // treated as evidence of deliberate misuse. Count visits, not repeated events.
    const [counts] = await this.prisma.$queryRaw<{ manual: number; closure: number }[]>`
      SELECT COUNT(DISTINCT CASE WHEN e."actorType"='STAFF' AND COALESCE(e.metadata->>'atSessionEnd','false') <> 'true' THEN e."entryId" END)::int AS manual,
        COUNT(DISTINCT CASE WHEN e.metadata->>'atSessionEnd'='true' THEN e."entryId" END)::int AS closure
      FROM "QueueEvent" e JOIN "QueueEntry" q ON q.id=e."entryId"
      WHERE e."hospitalId"=${hospitalId} AND q."hospitalId"=${hospitalId} AND q."patientId"=${entry.patientId}
        AND e.type='ENTRY_NO_SHOW' AND e."createdAt">=${new Date(Date.now() - 30 * 86_400_000)}`;
    return { patientName: entry.patient.name, pausedUntil: control?.pausedUntil?.toISOString() ?? null,
      reviewAllowed: entry.patient.erasedAt === null,
      reason: control?.reason ?? null, reviewedAt: control?.reviewedAt.toISOString() ?? null,
      manuallyMarkedNoShowsIn30Days: counts?.manual ?? 0, sessionEndNoShowsIn30Days: counts?.closure ?? 0 };
  }

  async review(sessionId: string, entryId: string, hospitalId: string, reviewer: string, input: ReviewBookingAccessRequest): Promise<BookingAccessReview> {
    const now = new Date();
    const until = input.pausedUntil === null ? null : new Date(input.pausedUntil);
    if (until && (until <= now || until.getTime() > now.getTime() + 7 * 86_400_000)) {
      throw new ValidationFailedError('Choose a future pause of at most seven days, or lift the pause.');
    }
    const entry = await this.entry(sessionId, entryId, hospitalId);
    await this.prisma.$transaction(async tx => {
      // Same lock order as remote reservations. A pause cannot race a new booking.
      await lockBookingAccount(tx, entry.accountId!);
      const patient = await tx.patient.findUnique({ where: { id: entry.patientId }, select: { erasedAt: true } });
      if (!patient || patient.erasedAt) throw new NotFoundError('This profile is no longer available for a booking review.');
      await tx.$queryRaw`SELECT id FROM "OPDSession" WHERE id=${sessionId} AND "hospitalId"=${hospitalId} FOR UPDATE`;
      await tx.bookingAccess.upsert({ where: { hospitalId_patientId: { hospitalId, patientId: entry.patientId } },
        create: { hospitalId, patientId: entry.patientId, pausedUntil: until, reason: input.reason, reviewedBy: reviewer, reviewedAt: now },
        update: { pausedUntil: until, reason: input.reason, reviewedBy: reviewer, reviewedAt: now } });
      await tx.auditLog.create({ data: { hospitalId, actorType: 'STAFF', actorId: reviewer,
        action: 'booking.ACCESS_REVIEWED', entityType: 'Patient', entityId: entry.patientId, reason: input.reason,
        metadata: { pausedUntil: until?.toISOString() ?? null, sessionId, entryId }, createdAt: now } });
    });
    return this.read(sessionId, entryId, hospitalId);
  }

  async eraseForAccount(accountId: string, tx: Prisma.TransactionClient): Promise<void> {
    await tx.bookingAccess.deleteMany({ where: { patient: { accountId } } });
  }
}
