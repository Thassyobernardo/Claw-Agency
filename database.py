import os
import logging
import json
import psycopg2
from sqlalchemy import create_engine, text

log = logging.getLogger(__name__)

def get_db_url():
    url = (os.getenv("DATABASE_URL") or "").strip()
    if not url:
        raise ValueError("DATABASE_URL not set")
    if url.startswith("postgres://"):
        url = url.replace("postgres://", "postgresql://", 1)
    return url

def get_engine():
    return create_engine(get_db_url(), pool_pre_ping=True, connect_args={"connect_timeout": 10})

def get_db_connection():
    url = get_db_url()
    url2 = url.replace("postgresql://", "")
    user_pass, rest = url2.split("@")
    user, password = user_pass.split(":")
    host_port, dbname = rest.split("/")
    if ":" in host_port:
        host, port = host_port.split(":")
    else:
        host, port = host_port, "5432"
    return psycopg2.connect(host=host, port=port, dbname=dbname, user=user, password=password)

def init_db():
    engine = get_engine()
    with engine.connect() as conn:
        # Tabela leads — se já existir com outro schema, fazemos ALTER para garantir colunas necessárias.
        conn.execute(
            text(
                """
                CREATE TABLE IF NOT EXISTS leads (
                    id SERIAL PRIMARY KEY,
                    name VARCHAR(255),
                    email VARCHAR(255),
                    phone VARCHAR(50),
                    sector VARCHAR(100),
                    location VARCHAR(100),
                    score INTEGER DEFAULT 0,
                    status VARCHAR(50) DEFAULT 'novo',
                    source VARCHAR(100),
                    notes TEXT,
                    skill_used VARCHAR(100),
                    created_at TIMESTAMP DEFAULT NOW()
                )
                """
            )
        )
        for col_def in [
            "ADD COLUMN IF NOT EXISTS name VARCHAR(255)",
            "ADD COLUMN IF NOT EXISTS email VARCHAR(255)",
            "ADD COLUMN IF NOT EXISTS phone VARCHAR(50)",
            "ADD COLUMN IF NOT EXISTS sector VARCHAR(100)",
            "ADD COLUMN IF NOT EXISTS location VARCHAR(100)",
            "ADD COLUMN IF NOT EXISTS score INTEGER DEFAULT 0",
            "ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT 'novo'",
            "ADD COLUMN IF NOT EXISTS source VARCHAR(100)",
            "ADD COLUMN IF NOT EXISTS notes TEXT",
            "ADD COLUMN IF NOT EXISTS skill_used VARCHAR(100)",
            "ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT NOW()",
        ]:
            try:
                conn.execute(text(f"ALTER TABLE leads {col_def}"))
            except Exception as e:
                msg = str(e).lower()
                if "already exists" not in msg:
                    log.warning(f"ALTER leads ({col_def}): {e}")
        conn.execute(text("""
            CREATE TABLE IF NOT EXISTS emails_sent (
                id SERIAL PRIMARY KEY, lead_id INTEGER,
                subject VARCHAR(255), body TEXT, sent_at TIMESTAMP DEFAULT NOW(),
                opened BOOLEAN DEFAULT FALSE, replied BOOLEAN DEFAULT FALSE
            )
        """))
        conn.execute(
            text(
                """
                CREATE TABLE IF NOT EXISTS agent_logs (
                    id SERIAL PRIMARY KEY,
                    action VARCHAR(100),
                    details JSONB,
                    created_at TIMESTAMP DEFAULT NOW()
                )
                """
            )
        )
        conn.execute(text("""
            CREATE TABLE IF NOT EXISTS security_log (
                id SERIAL PRIMARY KEY, threat_type VARCHAR(50),
                source TEXT, content_preview TEXT, created_at TIMESTAMP DEFAULT NOW()
            )
        """))
        # MULTI-TENANT TABLES
        conn.execute(text("""
            CREATE TABLE IF NOT EXISTS users (
                id SERIAL PRIMARY KEY,
                email VARCHAR(255) UNIQUE NOT NULL,
                password_hash VARCHAR(255) NOT NULL,
                name VARCHAR(255), company VARCHAR(255),
                plan VARCHAR(50) DEFAULT 'trial',
                status VARCHAR(50) DEFAULT 'active',
                stripe_customer_id VARCHAR(255),
                stripe_subscription_id VARCHAR(255),
                agent_config JSONB DEFAULT '{}',
                telegram_chat_id VARCHAR(100),
                created_at TIMESTAMP DEFAULT NOW()
            )
        """))
        conn.execute(text("""
            CREATE TABLE IF NOT EXISTS tenant_leads (
                id SERIAL PRIMARY KEY,
                user_id INTEGER REFERENCES users(id),
                name VARCHAR(255), email VARCHAR(255), phone VARCHAR(50),
                website VARCHAR(255), sector VARCHAR(100), location VARCHAR(100),
                score INTEGER DEFAULT 0, status VARCHAR(50) DEFAULT 'novo',
                source VARCHAR(100), notes TEXT, created_at TIMESTAMP DEFAULT NOW()
            )
        """))
        conn.execute(text("""
            CREATE TABLE IF NOT EXISTS tenant_emails (
                id SERIAL PRIMARY KEY,
                user_id INTEGER REFERENCES users(id),
                lead_id INTEGER REFERENCES tenant_leads(id),
                subject VARCHAR(255), sent_at TIMESTAMP DEFAULT NOW(),
                opened BOOLEAN DEFAULT FALSE, replied BOOLEAN DEFAULT FALSE
            )
        """))
        conn.commit()
    log.info("Database tables ready (multi-tenant)")

