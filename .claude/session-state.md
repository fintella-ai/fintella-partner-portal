# Session State — Fintella Partner Portal

> **This file is the single source of truth for session-to-session continuity.**
> It is kept up to date by the active Claude Code session and read at the start
> of every new session so work resumes without context loss.
>
> **Owner**: the active Claude Code session (this file is mechanically edited,
> not by hand).
>
> **Protocol**: see `CLAUDE.md → Session Continuity Protocol` for the full
> rules on when and how this file gets updated.

---

## 🕒 Last updated

`2026-04-14T08:15:00Z` — by session `01KrpjXE9kuhr7gceNDuMqjs` (continued, branched conversation)

## 🌿 Git state at last checkpoint

- **Branch**: `claude/launch-status-doc-mzWSp` (active — this PR creates `docs/launch-status.md` per Day 2 BLOCK 7 and folds in this state refresh)
- **Base commit on main**: `5feb3fe chore(security): regression-sweep fixes — 6 surgical hardening edits (#77)`
- **Working tree**: `docs/launch-status.md` (new) + `.claude/session-state.md` (this refresh)
- **Worktree path**: `/Users/johnorlandorobotax/tariff-partner-portal-phase12`
- **Build**: pre-edit was 97/97 static pages; expected post-edit **97/97** (docs-only change, no new routes)
- **Prod deployment**: Vercel auto-deploy from #77 merge is in progress. Schema migration from #77 (`AiMessage.cacheReadTokens` + `cacheCreationTokens`) lands via `prisma db push --accept-data-loss` step.
- **Open dependabot queue**: 0 (verified via `gh pr list --search dependabot`).

## ✅ What's done this session (in merge order)

| # | PR | What shipped |
|---|---|---|
| 1 | **#69** | `fix(seed)`: wire conference data into `seed-all.js` so fresh DBs get Live Weekly content |
| 2 | **#60** | `chore(deps-dev)`: bump autoprefixer 10.4.27 → 10.5.0 (minor, safe) |
| 3 | **#67** | `chore(deps-dev)`: bump postcss 8.5.8 → 8.5.9 (patch, safe) |
| 4 | **#70** | `docs(session-state)`: record PR sweep results — 8 closed, 2 minor merged |
| 5 | **#71** | `feat(admin)`: Mark Payment Received workflow — closes the commission chain (`Deal.paymentReceivedAt`/`paymentReceivedBy`, POST `/api/admin/deals/[id]/payment-received` transactional route, green "Mark Payment Received" admin UI button, system `DealNote` audit entry, transactional creation of `CommissionLedger` entries with `status="due"`) |
| 6 | **#73** | `feat`: `/privacy` + `/terms` public legal pages for Twilio TCR reviewers (11 + 12 section legal docs, verbatim SMS disclosures, Florida governing law, middleware updated, 95 → 97 pages) |
| 7 | **#74** | `feat(webhook)`: harden `/api/webhook/referral` for production use — dual-scheme API-key auth (`X-Fintella-Api-Key` primary + legacy `x-webhook-secret` still accepted), `Deal.idempotencyKey` unique column + replay-safe semantics, 60 req/60s in-memory rate limit with Retry-After, optional event-type whitelist, HMAC signature verify code prep (log-only, not enforced yet), `/admin/dev/webhook-test` harness updated to inject both headers |
| 8 | **#75** | `docs(webhook-guide)`: document hardened contract from #74 + refresh session-state — adds Security / cURL Examples / Error Handling sections to `/docs/webhook-guide`, documents API-key auth, rate limit, idempotency, HMAC, 200-idempotent + 429 response blocks, exponential backoff retry schedule |
| 9 | **#76** | `feat(signwell)`: webhook activates partner on `document_completed` — closes the CLAUDE.md-stated "webhook → partner becomes active" gap. `/api/signwell/webhook` now flips `Partner.status` from `pending → active` after updating the agreement row. Folded into the existing partner lookup (no extra DB round-trip). Also removes the dead `sendForSigning` / `isSignWellConfigured` imports from `signup/route.ts`. |
| 10 | **#77** | `chore(security)`: regression-sweep fixes — 6 surgical hardening edits. 1 CRITICAL + 3 HIGH + 2 MEDIUM. Impersonate role narrowed to `{super_admin, admin}` only, payouts POST narrowed to `{super_admin, admin, accounting}`, settings PUT narrowed to `super_admin` only, impersonation token TTL 15min → 60s, AI cache-write pricing bug fixed (split `cacheReadTokens` + `cacheCreationTokens` through the whole stack), agreement gate adds `Partner.status === "active"` check as defense-in-depth. |

**Dependabot PRs CLOSED this session (8 total — all major bumps, defer to dedicated migration window):**

