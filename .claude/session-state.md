# Session State

🕒 Last updated: 2026-04-19 — admin Team Chat is LIVE; announcement channels spec+plan on main, impl pending

## 🌿 Git state
- **main HEAD:** `43f2d8e` — feat(admin): admin-internal Team Chat with @mentions, deal threads, SSE (#293)
- **origin/main HEAD:** same, in sync
- **Open PRs:** 5 dependabot (#287-291) — see "Dependabot status" below
- **Working tree:** clean on `main`

## ✅ What shipped this session (2026-04-19)
- **#292** docs: admin Team Chat spec + plan
- **#293** feat(admin): admin Team Chat implementation — `/admin/team-chat`, 4 new Prisma models (`AdminChatThread`, `AdminChatMessage`, `AdminChatMention`, `AdminChatReadState`) + `DealNote.sourceChatMessageId`, 7 new API routes, SSE via Postgres LISTEN/NOTIFY on `portal_chat_events`, MentionInput autocomplete component, DealNote mirror for deal-scoped messages, 24h sender edit window, soft delete, per-user read state. `pg@^8.20.0` + `@types/pg` freshly installed. Webhook handler `/api/webhook/referral` changed only by the additive `prisma.$transaction` wrapper (constraint verified).
- **#294** docs: admin announcement channels spec + plan (implementation pending — a separate subagent can execute the 16-task plan when user kicks it)

## 🧪 Deploy verification
- Vercel deploy for #293 initiated on merge. Background task watches the deploy status for commit `43f2d8e`.
- On-prod smoke plan (once deploy completes):
  1. Visit `/admin/team-chat` as super_admin — confirm sidebar entry, Global thread loads
  2. Post `@[John Orlando](john@fintellaconsulting.com)` in Global — confirm notification fires + SSE push is instant
  3. Open a deal's admin-chat thread — confirm mirror `DealNote` appears on `/admin/deals` expansion
  4. Test partner-testing webhook POST to `/api/webhook/referral` with real API key — confirm 201 response unchanged (regression check)

## 🎯 What's next
1. **Implement announcement channels (spec+plan merged as #294)** — dispatch a subagent for the 16-task plan in `docs/superpowers/plans/2026-04-19-admin-announcement-channels.md`. This is the "Feature 2" from the 2026-04-19 brainstorm.
2. **Brainstorm partner-to-downline DM** — deferred sibling feature from the 2026-04-19 brainstorm. Permission model agreed: Tier B (parent↔direct-child only, bidirectional, L1↔L2 + L2↔L3, no skip-level). Privacy model: Tier D (flag-to-super_admin abuse reporting). Needs its own spec+plan cycle.
3. **Admin deals table — timestamp formatting** (flagged as next-easy). Put time on a separate line below the date in `/admin/deals`, both center-aligned. Single-file cosmetic PR. File: `src/app/(admin)/admin/deals/page.tsx` around line 495 where `fmtDateTime(deal.createdAt)` renders.
4. **Outbound network adapter sub-spec 1 implementation** — still pending since 2026-04-18. Plan at `docs/superpowers/plans/2026-04-18-outbound-network-adapter.md`.
5. **Phase 18b** — Next.js 14→16 migration (dedicated session, deferred)

## 🧠 Context that matters for resuming
- **Brainstorm decisions locked in this session (for partner DM + announcement channels):**
  - Partner DM: parent↔direct-child bidirectional (L1↔L2, L2↔L3 only). Privacy = flag-to-super_admin.
  - Announcement channels: admins-only post main feed, partner replies go private to admins (per-partner thread). Hybrid membership: segment rule + manual adds; manual removes are sticky.
  - Call-link message type: URL paste only (no embedded Twilio Video v1). HTTPS-only URL validation.
- **Vercel env (prod):** `WEBHOOK_SKIP_HMAC=true` remains active; `FROST_LAW_API_KEY` set; HubSpot inbound flow verified end-to-end yesterday via live curl.
- **SSE bus:** `portal_chat_events` via Postgres LISTEN/NOTIFY. Admin Team Chat uses it now; announcement channels will share it when implemented. Requires `pg` npm package (installed in #293).
- **Partner-testing webhook:** `/api/webhook/referral` is strictly hands-off beyond the single additive transaction wrapper committed in #293. Any future edit must be explicitly confirmed with John.

## 📂 Relevant files for the next task
- Announcement channels impl: `docs/superpowers/plans/2026-04-19-admin-announcement-channels.md` + `prisma/schema.prisma` (4 new models to add) + new route tree under `src/app/api/admin/channels/*` and `src/app/api/announcements/*`
- Partner DM brainstorm: `prisma/schema.prisma` (Partner model + referredByPartnerCode chain), `src/lib/commission.ts` (chain walk pattern), `src/app/api/admin/chat/route.ts` (existing partner-support chat as reference)
- Timestamp formatting fix: `src/app/(admin)/admin/deals/page.tsx` line ~495 (swap `fmtDateTime` → two-line `fmtDate` + time)

## 📌 Dependabot status (open, do NOT auto-merge per CLAUDE.md)
- **#287** postcss 8.5.9 → 8.5.10 (patch) — safe-ish
- **#288** next-auth 5.0-beta.30 → 5.0-beta.31 (beta) — risky; next-auth betas are breaking
- **#289** typescript 5.9.3 → **6.0.3 (MAJOR)** — blocked per dedicated-session rule
- **#290** @anthropic-ai/sdk 0.88 → 0.90 (0.x minor = breaking) — review required
- **#291** @sentry/nextjs 10.48 → 10.49 (minor) — likely safe
CLAUDE.md says "never merge major-version dependabot PRs without a dedicated migration session". Leave all five for a triage pass in a future session.
