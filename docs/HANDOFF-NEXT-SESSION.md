# HANDOFF — next session (start here)

🕒 Updated: 2026-07-09 — Committing orphaned 2026-06-22 outage-recovery docs (fixed live, never committed until now); stale forward-looking priority list removed as noise (see git history for prior content).
🌿 main @ `07b60b42` (#1149 "feat(recover): standalone 2025-first estimate form at /recover/estimate"; LIVE at fintella.partners)

## ⚠️ 2026-06-22 outage (RESOLVED — read if it recurs)
- Whole portal went down: admin login "not authorized" + zero partners/deals + crons 500 = `PrismaClientInitializationError` everywhere = **DB unreachable, NOT data loss**.
- Cause: **Neon `trln-db` Free-plan compute quota exhausted.** Fix: upgraded Neon off Free (managed in **Vercel → Storage → trln-db → Installation**) + redeployed prod.
- The Vercel "Overdue" bill was a RED HERRING (paid it anyway). Full playbook: `docs/knowledge/neon-vercel-db-outage-playbook.md`. Log: `terminal-logs/2026-06-22-neon-compute-quota-outage-recovery.md`.
- **NOT done (John said "good for now"):** Vercel auto-pay + backup card; Sentry alert on `PrismaClientInitializationError` (DSN already set); keep Neon paid.

## Step 0 — on restart
1. `git pull` your clone of `~/tariff-partner-portal`.
2. Read this file + `terminal-logs/2026-06-03-deal-stages-onboarding-closedlost.md` + `docs/knowledge/deal-stage-mapping-and-triggers.md`.
3. No migration / db-push required (additive enum/string + workflow registry; no schema change).
4. **NEVER `npm run build`** on this repo — it runs `prisma db push` against the LIVE prod DB. Use `./node_modules/.bin/next build` (compile-only, safe) or `next dev`. **Confirm before EVERY merge to main** (per-merge gate — hard rule even in beast mode). Never `git add -A`.

## Flagged — need John's explicit OK (NOT auto-done)
- Delete untracked `Kwong Client intake form/client-intake-dashboard.html` — superseded by tracked `src/app/(partner)/dashboard/submit-client/kwong/page.tsx` + `src/app/api/kwong-intake/route.ts` + `src/app/intake/kwong/page.tsx`. **Unrecoverable** (never committed) — confirm before `rm`.
- Prune **~202 stale local `claude/*` branches** (mostly merged). Offer: `git branch --merged main | grep claude/ | xargs git branch -d`.
- Bulk-delete merged **remote** branches (auto-classifier blocked the remote delete this session).

## What merged this session
- #1108 regenerate backup codes + "X of 10" counter (partner + admin) — MERGED+LIVE
- #1109 MFA break-glass recovery (password-gated, single-use, 15-min) — MERGED+LIVE
- #1110 Dependabot safe overrides — MERGED+LIVE (`3c6c733`); **open alerts 33 → 14**
- #1113 session handoff + knowledge + terminal-log docs — MERGED (`412977c`)

## Reference
- Architecture/patterns: `docs/knowledge/2fa-backup-codes-and-recovery.md`
- Tests: `npx tsx src/lib/__tests__/{totp,mfa-recovery}.test.ts` · Build: `./node_modules/.bin/next build`

---
_(Prior handoff — OpCenter OLED marketing rollout, 2026-05-29 — is in git history at the previous revision of this file.)_
