# HANDOFF — next session (start here)

🕒 Updated: 2026-07-10 (evening) — #1172 landed on main. Nothing outstanding — clean state to resume from.
🌿 main @ `353d343d` (#1172 "fix(auth): allow login to persist when embedded cross-site in OpCenter's iframe"; LIVE at fintella.partners)

## ⚠️ 2026-06-22 outage (RESOLVED — read if it recurs)
- Whole portal went down: admin login "not authorized" + zero partners/deals + crons 500 = `PrismaClientInitializationError` everywhere = **DB unreachable, NOT data loss**.
- Cause: **Neon `trln-db` Free-plan compute quota exhausted.** Fix: upgraded Neon off Free (managed in **Vercel → Storage → trln-db → Installation**) + redeployed prod.
- The Vercel "Overdue" bill was a RED HERRING (paid it anyway). Full playbook: `docs/knowledge/neon-vercel-db-outage-playbook.md`. Log: `terminal-logs/2026-06-22-neon-compute-quota-outage-recovery.md`.
- **NOT done (John said "good for now"):** Vercel auto-pay + backup card; Sentry alert on `PrismaClientInitializationError` (DSN already set); keep Neon paid.

## Step 0 — on restart
1. `git pull` your clone of `~/tariff-partner-portal`.
2. Read this file. For the OpCenter iframe-embed auth pattern, also read `docs/knowledge/opcenter-iframe-embed-auth.md`.
3. No migration / db-push required this session (no schema changes).
4. **NEVER `npm run build`** on this repo — it runs `prisma db push` against the LIVE prod DB. Use `./node_modules/.bin/next build` (compile-only, safe) or `next dev`. **Confirm before EVERY merge to main** (per-merge gate — hard rule even in beast mode). Never `git add -A`.
5. Squash-merge titles put the PR number at the FRONT (`(#1234) feat: ...`), and session-state/handoff/terminal-log updates need a **timestamp**, not just a date.

## ▶️ Pick up here
1. **OpCenter embed**: email/password login now works inside `opcenter.app`'s iframe embed (#1172, confirmed live by John). Google sign-in inside the embed is still blocked — by Google itself, not fixable via our config (see knowledge doc). Only revisit if Google login inside the embed becomes a real need — it'd need a popup-window OAuth flow.
2. **admin@fintella.partners 2FA**: John disabled his own 2FA on this account 2026-07-10 while testing (lost his codes, found them shortly after, handled it himself). Currently NOT re-enrolled — his call whether/when to turn it back on at `/admin/account`.
3. Same column-customization hooks (`useColumnPrefs`, `useResizableColumnsByKey` in `src/components/ui/ResizableTable.tsx`) from the prior session are reusable — Partners and Payouts admin tables are natural next candidates if John wants the same treatment there.
4. 82 remote branches remain (59 with open PRs, 23 with no PR record at all) — left untouched pending individual review; not urgent. 10 open DRAFT PRs (#1157–#1165, #1171) are routine daily `claude/tie-*` regulatory/competitive-intel automation reports.

## What merged this session (2026-07-10, evening) — LANDED ✅
- #1172 fix(auth): OpCenter iframe-embed login fix — `SameSite=None; Secure; Partitioned` cookies in prod (`src/lib/auth.ts`) + scoped `frame-ancestors` CSP (`src/middleware.ts`). See `docs/knowledge/opcenter-iframe-embed-auth.md` for the full pattern and the Google-OAuth-in-iframe limitation.

No open PRs from this session remain — `main` is fully caught up, working tree clean.

## Reference
- New pattern: `docs/knowledge/opcenter-iframe-embed-auth.md`
- Prior pattern: `docs/knowledge/admin-column-customization-pattern.md`
- Architecture/patterns: `docs/knowledge/2fa-backup-codes-and-recovery.md`
- Tests: `npx tsx src/lib/__tests__/{totp,mfa-recovery}.test.ts` · Build: `./node_modules/.bin/next build`

---
_(Prior handoff — 2026-06-22 Neon outage — is in git history at the previous revision of this file.)_