def get_stats():
    try:
        engine = get_engine()
        with engine.connect() as conn:
            leads = conn.execute(text("SELECT COUNT(*) FROM leads")).scalar()
            emails = conn.execute(text("SELECT COUNT(*) FROM emails_sent")).scalar()
            logs = conn.execute(text("SELECT COUNT(*) FROM agent_logs WHERE created_at > NOW() - INTERVAL '24 hours'")).scalar()
            return {"leads": leads, "emails_sent": emails, "scans_today": logs}
    except Exception as e:
        log.error(f"get_stats error: {e}")
        return {"leads": 0, "emails_sent": 0, "scans_today": 0}

def get_upwork_proposals_count_today():
    """Quantas propostas Upwork já foram enviadas hoje (limite 3/dia — peixes grandes)."""
    try:
        engine = get_engine()
        with engine.connect() as conn:
            n = conn.execute(text("""
                SELECT COUNT(*) FROM leads
                WHERE source = 'apify_upwork' AND created_at::date = CURRENT_DATE
            """)).scalar()
            return n or 0
    except Exception as e:
        log.error(f"get_upwork_proposals_count_today error: {e}")
        return 0

def get_other_platforms_proposals_count_today():
    """Quantas propostas em volume (Remote OK, LinkedIn, WWR) já foram enviadas hoje (limite 16/dia)."""
    try:
        engine = get_engine()
        with engine.connect() as conn:
            n = conn.execute(text("""
                SELECT COUNT(*) FROM leads
                WHERE source IN ('apify_remoteok', 'apify_linkedin', 'apify_wwr')
                  AND created_at::date = CURRENT_DATE
            """)).scalar()
            return n or 0
    except Exception as e:
        log.error(f"get_other_platforms_proposals_count_today error: {e}")
        return 0

def get_cold_emails_sent_today():
    """Quantos cold emails (Maps) foram enviados hoje (limite 20/dia)."""
    try:
        engine = get_engine()
        with engine.connect() as conn:
            n = conn.execute(text("""
                SELECT COUNT(*) FROM emails_sent
                WHERE sent_at::date = CURRENT_DATE
            """)).scalar()
            return n or 0
    except Exception as e:
        log.error(f"get_cold_emails_sent_today error: {e}")
        return 0


