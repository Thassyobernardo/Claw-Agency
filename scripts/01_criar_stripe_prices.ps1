# ─────────────────────────────────────────────────────────────────────────────
# EcoLink Australia — Criar produtos + precos no Stripe
#
# Cria 3 produtos (Starter, Professional, Enterprise) e 3 precos recorrentes
# mensais em AUD ($49 / $99 / $149) na conta Stripe identificada pela STRIPE_API_KEY.
# Ao final salva os price IDs em .stripe_price_ids.txt — cole no Vercel.
#
# Uso:
#   1. Abra PowerShell nesta pasta (scripts\)
#   2. $env:STRIPE_API_KEY = "sk_live_..."  (ou sk_test_... para sandbox)
#   3. .\01_criar_stripe_prices.ps1
#
# STRIPE_API_KEY e obrigatorio — nao deixamos chave hardcoded (o GitHub Secret
# Scanning bloqueia o push). Pega em: https://dashboard.stripe.com/apikeys
# ─────────────────────────────────────────────────────────────────────────────

$ErrorActionPreference = "Stop"

if (-not $env:STRIPE_API_KEY) {
    Write-Host "❌ STRIPE_API_KEY nao definido." -ForegroundColor Red
    Write-Host '  Faca: $env:STRIPE_API_KEY = "sk_test_..."  (ou sk_live_...)' -ForegroundColor Yellow
    Write-Host "  Pegue em: https://dashboard.stripe.com/apikeys" -ForegroundColor Yellow
    exit 1
}
$apiKey = $env:STRIPE_API_KEY

$mode = if ($apiKey.StartsWith("sk_live_")) { "LIVE 🔴" } else { "TEST 🟢" }
Write-Host "Modo: $mode" -ForegroundColor Cyan

# ─── Plans (precos em centavos AUD) ─────────────────────────────────────────
$plans = @(
    @{ key = "starter";       name = "EcoLink Starter";        amountCents = 4900;  description = "Up to 500 transactions/month, Xero sync, AASB S2 PDF reports."      },
    @{ key = "professional";  name = "EcoLink Professional";   amountCents = 9900;  description = "Unlimited transactions, Xero + MYOB, review queue, AASB S1 + S2."   },
    @{ key = "enterprise";    name = "EcoLink Enterprise";     amountCents = 14900; description = "Up to 5 companies, white-label reports, API access, dedicated call." }
)

$bytes = [System.Text.Encoding]::ASCII.GetBytes("${apiKey}:")
$base64 = [Convert]::ToBase64String($bytes)
$headers = @{
    Authorization  = "Basic $base64"
    "Content-Type" = "application/x-www-form-urlencoded"
}

$results = @{}

foreach ($p in $plans) {
    Write-Host "`n━━ $($p.name) ($($p.amountCents/100) AUD/mo) ━━" -ForegroundColor Cyan

    # 1. Criar produto
    $productBody = "name=$([uri]::EscapeDataString($p.name))"
    $productBody += "&description=$([uri]::EscapeDataString($p.description))"
    $productBody += "&metadata[plan_key]=$($p.key)"
    $productBody += "&tax_code=txcd_10000000"   # txcd_10000000 = General — Electronically Supplied Services (apropriado para SaaS)

    try {
        $product = Invoke-RestMethod `
            -Uri "https://api.stripe.com/v1/products" `
            -Method POST `
            -Headers $headers `
            -Body $productBody
        Write-Host "  ✓ Produto: $($product.id)" -ForegroundColor Green
    } catch {
        Write-Host "  ✗ Falha ao criar produto: $($_.Exception.Message)" -ForegroundColor Red
        throw
    }

    # 2. Criar preco (recurring monthly, AUD)
    $priceBody = "product=$($product.id)"
    $priceBody += "&unit_amount=$($p.amountCents)"
    $priceBody += "&currency=aud"
    $priceBody += "&recurring[interval]=month"
    $priceBody += "&recurring[interval_count]=1"
    $priceBody += "&tax_behavior=exclusive"     # o preco e antes-do-GST; Stripe Tax adiciona 10% no checkout
    $priceBody += "&metadata[plan_key]=$($p.key)"
    $priceBody += "&lookup_key=ecolink_$($p.key)_monthly_aud"

    try {
        $price = Invoke-RestMethod `
            -Uri "https://api.stripe.com/v1/prices" `
            -Method POST `
            -Headers $headers `
            -Body $priceBody
        Write-Host "  ✓ Preco:   $($price.id)" -ForegroundColor Green
        $results[$p.key] = $price.id
    } catch {
        Write-Host "  ✗ Falha ao criar preco: $($_.Exception.Message)" -ForegroundColor Red
        throw
    }
}

# ─── Persistir IDs em arquivo ───────────────────────────────────────────────
$outPath = Join-Path $PSScriptRoot ".stripe_price_ids.txt"
$output = @"
# EcoLink Stripe price IDs — gerados em $(Get-Date -Format "yyyy-MM-dd HH:mm")
# Modo: $mode
#
# Cole estas variaveis no Vercel:
#   https://vercel.com/thassyobernardos-projects/claw-agency/settings/environment-variables

STRIPE_PRICE_STARTER=$($results['starter'])
STRIPE_PRICE_PROFESSIONAL=$($results['professional'])
STRIPE_PRICE_ENTERPRISE=$($results['enterprise'])
"@

$output | Out-File -FilePath $outPath -Encoding utf8
Write-Host "`n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Yellow
Write-Host "✅ 3 produtos + 3 precos criados" -ForegroundColor Green
Write-Host "IDs salvos em: $outPath" -ForegroundColor Green
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Yellow
Write-Host "`nProximo passo: cole as 3 linhas STRIPE_PRICE_* no Vercel → Environment Variables."

Write-Host "`nPressione qualquer tecla para fechar..."
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
