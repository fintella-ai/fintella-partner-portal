"use client";

import { useCallback, useEffect, useState } from "react";
import { fmtDateTime } from "@/lib/format";
import TablePagination from "@/components/ui/TablePagination";

const PIPELINE_STAGES = [
  { value: "all", label: "All" },
  { value: "pending", label: "Pending" },
  { value: "lead_submitted", label: "Lead Submitted" },
  { value: "meeting_booked", label: "Meeting Booked" },
  { value: "meeting_missed", label: "Meeting Missed" },
  { value: "qualified", label: "Qualified" },
  { value: "disqualified", label: "Disqualified" },
  { value: "agreement_sent", label: "Agreement Sent" },
  { value: "client_engaged", label: "Agreement Signed" },
  { value: "in_process", label: "In Process" },
  { value: "unresponsive", label: "Unresponsive" },
  { value: "closedwon", label: "Closed Won" },
];

const EDITABLE_STAGES = PIPELINE_STAGES.filter((s) => s.value !== "all");

interface Submission {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string | null;
  title: string | null;
  companyName: string;
  city: string | null;
  state: string | null;
  ein: string | null;
  businessEntityType: string | null;
  partnerCode: string | null;
  estimatedDuties: number | null;
  estimatedRefund: number | null;
  importCategory: string | null;
  annualImportValue: string | null;
  importsGoods: string | null;
  importCountries: string | null;
  importerOfRecord: string | null;
  isImporterOfRecord: boolean;
  serviceOfInterest: string | null;
  affiliateNotes: string | null;
  entryPeriod: string | null;
  dealId: string | null;
  dealStage: string | null;
  source: string;
  utmSource?: string | null;
  utmCampaign?: string | null;
  utmMedium?: string | null;
  utmTerm?: string | null;
  utmAdGroup?: string | null;
  qualified: boolean;
  disqualifyReason: string | null;
  meetingBookedAt: string | null;
  meetingStartTime: string | null;
  meetingEndTime: string | null;
  meetingUri: string | null;
  createdAt: string;
}

