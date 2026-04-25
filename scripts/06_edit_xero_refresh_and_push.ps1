# =============================================================================
# EcoLink Australia - Fix: edita xero/refresh/route.ts + amend + force-push
#
# Problema: o arquivo local no Windows nao tem o `type XeroTokenSet` no import,
# por isso o script anterior disse "Nada pra commitar".
#
# Este script faz a edicao diretamente no arquivo, commita e empurra.
#
# Uso: botao direito -> Run with PowerShell
# =============================================================================

$ErrorActionPreference = "Stop"

$projectRoot = Split-Path -Parent $PSScriptRoot
Set-Location $projectRoot

$file = "frontend/src/app/api/auth/xero/refresh/route.ts"

Write-Host ""
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Yellow
Write-Host " EcoLink  ·  Editar refresh/route.ts + amend + force push" -ForegroundColor Yellow
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Yellow
Write-Host ""

# ─── Passo 1: editar ──────────────────────────────────────────────────────────
Write-Host "[1/4] Editando $file ..." -ForegroundColor Cyan

if (-not (Test-Path $file)) {
    Write-Host "❌ Arquivo nao encontrado: $file" -ForegroundColor Red
    Read-Host "Pressione Enter para fechar"
    exit 1
}

$content = Get-Content $file -Raw
$oldLine = 'import { refreshAccessToken } from "@/lib/xero";'
$newLine = 'import { refreshAccessToken, type XeroTokenSet } from "@/lib/xero";'

if ($content -notmatch [regex]::Escape($oldLine)) {
    if ($content -match [regex]::Escape($newLine)) {
        Write-Host "  ℹ️  Import ja esta correto no arquivo. Pulando edicao." -ForegroundColor Yellow
    } else {
        Write-Host "❌ Nao achei o import esperado no arquivo — algo esta diferente do esperado." -ForegroundColor Red
        Write-Host "   Procurei por: $oldLine" -ForegroundColor Gray
        Read-Host "Pressione Enter para fechar"
        exit 1
    }
} else {
    $newContent = $content -replace [regex]::Escape($oldLine), $newLine
    Set-Content -Path $file -Value $newContent -NoNewline
    Write-Host "  ✓ Arquivo editado" -ForegroundColor Green
}

# ─── Passo 2: stage ───────────────────────────────────────────────────────────
Write-Host ""
Write-Host "[2/4] git add ..." -ForegroundColor Cyan

& git add $file 2>&1 | Out-Null

$staged = & git diff --cached --name-only 2>&1
if (-not $staged) {
    Write-Host "  ℹ️  Nada pra commitar. Verificando se o arquivo no HEAD ja esta correto..." -ForegroundColor Yellow
    $headContent = & git show "HEAD:$file" 2>&1
    if ($headContent -match [regex]::Escape($newLine)) {
        Write-Host "  ✓ HEAD ja tem o fix. Pulando commit. Checando se precisa push..." -ForegroundColor Green
    } else {
        Write-Host "❌ HEAD nao tem o fix e o working tree nao tem mudanca. Situacao estranha." -ForegroundColor Red
        Read-Host "Pressione Enter para fechar"
        exit 1
    }
} else {
    Write-Host "  Arquivos no stage:" -ForegroundColor Gray
    $staged | ForEach-Object { Write-Host "    $_" -ForegroundColor Gray }

    # ─── Passo 3: amend ───────────────────────────────────────────────────────
    Write-Host ""
    Write-Host "[3/4] git commit --amend --no-edit ..." -ForegroundColor Cyan
    & git commit --amend --no-edit 2>&1 | Out-Null
    if ($LASTEXITCODE -ne 0) {
        Write-Host "❌ Amend falhou." -ForegroundColor Red
        Read-Host "Pressione Enter para fechar"
        exit 1
    }
    Write-Host "  ✓ Amend OK" -ForegroundColor Green
}

# ─── Passo 4: force-push ──────────────────────────────────────────────────────
Write-Host ""
Write-Host "[4/4] git push --force-with-lease ..." -ForegroundColor Cyan

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
Write-Host ""
Read-Host "Pressione Enter para fechar"
