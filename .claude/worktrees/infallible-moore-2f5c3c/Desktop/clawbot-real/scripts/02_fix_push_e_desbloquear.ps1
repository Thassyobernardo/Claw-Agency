# =============================================================================
# EcoLink Australia - Fix push + desbloquear usuario (tudo em 1 clique)
#
# O que faz:
#   1. Amend do commit ed44b5c com o arquivo 01_criar_stripe_prices.ps1 ja
#      corrigido (sem a chave de teste hardcoded) para passar no GitHub Push
#      Protection (GH013).
#   2. git push (deve funcionar depois do amend).
#   3. Se DATABASE_URL estiver no env, desbloqueia todos os usuarios nao
#      verificados chamando 01_desbloquear_usuario.ps1.
#
# Uso:
#   clique 2x neste arquivo no Explorer      OU
#   cd C:\Users\Taric\Desktop\clawbot-real\scripts
#   .\02_fix_push_e_desbloquear.ps1
#
# Se quiser desbloquear tambem: antes de rodar, abra PowerShell e faca:
#   $env:DATABASE_URL = "postgresql://...(do Railway)..."
# Depois rode o script.
# =============================================================================

$ErrorActionPreference = "Stop"

$projectRoot = Split-Path -Parent $PSScriptRoot
Set-Location $projectRoot

Write-Host ""
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Yellow
Write-Host " EcoLink  ·  Fix push + desbloquear" -ForegroundColor Yellow
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Yellow
Write-Host ""

# ─── Passo 1: git status para confirmar que estamos no repo ──────────────────
Write-Host "[1/4] Verificando repositorio git..." -ForegroundColor Cyan
$branch = & git rev-parse --abbrev-ref HEAD 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Nao estamos em um repositorio git. Estamos em: $projectRoot" -ForegroundColor Red
    Read-Host "Pressione Enter para fechar"
    exit 1
}
Write-Host "  ✓ Branch atual: $branch" -ForegroundColor Green

# ─── Passo 2: stage + amend do commit ────────────────────────────────────────
Write-Host ""
Write-Host "[2/4] Amend do commit HEAD com o arquivo corrigido..." -ForegroundColor Cyan

& git add scripts/01_criar_stripe_prices.ps1 scripts/01_desbloquear_usuario.ps1 scripts/02_fix_push_e_desbloquear.ps1 scripts/00_rodar_todas_migracoes.ps1 frontend/src/app/api/auth/forgot-password/route.ts frontend/src/app/api/auth/resend-verification/route.ts frontend/src/app/api/auth/register/route.ts AUDIT_2026-04-19.md 2>&1 | Out-Null

# Se houver algo no stage, amend. Se nao houver, tenta amend em branco (no-op).
$staged = & git diff --cached --name-only 2>&1
if ($staged) {
    Write-Host "  Arquivos no stage:" -ForegroundColor Gray
    $staged | ForEach-Object { Write-Host "    $_" -ForegroundColor Gray }
    & git commit --amend --no-edit 2>&1 | Out-Null
    if ($LASTEXITCODE -ne 0) {
        Write-Host "  ⚠️  Amend falhou — tentando commit novo..." -ForegroundColor Yellow
        & git commit -m "chore: harden scripts & fix email-from consistency" 2>&1 | Out-Null
        if ($LASTEXITCODE -ne 0) {
            Write-Host "❌ Commit falhou." -ForegroundColor Red
            Read-Host "Pressione Enter para fechar"
            exit 1
        }
    }
    Write-Host "  ✓ Amend OK" -ForegroundColor Green
} else {
    Write-Host "  ℹ️  Nada para amendar — seguindo direto para push" -ForegroundColor Yellow
}

# ─── Passo 3: push ───────────────────────────────────────────────────────────
Write-Host ""
Write-Host "[3/4] Push para o remote..." -ForegroundColor Cyan
$pushOut = & git push 2>&1
$pushExit = $LASTEXITCODE

if ($pushExit -ne 0) {
    Write-Host ""
    Write-Host "❌ Push ainda bloqueado. Output:" -ForegroundColor Red
    $pushOut | ForEach-Object { Write-Host "  $_" -ForegroundColor Red }
    Write-Host ""
    Write-Host "Se o GH013 persistir, pode ser que o commit anterior tambem tenha a chave." -ForegroundColor Yellow
    Write-Host "Rode:  git log --oneline -5   para ver os commits." -ForegroundColor Yellow
    Write-Host "Me manda o output e eu resolvo." -ForegroundColor Yellow
    Read-Host "Pressione Enter para fechar"
    exit 1
}

Write-Host "  ✓ Push OK" -ForegroundColor Green
Write-Host ""
$pushOut | ForEach-Object { Write-Host "  $_" -ForegroundColor Gray }

# ─── Passo 4: desbloquear usuario (opcional, se DATABASE_URL estiver setada) ──
Write-Host ""
Write-Host "[4/4] Desbloquear usuario no DB..." -ForegroundColor Cyan

if (-not $env:DATABASE_URL) {
    Write-Host "  ⚠️  DATABASE_URL nao setada — pulando desbloqueio." -ForegroundColor Yellow
    Write-Host "     Se quiser desbloquear, abra PowerShell e rode:" -ForegroundColor Gray
    Write-Host '       $env:DATABASE_URL = "postgresql://..."' -ForegroundColor Gray
    Write-Host "       .\scripts\01_desbloquear_usuario.ps1" -ForegroundColor Gray
} else {
    $unlockScript = Join-Path $PSScriptRoot "01_desbloquear_usuario.ps1"
    if (-not (Test-Path $unlockScript)) {
        Write-Host "  ⚠️  Script 01_desbloquear_usuario.ps1 nao encontrado." -ForegroundColor Yellow
    } else {
        & $unlockScript
        if ($LASTEXITCODE -ne 0) {
            Write-Host "  ⚠️  Desbloqueio teve erro — veja output acima" -ForegroundColor Yellow
        }
    }
}

# ─── Done ─────────────────────────────────────────────────────────────────────
Write-Host ""
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Green
Write-Host "✅ Tudo certo." -ForegroundColor Green
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Green
Write-Host ""
Write-Host "Proximo passo: no Vercel Dashboard, adicionar EMAIL_FROM na env vars:" -ForegroundColor Cyan
Write-Host "  Key:   EMAIL_FROM"
Write-Host "  Value: EcoLink <noreply@mytradieai.com.au>"
Write-Host ""
Write-Host "Depois voce pode fazer login no app (registra usuario novo OU usa um ja"
Write-Host "desbloqueado) e testar o checkout com card 4242 4242 4242 4242."
Write-Host ""
Read-Host "Pressione Enter para fechar"
