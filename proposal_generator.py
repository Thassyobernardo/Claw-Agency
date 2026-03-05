import json
import logging
from ai_utils import (
    MODEL, get_client, call_with_retry,
    BadRequestError, APIStatusError, APIConnectionError,
)
import time

log = logging.getLogger(__name__)

ANALYSIS_PROMPT = """Analyze this client lead with senior consultant precision.
Source: {source}
Title: {title}
Description: {description}

Identify hidden requirements, budget signals, and specific technical obstacles.
Respond with ONLY a valid JSON object:
{{
  "pain_points": ["explicit and implicit pains"],
  "tech_stack": ["detected tech requirements"],
  "urgency": "low|medium|high",
  "budget_signal": "unknown|low|medium|high",
  "ideal_approach": "concise technical solution summary",
  "complexity_score": 1-10
}}"""

PROPOSAL_PROMPT = """Write a high-converting freelancing proposal using the PAS (Problem-Agitation-Solution) framework.
Context:
Source: {source}
Title: {title}
Description: {description}
Analysis: {analysis}

Respond with ONLY this JSON:
{{
  "hook": "1 sentence showing you've READ their specific problem",
  "pas_agitation": "1-2 sentences highlighting the cost of NOT fixing the problem",
  "pas_solution": "2 sentences on how your approach solves it specifically",
  "tech_stack": "comma-separated tech",
  "call_to_action": "An open, low-friction question"
}}

Tone: Bold, Human, Direct. No fluff."""

def analyze_lead(source: str, title: str, description: str) -> dict:
    try:
        resp = call_with_retry(lambda: get_client().chat.completions.create(
            model=MODEL,
            messages=[{
                "role": "user",
                "content": ANALYSIS_PROMPT.format(
                    source=source,
                    title=title,
                    description=description[:3000],
                ),
            }],
            temperature=0.3,
            max_tokens=2000,
        ))
        content = resp.choices[0].message.content
        if not content:
            return {}
        try:
            return json.loads(content.strip())
        except json.JSONDecodeError as e:
            log.error("analyze_lead: truncated/non-JSON response: %s", e)
            return {}
    except BadRequestError as e:
        log.error("LLM 400 — status=%s message=%r", e.status_code, e.message)
        return {"error": f"LLM 400: {e.message}"}
    except APIStatusError as e:
        log.error("LLM API error — status=%s message=%r", e.status_code, e.message)
        return {"error": f"LLM {e.status_code}: {e.message}"}
    except APIConnectionError as e:
        log.error("LLM connection error: %s", e)
        return {"error": f"LLM connection error: {e}"}
    except Exception as e:
        log.error("Unexpected error in analyze_lead: %s", e, exc_info=True)
        return {"error": str(e)}

def generate_proposal(source: str, title: str, description: str,
                      analysis: dict) -> dict:
    try:
        resp = call_with_retry(lambda: get_client().chat.completions.create(
            model=MODEL,
            messages=[{
                "role": "user",
                "content": PROPOSAL_PROMPT.format(
                    source=source,
                    title=title,
                    description=description[:3000],
                    analysis=json.dumps(analysis, indent=2),
                ),
            }],
            temperature=0.7,
            max_tokens=1024,
        ))
        content = resp.choices[0].message.content
        if not content:
            return {}
        try:
            return json.loads(content.strip())
        except json.JSONDecodeError as e:
            log.error("generate_proposal: truncated/non-JSON response: %s", e)
            return {}
    except BadRequestError as e:
        log.error("LLM 400 — status=%s message=%r", e.status_code, e.message)
        return {"error": f"LLM 400: {e.message}"}
    except APIStatusError as e:
        log.error("LLM API error — status=%s message=%r", e.status_code, e.message)
        return {"error": f"LLM {e.status_code}: {e.message}"}
    except APIConnectionError as e:
        log.error("LLM connection error: %s", e)
        return {"error": f"LLM connection error: {e}"}
    except Exception as e:
        log.error("Unexpected error in generate_proposal: %s", e, exc_info=True)
        return {"error": str(e)}

def process_lead(lead_id: int, source: str, title: str,
                 description: str) -> tuple[str, str]:
    """Returns (analysis_json, proposal_json) as strings."""
    analysis = analyze_lead(source, title, description)
    time.sleep(1.5) # Safety delay for rate limits
    proposal = generate_proposal(source, title, description, analysis)
    return json.dumps(analysis), json.dumps(proposal)
