/**
 * Isomorphic Deal column registry for the admin Deals page.
 *
 * Safe to import from BOTH the client component
 * (`src/app/(admin)/admin/deals/page.tsx`) and a server API route
 * (`src/app/api/admin/deals/export/route.ts`) — this file MUST stay free of
 * React/JSX/DOM-only imports. `deriveDealWorkflowFields` from
 * `./workflow-engine` is plain TS with no React dependency, so it's safe to
 * import directly here.
 *
 * New Prisma `Deal` fields will NOT automatically appear as columns — this
 * registry needs manual upkeep alongside `prisma/schema.prisma` changes.
 *
 * Note on `externalDealId` vs `external_deal_id`: the schema has both.
 * `externalDealId` (camelCase, `@unique`) is the network-assigned ID set by
 * the primary webhook flow (`/api/webhook/referral`, HubSpot `hs_object_id`
 * or an outbound network's returned ID) and is the one actually populated
 * across the codebase. `external_deal_id` (snake_case) is a secondary,
 * lightly-used field for partner-CRM-side deal IDs on update callbacks. Per
 * the plan's exclusion list, only the camelCase `externalDealId` is
 * registered as a column here.
 */

import { deriveDealWorkflowFields } from "./workflow-engine";

// ─── Keys ───────────────────────────────────────────────────────────────────

export type DealColumnKey =
  // Deal
  | "dealName"
  | "id"
  | "stage"
  | "externalStage"
  | "externalDealId"
  | "createdAt"
  | "updatedAt"
  | "closeDate"
  | "closedLostReason"
  | "tags"
  | "notes"
  | "affiliateNotes"
  | "epLevel1"
  | "idempotencyKey"
  // Partner
  | "partnerName"
  | "partnerCode"
  // Client
  | "clientFirstName"
  | "clientLastName"
  | "clientName"
  | "clientEmail"
  | "clientPhone"
  | "clientTitle"
  // Business
  | "serviceOfInterest"
  | "legalEntityName"
  | "companyEin"
  | "businessStreetAddress"
  | "businessStreetAddress2"
  | "businessCity"
  | "businessState"
  | "businessZip"
  | "businessAddress"
  | "importsGoods"
  | "importCountries"
  | "annualImportValue"
  | "importerOfRecord"
  | "isImporterOfRecord"
  | "productType"
  | "importedProducts"
  // Financial
  | "estimatedRefundAmount"
  | "actualRefundAmount"
  | "firmFeeRate"
  | "firmFeeAmount"
  | "effectiveCommissionRate"
  | "l1CommissionAmount"
  | "l1CommissionRate"
  // Commission
  | "l1CommissionStatus"
  | "l2CommissionAmount"
  | "l2CommissionStatus"
  | "l3CommissionAmount"
  | "l3CommissionStatus"
  // Workflow
  | "entityType"
  | "filerType"
  | "filingStatus"
  | "agreementStatus"
  | "signwellDocumentId"
  | "signedPdfUrl"
  | "signedPdfMirrorUrl"
  // Meeting
  | "consultBookedDate"
  | "consultBookedTime"
  // Payment
  | "paymentReceivedAt"
  | "paymentReceivedBy";

export type DealColumnCategory =
  | "Deal"
  | "Partner"
  | "Client"
  | "Business"
  | "Financial"
  | "Commission"
  | "Workflow"
  | "Meeting"
  | "Payment";

export type DealColumnMeta = {
  key: DealColumnKey;
  label: string;
  category: DealColumnCategory;
  defaultVisible: boolean;
  align?: "left" | "center" | "right";
  width?: number;
};

// ─── Deal-shape type ────────────────────────────────────────────────────────

/**
 * Permissive structural type covering the Prisma `Deal` fields plus the
 * computed fields added by `/api/admin/deals` (partnerName, partnerId,
 * effectiveCommissionRate) and `/api/admin/deals/export`. Deliberately loose
 * (`any`-ish optionals) since this is an internal admin tool consumed from
 * two slightly different shapes (Prisma row vs. client-side `Deal` type in
 * `page.tsx`) — a tight type isn't worth the duplication here.
 */
