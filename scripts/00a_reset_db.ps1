# =============================================================================
# EcoLink Australia - RESET do banco Postgres (DANGER)
#
# Dropa TUDO no schema `public` do DATABASE_URL atual.
# Use APENAS quando:
#   - o DB esta em estado inconsistente (ex.: tabela parcial de tentativa falha)
#   - voce confirma que NAO tem dados de producao la
#
# Depois desse script, rode 00_rodar_todas_migracoes.ps1 pra reconstruir.
# =============================================================================

$ErrorActionPreference = "Stop"

if (-not $env:DATABASE_URL) {
    Write-Host "❌ DATABASE_URL nao definido." -ForegroundColor Red
    exit 1
}

# Confirmacao dupla
Write-Host ""
Write-Host "⚠️  ATENCAO: Este script vai DROPAR TODAS AS TABELAS do DB:" -ForegroundColor Yellow
Write-Host "   $($env:DATABASE_URL -replace ':[^:@/]+@', ':***@')" -ForegroundColor Yellow
Write-Host ""
$confirm = Read-Host "Digite 'RESET' (em caixa alta) para confirmar"
if ($confirm -ne "RESET") {
    Write-Host "Cancelado." -ForegroundColor Cyan
    exit 0
}

$projectRoot = Split-Path -Parent $PSScriptRoot
$env:NODE_PATH = Join-Path $projectRoot "frontend\node_modules"

$resetJs = @'
import postgres from "postgres";
const sql = postgres(process.env.DATABASE_URL, {
  ssl: process.env.DATABASE_URL.includes("localhost") ? false : "require",
  max: 1, connect_timeout: 30,
  onnotice: (n) => console.log("📢", n.message),
});
try {
  console.log("⏳ DROP SCHEMA public CASCADE; CREATE SCHEMA public;");
  await sql.unsafe(`
    DROP SCHEMA IF EXISTS public CASCADE;
    CREATE SCHEMA public;
    GRANT ALL ON SCHEMA public TO postgres;
    GRANT ALL ON SCHEMA public TO public;
  `);
  // Dropa a role ecolink_app se existir (senao a migration 004 da erro de "role already exists"
  // quando a senha muda)
  console.log("⏳ Removendo role ecolink_app (se existir)...");
  await sql.unsafe(`
    DO $$
    BEGIN
      IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'ecolink_app') THEN
        -- Revoga privilegios antes de dropar
        EXECUTE 'REVOKE ALL PRIVILEGES ON ALL TABLES IN SCHEMA public FROM ecolink_app';
        EXECUTE 'REVOKE ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public FROM ecolink_app';
        EXECUTE 'REVOKE ALL ON SCHEMA public FROM ecolink_app';
        EXECUTE 'DROP ROLE ecolink_app';
      END IF;
    END $$;
  `);
  console.log("✅ Reset completo. Agora rode: .\\00_rodar_todas_migracoes.ps1");
} catch (e) {
  console.error("❌", e.message);
  process.exitCode = 1;
} finally {
  await sql.end();
}
'@

$tmpFile = Join-Path $env:TEMP "ecolink_reset_$([guid]::NewGuid().ToString('N')).mjs"
Set-Content -Path $tmpFile -Value $resetJs -Encoding UTF8

try {
    node $tmpFile
    if ($LASTEXITCODE -ne 0) { throw "Reset falhou" }
} finally {
    Remove-Item $tmpFile -ErrorAction SilentlyContinue
}

Write-Host ""
Write-Host "Pressione qualquer tecla para fechar..."
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
