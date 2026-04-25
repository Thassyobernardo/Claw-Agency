
import os
import json
import asyncio
from apify_client import ApifyClient
from dotenv import load_dotenv

load_dotenv()

async def find_australian_leads(industry: str = "Construction", city: str = "Sydney"):
    """
    Busca empresas reais na Australia usando o Apify Google Places Scraper.
    Actor: compass/crawler-google-places
    """
    token = os.getenv("APIFY_TOKEN")
    if not token:
        print("❌ APIFY_TOKEN nao encontrado no .env")
        return []

    client = ApifyClient(token)
    query = f"{industry} in {city}, Australia"
    print(f"🔎 Buscando leads REAIS via Apify para: {query}...")

    run_input = {
        "searchStringsArray": [query],
        "maxCrawledPlacesPerSearch": 10,
        "language": "en",
        "deeperCityScrape": False,
        "onePerQuery": False,
    }

    try:
        # Actor correto: compass/crawler-google-places
        run = client.actor("compass/crawler-google-places").call(run_input=run_input)

        leads = []
        for item in client.dataset(run["defaultDatasetId"]).iterate_items():
            leads.append({
                "name": item.get("title"),
                "website": item.get("website"),
                "phone": item.get("phone"),
                "sector": industry,
                "address": item.get("address"),
                "rating": item.get("totalScore"),
            })

        print(f"✅ Encontrados {len(leads)} leads reais!")
        return leads

    except Exception as e:
        print(f"❌ Erro ao chamar Apify: {e}")
        return []

if __name__ == "__main__":
    res = asyncio.run(find_australian_leads())
    print(json.dumps(res, indent=2, ensure_ascii=False))
