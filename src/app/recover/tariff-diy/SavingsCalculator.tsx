"use client";

// ---------------------------------------------------------------------------
// Interactive "exclaim the results" savings calculator for the DIY landing.
//
// Dramatizes the core value: a contingency firm takes ~30% of the refund for
// the same work; with Fintella you pay one small flat fee (a few % of the
// refund) for the service + software that produced the file, and KEEP the
// rest. Numbers count up when the refund changes so the savings "land."
//
// Pure client math — no API calls. Fee comes from TARIFF_UPFRONT_FEE_CENTS via
// props so it always tracks the real configured price.
// ---------------------------------------------------------------------------

import { useEffect, useRef, useState } from "react";

const ACCENT = "#7c3aed";
const CONTINGENCY_RATE = 0.3; // what the big firms typically take

interface Props {
  upfrontFeeCents: number;
}

// Smoothly animate a displayed number toward `target` (the "exclaim" effect).
function useCountUp(target: number, durationMs = 600): number {
  const [value, setValue] = useState(target);
  const fromRef = useRef(target);
  const startRef = useRef<number | null>(null);
  const frameRef = useRef<number | null>(null);

  useEffect(() => {
    if (typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) {
      setValue(target);
      return;
    }
    fromRef.current = value;
    startRef.current = null;
    const from = fromRef.current;
    const tick = (now: number) => {
      if (startRef.current == null) startRef.current = now;
      const t = Math.min(1, (now - startRef.current) / durationMs);
      const eased = 1 - Math.pow(1 - t, 3); // ease-out cubic
      setValue(from + (target - from) * eased);
      if (t < 1) frameRef.current = requestAnimationFrame(tick);
    };
    frameRef.current = requestAnimationFrame(tick);
    return () => { if (frameRef.current != null) cancelAnimationFrame(frameRef.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target, durationMs]);

  return value;
}

const money = (n: number) => `$${Math.round(n).toLocaleString("en-US")}`;

export default function SavingsCalculator({ upfrontFeeCents }: Props) {
  const fee = upfrontFeeCents / 100;
  const [refund, setRefund] = useState(50_000);

  const contingencyTakes = refund * CONTINGENCY_RATE;
  const ourPct = refund > 0 ? (fee / refund) * 100 : 0;
  const youKeep = Math.max(0, refund - fee);
  const youSave = Math.max(0, contingencyTakes - fee);

  const keepAnim = useCountUp(youKeep);
  const saveAnim = useCountUp(youSave);
  const takeAnim = useCountUp(contingencyTakes);

  return (
    <div className="rounded-2xl bg-white/[0.03] border border-white/10 p-6 sm:p-8 backdrop-blur">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-center">
        {/* Left — input */}
        <div>
          <div className="text-xs uppercase tracking-wider text-white/40 mb-2">Your estimated refund</div>
          <div className="flex items-baseline gap-2 mb-4">
            <span className="text-3xl font-bold" style={{ color: ACCENT }}>{money(refund)}</span>
          </div>
          <input
            type="range"
            min={5_000}
            max={500_000}
            step={1_000}
            value={refund}
            onChange={(e) => setRefund(Number(e.target.value))}
            aria-label="Estimated refund amount"
            className="w-full accent-[#7c3aed] h-2 cursor-pointer"
          />
          <div className="flex justify-between text-[11px] text-white/55 mt-1">
            <span>$5K</span><span>$500K</span>
          </div>

          <div className="mt-5 rounded-xl border border-white/10 bg-black/30 p-4">
            <div className="flex items-center justify-between text-sm mb-2">
              <span className="text-white/60">A contingency firm takes 30%</span>
              <span className="font-semibold text-red-300 tabular-nums">−{money(takeAnim)}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-white/60">Fintella service + software</span>
              <span className="font-semibold tabular-nums" style={{ color: ACCENT }}>
                {money(fee)} <span className="text-[11px] text-white/40">≈ {ourPct.toFixed(1)}%</span>
              </span>
            </div>
          </div>
          <p className="text-[11px] text-white/60 mt-3 leading-relaxed">
            One flat fee for the work + the software that produced your audit-ready file — a few percent of your
            refund instead of a third of it. Estimate only, not a guarantee of approval.
          </p>
        </div>

        {/* Right — the exclaimed result */}
        <div className="space-y-4">
          <div className="rounded-2xl border-2 p-6 text-center" style={{ borderColor: ACCENT, background: "rgba(124,58,237,0.10)", boxShadow: "0 0 40px -10px rgba(124,58,237,0.4)" }}>
            <div className="text-xs uppercase tracking-wider text-white/50 mb-1">You keep</div>
            <div className="text-5xl font-bold tabular-nums leading-none" style={{ color: ACCENT }}>{money(keepAnim)}</div>
            <div className="text-xs text-white/40 mt-2">of your {money(refund)} refund</div>
          </div>
          <div className="rounded-xl border border-emerald-500/25 bg-emerald-500/[0.08] p-4 text-center animate-[fadeIn_0.4s_ease-out]">
            <div className="text-sm text-emerald-200">
              That&apos;s <strong className="text-emerald-100 tabular-nums">{money(saveAnim)} more</strong> than you&apos;d
              keep with a contingency firm. 🎉
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
