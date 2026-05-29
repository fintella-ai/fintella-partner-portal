"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";

interface RiskFactor { label: string; points: number }
interface Risk {
  score: number;
  band: "low" | "medium" | "high";
  recommendedBuyoutBps: number;
  decision: "auto_approve" | "review" | "auto_decline";
  factors: RiskFactor[];
}
interface Detail {
  dealId: string;
  dealName: string;
  clientName: string | null;
  clientEmail: string | null;
  company: string | null;
  partnerCode: string;
  createdAt: string;
  engagement: {
    underwritingStatus?: "pending" | "approved" | "declined";
    upfrontFeeCents?: number;
    upfrontTxnId?: string;
    upfrontStatus?: string;
    underwritingNote?: string;
    underwritingDecidedBy?: string;
    underwritingDecidedAt?: string;
  };
  estimatedRefund: number | null;
  entryCount: number;
  risk: Risk | null;
}

const usd = (n: number | null | undefined) => (n == null ? "—" : `$${Math.round(n).toLocaleString("en-US")}`);
const BAND_COLOR: Record<string, string> = { low: "#16a34a", medium: "#ca8a04", high: "#dc2626" };

export default function UnderwritingDetailPage() {
  const { dealId } = useParams<{ dealId: string }>();
  const router = useRouter();
  const [d, setD] = useState<Detail | null>(null);
  const [loading, setLoading] = useState(true);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch(`/api/admin/tariff/underwriting/${dealId}`);
    const data = await res.json();
    if (res.ok) setD(data);
    else setError(data.error || "Failed to load");
    setLoading(false);
  }, [dealId]);

  useEffect(() => { load(); }, [load]);

  async function decide(action: "approve" | "decline") {
    const verb = action === "approve" ? "approve (void the hold)" : "decline (capture the fee)";
    if (!confirm(`Confirm: ${verb} for this buyout? This writes to the real DB and settles the NMI hold.`)) return;
    setBusy(true);
    setError("");
    try {
      const res = await fetch(`/api/admin/tariff/underwriting/${dealId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, note }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Decision failed");
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <div className="text-[var(--app-text-muted)] text-sm py-12 text-center">Loading…</div>;
  if (!d) return <div className="text-[var(--app-text-muted)] text-sm py-12 text-center">{error || "Not found"}</div>;

  const uw = d.engagement.underwritingStatus ?? "pending";
  const decided = uw !== "pending";

  return (
    <div className="space-y-6 max-w-3xl">
      <Link href="/admin/tariff-underwriting" className="text-sm text-[var(--app-text-muted)] hover:underline">
        ← Back to queue
      </Link>

      <div>
        <h1 className="font-display text-xl font-bold">{d.company || d.clientName || "Buyout deal"}</h1>
        <p className="font-body text-[13px] text-[var(--app-text-muted)] mt-1">
          {d.clientEmail} · partner {d.partnerCode} · {d.entryCount} entr{d.entryCount === 1 ? "y" : "ies"}
        </p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Stat label="Est. refund" value={usd(d.estimatedRefund)} />
        <Stat label="Upfront hold" value={usd(d.engagement.upfrontFeeCents != null ? d.engagement.upfrontFeeCents / 100 : null)} />
        <Stat label="Hold txn" value={d.engagement.upfrontTxnId ? "placed" : "none"} />
        <Stat label="Status" value={uw} />
      </div>

      {d.risk && (
        <div className="rounded-xl border border-[var(--app-border)] p-4 space-y-3">
          <div className="flex items-center gap-3">
            <span
              className="px-2.5 py-1 rounded-full text-xs font-semibold text-white"
              style={{ background: BAND_COLOR[d.risk.band] }}
            >
              Risk {d.risk.score} · {d.risk.band}
            </span>
            <span className="text-sm capitalize text-[var(--app-text-muted)]">
              Suggestion: {d.risk.decision.replace("_", " ")} · recommend {(d.risk.recommendedBuyoutBps / 100).toFixed(0)}¢ per $
            </span>
          </div>
          <div>
            <div className="text-xs text-[var(--app-text-muted)] mb-1">Risk factors</div>
            {d.risk.factors.length === 0 ? (
              <div className="text-sm">No adverse signals — clean claim.</div>
            ) : (
              <ul className="text-sm space-y-1">
                {d.risk.factors.map((f, i) => (
                  <li key={i} className="flex justify-between border-b border-[var(--app-border)] py-1">
                    <span>{f.label}</span>
                    <span className="text-[var(--app-text-muted)]">+{f.points}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}

      {error && <div className="text-sm text-[#dc2626]">{error}</div>}

      {decided ? (
        <div className="rounded-xl border border-[var(--app-border)] p-4 text-sm">
          <div className="font-semibold capitalize mb-1">Decision: {uw}</div>
          {d.engagement.underwritingDecidedBy && (
            <div className="text-[var(--app-text-muted)] text-xs">
              by {d.engagement.underwritingDecidedBy}
              {d.engagement.underwritingDecidedAt ? ` · ${new Date(d.engagement.underwritingDecidedAt).toLocaleString()}` : ""}
            </div>
          )}
          {d.engagement.underwritingNote && <p className="mt-2">{d.engagement.underwritingNote}</p>}
          <p className="mt-2 text-[var(--app-text-muted)] text-xs">
            {uw === "approved"
              ? "Upfront hold voided — fee will be netted from the lending payout."
              : "Upfront hold captured — fee retained."}
          </p>
        </div>
      ) : (
        <div className="rounded-xl border border-[var(--app-border)] p-4 space-y-3">
          <div className="font-semibold text-sm">Underwriting decision</div>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Decision note (optional)…"
            className="w-full rounded-lg bg-[var(--app-bg-secondary)] border border-[var(--app-border)] px-3 py-2 text-sm"
            rows={3}
          />
          <div className="flex gap-2">
            <button
              onClick={() => decide("approve")}
              disabled={busy}
              className="px-4 py-2 rounded-lg text-sm font-semibold text-white disabled:opacity-50"
              style={{ background: "#16a34a" }}
            >
              {busy ? "Working…" : "Approve — void hold"}
            </button>
            <button
              onClick={() => decide("decline")}
              disabled={busy}
              className="px-4 py-2 rounded-lg text-sm font-semibold text-white disabled:opacity-50"
              style={{ background: "#dc2626" }}
            >
              {busy ? "Working…" : "Decline — capture fee"}
            </button>
          </div>
          <p className="text-[11px] text-[var(--app-text-muted)]">
            Lending payout execution is deferred (pending lending-partner docs). This records the decision and
            settles the NMI authorization hold only.
          </p>
        </div>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-[var(--app-border)] p-3">
      <div className="text-xs text-[var(--app-text-muted)]">{label}</div>
      <div className="font-semibold capitalize mt-0.5">{value}</div>
    </div>
  );
}