def is_job_already_processed(job_url: str) -> bool:
    """
    Verifica se já existe um lead associado a esta vaga (mesmo URL),
    para evitar processar / mandar proposta duas vezes para o mesmo job.
    """
    if not job_url:
        return False
    try:
        engine = get_engine()
        with engine.connect() as conn:
            n = conn.execute(
                text(
                    """
                    SELECT COUNT(*) FROM leads
                    WHERE notes = :url_exact OR notes LIKE :url_like
                    """
                ),
                {"url_exact": job_url, "url_like": f"%{job_url}%"},
            ).scalar()
            return bool(n and n > 0)
    except Exception as e:
        log.error(f"is_job_already_processed error: {e}")
        return False

def get_leads(limit=50):
    try:
        engine = get_engine()
        with engine.connect() as conn:
            result = conn.execute(text("SELECT * FROM leads ORDER BY created_at DESC LIMIT :limit"), {"limit": limit})
            return [dict(r._mapping) for r in result.fetchall()]
    except Exception as e:
        log.error(f"get_leads error: {e}")
        return []

def get_tenant_leads(user_id, limit=100):
    try:
        engine = get_engine()
        with engine.connect() as conn:
            result = conn.execute(text("""
                SELECT * FROM tenant_leads WHERE user_id = :uid
                ORDER BY created_at DESC LIMIT :limit
            """), {"uid": user_id, "limit": limit})
            return [dict(r._mapping) for r in result.fetchall()]
    except Exception as e:
        log.error(f"get_tenant_leads error: {e}")
        return []

def get_tenant_stats(user_id):
    try:
        engine = get_engine()
        with engine.connect() as conn:
            leads = conn.execute(text("SELECT COUNT(*) FROM tenant_leads WHERE user_id = :uid"), {"uid": user_id}).scalar()
            emails = conn.execute(text("SELECT COUNT(*) FROM tenant_emails WHERE user_id = :uid"), {"uid": user_id}).scalar()
            new_week = conn.execute(text("SELECT COUNT(*) FROM tenant_leads WHERE user_id = :uid AND created_at > NOW() - INTERVAL '7 days'"), {"uid": user_id}).scalar()
            return {"total_leads": leads, "emails_sent": emails, "new_this_week": new_week}
    except Exception as e:
        log.error(f"get_tenant_stats error: {e}")
        return {"total_leads": 0, "emails_sent": 0, "new_this_week": 0}

def save_lead(name, email, phone, sector, location, score, source, notes="", skill_used=""):
    try:
        engine = get_engine()
        with engine.connect() as conn:
            conn.execute(text("""
                INSERT INTO leads (name, email, phone, sector, location, score, source, notes, skill_used)
                VALUES (:name, :email, :phone, :sector, :location, :score, :source, :notes, :skill_used)
            """), {"name": name, "email": email, "phone": phone,
                  "sector": sector, "location": location,
                  "score": score, "source": source, "notes": notes, "skill_used": skill_used or None})
            conn.commit()
        return True
    except Exception as e:
        log.error(f"save_lead error: {e}")
        return False

def log_action(action, details=""):
    try:
        engine = get_engine()
        with engine.connect() as conn:
            # Garante JSON válido mesmo quando details é só uma string.
            if isinstance(details, (dict, list)):
                details_json = json.dumps(details)
            else:
                details_json = json.dumps({"message": str(details)})
            conn.execute(
                text("INSERT INTO agent_logs (action, details) VALUES (:action, :details)"),
                {"action": action, "details": details_json},
            )
            conn.commit()
    except Exception as e:
        log.error(f"log_action error: {e}")

def get_all_users_summary():
    try:
        engine = get_engine()
        with engine.connect() as conn:
            result = conn.execute(text("""
                SELECT u.id, u.email, u.name, u.plan, u.status, u.created_at,
                       COUNT(tl.id) as lead_count
                FROM users u
                LEFT JOIN tenant_leads tl ON tl.user_id = u.id
                GROUP BY u.id ORDER BY u.created_at DESC
            """))
            return [dict(r._mapping) for r in result.fetchall()]
    except Exception as e:
        log.error(f"get_all_users_summary error: {e}")
        return []
