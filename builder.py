import os
import re
import json
import logging
import zipfile
from ai_utils import (
    MODEL, get_client, call_with_retry,
    BadRequestError, APIStatusError, APIConnectionError,
)

import database as db

log = logging.getLogger(__name__)

BUILDS_DIR = os.path.abspath(os.getenv("BUILDS_DIR", "builds"))

def _safe(s) -> str:
    """Escape braces for .format() safety."""
    return str(s or "").replace("{", "{{").replace("}", "}}")

def _slug(title: str, lead_id: int) -> str:
    slug = re.sub(r"[^a-z0-9]+", "-", title.lower())[:40].strip("-")
    return f"{slug or 'project'}-{lead_id}"

def _parse_json_field(value) -> dict:
    if not value: return {}
    if isinstance(value, dict): return value
    try: return json.loads(value)
    except: return {}

def _parse_files(raw: str) -> list[dict]:
    """Extract and sanitize JSON file list from LLM response."""
    raw = raw.strip()
    if raw.startswith("```"):
        raw = re.sub(r"^```(?:json)?\s*\n?", "", raw, flags=re.MULTILINE)
        raw = re.sub(r"\n?```\s*$", "", raw, flags=re.MULTILINE)
        raw = raw.strip()
    start = raw.find("[")
    end = raw.rfind("]")
    if start == -1 or end == -1:
        raise ValueError("Could not find JSON array in LLM response")
    return json.loads(raw[start : end + 1])

BUILD_PROMPT = """You are a Principal Software Architect. Generate a premium, production-ready Python automation tool.

Client Context:
Problem: {problem_summary}
Solution: {automation_solution}
Tech Stack: {tech_hints}

Job Post Ref: {title}
{description}

Requirements:
1. ALL code must be functional, modular, and professional. NO placeholders.
2. Structure: 
   - main.py: Orchestration logic.
   - core/: Sub-modules for scraping, processing, or logic.
   - .env.example: Self-documenting config.
   - requirements.txt: Stable version pins.
   - README.md: Premium documentation (Setup, Architecture, Usage).
   - .gitignore: Standard Python exclusions.

3. Standards:
   - Robust logging to console AND 'logs/' directory.
   - Detailed docstrings (Google style).
   - Clean error handling (try/except blocks).
   - decouple logic from configuration.

Output Format:
Return ONLY a JSON array: [{{"name": "path/to/file.py", "content": "..."}}]
Use double backslashes for newlines in JSON strings.
"""

def generate_project(lead: dict, qual: dict, proposal: dict, analysis: dict) -> list[dict]:
    tech_hints = proposal.get("tech_stack") or analysis.get("tech_stack", "Python, requests, dotenv")
    
    problem_summary = qual.get("problem_summary") or lead["title"]
    solution = qual.get("automation_solution") or (lead.get("description") or "")[:500]
    
    prompt = BUILD_PROMPT.format(
        problem_summary=_safe(problem_summary),
        automation_solution=_safe(solution),
        tech_hints=_safe(tech_hints),
        title=_safe(lead["title"]),
        description=_safe((lead.get("description") or "")[:2000]),
    )

    try:
        resp = call_with_retry(lambda: get_client().chat.completions.create(
            model=MODEL,
            messages=[{"role": "user", "content": prompt}],
            temperature=0.1, # Keep it deterministic
            max_tokens=8192,
        ))
        raw = resp.choices[0].message.content.strip()
        files = _parse_files(raw)
        files = [f for f in files if f.get("name") and f.get("content")]
        log.info("LLM generated %d premium files for lead %d", len(files), lead["id"])
        return files
    except Exception as e:
        log.error(f"Project generation failed: {e}")
        raise

def build_lead(lead_id: int) -> str:
    lead = db.get_lead(lead_id)
    if not lead: raise ValueError(f"Lead {lead_id} not found")

    qual = _parse_json_field(lead.get("qualification"))
    proposal = _parse_json_field(lead.get("proposal"))
    analysis = _parse_json_field(lead.get("analysis"))

    files = generate_project(lead, qual, proposal, analysis)
    if not files: raise RuntimeError("LLM returned no files")

    os.makedirs(BUILDS_DIR, exist_ok=True)
    slug = _slug(lead["title"], lead_id)
    zip_path = os.path.join(BUILDS_DIR, f"{slug}.zip")

    with zipfile.ZipFile(zip_path, "w", zipfile.ZIP_DEFLATED) as zf:
        for f in files:
            zf.writestr(f"{slug}/{f['name'].lstrip('/')}", f["content"])
            
        # START_HERE.bat for UX (Premium Pattern)
        bat = (
            "@echo off\ncls\necho =========================================\n"
            "echo           Claw Agency Tool Runner         \n"
            "echo =========================================\n\n"
            "python --version >nul 2>&1\n"
            "if %errorlevel% neq 0 (echo Error: Python not found! && pause && exit /b)\n"
            "echo [1/2] Installing requirements...\n"
            "pip install -q -r requirements.txt\n"
            "echo [2/2] Launching automation...\n"
            "python main.py\n"
            "echo.\necho Execution complete.\npause\n"
        )
        zf.writestr(f"{slug}/START_HERE.bat", bat)

    db.save_deliverable_path(lead_id, zip_path)
    db.update_status(lead_id, "built")
    return zip_path
