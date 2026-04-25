# EcoLink Australia — Deploy Runbook

**Last updated:** 2026-04-18
**Target platform:** Railway (Dockerfile build, 1 replica)
**Production URL:** https://claw-agency-hunter-production.up.railway.app

---

## 1. Pre-deploy checklist

Run these checks **before pushing to Railway**.

### 1.1 Code health

- [ ] `cd frontend && npx tsc --noEmit` returns zero errors.
- [ ] `npm audit` shows zero high-severity vulnerabilities. (`next@16.2.4` fixes the last one; `xlsx` has been removed because it was never imported.)
- [ ] No committed secrets in the diff (grep for `sk_live`, `whsec_`, `postgres://`, `password`).

### 1.2 Required environment variables on Railway

Every variable below must be set in Railway → **Variables** tab. Any missing variable in this list will break production.

**Core**

| Variable | Purpose | Example |
|---|---|---|
| `NODE_ENV` | Runtime flag | `production` |
| `PORT` | Railway injects automatically | — |
| `NEXT_PUBLIC_APP_URL` | Absolute URL used in emails & Stripe callbacks | `https://claw-agency-hunter-production.up.railway.app` |
| `NEXTAUTH_URL` | Must match the deployed URL | `https://claw-agency-hunter-production.up.railway.app` |
| `NEXTAUTH_SECRET` | JWT signing key (≥ 32 bytes) | `openssl rand -base64 32` |

**Database & cache**

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | Postgres connection string (Railway injects from the Postgres plugin). |
| `REDIS_URL` | Redis connection string (Railway injects from the Redis plugin). **Without this the rate-limiter falls back to in-memory — INSECURE in multi-replica deployments.** |
| `ECOLINK_APP_DB_PASSWORD` | Password for the `ecolink_app` Postgres role created in migration 004. Must be ≥ 16 chars. Generate with `openssl rand -base64 32`. |

**Stripe**

| Variable | Purpose |
|---|---|
| `STRIPE_SECRET_KEY` | Live server key (`sk_live_…`). |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | Live publishable key (`pk_live_…`). |
| `STRIPE_WEBHOOK_SECRET` | From the `/api/billing/webhook` endpoint in the Stripe dashboard (`whsec_…`). |
| `STRIPE_PRICE_STARTER` | Price ID for AUD $49/mo recurring. |
| `STRIPE_PRICE_PROFESSIONAL` | Price ID for AUD $99/mo recurring. |
| `STRIPE_PRICE_ENTERPRISE` | Price ID for AUD $149/mo recurring. |

Stripe Tax must be enabled in the dashboard with an Australian GST registration linked to the EcoLink ABN — the checkout route relies on `automatic_tax.enabled` to charge 10% GST on top of the list price.

**Xero OAuth**

| Variable | Purpose |
|---|---|
| `XERO_CLIENT_ID` | App Client ID. |
| `XERO_CLIENT_SECRET` | App Client Secret. |
| `XERO_REDIRECT_URI` | Must equal `${NEXT_PUBLIC_APP_URL}/api/auth/xero/callback` and match what is registered in the Xero developer portal. |
| `TOKEN_ENCRYPTION_KEY` | 64-hex-character key (AES-256-GCM). Generate with `openssl rand -hex 32`. |

**MYOB OAuth (optional — Professional+ plans)**

`MYOB_CLIENT_ID`, `MYOB_CLIENT_SECRET`, `MYOB_REDIRECT_URI` — same pattern as Xero.

**LLM classifier**

| Variable | Purpose |
|---|---|
| `GROQ_API_KEY` | Primary — fast transaction classification. |
| `GEMINI_API_KEY` | Fallback when Groq quota is exhausted. |

**Email**

| Variable | Purpose |
|---|---|
| `RESEND_API_KEY` | Required for verification, password-reset and welcome emails. Without it those emails silently no-op. |

### 1.3 Database migrations

Migrations are **not** auto-applied. Run them from a workstation that has `DATABASE_URL` in its shell env:

```bash
# 1. Schema + emission-factor seeds (runs via database/migrate.ts)
# ECOLINK_APP_DB_PASSWORD="SUA_SENHA_AQUI"
npx ts-node database/migrate.ts

# 2. Incremental migrations — apply in order, skip ones already applied
psql "$DATABASE_URL" -v "ecolink_app_password=$ECOLINK_APP_DB_PASSWORD" \
    -f database/migrations/004_row_level_security.sql
psql "$DATABASE_URL" -f database/migrations/005_emission_categories.sql
psql "$DATABASE_URL" -f database/migrations/006_sector_benchmarks.sql
psql "$DATABASE_URL" -f database/migrations/007_stripe_columns.sql
psql "$DATABASE_URL" -f database/migrations/008_myob_token.sql
# 009 is a scaffold — only apply AFTER filling in the NGA 2024–25 values.
```

