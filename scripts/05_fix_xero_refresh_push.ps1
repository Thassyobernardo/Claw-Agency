# =============================================================================
# EcoLink Australia - Fix: xero/refresh/route.ts (import do type XeroTokenSet)
#
# O commit c3881ba quebrou no typecheck do Vercel porque:
#   ./src/app/api/auth/xero/refresh/route.ts linha 54 usa `XeroTokenSet`
#   mas o import no topo do arquivo (no commit) era so:
#       import { refreshAccessToken } from "@/lib/xero";
#   faltava o `type XeroTokenSet`.
#
# O arquivo local ja tem o fix:
#       import { refreshAccessToken, type XeroTokenSet } from "@/lib/xero";
#
# Este script stage + amend + force-push esse unico arquivo.
#
# Uso: botao direito -> Run with PowerShell
# =============================================================================

$ErrorActionPreference = "Stop"

$projectRoot = Split-Path -Parent $PSScriptRoot
Set-Location $projectRoot

Write-Host ""
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Yellow
Write-Host " EcoLink  ·  Fix xero/refresh type import + force push" -ForegroundColor Yellow
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Yellow
Write-Host ""

# ─── Passo 1: stage ───────────────────────────────────────────────────────────
Write-Host "[1/3] Adicionando arquivo corrigido ao stage..." -ForegroundColor Cyan

& git add frontend/src/app/api/auth/xero/refresh/route.ts 2>&1 | Out-Null

$staged = & git diff --cached --name-only 2>&1
if (-not $staged) {
    Write-Host "  ℹ️  Nada pra commitar — o arquivo local ja esta identico ao HEAD." -ForegroundColor Yellow
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
Write-Host "Desta vez ja vai — so tinha esse type import faltando." -ForegroundColor Cyan
Write-Host ""
Read-Host "Pressione Enter para fechar"
