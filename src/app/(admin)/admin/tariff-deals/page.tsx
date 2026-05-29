"use client";

import { useEffect, useState, useCallback } from "react";

interface Deal {
  id: string;
  dealName: string;
  clientName: string | null;
  clientEmail: string | null;
  partnerName?: string;
  partnerCode: string;
  stage: string;
  tags: string[];
  estimatedRefundAmount: number;
  actualRefundAmount: number | null;
  serviceOfInterest: string | null;
  serviceFields?: any;
}

const usd = (n: number) => `$${Math.round(n || 0).toLocaleString("en-US")}`;
const FROST_TAG = "submitted_to_frost";
const CONVERTED_STAGES = new Set(["closedwon", "completed"]);

const TAG_LABEL: Record<string, string> = {
  tariff: "Tariff",
  kwong: "Kwong",
  internal_lead: "Internal Lead",
  tier1: "Tier-1 (<$1M)",
  submitted_to_frost: "Submitted to Frost",
  frost_converted: "Frost Converted",
};

function isConverted(d: Deal) {
  return d.tags?.includes("frost_converted") || CONVERTED_STAGES.has(d.stage) || (d.actualRefundAmount ?? 0) > 0;
}

export default function TariffDealsPage() {
  const [service, setService] = useState<"tariff" | "kwong">("tariff");
  const [tagFilter, setTagFilter] = useState<string>("all");
  const [deals, setDeals] = useState<Deal[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string>("");

  const load = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({ service });
    if (tagFilter !== "all") params.set("tag", tagFilter);
    const res = await fetch(`/api/admin/deals?${params.toString()}`);
    const data = await res.json();
    setDeals(Array.isArray(data.deals) ? data.deals : []);
    setLoading(false);
  }, [service, tagFilter]);

  useEffect(() => { load(); }, [load]);

  async function submitToFrost(id: string) {
    if (!confirm("Submit this deal to Frost? It will be frozen at this stage and can no longer be moved or deleted.")) return;
    setBusyId(id);
    await fetch(`/api/admin/deals/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ submitToFrost: true }),
    });
    setBusyId("");
    load();
  }

  // KPI rollup (Frost handoff funnel)
  const sentToFrost = deals.filter((d) => d.tags?.includes(FROST_TAG));
  const converted = sentToFrost.filter(isConverted);
  const kpi = {
    pipeline: deals.length,
    pipelineValue: deals.reduce((s, d) => s + (d.estimatedRefundAmount || 0), 0),
    sent: sentToFrost.length,
    converted: converted.length,
    rate: sentToFrost.length ? Math.round((converted.length / sentToFrost.length) * 100) : 0,
    sentValue: sentToFrost.reduce((s, d) => s + (d.estimatedRefundAmount || 0), 0),
    convertedValue: converted.reduce((s, d) => s + (d.actualRefundAmount ?? d.estimatedRefundAmount ?? 0), 0),
  };

  // Group by stage for the pipeline view
  const byStage: Record<string, Deal[]> = {};
  for (const d of deals) (byStage[d.stage] ||= []).push(d);
  const stages = Object.keys(byStage).sort();

  const card = "rounded-xl border border-[var(--app-border)] bg-[var(--app-bg-secondary)] p-4";

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
        <div>
          <h2 className="font-display text-xl font-bold">Tariff & Internal Lead Pipeline</h2>
          <p className="font-body text-[13px] text-[var(--app-text-muted)] mt-1">
            Tier-1 (&lt;$1M) tariff-refund engagements + Kwong, with Frost-handoff conversion KPI.
          </p>
        </div>
        <a href="/recover/tariff-diy" target="_blank" rel="noopener noreferrer"
          className="px-4 py-2 rounded-lg bg-[var(--brand-gold)] text-[var(--app-button-gold-text)] text-sm font-semibold hover:opacity-90 self-start">
          /recover/tariff-diy ↗
        </a>
      </div>

      {/* Service toggle */}
      <div className="mb-4 flex gap-1 border-b border-[var(--app-border)]">
        {([["tariff", "Tariff Refunds"], ["kwong", "Kwong (ERC)"]] as const).map(([v, label]) => (
          <button key={v} onClick={() => setService(v)}
            className={`px-4 py-2 text-sm font-semibold border-b-2 -mb-px transition ${service === v ? "border-[var(--brand-gold)] text-[var(--app-text)]" : "border-transparent text-[var(--app-text-muted)] hover:text-[var(--app-text)]"}`}>
            {label}
          </button>
        ))}
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 mb-5">
        <div className={card}><div className="text-2xl font-bold">{kpi.pipeline}</div><div className="text-xs text-[var(--app-text-muted)]">In pipeline</div></div>
        <div className={card}><div className="text-2xl font-bold">{usd(kpi.pipelineValue)}</div><div className="text-xs text-[var(--app-text-muted)]">Pipeline value</div></div>
        <div className={card}><div className="text-2xl font-bold">{kpi.sent}</div><div className="text-xs text-[var(--app-text-muted)]">Sent to Frost</div></div>
        <div className={card}><div className="text-2xl font-bold">{kpi.converted}</div><div className="text-xs text-[var(--app-text-muted)]">Converted ({kpi.rate}%)</div></div>
        <div className={card}><div className="text-2xl font-bold">{usd(kpi.convertedValue)}</div><div className="text-xs text-[var(--app-text-muted)]">Converted value</div></div>
      </div>

      {/* Tag filters */}
      <div className="mb-4 flex flex-wrap gap-2">
        {[["all", "All"], ["internal_lead", "Internal Lead"], ["tier1", "Tier-1 (<$1M)"], ["submitted_to_frost", "Submitted to Frost"], ["frost_converted", "Converted"]].map(([v, label]) => (
          <button key={v} onClick={() => setTagFilter(v)}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition ${tagFilter === v ? "bg-[var(--brand-gold)] text-[var(--app-button-gold-text)] border-transparent" : "border-[var(--app-border)] text-[var(--app-text-muted)] hover:text-[var(--app-text)]"}`}>
            {label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="text-[var(--app-text-muted)] text-sm py-12 text-center">Loading…</div>
      ) : deals.length === 0 ? (
        <div className="text-[var(--app-text-muted)] text-sm py-12 text-center">No deals match this filter.</div>
      ) : (
        <div className="space-y-6">
          {stages.map((stage) => (
            <div key={stage}>
              <div className="flex items-center gap-2 mb-2">
                <h3 className="font-semibold text-sm capitalize">{stage.replace(/_/g, " ")}</h3>
                <span className="text-xs text-[var(--app-text-muted)]">({byStage[stage].length})</span>
                {stage === FROST_TAG && <span className="text-xs">🔒 frozen</span>}
              </div>
              <div className="overflow-x-auto rounded-xl border border-[var(--app-border)]">
                <table className="w-full text-sm">
                  <thead className="bg-[var(--app-bg-secondary)] text-[var(--app-text-muted)] text-xs">
                    <tr>
                      <th className="text-left px-3 py-2">Client</th>
                      <th className="text-left px-3 py-2">Partner</th>
                      <th className="text-right px-3 py-2">Est. Refund</th>
                      <th className="text-left px-3 py-2">Tags</th>
                      <th className="text-right px-3 py-2">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {byStage[stage].map((d) => {
                      const frozen = d.tags?.includes(FROST_TAG) || d.stage === FROST_TAG;
                      return (
                        <tr key={d.id} className="border-t border-[var(--app-border)]">
                          <td className="px-3 py-2">
                            <a href={`/admin/deals?id=${d.id}`} className="font-medium hover:underline">{d.clientName || d.dealName}</a>
                            <div className="text-xs text-[var(--app-text-muted)]">{d.clientEmail}</div>
                          </td>
                          <td className="px-3 py-2 text-[var(--app-text-muted)]">{d.partnerName || d.partnerCode}</td>
                          <td className="px-3 py-2 text-right font-medium">{usd(d.estimatedRefundAmount)}</td>
                          <td className="px-3 py-2">
                            <div className="flex flex-wrap gap-1">
                              {(d.tags || []).map((t) => (
                                <span key={t} className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-[var(--app-bg)] border border-[var(--app-border)]">{TAG_LABEL[t] || t}</span>
                              ))}
                            </div>
                          </td>
                          <td className="px-3 py-2 text-right">
                            {frozen ? (
                              <span className="text-xs text-[var(--app-text-muted)]">🔒 {isConverted(d) ? "converted" : "frozen"}</span>
                            ) : (
                              <button onClick={() => submitToFrost(d.id)} disabled={busyId === d.id}
                                className="px-3 py-1.5 rounded-lg text-xs font-semibold border border-[var(--app-border)] hover:bg-[var(--app-bg-secondary)] disabled:opacity-50">
                                {busyId === d.id ? "…" : "Submit to Frost →"}
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
