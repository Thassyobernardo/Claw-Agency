"""
Upwork scraper via Apify actor flash_mage/upwork.

Uses the official apify-client library instead of the sync HTTP endpoint
to avoid 400/timeout errors on large result sets.

Actor: flash_mage~upwork
Input:  {"query": [keyword], "maxJobs": N}
Output: list of job objects with fields:
  - title
  - link  (full Upwork job URL)
  - data.opening.description
  - data.opening.postedOn
"""
import os
import time
import logging

from apify_client import ApifyClient

from database import upsert_lead, save_proposal
from proposal_generator import process_lead

import config

log = logging.getLogger(__name__)

SOURCE = "upwork"
ACTOR = "jan.mraz~upwork-jobs-scraper"


def _get_client() -> ApifyClient:
    token = os.getenv("APIFY_TOKEN")
    if not token:
        raise RuntimeError("APIFY_TOKEN is not set.")
    return ApifyClient(token, timeout_secs=300)


def _fetch_jobs(client: ApifyClient, keyword: str, max_jobs: int = 5) -> list[dict]:
    try:
        run_input = {
            "queries": [keyword],
            "maxResults": max_jobs,
            "sort": "recency"
        }
        log.info(f"[Upwork] Starting actor run for '{keyword}'")
        run = client.actor(ACTOR).call(run_input=run_input, timeout_secs=300)
        items = client.dataset(run["defaultDatasetId"]).list_items().items
        return items if isinstance(items, list) else []
    except Exception as e:
        log.warning("[Upwork] Actor call failed for '%s': %s", keyword, e)
        return []


def _parse_job(item: dict) -> dict | None:
    title = item.get("title", "").strip()
    url   = item.get("url", "").strip()
    if not title or not url:
        return None
    description = item.get("description", "")
    posted_at   = item.get("posted_time") or item.get("published_at")
    return {
        "title":       title,
        "url":         url,
        "description": description,
        "posted_at":   posted_at,
    }


def scrape(keywords: list[str] = None, max_per_keyword: int = 5) -> int:
    try:
        client = _get_client()
    except Exception as e:
        log.error(f"[Upwork] {e}")
        return 0

    # Use config sectors if none provided
    search_keywords = keywords if keywords else config.TARGET_SECTORS
    
    saved = 0
    for i, kw in enumerate(search_keywords):
        if i > 0:
            time.sleep(2)

        jobs = _fetch_jobs(client, kw, max_jobs=max_per_keyword)
        log.info("[Upwork] '%s' → %d jobs", kw, len(jobs))

        for item in jobs:
            parsed = _parse_job(item)
            if not parsed:
                continue

            lead_id = upsert_lead(
                source=SOURCE,
                title=parsed["title"],
                description=parsed["description"],
                url=parsed["url"],
                author=None,
                posted_at=parsed["posted_at"],
                keywords=kw,
                location="Worldwide",
                sector=kw
            )

            if lead_id:
                saved += 1
                log.info("[Upwork] Saved #%d: %s", lead_id, parsed["title"][:60])

    return saved