export type DealLike = {
  id: string;
  dealName: string;
  partnerCode: string;
  clientFirstName?: string | null;
  clientLastName?: string | null;
  clientName?: string | null;
  clientEmail?: string | null;
  clientPhone?: string | null;
  clientTitle?: string | null;
  serviceOfInterest?: string | null;
  legalEntityName?: string | null;
  companyEin?: string | null;
  businessStreetAddress?: string | null;
  businessStreetAddress2?: string | null;
  businessCity?: string | null;
  businessState?: string | null;
  businessZip?: string | null;
  importsGoods?: string | null;
  importCountries?: string | null;
  annualImportValue?: string | null;
  importerOfRecord?: string | null;
  isImporterOfRecord?: boolean | null;
  affiliateNotes?: string | null;
  epLevel1?: string | null;
  stage: string;
  externalStage?: string | null;
  externalDealId?: string | null;
  consultBookedDate?: string | null;
  consultBookedTime?: string | null;
  productType?: string | null;
  importedProducts?: string | null;
  estimatedRefundAmount?: number | null;
  actualRefundAmount?: number | null;
  firmFeeRate?: number | null;
  firmFeeAmount?: number | null;
  l1CommissionRate?: number | null;
  l1CommissionAmount?: number | null;
  l1CommissionStatus?: string | null;
  l2CommissionAmount?: number | null;
  l2CommissionStatus?: string | null;
  l3CommissionAmount?: number | null;
  l3CommissionStatus?: string | null;
  notes?: string | null;
  closedLostReason?: string | null;
  closeDate?: string | Date | null;
  paymentReceivedAt?: string | Date | null;
  paymentReceivedBy?: string | null;
  idempotencyKey?: string | null;
  createdAt?: string | Date | null;
  updatedAt?: string | Date | null;
  tags?: string[] | null;
  serviceFields?: Record<string, unknown> | null;
  // Computed/enriched fields (added by /api/admin/deals or /export route)
  partnerName?: string | null;
  partnerId?: string | null;
  effectiveCommissionRate?: number | null;
};

export type DealColumnCtx = {
  partnerName?: string | null;
  effectiveCommissionRate?: number | null;
  workflowFields?: ReturnType<typeof deriveDealWorkflowFields>;
};

// ─── Registry ───────────────────────────────────────────────────────────────

