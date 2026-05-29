"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";

interface RiskFactor { label: string; points: number }
interface Risk {
  score: number;
  band: "low" | "medium" | "high";
  recommendedBuyoutBps: number;
  decision: "auto_approve" | "review" | "auto_decline";
  factors: RiskFactor[];
}
interface Row {
  dealId: string;
  dealName: string;
  clientName: string | null;
  clientEmail: string | null;
  company: string | null;
  partnerCode: string;
  createdAt: string;
  underwritingStatus: "pending" | "approved" | "declined";
  upfrontFeeCents: number | null;
  hasHold: boolean;
  estimatedRefund: number | null;
  risk: Risk | null;
}

const usd = (n: number | null) => (n == null ? "—" : `$${Math.round(n).toLocaleString("en-US")}`);
const STATUSES = ["pending", "approved", "declined", "all"] as const;

const BAND_COLOR: Record<string, string> = {
  low: "#16a34a",
  medium: "#ca8a04",
  high: "#dc2626",
};

export default function TariffUnderwritingPage() {
  const [status, setStatus] = useState<(typeof STATUSES)[number]>("pending");
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch(`/api/admin/tariff/underwriting/queue?status=${status}`);
    const data = await res.json();
    setRows(Array.isArray(data.deals) ? data.deals : []);
    setLoading(false);
  }, [status]);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-2">
        <div>
          <h1 className="font-display text-xl font-bold">Tariff Underwriting</h1>
          <p className="font-body text-[13px] text-[var(--app-text-muted)] mt-1">
            Buyout deals pending audit & underwriting. Approve to release the upfront hold (fee netted from the
            payout); decline to capture the fee. Risk scores are decision support — you make the call.
          </p>
        </div>
      </div>

      <div className="mb-4 flex gap-1 border-b border-[var(--app-border)]">
        {STATUSES.map((s) => (
          <button
            key={s}
            onClick={() => setStatus(s)}
            className={`px-3 py-2 text-sm font-semibold capitalize border-b-2 -mb-px transition ${
              status === s
                ? "border-[var(--brand-gold)] text-[var(--app-text)]"
                : "border-transparent text-[var(--app-text-muted)] hover:text-[var(--app-text)]"
            }`}
          >
            {s}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="text-[var(--app-text-muted)] text-sm py-12 text-center">Loading…</div>
      ) : rows.length === 0 ? (
        <div className="text-[var(--app-text-muted)] text-sm py-12 text-center">No {status} buyout deals.</div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-[var(--app-border)]">
          <table className="w-full text-sm">
            <thead className="bg-[var(--app-bg-secondary)] text-[var(--app-text-muted)] text-xs">
              <tr>
                <th className="text-left px-3 py-2">Client</th>
                <th className="text-left px-3 py-2">Partner</th>
                <th className="text-right px-3 py-2">Est. refund</th>
                <th className="text-right px-3 py-2">Hold</th>
                <th className="text-left px-3 py-2">Risk</th>
                <th className="text-left px-3 py-2">Suggestion</th>
                <th className="text-left px-3 py-2">Status</th>
                <th className="px-3 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.dealId} className="border-t border-[var(--app-border)]">
                  <td className="px-3 py-2">
                    <div className="font-medium">{r.company || r.clientName || "—"}</div>
                    <div className="text-xs text-[var(--app-text-muted)]">{r.clientEmail || "—"}</div>
                  </td>
                  <td className="px-3 py-2 text-xs">{r.partnerCode}</td>
                  <td className="px-3 py-2 text-right font-medium">{usd(r.estimatedRefund)}</td>
                  <td className="px-3 py-2 text-right">
                    {r.upfrontFeeCents != null ? usd(r.upfrontFeeCents / 100) : "—"}
                    {r.hasHold ? "" : <span className="text-[10px] text-[var(--app-text-muted)]"> (none)</span>}
                  </td>
                  <td className="px-3 py-2">
                    {r.risk ? (
                      <span
                        className="px-2 py-0.5 rounded-full text-[10px] font-semibold text-white"
                        style={{ background: BAND_COLOR[r.risk.band] }}
                      >
                        {r.risk.score} · {r.risk.band}
                      </span>
                    ) : (
                      <span className="text-xs text-[var(--app-text-muted)]">no dossier</span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-xs capitalize">
                    {r.risk ? r.risk.decision.replace("_", " ") : "—"}
                    {r.risk ? (
                      <span className="text-[var(--app-text-muted)]"> · {(r.risk.recommendedBuyoutBps / 100).toFixed(0)}¢/$</span>
                    ) : null}
                  </td>
                  <td className="px-3 py-2">
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-[var(--app-bg)] border border-[var(--app-border)] capitalize">
                      {r.underwritingStatus}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-right">
                    <Link
                      href={`/admin/tariff-underwriting/${r.dealId}`}
                      className="font-medium hover:underline text-[var(--brand-gold)]"
                    >
                      Review →
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
