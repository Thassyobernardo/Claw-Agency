# 🦅 Claw Agency Starter Kit

**Build Your AI Lead Generation Agency in a Weekend**

> The exact system used to run an automated AI agency — scraping leads, sending personalized emails, and managing clients — all on autopilot for $5/month.

---

## What's Inside

```
claw-agency-starter-kit/
│
├── 📁 hunter-agent/          # The AI lead generation engine
│   ├── main.py               # Flask app + API routes
│   ├── database.py           # PostgreSQL schema (multi-tenant)
│   ├── auth.py               # JWT authentication
│   ├── scheduler.py          # APScheduler jobs
│   ├── stripe_payments.py    # Stripe SaaS billing
│   ├── requirements.txt
│   └── Procfile              # Railway deploy config
│
├── 📁 dashboard/             # SaaS client dashboard
│   ├── app.html              # Full dashboard (EN/PT/FR/DE/ES)
│   └── app_with_i18n.html    # Latest version with language switcher
│
├── 📁 antigravity-skills/    # AntiGravity/Claude Code skills
│   ├── automation-agency/    # Full agency automation skill
│   ├── cold-email/           # Email templates (5 languages)
│   └── security-bonus/       # 🔒 OpenClaw Security Shield (BONUS)
│
├── 📁 guide/
│   └── SETUP_GUIDE.md        # Step-by-step setup (Weekend Deploy)
│
└── README.md                 # This file
```

---

## What This System Does

1. **Scrapes leads** from Google Maps using Apify (dental clinics, law firms, agencies — any sector, any city)
2. **Finds contact emails** by visiting company websites automatically
3. **Generates personalized proposals** using Groq LLaMA-3 AI
4. **Sends cold emails** via Resend (3,000 free/month)
5. **Reports to Telegram** every day at 19:00 with your stats
6. **Client dashboard** — multi-language SaaS interface your clients log into

---

## Tech Stack

| Component | Technology | Cost |
|-----------|-----------|------|
| Backend | Flask + Python | Free |
| Database | PostgreSQL | Free (Railway) |
| Hosting | Railway | $5/month |
| Scraping | Apify | ~$10/month |
| AI | Groq LLaMA-3 | Free |
| Email | Resend | Free (3k/mo) |
| Payments | Stripe | 2.9% per transaction |

**Total: ~$15/month to run**

---

## Quick Start

See `guide/SETUP_GUIDE.md` for the full walkthrough.

TL;DR:
```bash
# 1. Create Railway project + PostgreSQL
# 2. Set environment variables (see guide)
# 3. railway up
# 4. Visit /app — register and configure your agent
# 5. Visit /run-now — trigger first scan
```

---

## The BONUS — OpenClaw Security Shield 🔒

The `antigravity-skills/security-bonus/` folder contains a production-grade security skill specifically for OpenClaw instances:

- Prompt injection defense
- Rate limiting
- JWT hardening  
- SQL injection prevention
- Secrets management
- CORS whitelist
- Audit logging

**Install in AntiGravity:**
> "Use @openclaw-security-shield to harden my OpenClaw deployment"

---

## License

You own this kit. Use it for your own projects, clients, and agency.
Do not resell this exact kit — build something new with it.

---

Built by **Claw Agency** — [clawagency.online](https://clawagency.online)
