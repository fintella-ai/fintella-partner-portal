"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useDevice } from "@/lib/useDevice";
import { useService } from "@/contexts/ServiceContext";
import StageBadge from "@/components/ui/StageBadge";
import StatusBadge from "@/components/ui/StatusBadge";
import { SkeletonTableRow } from "@/components/ui/Skeleton";
import PullToRefresh from "@/components/ui/PullToRefresh";
import { fmt$, fmtDate, fmtDateTime } from "@/lib/format";
import { resolveDealFinancials, formatRate } from "@/lib/dealCalc";
import { STAGE_LABELS } from "@/lib/constants";
import TablePagination from "@/components/ui/TablePagination";
import ScrollableRow from "@/components/ui/ScrollableRow";

export default function DealsPage() {
  const device = useDevice();
  const router = useRouter();
  const { activeServiceId } = useService();
  const [deals, setDeals] = useState<any[]>([]);
  const [downlineDeals, setDownlineDeals] = useState<any[]>([]);
  const [me, setMe] = useState<{ commissionRate: number; tier: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [dealsTab, setDealsTab] = useState<"my-deals" | "downline">("my-deals");
  const [serviceFilter, setServiceFilter] = useState("all");
  // Stage filters
  const [directStageFilter, setDirectStageFilter] = useState("all");
  const [downlineStageFilter, setDownlineStageFilter] = useState("all");
  // Pagination
  const [directPage, setDirectPage] = useState(1);
  const [directPageSize, setDirectPageSize] = useState(10);
  const [downlinePage, setDownlinePage] = useState(1);
  const [downlinePageSize, setDownlinePageSize] = useState(10);
  // Deep link: auto-expand a deal from URL ?deal=xxx
  const [expandedId, setExpandedId] = useState<string | null>(() => {
    if (typeof window !== "undefined") {
      return new URLSearchParams(window.location.search).get("deal");
    }
    return null;
  });

  const loadData = useCallback(async () => {
    try {
      const res = await fetch(`/api/deals${activeServiceId ? `?serviceId=${activeServiceId}` : ""}`);
      if (res.ok) {
        const data = await res.json();
        setDeals(data.directDeals || []);
        setDownlineDeals(data.downlineDeals || []);
        setMe(data.me || null);
      }
    } catch {}
    setLoading(false);
  }, [activeServiceId]);

  useEffect(() => { loadData(); }, [loadData]);
  useEffect(() => { setDirectPage(1); }, [directStageFilter]);
  useEffect(() => { setDownlinePage(1); }, [downlineStageFilter]);

  // Service + stage filtered
  const svcDirectDeals = serviceFilter === "all" ? deals : deals.filter((d: any) => (d.serviceOfInterest || "Tariff Refund Support") === serviceFilter);
  const svcDownlineDeals = serviceFilter === "all" ? downlineDeals : downlineDeals.filter((d: any) => (d.serviceOfInterest || "Tariff Refund Support") === serviceFilter);
  const filteredDirectDeals = directStageFilter === "all" ? svcDirectDeals : svcDirectDeals.filter((d) => d.stage === directStageFilter);
  const filteredDownlineDeals = downlineStageFilter === "all" ? svcDownlineDeals : svcDownlineDeals.filter((d) => d.stage === downlineStageFilter);
  const paginatedDirectDeals = filteredDirectDeals.slice((directPage - 1) * directPageSize, directPage * directPageSize);
  const paginatedDownlineDeals = filteredDownlineDeals.slice((downlinePage - 1) * downlinePageSize, downlinePage * downlinePageSize);

  function toggleExpand(dealId: string) {
    setExpandedId(expandedId === dealId ? null : dealId);
  }

  function handleDealSupport(deal: any) {
    // Try to open live chat with deal context, otherwise open support ticket
    const dealRef = `[Deal: ${deal.dealName} | ID: ${deal.id}]`;

    // Dispatch custom event for chat widget in layout
    const chatEvent = new CustomEvent("openDealChat", {
      detail: { dealId: deal.id, dealName: deal.dealName, message: `I have a question about my deal: ${deal.dealName}\nDeal ID: ${deal.id}` },
    });
    window.dispatchEvent(chatEvent);

    // Also navigate to support as fallback (if chat is not enabled, the ticket page handles it)
    setTimeout(() => {
      // Check if chat opened (layout sets a flag)
      if (!(window as any).__fintellaChatOpened) {
        router.push(`/dashboard/support?newTicket=true&subject=${encodeURIComponent(`Deal Support: ${deal.dealName}`)}&category=${encodeURIComponent("Deal Tracking")}&dealRef=${encodeURIComponent(dealRef)}&dealId=${encodeURIComponent(deal.id)}&service=${encodeURIComponent(deal.serviceOfInterest || "")}`);
      }
      delete (window as any).__fintellaChatOpened;
    }, 200);
  }

  if (loading) {
    return (
      <div>
        <div className="animate-pulse mb-6">
          <div className="h-6 w-40 bg-[var(--app-card-bg)] rounded-lg mb-2" />
          <div className="h-3 w-64 bg-[var(--app-card-bg)] rounded-lg" />
        </div>
        <div className="card">
          <div className="px-4 sm:px-6 py-4 border-b border-[var(--app-border)]">
            <div className="h-4 w-24 bg-[var(--app-card-bg)] rounded animate-pulse" />
          </div>
          {[1, 2, 3].map((i) => <SkeletonTableRow key={i} cols={5} />)}
        </div>
      </div>
    );
  }

  return (
    <PullToRefresh onRefresh={loadData} disabled={!device.isMobile}>
    <div>
      <h2 className="font-display text-xl sm:text-2xl font-bold mb-2">
        Deals
      </h2>
      <p className="font-body text-sm text-[var(--app-text-muted)] mb-6">
        Your direct referrals and downline partner deals.
      </p>

      {/* Service Switcher */}
      <div className="flex gap-2 mb-4">
        {[
          { value: "all", label: "All Services", color: "#d4a017", icon: "📊" },
          { value: "Tariff Refund Support", label: "Tariff Refund", color: "#d4a017", icon: "💰" },
          { value: "Kwong Penalty Abatement (ERC)", label: "Penalty Abatement (ERC)", color: "#14b8a6", icon: "📋" },
        ].map((svc) => {
          const count = svc.value === "all" ? deals.length : deals.filter((d: any) => (d.serviceOfInterest || "Tariff Refund Support") === svc.value).length;
          const active = serviceFilter === svc.value;
          return (
            <button
              key={svc.value}
              type="button"
              onClick={() => { setServiceFilter(svc.value); setDirectStageFilter("all"); setDownlineStageFilter("all"); }}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-body text-[13px] font-semibold transition-all border ${
                active ? "border-transparent text-white" : "border-[var(--app-border)] bg-[var(--app-card-bg)] text-[var(--app-text-muted)] hover:border-[var(--app-text-faint)]"
              }`}
              style={active ? { background: svc.color, borderColor: svc.color } : {}}
            >
              <span>{svc.icon}</span>
              <span className="hidden sm:inline">{svc.label}</span>
              <span className="sm:hidden">{svc.icon}</span>
              <span className={`text-[11px] px-1.5 py-0.5 rounded-full ${active ? "bg-white/20" : "bg-[var(--app-input-bg)]"}`}>{count}</span>
            </button>
          );
        })}
      </div>

      {/* Deal Pipeline */}
      {(() => {
        const activeDealList = dealsTab === "my-deals" ? svcDirectDeals : svcDownlineDeals;
        const activeFilter = dealsTab === "my-deals" ? directStageFilter : downlineStageFilter;
        const setFilter = dealsTab === "my-deals" ? setDirectStageFilter : setDownlineStageFilter;
        const counts: Record<string, number> = {};
        for (const d of activeDealList) counts[d.stage] = (counts[d.stage] || 0) + 1;
        const isKwongFilter = serviceFilter === "Kwong Penalty Abatement (ERC)";
        const visibleStages = isKwongFilter ? KWONG_PIPELINE : serviceFilter !== "all" ? PIPELINE_STAGES : [...PIPELINE_STAGES, ...KWONG_PIPELINE.filter((s) => !PIPELINE_STAGES.includes(s))];
        return (
          <>
            <div className="card p-4 sm:p-5 mb-4">
              <div className="font-body font-semibold text-[13px] mb-3">
                {isKwongFilter ? "Penalty Abatement Pipeline" : serviceFilter === "all" ? "Deal Pipeline" : "Tariff Refund Pipeline"}
              </div>
              <div className="flex flex-wrap gap-2">
                {visibleStages.map((s) => (
                  <button key={s} onClick={() => setFilter(activeFilter === s ? "all" : s)}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-lg transition-colors border ${
                      activeFilter === s ? "bg-brand-gold/20 border-brand-gold/30" : "bg-[var(--app-card-bg)] border-[var(--app-border)] hover:bg-[var(--app-card-bg)]"
                    }`}
                  >
                    <StageBadge stage={s} />
                  </button>
                ))}
              </div>
            </div>
            <ScrollableRow className="mb-4 border-b border-[var(--app-border)]">
              <div className="flex gap-1 min-w-max">
                {[{ value: "all", label: "All" }, ...visibleStages.map((s) => ({ value: s, label: (STAGE_LABELS[s]?.label || s) }))].map((s) => {
                  const count = s.value === "all" ? activeDealList.length : (counts[s.value] || 0);
                  const active = activeFilter === s.value;
                  return (
                    <button key={s.value} type="button" onClick={() => setFilter(s.value)}
                      className={`font-body text-[12px] px-3 py-2 rounded-t-lg border border-b-0 transition-colors whitespace-nowrap min-h-[36px] ${
                        active ? "text-brand-gold border-[var(--app-border)] bg-[var(--app-card-bg)] -mb-px font-semibold" : "text-[var(--app-text-muted)] border-transparent hover:text-[var(--app-text-secondary)] hover:bg-brand-gold/5"
                      }`}
                    >
                      {s.label} <span className={`ml-1 text-[10px] ${active ? "text-brand-gold/80" : "text-[var(--app-text-muted)]"}`}>{count}</span>
                    </button>
                  );
                })}
              </div>
            </ScrollableRow>
          </>
        );
      })()}

      <div className="card">
        <div className="flex gap-1 px-4 sm:px-6 pt-4 sm:pt-5 border-b border-[var(--app-border)]">
          {([
            { id: "my-deals" as const, label: "My Direct Deals" },
            { id: "downline" as const, label: "Downline Deals" },
          ]).map((t) => (
            <button
              key={t.id}
              onClick={() => setDealsTab(t.id)}
              className={`font-body text-[13px] px-4 py-2.5 whitespace-nowrap transition-colors border-b-2 -mb-px ${
                dealsTab === t.id
                  ? "text-brand-gold border-brand-gold"
                  : "text-[var(--app-text-muted)] border-transparent hover:text-[var(--app-text-secondary)]"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {dealsTab === "my-deals" && (filteredDirectDeals.length === 0 ? (
          <div className="p-12 text-center font-body text-sm text-[var(--app-text-muted)]">
            {deals.length === 0 ? "No deals yet. Share your referral link to start earning commissions." : "No deals match this stage filter."}
          </div>
        ) : device.isMobile ? (
          /* ── Mobile: Card layout ── */
          <div>
            {paginatedDirectDeals.map((deal, idx) => (
              <div key={deal.id}>
                <div
                  className={`px-4 py-4 border-b border-[var(--app-border)] cursor-pointer ${idx % 2 === 1 ? "bg-[rgba(59,130,246,0.03)]" : ""}`}
                  onClick={() => toggleExpand(deal.id)}
                >
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <div className="font-body text-[13px] font-medium text-[var(--app-text)] leading-snug flex-1 min-w-0">
                      {deal.dealName}
                    </div>
                    <StageBadge stage={deal.stage} />
                  </div>
                  <div className="font-body text-[11px] text-[var(--app-text-secondary)] mb-1">
                    {(deal.serviceOfInterest || "Tariff Refund Support").replace(/\s*\(Tier [12]\)/, "")}{deal.serviceOfInterest !== "Kwong Penalty Abatement (ERC)" && <span className={`font-medium ${deal.isImporterOfRecord !== false ? "text-emerald-400" : "text-amber-400"}`}> ({deal.isImporterOfRecord !== false ? "Tier 1" : "Tier 2"})</span>}
                  </div>
                  <div className="font-body text-[11px] text-[var(--app-text-muted)] mb-3">
                    {fmtDateTime(deal.createdAt)}
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <div className="font-body text-[10px] text-[var(--app-text-muted)] tracking-wider uppercase mb-0.5">Refund</div>
                      <div className="font-body text-[13px] text-[var(--app-text)]">{fmt$(deal.estimatedRefundAmount)}</div>
                    </div>
                    <div>
                      <div className="font-body text-[10px] text-[var(--app-text-muted)] tracking-wider uppercase mb-0.5">Firm Fee</div>
                      <div className="font-body text-[13px] text-[var(--app-text-secondary)]">{fmt$(deal.firmFeeAmount)}</div>
                    </div>
                    <div className="text-right">
                      <div className="font-body text-[10px] text-[var(--app-text-muted)] tracking-wider uppercase mb-0.5">Commission</div>
                      <div className="font-display text-sm font-semibold text-brand-gold">{fmt$(deal.l1CommissionAmount)}</div>
                      <div className="mt-1"><StatusBadge status={deal.l1CommissionStatus} /></div>
                    </div>
                  </div>
                </div>

                {/* Expanded detail */}
                {expandedId === deal.id && (
                  <DealDetail deal={deal} onSupport={() => handleDealSupport(deal)} />
                )}
              </div>
            ))}
          </div>
        ) : (
          /* ── Desktop/Tablet: Grid table (horizontal scroll on narrow viewports) ── */
          <div className="overflow-x-auto">
            <div className="min-w-[1140px]">
            {/* Header — 9 columns: Client/Deal / Service / Stage / Est. Refund /
                Firm Fee (%) / Firm Fee / Commission (%) / Commission / Status. */}
            <div className="grid grid-cols-[2fr_0.9fr_1fr_1fr_0.55fr_1fr_0.65fr_1fr_0.7fr] gap-6 px-6 py-3 border-b border-[var(--app-border)]">
              {["Client / Deal", "Service", "Stage", "Est. Refund", "Firm Fee (%)", "Firm Fee", "Commission (%)", "Commission", "Status"].map((h) => (
                <div key={h} className={`font-body text-[10px] tracking-[1px] uppercase text-[var(--app-text-muted)] ${h === "Client / Deal" ? "" : "text-center"}`}>{h}</div>
              ))}
            </div>
            {paginatedDirectDeals.map((deal, idx) => {
              // Cross-calculate missing financial values using the shared
              // helper. The partner's own commissionRate (from `me`) is the
              // fallback rate for their direct deals — see src/lib/dealCalc.ts
              // for the full precedence rules.
              const fin = resolveDealFinancials(deal, me?.commissionRate);
              return (
              <div key={deal.id}>
                <div
                  className={`grid grid-cols-[2fr_0.9fr_1fr_1fr_0.55fr_1fr_0.65fr_1fr_0.7fr] gap-6 px-6 py-4 border-b border-[var(--app-border)] items-center hover:bg-[var(--app-card-bg)] transition-colors cursor-pointer ${idx % 2 === 1 ? "bg-[rgba(59,130,246,0.03)]" : ""}`}
                  onClick={() => toggleExpand(deal.id)}
                >
                  <div>
                    <div className="font-body text-[13px] font-medium text-[var(--app-text)] truncate">{deal.dealName}</div>
                    <div className="font-body text-[11px] text-[var(--app-text-muted)] mt-0.5 truncate">{fmtDateTime(deal.createdAt)}</div>
                  </div>
                  <div className="font-body text-[11px] text-[var(--app-text-secondary)] text-center truncate">
                    {(deal.serviceOfInterest || "Tariff Refund Support").replace(/\s*\(Tier [12]\)/, "")}{deal.serviceOfInterest !== "Kwong Penalty Abatement (ERC)" && <span className={`font-medium ${deal.isImporterOfRecord !== false ? "text-emerald-400" : "text-amber-400"}`}> ({deal.isImporterOfRecord !== false ? "Tier 1" : "Tier 2"})</span>}
                  </div>
                  <div className="text-center"><StageBadge stage={deal.stage} /></div>
                  <div className="font-body text-[13px] text-[var(--app-text)] text-center">{fmt$(fin.refund)}</div>
                  <div className="font-body text-[12px] text-[var(--app-text-muted)] text-center">
                    {formatRate(fin.firmFeeRate)}
                  </div>
                  <div className="font-body text-[13px] text-[var(--app-text-secondary)] text-center">{fmt$(fin.firmFeeAmount)}</div>
                  <div className="font-body text-[12px] text-[var(--app-text-muted)] text-center">
                    {formatRate(fin.commissionRate)}
                  </div>
                  <div className="font-display text-[15px] font-semibold text-brand-gold text-center">{fmt$(fin.commissionAmount)}</div>
                  <div className="text-center"><StatusBadge status={deal.l1CommissionStatus} /></div>
                </div>

                {/* Expanded detail */}
                {expandedId === deal.id && (
                  <DealDetail deal={deal} onSupport={() => handleDealSupport(deal)} />
                )}
              </div>
              );
            })}
            </div>
          </div>
        ))}
        {dealsTab === "my-deals" && deals.length > 0 && (
          <TablePagination page={directPage} pageSize={directPageSize} totalItems={filteredDirectDeals.length} onPageChange={setDirectPage} onPageSizeChange={setDirectPageSize} />
        )}

        {dealsTab === "downline" && (filteredDownlineDeals.length === 0 ? (
          <div className="p-12 text-center font-body text-sm text-[var(--app-text-muted)]">
            {downlineDeals.length === 0 ? "No downline deals yet. Recruit partners to build your team." : "No downline deals match this stage filter."}
          </div>
        ) : (
          <div>
            {paginatedDownlineDeals.map((deal, idx) => (
              <div
                key={deal.id}
                className={`px-4 sm:px-6 py-4 border-b border-[var(--app-border)] last:border-b-0 ${idx % 2 === 1 ? "bg-[rgba(59,130,246,0.03)]" : ""}`}
              >
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="font-body text-[13px] font-medium text-[var(--app-text)] truncate flex-1">{deal.dealName}</div>
                  <StageBadge stage={deal.stage} />
                </div>
                <div className="font-body text-[11px] text-[var(--app-text-muted)] mb-2">
                  Via {deal.submittingPartnerName || deal.partnerCode} · {fmtDate(deal.createdAt)}
                </div>
                <div className="flex items-center justify-between">
                  <div className="font-body text-[12px] text-[var(--app-text-muted)]">
                    Refund: {fmt$(deal.estimatedRefundAmount)}
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="font-display text-[14px] font-semibold text-brand-gold">{fmt$(deal.l2CommissionAmount)}</div>
                    <StatusBadge status={deal.l2CommissionStatus} />
                  </div>
                </div>
              </div>
            ))}
          </div>
        ))}
        {dealsTab === "downline" && downlineDeals.length > 0 && (
          <TablePagination page={downlinePage} pageSize={downlinePageSize} totalItems={filteredDownlineDeals.length} onPageChange={setDownlinePage} onPageSizeChange={setDownlinePageSize} />
        )}
      </div>
    </div>
    </PullToRefresh>
  );
}

/* ── Deal stages for tracker ── */
const PIPELINE_STAGES = [
  "lead_submitted", "meeting_booked", "meeting_missed", "meeting_completed",
  "qualified", "disqualified", "gathering_info", "agreement_sent",
  "client_engaged", "unresponsive", "closedwon",
];

const KWONG_PIPELINE = [
  "lead_submitted", "engaged", "awaiting_poa", "poa_declined",
  "poa_resubmitted", "reviewing_data", "denied",
  "submitted_to_irs", "awaiting_refund", "completed",
];

/* ── Deal Detail Component (read-only) ── */
function DealDetail({ deal, onSupport }: { deal: any; onSupport: () => void }) {
  const isKwong = deal.serviceOfInterest === "Kwong Penalty Abatement (ERC)";
  const stages = isKwong ? KWONG_PIPELINE : PIPELINE_STAGES;
  const currentIdx = stages.indexOf(deal.stage);
  const isClosed = deal.stage === "closedwon" || deal.stage === "disqualified" || deal.stage === "closedlost" || deal.stage === "completed" || deal.stage === "denied";

  return (
    <div className="px-4 sm:px-6 py-5 bg-[var(--app-card-bg)] border-b border-[var(--app-border)]">
      {/* Deal ID */}
      <div className="mb-4 p-3 rounded-lg" style={{ background: "var(--app-input-bg)", border: "1px solid var(--app-border)" }}>
        <div className="font-body text-[10px] text-[var(--app-text-muted)] uppercase tracking-wider">Deal ID (Reference Number)</div>
        <div className="font-mono text-[12px] text-[var(--app-text)] mt-0.5 select-all">{deal.id}</div>
      </div>

      {/* ── Status Tracker ── */}
      <div className="mb-5">
        <div className="font-body text-[11px] text-[var(--app-text-muted)] uppercase tracking-wider mb-3">Deal Progress</div>
        <div className="flex items-center gap-1 overflow-x-auto pb-2">
          {stages.filter((s) => {
            if (isKwong) {
              if (s === "denied" && deal.stage !== "denied") return false;
              if (s === "poa_declined" && deal.stage !== "poa_declined") return false;
              return true;
            }
            return s !== "disqualified" || deal.stage === "disqualified" || deal.stage === "closedlost";
          }).map((stage, i) => {
            const label = STAGE_LABELS[stage]?.label || stage;
            const isActive = stage === deal.stage;
            const isPast = currentIdx >= 0 && i < currentIdx && !isClosed;
            const isWon = (deal.stage === "closedwon" && stage === "closedwon") || (deal.stage === "completed" && stage === "completed");
            const isLost = ((deal.stage === "disqualified" || deal.stage === "closedlost") && (stage === "disqualified" || stage === "closedlost")) || (deal.stage === "denied" && stage === "denied");

            return (
              <div key={stage} className="flex items-center gap-1 shrink-0">
                {i > 0 && (
                  <div className={`w-3 sm:w-5 h-0.5 ${isPast || isActive ? "bg-brand-gold" : "bg-[var(--app-border)]"}`} />
                )}
                <div className={`flex items-center gap-1.5 px-2 py-1.5 rounded-full text-[9px] sm:text-[10px] font-body font-semibold tracking-wider whitespace-nowrap ${
                  isWon ? "bg-green-500/15 text-green-400 border border-green-500/25"
                    : isLost ? "bg-red-500/15 text-red-400 border border-red-500/25"
                    : isActive ? "bg-brand-gold/15 text-brand-gold border border-brand-gold/25"
                    : isPast ? "bg-brand-gold/10 text-brand-gold/60 border border-brand-gold/15"
                    : "bg-[var(--app-input-bg)] text-[var(--app-text-faint)] border border-[var(--app-border)]"
                }`}>
                  {(isPast || isActive || isWon) && !isLost && <span className="w-1.5 h-1.5 rounded-full bg-current" />}
                  {label}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Client Info */}
      <div className="mb-4">
        <div className="font-body text-[11px] text-[var(--app-text-muted)] uppercase tracking-wider mb-3">Client Information</div>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-2.5">
          {[
            { label: "Client Name", value: deal.clientName || [deal.clientFirstName, deal.clientLastName].filter(Boolean).join(" ") },
            { label: "Email", value: deal.clientEmail },
            { label: "Phone", value: deal.clientPhone },
            { label: "Business Title", value: deal.clientTitle },
            { label: "Company / Entity", value: deal.legalEntityName },
            { label: "Service", value: deal.serviceOfInterest },
            { label: "City", value: deal.businessCity },
            { label: "State", value: deal.businessState },
          ].filter((f) => f.value).map((f) => (
            <div key={f.label}>
              <div className="font-body text-[10px] text-[var(--app-text-muted)] uppercase tracking-wider">{f.label}</div>
              <div className="font-body text-[13px] text-[var(--app-text-secondary)] mt-0.5">{f.value}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Consultation */}
      {(deal.consultBookedDate || deal.consultBookedTime) && (
        <div className="mb-4 p-3 rounded-lg flex items-center gap-4" style={{ background: "var(--app-gold-overlay)", border: "1px solid var(--app-gold-overlay-border)" }}>
          <div>
            <div className="font-body text-[10px] text-yellow-500/80 uppercase tracking-wider">Consultation Date</div>
            <div className="font-body text-[13px] text-[var(--app-text)] mt-0.5">{deal.consultBookedDate || "—"}</div>
          </div>
          <div>
            <div className="font-body text-[10px] text-yellow-500/80 uppercase tracking-wider">Consultation Time</div>
            <div className="font-body text-[13px] text-[var(--app-text)] mt-0.5">{deal.consultBookedTime || "—"}</div>
          </div>
        </div>
      )}

      {/* Tariff Info */}
      {(deal.importsGoods || deal.importCountries || deal.annualImportValue) && (
        <div className="mb-4">
          <div className="font-body text-[11px] text-[var(--app-text-muted)] uppercase tracking-wider mb-3">Tariff Information</div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-2.5">
            {[
              { label: "Imports Goods", value: deal.importsGoods },
              { label: "Import Countries", value: deal.importCountries },
              { label: "Annual Import Value", value: deal.annualImportValue },
              { label: "Importer of Record", value: deal.importerOfRecord },
            ].filter((f) => f.value).map((f) => (
              <div key={f.label}>
                <div className="font-body text-[10px] text-[var(--app-text-muted)] uppercase tracking-wider">{f.label}</div>
                <div className="font-body text-[13px] text-[var(--app-text-secondary)] mt-0.5">{f.value}</div>
              </div>
            ))}
            {!isKwong && <div>
              <div className="font-body text-[10px] text-[var(--app-text-muted)] uppercase tracking-wider">Client Tier</div>
              <div className={`font-body text-[13px] mt-0.5 font-medium ${
                deal.isImporterOfRecord !== false ? "text-emerald-400" : "text-amber-400"
              }`}>
                {deal.isImporterOfRecord !== false ? "Tier 1 — Full Commission" : "Tier 2 — 50% Commission"}
              </div>
            </div>}
          </div>
        </div>
      )}

      {/* Enterprise Partner tag — read-only for partners */}
      {deal.epLevel1 && (
        <div className="mb-4">
          <div className="font-body text-[10px] text-[var(--app-text-muted)] uppercase tracking-wider">EP Level 1</div>
          <div className="font-body text-[13px] text-[var(--app-text-secondary)] mt-0.5 font-mono">{deal.epLevel1}</div>
        </div>
      )}

      {/* Financials */}
      <div className="mb-4">
        <div className="font-body text-[11px] text-[var(--app-text-muted)] uppercase tracking-wider mb-3">Financial Summary</div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: "Estimated Refund", value: fmt$(deal.estimatedRefundAmount) },
            { label: "Firm Fee", value: fmt$(deal.firmFeeAmount) },
            { label: "Your Commission", value: fmt$(deal.l1CommissionAmount), highlight: true },
            { label: "Commission Status", value: deal.l1CommissionStatus?.charAt(0).toUpperCase() + deal.l1CommissionStatus?.slice(1) || "Pending" },
          ].map((f) => (
            <div key={f.label} className="p-3 rounded-lg" style={{ background: "var(--app-input-bg)", border: "1px solid var(--app-border)" }}>
              <div className="font-body text-[10px] text-[var(--app-text-muted)] uppercase tracking-wider mb-1">{f.label}</div>
              <div className={`font-display text-base font-bold ${f.highlight ? "text-brand-gold" : "text-[var(--app-text)]"}`}>{f.value}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Deal Notes & Timeline */}
      <div className="mb-4">
        <div className="font-body text-[11px] text-[var(--app-text-muted)] uppercase tracking-wider mb-3">Deal Notes & Activity</div>
        <div className="space-y-2">
          {/* Creation event */}
          <div className="flex items-start gap-3 p-3 rounded-lg" style={{ background: "var(--app-input-bg)", border: "1px solid var(--app-border)" }}>
            <span className="text-sm mt-0.5 shrink-0">📋</span>
            <div className="flex-1">
              <div className="font-body text-[12px] text-[var(--app-text-secondary)]">Deal created</div>
              <div className="font-body text-[10px] text-[var(--app-text-faint)] mt-0.5">{fmtDateTime(deal.createdAt)}</div>
            </div>
          </div>

          {/* Consultation booked */}
          {deal.consultBookedDate && (
            <div className="flex items-start gap-3 p-3 rounded-lg" style={{ background: "var(--app-gold-overlay-subtle)", border: "1px solid var(--app-gold-overlay-border-subtle)" }}>
              <span className="text-sm mt-0.5 shrink-0">📅</span>
              <div className="flex-1">
                <div className="font-body text-[12px] text-[var(--app-text-secondary)]">Consultation scheduled: {deal.consultBookedDate} {deal.consultBookedTime && `at ${deal.consultBookedTime}`}</div>
              </div>
            </div>
          )}

          {/* Affiliate notes */}
          {deal.affiliateNotes && (
            <div className="flex items-start gap-3 p-3 rounded-lg" style={{ background: "var(--app-input-bg)", border: "1px solid var(--app-border)" }}>
              <span className="text-sm mt-0.5 shrink-0">📝</span>
              <div className="flex-1">
                <div className="font-body text-[10px] text-[var(--app-text-muted)] uppercase tracking-wider mb-1">Your Referral Notes</div>
                <div className="font-body text-[13px] text-[var(--app-text-secondary)] whitespace-pre-wrap">{deal.affiliateNotes}</div>
              </div>
            </div>
          )}

          {/* Disqualified Reason */}
          {deal.closedLostReason && (deal.stage === "disqualified" || deal.stage === "closedlost") && (
            <div className="flex items-start gap-3 p-3 rounded-lg bg-red-500/5 border border-red-500/10">
              <span className="text-sm mt-0.5 shrink-0">&#x26A0;&#xFE0F;</span>
              <div className="flex-1">
                <div className="font-body text-[10px] text-red-400/80 uppercase tracking-wider mb-1">Disqualified Reason</div>
                <div className="font-body text-[13px] text-red-300">{deal.closedLostReason}</div>
              </div>
            </div>
          )}

          {/* Close date */}
          {deal.closeDate && (
            <div className={`flex items-start gap-3 p-3 rounded-lg ${deal.stage === "closedwon" ? "bg-green-500/5 border border-green-500/10" : "bg-red-500/5 border border-red-500/10"}`}>
              <span className="text-sm mt-0.5 shrink-0">{deal.stage === "closedwon" ? "✅" : "❌"}</span>
              <div className="flex-1">
                <div className={`font-body text-[12px] ${deal.stage === "closedwon" ? "text-green-400" : "text-red-400"}`}>
                  Deal {deal.stage === "closedwon" ? "closed won" : "closed lost"}
                </div>
                <div className="font-body text-[10px] text-[var(--app-text-faint)] mt-0.5">{fmtDate(deal.closeDate)}</div>
                {deal.closedLostReason && (
                  <div className="font-body text-[11px] text-[var(--app-text-muted)] mt-1">{deal.closedLostReason}</div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Deal Support Button */}
      <div className="flex items-center justify-between pt-3" style={{ borderTop: "1px solid var(--app-border)" }}>
        <div className="font-body text-[10px] text-[var(--app-text-faint)]">
          Deal ID: <span className="font-mono select-all">{deal.id}</span>
        </div>
        <button
          onClick={(e) => { e.stopPropagation(); onSupport(); }}
          className="font-body text-[12px] font-semibold text-brand-gold border border-brand-gold/20 rounded-lg px-4 py-2.5 hover:bg-brand-gold/10 transition-colors flex items-center gap-2 min-h-[44px]"
        >
          <span>🎫</span> Deal Support
        </button>
      </div>
    </div>
  );
}
