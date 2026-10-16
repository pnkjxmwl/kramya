import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PrismaService } from "../src/prisma/prisma.service";
import {
  databaseScope,
  withDatabaseIdentity,
} from "../src/prisma/database-context";

describe("transaction-local database identity", () => {
  const prisma = new PrismaService();
  beforeAll(() => prisma.$connect());
  afterAll(() => prisma.$disconnect());
  const read = () =>
    prisma.$queryRaw<
      { account: string | null; hospital: string | null; pid: number }[]
    >`SELECT nullif(current_setting('kramya.account_id',true),'') AS account, nullif(current_setting('kramya.hospital_id',true),'') AS hospital, pg_backend_pid() AS pid`;
  it("keeps alternating concurrent identities separate and leaves the pool empty", async () => {
    await Promise.all(
      Array.from({ length: 20 }, (_, i) =>
        withDatabaseIdentity(
          { accountId: `account-${i}`, hospitalId: `hospital-${i}` },
          async () => {
            const rows = await read();
            expect(rows[0]).toMatchObject({
              account: `account-${i}`,
              hospital: `hospital-${i}`,
            });
          },
        ),
      ),
    );
    expect((await read())[0]).toMatchObject({ account: null, hospital: null });
    expect(databaseScope.getStore()).toBeUndefined();
  });
  it("binds domain queries to the same transaction, including calls through PrismaService", async () => {
    await withDatabaseIdentity({ accountId: "locked-account" }, () =>
      prisma.$transaction(async (tx) => {
        const first = await tx.$queryRaw<
          { pid: number }[]
        >`SELECT pg_backend_pid() AS pid`;
        expect((await read())[0]).toMatchObject({
          account: "locked-account",
          pid: first[0]!.pid,
        });
        expect(databaseScope.getStore()?.transaction).toBe(tx);
      expect(() => withDatabaseIdentity({ accountId: 'different-account' }, () => undefined)).toThrow('Cannot change database identity');
      }),
    );
  });
  it("clears settings after rollback and never nests a scoped transaction", async () => {
    await expect(
      withDatabaseIdentity({ accountId: "rollback-account" }, () =>
        prisma.$transaction(async () => {
          throw new Error("rollback probe");
        }),
      ),
    ).rejects.toThrow("rollback probe");
    expect((await read())[0]?.account).toBeNull();
    await withDatabaseIdentity({ accountId: "owner" }, async () => {
      expect(() => prisma.$transaction([])).toThrow("require a callback");
      await prisma.$transaction(async () => {
        expect(() => prisma.$transaction(async () => undefined)).toThrow(
          "Nested",
        );
      });
    });
  });
});
