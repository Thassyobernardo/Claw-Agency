"""
Skill: Instagram Publisher
Role: Uploads carousel images to Cloudinary and posts them to Instagram
via the Meta Graph API. Sends Telegram notification on success/failure.
"""

import os
import json
import time
import requests

# ── ENV ───────────────────────────────────────────────────────────────────────
IG_USER_ID        = os.environ.get("INSTAGRAM_USER_ID", "")
IG_ACCESS_TOKEN   = os.environ.get("INSTAGRAM_ACCESS_TOKEN", "")
CLOUDINARY_URL    = os.environ.get("CLOUDINARY_URL", "")          # cloudinary://key:secret@cloud_name
CLOUDINARY_CLOUD  = os.environ.get("CLOUDINARY_CLOUD_NAME", "")
CLOUDINARY_KEY    = os.environ.get("CLOUDINARY_API_KEY", "")
CLOUDINARY_SECRET = os.environ.get("CLOUDINARY_API_SECRET", "")
TELEGRAM_TOKEN    = os.environ.get("TELEGRAM_BOT_TOKEN", "")
TELEGRAM_CHAT_ID  = os.environ.get("TELEGRAM_CHAT_ID", "")

IG_BASE = "https://graph.instagram.com/v21.0"


# ── Cloudinary Upload ─────────────────────────────────────────────────────────

def upload_to_cloudinary(image_path: str) -> str:
    """Upload a local image to Cloudinary and return the public URL."""
    import hashlib, hmac, time as t
    from pathlib import Path

    if not all([CLOUDINARY_CLOUD, CLOUDINARY_KEY, CLOUDINARY_SECRET]):
        raise ValueError("Cloudinary credentials not configured (CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET)")

    timestamp = int(t.time())
    # Build signature
    params = f"timestamp={timestamp}"
    sig = hmac.new(CLOUDINARY_SECRET.encode(), params.encode(), hashlib.sha1).hexdigest()

    url = f"https://api.cloudinary.com/v1_1/{CLOUDINARY_CLOUD}/image/upload"

    with open(image_path, "rb") as f:
        resp = requests.post(url, data={
            "api_key": CLOUDINARY_KEY,
            "timestamp": timestamp,
            "signature": sig,
        }, files={"file": f}, timeout=60)

    resp.raise_for_status()
    data = resp.json()
    public_url = data.get("secure_url", "")
    print(f"[instagram_publisher] Uploaded {Path(image_path).name} → {public_url[:60]}...")
    return public_url


# ── Meta Graph API ────────────────────────────────────────────────────────────

def _ig_post(endpoint: str, payload: dict) -> dict:
    payload["access_token"] = IG_ACCESS_TOKEN
    resp = requests.post(f"{IG_BASE}/{endpoint}", json=payload, timeout=30)
    data = resp.json()
    if "error" in data:
        raise RuntimeError(f"IG API error: {data['error']}")
    return data


def create_carousel_item(image_url: str) -> str:
    """Create a single carousel item container. Returns container ID."""
    data = _ig_post(f"{IG_USER_ID}/media", {
        "image_url": image_url,
        "is_carousel_item": True,
    })
    cid = data.get("id", "")
    print(f"[instagram_publisher] Carousel item created: {cid}")
    return cid


def create_carousel_container(item_ids: list[str], caption: str) -> str:
    """Create the carousel container with all items. Returns container ID."""
    data = _ig_post(f"{IG_USER_ID}/media", {
        "media_type": "CAROUSEL",
        "children": ",".join(item_ids),
        "caption": caption,
    })
    cid = data.get("id", "")
    print(f"[instagram_publisher] Carousel container created: {cid}")
    return cid


def publish_container(container_id: str) -> str:
    """Publish a media container. Returns the published media ID."""
    data = _ig_post(f"{IG_USER_ID}/media_publish", {
        "creation_id": container_id,
    })
    mid = data.get("id", "")
    print(f"[instagram_publisher] ✅ Published! Media ID: {mid}")
    return mid


