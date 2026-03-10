"""
orchestrator.py — The brain of the Hunter Agent
Runs the full lead generation and outreach cycle.
"""
import os
import json
import logging
import requests
from datetime import datetime

log = logging.getLogger(__name__)

# ─── APIFY SCRAPING ────────────────────────────────────────────────────────────
def scrape_google_maps(sector: str, location: str, limit: int = 20) -> list:
    """Scrape business leads from Google Maps via Apify."""
    token = os.environ.get("APIFY_TOKEN")
    if not token:
        log.warning("APIFY_TOKEN not set — skipping scrape")
        return []
    try:
        from apify_client import ApifyClient
        client = ApifyClient(token)
        run = client.actor("compass/crawler-google-places").call(run_input={
            "searchStringsArray": [f"{sector} in {location}"],
            "maxCrawledPlacesPerSearch": limit,
            "language": "en",
            "maxImages": 0,
            "maxReviews": 0,
        })
        items = list(client.dataset(run["defaultDatasetId"]).iterate_items())
        log.info(f"Scraped {len(items)} leads for '{sector}' in '{location}'")
        return items
    except Exception as e:
        log.error(f"Scraping error: {e}")
        return []

# ─── EMAIL ENRICHMENT ──────────────────────────────────────────────────────────
def enrich_email(website: str) -> str | None:
    """Try to find a contact email from a website."""
    if not website:
        return None
    try:
        import re
        url = website if website.startswith("http") else f"https://{website}"
        resp = requests.get(url, timeout=8, headers={"User-Agent": "Mozilla/5.0"})
        emails = re.findall(r"[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}", resp.text)
        # Filter out common false positives
        filtered = [e for e in emails if not any(x in e.lower() for x in
                    ["sentry", "example", "wixpress", "schema", "pixel", "jquery"])]
        return filtered[0] if filtered else None
    except Exception:
        return None

# ─── AI PROPOSAL GENERATION ────────────────────────────────────────────────────
def generate_proposal(lead: dict, language: str = "en") -> dict:
    """Generate a personalized cold email using Groq LLaMA-3."""
    api_key = os.environ.get("GROQ_API_KEY")
    if not api_key:
        return {
            "subject": f"Quick question for {lead.get('name', 'your business')}",
            "body": "Hi,\n\nI wanted to reach out about automating your lead generation.\n\nWould a 15-min call make sense?\n\nBest regards"
        }
    try:
        from groq import Groq
        client = Groq(api_key=api_key)

        lang_prompts = {
            "en": "Write in English. Professional but friendly.",
            "fr": "Écris en français. Professionnel mais chaleureux.",
            "pt": "Escreve em português. Profissional mas amigável.",
            "de": "Schreibe auf Deutsch. Professionell aber freundlich.",
            "es": "Escribe en español. Profesional pero amigable.",
        }

        prompt = f"""Write a cold email for a B2B outreach.

Company: {lead.get('name', 'Unknown')}
Sector: {lead.get('sector', 'business')}
Location: {lead.get('location', '')}
Website: {lead.get('website', '')}

Rules:
- Max 100 words
- Focus on saving time and automating repetitive tasks
- Mention AI automation specifically
- End with a soft CTA (15-min call)
- {lang_prompts.get(language, lang_prompts['en'])}

Return ONLY valid JSON with keys: subject, body
No markdown, no explanation."""

        response = client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=[{"role": "user", "content": prompt}],
            response_format={"type": "json_object"},
            max_tokens=300,
        )
        return json.loads(response.choices[0].message.content)
    except Exception as e:
        log.error(f"Proposal generation error: {e}")
        return {
            "subject": f"AI automation for {lead.get('name', 'your business')}",
            "body": "Hi,\n\nI help businesses automate their lead generation and outreach with AI.\n\nWould a quick 15-min call make sense this week?\n\nBest regards"
        }

# ─── EMAIL OUTREACH ────────────────────────────────────────────────────────────
def send_outreach_email(to_email: str, subject: str, body: str) -> bool:
    """Send a cold email via Resend."""
    api_key = os.environ.get("RESEND_API_KEY")
    from_email = os.environ.get("EMAIL_FROM", "bernardo@clawagency.online")
    if not api_key:
        log.warning("RESEND_API_KEY not set — skipping email")
        return False
    try:
        import resend
        resend.api_key = api_key
        resend.Emails.send({
            "from": from_email,
            "to": to_email,
            "subject": subject,
            "html": f"<p style='font-family:Arial,sans-serif;line-height:1.6'>{body.replace(chr(10), '<br>')}</p>",
        })
        log.info(f"Email sent to {to_email}")
        return True
    except Exception as e:
        log.error(f"Email send error: {e}")
        return False

