# Full Reporting Sort Arrows Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Every desktop table in `/dashboard/reporting` (5 tables across 4 tabs) gets clickable sort arrows on every sortable column. The existing inline `SortHeader` component from `/admin/reports` moves to a shared location and replaces the duplicate copy in `/admin/revenue`.

**Architecture:** A shared `<SortHeader>` component in `src/components/ui/SortHeader.tsx` + a pure `compareRows` helper in `src/lib/sortRows.ts` with support for accessor functions (for derived columns like "Commission" that depend on `source`). Each partner-reporting table owns its own `sort` + `dir` state with a `useMemo` sort. Mobile card views are untouched.

**Tech Stack:** React 18 client components. Pure TS for `compareRows` with Node `assert` tests run via `npx ts-node` (matches the existing seed-script pattern — no new framework).

**Spec:** `docs/superpowers/specs/2026-04-18-full-reporting-sort-arrows-design.md`

---

### Task 1: Write `compareRows` with failing tests

**Files:**
- Create: `src/lib/sortRows.ts`
- Create: `src/lib/__tests__/sortRows.test.ts`

- [ ] **Step 1: Write the failing test file**

```ts
// src/lib/__tests__/sortRows.test.ts
import assert from "node:assert/strict";
import { compareRows, type SortDir } from "../sortRows";

let passed = 0;
let failed = 0;

function test(name: string, fn: () => void) {
  try {
    fn();
    passed++;
    console.log(`  ✓ ${name}`);
  } catch (e) {
    failed++;
    console.log(`  ✗ ${name}`);
    console.log(`    ${(e as Error).message}`);
  }
}

function sortArr<T>(arr: T[], key: keyof T | string, dir: SortDir, accessors?: Record<string, (r: T) => unknown>): T[] {
  return [...arr].sort((a, b) => compareRows(a, b, key, dir, accessors));
}

console.log("compareRows");

test("sorts numbers ascending", () => {
  const rows = [{ n: 3 }, { n: 1 }, { n: 2 }];
  const out = sortArr(rows, "n", "asc");
  assert.deepEqual(out.map((r) => r.n), [1, 2, 3]);
});

test("sorts numbers descending", () => {
  const rows = [{ n: 3 }, { n: 1 }, { n: 2 }];
  const out = sortArr(rows, "n", "desc");
  assert.deepEqual(out.map((r) => r.n), [3, 2, 1]);
});

test("sorts ISO date strings chronologically", () => {
  const rows = [
    { d: "2026-03-05" },
    { d: "2026-01-10" },
    { d: "2026-02-20" },
  ];
  const out = sortArr(rows, "d", "asc");
  assert.deepEqual(out.map((r) => r.d), ["2026-01-10", "2026-02-20", "2026-03-05"]);
});

test("sorts strings case-insensitively via localeCompare", () => {
  const rows = [{ s: "banana" }, { s: "Apple" }, { s: "cherry" }];
  const out = sortArr(rows, "s", "asc");
  assert.deepEqual(out.map((r) => r.s), ["Apple", "banana", "cherry"]);
});

test("nulls always sort last when asc", () => {
  const rows = [{ n: 3 }, { n: null }, { n: 1 }, { n: null }];
  const out = sortArr(rows, "n", "asc");
  assert.deepEqual(out.map((r) => r.n), [1, 3, null, null]);
});

test("nulls always sort last when desc", () => {
  const rows = [{ n: 3 }, { n: null }, { n: 1 }];
  const out = sortArr(rows, "n", "desc");
  assert.deepEqual(out.map((r) => r.n), [3, 1, null]);
});

test("mixed null + string column does not throw", () => {
  const rows = [{ s: "zebra" }, { s: null }, { s: "apple" }];
  const out = sortArr(rows, "s", "asc");
  assert.deepEqual(out.map((r) => r.s), ["apple", "zebra", null]);
});

test("accessor resolves a derived column", () => {
  type Row = { source: "direct" | "downline"; l1: number; l2: number };
  const rows: Row[] = [
    { source: "direct", l1: 100, l2: 0 },
    { source: "downline", l1: 0, l2: 30 },
    { source: "direct", l1: 50, l2: 0 },
  ];
  const accessors: Record<string, (r: Row) => unknown> = {
    commission: (r) => (r.source === "direct" ? r.l1 : r.l2),
  };
  const out = sortArr(rows, "commission", "asc", accessors);
  assert.deepEqual(out.map((r) => (r.source === "direct" ? r.l1 : r.l2)), [30, 50, 100]);
});

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
npx ts-node --compiler-options '{"module":"commonjs","esModuleInterop":true}' src/lib/__tests__/sortRows.test.ts
```

