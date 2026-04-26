"use client";

import { useEffect, useState, useCallback } from "react";
import type { ChecklistStep, GettingStartedResult } from "@/lib/getting-started";

type Variant = "home" | "page";

interface Props {
  variant?: Variant;
  onDismissed?: () => void;
  onCompleted?: () => void;
}

const CTA_ROUTE_ACTIONS: Record<string, "mark_link_shared" | "mark_call_joined" | "mark_training_completed" | "mark_video_watched" | null> = {
  "/dashboard/referral-links": "mark_link_shared",
  "/dashboard/conference": "mark_call_joined",
  "/dashboard/training": "mark_training_completed",
  "/dashboard/home": "mark_video_watched",
};

export function GettingStartedChecklist({ variant = "home", onDismissed, onCompleted }: Props) {
  const [data, setData] = useState<GettingStartedResult | null>(null);
  const [busyStepId, setBusyStepId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/partner/getting-started", { cache: "no-store" });
      if (!res.ok) return;
      const json: GettingStartedResult = await res.json();
      setData(json);
      if (json.completedCount === json.totalCount && json.totalCount > 0) {
        onCompleted?.();
      }
    } catch {
      // Swallow — checklist is non-critical UI.
    }
  }, [onCompleted]);

  useEffect(() => { load(); }, [load]);

  const patch = useCallback(async (action: string) => {
    try {
      const res = await fetch("/api/partner/getting-started", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      if (res.ok) {
        const json: GettingStartedResult = await res.json();
        setData(json);
      }
    } catch {
      // Silent.
    }
  }, []);

  const handleCta = useCallback((step: ChecklistStep) => {
    if (step.status === "locked" || step.done) return;
    setBusyStepId(step.id);

    // If the CTA corresponds to an action we can optimistically mark, fire it.
    const action = CTA_ROUTE_ACTIONS[step.ctaUrl];
    if (action && !step.done) {
      // Fire-and-forget: the route-level detection is the real trigger; this
      // is a belt-and-suspenders mark so the checklist progresses when the
      // partner clicks the CTA even if they don't complete the underlying
      // action.
      patch(action);
    }

    // Navigate. External URLs (signing URL) open in a new tab per the
    // SignWell-iframe-forbidden rule.
    if (step.ctaUrl.startsWith("http")) {
      window.open(step.ctaUrl, "_blank", "noopener,noreferrer");
    } else {
      window.location.href = step.ctaUrl;
    }
    setBusyStepId(null);
  }, [patch]);

  const handleDismiss = useCallback(async () => {
    await patch("dismiss");
    onDismissed?.();
  }, [patch, onDismissed]);

  if (!data || data.totalCount === 0) return null;
  if (variant === "home" && data.dismissed) return null;
  if (variant === "home" && data.completedCount === data.totalCount) return null;

  const progressBar = (
    <div className="h-1.5 w-full rounded-full bg-[var(--app-input-bg)] overflow-hidden">
      <div
        className="h-full rounded-full bg-brand-gold transition-all"
        style={{ width: `${data.progressPercent}%` }}
      />
    </div>
  );

  return (
    <div className={variant === "home" ? "card p-5 sm:p-6 border-brand-gold/30 bg-brand-gold/[0.03]" : ""}>
      <div className="flex items-center justify-between gap-4 mb-3">
        <div>
          <h2 className="font-display text-base sm:text-lg font-semibold text-brand-gold">
            {variant === "home" ? "Getting Started" : "Your Getting Started Checklist"}
          </h2>
          <p className="font-body text-[12px] text-[var(--app-text-muted)] mt-0.5">
            {data.completedCount} of {data.totalCount} complete
            {data.completedCount < data.totalCount && " — keep going"}
          </p>
        </div>
        <div className="font-display text-xl font-bold text-brand-gold shrink-0">
          {data.progressPercent}%
        </div>
      </div>

      {progressBar}

      <ul className="mt-5 space-y-2">
        {data.steps.map((step) => (
          <li
            key={step.id}
            className={`flex items-start gap-3 rounded-lg border px-3 py-3 ${
              step.done
                ? "border-[var(--app-border)] bg-transparent opacity-70"
                : step.status === "locked"
                  ? "border-[var(--app-border)] bg-transparent opacity-60"
                  : "border-brand-gold/20 bg-[var(--app-card-bg)]"
            }`}
          >
            <StatusGlyph status={step.status} done={step.done} />
            <div className="flex-1 min-w-0">
              <div className={`font-body text-[13px] sm:text-[14px] font-semibold ${step.done ? "line-through text-[var(--app-text-muted)]" : "text-[var(--app-text)]"}`}>
                {step.title}
              </div>
              {(!step.done || variant === "page") && (
                <div className="font-body text-[12px] text-[var(--app-text-secondary)] mt-0.5 leading-snug">
                  {step.description}
                </div>
              )}
              {step.videoUrl && variant === "page" && (
                <div className="mt-2 rounded-lg overflow-hidden border border-[var(--app-border)]" style={{ aspectRatio: "16/9", maxHeight: 180 }}>
                  <iframe src={step.videoUrl.replace("watch?v=", "embed/").replace("youtu.be/", "youtube.com/embed/")} className="w-full h-full" allowFullScreen title={`${step.title} video`} />
                </div>
              )}
            </div>
            <div className="shrink-0">
              <button
                onClick={() => handleCta(step)}
                disabled={step.done || step.status === "locked" || busyStepId === step.id}
                title={step.status === "locked" ? "Sign your agreement first" : undefined}
                className={`font-body text-[11px] tracking-[1px] uppercase rounded-lg px-3 py-2 transition-colors min-h-[36px] ${
                  step.done
                    ? "text-[var(--app-text-muted)] cursor-default"
                    : step.status === "locked"
                      ? "text-[var(--app-text-muted)] cursor-not-allowed"
                      : "bg-brand-gold text-black font-semibold hover:bg-brand-gold/90"
                }`}
              >
                {step.ctaLabel}
              </button>
            </div>
          </li>
        ))}
      </ul>

      {variant === "home" && data.completedCount < data.totalCount && (
        <div className="mt-4 text-center">
          <button
            onClick={handleDismiss}
            className="font-body text-[11px] text-[var(--app-text-muted)] hover:text-[var(--app-text-secondary)] underline"
          >
            Hide until I'm ready
          </button>
        </div>
      )}
    </div>
  );
}

function StatusGlyph({ status, done }: { status: ChecklistStep["status"]; done: boolean }) {
  if (done || status === "done") {
    return (
      <div className="w-6 h-6 rounded-full bg-brand-gold flex items-center justify-center shrink-0 mt-0.5">
        <svg viewBox="0 0 20 20" fill="none" className="w-3.5 h-3.5">
          <path d="M4 10.5l3.5 3.5L16 6" stroke="#000" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>
    );
  }
  if (status === "locked") {
    return (
      <div className="w-6 h-6 rounded-full border border-[var(--app-border)] flex items-center justify-center shrink-0 mt-0.5 bg-[var(--app-input-bg)]">
        <svg viewBox="0 0 20 20" fill="none" className="w-3 h-3">
          <path d="M5 9V7a5 5 0 0110 0v2" stroke="currentColor" strokeWidth="1.5" className="text-[var(--app-text-muted)]" />
          <rect x="4" y="9" width="12" height="8" rx="1.5" stroke="currentColor" strokeWidth="1.5" className="text-[var(--app-text-muted)]" />
        </svg>
      </div>
    );
  }
  return (
    <div className="w-6 h-6 rounded-full border-2 border-brand-gold/60 shrink-0 mt-0.5" />
  );
}
