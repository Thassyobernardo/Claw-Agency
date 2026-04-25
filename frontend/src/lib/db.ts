/**
 * EcoLink Australia — PostgreSQL singleton for Next.js API routes.
 *
 * Uses the `postgres` (postgres.js) driver.  The client is created lazily
 * on first use so that build-time imports don't throw when DATABASE_URL
 * isn't available in the Docker build environment.
 */

import postgres from "postgres";

declare global {
  // eslint-disable-next-line no-var
  var __ecolink_sql: postgres.Sql | undefined;
}

function getOrCreateClient(): postgres.Sql {
  if (globalThis.__ecolink_sql) return globalThis.__ecolink_sql;
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set. Add it to frontend/.env.local");
  globalThis.__ecolink_sql = postgres(url, {
    ssl: "require",
    max: 5,
    idle_timeout: 30,
    connect_timeout: 30,
  });
  return globalThis.__ecolink_sql;
}

/**
 * Lazy proxy — the Postgres client is only instantiated when `sql` is first
 * called at runtime, not at module import time.  This keeps Docker builds
 * working without DATABASE_URL in the build environment.
 */
export const sql: postgres.Sql = new Proxy(
  function __lazyTarget() {} as unknown as postgres.Sql,
  {
    apply(_target, thisArg, args) {
      return Reflect.apply(
        getOrCreateClient() as unknown as (...a: unknown[]) => unknown,
        thisArg,
        args,
      );
    },
    get(_target, prop) {
      const client = getOrCreateClient();
      const value = (client as unknown as Record<string | symbol, unknown>)[prop];
      return typeof value === "function"
        ? (value as (...a: unknown[]) => unknown).bind(client)
        : value;
    },
  },
) as postgres.Sql;
