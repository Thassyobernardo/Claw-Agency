# =============================================================================
# EcoLink Australia - Fix: adicionar validators.ts ao commit e repushar
#
# O commit 3ab363d passou no GitHub mas quebrou no build do Vercel porque
# register/route.ts importa { isValidAbn } de @/lib/validators, e esse
# arquivo nao tinha sido commitado. Aqui vamos:
#   1. Stage do validators.ts (e de qualquer outro arquivo lib esquecido).
#   2. Amend no HEAD.
#   3. Force-push (porque reescreve o commit que ja foi empurrado).
#
# Uso: botao direito neste arquivo -> Run with PowerShell
#      OU
#      cd C:\Users\Taric\Desktop\clawbot-real\scripts
#      .\03_fix_validators_push.ps1
# =============================================================================

$ErrorActionPreference = "Stop"

$projectRoot = Split-Path -Parent $PSScriptRoot
Set-Location $projectRoot

Write-Host ""
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Yellow
Write-Host " EcoLink  ·  Fix validators.ts + force push" -ForegroundColor Yellow
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Yellow
Write-Host ""

# ─── Passo 1: stage dos arquivos ─────────────────────────────────────────────
Write-Host "[1/3] Adicionando arquivos que faltaram no stage..." -ForegroundColor Cyan

# validators.ts e o culpado principal. Stage tambem crypto.ts, rate-limit.ts,
# auth.ts e afins caso tenham mudancas locais nao-commitadas.
$paths = @(
    "frontend/src/lib/validators.ts",
    "frontend/src/lib/crypto.ts",
    "frontend/src/lib/rate-limit.ts",
    "frontend/src/lib/auth.ts",
    "frontend/src/lib/stripe.ts",
    "frontend/src/lib/db.ts"
)

foreach ($p in $paths) {
    $full = Join-Path $projectRoot $p
    if (Test-Path $full) {
        & git add $p 2>&1 | Out-Null
    }
}

$staged = & git diff --cached --name-only 2>&1
if (-not $staged) {
    Write-Host "  ℹ️  Nada mudou no lib/ — validators.ts ja devia estar OK." -ForegroundColor Yellow
    Write-Host "     Tentando um build local seria melhor. Fechando." -ForegroundColor Yellow
    Read-Host "Pressione Enter para fechar"
    exit 0
}

Write-Host "  Arquivos no stage:" -ForegroundColor Gray
$staged | ForEach-Object { Write-Host "    $_" -ForegroundColor Gray }

# ─── Passo 2: amend no HEAD ──────────────────────────────────────────────────
Write-Host ""
Write-Host "[2/3] Amend do commit HEAD..." -ForegroundColor Cyan
& git commit --amend --no-edit 2>&1 | Out-Null
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Amend falhou." -ForegroundColor Red
    Read-Host "Pressione Enter para fechar"
    exit 1
}
Write-Host "  ✓ Amend OK" -ForegroundColor Green

# ─── Passo 3: force-push ─────────────────────────────────────────────────────
# Precisa ser --force-with-lease porque o commit ja existia no remote
# (3ab363d). Estamos sobrescrevendo com uma versao que compila.
Write-Host ""
Write-Host "[3/3] Force push (com safety --force-with-lease)..." -ForegroundColor Cyan

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
Write-Host "✅ Feito. Vercel ja deve estar disparando o novo build." -ForegroundColor Green
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Green
Write-Host ""
Write-Host "Cheque em: https://vercel.com/thassyobernardos-projects/claw-agency/deployments" -ForegroundColor Cyan
Write-Host ""
Read-Host "Pressione Enter para fechar"
