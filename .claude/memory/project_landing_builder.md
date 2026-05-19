---
name: Landing page visual builder — shipped PR #1016
description: Two-column visual builder for /admin/landing-pages with native HTML5 DnD, section cards, preview snippets
type: project
---

Built visual block builder for `/admin/landing-pages` editor. PR #1016 open, not yet merged.

**What it does:**
- Left sidebar: section cards with drag handle (⠿), section icon, live preview snippet of current headline/count
- Right panel: form editor for selected section (click card to switch)
- Native HTML5 drag-and-drop — no new deps — reorders sections in local state
- Section order stored as `_sectionOrder` in draft JSON blob (backwards-compatible)
- Works for all 4 pages: Recovery (`/recover`), Partners (`/partners`), Brokers (`/partners/brokers`), Webinar (`/webinar`)

**What's NOT done yet (follow-up):**
- Public page renderers (`/recover`, `/partners`, etc.) still use fixed section order — `_sectionOrder` is saved but not yet read by the renderer
- To complete: update `src/app/recover/page.tsx`, `src/app/partners/page.tsx` etc. to read `_sectionOrder` from `getLandingContent()`

**Why:** John marked "landing page visual builder" as PRIORITY. The previous editor used a double-tab system with no visual feedback.

**How to apply:** When continuing on landing pages, the `_sectionOrder` field is already in the schema and stored in drafts. The renderer update is the next step.
