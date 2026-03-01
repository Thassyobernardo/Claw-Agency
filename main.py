"""
CLAW SALES AGENT
Railway deployment — runs 24/7
Sells the AI Mastery Course ($47) automatically via:
  - Dev.to article posting (organic traffic)
  - Lead capture + email nurture sequence (Resend)
  - Gumroad checkout link
"""

import os, json, sqlite3, threading, time, schedule, random
from datetime import datetime, timedelta
from flask import Flask, request, jsonify, render_template_string
import requests

app = Flask(__name__)

# ─── CONFIG ───────────────────────────────────────────────────────────────────
GROQ_API_KEY   = os.environ.get("GROQ_API_KEY", "")
DEVTO_API_KEY  = os.environ.get("DEVTO_API_KEY", "")
RESEND_API_KEY = os.environ.get("RESEND_API_KEY", "")
EMAIL_FROM     = os.environ.get("EMAIL_FROM", "noreply@clawagency.com")
EMAIL_DESTINO  = os.environ.get("EMAIL_DESTINO", "")
GUMROAD_LINK   = os.environ.get("GUMROAD_LINK", "https://gumroad.com/l/ai-mastery-course")
COURSE_PRICE   = "$47"
DB_PATH        = "/tmp/claw.db"

# ─── DATABASE ─────────────────────────────────────────────────────────────────
def init_db():
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    c.execute("""CREATE TABLE IF NOT EXISTS leads (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        email TEXT UNIQUE,
        name TEXT,
        source TEXT,
        created_at TEXT,
        email_step INTEGER DEFAULT 0,
        last_email_at TEXT
    )""")
    c.execute("""CREATE TABLE IF NOT EXISTS articles (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT,
        devto_id TEXT,
        posted_at TEXT,
        views INTEGER DEFAULT 0
    )""")
    c.execute("""CREATE TABLE IF NOT EXISTS events (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        event TEXT,
        details TEXT,
        created_at TEXT
    )""")
    conn.commit()
    conn.close()

def log_event(event, details=""):
    conn = sqlite3.connect(DB_PATH)
    conn.execute("INSERT INTO events (event, details, created_at) VALUES (?,?,?)",
                 (event, details, datetime.now().isoformat()))
    conn.commit()
    conn.close()

# ─── GROQ LLM ─────────────────────────────────────────────────────────────────
def groq(system, user, max_tokens=2000):
    try:
        r = requests.post("https://api.groq.com/openai/v1/chat/completions",
            headers={"Authorization": f"Bearer {GROQ_API_KEY}", "Content-Type": "application/json"},
            json={"model": "llama-3.3-70b-versatile", "max_tokens": max_tokens,
                  "messages": [{"role": "system", "content": system},
                                {"role": "user", "content": user}]},
            timeout=30)
        return r.json()["choices"][0]["message"]["content"]
    except Exception as e:
        log_event("groq_error", str(e))
        return None

# ─── RESEND EMAIL ──────────────────────────────────────────────────────────────
def send_email(to_email, subject, html_body):
    try:
        r = requests.post("https://api.resend.com/emails",
            headers={"Authorization": f"Bearer {RESEND_API_KEY}", "Content-Type": "application/json"},
            json={"from": EMAIL_FROM, "to": [to_email],
                  "subject": subject, "html": html_body},
            timeout=15)
        ok = r.status_code == 200
        log_event("email_sent" if ok else "email_error", f"{to_email} | {subject}")
        return ok
    except Exception as e:
        log_event("email_error", str(e))
        return False

# ─── EMAIL SEQUENCES ──────────────────────────────────────────────────────────
EMAIL_SEQUENCE = [
    {
        "delay_hours": 0,
        "subject": "Your free AI income guide is here 🎯",
        "template": "welcome"
    },
    {
        "delay_hours": 24,
        "subject": "The prompt that made me $800 last month",
        "template": "value1"
    },
    {
        "delay_hours": 72,
        "subject": "How to go from 0 → $47/day with AI (step by step)",
        "template": "value2"
    },
    {
        "delay_hours": 120,
        "subject": "Last chance: AI Mastery Course at launch price",
        "template": "offer"
    },
]

