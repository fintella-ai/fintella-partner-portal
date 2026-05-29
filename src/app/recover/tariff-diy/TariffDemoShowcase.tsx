"use client";

// ---------------------------------------------------------------------------
// Animated "live engine" demo for the DIY tariff landing page.
//
// Mirrors the REAL product shapes — ExtractedEntry (per-field confidence +
// null = missing, from document-intake.ts), AuditCheck severities (from
// tariff-audit.ts), and the risk band (from tariff-risk-score.ts) — but runs
// entirely on canned data with NO AI calls and NO uploads. It is a scripted
// showcase (à la a product "live session"), so it costs nothing per visitor
// and can't leak the real refund math, which we deliberately gate.
// ---------------------------------------------------------------------------

import { useCallback, useEffect, useRef, useState } from "react";

const ACCENT = "#7c3aed";

// One extracted field, shaped like ExtractedEntry: a value + a confidence, or
// null to model a field the engine could not read (the "missing data" case).
interface DemoField {
  label: string;
  value: string | null; // null → missing
  confidence: number; // 0–1
  revealAtMs: number; // when in the scripted timeline this field appears
}

// Confidence thresholds match document-intake.ts guidance (≥0.8 high, 0.3–0.6 low).
const HIGH_CONF = 0.8;
const LOW_CONF = 0.6;

const FIELDS: DemoField[] = [
  { label: "Entry number", value: "CBP-31548820-9", confidence: 0.97, revealAtMs: 1800 },
  { label: "Entry date", value: "2025-02-14", confidence: 0.96, revealAtMs: 3200 },
  { label: "Country of origin", value: "CN", confidence: 0.94, revealAtMs: 4400 },
  { label: "Importer of record", value: "Harborline Trading LLC", confidence: 0.91, revealAtMs: 5600 },
  { label: "Entered value", value: "$182,450", confidence: 0.43, revealAtMs: 7000 }, // low → flagged for review
  { label: "Duty paid", value: "$26,455", confidence: 0.88, revealAtMs: 8200 },
  { label: "HTS code", value: null, confidence: 0, revealAtMs: 9400 }, // missing
  { label: "Liquidation date", value: "2025-08-29", confidence: 0.9, revealAtMs: 10600 },
];

// Audit checks, shaped like AuditCheck (severity error|warning|info + a fix hint).
interface DemoCheck {
  severity: "error" | "warning" | "info";
  passed: boolean;
  message: string;
  fix?: string;
}
const CHECKS: DemoCheck[] = [
  { severity: "info", passed: true, message: "Entry within IEEPA refund window (Feb 2025)" },
  { severity: "info", passed: true, message: "Protest window open — 196 days remaining" },
  { severity: "warning", passed: false, message: "Entered value confidence low (0.43)", fix: "Confirm against the commercial invoice" },
  { severity: "error", passed: false, message: "HTS code not found on document", fix: "Add the 10-digit HTS from line 28" },
  { severity: "info", passed: true, message: "No AD/CVD case linked to this HTS" },
];

const TIMELINE_END_MS = 12000;
const FINAL_SECONDS = 27.4; // the headline "time-to-result"
const RISK_SCORE = 18; // 0–100, lands in the LOW band (≤25 per tariff-risk-score.ts)

type Phase = "idle" | "reading" | "extracting" | "auditing" | "done";

function confChipClass(conf: number): string {
  if (conf >= HIGH_CONF) return "bg-emerald-500/15 text-emerald-300 border-emerald-500/25";
  if (conf >= LOW_CONF) return "bg-amber-500/15 text-amber-300 border-amber-500/25";
  return "bg-red-500/15 text-red-300 border-red-500/25";
}

