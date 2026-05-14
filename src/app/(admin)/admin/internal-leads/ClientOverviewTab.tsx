"use client";

import { useCallback, useEffect, useState } from "react";

interface Stats {
  total: number;
  linked: number;
  unlinked: number;
  byStage: Record<string, number>;
  byPartner: Record<string, number>;
  funnel: { submitted: number; qualified: number; disqualified: number; engaged: number; inProcess: number; won: number };
  byUtmSource?: Record<string, number>;
  byUtmCampaign?: Record<string, number>;
  byQualification?: { qualified: number; disqualified: number };
}

const STAGE_COLORS: Record<string, string> = {
  lead_submitted: "bg-blue-500/10 text-blue-400 border-blue-500/20",
  meeting_booked: "bg-amber-500/10 text-amber-400 border-amber-500/20",
  meeting_missed: "bg-red-500/10 text-red-400 border-red-500/20",
  qualified: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  client_engaged: "bg-green-500/10 text-green-400 border-green-500/20",
  in_process: "bg-purple-500/10 text-purple-400 border-purple-500/20",
  closedwon: "bg-green-500/10 text-green-300 border-green-500/20",
  disqualified: "bg-red-500/10 text-red-400 border-red-500/20",
  pending: "bg-gray-500/10 text-gray-400 border-gray-500/20",
};

