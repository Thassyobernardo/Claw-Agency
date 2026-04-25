"""
Skill: Content Writer
Role: Writes the Instagram caption (hook + body + CTA) and generates
the best hashtags for maximum reach in the AI/tradies/small biz niche.
"""

import os
import json
from groq import Groq

GROQ_API_KEY = os.environ.get("GROQ_API_KEY", "")

# ── Hashtag Library (curated, high-reach in AU tradies + AI niche) ─────────
BASE_HASHTAGS = {
    "ai_automation": [
        "#AIautomation", "#artificialintelligence", "#automationtips",
        "#AItools", "#machinelearning", "#techforbusiness", "#futureofwork",
        "#digitaltransformation", "#AIstartup", "#growthhacking",
    ],
    "tradies": [
        "#tradie", "#tradies", "#tradesman", "#australiantradies",
        "#builder", "#electrician", "#plumber", "#concreter",
        "#tradeslife", "#constructionaustralia", "#buildingaustralia",
        "#tradiesofinstagram", "#tradiebusiness",
    ],
    "small_business": [
        "#smallbusiness", "#smallbusinessaustralia", "#australianbusiness",
        "#entrepreneur", "#businessgrowth", "#businesstips",
        "#startup", "#sidehustle", "#businessowner", "#SME",
    ],
    "marketing": [
        "#digitalmarketing", "#contentmarketing", "#instagrammarketing",
        "#socialmediatips", "#growthhacking", "#marketingstrategy",
    ],
    "claw_agency": [
        "#ClawAgency", "#clawagencyhq", "#AIforTradies",
        "#automatedBusiness", "#tradietech",
    ],
}


def _select_hashtags(topic: dict, max_tags: int = 28) -> list[str]:
    """Select the most relevant hashtags for a topic."""
    content_type = topic.get("content_type", "educational")
    tags = []

    # Always include brand tags
    tags.extend(BASE_HASHTAGS["claw_agency"])

    # Core niche tags
    tags.extend(BASE_HASHTAGS["ai_automation"][:6])
    tags.extend(BASE_HASHTAGS["tradies"][:7])
    tags.extend(BASE_HASHTAGS["small_business"][:6])
    tags.extend(BASE_HASHTAGS["marketing"][:4])

    # Deduplicate and limit
    seen = set()
    result = []
    for t in tags:
        if t.lower() not in seen:
            seen.add(t.lower())
            result.append(t)
        if len(result) >= max_tags:
            break

    return result


def write_caption(topic: dict) -> str:
    """
    Generate a full Instagram caption using Groq.
    Format: Hook (1 line) → Body (value) → CTA → Hashtags
    """
    if not GROQ_API_KEY:
        return _fallback_caption(topic)

    client = Groq(api_key=GROQ_API_KEY)

    key_points = "\n".join([f"• {p}" for p in topic.get("key_points", [])])
    hook = topic.get("hook", "")
    cta = topic.get("cta", "Follow for more AI tips for tradies")

    prompt = f"""You are a social media copywriter for Claw Agency (@claw.agency.hq), an AI automation agency for Australian tradies and small businesses.

Write an Instagram carousel caption for the topic: "{topic.get('topic_title')}"

Hook (already written — use this exactly):
{hook}

Key points covered in the carousel:
{key_points}

CTA: {cta}

Caption rules:
1. Start with the HOOK on its own line (attention-grabbing, bold claim or question)
2. Line break
3. 2-3 short paragraphs of body copy — plain language, direct, no buzzword fluff
4. Each insight/tip on its own line with an emoji bullet
5. Line break
6. Clear CTA (1-2 lines)
7. Line break
8. "— — —"
9. Do NOT include hashtags in the caption body (they go separately)
10. Max 150 words total (not counting hashtags)
11. Write in English, conversational tone, like talking to a tradie mate

Return ONLY the caption text. Nothing else."""

    try:
        response = client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=[{"role": "user", "content": prompt}],
            temperature=0.7,
            max_tokens=400,
        )
        return response.choices[0].message.content.strip()
    except Exception as e:
        print(f"[content_writer] Groq error: {e}")
        return _fallback_caption(topic)


def _fallback_caption(topic: dict) -> str:
    hook = topic.get("hook", "This is changing the game for tradies 👇")
    points = topic.get("key_points", [])
    cta = topic.get("cta", "Follow @claw.agency.hq for daily AI tips")

    body_lines = "\n".join([f"✅ {p}" for p in points[:4]])
    return f"""{hook}

Here's what you need to know:

{body_lines}

{cta}

— — —"""


def write_full_post(topic: dict) -> dict:
    """
    Generate caption + hashtags for a topic.
    Returns dict with caption, hashtags, full_text.
    """
    caption = write_caption(topic)
    hashtags = _select_hashtags(topic)
    hashtag_string = " ".join(hashtags)

    full_text = f"{caption}\n\n.\n.\n.\n{hashtag_string}"

    return {
        "caption": caption,
        "hashtags": hashtags,
        "hashtag_string": hashtag_string,
        "full_text": full_text,
        "char_count": len(full_text),
    }


def run(topics: list[dict] | None = None) -> dict:
    """Main entry point for OpenClaw skill."""
    if not topics:
        return {"status": "error", "message": "No topics provided"}

    results = []
    for topic in topics:
        post = write_full_post(topic)
        results.append({
            "topic_title": topic.get("topic_title"),
            **post,
        })

    return {"status": "ok", "posts": results}


if __name__ == "__main__":
    test_topic = {
        "topic_title": "AI Saves Tradies 10 Hours Per Week",
        "hook": "Your competitors are already using this. Are you?",
        "key_points": [
            "AI SMS bots reply to missed calls 24/7 — no lost leads",
            "Automated quotes in 2 minutes instead of 2 hours",
            "Invoice reminders sent automatically",
            "AI scheduling reduces travel time by 30%",
        ],
        "cta": "Follow @claw.agency.hq for daily AI tips for tradies 🤖",
        "content_type": "educational",
    }
    result = write_full_post(test_topic)
    print(result["full_text"])
    print(f"\nChar count: {result['char_count']}")
