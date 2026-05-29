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

type Step = "analyze" | "results" | "consent" | "pay" | "sample" | "done";

interface Props {
  tokenizationKey: string;
  demoMode: boolean;
  partnerCode: string | null;
  feeLabel: string;
  widgetOnceLabel: string;
  widgetPerLabel: string;
  platforms: string[];
}

type PricingModel = "upfront" | "widget_onetime" | "widget_per_submission" | "per_file_volume";

interface PerFile {
  fileCount: number;
  sampleCents: number;
  fullCents: number;
  remainderCents: number;
}

interface EntryRow {
  countryOfOrigin: string;
  entryDate: string;
  enteredValue: string;
  entryNumber: string;
  liquidationDate: string;
}

interface Summary {
  entryCount: number;
  eligibleCount: number;
  excludedCount: number;
  urgentCount: number;
  totalEstRefund: number;
  totalEstInterest: number;
  totalRefundWithInterest: number;
  deadlineDays: number | null;
}

const GOLD = "#7c3aed"; // OpCenter-matched canonical accent (violet); name kept to minimize churn
const STORAGE_KEY = "tariff_diy_engagement";
const emptyRow: EntryRow = { countryOfOrigin: "", entryDate: "", enteredValue: "", entryNumber: "", liquidationDate: "" };
const fmt = (n: number) => `$${Math.round(n).toLocaleString("en-US")}`;
const centsLabel = (c: number) => `$${Math.round((c || 0) / 100).toLocaleString("en-US")}`;

