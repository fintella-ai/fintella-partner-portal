"use client";

import { useState, useEffect, useCallback } from "react";

interface WidgetReferralRow {
  id: string;
  partner: { firstName: string; lastName: string; partnerCode: string };
  widgetSession: { platform: string };
  clientCompanyName: string;
  clientContactName: string;
  clientEmail: string;
  clientPhone: string | null;
  estimatedImportValue: string | null;
  htsCodes: string[];
  tmsReference: string | null;
  status: string;
  notes: string | null;
  createdAt: string;
}

const STATUS_OPTIONS = ["submitted", "contacted", "qualified", "converted", "rejected"];
const STATUS_COLORS: Record<string, string> = {
  submitted: "bg-blue-100 text-blue-700",
  contacted: "bg-yellow-100 text-yellow-700",
  qualified: "bg-purple-100 text-purple-700",
  converted: "bg-green-100 text-green-700",
  rejected: "bg-red-100 text-red-700",
};

export default function AdminWidgetReferralsPage() {
  const [referrals, setReferrals] = useState<WidgetReferralRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");
  const [detail, setDetail] = useState<WidgetReferralRow | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/widget-referrals");
      const data = await res.json();
      setReferrals(data.referrals || []);
    } catch {}
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const updateStatus = async (id: string, status: string) => {
    await fetch(`/api/admin/widget-referrals/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    load();
  };

  const filtered = filter === "all" ? referrals : referrals.filter((r) => r.status === filter);

  return (
    <div className="max-w-7xl mx-auto p-4 md:p-6 space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-2xl font-bold text-[var(--app-text)]">Widget Referrals</h1>
          <p className="text-sm text-[var(--app-text-muted)]">
            {referrals.length} total · {referrals.filter((r) => r.status === "submitted").length} pending
          </p>
        </div>
        <div className="flex gap-1 flex-wrap">
          {["all", ...STATUS_OPTIONS].map((s) => (
            <button
              key={s}
              onClick={() => setFilter(s)}
              className={`px-2 py-1 text-xs rounded ${
                filter === s ? "bg-amber-100 text-amber-700 font-medium" : "bg-[var(--app-bg-secondary)] text-[var(--app-text-muted)]"
              }`}
            >
              {s === "all" ? "All" : s.charAt(0).toUpperCase() + s.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="text-center py-12 text-[var(--app-text-muted)]">Loading...</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 text-[var(--app-text-muted)]">No widget referrals found.</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--app-border)]">
                <th className="text-left py-2 px-2 text-xs text-[var(--app-text-muted)]">Partner</th>
                <th className="text-left py-2 px-2 text-xs text-[var(--app-text-muted)]">Client</th>
                <th className="text-left py-2 px-2 text-xs text-[var(--app-text-muted)]">Email</th>
                <th className="text-left py-2 px-2 text-xs text-[var(--app-text-muted)]">Est. Value</th>
                <th className="text-left py-2 px-2 text-xs text-[var(--app-text-muted)]">Platform</th>
                <th className="text-left py-2 px-2 text-xs text-[var(--app-text-muted)]">Status</th>
                <th className="text-left py-2 px-2 text-xs text-[var(--app-text-muted)]">Date</th>
                <th className="text-right py-2 px-2 text-xs text-[var(--app-text-muted)]">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => (
                <tr key={r.id} className="border-b border-[var(--app-border)] hover:bg-[var(--app-bg-secondary)]">
                  <td className="py-2 px-2 text-[var(--app-text)]">
                    {r.partner.firstName} {r.partner.lastName}
                    <span className="text-[10px] text-[var(--app-text-muted)] ml-1">({r.partner.partnerCode})</span>
                  </td>
                  <td className="py-2 px-2 font-medium text-[var(--app-text)]">{r.clientCompanyName}</td>
                  <td className="py-2 px-2 text-[var(--app-text-muted)]">{r.clientEmail}</td>
                  <td className="py-2 px-2 text-[var(--app-text-muted)]">{r.estimatedImportValue || "—"}</td>
                  <td className="py-2 px-2 capitalize text-[var(--app-text-muted)]">{r.widgetSession.platform}</td>
                  <td className="py-2 px-2">
                    <select
                      value={r.status}
                      onChange={(e) => updateStatus(r.id, e.target.value)}
                      className={`text-xs px-1.5 py-0.5 rounded border-0 cursor-pointer ${STATUS_COLORS[r.status] || ""}`}
                    >
                      {STATUS_OPTIONS.map((s) => (
                        <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
                      ))}
                    </select>
                  </td>
                  <td className="py-2 px-2 text-xs text-[var(--app-text-muted)]">
                    {new Date(r.createdAt).toLocaleDateString()}
                  </td>
                  <td className="py-2 px-2 text-right">
                    <button onClick={() => setDetail(r)} className="text-xs text-amber-600 hover:text-amber-700">
                      Details
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Detail modal */}
      {detail && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[var(--app-bg-secondary)] rounded-xl max-w-lg w-full p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-[var(--app-text)]">{detail.clientCompanyName}</h2>
              <button onClick={() => setDetail(null)} className="text-[var(--app-text-muted)] hover:text-[var(--app-text)]">✕</button>
            </div>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <span className="text-xs text-[var(--app-text-muted)]">Contact</span>
                <p className="text-[var(--app-text)]">{detail.clientContactName}</p>
              </div>
              <div>
                <span className="text-xs text-[var(--app-text-muted)]">Email</span>
                <p className="text-[var(--app-text)]">{detail.clientEmail}</p>
              </div>
              <div>
                <span className="text-xs text-[var(--app-text-muted)]">Phone</span>
                <p className="text-[var(--app-text)]">{detail.clientPhone || "—"}</p>
              </div>
              <div>
                <span className="text-xs text-[var(--app-text-muted)]">Est. Value</span>
                <p className="text-[var(--app-text)]">{detail.estimatedImportValue || "—"}</p>
              </div>
              <div>
                <span className="text-xs text-[var(--app-text-muted)]">TMS Reference</span>
                <p className="text-[var(--app-text)]">{detail.tmsReference || "—"}</p>
              </div>
              <div>
                <span className="text-xs text-[var(--app-text-muted)]">Platform</span>
                <p className="text-[var(--app-text)] capitalize">{detail.widgetSession.platform}</p>
              </div>
              <div className="col-span-2">
                <span className="text-xs text-[var(--app-text-muted)]">HTS Codes</span>
                <p className="text-[var(--app-text)]">{detail.htsCodes.length > 0 ? detail.htsCodes.join(", ") : "—"}</p>
              </div>
              <div className="col-span-2">
                <span className="text-xs text-[var(--app-text-muted)]">Partner</span>
                <p className="text-[var(--app-text)]">{detail.partner.firstName} {detail.partner.lastName} ({detail.partner.partnerCode})</p>
              </div>
              {detail.notes && (
                <div className="col-span-2">
                  <span className="text-xs text-[var(--app-text-muted)]">Notes</span>
                  <p className="text-[var(--app-text)]">{detail.notes}</p>
                </div>
              )}
            </div>
            <div className="pt-2 border-t border-[var(--app-border)]">
              <p className="text-xs text-[var(--app-text-muted)]">ID: {detail.id}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
