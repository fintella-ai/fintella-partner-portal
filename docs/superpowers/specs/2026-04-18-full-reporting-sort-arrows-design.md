# Full Reporting Sort Arrows — Design

**Date:** 2026-04-18
**Status:** Approved for implementation
**Surface:** `/dashboard/reporting` (partner-side), with a reusable component that also backfits `/admin/reports` and `/admin/revenue`.

## Goal

All desktop tables across the partner Full Reporting page get clickable sort arrows on every column. The `SortHeader` component currently inlined in `/admin/reports/page.tsx` moves to a shared location and is reused in all five partner tables.

## Scope

Exactly these five desktop tables (mobile card views unchanged):

| Tab | Table | Row source | Default sort |
|---|---|---|---|
| Overview | Filtered deals | `filtered` (combined direct + downline) | `createdAt desc` |
| My Deals | Direct deals | `directDeals` | `createdAt desc` |
| Downline › Partners | Downline partners | `downlinePartners` | `firstName asc` |
| Downline › Deals | Downline deals | `downlineDeals` | `createdAt desc` |
| Commissions | Commission history | `commDeals` (derived) | `createdAt desc` |

## Architecture

### 1. Extract `SortHeader` to shared component

**New file:** `src/components/ui/SortHeader.tsx`

```tsx
export type SortDir = "asc" | "desc";

export type SortHeaderProps = {
  label: string;
  sortKey: string;
  currentSort: string;
  currentDir: SortDir;
  onSort: (key: string) => void;
  align?: "left" | "center" | "right";
};
```

Behavior: renders a `<button>` styled identically to existing table headers with a small up/down triangle stack. Active column's active direction highlights gold. Click calls `onSort(sortKey)`.

Styling matches the existing inline version from `/admin/reports/page.tsx` lines 10–23.

**Refactor:** `/admin/reports/page.tsx` + `/admin/revenue/page.tsx` delete their inline `SortHeader` definitions and import from `src/components/ui/SortHeader`. Zero behavior change expected.

### 2. Add per-tab sort state in `/dashboard/reporting/page.tsx`

Each tab's table owns its own `sort` + `dir` useState pair plus a `useMemo` sorted array. No cross-tab state sharing.

Toggle rule: click a header → if `sort === key`, flip `dir`; else set `sort = key`, `dir = "asc"` (except the default starting dir per table from the table above).

### 3. Comparator helper

**New helper:** `src/lib/sortRows.ts` (always extracted; unit-testable and reused by future sortable tables).

```ts
function compareRows<T>(a: T, b: T, key: keyof T | string, dir: SortDir): number {
  const av = (a as any)[key];
  const bv = (b as any)[key];
  // null/undefined sort last regardless of dir
  if (av == null && bv == null) return 0;
  if (av == null) return 1;
  if (bv == null) return -1;
  // numbers
  if (typeof av === "number" && typeof bv === "number") {
    return dir === "asc" ? av - bv : bv - av;
  }
  // dates (ISO strings or Date)
  const ad = Date.parse(av as string);
  const bd = Date.parse(bv as string);
  if (!isNaN(ad) && !isNaN(bd) && typeof av === "string" && /^\d{4}-/.test(av)) {
    return dir === "asc" ? ad - bd : bd - ad;
  }
  // strings
  return dir === "asc"
    ? String(av).localeCompare(String(bv))
    : String(bv).localeCompare(String(av));
}
```

Usage: `const sorted = useMemo(() => [...rows].sort((a, b) => compareRows(a, b, sort, dir)), [rows, sort, dir]);`

## Per-table column map

For each table, map each existing `<th>` to a `<th><SortHeader .../></th>`. Columns that sort on a derived value (e.g. Overview's "Commission" column = `source === "direct" ? l1CommissionAmount : l2CommissionAmount`) are sorted by projecting the row through a lookup:

```ts
const sortAccessors: Record<string, (d: any) => any> = {
  commission: (d) => d.source === "direct" ? d.l1CommissionAmount : d.l2CommissionAmount,
  status: (d) => d.source === "direct" ? d.l1CommissionStatus : d.l2CommissionStatus,
  // ...
};
```

Extend `compareRows` to accept an optional accessor: `compareRows(a, b, key, dir, accessors?)`.

### Column → sortKey mapping

**Overview / Filtered deals (9 cols):**
- Deal → `dealName`
- Date → `createdAt`
- Source → `source`
- Stage → `stage`
- Refund → `estimatedRefundAmount`
- Fee % → `firmFeeRate`
- Comm % → (static, non-sortable — skip `SortHeader`, keep plain `<th>`)
- Status → derived `commStatus`
- Commission → derived `commAmt`

**My Deals / Direct deals (8 cols):** same as Overview minus Source, with Commission/Status resolved against L1 fields directly.

**Downline › Partners (7 cols):** Partner → `firstName` (composed `firstName lastName`), Code → `partnerCode`, Company → `companyName`, Status → `status`, Their Rate → `commissionRate`, Your Override → derived `commissionRate - p.commissionRate`, Your Total → static (non-sortable).

**Downline › Deals (8 cols):** Deal → `dealName`, Partner → derived `submittingPartnerName || partnerNameMap[partnerCode]`, Date → `createdAt`, Stage → `stage`, Refund → `estimatedRefundAmount`, Fee % → `firmFeeRate`, Status → `l2CommissionStatus`, Commission → `l2CommissionAmount`.

**Commissions / Commission history (5 cols):** Deal → `dealName`, Date → `createdAt`, Tier → `_tier`, Status → `_status`, Commission → `_amt`.

## Error handling

- `compareRows` tolerates `null`/`undefined` (sort last) and mixed types (fall through to `String(...).localeCompare`).
- Default sort is always set, so there is no "unsorted" state where rendering could break.
- Re-sorting a filtered list is pure; no effect on data fetch or display of empty-state message.

## Testing

Unit tests at `src/lib/__tests__/sortRows.test.ts` + `src/components/ui/__tests__/SortHeader.test.tsx`:

1. `compareRows` sorts numbers ascending and descending.
2. `compareRows` sorts ISO dates correctly.
3. `compareRows` sorts strings case-insensitively via `localeCompare`.
4. Nulls always sort last, both asc and desc.
5. Mixed-type column (e.g. string + null) doesn't throw.
6. `SortHeader` renders active dir with gold highlight only on the active key.
7. Click handler fires with the right `sortKey`.

Manual browser verification: open each tab, click every sortable header, confirm arrow highlights flip and rows reorder correctly.

## Out of scope

- New filter bars on non-Overview tabs (explicitly declined in brainstorm).
- Multi-column secondary sort.
- Persisted sort preference across sessions.
- Admin-side Payouts page (has a separate unrelated table; bonus backfit possible later).

## Files touched

- `src/components/ui/SortHeader.tsx` — new.
- `src/components/ui/__tests__/SortHeader.test.tsx` — new.
- `src/lib/sortRows.ts` — new.
- `src/lib/__tests__/sortRows.test.ts` — new.
- `src/app/(partner)/dashboard/reporting/page.tsx` — add sort state + sorted useMemos + replace `<th>` content with `<SortHeader>` across 5 tables.
- `src/app/(admin)/admin/reports/page.tsx` — drop inline `SortHeader`, import shared.
- `src/app/(admin)/admin/revenue/page.tsx` — drop inline `SortHeader`, import shared.
