/**
 * EcoLink Australia — Database Migration Runner
 *
 * Reads schema.sql and seeds/emission_factors.sql and applies them
 * to the PostgreSQL instance defined by DATABASE_URL.
 *
 * Usage:
 *   npx ts-node database/migrate.ts          # run schema + seeds
 *   npx ts-node database/migrate.ts --schema  # schema only
 *   npx ts-node database/migrate.ts --seed    # seeds only
 */

import postgres from "postgres";
import fs from "fs";
import path from "path";
import { config } from "dotenv";

// Load .env from project root (one level up from /database)
config({ path: path.join(__dirname, "../.env") });

if (!process.env.DATABASE_URL) {
  console.error("❌ DATABASE_URL is not set. Check your .env file.");
  process.exit(1);
}

// ---------------------------------------------------------------------------
// Connection
// ---------------------------------------------------------------------------
const sql = postgres(process.env.DATABASE_URL!, {
  ssl: "require",
  max: 5,
  idle_timeout: 20,
  connect_timeout: 30,
  onnotice: (notice) => console.log("📢 PG Notice:", notice.message),
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function readFile(filename: string): string {
  return fs.readFileSync(path.join(__dirname, filename), "utf-8");
}

async function runSQL(label: string, sqlText: string): Promise<void> {
  console.log(`\n⏳ Running: ${label}`);
  try {
    // Execute the entire SQL file as one query so that $$ blocks (functions,
    // DO statements) are never split mid-way by a naïve semicolon parser.
    await sql.unsafe(sqlText);
    console.log(`✅ Done: ${label}`);
  } catch (err: any) {
    console.error(`❌ Failed: ${label}`);
    console.error("   →", err.message);
    throw err;
  }
}

// ---------------------------------------------------------------------------
// Migration steps
// ---------------------------------------------------------------------------
async function runSchema(): Promise<void> {
  const schema = readFile("schema.sql");
  await runSQL("Schema — tables, indexes, triggers", schema);
}

async function runSeeds(): Promise<void> {
  const seeds = readFile("seeds/emission_factors.sql");
  await runSQL("Seeds — NGA Emission Factors (2023–24 edition)", seeds);
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------
async function migrate(): Promise<void> {
  console.log("╔════════════════════════════════════════════╗");
  console.log("║  EcoLink Australia — Database Migration    ║");
  console.log("╚════════════════════════════════════════════╝");

  const args = process.argv.slice(2);
  const schemaOnly = args.includes("--schema");
  const seedOnly   = args.includes("--seed");

  try {
    if (!seedOnly) await runSchema();
    if (!schemaOnly) await runSeeds();

    console.log("\n🏆 Migration completed successfully!\n");
    process.exit(0);
  } catch (err) {
    console.error("\n💥 Migration aborted due to errors.\n");
    process.exit(1);
  } finally {
    await sql.end();
  }
}

migrate();
