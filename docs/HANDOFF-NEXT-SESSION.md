# HANDOFF — next session (start here)

🕒 Updated: 2026-07-09 04:52 EDT — All 4 PRs from this session landed on main (#1166, #1167, #1168, #1169). Nothing outstanding — clean state to resume from.
🌿 main @ `480ab708` (#1169 "docs: session wrap — deals columns + branch cleanup handoff"; LIVE at fintella.partners)

## ⚠️ 2026-06-22 outage (RESOLVED — read if it recurs)
- Whole portal went down: admin login "not authorized" + zero partners/deals + crons 500 = `PrismaClientInitializationError` everywhere = **DB unreachable, NOT data loss**.
- Cause: **Neon `trln-db` Free-plan compute quota exhausted.** Fix: upgraded Neon off Free (managed in **Vercel → Storage → trln-db → Installation**) + redeployed prod.
- The Vercel "Overdue" bill was a RED HERRING (paid it anyway). Full playbook: `docs/knowledge/neon-vercel-db-outage-playbook.md`. Log: `terminal-logs/2026-06-22-neon-compute-quota-outage-recovery.md`.
- **NOT done (John said "good for now"):** Vercel auto-pay + backup card; Sentry alert on `PrismaClientInitializationError` (DSN already set); keep Neon paid.

## Step 0 — on restart
1. `git pull` your clone of `~/tariff-partner-portal`.
2. Read this file. For the new column-customization pattern, also read `docs/knowledge/admin-column-customization-pattern.md`.
3. No migration / db-push required this session (all additive, no schema changes).
4. **NEVER `npm run build`** on this repo — it runs `prisma db push` against the LIVE prod DB. Use `./node_modules/.bin/next build` (compile-only, safe) or `next dev`. **Confirm before EVERY merge to main** (per-merge gate — hard rule even in beast mode). Never `git add -A`.
5. **NEW hard rules (added this session, in CLAUDE.md's Git workflow / Session continuity sections):** squash-merge titles put the PR number at the FRONT (`(#1234) feat: ...`), and session-state/handoff/terminal-log updates need a **timestamp**, not just a date.

## ▶️ Pick up here
1. **Admin → Deals**: try the new "🧩 Columns" button (toggle/drag-reorder any of 61 fields as table columns) and "📥 Export CSV" (now opens a popup pre-checked to your visible columns, still `super_admin`-gated server-side). Browser-verify visually — this was built and CI-verified but not yet manually clicked through in a live browser session.
2. Same column-customization hooks (`useColumnPrefs`, `useResizableColumnsByKey` in `src/components/ui/ResizableTable.tsx`) are reusable — Partners and Payouts admin tables are natural next candidates if John wants the same treatment there.
3. 82 remote branches remain (59 with open PRs, 23 with no PR record at all) — left untouched pending individual review; not urgent.

## What merged this session (2026-07-09, evening/late-night) — ALL LANDED ✅
- #1166 docs: committed orphaned 2026-06-22 Neon outage-recovery docs + refreshed stale handoff
- #1167 docs: two new hard rules (PR# at front of squash-merge titles; timestamp session docs)
- #1168 feat(admin): Deals column customization + drag reorder + server-gated CSV export (`src/lib/dealColumns.ts`, `dealColumnsUi.tsx`, `ColumnCustomizeModal.tsx`, `CsvExportModal.tsx`, extended `/api/admin/deals/export`, two new hooks in `ResizableTable.tsx`)
- #1169 docs: session-wrap handoff + knowledge doc + terminal log for the above

No open PRs from this session remain — `main` is fully caught up, working tree clean.

## Reference
- New pattern: `docs/knowledge/admin-column-customization-pattern.md`
- Architecture/patterns: `docs/knowledge/2fa-backup-codes-and-recovery.md`
- Tests: `npx tsx src/lib/__tests__/{totp,mfa-recovery}.test.ts` · Build: `./node_modules/.bin/next build`

---
_(Prior handoff — 2026-06-22 Neon outage — is in git history at the previous revision of this file.)_
