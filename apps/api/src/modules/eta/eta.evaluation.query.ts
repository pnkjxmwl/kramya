import type { PrismaClient } from '@prisma/client';
import type { RecordedForecast } from './eta.evaluation';

/** Use immutable first-call events: requeue clears/replaces QueueEntry.calledAt. */
export async function loadRecordedForecasts(
  prisma: Pick<PrismaClient, 'queueEntry'>,
  hospitalId: string,
  from: Date,
  to: Date,
): Promise<RecordedForecast[]> {
  const rows = await prisma.queueEntry.findMany({
    where: { hospitalId, session: { scheduledStart: { gte: from, lt: to } } },
    select: {
      predictedCallFrom: true,
      predictedCallTo: true,
      consultStartedAt: true,
      events: {
        where: { type: 'ENTRY_CALLED' },
        orderBy: { createdAt: 'asc' },
        take: 1,
        select: { createdAt: true },
      },
      notifications: {
        where: { type: 'LEAVE_NOW' },
        orderBy: { createdAt: 'asc' },
        take: 1,
        select: { createdAt: true, sentAt: true },
      },
    },
    take: 10_001,
  });
  if (rows.length > 10_000)
    throw new Error('More than 10000 entries; narrow the reporting interval.');
  return rows.map((row) => ({
    from: row.predictedCallFrom,
    to: row.predictedCallTo,
    recordedAt: row.notifications[0]?.createdAt ?? null,
    submittedAt: row.notifications[0]?.sentAt ?? null,
    calledAt: row.events[0]?.createdAt ?? null,
    startedAt: row.consultStartedAt,
  }));
}
