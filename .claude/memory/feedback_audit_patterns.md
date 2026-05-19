---
name: Audit / dead code detection patterns
description: Lessons learned from the 2026-05-19 full admin panel audit — what trips up static grep and what to always verify
type: feedback
---

Always verify agent "dead code" claims before deleting. Static grep misses:

**Why:** The May 2026 audit had multiple false positives that caused or nearly caused real damage.

**How to apply:**
1. **Dynamic imports** (`await import("@/lib/foo")`) — invisible to `grep -r "from.*lib/foo"`. Always search for the bare module name string too.
2. **Lazy-loaded panel components** — `lazy(() => import("../some-panel/page"))` in hub pages. A page can be "orphaned" in the nav but embedded as a panel inside another page.
3. **Prisma child models** — `prisma.childModel` may be zero hits if the parent loads it via `include: { children: true }`. Don't drop child tables just because there's no direct `prisma.childModel` call.
4. **Schema drops are dangerous** — The build script runs `prisma db push --accept-data-loss`. Removing a model from schema will DROP the production table on next Vercel deploy. Always take a Neon snapshot first and get explicit John confirmation.
5. **API routes from UI** — Grep for the URL string in src/ not just the function name. e.g., search `/api/admin/analytics` not just `analyticsRoute`.
6. **"Zero callers" enums** — Prisma enums can be schema-level constraints with no TypeScript usage. That's fine; don't drop them just because no TS code references the enum name.
