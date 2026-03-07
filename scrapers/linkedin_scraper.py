"""
LinkedIn scraper via Apify Actor (linkedin-jobs-scraper).
No official API required. Falls back gracefully if APIFY_TOKEN not set.
"""
import os
import requests
from datetime import datetime
from database import upsert_lead, save_proposal
from proposal_generator import process_lead

import config

SOURCE = "linkedin"
APIFY_ACTOR = "bebity/linkedin-jobs-scraper"
APIFY_BASE = "https://api.apify.com/v2"


def _run_actor(keyword: str, location: str, max_items: int = 10) -> list[dict]:
    token = os.getenv("APIFY_TOKEN")
    if not token:
        return []

    run_url = f"{APIFY_BASE}/acts/{APIFY_ACTOR}/run-sync-get-dataset-items"
    payload = {
        "title": keyword,
        "location": location,
        "rows": max_items,
        "contractType": "freelance",
    }

    try:
        resp = requests.post(
            run_url,
            json=payload,
            params={"token": token},
            timeout=180,
        )
        resp.raise_for_status()
        return resp.json()
    except Exception as e:
        print(f"[LinkedIn] Apify error for '{keyword}' in '{location}': {e}")
        return []


def scrape(keywords: list[str] = None, max_per_keyword: int = 10) -> int:
    if not os.getenv("APIFY_TOKEN"):
        print("[LinkedIn] APIFY_TOKEN not set, skipping.")
        return 0

    # Use keywords from config if none provided
    search_keywords = keywords if keywords else config.TARGET_SECTORS
    locations = config.TARGET_LOCATIONS[:3] # Limit for performance

    saved = 0
    for kw in search_keywords:
        for loc in locations:
            print(f"[LinkedIn] Searching '{kw}' in {loc}...")
            jobs = _run_actor(kw, loc, max_per_keyword)

            for job in jobs:
                title = job.get("title", "No title")
                company = job.get("companyName", "")
                description = job.get("description", "") or job.get("descriptionText", "")
                url = job.get("jobUrl") or job.get("url", "")
                posted = job.get("postedAt") or job.get("publishedAt", "")

                if not url:
                    continue

                author = company or None
                full_desc = f"{description}"[:4000]

                lead_id = upsert_lead(
                    source=SOURCE,
                    title=title,
                    description=full_desc,
                    url=url,
                    author=author,
                    posted_at=posted,
                    keywords=kw,
                    location=loc,
                    sector=kw
                )

                if lead_id:
                    try:
                        analysis, proposal = process_lead(
                            lead_id, SOURCE, title, full_desc
                        )
                        save_proposal(lead_id, analysis, proposal)
                        saved += 1
                        print(f"[LinkedIn] Saved lead #{lead_id}: {title[:60]}")
                    except Exception as e:
                        print(f"[LinkedIn] Proposal error for #{lead_id}: {e}")

    return saved
