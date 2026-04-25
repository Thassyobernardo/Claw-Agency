---
name: autoresearch
description: Deep research loop for company and project investigation.
---

# SKILL: AutoResearch

## Purpose
Exhaustive background research on a target lead, company, or technical requirement using web search and LLM synthesis.

## Triggers
- Any new lead found by the Hunter.
- Explicit command: "/research [topic]"

## Logic
1. Perform initial Google/Google Scholar search for the client/company.
2. Extract key themes, past works, and technical stack details.
3. Cross-reference with social profiles (LinkedIn, GitHub) if available.
4. Synthesize a "Client Brief" for the proposal generator.

## Output
A markdown report containing:
- Business Model & Niche
- Technical Requirements (Hidden or Explicit)
- Potential Pain Points
- Strategic Angle for Proposal
