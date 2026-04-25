# PRD: Claw Agency Hunter Agent System

## Overview
Claw Agency Hunter is an autonomous AI agent system built on the OpenClaw framework, designed to find, research, and outreach to potential leads on Upwork.

## Goal
To automate the lead generation and proposal process for Claw Agency, leveraging high-speed LLMs (Groq) and scalable fallbacks (Gemini).

## Target Stack
- **Framework**: OpenClaw (Railway Deployment)
- **Primary LLM**: Groq (llama-3.3-70b)
- **Fallback LLM**: Gemini 2.0 Flash
- **Database**: Railway PostgreSQL
- **Queue**: Railway Redis
- **Notifications**: Telegram Bot

## Key Components

### 1. OpenClaw Core
- **Gateway**: Handles Telegram integration.
- **Brain**: Interprets leads and decides on research/proposal strategy.
- **Memory**: Persistent storage in PostgreSQL.

### 2. Specialized Skills
- **AutoResearch**: A deep research loop that investigates the lead's company, project requirements, and industry context.
- **Superpowers**: Provides the agent with shell and filesystem access for local processing and task automation.
- **Hunter**:
  - **Scraping**: Uses Apify to extract Upwork job postings.
  - **Proposal Generation**: Uses Groq (or Gemini) to craft personalized proposals based on research.
  - **Delivery**: Sends proposals via Resend (Email) and notifications via Telegram.

## Requirements
- **Dockerfile**: Optimized for node.js/python environment required by OpenClaw.
- **Railway Configuration**: Multi-service setup (App, DB, Redis).
- **Environment Management**: Secure handling of API keys.

## Success Criteria
- Agent successfully scrapes Upwork leads.
- Agent performs background research autonomously.
- Agent generates and sends/notifies about high-quality proposals.
