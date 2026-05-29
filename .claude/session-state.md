# Session State

🕒 Last updated: 2026-05-27 — **AI chat widget fixes + per-user memory system**

## 🌿 Git state

- **Branch**: `main` @ `c8832a0`
- **Working tree**: 5 modified files + 1 new file (NOT committed)
- **No PR created** — changes are local only

### Modified files (uncommitted):
```
 M prisma/schema.prisma                         (+20 lines — AiMemory model)
 M src/app/(partner)/dashboard/layout.tsx        (-2 lines — removed ChannelChatWidget)
 M src/app/api/ai/chat/route.ts                  (+34 lines — memory extraction)
 M src/components/partner/UnifiedChatWidget.tsx   (+121 lines — Channels tab)
 M src/lib/ai.ts                                 (+32 lines — memory injection)
?? src/app/api/ai/memory/route.ts                (NEW — CRUD API for memories)
```

## ✅ What's done

1. **Stacked widget fix** — Removed standalone `ChannelChatWidget` (📣 FAB) from dashboard layout. Was rendering on top of `UnifiedChatWidget` (chat FAB) — two floating buttons stacked in bottom-right corner.

2. **Channels merged into UnifiedChatWidget** — Added "Channels" as 4th tab (AI / Support / Messages / Channels). Channel list with unread badges, click-to-view messages, back navigation. All channel functionality preserved, no standalone FAB needed.

3. **Per-user AI memory system** — New `AiMemory` Prisma model for cloud-based memory storage. AI personas automatically extract and persist facts, preferences, context, and instructions from conversations. Memories injected into system prompt on every conversation. `[MEMORY:save]` blocks parsed from AI responses, persisted to DB, stripped from user-visible content.

4. **Memory API** — `GET/POST/DELETE /api/ai/memory` for user self-service memory management.

## 🔄 What's in flight

- Changes are **NOT committed or pushed**. Need to:
  1. Create a branch
  2. Commit changes
  3. Create PR
  4. Run `npx prisma db push` on Vercel to create `AiMemory` table
  5. Merge to main

## 🎯 What's next

1. **Commit + PR these changes** — branch, commit, push, PR, merge
2. **Run `prisma db push`** on Vercel to create the AiMemory table in production
3. **Test the unified widget** — verify single FAB, all 4 tabs work, AI responds
4. **Memory UI** — optionally add a "My Memory" section in partner settings where users can see/edit/delete what the AI has learned about them
5. **Admin memory management** — admin ability to view/set memories for partners (e.g. set context about their business before they even ask)

## 🧠 Context that matters for resuming

- The Fintella portal AI chat uses **Anthropic exclusively** — no multi-provider fallback (John explicitly said "no need to fallback just fix the bot with anthropic")
- `ANTHROPIC_API_KEY` is set on Vercel production. Locally there's no `.env.local` so it runs in mock mode
- The AI has 4 personas: Finn (generalist), Stella (generalist), Tara (product specialist), Ollie (ops specialist with DB tools)
- The `ChannelChatWidget` component still exists in `src/components/partner/ChannelChatWidget.tsx` — it's just no longer imported in the layout. Could be deleted later.
- OpCenter also got similar fixes in a parallel session (provider dropdown, fallback system, FeatureTips repositioned)

## 📂 Relevant files for the next task

- `prisma/schema.prisma` — AiMemory model at ~line 1215
- `src/lib/ai.ts` — `buildUserContext()` with memory injection + memory instructions in system prompt
- `src/app/api/ai/chat/route.ts` — memory extraction logic (MEMORY_REGEX)
- `src/app/api/ai/memory/route.ts` — CRUD API
- `src/components/partner/UnifiedChatWidget.tsx` — unified panel with 4 tabs
- `src/components/partner/ChannelChatWidget.tsx` — orphaned, can be deleted
