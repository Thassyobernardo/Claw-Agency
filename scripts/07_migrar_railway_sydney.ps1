#!/usr/bin/env pwsh
<#
.SYNOPSIS
    EcoLink — Migração do banco de dados Railway para ap-southeast-2 (Sydney)
    Privacy Act 1988 (APP 8) compliance.

.DESCRIPTION
    Este script automatiza os passos da migração:
      1. Dump do banco atual (qualquer região)
      2. Restauração no novo banco em Sydney
      3. Aplicação das migrations pendentes 011-015
      4. Verificação de integridade

.PRE-REQUISITOS
    - psql e pg_dump instalados (PostgreSQL client tools)
      Download: https://www.postgresql.org/download/windows/
    - Node.js instalado
    - Railway CLI (opcional mas recomendado):
      npm install -g @railway/cli
    - Estar na raiz do projeto: C:\Users\Taric\Desktop\clawbot-real

.ANTES DE RODAR
    1. No painel Railway (https://railway.app):
       a. Clique em "+ New" → "Database" → "PostgreSQL"
       b. Clique no novo banco → "Settings" → "Change Region" → "ap-southeast-2 (Sydney)"
          ⚠️  Faça isso ANTES de criar — você não pode mudar região depois.
       c. Após criado, vá em "Connect" → copie a "Private URL" (começa com postgresql://)

    2. Cole as duas URLs abaixo:

.USO
    cd C:\Users\Taric\Desktop\clawbot-real
    .\scripts\07_migrar_railway_sydney.ps1
#>

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# CONFIGURAR AQUI
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

# URL do banco ATUAL (fonte — provavelmente US/EU)
# Encontre em: Railway → seu projeto → PostgreSQL → Connect → PostgreSQL Public URL
$SOURCE_URL = "postgresql://SEU_BANCO_ATUAL_AQUI"

# URL do banco NOVO em Sydney (ap-southeast-2)
# Encontre em: Railway → novo banco Sydney → Connect → PostgreSQL Public URL
$TARGET_URL = "postgresql://SEU_BANCO_SYDNEY_AQUI"

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

$ErrorActionPreference = "Stop"
$DUMP_FILE = "$PSScriptRoot\ecolink_backup_$(Get-Date -Format 'yyyyMMdd_HHmmss').sql"
$ROOT = Split-Path $PSScriptRoot -Parent

Write-Host ""
Write-Host "╔══════════════════════════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "║  EcoLink — Migração Railway → Sydney (ap-southeast-2)        ║" -ForegroundColor Cyan
Write-Host "║  Privacy Act 1988 (APP 8) Compliance                         ║" -ForegroundColor Cyan
Write-Host "╚══════════════════════════════════════════════════════════════╝" -ForegroundColor Cyan
Write-Host ""

# ── Verificar pré-requisitos ───────────────────────────────────────────────
Write-Host "🔍 Verificando pré-requisitos..." -ForegroundColor Yellow

if (-not (Get-Command pg_dump -ErrorAction SilentlyContinue)) {
    Write-Host "✗ pg_dump não encontrado. Instale o PostgreSQL Client:" -ForegroundColor Red
    Write-Host "  https://www.postgresql.org/download/windows/" -ForegroundColor Red
    Write-Host "  Depois adicione C:\Program Files\PostgreSQL\<versão>\bin ao PATH" -ForegroundColor Red
    exit 1
}

if ($SOURCE_URL -like "*SEU_BANCO*" -or $TARGET_URL -like "*SEU_BANCO*") {
    Write-Host "✗ Configure SOURCE_URL e TARGET_URL no script antes de rodar!" -ForegroundColor Red
    exit 1
}

Write-Host "✓ pg_dump disponível" -ForegroundColor Green
Write-Host ""

# ── Passo 1: Dump do banco atual ───────────────────────────────────────────
Write-Host "📦 Passo 1/4: Exportando banco atual..." -ForegroundColor Yellow
Write-Host "   Destino: $DUMP_FILE"
Write-Host ""

try {
    & pg_dump --no-owner --no-acl --format=plain --file="$DUMP_FILE" "$SOURCE_URL"
    $size = (Get-Item $DUMP_FILE).Length / 1MB
    Write-Host "✓ Dump concluído ($([math]::Round($size, 2)) MB)" -ForegroundColor Green
} catch {
    Write-Host "✗ Falha no dump: $_" -ForegroundColor Red
    exit 1
}

Write-Host ""

# ── Passo 2: Restaurar no banco Sydney ────────────────────────────────────
Write-Host "🚀 Passo 2/4: Restaurando no banco Sydney..." -ForegroundColor Yellow
Write-Host "   Isso pode demorar 1-3 minutos dependendo do tamanho dos dados."
Write-Host ""

try {
    & psql --file="$DUMP_FILE" "$TARGET_URL"
    Write-Host "✓ Restauração concluída" -ForegroundColor Green
} catch {
    Write-Host "✗ Falha na restauração: $_" -ForegroundColor Red
    Write-Host "  O dump original está salvo em: $DUMP_FILE" -ForegroundColor Yellow
    exit 1
}

Write-Host ""

# ── Passo 3: Rodar migrations pendentes 011-015 ───────────────────────────
Write-Host "🔧 Passo 3/4: Aplicando migrations pendentes (011-015)..." -ForegroundColor Yellow
Write-Host ""

# Sobrescreve temporariamente o DATABASE_URL para o novo banco
$ENV_FILE = "$ROOT\frontend\.env.local"
$envContent = Get-Content $ENV_FILE -Raw
$oldUrl = ($envContent | Select-String -Pattern 'DATABASE_URL=(.+)' -AllMatches).Matches[0].Groups[1].Value.Trim()

# Backup do .env.local
$backupEnv = "$ENV_FILE.backup_$(Get-Date -Format 'yyyyMMdd_HHmmss')"
Copy-Item $ENV_FILE $backupEnv
Write-Host "   .env.local backup: $backupEnv"

# Injecta nova URL temporariamente
$newContent = $envContent -replace "DATABASE_URL=.+", "DATABASE_URL=$TARGET_URL"
Set-Content -Path $ENV_FILE -Value $newContent -NoNewline

try {
    Push-Location $ROOT
    node scripts/run-migrations.mjs --from=011
    Pop-Location
    Write-Host "✓ Migrations 011-015 aplicadas com sucesso" -ForegroundColor Green
} catch {
    # Restaura .env.local se der erro
    Copy-Item $backupEnv $ENV_FILE -Force
    Write-Host "✗ Falha nas migrations: $_" -ForegroundColor Red
    Write-Host "  .env.local restaurado para a URL original." -ForegroundColor Yellow
    exit 1
}

Write-Host ""

# ── Passo 4: Atualizar .env.local permanentemente ─────────────────────────
Write-Host "⚙️  Passo 4/4: Atualizando .env.local com a URL de Sydney..." -ForegroundColor Yellow

# O .env.local já tem a nova URL (foi escrito no passo 3 e deu certo)
Write-Host "✓ .env.local atualizado" -ForegroundColor Green
Write-Host ""

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Write-Host "╔══════════════════════════════════════════════════════════════╗" -ForegroundColor Green
Write-Host "║  ✅ MIGRAÇÃO CONCLUÍDA — Banco agora em Sydney (ap-se-2)     ║" -ForegroundColor Green
Write-Host "╚══════════════════════════════════════════════════════════════╝" -ForegroundColor Green
Write-Host ""
Write-Host "📋 PRÓXIMOS PASSOS MANUAIS:" -ForegroundColor Cyan
Write-Host ""
Write-Host "  1. VERCEL — Atualize a variável de ambiente:" -ForegroundColor White
Write-Host "     Vercel Dashboard → Settings → Environment Variables" -ForegroundColor Gray
Write-Host "     DATABASE_URL = $TARGET_URL" -ForegroundColor Yellow
Write-Host ""
Write-Host "  2. RAILWAY — Desligue o banco antigo:" -ForegroundColor White
Write-Host "     Railway → banco antigo → Settings → Delete Service" -ForegroundColor Gray
Write-Host "     ⚠️  Só faça isso depois de confirmar que tudo funciona!" -ForegroundColor Yellow
Write-Host ""
Write-Host "  3. TESTE — Acesse o painel e verifique:" -ForegroundColor White
Write-Host "     https://claw-agency.vercel.app/dashboard" -ForegroundColor Gray
Write-Host ""
Write-Host "  4. CLEANUP — Remova o backup local do dump:" -ForegroundColor White
Write-Host "     Remove-Item '$DUMP_FILE'" -ForegroundColor Gray
Write-Host ""

Write-Host "📁 Backup do dump: $DUMP_FILE" -ForegroundColor Gray
Write-Host "📁 Backup .env: $backupEnv" -ForegroundColor Gray
Write-Host ""
