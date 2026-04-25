---
name: hunter
description: Lead scraping and proposal generation workflow.
---

# SKILL: Hunter

## Purpose
Orchestrates the end-to-end flow of finding leads, triggering research, and generating proposals.

## Workflow
1. **Scrape**: Trigger `hunter.py` to get latest Upwork leads via Apify.
2. **Filter**: Filter leads based on budget ($500+) and tech stack (Agentic AI, Web3, FinTech).
3. **Research**: Call `autoresearch` skill for each filtered lead.
4. **Propose**: Generate a tailored proposal using Groq.
5. **Notify**: Send the proposal draft and lead details to Telegram.

## Commands
- `/hunt`: Run a manual scrape cycle.
- `/hunter stats`: Show number of leads found/processed today.
