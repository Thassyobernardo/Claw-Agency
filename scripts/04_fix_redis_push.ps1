# =============================================================================
# EcoLink Australia - Fix: remover dependencia redis + repushar
#
# O commit 3808863 quebrou no build do Vercel porque:
#   1. rate-limit.ts importava o pacote `redis`
#   2. `redis` estava no package.json mas sem entrada no package-lock.json
#   3. Vercel rodou npm ci e nao instalou -> Turbopack nao achou o modulo
#
# Fix aplicado:
#   - rate-limit.ts agora e so in-memory (sem redis)
#   - redis removido do package.json + package-lock.json
#
# Este script amend + force-push esses 3 arquivos pra desbloquear o deploy.
#
# Uso: botao direito -> Run with PowerShell
# =============================================================================

$ErrorActionPreference = "Stop"

$projectRoot = Split-Path -Parent $PSScriptRoot
Set-Location $projectRoot

Write-Host ""
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Yellow
Write-Host " EcoLink  ·  Remover redis + force push" -ForegroundColor Yellow
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Yellow
Write-Host ""

# ─── Passo 1: stage ───────────────────────────────────────────────────────────
Write-Host "[1/3] Adicionando arquivos corrigidos ao stage..." -ForegroundColor Cyan

& git add frontend/src/lib/rate-limit.ts frontend/package.json frontend/package-lock.json 2>&1 | Out-Null

$staged = & git diff --cached --name-only 2>&1
if (-not $staged) {
    Write-Host "  ℹ️  Nada pra commitar — talvez o fix nao tenha chegado no filesystem." -ForegroundColor Yellow
    Read-Host "Pressione Enter para fechar"
    exit 0
}

Write-Host "  Arquivos no stage:" -ForegroundColor Gray
$staged | ForEach-Object { Write-Host "    $_" -ForegroundColor Gray }

# ─── Passo 2: amend ───────────────────────────────────────────────────────────
Write-Host ""
Write-Host "[2/3] Amend do commit HEAD..." -ForegroundColor Cyan
& git commit --amend --no-edit 2>&1 | Out-Null
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Amend falhou." -ForegroundColor Red
    Read-Host "Pressione Enter para fechar"
    exit 1
}
Write-Host "  ✓ Amend OK" -ForegroundColor Green

# ─── Passo 3: force-push ──────────────────────────────────────────────────────
Write-Host ""
Write-Host "[3/3] Force push (--force-with-lease)..." -ForegroundColor Cyan

$pushOut = & git push --force-with-lease 2>&1
$pushExit = $LASTEXITCODE

if ($pushExit -ne 0) {
    Write-Host "❌ Push falhou:" -ForegroundColor Red
    $pushOut | ForEach-Object { Write-Host "  $_" -ForegroundColor Red }
    Read-Host "Pressione Enter para fechar"
    exit 1
}

Write-Host "  ✓ Push OK" -ForegroundColor Green
$pushOut | ForEach-Object { Write-Host "  $_" -ForegroundColor Gray }

Write-Host ""
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Green
Write-Host "✅ Feito. Vercel ja deve estar disparando o build novo." -ForegroundColor Green
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Green
Write-Host ""
Write-Host "Cheque em: https://vercel.com/thassyobernardos-projects/claw-agency/deployments" -ForegroundColor Cyan
Write-Host "Desta vez deve passar. Me avisa se der erro." -ForegroundColor Cyan
Write-Host ""
Read-Host "Pressione Enter para fechar"
