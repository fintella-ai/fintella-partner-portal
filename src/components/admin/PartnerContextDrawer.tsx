"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

/**
 * Right-rail partner context drawer shown on /admin workspace when
 * the admin clicks a Needs-Attention feed row. Slides in from the
 * right as a fixed overlay (matches the partner portal's chat panel
 * pattern), close via X, click-outside, or Escape.
 *
 * Fetches /api/admin/partners once per open to resolve the full
 * partner record + agreement + ticket counts — snapshot view, not
 * live-polled (the main workspace handles live polling).
 */
interface PartnerRecord {
  id: string;
  partnerCode: string;
  firstName: string;
  lastName: string;
  email: string;
  status: string;
  tier: string;
  commissionRate: number;
  agreement?: { status: string; sentDate?: string | null; signedDate?: string | null } | null;
  // admin enrichment fields if present
  w9Status?: string | null;
  createdAt?: string;
}

export default function PartnerContextDrawer({
  open,
  partnerCode,
  onClose,
}: {
  open: boolean;
  partnerCode: string | null;
  onClose: () => void;
}) {
  const [partner, setPartner] = useState<PartnerRecord | null>(null);
  const [ticketCount, setTicketCount] = useState<number>(0);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open || !partnerCode) return;
    setLoading(true);
    setPartner(null);
    Promise.all([
      fetch("/api/admin/partners").then((r) => (r.ok ? r.json() : null)),
      fetch("/api/admin/support").then((r) => (r.ok ? r.json() : null)),
    ])
      .then(([partnersData, ticketsData]) => {
        const match = (partnersData?.partners as PartnerRecord[] | undefined)?.find(
          (p) => p.partnerCode === partnerCode
        );
        setPartner(match || null);
        const openTickets = Array.isArray(ticketsData?.tickets)
          ? (ticketsData.tickets as Array<{ partnerCode: string; status: string }>).filter(
              (t) => t.partnerCode === partnerCode && t.status !== "resolved"
            ).length
          : 0;
        setTicketCount(openTickets);
      })
      .finally(() => setLoading(false));
  }, [open, partnerCode]);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <>
      <div
        className="fixed inset-0 bg-black/40 backdrop-blur-[2px] z-[90]"
        onClick={onClose}
        aria-hidden
      />
      <div
        className="fixed right-0 top-0 bottom-0 w-full sm:w-[380px] z-[91] overflow-y-auto shadow-2xl"
        style={{ background: "var(--app-bg)", borderLeft: "1px solid var(--app-border)" }}
      >
        <div className="sticky top-0 z-10 flex items-center justify-between px-5 py-4" style={{ background: "var(--app-bg)", borderBottom: "1px solid var(--app-border)" }}>
          <div className="font-display text-[15px] font-semibold">Partner</div>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-brand-gold/10 transition-colors theme-text-muted"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        <div className="p-5 space-y-4">
          {loading && (
            <div className="font-body text-sm theme-text-muted">Loading partner…</div>
          )}
          {!loading && !partner && partnerCode && (
            <div className="font-body text-sm theme-text-muted">
              Partner <span className="font-mono">{partnerCode}</span> not found or couldn't be loaded.
            </div>
          )}
          {!loading && !partnerCode && (
            <div className="font-body text-sm theme-text-muted">No partner attached to this item.</div>
          )}
          {!loading && partner && (
            <>
              <div>
                <div className="font-display text-lg font-bold">
                  {partner.firstName} {partner.lastName}
                </div>
                <div className="font-mono text-[12px] theme-text-muted">{partner.partnerCode}</div>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                <span className={`inline-block rounded-full px-2.5 py-0.5 font-body text-[10px] font-semibold tracking-wider uppercase border ${
                  partner.status === "active"
                    ? "bg-green-500/10 text-green-400 border-green-500/20"
                    : partner.status === "pending"
                      ? "bg-amber-500/10 text-amber-400 border-amber-500/20"
                      : "bg-red-500/10 text-red-400 border-red-500/20"
                }`}>
                  {partner.status}
                </span>
                <span className="inline-block rounded-full px-2.5 py-0.5 font-body text-[10px] font-semibold tracking-wider uppercase bg-brand-gold/10 text-brand-gold border border-brand-gold/20">
                  {partner.tier.toUpperCase()}
                </span>
                {typeof partner.commissionRate === "number" && (
                  <span className="font-body text-[12px] theme-text-muted">
                    {Math.round(partner.commissionRate * 100)}%
                  </span>
                )}
              </div>

              <div className="space-y-2 pt-2 border-t border-[var(--app-border)]">
                <div className="font-body text-[10px] uppercase tracking-wider theme-text-muted">Contact</div>
                <div className="font-body text-[13px] text-[var(--app-text-secondary)] break-all">
                  {partner.email || "—"}
                </div>
              </div>

              <div className="space-y-2 pt-2 border-t border-[var(--app-border)]">
                <div className="font-body text-[10px] uppercase tracking-wider theme-text-muted">Agreement</div>
                <div className="font-body text-[13px] text-[var(--app-text-secondary)]">
                  {partner.agreement?.status || "not_sent"}
                  {partner.agreement?.signedDate && (
                    <span className="theme-text-faint"> · signed {new Date(partner.agreement.signedDate).toLocaleDateString()}</span>
                  )}
                  {partner.agreement?.sentDate && !partner.agreement.signedDate && (
                    <span className="theme-text-faint"> · sent {new Date(partner.agreement.sentDate).toLocaleDateString()}</span>
                  )}
                </div>
              </div>

              <div className="space-y-2 pt-2 border-t border-[var(--app-border)]">
                <div className="font-body text-[10px] uppercase tracking-wider theme-text-muted">Open Tickets</div>
                <div className="font-body text-[13px] text-[var(--app-text-secondary)]">
                  {ticketCount} open
                </div>
              </div>

              <div className="flex flex-col gap-2 pt-3 border-t border-[var(--app-border)]">
                <Link
                  href={`/admin/partners/${partner.id}`}
                  className="btn-gold text-[12px] text-center px-4 py-2.5"
                  onClick={onClose}
                >
                  View full profile
                </Link>
                <Link
                  href={`/admin/support?partnerCode=${partner.partnerCode}`}
                  className="font-body text-[12px] text-center border border-[var(--app-border)] rounded-lg px-4 py-2 theme-text-secondary hover:bg-[var(--app-card-bg)] transition-colors"
                  onClick={onClose}
                >
                  Support history
                </Link>
              </div>
            </>
          )}
        </div>
      </div>
    </>
  );
}
