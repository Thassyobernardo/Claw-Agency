# =============================================================================
# EcoLink Australia - Rodar TODAS as migracoes em ordem (com auto-detect)
#
# Fluxo:
#   0. Health check: se o DB esta em estado quebrado (tabelas parciais de
#      tentativa anterior), oferece RESET automatico.
#   1. Schema + seeds (npm run migrate -> database/schema.sql + emission_factors)
#   2-7. Migracoes incrementais 004-009
#
# Pre-requisitos:
#   $env:DATABASE_URL            = "postgresql://..."
#   $env:ECOLINK_APP_DB_PASSWORD = "<min 16 chars>"
#
# Flags opcionais:
#   -ForceReset : pula confirmacao e faz DROP SCHEMA public CASCADE direto.
#
# Uso:
#   cd C:\Users\Taric\Desktop\clawbot-real\scripts
#   .\00_rodar_todas_migracoes.ps1
#   .\00_rodar_todas_migracoes.ps1 -ForceReset   # modo nao-interativo
# =============================================================================

param(
    [switch]$ForceReset
)

$ErrorActionPreference = "Stop"

if (-not $env:DATABASE_URL) {
    Write-Host "❌ DATABASE_URL nao definido." -ForegroundColor Red
    Write-Host '  Faca: $env:DATABASE_URL = "postgresql://..."' -ForegroundColor Yellow
    exit 1
}
if (-not $env:ECOLINK_APP_DB_PASSWORD -or $env:ECOLINK_APP_DB_PASSWORD.Length -lt 16) {
    Write-Host "❌ ECOLINK_APP_DB_PASSWORD nao definido ou < 16 chars." -ForegroundColor Red
    exit 1
}

$projectRoot = Split-Path -Parent $PSScriptRoot
$runner      = Join-Path $PSScriptRoot "run_migration.mjs"

# Garante que 'postgres' esta em node_modules da raiz (onde ficam ts-node + dotenv + postgres)
$rootPg = Join-Path $projectRoot "node_modules\postgres"
if (-not (Test-Path $rootPg)) {
    Write-Host "  Instalando dependencias do projeto raiz (ts-node, postgres, dotenv)..." -ForegroundColor Yellow
    Push-Location $projectRoot
    try { npm install | Out-Null } finally { Pop-Location }
}
# NODE_PATH nao funciona pra ESM imports — escrevemos os temps .mjs dentro do
# projectRoot pra ESM resolver 'postgres' a partir de node_modules/ da raiz.

# --- Step 0: health check ----------------------------------------------------
Write-Host "`n━━ Step 0/7: Health check do banco ━━" -ForegroundColor Cyan

$healthJs = @'
import postgres from "postgres";
const sql = postgres(process.env.DATABASE_URL, {
  ssl: process.env.DATABASE_URL.includes("localhost") ? false : "require",
  max: 1, connect_timeout: 30,
});
try {
  const [{ count }] = await sql`
    SELECT COUNT(*)::int AS count
    FROM information_schema.tables
    WHERE table_schema='public' AND table_type='BASE TABLE'
  `;
  const [{ has_users }] = await sql`
    SELECT EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema='public' AND table_name='users'
    ) AS has_users
  `;
  let has_company_id = null;
  if (has_users) {
    const [{ has }] = await sql`
      SELECT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema='public' AND table_name='users' AND column_name='company_id'
      ) AS has
    `;
    has_company_id = has;
  }
  const state = {
    table_count: count,
    has_users,
    has_company_id,
    broken: has_users && !has_company_id,
    empty: count === 0,
  };
  console.log("STATE:" + JSON.stringify(state));
} finally {
  await sql.end();
}
'@

$tmpHealth = Join-Path $projectRoot "_ecolink_health_$([guid]::NewGuid().ToString('N')).mjs"
Set-Content -Path $tmpHealth -Value $healthJs -Encoding UTF8
$healthOut = & node $tmpHealth 2>&1
Remove-Item $tmpHealth -ErrorAction SilentlyContinue

if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Nao consegui conectar no DB. Output:" -ForegroundColor Red
    Write-Host $healthOut
    exit 1
}

$stateLine = $healthOut | Select-String -Pattern '^STATE:' | Select-Object -First 1
if (-not $stateLine) {
    Write-Host "❌ Health check nao retornou estado. Output:" -ForegroundColor Red
    Write-Host $healthOut
    exit 1
}
$state = $stateLine.ToString().Substring(6) | ConvertFrom-Json