def build_email_html(template, name, gumroad_link):
    base = f"""
    <div style="font-family:sans-serif;max-width:600px;margin:0 auto;background:#0a0a0f;color:#e0e0e0;padding:40px;border-radius:12px">
      <div style="color:#f0c060;font-weight:bold;font-size:18px;margin-bottom:24px">⚡ CLAW</div>
      {{CONTENT}}
      <div style="margin-top:40px;padding-top:20px;border-top:1px solid #222;font-size:12px;color:#666">
        You received this because you signed up for free AI income tips.<br>
        <a href="{{UNSUB}}" style="color:#444">Unsubscribe</a>
      </div>
    </div>"""

    contents = {
        "welcome": f"""
            <h2 style="color:#f0c060">Hey {name}, welcome 👋</h2>
            <p>You just made a smart move. Most people dabble with AI. You're about to use it to build real income.</p>
            <p>Over the next few days I'll send you:</p>
            <ul>
              <li>The exact prompts that generate $500-2,000/month</li>
              <li>A 45-minute content system used by 6-figure creators</li>
              <li>How to build automation clients who pay $2,000+/month</li>
            </ul>
            <p>Start here: <a href="{gumroad_link}" style="color:#f0c060">peek at the full AI Mastery Course →</a></p>
            <p style="color:#888">— Claw Agency</p>""",

        "value1": f"""
            <h2 style="color:#f0c060">The prompt that made $800 last month</h2>
            <p>Hey {name},</p>
            <p>Here's a real prompt I use to generate LinkedIn posts for clients at $300/month per account:</p>
            <div style="background:#111;border-left:3px solid #f0c060;padding:16px;margin:20px 0;font-family:monospace;font-size:13px;color:#ccc">
              You are a [NICHE] thought leader. Write a contrarian LinkedIn post about [TOPIC] that:<br>
              - Starts with a bold claim most people disagree with<br>
              - Uses 3 short paragraphs max<br>
              - Ends with one question that sparks debate<br>
              Tone: direct, confident, no fluff. No hashtags.
            </div>
            <p>That's 1 of 150+ prompts in the AI Mastery Course. Each lesson shows you exactly how to turn prompts like this into monthly income.</p>
            <p><a href="{gumroad_link}" style="background:#f0c060;color:#000;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:bold;display:inline-block;margin-top:12px">Get the full course — {COURSE_PRICE} →</a></p>
            <p style="color:#888">— Claw Agency</p>""",

        "value2": f"""
            <h2 style="color:#50d8c8">0 → $47/day roadmap</h2>
            <p>Hey {name},</p>
            <p>Here's the simplest path I know:</p>
            <p><strong style="color:#f0c060">Week 1:</strong> Build a prompt library (Notion, free). Catalog everything you test.</p>
            <p><strong style="color:#f0c060">Week 2:</strong> Package 15 prompts into a Gumroad product. Price: $19. Send to 50 people on Reddit/LinkedIn.</p>
            <p><strong style="color:#f0c060">Week 3:</strong> Offer to manage content for 1 local business. Charge $300/month. Use your prompts to deliver in 2 hours/week.</p>
            <p><strong style="color:#f0c060">Month 2:</strong> Scale to 3 clients + passive Gumroad sales. That's your $47/day.</p>
            <p>The AI Mastery Course walks through every step with real prompts, real scripts, and real income targets.</p>
            <p><a href="{gumroad_link}" style="background:#50d8c8;color:#000;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:bold;display:inline-block;margin-top:12px">Start the course — {COURSE_PRICE} →</a></p>
            <p style="color:#888">— Claw Agency</p>""",

        "offer": f"""
            <h2 style="color:#f880b0">Last chance at launch price</h2>
            <p>Hey {name},</p>
            <p>Quick one: the AI Mastery Course is at {COURSE_PRICE} right now as a launch price. When I add the live Q&A sessions and community access next month, it goes to $97.</p>
            <p>What you get today:</p>
            <ul>
              <li>✅ 15 lessons with copy-paste prompts and real income targets</li>
              <li>✅ Python automation scripts (copy-paste ready)</li>
              <li>✅ Make.com + n8n workflow templates</li>
              <li>✅ 30-day income roadmap (Month 1: $800-2,000)</li>
            </ul>
            <p><a href="{gumroad_link}" style="background:#f880b0;color:#000;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:bold;display:inline-block;margin-top:12px">Get AI Mastery Course — {COURSE_PRICE} →</a></p>
            <p style="color:#666;font-size:13px">If you've already bought — thank you! Ignore this.</p>
            <p style="color:#888">— Claw Agency</p>""",
    }

    content = contents.get(template, contents["welcome"])
    return base.replace("{CONTENT}", content).replace("{UNSUB}", "#")

