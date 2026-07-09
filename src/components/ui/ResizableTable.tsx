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

/**
 * Hook that manages which columns are visible AND their display order,
 * as a single ordered array of keys (order = display order).
 *
 * Persists to localStorage under `col-order:${storageKey}` — a distinct
 * prefix from `col-widths:${storageKey}` (used by useResizableColumns), so
 * the two hooks never collide even when called with the same storageKey.
 *
 * Behavior notes:
 *   - On init, the saved array is filtered against `allKeys` so columns
 *     removed from the registry silently drop out (handles schema drift).
 *   - Keys newly added to `allKeys` that aren't in the saved array are NOT
 *     auto-appended — new columns stay hidden until the user opts in, so a
 *     deploy never surprises anyone with extra columns.
 *
 * Usage:
 *   const { visibleColumns, toggleColumn, reorderColumn, resetColumns } =
 *     useColumnPrefs(ALL_DEAL_COLUMN_KEYS, DEFAULT_VISIBLE_KEYS, { storageKey: "deals-v2" });
 */
export function useColumnPrefs(
  allKeys: string[],
  defaultVisible: string[],
  { storageKey }: { storageKey: string }
) {
  const [visibleColumns, setVisibleColumns] = useState<string[]>(() => {
    if (storageKey && typeof window !== "undefined") {
      try {
        const saved = localStorage.getItem(`col-order:${storageKey}`);
        if (saved) {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed)) {
            return parsed.filter((key) => allKeys.includes(key));
          }
        }
      } catch {}
    }
    return defaultVisible;
  });

  // Persist to localStorage whenever the visible/ordered column set changes
  useEffect(() => {
    if (storageKey && typeof window !== "undefined") {
      try {
        localStorage.setItem(`col-order:${storageKey}`, JSON.stringify(visibleColumns));
      } catch {}
    }
  }, [visibleColumns, storageKey]);

  const toggleColumn = useCallback((key: string) => {
    setVisibleColumns((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
    );
  }, []);

  const reorderColumn = useCallback((fromIdx: number, toIdx: number) => {
    setVisibleColumns((prev) => {
      const next = [...prev];
      const [moved] = next.splice(fromIdx, 1);
      next.splice(toIdx, 0, moved);
      return next;
    });
  }, []);

  const resetColumns = useCallback(() => {
    setVisibleColumns(defaultVisible);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [defaultVisible]);

  return { visibleColumns, setVisibleColumns, toggleColumn, reorderColumn, resetColumns };
}

/**
 * Key-indexed variant of useResizableColumns, for tables with a dynamic,
 * reorderable set of columns (paired with useColumnPrefs). Same drag-to-resize
 * and double-click-to-auto-fit UX as the original hook, but width state is
 * keyed by column key instead of array index.
 *
 * Persists to a NEW localStorage key `col-widths-v2:${storageKey}` —
 * deliberately NOT `col-widths:${storageKey}`, which holds the OLD
 * numeric-array-format widths from useResizableColumns. Reusing that key
 * with a new object shape would risk ambiguous/corrupt reads. Tables that
 * migrate to this hook leave their old `col-widths:` entry orphaned, which
 * is an accepted harmless tradeoff (just a one-time visual reset, no data loss).
 *
 * Usage:
 *   const { widthFor, getResizeHandlerFor } = useResizableColumnsByKey(
 *     visibleColumns, DEFAULT_WIDTHS, { storageKey: "deals-v2" }
 *   );
 *
 *   <th style={{ width: widthFor("name"), position: "relative" }}>
 *     Name
 *     <span {...getResizeHandlerFor("name")} />
 *   </th>
 */
export function useResizableColumnsByKey(
  keys: string[],
  defaultWidths: Record<string, number>,
  {
    minWidth = 60,
    maxWidth = 600,
    storageKey,
  }: { minWidth?: number; maxWidth?: number; storageKey: string }
) {
  const [columnWidths, setColumnWidths] = useState<Record<string, number>>(() => {
    if (storageKey && typeof window !== "undefined") {
      try {
        const saved = localStorage.getItem(`col-widths-v2:${storageKey}`);
        if (saved) {
          const parsed = JSON.parse(saved);
          if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
            // Merge with defaults so newly-visible columns get a sane width
            // immediately instead of undefined.
            return { ...defaultWidths, ...parsed };
          }
        }
      } catch {}
    }
    return { ...defaultWidths };
  });

  const dragging = useRef<{ key: string; startX: number; startWidth: number } | null>(null);

  // Persist to localStorage whenever widths change
  useEffect(() => {
    if (storageKey && typeof window !== "undefined") {
      try {
        localStorage.setItem(`col-widths-v2:${storageKey}`, JSON.stringify(columnWidths));
      } catch {}
    }
  }, [columnWidths, storageKey]);

  const widthFor = useCallback(
    (key: string) => columnWidths[key] ?? defaultWidths[key] ?? 150,
    [columnWidths, defaultWidths]
  );

  const setWidthFor = useCallback((key: string, width: number) => {
    setColumnWidths((prev) => ({ ...prev, [key]: width }));
  }, []);

  const onMouseMove = useCallback(
    (e: MouseEvent) => {
      if (!dragging.current) return;
      const { key, startX, startWidth } = dragging.current;
      const delta = e.clientX - startX;
      const newWidth = Math.max(minWidth, Math.min(maxWidth, startWidth + delta));
      setColumnWidths((prev) => ({ ...prev, [key]: newWidth }));
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
    (key: string, colIndex: number, handleEl: HTMLElement) => {
      const container = handleEl.closest("table, [class*='overflow']") || handleEl.parentElement?.parentElement?.parentElement;
      if (!container) {
        setColumnWidths((prev) => ({ ...prev, [key]: defaultWidths[key] || 150 }));
        return;
      }

      const rows = container.querySelectorAll("tr, [class*='grid']");
      let maxContentWidth = minWidth;

      rows.forEach((row) => {
        const cells = row.children;
        if (colIndex < cells.length) {
          const cell = cells[colIndex] as HTMLElement;
          const contentW = cell.scrollWidth + 16; // 16px padding buffer
          if (contentW > maxContentWidth) maxContentWidth = contentW;
        }
      });

      const fitted = Math.max(minWidth, Math.min(maxWidth, maxContentWidth));
      setColumnWidths((prev) => ({ ...prev, [key]: fitted }));
    },
    [defaultWidths, minWidth, maxWidth]
  );

  const getResizeHandlerFor = useCallback(
    (key: string) => ({
      onMouseDown: (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        dragging.current = {
          key,
          startX: e.clientX,
          startWidth: widthFor(key),
        };
        document.body.style.cursor = "col-resize";
        document.body.style.userSelect = "none";
      },
      onDoubleClick: (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        const colIndex = keys.indexOf(key);
        autoFitColumn(key, colIndex, e.currentTarget as HTMLElement);
      },
      className:
        "absolute right-0 top-0 bottom-0 w-px cursor-col-resize bg-[var(--app-border)] hover:w-1 hover:bg-brand-gold/60 transition-all z-10",
      style: { touchAction: "none" } as React.CSSProperties,
    }),
    [keys, widthFor, autoFitColumn]
  );

  return { columnWidths, widthFor, getResizeHandlerFor, setWidthFor };
}
