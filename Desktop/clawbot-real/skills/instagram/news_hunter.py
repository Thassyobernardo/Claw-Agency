"""
Skill: News Hunter
Role: Fetches latest news about AI, automation, tradies, and small business
from RSS feeds and optionally Apify scrapers.
"""

import feedparser
import os
import json
import hashlib
from datetime import datetime, timezone, timedelta
from groq import Groq

# ── RSS Feed Sources ──────────────────────────────────────────────────────────
RSS_FEEDS = {
    "ai_automation": [
        "https://techcrunch.com/category/artificial-intelligence/feed/",
        "https://www.artificialintelligence-news.com/feed/",
        "https://venturebeat.com/category/ai/feed/",
        "https://feeds.feedburner.com/oreilly/radar/blogposts",
        "https://www.zdnet.com/topic/artificial-intelligence/rss.xml",
    ],
    "tradies_australia": [
        "https://www.hia.com.au/rss",
        "https://www.constructionequipment.com.au/feed",
        "https://sourceable.net/feed/",
        "https://www.thenewdaily.com.au/finance/work/feed/",
    ],
    "small_business": [
        "https://www.smartcompany.com.au/feed/",
        "https://www.startupdaily.net/feed/",
        "https://www.businessinsider.com.au/feed",
        "https://www.afr.com/rss/technology",
    ],
    "marketing_digital": [
        "https://feeds.feedburner.com/socialmediaexaminer",
        "https://neilpatel.com/blog/feed/",
        "https://moz.com/blog/feed",
    ],
}

GROQ_API_KEY = os.environ.get("GROQ_API_KEY", "")
MAX_ARTICLES_PER_FEED = 5
MAX_AGE_HOURS = 72  # only articles from last 72 hours


def _is_recent(entry) -> bool:
    """Check if article is within MAX_AGE_HOURS."""
    for attr in ("published_parsed", "updated_parsed"):
        t = getattr(entry, attr, None)
        if t:
            pub = datetime(*t[:6], tzinfo=timezone.utc)
            cutoff = datetime.now(timezone.utc) - timedelta(hours=MAX_AGE_HOURS)
            return pub >= cutoff
    return True  # if no date, include anyway


def _clean_summary(text: str, max_len: int = 300) -> str:
    import re
    text = re.sub(r"<[^>]+>", "", text or "")
    text = re.sub(r"\s+", " ", text).strip()
    return text[:max_len] + "…" if len(text) > max_len else text


def fetch_news(categories: list[str] | None = None) -> list[dict]:
    """
    Fetch news articles from RSS feeds.
    Returns list of dicts: {id, title, summary, url, source, category, published}
    """
    categories = categories or list(RSS_FEEDS.keys())
    articles = []
    seen_ids = set()

    for category in categories:
        feeds = RSS_FEEDS.get(category, [])
        for feed_url in feeds:
            try:
                feed = feedparser.parse(feed_url)
                count = 0
                for entry in feed.entries:
                    if count >= MAX_ARTICLES_PER_FEED:
                        break
                    if not _is_recent(entry):
                        continue

                    article_id = hashlib.md5(
                        getattr(entry, "link", entry.title).encode()
                    ).hexdigest()[:12]

                    if article_id in seen_ids:
                        continue
                    seen_ids.add(article_id)

                    articles.append({
                        "id": article_id,
                        "title": entry.get("title", "").strip(),
                        "summary": _clean_summary(
                            entry.get("summary", "") or entry.get("description", "")
                        ),
                        "url": entry.get("link", ""),
                        "source": feed.feed.get("title", feed_url),
                        "category": category,
                        "published": str(entry.get("published", "")),
                    })
                    count += 1
            except Exception as e:
                print(f"[news_hunter] Error parsing {feed_url}: {e}")

    print(f"[news_hunter] Fetched {len(articles)} articles across {len(categories)} categories")
    return articles


def filter_relevant(articles: list[dict]) -> list[dict]:
    """
    Use Groq to filter/score articles by relevance to:
    AI that helps tradies and small businesses in Australia.
    Returns top 10 most relevant articles.
    """
    if not articles or not GROQ_API_KEY:
        return articles[:10]

    client = Groq(api_key=GROQ_API_KEY)

    article_list = "\n".join([
        f"{i+1}. [{a['category']}] {a['title']} — {a['summary'][:150]}"
        for i, a in enumerate(articles[:40])  # send max 40 for scoring
    ])

    prompt = f"""You are a content strategist for Claw Agency, an AI automation agency targeting Australian tradies and small businesses.

Rate each article 1-10 on how relevant it is for creating Instagram content that would resonate with tradies, builders, electricians, plumbers, small business owners in Australia who are curious about AI and automation.

HIGH SCORE (8-10): AI tools saving time/money for trades/small biz, automation success stories, productivity hacks, AI news affecting small business Australia
MEDIUM SCORE (4-7): General AI news, marketing tips, digital tools
LOW SCORE (1-3): Unrelated tech news, US-only content, enterprise-only

Articles:
{article_list}

Return ONLY a JSON array like: [{{"index": 1, "score": 8}}, {{"index": 2, "score": 3}}, ...]
Just the JSON, nothing else."""

    try:
        response = client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=[{"role": "user", "content": prompt}],
            temperature=0.3,
            max_tokens=500,
        )
        raw = response.choices[0].message.content.strip()
        scores = json.loads(raw)
        scored = {s["index"]: s["score"] for s in scores}

        # Attach scores and sort
        for i, a in enumerate(articles[:40]):
            a["relevance_score"] = scored.get(i + 1, 5)

        articles[:40] = sorted(articles[:40], key=lambda x: x.get("relevance_score", 0), reverse=True)
        top = [a for a in articles[:40] if a.get("relevance_score", 0) >= 6][:10]
        print(f"[news_hunter] Filtered to {len(top)} high-relevance articles")
        return top
    except Exception as e:
        print(f"[news_hunter] Groq filter error: {e}")
        return articles[:10]


def run() -> dict:
    """Main entry point for OpenClaw skill."""
    raw = fetch_news()
    relevant = filter_relevant(raw)
    return {
        "status": "ok",
        "total_fetched": len(raw),
        "articles": relevant,
    }


if __name__ == "__main__":
    result = run()
    print(json.dumps(result, indent=2, ensure_ascii=False))