export default function ClientOverviewTab() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/client-submissions");
      if (res.ok) {
        const data = await res.json();
        setStats(data.stats || null);
      }
    } catch {} finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  if (loading) return <div className="text-center py-12 font-body text-sm text-[var(--app-text-muted)]">Loading overview...</div>;
  if (!stats) return <div className="text-center py-12 font-body text-sm text-[var(--app-text-muted)]">No data yet.</div>;

  return (
    <div>
      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        <div className="card p-4 text-center">
          <div className="font-display text-2xl text-[var(--app-text)]">{stats.total}</div>
          <div className="font-body text-[10px] text-[var(--app-text-muted)] uppercase tracking-wider mt-1">Total Submissions</div>
        </div>
        <div className="card p-4 text-center">
          <div className="font-display text-2xl text-green-400">{stats.linked}</div>
          <div className="font-body text-[10px] text-[var(--app-text-muted)] uppercase tracking-wider mt-1">Matched to Deal</div>
        </div>
        <div className="card p-4 text-center">
          <div className="font-display text-2xl text-amber-400">{stats.unlinked}</div>
          <div className="font-body text-[10px] text-[var(--app-text-muted)] uppercase tracking-wider mt-1">Not Found</div>
        </div>
        <div className="card p-4 text-center">
          <div className="font-display text-2xl text-brand-gold">
            {stats.total > 0 ? `${Math.round((stats.linked / stats.total) * 100)}%` : "—"}
          </div>
          <div className="font-body text-[10px] text-[var(--app-text-muted)] uppercase tracking-wider mt-1">Match Rate</div>
        </div>
      </div>

      {/* Conversion Funnel */}
      {stats.funnel && (
        <div className="card p-5 mb-6">
          <div className="font-body text-[11px] text-[var(--app-text-muted)] uppercase tracking-wider mb-3">Conversion Funnel</div>
          <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
            {([
              { label: "Submitted", value: stats.funnel.submitted, color: "text-blue-400" },
              { label: "Qualified", value: stats.funnel.qualified, color: "text-emerald-400" },
              { label: "Disqualified", value: stats.funnel.disqualified, color: "text-red-400" },
              { label: "Agreement Signed", value: stats.funnel.engaged, color: "text-green-400" },
              { label: "In Process", value: stats.funnel.inProcess, color: "text-purple-400" },
              { label: "Won", value: stats.funnel.won, color: "text-brand-gold" },
            ] as const).map((s) => (
              <div key={s.label} className="text-center">
                <div className={`font-display text-xl ${s.color}`}>{s.value}</div>
                <div className="font-body text-[9px] text-[var(--app-text-muted)] uppercase tracking-wider mt-0.5">{s.label}</div>
                {stats.funnel.submitted > 0 && s.label !== "Submitted" && s.label !== "Disqualified" && (
                  <div className="font-body text-[9px] text-[var(--app-text-faint)] mt-0.5">
                    {Math.round((s.value / stats.funnel.submitted) * 100)}% rate
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Stage + Partner breakdowns */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
        {Object.keys(stats.byStage).length > 0 && (
          <div className="card p-4">
            <div className="font-body text-[10px] text-[var(--app-text-muted)] uppercase tracking-wider mb-3">By Deal Stage</div>
            <div className="space-y-2">
              {Object.entries(stats.byStage).sort(([,a], [,b]) => b - a).map(([stage, count]) => (
                <div key={stage} className="flex items-center justify-between">
                  <span className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase border ${STAGE_COLORS[stage] || STAGE_COLORS.pending}`}>
                    {stage.replace(/_/g, " ")}
                  </span>
                  <div className="flex items-center gap-2">
                    <div className="w-24 h-1.5 rounded-full bg-[var(--app-input-bg)] overflow-hidden">
                      <div className="h-full rounded-full bg-brand-gold/60" style={{ width: `${(count / stats.total) * 100}%` }} />
                    </div>
                    <span className="font-body text-[12px] text-[var(--app-text-secondary)] w-8 text-right">{count}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
        {Object.keys(stats.byPartner).length > 0 && (
          <div className="card p-4">
            <div className="font-body text-[10px] text-[var(--app-text-muted)] uppercase tracking-wider mb-3">By Partner Source</div>
            <div className="space-y-2">
              {Object.entries(stats.byPartner).sort(([,a], [,b]) => b - a).map(([partner, count]) => (
                <div key={partner} className="flex items-center justify-between">
                  <span className="font-body text-[12px] text-[var(--app-text-secondary)] font-mono">{partner === "direct" ? "Direct (no partner)" : partner}</span>
                  <div className="flex items-center gap-2">
                    <div className="w-24 h-1.5 rounded-full bg-[var(--app-input-bg)] overflow-hidden">
                      <div className="h-full rounded-full bg-brand-gold/60" style={{ width: `${(count / stats.total) * 100}%` }} />
                    </div>
                    <span className="font-body text-[12px] text-[var(--app-text-secondary)] w-8 text-right">{count}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Source Attribution */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {stats.byUtmSource && Object.keys(stats.byUtmSource).length > 0 && (
          <div className="card p-4">
            <div className="font-body text-[10px] text-[var(--app-text-muted)] uppercase tracking-wider mb-3">By Source</div>
            <div className="space-y-2">
              {Object.entries(stats.byUtmSource).sort(([,a], [,b]) => b - a).map(([source, count]) => (
                <div key={source} className="flex items-center justify-between">
                  <span className="font-body text-[12px] text-[var(--app-text-secondary)] capitalize">{source}</span>
                  <div className="flex items-center gap-2">
                    <div className="w-20 h-1.5 rounded-full bg-[var(--app-input-bg)] overflow-hidden">
                      <div className="h-full rounded-full bg-blue-500/60" style={{ width: `${(count / stats.total) * 100}%` }} />
                    </div>
                    <span className="font-body text-[12px] text-[var(--app-text-secondary)] w-8 text-right">{count}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
        {stats.byUtmCampaign && Object.keys(stats.byUtmCampaign).length > 0 && (
          <div className="card p-4">
            <div className="font-body text-[10px] text-[var(--app-text-muted)] uppercase tracking-wider mb-3">By Campaign</div>
            <div className="space-y-2">
              {Object.entries(stats.byUtmCampaign).sort(([,a], [,b]) => b - a).map(([campaign, count]) => (
                <div key={campaign} className="flex items-center justify-between">
                  <span className="font-body text-[12px] text-[var(--app-text-secondary)] truncate max-w-[120px]" title={campaign}>{campaign}</span>
                  <div className="flex items-center gap-2">
                    <div className="w-20 h-1.5 rounded-full bg-[var(--app-input-bg)] overflow-hidden">
                      <div className="h-full rounded-full bg-purple-500/60" style={{ width: `${(count / stats.total) * 100}%` }} />
                    </div>
                    <span className="font-body text-[12px] text-[var(--app-text-secondary)] w-8 text-right">{count}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
        {stats.byQualification && (
          <div className="card p-4">
            <div className="font-body text-[10px] text-[var(--app-text-muted)] uppercase tracking-wider mb-3">Qualification</div>
            <div className="flex items-center justify-around pt-2">
              <div className="text-center">
                <div className="font-display text-2xl text-green-400">{stats.byQualification.qualified}</div>
                <div className="font-body text-[10px] text-[var(--app-text-muted)] uppercase tracking-wider mt-1">Qualified</div>
              </div>
              <div className="text-center">
                <div className="font-display text-2xl text-red-400">{stats.byQualification.disqualified}</div>
                <div className="font-body text-[10px] text-[var(--app-text-muted)] uppercase tracking-wider mt-1">Screened Out</div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