export default function TariffDemoShowcase() {
  const [elapsed, setElapsed] = useState(0); // ms into the scripted timeline
  const [phase, setPhase] = useState<Phase>("idle");
  const rafStart = useRef<number | null>(null);
  const frame = useRef<number | null>(null);
  const reducedMotion = useRef(false);

  const stop = useCallback(() => {
    if (frame.current != null) cancelAnimationFrame(frame.current);
    frame.current = null;
    rafStart.current = null;
  }, []);

  const play = useCallback(() => {
    stop();
    setElapsed(0);
    setPhase("reading");
    // Respect reduced-motion: jump straight to the finished state.
    if (reducedMotion.current) {
      setElapsed(TIMELINE_END_MS);
      setPhase("done");
      return;
    }
    const tick = (now: number) => {
      if (rafStart.current == null) rafStart.current = now;
      const e = now - rafStart.current;
      setElapsed(e);
      if (e < 1500) setPhase("reading");
      else if (e < 11000) setPhase("extracting");
      else if (e < TIMELINE_END_MS) setPhase("auditing");
      else { setPhase("done"); stop(); return; }
      frame.current = requestAnimationFrame(tick);
    };
    frame.current = requestAnimationFrame(tick);
  }, [stop]);

  // Auto-start once when scrolled into view; honor reduced-motion.
  const rootRef = useRef<HTMLDivElement | null>(null);
  const startedRef = useRef(false);
  useEffect(() => {
    if (typeof window !== "undefined" && window.matchMedia) {
      reducedMotion.current = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    }
    const el = rootRef.current;
    if (!el || typeof IntersectionObserver === "undefined") { play(); startedRef.current = true; return stop; }
    const obs = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && !startedRef.current) {
          startedRef.current = true;
          play();
        }
      },
      { threshold: 0.35 },
    );
    obs.observe(el);
    return () => { obs.disconnect(); stop(); };
  }, [play, stop]);

  const shownFields = FIELDS.filter((f) => elapsed >= f.revealAtMs);
  const progress = Math.min(100, Math.round((elapsed / TIMELINE_END_MS) * 100));
  const liveSeconds = phase === "done" ? FINAL_SECONDS : Math.min(FINAL_SECONDS, (elapsed / TIMELINE_END_MS) * FINAL_SECONDS);
  const gaugeScore = phase === "done" ? RISK_SCORE : Math.round((elapsed / TIMELINE_END_MS) * RISK_SCORE);

  return (
    <div ref={rootRef} className="rounded-2xl bg-white/[0.03] border border-white/10 p-5 sm:p-7 backdrop-blur">
      {/* Header: live status + stopwatch */}
      <div className="flex items-center justify-between gap-3 mb-5">
        <div className="flex items-center gap-2.5">
          <span className={`h-2.5 w-2.5 rounded-full ${phase === "done" ? "bg-emerald-400" : "bg-amber-400 animate-pulse"}`} />
          <span className="text-sm font-semibold text-white/80">
            {phase === "idle" && "Tariff Intelligence Engine"}
            {phase === "reading" && "Reading document…"}
            {phase === "extracting" && "Extracting entry fields…"}
            {phase === "auditing" && "Running pre-submission audit…"}
            {phase === "done" && "Analysis complete"}
          </span>
        </div>
        <div className="flex items-center gap-2 tabular-nums">
          <span className="text-xs text-white/40">⏱</span>
          <span className="text-sm font-mono font-semibold" style={{ color: ACCENT }}>{liveSeconds.toFixed(1)}s</span>
        </div>
      </div>

      {/* Scan progress */}
      <div className="h-1 w-full rounded-full bg-white/10 overflow-hidden mb-6">
        <div className="h-full rounded-full transition-[width] duration-150 ease-out" style={{ width: `${progress}%`, background: ACCENT }} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Left — the "document" + streaming extraction */}
        <div className="rounded-xl bg-black/30 border border-white/10 p-4">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs uppercase tracking-wider text-white/40">CBP Form 7501 · Entry Summary</span>
            <span className="text-[10px] rounded px-1.5 py-0.5 bg-white/5 text-white/40 font-mono">sample.pdf</span>
          </div>
          <div className="space-y-1.5" aria-live="polite">
            {shownFields.map((f) => (
              <div key={f.label} className="flex items-center justify-between gap-3 rounded-lg bg-white/[0.03] px-3 py-2 animate-[fadeIn_0.3s_ease-out]">
                <div className="min-w-0">
                  <div className="text-[10px] uppercase tracking-wide text-white/35">{f.label}</div>
                  <div className={`text-sm font-medium truncate ${f.value == null ? "text-red-300 italic" : "text-white/85"}`}>
                    {f.value ?? "— not found —"}
                  </div>
                </div>
                <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-semibold ${f.value == null ? "bg-red-500/15 text-red-300 border-red-500/25" : confChipClass(f.confidence)}`}>
                  {f.value == null ? "MISSING" : `${Math.round(f.confidence * 100)}%`}
                </span>
              </div>
            ))}
            {shownFields.length === 0 && (
              <div className="text-sm text-white/30 py-8 text-center">Scanning entry summary…</div>
            )}
          </div>
        </div>

        {/* Right — risk gauge + audit checks + missing-data report */}
        <div className="space-y-4">
          {/* Risk gauge */}
          <div className="rounded-xl bg-black/30 border border-white/10 p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs uppercase tracking-wider text-white/40">Risk analysis</span>
              <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold border ${gaugeScore <= 25 ? "bg-emerald-500/15 text-emerald-300 border-emerald-500/25" : gaugeScore <= 55 ? "bg-amber-500/15 text-amber-300 border-amber-500/25" : "bg-red-500/15 text-red-300 border-red-500/25"}`}>
                {gaugeScore <= 25 ? "LOW" : gaugeScore <= 55 ? "MEDIUM" : "HIGH"} RISK
              </span>
            </div>
            <div className="flex items-end gap-3">
              <div className="text-4xl font-bold tabular-nums" style={{ color: ACCENT }}>{gaugeScore}</div>
              <div className="text-xs text-white/40 pb-1.5">/ 100 risk score</div>
            </div>
            <div className="h-1.5 w-full rounded-full bg-white/10 overflow-hidden mt-2">
              <div className="h-full rounded-full bg-emerald-400 transition-[width] duration-150" style={{ width: `${Math.max(4, gaugeScore)}%` }} />
            </div>
          </div>

          {/* Audit checks */}
          <div className="rounded-xl bg-black/30 border border-white/10 p-4">
            <div className="text-xs uppercase tracking-wider text-white/40 mb-2">Pre-submission audit · CBP rejection codes</div>
            <div className="space-y-1.5">
              {(phase === "auditing" || phase === "done" ? CHECKS : []).map((c, i) => (
                <div key={i} className="flex items-start gap-2 text-xs animate-[fadeIn_0.3s_ease-out]">
                  <span className="mt-0.5 shrink-0">
                    {c.severity === "error" ? "🔴" : c.severity === "warning" ? "🟡" : "🟢"}
                  </span>
                  <span className={c.passed ? "text-white/60" : "text-white/80"}>{c.message}</span>
                </div>
              ))}
              {phase !== "auditing" && phase !== "done" && (
                <div className="text-xs text-white/30 py-3 text-center">Audit runs after extraction…</div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Missing-data report — the finale */}
      {phase === "done" && (
        <div className="mt-5 rounded-xl border border-amber-500/25 bg-amber-500/[0.06] p-4 animate-[fadeIn_0.4s_ease-out]">
          <div className="flex items-center justify-between gap-3 mb-2">
            <span className="text-sm font-semibold text-amber-200">Missing-data report — 2 items to confirm</span>
            <span className="text-[10px] text-white/40">before you file</span>
          </div>
          <ul className="space-y-1.5 text-xs text-white/70">
            <li className="flex items-start gap-2"><span className="text-red-300 mt-0.5">•</span><span><strong className="text-white/90">HTS code</strong> — not found on the document. Add the 10-digit HTS from line 28.</span></li>
            <li className="flex items-start gap-2"><span className="text-amber-300 mt-0.5">•</span><span><strong className="text-white/90">Entered value</strong> — read at low confidence (43%). Confirm against the commercial invoice.</span></li>
          </ul>
        </div>
      )}

      {/* Replay */}
      <div className="mt-5 flex items-center justify-between">
        <span className="text-[11px] text-white/30">Animated example · canned data · no upload or AI call</span>
        <button
          onClick={play}
          className="rounded-lg border border-white/15 px-3 py-2 text-xs font-semibold text-white/70 hover:bg-white/5 transition min-h-[36px]"
        >
          ↻ Replay
        </button>
      </div>
    </div>
  );
}
