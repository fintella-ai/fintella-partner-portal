"use client";

import { useEffect, useState } from "react";

interface Step {
  id: string;
  title: string;
  description: string;
  status: "done" | "ready" | "locked";
  done: boolean;
}

interface GettingStartedData {
  partnerCode: string;
  firstName: string;
  lastName: string;
  status: string;
  signupDate: string;
  steps: Step[];
  progressPercent: number;
  completedCount: number;
  totalCount: number;
  dismissed: boolean;
}

interface Props {
  partnerId: string;
}

export function AdminGettingStartedCard({ partnerId }: Props) {
  const [data, setData] = useState<GettingStartedData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetch(`/api/admin/partners/${partnerId}/getting-started`, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((json) => { if (!cancelled) setData(json); })
      .catch(() => { if (!cancelled) setData(null); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [partnerId]);

  if (loading) {
    return (
      <div className="card p-5 sm:p-6 mb-6">
        <div className="font-body text-[12px] text-[var(--app-text-muted)]">Loading onboarding progress…</div>
      </div>
    );
  }
  if (!data) return null;

  const daysSinceSignup = Math.floor(
    (Date.now() - new Date(data.signupDate).getTime()) / (1000 * 60 * 60 * 24)
  );
  const allDone = data.completedCount === data.totalCount;
  const stalledThreshold = 7; // days — admin eye-catch for "why is this partner stuck?"
  const stalled = !allDone && daysSinceSignup >= stalledThreshold;

  return (
    <div className={`card p-5 sm:p-6 mb-6 ${stalled ? "border-yellow-500/30 bg-yellow-500/[0.03]" : ""}`}>
      <div className="flex items-start justify-between gap-4 mb-3">
        <div>
          <div className="font-body font-semibold text-sm">
            Getting-Started Progress
            {stalled && (
              <span className="ml-2 inline-block text-[10px] font-semibold tracking-wider uppercase bg-yellow-500/10 text-yellow-400 border border-yellow-500/20 rounded-full px-2 py-0.5">
                Stalled · {daysSinceSignup}d
              </span>
            )}
            {allDone && (
              <span className="ml-2 inline-block text-[10px] font-semibold tracking-wider uppercase bg-green-500/10 text-green-400 border border-green-500/20 rounded-full px-2 py-0.5">
                Complete
              </span>
            )}
          </div>
          <p className="font-body text-[12px] text-[var(--app-text-muted)] mt-0.5">
            {data.completedCount} of {data.totalCount} steps · signed up {daysSinceSignup}d ago
            {data.dismissed && " · dismissed on home"}
          </p>
        </div>
        <div className="font-display text-xl font-bold text-brand-gold shrink-0">{data.progressPercent}%</div>
      </div>

      <div className="h-1.5 w-full rounded-full bg-[var(--app-input-bg)] overflow-hidden mb-4">
        <div
          className={`h-full rounded-full transition-all ${stalled ? "bg-yellow-500" : "bg-brand-gold"}`}
          style={{ width: `${data.progressPercent}%` }}
        />
      </div>

      <ul className="space-y-1.5">
        {data.steps.map((step) => (
          <li
            key={step.id}
            className={`flex items-center gap-3 rounded-lg border px-3 py-2 ${
              step.done
                ? "border-[var(--app-border)] opacity-70"
                : step.status === "locked"
                  ? "border-[var(--app-border)] opacity-60"
                  : "border-brand-gold/20 bg-[var(--app-card-bg)]"
            }`}
          >
            <Glyph status={step.status} done={step.done} />
            <div className="flex-1 min-w-0">
              <div className={`font-body text-[12px] sm:text-[13px] ${step.done ? "line-through text-[var(--app-text-muted)]" : "text-[var(--app-text)] font-medium"}`}>
                {step.title}
              </div>
            </div>
            <span className={`font-body text-[10px] tracking-wider uppercase shrink-0 ${
              step.done ? "text-green-400" : step.status === "locked" ? "text-[var(--app-text-muted)]" : "text-brand-gold"
            }`}>
              {step.done ? "done" : step.status === "locked" ? "locked" : "ready"}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Glyph({ status, done }: { status: Step["status"]; done: boolean }) {
  if (done || status === "done") {
    return (
      <div className="w-5 h-5 rounded-full bg-brand-gold flex items-center justify-center shrink-0">
        <svg viewBox="0 0 20 20" fill="none" className="w-3 h-3">
          <path d="M4 10.5l3.5 3.5L16 6" stroke="#000" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>
    );
  }
  if (status === "locked") {
    return <div className="w-5 h-5 rounded-full border border-[var(--app-border)] bg-[var(--app-input-bg)] shrink-0" />;
  }
  return <div className="w-5 h-5 rounded-full border-2 border-brand-gold/60 shrink-0" />;
}
