# EcoLink Australia — Privacy Policy

**Effective Date:** 1 July 2025
**Last Updated:** 29 April 2026
**Version:** 1.0

---

## 1. Introduction

EcoLink Australia Pty Ltd ("EcoLink", "we", "our", "us") is committed to protecting your privacy and the confidentiality of your data. This Privacy Policy explains how we collect, use, store, and protect personal information and business data when you use the EcoLink carbon accounting platform ("the Platform").

This policy complies with the **Privacy Act 1988 (Cth)** and the **Australian Privacy Principles (APPs)**.

---

## 2. What Data We Collect

### 2.1 Account Information
- Full name, business email address
- Australian Business Number (ABN) or Company Name
- Billing details (processed by Stripe — not stored by EcoLink)

### 2.2 Xero Integration Data
When you connect your Xero account, we access the following data **read-only**, under the scopes you authorise:

| Xero Scope | Data Accessed | Purpose |
|---|---|---|
| `accounting.banktransactions.read` | Bank transaction records | Carbon accounting classification |
| `accounting.invoices.read` | Invoices and bills | Supplier identification |
| `accounting.contacts.read` | Supplier and customer names | Merchant routing rules |
| `accounting.settings.read` | Chart of accounts | Account name resolution |

> **Important:** EcoLink requests **read-only** access. We cannot create, modify or delete records in your Xero account.

### 2.3 Carbon Accounting Data
- Classified transaction records with emission calculations
- AASB S2 report snapshots (Scope 1, 2, 3 totals)
- Manually entered physical quantities (e.g. fuel litres, kWh)

### 2.4 Usage Data
- IP addresses, browser type, session timestamps (for security logging)
- Feature usage analytics (page views, button clicks — anonymised)

---

## 3. How We Use Your Data

| Purpose | Legal Basis |
|---|---|
| Providing the carbon accounting service | Contractual necessity |
| Generating AASB S2 compliance reports | Contractual necessity |
| Authenticating your identity | Contractual necessity |
| Sending transactional emails (Magic Link) | Contractual necessity |
| Improving the Platform | Legitimate interest |
| Legal compliance (NGER Act 2007, Corporations Act) | Legal obligation |

---

## 4. What We Do NOT Do With Your Data

> **4.1 Zero AI Training — Architectural Guarantee**
>
> EcoLink's carbon accounting engine is **100% deterministic**. We use the NGA Factors 2025 published by DCCEEW in fixed mathematical formulas. Your Xero transaction data, financial figures, supplier names, and emission calculations are **never used to train, fine-tune, or improve any artificial intelligence or machine learning model** — by EcoLink or any third party.
>
> This is not merely a policy statement. Our architecture enforces it: all calculations are performed by auditable rule-based code (`calculator.ts`, `transaction_router.ts`) with no connection to any AI/LLM API.

**We also do not:**
- Sell, rent, or broker your data to any third party
- Use your financial data for advertising or profiling
- Share transaction data with other EcoLink customers
- Store your Xero OAuth tokens in plain text (AES-256-GCM encrypted at rest)

---

## 5. Data Storage and Security

### 5.1 Infrastructure
- **Database:** PostgreSQL hosted on Railway (Australia/Asia-Pacific region)
- **File Storage:** Supabase Storage (private bucket, pre-signed URL access only)
- **Encryption in transit:** TLS 1.3 on all API endpoints
- **Encryption at rest:** AES-256-GCM for OAuth tokens; standard encryption for database volumes

### 5.2 Access Controls
- Row-Level Security (RLS) enforced at the database level — no cross-tenant data access is architecturally possible
- OAuth refresh tokens encrypted with a unique `TOKEN_ENCRYPTION_KEY` per deployment
- Sealed AASB reports stored in a private storage bucket — accessible only via server-generated, short-lived (5-minute) signed URLs

### 5.3 Data Retention
| Data Type | Retention Period |
|---|---|
| Active account data | Duration of subscription |
| Sealed AASB reports | 7 years (ASIC records obligations) |
| OAuth tokens | Deleted on Xero disconnection |
| Audit logs | 7 years |
| Anonymised usage analytics | 2 years |

---

## 6. Third-Party Services

| Service | Purpose | Data Shared | Privacy Policy |
|---|---|---|---|
| Xero | Accounting data source | OAuth tokens only | xero.com/privacy |
| Resend | Transactional email (Magic Link) | Email address | resend.com/privacy |
| Stripe | Subscription billing | Name, email, payment method | stripe.com/privacy |
| Supabase | File storage (PDF reports) | Report files | supabase.com/privacy |
| Railway | Database hosting | All data (encrypted) | railway.app/privacy |

No third-party service listed above receives your Xero financial data or emission calculations.

---

## 7. Your Rights (Australian Privacy Principles)

Under the Privacy Act 1988 and APPs, you have the right to:

- **Access** the personal information we hold about you (APP 12)
- **Correct** inaccurate personal information (APP 13)
- **Anonymisation** upon request where technically feasible
- **Opt-out** of non-essential communications
- **Data portability** — export your transaction and report data in JSON format

To exercise these rights, contact: **privacy@ecolink.com.au**

---

## 8. Xero Data Handling Compliance

EcoLink's use of Xero data complies with the [Xero API Terms of Use](https://developer.xero.com/documentation/getting-started-guide/). Specifically:

- We access only the scopes necessary for the service
- We do not use Xero data for any purpose other than providing the EcoLink service to you
- Your Xero connection can be revoked at any time from `/dashboard/xero-sync`
- Upon disconnection, your Xero OAuth tokens are deleted from our database immediately

---

## 9. Cookies

We use essential cookies only:
- **Session cookie:** NextAuth session token (httpOnly, secure, sameSite=lax)
- **CSRF cookie:** Xero OAuth state token (deleted after callback)
- **No tracking cookies.** No Google Analytics, Meta Pixel, or similar.

---

## 10. Changes to This Policy

We will notify you by email at least 14 days before any material changes to this Privacy Policy. Continued use of the Platform after the effective date constitutes acceptance.

---

## 11. Contact

**EcoLink Australia Pty Ltd**
Email: privacy@ecolink.com.au
Website: https://ecolink.com.au

For complaints not resolved by EcoLink, you may contact the **Office of the Australian Information Commissioner (OAIC)**: oaic.gov.au