Expected: module-not-found error for `../sortRows`. Non-zero exit code.

- [ ] **Step 3: Write the minimal `compareRows` implementation**

```ts
// src/lib/sortRows.ts
export type SortDir = "asc" | "desc";

const ISO_DATE_LEADING = /^\d{4}-/;

function getValue<T>(row: T, key: keyof T | string, accessors?: Record<string, (r: T) => unknown>): unknown {
  if (accessors && typeof key === "string" && key in accessors) return accessors[key](row);
  return (row as Record<string, unknown>)[key as string];
}

export function compareRows<T>(
  a: T,
  b: T,
  key: keyof T | string,
  dir: SortDir,
  accessors?: Record<string, (r: T) => unknown>
): number {
  const av = getValue(a, key, accessors);
  const bv = getValue(b, key, accessors);

  // Nulls sort last regardless of direction.
  const aNull = av === null || av === undefined;
  const bNull = bv === null || bv === undefined;
  if (aNull && bNull) return 0;
  if (aNull) return 1;
  if (bNull) return -1;

  // Numbers.
  if (typeof av === "number" && typeof bv === "number") {
    return dir === "asc" ? av - bv : bv - av;
  }

  // ISO-ish date strings (leading YYYY-).
  if (typeof av === "string" && typeof bv === "string" && ISO_DATE_LEADING.test(av) && ISO_DATE_LEADING.test(bv)) {
    const ad = Date.parse(av);
    const bd = Date.parse(bv);
    if (!Number.isNaN(ad) && !Number.isNaN(bd)) {
      return dir === "asc" ? ad - bd : bd - ad;
    }
  }

  // Strings.
  const as = String(av);
  const bs = String(bv);
  return dir === "asc" ? as.localeCompare(bs) : bs.localeCompare(as);
}
```

- [ ] **Step 4: Run the test to verify it passes**

```bash
npx ts-node --compiler-options '{"module":"commonjs","esModuleInterop":true}' src/lib/__tests__/sortRows.test.ts
```

Expected: `8 passed, 0 failed` and exit code 0.

- [ ] **Step 5: Commit**

```bash
git add src/lib/sortRows.ts src/lib/__tests__/sortRows.test.ts
git commit -m "feat(lib): add compareRows pure helper + unit tests"
```

---

### Task 2: Extract `SortHeader` into a shared component

**Files:**
- Create: `src/components/ui/SortHeader.tsx`
- Modify: `src/app/(admin)/admin/reports/page.tsx` (drop inline SortHeader, import shared)
- Modify: `src/app/(admin)/admin/revenue/page.tsx` (drop inline SortHeader, import shared)

- [ ] **Step 1: Create the shared component**

```tsx
// src/components/ui/SortHeader.tsx
"use client";

import type { SortDir } from "@/lib/sortRows";

export type { SortDir };

export type SortHeaderProps = {
  label: string;
  sortKey: string;
  currentSort: string;
  currentDir: SortDir;
  onSort: (key: string) => void;
};

export default function SortHeader({ label, sortKey, currentSort, currentDir, onSort }: SortHeaderProps) {
  const isActive = currentSort === sortKey;
  return (
    <button
      onClick={() => onSort(sortKey)}
      className="flex items-center gap-1 font-body text-[10px] tracking-[1px] uppercase theme-text-muted hover:text-brand-gold transition-colors text-left"
    >
      {label}
      <span className={`text-[8px] flex flex-col leading-none ${isActive ? "text-brand-gold" : "theme-text-faint"}`}>
        <span className={isActive && currentDir === "asc" ? "text-brand-gold" : ""}>&#9650;</span>
        <span className={isActive && currentDir === "desc" ? "text-brand-gold" : ""}>&#9660;</span>
      </span>
    </button>
  );
}
```

