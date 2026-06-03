# Terminal Log — 2026-06-03 — Deal stages: tier filter, hs_pipeline_stage, Onboarding + Closed Lost, triggers

**Repo:** tariff-partner-portal (Fintella Partner Portal) · **main:** `76fb870` · **prod:** deployed `76fb870` ✅

## PRs merged (4) — all squash-merged to main, prod LIVE + browser-verified
| PR | Title | Merge SHA |
|---|---|---|
| #1126 | fix(deals): Tariff Refund filter shows all tiers (Tier 1 + Tier 2 + DIY) | `8d8b709` |
| #1127 | fix(webhook): PATCH updates deal.stage from hs_pipeline_stage | `de87220` |
| #1128 | feat(deals): Onboarding + Closed Lost tariff stages, deal name follows legal entity | `b928140` |
| #1129 | feat(workflows): deal.onboarding trigger + friendly stage labels in status emails | `76fb870` |

## What shipped
1. **#1126** — Service switcher counted/filtered by exact `serviceOfInterest` string, so
   only 11 bare-legacy "Tariff Refund Support" deals matched; 122 tier-suffixed/DIY/null
   were dropped. Added `src/lib/serviceBucket.ts` → normalizes all non-ERC → Tariff Refund
   bucket. Tariff Refund tab now shows **122** (browser-verified).
2. **#1127** — PATCH stage-extraction OR-chain omitted `hs_pipeline_stage` (the key
   Frost Law's HubSpot actually sends on updates) → stage updates silently dropped.
   Added it + variants; stringify + empty-guard. All 11 HubSpot IDs verified mapping.
3. **#1128** — Tariff pipeline now mirrors HubSpot: added `onboarding`; repurposed
   `closedlost` as real "Closed Lost" (was folding into disqualified); removed
   `unresponsive` from picker; kept `client_engaged` (Closed Won target). Mapped
   Onboarding `3381784256`→onboarding, Closed Lost `3381784258`→closedlost. Wired into
   admin pills/tabs/filter/expanded-edit dropdown + partner tracker + commission status
   + closeDate + deal.closed_lost. **dealName now forced = legalEntityName** on admin
   PUT + webhook PATCH (table label follows legal entity edit).
4. **#1129** — Added first-class `deal.onboarding` workflow trigger (fires from webhook
   + admin), registered in all four `Record<TriggerKey>` maps. Verified live in the
   Automations builder trigger dropdown. Fixed `sendDealStatusUpdateEmail` to render
   friendly `STAGE_LABELS` labels instead of raw keys (helps all stages).

## Files touched
- `src/lib/serviceBucket.ts` (new), `src/lib/constants.ts`, `src/lib/commission.ts`,
  `src/lib/sendgrid.ts`, `src/lib/workflow-engine.ts`
- `src/app/api/webhook/referral/route.ts`, `src/app/api/admin/deals/[id]/route.ts`
- `src/app/(admin)/admin/deals/page.tsx`, `src/app/(partner)/dashboard/deals/page.tsx`

## Verification
- `npx tsc --noEmit` clean; local `./node_modules/.bin/next build` compiles each PR.
- Browser-verified on fintella.partners: Tariff Refund tab = 122; Onboarding + Closed Lost
  in admin pipeline (unresponsive gone); `Deal Onboarding` in Automations trigger dropdown.
- Standalone node repros confirmed: hs_pipeline_stage 3468521172 → meeting_booked;
  all 11 HubSpot IDs map correctly.

## Notes / open items
- Untracked `Kwong Client intake form/` folder in working tree — intentionally NOT
  committed (unrelated, pre-existing).
- HubSpot "Closed Won" → `client_engaged` (NOT internal `closedwon`) is intentional;
  our real refund-received closed-won + commission auto-create is deferred ("address
  our actual closed won later" — John).
- Legal-entity→deal-name sync verified by code/build, not by mutating a real prod deal.
- Stale local merged branches present (worktree-agent-*, claude/outbound-adapter-impl,
  claude/tier-knowledge-update) — safe to prune.

## Knowledge captured
`docs/knowledge/deal-stage-mapping-and-triggers.md` — full HubSpot↔internal stage map,
resolver rules, hs_pipeline_stage gotcha, triggers, dealName sync.
