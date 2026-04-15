"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { fmtDate } from "@/lib/format";

type Partner = {
  id: string;
  partnerCode: string;
  email: string;
  firstName: string;
  lastName: string;
  phone: string | null;
  mobilePhone: string | null;
  status: string;
  referredByPartnerCode: string | null;
  notes: string | null;
  signupDate: string;
  agreementStatus: string;
  w9Status: string;
};

type Invite = {
  id: string;
  token: string;
  invitedEmail: string | null;
  invitedName: string | null;
  commissionRate: number;
  status: string;
  targetTier: string;
  expiresAt: string;
  createdAt: string;
};

type TabType = "all" | "active" | "pending" | "invited" | "blocked";

// Normalize a stored mobile number to E.164 for the softphone Device.
// Accepts 10-digit US, 11-digit starting with 1, or already-E.164.
function normalizeForSoftphone(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (trimmed.startsWith("+") && /^\+[1-9]\d{6,14}$/.test(trimmed)) return trimmed;
  const digits = trimmed.replace(/\D/g, "");
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  return null;
}

const docBadge: Record<string, string> = {
  signed: "bg-green-500/10 text-green-400 border border-green-500/20",
  pending: "bg-yellow-500/10 text-yellow-400 border border-yellow-500/20",
  amended: "bg-orange-500/10 text-orange-400 border border-orange-500/20",
  not_sent: "bg-[var(--app-input-bg)] text-[var(--app-text-muted)] border border-[var(--app-border)]",
  none: "bg-red-500/10 text-red-400 border border-red-500/20",
  approved: "bg-green-500/10 text-green-400 border border-green-500/20",
  uploaded: "bg-blue-500/10 text-blue-400 border border-blue-500/20",
  under_review: "bg-yellow-500/10 text-yellow-400 border border-yellow-500/20",
  needed: "bg-red-500/10 text-red-400 border border-red-500/20",
};

const statusBadge: Record<string, string> = {
  active: "bg-green-500/10 text-green-400 border border-green-500/20",
  pending: "bg-yellow-500/10 text-yellow-400 border border-yellow-500/20",
  inactive: "bg-[var(--app-input-bg)] text-[var(--app-text-secondary)] border border-[var(--app-border)]",
  blocked: "bg-red-500/10 text-red-400 border border-red-500/20",
  invited: "bg-blue-500/10 text-blue-400 border border-blue-500/20",
};

const inviteStatusBadge: Record<string, string> = {
  active: "bg-blue-500/10 text-blue-400 border border-blue-500/20",
  used: "bg-green-500/10 text-green-400 border border-green-500/20",
  expired: "bg-[var(--app-input-bg)] text-[var(--app-text-muted)] border border-[var(--app-border)]",
};