- [ ] **Step 2: Replace the inline `SortHeader` in `/admin/reports/page.tsx`**

At the top of `src/app/(admin)/admin/reports/page.tsx`, add the import alongside the existing imports:

```tsx
import SortHeader, { type SortDir } from "@/components/ui/SortHeader";
```

Remove the existing `type SortDir = "asc" | "desc";` declaration and the inline `function SortHeader(...)` block (approximately lines 8–23). Everything else in the file stays the same — the JSX usages of `<SortHeader ...>` now resolve to the shared component.

- [ ] **Step 3: Replace the inline `SortHeader` in `/admin/revenue/page.tsx`**

Same pattern. At the top, add:

```tsx
import SortHeader, { type SortDir } from "@/components/ui/SortHeader";
```

Remove `type SortDir = "asc" | "desc";` and the inline `function SortHeader(...)` block. The existing `type SortKey = string;` declaration stays.

- [ ] **Step 4: Build to verify everything compiles**

```bash
./node_modules/.bin/next build
```

Expected: "✓ Compiled successfully". Both admin pages still render sort headers with identical behavior.

- [ ] **Step 5: Commit**

```bash
git add src/components/ui/SortHeader.tsx src/app/\(admin\)/admin/reports/page.tsx src/app/\(admin\)/admin/revenue/page.tsx
git commit -m "refactor(ui): extract SortHeader into shared component"
```

---

### Task 3: Add sort state and sorted useMemo to the Overview tab's filtered-deals table

**Files:**
- Modify: `src/app/(partner)/dashboard/reporting/page.tsx`

- [ ] **Step 1: Import the shared pieces**

At the top of the file alongside the existing imports, add:

```tsx
import SortHeader, { type SortDir } from "@/components/ui/SortHeader";
import { compareRows } from "@/lib/sortRows";
```

- [ ] **Step 2: Add per-tab sort state inside the component body**

Immediately after the existing `const [searchQuery, setSearchQuery] = useState("");` line (around line 42), add:

```tsx
  // ── Sort state (one pair per table) ──
  const [overviewSort, setOverviewSort] = useState<string>("createdAt");
  const [overviewDir, setOverviewDir] = useState<SortDir>("desc");
  const [myDealsSort, setMyDealsSort] = useState<string>("createdAt");
  const [myDealsDir, setMyDealsDir] = useState<SortDir>("desc");
  const [downlinePartnersSort, setDownlinePartnersSort] = useState<string>("firstName");
  const [downlinePartnersDir, setDownlinePartnersDir] = useState<SortDir>("asc");
  const [downlineDealsSort, setDownlineDealsSort] = useState<string>("createdAt");
  const [downlineDealsDir, setDownlineDealsDir] = useState<SortDir>("desc");
  const [commSort, setCommSort] = useState<string>("createdAt");
  const [commDir, setCommDir] = useState<SortDir>("desc");

  const cycleSort = (
    key: string,
    current: string,
    dir: SortDir,
    setKey: (k: string) => void,
    setDir: (d: SortDir) => void
  ) => {
    if (current === key) setDir(dir === "asc" ? "desc" : "asc");
    else { setKey(key); setDir("asc"); }
  };
```

- [ ] **Step 3: Compute the sorted Overview deals via useMemo**

Immediately after the existing `filtered` useMemo (ends around line 103), add:

```tsx
  const overviewAccessors = useMemo(() => ({
    commission: (d: any) => (d.source === "direct" ? d.l1CommissionAmount : (d.l2CommissionAmount || 0)),
    status: (d: any) => (d.source === "direct" ? d.l1CommissionStatus : (d.l2CommissionStatus || "pending")),
    createdAt: (d: any) => d.createdAt,
  }), []);

  const sortedFiltered = useMemo(
    () => [...filtered].sort((a, b) => compareRows(a, b, overviewSort, overviewDir, overviewAccessors)),
    [filtered, overviewSort, overviewDir, overviewAccessors]
  );
```

- [ ] **Step 4: Replace the Overview desktop `<thead>` with SortHeader columns**

