# Session State

🕒 Last updated: 2026-05-27 — **Kwong Penalty Abatement (ERC) full build — 24 PRs (#1038–#1061)**

## 🌿 Git state
- **main**: `d5e7059` — all merged, deploying
- Working tree: clean
- No open feature branches

## ✅ What's done (this session)
- Kwong intake form (public + dashboard embed + SignWell + email + pipeline)
- Service switcher tabs on deal pages (admin + partner)
- Workflow engine fixes (brace stripping, skip logging, dry-run, request/response capture)
- deal.stage_changed now fires on admin stage changes
- Support tickets wired with serviceOfInterest + dealId
- See memory file `project_kwong_session_2026-05-27.md` for full PR list

## 🎯 What's next
1. Training page service selector
2. Admin chat service context
3. Admin support service filter
4. Test full Kwong flow end-to-end

## 📂 Key files
- `src/app/intake/kwong/page.tsx` — public intake form
- `src/app/api/kwong-intake/route.ts` — intake API + markdown
- `src/app/api/signwell/webhook/route.ts` — Kwong completion handler
- `src/lib/workflow-engine.ts` — triggers, dry-run
- `src/lib/constants.ts` — KWONG_PIPELINE_STAGES
- `prisma/schema.prisma` — SupportTicket.serviceOfInterest + dealId
