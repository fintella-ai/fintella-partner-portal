# Fintella Partner Portal — Launch Status

> **Status as of 2026-04-14**
> Document maintained alongside `.claude/session-state.md`. When in doubt, this
> file reflects the **product-level** state the portal is in right now; the
> session-state file reflects the **current Claude session's** in-flight work.

---

## 🚀 Production environment

- **Primary domain**: https://fintella.partners (SSL, Vercel, iad1)
- **Legacy domain**: https://trln.partners (still resolves; redirect to come)
- **Repository**: https://github.com/fintella-ai/tariff-partner-portal (branch protected on `main`)
- **Hosting**: Vercel project `tariff-partner-portal-iwki` (`prj_HGZ9qqBI8KiCsdnZBqlAHVm0O0cm`)
- **Database**: Neon PostgreSQL (`ep-lively-cherry-an8cyy9s.c-6.us-east-1.aws.neon.tech`)
- **Latest production commit**: `5feb3fe` (PR #77 — regression-sweep fixes, merged 2026-04-14)
- **Latest verified production deployment**: `dpl_H6TfaeEz5cnorq2u3orShNjTbjSU` (READY)
- **Build size**: 97 static pages, clean build (only pre-existing `global-error.tsx` Sentry deprecation warning)

---

## ✅ Ready — shipped and verified

### Partner-facing portal
- Partner login / signup (invite-only, email + password)
- Home feed, overview stats, deals dashboard with pipeline tracker
- Commissions view (L1 / L2 / L3 waterfall, per-deal breakdown)
- Downline tree
- Training modules + Live Weekly (conference) page
- Submit Client (Frost Law iframe) with agreement gate
- Referral Links with tiered invite generation (L1 → L2 @ 10/15/20%, L2 → L3 if enabled)
- Documents upload
- Account Settings with email + SMS opt-in toggles
- Support tickets
- Feature requests
- **Fintella PartnerOS AI assistant** (Claude Sonnet 4.6, prompt caching, per-partner daily budget + message limits)
- Agreement gate blocking Submit Client + Referral Links until both the partnership agreement is signed AND the partner row is active (defense-in-depth — post-PR #77)

### Admin portal
- Partners (list, detail, notes, communication log, sudo impersonation)
- Deals (list, detail, stage management, notes) with **"Mark Payment Received" workflow** (PR #71) that transactionally stamps the Deal, creates `CommissionLedger` entries with `status="due"`, flips commission status, and writes a system `DealNote` audit entry
- Revenue / custom commissions / enterprise reporting
- Payouts (batch creation, approval, processing, EP overrides calculated on the fly)
- Support (ticket management)
- Chat (live agent panel)
- Communications Hub (Email + SMS + Voice logs)
- Documents (admin uploads)
- Training management
- Live Weekly (conference) management
- Feature request triage
- User management (super_admin only)
- Settings (portal config — super_admin only post-PR #77)
- **Development page** (`/admin/dev`) with live GitHub feed + Sentry errors panel + webhook test harness (super_admin only)

### Data layer
- Prisma 5.20 against Neon PostgreSQL
- Hub-and-spoke architecture: Fintella owns partners / commissions / reporting; Frost Law is a spoke that pushes referral submissions via webhook
- Idempotent seed pipeline (`seed-all.js`) covering admin, partners, deals, conference, portal settings
- Auto-migrations on every build via `prisma db push --accept-data-loss` (pre-launch safe)
- Admin seed hardened against default-password creation in production (PR #53)

### Integrations
- **SignWell e-signature** (`src/lib/signwell.ts`) — 4-template system by commission rate (25/20/15/10%), embedded signing iframe, webhook handler that flips `PartnershipAgreement.status = "signed"` AND `Partner.status = "active"` on `document_completed` (PR #76)
- **SendGrid transactional email** (`src/lib/sendgrid.ts`, Phase 15a) — raw `fetch()` against v3 REST, demo-mode fallback, 4 templates (welcome, agreement_ready, agreement_signed, signup_notification), every send audits to `EmailLog` even in demo / failed states, fire-and-forget so transient failures never block signup / agreement flows
- **Twilio SMS** (`src/lib/twilio.ts`, Phase 15b) — raw `fetch()` against v2010 REST, TCPA opt-in gate enforced BEFORE every network call (non-opted-in partners get a `skipped_optout` audit row), 4 templates matching the SendGrid set, inbound STOP/START webhook (Phase 15b-fu) flips `Partner.smsOptIn` automatically, signature verification via `TWILIO_AUTH_TOKEN`
- **Twilio Voice** (`src/lib/twilio-voice.ts`, Phase 15c) — bridged click-to-call flow (admin dials admin phone first → on answer, Twilio bridges partner's mobile), full `CallLog` audit, recording intentionally deferred to 15c-followup pending state-by-state consent handling
- **HubSpot** — demo-mode only (real integration explicitly **descoped** — see "Descoped" section)
- **Anthropic Claude** — Sonnet 4.6 with prompt caching, per-partner daily budget + message limits, separate accounting for cache-read vs cache-write tokens (PR #77 fixed the cost math)
- **Sentry** — error tracking + deployment notifications (Phase 18a)
- **Vercel Analytics** + **Speed Insights** — production telemetry (Phase 18a)
- **PWA** — manifest, install prompt, safe-area handling, offline-ready login shell

### Security
- Auth: **NextAuth.js 5.0-beta.22** with JWT sessions, dual credential providers (admin: email+password, partner: email+password with legacy partnerCode fallback)
- Role-based access with **4 admin roles**: `super_admin`, `admin`, `accounting`, `partner_support` — each API route role-gated at the handler level with the following post-PR #77 matrix:
  - `/api/admin/impersonate` POST — `{super_admin, admin}` only (CRITICAL fix)
  - `/api/admin/payouts` POST — `{super_admin, admin, accounting}` (HIGH fix)
  - `/api/admin/settings` PUT — `super_admin` only (HIGH fix)
  - `/api/admin/dev/*` — `super_admin` only
  - Read GETs on most resources — all 4 admin roles
- Branch protection on `main` via GitHub ruleset (PR required, no force push, no deletion, CodeQL + Vercel checks must pass)
- Dependabot active with ignore rule for major bumps (PR #58) — current queue is 0 after the 8 major-bump PRs were closed this session
- CodeQL scanning on every PR + main push
- Private vulnerability reporting + secret scanning + push protection enabled
- **Webhook hardening** (PR #74): `/api/webhook/referral` now enforces API-key auth (dual-scheme: `X-Fintella-Api-Key` primary + legacy `x-webhook-secret` still accepted), 60 req/60s rate limit with `Retry-After`, idempotency enforcement via `Deal.idempotencyKey` with replay-safe 200 responses, input validation (event-type whitelist, JSON shape check), HMAC signature code prep (log-only, not yet enforced pending Frost Law cutover)
- **Impersonation tokens**: 32-byte random hex, 60-second TTL, single-use, deleted from DB after first consumption (PR #77 tightened from the old 15-minute TTL)
- **Admin legacy orphan** (`admin@trln.com`): still present in DB as a pre-rebrand artifact. No active code path references it as special. Harmless but should be deleted manually via `/admin/users` when convenient.

### Compliance / legal
- **Privacy Policy** live at https://fintella.partners/privacy (PR #73) — 11 sections, TCR-required SMS disclosures present verbatim (STOP/HELP, message frequency varies, msg & data rates may apply, opt-in not shared with third parties, opt-in not a condition of registration)
- **Terms and Conditions** live at https://fintella.partners/terms (PR #73) — 12 sections, program name "Fintella Partner Notifications", carrier disclosure, Florida governing law, conditional commission language
- **Frost Law webhook integration guide** at https://fintella.partners/docs/webhook-guide (PR #75) — documents full post-hardening contract: auth schemes, rate limit, idempotency, HMAC prep, error codes + retry schedule, 3 worked cURL examples
- TCPA: every SMS send checks `Partner.smsOptIn` before the network call; inbound STOP/START webhook flips opt-in state automatically; every send (including skipped ones) is logged to `SmsLog` for audit

---

## 🟡 Pending — started, waiting on external

1. **Twilio A2P 10DLC campaign approval** — submitted to TCR on 2026-04-14. Brand approval typically clears overnight (1–3 days); **campaign approval is the critical path blocker at 10–15 business days.** Expected window: **2026-04-28 – 2026-05-05**. SMS delivery is demo-mode-gated until approval lands; the moment the env vars + a green campaign register in Twilio, real SMS flows automatically (no code change needed).
2. **SendGrid domain authentication** — started 2026-04-14, DNS records added to provider. Propagation window: 15 minutes to 48 hours. Verify button in SendGrid settings will flip the status when DNS propagates. Single Sender Verification is the interim path for sending from `john@fintellaconsulting.com` while domain auth completes. Email delivery works today via demo mode and logs to `EmailLog`.
3. **Send `FROST_LAW_API_KEY` to Frost Law's IT team** — key is set in Vercel env vars (`FROST_LAW_API_KEY`) and referenced by the hardened webhook at `/api/webhook/referral`. Needs to go to Frost Law via a secure channel (1Password share / Signal / in-person). Point them at https://fintella.partners/docs/webhook-guide for the integration spec. Legacy `x-webhook-secret` header still accepted, so their existing integration (if any) keeps working during cutover.

---

## ⚠️ Known limitations

### Intentional deferrals
- **Voice recording**: the Twilio Voice bridge does NOT yet record calls. State-by-state legal disclosure requirements (CA / WA / FL / IL all-party consent) require a `<Gather>` IVR consent prompt before `<Dial>`, plus per-state config. Deferred to Phase 15c-followup. DB columns + UI hooks for `recordingUrl` already wired in so the followup is a drop-in.
- **Auto-create CommissionLedger entries on closed_won transition**: currently the ledger is only populated when an admin clicks "Mark Payment Received" (PR #71). Partners only see commissions after admin confirms the firm has paid Fintella the override. If we want partners to see "pending" commissions the moment a deal closes, a followup can add upstream ledger writes to the deal PUT route and the webhook PATCH handler. Current behavior is arguably correct (avoids showing partners money that hasn't been paid yet).
- **HMAC enforcement on `/api/webhook/referral`**: code is live and log-only. Flipping to hard enforcement is a one-line change in `src/app/api/webhook/referral/route.ts` `verifyHmacSignature()`. Coordinate with Frost Law before flipping.
- **`@@unique([dealId, partnerCode, tier])` belt-and-suspender on `CommissionLedger`**: the existing 409 idempotency in the payment-received route is sufficient in practice. Future hardening, not a real gap.

### Technical debt
- **Next.js 14.2.35 → 16 migration** (Phase 18b): closes 5 remaining DoS-only CVEs on `next`. Major migration — React 18 → 19, `middleware.ts` → `proxy.ts`, App Router caching opt-in model changes, Turbopack as default. Requires a dedicated test session. Deferred; verified on 2026-04-13 that no safe intermediate version exists (Next 15.x still has 2 of the 5 CVEs).
- **Dependabot major-bump queue** (closed this session): `@prisma/client` 7.7, `prisma` 7.7, `tailwindcss` 4.2, `typescript` 6.0, `bcryptjs` 3.0 (ESM + new `$2b$` hash), `@vercel/analytics` 2.0, `@vercel/speed-insights` 2.0, `@types/node` 25. All 8 closed with "major version bump — dedicated migration session required" comments. They will land naturally as part of the Phase 18b migration window.
- **`AiUsageDay` denormalization**: the daily AI usage table only stores `messageCount` + `totalCostUsd`, not per-token-type counts. Per-message token counts exist in `AiMessage`. Fine for cost accounting, limits daily reporting granularity. Optimization opportunity, not a bug.

### Descoped (do NOT reintroduce)
- **Phase 14 — HubSpot integration**: Fintella does NOT run its own HubSpot. Frost Law owns the CRM and pushes deal data via `POST /api/webhook/referral` + `PATCH` for lifecycle updates. Outbound HubSpot sync is not needed. Demo-mode stubs in `src/lib/hubspot.ts` may be removed later or kept for optional future use.

---

## 🗺️ Post-launch roadmap

Items that matter for the portal's evolution but are not launch-blocking:

1. **Mercury banking reconciliation** — automatically match Frost Law's override payments arriving in the Fintella bank account against `Deal.firmFeeAmount` on closed-won deals. Would remove the manual "Mark Payment Received" step for the clean cases. Depends on Mercury API access + reliable memo-line matching.
2. **Twilio Voice — state-by-state consent + recording** (Phase 15c-followup) — flip on `Record=true` + `<Gather>` consent IVR + per-state config table. Required for compliance in CA / WA / FL / IL.
3. **Auto-create `pending` CommissionLedger entries on `closed_won` transition** — shows partners "pending" commissions the moment a deal closes, before admin confirms payment.
4. **Finn + Stella dual-personality AI** (Phase 17b) — split the single "Fintella PartnerOS" assistant into two voices: Finn (direct, data-driven) and Stella (warm, relationship-focused). Current setup is a placeholder per CLAUDE.md.
5. **Stripe Connect partner payouts** (Phase 16) — actually pay partners directly from the portal instead of manual payout batches. Multi-hour implementation, requires Stripe Connect onboarding flow + new `StripeAccount` Prisma model.
6. **Next.js 14 → 16 upgrade** (Phase 18b) — closes 5 remaining DoS-only CVEs, lets the closed dependabot PRs land, modernizes the framework layer.
7. **Enforce HMAC signatures on `/api/webhook/referral`** — flip from log-only to hard-reject once Frost Law is signing.
8. **Full regression test suite** — currently tested manually. Adding vitest / Playwright would catch regressions at PR-time.

---

## 📋 Launch readiness checklist

Walk through this before announcing the portal is live to real partners:

### Infrastructure
- [ ] Vercel production deploy is healthy (latest commit READY, no ERRORED deployments in the last hour)
- [ ] Neon database health check (connection from Vercel, no `prisma db push` failures in build logs)
- [ ] Sentry dashboard shows no unresolved issues from the last 24 hours
- [ ] Vercel Analytics + Speed Insights reporting data (at least one real session recorded)

### External integrations
- [ ] **Twilio A2P 10DLC brand approval** received (email from Twilio)
- [ ] **Twilio A2P 10DLC campaign approval** received (the 10–15 business day blocker)
- [ ] Send a real SMS from `/admin/partners/[id]` → Communication Log → trigger welcome SMS → verify it arrives on a real phone
- [ ] **SendGrid domain authentication** verified (Verify button in SendGrid settings shows green)
- [ ] Send a real email from `/admin/partners/[id]` → trigger welcome email → verify it arrives in a real inbox (not spam folder)
- [ ] **Frost Law's IT team** has received the `FROST_LAW_API_KEY` via secure channel
- [ ] Frost Law has confirmed they can POST to `/api/webhook/referral` and get a 201 (or idempotent 200)
- [ ] SignWell test: send a real partnership agreement from `/api/admin/agreement/[partnerCode]`, sign it in the embedded iframe, verify `Partner.status` flips `pending → active` automatically (PR #76 behavior)
- [ ] Anthropic (PartnerOS AI): send a real chat message as a test partner, verify the response lands, verify `AiUsageDay.totalCostUsd` increments by a non-zero amount

### End-to-end flows
- [ ] **Full signup flow**: admin generates an invite → open invite URL in incognito → fill signup form → verify welcome email + SMS arrive → admin receives signup notification email + SMS → agreement gate blocks Submit Client until signed
- [ ] **Agreement gate**: pending partner tries Submit Client → sees lock screen → partner signs agreement → gate clears on refresh
- [ ] **Deal submission** via webhook: POST to `/api/webhook/referral` with `X-Fintella-Api-Key` header → verify 201 + dealId → PATCH with a stage update → verify 200 + fieldsUpdated → verify the deal appears in `/admin/deals`
- [ ] **Payment received flow**: admin opens a closed-won deal → clicks "Mark Payment Received" → verify success alert with commission count → verify CommissionLedger rows appear in `/admin/payouts` "due" bucket
- [ ] **Payout batch**: admin goes to `/admin/payouts` → clicks Create Batch → verify batch created with correct total → approve → process → verify ledger entries flip to `paid`

### Security
- [ ] Log in as each of the 4 admin roles and verify the permission boundaries from PR #77 (accounting can't impersonate, partner_support can't process payouts, non-super_admin can't save settings)
- [ ] Test impersonation token: click "View as Partner" → new tab opens → verify token expires 60 seconds later (second tab refresh should fail)
- [ ] Rate-limit test: send 61 POSTs to `/api/webhook/referral` in under 60s → verify the 61st returns 429 with `Retry-After`
- [ ] Idempotency test: POST to `/api/webhook/referral` twice with the same `idempotencyKey` → first returns 201, second returns 200 with `idempotent: true`

### Documents in place
- [x] Privacy policy live at `/privacy`
- [x] Terms live at `/terms`
- [x] Webhook integration guide at `/docs/webhook-guide`
- [x] `CLAUDE.md` up to date (needs one more trim pass per Day 1 BLOCK 8)
- [x] `.claude/session-state.md` current
- [x] `docs/launch-status.md` (this file)

---

## 📈 What was shipped in the 2-day launch sprint (2026-04-13 → 2026-04-14)

**10 PRs merged to main:**

| PR | Title |
|---|---|
| **#69** | `fix(seed)`: wire conference data into `seed-all.js` so fresh DBs get Live Weekly content |
| **#60** | `chore(deps-dev)`: bump autoprefixer 10.4.27 → 10.5.0 |
| **#67** | `chore(deps-dev)`: bump postcss 8.5.8 → 8.5.9 |
| **#70** | `docs(session-state)`: record PR sweep results |
| **#71** | `feat(admin)`: Mark Payment Received workflow — closes the commission chain |
| **#73** | `feat`: add privacy policy and terms pages for TCR compliance |
| **#74** | `feat(webhook)`: harden `/api/webhook/referral` for production use |
| **#75** | `docs(webhook-guide)`: document hardened contract from #74 + refresh session-state |
| **#76** | `feat(signwell)`: webhook activates partner on `document_completed` |
| **#77** | `chore(security)`: regression-sweep fixes — 6 surgical hardening edits |

**9 PRs closed** (housekeeping):
- 8 major-bump dependabot PRs (#59 `@prisma/client`, #61 `@vercel/analytics`, #62 `tailwindcss`, #63 `bcryptjs`, #64 `@vercel/speed-insights`, #65 `prisma`, #66 `typescript`, #68 `@types/node`)
- #72 duplicate privacy+terms PR (superseded by #73)

**0 PRs currently open.**

**97/97 static pages** build cleanly from `main`. No new TypeScript errors. No regressions flagged in the Day 2 BLOCK 5 regression sweep that aren't already fixed in PR #77.
