# Claw Agency — Global Configuration
# Adapted for European B2B Prospecting

AGENCY_NAME = "Claw Agency"
TARGET_SECTORS = ["dental clinics", "cliniques dentaires", "real estate", "immobilier"]
TARGET_LOCATIONS = ["Luxembourg", "Luxembourg City", "Paris", "Berlin", "Madrid", "Brussels"]
OUTREACH_LANGUAGE = "fr"
TARGET_PLATFORMS = ["linkedin", "google_maps"]

EMAIL_SUBJECT_FR = "Idée rapide pour automatiser votre prospection"
EMAIL_FROM_NAME = "Bernardo | Claw Agency"

# Ideal Client Profile (ICP) for AI Qualification
ICP = {
    "sectors": ["dentiste", "clinique dentaire", "agence immobilière"],
    "company_size": "1-20 employees",
    "has_website": True,
    "location": "Luxembourg, France, Belgium, Germany, Spain"
}

# Scraper Settings
APIFY_TOKEN = None # Will be read from env via os.getenv
GROQ_API_KEY = None # Will be read from env via os.getenv
RESEND_API_KEY = None # Will be read from env via os.getenv
