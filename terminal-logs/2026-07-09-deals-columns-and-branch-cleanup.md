# Terminal log — 2026-07-09 (late night, ~01:00–04:20 EDT)

## What happened
Built admin Deals page column customization (toggle/reorder/CSV-export any of 61 fields), added two repo hard rules, and pruned ~340 stale git branches.

## PRs merged (main advanced 07b60b42 → 96bdc895)
- **#1166** docs: committed orphaned 2026-06-22 Neon outage-recovery docs (fixed live at the time, never committed) + trimmed a stale forward-looking priority list out of the handoff
- **#1167** docs: two new CLAUDE.md hard rules — (a) squash-merge commit titles put the PR number at the FRONT (`(#1234) feat: ...`), not GitHub's default trailing suffix, because Vercel's deployment list truncates long titles; (b) session-state/handoff/terminal-log timestamps need a time component, not just a date, since John runs many sessions per day
- **#1168** feat(admin): Deals column customization — new isomorphic field registry (`src/lib/dealColumns.ts`, 61 fields), client render layer (`dealColumnsUi.tsx`), two new hooks in `ResizableTable.tsx` (`useColumnPrefs`, `useResizableColumnsByKey`, additive — original hook untouched), two modals (`ColumnCustomizeModal.tsx`, `CsvExportModal.tsx`), extended `/api/admin/deals/export` with a `columns=` param (kept server-side + `super_admin`-gated per explicit product decision, not client-side generation). Full pattern documented at `docs/knowledge/admin-column-customization-pattern.md`.

Build process: plan approved in plan mode, then built via ~9 parallel/staged subagents across an isolated worktree (`~/tariff-partner-portal-deals-columns`), model-tiered per task complexity (opus for the high-blast-radius `page.tsx` integration and the security-gated export route, sonnet for well-specified new files, haiku-tier reserved for pure mechanical extraction). `next build` 351/351 routes, `tsc --noEmit` 0 errors, CI green on all three PRs before merge. None of the three PRs were auto-merged by an agent — all three were reviewed and merged by the human-in-the-loop session per this repo's confirm-before-merge hard rule.

## Repo cleanup (explicit John authorization, cross-referenced against real merged-PR records via `gh pr list`, not a heuristic)
- Deleted untracked `Kwong Client intake form/client-intake-dashboard.html` (superseded by tracked code, zero git history, confirmed unrecoverable-but-redundant before deletion)
- Deleted 197 local `claude/*` branches whose PRs were confirmed merged (content already in `main` via squash-merge — zero data loss)
- Deleted 142 remote `claude/*` branches, same confirmed-merged criterion
- Left untouched: 82 remote branches (59 have an open PR, 23 have no PR record at all — need individual review, not blanket-safe to delete) and 10 local branches (no PR record)
- Removed 3 completed feature worktrees (`tariff-partner-portal-deals-columns`, `tariff-partner-portal-claude-md-rule`, plus an agent-internal worktree under `.claude/worktrees/`)

## Open items for next session
- Browser-verify the new Deals column-customization UI live (built + CI-verified, not yet manually clicked through)
- Consider extending the same column-customization hooks to Partners/Payouts admin tables (pattern is documented and reusable)
- The 82 remaining stale-looking branches (59 open-PR, 23 no-record) — individual review if John wants further cleanup
- ~18 automated regulatory/CAPE/competitive-intel/docs bot PRs still open, not blocking — triage pass whenever convenient
