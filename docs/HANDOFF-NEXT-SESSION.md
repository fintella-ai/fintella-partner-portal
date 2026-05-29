# HANDOFF — Next Session (updated 2026-05-29, Session 2: Small Tariff Deals)

## Step 0 — startup
1. `git pull` (latest `main` = `cacaafa`).
2. Read `docs/knowledge/tariff-diy-engagement.md` (durable architecture) + `terminal-logs/2026-05-29-session2-small-tariff-deals.md` (what shipped).
3. Repo is LIVE prod (real partner data). Additive schema only; preview-test schema changes first. Never `git add -A`. Confirm before merge to main.

## What's done (merged this session — #1083–#1091)
Small-deal IEEPA tariff-refund build: TIE calc fixes, nav hygiene, DIY self-file funnel (`/recover/tariff-diy`), self-file kit (PDF+CSV+guide), full monetization pricing engine, widget fallback upsell, deal tags + segmented tariff/Kwong pipelines + frozen Frost-handoff KPI (`/admin/tariff-deals`), per-file sample-gate, and a password-reset case-sensitivity fix + admin send-reset endpoint. 96 unit tests green.

## ▶️ RESUME HERE — remaining "beast these 4" (1/4 shipped)
**2. Widget self-serve trial-key** *(next — additive schema)*
- New `WidgetTrialKey` model: `keyHash` (sha256, @unique), `keyHint`, `email`, `company`, `platform`, `dealId?`, `status` (trial/upgraded/revoked), `usageCount`, `createdAt`, `lastUsedAt`.
- `POST /api/tariff/widget-trial` (public, from the CRM/TMS upsell on `/recover/tariff-diy`): create key + optional lead Deal; return `{apiKey, embedSnippet, docsUrl}`.
- `POST /api/tariff/widget-trial/calculate` (key-auth via header/body): run TIE but return **partial** (eligibility + counts + deadlines; refund $ hidden/locked). Increment usage. Pay → full unlock via the existing engage flow.
- UI: add "Get a free trial key" to the widget upsell block in `EngageFlow.tsx` (show key + 1-line embed snippet + "upgrade for full calc").

**3. Accuracy testing + KPI reporting**
- Labeled fixtures (known CF 7501 / ACE samples + expected values) → run through `src/lib/document-intake.ts` (AI extraction) + the calculator → score field-extraction precision + calc accuracy vs expected.
- `/admin` accuracy-KPI report: per-field precision, confidence calibration, drift over time. Optional `AccuracyRun` model to persist results.

**4. Buyout module** *(partial — lending-partner docs pending)*
- Underwriting **request** flow + auto risk-score (appeal-stay, AD/CVD, drawback, liquidation status, rejection likelihood — all derivable from the audit engine).
- NMI **auth-hold** lifecycle: `authorizeOneTime` on engage → admin approve = `voidAuth` (fee netted from lending payout) / decline = `captureAuth` (keep fee). Primitives already in `src/lib/nmi-gateway.ts`.
- Admin underwriting queue. **Skip the actual lending payout execution** until John's lending docs land.

## Then — live end-to-end test (needs John's Vercel env)
Set: `SIGNWELL_TARIFF_APP_ID` (+ redirect URL `https://fintella.partners/recover/tariff-diy/signed`), `TARIFF_UPFRONT_FEE_CENTS`, optional `SIGNWELL_TARIFF_SIGNER_ROLE`/`_COSIGNER_ROLE` (if template `e1088c29…` placeholders ≠ Taxpayer/Fintella). Confirm `e1088c29…` is a SignWell *template* (not a workflow). Then drive `/recover/tariff-diy` end-to-end (consent + charge + kit).

## Verify Jennifer's reset (after #1090 deploy)
Partner page → "Send Reset Link" → expect a definitive `sent` / `blocked` / `no email` result + an EmailLog row.

## Notes
- 3 locked worktrees exist (other terminals): `admin-2fa-google`, `workflow-token-preview`, `outbound-webhook-dashboard` — branch off clean `main`, avoid those.
- `.claude/session-state.md` writes are DEFERRED (sibling `~/ops-center` clone holds it dirty — collision risk). Use this handoff + the terminal log as resume source of truth.
- 20+ open PRs (#988–#1080) are pre-existing automated regulatory/dependabot bot PRs — not from this session.
