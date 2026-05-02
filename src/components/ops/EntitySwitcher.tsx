"use client";

import { useState, useRef, useEffect } from "react";
import { useEntity, type OpsEntity } from "./EntityContext";

// ── Globe icon (inline SVG, no external deps) ───────────────────────────────

function GlobeIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 20 20"
      fill="currentColor"
      aria-hidden="true"
    >
      <path
        fillRule="evenodd"
        d="M10 18a8 8 0 100-16 8 8 0 000 16zM4.332 8.027a6.012 6.012 0 011.912-2.706C6.512 5.73 6.974 6 7.5 6A1.5 1.5 0 019 7.5V8a2 2 0 004 0 2 2 0 011.523-1.943A5.977 5.977 0 0116 10c0 .34-.028.675-.083 1H15a2 2 0 00-2 2v2.197A5.973 5.973 0 0110 16v-2a2 2 0 00-2-2 2 2 0 01-2-2 2 2 0 00-1.668-1.973z"
        clipRule="evenodd"
      />
    </svg>
  );
}

// ── Chevron icon ─────────────────────────────────────────────────────────────

function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg
      className={`w-3.5 h-3.5 transition-transform duration-200 ${
        open ? "rotate-180" : ""
      }`}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
    </svg>
  );
}

// ── Color dot ────────────────────────────────────────────────────────────────

function ColorDot({ color, size = 8 }: { color: string; size?: number }) {
  return (
    <span
      className="inline-block rounded-full shrink-0"
      style={{
        width: size,
        height: size,
        backgroundColor: color,
        boxShadow: `0 0 0 2px ${color}33`,
      }}
    />
  );
}

// ── Main component ───────────────────────────────────────────────────────────

export default function EntitySwitcher() {
  const { activeEntity, setActiveEntity, entities, loading } = useEntity();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) {
      document.addEventListener("mousedown", handleClick);
      return () => document.removeEventListener("mousedown", handleClick);
    }
  }, [open]);

  // Close on Escape
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    if (open) {
      document.addEventListener("keydown", handleKey);
      return () => document.removeEventListener("keydown", handleKey);
    }
  }, [open]);

  if (loading) {
    return (
      <div className="h-9 w-36 rounded-lg animate-pulse" style={{ background: "var(--app-hover)" }} />
    );
  }

  const currentLabel = activeEntity ? activeEntity.name : "All Entities";
  const currentColor = activeEntity?.colorAccent ?? null;

  return (
    <div ref={ref} className="relative">
      {/* ── Trigger pill ── */}
      <button
        onClick={() => setOpen((p) => !p)}
        className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-all duration-150 min-h-[36px] hover:brightness-110 active:scale-[0.98]"
        style={{
          background: currentColor
            ? `${currentColor}18`
            : "var(--app-hover)",
          color: currentColor ?? "var(--app-text)",
          border: `1px solid ${currentColor ? `${currentColor}40` : "var(--app-border)"}`,
        }}
        aria-expanded={open}
        aria-haspopup="listbox"
      >
        {currentColor ? (
          <ColorDot color={currentColor} />
        ) : (
          <GlobeIcon className="w-4 h-4 opacity-60" />
        )}
        <span className="max-w-[140px] truncate">{currentLabel}</span>
        <ChevronIcon open={open} />
      </button>

      {/* ── Dropdown ── */}
      {open && (
        <div
          className="absolute left-0 top-full mt-1.5 z-50 min-w-[220px] rounded-xl shadow-xl overflow-hidden"
          style={{
            background: "var(--app-popover-bg)",
            border: "1px solid var(--app-border)",
          }}
          role="listbox"
          aria-label="Select entity"
        >
          {/* All Entities option */}
          <button
            onClick={() => {
              setActiveEntity(null);
              setOpen(false);
            }}
            className={`flex items-center gap-2.5 w-full text-left px-3.5 py-2.5 text-sm transition-colors ${
              !activeEntity
                ? "font-semibold"
                : "hover:bg-[var(--app-hover)]"
            }`}
            style={{
              color: !activeEntity
                ? "var(--app-text)"
                : "var(--app-text-secondary)",
              background: !activeEntity ? "var(--app-hover)" : undefined,
            }}
            role="option"
            aria-selected={!activeEntity}
          >
            <GlobeIcon className="w-4 h-4 opacity-60 shrink-0" />
            <span>All Entities</span>
            {!activeEntity && (
              <svg className="w-4 h-4 ml-auto opacity-60" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            )}
          </button>

          {/* Divider */}
          <div
            className="mx-3"
            style={{ borderTop: "1px solid var(--app-border-subtle)" }}
          />

          {/* Entity list */}
          {entities.map((entity) => {
            const selected = activeEntity?.slug === entity.slug;
            return (
              <button
                key={entity.slug}
                onClick={() => {
                  setActiveEntity(entity);
                  setOpen(false);
                }}
                className={`flex items-center gap-2.5 w-full text-left px-3.5 py-2.5 text-sm transition-colors ${
                  selected
                    ? "font-semibold"
                    : "hover:bg-[var(--app-hover)]"
                }`}
                style={{
                  color: selected
                    ? entity.colorAccent
                    : "var(--app-text-secondary)",
                  background: selected ? `${entity.colorAccent}12` : undefined,
                }}
                role="option"
                aria-selected={selected}
              >
                <ColorDot color={entity.colorAccent} />
                <span className="flex-1 truncate">{entity.name}</span>
                {entity.myRole && (
                  <span
                    className="text-[10px] uppercase tracking-wider opacity-50"
                  >
                    {entity.myRole}
                  </span>
                )}
                {selected && (
                  <svg className="w-4 h-4 ml-1 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5} style={{ color: entity.colorAccent }}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
