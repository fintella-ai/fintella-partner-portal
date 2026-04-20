# Internal Chats Group Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a new top-level "Internal Chats" group (`/admin/internal-chats`) containing Team Chat, Channels, DM Flags. Relocate those three surfaces out of Communications + Partner Support. Update the Settings navigation customizer. Everything else from the nav consolidation (#302 follow-up) stays the same.

**Architecture:** One new tabbed host page. Sidebar registry entry. Three child panels get their group assignment changed from Communications/Partner Support → Internal Chats. The two existing tabbed hosts (Communications, Partner Support) drop the moved tabs from their pill bars. Settings customizer registry gains one row. All existing routes continue to work (the panels are reused as-is).

**Tech Stack:** Next.js 14, React 18. No new dependencies. Uses the `reconcileNavOrder` helper already shipped in #302.

**Spec:** `docs/superpowers/specs/2026-04-20-internal-chats-group-design.md`

**Dependency:** Must run AFTER the nav consolidation subagent's PR lands. That PR creates the extracted panels (`TeamChatPanel`, `ChannelsListPanel`, `DmFlagsListPanel`) that this plan's new host imports, plus the Communications + Partner Support host pages whose pill bars we trim here.

**⚠️ Hard constraints:**

- Do NOT modify `src/app/api/webhook/referral/route.ts` or any other API handler, Prisma model, or business logic.
- Do NOT change any existing URL. `/admin/team-chat`, `/admin/channels`, `/admin/partner-dm-flags` continue to render their panels via existing thin wrappers.
- Do NOT modify any `*Panel.tsx` — they stay identical to what #302 extracted. This plan only imports them.

---

### Task 1: Create the Internal Chats tabbed host page

**Files:**
- Create: `src/app/(admin)/admin/internal-chats/page.tsx`

- [ ] **Step 1: Write the host**

Copy the code block from the spec's § Tabbed host code section verbatim into `src/app/(admin)/admin/internal-chats/page.tsx`. Three-tab host (Team Chat default, Channels, DM Flags) wrapping `TeamChatPanel`, `ChannelsListPanel`, `DmFlagsListPanel` inside a `<Suspense>` boundary per Next 14 prerender rules.

- [ ] **Step 2: Build**

```bash
./node_modules/.bin/next build
```

Expected: `✓ Compiled successfully`. The three imported panels are assumed to already exist at the paths the spec specifies (shipped in the nav consolidation PR).

- [ ] **Step 3: Commit**

```bash
git add src/app/\(admin\)/admin/internal-chats/page.tsx
git commit -m "feat(internal-chats): new tabbed host at /admin/internal-chats"
```

---

### Task 2: Remove Team Chat + Channels from Communications tabbed host

**Files:**
- Modify: `src/app/(admin)/admin/communications/page.tsx`

- [ ] **Step 1: Drop the two tabs**

