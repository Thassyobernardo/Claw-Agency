#!/usr/bin/env node
/**
 * EcoLink — Schema verification
 *
 * Connects to Railway Postgres and confirms that all 4 compliance migrations
 * have actually changed the schema (column added, table created, factors
 * refreshed, categories present).
 *
 * Usage:  node scripts/verify-schema.mjs
 */

import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import postgres from "../frontend/node_modules/postgres/src/index.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ENV_PATH  = join(__dirname, "..", "frontend", ".env.local");

const env = readFileSync(ENV_PATH, "utf8");
const DATABASE_URL = env.match(/^DATABASE_URL=(.+)$/m)[1].trim();

const sql = postgres(DATABASE_URL, { ssl: "require", max: 1, connect_timeout: 30 });

const checks = [];
const tick = (ok, label, detail = "") => checks.push({ ok, label, detail });

try {
  // 1. transactions.electricity_state column exists (migration 011)
  const colRows = await sql`
    SELECT column_name
    FROM   information_schema.columns
    WHERE  table_name = 'transactions'
      AND  column_name IN ('electricity_state', 'excluded', 'exclusion_reason')
  `;
  tick(colRows.length === 3,
       "Migration 011 — transactions has electricity_state, excluded, exclusion_reason",
       `Found: ${colRows.map(r => r.column_name).join(", ")}`);

  // 1b. companies has reporting_period and assurance fields
  const compCol = await sql`
    SELECT column_name
    FROM   information_schema.columns
    WHERE  table_name = 'companies'
      AND  column_name IN ('reporting_period_start','reporting_period_end','assurance_status','assurance_provider')
  `;
  tick(compCol.length === 4,
       "Migration 011 — companies has reporting_period_* + assurance_*",
       `Found: ${compCol.map(r => r.column_name).join(", ")}`);

  // 2. company_governance table exists (migration 012)
  const govTbl = await sql`
    SELECT table_name FROM information_schema.tables
    WHERE  table_name = 'company_governance' AND table_schema = 'public'
  `;
  tick(govTbl.length === 1,
       "Migration 012 — company_governance table exists");

  // 3. Cat 6 categories exist (migration 013)
  const cat6 = await sql`
    SELECT code FROM emission_categories
    WHERE  code IN ('rideshare_taxi','public_transport','rental_vehicle',
                    'air_travel_domestic','air_travel_international',
                    'accommodation_business','refrigerants',
                    'excluded_personal','excluded_finance')
  `;
  tick(cat6.length === 9,
       "Migration 013 — Cat 6 + exclusion categories present",
       `Found ${cat6.length}/9: ${cat6.map(r => r.code).join(", ")}`);

  // 4. NGA 2024 Scope 2 factors are set (migration 014)
  const efRows = await sql`
    SELECT state, co2e_factor::text AS f
    FROM   emission_factors
    WHERE  is_current = TRUE AND scope = 2 AND unit = 'kWh'
    ORDER  BY state
  `;
  const expected = { NSW: "0.66", VIC: "0.79", QLD: "0.71", SA: "0.20",
                     WA:  "0.51", TAS: "0.13", ACT: "0.66", NT: "0.61" };
  let allMatch = true;
  const factorReport = [];
  for (const r of efRows) {
    const exp = expected[r.state];
    const match = exp && Math.abs(parseFloat(r.f) - parseFloat(exp)) < 0.001;
    factorReport.push(`${r.state}=${r.f}${match ? "✓" : `✗ (expected ${exp})`}`);
    if (!match) allMatch = false;
  }
  tick(efRows.length === 8 && allMatch,
       "Migration 014 — Scope 2 factors match NGA 2024",
       factorReport.join(" · "));

  // 5. _migrations tracking table — list applied
  const applied = await sql`
    SELECT filename, applied_at::text FROM _migrations ORDER BY filename
  `.catch(() => []);
  console.log(`\n📋 _migrations table — applied:`);
  if (applied.length === 0) {
    console.log("   (empty — runner did not record any)");
  } else {
    applied.forEach(r => console.log(`   ✓ ${r.filename}  @ ${r.applied_at}`));
  }

  // ── Print results ──────────────────────────────────────────────
  console.log(`\n${"═".repeat(70)}\nSCHEMA VERIFICATION\n${"═".repeat(70)}`);
  for (const c of checks) {
    const icon = c.ok ? "✓" : "✗";
    const colour = c.ok ? "\x1b[32m" : "\x1b[31m";
    console.log(`${colour}${icon} ${c.label}\x1b[0m`);
    if (c.detail) console.log(`     ${c.detail}`);
  }

  const allOk = checks.every(c => c.ok);
  console.log(`\n${allOk ? "🎉 All migrations verified successfully!" : "⚠️  Some checks failed — see above."}`);
  process.exit(allOk ? 0 : 1);

} catch (err) {
  console.error(`\n✗ Verification failed: ${err.message}`);
  process.exit(1);
} finally {
  await sql.end({ timeout: 5 });
}
