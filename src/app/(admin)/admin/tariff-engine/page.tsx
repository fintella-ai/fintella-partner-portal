"use client";

import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import { fmt$, fmtDate } from "@/lib/format";

/* ────────────── Types ────────────── */

type Dossier = {
  id: string;
  clientCompany: string;
  clientContact: string | null;
  clientEmail: string | null;
  status: string;
  source: string;
  totalEstRefund: number | null;
  entryCount: number;
  urgentCount: number;
  nearestDeadline: string | null;
  partnerName: string | null;
  partnerId: string | null;
  createdAt: string;
  _count: { entries: number };
};

type IeepaRate = {
  id: string;
  executiveOrder: string;
  name: string;
  rateType: string;
  countryCode: string;
  countryName: string;
  rate: number;
  effectiveDate: string;
  endDate: string | null;
  htsChapter99: string | null;
  isSeeded: boolean;
  createdAt: string;
};

type Deadline = {
  id: string;
  dossierId: string;
  clientCompany: string;
  partnerName: string | null;
  countryOfOrigin: string;
  deadlineDays: number;
  deadlineDate: string | null;
  entryNumber: string | null;
  estimatedRefund: number;
};

const STATUSES: { value: string; label: string; color: string }[] = [
  { value: "draft", label: "Draft", color: "bg-gray-600" },
  { value: "analyzing", label: "Analyzing", color: "bg-blue-600" },
  { value: "ready", label: "Ready", color: "bg-green-600" },
  { value: "submitted", label: "Submitted", color: "bg-yellow-600" },
  { value: "converted", label: "Converted", color: "bg-purple-600" },
];

const RATE_TYPES = [
  { value: "", label: "All Types" },
  { value: "fentanyl", label: "Fentanyl" },
  { value: "reciprocal", label: "Reciprocal" },
  { value: "section122", label: "Section 122" },
];

/* ────────────── Page ────────────── */

