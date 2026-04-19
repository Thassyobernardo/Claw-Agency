#!/usr/bin/env node
/**
 * Runner para migracoes incrementais do EcoLink.
 *
 * Uso:
 *   DATABASE_URL=...  ECOLINK_APP_DB_PASSWORD=... \
 *   node scripts/run_migration.mjs database/migrations/004_row_level_security.sql
 *
 * Em Windows PowerShell:
 *   $env:DATABASE_URL = "postgres://..."
 *   $env:ECOLINK_APP_DB_PASSWORD = "..."
 *   node scripts\run_migration.mjs database\migrations\004_row_level_security.sql
 *
 * O runner:
 *   - valida env vars obrigatorias
 *   - se a migracao referencia `app.ecolink_password`, faz SET SESSION antes
 *   - executa o SQL inteiro via uma unica query (preserva $$ blocks)
 *   - imprime NOTICEs do Postgres (ex.: "✅ NGA 2024–25 edition loaded")
 */

import fs from "node:fs";
import path from "node:path";
import postgres from "postgres";

const [,, fileArg] = process.argv;
if (!fileArg) {
  console.error("Uso: node scripts/run_migration.mjs <path/to/migration.sql>");
  process.exit(1);
}

const migrationPath = path.resolve(process.cwd(), fileArg);
if (!fs.existsSync(migrationPath)) {
  console.error(`❌ Arquivo nao encontrado: ${migrationPath}`);
  process.exit(1);
}

const { DATABASE_URL, ECOLINK_APP_DB_PASSWORD } = process.env;
if (!DATABASE_URL) {
  console.error("❌ DATABASE_URL nao definido. Pegue do Railway → Postgres plugin → Connect.");
  process.exit(1);
}

const sqlText = fs.readFileSync(migrationPath, "utf-8");
const needsAppPassword = /current_setting\('app\.ecolink_password'/.test(sqlText);

if (needsAppPassword) {
  if (!ECOLINK_APP_DB_PASSWORD || ECOLINK_APP_DB_PASSWORD.length < 16 || ECOLINK_APP_DB_PASSWORD === "CHANGE_ME_IN_PRODUCTION") {
    console.error(
      "❌ ECOLINK_APP_DB_PASSWORD nao definido ou muito fraco (min 16 chars).\n" +
      "   Gere com: node -e \"console.log(require('crypto').randomBytes(24).toString('base64'))\"\n" +
      "   Use o MESMO valor no Vercel (env var ECOLINK_APP_DB_PASSWORD)."
    );
    process.exit(1);
  }
}

console.log(`\n⏳ Aplicando migracao: ${path.basename(migrationPath)}`);
console.log(`   Postgres: ${DATABASE_URL.replace(/:[^:@/]+@/, ":***@")}`);

const sql = postgres(DATABASE_URL, {
  ssl: DATABASE_URL.includes("localhost") ? false : "require",
  max: 1,
  connect_timeout: 30,
  onnotice: (n) => console.log("📢", n.message),
});

try {
  if (needsAppPassword) {
    // Escapa aspas simples na senha antes de interpolar no SET SESSION.
    // Usamos `app.ecolink_password` porque custom GUCs no Postgres exigem
    // um "." no nome — sem isso o server rejeita como "unrecognized parameter".
    const escaped = ECOLINK_APP_DB_PASSWORD.replace(/'/g, "''");
    await sql.unsafe(`SET SESSION "app.ecolink_password" = '${escaped}'`);
    console.log("   ✓ app.ecolink_password definido para esta sessao");
  }
  await sql.unsafe(sqlText);
  console.log(`✅ Migracao aplicada com sucesso: ${path.basename(migrationPath)}\n`);
} catch (err) {
  console.error(`\n❌ Migracao falhou: ${err.message}\n`);
  process.exitCode = 1;
} finally {
  await sql.end();
}
