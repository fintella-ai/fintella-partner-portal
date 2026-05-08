"use client";

const PAGE_SIZES = [10, 25, 50, 100] as const;

interface TablePaginationProps {
  page: number;
  pageSize: number;
  totalItems: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
}

export default function TablePagination({ page, pageSize, totalItems, onPageChange, onPageSizeChange }: TablePaginationProps) {
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const start = totalItems === 0 ? 0 : (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, totalItems);

  const maxVisible = 7;
  const pages: (number | "...")[] = [];
  if (totalPages <= maxVisible) {
    for (let i = 1; i <= totalPages; i++) pages.push(i);
  } else {
    pages.push(1);
    if (page > 3) pages.push("...");
    const rangeStart = Math.max(2, page - 1);
    const rangeEnd = Math.min(totalPages - 1, page + 1);
    for (let i = rangeStart; i <= rangeEnd; i++) pages.push(i);
    if (page < totalPages - 2) pages.push("...");
    pages.push(totalPages);
  }

  if (totalItems === 0) return null;

  return (
    <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-5 py-3 border-t border-[var(--app-border)]">
      <div className="font-body text-[12px] text-[var(--app-text-muted)]">
        Showing {start}–{end} of {totalItems}
      </div>
      <div className="flex items-center gap-2">
        <button
          onClick={() => onPageChange(page - 1)}
          disabled={page === 1}
          className="font-body text-[12px] px-2 py-1 rounded border border-[var(--app-border)] text-[var(--app-text-muted)] hover:text-[var(--app-text)] disabled:opacity-30 disabled:cursor-not-allowed transition min-h-[32px]"
        >
          Prev
        </button>
        {pages.map((p, i) =>
          p === "..." ? (
            <span key={`dots-${i}`} className="font-body text-[12px] text-[var(--app-text-muted)] px-1">...</span>
          ) : (
            <button
              key={p}
              onClick={() => onPageChange(p)}
              className={`font-body text-[12px] px-2.5 py-1 rounded border min-h-[32px] transition ${
                p === page
                  ? "border-brand-gold/40 text-brand-gold bg-brand-gold/10"
                  : "border-[var(--app-border)] text-[var(--app-text-muted)] hover:text-[var(--app-text)]"
              }`}
            >
              {p}
            </button>
          )
        )}
        <button
          onClick={() => onPageChange(page + 1)}
          disabled={page === totalPages}
          className="font-body text-[12px] px-2 py-1 rounded border border-[var(--app-border)] text-[var(--app-text-muted)] hover:text-[var(--app-text)] disabled:opacity-30 disabled:cursor-not-allowed transition min-h-[32px]"
        >
          Next
        </button>
        <select
          value={pageSize}
          onChange={(e) => { onPageSizeChange(Number(e.target.value)); onPageChange(1); }}
          className="font-body text-[12px] px-2 py-1 rounded border border-[var(--app-border)] bg-[var(--app-input-bg)] text-[var(--app-text-muted)] outline-none focus:border-brand-gold/40 min-h-[32px] cursor-pointer"
        >
          {PAGE_SIZES.map((s) => (
            <option key={s} value={s}>{s} per page</option>
          ))}
        </select>
      </div>
    </div>
  );
}