export default function AdminTariffEnginePage() {
  const { data: session } = useSession();
  const role = (session?.user as any)?.role;
  const canEdit = ["super_admin", "admin"].includes(role);

  const [tab, setTab] = useState<"pipeline" | "rates" | "deadlines">("pipeline");

  // ── Dossier state ──
  const [dossiers, setDossiers] = useState<Dossier[]>([]);
  const [dossiersLoading, setDossiersLoading] = useState(true);

  // ── Rate state ──
  const [rates, setRates] = useState<IeepaRate[]>([]);
  const [ratesLoading, setRatesLoading] = useState(true);
  const [rateFilter, setRateFilter] = useState("");
  const [showAddRate, setShowAddRate] = useState(false);
  const [newRate, setNewRate] = useState({
    executiveOrder: "",
    name: "",
    rateType: "reciprocal",
    countryCode: "",
    countryName: "",
    rate: "",
    effectiveDate: "",
    endDate: "",
    htsChapter99: "",
    notes: "",
  });
  const [addingRate, setAddingRate] = useState(false);

  // ── Deadline state ──
  const [deadlines, setDeadlines] = useState<Deadline[]>([]);
  const [deadlinesLoading, setDeadlinesLoading] = useState(true);

  /* ── Fetch dossiers ── */
  const fetchDossiers = useCallback(async () => {
    setDossiersLoading(true);
    try {
      const res = await fetch("/api/admin/tariff/dossiers");
      const data = await res.json();
      setDossiers(data.dossiers || []);
    } catch { /* noop */ }
    setDossiersLoading(false);
  }, []);

  /* ── Fetch rates ── */
  const fetchRates = useCallback(async () => {
    setRatesLoading(true);
    try {
      const params = new URLSearchParams();
      if (rateFilter) params.set("rateType", rateFilter);
      const res = await fetch(`/api/admin/tariff/rates?${params}`);
      const data = await res.json();
      setRates(data.rates || []);
    } catch { /* noop */ }
    setRatesLoading(false);
  }, [rateFilter]);

  /* ── Fetch deadlines ── */
  const fetchDeadlines = useCallback(async () => {
    setDeadlinesLoading(true);
    try {
      const res = await fetch("/api/admin/tariff/deadlines");
      const data = await res.json();
      setDeadlines(data.deadlines || []);
    } catch { /* noop */ }
    setDeadlinesLoading(false);
  }, []);

  useEffect(() => {
    if (tab === "pipeline") fetchDossiers();
    if (tab === "rates") fetchRates();
    if (tab === "deadlines") fetchDeadlines();
  }, [tab, fetchDossiers, fetchRates, fetchDeadlines]);

  /* ── Add rate handler ── */
  const handleAddRate = async () => {
    setAddingRate(true);
    try {
      const res = await fetch("/api/admin/tariff/rates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...newRate,
          rate: parseFloat(newRate.rate),
          endDate: newRate.endDate || undefined,
          htsChapter99: newRate.htsChapter99 || undefined,
          notes: newRate.notes || undefined,
        }),
      });
      if (res.ok) {
        setShowAddRate(false);
        setNewRate({
          executiveOrder: "",
          name: "",
          rateType: "reciprocal",
          countryCode: "",
          countryName: "",
          rate: "",
          effectiveDate: "",
          endDate: "",
          htsChapter99: "",
          notes: "",
        });
        fetchRates();
      }
    } catch { /* noop */ }
    setAddingRate(false);
  };

  /* ── Dossier pipeline groups ── */
  const grouped = STATUSES.map((s) => ({
    ...s,
    items: dossiers.filter((d) => d.status === s.value),
  }));

  /* ── Deadline row color ── */
  const deadlineBg = (days: number) => {
    if (days <= 7) return "bg-red-900/40 border-red-700/50";
    if (days <= 14) return "bg-yellow-900/30 border-yellow-700/50";
    return "bg-green-900/20 border-green-700/50";
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold theme-text">Tariff Intelligence Engine</h1>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 rounded-lg p-1 app-bg-secondary">
        {[
          { key: "pipeline" as const, label: "Dossier Pipeline" },
          { key: "rates" as const, label: "Rate Database" },
          { key: "deadlines" as const, label: "Deadline Alerts" },
        ].map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              tab === t.key
                ? "bg-blue-600 text-white"
                : "theme-text-secondary hover:theme-text"
            }`}
          >
            {t.label}
            {t.key === "deadlines" && deadlines.length > 0 && (
              <span className="ml-2 px-1.5 py-0.5 text-xs rounded-full bg-red-600 text-white">
                {deadlines.length}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* ════════════════ TAB 1: Dossier Pipeline ════════════════ */}
      {tab === "pipeline" && (
        <div>
          {dossiersLoading ? (
            <div className="text-center py-12 theme-text-secondary">Loading dossiers...</div>
          ) : dossiers.length === 0 ? (
            <div className="text-center py-12 theme-text-secondary">
              No dossiers yet. Dossiers are created when partners or brokers submit tariff intake data.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
              {grouped.map((col) => (
                <div key={col.value} className="space-y-3">
                  {/* Column header */}
                  <div className="flex items-center gap-2 px-2">
                    <span className={`w-2.5 h-2.5 rounded-full ${col.color}`} />
                    <span className="text-sm font-semibold theme-text">{col.label}</span>
                    <span className="text-xs theme-text-secondary">({col.items.length})</span>
                  </div>
                  {/* Cards */}
                  <div className="space-y-2 min-h-[120px]">
                    {col.items.length === 0 && (
                      <div className="text-xs theme-text-secondary text-center py-6 border border-dashed rounded-lg border-gray-700">
                        Empty
                      </div>
                    )}
                    {col.items.map((d) => (
                      <div
                        key={d.id}
                        className="rounded-lg p-3 app-bg-secondary border border-gray-700/50 hover:border-gray-600 transition-colors"
                      >
                        <div className="flex items-start justify-between mb-1">
                          <span className="text-sm font-medium theme-text truncate max-w-[160px]">
                            {d.clientCompany}
                          </span>
                          {d.urgentCount > 0 && (
                            <span className="px-1.5 py-0.5 text-[10px] font-bold rounded bg-red-600 text-white flex-shrink-0">
                              {d.urgentCount} urgent
                            </span>
                          )}
                        </div>
                        <div className="text-xs theme-text-secondary space-y-0.5">
                          <div>{d._count?.entries ?? d.entryCount} entries</div>
                          {d.totalEstRefund != null && (
                            <div className="text-green-400 font-medium">
                              Est. {fmt$(Number(d.totalEstRefund))}
                            </div>
                          )}
                          {d.partnerName && (
                            <div className="truncate">Partner: {d.partnerName}</div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ════════════════ TAB 2: Rate Database ════════════════ */}
      {tab === "rates" && (
        <div className="space-y-4">
          {/* Controls */}
          <div className="flex items-center gap-3 flex-wrap">
            <select
              value={rateFilter}
              onChange={(e) => setRateFilter(e.target.value)}
              className="rounded-md px-3 py-2 text-sm app-bg-secondary theme-text border border-gray-700"
            >
              {RATE_TYPES.map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
            {canEdit && (
              <button
                onClick={() => setShowAddRate(!showAddRate)}
                className="px-3 py-2 rounded-md text-sm bg-blue-600 text-white hover:bg-blue-500 transition-colors"
              >
                {showAddRate ? "Cancel" : "+ Add Rate"}
              </button>
            )}
          </div>

          {/* Add Rate Form */}
          {showAddRate && (
            <div className="rounded-lg p-4 app-bg-secondary border border-gray-700 space-y-3">
              <h3 className="text-sm font-semibold theme-text">Add Custom Rate</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <input
                  placeholder="Executive Order #"
                  value={newRate.executiveOrder}
                  onChange={(e) => setNewRate({ ...newRate, executiveOrder: e.target.value })}
                  className="rounded px-3 py-2 text-sm app-bg-primary theme-text border border-gray-700"
                />
                <input
                  placeholder="Name / Description"
                  value={newRate.name}
                  onChange={(e) => setNewRate({ ...newRate, name: e.target.value })}
                  className="rounded px-3 py-2 text-sm app-bg-primary theme-text border border-gray-700"
                />
                <select
                  value={newRate.rateType}
                  onChange={(e) => setNewRate({ ...newRate, rateType: e.target.value })}
                  className="rounded px-3 py-2 text-sm app-bg-primary theme-text border border-gray-700"
                >
                  <option value="fentanyl">Fentanyl</option>
                  <option value="reciprocal">Reciprocal</option>
                  <option value="section122">Section 122</option>
                </select>
                <input
                  placeholder="Country Code (e.g. CN)"
                  value={newRate.countryCode}
                  onChange={(e) => setNewRate({ ...newRate, countryCode: e.target.value.toUpperCase() })}
                  className="rounded px-3 py-2 text-sm app-bg-primary theme-text border border-gray-700"
                />
                <input
                  placeholder="Country Name"
                  value={newRate.countryName}
                  onChange={(e) => setNewRate({ ...newRate, countryName: e.target.value })}
                  className="rounded px-3 py-2 text-sm app-bg-primary theme-text border border-gray-700"
                />
                <input
                  placeholder="Rate (e.g. 0.145)"
                  type="number"
                  step="0.001"
                  value={newRate.rate}
                  onChange={(e) => setNewRate({ ...newRate, rate: e.target.value })}
                  className="rounded px-3 py-2 text-sm app-bg-primary theme-text border border-gray-700"
                />
                <input
                  type="date"
                  placeholder="Effective Date"
                  value={newRate.effectiveDate}
                  onChange={(e) => setNewRate({ ...newRate, effectiveDate: e.target.value })}
                  className="rounded px-3 py-2 text-sm app-bg-primary theme-text border border-gray-700"
                />
                <input
                  type="date"
                  placeholder="End Date (optional)"
                  value={newRate.endDate}
                  onChange={(e) => setNewRate({ ...newRate, endDate: e.target.value })}
                  className="rounded px-3 py-2 text-sm app-bg-primary theme-text border border-gray-700"
                />
                <input
                  placeholder="HTS Chapter 99 (optional)"
                  value={newRate.htsChapter99}
                  onChange={(e) => setNewRate({ ...newRate, htsChapter99: e.target.value })}
                  className="rounded px-3 py-2 text-sm app-bg-primary theme-text border border-gray-700"
                />
              </div>
              <textarea
                placeholder="Notes (optional)"
                value={newRate.notes}
                onChange={(e) => setNewRate({ ...newRate, notes: e.target.value })}
                rows={2}
                className="w-full rounded px-3 py-2 text-sm app-bg-primary theme-text border border-gray-700"
              />
              <button
                onClick={handleAddRate}
                disabled={addingRate || !newRate.executiveOrder || !newRate.countryCode || !newRate.rate || !newRate.effectiveDate}
                className="px-4 py-2 rounded-md text-sm bg-green-600 text-white hover:bg-green-500 disabled:opacity-50 transition-colors"
              >
                {addingRate ? "Saving..." : "Save Rate"}
              </button>
            </div>
          )}

          {/* Rate Table */}
          {ratesLoading ? (
            <div className="text-center py-12 theme-text-secondary">Loading rates...</div>
          ) : rates.length === 0 ? (
            <div className="text-center py-12 theme-text-secondary">No rates found.</div>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-gray-700">
              <table className="w-full text-sm">
                <thead>
                  <tr className="app-bg-secondary border-b border-gray-700">
                    <th className="text-left px-3 py-2 theme-text-secondary font-medium">Country</th>
                    <th className="text-left px-3 py-2 theme-text-secondary font-medium">Type</th>
                    <th className="text-right px-3 py-2 theme-text-secondary font-medium">Rate</th>
                    <th className="text-left px-3 py-2 theme-text-secondary font-medium">Effective</th>
                    <th className="text-left px-3 py-2 theme-text-secondary font-medium">End</th>
                    <th className="text-left px-3 py-2 theme-text-secondary font-medium">Executive Order</th>
                    <th className="text-left px-3 py-2 theme-text-secondary font-medium">Ch.99</th>
                  </tr>
                </thead>
                <tbody>
                  {rates.map((r) => (
                    <tr
                      key={r.id}
                      className={`border-b border-gray-800 hover:app-bg-secondary ${
                        r.isSeeded ? "opacity-70" : ""
                      }`}
                    >
                      <td className="px-3 py-2 theme-text">
                        {r.isSeeded && (
                          <span className="inline-block mr-1 text-gray-500" title="Seeded (read-only)">
                            <svg className="w-3 h-3 inline" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
                            </svg>
                          </span>
                        )}
                        {r.countryName} ({r.countryCode})
                      </td>
                      <td className="px-3 py-2 theme-text-secondary capitalize">{r.rateType}</td>
                      <td className="px-3 py-2 theme-text text-right font-mono">
                        {(Number(r.rate) * 100).toFixed(1)}%
                      </td>
                      <td className="px-3 py-2 theme-text-secondary">{fmtDate(r.effectiveDate)}</td>
                      <td className="px-3 py-2 theme-text-secondary">{r.endDate ? fmtDate(r.endDate) : "—"}</td>
                      <td className="px-3 py-2 theme-text-secondary text-xs">{r.executiveOrder}</td>
                      <td className="px-3 py-2 theme-text-secondary text-xs">{r.htsChapter99 || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ════════════════ TAB 3: Deadline Alerts ════════════════ */}
      {tab === "deadlines" && (
        <div>
          {deadlinesLoading ? (
            <div className="text-center py-12 theme-text-secondary">Loading deadlines...</div>
          ) : deadlines.length === 0 ? (
            <div className="text-center py-16">
              <svg className="w-12 h-12 mx-auto mb-3 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className="theme-text font-medium">No urgent deadlines</p>
              <p className="theme-text-secondary text-sm mt-1">All eligible entries have more than 30 days remaining.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {/* Table header */}
              <div className="grid grid-cols-6 gap-2 px-3 py-2 text-xs font-medium theme-text-secondary uppercase tracking-wide">
                <div>Client</div>
                <div>Partner</div>
                <div>Country</div>
                <div className="text-center">Days Left</div>
                <div>Deadline</div>
                <div>Entry #</div>
              </div>
              {/* Rows */}
              {deadlines.map((d) => (
                <div
                  key={d.id}
                  className={`grid grid-cols-6 gap-2 px-3 py-2.5 rounded-lg border text-sm ${deadlineBg(d.deadlineDays)}`}
                >
                  <div className="theme-text font-medium truncate">{d.clientCompany}</div>
                  <div className="theme-text-secondary truncate">{d.partnerName || "—"}</div>
                  <div className="theme-text-secondary">{d.countryOfOrigin}</div>
                  <div className="text-center font-bold">
                    <span
                      className={`inline-block px-2 py-0.5 rounded text-xs font-bold ${
                        d.deadlineDays <= 7
                          ? "bg-red-600 text-white"
                          : d.deadlineDays <= 14
                          ? "bg-yellow-600 text-white"
                          : "bg-green-700 text-white"
                      }`}
                    >
                      {d.deadlineDays}d
                    </span>
                  </div>
                  <div className="theme-text-secondary">{d.deadlineDate ? fmtDate(d.deadlineDate) : "—"}</div>
                  <div className="theme-text-secondary font-mono text-xs">{d.entryNumber || "—"}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