# ─── DEV.TO ARTICLE TOPICS ────────────────────────────────────────────────────
ARTICLE_TOPICS = [
    "5 ChatGPT prompts that generate real income in 2026",
    "How I built a $2,000/month automation service with Make.com and AI",
    "The 45-minute content system that replaces a full-time writer",
    "From zero to first client: the exact AI freelance playbook",
    "Why most people fail with AI tools (and how to actually profit)",
    "The prompt library system that compounds income over time",
    "How to charge $800/month for AI automation clients (step by step)",
    "n8n vs Make.com: which one makes you more money as a freelancer",
    "Cold outreach that actually works for selling AI services in 2026",
    "The 30-day roadmap from AI hobbyist to $4,000/month",
]

def generate_devto_article(topic):
    system = """You are an expert content creator writing for Dev.to.
    Write practical, honest articles about making money with AI tools.
    Style: direct, no fluff, real examples, actionable steps.
    Always include code snippets or prompt examples when relevant."""

    user = f"""Write a complete Dev.to article about: "{topic}"

    Format:
    - Title (the topic, punchy)
    - Introduction (2 paragraphs, hook immediately)
    - 4-5 sections with ## headers
    - Real examples, actual numbers, copy-paste prompts or code
    - Conclusion with a clear next step
    - Tags: 4 tags relevant to AI, productivity, career

    At the end include a natural CTA paragraph mentioning the AI Mastery Course
    (15 lessons, $47, link: {GUMROAD_LINK}) as something the author built.

    Return as JSON: {{"title": "...", "body": "...", "tags": ["tag1","tag2","tag3","tag4"]}}"""

    result = groq(system, user, max_tokens=3000)
    if not result:
        return None
    try:
        # Strip markdown code fences if present
        clean = result.strip()
        if clean.startswith("```"):
            clean = clean.split("```")[1]
            if clean.startswith("json"):
                clean = clean[4:]
        return json.loads(clean.strip())
    except:
        return None

def post_to_devto(article_data):
    try:
        r = requests.post("https://dev.to/api/articles",
            headers={"api-key": DEVTO_API_KEY, "Content-Type": "application/json"},
            json={"article": {
                "title": article_data["title"],
                "body_markdown": article_data["body"],
                "published": True,
                "tags": article_data.get("tags", ["ai", "productivity"]),
            }},
            timeout=20)
        if r.status_code in [200, 201]:
            data = r.json()
            conn = sqlite3.connect(DB_PATH)
            conn.execute("INSERT INTO articles (title, devto_id, posted_at) VALUES (?,?,?)",
                         (article_data["title"], str(data.get("id","")), datetime.now().isoformat()))
            conn.commit()
            conn.close()
            log_event("article_posted", article_data["title"])
            return True
        log_event("devto_error", f"{r.status_code}: {r.text[:200]}")
        return False
    except Exception as e:
        log_event("devto_error", str(e))
        return False

