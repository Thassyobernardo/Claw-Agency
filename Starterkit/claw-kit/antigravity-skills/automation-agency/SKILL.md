---
name: ai-automation-agency
description: "Build and run an AI automation agency. Use when setting up lead generation, client outreach, proposal writing, or deploying autonomous agents. Covers Hunter Agent, Apify, Groq AI, Resend email, Railway deployment."
---

# AI Automation Agency 🤖

## Stack
Flask + APScheduler | Apify scraping | Groq LLaMA | Resend email | PostgreSQL | Railway ($5/mo)

## Core Agent Loop
```python
def agent_cycle():
    leads = scrape_google_maps(sector="dental clinics", location="Luxembourg", limit=20)
    for lead in leads:
        email = enrich_email(lead['website'])
        proposal = generate_proposal(lead)
        send_email(to=email, **proposal)
        save_lead(lead, status="contacted")
```

## Apify Scraping
```python
from apify_client import ApifyClient
client = ApifyClient(os.environ["APIFY_TOKEN"])

def scrape_google_maps(sector, location, limit=20):
    run = client.actor("compass/crawler-google-places").call(run_input={
        "searchStringsArray": [f"{sector} in {location}"],
        "maxCrawledPlacesPerSearch": limit,
    })
    return list(client.dataset(run["defaultDatasetId"]).iterate_items())
```

## Groq Proposal Generator
```python
from groq import Groq
client = Groq(api_key=os.environ["GROQ_API_KEY"])

def generate_proposal(lead):
    response = client.chat.completions.create(
        model="llama-3.3-70b-versatile",
        messages=[{"role":"user","content":f"Cold email for {lead['name']} ({lead['sector']}). Max 120 words. JSON: {{subject, body}}"}],
        response_format={"type":"json_object"}
    )
    return json.loads(response.choices[0].message.content)
```

## Deploy to Railway
```bash
railway login && railway up
# Set vars: DATABASE_URL, GROQ_API_KEY, APIFY_TOKEN, RESEND_API_KEY
```

## Best Sectors
dental clinics | law firms | real estate | e-commerce | SaaS startups | marketing agencies