In the Overview tab's desktop table, replace the plain `<th>` headers (the block that currently renders "Deal", "Date", "Source", "Stage", "Refund", "Fee %", "Comm %", "Status", "Commission") with sortable headers. Change:

```tsx
<thead>
  <tr className="border-b border-[var(--app-border)]">
    <th className="px-4 sm:px-6 py-3 text-[11px] text-[var(--app-text-muted)] uppercase tracking-wider font-medium text-left">Deal</th>
    <th className="px-3 py-3 text-[11px] text-[var(--app-text-muted)] uppercase tracking-wider font-medium text-center">Date</th>
    <th className="px-3 py-3 text-[11px] text-[var(--app-text-muted)] uppercase tracking-wider font-medium text-center">Source</th>
    <th className="px-3 py-3 text-[11px] text-[var(--app-text-muted)] uppercase tracking-wider font-medium text-center">Stage</th>
    <th className="px-3 py-3 text-[11px] text-[var(--app-text-muted)] uppercase tracking-wider font-medium text-center">Refund</th>
    <th className="px-3 py-3 text-[11px] text-[var(--app-text-muted)] uppercase tracking-wider font-medium text-center">Fee %</th>
    <th className="px-3 py-3 text-[11px] text-[var(--app-text-muted)] uppercase tracking-wider font-medium text-center">Comm %</th>
    <th className="px-3 py-3 text-[11px] text-[var(--app-text-muted)] uppercase tracking-wider font-medium text-center">Status</th>
    <th className="px-3 py-3 text-[11px] text-[var(--app-text-muted)] uppercase tracking-wider font-medium text-center">Commission</th>
  </tr>
</thead>
```

to:

```tsx
<thead>
  <tr className="border-b border-[var(--app-border)]">
    {(() => {
      const on = (k: string) => cycleSort(k, overviewSort, overviewDir, setOverviewSort, setOverviewDir);
      const H = (props: { label: string; k: string; className?: string; sortable?: boolean }) => (
        <th className={props.className || "px-3 py-3 text-center"}>
          {props.sortable === false ? (
            <span className="font-body text-[10px] tracking-[1px] uppercase theme-text-muted">{props.label}</span>
          ) : (
            <SortHeader label={props.label} sortKey={props.k} currentSort={overviewSort} currentDir={overviewDir} onSort={on} />
          )}
        </th>
      );
      return (<>
        <H label="Deal" k="dealName" className="px-4 sm:px-6 py-3 text-left" />
        <H label="Date" k="createdAt" />
        <H label="Source" k="source" />
        <H label="Stage" k="stage" />
        <H label="Refund" k="estimatedRefundAmount" />
        <H label="Fee %" k="firmFeeRate" />
        <H label="Comm %" k="commRate" sortable={false} />
        <H label="Status" k="status" />
        <H label="Commission" k="commission" />
      </>);
    })()}
  </tr>
</thead>
```

- [ ] **Step 5: Point the `<tbody>` at `sortedFiltered` instead of `filtered`**

In the same Overview desktop table block, change `{filtered.map((deal, idx) => {` to `{sortedFiltered.map((deal, idx) => {`.

- [ ] **Step 6: Build to verify compile**

```bash
./node_modules/.bin/next build
```

Expected: "✓ Compiled successfully".

- [ ] **Step 7: Commit**

```bash
git add src/app/\(partner\)/dashboard/reporting/page.tsx
git commit -m "feat(reporting): sortable headers on Overview deals table"
```

---

### Task 4: Sortable headers on My Deals tab

**Files:**
- Modify: `src/app/(partner)/dashboard/reporting/page.tsx`

- [ ] **Step 1: Add sorted useMemo for direct deals**

Near the other `useMemo` declarations (after `sortedFiltered`), add:

```tsx
  const myDealsAccessors = useMemo(() => ({
    status: (d: any) => d.l1CommissionStatus,
    commission: (d: any) => d.l1CommissionAmount,
    createdAt: (d: any) => d.createdAt,
  }), []);

  const sortedDirectDeals = useMemo(
    () => [...directDeals].sort((a, b) => compareRows(a, b, myDealsSort, myDealsDir, myDealsAccessors)),
    [directDeals, myDealsSort, myDealsDir, myDealsAccessors]
  );
```

