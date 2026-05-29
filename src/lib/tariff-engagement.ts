// ---------------------------------------------------------------------------
// Tariff Refund — DIY engagement config
//
// Single source of truth for the small-deal (Tier-1) DIY self-file + upfront-fee
// pathway. Everything here is swappable via env vars so the placeholder consent
// template, dedicated SignWell app, and pricing can be replaced without code edits.
// ---------------------------------------------------------------------------

/** Service label stored on the Deal. Kept out of any partner-firm naming. */
export const TARIFF_DIY_SERVICE = "IEEPA Tariff Refund (DIY)";

/**
 * SignWell template for the client consent / data-sharing + release.
 * Defaults to the dedicated "Tariff Refund Workflow" template. Override with
 * SIGNWELL_TARIFF_CONSENT_TEMPLATE_ID.
 */
export const TARIFF_CONSENT_TEMPLATE_ID =
  process.env.SIGNWELL_TARIFF_CONSENT_TEMPLATE_ID ||
  "e1088c29-798a-4056-97be-edfde067c970";

/**
 * Signer placeholder role names on the template. SignWell 422s if a recipient's
 * role doesn't match a template placeholder name, so these are env-overridable
 * to match whatever the "Tariff Refund Workflow" template declares.
 * Defaults match the Kwong template's naming (Taxpayer + Fintella cosigner).
 */
export const TARIFF_SIGNER_ROLE = process.env.SIGNWELL_TARIFF_SIGNER_ROLE || "Taxpayer";
export const TARIFF_COSIGNER_ROLE = process.env.SIGNWELL_TARIFF_COSIGNER_ROLE || "Fintella";

/** Template field api_id that receives the signer's printed name (if present). */
export const TARIFF_SIGNER_NAME_FIELD =
  process.env.SIGNWELL_TARIFF_SIGNER_NAME_FIELD || "TextField_1";

/**
 * Optional dedicated SignWell API Application ID for the tariff flow (its own
 * branding + post-sign redirect URL). Falls back to the global app id when unset.
 */
export const TARIFF_SIGNWELL_APP_ID =
  process.env.SIGNWELL_TARIFF_APP_ID || undefined;

