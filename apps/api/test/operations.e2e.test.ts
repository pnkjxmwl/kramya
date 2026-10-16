import type { INestApplication } from "@nestjs/common";
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import { auth, createTestApp, request, resetDb, signup } from "./helpers";
import { PrismaService } from "../src/prisma/prisma.service";
import { RazorpayClient } from "../src/modules/payments/razorpay.client";
import { FcmClient } from "../src/modules/notifications/fcm.client";

describe("clinic operations permissions", () => {
  let app: INestApplication, prisma: PrismaService;
  const preflight = vi.fn(async () => ({
    configured: true,
    authenticated: true,
  }));
  beforeAll(async () => {
    ({ app, prisma } = await createTestApp([
      { provide: RazorpayClient, useValue: { configured: false, preflight } },
      { provide: FcmClient, useValue: { configured: false, preflight } },
    ]));
  });
  beforeEach(async () => {
    await resetDb(prisma);
    preflight.mockClear();
  });
  afterAll(() => app.close());
  it("requires an active admin of the selected clinic before inspecting integrations", async () => {
    const admin = await signup(app, "ops-admin@kramya.test"),
      patient = await signup(app, "ops-patient@kramya.test");
    const clinic = await prisma.hospital.create({
      data: { name: "TEST Operations", city: "Mumbai" },
    });
    const other = await prisma.hospital.create({
      data: { name: "TEST Other", city: "Mumbai" },
    });
    await prisma.hospitalStaff.create({
      data: {
        hospitalId: clinic.id,
        accountId: admin.accountId,
        role: "ADMIN",
      },
    });
    const path = `/hospitals/${clinic.id}/operations`;
    await request(app.getHttpServer()).post(`${path}/preflight`).expect(401);
    await request(app.getHttpServer())
      .post(`${path}/preflight`)
      .set(auth(patient.accessToken))
      .expect(403);
    await request(app.getHttpServer())
      .post(`/hospitals/${other.id}/operations/preflight`)
      .set(auth(admin.accessToken))
      .expect(403);
    expect(preflight).not.toHaveBeenCalled();
    const status = await request(app.getHttpServer())
      .get(path)
      .set(auth(admin.accessToken))
      .expect(200);
    expect(status.body).toMatchObject({
      releaseGate: "not-cleared",
      backlog: {
        paymentsOlderThanTenMinutes: 0,
        refundsOlderThanTenMinutes: 0,
      },
    });
    await request(app.getHttpServer())
      .post(`${path}/preflight`)
      .set(auth(admin.accessToken))
      .expect(201);
    expect(preflight).toHaveBeenCalledTimes(2);
    await prisma.hospitalStaff.updateMany({
      where: { accountId: admin.accountId },
      data: { status: "DISABLED" },
    });
    await request(app.getHttpServer())
      .get(path)
      .set(auth(admin.accessToken))
      .expect(403);
  });
});
