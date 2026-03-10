---
name: openclaw-security-shield
description: "Security & protection hardening for OpenClaw instances. Use when you need to secure your OpenClaw deployment against prompt injection, data leakage, API abuse, and unauthorized access."
---

# OpenClaw Security Shield 🔒

## When to invoke
- Before deploying OpenClaw to production
- When adding new agents or tools
- When handling sensitive client data

## 1. Prompt Injection Defense
```python
def sanitize_input(text: str) -> str:
    patterns = ["ignore previous instructions","ignore all instructions",
                "disregard your","you are now","act as","jailbreak","DAN mode"]
    for p in patterns:
        if p in text.lower():
            return "[Blocked: injection attempt detected]"
    return text[:2000]
```

## 2. Rate Limiting (Flask)
```python
from functools import wraps
from collections import defaultdict
import time

_counts = defaultdict(list)

def rate_limit(max_req=20, window=60):
    def decorator(f):
        @wraps(f)
        def wrapped(*args, **kwargs):
            ip = request.remote_addr
            now = time.time()
            _counts[ip] = [t for t in _counts[ip] if now-t < window]
            if len(_counts[ip]) >= max_req:
                return jsonify({"error": "Rate limit exceeded"}), 429
            _counts[ip].append(now)
            return f(*args, **kwargs)
        return wrapped
    return decorator
```

## 3. JWT Hardening
```python
import jwt, os
from datetime import datetime, timedelta

SECRET = os.environ.get("JWT_SECRET")  # Min 32 chars!

def create_token(user_id):
    return jwt.encode({"sub": user_id, "exp": datetime.utcnow()+timedelta(hours=24)}, SECRET, algorithm="HS256")

def verify_token(token):
    try:
        return jwt.decode(token, SECRET, algorithms=["HS256"])
    except jwt.ExpiredSignatureError:
        raise ValueError("Token expired")
    except jwt.InvalidTokenError:
        raise ValueError("Invalid token")
```

## 4. Secrets Management
```bash
# NEVER hardcode. Always:
import os
GROQ_API_KEY = os.environ.get("GROQ_API_KEY")

# Scan for exposed secrets:
grep -r "sk_\|api_key\s*=" . --include="*.py" | grep -v "environ\|#"
```

## 5. CORS Whitelist
```python
from flask_cors import CORS
CORS(app, origins=["https://yourdomain.com"], methods=["GET","POST"])
```

## 6. SQL Injection Prevention
```python
# Always parameterized queries - NEVER f-strings in SQL
user = db.session.execute(
    text("SELECT * FROM users WHERE email = :email"),
    {"email": email}
).fetchone()
```

## Production Checklist
- [ ] JWT_SECRET min 32 chars random
- [ ] All API keys in environment variables
- [ ] FLASK_ENV=production (disables debug)
- [ ] CORS whitelist configured
- [ ] Rate limiting on all public endpoints
- [ ] Input sanitization on agent prompts
