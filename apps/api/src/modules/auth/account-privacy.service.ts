import { Injectable } from '@nestjs/common';
import { verify as argonVerify } from '@node-rs/argon2';
import type { AccountActionResponse, RequestAccountDeletion } from '@opd/contracts';
import { PrismaService } from '../../prisma/prisma.service';
import { DatabaseIdentityFor, setDatabaseIdentity } from '../../prisma/database-context';
import { UnauthorizedError } from '../../common/errors';
import { PatientsService } from '../patients/patients.service';
import { NotificationsService } from '../notifications/notifications.service';
import { PaymentsService } from '../payments/payments.service';
import { RealtimeGateway } from '../../realtime/realtime.gateway';
import { BookingAccessService } from '../queue/booking-access.service';
import { lockBookingAccount } from '../queue/booking-account-lock';

const PENDING = { message: 'Your deletion request is saved. New reservations are blocked. Active consultations or clinic staff access need a handover before deletion can finish. Contact pankajsemwal.careers@gmail.com for follow-up.', deleted: false };

@Injectable()
export class AccountPrivacyService {
  constructor(private readonly prisma: PrismaService, private readonly patients: PatientsService,
    private readonly notifications: NotificationsService, private readonly payments: PaymentsService,
    private readonly realtime: RealtimeGateway, private readonly bookingAccess: BookingAccessService) {}

  @DatabaseIdentityFor((accountId: string) => ({ accountId, purpose: 'account' }))
  async request(accountId: string, input: RequestAccountDeletion): Promise<AccountActionResponse> {
    const account = await this.prisma.account.findUnique({ where: { id: accountId } });
    if (!account?.passwordHash || account.deletedAt || !(await argonVerify(account.passwordHash, input.password))) throw new UnauthorizedError('Confirm your current password, or request deletion by email from the public deletion page.');
    await this.prisma.$transaction(async tx => {
      await tx.$queryRaw`SELECT "id" FROM "Account" WHERE "id" = ${accountId} FOR UPDATE`;
      const current = await tx.account.findUnique({ where: { id: accountId } });
      if (!current || current.deletedAt || current.authVersion !== account.authVersion) throw new UnauthorizedError();
      await tx.account.update({ where: { id: accountId }, data: { deletionRequestedAt: current.deletionRequestedAt ?? new Date() } });
    });
    return this.finishRequest(accountId);
  }

  /** Also called by the operator's retry command after any clinical/staff handover. */
  @DatabaseIdentityFor((accountId: string) => ({ accountId, purpose: 'account' }))
  async finishRequest(accountId: string): Promise<AccountActionResponse> {
    const account = await this.prisma.account.findUnique({ where: { id: accountId },
      include: { memberships: { where: { status: { in: ['ACTIVE', 'INVITED'] } }, select: { id: true } } } });
    if (!account?.deletionRequestedAt) throw new UnauthorizedError('No verified deletion request exists');
    if (account.deletedAt) return { message: 'Account deletion is complete.', deleted: true };
    if (account.memberships.length || !(await this.payments.cancelForAccountDeletion(accountId))) return PENDING;
    setDatabaseIdentity({ purpose: 'account-deletion' });
    const completed = await this.prisma.$transaction(async tx => {
      await lockBookingAccount(tx, accountId);
      await tx.$queryRaw`SELECT "id" FROM "Account" WHERE "id" = ${accountId} FOR UPDATE`;
      // New reservations serialize on this same account lock and refuse pending deletion.
      if (await this.payments.hasActiveEntries(accountId, tx)) return false;
      const staff = await tx.account.findUnique({ where: { id: accountId }, select: { memberships: { where: { status: { in: ['ACTIVE', 'INVITED'] } }, select: { id: true } } } });
      if (staff?.memberships.length) return false;
      await this.patients.eraseAccountDetails(accountId, tx);
      await this.bookingAccess.eraseForAccount(accountId, tx);
      await this.notifications.eraseAccountData(accountId, tx, true);
      await tx.refreshToken.deleteMany({ where: { accountId } });
      await tx.accountActionToken.deleteMany({ where: { accountId } });
      await tx.account.update({ where: { id: accountId }, data: {
        email: `deleted+${accountId}@kramya.invalid`, passwordHash: null, googleId: null,
        emailVerifiedAt: null, remoteBookingApprovedAt: null, deletedAt: new Date(), authVersion: { increment: 1 },
      } });
      return true;
    });
    if (!completed) return PENDING;
    this.realtime.disconnectAccount(accountId);
    return { message: 'Account login, contact details, family profile details and notification data have been removed. Limited pseudonymous visit, audit and historical payment records remain for operational and legitimate retention purposes. Contact the clinic about records it holds separately.', deleted: true };
  }
}
