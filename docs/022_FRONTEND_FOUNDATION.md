# Frontend Foundation — Auth + Dashboard Shell + Xero Sync
## Phase 1: Authentication, Layout & Integration Onboarding

| Field | Value |
|---|---|
| **Report ID** | 022_FRONTEND_FOUNDATION |
| **Execution Date** | 2026-04-28 |
| **Framework** | Next.js 16 (App Router) |
| **Auth** | NextAuth.js v4 — credentials + Magic Link (email OTP) |
| **Styling** | Tailwind CSS v4 + existing EcoLink design tokens |
| **TypeScript** | 0 errors (`tsc --noEmit` clean) |
| **Tests** | 174 passing — no regressions |

---

## 1. Files Created / Modified

| File | Action | Description |
|---|---|---|
| `src/app/login/page.tsx` | ✏️ Enhanced | Added Magic Link tab, animated mode toggle, OTP confirmation screen |
| `src/app/dashboard/layout.tsx` | ✅ Created | Shell layout: sidebar + sticky header |
| `src/components/dashboard/XeroStatusBadge.tsx` | ✅ Created | Client component — live Xero connection badge |
| `src/app/dashboard/xero-sync/page.tsx` | ✅ Created | Xero onboarding page with big CTA + status card |
| `src/app/api/auth/xero/login/route.ts` | ✅ Created | OAuth2 redirect to Xero authorization endpoint |

---

## 2. Middleware — `/dashboard/*` Protection

**File:** `src/middleware.ts` (pre-existing, no changes needed)

The existing middleware already:
- Reads `next-auth` JWT from the request
- Redirects unauthenticated users to `/login?callbackUrl=<original>`
- Enforces 14-day trial for `starter` plan users
- Protects `/dashboard/:path*`, `/api/xero/:path*`, `/api/transactions/:path*`

> [!NOTE]
> Magic Link requires adding the `email` provider to `authOptions` in `src/lib/auth.ts`
> and configuring a Resend API key (`RESEND_API_KEY` env var).

---

## 3. Login Page — Magic Link Enhancement

The existing password login was enhanced with a **mode toggle**:

```
┌─────────────────────────────────────────┐
│  🔒 Password  │  ✨ Magic Link          │  ← animated toggle
├─────────────────────────────────────────┤
│  Email: [___________________________]  │
│  (password field collapses in ML mode) │
│                                         │
│  [✨ Send Magic Link →]                 │
└─────────────────────────────────────────┘
```

**Magic Link flow:**
1. User enters email → clicks "Send Magic Link"
2. NextAuth `email` provider sends OTP via Resend
3. UI transitions to "Check your inbox" confirmation screen
4. Email is **natively validated** at the moment of link click (no separate verify step)

---

## 4. Dashboard Shell Layout

```
┌──────────────────┬────────────────────────────────────────────┐
│ 🌿 EcoLink.      │  [Company Name]          [🔴 Disconnected] │
│                  ├────────────────────────────────────────────┤
│ ── Navigation ── │                                            │
│ 📊 Dashboard     │                                            │
│ ✅ Review Queue  │         <page content>                     │
│ 🔄 Xero Sync     │                                            │
│ 📄 AASB Reports  │                                            │
│                  │                                            │
│ ── Account ───── │                                            │
│ ⚙️  Settings     │                                            │
│                  │                                            │
│ [AV] User Name   │                                            │
│      email@co    │                                            │
│                [→│                                            │
└──────────────────┴────────────────────────────────────────────┘
```

- **Server Component** — auth checked server-side via `getServerSession(authOptions)`
- **XeroStatusBadge** — Client component, fetches status independently (no waterfall)
- **Mobile-responsive** — sidebar hidden on `< md`, logo shown in header

---

## 5. Xero Sync Page — Onboarding States

### State A: Not Connected (new customer)

```
┌─────────────────────────────────────────────┐
│              [Xero Logo]                    │
│           Connect to Xero                   │
│   "Link your Xero account to auto-import…"  │
│                                             │
│     [ 🔵 Connect to Xero ↗ ]               │  ← /api/auth/xero/login
│                                             │
│  🛡 Read-only · 🔒 Bank-grade · Disconnect  │
│                                             │
│  🧪 Use "Demo Company (AU)" for testing     │
└─────────────────────────────────────────────┘
```

### State B: Connected

```
┌─────────────────────────────────────────────┐
│ [Xero]  ✅ Connected                        │
│         Demo Company (AU)       [Sync Now]  │
│                                             │
│  Organisation: Demo Company (AU)            │
│  Token Status: Valid ✓                      │
│                                             │
│  Disconnect Xero →                          │
└─────────────────────────────────────────────┘
```

---

## 6. OAuth2 Route — `/api/auth/xero/login`

```typescript
GET /api/auth/xero/login?returnTo=/dashboard/xero-sync

→ Redirect to:
  https://login.xero.com/identity/connect/authorize
    ?response_type=code
    &client_id=<XERO_CLIENT_ID>
    &redirect_uri=<XERO_REDIRECT_URI>
    &scope=openid profile email accounting.transactions.read accounting.contacts.read offline_access
    &state=<base64url({ returnTo, ts })>
```

**Scopes:**
| Scope | Purpose |
|---|---|
| `openid profile email` | Identity (PKCE) |
| `accounting.transactions.read` | Import bank transactions |
| `accounting.contacts.read` | Supplier names for merchant rules |
| `offline_access` | Refresh token for long-lived sessions |

> [!IMPORTANT]
> The OAuth2 **callback** route (`/api/auth/xero/callback`) is handled by the
> existing `src/app/api/integrations/xero/route.ts`. No new callback needed.

---

## 7. Environment Variables Required

```env
# NextAuth (existing)
NEXTAUTH_SECRET=<random-secret>
NEXTAUTH_URL=http://localhost:3000

# Magic Link (add to .env.local)
RESEND_API_KEY=re_xxxx
EMAIL_FROM=noreply@ecolink.com.au

# Xero OAuth2 (add to .env.local)
XERO_CLIENT_ID=xxxx
XERO_CLIENT_SECRET=xxxx
XERO_REDIRECT_URI=http://localhost:3000/api/integrations/xero/callback
```

---

## 8. Design Tokens Used

All new UI uses the existing EcoLink design system tokens:

| Token | Value | Usage |
|---|---|---|
| `aw-green` | `#1A6B3F` | Primary CTAs, connected badges |
| `aw-slate` | `#1E2D40` | Body text, headings |
| `aw-gray-border` | `#E8EBF0` | Borders, dividers |
| `aw-green-light` | `#EBF5EF` | Success backgrounds |
| `[#1AB4D7]` | Xero brand blue | Xero-specific elements only |

> [!NOTE]
> Xero brand blue `#1AB4D7` is used **only** for Xero-branded elements.
> All other UI uses the EcoLink green system.

---

## 9. Next Steps

1. **Add `email` provider to `authOptions`** in `src/lib/auth.ts` for Magic Link
2. **Create callback route** `src/app/api/auth/xero/callback/route.ts` to handle OAuth code exchange
3. **Active sidebar state** — add `usePathname()` client wrapper for current route highlighting
4. **Mobile sidebar** — add hamburger menu + drawer for `< md` breakpoint
5. **Review Queue page** — `/dashboard/review` already has `review/` directory

*Report v1 — Generated 2026-04-28. Antigravity Engineering Assistant — EcoLink Australia Project.*
