---
name: instagram
description: Autonomous Instagram content pipeline — hunts news, creates branded carousels, writes captions, posts to @claw.agency.hq
---

# SKILL: Instagram

## Purpose
End-to-end automation for Claw Agency's Instagram presence. Runs a full pipeline from news discovery to carousel post.

## Workflow
1. **Hunt** (`news_hunter.py`): Scan RSS feeds for AI, automation, tradie, and AU small business news.
2. **Analyse** (`trend_analyst.py`): Filter and score articles, select top topics for the audience.
3. **Create** (`carousel_creator.py`): Generate 6-slide branded 1080x1080 carousels with Claw Agency styling.
4. **Write** (`content_writer.py`): Craft scroll-stopping captions with hashtags.
5. **Publish** (`instagram_publisher.py`): Upload to Cloudinary → post via Meta Graph API → notify via Telegram.

## Entry Point
`pipeline.py` — run directly or via OpenClaw schedule.

## Commands
- `/post` — Run full pipeline and post to Instagram
- `/dryrun` — Run pipeline but skip posting (saves JSON to /tmp)
- `/news` — Show top news articles found today
- `/status` — Show last post details

## Schedule
Monday, Wednesday, Friday at 7:00 AM AEST (`0 7 * * 1,3,5`)

## Required ENV
- `GROQ_API_KEY`
- `INSTAGRAM_USER_ID`
- `INSTAGRAM_ACCESS_TOKEN`
- `CLOUDINARY_CLOUD_NAME`
- `CLOUDINARY_API_KEY`
- `CLOUDINARY_API_SECRET`
- `TELEGRAM_BOT_TOKEN`
- `TELEGRAM_CHAT_ID`
