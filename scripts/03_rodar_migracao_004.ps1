# ─────────────────────────────────────────────────────────────────────────────
# EcoLink Australia — Aplicar Migracao 004 (Row Level Security)
#
# Cria a role Postgres 'ecolink_app' com senha forte, habilita RLS nas tabelas
# multi-tenant (transactions, users) e instala as policies de isolamento por
# company_id.
#
# Pre-requisitos:
#   - Node.js instalado (voce ja usa pro Next.js)
#   - pacote 'postgres' instalado no projeto (ja esta em frontend/package.json)
#   - DATABASE_URL do Railway
#   - ECOLINK_APP_DB_PASSWORD (o MESMO que voce vai colar no Vercel)
#
# Uso:
#   1. Abra PowerShell na pasta scripts\
#   2. $env:DATABASE_URL = "postgres://postgres:xxx@xxx.railway.internal:5432/railway"
#      (pegue em Railway → Postgres plugin → Connect → "Postgres Connection URL")
#   3. $env:ECOLINK_APP_DB_PASSWORD = "<a mesma senha do .vercel_env.txt>"
#   4. .\03_rodar_migracao_004.ps1
# ─────────────────────────────────────────────────────────────────────────────

$ErrorActionPreference = "Stop"

# ─── Validacoes ─────────────────────────────────────────────────────────────
if (-not $env:DATABASE_URL) {
    Write-Host "❌ DATABASE_URL nao definido." -ForegroundColor Red
    Write-Host "`nFaca:" -ForegroundColor Yellow
    Write-Host '  $env:DATABASE_URL = "postgres://..."' -ForegroundColor Yellow
    Write-Host "  (pegue em Railway → Postgres → Connect → Postgres Connection URL)"
    exit 1
}

if (-not $env:ECOLINK_APP_DB_PASSWORD -or $env:ECOLINK_APP_DB_PASSWORD.Length -lt 16) {
    Write-Host "❌ ECOLINK_APP_DB_PASSWORD nao definido ou menor que 16 chars." -ForegroundColor Red
    Write-Host "`nFaca:" -ForegroundColor Yellow
    Write-Host '  $env:ECOLINK_APP_DB_PASSWORD = "<senha_gerada_pelo_02_gerar_secrets.ps1>"' -ForegroundColor Yellow
    Write-Host "  (o MESMO valor que voce colou no Vercel)"
    exit 1
}

# ─── Caminhos ───────────────────────────────────────────────────────────────
$projectRoot = Split-Path -Parent $PSScriptRoot
$runner      = Join-Path $PSScriptRoot "run_migration.mjs"
$migration   = Join-Path $projectRoot  "database\migrations\004_row_level_security.sql"

if (-not (Test-Path $migration)) {
    Write-Host "❌ Arquivo de migracao nao encontrado: $migration" -ForegroundColor Red
    exit 1
}

# ─── Garantir que 'postgres' (node package) esta instalado ──────────────────
$frontendNodeModules = Join-Path $projectRoot "frontend\node_modules\postgres"
if (-not (Test-Path $frontendNodeModules)) {
    Write-Host "⚠️  Pacote 'postgres' nao encontrado em frontend/node_modules." -ForegroundColor Yellow
    Write-Host "    Rodando 'npm install' em frontend/ ..." -ForegroundColor Yellow
    Push-Location (Join-Path $projectRoot "frontend")
    try { npm install | Out-Null } finally { Pop-Location }
}

# O runner importa 'postgres' — adicionar frontend/node_modules ao NODE_PATH
$env:NODE_PATH = Join-Path $projectRoot "frontend\node_modules"

# ─── Rodar ──────────────────────────────────────────────────────────────────
Write-Host "`n━━ Aplicando Migracao 004 — Row Level Security ━━" -ForegroundColor Cyan
Push-Location $projectRoot
try {
    node $runner "database/migrations/004_row_level_security.sql"
    $exit = $LASTEXITCODE
} finally {
    Pop-Location
}

if ($exit -ne 0) {
    Write-Host "`n❌ Migracao falhou (exit $exit)." -ForegroundColor Red
    Write-Host "   Causas mais comuns:" -ForegroundColor Yellow
    Write-Host "   • DATABASE_URL apontando para o Postgres errado"
    Write-Host "   • ECOLINK_APP_DB_PASSWORD nao passou a validacao (min 16 chars)"
    Write-Host "   • Tabelas transactions/users ainda nao criadas — rode o schema primeiro:"
    Write-Host "       cd database; npx ts-node migrate.ts --schema"
    exit 1
}

Write-Host "`n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Yellow
Write-Host "✅ Migracao 004 aplicada com sucesso" -ForegroundColor Green
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Yellow
Write-Host ""
Write-Host "Criado:"
Write-Host "  • Role Postgres 'ecolink_app' (login + senha)"
Write-Host "  • RLS habilitado em: transactions, users"
Write-Host "  • Policies de isolamento por company_id"
Write-Host "  • Funcao set_company_context(uuid)"
Write-Host ""
Write-Host "Proximos passos:" -ForegroundColor Cyan
Write-Host "  1. Confirme ECOLINK_APP_DB_PASSWORD no Vercel Environment Variables"
Write-Host "  2. Redeploy o Vercel (Deployments → … → Redeploy)"
Write-Host "  3. Teste /api/auth/register — se cadastrar OK, RLS nao esta quebrando nada"

Write-Host "`nPressione qualquer tecla para fechar..."
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