interface Stats {
  total: number;
  linked: number;
  unlinked: number;
  byStage: Record<string, number>;
  byPartner: Record<string, number>;
  bySource: Record<string, number>;
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

function fmt$(n: number | null): string {
  if (n == null || n === 0) return "—";
  return `$${n.toLocaleString()}`;
}

const inputClass = "bg-[var(--app-input-bg)] border border-[var(--app-input-border)] rounded-lg px-3 py-2 text-[var(--app-text)] font-body text-[12px] outline-none focus:border-brand-gold/40 transition-colors";

export default function ClientSubmissionsTab() {
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [stageFilter, setStageFilter] = useState("all");
  const [sourceFilter, setSourceFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // Expanded detail
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Record<string, string>>({});
  const [editStage, setEditStage] = useState("pending");
  const [editQualified, setEditQualified] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/client-submissions");
      if (res.ok) {
        const data = await res.json();
        setSubmissions(data.submissions || []);
        setStats(data.stats || null);
      }
    } catch {} finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const toggleExpand = (sub: Submission) => {
    if (expandedId === sub.id) {
      setExpandedId(null);
      return;
    }
    setExpandedId(sub.id);
    setEditStage(sub.dealStage || "pending");
    setEditQualified(sub.qualified);
    setEditForm({
      firstName: sub.firstName || "",
      lastName: sub.lastName || "",
      email: sub.email || "",
      phone: sub.phone || "",
      title: sub.title || "",
      companyName: sub.companyName || "",
      city: sub.city || "",
      state: sub.state || "",
      ein: sub.ein || "",
      businessEntityType: sub.businessEntityType || "",
      importsGoods: sub.importsGoods || "",
      importCountries: sub.importCountries || "",
      annualImportValue: sub.annualImportValue || "",
      importerOfRecord: sub.importerOfRecord || "",
      serviceOfInterest: sub.serviceOfInterest || "",
      importCategory: sub.importCategory || "",
      estimatedDuties: sub.estimatedDuties != null ? String(sub.estimatedDuties) : "",
      estimatedRefund: sub.estimatedRefund != null ? String(sub.estimatedRefund) : "",
      entryPeriod: sub.entryPeriod || "",
      affiliateNotes: sub.affiliateNotes || "",
      partnerCode: sub.partnerCode || "",
    });
  };

  const setField = (key: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    setEditForm((prev) => ({ ...prev, [key]: e.target.value }));
  };

  const handleSave = async (id: string) => {
    setSaving(true);
    try {
      const parseNum = (s: string): number | null => {
        const cleaned = s.replace(/[,$\s]/g, "");
        if (!cleaned) return null;
        const n = parseFloat(cleaned);
        return isNaN(n) ? null : n;
      };
      await fetch(`/api/admin/client-submissions/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...editForm,
          estimatedDuties: parseNum(editForm.estimatedDuties || ""),
          estimatedRefund: parseNum(editForm.estimatedRefund || ""),
          dealStage: editStage,
          qualified: editQualified,
        }),
      });
      setExpandedId(null);
      load();
    } catch {} finally { setSaving(false); }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Delete submission from "${name}"? This cannot be undone.`)) return;
    setDeleting(true);
    try {
      await fetch(`/api/admin/client-submissions/${id}`, { method: "DELETE" });
      setExpandedId(null);
      load();
    } catch {} finally { setDeleting(false); }
  };

  if (loading) return <div className="text-center py-12 font-body text-sm text-[var(--app-text-muted)]">Loading client submissions...</div>;

  return (
    <div>
      {/* Pipeline stage tabs */}
      <div className="mb-4 border-b border-[var(--app-border)] overflow-x-auto">
        <div className="flex gap-1 min-w-max">
          {PIPELINE_STAGES.map((s) => {
            const count = s.value === "all"
              ? submissions.length
              : submissions.filter((sub) => (sub.dealStage || "pending") === s.value).length;
            const active = stageFilter === s.value;
            return (
              <button
                key={s.value}
                onClick={() => { setStageFilter(s.value); setPage(1); }}
                className={`font-body text-[12px] px-3 py-2 rounded-t-lg border border-b-0 transition-colors whitespace-nowrap min-h-[36px] ${
                  active
                    ? "text-brand-gold border-[var(--app-border)] bg-[var(--app-card-bg)] -mb-px font-semibold"
                    : "text-[var(--app-text-muted)] border-transparent hover:text-[var(--app-text-secondary)] hover:bg-brand-gold/5"
                }`}
              >
                {s.label}
                <span className={`ml-1.5 text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${active ? "bg-brand-gold/20 text-brand-gold" : "bg-[var(--app-input-bg)] text-[var(--app-text-muted)]"}`}>
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Search + Source Filter */}
      <div className="mb-4 flex gap-3">
        <input
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          placeholder="Search by name, email, company, partner code..."
          className="flex-1 bg-[var(--app-input-bg)] border border-[var(--app-input-border)] rounded-lg px-4 py-2.5 text-[var(--app-text)] font-body text-sm outline-none focus:border-brand-gold/40 transition-colors placeholder:text-[var(--app-text-muted)]"
        />
        <select
          value={sourceFilter}
          onChange={(e) => { setSourceFilter(e.target.value); setPage(1); }}
          className="bg-[var(--app-input-bg)] border border-[var(--app-input-border)] rounded-lg px-3 py-2.5 text-sm text-[var(--app-text)]"
        >
          <option value="all">All Sources</option>
          <option value="google">Google Ads</option>
          <option value="meta">Meta Ads</option>
          <option value="linkedin">LinkedIn</option>
          <option value="email">Email</option>
          <option value="direct">Direct</option>
        </select>
      </div>

      {(() => {
        const filtered = submissions
          .filter((s) => stageFilter === "all" || (s.dealStage || "pending") === stageFilter)
          .filter((s) => sourceFilter === "all" || (s.utmSource || "direct") === sourceFilter)
          .filter((s) => {
            if (!search) return true;
            const q = search.toLowerCase();
            return (
              s.firstName.toLowerCase().includes(q) ||
              s.lastName.toLowerCase().includes(q) ||
              s.email.toLowerCase().includes(q) ||
              s.companyName.toLowerCase().includes(q) ||
              (s.partnerCode || "").toLowerCase().includes(q)
            );
          });

        const paginated = filtered.slice((page - 1) * pageSize, page * pageSize);

        return filtered.length === 0 ? (
        <div className="card p-12 text-center">
          <div className="text-5xl mb-3">📊</div>
          <h3 className="text-lg font-semibold mb-1">{search || stageFilter !== "all" ? "No submissions match this filter" : "No client submissions yet"}</h3>
          <p className="text-sm text-[var(--app-text-muted)]">Submissions from /recover will appear here with deal sync status.</p>
        </div>
      ) : (
        <div className="card overflow-x-auto">
          <div className="font-body text-[12px] text-[var(--app-text-muted)] px-4 py-2 border-b border-[var(--app-border)]">
            Showing {filtered.length} submission{filtered.length !== 1 ? "s" : ""}{stageFilter !== "all" ? ` in ${PIPELINE_STAGES.find((s) => s.value === stageFilter)?.label}` : ""}
          </div>
          <table className="w-full text-left font-body text-sm">
            <thead>
              <tr className="border-b border-[var(--app-border)] text-[var(--app-text-muted)] text-xs uppercase tracking-wider">
                <th className="px-4 py-3 text-center">Client</th>
                <th className="px-4 py-3 text-center">Company</th>
                <th className="px-4 py-3 text-center">Location</th>
                <th className="px-4 py-3 text-center">Est. Refund</th>
                <th className="px-4 py-3 text-center">Partner</th>
                <th className="px-4 py-3 text-center">Source</th>
                <th className="px-4 py-3 text-center">Deal Stage</th>
                <th className="px-4 py-3 text-center">Match</th>
                <th className="px-4 py-3 text-center">Date</th>
              </tr>
            </thead>
            <tbody>
              {paginated.map((s) => (
                <>
                <tr
                  key={s.id}
                  onClick={() => toggleExpand(s)}
                  className={`border-b border-[var(--app-border-subtle)] hover:bg-[var(--app-hover)] transition cursor-pointer ${expandedId === s.id ? "bg-[var(--app-hover)]" : ""}`}
                >
                  <td className="px-4 py-3">
                    <div className="font-medium text-[13px]">{s.firstName} {s.lastName}</div>
                    <div className="text-[11px] text-[var(--app-text-muted)]">{s.email}</div>
                    {s.phone && <div className="text-[10px] text-[var(--app-text-faint)]">{s.phone}</div>}
                  </td>
                  <td className="px-4 py-3 text-center text-[12px] text-[var(--app-text-secondary)]">{s.companyName}</td>
                  <td className="px-4 py-3 text-center text-[12px] text-[var(--app-text-secondary)]">
                    {s.city && s.state ? `${s.city}, ${s.state}` : s.state || "—"}
                  </td>
                  <td className="px-4 py-3 text-center text-[13px] text-green-400 font-semibold">{fmt$(s.estimatedRefund)}</td>
                  <td className="px-4 py-3 text-center text-[12px] font-mono text-[var(--app-text-secondary)]">{s.partnerCode || "Direct"}</td>
                  <td className="px-4 py-3 text-center">
                    <div className="text-[12px] text-[var(--app-text-secondary)] capitalize">{s.utmSource || "direct"}</div>
                    {s.utmCampaign && (
                      <div className="text-[10px] text-[var(--app-text-muted)]">{s.utmCampaign}</div>
                    )}
                  </td>
                  <td className="px-4 py-3 text-center">
                    {s.dealStage ? (
                      <span className={`inline-block rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase border ${STAGE_COLORS[s.dealStage] || STAGE_COLORS.pending}`}>
                        {s.dealStage.replace(/_/g, " ")}
                      </span>
                    ) : (
                      <span className={`inline-block rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase border ${STAGE_COLORS.pending}`}>
                        Pending
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-center">
                    {s.dealId ? (
                      <span className="inline-block rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase bg-green-500/10 text-green-400 border border-green-500/20">
                        Matched
                      </span>
                    ) : (
                      <span className="inline-block rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase bg-amber-500/10 text-amber-400 border border-amber-500/20">
                        Not Found
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-center text-[12px] text-[var(--app-text-muted)] whitespace-nowrap">{fmtDateTime(s.createdAt)}</td>
                </tr>

                {/* Expanded detail panel */}
                {expandedId === s.id && (
                  <tr key={`${s.id}-detail`}>
                    <td colSpan={9} className="p-0">
                      <div className="px-5 py-4 bg-[var(--app-card-bg)] border-b border-[var(--app-border)]">

                        {/* Submission ID + Deal Link */}
                        <div className="flex items-center gap-4 mb-4">
                          <div className="p-2.5 rounded-lg flex-1" style={{ background: "var(--app-input-bg)", border: "1px solid var(--app-border)" }}>
                            <div className="font-body text-[10px] text-[var(--app-text-muted)] uppercase tracking-wider">Submission ID</div>
                            <div className="font-mono text-[12px] text-[var(--app-text)] mt-0.5 select-all">{s.id}</div>
                          </div>
                          {s.dealId && (
                            <a
                              href={`/admin/deals?deal=${s.dealId}`}
                              className="p-2.5 rounded-lg flex-1 hover:opacity-80 transition"
                              style={{ background: "var(--app-gold-overlay)", border: "1px solid var(--app-gold-overlay-border)" }}
                            >
                              <div className="font-body text-[10px] text-yellow-500/80 uppercase tracking-wider">Linked Deal</div>
                              <div className="font-mono text-[12px] text-brand-gold mt-0.5">View Deal →</div>
                            </a>
                          )}
                        </div>

                        {/* Meeting Info */}
                        {s.meetingStartTime && (
                          <div className="mb-4 p-3 rounded-lg flex items-center gap-4" style={{ background: "var(--app-gold-overlay)", border: "1px solid var(--app-gold-overlay-border)" }}>
                            <div>
                              <div className="font-body text-[10px] text-yellow-500/80 uppercase tracking-wider">Meeting Booked</div>
                              <div className="font-body text-[13px] text-[var(--app-text)] mt-0.5">
                                {new Date(s.meetingStartTime).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric" })}
                              </div>
                            </div>
                            <div>
                              <div className="font-body text-[10px] text-yellow-500/80 uppercase tracking-wider">Time</div>
                              <div className="font-body text-[13px] text-[var(--app-text)] mt-0.5">
                                {new Date(s.meetingStartTime).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}
                                {s.meetingEndTime && ` – ${new Date(s.meetingEndTime).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}`}
                              </div>
                            </div>
                            {s.meetingUri && (
                              <a href={s.meetingUri} target="_blank" rel="noopener noreferrer" className="ml-auto text-[11px] text-brand-gold hover:underline">
                                Calendly →
                              </a>
                            )}
                          </div>
                        )}

                        {/* Deal Stage */}
                        <div className="mb-4 pb-4 border-b border-[var(--app-border)]">
                          <div className="font-body text-[11px] text-[var(--app-text-muted)] uppercase tracking-wider mb-3">Deal Stage</div>
                          <div className="flex flex-wrap gap-2">
                            {EDITABLE_STAGES.map((st) => (
                              <button
                                key={st.value}
                                onClick={() => setEditStage(st.value)}
                                className={`px-3 py-1.5 rounded-lg text-[11px] font-semibold border transition-all ${
                                  editStage === st.value
                                    ? STAGE_COLORS[st.value] || STAGE_COLORS.pending
                                    : "border-[var(--app-border)] text-[var(--app-text-muted)] hover:border-[var(--app-text-faint)]"
                                }`}
                              >
                                {st.label}
                              </button>
                            ))}
                          </div>
                          {/* Qualification toggle */}
                          <div className="flex gap-2 mt-3">
                            <button
                              onClick={() => setEditQualified(true)}
                              className={`flex-1 px-3 py-2 rounded text-xs font-medium border transition-all ${
                                editQualified
                                  ? "border-emerald-500/50 bg-emerald-500/10 text-emerald-400"
                                  : "border-[var(--app-border)] bg-transparent text-[var(--app-text-muted)]"
                              }`}
                            >
                              Qualified
                            </button>
                            <button
                              onClick={() => setEditQualified(false)}
                              className={`flex-1 px-3 py-2 rounded text-xs font-medium border transition-all ${
                                !editQualified
                                  ? "border-red-500/50 bg-red-500/10 text-red-400"
                                  : "border-[var(--app-border)] bg-transparent text-[var(--app-text-muted)]"
                              }`}
                            >
                              Disqualified
                            </button>
                          </div>
                        </div>

                        {/* Client Details */}
                        <div className="mb-4 pb-4 border-b border-[var(--app-border)]">
                          <div className="font-body text-[11px] text-[var(--app-text-muted)] uppercase tracking-wider mb-3">Client Details</div>
                          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-x-4 gap-y-3">
                            {([
                              { label: "First Name", key: "firstName" },
                              { label: "Last Name", key: "lastName" },
                              { label: "Email", key: "email" },
                              { label: "Phone", key: "phone" },
                              { label: "Title", key: "title" },
                              { label: "Company", key: "companyName" },
                              { label: "City", key: "city" },
                              { label: "State", key: "state" },
                              { label: "EIN", key: "ein" },
                              { label: "Entity Type", key: "businessEntityType" },
                            ]).map((f) => (
                              <div key={f.key}>
                                <label className="font-body text-[10px] text-[var(--app-text-muted)] uppercase tracking-wider block mb-1">{f.label}</label>
                                <input className={`${inputClass} w-full`} value={editForm[f.key] || ""} onChange={setField(f.key)} placeholder="—" />
                              </div>
                            ))}
                          </div>
                        </div>

                        {/* Import Details */}
                        <div className="mb-4 pb-4 border-b border-[var(--app-border)]">
                          <div className="font-body text-[11px] text-[var(--app-text-muted)] uppercase tracking-wider mb-3">Import Details</div>
                          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-x-4 gap-y-3">
                            {([
                              { label: "Service of Interest", key: "serviceOfInterest" },
                              { label: "Imports Goods to U.S.", key: "importsGoods" },
                              { label: "Import Countries", key: "importCountries" },
                              { label: "Annual Import Value", key: "annualImportValue" },
                              { label: "Importer of Record", key: "importerOfRecord" },
                              { label: "Import Category", key: "importCategory" },
                              { label: "Entry Period", key: "entryPeriod" },
                            ]).map((f) => (
                              <div key={f.key}>
                                <label className="font-body text-[10px] text-[var(--app-text-muted)] uppercase tracking-wider block mb-1">{f.label}</label>
                                <input className={`${inputClass} w-full`} value={editForm[f.key] || ""} onChange={setField(f.key)} placeholder="—" />
                              </div>
                            ))}
                          </div>
                        </div>

                        {/* Financial Details */}
                        <div className="mb-4 pb-4 border-b border-[var(--app-border)]">
                          <div className="font-body text-[11px] text-[var(--app-text-muted)] uppercase tracking-wider mb-3">Financial Details</div>
                          <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-3">
                            <div>
                              <label className="font-body text-[10px] text-[var(--app-text-muted)] uppercase tracking-wider block mb-1">Estimated Duties ($)</label>
                              <input className={`${inputClass} w-full`} value={editForm.estimatedDuties || ""} onChange={setField("estimatedDuties")} placeholder="0" />
                            </div>
                            <div>
                              <label className="font-body text-[10px] text-[var(--app-text-muted)] uppercase tracking-wider block mb-1">Estimated Refund ($)</label>
                              <input className={`${inputClass} w-full`} value={editForm.estimatedRefund || ""} onChange={setField("estimatedRefund")} placeholder="0" />
                            </div>
                            <div>
                              <label className="font-body text-[10px] text-[var(--app-text-muted)] uppercase tracking-wider block mb-1">Partner Code</label>
                              <input className={`${inputClass} w-full font-mono`} value={editForm.partnerCode || ""} onChange={setField("partnerCode")} placeholder="—" />
                            </div>
                          </div>
                        </div>

                        {/* UTM Attribution (read-only) */}
                        {(s.utmSource || s.utmCampaign || s.utmMedium || s.utmTerm) && (
                          <div className="mb-4 pb-4 border-b border-[var(--app-border)]">
                            <div className="font-body text-[11px] text-[var(--app-text-muted)] uppercase tracking-wider mb-3">UTM Attribution</div>
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-4 gap-y-2">
                              {([
                                { label: "Source", value: s.utmSource },
                                { label: "Medium", value: s.utmMedium },
                                { label: "Campaign", value: s.utmCampaign },
                                { label: "Term", value: s.utmTerm },
                                { label: "Ad Group", value: s.utmAdGroup },
                              ]).filter(u => u.value).map((u) => (
                                <div key={u.label}>
                                  <div className="font-body text-[10px] text-[var(--app-text-muted)] uppercase tracking-wider">{u.label}</div>
                                  <div className="font-body text-[12px] text-[var(--app-text-secondary)] mt-0.5">{u.value}</div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Notes */}
                        <div className="mb-4">
                          <label className="font-body text-[10px] text-[var(--app-text-muted)] uppercase tracking-wider block mb-1">Notes</label>
                          <textarea
                            className={`${inputClass} w-full min-h-[80px] resize-y`}
                            value={editForm.affiliateNotes || ""}
                            onChange={setField("affiliateNotes")}
                            placeholder="Add notes about this submission..."
                          />
                        </div>

                        {/* Action buttons */}
                        <div className="flex items-center gap-3">
                          <button
                            onClick={() => handleSave(s.id)}
                            disabled={saving}
                            className="px-5 py-2.5 rounded-lg font-body text-[12px] font-semibold text-black disabled:opacity-50 transition-colors"
                            style={{ background: "var(--brand-gold)" }}
                          >
                            {saving ? "Saving..." : "Save Changes"}
                          </button>
                          <button
                            onClick={() => setExpandedId(null)}
                            className="font-body text-[11px] text-[var(--app-text-muted)] border border-[var(--app-border)] rounded-lg px-4 py-2 hover:text-[var(--app-text-secondary)] transition-colors"
                          >
                            Cancel
                          </button>
                          <div className="flex-1" />
                          <button
                            onClick={() => handleDelete(s.id, `${s.firstName} ${s.lastName}`)}
                            disabled={deleting}
                            className="font-body text-[11px] text-red-400 border border-red-500/20 rounded-lg px-4 py-2 hover:bg-red-500/10 transition-colors disabled:opacity-50"
                          >
                            {deleting ? "Deleting..." : "Delete"}
                          </button>
                        </div>
                      </div>
                    </td>
                  </tr>
                )}
                </>
              ))}
            </tbody>
          </table>
          <TablePagination
            page={page}
            pageSize={pageSize}
            totalItems={filtered.length}
            onPageChange={setPage}
            onPageSizeChange={setPageSize}
          />
        </div>
      );
      })()}
    </div>
  );
}
