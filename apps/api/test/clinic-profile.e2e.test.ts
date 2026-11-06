import type { INestApplication } from '@nestjs/common';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { PrismaService } from '../src/prisma/prisma.service';
import { auth, createTestApp, request, resetDb, signup } from './helpers';

describe('clinic self-service profile', () => {
  let app: INestApplication, db: PrismaService, clinic: string;
  let admin: Awaited<ReturnType<typeof signup>>, other: Awaited<ReturnType<typeof signup>>, reception: Awaited<ReturnType<typeof signup>>;
  const http = () => request(app.getHttpServer());
  const details = { name: 'TEST Clinic Updated', city: 'Mumbai', area: 'TEST Area', address: 'TEST Ground floor OPD, Mumbai', receptionPhone: '+91 90000 00000', receptionEmail: 'reception@example.test' };
  beforeAll(async () => { ({ app, prisma: db } = await createTestApp()); });
  afterAll(() => app.close());
  beforeEach(async () => {
    await resetDb(db); admin = await signup(app, 'admin@profile.test'); other = await signup(app, 'other@profile.test'); reception = await signup(app, 'reception@profile.test');
    clinic = (await db.hospital.create({ data: { name: 'TEST Pending', city: 'Mumbai' } })).id;
    const second = await db.hospital.create({ data: { name: 'TEST Other', city: 'Mumbai' } });
    await db.hospitalStaff.createMany({ data: [{ hospitalId: clinic, accountId: admin.accountId, role: 'ADMIN' }, { hospitalId: second.id, accountId: other.accountId, role: 'ADMIN' }, { hospitalId: clinic, accountId: reception.accountId, role: 'RECEPTION' }] });
  });
  it('lets its administrator maintain public reception details but never self-publish', async () => {
    const result = await http().put(`/hospitals/${clinic}/profile`).set(auth(admin.accessToken)).send(details).expect(200);
    expect(result.body.receptionPhone).toBe(details.receptionPhone); expect(result.body.status).toBe('PENDING');
    await http().get(`/hospitals/${clinic}`).set(auth(reception.accessToken)).expect(404);
    expect(await db.auditLog.count({ where: { action: 'hospital.PROFILE_UPDATED', hospitalId: clinic } })).toBe(1);
    await db.hospital.update({ where: { id: clinic }, data: { status: 'VERIFIED' } });
    const publicView = await http().get(`/hospitals/${clinic}`).set(auth(reception.accessToken)).expect(200);
    expect(publicView.body.address).toBe(details.address); expect(publicView.body.receptionEmail).toBe(details.receptionEmail);
  });
  it('rejects cross-clinic access, reception writes, publication flags and invalid contacts', async () => {
    await http().put(`/hospitals/${clinic}/profile`).set(auth(other.accessToken)).send(details).expect(403);
    await http().put(`/hospitals/${clinic}/profile`).set(auth(reception.accessToken)).send(details).expect(403);
    await http().put(`/hospitals/${clinic}/profile`).set(auth(admin.accessToken)).send({ ...details, status: 'VERIFIED' }).expect(400);
    await http().put(`/hospitals/${clinic}/profile`).set(auth(admin.accessToken)).send({ ...details, receptionPhone: '-------' }).expect(400);
    expect((await db.hospital.findUniqueOrThrow({ where: { id: clinic } })).status).toBe('PENDING');
  });
});
