# Admin table column customization pattern

Shipped on the admin Deals page (PR #1168, 2026-07-09). Reusable for other admin tables (Partners, Payouts) that currently use `useResizableColumns` from `src/components/ui/ResizableTable.tsx`.

## What it does

- Toggle any of a field registry's columns on/off as visible table columns.
- Drag-and-drop reorder the visible columns (left-to-right display order).
- Export a CSV via a popup pre-checked to match the currently visible/ordered columns, with the ability to check additional fields before exporting.

## Architecture

1. **Isomorphic field registry** (`src/lib/dealColumns.ts` for Deals) — no React/DOM imports, so it's safely importable from BOTH a Next.js API route and a client component. Exports:
   - `DealColumnKey` — union of every field key
   - `DealColumnMeta` — `{ key, label, category, defaultVisible, align?, width? }`
   - `DEAL_COLUMNS: DealColumnMeta[]`, `DEAL_COLUMNS_BY_KEY`, `DEFAULT_VISIBLE_DEAL_COLUMNS`
   - `csvValue(key, deal, ctx)` — pure formatter, one branch per key (money raw numbers, rates as `"12.34%"` strings, dates as `YYYY-MM-DD`, arrays joined `"; "`, booleans as `"Yes"/"No"`)

2. **Client render layer** (`dealColumnsUi.tsx`) — separate file, `"use client"`, maps each key to a JSX cell renderer. Kept apart from the registry specifically so the registry stays importable from server code (API routes) without pulling in React component deps.

3. **Two new hooks** in `src/components/ui/ResizableTable.tsx` (additive — the original `useResizableColumns` is untouched and still used as-is by Partners/Payouts):
   - `useColumnPrefs(allKeys, defaultVisible, {storageKey})` → `{ visibleColumns, toggleColumn, reorderColumn, resetColumns }`. Single ordered array — order IS display order, so visibility and ordering share one piece of state. Persisted to `localStorage["col-order:${storageKey}"]`.
   - `useResizableColumnsByKey(keys, defaultWidths, {storageKey})` → key-indexed variant of the original index-indexed hook, needed because columns are now dynamic/reorderable. Persisted to a **new** key `col-widths-v2:${storageKey}` — deliberately not reusing the old array-shaped `col-widths:${storageKey}` key to avoid format ambiguity (old data there is now harmlessly orphaned, visual-preference-only).

4. **Two modal components**, page-scoped (`ColumnCustomizeModal.tsx`, `CsvExportModal.tsx`) — native HTML5 drag-and-drop for reordering (this codebase's established convention, no dnd library installed; see `landing-pages/page.tsx` for the original pattern this was copied from), standard `var(--app-*)`-themed modal shell (see `HeyGenOptionsModal.tsx` for the reference styling — NOT `ConfirmModal.tsx`'s glass-card variant, that's a different design system).

5. **CSV export stays server-side, `super_admin`-gated** — this was a deliberate product decision (not the simpler client-side-generation default), extending `/api/admin/deals/export` with a `columns=key1,key2,...` query param (validated against the registry, silently drops unknown keys, falls back to `DEFAULT_VISIBLE_DEAL_COLUMNS` if absent) rather than generating the CSV in the browser. Preserves server-enforced role gating (defense in depth) on this financial export, even though the same deal data already ships to any admin's browser for the table itself.

## To replicate for another admin table (e.g. Partners, Payouts)

1. Build a field registry file analogous to `dealColumns.ts` for that model.
2. Build a client render layer analogous to `dealColumnsUi.tsx`.
3. Reuse `useColumnPrefs`/`useResizableColumnsByKey` from `ResizableTable.tsx` as-is (already generic, not Deal-specific) with a new `storageKey`.
4. Reuse `ColumnCustomizeModal.tsx`'s pattern (could even be made fully generic/shared rather than copy-pasted, if a second table adopts this — currently it's Deal-specific in props).
5. Decide the CSV export gating question per-table — if there's no existing server-gated export route, client-side generation from already-fetched data is the simpler default; only go server-side if the export needs stronger role enforcement than the page's own UI gate.
