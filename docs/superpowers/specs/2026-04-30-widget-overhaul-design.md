# Widget Overhaul — Visual Redesign + Functional Gaps

**Date:** 2026-04-30
**Status:** Approved
**Scope:** Full widget system overhaul — UI redesign, functional gaps, AI assistant

---

## 1. Visual Redesign

### Design Language

Adopt Fintella's existing design tokens (already in `tailwind.config.ts` and `globals.css`) consistently across all widget components. Inspired by RoboTax.app and Apple.com aesthetics with Fintella's gold/dark color scheme.

### Color System (use existing tokens)

| Token | Value | Usage |
|-------|-------|-------|
| `--app-bg` / `brand.dark` | `#060a14` | Widget background |
| `--brand-gold` | `#c4a050` | Primary accent, CTAs, highlights |
| `brand.gold-light` | `#f0d070` | Hover states, gradient endpoints |
| `accent.blue` | `#4f6ef7` | Secondary accent, links |
| Text primary | `rgba(255,255,255,0.95)` | Headings, values |
| Text secondary | `rgba(255,255,255,0.6)` | Labels, descriptions |
| Text dim | `rgba(255,255,255,0.35)` | Placeholders, captions |
| Borders | `rgba(255,255,255,0.06)` | Card edges, dividers |
| Card surface | `rgba(255,255,255,0.03)` | Card backgrounds |

### Typography

- **Headings/Stats:** DM Serif Display (already loaded)
- **Body/Labels:** Inter (already loaded)
- **Large money values:** 28-32px, weight 700, letter-spacing -0.5px, gold gradient text
- **Tab labels:** 13px, weight 600, uppercase, letter-spacing 0.5px
- **Body text:** 14px, weight 400, line-height 1.5

### Component Patterns

**Cards:**
```css
background: rgba(255, 255, 255, 0.03);
border: 1px solid rgba(255, 255, 255, 0.06);
border-radius: 16px;
backdrop-filter: blur(12px);
```

**Gold CTA Button:**
```css
background: linear-gradient(135deg, #c4a050, #f0d070);
color: #060a14;
font-weight: 700;
padding: 14px 28px;
border-radius: 12px;
box-shadow: 0 4px 20px rgba(196, 160, 80, 0.3);
transition: all 0.25s cubic-bezier(0.22, 1, 0.36, 1);
```
Hover: `box-shadow: 0 6px 28px rgba(196, 160, 80, 0.45); transform: translateY(-1px);`

**Ghost Button:**
```css
background: transparent;
border: 1px solid rgba(255, 255, 255, 0.1);
color: rgba(255, 255, 255, 0.8);
border-radius: 10px;
padding: 10px 20px;
```

**Input Fields:**
```css
background: rgba(255, 255, 255, 0.04);
border: 1px solid rgba(255, 255, 255, 0.08);
border-radius: 10px;
color: #fff;
padding: 12px 14px;
font-size: 14px;
```
Focus: `border-color: #c4a050; box-shadow: 0 0 0 3px rgba(196, 160, 80, 0.15);`

**Status Badges:**
- submitted: `bg-amber-500/15 text-amber-400 border-amber-500/20`
- contacted: `bg-blue-500/15 text-blue-400 border-blue-500/20`
- converted: `bg-green-500/15 text-green-400 border-green-500/20`
- rejected: `bg-red-500/15 text-red-400 border-red-500/20`

### Animations

- **Section entrance:** `fadeUp` (0.4s, translateY(12px) → 0, opacity 0 → 1)
- **Tab switch:** crossfade with 0.2s transition
- **Button hover:** translateY(-1px) + shadow expansion
- **Stats counter:** number counting animation on Dashboard load
- **Success state:** checkmark scale-bounce (0.3s)

### Widget Shell (page.tsx)

- Dark background (`#060a14`) with subtle radial gradient glow behind header
- Header: Partner avatar initial (gold circle), name in DM Serif Display, commission badge as pill
- Tab bar: horizontal pills with gold underline indicator, smooth slide transition
- Constrained to 420px max-width (unchanged for TMS embed compatibility)

---

## 2. Functional Gap: Referral History in Dashboard

### Current State
Dashboard shows 3 stat cards (referred, earned, pending) + "Refer a Client" CTA. Recent referrals list exists but is basic.

### New Design
- **Stats row:** 3 glass cards with large gold numbers, labels below, subtle gold gradient on values
- **Recent Referrals section:** Expandable list showing last 10 referrals
  - Each row: company name, status badge, date, estimated value
  - **Clickable rows** → confirmation modal → opens `fintella.partners/dashboard/deals` in new tab
  - Confirmation modal: glass-morphism overlay, "You're about to leave your TMS. Open Fintella Partner Portal?" with Cancel/Open Portal buttons
- **"Refer a Client" CTA** stays at bottom as gold gradient button

### Data
Uses existing `/api/widget/stats` endpoint — already returns `recentReferrals[]` with company name, status, created date, estimated value. May need to expand to return 10 instead of 5.

---

## 3. Functional Gap: Document Persistence (Vercel Blob)

### Current State
Upload Document in Calculator extracts data from PDFs/images via AI, calculates refunds, generates CSVs — all in-memory. Files are lost after the response.

### New Design
- After successful document extraction, save the original file(s) to Vercel Blob
- Store blob URL(s) on the `WidgetReferral` when the user submits via "Submit as Referral"
- New `documentUrls` field on `WidgetReferral` model (String array, optional)

### Schema Change
```prisma
model WidgetReferral {
  // ... existing fields ...
  documentUrls  String[]  // Vercel Blob URLs for uploaded documents
}
```

