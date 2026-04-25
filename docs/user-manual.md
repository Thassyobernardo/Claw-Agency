# EcoLink Australia — Client User Manual
**Version 1.0 · April 2026**

---

## Table of Contents

1. [What Is EcoLink?](#1-what-is-ecolink)
2. [Getting Started](#2-getting-started)
   - 2.1 Create Your Account
   - 2.2 Verify Your Email
   - 2.3 Log In
   - 2.4 Forgot Password
3. [The Dashboard](#3-the-dashboard)
   - 3.1 Total Emissions Summary
   - 3.2 Scope 1 / 2 / 3 Cards
   - 3.3 Sector Benchmarking
   - 3.4 Top Emission Categories
   - 3.5 Recent Transactions
4. [Connecting Your Accounting Software](#4-connecting-your-accounting-software)
   - 4.1 Connect Xero
   - 4.2 Connect MYOB
   - 4.3 Syncing Transactions
5. [AI Classification](#5-ai-classification)
   - 5.1 How It Works
   - 5.2 Classification Statuses
   - 5.3 Running Classification
6. [Review Queue](#6-review-queue)
7. [Exporting Your AASB S2 Report](#7-exporting-your-aasb-s2-report)
8. [Billing & Plans](#8-billing--plans)
9. [FAQ](#9-faq)

---

## 1. What Is EcoLink?

EcoLink is a carbon accounting platform built for Australian small and medium businesses (SMEs).

Starting in 2026, large corporations (Lendlease, BHP, Woolworths, and others) are legally required under **AASB S1/S2** to report the carbon emissions of their entire supply chain — including their suppliers. If you supply to a large company and cannot provide an emissions report, **you risk losing that contract**.

EcoLink solves this automatically:

- Connects to your existing accounting software (Xero or MYOB)
- Reads your transactions and classifies each one by emission type
- Applies the official **NGA 2023–24 emission factors** from the Australian government
- Generates a ready-to-submit **AASB S2 report** in minutes

You do not need an accountant, a consultant, or a sustainability team.

---

## 2. Getting Started

### 2.1 Create Your Account

1. Go to the EcoLink website and click **Create account — free**.
2. Fill in all required fields:
   - **Full name**
   - **Company name**
   - **ABN** (Australian Business Number — 11 digits)
   - **State** (e.g. NSW, VIC, QLD)
   - **Industry** (e.g. Construction, Transport, Retail)
   - **Email address**
   - **Password**

**Password requirements:** minimum 10 characters, must include at least one uppercase letter, one lowercase letter, one number, and one special character (e.g. `!`, `@`, `#`).

3. Click **Create account**.

You will be redirected to the login page with a confirmation message. Do not log in yet — you must verify your email first.

---

### 2.2 Verify Your Email

After registering, EcoLink sends a verification email to the address you provided.

1. Open the email (subject: **Confirm your EcoLink account**).
2. Click **Confirm my email**.
3. You will be redirected to the login page with the message: *"Email confirmed! You can now log in."*

> If you do not see the email within 2 minutes, check your spam/junk folder. The link expires after **24 hours** — if it expires, register again.

---

### 2.3 Log In

1. Go to `/login`.
2. Enter your email and password.
3. Click **Sign in**.

You will be taken to your dashboard.

**Demo account:** On the login page there is a "Use demo account" button that prefills the credentials for a sample construction company (`demo@acmebuilding.com.au`). Use this to explore the platform before connecting your own data.

---

### 2.4 Forgot Password

1. On the login page, click **Forgot password?**
2. Enter your email address and click **Send reset link**.
3. Open the email (subject: **Reset your EcoLink password**).
4. Click the link and enter a new password (same requirements as above).
5. You will be redirected to login with the message: *"Password updated successfully!"*

The reset link expires after **1 hour**.

---

## 3. The Dashboard

The dashboard is the main screen after login. It shows your company's carbon footprint for the current financial year (FY 2023–24) in real time.

---

### 3.1 Total Emissions Summary

The large dark card at the top shows your **total emissions in tonnes of CO₂ equivalent (t CO₂e)** across all classified transactions.

- This figure is calculated using the official NGA 2023–24 factors published by the Australian Government (DCCEEW).
- An **AASB S2** badge confirms the data is in the correct reporting format.

---

### 3.2 Scope 1 / 2 / 3 Cards

Below the hero card, three panels break your emissions into the three scopes required by AASB S2:

| Scope | What it covers | Examples |
|---|---|---|
| **Scope 1** | Direct emissions from sources you own or control | Fuel in company vehicles, gas heating |
| **Scope 2** | Purchased electricity | Electricity bills |
| **Scope 3** | All other indirect emissions in your value chain | Business travel, freight, purchased goods |

Each card shows:
- Total **t CO₂e** for the scope
- Percentage of your total footprint
- Number of transactions counted
- A proportional progress bar

---

### 3.3 Sector Benchmarking

If you have enough classified data, EcoLink compares your **emission intensity** (kg CO₂e per AUD $1,000 of spending) against other Australian businesses in your sector and size band.

The benchmark card shows:
- **Your intensity** — your current figure
- A colour-graded bar from Best (P25) to Laggards (P75) with your position marked
- **Percentile rank** — e.g. "42nd percentile" means you emit less than 58% of your peers
- **Reduction to reach median** — how much you need to cut to be average
- **2030 target intensity** — the −43% from average trajectory aligned with Australian climate targets

> The benchmark appears only once enough transactions have been classified. If your data is sparse, an "Estimated" badge will appear.

---

### 3.4 Top Emission Categories

The left panel in the bottom row lists your **top 5 emission categories** — e.g. Transport, Electricity, Business Travel — sorted by CO₂e contribution. Each row shows the scope, number of transactions, and total tonnes.

---

### 3.5 Recent Transactions

The right panel shows the **8 most recent transactions** imported from your accounting software. Each row shows:
- Transaction description
- Category and date
- CO₂e in kg or tonnes
- Classification status badge (see [Section 5.2](#52-classification-statuses))

Click **Review Queue →** in the top-right corner of this panel to see all transactions that need manual review.

---

## 4. Connecting Your Accounting Software

EcoLink needs access to your transactions to calculate your footprint. It supports **Xero** and **MYOB AccountRight**.

Your credentials are never stored. EcoLink uses the industry-standard OAuth 2.0 protocol — the same method banks use.

---

### 4.1 Connect Xero

1. On the dashboard, click **Connect Xero** (top-right header).
2. You will be taken to the Xero login page.
3. Log in with your Xero credentials and click **Allow access**.
4. You are redirected back to EcoLink. A green banner confirms: *"Connected to Xero — [Your Organisation Name]"*.

The header button changes to show your organisation name and a **Sync Xero** button.

**Note:** If you see an `Invalid redirect_uri` error, your Xero developer app's redirect URI may not include the EcoLink production URL. Contact your administrator.

---

### 4.2 Connect MYOB — Coming Soon

MYOB AccountRight integration is currently in development and not yet available. You will be notified by email when MYOB support goes live. In the meantime, use Xero to import your transactions.

---

### 4.3 Syncing Transactions

After connecting, click **Sync Xero** or **Sync MYOB** in the top-right header to import your latest transactions.

- Transactions already imported are skipped (no duplicates).
- The button shows `+N new` after a successful sync to tell you how many records were imported.
- After syncing, run **Classify** (see Section 5) to process the new transactions.

> Sync pulls transactions from the most recent 12 months by default.

---

## 5. AI Classification

### 5.1 How It Works

After importing transactions, EcoLink's AI engine reads each transaction description and maps it to an **NGA emission category**.

The pipeline works in three stages:

```
Transaction description
       ↓
1. Keyword matching (fast, rule-based)
       ↓
2. Groq llama-3.3-70b (AI)
       ↓
3. Gemini (fallback AI)
       ↓
Emission category + kg CO₂e
```

Example: `"BP Station Sydney $150"` → **Combustion — Petrol (Scope 1)** → 163 kg CO₂e

The AI uses the official **NGA 2023–24 emission factors** published by the Australian Government to convert dollar amounts into kilograms of CO₂ equivalent.

---

### 5.2 Classification Statuses

Each transaction has one of four statuses:

| Status | Meaning | Action required |
|---|---|---|
| **Classified** (green) | AI confidence ≥ 60%. Category and CO₂e assigned automatically. | None |
| **Needs Review** (yellow) | AI confidence 40–59%. Likely correct but uncertain. | Review in the Review Queue |
| **No Factor** (red) | No matching NGA emission factor found. | Assign manually in the Review Queue |
| **Pending** (grey) | Not yet processed. | Run Classify |

---

### 5.3 Running Classification

Click the **Classify** button (with a sparkle icon ✦) in the top-right header.

EcoLink processes all pending transactions. When complete, a banner shows:
- `N auto-classified` — handled automatically
- `N flagged for review` — added to the Review Queue
- `N could not be matched` — no NGA factor found, need manual assignment

The dashboard stats update immediately.

---

## 6. Review Queue

Go to **Dashboard → Review Queue →** (or click the yellow alert in the page title area).

The Review Queue shows every transaction with status `Needs Review` or `No Factor`. For each:

- You can see the transaction description, amount, supplier, and the AI's suggested category (with confidence percentage).
- Use the **dropdown** to assign or change the emission category.
- Click **Approve** to confirm the classification and add it to your footprint.
- Click **Reject** to exclude the transaction from the report.

Approved transactions move to **Classified** and are included in all dashboard totals and the exported report.

> Regularly clearing the Review Queue improves your report accuracy and ensures all spend is accounted for.

---

## 7. Exporting Your AASB S2 Report

Click **Export Report** (top-right, green button) at any time.

EcoLink generates a PDF report containing:
- Your company name, ABN, and reporting period (FY 2023–24)
- Total emissions in t CO₂e
- Breakdown by Scope 1, 2, and 3
- Top emission categories
- NGA factor references
- AASB S1/S2 compliance statement

The report opens in a new browser tab and can be saved or printed.

**This is the document you send to your corporate client** when they request your emissions data under AASB S2 obligations.

> For best accuracy, clear your Review Queue before exporting so all transactions are included.

---

## 8. Billing & Plans

Go to **Billing** (click your plan name in the dashboard subtitle, e.g. "Starter Plan").

EcoLink offers three plans:

| | Starter | Professional | Enterprise |
|---|---|---|---|
| **Price** | $49 AUD/month | $99 AUD/month | $149 AUD/month |
| **Companies** | 1 | 1 | Up to 5 |
| **Users** | 1 | Up to 5 | Unlimited |
| **Transactions** | 500/month | Unlimited | Unlimited |
| **Xero sync** | ✓ | ✓ | ✓ |
| **MYOB sync** | Coming soon | Coming soon | Coming soon |
| **AI classification** | ✓ | ✓ + Review Queue | ✓ + Review Queue |
| **Report type** | AASB S2 | AASB S1 + S2 | AASB S1 + S2 |
| **Benchmarking** | ✓ | ✓ | ✓ |
| **Support** | — | Priority email | Phone + email |
| **Custom factors** | — | ✓ | ✓ |
| **White-label reports** | — | — | ✓ |
| **API access** | — | — | ✓ |

All plans include a **14-day free trial**. No credit card required to start.

To subscribe, click **Start free trial** under your chosen plan. You will be taken to Stripe's secure checkout.

To update payment details, download invoices, or cancel, click **Open billing portal**.

Prices are in AUD and exclude GST. Cancel anytime.

---

## 9. FAQ

**Q: Do I need to enter my transactions manually?**
No. EcoLink connects directly to Xero or MYOB and imports them automatically. You only need to review transactions the AI could not classify with high confidence.

---

**Q: What if my supplier transaction is for something unrelated to emissions (e.g. office coffee)?**
EcoLink will still attempt to classify it. If no NGA emission factor exists for that category, it will appear as **No Factor** in the Review Queue. You can reject it or assign it to the closest matching category.

---

**Q: How accurate are the CO₂e figures?**
EcoLink uses the official NGA 2023–24 emission factors published by Australia's Department of Climate Change, Energy, the Environment and Water (DCCEEW). These are the same factors used by government-approved carbon consultants.

---

**Q: What is Scope 3 and do I need to report it?**
Scope 3 covers indirect emissions across your value chain — including purchased goods, freight, and business travel. Under AASB S2, large corporations must report Scope 3 (which includes their suppliers' footprints). EcoLink captures Scope 3 from your transaction data automatically.

---

**Q: Can I connect both Xero and MYOB?**
Yes. If your business uses both, you can connect both. Transactions from each source are imported separately and deduplicated.

---

**Q: Will connecting Xero/MYOB give EcoLink access to make payments or changes?**
No. EcoLink requests **read-only** access to your accounting software. It cannot create, edit, or delete any transactions.

---

**Q: My Xero connection shows "Invalid redirect_uri". What do I do?**
This means the EcoLink application URL has not been registered in your Xero developer settings. Contact your EcoLink administrator to add the production redirect URI in the Xero developer portal under Configuration → Redirect URIs.

---

**Q: When will MYOB be available?**
MYOB integration is currently in development. You will be notified by email as soon as it goes live. In the meantime, connect via Xero to get started.

---

**Q: What is the difference between AASB S1 and S2?**
- **AASB S2** covers climate-related financial disclosures including greenhouse gas emissions (Scope 1, 2, 3). This is what most suppliers need.
- **AASB S1** covers broader sustainability-related disclosures. It is available on the Professional and Enterprise plans.

---

**Q: Can I export a report before all my transactions are classified?**
Yes. The report will include only classified transactions. Unclassified or pending transactions are excluded. For a complete and accurate report, clear your Review Queue first.

---

**Q: I signed up but cannot log in. What happened?**
You must verify your email before logging in. Check your inbox for a message with the subject "Confirm your EcoLink account" and click the confirmation link. If the link has expired (after 24 hours), register again.

---

**Q: Can multiple people in my team use the same account?**
The Starter plan supports 1 user. The Professional plan supports up to 5 users. The Enterprise plan supports unlimited users. To add users, contact EcoLink support.

---

**Q: How do I cancel my subscription?**
Go to **Billing → Open billing portal**. From there you can cancel anytime. Your access continues until the end of the current billing period.

---

**Q: My question is not listed here. How do I get help?**
Email the EcoLink support team. Professional plan clients receive priority response. Enterprise clients have access to phone support.

---

*EcoLink Australia · Emissions reported under AASB S2 · NGA Factors 2023–24 · April 2026*
