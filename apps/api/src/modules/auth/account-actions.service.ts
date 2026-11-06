import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { hash as argonHash } from '@node-rs/argon2';
import { createHash, randomBytes } from 'node:crypto';
import type { AccountActionPurpose, AccountActionResponse, ConfirmAccountAction, RequestAccountAction } from '@opd/contracts';
import { PrismaService } from '../../prisma/prisma.service';
import { DatabaseIdentityFor, setDatabaseIdentity } from '../../prisma/database-context';
import { UnauthorizedError } from '../../common/errors';
import { AccountMailer } from './account-mailer';
import { AccountPrivacyService } from './account-privacy.service';
import { NotificationsService } from '../notifications/notifications.service';
import { RealtimeGateway } from '../../realtime/realtime.gateway';

const hash = (token: string) => createHash('sha256').update(token).digest('hex');
const ACK = { message: 'If this address is eligible, a confirmation link will arrive shortly. Check spam or contact support if it does not arrive.' };

@Injectable()
export class AccountActionsService {
  private readonly log = new Logger(AccountActionsService.name);
  constructor(private readonly prisma: PrismaService, private readonly mail: AccountMailer,
    private readonly privacy: AccountPrivacyService, private readonly notifications: NotificationsService,
    private readonly realtime: RealtimeGateway) {}

  @DatabaseIdentityFor((input: RequestAccountAction) => ({ purpose: 'auth', email: input.email }))
  async requestPublic(input: RequestAccountAction): Promise<AccountActionResponse> {
    if (!this.mail.configured) throw new ServiceUnavailableException('Email delivery is not configured. Contact pankajsemwal.careers@gmail.com.');
    const account = await this.prisma.account.findUnique({ where: { email: input.email } });
    if (account && !account.deletedAt) {
      setDatabaseIdentity({ accountId: account.id });
      await this.issue(account.id, account.email, input.purpose);
    }
    return ACK;
  }

  @DatabaseIdentityFor((accountId: string) => ({ accountId, purpose: 'account' }))
  async requestVerification(accountId: string): Promise<AccountActionResponse> {
    if (!this.mail.configured) throw new ServiceUnavailableException('Email delivery is not configured. Contact Kramya support.');
    const account = await this.prisma.account.findUnique({ where: { id: accountId } });
    if (account && !account.deletedAt && !account.emailVerifiedAt) await this.issue(account.id, account.email, 'VERIFY_EMAIL');
    return ACK;
  }

  private async issue(accountId: string, email: string, kind: AccountActionPurpose): Promise<void> {
    const token = randomBytes(32).toString('base64url');
    const created = await this.prisma.$transaction(async tx => {
      await tx.$queryRaw`SELECT "id" FROM "Account" WHERE "id" = ${accountId} FOR UPDATE`;
      const current = await tx.account.findUnique({ where: { id: accountId } });
      if (!current || current.deletedAt || current.email !== email) return false;
      const now = new Date();
      const recent = await tx.accountActionToken.findFirst({ where: { accountId, kind, createdAt: { gt: new Date(now.getTime() - 60_000) } } });
      const todayCount = await tx.accountActionToken.count({ where: { accountId, createdAt: { gt: new Date(now.getTime() - 86_400_000) } } });
      if (recent || todayCount >= 5) return false;
      await tx.accountActionToken.updateMany({ where: { accountId, kind, consumedAt: null }, data: { consumedAt: now } });
      await tx.accountActionToken.deleteMany({ where: { accountId, expiresAt: { lt: new Date(now.getTime() - 30 * 86_400_000) } } });
      await tx.accountActionToken.create({ data: { accountId, kind, tokenHash: hash(token), expiresAt: new Date(now.getTime() + 30 * 60_000) } });
      return true;
    });
    if (created) {
      try { await this.mail.send(email, kind, token); }
      catch { this.log.warn({ purpose: kind }, 'Account email delivery failed; resend remains available after cooldown'); }
    }
  }

  @DatabaseIdentityFor((input: ConfirmAccountAction) => ({ purpose: 'account-action', actionHash: hash(input.token) }))
  async confirm(input: ConfirmAccountAction): Promise<AccountActionResponse> {
    const invalid = () => new UnauthorizedError('This link is invalid, expired or already used. Request a new one.');
    const proof = await this.prisma.accountActionToken.findUnique({ where: { tokenHash: hash(input.token) } });
    if (!proof || proof.kind !== input.purpose || proof.consumedAt || proof.expiresAt <= new Date()) throw invalid();
    setDatabaseIdentity({ accountId: proof.accountId });
    const newHash = input.purpose === 'RESET_PASSWORD' ? await argonHash(input.newPassword!) : null;
    await this.prisma.$transaction(async tx => {
      await tx.$queryRaw`SELECT "id" FROM "Account" WHERE "id" = ${proof.accountId} FOR UPDATE`;
      const account = await tx.account.findUnique({ where: { id: proof.accountId } });
      const current = await tx.accountActionToken.findUnique({ where: { id: proof.id } });
      if (!account || account.deletedAt || !current || current.consumedAt || current.expiresAt <= new Date()) throw invalid();
      const now = new Date();
      await tx.accountActionToken.update({ where: { id: proof.id }, data: { consumedAt: now } });
      if (input.purpose === 'VERIFY_EMAIL') await tx.account.update({ where: { id: account.id }, data: { emailVerifiedAt: now } });
      if (input.purpose === 'RESET_PASSWORD') {
        await tx.account.update({ where: { id: account.id }, data: { passwordHash: newHash!, emailVerifiedAt: now, authVersion: { increment: 1 } } });
        await tx.refreshToken.updateMany({ where: { accountId: account.id, revokedAt: null }, data: { revokedAt: now } });
        await tx.accountActionToken.updateMany({ where: { accountId: account.id, kind: 'RESET_PASSWORD', consumedAt: null }, data: { consumedAt: now } });
        await this.notifications.eraseAccountData(account.id, tx, false);
      }
      if (input.purpose === 'DELETE_ACCOUNT') await tx.account.update({ where: { id: account.id }, data: { deletionRequestedAt: account.deletionRequestedAt ?? now } });
    });
    if (input.purpose === 'RESET_PASSWORD') this.realtime.disconnectAccount(proof.accountId);
    if (input.purpose === 'DELETE_ACCOUNT') return this.privacy.finishRequest(proof.accountId);
    return { message: input.purpose === 'VERIFY_EMAIL' ? 'Email verified. Return to Kramya and refresh Profile.' : 'Password updated. Sign in again on your devices.' };
  }
}
