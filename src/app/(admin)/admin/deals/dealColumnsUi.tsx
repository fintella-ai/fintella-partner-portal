"use client";

/**
 * Render functions for every `DealColumnKey` on the admin Deals table.
 *
 * The 10 keys that make up `DEFAULT_VISIBLE_DEAL_COLUMNS` (dealName,
 * partnerName, serviceOfInterest, stage, estimatedRefundAmount, firmFeeRate,
 * firmFeeAmount, effectiveCommissionRate, l1CommissionAmount, createdAt)
 * render EXACTLY the JSX that `src/app/(admin)/admin/deals/page.tsx` used to
 * hardcode inline (same classNames, same conditional styling, same
 * StageBadge/PartnerLink usage) — this is a pure lift, not a rewrite, so
 * there is zero visual regression when the integration step swaps the
 * hardcoded 10 cells for `DEAL_COLUMN_RENDERERS[key](deal, ctx)`.
 *
 * The remaining ~51 keys get a simple, consistent plain-cell treatment
 * (money / percent / date / boolean / list / truncated-text) — this is an
 * internal admin tool, so these don't need bespoke design.
 *
 * `Record<DealColumnKey, ...>` below is what makes this file "complete" —
 * TypeScript errors at compile time if a key from `dealColumns.ts` is ever
 * added without a matching renderer here.
 */

import type { ReactNode } from "react";
import type { DealColumnKey, DealLike } from "@/lib/dealColumns";
import { DEAL_COLUMNS_BY_KEY } from "@/lib/dealColumns";
import type { deriveDealWorkflowFields } from "@/lib/workflow-engine";
import type { DealFinancialsOutput } from "@/lib/dealCalc";
import { formatRate } from "@/lib/dealCalc";
import { fmt$, fmtDate, fmtTime } from "@/lib/format";
import StageBadge from "@/components/ui/StageBadge";
import PartnerLink from "@/components/ui/PartnerLink";

export type DealColumnRenderCtx = {
  /** Resolved financials for this row — output of `resolveDealFinancials(deal)`. */
  fin: DealFinancialsOutput;
  /** Derived `serviceFields`-backed workflow values — output of `deriveDealWorkflowFields(deal)`. */
  workflowFields?: ReturnType<typeof deriveDealWorkflowFields>;
};

// ─── Generic plain-cell helpers (for the ~51 non-default columns) ─────────

function alignClass(key: DealColumnKey): string {
  const align = DEAL_COLUMNS_BY_KEY[key]?.align;
  if (align === "right") return "text-right";
  if (align === "center") return "text-center";
  return "text-left";
}

function textCell(value: string | null | undefined, key: DealColumnKey): ReactNode {
  const v = value && String(value).trim() ? String(value) : "";
  return (
    <div
      className={`font-body text-[12px] text-[var(--app-text-secondary)] truncate ${alignClass(key)}`}
      title={v || undefined}
    >
      {v || "—"}
    </div>
  );
}

/** Longer free-text fields (notes, affiliateNotes) — truncated with full text on hover. */
function longTextCell(value: string | null | undefined, key: DealColumnKey): ReactNode {
  const v = value && String(value).trim() ? String(value) : "";
  return (
    <div
      className={`font-body text-[12px] text-[var(--app-text-secondary)] truncate max-w-[260px] ${alignClass(key)}`}
      title={v || undefined}
    >
      {v || "—"}
    </div>
  );
}

function monoTextCell(value: string | null | undefined, key: DealColumnKey): ReactNode {
  const v = value && String(value).trim() ? String(value) : "";
  return (
    <div
      className={`font-mono text-[11px] text-[var(--app-text-muted)] truncate ${alignClass(key)}`}
      title={v || undefined}
    >
      {v || "—"}
    </div>
  );
}

function moneyCell(value: number | null | undefined, key: DealColumnKey): ReactNode {
  return (
    <div className={`font-body text-[13px] text-[var(--app-text-secondary)] ${alignClass(key)}`}>
      {value == null ? "—" : fmt$(value)}
    </div>
  );
}

function percentCell(rate: number | null | undefined, key: DealColumnKey): ReactNode {
  return (
    <div className={`font-body text-[12px] text-[var(--app-text-muted)] ${alignClass(key)}`}>
      {formatRate(rate ?? null)}
    </div>
  );
}

