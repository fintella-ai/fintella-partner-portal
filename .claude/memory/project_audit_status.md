---
name: Admin panel audit — shipped and deferred items
description: Full audit run 2026-05-19 — what was deleted, what was kept, what still needs manual action
type: project
---

Full beast-mode admin panel audit completed 2026-05-19. ~1,380 lines of dead code removed across 4 PRs.

**Shipped:**
- PR #1012 (merged): 5 dead page stubs, feature-gate.ts, monitoring.ts, engagement.ts, nav fixes
- PR #1014 (merged): 4 dead API routes (analytics, engagement, research/deep, debug)
- PR #1015 (merged): billing/page.tsx → redirect to expenses, SubscriptionRevenueSection ported
- PR #1017 (open): 13 dead components — 10 template stubs + BottomSheet, CopyButton, UpgradeGate

**Deferred (need Neon snapshot before acting):**
- `PartnerActivity` model — annotated DEAD in schema, zero src/ refs, but build uses `db push --accept-data-loss` so removing it drops the table on next deploy
- `DossierDocument` model — same situation

**Kept intentionally (staged features, not dead):**
- `src/components/ops/VoiceDictation, VoiceMessageButton, VoiceToRequest, PushNotificationSetup` — built feature with API infrastructure, just not surfaced in UI yet
- `src/components/ui/PageSectionTypes.tsx` — used by CustomSections.tsx

**Why:** Engagement scoring (PartnerActivity) and DossierDocument processing were descoped. Schema drops require production DB snapshot per CLAUDE.md safety rules.

**How to apply:** When John says "drop PartnerActivity" or "clean up the schema" — remind him to take a Neon snapshot first and confirm, then remove the model from schema.
