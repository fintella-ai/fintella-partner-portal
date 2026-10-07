# Session State

## ▶️ RESUME HERE — NEXT STEPS
1. **Review draft PR #1270** — `claude/tie-regulatory-update-2026-10-07`: CAPE Phase 3 eligibility logic + Q3/Q4 2026 IRS interest rates. See `docs/regulatory-monitor/2026-10-07.md` for full source citations.
2. **Follow-up (optional, explicit request needed)**: Wire `isCitPlaintiff` flag from dossier/partner data into the API routes that call `checkEligibility()` — currently the flag defaults to `undefined` so Phase 3 routing is never activated. Routes to update: `src/app/api/partner/dossiers/[id]/entries/route.ts`, `src/app/api/partner/dossiers/csv-upload/route.ts`, `src/app/api/tariff/calculate/route.ts`.
3. Optional: decide whether to re-enroll 2FA on `admin@fintella.partners` (John disabled it himself 2026-07-10 to test the embed after losing his codes; found them shortly after but has not re-enabled).
4. If Google sign-in inside the OpCenter embed becomes a real need, build the popup-window OAuth workaround (see `docs/knowledge/opcenter-iframe-embed-auth.md`) — deferred by John since email/password already covers the embed use case.
5. 82 remote branches remain from prior sessions (59 with open PRs, 23 with no PR record) — still untouched pending individual review; not urgent. 10 open DRAFT PRs are daily `claude/tie-*` regulatory/competitive-intel automation reports (#1157–#1165, #1171) — routine, not action items.

🕒 Last updated: 2026-10-07 (automated TIE regulatory monitor run)

## 🌿 Git state
- **Branch**: `main` @ `d46f8758` (#1174 "fix(pwa): use the F brand mark for the installed-app icon, not the full text logo" — live at fintella.partners)
- **Feature branch**: `claude/tie-regulatory-update-2026-10-07` @ `595713f` — pushed, draft PR #1270 open
- **Working tree**: clean

## ✅ What's done (2026-10-07 — automated TIE regulatory monitor)
- **#1270 (DRAFT)** — TIE Regulatory Update: CAPE Phase 3 + IRS Q3/Q4 2026 rates
  - `src/lib/tariff-calculator.ts`: Added `"cape_phase3"` to `FilingMethod` union; added `isCitPlaintiff?: boolean` to `EntryForEligibility`; updated `checkEligibility()` to route finally-liquidated CIT-plaintiff entries to `eligible/cape_phase3` instead of `excluded_expired/litigation`
  - `src/lib/tariff-risk-score.ts`: Added `cape_phase3: 20` to exhaustive `FILING_RISK` Record (between protest=15 and litigation=35)
  - `prisma/seed-data/ieepa-tariff-rates.json`: Added Q3 2026 (7%) and Q4 2026 (7%) IRS interest rate quarters; added `capePhase2` and `capePhase3` documentation blocks
  - `docs/regulatory-monitor/2026-10-07.md`: Full source-cited findings report (6 sections)
  - No buildable next.js available in cloud environment — TypeScript-clean in the changed files; all pre-existing errors are environment-level (no node_modules), not code errors
- **#1175** (prior) — docs: session-state checkpoint — PWA app-icon F mark shipped
- **#1174** (prior) — fix(pwa): use the F brand mark for the installed-app icon

## 🧠 Context that matters for resuming
- CAPE Phase 3 (Oct 6, 2026): finally-liquidated entries for CIT plaintiffs who registered importer-of-record with CBP by July 30, 2026. Pool ~$11.4B. The `isCitPlaintiff` flag must be set by calling API routes from partner dossier data — currently defaults to `undefined` (preserving existing behavior).
- IRS interest rates: Q1–Q2 2026 = 6%; Q3–Q4 2026 = 7% (rates now in seed data through end of 2026).
- CAPE Phase 2 (Jun 29, 2026): No code change was needed — entry types 01/02/06 were already eligible; Phase 2 only added a reconciliation pathway for the subset with pending Type 09 entries. `EXCLUDED_ENTRY_TYPES` set remains `["08", "09", "23", "47"]`.
- Section 122 tariffs expired July 24, 2026 — seed data already had correct `endDate: "2026-07-23"`.
- Section 301 Forced Labor tariffs (replaced Section 122 Jul 24): NOT IEEPA, not refundable via CAPE — out of TIE scope.
- OpCenter is embedding Fintella (and likely other) product surfaces via iframe under a "Partner OS" tab — the SameSite=None+Partitioned+scoped-frame-ancestors pattern in `src/lib/auth.ts` + `src/middleware.ts` is the template.
- John disabled 2FA on his own `admin@fintella.partners` account directly in prod; found his codes but has not re-enrolled. His call.

## 📂 Relevant files for the next task
- `src/lib/tariff-calculator.ts` — FilingMethod union, EntryForEligibility, checkEligibility()
- `src/lib/tariff-risk-score.ts` — FILING_RISK map (exhaustive Record<FilingMethod, number>)
- `prisma/seed-data/ieepa-tariff-rates.json` — IRS interest rates, CAPE documentation blocks
- `docs/regulatory-monitor/2026-10-07.md` — today's findings report
- `src/lib/auth.ts` — NextAuth config, cookie overrides, Google signIn callback (invite-only gate)
- `src/middleware.ts` — auth gate + `withFrameAncestors()` CSP helper
