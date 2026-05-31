# HANDOFF — next session (start here)

🕒 Updated: 2026-05-31 — 2FA polish + Dependabot triage (wrap)
🌿 main @ `412977c` (LIVE at fintella.partners; prod deploy verified success)

## Step 0 — on restart
1. `git pull` your clone of `~/tariff-partner-portal`.
2. Read this file + `terminal-logs/2026-05-31-2fa-polish-dependabot.md`.
3. No migration / db-push required this session (recovery reuses `PasswordResetToken`; no schema change).
4. **NEVER `npm run build`** on this repo — it runs `prisma db push` against the LIVE prod DB. Use `./node_modules/.bin/next build` (compile-only, safe) or `next dev`. **Confirm before EVERY merge to main** (per-merge gate — hard rule even in beast mode). Never `git add -A`.

## ▶️ Pick up here (priority order)
1. **Flip "Require 2FA for Partners"** (Admin → Settings → Security) + do a **real enrollment** to browser-verify end-to-end (NOT yet browser-verified — needs John's authed enrollment):
   - regenerate backup codes → Copy/Download work,
   - "X of 10 left" counter + ≤2 warning render,
   - **recovery email**: from login (partner) after a failed attempt, "Lost your authenticator?" → confirm the email lands (Resend) → `/mfa-recovery` removes 2FA → forced re-enroll.
2. **Next 14→16 migration (DEFERRED, dedicated session only):** the remaining **14** Dependabot alerts (5 high / 7 med / 2 low) are ALL `next` (14.2.35, patched only in 15.x). Dependabot PR **#1111** (bump next → 16.2.6) is OPEN — do NOT merge without a planned migration session (CLAUDE.md hard rule). 
3. **Cleanup (need John's OK):** delete untracked Kwong HTML, prune ~201 stale local `claude/*` branches, bulk-delete merged remotes (see below).
4. **Other open PRs:** ~18 automated regulatory / CAPE / competitive-intel / docs bot PRs are open (e.g. #1112 Q3 IRS rate 7%, #1104/#1080 S122 CIT). Triage/merge in a docs-review pass — not blocking.

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
