/**
 * EcoLink Australia — PostgreSQL singleton for Next.js API routes.
 *
 * Uses the `postgres` (postgres.js) driver.  In development the module is
 * hot-reloaded, so we cache the client on the global object to avoid
 * exhausting the connection pool between reloads.
 */

import postgres from "postgres";

declare global {
  // Prevent multiple instances during Next.js hot-reload
  // eslint-disable-next-line no-var
  var __ecolink_sql: postgres.Sql | undefined;
}

function createClient(): postgres.Sql {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error(
      "DATABASE_URL is not set. Add it to frontend/.env.local"
    );
  }
  return postgres(url, {
    ssl: "require",
    max: 5,
    idle_timeout: 30,
    connect_timeout: 30,
  });
}

export const sql: postgres.Sql =
  globalThis.__ecolink_sql ?? (globalThis.__ecolink_sql = createClient());
