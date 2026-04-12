"use client";

import { useState, useEffect } from "react";
import { fmt$ } from "@/lib/format";

type Stats = {
  totalPipeline: number;
  totalCommissionsPaid: number;
  totalCommissionsDue: number;
  totalCommissionsPending: number;
  totalPartners: number;
  activePartners: number;
  newPartnersThisMonth: number;
  dealsThisMonth: number;
  closedWonThisMonth: number;
  conversionRate: number;
};

type MonthlyRow = {
  month: string;
  newDeals: number;
  closedWon: number;
  commPaid: number;
  commDue: number;
  newPartners: number;
};

type TopPartner = {
  name: string;
  code: string;
  deals: number;
  pipeline: number;
  commission: number;
};

export default function ReportsPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [monthlyData, setMonthlyData] = useState<MonthlyRow[]>([]);
  const [topPartners, setTopPartners] = useState<TopPartner[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/admin/reports")
      .then((r) => r.json())
      .then((data) => {
        setStats(data.stats);
        setMonthlyData(data.monthlyData || []);
        setTopPartners(data.topPartners || []);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div>
        <h2 className="font-display text-[22px] font-bold mb-1.5">Reports & Analytics</h2>
        <p className="font-body text-[13px] text-[var(--app-text-muted)] mb-6">Loading analytics...</p>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="stat-card animate-pulse">
              <div className="h-3 w-20 bg-[var(--app-border)] rounded mb-3" />
              <div className="h-7 w-24 bg-[var(--app-border)] rounded" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  const s = stats || {
    totalPipeline: 0,
    totalCommissionsPaid: 0,
    totalCommissionsDue: 0,
    totalCommissionsPending: 0,
    totalPartners: 0,
    activePartners: 0,
    newPartnersThisMonth: 0,
    conversionRate: 0,
  };

  return (
    <div>
      <div className="flex justify-between items-start mb-6">
        <div>
          <h2 className="font-display text-[22px] font-bold mb-1.5">Reports & Analytics</h2>
          <p className="font-body text-[13px] text-[var(--app-text-muted)]">Overview of pipeline, commissions, and partner performance.</p>
        </div>
      </div>

      {/* ═══ KEY METRICS ═══ */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {[
          { label: "Total Pipeline", value: fmt$(s.totalPipeline), color: "text-[var(--app-text)]" },
          { label: "Commissions Paid", value: fmt$(s.totalCommissionsPaid), color: "text-green-400" },
          { label: "Commissions Due", value: fmt$(s.totalCommissionsDue), color: "text-blue-400" },
          { label: "Commissions Pending", value: fmt$(s.totalCommissionsPending), color: "text-yellow-400" },
        ].map((m) => (
          <div key={m.label} className="stat-card">
            <div className="font-body text-[9px] tracking-[1.5px] uppercase text-[var(--app-text-muted)] mb-2">{m.label}</div>
            <div className={`font-display text-xl sm:text-2xl font-bold ${m.color}`}>{m.value}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {[
          { label: "Total Partners", value: String(s.totalPartners) },
          { label: "Active Partners", value: String(s.activePartners) },
          { label: "New This Month", value: `+${s.newPartnersThisMonth}` },
          { label: "Conversion Rate", value: `${s.conversionRate}%` },
        ].map((m) => (
          <div key={m.label} className="stat-card">
            <div className="font-body text-[9px] tracking-[1.5px] uppercase text-[var(--app-text-muted)] mb-2">{m.label}</div>
            <div className="font-display text-xl sm:text-2xl font-bold text-brand-gold">{m.value}</div>
          </div>
        ))}
      </div>

      {/* ═══ MONTHLY TRENDS ═══ */}
      <div className="card mb-6">
        <div className="px-6 py-4 border-b border-[var(--app-border)]">
          <div className="font-body font-semibold text-sm">Monthly Commission Report</div>
        </div>
        {monthlyData.length === 0 ? (
          <div className="p-8 text-center">
            <div className="font-body text-sm text-[var(--app-text-muted)]">No monthly data yet. Data will appear as deals and commissions are created.</div>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-[1fr_0.6fr_0.6fr_0.8fr_0.8fr_0.6fr] gap-4 px-6 py-3 border-b border-[var(--app-border)]">
              {["Month", "New Deals", "Closed Won", "Comm. Paid", "Comm. Due", "New Partners"].map((h) => (
                <div key={h} className="font-body text-[10px] tracking-[1px] uppercase text-[var(--app-text-muted)]">{h}</div>
              ))}
            </div>
            {monthlyData.map((row) => (
              <div key={row.month} className="grid grid-cols-[1fr_0.6fr_0.6fr_0.8fr_0.8fr_0.6fr] gap-4 px-6 py-3.5 border-b border-[var(--app-border)] last:border-b-0 items-center hover:bg-[var(--app-card-bg)] transition-colors">
                <div className="font-body text-[13px] text-[var(--app-text)]">{row.month}</div>
                <div className="font-body text-[13px] text-[var(--app-text-secondary)]">{row.newDeals}</div>
                <div className="font-body text-[13px] text-[var(--app-text-secondary)]">{row.closedWon}</div>
                <div className="font-body text-[13px] text-green-400 font-semibold">{fmt$(row.commPaid)}</div>
                <div className="font-body text-[13px] text-blue-400 font-semibold">{fmt$(row.commDue)}</div>
                <div className="font-body text-[13px] text-brand-gold">+{row.newPartners}</div>
              </div>
            ))}
          </>
        )}
      </div>

      {/* ═══ TOP PARTNERS ═══ */}
      <div className="card">
        <div className="px-6 py-4 border-b border-[var(--app-border)]">
          <div className="font-body font-semibold text-sm">Top Partners by Commission</div>
        </div>
        {topPartners.length === 0 ? (
          <div className="p-8 text-center">
            <div className="font-body text-sm text-[var(--app-text-muted)]">No partner data yet.</div>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-[0.3fr_1.5fr_0.6fr_0.6fr_0.8fr_0.8fr] gap-4 px-6 py-3 border-b border-[var(--app-border)]">
              {["#", "Partner", "Code", "Deals", "Pipeline", "Commission"].map((h) => (
                <div key={h} className="font-body text-[10px] tracking-[1px] uppercase text-[var(--app-text-muted)]">{h}</div>
              ))}
            </div>
            {topPartners.map((p, i) => (
              <div key={p.code} className="grid grid-cols-[0.3fr_1.5fr_0.6fr_0.6fr_0.8fr_0.8fr] gap-4 px-6 py-3.5 border-b border-[var(--app-border)] last:border-b-0 items-center hover:bg-[var(--app-card-bg)] transition-colors">
                <div className={`font-display text-sm font-bold ${i === 0 ? "text-yellow-400" : i === 1 ? "text-gray-300" : i === 2 ? "text-orange-400" : "text-[var(--app-text-muted)]"}`}>
                  {i + 1}
                </div>
                <div className="font-body text-[13px] text-[var(--app-text)]">{p.name}</div>
                <div className="font-body text-[11px] text-[var(--app-text-muted)] tracking-wider">{p.code}</div>
                <div className="font-body text-[13px] text-[var(--app-text-secondary)]">{p.deals}</div>
                <div className="font-body text-[13px] text-[var(--app-text-secondary)]">{fmt$(p.pipeline)}</div>
                <div className="font-display text-[14px] font-semibold text-brand-gold">{fmt$(p.commission)}</div>
              </div>
            ))}
          </>
        )}
      </div>
    </div>
  );
}
