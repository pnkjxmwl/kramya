/** Bound steady-state connections and old/new-process deployment overlap. */
export function boundedDatabaseUrl(value: string): string {
  try {
    const url = new URL(value);
    const requested = Number(url.searchParams.get("connection_limit") ?? "4");
    if (
      !["postgres:", "postgresql:"].includes(url.protocol) ||
      !Number.isInteger(requested) ||
      requested < 1
    )
      throw new Error();
    url.searchParams.set("connection_limit", String(Math.min(requested, 4)));
    if (!url.searchParams.has("pool_timeout"))
      url.searchParams.set("pool_timeout", "10");
    if (!url.searchParams.has("connect_timeout"))
      url.searchParams.set("connect_timeout", "10");
    return url.toString();
  } catch {
    throw new Error("Invalid database connection options");
  }
}
