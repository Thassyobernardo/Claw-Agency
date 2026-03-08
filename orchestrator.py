import logging
from scrapers import google_maps_scraper
from database import log_action, get_leads

log = logging.getLogger(__name__)

def run_full_cycle():
    """
    Simplified Orchestrator for version 1.0.2.
    Only triggers Google Maps scraper once.
    """
    log.info("--- [Orchestrator] Starting Simplified B2B Cycle (Luxembourg) ---")
    
    # Run Google Maps scan exactly once
    try:
        count = google_maps_scraper.scrape()
        log.info(f"[Orchestrator] Found {count} new leads on Google Maps.")
    except Exception as e:
        log.error(f"[Orchestrator] Scan failed: {e}")
        count = 0
    
    log.info(f"--- [Orchestrator] Cycle Complete. Total new leads: {count} ---")
    log_action("orchestrator_cycle", f"Simplified scan complete. {count} leads added.")
    
    return count

if __name__ == "__main__":
    run_full_cycle()
    print("Simplified scan complete. Check database or dashboard.")
