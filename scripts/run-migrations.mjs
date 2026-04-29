#!/usr/bin/env node
/**
 * EcoLink — Migration runner
 *
 * Connects to Railway Postgres via DATABASE_URL (read from frontend/.env.local)
 * and applies any pending SQL migrations in order. Idempotent — safe to re-run.
 *
 * Usage (from project root):
 *   cd C:\Users\Taric\Desktop\clawbot-real
 *   node scripts/run-migrations.mjs
 *
 * Optional flags:
 *   --check         — only print what would run, don't execute
 *   --only=NNN      — run only one migration (e.g. --only=014)
 *   --from=NNN      — start at this migration, skip earlier (e.g. --from=011)
 *   --baseline=NNN  — mark all migrations <= NNN as already applied (no SQL run),
 *                     then continue with newer ones. Use this once when adopting
 *                     this tool for the first time on a DB where older migrations
 *                     were already applied by other means.
 */

import { readFileSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import postgres from "../frontend/node_modules/postgres/src/index.js";

const __dirname  = dirname(fileURLToPath(import.meta.url));
const ROOT       = join(__dirname, "..");
const ENV_PATH   = join(ROOT, "frontend", ".env.local");
const MIGR_DIR   = join(ROOT, "database", "migrations");

const args        = process.argv.slice(2);
const dryRun      = args.includes("--check");
const onlyArg     = args.find((a) => a.startsWith("--only="));
const onlyId      = onlyArg ? onlyArg.split("=")[1] : null;
const fromArg     = args.find((a) => a.startsWith("--from="));
const fromId      = fromArg ? fromArg.split("=")[1] : null;
const baselineArg = args.find((a) => a.startsWith("--baseline="));
const baselineId  = baselineArg ? baselineArg.split("=")[1] : null;

// ── Read DATABASE_URL from .env.local ─────────────────────────────────────
let DATABASE_URL;
try {
  const env = readFileSync(ENV_PATH, "utf8");
  const m = env.match(/^DATABASE_URL=(.+)$/m);
  if (!m) throw new Error("DATABASE_URL not found in .env.local");
  DATABASE_URL = m[1].trim();
} catch (err) {
  console.error(`✗ Could not read DATABASE_URL from ${ENV_PATH}`);
  console.error(`  ${err.message}`);
  process.exit(1);
}

const masked = DATABASE_URL.replace(/:[^:@]+@/, ":***@");
console.log(`🔌 Target: ${masked}\n`);

// ── Build migration list ──────────────────────────────────────────────────
let migrations = readdirSync(MIGR_DIR)
  .filter((f) => /^\d{3}_.*\.sql$/.test(f))
  .sort();

if (onlyId) {
  const filtered = migrations.filter((f) => f.startsWith(onlyId + "_"));
  if (filtered.length === 0) {
    console.error(`✗ No migration matches --only=${onlyId}`);
    process.exit(1);
  }
  migrations = filtered;
}

if (fromId) {
  const idx = migrations.findIndex((f) => f.startsWith(fromId + "_"));
  if (idx === -1) {
    console.error(`✗ No migration matches --from=${fromId}`);
    process.exit(1);
  }
  migrations = migrations.slice(idx);
}

console.log(`📋 ${migrations.length} migration(s) to run:`);
for (const f of migrations) console.log(`   • ${f}`);
console.log();

if (dryRun) {
  console.log("Dry-run only (--check). Exiting without changes.");
  process.exit(0);
}

// ── Connect ───────────────────────────────────────────────────────────────
const sql = postgres(DATABASE_URL, {
  ssl: "require",
  max: 1,
  idle_timeout: 5,
  connect_timeout: 30,
});

// ── Track which migrations have run (uses _migrations table) ─────────────
async function ensureTrackingTable() {
  await sql`
    CREATE TABLE IF NOT EXISTS _migrations (
      filename TEXT PRIMARY KEY,
      applied_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
    )
  `;
}

async function isApplied(filename) {
  const r = await sql`SELECT 1 FROM _migrations WHERE filename = ${filename} LIMIT 1`;
  return r.length > 0;
}

async function markApplied(filename) {
  await sql`INSERT INTO _migrations (filename) VALUES (${filename}) ON CONFLICT DO NOTHING`;
}

// ── Run ──────────────────────────────────────────────────────────────────
let ok = 0, skipped = 0, failed = 0;

try {
  await ensureTrackingTable();

  // ── Baseline mode — mark old migrations as applied without running them ──
  if (baselineId) {
    const allFiles = readdirSync(MIGR_DIR)
      .filter((f) => /^\d{3}_.*\.sql$/.test(f))
      .sort();
    const baselineFiles = allFiles.filter((f) => f.split("_")[0] <= baselineId);
    console.log(`🏷  Baseline mode: marking ${baselineFiles.length} migration(s) <= ${baselineId} as applied (no SQL run):`);
    for (const f of baselineFiles) {
      const already = await isApplied(f);
      if (already) {
        console.log(`   ⏭  ${f} — already in tracking`);
      } else {
        await markApplied(f);
        console.log(`   ✓ ${f} — marked applied`);
      }
    }
    console.log();
  }

  for (const filename of migrations) {
    // Skip baseline range — they're already in _migrations now
    if (baselineId && filename.split("_")[0] <= baselineId) continue;
    const applied = await isApplied(filename);
    if (applied && !onlyId) {
      console.log(`⏭  ${filename} — already applied`);
      skipped++;
      continue;
    }

    console.log(`▶  ${filename}`);
    const sqlText = readFileSync(join(MIGR_DIR, filename), "utf8");
    try {
      await sql.unsafe(sqlText);
      await markApplied(filename);
      console.log(`   ✓ OK\n`);
      ok++;
    } catch (err) {
      console.error(`   ✗ FAILED: ${err.message}\n`);
      failed++;
      // Stop on first failure to avoid cascading errors
      break;
    }
  }

  console.log("─".repeat(60));
  console.log(`Done. ${ok} applied · ${skipped} skipped · ${failed} failed.`);
} catch (err) {
  console.error(`✗ Connection or setup failed: ${err.message}`);
  failed = 1;
} finally {
  await sql.end({ timeout: 5 });
}

process.exit(failed > 0 ? 1 : 0);
