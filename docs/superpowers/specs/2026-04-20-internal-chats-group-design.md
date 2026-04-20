# Internal Chats Group — Design (follow-up to Nav Consolidation #302)

**Date:** 2026-04-20
**Status:** Approved for implementation (after nav consolidation PR from #302 lands)
**Surface:** admin sidebar + new tabbed host at `/admin/internal-chats` + Settings → Navigation registry.

## Goal

Refine the nav consolidation (#302) with a third group. Extract the three internal-chat surfaces (Team Chat, Channels, DM Flags) out of Communications and Partner Support into a brand-new top-level group called **Internal Chats**. Clearer mental model: Communications = outbound/inbound customer comms; Internal Chats = admin-facing real-time surfaces; Partner Support = inbound support queues.

## Non-goals

- No change to any extracted panel's functionality or URL.
- No schema or API changes.
- No change to partner-side nav.

## Final nav structure (after this lands on top of #302)

```
Partners
Deals
Reporting (existing group, unchanged)
Communications (group)         ← now just Email / SMS / Phone / Automations (4 children)
Internal Chats (NEW group)     ← Team Chat / Channels / DM Flags (3 children)
Partner Support (group)        ← Support Tickets / Live Chat Support (2 children)
Training
Live Weekly
Documents
Settings
Admin Users
Feature Requests
Development
```

12 top-level entries (nav consolidation #302 had 11; this adds one more group). The Internal Chats split creates tighter conceptual boundaries.

## New tabbed host page

**`/admin/internal-chats`** — parallel structure to the `/admin/communications` and `/admin/support` hosts landed in #302.

Top-level pill tabs:
- Team Chat (default)
- Channels
- DM Flags

URL encoding: `?tab=team-chat` / `?tab=channels` / `?tab=dmflags`.

Embeds the extracted panels `TeamChatPanel`, `ChannelsListPanel`, `DmFlagsListPanel` directly. Each panel was already extracted as part of #302's plan.

## Relocations

| Panel | Was (after #302) | Becomes (after this) |
|---|---|---|
| Team Chat | Communications group, child | Internal Chats group, child |
| Channels | Communications group, child | Internal Chats group, child |
| DM Flags | Partner Support group, child | Internal Chats group, child |

**Communications group children after relocation:** Email, SMS, Phone, Automations (4).
**Partner Support group children after relocation:** Support Tickets, Live Chat Support (2).

All route URLs continue to work unchanged. `/admin/team-chat`, `/admin/channels`, `/admin/partner-dm-flags` still resolve via their thin-wrapper pages.

## Sidebar registry update

`src/app/(admin)/admin/layout.tsx` — `ADMIN_NAV_ITEMS_MAP`:

1. Remove `Team Chat` + `Channels` from the `communications.children` array.
2. Remove `DM Flags` from the `partnerSupport.children` array.
3. Add a new top-level entry:

```ts
internalChats: {
  id: "internalChats",
  icon: "💬",
  label: "Internal Chats",
  children: [
    { id: "internalChats:team-chat", href: "/admin/team-chat",            icon: "💬", label: "Team Chat" },
    { id: "internalChats:channels",  href: "/admin/channels",             icon: "📣", label: "Channels" },
    { id: "internalChats:dmflags",   href: "/admin/partner-dm-flags",     icon: "🚩", label: "DM Flags" },
  ],
},
```

4. Update `ADMIN_NAV_IDS_DEFAULT` — insert `"internalChats"` between `"communications"` and `"partnerSupport"`:

```ts
const ADMIN_NAV_IDS_DEFAULT = [
  "partners", "deals", "reporting",
  "communications", "internalChats", "partnerSupport",
  "training", "conference", "documents",
  "settings", "users", "features", "dev",
];
```

## Settings → Navigation customizer update

`src/app/(admin)/admin/settings/page.tsx` — `ALL_ADMIN_NAV_ITEMS` gets an Internal Chats row:

```ts
const ALL_ADMIN_NAV_ITEMS = [
  { id: "partners", label: "Partners", icon: "👥" },
  { id: "deals", label: "Deals", icon: "📋" },
  { id: "communications", label: "Communications", icon: "💬" },
  { id: "internalChats", label: "Internal Chats", icon: "💬" },  // NEW
  { id: "partnerSupport", label: "Partner Support", icon: "🎧" },
  { id: "training", label: "Training", icon: "📖" },
  { id: "conference", label: "Live Weekly", icon: "📹" },
  { id: "documents", label: "Documents", icon: "📁" },
  { id: "reporting", label: "Reporting", icon: "📈" },
  { id: "settings", label: "Settings", icon: "⚙️" },
  { id: "users", label: "Admin Users", icon: "🔐" },
  { id: "dev", label: "Development", icon: "🛠️" },
  { id: "features", label: "Feature Requests", icon: "💡" },
];
```

Drag-and-drop reorder applies. The `reconcileNavOrder` helper (shipped in #302) already handles missing-ID append automatically — any admin who had a saved custom order before this change will see `internalChats` appended at the end on their next settings load, clean after that.

## Tabbed host code

`src/app/(admin)/admin/internal-chats/page.tsx` — mirrors the `/admin/support` host pattern from #302. Same `<Suspense>` wrapper + `useSearchParams` tab state + embedded panels.

```tsx
"use client";
import { Suspense, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import TeamChatPanel from "../team-chat/TeamChatPanel";
import ChannelsListPanel from "../channels/ChannelsListPanel";
import DmFlagsListPanel from "../partner-dm-flags/DmFlagsListPanel";

type Tab = "team-chat" | "channels" | "dmflags";
const TABS: { id: Tab; label: string }[] = [
  { id: "team-chat", label: "Team Chat" },
  { id: "channels",  label: "Channels" },
  { id: "dmflags",   label: "DM Flags" },
];

function InternalChatsHostInner() {
  const params = useSearchParams();
  const router = useRouter();
  const urlTab = params?.get("tab");
  const [tab, setTab] = useState<Tab>((TABS.some((t) => t.id === urlTab) ? urlTab : "team-chat") as Tab);

  const onSelect = (t: Tab) => {
    setTab(t);
    const qs = new URLSearchParams(params?.toString() || "");
    qs.set("tab", t);
    router.replace(`/admin/internal-chats?${qs.toString()}`);
  };

  return (
    <div>
      <div className="flex gap-2 mb-6 overflow-x-auto">
        {TABS.map((t) => (
          <button key={t.id} onClick={() => onSelect(t.id)}
            className={`font-body text-sm px-4 py-2 rounded-full whitespace-nowrap transition ${
              tab === t.id ? "bg-brand-gold/20 text-brand-gold" : "bg-[var(--app-input-bg)] text-[var(--app-text-secondary)] hover:text-[var(--app-text)]"
            }`}>{t.label}</button>
        ))}
      </div>
      {tab === "team-chat" && <TeamChatPanel />}
      {tab === "channels"  && <ChannelsListPanel />}
      {tab === "dmflags"   && <DmFlagsListPanel />}
    </div>
  );
}

export default function Page() {
  return <Suspense><InternalChatsHostInner /></Suspense>;
}
```

## Role visibility for Internal Chats

`src/lib/permissions.ts` — `ROLE_VISIBLE_NAV` per role:

- super_admin, admin, partner_support: add `"internalChats"` (these roles can access Team Chat + Channels + DM Flags per the earlier specs)
- accounting: do NOT add (no access to any internal-chat surface)

Same pattern as Partner Support: a role sees the group in the sidebar if it has permission for any child. Accounting is excluded entirely.

## Files touched

**New:**
- `src/app/(admin)/admin/internal-chats/page.tsx` — tabbed host

**Modified:**
- `src/app/(admin)/admin/layout.tsx` — new `internalChats` group entry; `communications.children` loses 2; `partnerSupport.children` loses 1; `ADMIN_NAV_IDS_DEFAULT` gains `internalChats`
- `src/lib/permissions.ts` — add `"internalChats"` to three roles
- `src/app/(admin)/admin/settings/page.tsx` — `ALL_ADMIN_NAV_ITEMS` gains an Internal Chats row
- `src/app/(admin)/admin/communications/page.tsx` — remove the Team Chat + Channels pill tabs (keep only Email/SMS/Phone/Automations)
- `src/app/(admin)/admin/support/page.tsx` — remove the DM Flags pill tab (keep only Support Tickets + Live Chat Support)

**Explicitly NOT touched:**
- Any extracted `*Panel.tsx` file (already shipped in #302's PR)
- Any API route, Prisma model, or business logic
- No URL removals — all six existing panel routes (`/admin/team-chat`, `/admin/channels`, `/admin/workflows`, `/admin/chat`, `/admin/support`, `/admin/partner-dm-flags`) still render via their thin-wrapper pages

## Dependency

Must land AFTER the nav consolidation PR from #302 merges. That PR creates the panel files (`TeamChatPanel`, `ChannelsListPanel`, `DmFlagsListPanel`) this host imports and creates the `/admin/communications` + `/admin/support` tabbed hosts whose tab lists we're trimming.

## Testing

Manual (after deploy):
- Admin sidebar shows 12 top-level entries; "Internal Chats" appears between Communications and Partner Support.
- Click Internal Chats → default Team Chat tab renders; switch to Channels and DM Flags tabs.
- Communications tab list no longer includes Team Chat/Channels pills.
- Partner Support tab list no longer includes DM Flags pill.
- All three panel URLs (`/admin/team-chat`, `/admin/channels`, `/admin/partner-dm-flags`) still render the same panels when accessed directly.
- Settings → Navigation shows "Internal Chats" as a draggable row; reorder saves and persists.
- An admin who had a saved nav order before this deploy: Internal Chats appears at the end of their list on first load; drag to preferred position; save.

## Out of v1

- Per-child reordering within the Internal Chats group (v1 uses the hardcoded order above).
- Any new functionality inside the panels — pure move.
- Renaming the Internal Chats label (configurable later if desired).