- [ ] **Step 2: Replace the My Deals desktop `<thead>` with SortHeader columns**

In the "MY DEALS TAB" block's desktop table, replace the `<thead>` with:

```tsx
<thead>
  <tr className="border-b border-[var(--app-border)]">
    {(() => {
      const on = (k: string) => cycleSort(k, myDealsSort, myDealsDir, setMyDealsSort, setMyDealsDir);
      const H = (props: { label: string; k: string; className?: string; sortable?: boolean }) => (
        <th className={props.className || "px-3 py-3 text-center"}>
          {props.sortable === false ? (
            <span className="font-body text-[10px] tracking-[1px] uppercase theme-text-muted">{props.label}</span>
          ) : (
            <SortHeader label={props.label} sortKey={props.k} currentSort={myDealsSort} currentDir={myDealsDir} onSort={on} />
          )}
        </th>
      );
      return (<>
        <H label="Deal" k="dealName" className="px-4 sm:px-6 py-3 text-left" />
        <H label="Date" k="createdAt" />
        <H label="Stage" k="stage" />
        <H label="Refund" k="estimatedRefundAmount" />
        <H label="Fee %" k="firmFeeRate" />
        <H label="Comm %" k="commRate" sortable={false} />
        <H label="Status" k="status" />
        <H label="Commission" k="commission" />
      </>);
    })()}
  </tr>
</thead>
```

- [ ] **Step 3: Point `<tbody>` at `sortedDirectDeals`**

In the same block, change the IIFE's `const deals = directDeals;` to `const deals = sortedDirectDeals;`.

- [ ] **Step 4: Build**

```bash
./node_modules/.bin/next build
```

Expected: "✓ Compiled successfully".

- [ ] **Step 5: Commit**

```bash
git add src/app/\(partner\)/dashboard/reporting/page.tsx
git commit -m "feat(reporting): sortable headers on My Deals table"
```

---

### Task 5: Sortable headers on Downline › Partners table

**Files:**
- Modify: `src/app/(partner)/dashboard/reporting/page.tsx`

- [ ] **Step 1: Add sorted useMemo for downline partners**

Near the other useMemos:

```tsx
  const downlinePartnersAccessors = useMemo(() => ({
    firstName: (p: any) => `${p.firstName || ""} ${p.lastName || ""}`.trim(),
    override: (p: any) => Math.max(0, commissionRate - (p.commissionRate || 0)),
  }), [commissionRate]);

  const sortedDownlinePartners = useMemo(
    () => [...downlinePartners].sort((a, b) => compareRows(a, b, downlinePartnersSort, downlinePartnersDir, downlinePartnersAccessors)),
    [downlinePartners, downlinePartnersSort, downlinePartnersDir, downlinePartnersAccessors]
  );
```

- [ ] **Step 2: Replace the Downline Partners desktop `<thead>`**

In the Downline tab's `partnerView === "list"` desktop branch, replace the `<thead>` block with:

```tsx
<thead>
  <tr className="border-b border-[var(--app-border)]">
    {(() => {
      const on = (k: string) => cycleSort(k, downlinePartnersSort, downlinePartnersDir, setDownlinePartnersSort, setDownlinePartnersDir);
      const H = (props: { label: string; k: string; className?: string; sortable?: boolean }) => (
        <th className={props.className || "px-3 py-3 text-center"}>
          {props.sortable === false ? (
            <span className="font-body text-[10px] tracking-[1px] uppercase theme-text-muted">{props.label}</span>
          ) : (
            <SortHeader label={props.label} sortKey={props.k} currentSort={downlinePartnersSort} currentDir={downlinePartnersDir} onSort={on} />
          )}
        </th>
      );
      return (<>
        <H label="Partner" k="firstName" className="px-4 sm:px-6 py-3 text-left" />
        <H label="Code" k="partnerCode" />
        <H label="Company" k="companyName" />
        <H label="Status" k="status" />
        <H label="Their Rate" k="commissionRate" />
        <H label="Your Override" k="override" />
        <H label="Your Total" k="yourTotal" sortable={false} />
      </>);
    })()}
  </tr>
</thead>
```