Write-Host ("  Tabelas: {0} | users existe: {1} | users.company_id: {2}" -f `
    $state.table_count, $state.has_users, $state.has_company_id) -ForegroundColor Gray

$needsReset = $false
if ($state.broken) {
    Write-Host "⚠️  DB esta em estado QUEBRADO (users sem company_id, de tentativa anterior)." -ForegroundColor Yellow
    $needsReset = $true
} elseif ($state.has_users -and -not $state.empty) {
    Write-Host "ℹ️  DB ja tem schema (users + outras tabelas)." -ForegroundColor Yellow
    Write-Host "   Se voce quer RECRIAR do zero, responda 's' abaixo." -ForegroundColor Yellow
    if (-not $ForceReset) {
        $ans = Read-Host "   Fazer RESET (drop schema public) e comecar limpo? (s/N)"
        if ($ans -match '^[sSyY]') { $needsReset = $true }
    } else {
        $needsReset = $true
    }
}

if ($needsReset) {
    if (-not $ForceReset) {
        Write-Host ""
        Write-Host "⚠️  Isso vai DROPAR TODAS AS TABELAS e a role ecolink_app." -ForegroundColor Red
        $confirm = Read-Host "   Digite 'RESET' para confirmar"
        if ($confirm -ne "RESET") {
            Write-Host "Cancelado." -ForegroundColor Cyan
            exit 0
        }
    }

    Write-Host "`n  Dropando schema public e role ecolink_app..." -ForegroundColor Yellow

    $resetJs = @'
import postgres from "postgres";
const sql = postgres(process.env.DATABASE_URL, {
  ssl: process.env.DATABASE_URL.includes("localhost") ? false : "require",
  max: 1, connect_timeout: 30,
  onnotice: (n) => console.log("📢", n.message),
});
try {
  await sql.unsafe(`
    DROP SCHEMA IF EXISTS public CASCADE;
    CREATE SCHEMA public;
    GRANT ALL ON SCHEMA public TO postgres;
    GRANT ALL ON SCHEMA public TO public;
  `);
  await sql.unsafe(`
    DO $$
    BEGIN
      IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'ecolink_app') THEN
        BEGIN EXECUTE 'REVOKE ALL PRIVILEGES ON ALL TABLES IN SCHEMA public FROM ecolink_app';
        EXCEPTION WHEN OTHERS THEN NULL; END;
        BEGIN EXECUTE 'REVOKE ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public FROM ecolink_app';
        EXCEPTION WHEN OTHERS THEN NULL; END;
        BEGIN EXECUTE 'REVOKE ALL ON SCHEMA public FROM ecolink_app';
        EXCEPTION WHEN OTHERS THEN NULL; END;
        EXECUTE 'DROP ROLE ecolink_app';
      END IF;
    END $$;
  `);
  console.log("✅ Reset feito.");
} catch (e) {
  console.error("❌", e.message);
  process.exitCode = 1;
} finally {
  await sql.end();
}
'@
    $tmpReset = Join-Path $projectRoot "_ecolink_reset_$([guid]::NewGuid().ToString('N')).mjs"
    Set-Content -Path $tmpReset -Value $resetJs -Encoding UTF8
    & node $tmpReset
    $resetExit = $LASTEXITCODE
    Remove-Item $tmpReset -ErrorAction SilentlyContinue
    if ($resetExit -ne 0) {
        Write-Host "❌ Reset falhou." -ForegroundColor Red
        exit 1
    }
} else {
    Write-Host "  ✓ DB esta limpo ou em estado coerente — seguindo sem reset." -ForegroundColor Green
}

# --- 1. Schema + seeds -------------------------------------------------------
Write-Host "`n━━ Step 1/7: Schema + seeds (npm run migrate) ━━" -ForegroundColor Cyan
Push-Location $projectRoot
try {
    if (-not (Test-Path (Join-Path $projectRoot "node_modules\ts-node"))) {
        Write-Host "  Instalando dependencias do root (ts-node, postgres, dotenv)..." -ForegroundColor Yellow
        npm install | Out-Null
    }
    npm run migrate
    if ($LASTEXITCODE -ne 0) { throw "npm run migrate falhou" }
} finally { Pop-Location }

# --- 2-7. Migracoes incrementais ---------------------------------------------
$migrations = @(
    "database/migrations/004_row_level_security.sql",
    "database/migrations/005_emission_categories.sql",
    "database/migrations/006_sector_benchmarks.sql",
    "database/migrations/007_stripe_columns.sql",
    "database/migrations/008_myob_token.sql",
    "database/migrations/009_nga_2024_25_edition.sql"
)

$step = 2
foreach ($mig in $migrations) {
    Write-Host "`n━━ Step $step/7: $(Split-Path -Leaf $mig) ━━" -ForegroundColor Cyan
    Push-Location $projectRoot
    try {
        node $runner $mig
        if ($LASTEXITCODE -ne 0) {
            Write-Host "`n❌ Migracao $mig falhou. Corrija antes de continuar." -ForegroundColor Red
            exit 1
        }
    } finally { Pop-Location }
    $step++
}

Write-Host "`n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Yellow
Write-Host "✅ Todas as migracoes aplicadas com sucesso" -ForegroundColor Green
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Yellow
Write-Host ""
Write-Host "Verificacao rapida (cole no Railway query editor):"
Write-Host "  SELECT COUNT(*) FROM emission_factors;  -- esperado > 0"
Write-Host "  SELECT rolname FROM pg_roles WHERE rolname = 'ecolink_app';  -- 1 linha"
Write-Host "  SELECT tablename, rowsecurity FROM pg_tables"
Write-Host "    WHERE schemaname='public' AND tablename IN ('users','transactions');"
Write-Host ""
Write-Host "Pressione qualquer tecla para fechar..."
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
