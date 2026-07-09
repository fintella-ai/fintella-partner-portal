# Knowledge — DB connection outage playbook (Neon + Vercel)

Durable runbook for diagnosing a sudden production outage where the app can't reach Postgres. Written after the 2026-06-22 incident.

## Signature to recognize
- Admin login fails ("not authorized") **and** super-admin sees ZERO partners and ZERO deals **and** crons 500 — all at once.
- This combination = **the app cannot connect to the database**, NOT data loss and NOT a code bug. The unfiltered admin list queries can only return empty if the connection itself fails (or 500s).

## Diagnose (fastest path)
1. Vercel runtime logs (production): if you see `PrismaClientInitializationError` on essentially every route + crons + `/api/auth/callback/*`, it's a connection failure.
2. Trigger/inspect a build: `prisma db push` runs in the build (`prisma generate && prisma db push --accept-data-loss && node scripts/seed-all.js && next build`). The build log gives the precise cause, e.g.:
   - `ERROR: ... exceeded the compute time quota` → **Neon Free compute quota exhausted** (see fix).
   - auth-failed / can't-reach → stale/rotated credentials or wrong endpoint.

## Key gotchas
- **Neon "Status: Available" is misleading** — a Free project can show Available while compute is quota-throttled. Check **Plan** and **Compute hours** on the store page, not just status.
- **The Neon org is managed by Vercel** (native marketplace integration). The Neon console says "billing managed by Vercel" and offers no plan change. Change the plan in **Vercel → Storage → `trln-db` → Installation** (or Vercel → Integrations → Neon → Manage).
- A **Vercel "Overdue" team bill is a separate problem** from a Neon outage. Pay it (overdue Vercel can block deploys), but it will NOT fix a Neon compute-quota throttle.
- The app connects via `DATABASE_URL` (pooled) + `DIRECT_URL` (direct), pgvector enabled. `src/lib/prisma.ts` uses a bare `new PrismaClient()`.

## Fix for compute-quota exhaustion
1. Upgrade Neon off Free (Launch tier) in Vercel → Storage → Installation.
2. Redeploy production (Deployments → top prod deploy → ⋯ → Redeploy, build cache on). A redeploy is needed because the build re-runs `prisma db push`, and it also re-establishes connections.
3. Confirm green: build shows "The database is already in sync with the Prisma schema"; runtime logs show `/api/admin/partners` + `/api/admin/deals` returning 200.

## Prevention
- Never host live partner/commission/audit data on Neon Free — the monthly compute cap is a built-in outage.
- Enable auto-pay + backup card on the Vercel team.
- Alert on `PrismaClientInitializationError` via Sentry (`NEXT_PUBLIC_SENTRY_DSN` already configured) or an uptime monitor on an API route, so a DB outage surfaces in minutes rather than via a failed login.