def run_article_poster():
    """Pick a random unused topic and post it."""
    conn = sqlite3.connect(DB_PATH)
    posted = [r[0] for r in conn.execute("SELECT title FROM articles").fetchall()]
    conn.close()
    unused = [t for t in ARTICLE_TOPICS if t not in posted]
    if not unused:
        log_event("article_poster", "All topics used — cycle reset")
        conn = sqlite3.connect(DB_PATH)
        conn.execute("DELETE FROM articles")
        conn.commit()
        conn.close()
        unused = ARTICLE_TOPICS[:]
    topic = random.choice(unused)
    log_event("article_generating", topic)
    article = generate_devto_article(topic)
    if article:
        post_to_devto(article)

# ─── EMAIL SEQUENCE RUNNER ────────────────────────────────────────────────────
def run_email_sequences():
    """Check leads and send next email in sequence if due."""
    conn = sqlite3.connect(DB_PATH)
    leads = conn.execute(
        "SELECT id, email, name, email_step, last_email_at, created_at FROM leads WHERE email_step < ?",
        (len(EMAIL_SEQUENCE),)
    ).fetchall()
    conn.close()

    for lead_id, email, name, step, last_at, created_at in leads:
        seq = EMAIL_SEQUENCE[step]
        # Check if enough time has passed
        ref_time = datetime.fromisoformat(last_at) if last_at else datetime.fromisoformat(created_at)
        due_at = ref_time + timedelta(hours=seq["delay_hours"])
        if datetime.now() >= due_at:
            html = build_email_html(seq["template"], name or "friend", GUMROAD_LINK)
            ok = send_email(email, seq["subject"], html)
            if ok:
                conn = sqlite3.connect(DB_PATH)
                conn.execute(
                    "UPDATE leads SET email_step=?, last_email_at=? WHERE id=?",
                    (step + 1, datetime.now().isoformat(), lead_id)
                )
                conn.commit()
                conn.close()

