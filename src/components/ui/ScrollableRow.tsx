"use client";

import { useRef, useState, useEffect, useCallback, type ReactNode } from "react";

interface ScrollableRowProps {
  children: ReactNode;
  className?: string;
}

export default function ScrollableRow({ children, className = "" }: ScrollableRowProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const checkScroll = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 2);
    setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 2);
  }, []);

  useEffect(() => {
    checkScroll();
    const el = ref.current;
    if (!el) return;
    el.addEventListener("scroll", checkScroll, { passive: true });
    const ro = new ResizeObserver(checkScroll);
    ro.observe(el);
    return () => { el.removeEventListener("scroll", checkScroll); ro.disconnect(); };
  }, [checkScroll]);

  function scroll(dir: "left" | "right") {
    const el = ref.current;
    if (!el) return;
    el.scrollBy({ left: dir === "left" ? -200 : 200, behavior: "smooth" });
  }

  const arrowClass =
    "flex-shrink-0 flex items-center justify-center w-7 h-7 rounded-md border border-[var(--app-border)] bg-[var(--app-card-bg)] text-[var(--app-text-muted)] hover:text-brand-gold hover:border-brand-gold/30 transition-colors cursor-pointer";

  return (
    <div className={`flex items-center gap-1 ${className}`}>
      {canScrollLeft && (
        <button type="button" onClick={() => scroll("left")} className={arrowClass} aria-label="Scroll left">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6"/></svg>
        </button>
      )}
      <div ref={ref} className="flex-1 overflow-x-auto min-w-0">
        {children}
      </div>
      {canScrollRight && (
        <button type="button" onClick={() => scroll("right")} className={arrowClass} aria-label="Scroll right">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round"><path d="M9 18l6-6-6-6"/></svg>
        </button>
      )}
    </div>
  );
}