In the Communications host (landed in #302), find the `TABS` array. Remove these entries:

```ts
{ id: "team-chat", label: "Team Chat" },
{ id: "channels",  label: "Channels" },
```

In the JSX, remove the two conditional branches:

```tsx
{tab === "team-chat" && <TeamChatPanel />}
{tab === "channels"  && <ChannelsListPanel />}
```

Remove the unused imports:

```ts
import TeamChatPanel from "../team-chat/TeamChatPanel";
import ChannelsListPanel from "../channels/ChannelsListPanel";
```

Update the `Tab` TypeScript union if the file declares one — remove `"team-chat"` and `"channels"`.

- [ ] **Step 2: Build**

```bash
./node_modules/.bin/next build
```

Expected: `✓ Compiled successfully`. Communications host now has 4 top-level tabs: Email / SMS / Phone / Automations.

- [ ] **Step 3: Commit**

```bash
git add src/app/\(admin\)/admin/communications/page.tsx
git commit -m "refactor(communications): remove Team Chat + Channels tabs (moved to Internal Chats)"
```

---

### Task 3: Remove DM Flags from Partner Support tabbed host

**Files:**
- Modify: `src/app/(admin)/admin/support/page.tsx`

- [ ] **Step 1: Drop the tab**

In the Partner Support host (landed in #302), find the `TABS` array. Remove:

```ts
{ id: "dmflags", label: "DM Flags" },
```

Remove the conditional branch:

```tsx
{tab === "dmflags" && <DmFlagsListPanel />}
```

Remove the unused import:

```ts
import DmFlagsListPanel from "../partner-dm-flags/DmFlagsListPanel";
```

Update the `Tab` TypeScript union — remove `"dmflags"`.

- [ ] **Step 2: Build**

```bash
./node_modules/.bin/next build
```

Expected: `✓ Compiled successfully`. Partner Support host now has 2 top-level tabs: Support Tickets / Live Chat Support.

- [ ] **Step 3: Commit**

```bash
git add src/app/\(admin\)/admin/support/page.tsx
git commit -m "refactor(support): remove DM Flags tab (moved to Internal Chats)"
```

---

### Task 4: Update `ADMIN_NAV_ITEMS_MAP` and `ADMIN_NAV_IDS_DEFAULT`

**Files:**
- Modify: `src/app/(admin)/admin/layout.tsx`

- [ ] **Step 1: Update `communications.children`**

Remove the Team Chat + Channels child entries from the `communications` group (they moved). Result:

```ts
communications: {
  id: "communications",
  icon: "💬",
  label: "Communications",
  children: [
    { id: "communications:email",       href: "/admin/communications?tab=email",       icon: "📧", label: "Email" },
    { id: "communications:sms",         href: "/admin/communications?tab=sms",         icon: "📱", label: "SMS" },
    { id: "communications:phone",       href: "/admin/communications?tab=phone",       icon: "📞", label: "Phone" },
    { id: "communications:automations", href: "/admin/communications?tab=automations", icon: "⚡", label: "Automations" },
  ],
},
```

- [ ] **Step 2: Update `partnerSupport.children`**

Remove the DM Flags child. Result:

```ts
partnerSupport: {
  id: "partnerSupport",
  icon: "🎧",
  label: "Partner Support",
  children: [
    { id: "partnerSupport:tickets",  href: "/admin/support?tab=tickets",  icon: "📩", label: "Support Tickets" },
    { id: "partnerSupport:livechat", href: "/admin/support?tab=livechat", icon: "💬", label: "Live Chat Support" },
  ],
},
```

- [ ] **Step 3: Add the new `internalChats` group**

Add a new top-level entry in `ADMIN_NAV_ITEMS_MAP`:

```ts
internalChats: {
  id: "internalChats",
  icon: "💬",
  label: "Internal Chats",
  children: [
    { id: "internalChats:team-chat", href: "/admin/team-chat",        icon: "💬", label: "Team Chat" },
    { id: "internalChats:channels",  href: "/admin/channels",         icon: "📣", label: "Channels" },
    { id: "internalChats:dmflags",   href: "/admin/partner-dm-flags", icon: "🚩", label: "DM Flags" },
  ],
},
```

- [ ] **Step 4: Update `ADMIN_NAV_IDS_DEFAULT`**

Insert `"internalChats"` between `"communications"` and `"partnerSupport"`:

```ts
const ADMIN_NAV_IDS_DEFAULT = [
  "partners", "deals", "reporting",
  "communications", "internalChats", "partnerSupport",
  "training", "conference", "documents",
  "settings", "users", "features", "dev",
];
```

- [ ] **Step 5: Build**

```bash
./node_modules/.bin/next build
```

Expected: `✓ Compiled successfully`. Sidebar now has 12 top-level entries.

- [ ] **Step 6: Commit**

```bash
git add src/app/\(admin\)/admin/layout.tsx
git commit -m "feat(admin-nav): add Internal Chats group; trim Communications + Partner Support children"
```

---

### Task 5: Update `ROLE_VISIBLE_NAV` per role

**Files:**
- Modify: `src/lib/permissions.ts`

- [ ] **Step 1: Add `"internalChats"` to three roles**

Find each role's `ROLE_VISIBLE_NAV` entry. Add `"internalChats"` to:

- `super_admin`
- `admin`
- `partner_support`

Do NOT add to `accounting` (they have no access to internal-chat surfaces today).

Example after-state (positional — insert between `"partnerSupport"` and `"training"` or wherever reads clean):

```ts
super_admin: [..., "communications", "internalChats", "partnerSupport", ...],
admin:       [..., "communications", "internalChats", "partnerSupport", ...],
partner_support: [..., "communications", "internalChats", "partnerSupport", ...],
accounting:  [...unchanged, no internalChats...],
```

- [ ] **Step 2: Build**

```bash
./node_modules/.bin/next build
```

- [ ] **Step 3: Commit**

```bash
git add src/lib/permissions.ts
git commit -m "feat(permissions): add internalChats to super_admin + admin + partner_support nav lists"
```

---

### Task 6: Update Settings → Navigation customizer registry

**Files:**
- Modify: `src/app/(admin)/admin/settings/page.tsx`

- [ ] **Step 1: Add the Internal Chats row to `ALL_ADMIN_NAV_ITEMS`**

Insert between `communications` and `partnerSupport`:

```ts
{ id: "internalChats", label: "Internal Chats", icon: "💬" },
```

- [ ] **Step 2: Build**

```bash
./node_modules/.bin/next build
```

Expected: `✓ Compiled successfully`. Settings → Navigation drag-and-drop editor now shows Internal Chats as a reorderable row.

- [ ] **Step 3: Commit**

```bash
git add src/app/\(admin\)/admin/settings/page.tsx
git commit -m "feat(settings): Navigation editor registers Internal Chats as reorderable"
```

---

### Task 7: Final sweep + PR

**Files:** none (verification + PR)

- [ ] **Step 1: Confirm no API / schema / panel-file changes**

```bash
git log --oneline main.. -- 'src/app/api/**/*.ts' prisma/schema.prisma
```

Expected: empty.

```bash
git log --oneline main.. -- 'src/app/(admin)/admin/*/TeamChatPanel.tsx' 'src/app/(admin)/admin/*/ChannelsListPanel.tsx' 'src/app/(admin)/admin/*/DmFlagsListPanel.tsx'
```

Expected: empty. (The three reused panels are NOT modified by this plan — they're just imported.)

- [ ] **Step 2: Confirm routes still render panels**

Build + smoke-review the routes list in the Next build output — verify `/admin/team-chat`, `/admin/channels`, `/admin/partner-dm-flags`, `/admin/internal-chats`, `/admin/communications`, `/admin/support` are all in the prerender manifest.

- [ ] **Step 3: Push + PR**

```bash
git push -u origin HEAD
gh pr create --title "feat(admin): Internal Chats group (Team Chat + Channels + DM Flags)" --body "$(cat <<'EOF'
## Summary

Follow-up to the nav consolidation (#302). Adds a third top-level group:

- **Internal Chats** (new): Team Chat, Channels, DM Flags
- **Communications**: now just Email, SMS, Phone, Automations (Team Chat + Channels removed)
- **Partner Support**: now just Support Tickets, Live Chat Support (DM Flags removed)

Admin sidebar goes from 11 → 12 top-level entries. Tighter conceptual grouping: outbound/inbound customer comms vs. admin-internal surfaces vs. inbound support queues.

Implements \`docs/superpowers/specs/2026-04-20-internal-chats-group-design.md\`.

## Changes

- New \`/admin/internal-chats\` tabbed host page
- Trim \`/admin/communications\` pill bar (remove Team Chat + Channels tabs)
- Trim \`/admin/support\` pill bar (remove DM Flags tab)
- \`ADMIN_NAV_ITEMS_MAP\` adds \`internalChats\` group; \`communications.children\` and \`partnerSupport.children\` lose the moved entries
- \`ADMIN_NAV_IDS_DEFAULT\` inserts \`internalChats\`
- \`ROLE_VISIBLE_NAV\` gains \`"internalChats"\` for super_admin, admin, partner_support (NOT accounting)
- Settings → Navigation customizer registers Internal Chats as reorderable

## Strictly NOT touched

- No API / Prisma / business-logic changes
- No existing URL removed (panels at \`/admin/team-chat\`, \`/admin/channels\`, \`/admin/partner-dm-flags\` still work via thin-wrapper pages)
- No existing \`*Panel.tsx\` file modified — they're imported as-is from #302's extractions

## Test plan

- [ ] Admin sees 12 top-level sidebar entries, Internal Chats between Communications and Partner Support
- [ ] Click Internal Chats → defaults to Team Chat tab; switch to Channels; switch to DM Flags
- [ ] Communications pill bar shows only Email/SMS/Phone/Automations
- [ ] Partner Support pill bar shows only Support Tickets/Live Chat Support
- [ ] Direct links to \`/admin/team-chat\`, \`/admin/channels\`, \`/admin/partner-dm-flags\` still render identical behavior
- [ ] Settings → Navigation shows Internal Chats as draggable row; reorder persists
- [ ] Saved nav order with no \`internalChats\` entry appends it at the end (handled by reconcileNavOrder from #302)
- [ ] Accounting role does not see Internal Chats in their sidebar
- [ ] CI green

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

- [ ] **Step 4: Stop. Do not merge.**
