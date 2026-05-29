# Tariff: widget trial keys, accuracy KPI, buyout underwriting

Durable architecture notes for the AI agents (Finn/Stella/Tara) and future sessions. Shipped 2026-05-29 (PRs #1093/#1094/#1095).

## Widget self-serve trial key
- **Token format:** `ftk_<keyId>.<secret>` — `keyId` = 16 hex (8 bytes), `secret` = 48 hex (24 bytes).
- **Storage:** `WidgetTrialKey.keyId` is plaintext + `@unique` (fast `findUnique`); `WidgetTrialKey.secretHash` is **bcrypt** of the secret. Never store the raw key.
- **Why this pattern (CodeQL-safe):** API tokens are high-entropy randoms, but CodeQL's `js/insufficient-password-hash` flags fast/keyed hashing of credentials. bcrypt-on-the-secret satisfies the query AND keeps O(1) lookup via the public `keyId`. Do NOT bcrypt-then-findUnique the whole key (bcrypt is salted → not lookup-able).
- **Endpoints:** `POST /api/tariff/widget-trial` (public, IP-rate-limited via `checkPublicRateLimit`) mints a key + optional lead `Deal` (tagged `trial_key`/`widget_upsell`), returns `{apiKey,keyHint,embedSnippet,docsUrl}`. `POST /api/tariff/widget-trial/calculate` (key auth via `X-Trial-Key`/Bearer/body, CORS) returns a PARTIAL result (`toPartialTariffResult`: eligibility+deadlines+filingMethod, refund $ + rate stripped server-side), increments usage, rejects `revoked`.
- **Helpers:** `src/lib/widget-trial.ts` — `generateTrialKey`, `parseTrialKey`, `hashSecret`, `verifyTrialKey`, `getTrialKeyHint`, `toPartialTariffResult`, `buildEmbedSnippet`.
- **UI:** "Get a free trial key" CTA in the CRM/TMS upsell block of `EngageFlow.tsx`; guide at `/docs/widget-trial`.

## Accuracy + KPI
- **Scoring lib (pure):** `src/lib/accuracy-scoring.ts` — `scoreExtraction(expected, actual)` (per-field, type-aware: strings case/space-insensitive, numbers within abs 0.5 / pct 0.5%, dates normalized to calendar day), `scoreCalc(expected, actual, tolPct)` (zero-safe % error), `aggregateRun(items)` (per-field precision + confidence-calibration deciles).
- **Fixtures:** `src/lib/__tests__/fixtures/accuracy-fixtures.ts` — ground-truth `expected` + captured `actual` + confidence + golden eligibility. Seeded `actual==expected` (baseline); replace with real `extractFromImage` output over time.
- **Persistence:** `AccuracyRun` model (JSON: fieldPrecision/confidenceCalibration/calcResults). `POST /api/admin/accuracy-kpi` runs the fixtures (extraction precision + deterministic eligibility accuracy via `checkEligibility`), persists a run, returns drift vs the previous run. Report at `/admin/accuracy-kpi`.

## Buyout underwriting (lending payout EXECUTION deferred)
- **Risk score (pure):** `src/lib/tariff-risk-score.ts` — `computeRiskScore(input)` → 0–100 score + band (low≤25/med≤55/high) + suggested decision + `recommendedBuyoutBps` linearly mapped within `TARIFF_BUYOUT_LOW_BPS`..`HIGH_BPS` (75–85¢). Risk points: ineligible +60, litigation +35/protest +15, drawback +30, AD/CVD +25, deadline-passed +40, needsReview +15, liquidated +10. `deriveRiskInput(dossier, entries)` aggregates worst-case from a `TariffDossier` + `TariffEntry[]`.
- **NMI auth-hold lifecycle:** buyout upfront fee is an AUTHORIZATION HOLD, not a charge. Pay route (`/api/tariff/engage/[dealId]/pay`) calls `authorizeOneTime` for `pricingModel==="buyout"` (stores `upfrontTxnId`, leaves `upfrontStatus:"unpaid"`). Admin decision: **approve → `voidAuth`** (release hold, fee netted from payout); **decline → `captureAuth`** (keep fee). All NMI helpers in `src/lib/nmi-gateway.ts` are demo-safe (no `NMI_API_KEY` → mock success).
- **Admin:** `GET /api/admin/tariff/underwriting/queue` (all admin roles) + `GET/POST /api/admin/tariff/underwriting/[dealId]` (decision = financial roles: super_admin/admin/accounting). UI at `/admin/tariff-underwriting`.
- **State:** lives in `Deal.serviceFields` (`TariffEngagementState.underwritingStatus`); no dedicated model.

## Admin nav registration (required for every new admin route)
Add the id in BOTH: `src/app/(admin)/admin/layout.tsx` (`ADMIN_NAV_IDS_DEFAULT` + `ADMIN_NAV_ITEMS_MAP`) AND `src/app/(admin)/admin/settings/page.tsx` (the `ALL_ADMIN_NAV_ITEMS` list). New ids this session: `tariffUnderwriting`, `accuracyKpi`.