export const DEAL_COLUMNS: DealColumnMeta[] = [
  // Default-visible 10, in today's on-screen order. `width` values match the
  // fixed widths the table shipped with pre-customization so the default view
  // stays pixel-identical.
  { key: "dealName", label: "Deal", category: "Deal", defaultVisible: true, width: 200 },
  { key: "partnerName", label: "Partner", category: "Partner", defaultVisible: true, width: 140 },
  { key: "serviceOfInterest", label: "Service", category: "Business", defaultVisible: true, width: 130 },
  { key: "stage", label: "Stage", category: "Deal", defaultVisible: true, width: 120 },
  { key: "estimatedRefundAmount", label: "Est. Refund", category: "Financial", defaultVisible: true, align: "right", width: 120 },
  { key: "firmFeeRate", label: "Fee %", category: "Financial", defaultVisible: true, align: "right", width: 70 },
  { key: "firmFeeAmount", label: "Firm Fee", category: "Financial", defaultVisible: true, align: "right", width: 110 },
  { key: "effectiveCommissionRate", label: "Comm %", category: "Financial", defaultVisible: true, align: "right", width: 70 },
  { key: "l1CommissionAmount", label: "L1 Commission", category: "Financial", defaultVisible: true, align: "right", width: 110 },
  { key: "createdAt", label: "Created", category: "Deal", defaultVisible: true, width: 100 },

  // Remaining Deal fields
  { key: "id", label: "Deal ID", category: "Deal", defaultVisible: false },
  { key: "externalStage", label: "External Stage", category: "Deal", defaultVisible: false },
  { key: "externalDealId", label: "External Deal ID", category: "Deal", defaultVisible: false },
  { key: "updatedAt", label: "Updated", category: "Deal", defaultVisible: false },
  { key: "closeDate", label: "Close Date", category: "Deal", defaultVisible: false },
  { key: "closedLostReason", label: "Closed-Lost Reason", category: "Deal", defaultVisible: false },
  { key: "tags", label: "Tags", category: "Deal", defaultVisible: false },
  { key: "notes", label: "Notes", category: "Deal", defaultVisible: false },
  { key: "affiliateNotes", label: "Affiliate Notes", category: "Deal", defaultVisible: false },
  { key: "epLevel1", label: "Enterprise Partner (EP)", category: "Deal", defaultVisible: false },
  { key: "idempotencyKey", label: "Idempotency Key", category: "Deal", defaultVisible: false },

  // Remaining Partner fields
  { key: "partnerCode", label: "Partner Code", category: "Partner", defaultVisible: false },

  // Client
  { key: "clientFirstName", label: "Client First Name", category: "Client", defaultVisible: false },
  { key: "clientLastName", label: "Client Last Name", category: "Client", defaultVisible: false },
  { key: "clientName", label: "Client Name", category: "Client", defaultVisible: false },
  { key: "clientEmail", label: "Client Email", category: "Client", defaultVisible: false },
  { key: "clientPhone", label: "Client Phone", category: "Client", defaultVisible: false },
  { key: "clientTitle", label: "Client Title", category: "Client", defaultVisible: false },

  // Business
  { key: "legalEntityName", label: "Legal Entity / Company", category: "Business", defaultVisible: false },
  { key: "companyEin", label: "Company EIN", category: "Business", defaultVisible: false },
  { key: "businessStreetAddress", label: "Business Address", category: "Business", defaultVisible: false },
  { key: "businessStreetAddress2", label: "Business Address 2", category: "Business", defaultVisible: false },
  { key: "businessCity", label: "Business City", category: "Business", defaultVisible: false },
  { key: "businessState", label: "Business State", category: "Business", defaultVisible: false },
  { key: "businessZip", label: "Business Zip", category: "Business", defaultVisible: false },
  { key: "businessAddress", label: "Business Address (Full)", category: "Business", defaultVisible: false },
  { key: "importsGoods", label: "Imports Goods", category: "Business", defaultVisible: false },
  { key: "importCountries", label: "Import Countries", category: "Business", defaultVisible: false },
  { key: "annualImportValue", label: "Annual Import Value", category: "Business", defaultVisible: false },
  { key: "importerOfRecord", label: "Importer of Record", category: "Business", defaultVisible: false },
  { key: "isImporterOfRecord", label: "Is Importer of Record", category: "Business", defaultVisible: false },
  { key: "productType", label: "Product Type", category: "Business", defaultVisible: false },
  { key: "importedProducts", label: "Imported Products", category: "Business", defaultVisible: false },

  // Remaining Financial
  { key: "actualRefundAmount", label: "Actual Refund", category: "Financial", defaultVisible: false, align: "right" },
  { key: "l1CommissionRate", label: "L1 Commission Rate", category: "Financial", defaultVisible: false, align: "right" },

  // Commission
  { key: "l1CommissionStatus", label: "L1 Commission Status", category: "Commission", defaultVisible: false },
  { key: "l2CommissionAmount", label: "L2 Commission", category: "Commission", defaultVisible: false, align: "right" },
  { key: "l2CommissionStatus", label: "L2 Commission Status", category: "Commission", defaultVisible: false },
  { key: "l3CommissionAmount", label: "L3 Commission", category: "Commission", defaultVisible: false, align: "right" },
  { key: "l3CommissionStatus", label: "L3 Commission Status", category: "Commission", defaultVisible: false },

  // Workflow
  { key: "entityType", label: "Entity Type", category: "Workflow", defaultVisible: false },
  { key: "filerType", label: "Filer Type", category: "Workflow", defaultVisible: false },
  { key: "filingStatus", label: "Filing Status", category: "Workflow", defaultVisible: false },
  { key: "agreementStatus", label: "Agreement Status", category: "Workflow", defaultVisible: false },
  { key: "signwellDocumentId", label: "SignWell Document ID", category: "Workflow", defaultVisible: false },
  { key: "signedPdfUrl", label: "Signed PDF URL", category: "Workflow", defaultVisible: false },
  { key: "signedPdfMirrorUrl", label: "Signed PDF Mirror URL", category: "Workflow", defaultVisible: false },

  // Meeting
  { key: "consultBookedDate", label: "Consult Date", category: "Meeting", defaultVisible: false },
  { key: "consultBookedTime", label: "Consult Time", category: "Meeting", defaultVisible: false },

  // Payment
  { key: "paymentReceivedAt", label: "Payment Received At", category: "Payment", defaultVisible: false },
  { key: "paymentReceivedBy", label: "Payment Received By", category: "Payment", defaultVisible: false },
];