Make sure the password you used in step 1 goes straight into Railway as `ECOLINK_APP_DB_PASSWORD`. Future migrations re-read it from the same env var.

### 1.4 External integrations

- [ ] **Stripe webhook endpoint** points to `${NEXT_PUBLIC_APP_URL}/api/billing/webhook` and is listening to: `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.payment_failed`.
- [ ] **Stripe Tax** enabled in the live dashboard with an Australian GST registration linked to the EcoLink ABN.
- [ ] **Xero app** redirect URI registered matches `XERO_REDIRECT_URI` exactly.
- [ ] **Resend** domain `ecolink.com.au` verified (SPF + DKIM) — without this, Gmail and Outlook will reject the outbound mail.

---

## 2. Deploy

1. Push the latest commit on `main` to GitHub. Railway auto-builds from the `Dockerfile`.
2. Watch the build log; the Node build stage runs `npm ci && npm run build` and the final image only contains `.next/standalone`.
3. When the build goes green, Railway promotes the new container.

If a deploy is triggered before Railway's env vars are updated, the container will boot but every Stripe, Xero and Resend call will throw — always update env vars **first**, then deploy.

---

## 3. Post-deploy smoke tests

Run these against the live URL immediately after deploy; they cover the payment path end-to-end.

1. **Landing** — `GET /` renders, Pricing cards show $49 / $99 / $149 AUD and "14-day free trial".
2. **Register** — `POST /api/auth/register` with a fresh email + valid ABN (Mod-89) returns `201`. Check that the welcome + verification emails arrive.
3. **Login** — after verifying the email, `POST /api/auth/callback/credentials` succeeds and the `/dashboard` page renders.
4. **Checkout (test card 4242 4242 4242 4242)** — click a plan → Stripe Checkout loads → complete the payment → Stripe redirects to `/billing?success=1&plan=…` → the webhook fires → `companies.plan` updates → the billing page shows the new plan active.
5. **Tax invoice** — confirm the Stripe-hosted invoice shows **10% GST** on the AUD price, and that the ABN field from checkout is on the invoice.
6. **Portal** — `POST /api/billing/portal` returns a Stripe Billing Portal URL; cancelling there fires `customer.subscription.deleted` and downgrades the company to `starter`.
7. **Xero connect** — `/api/auth/xero` starts the OAuth dance; callback persists the encrypted token (decrypt with `TOKEN_ENCRYPTION_KEY` to verify no plain-text leak in `companies.xero_token_data`).
8. **Rate limiter** — hit `/api/auth/forgot-password` six times in 15 min from one IP; the sixth call should be silently dropped. Run it from two replicas to confirm Redis is the shared counter (requires `REDIS_URL`).

---

## 4. Rollback triggers

Roll back (Railway → **Deployments** → **Redeploy previous**) if any of these fire within 15 min of deploy:

- 5xx rate on `/api/billing/webhook` > 1% (Stripe will start retrying; if the handler is broken, subscriptions may silently fail to activate).
- Sign-in success rate drops > 20% vs. baseline.
- Any `[rate-limit] Redis …` error log (indicates Redis has gone down — rate-limiter has degraded silently to in-memory).
- Stripe webhook returns 400 `Invalid signature` for more than 2 consecutive events (usually means `STRIPE_WEBHOOK_SECRET` drifted).

---

## 5. Known follow-ups (not blocking this deploy)

- **Legacy Xero tokens** — any token written before the encryption patch is stored as plain JSON. Write a one-shot script to re-encrypt them and then remove the `looksLikePlainJson` fallback in `lib/crypto.ts`.
- **Privacy Act APP 13 (right to erasure)** — no user-facing endpoint yet; currently only admin can delete via SQL.
- **Security headers** — add CSP and HSTS via `next.config.ts` `headers()`.
- **NGA 2024–25** — migration 009 scaffold is in place; fill in the DCCEEW values and re-run when the edition is published.
- **node_modules in repo** — if any `node_modules/` was accidentally committed, drop it via `git rm -r --cached node_modules` before the next deploy.
