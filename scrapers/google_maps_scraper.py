"""
Google Maps scraper via Apify Actor (compass/crawler-google-places).
Targets dental clinics and real estate agencies in Luxembourg.
"""
import os
import time
import logging
from apify_client import ApifyClient
from database import save_lead, log_action

log = logging.getLogger(__name__)

SOURCE = "google_maps"
ACTOR = "compass/crawler-google-places"

def _get_client() -> ApifyClient:
    token = os.getenv("APIFY_TOKEN")
    if not token:
        raise RuntimeError("APIFY_TOKEN is not set.")
    return ApifyClient(token)

def scrape() -> int:
    """
    Simplified Google Maps scraper.
    Runs exactly 4 searches and saves results to the database.
    """
    try:
        client = _get_client()
    except Exception as e:
        log.error(f"[GoogleMaps] {e}")
        return 0

    queries = [
        "clinique dentaire Luxembourg",
        "dentiste Luxembourg",
        "agence immobilière Luxembourg",
        "immobilier Luxembourg"
    ]

    saved = 0
    for query in queries:
        log.info(f"[GoogleMaps] Running search: {query}")
        
        # Sector logic
        sector = "dental" if "dent" in query.lower() else "real_estate"
        
        try:
            run_input = {
                "searchStringsArray": [query],
                "maxCrawledPlacesPerSearch": 20,
                "language": "fr"
            }
            
            # Start the actor and wait for it to finish
            run = client.actor(ACTOR).call(run_input=run_input, timeout_secs=600)
            items = client.dataset(run["defaultDatasetId"]).list_items().items
            
            log.info(f"[GoogleMaps] Found {len(items)} items for '{query}'")
            
            for item in items:
                name = item.get("title") or item.get("name", "").strip()
                if not name:
                    continue
                
                phone = item.get("phone") or item.get("phoneNumber", "N/A")
                website = item.get("website") or item.get("url", "N/A")
                address = item.get("address") or item.get("fullAddress", "Luxembourg")
                
                # Use save_lead(name, email, phone, sector, location, score, source, notes)
                # Note: We put website in notes since there's no official website field in schema
                success = save_lead(
                    name=name,
                    email="N/A",
                    phone=phone,
                    sector=sector,
                    location=address,
                    score=70,
                    source=SOURCE,
                    notes=f"Website: {website} | Search: {query}"
                )

                if success:
                    saved += 1
            
            # Anti-hammering delay
            time.sleep(2)

        except Exception as e:
            log.error(f"[GoogleMaps] Actor failed for '{query}': {e}")

    if saved > 0:
        log_action("google_maps_scan", f"Successful scan. Added {saved} leads from Luxembourg.")
        
    return saved
