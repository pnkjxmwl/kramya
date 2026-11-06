import { resetEnvCache } from '../src/config/env';
import type { INestApplication } from '@nestjs/common';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { auth, createTestApp, request, resetDb, signup } from './helpers';
import { PrismaService } from '../src/prisma/prisma.service';
import { AccountMailer } from '../src/modules/auth/account-mailer';
import type { AccountActionPurpose } from '@opd/contracts';
import { AccountPrivacyService } from '../src/modules/auth/account-privacy.service';
import { dateColumnFromString, istToday } from '../src/common/ist';

class FakeMail {
  configured = true;
  sent: { email: string; purpose: AccountActionPurpose; token: string }[] = [];
  async send(email: string, purpose: AccountActionPurpose, token: string) { this.sent.push({ email, purpose, token }); }
}

describe('account verification, recovery and deletion', () => {
  let app: INestApplication, prisma: PrismaService;
  const mail = new FakeMail();
  const http = () => request(app.getHttpServer());
  beforeAll(async () => { process.env.BOOKING_PAYMENT_MODE = 'AT_CLINIC'; resetEnvCache(); ({ app, prisma } = await createTestApp([{ provide: AccountMailer, useValue: mail }])); });
  afterAll(() => app.close());
  beforeEach(async () => { await resetDb(prisma); mail.sent = []; mail.configured = true; });
  const requestAction = (email: string, purpose: string) => http().post('/auth/account-actions/request').send({ email, purpose });
  const confirm = (purpose: string, token: string, extra = {}) => http().post('/auth/account-actions/confirm').send({ purpose, token, ...extra });

  it('does not issue proofs or reveal account existence when email delivery is disabled', async () => {
    const user = await signup(app, 'disabled-mail@test.dev');
    mail.configured = false;
    const known = await requestAction('disabled-mail@test.dev', 'RESET_PASSWORD').expect(503);
    const unknown = await requestAction('missing-mail@test.dev', 'RESET_PASSWORD').expect(503);
    expect(known.body.error.message).toBe(unknown.body.error.message);
    await http().post('/me/email-verification').set(auth(user.accessToken)).send({}).expect(503);
    expect(await prisma.accountActionToken.count()).toBe(0);
    expect(mail.sent).toHaveLength(0);
  });

  it('returns a generic response and stores only a hash, with bounded resend', async () => {
    await signup(app, 'recovery@test.dev');
    const known = await requestAction('recovery@test.dev', 'RESET_PASSWORD').expect(200);
    const unknown = await requestAction('unknown@test.dev', 'RESET_PASSWORD').expect(200);
    expect(known.body).toEqual(unknown.body);
    expect(mail.sent).toHaveLength(1);
    const stored = await prisma.accountActionToken.findFirstOrThrow();
    expect(stored.tokenHash).not.toBe(mail.sent[0]!.token);
    expect(stored.tokenHash).toHaveLength(64);
    expect(JSON.stringify(known.body)).not.toContain(mail.sent[0]!.token);
    await requestAction('recovery@test.dev', 'RESET_PASSWORD').expect(200);
    expect(mail.sent).toHaveLength(1);
  });

  it('verifies mailbox proof once and refuses cross-purpose or expired proofs', async () => {
    const user = await signup(app, 'verify@test.dev');
    await http().post('/me/email-verification').set(auth(user.accessToken)).send({}).expect(200);
    const token = mail.sent[0]!.token;
    await confirm('RESET_PASSWORD', token, { newPassword: 'another-long-password' }).expect(401);
    await confirm('VERIFY_EMAIL', token).expect(200);
    expect((await http().get('/me').set(auth(user.accessToken)).expect(200)).body.emailVerified).toBe(true);
    await confirm('VERIFY_EMAIL', token).expect(401);
    await requestAction('verify@test.dev', 'RESET_PASSWORD').expect(200);
    await prisma.accountActionToken.updateMany({ where: { kind: 'RESET_PASSWORD' }, data: { expiresAt: new Date(0) } });
    await confirm('RESET_PASSWORD', mail.sent[1]!.token, { newPassword: 'another-long-password' }).expect(401);
  });

  it('resets once under concurrency and invalidates access, refresh and registered devices', async () => {
    const user = await signup(app, 'reset@test.dev');
    await http().post('/me/push-tokens').set(auth(user.accessToken)).send({ token: 'reset-device-token', platform: 'android', deliveryVersion: 2 }).expect(201);
    await requestAction('reset@test.dev', 'RESET_PASSWORD').expect(200);
    const outcomes = await Promise.all([confirm('RESET_PASSWORD', mail.sent[0]!.token, { newPassword: 'new-long-password' }), confirm('RESET_PASSWORD', mail.sent[0]!.token, { newPassword: 'new-long-password' })]);
    expect(outcomes.map(r => r.status).sort()).toEqual([200, 401]);
    await http().get('/me').set(auth(user.accessToken)).expect(401);
    await http().post('/auth/refresh').send({ refreshToken: user.refreshToken }).expect(401);
    await http().post('/auth/login').send({ email: 'reset@test.dev', password: 'correct-horse-battery' }).expect(401);
    await http().post('/auth/login').send({ email: 'reset@test.dev', password: 'new-long-password' }).expect(200);
    expect(await prisma.pushToken.count()).toBe(0);
  });

  it('removes credentials and profile details without accepting another account or wrong password', async () => {
    const user = await signup(app, 'delete@test.dev');
    await http().post('/patients').set(auth(user.accessToken)).send({ name: 'TEST Private', relation: 'SELF' }).expect(201);
    await http().post('/me/account-deletion').set(auth(user.accessToken)).send({ password: 'wrong', confirmation: 'DELETE' }).expect(401);
    const result = await http().post('/me/account-deletion').set(auth(user.accessToken)).send({ password: 'correct-horse-battery', confirmation: 'DELETE' }).expect(200);
    expect(result.body.deleted).toBe(true);
    const account = await prisma.account.findUniqueOrThrow({ where: { id: user.accountId } });
    expect(account.email).not.toBe('delete@test.dev');
    expect(account.passwordHash).toBeNull(); expect(account.deletedAt).not.toBeNull();
    expect((await prisma.patient.findFirstOrThrow()).name).toBe('Deleted patient');
    expect(await prisma.refreshToken.count()).toBe(0);
    await http().get('/me').set(auth(user.accessToken)).expect(401);
  });

  it('supports externally requested deletion through mailbox proof', async () => {
    const user = await signup(app, 'external-delete@test.dev');
    await requestAction('external-delete@test.dev', 'DELETE_ACCOUNT').expect(200);
    await confirm('DELETE_ACCOUNT', mail.sent[0]!.token).expect(400);
    expect((await confirm('DELETE_ACCOUNT', mail.sent[0]!.token, { confirmation: 'DELETE' }).expect(200)).body.deleted).toBe(true);
    await http().get('/me').set(auth(user.accessToken)).expect(401);
  });

  it('cancels an upcoming reservation through the queue command while retaining the audit', async () => {
    const user = await signup(app, 'booked-delete@test.dev');
    const person = await prisma.patient.create({ data: { accountId: user.accountId, name: 'TEST Booked', dob: new Date('1990-01-01'), abhaId: 'TEST-ONLY' } });
    const hospital = await prisma.hospital.create({ data: { name: 'TEST Privacy Clinic', city: 'Mumbai', status: 'VERIFIED' } });
    const department = await prisma.department.create({ data: { hospitalId: hospital.id, name: 'General' } });
    const doctor = await prisma.doctor.create({ data: { hospitalId: hospital.id, departmentId: department.id, name: 'Dr TEST' } });
    const session = await prisma.oPDSession.create({ data: { hospitalId: hospital.id, departmentId: department.id, originalDoctorId: doctor.id, currentProviderDoctorId: doctor.id, date: dateColumnFromString(istToday()), scheduledStart: new Date(Date.now() + 3_600_000), scheduledEnd: new Date(Date.now() + 7_200_000), feePaise: 50000 } });
    const reserved = await http().post(`/sessions/${session.id}/reserve`).set(auth(user.accessToken)).send({ patientId: person.id }).expect(201);
    const deleted = await http().post('/me/account-deletion').set(auth(user.accessToken)).send({ password: 'correct-horse-battery', confirmation: 'DELETE' }).expect(200);
    expect(deleted.body.deleted).toBe(true);
    expect((await prisma.queueEntry.findUniqueOrThrow({ where: { id: reserved.body.entry.id } })).status).toBe('CANCELLED');
    expect(await prisma.auditLog.count({ where: { action: 'queue.CANCEL_ENTRY' } })).toBe(1);
    expect((await prisma.patient.findUniqueOrThrow({ where: { id: person.id } })).abhaId).toBeNull();
  });

  it('keeps a staff deletion request pending for clinic access handover', async () => {
    const user = await signup(app, 'staff-delete@test.dev');
    const hospital = await prisma.hospital.create({ data: { name: 'TEST Staff Clinic', city: 'Mumbai' } });
    await prisma.hospitalStaff.create({ data: { hospitalId: hospital.id, accountId: user.accountId, role: 'ADMIN' } });
    const result = await http().post('/me/account-deletion').set(auth(user.accessToken)).send({ password: 'correct-horse-battery', confirmation: 'DELETE' }).expect(200);
    expect(result.body.deleted).toBe(false);
    expect((await prisma.account.findUniqueOrThrow({ where: { id: user.accountId } })).deletionRequestedAt).not.toBeNull();
    await prisma.hospitalStaff.updateMany({ where: { accountId: user.accountId }, data: { status: 'DISABLED' } });
    expect((await app.get(AccountPrivacyService).finishRequest(user.accountId)).deleted).toBe(true);
  });
});
