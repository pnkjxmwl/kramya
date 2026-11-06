import type { INestApplication } from '@nestjs/common';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { POST } from '../../web/app/api/auth/account-deletion/route';
import { PrismaService } from '../src/prisma/prisma.service';
import { auth, createTestApp, request, resetDb, signup } from './helpers';

describe('public web deletion through the actual API', () => {
  let app: INestApplication, db: PrismaService, apiUrl: string;
  const original = process.env.API_URL;
  const send = (body: unknown, origin = 'https://kramya.local') => POST(new Request('https://kramya.local/api/auth/account-deletion', {
    method: 'POST', headers: { 'content-type': 'application/json', origin }, body: JSON.stringify(body),
  }));
  beforeAll(async () => {
    ({ app, prisma: db } = await createTestApp()); await app.listen(0, '127.0.0.1');
    const address = app.getHttpServer().address();
    apiUrl = `http://127.0.0.1:${typeof address === 'object' && address ? address.port : 0}`;
  });
  beforeEach(async () => { await resetDb(db); process.env.API_URL = apiUrl; process.env.NEXT_PUBLIC_DEPLOYMENT_ENVIRONMENT = 'STAGING'; });
  afterAll(async () => { if (original === undefined) delete process.env.API_URL; else process.env.API_URL = original; await app.close(); });

  it('deletes using password proof without emails, cookies or browser-visible API credentials', async () => {
    const user = await signup(app, 'public-delete@test.dev');
    await db.patient.create({ data: { accountId: user.accountId, name: 'TEST Public Patient' } });
    const result = await send({ email: 'public-delete@test.dev', password: 'correct-horse-battery', confirmation: 'DELETE' });
    expect(result.status).toBe(200); expect(result.headers.get('set-cookie')).toBeNull();
    const body = await result.json(); expect(body.deleted).toBe(true); expect(body.accessToken).toBeUndefined(); expect(body.refreshToken).toBeUndefined();
    expect((await db.account.findUniqueOrThrow({ where: { id: user.accountId } })).deletedAt).not.toBeNull();
    expect((await db.patient.findFirstOrThrow()).name).toBe('Deleted patient');
    expect(await db.refreshToken.count()).toBe(0);
    await request(app.getHttpServer()).get('/me').set(auth(user.accessToken)).expect(401);
  });

  it('requires confirmation and correct credentials and refuses cross-origin submission', async () => {
    const user = await signup(app, 'public-proof@test.dev');
    const body = { email: 'public-proof@test.dev', password: 'correct-horse-battery' };
    expect((await send(body)).status).toBe(400);
    expect((await send({ ...body, confirmation: 'DELETE' }, 'https://unrelated.invalid')).status).toBe(403);
    const known = await send({ ...body, password: 'wrong-password', confirmation: 'DELETE' });
    const unknown = await send({ email: 'missing@test.dev', password: 'wrong-password', confirmation: 'DELETE' });
    expect(known.status).toBe(401); expect(unknown.status).toBe(401); expect(await known.json()).toEqual(await unknown.json());
    expect((await db.account.findUniqueOrThrow({ where: { id: user.accountId } })).deletedAt).toBeNull();
  });

  it('records staff handover without leaving the temporary web login active', async () => {
    const user = await signup(app, 'public-staff@test.dev');
    const hospital = await db.hospital.create({ data: { name: 'TEST Handover', city: 'Mumbai' } });
    await db.hospitalStaff.create({ data: { hospitalId: hospital.id, accountId: user.accountId, role: 'ADMIN' } });
    const result = await send({ email: 'public-staff@test.dev', password: 'correct-horse-battery', confirmation: 'DELETE' });
    expect(result.status).toBe(200); expect((await result.json()).deleted).toBe(false);
    expect(await db.refreshToken.count({ where: { accountId: user.accountId, revokedAt: null } })).toBe(1);
    expect((await db.account.findUniqueOrThrow({ where: { id: user.accountId } })).deletionRequestedAt).not.toBeNull();
  });
});
