"use client";

import { useState, useRef, useCallback } from "react";

interface PullToRefreshProps {
  onRefresh: () => Promise<void>;
  children: React.ReactNode;
  disabled?: boolean;
}

const PULL_THRESHOLD = 80;
const MAX_PULL = 120;

/**
 * Pull-to-refresh wrapper for mobile data pages.
 * Wraps page content and shows a refresh indicator when pulled down.
 */
export default function PullToRefresh({ onRefresh, children, disabled }: PullToRefreshProps) {
  const [pulling, setPulling] = useState(false);
  const [pullDistance, setPullDistance] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const startY = useRef(0);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (disabled || refreshing) return;
    // Only trigger when scrolled to top
    if (containerRef.current && containerRef.current.scrollTop > 0) return;
    startY.current = e.touches[0].clientY;
    setPulling(true);
  }, [disabled, refreshing]);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!pulling || refreshing) return;
    const delta = e.touches[0].clientY - startY.current;
    if (delta > 0) {
      setPullDistance(Math.min(delta * 0.5, MAX_PULL));
    }
  }, [pulling, refreshing]);

  const handleTouchEnd = useCallback(async () => {
    if (!pulling) return;
    setPulling(false);

    if (pullDistance >= PULL_THRESHOLD) {
      setRefreshing(true);
      setPullDistance(PULL_THRESHOLD * 0.5);
      try {
        await onRefresh();
      } finally {
        setRefreshing(false);
        setPullDistance(0);
      }
    } else {
      setPullDistance(0);
    }
  }, [pulling, pullDistance, onRefresh]);

  const progress = Math.min(pullDistance / PULL_THRESHOLD, 1);
  const showIndicator = pullDistance > 10 || refreshing;

  return (
    <div
      ref={containerRef}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      className="relative"
    >
      {/* Pull indicator */}
      {showIndicator && (
        <div
          className="flex items-center justify-center transition-opacity duration-200"
          style={{ height: pullDistance, opacity: progress }}
        >
          <div
            className={`w-7 h-7 rounded-full border-2 border-brand-gold/40 border-t-brand-gold ${refreshing ? "animate-spin" : ""}`}
            style={{
              transform: refreshing ? undefined : `rotate(${progress * 360}deg)`,
              transition: pulling ? "none" : "transform 0.2s ease",
            }}
          />
        </div>
      )}

      {/* Content */}
      <div
        style={{
          transform: showIndicator && !refreshing ? `translateY(${pullDistance > 10 ? 0 : 0}px)` : undefined,
        }}
      >
        {children}
      </div>
    </div>
  );
}