| PR | Bump | Reason |
|---|---|---|
| #59 | `@prisma/client` 5.20 → 7.7 | Major, breaks build |
| #61 | `@vercel/analytics` 1.6 → 2.0 | Major |
| #62 | `tailwindcss` 3.4 → 4.2 | Major |
| #63 | `bcryptjs` 2.4.3 → 3.0.3 | Major (ESM-default + new $2b$ hash format, hits auth + seed-admin) |
| #64 | `@vercel/speed-insights` 1.3 → 2.0 | Major |
| #65 | `prisma` 5.20 → 7.7 | Major |
| #66 | `typescript` 5.9 → 6.0 | Major |
| #68 | `@types/node` 20 → 25 | Major (skips 4 majors) |

Plus **#72** (orphaned duplicate privacy+terms) closed as superseded by #73.

**PRs from the original "needing merge" list that turned out to be already done — no action required:**
- **#11**, **#12**, **#13** — webhook trio, all already MERGED on `main` before this session started. The infra baseline was stale.
- **#55** — was a duplicate Phase 15a PR; CLOSED long ago (real Phase 15a shipped as PR #46).

## 🔄 What's in flight

- **Current task**: Day 2 BLOCK 7 — `docs/launch-status.md` creation. This is the final launch-status doc covering Ready / Pending External / Known Limitations / Descoped / Post-launch roadmap / Launch readiness checklist. Also folds in this state refresh to clear the Session Continuity Protocol debt from #76 + #77 (neither merge bundled a state update).
- **Branch**: `claude/launch-status-doc-mzWSp`
- **Files changed**:
  - `docs/launch-status.md` (new) — comprehensive product-state document covering infrastructure, what's ready, external blockers, limitations, post-launch roadmap, launch readiness checklist, and 2-day sprint summary.
  - `.claude/session-state.md` — this refresh.
- **Next step after commit**: build verify (expect 97/97), push to feature branch, open PR, await John's merge approval.

## 🎯 What's next (queued, prioritized)

### 🅰 Highest priority — wall-clock blockers already in motion
1. **Twilio A2P 10DLC** — submitted by John this session. TCR campaign approval window 2026-04-28 – 2026-05-05. Watch for email. `/privacy` + `/terms` live for reviewers post-#73.
2. **SendGrid domain authentication** — submitted, DNS propagating. Check Verify button in SendGrid every few hours. Single Sender Verification is the interim path.
3. **Send `FROST_LAW_API_KEY` to Frost Law's IT team** via secure channel. Point them at `https://fintella.partners/docs/webhook-guide` for the post-#74/#75 integration spec.
4. **Smoke-test #76 + #77 on prod** — create a test partner, trigger an agreement send, sign it, verify `Partner.status` flips. Then log in as each of the 4 admin roles and verify the post-#77 permission boundaries work (impersonate, payouts POST, settings PUT).

### 🅱 Highest-value Claude-only code work (no external dependencies)
1. **Day 1 BLOCK 8 — CLAUDE.md trim** (~15 min) — swap in the pre-prepared `CLAUDE-trimmed.md` from `~/Documents/Fintella Partner Portal/2 day portal plan/`, review deltas, commit. Reduces future session startup cost. Could bundle with this PR or a followup.
2. **Auto-create CommissionLedger entries on closed-won transition** (the upstream half of the payment-received pipeline) — currently the ledger is only populated when admin clicks "Mark Payment Received." If we want partners to see `pending` commissions the moment a deal closes, add ledger creation to the deal PUT route and the webhook PATCH handler. Low priority.
3. **Enforce HMAC signatures on `/api/webhook/referral`** — flip from log-only to hard-reject once Frost Law implements signing. One-line change in `verifyHmacSignature()` in `src/app/api/webhook/referral/route.ts`.
4. **Phase 15c-followup** — recording with state-by-state consent. Multi-hour, fresh session recommended.

### 🅲 Pre-existing queued items still relevant
1. Operational cleanup John should do in `/admin` UI manually — delete the legacy `admin@trln.com` super_admin row via `/admin/users` (orphan from pre-rebrand deployment).
2. **Phase 16 — Stripe Connect** payments/payouts. Needed once partners need to actually be paid directly from the portal. Multi-hour, fresh session recommended.
3. **Phase 18b — Next.js 14.2.35 → 16 migration**. Closes 5 remaining DoS-only CVEs. Major migration — React 18 → 19, `middleware.ts` → `proxy.ts`, dedicated test session. **All the closed dependabot PRs above land naturally as part of this window.**

### 2-day launch plan status

| Block | Status |
|---|---|
| Day 1 BLOCK 1 — Twilio A2P registration | ✅ submitted by John |
| Day 1 BLOCK 2 — SendGrid DNS | 🟡 in flight |
| Day 1 BLOCK 3 — Vercel env vars | ✅ done |
| Day 1 BLOCK 4 — PR sweep | ✅ 100% complete |
| Day 1 BLOCK 5 — SignWell activation | ✅ shipped as #76 |
| Day 1 BLOCK 6 — Sentry verify | ✅ verify-only (Phase 18a) |
| Day 1 BLOCK 7 — Webhook smoke test | ⏳ John (browser via /admin/dev/webhook-test) |
| Day 1 BLOCK 8 — CLAUDE.md trim | ⏳ me (pre-prepared file exists locally) |
| Day 2 BLOCK 3 — Payment Received workflow | ✅ shipped as #71 |
| Day 2 BLOCK 4 — Webhook security hardening | ✅ shipped as #74 |
| Day 2 BLOCK 5 — Full regression sweep | ✅ shipped as #77 |
| Day 2 BLOCK 6 — Webhook docs refresh | ✅ shipped as #75 |
| Day 2 BLOCK 7 — Final cleanup + launch-status.md | 🔄 **in flight in this PR** |

