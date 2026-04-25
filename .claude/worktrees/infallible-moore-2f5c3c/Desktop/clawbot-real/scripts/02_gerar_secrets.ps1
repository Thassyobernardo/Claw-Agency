# ─────────────────────────────────────────────────────────────────────────────
# EcoLink Australia — Gerador de secrets para Vercel
#
# Gera:
#   NEXTAUTH_SECRET        (32 bytes random, base64 — assina JWT de sessao)
#   TOKEN_ENCRYPTION_KEY   (32 bytes random, hex   — AES-256-GCM para tokens Xero)
#   ECOLINK_APP_DB_PASSWORD (24 bytes random, base64 — role Postgres da migracao 004)
#
# Salva um arquivo .vercel_env.txt com TODAS as env vars (nao so as geradas)
# formatadas para voce copiar direto no Vercel → Environment Variables.
#
# Uso:   .\02_gerar_secrets.ps1
# ─────────────────────────────────────────────────────────────────────────────

$ErrorActionPreference = "Stop"

function New-RandomBase64 {
    param([int]$Bytes)
    $buf = New-Object byte[] $Bytes
    [System.Security.Cryptography.RandomNumberGenerator]::Fill($buf)
    return [Convert]::ToBase64String($buf)
}

function New-RandomHex {
    param([int]$Bytes)
    $buf = New-Object byte[] $Bytes
    [System.Security.Cryptography.RandomNumberGenerator]::Fill($buf)
    return ([BitConverter]::ToString($buf) -replace '-','').ToLower()
}

$nextAuthSecret     = New-RandomBase64 -Bytes 32
$tokenEncryptionKey = New-RandomHex    -Bytes 32
$dbAppPassword      = New-RandomBase64 -Bytes 24

# ─── Ler price IDs do Stripe se ja foram criados ────────────────────────────
$priceStarter       = "price_TODO_run_01_criar_stripe_prices_first"
$priceProfessional  = "price_TODO_run_01_criar_stripe_prices_first"
$priceEnterprise    = "price_TODO_run_01_criar_stripe_prices_first"

$priceIdsPath = Join-Path $PSScriptRoot ".stripe_price_ids.txt"
if (Test-Path $priceIdsPath) {
    Get-Content $priceIdsPath | ForEach-Object {
        if ($_ -match "^STRIPE_PRICE_STARTER=(.+)$")      { $priceStarter      = $Matches[1] }
        if ($_ -match "^STRIPE_PRICE_PROFESSIONAL=(.+)$") { $priceProfessional = $Matches[1] }
        if ($_ -match "^STRIPE_PRICE_ENTERPRISE=(.+)$")   { $priceEnterprise   = $Matches[1] }
    }
    Write-Host "✓ Price IDs do Stripe importados de $priceIdsPath" -ForegroundColor Green
} else {
    Write-Host "⚠️  .stripe_price_ids.txt nao encontrado — rode 01_criar_stripe_prices.ps1 primeiro." -ForegroundColor Yellow
}

# ─── Montar bloco completo de env vars ──────────────────────────────────────
$appUrl = "https://claw-agency.vercel.app"

$envBlock = @"
# ═══════════════════════════════════════════════════════════════════════════
# EcoLink Australia — Vercel Environment Variables
# Gerado: $(Get-Date -Format "yyyy-MM-dd HH:mm:ss")
#
# Como usar:
#   1. Abra https://vercel.com/thassyobernardos-projects/claw-agency/settings/environment-variables
#   2. Para cada linha KEY=VALUE abaixo, clique "Add Another"
#        Name   = KEY
#        Value  = VALUE (sem aspas)
#        Envs   = Production (marque tambem Preview se quiser testar em branches)
#   3. Apos adicionar todas, redeploy: Deployments → … → Redeploy
#
# GUARDE ESTE ARQUIVO EM LOCAL SEGURO — contem segredos de producao.
# ═══════════════════════════════════════════════════════════════════════════

# ─── Core ────────────────────────────────────────────────────────────────────
NODE_ENV=production
NEXT_PUBLIC_APP_URL=$appUrl
NEXTAUTH_URL=$appUrl
NEXTAUTH_SECRET=$nextAuthSecret

# ─── Database & Cache (pegar do dashboard do Railway) ────────────────────────
# Em Railway: projeto → Postgres plugin → Connect → copiar "Postgres Connection URL"
DATABASE_URL=<COLAR_DATABASE_URL_DO_RAILWAY>
# Railway → Redis plugin → Connect → "Redis Connection URL"
REDIS_URL=<COLAR_REDIS_URL_DO_RAILWAY>
# Senha da role Postgres 'ecolink_app' criada pela migracao 004
# (use o mesmo valor quando rodar 03_rodar_migracao_004.ps1)
ECOLINK_APP_DB_PASSWORD=$dbAppPassword

# ─── Stripe ──────────────────────────────────────────────────────────────────
# Pegue do dashboard Stripe → Developers → API keys
STRIPE_SECRET_KEY=<COLAR_sk_live_OU_sk_test>
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=<COLAR_pk_live_OU_pk_test>
# Gerado por criar_webhook_stripe.ps1 (ver webhook_secret.txt)
STRIPE_WEBHOOK_SECRET=<COLAR_whsec_DO_webhook_secret_txt>
# Gerados por 01_criar_stripe_prices.ps1
STRIPE_PRICE_STARTER=$priceStarter
STRIPE_PRICE_PROFESSIONAL=$priceProfessional
STRIPE_PRICE_ENTERPRISE=$priceEnterprise

# ─── Xero OAuth ──────────────────────────────────────────────────────────────
# https://developer.xero.com/app/manage
XERO_CLIENT_ID=<COLAR>
XERO_CLIENT_SECRET=<COLAR>
XERO_REDIRECT_URI=$appUrl/api/auth/xero/callback
TOKEN_ENCRYPTION_KEY=$tokenEncryptionKey

# ─── MYOB OAuth (opcional — Professional+) ───────────────────────────────────
MYOB_CLIENT_ID=<COLAR_OU_DEIXAR_VAZIO>
MYOB_CLIENT_SECRET=<COLAR_OU_DEIXAR_VAZIO>
MYOB_REDIRECT_URI=$appUrl/api/auth/myob/callback

# ─── LLM APIs ────────────────────────────────────────────────────────────────
GROQ_API_KEY=<COLAR>
GEMINI_API_KEY=<COLAR>

# ─── Email (Resend) ──────────────────────────────────────────────────────────
# Dominio ecolink.com.au deve estar verificado (SPF + DKIM)
RESEND_API_KEY=<COLAR_re_XXX>
"@

$outPath = Join-Path $PSScriptRoot ".vercel_env.txt"
$envBlock | Out-File -FilePath $outPath -Encoding utf8

Write-Host "`n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Yellow
Write-Host "✅ Secrets gerados e arquivo escrito:" -ForegroundColor Green
Write-Host "   $outPath" -ForegroundColor Green
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Yellow
Write-Host ""
Write-Host "⚠️  GUARDE ECOLINK_APP_DB_PASSWORD — voce vai precisar dele" -ForegroundColor Yellow
Write-Host "    tanto no Vercel (env var) quanto no script 03 (migracao)." -ForegroundColor Yellow
Write-Host ""
Write-Host "⚠️  NAO commite .vercel_env.txt no git. Deve estar no .gitignore." -ForegroundColor Yellow

Write-Host "`nPressione qualquer tecla para fechar..."
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
