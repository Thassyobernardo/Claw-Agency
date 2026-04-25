"""
Instagram Pipeline Orchestrator — Claw Agency
=============================================
Runs the full multi-agent pipeline:

  1. NewsHunter    → Fetch latest AI/tradies/business news from RSS
  2. TrendAnalyst  → Select best 2 topics for Instagram
  3. CarouselCreator → Generate carousel slides (PIL images)
  4. ContentWriter → Write caption + hashtags
  5. InstagramPublisher → Upload to Cloudinary + Post via Meta Graph API
  6. Telegram notification on result

Trigger: Railway Cron (daily) or Telegram command via OpenClaw
"""

import os
import sys
import json
import traceback
from datetime import datetime

# Add skills to path
sys.path.insert(0, os.path.dirname(__file__))

from skills.news_hunter import fetch_news, filter_relevant
from skills.trend_analyst import analyse
from skills.carousel_creator import create_carousel
from skills.content_writer import write_full_post
from skills.instagram_publisher import run as publish, send_telegram


def run_pipeline(dry_run: bool = False) -> dict:
    """
    Execute the full Instagram content pipeline.
    dry_run=True: generates content but does not post to Instagram.
    """
    print(f"\n{'='*60}")
    print(f"🤖 CLAW INSTAGRAM PIPELINE — {datetime.now().strftime('%Y-%m-%d %H:%M')}")
    print(f"{'='*60}")
    print(f"Mode: {'DRY RUN' if dry_run else 'LIVE'}\n")

    send_telegram(f"🚀 <b>Instagram Pipeline Started</b>\n{datetime.now().strftime('%Y-%m-%d %H:%M')}\nMode: {'DRY RUN' if dry_run else 'LIVE'}")

    try:
        # ── Step 1: Hunt News ─────────────────────────────────────────────
        print("📰 Step 1: Hunting news...")
        raw_articles = fetch_news()
        articles = filter_relevant(raw_articles)
        print(f"   Found {len(articles)} relevant articles\n")

        if not articles:
            msg = "❌ No relevant articles found today. Pipeline stopped."
            print(msg)
            send_telegram(msg)
            return {"status": "stopped", "reason": "no_articles"}

        # ── Step 2: Analyse Trends ────────────────────────────────────────
        print("📊 Step 2: Analysing trends...")
        topics = analyse(articles, posts_per_run=2)
        print(f"   Selected {len(topics)} topics\n")

        if not topics:
            msg = "❌ Trend analysis failed to select topics. Pipeline stopped."
            print(msg)
            send_telegram(msg)
            return {"status": "stopped", "reason": "no_topics"}

        # ── Step 3: Create Carousels ──────────────────────────────────────
        print("🎨 Step 3: Creating carousel images...")
        carousels = []
        for topic in topics:
            paths = create_carousel(topic, output_dir=f"/tmp/carousel_{datetime.now().strftime('%Y%m%d_%H%M%S')}")
            carousels.append({
                "topic_title": topic.get("topic_title"),
                "slide_paths": paths,
                "slide_count": len(paths),
            })
            print(f"   ✅ Created {len(paths)} slides for: {topic.get('topic_title')}")
        print()

        # ── Step 4: Write Captions ────────────────────────────────────────
        print("✍️  Step 4: Writing captions + hashtags...")
        posts = []
        for topic in topics:
            post = write_full_post(topic)
            posts.append({"topic_title": topic.get("topic_title"), **post})
            print(f"   ✅ Caption written ({post['char_count']} chars): {topic.get('topic_title')}")
        print()

        # ── Step 5: Publish ───────────────────────────────────────────────
        if dry_run:
            print("🏃 DRY RUN — Skipping Instagram post")
            # Save output for inspection
            output = {
                "articles_found": len(articles),
                "topics": [t.get("topic_title") for t in topics],
                "captions": [p.get("caption") for p in posts],
                "hashtags": [p.get("hashtag_string") for p in posts],
                "slide_paths": [c.get("slide_paths") for c in carousels],
            }
            output_path = f"/tmp/pipeline_dry_run_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
            with open(output_path, "w") as f:
                json.dump(output, f, indent=2, ensure_ascii=False)
            print(f"   Dry run output saved: {output_path}")
            send_telegram(f"✅ <b>DRY RUN Complete</b>\n\nTopics ready:\n" + "\n".join([f"• {t.get('topic_title')}" for t in topics]))
            return {"status": "dry_run_complete", "output": output}
        else:
            print("📱 Step 5: Publishing to Instagram...")
            result = publish(carousels=carousels, posts=posts)
            print(f"\n{'='*60}")
            print(f"✅ PIPELINE COMPLETE — {len(result.get('results', []))} posts processed")
            print(f"{'='*60}\n")
            return {"status": "complete", "results": result}

    except Exception as e:
        error = traceback.format_exc()
        print(f"❌ PIPELINE ERROR:\n{error}")
        send_telegram(f"❌ <b>Pipeline ERROR</b>\n\n<pre>{str(e)[:500]}</pre>")
        return {"status": "error", "error": str(e), "traceback": error}


if __name__ == "__main__":
    dry = "--dry" in sys.argv or "--dry-run" in sys.argv
    result = run_pipeline(dry_run=dry)
    print(json.dumps(result, indent=2, default=str))
