import { describe, expect, it } from "vitest";
import { boundedDatabaseUrl } from "./connection-options";
describe("database connection budget", () => {
  it("caps each process at four while retaining an explicitly smaller pool", () => {
    const value = "postgresql://fixture:fake-password@localhost:5433/opd";
    expect(
      new URL(boundedDatabaseUrl(value)).searchParams.get("connection_limit"),
    ).toBe("4");
    expect(
      new URL(
        boundedDatabaseUrl(value + "?connection_limit=2"),
      ).searchParams.get("connection_limit"),
    ).toBe("2");
    expect(
      new URL(
        boundedDatabaseUrl(value + "?connection_limit=100&sslmode=require"),
      ).searchParams.get("connection_limit"),
    ).toBe("4");
    expect(
      new URL(boundedDatabaseUrl(value + "?sslmode=require")).searchParams.get(
        "sslmode",
      ),
    ).toBe("require");
    expect(() =>
      boundedDatabaseUrl(value + "?connection_limit=invalid"),
    ).toThrow("Invalid database connection options");
  });
});
