"""
Skill: Carousel Creator
Role: Generates professional Instagram carousel slides (1080x1080px)
in Claw Agency brand style: dark navy bg, orange accents, white text.
"""

import os
import json
import textwrap
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont
import math

# ── Brand Colors ──────────────────────────────────────────────────────────────
BG_COLOR      = "#0a0f1e"   # Deep navy
BG2_COLOR     = "#111827"   # Slightly lighter
ACCENT_COLOR  = "#f97316"   # Claw orange
ACCENT2_COLOR = "#fb923c"   # Lighter orange
TEXT_COLOR    = "#f1f5f9"   # Near white
MUTED_COLOR   = "#64748b"   # Muted grey
WHITE         = "#ffffff"
DARK_CARD     = "#1e293b"   # Card background

# ── Dimensions ────────────────────────────────────────────────────────────────
W, H = 1080, 1080

# ── Font helpers ─────────────────────────────────────────────────────────────
FONT_PATHS = [
    "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
    "/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf",
    "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
]

def _hex(color: str):
    color = color.lstrip("#")
    return tuple(int(color[i:i+2], 16) for i in (0, 2, 4))

def _font(size: int, bold: bool = True):
    paths = FONT_PATHS if bold else [FONT_PATHS[-1]] + FONT_PATHS
    for p in paths:
        try:
            return ImageFont.truetype(p, size)
        except Exception:
            pass
    return ImageFont.load_default()


def _text_size(draw, text, font):
    bb = draw.textbbox((0, 0), text, font=font)
    return bb[2] - bb[0], bb[3] - bb[1]


def _draw_rounded_rect(draw, xy, radius=20, fill=None, outline=None, width=2):
    x0, y0, x1, y1 = xy
    draw.rounded_rectangle([x0, y0, x1, y1], radius=radius, fill=fill, outline=outline, width=width)


def _draw_glow_circle(img, cx, cy, r, color):
    """Soft radial glow effect."""
    overlay = Image.new("RGBA", img.size, (0, 0, 0, 0))
    d = ImageDraw.Draw(overlay)
    r_col = _hex(color)
    for i in range(r, 0, -4):
        alpha = int(35 * (i / r))
        d.ellipse([cx - i, cy - i, cx + i, cy + i],
                  fill=(*r_col, alpha))
    img.paste(overlay, mask=overlay)


def _add_slide_number(draw, current: int, total: int):
    """Bottom right slide counter."""
    font = _font(22, bold=False)
    text = f"{current} / {total}"
    w, h = _text_size(draw, text, font)
    draw.text((W - w - 40, H - h - 30), text, font=font, fill=_hex(MUTED_COLOR))


def _add_watermark(draw):
    """Bottom left: @claw.agency.hq"""
    font = _font(24, bold=False)
    draw.text((40, H - 50), "@claw.agency.hq", font=font, fill=_hex(MUTED_COLOR))


