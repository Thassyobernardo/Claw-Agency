"""
Google Maps scraper via Apify Actor (jan.mraz/google-maps-scraper).
Targets local businesses like dental clinics and real estate agencies.
"""
import os
import logging
import config
from apify_client import ApifyClient
from database import upsert_lead, save_proposal
from proposal_generator import process_lead

log = logging.getLogger(__name__)

SOURCE = "google_maps"
ACTOR = "jan.mraz/google-maps-scraper"


def _get_client() -> ApifyClient:
    token = os.getenv("APIFY_TOKEN")
    if not token:
        raise RuntimeError("APIFY_TOKEN is not set.")
    return ApifyClient(token)


def scrape(queries: list[str] = None, max_results: int = 10) -> int:
    try:
        client = _get_client()
    except Exception as e:
        log.error(f"[GoogleMaps] {e}")
        return 0

    # If no queries provided, build from config
    search_queries = queries
    if not search_queries:
        search_queries = []
        for sector in config.TARGET_SECTORS:
            for loc in config.TARGET_LOCATIONS[:2]: # Limit locations to avoid huge runs
                search_queries.append(f"{sector} {loc}")

    saved = 0
    for query in search_queries:
        log.info(f"[GoogleMaps] Searching for: {query}")
        try:
            run_input = {
                "queries": [query],
                "maxResults": max_results,
                "language": "fr",
                "deeperCity": True,
            }
            run = client.actor(ACTOR).call(run_input=run_input, timeout_secs=300)
            items = client.dataset(run["defaultDatasetId"]).list_items().items
            
            for item in items:
                title = item.get("title", "").strip()
                url = item.get("website") or item.get("url", "").strip()
                if not title or not url:
                    continue
                
                address = item.get("address", "")
                category = item.get("categoryName", "")
                description = f"Local business in {address}. Category: {category}. Phone: {item.get('phone', 'N/A')}"
                
                lead_id = upsert_lead(
                    source=SOURCE,
                    title=title,
                    description=description,
                    url=url,
                    author=item.get("title"),
                    keywords=query,
                    location=address,
                    sector=category
                )

                if lead_id:
                    try:
                        # For local businesses, we might want a simpler analysis
                        analysis, proposal = process_lead(
                            lead_id, SOURCE, title, description
                        )
                        save_proposal(lead_id, analysis, proposal)
                        saved += 1
                        log.info(f"[GoogleMaps] Saved lead #{lead_id}: {title[:60]}")
                    except Exception as e:
                        log.warning(f"[GoogleMaps] Proposal error for #{lead_id}: {e}")

        except Exception as e:
            log.error(f"[GoogleMaps] Actor run failed for '{query}': {e}")

    return saved