function centsEnv(name: string, fallback: number): number {
  const n = parseInt(process.env[name] || "", 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

/**
 * Upfront fee (in CENTS) for a fully-substantiated DIY self-file dossier.
 * Server-authoritative — never trust a client-supplied amount.
 * Default $500; override with TARIFF_UPFRONT_FEE_CENTS.
 */
export const TARIFF_UPFRONT_FEE_CENTS = centsEnv("TARIFF_UPFRONT_FEE_CENTS", 50_000);

/** One-time fee (CENTS) to unlock the full widget for CRM/TMS importers. Default $1,500. */
export const TARIFF_WIDGET_UNLOCK_FEE_CENTS = centsEnv("TARIFF_WIDGET_UNLOCK_FEE_CENTS", 150_000);

/** Per-submission fee (CENTS) for the widget pay-as-you-go option. Default $99. */
export const TARIFF_WIDGET_PER_SUBMISSION_CENTS = centsEnv("TARIFF_WIDGET_PER_SUBMISSION_CENTS", 9_900);

/**
 * Per-file volume tiers — the per-file price (CENTS) drops as the file count
 * rises (the bracket rate applies to ALL files in the order). The 1-file rate
 * is a premium "sample" price so a buyer can try one before committing to the
 * cheaper bulk rate. Override via TARIFF_PERFILE_TIERS (JSON: [[minFiles,cents],…]).
 * Research-informed defaults (well under the 15–30% contingency norm at volume).
 */
export const TARIFF_PERFILE_TIERS: Array<{ minFiles: number; perFileCents: number }> = (() => {
  try {
    const raw = process.env.TARIFF_PERFILE_TIERS;
    if (raw) {
      const parsed = JSON.parse(raw) as [number, number][];
      const tiers = parsed.map(([minFiles, perFileCents]) => ({ minFiles, perFileCents }));
      if (tiers.length) return tiers.sort((a, b) => a.minFiles - b.minFiles);
    }
  } catch { /* fall through to defaults */ }
  return [
    { minFiles: 1, perFileCents: 25_000 },  // $250 — single sample (premium)
    { minFiles: 2, perFileCents: 15_000 },  // $150/file
    { minFiles: 6, perFileCents: 9_900 },   // $99/file
    { minFiles: 21, perFileCents: 5_900 },  // $59/file
  ];
})();

/**
 * Contingency alternative — basis points of total estimated refund. Industry
 * band is 15/20%–33%; default 20%. Override with TARIFF_REFUND_PERCENT_BPS.
 */
export const TARIFF_REFUND_PERCENT_BPS = (() => {
  const n = parseInt(process.env.TARIFF_REFUND_PERCENT_BPS || "", 10);
  return Number.isFinite(n) && n > 0 && n < 10_000 ? n : 2_000;
})();

/** Hard ceiling on any combined backend contingency — never exceed 33%. */
export const TARIFF_MAX_BACKEND_BPS = 3_300;

function bpsEnv(name: string, fallback: number): number {
  const n = parseInt(process.env[name] || "", 10);
  return Number.isFinite(n) && n > 0 && n < 10_000 ? n : fallback;
}

/** Dual model: a small upfront fee + a backend contingency when the refund hits. */
export const TARIFF_DUAL_UPFRONT_FEE_CENTS = centsEnv("TARIFF_DUAL_UPFRONT_FEE_CENTS", 25_000); // $250
export const TARIFF_DUAL_BACKEND_BPS = bpsEnv("TARIFF_DUAL_BACKEND_BPS", 1_000); // 10%

/** Add-on: human legal review by the law-firm partner — upfront fee + backend contingency. */
export const TARIFF_LEGAL_REVIEW_FEE_CENTS = centsEnv("TARIFF_LEGAL_REVIEW_FEE_CENTS", 49_900); // $499
export const TARIFF_LEGAL_REVIEW_BACKEND_BPS = bpsEnv("TARIFF_LEGAL_REVIEW_BACKEND_BPS", 500); // +5%

/** Add-on: guaranteed litigation-support rider — secures the filing if CBP fights it. */
export const TARIFF_LITIGATION_GUARANTEE_FEE_CENTS = centsEnv("TARIFF_LITIGATION_GUARANTEE_FEE_CENTS", 99_900); // $999

/** Pricing models the engagement supports. */
export type TariffPricingModel =
  | "upfront"               // flat done-for-you file
  | "widget_onetime"        // one-time full widget unlock (CRM/TMS)
  | "widget_per_submission" // flat per-submission widget fee
  | "per_file_volume"       // per-file price that drops with file count
  | "refund_percent"        // % of estimated refund (contingency)
  | "dual"                  // small upfront + backend contingency
  | "buyout";               // we buy the claim (75–85¢); PENDING audit + underwriting

/** Optional add-ons stacked on any base model. */
export type TariffAddOn = "legal_review" | "litigation_guarantee";

/** Resolve the per-file rate (CENTS) for a given total file count, using the volume tiers. */
export function perFileCentsForCount(fileCount: number): number {
  const n = Math.max(1, fileCount);
  let rate = TARIFF_PERFILE_TIERS[0]?.perFileCents ?? TARIFF_WIDGET_PER_SUBMISSION_CENTS;
  for (const t of TARIFF_PERFILE_TIERS) if (n >= t.minFiles) rate = t.perFileCents;
  return rate;
}

export interface PerFileQuote {
  fileCount: number;
  perFileCents: number;   // volume rate for the full set
  fullCents: number;      // commit-now total (all files at the volume rate)
  sampleCents: number;    // premium price to unlock ONE file first (1-file tier rate)
  remainderCents: number; // to unlock the rest after sampling (full − sample, sample credited)
}

/**
 * "Try one, then unlock the batch" quote. The sample is charged at the premium
 * 1-file rate; the remainder credits the sample so committing after sampling
 * costs the same as committing upfront.
 */
export function perFileQuote(fileCount: number): PerFileQuote {
  const n = Math.max(1, fileCount);
  const perFileCents = perFileCentsForCount(n);
  const fullCents = perFileCents * n;
  const sampleCents = perFileCentsForCount(1);
  const remainderCents = Math.max(0, fullCents - sampleCents);
  return { fileCount: n, perFileCents, fullCents, sampleCents, remainderCents };
}

/**
 * Server-authoritative fee (CENTS) for a pricing model — never trust the client.
 * Volume/percentage models read from `ctx` (file count, estimated refund).
 */
export function feeForPricingModel(
  model: TariffPricingModel,
  ctx: { fileCount?: number; refundCents?: number } = {},
): number {
  switch (model) {
    case "widget_onetime": return TARIFF_WIDGET_UNLOCK_FEE_CENTS;
    case "widget_per_submission": return TARIFF_WIDGET_PER_SUBMISSION_CENTS;
    case "per_file_volume": {
      const files = Math.max(1, ctx.fileCount ?? 1);
      return perFileCentsForCount(files) * files;
    }
    case "refund_percent":
      return 0; // contingency: nothing upfront
    case "buyout":
      // Upfront is placed as an AUTH HOLD (not captured): voided if the buyout
      // is approved (fee netted from payout), captured if declined.
      return TARIFF_UPFRONT_FEE_CENTS;
    case "dual":
      return TARIFF_DUAL_UPFRONT_FEE_CENTS;
    case "upfront":
    default: return TARIFF_UPFRONT_FEE_CENTS;
  }
}

/** Buyout discount band — we advance this share of the refund (pending underwriting). */
export const TARIFF_BUYOUT_LOW_BPS = bpsEnv("TARIFF_BUYOUT_LOW_BPS", 7_500);  // 75¢
export const TARIFF_BUYOUT_HIGH_BPS = bpsEnv("TARIFF_BUYOUT_HIGH_BPS", 8_500); // 85¢

/** Models that require audit + underwriting before they can be executed. */
export function requiresUnderwriting(model: TariffPricingModel): boolean {
  return model === "buyout";
}

export interface PricingLineItem {
  label: string;
  upfrontCents?: number;
  backendBps?: number;
}

export interface EngagementPricing {
  model: TariffPricingModel;
  addOns: TariffAddOn[];
  /** Charged now (NMI Collect.js), server-authoritative. */
  upfrontCents: number;
  /** Charged from the refund when it hits CBP (contingency), in basis points. */
  backendBps: number;
  lineItems: PricingLineItem[];
}

/**
 * Single source of truth for what a client owes: combines a base pricing model
 * with optional add-ons into an upfront charge + a backend contingency (bps).
 * Pure + server-authoritative — the engage route stores the result and the pay
 * route charges `upfrontCents`; `backendBps` is recorded for when the refund hits.
 */
export function computeEngagementPricing(
  model: TariffPricingModel,
  opts: { fileCount?: number; refundCents?: number; addOns?: TariffAddOn[] } = {},
): EngagementPricing {
  const addOns = opts.addOns ?? [];
  const lineItems: PricingLineItem[] = [];

  const baseUpfront = feeForPricingModel(model, opts);
  const baseLabel: Record<TariffPricingModel, string> = {
    upfront: "Done-for-you substantiated file",
    widget_onetime: "Widget — full unlock (one-time)",
    widget_per_submission: "Widget — per submission",
    per_file_volume: `Per-file (${opts.fileCount ?? 1} file${(opts.fileCount ?? 1) === 1 ? "" : "s"})`,
    refund_percent: "Contingency — % of refund",
    dual: "Dual — upfront portion",
    buyout: "Buyout — pending audit & underwriting",
  };
  lineItems.push({ label: baseLabel[model], upfrontCents: baseUpfront });

  let backendBps = 0;
  if (model === "refund_percent") backendBps += TARIFF_REFUND_PERCENT_BPS;
  if (model === "dual") backendBps += TARIFF_DUAL_BACKEND_BPS;
  if (backendBps > 0) lineItems.push({ label: "Backend contingency (on refund)", backendBps });

  if (model === "buyout") {
    // Upfront placed as an authorization HOLD (see baseUpfront). Voided if the
    // buyout is approved (fee netted from the payout); captured if declined.
    lineItems.push({
      label: `Buyout payout ${(TARIFF_BUYOUT_LOW_BPS / 100).toFixed(0)}–${(TARIFF_BUYOUT_HIGH_BPS / 100).toFixed(0)}¢/$ — pending audit & underwriting; upfront held, not charged`,
    });
  }

  if (addOns.includes("legal_review")) {
    lineItems.push({
      label: "Add-on: attorney legal review",
      upfrontCents: TARIFF_LEGAL_REVIEW_FEE_CENTS,
      backendBps: TARIFF_LEGAL_REVIEW_BACKEND_BPS,
    });
    backendBps += TARIFF_LEGAL_REVIEW_BACKEND_BPS;
  }
  if (addOns.includes("litigation_guarantee")) {
    lineItems.push({
      label: "Add-on: guaranteed litigation support",
      upfrontCents: TARIFF_LITIGATION_GUARANTEE_FEE_CENTS,
    });
  }

  // Enforce the 33% combined backend ceiling.
  backendBps = Math.min(backendBps, TARIFF_MAX_BACKEND_BPS);

  const upfrontCents = lineItems.reduce((s, li) => s + (li.upfrontCents ?? 0), 0);
  return { model, addOns, upfrontCents, backendBps, lineItems };
}

/** CRM/TMS platforms the widget integrates with — drives the fallback upsell question. */
export const TARIFF_WIDGET_PLATFORMS = [
  "CargoWise",
  "Descartes",
  "Flexport",
  "Magaya",
  "QuickBooks / NetSuite",
  "Other CRM / TMS",
];

/** Engagement state stored inside Deal.serviceFields (no schema migration). */
export interface TariffEngagementState {
  pathway: "diy" | "widget"; // DIY self-file or widget (CRM/TMS) add-on; broker/law_firm/buyout deferred
  pricingModel: TariffPricingModel;
  consentTemplateId?: string;
  signwellDocumentId?: string;
  signwellSigningUrl?: string | null;
  signwellStatus?: "pending" | "signed" | "expired";
  upfrontFeeCents?: number;
  upfrontStatus?: "unpaid" | "paid";
  upfrontTxnId?: string;
  paidAt?: string;
  dossierId?: string | null;
  addOns?: TariffAddOn[];
  backendBps?: number;       // contingency taken from the refund when it hits
  platform?: string | null;  // CRM/TMS for the widget pathway
  underwritingStatus?: "pending" | "approved" | "declined"; // buyout audit gate
  // Per-file sample-gate state
  fileCount?: number;
  sampleCents?: number;
  fullCents?: number;
  remainderCents?: number;
  sampleStatus?: "unpaid" | "paid"; // one-file sample unlocked
  fullStatus?: "unpaid" | "paid";   // all files unlocked
}
