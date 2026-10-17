import { PrismaClient } from "@prisma/client";
import type { INestApplication } from "@nestjs/common";
import { randomBytes } from "node:crypto";
import { io, type Socket } from "socket.io-client";
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import { AuthService } from "../src/modules/auth/auth.service";
import { resetEnvCache } from "../src/config/env";
import { PrismaService } from "../src/prisma/prisma.service";
import { withDatabaseIdentity } from "../src/prisma/database-context";
import { auth, createTestApp, request, resetDb, signup } from "./helpers";
import { RazorpayClient } from "../src/modules/payments/razorpay.client";
import {
  FakeRazorpay,
  capturedWebhookBody,
  signWebhook,
} from "./razorpay.fake";
import { ReservationSweeper } from "../src/modules/queue/reservation-sweeper";
import { dateColumnFromString, istToday } from "../src/common/ist";

// A dedicated local DB/process: never silently run owner-only tests as RLS proof.
describe.skipIf(process.env.RLS_RUNTIME_TEST !== "1")(
  "RLS with an actual non-owner login",
  () => {
    let app: INestApplication, runtime: PrismaService;
    const owner = new PrismaClient();
    let clinic: string,
      otherClinic: string,
      session: string,
      otherSession: string;
    let admin: Awaited<ReturnType<typeof signup>>,
      alice: Awaited<ReturnType<typeof signup>>,
      bob: Awaited<ReturnType<typeof signup>>;
    let alicePatient: string, bobPatient: string;
    const gateway = new FakeRazorpay();
    const http = () => request(app.getHttpServer());
    beforeAll(async () => {
      const url = new URL(process.env.DATABASE_URL!);
      if (
        !["localhost", "127.0.0.1"].includes(url.hostname) ||
        !url.pathname.endsWith("_rls_test")
      )
        throw new Error(
          "RLS probes require a dedicated local *_rls_test database",
        );
      const flags = await owner.$queryRaw<
        { relrowsecurity: boolean }[]
      >`SELECT relrowsecurity FROM pg_class WHERE oid='public."Patient"'::regclass`;
      expect(flags[0]?.relrowsecurity).toBe(true);
      const password = randomBytes(32).toString("hex");
      await owner.$executeRawUnsafe(
        `CREATE ROLE kramya_rls_probe LOGIN INHERIT PASSWORD '${password}'`,
      );
      await owner.$executeRawUnsafe("GRANT kramya_runtime TO kramya_rls_probe");
      const original = process.env.DATABASE_URL;
      url.username = "kramya_rls_probe";
      url.password = password;
      url.searchParams.set("connection_limit", "2");
      process.env.DATABASE_URL = url.toString();
      try {
        runtime = new PrismaService();
        await runtime.$connect();
      } finally {
        process.env.DATABASE_URL = original;
      }
      ({ app } = await createTestApp([
        { provide: PrismaService, useValue: runtime },
        { provide: RazorpayClient, useValue: gateway },
      ]));
      const role = await runtime.$queryRaw<
        { current_user: string; rolsuper: boolean; rolbypassrls: boolean }[]
      >`SELECT current_user, rolsuper,rolbypassrls FROM pg_roles WHERE rolname=current_user`;
      expect(role[0]).toMatchObject({
        current_user: "kramya_rls_probe",
        rolsuper: false,
        rolbypassrls: false,
      });
    });
    afterAll(async () => {
      await app?.close();
      await runtime?.$disconnect();
      await owner.$executeRawUnsafe("DROP ROLE IF EXISTS kramya_rls_probe");
      await owner.$disconnect();
    });
    beforeEach(async () => {
      await resetDb(owner as unknown as PrismaService);
      gateway.orders = [];
      gateway.refunds = [];
      admin = await signup(app, "rls-admin@kramya.test");
      alice = await signup(app, "rls-alice@kramya.test");
      bob = await signup(app, "rls-bob@kramya.test");
      const make = async (label: string) => {
        const h = await owner.hospital.create({
          data: {
            name: `TEST RLS ${label}`,
            city: "Mumbai",
            status: "VERIFIED",
          },
        });
        const d = await owner.department.create({
          data: { hospitalId: h.id, name: "TEST General" },
        });
        const doc = await owner.doctor.create({
          data: {
            hospitalId: h.id,
            departmentId: d.id,
            name: `Dr TEST ${label}`,
          },
        });
        const s = await owner.oPDSession.create({
          data: {
            hospitalId: h.id,
            departmentId: d.id,
            originalDoctorId: doc.id,
            currentProviderDoctorId: doc.id,
            date: dateColumnFromString(istToday()),
            scheduledStart: new Date(Date.now() + 3_600_000),
            scheduledEnd: new Date(Date.now() + 14_400_000),
            feePaise: 50_000,
            doctorPresence: "PRESENT",
          },
        });
        return { h: h.id, s: s.id };
      };
      const a = await make("Alpha"),
        b = await make("Beta");
      clinic = a.h;
      session = a.s;
      otherClinic = b.h;
      otherSession = b.s;
      await owner.hospitalStaff.create({
        data: { hospitalId: clinic, accountId: admin.accountId, role: "ADMIN" },
      });
      alicePatient = (
        await owner.patient.create({
          data: { accountId: alice.accountId, name: "TEST Alice" },
        })
      ).id;
      bobPatient = (
        await owner.patient.create({
          data: { accountId: bob.accountId, name: "TEST Bob" },
        })
      ).id;
      await owner.queueEntry.create({
        data: {
          hospitalId: otherClinic,
          sessionId: otherSession,
          patientId: bobPatient,
          accountId: bob.accountId,
          type: "ONLINE",
          status: "CONFIRMED",
          tokenNumber: 1,
          tokenLabel: "B001",
        },
      });
    });
    it("fails closed without identity, blocks owner/clinic changes, and keeps pooled identities apart", async () => {
      const overlaps = await owner.$queryRawUnsafe(`
        SELECT tablename, action FROM pg_policies
        CROSS JOIN LATERAL unnest(CASE WHEN cmd='ALL'
          THEN ARRAY['SELECT','INSERT','UPDATE','DELETE'] ELSE ARRAY[cmd] END) AS action
        WHERE schemaname='public' AND roles @> ARRAY['kramya_runtime']::name[]
        GROUP BY tablename,action HAVING count(*)>1
      `);
      expect(overlaps).toEqual([]);
      expect(await runtime.patient.findMany()).toEqual([]);
      expect(await runtime.queueMetric.findMany()).toEqual([]);
      await expect(
        runtime.$queryRawUnsafe("SELECT * FROM public._prisma_migrations"),
      ).rejects.toThrow();
      await Promise.all(
        Array.from({ length: 12 }, (_, i) =>
          withDatabaseIdentity(
            {
              accountId: i % 2 ? alice.accountId : bob.accountId,
              purpose: "account",
            },
            async () => {
              const profiles = await runtime.patient.findMany();
              expect(
                profiles.every(
                  (p) =>
                    p.accountId === (i % 2 ? alice.accountId : bob.accountId),
                ),
              ).toBe(true);
            },
          ),
        ),
      );
      await withDatabaseIdentity(
        { accountId: alice.accountId, purpose: "account" },
        async () => {
          expect(await runtime.queueEntry.findMany()).toEqual([]);
          const rows = await runtime.queueMetric.findMany();
          expect(rows.length).toBe(1);
          expect(Object.keys(rows[0]!)).not.toEqual(
            expect.arrayContaining(["accountId", "patientId", "checkInCode"]),
          );
          await expect(
            runtime.patient.update({
              where: { id: alicePatient },
              data: { accountId: bob.accountId },
            }),
          ).rejects.toThrow();
          expect(
            await runtime.patient.updateMany({
              where: { id: bobPatient },
              data: { name: "forbidden" },
            }),
          ).toEqual({ count: 0 });
        },
      );
      await withDatabaseIdentity(
        { accountId: admin.accountId, hospitalId: clinic, purpose: "staff" },
        async () => {
          expect(await runtime.patient.findMany()).toEqual([]);
          expect(await runtime.queueEntry.findMany()).toEqual([]);
          expect(
            await runtime.hospitalStaff.findMany({
              where: { hospitalId: otherClinic },
            }),
          ).toEqual([]);
        },
      );
      expect(await runtime.patient.findMany()).toEqual([]);
    });
    it("serves authenticated discovery and clinic diagnostics through the restricted pool", async () => {
      const get = (path: string) =>
        http().get(path).set(auth(alice.accessToken));
      await get("/cities").expect(200);
      const hospitals = await get("/hospitals").expect(200);
      expect(hospitals.body.total).toBe(2);
      const departments = await get(`/departments?hospitalId=${clinic}`).expect(
        200,
      );
      expect(departments.body.total).toBe(1);
      const doctors = await get("/doctors?q=Alpha").expect(200);
      expect(doctors.body.total).toBe(1);
      await get(`/sessions/${session}`).expect(200);
      expect(JSON.stringify(hospitals.body)).not.toContain("TEST Bob");
      await http()
        .get(`/hospitals/${clinic}/operations`)
        .set(auth(admin.accessToken))
        .expect(200);
      await get(`/hospitals/${clinic}/operations`).expect(403);
      await http()
        .get(`/hospitals/${otherClinic}/operations`)
        .set(auth(admin.accessToken))
        .expect(403);
    });
    it("supports patient booking, signed capture and cancellation/refund on the restricted connection", async () => {
      const joined = await http()
        .post(`/sessions/${session}/join`)
        .set(auth(alice.accessToken))
        .send({ patientId: alicePatient })
        .expect(201);
      const body = capturedWebhookBody(
        joined.body.razorpayOrderId,
        "pay_rls_test",
        50_000,
      );
      await http()
        .post("/webhooks/razorpay")
        .set("content-type", "application/json")
        .set("x-razorpay-signature", signWebhook(body))
        .send(body)
        .expect(201);
      await http()
        .post("/webhooks/razorpay")
        .set("content-type", "application/json")
        .set("x-razorpay-signature", signWebhook(body))
        .send(body)
        .expect(201);
      expect(
        await owner.payment.count({
          where: { razorpayPaymentId: "pay_rls_test" },
        }),
      ).toBe(1);
      await http()
        .get("/me/queue-entries")
        .set(auth(alice.accessToken))
        .expect(200);
      await http()
        .post(`/queue-entries/${joined.body.entry.id}/cancel`)
        .set(auth(alice.accessToken))
        .send({})
        .expect(201);
      expect(gateway.refunds).toHaveLength(1);
      expect((await owner.refund.findFirst())?.razorpayRefundId).toBeTruthy();
      await http()
        .get(`/sessions/${session}/queue`)
        .set(auth(bob.accessToken))
        .expect(403);
    });
    it("filters public socket discovery without an HTTP database context", async () => {
      await app.listen(0, "127.0.0.1");
      const url = await app.getUrl();
      const sockets: Socket[] = [];
      async function connect(token: string) {
        const socket = io(url, {
          auth: { token },
          transports: ["websocket"],
          forceNew: true,
          reconnection: false,
        });
        sockets.push(socket);
        await new Promise<void>((ok, fail) => {
          const timer = setTimeout(
            () => fail(new Error("RLS socket connection timed out")),
            4000,
          );
          socket.once("connect", () => {
            clearTimeout(timer);
            ok();
          });
          socket.once("connect_error", (e) => {
            clearTimeout(timer);
            fail(e);
          });
        });
        return socket;
      }
      const subscribe = (
        socket: Socket,
        id: string,
      ): Promise<{ ok: boolean }> =>
        socket.timeout(4000).emitWithAck("subscribe", { sessionId: id });
      try {
        const staff = await connect(admin.accessToken),
          patient = await connect(bob.accessToken),
          outsider = await connect(alice.accessToken);
        expect(await subscribe(staff, session)).toMatchObject({ ok: true });
        expect(await subscribe(staff, otherSession)).toMatchObject({
          ok: true,
        });
        expect(await subscribe(patient, otherSession)).toMatchObject({
          ok: true,
        });
        expect(await subscribe(patient, session)).toMatchObject({ ok: true });
        expect(await subscribe(outsider, otherSession)).toMatchObject({
          ok: true,
        });
        // Session rooms carry only sessionId/version invalidation events and are
        // deliberately public to signed-in catalog users. Hidden clinics are not.
        await owner.hospital.update({
          where: { id: otherClinic },
          data: { status: "PENDING" },
        });
        expect(await subscribe(staff, otherSession)).toMatchObject({
          ok: false,
        });
        expect(await subscribe(patient, otherSession)).toMatchObject({
          ok: false,
        });
        expect(await subscribe(outsider, otherSession)).toMatchObject({
          ok: false,
        });
        expect(await subscribe(staff, session)).toMatchObject({ ok: true });
      } finally {
        for (const socket of sockets) socket.close();
      }
    });
    it("creates and reads walk-ins only through their clinic and blocks disabled memberships", async () => {
      await http()
        .post(`/sessions/${session}/walk-in`)
        .set(auth(admin.accessToken))
        .send({ name: "TEST Walk-in" })
        .expect(201);
      const queue = await http()
        .get(`/sessions/${session}/queue`)
        .set(auth(admin.accessToken))
        .expect(200);
      expect(JSON.stringify(queue.body)).toContain("TEST Walk-in");
      await http()
        .post(`/sessions/${otherSession}/walk-in`)
        .set(auth(admin.accessToken))
        .send({ name: "forbidden" })
        .expect(403);
      await owner.hospitalStaff.updateMany({
        where: { accountId: admin.accountId },
        data: { status: "DISABLED" },
      });
      await withDatabaseIdentity(
        { accountId: admin.accountId, hospitalId: clinic, purpose: "staff" },
        async () => expect(await runtime.queueEntry.findMany()).toEqual([]),
      );
    });
    it("supports refresh/logout and device reassignment without exposing another account", async () => {
      const login = await http()
        .post("/auth/login")
        .send({
          email: "rls-alice@kramya.test",
          password: "correct-horse-battery",
        })
        .expect(200);
      const rotated = await http()
        .post("/auth/refresh")
        .send({
          refreshToken: login.body.refreshToken,
          rotationKey: login.body.rotationKey,
        })
        .expect(200);
      const token = "rls-test-device-token-at-least-twenty-characters";
      await http()
        .post("/me/push-tokens")
        .set(auth(alice.accessToken))
        .send({ token, platform: "android" })
        .expect(201);
      await http()
        .post("/me/push-tokens")
        .set(auth(bob.accessToken))
        .send({ token, platform: "android" })
        .expect(201);
      expect(
        (await owner.pushToken.findUnique({ where: { token } }))?.accountId,
      ).toBe(bob.accountId);
      await http()
        .post("/auth/logout")
        .send({ refreshToken: rotated.body.refreshToken, pushToken: token })
        .expect(204);
      expect(
        (await owner.pushToken.findUnique({ where: { token } }))?.accountId,
      ).toBe(bob.accountId);
    });
    it("lets background recovery see required rows without granting HTTP clients a system identity", async () => {
      const profile = await owner.patient.create({
        data: { accountId: alice.accountId, name: "TEST expired hold" },
      });
      const entry = await owner.queueEntry.create({
        data: {
          hospitalId: clinic,
          sessionId: session,
          patientId: profile.id,
          accountId: alice.accountId,
          type: "ONLINE",
          status: "RESERVED",
          tokenNumber: 1,
          tokenLabel: "A001",
          reservationExpiresAt: new Date(Date.now() - 60_000),
        },
      });
      await app.get(ReservationSweeper).safeSweep();
      expect(
        (await owner.queueEntry.findUnique({ where: { id: entry.id } }))
          ?.status,
      ).toBe("CANCELLED");
      await http()
        .get("/patients")
        .set(auth(alice.accessToken))
        .set("x-kramya-purpose", "worker:reservation")
        .set("x-kramya-account-id", bob.accountId)
        .expect(200)
        .then((result) =>
          expect(JSON.stringify(result.body)).not.toContain("TEST Bob"),
        );
    });
    it("supports new and existing staff invitations without changing existing credentials", async () => {
      const invited = await http()
        .post(`/hospitals/${clinic}/staff`)
        .set(auth(admin.accessToken))
        .send({ email: "rls-invited@kramya.test", role: "RECEPTION" })
        .expect(201);
      await http()
        .post("/auth/accept-invite")
        .send({
          token: invited.body.inviteToken,
          password: "a-new-private-test-password",
        })
        .expect(200);
      await http()
        .post("/auth/accept-invite")
        .send({
          token: invited.body.inviteToken,
          password: "a-new-private-test-password",
        })
        .expect(401);
      const existing = await http()
        .post(`/hospitals/${clinic}/staff`)
        .set(auth(admin.accessToken))
        .send({ email: "rls-bob@kramya.test", role: "RECEPTION" })
        .expect(201);
      await http()
        .post("/auth/accept-membership")
        .set(auth(bob.accessToken))
        .send({ token: existing.body.inviteToken })
        .expect(200);
      await http()
        .post("/auth/login")
        .send({
          email: "rls-bob@kramya.test",
          password: "correct-horse-battery",
        })
        .expect(200);
    });
    it("uses the selected membership and database role, including multi-clinic staff", async () => {
      await owner.hospitalStaff.create({
        data: {
          hospitalId: otherClinic,
          accountId: admin.accountId,
          role: "RECEPTION",
        },
      });
      await withDatabaseIdentity(
        {
          accountId: admin.accountId,
          hospitalId: clinic,
          purpose: "staff",
          role: "ADMIN",
        },
        async () => expect(await runtime.queueEntry.findMany()).toEqual([]),
      );
      await withDatabaseIdentity(
        {
          accountId: admin.accountId,
          hospitalId: otherClinic,
          purpose: "staff",
          role: "ADMIN",
        },
        async () => {
          expect(await runtime.queueEntry.count()).toBe(1);
          expect(
            await runtime.doctor.updateMany({
              where: { hospitalId: otherClinic },
              data: { name: "forbidden" },
            }),
          ).toEqual({ count: 0 });
        },
      );
      await owner.hospitalStaff.updateMany({
        where: { hospitalId: otherClinic, accountId: admin.accountId },
        data: { status: "DISABLED" },
      });
      await withDatabaseIdentity(
        {
          accountId: admin.accountId,
          hospitalId: otherClinic,
          purpose: "staff",
        },
        async () => expect(await runtime.queueEntry.findMany()).toEqual([]),
      );
    });
    it("rejects reassigned ownership and forged hospital/session relations", async () => {
      const entry = await owner.queueEntry.create({
        data: {
          hospitalId: clinic,
          sessionId: session,
          patientId: alicePatient,
          accountId: alice.accountId,
          type: "ONLINE",
          status: "RESERVED",
          tokenNumber: 1,
          tokenLabel: "A001",
        },
      });
      await withDatabaseIdentity(
        {
          accountId: alice.accountId,
          purpose: "patient-command",
          sessionId: session,
        },
        async () => {
          await expect(
            runtime.queueEntry.update({
              where: { id: entry.id },
              data: { hospitalId: otherClinic, sessionId: otherSession },
            }),
          ).rejects.toThrow();
          await expect(
            runtime.queueEntry.update({
              where: { id: entry.id },
              data: { patientId: bobPatient },
            }),
          ).rejects.toThrow();
        },
      );
      await withDatabaseIdentity(
        { accountId: admin.accountId, hospitalId: clinic, purpose: "staff" },
        async () => {
          const doctor = await runtime.doctor.findFirstOrThrow({
            where: { hospitalId: clinic },
          });
          const department = await owner.department.findFirstOrThrow({
            where: { hospitalId: otherClinic },
          });
          await expect(
            runtime.doctor.update({
              where: { id: doctor.id },
              data: { departmentId: department.id },
            }),
          ).rejects.toThrow();
        },
      );
    });
    it("preserves a patient history when a clinic/provider is no longer discoverable", async () => {
      const s = await owner.oPDSession.findUniqueOrThrow({
        where: { id: otherSession },
      });
      await owner.hospital.update({
        where: { id: otherClinic },
        data: { status: "PENDING" },
      });
      await owner.department.update({
        where: { id: s.departmentId },
        data: { isActive: false },
      });
      await owner.doctor.update({
        where: { id: s.currentProviderDoctorId },
        data: { isActive: false },
      });
      await owner.queueEntry.updateMany({
        where: { sessionId: otherSession },
        data: { status: "COMPLETED" },
      });
      const history = await http()
        .get("/me/queue-entries?scope=past")
        .set(auth(bob.accessToken))
        .expect(200);
      expect(history.body.items).toHaveLength(1);
      expect(history.body.items[0]).toMatchObject({
        hospitalId: otherClinic,
        patientName: "TEST Bob",
        etaFrom: null,
        etaTo: null,
      });
      await http()
        .post(`/sessions/${otherSession}/join`)
        .set(auth(bob.accessToken))
        .send({ patientId: bobPatient })
        .expect(404);
      expect(gateway.orders).toHaveLength(0);
    });
    it("binds verified Google subject and refuses a conflicting identity binding", async () => {
      const original = process.env.GOOGLE_CLIENT_IDS;
      process.env.GOOGLE_CLIENT_IDS = "rls-test-client";
      resetEnvCache();
      const verify = vi.spyOn(
        app.get(AuthService) as unknown as {
          verifyGoogleToken: () => Promise<{ sub: string; email: string }>;
        },
        "verifyGoogleToken",
      );
      try {
        verify.mockResolvedValue({
          sub: "rls-google-subject",
          email: "rls-google@kramya.test",
        });
        await http()
          .post("/auth/google")
          .send({ idToken: "verified-provider-fixture" })
          .expect(200);
        const first = await owner.account.findUniqueOrThrow({
          where: { googleId: "rls-google-subject" },
        });
        verify.mockResolvedValue({
          sub: "rls-google-subject",
          email: "rls-google-new-email@kramya.test",
        });
        const again = await http()
          .post("/auth/google")
          .send({ idToken: "verified-provider-fixture" })
          .expect(200);
        await http()
          .get("/me")
          .set(auth(again.body.accessToken))
          .expect(200)
          .then((result) => expect(result.body.id).toBe(first.id));
        verify.mockResolvedValue({
          sub: "rls-bob-google",
          email: "rls-bob@kramya.test",
        });
        await http()
          .post("/auth/google")
          .send({ idToken: "verified-provider-fixture" })
          .expect(200);
        expect(
          (
            await owner.account.findUniqueOrThrow({
              where: { id: bob.accountId },
            })
          ).googleId,
        ).toBe("rls-bob-google");
        verify.mockResolvedValue({
          sub: "rls-conflicting-google",
          email: "rls-bob@kramya.test",
        });
        await http()
          .post("/auth/google")
          .send({ idToken: "verified-provider-fixture" })
          .expect(401);
      } finally {
        verify.mockRestore();
        if (original === undefined) delete process.env.GOOGLE_CLIENT_IDS;
        else process.env.GOOGLE_CLIENT_IDS = original;
        resetEnvCache();
      }
    });
  },
);