# ─── LANDING PAGE ─────────────────────────────────────────────────────────────
LANDING_HTML = """<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>AI Mastery Course — Make $4,000/month with AI</title>
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{background:#0a0a0f;color:#e0e0e0;font-family:'DM Sans',sans-serif;line-height:1.6}
@import url('https://fonts.googleapis.com/css2?family=Syne:wght@700;800&family=DM+Sans:wght@300;400;500&display=swap');
.hero{padding:80px 24px 60px;text-align:center;max-width:780px;margin:0 auto}
.badge{display:inline-block;background:#1a1a2e;color:#f0c060;border:1px solid #f0c060;padding:6px 16px;border-radius:99px;font-size:13px;margin-bottom:24px}
h1{font-family:'Syne',sans-serif;font-size:clamp(2rem,5vw,3.5rem);line-height:1.1;margin-bottom:20px}
h1 span{color:#f0c060}
.sub{font-size:1.1rem;color:#999;max-width:560px;margin:0 auto 40px}
.price-box{display:inline-flex;align-items:center;gap:16px;background:#111;border:1px solid #222;padding:16px 24px;border-radius:12px;margin-bottom:32px}
.price{font-family:'Syne',sans-serif;font-size:2.5rem;color:#f0c060;font-weight:800}
.price-note{font-size:13px;color:#666;text-align:left}
.price-note s{color:#444}
.cta-btn{display:inline-block;background:#f0c060;color:#000;font-weight:700;font-size:1.1rem;padding:16px 40px;border-radius:8px;text-decoration:none;margin-bottom:12px;transition:opacity .2s}
.cta-btn:hover{opacity:.85}
.cta-sub{font-size:13px;color:#666}
.features{padding:60px 24px;max-width:900px;margin:0 auto}
.features h2{font-family:'Syne',sans-serif;font-size:1.8rem;margin-bottom:40px;text-align:center}
.feat-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:20px}
.feat{background:#111;border:1px solid #1e1e1e;border-radius:12px;padding:24px}
.feat-icon{font-size:1.5rem;margin-bottom:12px}
.feat-title{font-weight:600;margin-bottom:8px;color:#fff}
.feat-text{font-size:14px;color:#888}
.income{background:linear-gradient(135deg,#111 0%,#0d1117 100%);border:1px solid #f0c060;border-radius:16px;padding:40px;margin:60px auto;max-width:700px;text-align:center}
.income h2{font-family:'Syne',sans-serif;color:#f0c060;margin-bottom:20px}
.inc-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:16px;margin-top:24px}
.inc-item{background:#0a0a0f;border-radius:8px;padding:16px}
.inc-num{font-family:'Syne',sans-serif;font-size:1.4rem;color:#f0c060;font-weight:800}
.inc-label{font-size:12px;color:#666;margin-top:4px}
.lessons{padding:60px 24px;max-width:900px;margin:0 auto}
.lessons h2{font-family:'Syne',sans-serif;font-size:1.8rem;margin-bottom:12px;text-align:center}
.lessons p{text-align:center;color:#888;margin-bottom:32px}
.lesson-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:12px}
.lesson{background:#111;border:1px solid #1e1e1e;border-radius:8px;padding:16px;display:flex;align-items:center;gap:12px}
.lesson-num{width:32px;height:32px;border-radius:6px;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:700;flex-shrink:0}
.b1{background:#2a1f00;color:#f0c060}
.b2{background:#001f1e;color:#50d8c8}
.b3{background:#1f0010;color:#f880b0}
.lesson-title{font-size:14px;color:#ccc}
.capture{padding:60px 24px;max-width:560px;margin:0 auto;text-align:center}
.capture h2{font-family:'Syne',sans-serif;font-size:1.8rem;margin-bottom:12px}
.capture p{color:#888;margin-bottom:28px}
.form-row{display:flex;gap:12px;flex-wrap:wrap}
input{flex:1;min-width:180px;background:#111;border:1px solid #222;color:#fff;padding:14px 16px;border-radius:8px;font-size:15px;outline:none}
input:focus{border-color:#f0c060}
.sub-btn{background:#f0c060;color:#000;font-weight:700;border:none;padding:14px 28px;border-radius:8px;cursor:pointer;font-size:15px;white-space:nowrap}
.sub-btn:hover{opacity:.85}
.form-note{font-size:12px;color:#555;margin-top:12px}
#msg{margin-top:16px;padding:12px;border-radius:8px;display:none}
#msg.ok{background:#0d2b0d;color:#4caf50;display:block}
#msg.err{background:#2b0d0d;color:#f44336;display:block}
footer{padding:40px 24px;text-align:center;color:#444;font-size:13px;border-top:1px solid #111}
</style>
</head>
<body>

<div class="hero">
  <div class="badge">⚡ 15-Lesson Course — Launch Price</div>
  <h1>Turn AI Into a<br><span>$4,000/Month Business</span></h1>
  <p class="sub">Prompt engineering, AI content systems, and automation clients — the complete playbook for 2026.</p>
  <div class="price-box">
    <div class="price">$47</div>
    <div class="price-note">Launch price<br><s>$97 regular</s></div>
  </div>
  <br>
  <a href="{{ gumroad_link }}" class="cta-btn">Get Instant Access →</a>
  <div class="cta-sub">Instant access · 15 lessons · Copy-paste prompts & code</div>
</div>

<div class="income">
  <h2>Real Income Targets Per Module</h2>
  <p style="color:#888;font-size:14px">Based on what students at each level realistically achieve</p>
  <div class="inc-grid">
    <div class="inc-item"><div class="inc-num">$800</div><div class="inc-label">Prompt Library<br>Month 1</div></div>
    <div class="inc-item"><div class="inc-num">$1,500</div><div class="inc-label">Digital Products<br>Month 2</div></div>
    <div class="inc-item"><div class="inc-num">$3,000</div><div class="inc-label">Content Clients<br>Month 3</div></div>
    <div class="inc-item"><div class="inc-num">$4,000+</div><div class="inc-label">Automation Agency<br>Month 4-6</div></div>
  </div>
</div>

<div class="features">
  <h2>What's Inside</h2>
  <div class="feat-grid">
    <div class="feat"><div class="feat-icon">🎯</div><div class="feat-title">CRAFT Prompt Framework</div><div class="feat-text">The exact 5-part structure that makes prompts sellable. Includes 150+ copy-paste prompts across 10 niches.</div></div>
    <div class="feat"><div class="feat-icon">⚡</div><div class="feat-title">45-Min Content System</div><div class="feat-text">One workflow that replaces a full-time content team. Used by freelancers charging $3,000/month per client.</div></div>
    <div class="feat"><div class="feat-icon">🤖</div><div class="feat-title">Python Bots (Real Code)</div><div class="feat-text">Copy-paste automation scripts. Lead research bot, news digest service, Railway deployment guide included.</div></div>
    <div class="feat"><div class="feat-icon">🔄</div><div class="feat-title">Make.com Workflows</div><div class="feat-text">3 complete automation blueprints: AI lead response, weekly reports, Google review auto-reply.</div></div>
    <div class="feat"><div class="feat-icon">📈</div><div class="feat-title">Agency Launch Playbook</div><div class="feat-text">3 service packages, 30-day launch plan, discovery call script, and month-by-month income targets.</div></div>
    <div class="feat"><div class="feat-icon">💰</div><div class="feat-title">Income Built In</div><div class="feat-text">Every lesson ends with a concrete income target. No vague advice — specific numbers for specific actions.</div></div>
  </div>
</div>

<div class="lessons">
  <h2>All 15 Lessons</h2>
  <p>Three complete learning blocks — from first prompt to first agency client</p>
  <div class="lesson-grid">
    <div class="lesson"><div class="lesson-num b1">01</div><div class="lesson-title">What AI Really Is</div></div>
    <div class="lesson"><div class="lesson-num b1">02</div><div class="lesson-title">Master Prompt Structure</div></div>
    <div class="lesson"><div class="lesson-num b1">03</div><div class="lesson-title">Prompt Optimization</div></div>
    <div class="lesson"><div class="lesson-num b1">04</div><div class="lesson-title">Style Cloning & Few-Shot</div></div>
    <div class="lesson"><div class="lesson-num b1">05</div><div class="lesson-title">Build Your Prompt Library</div></div>
    <div class="lesson"><div class="lesson-num b2">06</div><div class="lesson-title">Your First Digital Product</div></div>
    <div class="lesson"><div class="lesson-num b2">07</div><div class="lesson-title">Getting Your First Buyers</div></div>
    <div class="lesson"><div class="lesson-num b2">08</div><div class="lesson-title">45-Minute Content System</div></div>
    <div class="lesson"><div class="lesson-num b2">09</div><div class="lesson-title">Content Multiplication</div></div>
    <div class="lesson"><div class="lesson-num b2">10</div><div class="lesson-title">Persuasive Writing & Sales Copy</div></div>
    <div class="lesson"><div class="lesson-num b3">11</div><div class="lesson-title">Automation Thinking</div></div>
    <div class="lesson"><div class="lesson-num b3">12</div><div class="lesson-title">Make.com Masterclass</div></div>
    <div class="lesson"><div class="lesson-num b3">13</div><div class="lesson-title">Python Bots — Real Code</div></div>
    <div class="lesson"><div class="lesson-num b3">14</div><div class="lesson-title">AI Agents with n8n</div></div>
    <div class="lesson"><div class="lesson-num b3">15</div><div class="lesson-title">Launch Your Agency</div></div>
  </div>
</div>

<div class="capture">
  <h2>Get 3 Free Lessons First</h2>
  <p>Enter your email and I'll send you Lessons 1, 2 and 5 free — including the full CRAFT framework and prompt library setup.</p>
  <div class="form-row">
    <input type="text" id="fname" placeholder="First name">
    <input type="email" id="femail" placeholder="Email address">
    <button class="sub-btn" onclick="subscribe()">Send Free Lessons</button>
  </div>
  <div class="form-note">No spam. Unsubscribe anytime.</div>
  <div id="msg"></div>
</div>

<footer>
  © 2026 Claw Agency · <a href="{{ gumroad_link }}" style="color:#f0c060">Get the Course</a>
</footer>

<script>
async function subscribe() {
  const name = document.getElementById('fname').value.trim();
  const email = document.getElementById('femail').value.trim();
  const msg = document.getElementById('msg');
  if (!email || !email.includes('@')) {
    msg.className = 'err'; msg.textContent = 'Please enter a valid email.'; return;
  }
  const btn = document.querySelector('.sub-btn');
  btn.textContent = 'Sending...'; btn.disabled = true;
  try {
    const r = await fetch('/subscribe', {
      method: 'POST',
      headers: {'Content-Type':'application/json'},
      body: JSON.stringify({name, email, source: 'landing'})
    });
    const d = await r.json();
    if (d.ok) {
      msg.className = 'ok';
      msg.textContent = '✓ Check your inbox! Free lessons on the way.';
    } else {
      msg.className = 'err';
      msg.textContent = d.error || 'Something went wrong.';
    }
  } catch(e) {
    msg.className = 'err'; msg.textContent = 'Network error. Try again.';
  }
  btn.textContent = 'Send Free Lessons'; btn.disabled = false;
}
</script>
</body>
</html>"""

