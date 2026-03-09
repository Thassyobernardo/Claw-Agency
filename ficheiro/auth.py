import os
import hashlib
import secrets
import jwt
from datetime import datetime, timedelta
from database import get_db_connection

JWT_SECRET = os.environ.get("JWT_SECRET", "claw-agency-secret-2026")

def hash_password(password):
    salt = secrets.token_hex(16)
    hashed = hashlib.sha256(f"{salt}{password}".encode()).hexdigest()
    return f"{salt}:{hashed}"

def verify_password(password, stored):
    try:
        salt, hashed = stored.split(":")
        return hashlib.sha256(f"{salt}{password}".encode()).hexdigest() == hashed
    except:
        return False

def create_token(user_id, email):
    payload = {
        "user_id": user_id,
        "email": email,
        "exp": datetime.utcnow() + timedelta(days=30)
    }
    return jwt.encode(payload, JWT_SECRET, algorithm="HS256")

def verify_token(token):
    try:
        return jwt.decode(token, JWT_SECRET, algorithms=["HS256"])
    except:
        return None

def register_user(email, password, name, company=""):
    conn = get_db_connection()
    cur = conn.cursor()
    try:
        cur.execute("SELECT id FROM users WHERE email = %s", (email,))
        if cur.fetchone():
            return None, "Email já registado"
        
        password_hash = hash_password(password)
        cur.execute("""
            INSERT INTO users (email, password_hash, name, company, plan, status, created_at)
            VALUES (%s, %s, %s, %s, 'trial', 'active', NOW())
            RETURNING id
        """, (email, password_hash, name, company))
        user_id = cur.fetchone()[0]
        conn.commit()
        token = create_token(user_id, email)
        return token, None
    except Exception as e:
        conn.rollback()
        return None, str(e)
    finally:
        cur.close()
        conn.close()

def login_user(email, password):
    conn = get_db_connection()
    cur = conn.cursor()
    try:
        cur.execute("SELECT id, password_hash, name, plan, status FROM users WHERE email = %s", (email,))
        row = cur.fetchone()
        if not row:
            return None, "Email ou senha incorrectos"
        
        user_id, password_hash, name, plan, status = row
        if not verify_password(password, password_hash):
            return None, "Email ou senha incorrectos"
        
        if status != 'active':
            return None, "Conta suspensa. Contacta o suporte."
        
        token = create_token(user_id, email)
        return {"token": token, "user_id": user_id, "name": name, "plan": plan}, None
    except Exception as e:
        return None, str(e)
    finally:
        cur.close()
        conn.close()

def get_user_by_id(user_id):
    conn = get_db_connection()
    cur = conn.cursor()
    try:
        cur.execute("""
            SELECT id, email, name, company, plan, status, 
                   stripe_customer_id, stripe_subscription_id,
                   agent_config, created_at
            FROM users WHERE id = %s
        """, (user_id,))
        row = cur.fetchone()
        if not row:
            return None
        return {
            "id": row[0], "email": row[1], "name": row[2],
            "company": row[3], "plan": row[4], "status": row[5],
            "stripe_customer_id": row[6], "stripe_subscription_id": row[7],
            "agent_config": row[8], "created_at": str(row[9])
        }
    finally:
        cur.close()
        conn.close()
