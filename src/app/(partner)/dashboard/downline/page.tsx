"use client";

import { useEffect, useState, useCallback } from "react";
import { useSession } from "next-auth/react";
import { useDevice } from "@/lib/useDevice";
import StageBadge from "@/components/ui/StageBadge";
import StatusBadge from "@/components/ui/StatusBadge";
import { SkeletonTableRow, SkeletonCard } from "@/components/ui/Skeleton";
import PullToRefresh from "@/components/ui/PullToRefresh";
import DownlineTree, { type TreePartner } from "@/components/ui/DownlineTree";
import { fmt$, fmtDate } from "@/lib/format";
import { DEFAULT_L2_RATE, DEFAULT_FIRM_FEE_RATE } from "@/lib/constants";

type PartnerView = "list" | "tree";

export default function DownlinePage() {
  const device = useDevice();
  const { data: session } = useSession();
  const [partners, setPartners] = useState<any[]>([]);
  const [l3Partners, setL3Partners] = useState<any[]>([]);
  const [deals, setDeals] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [partnerView, setPartnerView] = useState<PartnerView>("list");

  const loadData = useCallback(async () => {
    try {
      const res = await fetch("/api/deals");
      if (res.ok) {
        const data = await res.json();
        setPartners(data.downlinePartners || []);
        setL3Partners(data.l3Partners || []);
        setDeals(data.downlineDeals || []);
      }
    } catch {}
    setLoading(false);
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  // Build a map from partner code → partner name for display in downline deals
  const partnerNameMap: Record<string, string> = {};
  for (const p of partners) {
    if (p.partnerCode) {
      partnerNameMap[p.partnerCode] = `${p.firstName} ${p.lastName}`.trim();
    }
  }

  // Resolve partner name: prefer submittingPartnerName, then map lookup, then code
  const resolvePartnerName = (p: any) =>
    p.submittingPartnerName || partnerNameMap[p.partnerCode] || p.partnerCode;

  // L2 commission percentage display
  const l2Pct = `${(DEFAULT_L2_RATE * 100).toFixed(0)}%`;

  if (loading) {
    return (
      <div>
        <div className="animate-pulse mb-6">
          <div className="h-6 w-36 bg-white/[0.06] rounded-lg mb-2" />
          <div className="h-3 w-64 bg-white/[0.06] rounded-lg" />
        </div>
        <div className="card mb-6">
          <div className="px-4 sm:px-6 py-4 border-b border-white/[0.06]">
            <div className="h-4 w-28 bg-white/[0.06] rounded animate-pulse" />
          </div>
          {[1, 2, 3].map((i) => <SkeletonTableRow key={i} cols={5} />)}
        </div>
        <div className="card">
          <div className="px-4 sm:px-6 py-4 border-b border-white/[0.06]">
            <div className="h-4 w-28 bg-white/[0.06] rounded animate-pulse" />
          </div>
          {[1, 2].map((i) => <SkeletonTableRow key={i} cols={6} />)}
        </div>
      </div>
    );
  }

  return (
    <PullToRefresh onRefresh={loadData} disabled={!device.isMobile}>
    <div>
      <h2 className="font-display text-xl sm:text-2xl font-bold mb-2">
        My Downline
      </h2>
      <p className="font-body text-sm text-white/40 mb-6">
        Partners you recruited and the deals they bring in. You earn L2
        commissions on their closed deals.
      </p>

      {/* ═══ YOUR PARTNERS ═══ */}
      <div className="card mb-6">
        <div className="px-4 sm:px-6 py-4 sm:py-5 border-b border-white/[0.06] flex items-center justify-between flex-wrap gap-2">
          <div className="font-body font-semibold text-sm sm:text-[15px]">
            Your Partners
          </div>
          {partners.length > 0 && (
            <div className="flex bg-white/5 rounded-lg p-0.5">
              <button
                onClick={() => setPartnerView("list")}
                className={`font-body text-[11px] px-3 py-1.5 rounded-md transition-colors flex items-center gap-1.5 ${
                  partnerView === "list" ? "bg-brand-gold/15 text-brand-gold" : "text-white/40 hover:text-white/60"
                }`}
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
                </svg>
                List
              </button>
              <button
                onClick={() => setPartnerView("tree")}
                className={`font-body text-[11px] px-3 py-1.5 rounded-md transition-colors flex items-center gap-1.5 ${
                  partnerView === "tree" ? "bg-brand-gold/15 text-brand-gold" : "text-white/40 hover:text-white/60"
                }`}
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v4m0 0a4 4 0 014 4h2a2 2 0 012 2v2M12 8a4 4 0 00-4 4H6a2 2 0 00-2 2v2m8-8v4m0 0a2 2 0 012 2v2m-2-4a2 2 0 00-2 2v2" />
                </svg>
                Tree View
              </button>
            </div>
          )}
        </div>

        {partners.length === 0 ? (
          <div className="p-12 text-center font-body text-sm text-white/35">
            No downline partners yet. Share your partner recruitment link to
            start building your team.
          </div>
        ) : partnerView === "tree" ? (
          /* ── Tree View ── */
          (() => {
            const user = session?.user as any;
            const rootPartner: TreePartner = {
              id: "self",
              partnerCode: user?.partnerCode || "YOU",
              firstName: user?.name?.split(" ")[0] || "You",
              lastName: user?.name?.split(" ").slice(1).join(" ") || "",
              status: "active",
              children: partners.map((p) => ({
                id: p.id,
                partnerCode: p.partnerCode,
                firstName: p.firstName,
                lastName: p.lastName,
                status: p.status,
                children: l3Partners
                  .filter((l3) => l3.referredByPartnerCode === p.partnerCode)
                  .map((l3) => ({
                    id: l3.id,
                    partnerCode: l3.partnerCode,
                    firstName: l3.firstName,
                    lastName: l3.lastName,
                    status: l3.status,
                    children: [],
                  })),
              })),
            };
            return <DownlineTree root={rootPartner} isMobile={device.isMobile} />;
          })()
        ) : device.isMobile ? (
          /* ── Mobile: Card layout ── */
          <div>
            {partners.map((p) => {
              const initials =
                (p.firstName?.[0] || "") + (p.lastName?.[0] || "");
              return (
                <div
                  key={p.partnerCode}
                  className="px-4 py-4 border-b border-white/5 last:border-b-0"
                >
                  <div className="flex items-center gap-3 mb-3">
                    {/* Avatar */}
                    <div className="w-9 h-9 rounded-full bg-white/[0.08] border border-white/10 flex items-center justify-center shrink-0">
                      <span className="font-body text-[11px] font-semibold text-white/60 uppercase">
                        {initials}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-body text-[13px] font-medium text-white truncate">
                        {p.firstName} {p.lastName}
                      </div>
                      <div className="font-body text-[11px] text-white/30 truncate">
                        {p.email}
                      </div>
                    </div>
                    <StatusBadge status={p.status} />
                  </div>
                  <div className="flex items-center justify-between font-body text-[11px] text-white/30">
                    <span>
                      Code:{" "}
                      <span className="text-white/50 font-mono">
                        {p.partnerCode}
                      </span>
                    </span>
                    <span>Joined {fmtDate(p.signupDate)}</span>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          /* ── Desktop/Tablet: Table layout ── */
          <div>
            {/* Header */}
            <div className="grid grid-cols-[2fr_1.5fr_1fr_0.8fr_1fr] gap-4 px-6 py-3 border-b border-white/[0.06]">
              <div className="font-body text-[10px] tracking-[1px] uppercase text-white/35">
                Partner
              </div>
              <div className="font-body text-[10px] tracking-[1px] uppercase text-white/35">
                Email
              </div>
              <div className="font-body text-[10px] tracking-[1px] uppercase text-white/35">
                Code
              </div>
              <div className="font-body text-[10px] tracking-[1px] uppercase text-white/35">
                Status
              </div>
              <div className="font-body text-[10px] tracking-[1px] uppercase text-white/35 text-right">
                Joined
              </div>
            </div>
            {/* Rows */}
            {partners.map((p) => {
              const initials =
                (p.firstName?.[0] || "") + (p.lastName?.[0] || "");
              return (
                <div
                  key={p.partnerCode}
                  className="grid grid-cols-[2fr_1.5fr_1fr_0.8fr_1fr] gap-4 px-6 py-4 border-b border-white/[0.04] last:border-b-0 items-center hover:bg-white/[0.02] transition-colors"
                >
                  {/* Col 1: Name + avatar */}
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-8 h-8 rounded-full bg-white/[0.08] border border-white/10 flex items-center justify-center shrink-0">
                      <span className="font-body text-[10px] font-semibold text-white/60 uppercase">
                        {initials}
                      </span>
                    </div>
                    <div className="font-body text-[13px] font-medium text-white truncate">
                      {p.firstName} {p.lastName}
                    </div>
                  </div>
                  {/* Col 2: Email */}
                  <div className="font-body text-[13px] text-white/50 truncate">
                    {p.email}
                  </div>
                  {/* Col 3: Code */}
                  <div className="font-mono text-[12px] text-white/40">
                    {p.partnerCode}
                  </div>
                  {/* Col 4: Status */}
                  <div>
                    <StatusBadge status={p.status} />
                  </div>
                  {/* Col 5: Joined */}
                  <div className="font-body text-[13px] text-white/40 text-right">
                    {fmtDate(p.signupDate)}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ═══ DOWNLINE DEALS ═══ */}
      <div className="card">
        <div className="px-4 sm:px-6 py-4 sm:py-5 border-b border-white/[0.06]">
          <div className="font-body font-semibold text-sm sm:text-[15px]">
            Downline Deals
          </div>
        </div>

        {deals.length === 0 ? (
          <div className="p-12 text-center font-body text-sm text-white/35">
            No downline deals yet. Once your partners refer clients, their deals
            will appear here.
          </div>
        ) : device.isMobile ? (
          /* ── Mobile: Card layout ── */
          <div>
            {deals.map((p) => (
                <div
                  key={p.dealName}
                  className="px-4 py-4 border-b border-white/5 last:border-b-0"
                >
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <div className="font-body text-[13px] font-medium text-white leading-snug flex-1 min-w-0">
                      {p.dealName}
                    </div>
                    <StageBadge stage={p.stage} />
                  </div>
                  <div className="font-body text-[11px] text-white/30 mb-3">
                    Via {resolvePartnerName(p)} · {fmtDate(p.createdAt)}
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <div className="font-body text-[9px] text-white/30 tracking-wider uppercase mb-0.5">
                        Est. Refund
                      </div>
                      <div className="font-body text-[13px] text-white/80">
                        {fmt$(p.estimatedRefundAmount)}
                      </div>
                    </div>
                    <div className="text-center">
                      <div className="font-body text-[9px] text-white/30 tracking-wider uppercase mb-0.5">
                        L2 Rate
                      </div>
                      <div className="font-body text-[13px] text-purple-400 font-semibold">
                        {l2Pct}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-body text-[9px] text-white/30 tracking-wider uppercase mb-0.5">
                        L2 Commission
                      </div>
                      <div className="font-display text-sm font-semibold text-brand-gold">
                        {fmt$(p.l2CommissionAmount)}
                      </div>
                      <div className="mt-1">
                        <StatusBadge status={p.l2CommissionStatus} />
                      </div>
                    </div>
                  </div>
                </div>
            ))}
          </div>
        ) : (
          /* ── Desktop/Tablet: Grid table ── */
          <div>
            {/* Header */}
            <div className="grid grid-cols-[2fr_1fr_1fr_0.6fr_1fr_0.7fr] gap-4 px-6 py-3 border-b border-white/[0.06]">
              <div className="font-body text-[10px] tracking-[1px] uppercase text-white/35">
                Client / Deal
              </div>
              <div className="font-body text-[10px] tracking-[1px] uppercase text-white/35">
                Stage
              </div>
              <div className="font-body text-[10px] tracking-[1px] uppercase text-white/35">
                Est. Refund
              </div>
              <div className="font-body text-[10px] tracking-[1px] uppercase text-white/35 text-center">
                L2 %
              </div>
              <div className="font-body text-[10px] tracking-[1px] uppercase text-white/35">
                L2 Commission
              </div>
              <div className="font-body text-[10px] tracking-[1px] uppercase text-white/35 text-right">
                Status
              </div>
            </div>
            {/* Rows */}
            {deals.map((p) => (
                <div
                  key={p.dealName}
                  className="grid grid-cols-[2fr_1fr_1fr_0.6fr_1fr_0.7fr] gap-4 px-6 py-4 border-b border-white/[0.04] last:border-b-0 items-center hover:bg-white/[0.02] transition-colors"
                >
                  {/* Col 1: Deal name + partner name */}
                  <div>
                    <div className="font-body text-[13px] font-medium text-white truncate">
                      {p.dealName}
                    </div>
                    <div className="font-body text-[11px] text-white/30 mt-0.5 truncate">
                      Via {resolvePartnerName(p)} · {fmtDate(p.createdAt)}
                    </div>
                  </div>
                  {/* Col 2: Stage */}
                  <div>
                    <StageBadge stage={p.stage} />
                  </div>
                  {/* Col 3: Est. Refund */}
                  <div className="font-body text-[13px] text-white/80">
                    {fmt$(p.estimatedRefundAmount)}
                  </div>
                  {/* Col 4: L2 % */}
                  <div className="text-center">
                    <span className="font-body text-[12px] text-purple-400 font-semibold bg-purple-500/10 border border-purple-500/20 rounded px-2 py-0.5">
                      {l2Pct}
                    </span>
                  </div>
                  {/* Col 5: L2 Commission */}
                  <div className="font-display text-[15px] font-semibold text-brand-gold">
                    {fmt$(p.l2CommissionAmount)}
                  </div>
                  {/* Col 6: Status */}
                  <div className="text-right">
                    <StatusBadge status={p.l2CommissionStatus} />
                  </div>
                </div>
            ))}
          </div>
        )}
      </div>
    </div>
    </PullToRefresh>
  );
}
