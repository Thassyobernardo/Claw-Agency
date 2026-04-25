# Scripts de deploy — Vercel + Railway

Execute na **ordem numerada**. Cada script salva um artefato que o proximo le.

## 1. Criar produtos + precos no Stripe

```powershell
cd scripts
# Opcional: usar chave de producao em vez da test do criar_webhook_stripe.ps1
$env:STRIPE_API_KEY = "sk_live_..."
.\01_criar_stripe_prices.ps1
```

Saida: `.stripe_price_ids.txt` com `STRIPE_PRICE_STARTER/PROFESSIONAL/ENTERPRISE`.

## 2. Gerar secrets e arquivo de env vars para o Vercel

```powershell
.\02_gerar_secrets.ps1
```

Saida: `.vercel_env.txt` — lista completa ja formatada. Cole no Vercel:
<https://vercel.com/thassyobernardos-projects/claw-agency/settings/environment-variables>.

Os 3 secrets gerados aleatoriamente sao:

- `NEXTAUTH_SECRET` — assina JWT de sessao
- `TOKEN_ENCRYPTION_KEY` — AES-256-GCM para tokens Xero
- `ECOLINK_APP_DB_PASSWORD` — senha da role Postgres da migracao 004

**Anote `ECOLINK_APP_DB_PASSWORD`** — voce precisa dele no passo 3.

## 3. Aplicar migracao 004 (Row Level Security) no Postgres do Railway

```powershell
$env:DATABASE_URL           = "postgres://..."   # Railway -> Postgres -> Connect
# Defina $env:ECOLINK_APP_DB_PASSWORD com a senha do passo 2
.\03_rodar_migracao_004.ps1
```

Cria a role `ecolink_app`, habilita RLS em `transactions` e `users`, instala as policies de isolamento por `company_id` e a funcao `set_company_context(uuid)`.

## 4. Criar webhook no Stripe (se ainda nao tiver rodado)

Ja existe o script `..\criar_webhook_stripe.ps1`. Ele grava `webhook_secret.txt` — cole o valor em `STRIPE_WEBHOOK_SECRET` no Vercel.

## 5. Configurar no dashboard do Stripe (manual — uma vez)

- **Stripe Tax** → **Settings → Tax → Registrations** → Add **Australia** com o ABN da EcoLink. Sem isso, `automatic_tax.enabled = true` no checkout nao vai cobrar GST.
- **Developers → Webhooks** → confirmar que o endpoint aponta para `https://claw-agency.vercel.app/api/billing/webhook` e esta escutando: `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.payment_failed`.

## 6. Redeploy no Vercel

Com todas as env vars coladas, va em **Deployments → ⋯ → Redeploy** (sem cache).

## 7. Smoke test de producao

Ver seção "Post-deploy smoke tests" em `..\DEPLOY.md`.

---

## Arquivos gerados (NAO committar)

Estes ficam com segredos:

```
scripts/.stripe_price_ids.txt
scripts/.vercel_env.txt
webhook_secret.txt
```

Ja deveriam estar cobertos por `.gitignore` via o padrao `.env*` ou afins — confirme antes do primeiro commit.
