import type { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { DEFAULT_QUEUE_POLICY } from '@opd/contracts';
import { auth, createTestApp, request, resetDb, signup } from './helpers';
import { PrismaService } from '../src/prisma/prisma.service';
import { resetEnvCache, env } from '../src/config/env';
import { dateColumnFromString, istToday } from '../src/common/ist';
import { DeploymentIdentityService } from '../src/prisma/deployment-identity.service';

describe('reservation launch controls', () => {
  let app: INestApplication, db: PrismaService;
  let staff: Awaited<ReturnType<typeof signup>>, user: Awaited<ReturnType<typeof signup>>, stranger: Awaited<ReturnType<typeof signup>>;
  let clinic: string, otherClinic: string, session: string, later: string, other: string, patient: string, family: string;
  const http = () => request(app.getHttpServer());
  const reserve = (s: string, p = patient) => http().post(`/sessions/${s}/reserve`).set(auth(user.accessToken)).send({ patientId: p });
  beforeAll(async () => { ({ app, prisma: db } = await createTestApp()); });
  afterAll(() => app.close());
  beforeEach(async () => {
    process.env.REMOTE_BOOKING_ACCESS = 'OPEN_TEST';
    process.env.MAX_PATIENT_PROFILES_PER_ACCOUNT = '20';
    process.env.BOOKING_PAYMENT_MODE = 'AT_CLINIC'; resetEnvCache();
    await resetDb(db);
    staff = await signup(app, 'staff@release.test'); user = await signup(app, 'patient@release.test'); stranger = await signup(app, 'stranger@release.test');
    patient = (await db.patient.create({ data: { accountId: user.accountId, name: 'TEST Patient' } })).id;
    family = (await db.patient.create({ data: { accountId: user.accountId, name: 'TEST Family', relation: 'MOTHER' } })).id;
    const createClinic = async (name: string) => {
      const h = await db.hospital.create({ data: { name, city: 'Mumbai', status: 'VERIFIED' } });
      const d = await db.department.create({ data: { hospitalId: h.id, name: 'OPD' } });
      const doc = await db.doctor.create({ data: { hospitalId: h.id, departmentId: d.id, name: 'Dr TEST' } });
      const make = async (hours: number) => (await db.oPDSession.create({ data: { hospitalId: h.id, departmentId: d.id, originalDoctorId: doc.id,
        currentProviderDoctorId: doc.id, date: dateColumnFromString(istToday()), scheduledStart: new Date(Date.now() + hours * 3_600_000),
        scheduledEnd: new Date(Date.now() + (hours + 2) * 3_600_000), feePaise: 50000, doctorPresence: 'PRESENT' } })).id;
      return { id: h.id, first: await make(1), later: await make(5) };
    };
    const a = await createClinic('TEST Alpha'), b = await createClinic('TEST Beta');
    clinic = a.id; session = a.first; later = a.later; otherClinic = b.id; other = b.later;
    await db.hospitalStaff.create({ data: { hospitalId: clinic, accountId: staff.accountId, role: 'RECEPTION' } });
  });

  it('requires reception check-in even for old policies that disabled it, and exposes arrival guidance', async () => {
    await db.queuePolicy.create({ data: { hospitalId: clinic, ...DEFAULT_QUEUE_POLICY, checkInRequired: false, arrivalInstructions: 'Ground floor OPD desk. Show your token.' } });
    const detail = await http().get(`/sessions/${session}`).set(auth(user.accessToken)).expect(200);
    expect(detail.body.arrivalGuidance.instructions).toContain('Ground floor');
    const booked = await reserve(session).expect(201);
    await http().post(`/sessions/${session}/call-next`).set(auth(staff.accessToken)).send({}).expect(409);
    expect((await db.queueEntry.findUniqueOrThrow({ where: { id: booked.body.entry.id } })).status).toBe('CONFIRMED');
    await http().post(`/sessions/${session}/check-in`).set(auth(staff.accessToken)).send({ tokenNumber: booked.body.entry.tokenNumber }).expect(201);
    const call = await http().post(`/sessions/${session}/call-next`).set(auth(staff.accessToken)).send({}).expect(201);
    expect(call.body.entry.id).toBe(booked.body.entry.id);
  });

  it('scopes reviewed pauses to one patient and clinic, preserving existing tokens and allowing appeal', async () => {
    const booking = await reserve(session).expect(201);
    const path = `/sessions/${session}/booking-access/${booking.body.entry.id}`;
    const pausedUntil = new Date(Date.now() + 3_600_000).toISOString();
    await http().post(path).set(auth(staff.accessToken)).send({ pausedUntil, reason: 'Reviewed repeated duplicate reservations with patient.' }).expect(201);
    await reserve(later).expect(409);
    expect((await reserve(session).expect(201)).body.entry.id).toBe(booking.body.entry.id);
    await reserve(later, family).expect(201);
    await reserve(other).expect(201);
    await http().post(path).set(auth(staff.accessToken)).send({ pausedUntil: null, reason: 'Patient explanation reviewed; online access restored.' }).expect(201);
    // Cancel the other-clinic overlapping reservation before trying again.
    const entry = await db.queueEntry.findFirstOrThrow({ where: { patientId: patient, sessionId: other } });
    await http().post(`/queue-entries/${entry.id}/cancel`).set(auth(user.accessToken)).send({}).expect(201);
    await reserve(later).expect(201);
    expect(await db.auditLog.count({ where: { action: 'booking.ACCESS_REVIEWED' } })).toBe(2);
  });

  it('rejects another clinic, patients, doctors, and permanent or unsupported pauses', async () => {
    const booking = await reserve(session).expect(201);
    const path = `/sessions/${session}/booking-access/${booking.body.entry.id}`;
    await http().get(path).set(auth(user.accessToken)).expect(403);
    await db.hospitalStaff.create({ data: { hospitalId: otherClinic, accountId: stranger.accountId, role: 'ADMIN' } });
    await http().get(path).set(auth(stranger.accessToken)).expect(403);
    await db.hospitalStaff.create({ data: { hospitalId: clinic, accountId: user.accountId, role: 'DOCTOR' } });
    await http().get(path).set(auth(user.accessToken)).expect(403);
    await http().post(path).set(auth(staff.accessToken)).send({ pausedUntil: new Date(Date.now() + 8 * 86_400_000).toISOString(), reason: 'Review cannot make an eight-day restriction.' }).expect(400);
    await http().post(path).set(auth(staff.accessToken)).send({ pausedUntil: null, reason: '' }).expect(400);
    expect(await db.bookingAccess.count()).toBe(0);
  });

  it('cancels absent reservations on early closure, keeping clinic disruption out of no-show evidence', async () => {
    const booking = await reserve(session).expect(201);
    await http().post(`/sessions/${session}/end`).set(auth(staff.accessToken)).send({ reason: 'Doctor called away early' }).expect(201);
    expect((await db.queueEntry.findUniqueOrThrow({ where: { id: booking.body.entry.id } })).status).toBe('CANCELLED');
    expect(await db.queueEvent.count({ where: { type: 'ENTRY_NO_SHOW' } })).toBe(0);
    expect(await db.payment.count()).toBe(0);
  });

  it('separates manual no-show evidence from session-end outcomes for a reception review', async () => {
    const booking = await reserve(session).expect(201);
    const event = { hospitalId: clinic, sessionId: session, entryId: booking.body.entry.id, actorType: 'STAFF' as const, actorId: staff.accountId, type: 'ENTRY_NO_SHOW' as const };
    await db.queueEvent.create({ data: { ...event, metadata: { atSessionEnd: true } } });
    let report = await http().get(`/sessions/${session}/booking-access/${booking.body.entry.id}`).set(auth(staff.accessToken)).expect(200);
    expect(report.body.manuallyMarkedNoShowsIn30Days).toBe(0); expect(report.body.sessionEndNoShowsIn30Days).toBe(1);
    await db.queueEvent.create({ data: { ...event, metadata: { from: 'SKIPPED' } } });
    report = await http().get(`/sessions/${session}/booking-access/${booking.body.entry.id}`).set(auth(staff.accessToken)).expect(200);
    expect(report.body.manuallyMarkedNoShowsIn30Days).toBe(1);
    expect(await db.bookingAccess.count()).toBe(0); // Reporting never silently sanctions a patient.
  });

  it('refuses mismatched client/token environments and a database identity mismatch', async () => {
    await http().get('/me').set(auth(user.accessToken)).set('x-kramya-environment', 'PRODUCTION').expect(409);
    const token = await app.get(JwtService).signAsync({ sub: user.accountId, email: 'patient@release.test', ver: 0, env: 'PRODUCTION' }, { secret: env().JWT_ACCESS_SECRET });
    await http().get('/me').set(auth(token)).expect(401);
    await db.deploymentIdentity.update({ where: { id: 'singleton' }, data: { environment: 'PRODUCTION' } });
    try { await expect(app.get(DeploymentIdentityService).onModuleInit()).rejects.toThrow('do not match'); }
    finally { await db.deploymentIdentity.update({ where: { id: 'singleton' }, data: { environment: 'STAGING' } }); }
    await expect(app.get(DeploymentIdentityService).onModuleInit()).resolves.toBeUndefined();
  });

  it('allows a free approved-account pilot without pretending email ownership is verified', async () => {
    process.env.REMOTE_BOOKING_ACCESS = 'APPROVED_ONLY'; resetEnvCache();
    await reserve(session).expect(403);
    expect((await http().get('/me').set(auth(user.accessToken)).expect(200)).body.remoteBookingAccess).toBe('APPROVAL_REQUIRED');
    await db.account.update({ where: { id: user.accountId }, data: { remoteBookingApprovedAt: new Date() } });
    const booked = await reserve(session).expect(201);
    const me = await http().get('/me').set(auth(user.accessToken)).expect(200);
    expect(me.body.remoteBookingAccess).toBe('APPROVED'); expect(me.body.emailVerified).toBe(false);
    await db.account.update({ where: { id: user.accountId }, data: { remoteBookingApprovedAt: null } });
    await reserve(later).expect(403);
    expect((await db.queueEntry.findUniqueOrThrow({ where: { id: booked.body.entry.id } })).status).toBe('CONFIRMED');
    process.env.REMOTE_BOOKING_ACCESS = 'VERIFIED_EMAIL'; resetEnvCache();
    await reserve(later).expect(403);
    await db.account.update({ where: { id: user.accountId }, data: { emailVerifiedAt: new Date() } });
    await reserve(later).expect(201);
  });

  it('serializes patient-profile limits so concurrent creation cannot farm extra profiles', async () => {
    process.env.MAX_PATIENT_PROFILES_PER_ACCOUNT = '3'; resetEnvCache();
    const results = await Promise.all([1, 2].map(n => http().post('/patients').set(auth(user.accessToken)).send({ name: `TEST Extra ${n}`, relation: 'OTHER' })));
    expect(results.map(r => r.status).sort()).toEqual([201, 409]);
    expect(await db.patient.count({ where: { accountId: user.accountId } })).toBe(3);
  });

  it('refuses public test booking access and a staging database during production startup', async () => {
    process.env.DEPLOYMENT_ENVIRONMENT = 'PRODUCTION'; resetEnvCache();
    try {
      await expect(app.get(DeploymentIdentityService).onModuleInit()).rejects.toThrow('refuses OPEN_TEST');
      process.env.REMOTE_BOOKING_ACCESS = 'APPROVED_ONLY'; resetEnvCache();
      await expect(app.get(DeploymentIdentityService).onModuleInit()).rejects.toThrow('do not match');
    } finally { process.env.DEPLOYMENT_ENVIRONMENT = 'STAGING'; resetEnvCache(); }
  });
});
