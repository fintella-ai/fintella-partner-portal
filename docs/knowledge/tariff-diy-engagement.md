# Knowledge: Tariff DIY Engagement & Monetization (small-deal IEEPA refunds)

Durable reference for the small-deal (Tier-1, <$1M total duties) IEEPA tariff-refund product. For the product AI (Finn/Stella/Tara) and future sessions.

## Positioning (legally safe — use verbatim)
"Human-reviewed tariff-refund analysis & substantiated dossier preparation. Fintella is not a law firm and does not provide legal advice; we prepare your refund file and connect you to licensed filing and legal partners." Never market as "an AI company." AI (document-intake) is an internal tool; every file is human-reviewed. Refund estimates are never a guarantee of approval.

## Hard regulatory constraints (drive the product)
- Only the **Importer of Record (IOR)** or the **original licensed customs broker** can file a CAPE Declaration. Fintella cannot file directly → DIY self-file kit, or a broker/law-firm partner.
- CIT litigation requires attorneys (UPL risk) → litigation only via the law-firm partner.
- Deadlines: CAPE Phase 1/2 = unliquidated + liquidated ≤80 days; **protest deadline = 180 days** (19 U.S.C. §1514); past that → CIT litigation only. Phase 3 (finally liquidated) = CIT litigants only.
- Refunds: ACH only, 60–90 days post-acceptance. ~15% CAPE rejection rate → clean-file prep is the moat.
- Buyout/advance constrained by the Assignment of Claims Act → must be a proceeds-purchase (importer stays claimant) + UCC-1 + lender-controlled ACH; CBP won't recognize the security interest.
- Scope live product to **IEEPA only** (Section 122 still stayed; plaintiffs-only).

## Calculator (TIE) eligibility — `src/lib/tariff-calculator.ts`
- `checkEligibility()` returns `filingMethod`: `cape_phase1` (unliq or ≤80d liquidated) / `cape_phase2` (reconciliation-flagged 01/02/06 entries where Type 09 not yet filed, OR unliquidated AD/CVD entries — Phase 2 launched June 29, 2026) / `protest` (80–180d) / `litigation` (>180d) / `none`.
- Exclusions: drawback (`excluded_drawback`), USMCA CA/MX after 2025-03-07 (`excluded_usmca`), entry types 08/09/23/47 (all CAPE phases). **Unliquidated AD/CVD is NO LONGER excluded — Phase 2 covers it** (route to `cape_phase2` with `needsReview`).
- Reconciliation-flagged (01/02/06): **SEQUENCING CRITICAL** — CAPE declaration must be filed BEFORE the Type 09 reconciliation entry. Once Type 09 is filed, the underlying entries are CAPE-ineligible.
- §232 (Annex II exempt) + §301 (non-refundable) → `needsReview` flag, not auto-disqualify.
- Phase 3 (finally liquidated entries): CIT litigants only, on track late July 2026. Not modeled in calculator — `protest`/`litigation` routing covers non-litigant cases correctly.
- `classifyDealTier(totalDuties)` → `tier1` (<$1M) | `standard`.

## Pricing engine — `src/lib/tariff-engagement.ts`
`computeEngagementPricing(model, {fileCount, refundCents, addOns})` → `{upfrontCents, backendBps, lineItems}` (receipt-ready). Models: `upfront` ($500) · `per_file_volume` (1=$250 sample, 2–5=$150, 6–20=$99, 21+=$59/file) · `refund_percent` (20% default, **15–33% band, hard cap 33%**, on top of upfront) · `dual` (upfront + backend %) · `widget_onetime` ($1,500) / `widget_per_submission` ($99) · `buyout` (auth-hold, pending underwriting; 75–85¢/$). Add-ons: `legal_review` (upfront+backend), `litigation_guarantee` (upfront). `perFileQuote()` = sample/full/remainder for "try one → unlock batch" (sample credited toward full). All amounts env-overridable (`TARIFF_*_CENTS`, `TARIFF_*_BPS`, `TARIFF_PERFILE_TIERS` JSON).

## Engagement flow (all state in `Deal.serviceFields`)
1. `POST /api/tariff/engage/analyze` — public, rate-limited; runs TIE; persists `TariffDossier` (source public_calculator). Returns dossierId + summary + tier.
2. `POST /api/tariff/engage` — creates Deal (`serviceOfInterest="IEEPA Tariff Refund (DIY)"`, tags tariff/internal_lead/tier1), sends SignWell consent (Fintella cosigner). Returns signingUrl + pricing + perFile quote.
3. `POST /api/tariff/engage/[dealId]/pay` — NMI Collect.js charge, **scope-aware** (`sample`|`full`); idempotent; advances stage to `client_engaged`; kit email on full unlock.
4. `GET /api/tariff/engage/[dealId]/kit?format=pdf|csv|guide` — paid-gated; sample tier → first eligible entry only; full → all.

## Deal tags & pipelines — `src/lib/tariff-deal-tags.ts`
`Deal.tags String[]`. Filters: `?service=tariff|kwong`, `?tag=`. Admin `/admin/tariff-deals` = service toggle + tag filters + Frost-funnel KPI (sent/converted/rate/$). **Submit to Frost** (`PUT /api/admin/deals/[id]` `{submitToFrost:true}`) snapshots handoff + freezes (no delete, no manual stage move, can't strip frost tag). `markFrostConverted` for KPI.

## Email case-sensitivity rule (learned 2026-05-29)
Partner emails MUST be normalized to lowercase on write (all create/update/signup paths do this now) and looked up case-insensitively (`mode:"insensitive"`) — login + password reset both depend on it. A case-sensitive lookup silently drops mail for mixed-case emails.
