"use client";

import LevelTag from "./LevelTag";

export type TreePartner = {
  id: string;
  partnerCode: string;
  firstName: string;
  lastName: string;
  status: string;
  commissionRate?: number; // e.g. 0.25, 0.20, 0.15, 0.10
  children: TreePartner[];
};

function PersonSilhouette({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" fill="none" className="text-[var(--app-text-faint)]">
      <circle cx="20" cy="14" r="7" fill="currentColor" />
      <ellipse cx="20" cy="32" rx="12" ry="8" fill="currentColor" />
    </svg>
  );
}

// Card border + fill per tier, matching the LevelTag gold/silver/bronze palette.
// Keeping this local because the DownlineTree cards want a lighter fill than
// the tag chip itself (tag sits on top of the card and needs to pop).
function tierCard(depth: number): { tier: "l1" | "l2" | "l3"; border: string; bg: string } {
  if (depth === 0) return { tier: "l1", border: "border-[rgba(196,160,80,0.35)]", bg: "bg-[rgba(196,160,80,0.08)]" };
  if (depth === 1) return { tier: "l2", border: "border-[rgba(200,205,215,0.3)]", bg: "bg-[rgba(200,205,215,0.06)]" };
  return { tier: "l3", border: "border-[rgba(184,115,51,0.35)]", bg: "bg-[rgba(184,115,51,0.08)]" };
}

const statusDot: Record<string, string> = {
  active: "bg-green-400",
  pending: "bg-yellow-400",
  inactive: "bg-white/30",
  blocked: "bg-red-400",
};

function TreeNode({ partner, depth, isMobile }: { partner: TreePartner; depth: number; isMobile: boolean }) {
  const card = tierCard(depth);
  const hasChildren = partner.children.length > 0;

  return (
    <div className="flex flex-col items-center">
      {/* Node card */}
      <div className={`relative border ${card.border} ${card.bg} rounded-xl ${isMobile ? "px-2.5 py-2.5 min-w-[100px] max-w-[130px]" : "px-4 py-3 min-w-[150px]"} text-center`}>
        {/* Tier badge — shared LevelTag so the palette stays in lockstep with the partners table */}
        <div className="absolute -top-2.5 left-1/2 -translate-x-1/2">
          <LevelTag tier={card.tier} size="xs" />
        </div>

        {/* Silhouette */}
        <div className="flex justify-center mb-1.5 mt-1">
          <div className={`${isMobile ? "w-8 h-8" : "w-10 h-10"} rounded-full bg-[var(--app-input-bg)] border border-[var(--app-border)] flex items-center justify-center overflow-hidden`}>
            <PersonSilhouette size={isMobile ? 24 : 28} />
          </div>
        </div>

        {/* Name */}
        <div className={`font-body ${isMobile ? "text-[11px]" : "text-[12px]"} font-semibold text-[var(--app-text)] leading-tight truncate min-w-0`}>
          {partner.firstName} {partner.lastName}
        </div>

        {/* Rate badge */}
        {partner.commissionRate !== undefined && (
          <div className="mt-1">
            <span className={`font-body ${isMobile ? "text-[9px]" : "text-[10px]"} font-semibold text-brand-gold bg-brand-gold/10 rounded-full px-1.5 py-0.5`}>
              {Math.round(partner.commissionRate * 100)}%
            </span>
          </div>
        )}

        {/* Code + status */}
        <div className="flex items-center justify-center gap-1.5 mt-1">
          <span className={`w-1.5 h-1.5 rounded-full ${statusDot[partner.status] || statusDot.active}`} />
          <span className={`font-mono ${isMobile ? "text-[9px]" : "text-[10px]"} text-[var(--app-text-muted)]`}>{partner.partnerCode}</span>
        </div>
      </div>

      {/* Connector line down */}
      {hasChildren && (
        <div className="w-px h-5 bg-[var(--app-input-bg)]" />
      )}

      {/* Children */}
      {hasChildren && (
        <div className="relative">
          {/* Horizontal connector bar */}
          {partner.children.length > 1 && (
            <div className="absolute top-0 left-1/2 -translate-x-1/2 h-px bg-[var(--app-input-bg)]"
              style={{
                width: `calc(100% - ${isMobile ? "120px" : "150px"})`,
              }}
            />
          )}

          <div className={`flex ${isMobile ? "gap-3" : "gap-5"} justify-center`}>
            {partner.children.map((child) => (
              <div key={child.id} className="flex flex-col items-center">
                {/* Vertical connector from horizontal bar to child */}
                <div className="w-px h-5 bg-[var(--app-input-bg)]" />
                <TreeNode partner={child} depth={depth + 1} isMobile={isMobile} />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

interface Props {
  root: TreePartner;
  isMobile?: boolean;
}

export default function DownlineTree({ root, isMobile = false }: Props) {
  if (root.children.length === 0) {
    return (
      <div className="text-center py-10">
        <PersonSilhouette size={40} />
        <div className="font-body text-[13px] text-[var(--app-text-muted)] mt-3">No downline partners to display.</div>
      </div>
    );
  }

  return (
    <div className={`${isMobile ? "overflow-x-auto pb-4 -mx-4 px-4" : "overflow-x-auto"}`}>
      <div className={`inline-flex justify-center ${isMobile ? "min-w-max px-2" : "w-full"} py-6`}>
        <TreeNode partner={root} depth={0} isMobile={isMobile} />
      </div>
    </div>
  );
}
