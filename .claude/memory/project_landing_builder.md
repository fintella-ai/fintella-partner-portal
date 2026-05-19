---
name: Landing page visual builder — SHIPPED
description: Two-column visual builder for /admin/landing-pages; drag order now wired to public renderers
type: project
---

Visual block builder shipped in PR #1016. Section order wiring shipped in PR #1019. Fully complete.

**What shipped:**
- PR #1016: Left sidebar drag handles, section cards with live preview snippets, `_sectionOrder` stored in draft/published JSON
- PR #1019: `_sectionOrder` now respected by `/recover` (recover/page.tsx) and `/partners` (PartnersPageRenderer.tsx)

**How the order flows:**
1. Admin drags sections in `/admin/landing-pages` → order saved as `_sectionOrder` in draft JSON
2. Admin clicks Publish → `_sectionOrder` included in `published` field of `LandingPageConfig`
3. `getRecoverContent()` / `getPartnersContent()` return content with `_sectionOrder` (type now includes it)
4. Renderer uses `c._sectionOrder ?? DEFAULT_ORDER` to render sections in saved order

**Nav is always fixed at top — not in section order.**

**How to apply:** This is done. If a webinar public page is ever built, apply the same pattern.