export default function EngageFlow({ tokenizationKey, demoMode, partnerCode, feeLabel, widgetOnceLabel, widgetPerLabel, platforms }: Props) {
  const [step, setStep] = useState<Step>("analyze");
  const [contact, setContact] = useState({ clientName: "", email: "", company: "", phone: "" });
  const [rows, setRows] = useState<EntryRow[]>([{ ...emptyRow }]);
  const [dossierId, setDossierId] = useState("");
  const [tier, setTier] = useState("");
  const [summary, setSummary] = useState<Summary | null>(null);
  const [dealId, setDealId] = useState("");
  const [signingUrl, setSigningUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showWidget, setShowWidget] = useState(false);
  const [platform, setPlatform] = useState("");
  const [trial, setTrial] = useState<{ apiKey: string; embedSnippet: string; docsUrl: string } | null>(null);
  const [pathwayLabel, setPathwayLabel] = useState("done-for-you file");
  const [feeDisplay, setFeeDisplay] = useState(feeLabel);
  const [perFile, setPerFile] = useState<PerFile | null>(null);
  const [payScope, setPayScope] = useState<"sample" | "full">("full");
  const payScopeRef = useRef<"sample" | "full">("full");
  const collectConfigured = useRef(false);

  // Resume after the new-tab signing redirect (?signed=1); localStorage is shared across tabs.
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (new URLSearchParams(window.location.search).get("signed") !== "1") return;
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
      if (saved?.dealId) {
        setDealId(saved.dealId);
        if (saved.email) setContact((c) => ({ ...c, email: saved.email }));
        setStep("pay");
      }
    } catch { /* ignore */ }
  }, []);

  // ── Step 1: analyze entries → create dossier ───────────────────────────────
  async function analyze(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    const entries = rows
      .filter((r) => r.countryOfOrigin && r.entryDate && r.enteredValue)
      .map((r) => ({
        countryOfOrigin: r.countryOfOrigin.trim().toUpperCase(),
        entryDate: r.entryDate,
        enteredValue: Number(r.enteredValue),
        entryNumber: r.entryNumber.trim() || undefined,
        liquidationDate: r.liquidationDate || undefined,
      }));
    if (entries.length === 0) { setError("Add at least one entry (country, date, value)."); return; }
    setLoading(true);
    try {
      const res = await fetch("/api/tariff/engage/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...contact, clientCompany: contact.company, entries }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Analysis failed");
      setDossierId(data.dossierId);
      setTier(data.tier);
      setSummary(data.summary);
      setStep("results");
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  // ── Step 2: engage → send consent ──────────────────────────────────────────
  async function engage(pricingModel: PricingModel = "upfront") {
    setError("");
    setLoading(true);
    setPathwayLabel(
      pricingModel === "widget_onetime" ? "widget (full unlock)"
        : pricingModel === "widget_per_submission" ? "widget (per submission)"
        : "done-for-you file",
    );
    setFeeDisplay(
      pricingModel === "widget_onetime" ? widgetOnceLabel
        : pricingModel === "widget_per_submission" ? widgetPerLabel
        : pricingModel === "per_file_volume" ? "per file"
        : feeLabel,
    );
    if (pricingModel === "per_file_volume") setPathwayLabel("per-file");
    try {
      const res = await fetch("/api/tariff/engage", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...contact, clientCompany: contact.company, dossierId, ref: partnerCode, estimatedRefund: summary?.totalRefundWithInterest, pricingModel, platform: platform || undefined }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not start engagement");
      setDealId(data.dealId);
      setSigningUrl(data.signingUrl || "");
      if (data.perFile) setPerFile(data.perFile);
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify({ dealId: data.dealId, email: contact.email })); } catch { /* ignore */ }
      setStep("consent");
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  // ── Self-serve widget trial key ────────────────────────────────────────────
  async function getTrialKey() {
    setError("");
    if (!contact.email) { setError("Enter your work email above to get a trial key."); return; }
    setLoading(true);
    try {
      const res = await fetch("/api/tariff/widget-trial", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: contact.email,
          company: contact.company || undefined,
          clientName: contact.clientName || undefined,
          platform: platform || undefined,
          ref: partnerCode || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not issue a trial key");
      setTrial({ apiKey: data.apiKey, embedSnippet: data.embedSnippet, docsUrl: data.docsUrl });
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  // ── Step 4: Collect.js ─────────────────────────────────────────────────────
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
        callback: (resp: { token?: string }) => { if (resp?.token) payWithToken(resp.token); },
      });
      collectConfigured.current = true;
    };
    document.body.appendChild(script);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, demoMode, tokenizationKey]);

  // Trigger payment for a given scope (sample = one file; full = all/remainder).
  function startPay(scope: "sample" | "full") {
    payScopeRef.current = scope;
    setPayScope(scope);
    if (demoMode) { payWithToken("demo-token"); return; }
    window.CollectJS?.startPaymentRequest();
  }

  async function payWithToken(paymentToken: string) {
    setError("");
    setLoading(true);
    const scope = payScopeRef.current;
    try {
      const res = await fetch(`/api/tariff/engage/${dealId}/pay`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paymentToken, scope }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Payment failed");
      if (data.sampleUnlocked && !data.fullUnlocked) {
        setStep("sample");
      } else {
        try { localStorage.removeItem(STORAGE_KEY); } catch { /* ignore */ }
        setStep("done");
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  function updateRow(i: number, key: keyof EntryRow, val: string) {
    setRows((rs) => rs.map((r, idx) => (idx === i ? { ...r, [key]: val } : r)));
  }

  const inputCls = "w-full rounded-lg bg-white/5 border border-white/10 px-3 py-2.5 text-white placeholder-white/30 focus:outline-none focus:border-white/30 transition text-sm";
  const btnPrimary = "w-full rounded-lg py-3 font-semibold transition disabled:opacity-50";
  const stepIndex = ["analyze", "results", "consent", "pay", "done"].indexOf(step);

  return (
    <div className="rounded-2xl bg-white/[0.03] border border-white/10 p-6 sm:p-8 backdrop-blur">
      <div className="flex items-center gap-1.5 mb-6">
        {[0, 1, 2, 3, 4].map((i) => (
          <span key={i} className="h-1 flex-1 rounded-full" style={{ background: i <= stepIndex ? GOLD : "rgba(255,255,255,0.1)" }} />
        ))}
      </div>

      {error && (
        <div className="mb-4 rounded-lg bg-red-500/10 border border-red-500/20 px-4 py-3 text-sm text-red-300">{error}</div>
      )}

      {/* Step 1 — analyze */}
      {step === "analyze" && (
        <form onSubmit={analyze} className="space-y-4">
          <h3 className="font-display text-2xl" style={{ color: GOLD }}>Check your refund — free</h3>
          <p className="text-sm text-white/60">Enter your import entries for an instant, no-obligation refund + eligibility estimate.</p>
          <div className="grid grid-cols-2 gap-3">
            <input className={inputCls} placeholder="Full name" required value={contact.clientName} onChange={(e) => setContact({ ...contact, clientName: e.target.value })} />
            <input className={inputCls} type="email" placeholder="Work email" required value={contact.email} onChange={(e) => setContact({ ...contact, email: e.target.value })} />
            <input className={inputCls} placeholder="Company (IOR)" value={contact.company} onChange={(e) => setContact({ ...contact, company: e.target.value })} />
            <input className={inputCls} placeholder="Phone (optional)" value={contact.phone} onChange={(e) => setContact({ ...contact, phone: e.target.value })} />
          </div>

          <div className="space-y-3 pt-2">
            <div className="text-xs uppercase tracking-wider text-white/40">Import entries</div>
            {rows.map((r, i) => (
              <div key={i} className="grid grid-cols-12 gap-2">
                <input className={`${inputCls} col-span-3`} placeholder="Country" maxLength={2} value={r.countryOfOrigin} onChange={(e) => updateRow(i, "countryOfOrigin", e.target.value)} />
                <input className={`${inputCls} col-span-4`} type="date" value={r.entryDate} onChange={(e) => updateRow(i, "entryDate", e.target.value)} />
                <input className={`${inputCls} col-span-5`} type="number" placeholder="Entered value $" value={r.enteredValue} onChange={(e) => updateRow(i, "enteredValue", e.target.value)} />
              </div>
            ))}
            <button type="button" onClick={() => setRows([...rows, { ...emptyRow }])} className="text-sm text-white/50 hover:text-white/80 transition">+ Add another entry</button>
          </div>

          <button type="submit" disabled={loading} className={btnPrimary} style={{ background: GOLD, color: "#fff" }}>
            {loading ? "Analyzing…" : "See my refund estimate →"}
          </button>
        </form>
      )}

      {/* Step 2 — results */}
      {step === "results" && summary && (
        <div className="space-y-4">
          <h3 className="font-display text-2xl" style={{ color: GOLD }}>Your estimated refund</h3>
          <div className="rounded-xl bg-white/5 border border-white/10 p-5 text-center">
            <div className="text-4xl font-bold" style={{ color: GOLD }}>{fmt(summary.totalRefundWithInterest)}</div>
            <div className="text-xs text-white/50 mt-1">duties {fmt(summary.totalEstRefund)} + interest {fmt(summary.totalEstInterest)}</div>
          </div>
          <div className="grid grid-cols-3 gap-3 text-center text-sm">
            <div className="rounded-lg bg-white/5 border border-white/10 py-3"><div className="text-xl font-semibold text-emerald-400">{summary.eligibleCount}</div><div className="text-xs text-white/40">eligible</div></div>
            <div className="rounded-lg bg-white/5 border border-white/10 py-3"><div className="text-xl font-semibold text-white/70">{summary.excludedCount}</div><div className="text-xs text-white/40">excluded</div></div>
            <div className="rounded-lg bg-white/5 border border-white/10 py-3"><div className="text-xl font-semibold text-red-400">{summary.urgentCount}</div><div className="text-xs text-white/40">urgent</div></div>
          </div>
          {summary.deadlineDays != null && summary.deadlineDays <= 60 && (
            <div className="rounded-lg bg-red-500/10 border border-red-500/20 px-4 py-3 text-sm text-red-300">
              ⏱ Nearest protest deadline in {summary.deadlineDays} days — act now before it closes.
            </div>
          )}
          <p className="text-sm text-white/60">
            For a flat <strong className="text-white">{feeLabel}</strong> we prepare your fully substantiated,
            audit-ready CAPE file + guided self-file kit. You keep 100% of the refund.
          </p>
          <button onClick={() => engage("upfront")} disabled={loading} className={btnPrimary} style={{ background: GOLD, color: "#fff" }}>
            {loading ? "Starting…" : `Get my done-for-you file — ${feeLabel} →`}
          </button>

          {/* Per-file volume option — pay per file, with a "try one first" sample */}
          {summary.entryCount > 1 && (
            <button onClick={() => engage("per_file_volume")} disabled={loading}
              className="w-full rounded-lg py-2.5 text-sm font-semibold border border-white/15 text-white/80 hover:bg-white/5 transition disabled:opacity-50">
              Pay per file instead — volume pricing ({summary.entryCount} files) →
            </button>
          )}

          {/* Fallback / add-on upsell — widget for CRM/TMS users */}
          {!showWidget ? (
            <button onClick={() => setShowWidget(true)} className="w-full text-sm text-white/50 hover:text-white/80 transition py-1">
              Use a CRM or TMS? See the widget option →
            </button>
          ) : (
            <div className="rounded-xl bg-white/5 border border-white/10 p-4 space-y-3">
              <div className="text-sm text-white/80 font-semibold">Embed tariff-refund analysis in your workflow</div>
              <p className="text-xs text-white/50">Which platform do you use? We&apos;ll send a free trial API key + integration guide so you can run refunds right inside it.</p>
              <select className={inputCls} value={platform} onChange={(e) => setPlatform(e.target.value)}>
                <option value="">Select your CRM / TMS…</option>
                {platforms.map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
              <div className="grid grid-cols-1 gap-2 pt-1">
                <button onClick={() => engage("widget_onetime")} disabled={loading} className="w-full rounded-lg py-2.5 text-sm font-semibold transition disabled:opacity-50" style={{ background: GOLD, color: "#fff" }}>
                  Full unlock — {widgetOnceLabel} one-time
                </button>
                <button onClick={() => engage("widget_per_submission")} disabled={loading} className="w-full rounded-lg py-2.5 text-sm font-semibold border border-white/15 text-white/80 hover:bg-white/5 transition disabled:opacity-50">
                  Pay as you go — {widgetPerLabel} / submission
                </button>
              </div>

              {/* Self-serve free trial key */}
              {!trial ? (
                <>
                  <div className="flex items-center gap-3 py-1">
                    <div className="h-px flex-1 bg-white/10" />
                    <span className="text-[11px] uppercase tracking-wide text-white/30">or try free first</span>
                    <div className="h-px flex-1 bg-white/10" />
                  </div>
                  <button onClick={getTrialKey} disabled={loading} className="w-full rounded-lg py-2.5 text-sm font-semibold border transition disabled:opacity-50" style={{ borderColor: GOLD, color: GOLD }}>
                    {loading ? "Generating…" : "Get a free trial key →"}
                  </button>
                </>
              ) : (
                <div className="rounded-lg bg-black/30 border border-white/10 p-3 space-y-2">
                  <div className="text-xs font-semibold" style={{ color: GOLD }}>Your free trial key</div>
                  <code className="block w-full break-all rounded bg-black/40 px-2 py-1.5 text-[11px] text-white/80 font-mono select-all">{trial.apiKey}</code>
                  <div className="text-[11px] text-white/40">1-line embed snippet:</div>
                  <code className="block w-full break-all rounded bg-black/40 px-2 py-1.5 text-[11px] text-white/70 font-mono select-all">{trial.embedSnippet}</code>
                  <p className="text-[11px] text-white/40">
                    Returns eligibility + deadlines (refund $ locked).{" "}
                    <a href={trial.docsUrl} target="_blank" rel="noreferrer" className="underline hover:text-white/70" style={{ color: GOLD }}>Integration guide →</a>
                  </p>
                  <p className="text-[11px] text-white/30">Upgrade for the full calc + file — pick a plan above.</p>
                </div>
              )}

              <p className="text-[11px] text-white/30">Free trial returns a partial analysis; full calculation + file unlock when you choose a plan.</p>
            </div>
          )}
          <p className="text-[11px] text-white/30 text-center">Estimate only, not a guarantee of approval. Fintella is not a law firm.</p>
        </div>
      )}

      {/* Step 3 — consent */}
      {step === "consent" && (
        <div className="space-y-4">
          <h3 className="font-display text-2xl" style={{ color: GOLD }}>Sign your consent & authorization</h3>
          <p className="text-sm text-white/60">Review and sign so we can prepare your file. Opens in a new tab.</p>
          {signingUrl ? (
            <a href={signingUrl} target="_blank" rel="noopener noreferrer" className="block w-full text-center rounded-lg py-3 font-semibold transition" style={{ background: GOLD, color: "#fff" }}>
              Open agreement to sign →
            </a>
          ) : (
            <div className="rounded-lg bg-white/5 border border-white/10 px-4 py-3 text-sm text-white/50">Agreement is being prepared — check your email shortly to sign.</div>
          )}
          <button onClick={() => setStep("pay")} className="w-full rounded-lg py-3 font-semibold border border-white/15 text-white/80 hover:bg-white/5 transition">
            I&apos;ve signed — continue to payment →
          </button>
        </div>
      )}

      {/* Step 4 — pay */}
      {step === "pay" && (
        <div className="space-y-4">
          <h3 className="font-display text-2xl" style={{ color: GOLD }}>Checkout — {pathwayLabel}</h3>

          {perFile ? (
            <>
              <p className="text-sm text-white/60">
                <strong className="text-white">{perFile.fileCount} files</strong> at volume pricing —
                <strong className="text-white"> {centsLabel(perFile.fullCents)}</strong> total. Or try one file
                first for <strong className="text-white">{centsLabel(perFile.sampleCents)}</strong>, then unlock the
                rest for {centsLabel(perFile.remainderCents)}.
              </p>
              <button onClick={() => startPay("full")} disabled={loading} className={btnPrimary} style={{ background: GOLD, color: "#fff" }}>
                {loading && payScope === "full" ? "Processing…" : `Unlock all ${perFile.fileCount} files — ${centsLabel(perFile.fullCents)}`}
              </button>
              <button onClick={() => startPay("sample")} disabled={loading}
                className="w-full rounded-lg py-3 font-semibold border border-white/15 text-white/80 hover:bg-white/5 transition disabled:opacity-50">
                {loading && payScope === "sample" ? "Processing…" : `Try one file first — ${centsLabel(perFile.sampleCents)}`}
              </button>
            </>
          ) : (
            <>
              <p className="text-sm text-white/60"><strong className="text-white">{feeDisplay}</strong> for your substantiated, audit-ready CAPE self-file kit. No contingency — the refund is 100% yours.</p>
              <button onClick={() => startPay("full")} disabled={loading} className={btnPrimary} style={{ background: GOLD, color: "#fff" }}>
                {loading ? "Processing…" : demoMode ? `Simulate payment (demo) — ${feeDisplay}` : `Pay ${feeDisplay} securely`}
              </button>
            </>
          )}
          <p className="text-xs text-white/30 text-center">Card processed securely by NMI. We never see your card details.</p>
        </div>
      )}

      {/* Step 4b — sample unlocked, offer the rest */}
      {step === "sample" && perFile && (
        <div className="space-y-4">
          <h3 className="font-display text-2xl" style={{ color: GOLD }}>Your sample file is ready</h3>
          <p className="text-sm text-white/60">One file is unlocked below. Happy with it? Unlock all {perFile.fileCount} files for {centsLabel(perFile.remainderCents)} more.</p>
          <div className="space-y-2">
            <a href={`/api/tariff/engage/${dealId}/kit?format=pdf`} className="block w-full text-center rounded-lg py-3 font-semibold border border-white/15 text-white/80 hover:bg-white/5 transition">⬇ Sample analysis (PDF)</a>
            <a href={`/api/tariff/engage/${dealId}/kit?format=csv`} className="block w-full text-center rounded-lg py-3 font-semibold border border-white/15 text-white/80 hover:bg-white/5 transition">⬇ Sample CAPE entry (CSV)</a>
          </div>
          <button onClick={() => startPay("full")} disabled={loading} className={btnPrimary} style={{ background: GOLD, color: "#fff" }}>
            {loading ? "Processing…" : `Unlock all ${perFile.fileCount} files — ${centsLabel(perFile.remainderCents)}`}
          </button>
        </div>
      )}

      {/* Step 5 — done */}
      {step === "done" && (
        <div className="space-y-4 text-center">
          <div className="text-5xl">✓</div>
          <h3 className="font-display text-2xl" style={{ color: GOLD }}>Your self-file kit is ready</h3>
          <p className="text-sm text-white/60">Payment received. Download your substantiated kit below — we&apos;ve also emailed a copy to <strong className="text-white">{contact.email}</strong>.</p>
          <div className="space-y-2">
            <a href={`/api/tariff/engage/${dealId}/kit?format=pdf`} className="block w-full rounded-lg py-3 font-semibold transition" style={{ background: GOLD, color: "#fff" }}>⬇ Recovery analysis (PDF)</a>
            <a href={`/api/tariff/engage/${dealId}/kit?format=csv`} className="block w-full rounded-lg py-3 font-semibold border border-white/15 text-white/80 hover:bg-white/5 transition">⬇ CAPE declaration (CSV)</a>
            <a href={`/api/tariff/engage/${dealId}/kit?format=guide`} className="block w-full rounded-lg py-3 font-semibold border border-white/15 text-white/80 hover:bg-white/5 transition">⬇ Step-by-step self-file guide</a>
          </div>
          <div className="rounded-lg bg-white/5 border border-white/10 px-4 py-3 text-xs text-white/40">Reference: {dealId}</div>
        </div>
      )}
    </div>
  );
}