def _add_claw_marks(draw, x, y, size=80, opacity=40):
    """Draw 3 diagonal claw scratch marks."""
    color = (*_hex(ACCENT_COLOR), opacity)
    overlay = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    od = ImageDraw.Draw(overlay)
    spacing = size // 3
    for i, off in enumerate([-spacing, 0, spacing]):
        dx = int(size * 0.8 * math.cos(math.radians(40)))
        dy = int(size * 0.8 * math.sin(math.radians(40)))
        x0 = x + off - dx // 2
        y0 = y - dy // 2
        x1 = x + off + dx // 2
        y1 = y + dy // 2
        od.line([(x0, y0), (x1, y1)], fill=color, width=max(3, size // 12))
    return overlay


def make_title_slide(topic: dict, slide_num: int, total: int) -> Image.Image:
    """Slide 1: Big hook headline."""
    img = Image.new("RGB", (W, H), _hex(BG_COLOR))
    draw = ImageDraw.Draw(img)

    # Background accent glow (top right)
    glow = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    gd = ImageDraw.Draw(glow)
    for r in range(350, 0, -8):
        a = int(25 * (r / 350))
        gd.ellipse([W - r, -r // 2, W + r, r], fill=(*_hex(ACCENT_COLOR), a))
    img.paste(glow, mask=glow)

    # Claw marks (decorative, top left)
    claw = _add_claw_marks(draw, 120, 120, size=100, opacity=30)
    img.paste(claw, mask=claw)

    # Top label
    label_font = _font(26)
    label = "🤖  CLAW AGENCY"
    lw, lh = _text_size(draw, label, label_font)
    draw.text(((W - lw) // 2, 90), label, font=label_font, fill=_hex(ACCENT_COLOR))

    # Divider line
    draw.rectangle([W // 2 - 220, 140, W // 2 + 220, 143], fill=_hex(ACCENT_COLOR))

    # Main headline (centered, word-wrapped)
    title = topic.get("topic_title", "AI is changing everything for tradies").upper()
    title_font = _font(72)
    lines = textwrap.wrap(title, width=16)
    y = 200
    for line in lines:
        lw, lh = _text_size(draw, line, title_font)
        draw.text(((W - lw) // 2, y), line, font=title_font, fill=_hex(WHITE))
        y += lh + 16

    # Hook subtext
    hook = topic.get("hook", "")
    if hook:
        hook_font = _font(34, bold=False)
        hook_lines = textwrap.wrap(hook, width=32)
        y += 30
        for line in hook_lines:
            lw, lh = _text_size(draw, line, hook_font)
            draw.text(((W - lw) // 2, y), line, font=hook_font, fill=_hex(TEXT_COLOR))
            y += lh + 10

    # Arrow / swipe hint
    arrow_font = _font(28)
    arrow_text = "Swipe to learn more  →"
    aw, ah = _text_size(draw, arrow_text, arrow_font)
    draw.text(((W - aw) // 2, H - 160), arrow_text, font=arrow_font, fill=_hex(ACCENT2_COLOR))

    _add_slide_number(draw, slide_num, total)
    _add_watermark(draw)
    return img


def make_content_slide(slide_title: str, key_point: str, slide_num: int, total: int, index: int) -> Image.Image:
    """Content slide: numbered insight."""
    img = Image.new("RGB", (W, H), _hex(BG_COLOR))
    draw = ImageDraw.Draw(img)

    # Subtle card background
    _draw_rounded_rect(draw, [60, 80, W - 60, H - 80], radius=24, fill=_hex(DARK_CARD))

    # Number badge (large, top left of card)
    num_font = _font(120)
    num_text = str(index)
    nw, nh = _text_size(draw, num_text, num_font)
    draw.text((100, 100), num_text, font=num_font, fill=(*_hex(ACCENT_COLOR), 60))

    # Accent line
    draw.rectangle([100, 240, 100 + 60, 246], fill=_hex(ACCENT_COLOR))

    # Slide title
    title_font = _font(52)
    title_lines = textwrap.wrap(slide_title.upper(), width=20)
    y = 270
    for line in title_lines:
        draw.text((100, y), line, font=title_font, fill=_hex(WHITE))
        y += 62

    # Key point text
    y += 20
    point_font = _font(38, bold=False)
    point_lines = textwrap.wrap(key_point, width=26)
    for line in point_lines:
        draw.text((100, y), line, font=point_font, fill=_hex(TEXT_COLOR))
        y += 52

    # Bottom claw watermark (decorative)
    claw = _add_claw_marks(draw, W - 120, H - 150, size=90, opacity=15)
    img.paste(claw, mask=claw)

    _add_slide_number(draw, slide_num, total)
    _add_watermark(draw)
    return img


def make_cta_slide(topic: dict, slide_num: int, total: int) -> Image.Image:
    """Last slide: Call to action."""
    img = Image.new("RGB", (W, H), _hex(BG_COLOR))
    draw = ImageDraw.Draw(img)

    # Full glow background
    glow = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    gd = ImageDraw.Draw(glow)
    for r in range(400, 0, -6):
        a = int(20 * (r / 400))
        gd.ellipse([W // 2 - r, H // 2 - r, W // 2 + r, H // 2 + r],
                   fill=(*_hex(ACCENT_COLOR), a))
    img.paste(glow, mask=glow)

    # Claw marks (center, decorative)
    claw = _add_claw_marks(draw, W // 2, H // 2 - 180, size=120, opacity=25)
    img.paste(claw, mask=claw)

    # "CLAW" text
    claw_font = _font(110)
    claw_text = "CLAW"
    cw, ch = _text_size(draw, claw_text, claw_font)
    draw.text(((W - cw) // 2, 220), claw_text, font=claw_font, fill=_hex(WHITE))

    # "AGENCY" text
    ag_font = _font(42)
    ag_text = "A G E N C Y"
    aw, ah = _text_size(draw, ag_text, ag_font)
    draw.text(((W - aw) // 2, 350), ag_text, font=ag_font, fill=_hex(ACCENT_COLOR))

    # Divider
    draw.rectangle([W // 2 - 200, 420, W // 2 + 200, 423], fill=_hex(ACCENT_COLOR))

    # CTA text
    cta = topic.get("cta", "Follow for daily AI tips for tradies 🤖")
    cta_font = _font(38, bold=False)
    cta_lines = textwrap.wrap(cta, width=28)
    y = 460
    for line in cta_lines:
        lw, lh = _text_size(draw, line, cta_font)
        draw.text(((W - lw) // 2, y), line, font=cta_font, fill=_hex(TEXT_COLOR))
        y += lh + 12

    # Handle
    handle_font = _font(34)
    handle_text = "@claw.agency.hq"
    hw, hh = _text_size(draw, handle_text, handle_font)
    draw.text(((W - hw) // 2, y + 30), handle_text, font=handle_font, fill=_hex(ACCENT_COLOR))

    # Link in bio hint
    link_font = _font(26, bold=False)
    link_text = "🔗 Link in bio"
    lw, lh = _text_size(draw, link_text, link_font)
    draw.text(((W - lw) // 2, y + 90), link_text, font=link_font, fill=_hex(MUTED_COLOR))

    _add_slide_number(draw, slide_num, total)
    return img


def create_carousel(topic: dict, output_dir: str = "/tmp/carousel") -> list[str]:
    """
    Generate all slides for a topic and save as PNG files.
    Returns list of file paths.
    """
    Path(output_dir).mkdir(parents=True, exist_ok=True)

    key_points = topic.get("key_points", [])
    slide_titles = topic.get("slide_titles", [])
    topic_id = topic.get("topic_title", "post")[:20].replace(" ", "_").lower()

    # Number of content slides = number of key points (max 5)
    n_content = min(len(key_points), 5)
    total_slides = 1 + n_content + 1  # title + content + cta

    paths = []

    # Slide 1: Title
    s = make_title_slide(topic, 1, total_slides)
    p = f"{output_dir}/{topic_id}_slide_01.png"
    s.save(p)
    paths.append(p)

    # Content slides
    for i in range(n_content):
        slide_title = slide_titles[i + 1] if i + 1 < len(slide_titles) else f"Point {i+1}"
        # Strip "SLIDE X:" prefix if present
        if ":" in slide_title:
            slide_title = slide_title.split(":", 1)[1].strip()
        key_point = key_points[i]
        s = make_content_slide(slide_title, key_point, i + 2, total_slides, i + 1)
        p = f"{output_dir}/{topic_id}_slide_{i+2:02d}.png"
        s.save(p)
        paths.append(p)

    # Last slide: CTA
    s = make_cta_slide(topic, total_slides, total_slides)
    p = f"{output_dir}/{topic_id}_slide_{total_slides:02d}.png"
    s.save(p)
    paths.append(p)

    print(f"[carousel_creator] Created {len(paths)} slides for '{topic.get('topic_title')}'")
    return paths


def run(topics: list[dict] | None = None) -> dict:
    """Main entry point for OpenClaw skill."""
    if topics is None:
        return {"status": "error", "message": "No topics provided"}

    results = []
    for topic in topics:
        paths = create_carousel(topic)
        results.append({
            "topic_title": topic.get("topic_title"),
            "slide_paths": paths,
            "slide_count": len(paths),
        })

    return {"status": "ok", "carousels": results}


if __name__ == "__main__":
    # Quick test
    test_topic = {
        "topic_title": "AI Saves Tradies 10 Hours Per Week",
        "hook": "Your competitors are already using this. Are you?",
        "key_points": [
            "Missed calls = lost jobs. AI SMS bots reply instantly, 24/7",
            "Automated quotes in 2 minutes instead of 2 hours",
            "Invoice reminders sent automatically — no chasing clients",
            "AI job scheduling reduces travel time by 30%",
            "Real tradies using AI report 40% more jobs booked per week",
        ],
        "slide_titles": [
            "SLIDE 1: AI Saves Tradies 10 Hours Per Week",
            "SLIDE 2: Never Miss a Lead Again",
            "SLIDE 3: Quote Faster, Win More",
            "SLIDE 4: Get Paid Faster",
            "SLIDE 5: Smarter Scheduling",
            "SLIDE 6: The Numbers",
        ],
        "cta": "Follow @claw.agency.hq for daily AI tips for tradies 🤖",
    }
    paths = create_carousel(test_topic, output_dir="/tmp/test_carousel")
    print(f"Created: {paths}")