### Flow
1. User uploads docs → extracted in-memory (unchanged)
2. Results displayed with refund calculations (unchanged)
3. User clicks "Submit as Referral" → files uploaded to Vercel Blob in parallel
4. Blob URLs included in the referral POST body
5. Referral created with `documentUrls` field populated
6. Admin can view/download docs from `/admin/widget-referrals` detail view

### Dependencies
- `BLOB_READ_WRITE_TOKEN` env var must be set on Vercel (already noted as pending)
- Uses `@vercel/blob` package (already in `package.json` from PR #561)

---

## 4. Functional Gap: Calculator → Referral Handoff

### Current State
Partially wired — `onSubmitAsReferral` callback exists, passes some data to referral form. But no visual summary card on the Refer tab showing what was calculated.

### New Design
- When calculator results exist and user switches to Refer tab, show a **pre-fill summary card** at top:
  - Glass card with gold border-left accent
  - "From your calculation:" label
  - Country, entry date, entered value, estimated refund (in gold)
  - Small "Clear" link to remove prefill
- Form fields auto-populated where possible (estimated import value mapped to dropdown range)
- Calculator data attached to referral as `calculatorData` JSON field (already supported by API)

---

## 5. Widget Footer

### Design
- Fixed at bottom of widget, outside scrollable content
- Subtle separator line (`rgba(255,255,255,0.06)`)
- Left: Fintella "F" logo mark (12px) + "Powered by Fintella"
- Right: "Open Portal →" link
- Both link to `https://fintella.partners/dashboard` (or `/login` if not authenticated)
- Font: 11px, `rgba(255,255,255,0.35)`, hover → `rgba(255,255,255,0.6)`
- Height: 36px total

---

## 6. Clickable Referrals + Confirmation Modal

### Behavior
- Each referral row in Dashboard has a subtle hover state (border brightens, cursor pointer)
- On click: show confirmation modal
- Modal design: glass-morphism overlay with backdrop blur
  - Icon: external link icon
  - Title: "Open Fintella Portal?"
  - Body: "This will open your partner dashboard in a new tab."
  - Buttons: "Cancel" (ghost) | "Open Portal" (gold gradient)
- "Open Portal" → `window.open('https://fintella.partners/dashboard', '_blank')`

---

## 7. Widget AI Assistant (TMS Help Bot)

### Concept
Lightweight AI chat panel scoped to TMS widget integration help. Not a full PartnerOS Ollie — a focused assistant that knows:
- How to generate and install API keys
- CargoWise/Magaya/Generic integration steps
- Troubleshooting common issues (CORS, auth failures, widget not loading)
- Explaining what each widget tab does

### Implementation
- New tab in widget: "Help" (replaces or sits alongside "Info")
- Chat UI: message bubbles, input field, send button
- Backend: POST to `/api/widget/chat` with conversation history
- Uses Claude API with a system prompt focused on TMS widget documentation
- Auth: same JWT token as other widget endpoints
- Rate limit: 10 messages per 5 minutes per session
- No conversation persistence — ephemeral, session-scoped

### System Prompt (embedded)
Scoped to: API key setup, embed installation (CargoWise custom panels, Magaya plugins, generic iframe), widget features (calculator, referral, dashboard), troubleshooting (CORS errors, auth failures, rate limits), commission info.

### UI Design
- Chat bubbles: user = right-aligned gold-tinted glass, bot = left-aligned dark glass
- Input: same glass input style as other forms, gold send button
- Typing indicator: 3-dot pulse animation
- Welcome message: "Hi! I can help you set up and use the Fintella widget in your TMS. What do you need help with?"
- Quick-action chips on first load: "How to install", "Troubleshoot", "What can I do?"

---

## 8. Performance

- **Lazy-load WidgetCalculator** — heaviest component (961 lines), use `React.lazy` + Suspense with skeleton loader
- **Cache JWT** in component state (already done via `auth` state)
- **Debounce stats fetch** — prevent double-fetch on rapid tab switching
- **Memoize** calculator results and referral list with `useMemo`

---

## 9. Files to Touch

### Components (restyle + enhance)
- `src/components/widget/WidgetCalculator.tsx` — restyle, blob upload
- `src/components/widget/WidgetDashboard.tsx` — restyle, clickable referrals, confirmation modal
- `src/components/widget/WidgetReferralForm.tsx` — restyle, prefill summary card
- `src/components/widget/WidgetHowItWorks.tsx` — restyle
- NEW: `src/components/widget/WidgetChat.tsx` — AI help assistant
- NEW: `src/components/widget/WidgetFooter.tsx` — powered-by footer

### Pages
- `src/app/widget/page.tsx` — restyle shell, add Help tab, footer, lazy loading
- `src/app/widget/layout.tsx` — dark bg

### API Routes
- `src/app/api/widget/referral/route.ts` — accept `documentUrls`
- `src/app/api/widget/stats/route.ts` — return 10 referrals instead of 5
- NEW: `src/app/api/widget/chat/route.ts` — AI assistant endpoint

### Schema
- `prisma/schema.prisma` — add `documentUrls String[]` to WidgetReferral

### Config
- No new env vars needed (uses existing `ANTHROPIC_API_KEY` for chat, `BLOB_READ_WRITE_TOKEN` for docs)

---

## 10. Out of Scope

- CRM demo page redesign (separate effort)
- Admin widget referrals page (keep as-is)
- TMS Widget Setup page on partner dashboard (keep as-is for now)
- Widget API key auth flow changes (working correctly after PR #830)
