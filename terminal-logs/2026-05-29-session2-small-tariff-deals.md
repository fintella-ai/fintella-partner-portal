# Terminal Log — 2026-05-29 Session 2 — Small Tariff Deals (Tier-1 IEEPA refunds)

**Repo:** tariff-partner-portal · **Branch base:** main · **Final main SHA:** `cacaafa`
**PRs merged this session:** #1083–#1091 (9) · **Open at wrap:** #1091 was merged; handoff PR for these docs.

## Goal
Build the small-deal (Tier-1, <$1M total duties) IEEPA tariff-refund business the big firms (Frost) won't take: use the existing Tariff Intelligence Engine (TIE) to produce clean, human-reviewed substantiated dossiers + a guided self-file kit, monetized via multiple pricing models. Not a law firm, not an AI company.

## Shipped (merged to main)
| PR | Title | Key SHAs |
|----|-------|----------|
| #1083 | TIE calc fixes — 180-day protest window vs 80-day CAPE Phase-1, USMCA/drawback/§232/§301, `classifyDealTier` (<$1M) | 082f293 |
| #1084 | Nav hygiene — remove dead demo/crm + phantom `partner-leads` nav id | 9fad63e |
| #1085 | DIY self-file + upfront-fee engagement funnel (`/recover/tariff-diy`) | 20d5a0f |
| #1086 | Self-file kit — analyze → dossier → paid kit (PDF + CAPE CSV + 12-step guide) | 2d17939 |
| #1087 | Widget fallback upsell + full monetization pricing engine | 30024e4 |
| #1088 | Segmented tariff/Kwong pipelines + `Deal.tags` + frozen Frost-handoff + KPI (`/admin/tariff-deals`) | 1432068 |
| #1089 | fix: case-insensitive forgot-password (silent reset failures) | a86cc57 |
| #1090 | Admin send-reset endpoint (real status) + normalize partner emails on write | b1137b7 |
| #1091 | Per-file volume pricing + "try one → unlock the batch" sample gate | cacaafa |

## Architecture notes
- **No schema migrations except `Deal.tags String[] @default([])` (#1088)** — engagement state lives in `Deal.serviceFields` JSON (mirrors Kwong intake). Build pipeline applies additive schema on deploy.
- **Pricing engine** (`src/lib/tariff-engagement.ts`): `computeEngagementPricing()` covers upfront / per_file_volume / refund_percent (20% default, 15–33% band, hard 33% cap) / dual / widget one-time+per-submission / buyout. Add-ons: legal_review, litigation_guarantee. All env-overridable. `perFileQuote()` powers the sample-gate.
- **Self-file flow:** `/recover/tariff-diy` → `POST /api/tariff/engage/analyze` (persists TariffDossier) → `POST /api/tariff/engage` (deal + SignWell consent) → `POST /api/tariff/engage/[dealId]/pay` (NMI Collect.js, scope-aware) → `GET /api/tariff/engage/[dealId]/kit?format=pdf|csv|guide` (paid-gated; sample = first entry only).
- **NMI:** `chargeOneTime` + buyout primitives `authorizeOneTime`/`captureAuth`/`voidAuth` (auth-hold lifecycle ready).
- **SignWell:** tariff consent template `e1088c29-798a-4056-97be-edfde067c970`; env overrides `SIGNWELL_TARIFF_CONSENT_TEMPLATE_ID`, `SIGNWELL_TARIFF_APP_ID`, `SIGNWELL_TARIFF_SIGNER_ROLE`/`_COSIGNER_ROLE`/`_SIGNER_NAME_FIELD`. Post-sign redirect URL = `https://fintella.partners/recover/tariff-diy/signed`.
- **Deal tags** (`src/lib/tariff-deal-tags.ts`): tariff/kwong/internal_lead/tier1/submitted_to_frost/frost_converted. "Submit to Frost" freezes the deal (no delete, no manual stage move, can't strip tag) + KPI.

## Bug fixed: partner password reset silently failing
Admin-created partner emails were stored verbatim (mixed-case). Login matched case-insensitively, but `/api/auth/forgot-password` matched case-SENSITIVELY → anti-enumeration early-return → no email, no EmailLog. Fix (#1089/#1090): case-insensitive lookups everywhere + lowercase emails on every write + new admin `POST /api/admin/partners/[id]/send-reset` (by id, returns sent/blocked/no_email, logs). Resend confirmed linked (DKIM `resend._domainkey` + `send.fintella.partners` SPF amazonses + `RESEND_API_KEY` set).

## Tests
96 unit assertions green: pricing 21 + deal-tags 9 + calculator 52 + audit 14. Run: `npx tsx src/lib/__tests__/<name>.test.ts`.

## Open items / next (see HANDOFF-NEXT-SESSION.md)
Beast "do these 4" — 1/4 shipped (#1091). Remaining: (2) widget self-serve trial-key, (3) accuracy testing + KPI, (4) buyout module (lending docs pending). Live test needs SIGNWELL_TARIFF_* + NMI env on Vercel.

## Env vars to set on Vercel for live tariff flow
`SIGNWELL_TARIFF_APP_ID`, `TARIFF_UPFRONT_FEE_CENTS`, optional `SIGNWELL_TARIFF_SIGNER_ROLE`/`_COSIGNER_ROLE` (if template placeholders ≠ Taxpayer/Fintella), `TARIFF_WIDGET_UNLOCK_FEE_CENTS`, `TARIFF_WIDGET_PER_SUBMISSION_CENTS`, `TARIFF_PERFILE_TIERS`, `TARIFF_REFUND_PERCENT_BPS`. NMI + RESEND already set.
