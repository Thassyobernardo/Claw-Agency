"""
Apify-based scrapers for Upwork and Freelancer.

Actors used:
  - misceres/upwork-scraper       → Upwork project listings
  - curious_coder/freelancer-scraper → Freelancer project listings

API: POST https://api.apify.com/v2/acts/{actor}/run-sync-get-dataset-items
     ?token={APIFY_TOKEN}

run-sync-get-dataset-items runs the actor and blocks until it finishes,
then returns the dataset as a JSON array — no polling needed.
"""
import os
import logging

import requests

from database import upsert_lead, save_proposal
from proposal_generator import process_lead

log = logging.getLogger(__name__)

APIFY_BASE = "https://api.apify.com/v2/acts"

KEYWORDS = [
    "automation",
    "chatbot",
    "zapier",
    "n8n",
    "crm",
    "whatsapp bot",
]


def _get_token() -> str:
    token = os.getenv("APIFY_TOKEN")
    if not token:
        raise RuntimeError("APIFY_TOKEN is not set.")
    return token


def _run_actor(actor: str, input_data: dict, timeout: int = 180) -> list[dict]:
    """POST to run-sync-get-dataset-items and return the results list."""
    url = f"{APIFY_BASE}/{actor}/run-sync-get-dataset-items"
    try:
        resp = requests.post(
            url,
            params={"token": _get_token()},
            json=input_data,
            timeout=timeout,
        )
        resp.raise_for_status()
        data = resp.json()
        return data if isinstance(data, list) else []
    except Exception as e:
        log.warning("[Apify] %s — request failed: %s", actor, e)
        return []


def _save_items(items: list[dict], source: str, keyword: str) -> int:
    """Upsert items into leads and generate proposals. Returns count saved."""
    saved = 0
    for item in items:
        title = item.get("title") or item.get("name", "")
        url   = item.get("url")   or item.get("link", "")
        desc  = (
            item.get("description")
            or item.get("snippet")
            or item.get("summary", "")
        )
        if not title or not url:
            continue

        lead_id = upsert_lead(
            source=source,
            title=title,
            description=desc,
            url=url,
            author=item.get("client") or item.get("company") or None,
            posted_at=item.get("publishedDate") or item.get("postedAt") or None,
            keywords=keyword,
        )
        if lead_id:
            try:
                analysis, proposal = process_lead(lead_id, source, title, desc)
                save_proposal(lead_id, analysis, proposal)
                saved += 1
                log.info("[Apify/%s] Saved #%d: %s", source, lead_id, title[:60])
            except Exception as e:
                log.warning("[Apify/%s] Proposal error #%d: %s", source, lead_id, e)
    return saved


def scrape_upwork(keywords: list[str] = None, max_per_keyword: int = 20) -> int:
    actor = "misceres/upwork-scraper"
    kws = keywords if keywords is not None else KEYWORDS
    saved = 0
    for kw in kws:
        log.info("[Apify/Upwork] Searching: %s", kw)
        items = _run_actor(actor, {"searchQuery": kw, "maxItems": max_per_keyword})
        log.info("[Apify/Upwork] '%s' → %d items", kw, len(items))
        saved += _save_items(items, "upwork", kw)
    return saved


def scrape_freelancer(keywords: list[str] = None, max_per_keyword: int = 20) -> int:
    actor = "curious_coder/freelancer-scraper"
    kws = keywords if keywords is not None else KEYWORDS
    saved = 0
    for kw in kws:
        log.info("[Apify/Freelancer] Searching: %s", kw)
        items = _run_actor(actor, {"searchQuery": kw, "maxResults": max_per_keyword})
        log.info("[Apify/Freelancer] '%s' → %d items", kw, len(items))
        saved += _save_items(items, "freelancer", kw)
    return saved
