"use client";

import { useEffect, useState } from "react";
import { DEAL_COLUMNS, type DealColumnKey } from "@/lib/dealColumns";

type CsvExportModalProps = {
  open: boolean;
  onClose: () => void;
  visibleColumns: DealColumnKey[]; // current table's visible/ordered columns — the pre-check baseline
  filters: { stage: string; partner: string; search: string }; // current page filter state, forwarded to the export URL
};

export default function CsvExportModal({ open, onClose, visibleColumns, filters }: CsvExportModalProps) {
  const [checked, setChecked] = useState<Set<DealColumnKey>>(new Set());

  // Re-sync the checked set to the table's CURRENT visible/ordered columns
  // every time the modal transitions to open.
  useEffect(() => {
    if (open) {
      setChecked(new Set(visibleColumns));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  if (!open) return null;

  const toggle = (key: DealColumnKey) => {
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  const resetToVisible = () => {
    setChecked(new Set(visibleColumns));
  };

  const categories: string[] = [];
  for (const col of DEAL_COLUMNS) {
    if (!categories.includes(col.category)) categories.push(col.category);
  }

  const handleExport = () => {
    // Deterministic order: columns that were already in visibleColumns, in
    // visibleColumns's order, followed by any additionally-checked columns
    // (not in visibleColumns) in DEAL_COLUMNS registry order. Always derived
    // by filtering — never dependent on Set iteration/insertion order.
    const visibleSet = new Set(visibleColumns);
    const fromVisible = visibleColumns.filter((key) => checked.has(key));
    const extras = DEAL_COLUMNS.filter((c) => checked.has(c.key) && !visibleSet.has(c.key)).map((c) => c.key);
    const orderedKeys = [...fromVisible, ...extras];

    const params = new URLSearchParams();
    if (filters.stage !== "all") params.set("stage", filters.stage);
    if (filters.partner && filters.partner !== "__unknown__") params.set("partner", filters.partner);
    if (filters.search) params.set("search", filters.search);
    params.set("columns", orderedKeys.join(","));

    window.open(`/api/admin/deals/export?${params.toString()}`);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" onClick={onClose}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <div
        className="relative rounded-xl shadow-2xl p-5 w-full max-w-lg"
        style={{ background: "var(--app-bg)", border: "1px solid var(--app-border)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-1">
          <h3 className="font-display text-[16px] font-bold">Export CSV</h3>
          <button
            type="button"
            onClick={resetToVisible}
            className="font-body text-[11px] text-[var(--app-text-muted)] hover:text-[var(--app-text)] transition-colors"
          >
            Reset to visible columns
          </button>
        </div>
        <p className="font-body text-[12px] text-[var(--app-text-muted)] mb-4">
          Choose which columns to include in the exported CSV.
        </p>

        <div className="max-h-[60vh] overflow-y-auto space-y-4 pr-1">
          {categories.map((category) => (
            <div key={category}>
              <div className="font-body text-[10px] font-bold tracking-wide uppercase text-[var(--app-text-muted)] mb-1.5">
                {category}
              </div>
              <div className="space-y-1">
                {DEAL_COLUMNS.filter((c) => c.category === category).map((col) => (
                  <label
                    key={col.key}
                    className="flex items-center gap-2 font-body text-[12px] text-[var(--app-text)] rounded-lg px-2 py-1.5 hover:bg-[var(--app-input-bg)] cursor-pointer transition-colors"
                  >
                    <input
                      type="checkbox"
                      checked={checked.has(col.key)}
                      onChange={() => toggle(col.key)}
                      className="h-4 w-4 accent-brand-gold"
                    />
                    {col.label}
                  </label>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="flex gap-2 mt-5">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 font-body text-[12px] px-3 py-2 rounded-lg border border-[var(--app-border)] text-[var(--app-text-muted)] hover:text-[var(--app-text)] transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleExport}
            disabled={checked.size === 0}
            className="btn-gold flex-1 font-body text-[12px] px-3 py-2 rounded-lg font-medium disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Export CSV
          </button>
        </div>
      </div>
    </div>
  );
}