export const DEAL_COLUMNS_BY_KEY: Record<DealColumnKey, DealColumnMeta> = DEAL_COLUMNS.reduce(
  (acc, col) => {
    acc[col.key] = col;
    return acc;
  },
  {} as Record<DealColumnKey, DealColumnMeta>
);

export const DEFAULT_VISIBLE_DEAL_COLUMNS: DealColumnKey[] = DEAL_COLUMNS.filter(
  (c) => c.defaultVisible
).map((c) => c.key);

// ─── Value formatting helpers ───────────────────────────────────────────────

function toIsoDate(value: string | Date | null | undefined): string {
  if (!value) return "";
  const d = value instanceof Date ? value : new Date(value);
  if (isNaN(d.getTime())) return "";
  return d.toISOString().split("T")[0];
}

function toPercent(rate: number | null | undefined): string {
  if (rate == null) return "";
  return `${Math.round(rate * 10000) / 100}%`;
}

function toYesNo(value: boolean | null | undefined): string {
  return value ? "Yes" : "No";
}

function joinList(value: string[] | null | undefined): string {
  if (!value || value.length === 0) return "";
  return value.join("; ");
}

function getWorkflowFields(
  deal: DealLike,
  ctx: DealColumnCtx
): ReturnType<typeof deriveDealWorkflowFields> {
  return ctx.workflowFields ?? deriveDealWorkflowFields(deal as Record<string, unknown>);
}

// ─── csvValue dispatcher ────────────────────────────────────────────────────

/**
 * Returns the plain CSV-ready value for a given column key. Money amounts
 * are returned as raw numbers (the CSV writer formats them); rate/percent
 * fields are pre-formatted as "12.34%" strings to match the convention used
 * by the existing export route. Dates are ISO (`YYYY-MM-DD`). Arrays are
 * joined with "; ". Booleans render as "Yes"/"No".
 */
