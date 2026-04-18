"use client";

import { useState, useRef, useCallback, useEffect } from "react";

/**
 * Hook that adds column-resize handles to any table.
 *
 * Features:
 *   - Drag to resize columns (min 60px, max 600px by default)
 *   - Double-click to auto-fit column to content width
 *   - Persists widths to localStorage (survives refresh)
 *   - Optional storageKey for per-table persistence
 *
 * Usage:
 *   const { columnWidths, getResizeHandler } = useResizableColumns(
 *     [200, 150, 120],
 *     { storageKey: "deals-table" }
 *   );
 *
 *   <th style={{ width: columnWidths[0], position: "relative" }}>
 *     Name
 *     <span {...getResizeHandler(0)} />
 *   </th>
 */
export function useResizableColumns(
  initialWidths: number[],
  {
    minWidth = 60,
    maxWidth = 600,
    storageKey,
  }: { minWidth?: number; maxWidth?: number; storageKey?: string } = {}
) {
  const [columnWidths, setColumnWidths] = useState<number[]>(() => {
    // Load saved widths from localStorage on init
    if (storageKey && typeof window !== "undefined") {
      try {
        const saved = localStorage.getItem(`col-widths:${storageKey}`);
        if (saved) {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed) && parsed.length === initialWidths.length) {
            return parsed;
          }
        }
      } catch {}
    }
    return initialWidths;
  });

  const dragging = useRef<{ colIndex: number; startX: number; startWidth: number } | null>(null);

  // Persist to localStorage whenever widths change
  useEffect(() => {
    if (storageKey && typeof window !== "undefined") {
      try {
        localStorage.setItem(`col-widths:${storageKey}`, JSON.stringify(columnWidths));
      } catch {}
    }
  }, [columnWidths, storageKey]);

  const onMouseMove = useCallback(
    (e: MouseEvent) => {
      if (!dragging.current) return;
      const { colIndex, startX, startWidth } = dragging.current;
      const delta = e.clientX - startX;
      const newWidth = Math.max(minWidth, Math.min(maxWidth, startWidth + delta));
      setColumnWidths((prev) => {
        const next = [...prev];
        next[colIndex] = newWidth;
        return next;
      });
    },
    [minWidth, maxWidth]
  );

  const onMouseUp = useCallback(() => {
    dragging.current = null;
    document.body.style.cursor = "";
    document.body.style.userSelect = "";
  }, []);

  useEffect(() => {
    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseup", onMouseUp);
    return () => {
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseup", onMouseUp);
    };
  }, [onMouseMove, onMouseUp]);

  // Auto-fit: on double-click, scan all cells in that column and fit to max content width
  const autoFitColumn = useCallback(
    (colIndex: number, handleEl: HTMLElement) => {
      // Walk up to the table/grid container, then scan all rows for this column
      const container = handleEl.closest("table, [class*='overflow']") || handleEl.parentElement?.parentElement?.parentElement;
      if (!container) {
        // Fallback: reset to initial width
        setColumnWidths((prev) => {
          const next = [...prev];
          next[colIndex] = initialWidths[colIndex] || 150;
          return next;
        });
        return;
      }

      // For <table>: scan all td/th in this column index
      const rows = container.querySelectorAll("tr, [class*='grid']");
      let maxContentWidth = minWidth;

      rows.forEach((row) => {
        const cells = row.children;
        if (colIndex < cells.length) {
          const cell = cells[colIndex] as HTMLElement;
          // scrollWidth gives the full content width including overflow
          const contentW = cell.scrollWidth + 16; // 16px padding buffer
          if (contentW > maxContentWidth) maxContentWidth = contentW;
        }
      });

      const fitted = Math.max(minWidth, Math.min(maxWidth, maxContentWidth));
      setColumnWidths((prev) => {
        const next = [...prev];
        next[colIndex] = fitted;
        return next;
      });
    },
    [initialWidths, minWidth, maxWidth]
  );

  const getResizeHandler = useCallback(
    (colIndex: number) => ({
      onMouseDown: (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        dragging.current = {
          colIndex,
          startX: e.clientX,
          startWidth: columnWidths[colIndex],
        };
        document.body.style.cursor = "col-resize";
        document.body.style.userSelect = "none";
      },
      onDoubleClick: (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        autoFitColumn(colIndex, e.currentTarget as HTMLElement);
      },
      className:
        "absolute right-0 top-0 bottom-0 w-px cursor-col-resize bg-[var(--app-border)] hover:w-1 hover:bg-brand-gold/60 transition-all z-10",
      style: { touchAction: "none" } as React.CSSProperties,
    }),
    [columnWidths, autoFitColumn]
  );

  return { columnWidths, setColumnWidths, getResizeHandler };
}
