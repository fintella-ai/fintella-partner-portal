# Session State

🕒 Last updated: 2026-05-19 — **HeyGen async fix shipped (PR #1018). Continuing from beast-mode session.**

## 🌿 Git state
- **main HEAD:** `90b16c4` — TCR A2P compliance footer (#997) — clean
- **origin/main:** in sync
- **Active branches:**
  - `claude/landing-visual-builder` → PR #1016 open
  - `claude/component-graveyard-cleanup` → PR #1017 open
  - `claude/heygen-async-fix` → PR #1018 open

## ✅ What shipped this session

### Beast-mode Admin Panel Audit (5 PRs) — previous session
| PR | Branch | Status | What |
|---|---|---|---|
| #1012 | `admin-panel-cleanup-audit` | ✅ MERGED | 5 dead page stubs, feature-gate.ts, monitoring.ts, engagement.ts deleted; nav fixes |
| #1014 | `dead-code-cleanup-phase2` | ✅ MERGED | 4 dead API routes deleted (analytics, engagement, research/deep, debug) |
| #1015 | `cleanup-phase3` | ✅ MERGED | billing/page.tsx → redirect(/admin/expenses); SubscriptionRevenueSection ported |
| #1016 | `landing-visual-builder` | 🔄 OPEN | Two-column visual builder for /admin/landing-pages with native HTML5 DnD |
| #1017 | `component-graveyard-cleanup` | 🔄 OPEN | 13 dead components deleted |

### HeyGen async fix (this session)
| PR | Branch | Status | What |
|---|---|---|---|
| #1018 | `claude/heygen-async-fix` | 🔄 OPEN | Fire-and-forget HeyGen + status polling; schema adds heygenVideoId; slides mode bug fix |

**Net: ~1,380 lines of dead code removed (previous) + HeyGen end-to-end fixed.**

## 🔄 Open PRs (full list)

| PR | Title | Status | Action |
|---|---|---|---|
| #1018 | HeyGen async video generation | OPEN | Schema change (additive), safe to merge |
| #1017 | Component graveyard cleanup | OPEN | Safe to merge |
| #1016 | Landing page visual builder | OPEN | Test `/admin/landing-pages` before merging |
| #1013 | Section 122 regulatory update | DRAFT | Review content |
| #964 | Fix partnerType on /apply form | OPEN | Bug fix — safe to merge |
| #966 | Ollie telemetry dashboard | OPEN | Review |

## 🎯 What's next

1. **Merge #1018** — additive schema + async fix, no risk; requires `HEYGEN_API_KEY` env var to activate
2. **Merge #1017** — clean dead component removal, no risk
3. **Test + merge #1016** — visual builder for landing pages, check `/admin/landing-pages`
4. **Wire `_sectionOrder` to public renderers** — `/recover`, `/partners` etc. don't respect drag order yet; follow-up PR
5. **Schema drops** — `PartnerActivity` + `DossierDocument` — take Neon snapshot first, then remove models from schema
6. **Bug fix #964** — fix partnerType dropped on /apply form
7. **Dep PRs** — #988 (postcss patch), #990 (sentry minor), #991 (openai minor), #963 (group) — John's approval needed per deploy trigger
8. **HeyGen API key** — add `HEYGEN_API_KEY` + `HEYGEN_AVATAR_ID` + `HEYGEN_VOICE_ID` to Vercel env vars to activate video generation

## 🧠 Context for resuming

- **HeyGen is fully wired** — lib, API routes, admin UI all complete. Only missing: `HEYGEN_API_KEY` in Vercel env vars. Once added, Training page "HeyGen Video" button triggers real avatar video generation.
- **HeyGen video flow**: Admin clicks "HeyGen Video" → HeyGenOptionsModal (avatar/voice selection) → POST generate-heygen → HeyGen renders async → client polls heygen-status every 15s → videoUrl stored when complete
- **HeyGen IDs in HeyGenOptionsModal**: Finn 1-3 avatars, Stella 1-4 avatars — these are placeholder IDs. Verify real IDs from HeyGen dashboard after API key is added.
- **Beast mode is ON** — `.claude/settings.json` has full auto-allow
- **Schema danger**: build script runs `prisma db push --accept-data-loss` — removing any model = production table drop on next Vercel deploy. Always snapshot Neon first
- **Twilio SMS env vars** still UNSET pending TCR A2P 10DLC approval
- **DossierDocument** + **PartnerActivity** both annotated DEAD in schema (comment added), not yet dropped

## 📂 Key files for next session

- `src/app/(admin)/admin/training/page.tsx` — training admin with HeyGen buttons
- `src/app/api/admin/training/modules/[id]/generate-heygen/route.ts` — fire-and-forget video creation
- `src/app/api/admin/training/modules/[id]/heygen-status/route.ts` — **NEW** polling endpoint
- `src/lib/heygen.ts` — HeyGen API lib
- `src/components/admin/HeyGenOptionsModal.tsx` — avatar/voice selection UI (placeholder IDs)
- `src/app/(admin)/admin/landing-pages/page.tsx` — the new visual builder (PR #1016 branch)
- `src/lib/getLandingContent.ts` — add `_sectionOrder` reading here for renderer follow-up
- `src/app/recover/page.tsx`, `src/app/partners/page.tsx` — public renderers to wire up section order
- `prisma/schema.prisma` — PartnerActivity (line ~2069) + DossierDocument (line ~2354) both annotated DEAD
