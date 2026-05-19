---
name: HeyGen video generation integration
description: Full end-to-end HeyGen avatar video pipeline for training modules — architecture, env vars needed, and current status
type: project
---

HeyGen integration is fully wired. PR #1018 fixed a critical timeout bug.

**Current status:** Code complete. Blocked on `HEYGEN_API_KEY` in Vercel env vars.

**Architecture (post-PR #1018):**
1. Admin clicks "HeyGen Video" → `HeyGenOptionsModal` (pick Finn/Stella avatar + avatar vs slides mode)
2. Slides mode → POST `generate-video` → Claude generates `VideoScript` JSON → stored as `TrainingModule.videoScript` → `SlidePlayer` preview opens
3. Avatar mode → POST `generate-heygen` → script built → submitted to HeyGen → `heygenVideoId` stored on module → 200 returned immediately
4. Client polls GET `heygen-status` every 15s → when completed, `videoUrl` stored, `heygenVideoId` cleared
5. Page refresh resumes polling for any module with a non-null `heygenVideoId`

**Key files:**
- `src/lib/heygen.ts` — `createAvatarVideo`, `checkVideoStatus`, `waitForVideo`, `scriptToNarration`
- `src/lib/ai-video.ts` — `generateVideoScript` (Claude → structured VideoScript JSON)
- `src/app/api/admin/training/modules/[id]/generate-heygen/route.ts` — fire-and-forget submission
- `src/app/api/admin/training/modules/[id]/heygen-status/route.ts` — polling endpoint
- `src/components/admin/HeyGenOptionsModal.tsx` — avatar picker (Finn 1-3, Stella 1-4 — verify IDs from dashboard)

**Env vars needed to activate:**
- `HEYGEN_API_KEY` — primary gate (`isHeyGenEnabled()` checks this)
- `HEYGEN_AVATAR_ID` — optional override of default avatar
- `HEYGEN_VOICE_ID` — optional override of default voice

**Schema field added:** `TrainingModule.heygenVideoId String?` — tracks in-flight render ID

**Why:** Original route used `waitForVideo()` synchronously (10min timeout), which always hit Vercel's serverless execution limit.

**How to apply:** When John asks about HeyGen or video training, remind him the only remaining step is adding `HEYGEN_API_KEY` to Vercel env vars. Also verify the hardcoded avatar IDs in `HeyGenOptionsModal.tsx` against his actual HeyGen account.
