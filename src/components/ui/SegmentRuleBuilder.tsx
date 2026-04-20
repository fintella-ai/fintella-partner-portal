"use client";

// Component: SegmentRuleBuilder
// Admin-facing compose helper for constructing a channel segment rule JSON.
// Emits the JSON string via onChange whenever the user edits any filter row.

import { useMemo, useState } from "react";

type Op = "eq" | "in" | "neq";
type Field = "tier" | "status" | "state" | "signedAgreement" | "l3Enabled";

type FilterRow = {
  field: Field;
  op: Op;
  value: string; // string form; we serialise based on field
};

const FIELDS: { value: Field; label: string }[] = [
  { value: "tier", label: "Tier" },
  { value: "status", label: "Status" },
  { value: "state", label: "State" },
  { value: "signedAgreement", label: "Signed agreement" },
  { value: "l3Enabled", label: "L3 enabled" },
];

const OPS: { value: Op; label: string }[] = [
  { value: "eq", label: "equals" },
  { value: "neq", label: "not equals" },
  { value: "in", label: "in (comma list)" },
];

function serialiseValue(field: Field, op: Op, raw: string): string | number | boolean | (string | number | boolean)[] {
  const trimmed = raw.trim();
  if (field === "signedAgreement" || field === "l3Enabled") {
    return trimmed.toLowerCase() === "true";
  }
  if (op === "in") {
    return trimmed.split(",").map((s) => s.trim()).filter(Boolean);
  }
  return trimmed;
}

export default function SegmentRuleBuilder({
  initialRule,
  onChange,
}: {
  initialRule?: string | null;
  onChange: (rule: string) => void;
}) {
  const [rows, setRows] = useState<FilterRow[]>(() => {
    if (!initialRule) return [];
    try {
      const parsed = JSON.parse(initialRule);
      if (Array.isArray(parsed?.filters)) {
        return parsed.filters.map((f: any) => ({
          field: f.field,
          op: f.op,
          value: Array.isArray(f.value) ? f.value.join(",") : String(f.value ?? ""),
        }));
      }
    } catch {}
    return [];
  });

  const emit = (next: FilterRow[]) => {
    const rule = {
      filters: next.map((r) => ({
        field: r.field,
        op: r.op,
        value: serialiseValue(r.field, r.op, r.value),
      })),
    };
    onChange(JSON.stringify(rule));
  };

  const update = (idx: number, patch: Partial<FilterRow>) => {
    const next = rows.map((r, i) => (i === idx ? { ...r, ...patch } : r));
    setRows(next);
    emit(next);
  };

  const add = () => {
    const next = [...rows, { field: "tier" as Field, op: "eq" as Op, value: "" }];
    setRows(next);
    emit(next);
  };

  const remove = (idx: number) => {
    const next = rows.filter((_, i) => i !== idx);
    setRows(next);
    emit(next);
  };

  const summary = useMemo(() => `${rows.length} filter${rows.length === 1 ? "" : "s"} • AND across all`, [rows.length]);

  return (
    <div className="theme-card p-3 space-y-2">
      <div className="flex items-center justify-between">
        <div className="text-sm font-medium">Segment rule</div>
        <div className="text-xs opacity-70">{summary}</div>
      </div>
      {rows.length === 0 && (
        <div className="text-xs opacity-60">No filters — every partner matches. Add one to narrow the audience.</div>
      )}
      {rows.map((row, idx) => (
        <div key={idx} className="flex flex-wrap gap-2 items-center">
          <select
            className="theme-input text-sm"
            value={row.field}
            onChange={(e) => update(idx, { field: e.target.value as Field })}
          >
            {FIELDS.map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}
          </select>
          <select
            className="theme-input text-sm"
            value={row.op}
            onChange={(e) => update(idx, { op: e.target.value as Op })}
          >
            {OPS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
          <input
            className="theme-input text-sm flex-1 min-w-[120px]"
            placeholder={row.op === "in" ? "l1,l2" : row.field === "signedAgreement" ? "true" : "value"}
            value={row.value}
            onChange={(e) => update(idx, { value: e.target.value })}
          />
          <button
            type="button"
            onClick={() => remove(idx)}
            className="text-xs opacity-70 hover:opacity-100 px-2 py-1"
            aria-label="Remove filter"
          >
            ✕
          </button>
        </div>
      ))}
      <button
        type="button"
        onClick={add}
        className="text-sm theme-btn-secondary px-3 py-1.5"
      >
        + Add filter
      </button>
    </div>
  );
}
