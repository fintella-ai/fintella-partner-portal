"use client";

import { useState, useEffect, useRef } from "react";

declare global {
  interface Window {
    CollectJS?: {
      configure: (opts: Record<string, unknown>) => void;
      startPaymentRequest: () => void;
    };
  }
}

type Step = "info" | "consent" | "pay" | "done";

interface Props {
  tokenizationKey: string;
  demoMode: boolean;
  partnerCode: string | null;
  feeLabel: string;
}

const GOLD = "#c4a050";

export default function EngageFlow({ tokenizationKey, demoMode, partnerCode, feeLabel }: Props) {
  const [step, setStep] = useState<Step>("info");
  const [form, setForm] = useState({ clientName: "", email: "", company: "", phone: "" });
  const [dealId, setDealId] = useState("");
  const [signingUrl, setSigningUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const collectConfigured = useRef(false);

  const STORAGE_KEY = "tariff_diy_engagement";

  // Resume after the new-tab signing redirect (?signed=1). localStorage is
  // shared across same-origin tabs, so the deal created in the original tab is
  // available here — jump straight to payment.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const signed = new URLSearchParams(window.location.search).get("signed");
    if (signed !== "1") return;
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
      if (saved?.dealId) {
        setDealId(saved.dealId);
        if (saved.email) setForm((f) => ({ ...f, email: saved.email }));
        setStep("pay");
      }
    } catch {
      /* ignore */
    }
  }, []);

  // ── Step 1: create engagement + send consent ──────────────────────────────
  async function startEngagement(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/tariff/engage", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, ref: partnerCode }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not start engagement");
      setDealId(data.dealId);
      setSigningUrl(data.signingUrl || "");
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify({ dealId: data.dealId, email: form.email }));
      } catch {
        /* ignore */
      }
      setStep("consent");
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  // ── Step 3: load + configure Collect.js when entering the pay step ─────────
  useEffect(() => {
    if (step !== "pay" || demoMode || collectConfigured.current) return;
    const script = document.createElement("script");
    script.src = "https://secure.nmi.com/token/Collect.js";
    script.setAttribute("data-tokenization-key", tokenizationKey);
    script.onload = () => {
      if (!window.CollectJS) return;
      window.CollectJS.configure({
        variant: "lightbox",
        primaryColor: GOLD,
        theme: "material",
        callback: (resp: { token?: string }) => {
          if (resp?.token) payWithToken(resp.token);
        },
      });
      collectConfigured.current = true;
    };
    document.body.appendChild(script);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, demoMode, tokenizationKey]);

  async function payWithToken(paymentToken: string) {
    setError("");
    setLoading(true);
    try {
      const res = await fetch(`/api/tariff/engage/${dealId}/pay`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paymentToken }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Payment failed");
      try {
        localStorage.removeItem(STORAGE_KEY);
      } catch {
        /* ignore */
      }
      setStep("done");
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  const inputCls =
    "w-full rounded-lg bg-white/5 border border-white/10 px-4 py-3 text-white placeholder-white/30 focus:outline-none focus:border-white/30 transition";

  return (
    <div className="rounded-2xl bg-white/[0.03] border border-white/10 p-6 sm:p-8 backdrop-blur">
      {/* Progress */}
      <div className="flex items-center gap-2 mb-6 text-xs text-white/40">
        {(["info", "consent", "pay", "done"] as Step[]).map((s, i) => (
          <span key={s} className="flex items-center gap-2">
            <span
              className="w-6 h-6 rounded-full flex items-center justify-center font-semibold"
              style={{
                background: step === s ? GOLD : "rgba(255,255,255,0.08)",
                color: step === s ? "#060a14" : "rgba(255,255,255,0.5)",
              }}
            >
              {i + 1}
            </span>
            {i < 3 && <span className="w-4 h-px bg-white/10" />}
          </span>
        ))}
      </div>

      {error && (
        <div className="mb-4 rounded-lg bg-red-500/10 border border-red-500/20 px-4 py-3 text-sm text-red-300">
          {error}
        </div>
      )}

      {/* Step 1 — info */}
      {step === "info" && (
        <form onSubmit={startEngagement} className="space-y-4">
          <h3 className="font-display text-2xl" style={{ color: GOLD }}>Start your DIY refund file</h3>
          <p className="text-sm text-white/60">
            We prepare a fully substantiated, audit-ready CAPE file — you submit it yourself, guided step by step.
          </p>
          <input className={inputCls} placeholder="Full name" required
            value={form.clientName} onChange={(e) => setForm({ ...form, clientName: e.target.value })} />
          <input className={inputCls} type="email" placeholder="Work email" required
            value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          <input className={inputCls} placeholder="Company / importer of record"
            value={form.company} onChange={(e) => setForm({ ...form, company: e.target.value })} />
          <input className={inputCls} placeholder="Phone (optional)"
            value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          <button type="submit" disabled={loading}
            className="w-full rounded-lg py-3 font-semibold transition disabled:opacity-50"
            style={{ background: GOLD, color: "#060a14" }}>
            {loading ? "Starting…" : "Continue →"}
          </button>
        </form>
      )}

      {/* Step 2 — consent */}
      {step === "consent" && (
        <div className="space-y-4">
          <h3 className="font-display text-2xl" style={{ color: GOLD }}>Sign your consent & authorization</h3>
          <p className="text-sm text-white/60">
            Review and sign the consent and data-sharing agreement so we can prepare your file. Opens in a new tab.
          </p>
          {signingUrl ? (
            <a href={signingUrl} target="_blank" rel="noopener noreferrer"
              className="block w-full text-center rounded-lg py-3 font-semibold transition"
              style={{ background: GOLD, color: "#060a14" }}>
              Open agreement to sign →
            </a>
          ) : (
            <div className="rounded-lg bg-white/5 border border-white/10 px-4 py-3 text-sm text-white/50">
              Agreement is being prepared — check your email shortly to sign.
            </div>
          )}
          <button onClick={() => setStep("pay")}
            className="w-full rounded-lg py-3 font-semibold border border-white/15 text-white/80 hover:bg-white/5 transition">
            I&apos;ve signed — continue to payment →
          </button>
        </div>
      )}

      {/* Step 3 — pay */}
      {step === "pay" && (
        <div className="space-y-4">
          <h3 className="font-display text-2xl" style={{ color: GOLD }}>Upfront file preparation fee</h3>
          <p className="text-sm text-white/60">
            One-time fee of <strong className="text-white">{feeLabel}</strong> for your fully substantiated,
            audit-ready CAPE self-file kit. No contingency — the refund is 100% yours.
          </p>
          {demoMode ? (
            <button onClick={() => payWithToken("demo-token")} disabled={loading}
              className="w-full rounded-lg py-3 font-semibold transition disabled:opacity-50"
              style={{ background: GOLD, color: "#060a14" }}>
              {loading ? "Processing…" : `Simulate payment (demo) — ${feeLabel}`}
            </button>
          ) : (
            <button onClick={() => window.CollectJS?.startPaymentRequest()} disabled={loading}
              className="w-full rounded-lg py-3 font-semibold transition disabled:opacity-50"
              style={{ background: GOLD, color: "#060a14" }}>
              {loading ? "Processing…" : `Pay ${feeLabel} securely`}
            </button>
          )}
          <p className="text-xs text-white/30 text-center">Card processed securely by NMI. We never see your card details.</p>
        </div>
      )}

      {/* Step 4 — done */}
      {step === "done" && (
        <div className="space-y-4 text-center">
          <div className="text-5xl">✓</div>
          <h3 className="font-display text-2xl" style={{ color: GOLD }}>You&apos;re all set</h3>
          <p className="text-sm text-white/60">
            Payment received. Our team will human-review your entries and deliver your substantiated CAPE
            self-file kit — with step-by-step submission instructions — to <strong className="text-white">{form.email}</strong>.
          </p>
          <div className="rounded-lg bg-white/5 border border-white/10 px-4 py-3 text-xs text-white/40 text-left">
            Reference: {dealId}
          </div>
        </div>
      )}
    </div>
  );
}