# ─── ROUTES ───────────────────────────────────────────────────────────────────
@app.route("/")
def index():
    return render_template_string(LANDING_HTML, gumroad_link=GUMROAD_LINK)

@app.route("/subscribe", methods=["POST"])
def subscribe():
    data = request.get_json()
    email = (data.get("email") or "").strip().lower()
    name  = (data.get("name")  or "friend").strip()
    source = data.get("source", "landing")
    if not email or "@" not in email:
        return jsonify({"ok": False, "error": "Invalid email"})
    try:
        conn = sqlite3.connect(DB_PATH)
        conn.execute(
            "INSERT INTO leads (email, name, source, created_at, email_step) VALUES (?,?,?,?,0)",
            (email, name, source, datetime.now().isoformat())
        )
        conn.commit()
        conn.close()
        log_event("lead_captured", f"{email} via {source}")
        # Send welcome email immediately
        html = build_email_html("welcome", name, GUMROAD_LINK)
        send_email(email, EMAIL_SEQUENCE[0]["subject"], html)
        conn = sqlite3.connect(DB_PATH)
        conn.execute("UPDATE leads SET email_step=1, last_email_at=? WHERE email=?",
                     (datetime.now().isoformat(), email))
        conn.commit()
        conn.close()
        return jsonify({"ok": True})
    except sqlite3.IntegrityError:
        return jsonify({"ok": True})  # already subscribed, silently ok
    except Exception as e:
        return jsonify({"ok": False, "error": str(e)})

