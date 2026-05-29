# HANDOFF — Next Session (updated 2026-05-29, Session 3: "beast these 4" COMPLETE)

## Step 0 — startup
1. `git pull` (latest `main` = `5de741c`).
2. Read `docs/knowledge/tariff-trial-key-and-underwriting.md` + `docs/knowledge/tariff-diy-engagement.md` (durable architecture) + `terminal-logs/2026-05-29-session3-beast-these-4.md` (what shipped).
3. Repo is LIVE prod (real partner data). Additive schema only; preview-test schema changes first. Never `git add -A`. **Confirm before EVERY merge to main** (per-merge gate — hard rule even in beast mode).

## What's done — "beast these 4" ALL SHIPPED
- **1. Per-file sample-gate** — #1091 (session 2).
- **2. Widget self-serve trial-key** — #1093. `WidgetTrialKey` (`keyId @unique` + bcrypt `secretHash`, prefixed token `ftk_<keyId>.<secret>`), public mint + partial `/calculate`, `/docs/widget-trial`, EngageFlow CTA.
- **3. Accuracy testing + KPI** — #1095. `accuracy-scoring` lib + fixtures + `AccuracyRun` model + `GET/POST /api/admin/accuracy-kpi` + `/admin/accuracy-kpi` report.
- **4. Buyout underwriting (scaffolding)** — #1094. `tariff-risk-score` lib, NMI auth-hold on the pay route for buyout, underwriting queue + decision API/pages (approve→void / decline→capture).

## ▶️ RESUME HERE — remaining tariff work
1. **Buyout lending-payout EXECUTION** — still deferred, BLOCKED on John's lending-partner docs. When they land: build the payout endpoint that reads the approved underwriting decision + advances the buyout %.
2. **Real accuracy runs** — fixtures' `actual` is seeded == `expected` (baseline). Replace with real `extractFromImage` captures; consider an `accuracy:run` script pairing fixtures with source CF-7501 images + the AI extractor.
3. **Sibling-worktree coordination** — `admin-2fa-google` / `workflow-token-preview` / `outbound-webhook-dashboard` are on STALE main (pre-#1083) and will conflict on `ADMIN_NAV_IDS_DEFAULT` + schema; they must rebase before merging.

## Then — live end-to-end test (needs John's Vercel env)
Set: `SIGNWELL_TARIFF_APP_ID` (+ redirect URL `https://fintella.partners/recover/tariff-diy/signed`), `TARIFF_UPFRONT_FEE_CENTS`, optional `SIGNWELL_TARIFF_SIGNER_ROLE`/`_COSIGNER_ROLE` (if template `e1088c29…` placeholders ≠ Taxpayer/Fintella). Confirm `e1088c29…` is a SignWell *template* (not a workflow). Then drive `/recover/tariff-diy` end-to-end (consent + charge + kit).

## Verify Jennifer's reset (after #1090 deploy)
Partner page → "Send Reset Link" → expect a definitive `sent` / `blocked` / `no email` result + an EmailLog row.

## Notes
- 3 locked worktrees exist (other terminals): `admin-2fa-google`, `workflow-token-preview`, `outbound-webhook-dashboard` — branch off clean `main`, avoid those.
- `.claude/session-state.md` writes are DEFERRED (sibling `~/ops-center` clone holds it dirty — collision risk). Use this handoff + the terminal log as resume source of truth.
- 20+ open PRs (#988–#1080) are pre-existing automated regulatory/dependabot bot PRs — not from this session.
