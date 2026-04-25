"""
Skill: Trend Analyst
Role: Analyses fetched articles and selects the 1-3 best topics to turn into
Instagram carousels. Also determines best post format, hook angle, and timing.
"""

import os
import json
from groq import Groq

GROQ_API_KEY = os.environ.get("GROQ_API_KEY", "")


def analyse(articles: list[dict], posts_per_run: int = 2) -> list[dict]:
    """
    Given a list of news articles, return the best topics to create content for.
    Each topic includes: headline, angle, key_points, hook, format.
    """
    if not articles:
        return []

    client = Groq(api_key=GROQ_API_KEY)

    article_summaries = "\n".join([
        f"[{i+1}] {a['title']}\n    {a['summary'][:200]}\n    Source: {a['source']}"
        for i, a in enumerate(articles)
    ])

    prompt = f"""You are a senior Instagram content strategist for Claw Agency — an AI automation agency targeting Australian tradies (builders, electricians, plumbers) and small business owners.

Our Instagram (@claw.agency.hq) posts educational carousel content that:
- Shows how AI/automation saves time and money for trades & small biz
- Uses direct, punchy language (not corporate fluff)
- Gives real, actionable value — not vague tips
- Positions Claw Agency as the go-to AI partner for tradies

Here are today's top articles:

{article_summaries}

Select the best {posts_per_run} topics for Instagram carousels. For each, provide:

Return ONLY valid JSON (no markdown, no extra text):
[
  {{
    "article_index": 1,
    "topic_title": "Short punchy topic title (max 8 words)",
    "hook": "First line of caption that stops the scroll — controversial, surprising, or bold statement",
    "angle": "The specific angle for tradies/small biz — how does this affect THEM specifically?",
    "key_points": [
      "Point 1 — specific and actionable",
      "Point 2 — specific and actionable",
      "Point 3 — specific and actionable",
      "Point 4 — specific and actionable",
      "Point 5 — specific and actionable"
    ],
    "slide_titles": [
      "SLIDE 1: Title Headline",
      "SLIDE 2: Key insight heading",
      "SLIDE 3: Key insight heading",
      "SLIDE 4: Key insight heading",
      "SLIDE 5: Key insight heading",
      "SLIDE 6: CTA heading"
    ],
    "cta": "Call to action for last slide",
    "best_posting_time": "HH:MM AEST",
    "content_type": "educational|news|tips|opinion",
    "estimated_engagement": "high|medium"
  }}
]"""

    try:
        response = client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=[{"role": "user", "content": prompt}],
            temperature=0.6,
            max_tokens=2000,
        )
        raw = response.choices[0].message.content.strip()
        # Strip markdown code fences if present
        if raw.startswith("```"):
            raw = raw.split("```")[1]
            if raw.startswith("json"):
                raw = raw[4:]
        topics = json.loads(raw.strip())

        # Enrich with source article data
        for topic in topics:
            idx = topic.get("article_index", 1) - 1
            if 0 <= idx < len(articles):
                topic["source_article"] = articles[idx]

        print(f"[trend_analyst] Selected {len(topics)} topics for posting")
        return topics
    except Exception as e:
        print(f"[trend_analyst] Error: {e}")
        # Fallback: use first article
        if articles:
            return [{
                "article_index": 1,
                "topic_title": articles[0]["title"][:50],
                "hook": f"This changes everything for tradies 👇",
                "angle": "How this affects Australian tradies and small business owners",
                "key_points": [
                    "AI is no longer just for big companies",
                    "Tradies using AI are saving 10+ hours per week",
                    "Automated quotes, invoices, and follow-ups",
                    "SMS bots that answer missed calls = no lost leads",
                    "Start small — one automation at a time",
                ],
                "slide_titles": [
                    f"SLIDE 1: {articles[0]['title'][:40]}",
                    "SLIDE 2: What's changing",
                    "SLIDE 3: How it affects you",
                    "SLIDE 4: What to do about it",
                    "SLIDE 5: Real numbers",
                    "SLIDE 6: Start today",
                ],
                "cta": "Follow @claw.agency.hq for daily AI tips for tradies",
                "best_posting_time": "08:00",
                "content_type": "educational",
                "estimated_engagement": "high",
                "source_article": articles[0],
            }]
        return []


def run(articles: list[dict] | None = None) -> dict:
    """Main entry point for OpenClaw skill."""
    if articles is None:
        # If called standalone, import news_hunter
        from skills.news_hunter import run as hunt
        news_result = hunt()
        articles = news_result.get("articles", [])

    topics = analyse(articles)
    return {
        "status": "ok",
        "topics_selected": len(topics),
        "topics": topics,
    }


if __name__ == "__main__":
    # For testing
    import sys
    if len(sys.argv) > 1:
        with open(sys.argv[1]) as f:
            articles = json.load(f)
    else:
        from news_hunter import run as hunt
        articles = hunt().get("articles", [])

    result = run(articles)
    print(json.dumps(result, indent=2, ensure_ascii=False))