- [ ] **Step 3: Point `<tbody>` at `sortedDownlinePartners`**

Change `downlinePartners.map((p, idx) => {` (inside the desktop branch) to `sortedDownlinePartners.map((p, idx) => {`.

- [ ] **Step 4: Build**

```bash
./node_modules/.bin/next build
```

Expected: "✓ Compiled successfully".

- [ ] **Step 5: Commit**

```bash
git add src/app/\(partner\)/dashboard/reporting/page.tsx
git commit -m "feat(reporting): sortable headers on Downline Partners table"
```

---

### Task 6: Sortable headers on Downline › Deals table

**Files:**
- Modify: `src/app/(partner)/dashboard/reporting/page.tsx`

- [ ] **Step 1: Add sorted useMemo for downline deals**

Near the other useMemos:

```tsx
  const downlineDealsAccessors = useMemo(() => ({
    submittingPartner: (d: any) => d.submittingPartnerName || partnerNameMap[d.partnerCode || ""] || d.partnerCode || "",
    commission: (d: any) => d.l2CommissionAmount || 0,
    status: (d: any) => d.l2CommissionStatus || "pending",
    createdAt: (d: any) => d.createdAt,
  }), [partnerNameMap]);

  const sortedDownlineDeals = useMemo(
    () => [...downlineDeals].sort((a, b) => compareRows(a, b, downlineDealsSort, downlineDealsDir, downlineDealsAccessors)),
    [downlineDeals, downlineDealsSort, downlineDealsDir, downlineDealsAccessors]
  );
```

- [ ] **Step 2: Replace the Downline Deals desktop `<thead>`**

In the Downline tab's `downlineSubTab === "deals"` desktop branch, replace the `<thead>`:

```tsx
<thead>
  <tr className="border-b border-[var(--app-border)]">
    {(() => {
      const on = (k: string) => cycleSort(k, downlineDealsSort, downlineDealsDir, setDownlineDealsSort, setDownlineDealsDir);
      const H = (props: { label: string; k: string; className?: string; sortable?: boolean }) => (
        <th className={props.className || "px-3 py-3 text-center"}>
          {props.sortable === false ? (
            <span className="font-body text-[10px] tracking-[1px] uppercase theme-text-muted">{props.label}</span>
          ) : (
            <SortHeader label={props.label} sortKey={props.k} currentSort={downlineDealsSort} currentDir={downlineDealsDir} onSort={on} />
          )}
        </th>
      );
      return (<>
        <H label="Deal" k="dealName" className="px-4 sm:px-6 py-3 text-left" />
        <H label="Partner" k="submittingPartner" />
        <H label="Date" k="createdAt" />
        <H label="Stage" k="stage" />
        <H label="Refund" k="estimatedRefundAmount" />
        <H label="Fee %" k="firmFeeRate" />
        <H label="Status" k="status" />
        <H label="Commission" k="commission" />
      </>);
    })()}
  </tr>
</thead>
```

- [ ] **Step 3: Point `<tbody>` at `sortedDownlineDeals`**

Change `downlineDeals.map((deal, idx) => (` to `sortedDownlineDeals.map((deal, idx) => (` inside the desktop branch.

- [ ] **Step 4: Build**

```bash
./node_modules/.bin/next build
```

Expected: "✓ Compiled successfully".

- [ ] **Step 5: Commit**

```bash
git add src/app/\(partner\)/dashboard/reporting/page.tsx
git commit -m "feat(reporting): sortable headers on Downline Deals table"
```

---

### Task 7: Sortable headers on Commission History table

**Files:**
- Modify: `src/app/(partner)/dashboard/reporting/page.tsx`

- [ ] **Step 1: Add sorted useMemo for the derived commDeals array**

The commDeals array is built inside the Commissions tab render function. Move the sort outside or wrap in `useMemo` at the same place it's built. Since `commDeals` depends on `commSubTab`, compute sort inline with a fresh useMemo per render cycle:

Inside the Commissions tab IIFE, after `const commDeals = [...];` (around the existing construction), add:

