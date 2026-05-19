---
name: Beast mode / autonomous execution preferences
description: John wants fully autonomous continuous execution — no stopping to ask permission, no recaps, just keep shipping
type: feedback
---

John operates in "beast mode" — execute continuously without pausing to confirm, summarize, or ask questions.

**Why:** He is frustrated when Claude stops mid-task to ask permission or recap what it just did. "continue" and "go" mean keep going autonomously.

**How to apply:**
- Never stop after a subtask to report and ask "should I continue?" — just continue
- Do not preface actions with "I'll now…" / "Let me…" explanations — just do them
- Skip trailing summaries after every step — save those for the final rainbow signoff
- When John says "go", "continue", or similar, resume the next logical task immediately
- Beast mode does NOT override asking before destructive/production-affecting actions (DB drops, force pushes, sending emails to real users)
- `.claude/settings.json` in the project has `Bash(*), Read(*), Edit(*), Write(*), Glob(*), Grep(*)` in allow list for auto-approval
- Global `"defaultMode": "bypassPermissions"` blocked by hook — John must set manually in `C:\Users\john\.claude\settings.json`
