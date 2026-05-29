# Terminal log — 2026-05-29 session 3 — "beast these 4"

**main:** `5de741c` (deployed via Vercel) · **mode:** beast · isolated worktrees

## Shipped (3 PRs)
| PR | Feature | Key files |
|----|---------|-----------|
| #1093 | Widget self-serve trial-key | `src/lib/widget-trial.ts`, `src/app/api/tariff/widget-trial/{route,calculate/route}.ts`, `src/app/docs/widget-trial/page.tsx`, `EngageFlow.tsx`, `WidgetTrialKey` model |
| #1094 | Buyout underwriting (scaffolding) | `src/lib/tariff-risk-score.ts`, `src/app/api/admin/tariff/underwriting/{queue,[dealId]}/route.ts`, `src/app/(admin)/admin/tariff-underwriting/*`, pay-route auth-hold |
| #1095 | Accuracy testing + KPI | `src/lib/accuracy-scoring.ts`, fixtures, `AccuracyRun` model, `src/app/api/admin/accuracy-kpi/route.ts`, `src/app/(admin)/admin/accuracy-kpi/page.tsx` |

Completes the "beast these 4" list (F1 per-file sample-gate was #1091 last session).

## Verification
- All libs TDD'd: widget-trial 14 tests, tariff-risk-score 10, accuracy-scoring 10 (node:assert/strict + tsx).
- `tsc --noEmit`: 0 errors at each merge.
- Each PR: Vercel preview build green + CodeQL green (no suppressions) before merge.

## Schema (additive only)
- `WidgetTrialKey` (#1093): `keyId @unique` + `secretHash` (bcrypt) + status/usage.
- `AccuracyRun` (#1095): run metrics (fieldPrecision/confidenceCalibration/calcResults JSON).
- #1094: NO schema change (uses `Deal.serviceFields` / `TariffEngagementState`).

## CodeQL events (resolved at source, NOT suppressed)
- `js/insufficient-password-hash` on trial-key sha256 → then keyed HMAC still flagged → fixed with prefixed-token pattern `ftk_<keyId>.<secret>` (plaintext keyId @unique lookup + bcrypt secret). Alert gone, lookup stays O(1).
- `js/incomplete-url-substring-sanitization` on a test `url.includes(...)` → rewrote to exact `assert.equal`.

## Governance lessons
- Per-merge confirmation is a HARD gate even in beast mode (auto-mode classifier enforced it). User pre-authorized F3 via AskUserQuestion after F2; F4 merge needed explicit go.
- Never resolve/suppress a CodeQL thread to clear a merge — fix the code.

## Collision state (multi-terminal)
- 3 sibling worktrees live + LOCKED: `admin-2fa-google`, `workflow-token-preview`, `outbound-webhook-dashboard`. They are cut from STALE main (pre-#1083) and rewrite `ADMIN_NAV_IDS_DEFAULT` + schema → they MUST rebase onto current main before merging (will otherwise drop `tariffDeals`/`tariffUnderwriting`/`accuracyKpi` nav + miss new models). My PRs were clean vs current main.
- Built in throwaway worktrees `~/tariff-wt-underwriting` + `~/tariff-wt-accuracy` (removed after merge), node_modules symlinked.

## Open / next
- **Buyout lending payout EXECUTION** still deferred — needs John's lending-partner docs.
- Accuracy fixtures `actual` are seeded == `expected` (clean baseline) — replace with real `extractFromImage` captures as runs accumulate; consider an `accuracy:run` script that pairs fixtures with source images + AI.
- New env var (optional): `WIDGET_TRIAL_SECRET` was introduced then removed in the bcrypt refactor — NOT needed anymore (bcrypt is self-salting).
- Live end-to-end test of `/recover/tariff-diy` still pending John's Vercel env (`SIGNWELL_TARIFF_APP_ID`, `TARIFF_UPFRONT_FEE_CENTS`).