function dateCell(value: string | Date | null | undefined, key: DealColumnKey): ReactNode {
  return (
    <div className={`font-body text-[12px] text-[var(--app-text-muted)] ${alignClass(key)}`}>
      {fmtDate(value instanceof Date ? value.toISOString() : value)}
    </div>
  );
}

function dateTimeCell(value: string | Date | null | undefined, key: DealColumnKey): ReactNode {
  const iso = value instanceof Date ? value.toISOString() : value;
  return (
    <div className={`font-body text-[12px] text-[var(--app-text-muted)] ${alignClass(key)}`}>
      <div>{fmtDate(iso)}</div>
      <div className="text-[11px] text-[var(--app-text-faint)] mt-0.5">{fmtTime(iso)}</div>
    </div>
  );
}

function boolCell(value: boolean | null | undefined, key: DealColumnKey): ReactNode {
  return (
    <div className={`font-body text-[11px] ${alignClass(key)}`}>
      <span
        className={`inline-block px-2 py-0.5 rounded-full font-semibold ${
          value ? "bg-emerald-500/15 text-emerald-400" : "bg-[var(--app-input-bg)] text-[var(--app-text-muted)]"
        }`}
      >
        {value ? "Yes" : "No"}
      </span>
    </div>
  );
}

function listCell(value: string[] | null | undefined, key: DealColumnKey): ReactNode {
  if (!value || value.length === 0) {
    return <div className={`font-body text-[12px] text-[var(--app-text-muted)] ${alignClass(key)}`}>—</div>;
  }
  return (
    <div className={`flex flex-wrap gap-1 ${alignClass(key) === "text-center" ? "justify-center" : alignClass(key) === "text-right" ? "justify-end" : ""}`}>
      {value.map((tag, i) => (
        <span
          key={i}
          className="font-body text-[10px] px-1.5 py-0.5 rounded-full bg-[var(--app-input-bg)] text-[var(--app-text-secondary)] border border-[var(--app-border)] truncate max-w-[100px]"
          title={tag}
        >
          {tag}
        </span>
      ))}
    </div>
  );
}

function statusCell(value: string | null | undefined, key: DealColumnKey): ReactNode {
  const v = value && String(value).trim() ? String(value) : "";
  return (
    <div className={alignClass(key)}>
      {v ? (
        <span className="inline-block font-body text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full bg-[var(--app-input-bg)] text-[var(--app-text-secondary)] border border-[var(--app-border)]">
          {v}
        </span>
      ) : (
        <span className="font-body text-[12px] text-[var(--app-text-muted)]">—</span>
      )}
    </div>
  );
}

function workflowTextCell(
  deal: DealLike,
  ctx: DealColumnRenderCtx,
  field: "entityType" | "filerType" | "filingStatus" | "agreementStatus" | "signwellDocumentId" | "signedPdfUrl" | "signedPdfMirrorUrl",
  key: DealColumnKey
): ReactNode {
  const value = (ctx.workflowFields?.[field] as string | undefined) ?? "";
  if (field === "signedPdfUrl" || field === "signedPdfMirrorUrl") {
    return (
      <div className={`font-body text-[11px] truncate max-w-[220px] ${alignClass(key)}`} title={value || undefined}>
        {value ? (
          <a
            href={value}
            target="_blank"
            rel="noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="text-brand-gold hover:underline"
          >
            View PDF
          </a>
        ) : (
          "—"
        )}
      </div>
    );
  }
  return textCell(value, key);
}

// ─── Renderer registry ──────────────────────────────────────────────────────

export const DEAL_COLUMN_RENDERERS: Record<
  DealColumnKey,
  (deal: DealLike, ctx: DealColumnRenderCtx) => ReactNode