**12 of 13 blocks done (this PR closes #13). Only CLAUDE.md trim remains after this PR merges.**

## 🧠 Context that matters for resuming

- **Pre-launch status** (per CLAUDE.md): no real customers in any environment. Freely destructive DB ops are safe. Smoke-test directly against `fintella.partners`.
- **Branch protection on `main`** is active. Every change goes through a PR. Never merge without explicit John go-ahead. No exceptions.
- **Build command**: `./node_modules/.bin/next build` — expects **97/97 static pages** as of main `5feb3fe`. Pre-existing `global-error.tsx` Sentry deprecation warning is noise, not failure.
- **Public pages now**: `/`, `/login`, `/signup`, `/impersonate`, `/getstarted`, `/docs/*`, `/privacy`, `/terms`. Authenticated routes everywhere else. Admin routes additionally gated by role check in middleware.
- **Admin permission matrix (post-#77)**:
  - `/api/admin/impersonate` POST — `{super_admin, admin}` only
  - `/api/admin/payouts` POST — `{super_admin, admin, accounting}`
  - `/api/admin/settings` PUT — `super_admin` only
  - `/api/admin/dev/*` — `super_admin` only
  - Most GETs — all 4 admin roles
- **Webhook auth contract (post-#74)**: accepts EITHER `X-Fintella-Api-Key` (env `FROST_LAW_API_KEY`) OR legacy `x-webhook-secret` / `Authorization: Bearer` (env `REFERRAL_WEBHOOK_SECRET`). Rate limit 60 req/60s per key. Optional `idempotencyKey` on POST body. Optional `X-Fintella-Signature` HMAC (log-only, not enforced).
- **Agreement gate (post-#77)**: `/dashboard/submit-client` and `/dashboard/referral-links` require BOTH `agreement.status in (signed, approved)` AND `Partner.status === "active"`. Post-#76 the SignWell webhook flips `Partner.status` automatically so the happy path converges.
- **Impersonation token (post-#77)**: 60-second TTL, single-use, only super_admin + admin can generate.
- **AI cost accounting (post-#77)**: `AiMessage` now records `cacheReadTokens` + `cacheCreationTokens` as separate columns. `recordUsage()` prices them at distinct rates ($0.30/MTok vs $3.75/MTok). The old `cachedTokens` column is kept as a DEPRECATED alias mirrored from `cacheReadTokens` for back-compat.
- **Worktree gotcha**: this session is working in a worktree at `/Users/johnorlandorobotax/tariff-partner-portal-phase12`. The original checkout at `/Users/johnorlandorobotax/tariff-partner-portal` is on stale `master` with 5 dirty files of unknown intent — left untouched.
- **Dependabot ignore rule**: PR #58 added `.github/dependabot.yml` config that ignores major bumps. Current open dependabot queue: **0 PRs**.
- **TCPA SMS gate**: every SMS send checks `Partner.smsOptIn` BEFORE the network call. Don't remove this. `/privacy` documents the opt-in pathway in the language TCR reviewers expect.
- **Voice recording**: deferred — state-by-state legal disclosure requirements. DB columns + UI hooks already wired for the followup.
- **2-day launch plan source-of-truth**: `~/Documents/Fintella Partner Portal/2 day portal plan/fintella-day{1,2}-prompts.md`.
- **Memory system**: persistent project memories under `~/.claude/projects/-Users-johnorlandorobotax/memory/`.

## 📂 Relevant files for the next task

If the next session starts with **CLAUDE.md trim (Day 1 BLOCK 8)**:
- `CLAUDE.md` (in the repo root) — current ~400-line file
- `~/Documents/Fintella Partner Portal/2 day portal plan/CLAUDE-trimmed.md` — pre-prepared replacement
- Review delta, drop in, commit as `docs: trim CLAUDE.md`

If the next session starts with **smoke-testing #76/#77 on prod**:
- `/admin/partners/[id]` — test impersonation (accounting should 403)
- `/admin/payouts` — test POST (partner_support should 403)
- `/admin/settings` — test PUT (non-super_admin should 403)
- `/admin/dev/webhook-test` — run the 10-step plan from PR #74's body
- `/dashboard/submit-client` as a test partner — verify gate blocks pending even with signed agreement
- SignWell test agreement → verify `Partner.status` flips automatically
- AI chat → verify `AiMessage.cacheCreationTokens` column populates

If the next session starts with **Stripe Connect (Phase 16)**:
- New `src/lib/stripe.ts` following the raw-fetch house pattern
- New `StripeAccount` Prisma model linked to `Partner`
- New API routes for Connect onboarding flow
- Multi-hour, fresh session recommended