export default function AdminPartnersPage() {
  const router = useRouter();
  const [partners, setPartners] = useState<Partner[]>([]);
  const [invites, setInvites] = useState<Invite[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [activeTab, setActiveTab] = useState<TabType>("all");
  const [showForm, setShowForm] = useState(false);

  // Add partner form
  const [formFirst, setFormFirst] = useState("");
  const [formLast, setFormLast] = useState("");
  const [formEmail, setFormEmail] = useState("");
  const [formPhone, setFormPhone] = useState("");
  const [formCode, setFormCode] = useState("");
  const [formReferrer, setFormReferrer] = useState("");
  const [formError, setFormError] = useState("");

  // Invite L1 partner modal
  const [showInvite, setShowInvite] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteFirst, setInviteFirst] = useState("");
  const [inviteLast, setInviteLast] = useState("");
  const [inviteRate, setInviteRate] = useState<number | "">(0.25);
  const [inviteError, setInviteError] = useState("");
  const [inviteResult, setInviteResult] = useState<{ signupUrl: string } | null>(null);
  const [inviteSending, setInviteSending] = useState(false);

  const ALLOWED_L1_RATES = [0.10, 0.15, 0.20, 0.25];

  const fetchPartners = useCallback(async () => {
    try {
      const url = search ? `/api/admin/partners?search=${encodeURIComponent(search)}` : "/api/admin/partners";
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        setPartners(data.partners || []);
      }
    } catch {} finally {
      setLoading(false);
    }
  }, [search]);

  const fetchInvites = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/invites");
      if (res.ok) {
        const data = await res.json();
        setInvites(data.invites || []);
      }
    } catch {}
  }, []);

  useEffect(() => { fetchPartners(); }, [fetchPartners]);
  useEffect(() => { fetchInvites(); }, [fetchInvites]);

  const handleInvite = async () => {
    setInviteError("");
    if (!inviteEmail.trim()) { setInviteError("Email is required."); return; }
    if (!inviteRate) { setInviteError("Commission rate is required."); return; }
    setInviteSending(true);
    try {
      const res = await fetch("/api/admin/invites", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: inviteEmail.trim(), firstName: inviteFirst.trim(), lastName: inviteLast.trim(), commissionRate: inviteRate }),
      });
      const data = await res.json();
      if (!res.ok) { setInviteError(data.error || "Failed to send invite"); return; }
      setInviteResult({ signupUrl: data.signupUrl });
      fetchInvites();
    } catch {
      setInviteError("Connection error");
    } finally {
      setInviteSending(false);
    }
  };

  const resetInvite = () => {
    setShowInvite(false);
    setInviteEmail(""); setInviteFirst(""); setInviteLast(""); setInviteRate(0.25);
    setInviteError(""); setInviteResult(null);
  };

  const handleAdd = async () => {
    setFormError("");
    if (!formFirst.trim() || !formLast.trim() || !formEmail.trim()) {
      setFormError("First name, last name, and email are required.");
      return;
    }
    try {
      const res = await fetch("/api/admin/partners", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          firstName: formFirst.trim(),
          lastName: formLast.trim(),
          email: formEmail.trim(),
          phone: formPhone.trim() || null,
          partnerCode: formCode.trim() || undefined,
          referredByPartnerCode: formReferrer.trim() || null,
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        setFormError(err.error || "Failed to create partner");
        return;
      }
      setShowForm(false);
      setFormFirst(""); setFormLast(""); setFormEmail(""); setFormPhone(""); setFormCode(""); setFormReferrer("");
      fetchPartners();
    } catch {
      setFormError("Connection error");
    }
  };

  const total = partners.length;
  const active = partners.filter((p) => p.status === "active").length;
  const pending = partners.filter((p) => p.status === "pending").length;
  const blocked = partners.filter((p) => p.status === "blocked").length;
  const invitedCount = invites.filter((inv) => inv.status === "active").length;

  // Tab filter applied client-side (partners already search-filtered by API)
  const filteredPartners = activeTab === "all" || activeTab === "invited"
    ? partners
    : partners.filter((p) => p.status === activeTab);

  // Invite search filtered client-side
  const filteredInvites = invites.filter((inv) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      inv.invitedEmail?.toLowerCase().includes(q) ||
      inv.invitedName?.toLowerCase().includes(q)
    );
  });

  const tabs: { key: TabType; label: string }[] = [
    { key: "all", label: "All" },
    { key: "active", label: "Active" },
    { key: "pending", label: "Pending" },
    { key: "invited", label: "Invited" },
    { key: "blocked", label: "Blocked" },
  ];

  const inputClass = "w-full bg-[var(--app-input-bg)] border border-[var(--app-input-border)] rounded-lg px-4 py-2.5 text-[var(--app-text)] font-body text-sm outline-none focus:border-brand-gold/40 transition-colors placeholder:text-[var(--app-text-muted)]";

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
        <div>
          <h2 className="font-display text-xl font-bold">Partner Management</h2>
          <p className="font-body text-[13px] text-[var(--app-text-muted)] mt-1">View, add, and manage partners.</p>
        </div>
        <div className="flex flex-wrap gap-2 self-start">
          <button onClick={() => { setShowInvite(true); setShowForm(false); }} className="btn-gold text-[12px] px-4 min-h-[44px]">
            + Invite Partner
          </button>
          <button onClick={() => { setShowForm(!showForm); setShowInvite(false); }} className="font-body text-[12px] px-4 min-h-[44px] border border-[var(--app-border)] rounded-lg theme-text-secondary hover:theme-text transition-colors">
            + Add Directly
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-6">
        {[
          { label: "Total Partners", value: total, color: "text-[var(--app-text)]" },
          { label: "Active", value: active, color: "text-green-400" },
          { label: "Pending", value: pending, color: "text-yellow-400" },
          { label: "Invited", value: invitedCount, color: "text-blue-400" },
          { label: "Blocked", value: blocked, color: "text-red-400" },
        ].map((s) => (
          <div key={s.label} className="card p-4">
            <div className="font-body text-[11px] text-[var(--app-text-muted)] uppercase tracking-wider mb-1">{s.label}</div>
            <div className={`font-display text-2xl font-bold ${s.color}`}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* Invite L1 Partner Modal */}
      {showInvite && (
        <div className="card p-5 mb-6">
          <div className="font-body font-semibold text-sm mb-1">Invite L1 Partner</div>
          <div className="font-body text-[12px] theme-text-muted mb-4">An invitation email with a signup link will be sent. The link expires in 7 days.</div>
          {!inviteResult ? (
            <>
              {inviteError && <div className="mb-3 p-2.5 bg-red-500/10 border border-red-500/20 rounded-lg font-body text-[12px] text-red-400">{inviteError}</div>}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
                <input className={inputClass} value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} placeholder="Email *" type="email" />
                <select className={inputClass} value={inviteRate} onChange={(e) => setInviteRate(e.target.value ? parseFloat(e.target.value) : "")}>
                  <option value="">Select commission rate *</option>
                  {ALLOWED_L1_RATES.map((r) => (
                    <option key={r} value={r}>{Math.round(r * 100)}% — L1 Partner</option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <input className={inputClass} value={inviteFirst} onChange={(e) => setInviteFirst(e.target.value)} placeholder="First Name (optional)" />
                <input className={inputClass} value={inviteLast} onChange={(e) => setInviteLast(e.target.value)} placeholder="Last Name (optional)" />
              </div>
              {inviteRate && (
                <div className="mt-3 p-3 rounded-lg bg-brand-gold/5 border border-brand-gold/20 font-body text-[12px] theme-text-muted">
                  At <strong className="text-brand-gold">{Math.round(Number(inviteRate) * 100)}%</strong>, this partner can offer their recruits rates from <strong>5%</strong> up to <strong>{Math.round((Number(inviteRate) - 0.05) * 100)}%</strong>.
                </div>
              )}
              <div className="flex gap-3 mt-4">
                <button onClick={handleInvite} disabled={inviteSending} className="btn-gold text-[12px] px-5 min-h-[44px] disabled:opacity-50">{inviteSending ? "Sending..." : "Send Invite"}</button>
                <button onClick={resetInvite} className="font-body text-[12px] theme-text-muted border border-[var(--app-border)] rounded-lg px-5 min-h-[44px] hover:theme-text-secondary transition-colors">Cancel</button>
              </div>
            </>
          ) : (
            <div>
              <div className="mb-3 p-3 bg-green-500/10 border border-green-500/20 rounded-lg font-body text-[12px] text-green-400">
                Invite sent to <strong>{inviteEmail}</strong>. They will receive an email with their signup link.
              </div>
              <div className="mb-3 p-3 rounded-lg" style={{ background: "var(--app-input-bg)", border: "1px solid var(--app-border)" }}>
                <div className="font-body text-[10px] theme-text-muted uppercase tracking-wider mb-1.5">Signup Link (share manually if needed)</div>
                <div className="font-mono text-[11px] theme-text-secondary break-all">{inviteResult.signupUrl}</div>
              </div>
              <button onClick={resetInvite} className="btn-gold text-[12px] px-5 min-h-[44px]">Done</button>
            </div>
          )}
        </div>
      )}

      {/* Add Partner Form */}
      {showForm && (
        <div className="card p-5 mb-6">
          <div className="font-body font-semibold text-sm mb-4">Add New Partner</div>
          {formError && <div className="mb-3 p-2.5 bg-red-500/10 border border-red-500/20 rounded-lg font-body text-[12px] text-red-400">{formError}</div>}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            <input className={inputClass} value={formFirst} onChange={(e) => setFormFirst(e.target.value)} placeholder="First Name *" />
            <input className={inputClass} value={formLast} onChange={(e) => setFormLast(e.target.value)} placeholder="Last Name *" />
            <input className={inputClass} value={formEmail} onChange={(e) => setFormEmail(e.target.value)} placeholder="Email *" type="email" />
            <input className={inputClass} value={formPhone} onChange={(e) => setFormPhone(e.target.value)} placeholder="Phone" />
            <input className={inputClass} value={formCode} onChange={(e) => setFormCode(e.target.value)} placeholder="Partner Code (auto-generated)" />
            <input className={inputClass} value={formReferrer} onChange={(e) => setFormReferrer(e.target.value)} placeholder="Referred By (partner code)" />
          </div>
          <div className="flex gap-3 mt-4">
            <button onClick={handleAdd} className="btn-gold text-[12px] px-5 py-2.5">Create Partner</button>
            <button onClick={() => setShowForm(false)} className="font-body text-[12px] text-[var(--app-text-muted)] border border-[var(--app-border)] rounded-lg px-5 py-2.5 hover:text-[var(--app-text-secondary)] transition-colors">Cancel</button>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1.5 mb-3 overflow-x-auto pb-1">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`shrink-0 px-4 rounded-lg font-body text-[12px] font-medium transition-colors min-h-[36px] ${
              activeTab === tab.key
                ? "bg-brand-gold text-black"
                : "border border-[var(--app-border)] text-[var(--app-text-muted)] hover:text-[var(--app-text-secondary)]"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="mb-4">
        <input
          className={inputClass}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={activeTab === "invited" ? "Search by name or email..." : "Search by name, email, or partner code..."}
        />
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="font-body text-sm text-[var(--app-text-muted)]">Loading partners...</div>
        </div>
      ) : activeTab === "invited" ? (
        <>
          {/* Invited — Desktop Table */}
          <div className="card hidden sm:block overflow-x-auto">
            <div className="grid grid-cols-[2fr_0.6fr_0.7fr_1fr_1fr] gap-3 px-5 py-3 border-b border-[var(--app-border)]">
              {["Invitee", "Rate", "Status", "Sent", "Expires"].map((h) => (
                <div key={h} className="font-body text-[11px] text-[var(--app-text-muted)] uppercase tracking-wider">{h}</div>
              ))}
            </div>
            {filteredInvites.map((inv) => (
              <div key={inv.id} className="grid grid-cols-[2fr_0.6fr_0.7fr_1fr_1fr] gap-3 px-5 py-3.5 border-b border-[var(--app-border)] last:border-b-0 items-center">
                <div>
                  <div className="font-body text-[13px] text-[var(--app-text)] font-medium">{inv.invitedName || "—"}</div>
                  <div className="font-body text-[11px] text-[var(--app-text-muted)]">{inv.invitedEmail || "—"}</div>
                </div>
                <div className="font-body text-[13px] text-[var(--app-text-secondary)]">{Math.round(inv.commissionRate * 100)}%</div>
                <div>
                  <span className={`inline-block rounded-full px-2.5 py-0.5 font-body text-[10px] font-semibold tracking-wider uppercase ${inviteStatusBadge[inv.status] || inviteStatusBadge.expired}`}>
                    {inv.status}
                  </span>
                </div>
                <div className="font-body text-[12px] text-[var(--app-text-muted)]">{fmtDate(inv.createdAt)}</div>
                <div className="font-body text-[12px] text-[var(--app-text-muted)]">{fmtDate(inv.expiresAt)}</div>
              </div>
            ))}
            {filteredInvites.length === 0 && (
              <div className="px-5 py-10 text-center font-body text-[13px] text-[var(--app-text-muted)]">No invites found.</div>
            )}
          </div>

          {/* Invited — Mobile Cards */}
          <div className="sm:hidden space-y-3">
            {filteredInvites.map((inv) => (
              <div key={inv.id} className="card p-4">
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div>
                    <div className="font-body text-[13px] font-medium text-[var(--app-text)]">{inv.invitedName || "—"}</div>
                    <div className="font-body text-[11px] text-[var(--app-text-muted)] mt-0.5">{inv.invitedEmail || "—"}</div>
                  </div>
                  <span className={`shrink-0 inline-block rounded-full px-2 py-0.5 font-body text-[10px] font-semibold tracking-wider uppercase ${inviteStatusBadge[inv.status] || inviteStatusBadge.expired}`}>
                    {inv.status}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="font-body text-[11px] text-[var(--app-text-muted)]">Rate: {Math.round(inv.commissionRate * 100)}%</div>
                  <div className="font-body text-[11px] text-[var(--app-text-muted)]">Expires {fmtDate(inv.expiresAt)}</div>
                </div>
              </div>
            ))}
            {filteredInvites.length === 0 && (
              <div className="text-center py-10 font-body text-[13px] text-[var(--app-text-muted)]">No invites found.</div>
            )}
          </div>
        </>
      ) : (
        <>
          {/* Partners — Desktop Table */}
          <div className="card hidden sm:block overflow-x-auto">
            <div className="grid grid-cols-[1.5fr_1fr_0.9fr_1.2fr_0.7fr_0.6fr_0.8fr_0.5fr] gap-3 px-5 py-3 border-b border-[var(--app-border)]">
              {["Partner", "Code", "Phone", "Email", "Status", "W9", "Joined", ""].map((h) => (
                <div key={h} className={`font-body text-[11px] text-[var(--app-text-muted)] uppercase tracking-wider ${h === "Status" || h === "W9" ? "text-center" : ""}`}>{h}</div>
              ))}
            </div>
            {filteredPartners.map((p) => {
              const e164 = normalizeForSoftphone(p.mobilePhone || p.phone);
              return (
                <div
                  key={p.id}
                  className="grid grid-cols-[1.5fr_1fr_0.9fr_1.2fr_0.7fr_0.6fr_0.8fr_0.5fr] gap-3 px-5 py-3.5 border-b border-[var(--app-border)] last:border-b-0 hover:bg-[var(--app-card-bg)] transition-colors items-center cursor-pointer"
                  onClick={() => router.push(`/admin/partners/${p.id}`)}
                >
                  <div className="font-body text-[13px] text-[var(--app-text)] font-medium truncate">{p.firstName} {p.lastName}</div>
                  <div className="font-mono text-[12px] text-[var(--app-text-secondary)]">{p.partnerCode}</div>
                  <div className="font-mono text-[12px] truncate">
                    {e164 ? (
                      <button
                        onClick={(evt) => {
                          evt.stopPropagation();
                          const sp = (window as any).__fintellaSoftphone;
                          if (sp) sp.call(e164, `${p.firstName} ${p.lastName}`.trim());
                        }}
                        className="text-brand-gold hover:underline"
                        title="Click to dial via softphone"
                      >
                        📞 {p.mobilePhone || p.phone}
                      </button>
                    ) : (
                      <span className="text-[var(--app-text-muted)]">—</span>
                    )}
                  </div>
                  <div className="font-body text-[12px] text-[var(--app-text-secondary)] truncate">{p.email}</div>
                  <div className="text-center">
                    <span className={`inline-block rounded-full px-2.5 py-0.5 font-body text-[10px] font-semibold tracking-wider uppercase ${statusBadge[p.status] || statusBadge.active}`}>
                      {p.status}
                    </span>
                  </div>
                  <div className="text-center">
                    <span className={`inline-block rounded-full px-2 py-0.5 font-body text-[9px] font-semibold tracking-wider uppercase ${docBadge[p.w9Status] || docBadge.needed}`}>
                      {p.w9Status === "under_review" ? "review" : p.w9Status}
                    </span>
                  </div>
                  <div className="font-body text-[12px] text-[var(--app-text-muted)]">{fmtDate(p.signupDate)}</div>
                  <div className="text-right">
                    <span className="font-body text-[11px] text-brand-gold/60 hover:text-brand-gold transition-colors">View →</span>
                  </div>
                </div>
              );
            })}
            {filteredPartners.length === 0 && (
              <div className="px-5 py-10 text-center font-body text-[13px] text-[var(--app-text-muted)]">No partners found.</div>
            )}
          </div>

          {/* Partners — Mobile Cards */}
          <div className="sm:hidden space-y-3">
            {filteredPartners.map((p) => (
              <div key={p.id} className="card p-4 cursor-pointer hover:bg-[var(--app-card-bg)] transition-colors" onClick={() => router.push(`/admin/partners/${p.id}`)}>
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div>
                    <div className="font-body text-[13px] font-medium text-[var(--app-text)]">{p.firstName} {p.lastName}</div>
                    <div className="font-mono text-[11px] text-[var(--app-text-muted)] mt-0.5">{p.partnerCode}</div>
                  </div>
                  <span className={`shrink-0 inline-block rounded-full px-2 py-0.5 font-body text-[10px] font-semibold tracking-wider uppercase ${statusBadge[p.status] || statusBadge.active}`}>
                    {p.status}
                  </span>
                </div>
                <div className="font-body text-[11px] text-[var(--app-text-muted)] mb-2">{p.email}</div>
                <div className="flex items-center justify-between">
                  <div className="font-body text-[11px] text-[var(--app-text-muted)]">Joined {fmtDate(p.signupDate)}</div>
                  <div className="flex items-center gap-1.5">
                    <span className="font-body text-[9px] text-[var(--app-text-muted)] uppercase">W9:</span>
                    <span className={`inline-block rounded-full px-2 py-0.5 font-body text-[9px] font-semibold tracking-wider uppercase ${docBadge[p.w9Status] || docBadge.needed}`}>
                      {p.w9Status === "under_review" ? "review" : p.w9Status}
                    </span>
                  </div>
                </div>
              </div>
            ))}
            {filteredPartners.length === 0 && (
              <div className="text-center py-10 font-body text-[13px] text-[var(--app-text-muted)]">No partners found.</div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