> = {
  // ── Default-visible 10 — verbatim lift from page.tsx (pre-refactor) ──
  dealName: (deal) => (
    <div>
      <div className="font-body text-[13px] text-[var(--app-text)] font-medium truncate">{deal.dealName}</div>
      <div className="font-body text-[11px] text-[var(--app-text-muted)] truncate">
        {deal.clientName || deal.clientEmail || "—"}
      </div>
    </div>
  ),

  partnerName: (deal) => (
    <div className="text-center">
      {deal.partnerId ? (
        <>
          <PartnerLink
            partnerId={deal.partnerId}
            className="font-body text-[12px] text-[var(--app-text-secondary)] truncate inline-block max-w-full"
          >
            {deal.partnerName}
          </PartnerLink>
          {deal.partnerName !== deal.partnerCode && (
            <div className="font-mono text-[10px] text-[var(--app-text-muted)] mt-0.5 truncate">{deal.partnerCode}</div>
          )}
        </>
      ) : (
        <>
          <span className="font-body text-[12px] text-[var(--app-text-muted)] italic truncate inline-block max-w-full">
            Unknown
          </span>
          <div className="font-mono text-[10px] text-[var(--app-text-muted)] mt-0.5 truncate">{deal.partnerCode}</div>
        </>
      )}
    </div>
  ),

  serviceOfInterest: (deal) => (
    <div
      className="font-body text-[11px] text-[var(--app-text-secondary)] text-center truncate"
      title={deal.serviceOfInterest || ""}
    >
      {(deal.serviceOfInterest || "Tariff Refund Support").replace(/\s*\(Tier [12]\)/, "")}
      {deal.serviceOfInterest !== "Kwong Penalty Abatement (ERC)" && (
        <span className={`font-medium ${deal.isImporterOfRecord ? "text-emerald-400" : "text-amber-400"}`}>
          {" "}
          ({deal.isImporterOfRecord ? "Tier 1" : "Tier 2"})
        </span>
      )}
    </div>
  ),

  stage: (deal) => (
    <div className="text-center">
      <StageBadge stage={deal.stage} />
    </div>
  ),

  estimatedRefundAmount: (_deal, ctx) => (
    <div className="font-body text-[13px] text-[var(--app-text)] text-center">{fmt$(ctx.fin.refund)}</div>
  ),

  firmFeeRate: (_deal, ctx) => (
    <div className="font-body text-[12px] text-[var(--app-text-muted)] text-center">{formatRate(ctx.fin.firmFeeRate)}</div>
  ),

  firmFeeAmount: (_deal, ctx) => (
    <div className="font-body text-[13px] text-[var(--app-text-secondary)] text-center">{fmt$(ctx.fin.firmFeeAmount)}</div>
  ),

  effectiveCommissionRate: (_deal, ctx) => (
    <div className="font-body text-[12px] text-[var(--app-text-muted)] text-center">{formatRate(ctx.fin.commissionRate)}</div>
  ),

  l1CommissionAmount: (_deal, ctx) => (
    <div className="font-display text-[14px] font-semibold text-brand-gold text-center">{fmt$(ctx.fin.commissionAmount)}</div>
  ),

  createdAt: (deal) => (
    <div className="font-body text-[12px] text-[var(--app-text-muted)] text-center">
      <div>{fmtDate(deal.createdAt as string)}</div>
      <div className="text-[11px] text-[var(--app-text-faint)] mt-0.5">{fmtTime(deal.createdAt as string)}</div>
    </div>
  ),

  // ── Remaining Deal fields ──
  id: (deal, _ctx) => monoTextCell(deal.id, "id"),
  externalStage: (deal) => textCell(deal.externalStage, "externalStage"),
  externalDealId: (deal) => monoTextCell(deal.externalDealId, "externalDealId"),
  updatedAt: (deal) => dateTimeCell(deal.updatedAt, "updatedAt"),
  closeDate: (deal) => dateCell(deal.closeDate, "closeDate"),
  closedLostReason: (deal) => longTextCell(deal.closedLostReason, "closedLostReason"),
  tags: (deal) => listCell(deal.tags, "tags"),
  notes: (deal) => longTextCell(deal.notes, "notes"),
  affiliateNotes: (deal) => longTextCell(deal.affiliateNotes, "affiliateNotes"),
  epLevel1: (deal) => textCell(deal.epLevel1, "epLevel1"),
  idempotencyKey: (deal) => monoTextCell(deal.idempotencyKey, "idempotencyKey"),

  // ── Remaining Partner fields ──
  partnerCode: (deal) => monoTextCell(deal.partnerCode, "partnerCode"),

  // ── Client ──
  clientFirstName: (deal) => textCell(deal.clientFirstName, "clientFirstName"),
  clientLastName: (deal) => textCell(deal.clientLastName, "clientLastName"),
  clientName: (deal) => textCell(deal.clientName, "clientName"),
  clientEmail: (deal) => textCell(deal.clientEmail, "clientEmail"),
  clientPhone: (deal) => textCell(deal.clientPhone, "clientPhone"),
  clientTitle: (deal) => textCell(deal.clientTitle, "clientTitle"),

  // ── Business ──
  legalEntityName: (deal) => textCell(deal.legalEntityName, "legalEntityName"),
  companyEin: (deal) => monoTextCell(deal.companyEin, "companyEin"),
  businessStreetAddress: (deal) => textCell(deal.businessStreetAddress, "businessStreetAddress"),
  businessStreetAddress2: (deal) => textCell(deal.businessStreetAddress2, "businessStreetAddress2"),
  businessCity: (deal) => textCell(deal.businessCity, "businessCity"),
  businessState: (deal) => textCell(deal.businessState, "businessState"),
  businessZip: (deal) => textCell(deal.businessZip, "businessZip"),
  businessAddress: (_deal, ctx) => textCell((ctx.workflowFields?.businessAddress as string) ?? "", "businessAddress"),
  importsGoods: (deal) => textCell(deal.importsGoods, "importsGoods"),
  importCountries: (deal) => textCell(deal.importCountries, "importCountries"),
  annualImportValue: (deal) => textCell(deal.annualImportValue, "annualImportValue"),
  importerOfRecord: (deal) => textCell(deal.importerOfRecord, "importerOfRecord"),
  isImporterOfRecord: (deal) => boolCell(deal.isImporterOfRecord, "isImporterOfRecord"),
  productType: (deal) => textCell(deal.productType, "productType"),
  importedProducts: (deal) => {
    const raw = deal.importedProducts as unknown;
    const list = Array.isArray(raw) ? (raw as string[]) : raw ? [String(raw)] : [];
    return listCell(list, "importedProducts");
  },

  // ── Remaining Financial ──
  actualRefundAmount: (deal) => moneyCell(deal.actualRefundAmount, "actualRefundAmount"),
  l1CommissionRate: (deal) => percentCell(deal.l1CommissionRate, "l1CommissionRate"),

  // ── Commission ──
  l1CommissionStatus: (deal) => statusCell(deal.l1CommissionStatus, "l1CommissionStatus"),
  l2CommissionAmount: (deal) => moneyCell(deal.l2CommissionAmount, "l2CommissionAmount"),
  l2CommissionStatus: (deal) => statusCell(deal.l2CommissionStatus, "l2CommissionStatus"),
  l3CommissionAmount: (deal) => moneyCell(deal.l3CommissionAmount, "l3CommissionAmount"),
  l3CommissionStatus: (deal) => statusCell(deal.l3CommissionStatus, "l3CommissionStatus"),

  // ── Workflow (derived from serviceFields via deriveDealWorkflowFields) ──
  entityType: (deal, ctx) => workflowTextCell(deal, ctx, "entityType", "entityType"),
  filerType: (deal, ctx) => workflowTextCell(deal, ctx, "filerType", "filerType"),
  filingStatus: (deal, ctx) => workflowTextCell(deal, ctx, "filingStatus", "filingStatus"),
  agreementStatus: (deal, ctx) => workflowTextCell(deal, ctx, "agreementStatus", "agreementStatus"),
  signwellDocumentId: (deal, ctx) => workflowTextCell(deal, ctx, "signwellDocumentId", "signwellDocumentId"),
  signedPdfUrl: (deal, ctx) => workflowTextCell(deal, ctx, "signedPdfUrl", "signedPdfUrl"),
  signedPdfMirrorUrl: (deal, ctx) => workflowTextCell(deal, ctx, "signedPdfMirrorUrl", "signedPdfMirrorUrl"),

  // ── Meeting ──
  consultBookedDate: (deal) => textCell(deal.consultBookedDate, "consultBookedDate"),
  consultBookedTime: (deal) => textCell(deal.consultBookedTime, "consultBookedTime"),

  // ── Payment ──
  paymentReceivedAt: (deal) => dateTimeCell(deal.paymentReceivedAt, "paymentReceivedAt"),
  paymentReceivedBy: (deal) => textCell(deal.paymentReceivedBy, "paymentReceivedBy"),
};
