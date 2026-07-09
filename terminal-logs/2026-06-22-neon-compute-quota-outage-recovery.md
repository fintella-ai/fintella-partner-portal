# Terminal log — 2026-06-22 — Neon Free compute-quota outage + recovery

🌿 main @ `6697c906` (unchanged — NO code changes this session). Live on fintella.partners via redeploy `dpl_Gb8SFuCeVc3smyzhK3uvsNEe1Sdb` (READY 01:08, ready 2026-06-23 ~01:08 UTC).
Working tree: clean except untracked `Kwong Client intake form/` (not ours).

## Incident (production total outage)
John reported: "not authorized to login as admin" + super-admin shows ZERO partners and ZERO deals.

### Root cause (definitive)
**Neon `trln-db` exhausted its Free-plan COMPUTE quota** → Neon disabled compute → every DB query failed with `PrismaClientInitializationError`. This is a can't-connect failure, NOT data loss. Data was intact throughout.

### How it cascaded
- Admin login "not authorized": `authorize()` in `src/lib/auth.ts` (admin-login provider) couldn't query the `User` table → returned null → generic login failure. (`POST /api/auth/callback/admin-login` logged `[auth][error]`.)
- Empty partners/deals: `/api/admin/partners` (unfiltered `findMany`) and `/api/admin/deals` errored → UI rendered empty.
- All `/api/cron/*` 500ing every 5 min.

### Evidence trail (Vercel MCP — project `prj_HGZ9qqBI8KiCsdnZBqlAHVm0O0cm`, team `team_4gzjdd6alC4By7sokALiBFUG`)
1. `get_runtime_logs` (production): every API route + crons + auth callbacks → 500 `PrismaClientInitializationError`.
2. A redeploy **build FAILED** (`get_deployment_build_logs`) at `prisma db push` with: `Schema engine error: ERROR: Your account or project has exceeded the compute time quota. Upgrade your plan to increase limits.` ← the smoking gun.
3. Neon store page showed **Status: Available** (misleading) / **Plan: Free** / **Compute: 42 hours** (over cap).

### Red herring
Vercel team `john-fflaw-projects` was **"Overdue"**. John paid it (worth doing — overdue Vercel can block deploys) but it did NOT restore the DB. The DB problem was 100% on the Neon side.

### Fix that worked
1. Neon org is **managed by Vercel** (native marketplace integration) — plan can't be changed inside Neon ("billing managed by Vercel"). Upgrade in **Vercel → Storage → trln-db → Installation** (or Vercel → Integrations → Neon → Manage).
2. John upgraded `trln-db` Neon Free → paid.
3. Redeploy production (⋯ → Redeploy, cache on). Build's `prisma db push` connected → "The database is already in sync with the Prisma schema." → `next build` → READY.
4. Verified: live `/api/admin/partners`, `/api/admin/deals`, `/api/admin/payouts`, `/api/admin/deals/{id}` all returning **200**. John browsing deals successfully. No more PrismaClientInitializationError.

## Open follow-ups (NOT done — John said "good for now")
- Enable Vercel auto-pay + backup card on `john-fflaw-projects`.
- Keep Neon on paid (done); never run live partner/commission data on Free.
- Add a Sentry alert on `PrismaClientInitializationError` (Sentry already wired via `NEXT_PUBLIC_SENTRY_DSN`) OR an uptime monitor on an API route → early warning before a login failure.
- Optional: consolidate this project + DB billing onto one well-funded team.

## Carried-over (pre-existing, unchanged by this session)
- Onboarding workflow build (deal.onboarding trigger exists) — see `docs/HANDOFF-NEXT-SESSION.md`.
- 2FA-for-partners flip + real enrollment browser-verify.
- ~18+ automated regulatory/CAPE bot PRs open (triage pass).
