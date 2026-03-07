import database as db
from dotenv import load_dotenv
load_dotenv()
import logging
import orchestrator

logging.basicConfig(level=logging.INFO)

db.init_db()
with db.get_conn() as conn:
    cur = conn.cursor()
    cur.execute("UPDATE leads SET status='new' WHERE id IN (SELECT id FROM leads WHERE status='skipped' OR status='new' LIMIT 5);")
    conn.commit()
    print(f"Resetted {cur.rowcount} leads to 'new'")

# Manually trigger the cycle on those 5 leads
orchestrator.run_full_agency_cycle()