@app.route("/admin")
def admin():
    try:
        init_db()
        conn = sqlite3.connect(DB_PATH)
        leads = conn.execute("SELECT email, name, source, created_at, email_step FROM leads ORDER BY created_at DESC LIMIT 50").fetchall()
        articles = conn.execute("SELECT title, posted_at FROM articles ORDER BY posted_at DESC").fetchall()
        events = conn.execute("SELECT event, details, created_at FROM events ORDER BY created_at DESC LIMIT 30").fetchall()
        conn.close()
        n_seq = len(EMAIL_SEQUENCE)
        leads_rows = "".join(f"<tr><td>{l[0]}</td><td>{l[1]}</td><td>{l[2]}</td><td>{str(l[3])[:16]}</td><td>{l[4]}/{n_seq}</td></tr>" for l in leads) or "<tr><td colspan=5 style=color:#555>No leads yet</td></tr>"
        articles_rows = "".join(f"<tr><td>{a[0]}</td><td>{str(a[1])[:16]}</td></tr>" for a in articles) or "<tr><td colspan=2 style=color:#555>No articles yet</td></tr>"
        events_rows = "".join(f"<tr><td>{e[0]}</td><td>{str(e[1])[:60]}</td><td>{str(e[2])[:16]}</td></tr>" for e in events) or "<tr><td colspan=3 style=color:#555>No events yet</td></tr>"
        html = (
            "<!DOCTYPE html><html><head><title>Claw Admin</title>"
            "<meta http-equiv=refresh content=30>"
            "<style>body{background:#0a0a0f;color:#e0e0e0;font-family:monospace;padding:24px}"
            "h2{color:#f0c060;margin:24px 0 12px}table{width:100%;border-collapse:collapse;font-size:13px}"
            "td,th{border:1px solid #222;padding:8px 12px;text-align:left}th{background:#111;color:#f0c060}"
            "tr:hover td{background:#111}.btn{background:#f0c060;color:#000;padding:8px 16px;border:none;border-radius:6px;cursor:pointer;font-weight:bold;text-decoration:none;display:inline-block;margin:4px}"
            "</style></head><body>"
            "<h1 style=color:#f0c060>⚡ Claw Admin</h1>"
            f"<p style=color:#666>Leads: {len(leads)} | Articles: {len(articles)} | Auto-refresh: 30s</p>"
            "<a href=/trigger/article class=btn>▶ Post Article Now</a> "
            "<a href=/trigger/emails class=btn style=background:#50d8c8>▶ Run Email Sequences</a>"
            "<h2>Recent Leads</h2><table><tr><th>Email</th><th>Name</th><th>Source</th><th>Date</th><th>Step</th></tr>"
            + leads_rows +
            "</table><h2>Articles Posted</h2><table><tr><th>Title</th><th>Posted</th></tr>"
            + articles_rows +
            "</table><h2>Event Log</h2><table><tr><th>Event</th><th>Details</th><th>Time</th></tr>"
            + events_rows +
            "</table></body></html>"
        )
        return html
    except Exception as e:
        return f"<pre style='background:#0a0a0f;color:#f44336;padding:24px'>Admin error: {str(e)}</pre>", 500

