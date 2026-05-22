"use client";

import { useService } from "@/contexts/ServiceContext";
import { useState, useRef, useEffect } from "react";

export default function ServiceSwitcher() {
  const { services, activeServiceId, activeService, setActiveServiceId } = useService();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  if (services.length < 2) return null;

  const label = activeService ? (activeService.shortName || activeService.name) : "All Services";

  return (
    <div ref={ref} className="relative mb-3 px-3">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium bg-white/5 hover:bg-white/10 border border-white/10 transition-colors"
      >
        {activeService?.accentColor && (
          <span
            className="w-2.5 h-2.5 rounded-full flex-shrink-0"
            style={{ backgroundColor: activeService.accentColor }}
          />
        )}
        <span className="truncate">{label}</span>
        <span className="ml-auto text-white/40">▾</span>
      </button>

      {open && (
        <div className="absolute left-3 right-3 top-full mt-1 z-50 bg-zinc-900 border border-white/10 rounded-lg shadow-xl overflow-hidden">
          {services.map((s) => (
            <button
              key={s.id}
              onClick={() => { setActiveServiceId(s.id); setOpen(false); }}
              className={`w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-white/10 transition-colors ${
                activeServiceId === s.id ? "bg-white/5 font-medium" : ""
              }`}
            >
              {s.accentColor && (
                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: s.accentColor }} />
              )}
              <span>{s.shortName || s.name}</span>
            </button>
          ))}
          <div className="border-t border-white/10" />
          <button
            onClick={() => { setActiveServiceId(null); setOpen(false); }}
            className={`w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-white/10 transition-colors ${
              activeServiceId === null ? "bg-white/5 font-medium" : ""
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-gradient-to-r from-blue-500 to-emerald-500" />
            <span>All Services</span>
          </button>
        </div>
      )}
    </div>
  );
}
