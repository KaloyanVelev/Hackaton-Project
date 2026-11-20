import pg from "pg";

const shared = globalThis as typeof globalThis & { streetAwarePool?: pg.Pool };

export function database() {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required.");
  shared.streetAwarePool ??= new pg.Pool({
    connectionString: process.env.DATABASE_URL,
    max: 8,
    connectionTimeoutMillis: 5_000,
    statement_timeout: 60_000,
  });
  return shared.streetAwarePool;
}
