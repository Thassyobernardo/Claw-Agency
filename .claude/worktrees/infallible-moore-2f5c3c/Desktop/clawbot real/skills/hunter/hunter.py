import os
import asyncio
from apify_client import ApifyClient
from groq import Groq
import json

# Configuration
APIFY_TOKEN = os.getenv("APIFY_TOKEN")
GROQ_API_KEY = os.getenv("GROQ_API_KEY")

apify_client = ApifyClient(APIFY_TOKEN)
groq_client = Groq(api_key=GROQ_API_KEY)

async def scrape_upwork_leads(query="AI Engineer"):
    """
    Scrapes Upwork leads using an Apify actor.
    """
    # Using 'apify/upwork-scraper' as an example actor
    run_input = {
        "queries": [query],
        "maxItems": 10,
        "location": "Worldwide"
    }
    
    run = apify_client.actor("apify/upwork-scraper").call(run_input=run_input)
    
    leads = []
    for item in apify_client.dataset(run["defaultDatasetId"]).iterate_items():
        leads.append(item)
        
    return leads

async def generate_proposal(lead_data, research_brief=""):
    """
    Generates a personalized proposal using Groq.
    """
    prompt = f"""
    Lead Data: {json.dumps(lead_data)}
    Research Brief: {research_brief}
    
    Task: Write a highly professional, short, and punchy Upwork proposal for Claw Agency.
    The proposal should highlight why Claw Agency is the best fit for this specific job.
    Mention at least one detail from the research brief to show you've done your homework.
    End with a clear call to action.
    """
    
    completion = groq_client.chat.completions.create(
        model="llama-3.3-70b-versatile",
        messages=[{"role": "user", "content": prompt}],
    )
    
    return completion.choices[0].message.content

async def run_hunt_cycle():
    leads = await scrape_upwork_leads()
    for lead in leads:
        # Simple filter
        if lead.get("budget", 0) > 500 or "Fixed" not in lead.get("jobType", ""):
            print(f"Processing high-potential lead: {lead.get('title')}")
            # In a real scenario, this would trigger the autoresearch skill first
            proposal = await generate_proposal(lead)
            print(f"Generated Proposal: {proposal}")
            # Notification logic (Telegram/Email) would go here

if __name__ == "__main__":
    asyncio.run(run_hunt_cycle())
