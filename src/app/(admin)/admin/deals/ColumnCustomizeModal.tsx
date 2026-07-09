"use client";

import { useRef, useState } from "react";
import {
  DEAL_COLUMNS,
  DEAL_COLUMNS_BY_KEY,
  type DealColumnKey,
} from "@/lib/dealColumns";

export type ColumnCustomizeModalProps = {
  open: boolean;
  onClose: () => void;
  visibleColumns: DealColumnKey[];
  onToggle: (key: DealColumnKey) => void;
  onReorder: (fromIdx: number, toIdx: number) => void;
  onReset: () => void;
};

export default function ColumnCustomizeModal({
  open,
  onClose,
  visibleColumns,
  onToggle,
  onReorder,
  onReset,
}: ColumnCustomizeModalProps) {
  const dragSrc = useRef<number | null>(null);
  const [dragOver, setDragOver] = useState<number | null>(null);

  if (!open) return null;

  function cleanup() {
    dragSrc.current = null;
    setDragOver(null);
  }

  function handleDragStart(idx: number) {
    dragSrc.current = idx;
  }

  function handleDragEnter(idx: number) {
    setDragOver(idx);
  }

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault();
  }

  function handleDrop(dropIdx: number) {
    const srcIdx = dragSrc.current;
    if (srcIdx === null || srcIdx === dropIdx) {
      cleanup();
      return;
    }
    onReorder(srcIdx, dropIdx);
    cleanup();
  }

  const visibleSet = new Set(visibleColumns);
  const availableByCategory: { category: string; cols: typeof DEAL_COLUMNS }[] = [];
  for (const col of DEAL_COLUMNS) {
    if (visibleSet.has(col.key)) continue;
    let group = availableByCategory.find((g) => g.category === col.category);
    if (!group) {
      group = { category: col.category, cols: [] };
      availableByCategory.push(group);
    }
    group.cols.push(col);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" onClick={onClose}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <div
        className="relative rounded-xl shadow-2xl p-5 w-full max-w-lg"
        style={{ background: "var(--app-bg)", border: "1px solid var(--app-border)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="font-display text-[16px] font-bold mb-1">Customize Columns</h3>
        <p className="font-body text-[12px] text-[var(--app-text-muted)] mb-4">
          Show, hide, and reorder the columns on the Deals table.
        </p>

        <div className="max-h-[60vh] overflow-y-auto pr-1 space-y-5">
          <div>
            <label className="font-body text-[11px] text-[var(--app-text-secondary)] font-medium block mb-2">
              Visible columns (drag to reorder)
            </label>
            <div className="space-y-1">
              {visibleColumns.map((key, idx) => {
                const meta = DEAL_COLUMNS_BY_KEY[key];
                if (!meta) return null;
                return (
                  <div
                    key={key}
                    draggable
                    onDragStart={() => handleDragStart(idx)}
                    onDragEnter={() => handleDragEnter(idx)}
                    onDragOver={handleDragOver}
                    onDrop={() => handleDrop(idx)}
                    onDragEnd={cleanup}
                    className={`flex items-center gap-2 rounded-lg px-2 py-1.5 border transition-colors cursor-grab active:cursor-grabbing ${
                      dragOver === idx
                        ? "border-purple-500/50 bg-purple-500/10"
                        : "border-[var(--app-border)]"
                    }`}
                  >
                    <span className="font-body text-[13px] text-[var(--app-text-muted)] select-none">
                      ⋮⋮
                    </span>
                    <label className="flex-1 flex items-center gap-2 font-body text-[13px] text-[var(--app-text)] cursor-pointer">
                      <input
                        type="checkbox"
                        checked
                        onChange={() => onToggle(key)}
                        className="h-4 w-4"
                      />
                      {meta.label}
                    </label>
                  </div>
                );
              })}
              {visibleColumns.length === 0 && (
                <p className="font-body text-[12px] text-[var(--app-text-muted)] italic px-2 py-1.5">
                  No columns visible.
                </p>
              )}
            </div>
          </div>

          <div>
            <label className="font-body text-[11px] text-[var(--app-text-secondary)] font-medium block mb-2">
              Available fields
            </label>
            <div className="space-y-3">
              {availableByCategory.map((group) => (
                <div key={group.category}>
                  <div className="font-body text-[10px] uppercase tracking-wide text-[var(--app-text-muted)] mb-1 px-2">
                    {group.category}
                  </div>
                  <div className="space-y-1">
                    {group.cols.map((col) => (
                      <label
                        key={col.key}
                        className="flex items-center gap-2 rounded-lg px-2 py-1.5 border border-transparent hover:border-[var(--app-border)] font-body text-[13px] text-[var(--app-text)] cursor-pointer"
                      >
                        <input
                          type="checkbox"
                          checked={false}
                          onChange={() => onToggle(col.key)}
                          className="h-4 w-4"
                        />
                        {col.label}
                      </label>
                    ))}
                  </div>
                </div>
              ))}
              {availableByCategory.length === 0 && (
                <p className="font-body text-[12px] text-[var(--app-text-muted)] italic px-2 py-1.5">
                  All fields are visible.
                </p>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between mt-5 pt-4 border-t" style={{ borderColor: "var(--app-border)" }}>
          <button
            type="button"
            onClick={onReset}
            className="font-body text-[12px] px-3 py-2 rounded-lg border border-[var(--app-border)] text-[var(--app-text-muted)] hover:border-[var(--app-text-secondary)] transition-colors"
          >
            Reset to Default
          </button>
          <button type="button" onClick={onClose} className="btn-gold font-body text-[12px] px-4 py-2 rounded-lg">
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
