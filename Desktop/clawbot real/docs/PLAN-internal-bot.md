# Architecture Plan: Claw Agency - Instagram Laboratory (Internal Automation)

## Overview
A systems-level automation to manage Claw Agency's own Instagram footprint. Acts as the "Client Zero" laboratory for testing premium 24/7 AI Receptionist services and Automated Content Generation for Australian Tradies and small businesses.

## Tech Stack (The "Laboratory" Spec)
- **Runtime:** Bun (for performance and DX)
- **Framework:** Hono (Lightweight, ultra-fast for webhooks)
- **Database:** SQLite (Turso) or Postgres (Neon) - Focus on edge-readiness.
- **AI Brain:** Claude 3.5 Sonnet (via OpenClaw engine) for high-intent lead qualification.
- **Social Engine:** Meta Graph API (Instagram Business)
- **Visuals:** Flux.1 (via inference.sh) for ultra-realistic Tradie lifestyle images.

---

## 🏗️ Phase 1: Infrastructure & Meta Handshake
- [x] **1.1: Meta App Configuration**
  - Setup Facebook Developer App (Instagram Business API).
  - Configure Webhooks for `instagram_manage_messages` and `pages_show_list`.
  - Obtain Long-lived User Access Tokens.
- [x] **1.2: Bun + Hono Core Setup**
  - Initialize project with `bun init`.
  - Setup Hono server with `/webhook` and `/health` endpoints.
  - Implement HMAC signature validation for Meta webhooks (Skeletal).
- [x] **1.3: Database Schema Migration**
  - `Leads`: id, ig_username, status (cold, qualified, booked), niche, summary.
  - `Conversations`: id, lead_id, message_log (JSON), last_interaction.
  - `Posts`: id, creative_assets, caption, status (scheduled, published).

---

## 🧠 Phase 2: AI Receptionist (24/7 DM Response)
- [ ] **2.1: The "AU Tradie" Personality Engine**
  - Prompt Engineering: Professional, direct, Australian English ("G'day mate", "No drama").
  - Strategic Goal: Move conversation from DM to "Get a Quote" or "Book a Demo".
- [ ] **2.2: Intent Recognition & Qualification**
  - Detect niche (Sparkie, Plumber, Cafe).
  - Filter out "tire-kickers".
  - Extract contact info (Phone/Email).
- [ ] **2.3: Messaging Loop**
  - Webhook listener -> AI Processing -> Post back to IG DM API.

---

## 🎨 Phase 3: Content Factory (Daily Carousels)
- [ ] **3.1: Automated Creative Pipeline**
  - Trigger: Daily Cron job.
  - Logic: AI generates 5-7 slides worth of content (Tips for Tradies, ROI numbers).
  - Image Gen: Request lifestyle shots (Flux.1) for each slide background.
- [ ] **3.2: Meta Publishing Pipeline**
  - Upload assets to `MEDIA_BUNDLE`.
  - Trigger `MEDIA_PUBLISH` for carousel format.
  - Set captions with AU-focused hashtags.

---

## 📊 Phase 4: Lead Management & Dashboard
- [ ] **4.1: Internal Monitoring API**
  - Protected endpoints to view "Qualified Leads" from the DB.
  - Logging system for AI tokens and costs.
- [ ] **4.2: Telegram/Slack Notifications**
  - Instant alert when a "High Value" lead is qualified.

---

## 🔴 CRITICAL CONSTRAINTS (MANDATORY)
1. **PURPLE BAN:** All generated assets (posts) must STRICTLY follow the `Rugged Tech` palette (White, Charcoal, Electric Orange).
2. **RATE LIMITING:** Implement backoff logic for Meta API to prevent shadow-banning.
3. **P0 SECURITY:** Store Meta tokens in encrypted environment variables.

---

## Success Criteria
- [ ] 24/7 Response time < 2 minutes.
- [ ] Daily carousel posted without manual intervention.
- [ ] Lead qualification accuracy > 90%.