```tsx
              const commAccessors: Record<string, (d: any) => unknown> = {
                dealName: (d) => d.dealName,
                createdAt: (d) => d.createdAt,
                tier: (d) => d._tier,
                status: (d) => d._status,
                commission: (d) => d._amt,
              };
              const sortedCommDeals = [...commDeals].sort((a, b) => compareRows(a, b, commSort, commDir, commAccessors));
```

Note: this is a render-time sort (not useMemo) because `commDeals` is already rebuilt per render. That is acceptable — the arrays are small.

- [ ] **Step 2: Replace the Commissions desktop `<thead>`**

Inside the Commissions tab's desktop branch, replace the `<thead>` block:

```tsx
<thead>
  <tr className="border-b border-[var(--app-border)]">
    {(() => {
      const on = (k: string) => cycleSort(k, commSort, commDir, setCommSort, setCommDir);
      const H = (props: { label: string; k: string; className?: string }) => (
        <th className={props.className || "px-3 py-3 text-center"}>
          <SortHeader label={props.label} sortKey={props.k} currentSort={commSort} currentDir={commDir} onSort={on} />
        </th>
      );
      return (<>
        <H label="Deal" k="dealName" className="px-4 sm:px-6 py-3 text-left" />
        <H label="Date" k="createdAt" />
        <H label="Tier" k="tier" />
        <H label="Status" k="status" />
        <H label="Commission" k="commission" />
      </>);
    })()}
  </tr>
</thead>
```

- [ ] **Step 3: Point `<tbody>` at `sortedCommDeals`**

Change `commDeals.map((deal, idx) => (` to `sortedCommDeals.map((deal, idx) => (` inside the desktop branch only (mobile cards keep `commDeals`).

- [ ] **Step 4: Build**

```bash
./node_modules/.bin/next build
```

Expected: "✓ Compiled successfully".

- [ ] **Step 5: Commit**

```bash
git add src/app/\(partner\)/dashboard/reporting/page.tsx
git commit -m "feat(reporting): sortable headers on Commission History table"
```

---

### Task 8: Open PR and hand off for review

**Files:** none (git + gh only)

- [ ] **Step 1: Push the branch**

```bash
git push -u origin HEAD
```

- [ ] **Step 2: Open the PR**

```bash
gh pr create --title "feat(reporting): clickable sort arrows on all Full Reporting tables" --body "$(cat <<'EOF'
## Summary

- Every desktop table across \`/dashboard/reporting\` (5 tables, 4 tabs) now supports click-to-sort on every sortable column.
- The inline \`SortHeader\` from \`/admin/reports\` moves to \`src/components/ui/SortHeader.tsx\` and is reused by \`/admin/revenue\` too.
- New pure helper \`src/lib/sortRows.ts\` with accessor support handles number / date / string / null-last sorting.
- Implements the design at \`docs/superpowers/specs/2026-04-18-full-reporting-sort-arrows-design.md\`.

## Defaults

| Tab | Table | Default sort |
|---|---|---|
| Overview | Filtered deals | createdAt desc |
| My Deals | Direct deals | createdAt desc |
| Downline › Partners | Partners list | firstName asc |
| Downline › Deals | Downline deals | createdAt desc |
| Commissions | Commission history | createdAt desc |

Mobile card views are untouched.

## Test plan

- [ ] Run \`npx ts-node --compiler-options '{"module":"commonjs","esModuleInterop":true}' src/lib/__tests__/sortRows.test.ts\` → 8 passed
- [ ] Open /dashboard/reporting as a partner with multiple deals and a downline
- [ ] Click every sortable column on every tab → arrow highlights flip, rows reorder correctly
- [ ] Verify /admin/reports and /admin/revenue still behave identically after the SortHeader extraction
- [ ] CI green (CodeQL + Vercel)
EOF
)"
```

- [ ] **Step 3: Report the PR URL**

Stop here and confirm the PR URL with the user before squash-merging. Per repo convention, main is branch-protected — the merge must be explicitly authorized.

---

## Out of scope (from the spec, do not build)

- New filter bars on non-Overview tabs
- Multi-column secondary sort
- Persisted sort preference across sessions
- Admin-side Payouts page sort arrows (bonus backfit, separate change)
