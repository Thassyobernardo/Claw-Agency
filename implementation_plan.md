# Implementation Plan: Claw Agency Landing Page

Create a premium institutional landing page for Claw Agency that positions them as the leader in AI Automation for Australian "Tradies" (tradespeople). The design will follow an "Editorial Premium" style (Ramotion-inspired) with a focus on conversion and accessibility.

## User Review Required

> [!IMPORTANT]
> **Tech Stack Recommendation:** I recommend using **Next.js 15 (App Router)** with **Tailwind CSS v4** and **Framer Motion** for the best "premium" feel and performance. Do you approve this stack?
> 
> **Color Palette:** Since we follow a "Premium/Editorial" style, I propose a **Deep Slate & Silver** palette with a single high-contrast accent (e.g., **Electric Blue** or **Neon Green**). Any preference?
> 
> **Content:** Do you have existing copy for the services, or should I generate high-converting copy focused on the "AI Lead Hunter" and "Instagram Automation" features?

## Proposed Changes

### 🎨 Design & Foundation

#### [NEW] `layout.tsx` / `page.tsx`
- Implement a modern, responsive layout with a custom cursor and smooth scroll behavior.
- Use a typography-first approach with **Outfit** or **Cabinet Grotesk** for headings.

#### [NEW] `index.css` / `globals.css`
- Configure Tailwind v4 tokens for the premium palette.
- Add utility classes for glassmorphism and editorial spacing.

---

### 🧩 Core Components

#### [NEW] `components/Hero.tsx`
- **Impact Statement:** "Your AI Agency on Autopilot."
- Massive typography that scales Fluidly.
- Subtle background animation (grainy gradients or floating glass elements).

#### [NEW] `components/Features.tsx`
- Vertical narrative layout instead of a standard grid.
- Highlight "The Tradie Lead Hunter" and "AI Social Management".

#### [NEW] `components/ConversionSection.tsx`
- High-contrast lead capture form.
- Micro-interactions for button hovers and input focus.

---

### 🚀 Optimization & SEO

#### [MODIFY] `metadata` (Root Layout)
- SEO tags for "AI Agency Australia", "Tradie Marketing Automation".
- Social preview images (OG tags).

---

## Open Questions

- **Integration:** Should the "Book a Demo" button link to a Calendly/external URL or open an internal lead form?
- **Mobile First:** Tradies access everything on mobile. Should we prioritise a "one-hand navigation" pattern for the mobile view?

## Verification Plan

### Automated Tests
- `npm run lint` & `npx tsc --noEmit`
- `python .agent/scripts/checklist.py .` for security and best practices.

### Manual Verification
- Visual audit against "Editorial Premium" standards.
- Lighthouse performance check (Target: 95+ Score).
- Mobile responsiveness on multiple viewport sizes.
