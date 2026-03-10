# Claw Agency Starter Kit — Setup Guide
## Build Your AI Lead Generation Agency in a Weekend

**What you'll have running by the end:**
- AI agent scraping leads from Google Maps automatically
- Personalized email outreach sent on autopilot
- Professional SaaS dashboard for managing clients
- OpenClaw secured and hardened for production
- Daily Telegram reports on your phone

---

## Prerequisites (15 min)

Create free accounts on:
- [Railway.app](https://railway.app) — cloud hosting ($5/month)
- [Apify.com](https://apify.com) — lead scraping (~$10/month)
- [Groq.com](https://console.groq.com) — AI (free)
- [Resend.com](https://resend.com) — email (free tier: 3000 emails/month)
- [Telegram](https://telegram.org) — for daily reports (free)

---

## Step 1 — Deploy the Hunter Agent (30 min)

### 1.1 Create Railway project
1. Go to railway.app → New Project → Deploy from GitHub
2. Connect your GitHub account
3. Upload the `hunter-agent/` folder as a new repository

### 1.2 Add PostgreSQL
1. In Railway → click "+ New" → Database → PostgreSQL
2. Copy the `DATABASE_URL` from the database settings

### 1.3 Set environment variables
In Railway → your service → Variables, add:

```
DATABASE_URL=postgresql://...  (from step 1.2)
GROQ_API_KEY=gsk_...           (from console.groq.com)
APIFY_TOKEN=apify_api_...      (from apify.com/account/integrations)
RESEND_API_KEY=re_...          (from resend.com/api-keys)
EMAIL_FROM=you@yourdomain.com
TELEGRAM_TOKEN=...             (create bot via @BotFather)
TELEGRAM_CHAT_ID=...           (your Telegram user ID)
JWT_SECRET=your-32-char-random-secret-here
```

### 1.4 Deploy
Railway auto-deploys on push. Visit your Railway URL to confirm it's running.

---

## Step 2 — Configure Your Agent (10 min)

Visit `https://your-app.railway.app/app` and:

1. **Register** your account
2. **Onboarding** → choose your sector (e.g. "Law firms")
3. **Set location** (e.g. "Luxembourg" or "New York")
4. **Choose email language** (EN/FR/PT/DE/ES)

The agent starts prospecting automatically every 6 hours.

---

## Step 3 — Set Up the SaaS Dashboard (20 min)

The `dashboard/app.html` file is your client-facing interface.

### For your own use:
Already included in the Railway deployment — access at `/app`

### To sell as white-label to clients:
1. Copy `app.html` to your web server
2. Change the `API` constant at the top to your Railway URL
3. Customise colours/branding in the CSS `:root` variables

---

## Step 4 — Install AntiGravity Skills (10 min)

Copy the skills from `antigravity-skills/` to your AntiGravity skills folder:

```bash
# Windows
xcopy antigravity-skills\* C:\Users\YourName\.agent\skills\ /E /I

# Mac/Linux  
cp -r antigravity-skills/* ~/.agent/skills/
```

Then in AntiGravity, type:
> "Use @ai-automation-agency to help me configure my lead generation"
> "Use @openclaw-security-shield to harden my deployment"
> "Use @cold-email-templates to write outreach for dental clinics in London"

---

## Step 5 — Get Your First Lead (5 min)

1. Go to `https://your-app.railway.app/run-now` to trigger an immediate scan
2. Check the Dashboard — leads should appear within 2 minutes
3. Go to Agent panel → verify your sector and location
4. Emails go out automatically

---

## Telegram Setup (5 min)

1. Open Telegram → search `@BotFather` → `/newbot`
2. Name: `YourAgency Report Bot`
3. Copy the token → add to Railway as `TELEGRAM_TOKEN`
4. Get your chat ID: message `@userinfobot` → copy the ID → add as `TELEGRAM_CHAT_ID`
5. Daily reports arrive at 19:00 your timezone

---

## Customising the Agent

### Change scan frequency
In `main.py`, find:
```python
scheduler.add_job(agent_cycle, 'interval', hours=6)
```
Change `hours=6` to any interval.

### Change target sector/location
In the Dashboard → Agent panel → update Sector and Location → Save

### Add multiple locations
The agent runs one location at a time. To cover multiple cities, create multiple accounts or modify `agent_cycle()` to loop through a list of locations.

---

## Revenue Model

**Option A — Use it yourself (agency)**
- Find clients in your sector
- Charge €500-2000/project for AI automation setup
- Use the leads the agent generates as your own pipeline

**Option B — Sell the dashboard as SaaS**
- Starter: €297/month
- Growth: €597/month  
- Enterprise: €997/month
- Activate Stripe in Railway variables to accept payments

**Option C — Sell this kit** 
- You bought the kit — you can use everything in it for your own projects
- Build your own version and sell it

---

## Troubleshooting

**Agent not finding leads:**
- Check APIFY_TOKEN is correct
- Verify sector + location in Agent panel
- Check Railway logs for errors

**Emails not sending:**
- Verify RESEND_API_KEY
- Check EMAIL_FROM domain is verified in Resend
- Check spam folder

**Database errors:**
- Confirm DATABASE_URL is correct
- Visit `/health` endpoint to check DB connection

---

## Support

Questions? Issues? 
- GitHub: [your repo]
- Email: bernardo@clawagency.online
- Built by Claw Agency — clawagency.online