def post_carousel(slide_paths: list[str], caption: str) -> dict:
    """
    Full carousel posting pipeline:
    1. Upload each slide to Cloudinary
    2. Create IG carousel items
    3. Create carousel container
    4. Publish
    """
    if not IG_USER_ID or not IG_ACCESS_TOKEN:
        raise ValueError("INSTAGRAM_USER_ID and INSTAGRAM_ACCESS_TOKEN must be set")

    if len(slide_paths) < 2:
        raise ValueError("Carousel requires at least 2 slides")
    if len(slide_paths) > 10:
        slide_paths = slide_paths[:10]  # IG carousel max is 10

    # Step 1: Upload to Cloudinary
    print(f"[instagram_publisher] Uploading {len(slide_paths)} slides to Cloudinary...")
    image_urls = []
    for path in slide_paths:
        url = upload_to_cloudinary(path)
        image_urls.append(url)
        time.sleep(0.5)  # be gentle

    # Step 2: Create carousel items
    print(f"[instagram_publisher] Creating {len(image_urls)} carousel items on Instagram...")
    item_ids = []
    for url in image_urls:
        item_id = create_carousel_item(url)
        item_ids.append(item_id)
        time.sleep(1)

    # Step 3: Create carousel container
    container_id = create_carousel_container(item_ids, caption)
    time.sleep(3)  # Instagram recommends waiting before publishing

    # Step 4: Publish
    media_id = publish_container(container_id)

    return {
        "status": "published",
        "media_id": media_id,
        "slide_count": len(slide_paths),
        "image_urls": image_urls,
    }


# ── Telegram Notifications ────────────────────────────────────────────────────

def send_telegram(message: str):
    """Send a Telegram message to the operator."""
    if not TELEGRAM_TOKEN or not TELEGRAM_CHAT_ID:
        print("[instagram_publisher] Telegram not configured, skipping notification")
        return
    try:
        requests.post(
            f"https://api.telegram.org/bot{TELEGRAM_TOKEN}/sendMessage",
            json={"chat_id": TELEGRAM_CHAT_ID, "text": message, "parse_mode": "HTML"},
            timeout=10,
        )
    except Exception as e:
        print(f"[instagram_publisher] Telegram error: {e}")


# ── Main Entry Point ──────────────────────────────────────────────────────────

def run(carousels: list[dict] | None = None, posts: list[dict] | None = None) -> dict:
    """
    Main entry point for OpenClaw skill.
    carousels: output from carousel_creator (slide_paths per topic)
    posts: output from content_writer (caption per topic)
    """
    if not carousels or not posts:
        return {"status": "error", "message": "Need both carousels and posts"}

    results = []
    for carousel, post in zip(carousels, posts):
        topic_title = carousel.get("topic_title", "Post")
        slide_paths = carousel.get("slide_paths", [])
        caption = post.get("full_text", post.get("caption", ""))

        print(f"\n[instagram_publisher] Posting: {topic_title}")
        try:
            result = post_carousel(slide_paths, caption)
            results.append({"topic": topic_title, **result})
            send_telegram(
                f"✅ <b>Posted to Instagram!</b>\n\n"
                f"📌 <b>{topic_title}</b>\n"
                f"🖼 {result['slide_count']} slides\n"
                f"🆔 Media ID: {result['media_id']}\n\n"
                f"<i>@claw.agency.hq</i>"
            )
        except Exception as e:
            error_msg = str(e)
            print(f"[instagram_publisher] ❌ Error posting {topic_title}: {error_msg}")
            results.append({"topic": topic_title, "status": "error", "error": error_msg})
            send_telegram(
                f"❌ <b>Instagram post FAILED</b>\n\n"
                f"📌 {topic_title}\n"
                f"Error: {error_msg}"
            )

    return {"status": "done", "results": results}


if __name__ == "__main__":
    print("Instagram Publisher — use via pipeline.py")
    print(f"IG User ID: {IG_USER_ID or '(not set)'}")
    print(f"Access Token: {'(set)' if IG_ACCESS_TOKEN else '(not set)'}")
    print(f"Cloudinary: {'(set)' if CLOUDINARY_CLOUD else '(not set)'}")