@app.route("/health")
def health():
    return jsonify({"status": "ok", "agent": "claw", "time": datetime.now().isoformat()})

@app.route("/trigger/article")
def trigger_article():
    """Manual trigger for posting an article — for testing"""
    threading.Thread(target=run_article_poster).start()
    return jsonify({"ok": True, "msg": "Article generation started"})

@app.route("/trigger/emails")
def trigger_emails():
    """Manual trigger for email sequence"""
    threading.Thread(target=run_email_sequences).start()
    return jsonify({"ok": True, "msg": "Email sequences checked"})

# ─── SCHEDULER ────────────────────────────────────────────────────────────────
def run_scheduler():
    # Post article twice a day
    schedule.every().day.at("09:00").do(run_article_poster)
    schedule.every().day.at("17:00").do(run_article_poster)
    # Check email sequences every 2 hours
    schedule.every(2).hours.do(run_email_sequences)
    while True:
        schedule.run_pending()
        time.sleep(60)

# ─── MAIN ─────────────────────────────────────────────────────────────────────
if __name__ == "__main__":
    init_db()
    log_event("agent_started", "Claw Sales Agent online")
    # Start scheduler in background thread
    t = threading.Thread(target=run_scheduler, daemon=True)
    t.start()
    port = int(os.environ.get("PORT", 3000))
    app.run(host="0.0.0.0", port=port)