# ─── TELEGRAM REPORT ───────────────────────────────────────────────────────────
def send_telegram_report(stats: dict):
    """Send daily stats to Telegram."""
    token = os.environ.get("TELEGRAM_TOKEN")
    chat_id = os.environ.get("TELEGRAM_CHAT_ID")
    if not token or not chat_id:
        return
    try:
        msg = (
            f"🦅 *Claw Agency — Daily Report*\n"
            f"📅 {datetime.utcnow().strftime('%d %b %Y')}\n\n"
            f"📊 New leads today: *{stats.get('new_today', 0)}*\n"
            f"📧 Emails sent: *{stats.get('emails_sent', 0)}*\n"
            f"📁 Total pipeline: *{stats.get('total_leads', 0)}*\n\n"
            f"🔗 Dashboard: https://claw-agency-production.up.railway.app/app"
        )
        requests.post(
            f"https://api.telegram.org/bot{token}/sendMessage",
            json={"chat_id": chat_id, "text": msg, "parse_mode": "Markdown"},
            timeout=10
        )
    except Exception as e:
        log.error(f"Telegram error: {e}")

# ─── MAIN CYCLE ────────────────────────────────────────────────────────────────
def run_full_cycle():
    """
    Main agent loop — runs every 6 hours via APScheduler.
    For each active tenant, scrapes leads based on their config
    and sends personalized outreach emails.
    """
    log.info("=== Agent cycle started ===")
    try:
        import database as db
        engine = db.get_engine()
        from sqlalchemy import text

        # Get all active tenants with agent config
        with engine.connect() as conn:
            tenants = conn.execute(text("""
                SELECT id, email, name, agent_config
                FROM users
                WHERE status = 'active' AND agent_config IS NOT NULL
            """)).fetchall()

        log.info(f"Processing {len(tenants)} active tenants")

        for tenant in tenants:
            try:
                config = tenant.agent_config if isinstance(tenant.agent_config, dict) \
                         else json.loads(tenant.agent_config or "{}")
                sector = config.get("sector", "")
                location = config.get("location", "")
                language = config.get("language", "en")
                limit = int(config.get("leads_per_scan", 20))

                if not sector or not location:
                    log.info(f"Tenant {tenant.id} has no sector/location config — skipping")
                    continue

                log.info(f"Tenant {tenant.id}: scanning '{sector}' in '{location}'")

                # Scrape leads
                raw_leads = scrape_google_maps(sector, location, limit)

                emails_sent = 0
                for item in raw_leads:
                    name = item.get("title", "Unknown")
                    website = item.get("website", "")
                    email = enrich_email(website)

                    # Save lead to database
                    lead_id = db.save_tenant_lead(tenant.id, {
                        "name": name,
                        "email": email or "",
                        "website": website,
                        "sector": sector,
                        "location": location,
                        "source": "google_maps",
                        "status": "new",
                    })

                    # Send outreach if we have an email
                    if email and lead_id:
                        proposal = generate_proposal(
                            {"name": name, "sector": sector, "location": location, "website": website},
                            language=language
                        )
                        sent = send_outreach_email(email, proposal["subject"], proposal["body"])
                        if sent:
                            emails_sent += 1
                            db.save_tenant_email(tenant.id, lead_id, proposal["subject"])

                log.info(f"Tenant {tenant.id}: {len(raw_leads)} leads, {emails_sent} emails sent")

            except Exception as e:
                log.error(f"Error processing tenant {tenant.id}: {e}")

        log.info("=== Agent cycle complete ===")

    except Exception as e:
        log.error(f"Full cycle error: {e}")


def run_admin_cycle():
    """
    Admin cycle — runs for the main Claw Agency account (internal use).
    Uses environment variables directly instead of tenant config.
    """
    sector = os.environ.get("TARGET_SECTOR", "dental clinics")
    location = os.environ.get("TARGET_LOCATION", "Luxembourg")
    language = os.environ.get("TARGET_LANGUAGE", "en")
    limit = int(os.environ.get("LEADS_PER_SCAN", "20"))

    log.info(f"Admin scan: '{sector}' in '{location}'")
    leads = scrape_google_maps(sector, location, limit)

    import database as db
    emails_sent = 0
    for item in leads:
        name = item.get("title", "Unknown")
        website = item.get("website", "")
        email = enrich_email(website)

        db.save_lead({
            "name": name, "email": email or "", "website": website,
            "sector": sector, "location": location, "source": "google_maps",
        })

        if email:
            proposal = generate_proposal(
                {"name": name, "sector": sector, "location": location},
                language=language
            )
            sent = send_outreach_email(email, proposal["subject"], proposal["body"])
            if sent:
                emails_sent += 1
                db.save_email_sent(None, email, proposal["subject"])

    log.info(f"Admin cycle: {len(leads)} leads found, {emails_sent} emails sent")

    # Telegram report
    try:
        stats = db.get_stats()
        send_telegram_report({
            "new_today": len(leads),
            "emails_sent": emails_sent,
            "total_leads": stats.get("leads", 0)
        })
    except Exception as e:
        log.warning(f"Stats/Telegram error: {e}")