export function csvValue(
  key: DealColumnKey,
  deal: DealLike,
  ctx: DealColumnCtx = {}
): string | number | null {
  switch (key) {
    // Deal
    case "dealName":
      return deal.dealName ?? "";
    case "id":
      return deal.id ?? "";
    case "stage":
      return deal.stage ?? "";
    case "externalStage":
      return deal.externalStage ?? "";
    case "externalDealId":
      return deal.externalDealId ?? "";
    case "createdAt":
      return toIsoDate(deal.createdAt);
    case "updatedAt":
      return toIsoDate(deal.updatedAt);
    case "closeDate":
      return toIsoDate(deal.closeDate);
    case "closedLostReason":
      return deal.closedLostReason ?? "";
    case "tags":
      return joinList(deal.tags);
    case "notes":
      return deal.notes ?? "";
    case "affiliateNotes":
      return deal.affiliateNotes ?? "";
    case "epLevel1":
      return deal.epLevel1 ?? "";
    case "idempotencyKey":
      return deal.idempotencyKey ?? "";

    // Partner
    case "partnerName":
      return ctx.partnerName ?? deal.partnerName ?? deal.partnerCode ?? "";
    case "partnerCode":
      return deal.partnerCode ?? "";

    // Client
    case "clientFirstName":
      return deal.clientFirstName ?? "";
    case "clientLastName":
      return deal.clientLastName ?? "";
    case "clientName":
      return deal.clientName ?? "";
    case "clientEmail":
      return deal.clientEmail ?? "";
    case "clientPhone":
      return deal.clientPhone ?? "";
    case "clientTitle":
      return deal.clientTitle ?? "";

    // Business
    case "serviceOfInterest":
      return deal.serviceOfInterest ?? "";
    case "legalEntityName":
      return deal.legalEntityName ?? "";
    case "companyEin":
      return deal.companyEin ?? "";
    case "businessStreetAddress":
      return deal.businessStreetAddress ?? "";
    case "businessStreetAddress2":
      return deal.businessStreetAddress2 ?? "";
    case "businessCity":
      return deal.businessCity ?? "";
    case "businessState":
      return deal.businessState ?? "";
    case "businessZip":
      return deal.businessZip ?? "";
    case "businessAddress":
      return (getWorkflowFields(deal, ctx).businessAddress as string) ?? "";
    case "importsGoods":
      return deal.importsGoods ?? "";
    case "importCountries":
      return deal.importCountries ?? "";
    case "annualImportValue":
      return deal.annualImportValue ?? "";
    case "importerOfRecord":
      return deal.importerOfRecord ?? "";
    case "isImporterOfRecord":
      return toYesNo(deal.isImporterOfRecord);
    case "productType":
      return deal.productType ?? "";
    case "importedProducts":
      return joinList(
        Array.isArray(deal.importedProducts)
          ? (deal.importedProducts as unknown as string[])
          : deal.importedProducts
          ? [deal.importedProducts as unknown as string]
          : []
      );

    // Financial
    case "estimatedRefundAmount":
      return deal.estimatedRefundAmount ?? 0;
    case "actualRefundAmount":
      return deal.actualRefundAmount ?? null;
    case "firmFeeRate":
      return toPercent(deal.firmFeeRate);
    case "firmFeeAmount":
      return deal.firmFeeAmount ?? 0;
    case "effectiveCommissionRate":
      return toPercent(ctx.effectiveCommissionRate ?? deal.effectiveCommissionRate ?? deal.l1CommissionRate);
    case "l1CommissionAmount":
      return deal.l1CommissionAmount ?? 0;
    case "l1CommissionRate":
      return toPercent(deal.l1CommissionRate);

    // Commission
    case "l1CommissionStatus":
      return deal.l1CommissionStatus ?? "";
    case "l2CommissionAmount":
      return deal.l2CommissionAmount ?? 0;
    case "l2CommissionStatus":
      return deal.l2CommissionStatus ?? "";
    case "l3CommissionAmount":
      return deal.l3CommissionAmount ?? 0;
    case "l3CommissionStatus":
      return deal.l3CommissionStatus ?? "";

    // Workflow (derived from serviceFields)
    case "entityType":
      return (getWorkflowFields(deal, ctx).entityType as string) ?? "";
    case "filerType":
      return (getWorkflowFields(deal, ctx).filerType as string) ?? "";
    case "filingStatus":
      return (getWorkflowFields(deal, ctx).filingStatus as string) ?? "";
    case "agreementStatus":
      return (getWorkflowFields(deal, ctx).agreementStatus as string) ?? "";
    case "signwellDocumentId":
      return (getWorkflowFields(deal, ctx).signwellDocumentId as string) ?? "";
    case "signedPdfUrl":
      return (getWorkflowFields(deal, ctx).signedPdfUrl as string) ?? "";
    case "signedPdfMirrorUrl":
      return (getWorkflowFields(deal, ctx).signedPdfMirrorUrl as string) ?? "";

    // Meeting
    case "consultBookedDate":
      return deal.consultBookedDate ?? "";
    case "consultBookedTime":
      return deal.consultBookedTime ?? "";

    // Payment
    case "paymentReceivedAt":
      return toIsoDate(deal.paymentReceivedAt);
    case "paymentReceivedBy":
      return deal.paymentReceivedBy ?? "";

    default: {
      // Exhaustiveness guard — TS will error above if a DealColumnKey case
      // is missing from this switch.
      const _exhaustive: never = key;
      return _exhaustive;
    }
  }
}
