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
 * PLACEHOLDER: reuses the existing Kwong consent template until the
 * lawyer-reviewed tariff release template is built. Override with
 * SIGNWELL_TARIFF_CONSENT_TEMPLATE_ID.
 */
export const TARIFF_CONSENT_TEMPLATE_ID =
  process.env.SIGNWELL_TARIFF_CONSENT_TEMPLATE_ID ||
  "ae6392fc-11cb-4a03-aa17-bff87bd11abb";

/**
 * Optional dedicated SignWell API Application ID for the tariff flow (its own
 * branding + post-sign redirect URL). Falls back to the global app id when unset.
 */
export const TARIFF_SIGNWELL_APP_ID =
  process.env.SIGNWELL_TARIFF_APP_ID || undefined;

/**
 * Upfront fee (in CENTS) for a fully-substantiated DIY self-file dossier.
 * Server-authoritative — never trust a client-supplied amount.
 * PLACEHOLDER default $500; override with TARIFF_UPFRONT_FEE_CENTS.
 */
export const TARIFF_UPFRONT_FEE_CENTS = (() => {
  const n = parseInt(process.env.TARIFF_UPFRONT_FEE_CENTS || "", 10);
  return Number.isFinite(n) && n > 0 ? n : 50_000;
})();

/** Engagement state stored inside Deal.serviceFields (no schema migration). */
export interface TariffEngagementState {
  pathway: "diy"; // only DIY is live; broker / law_firm / buyout deferred
  pricingModel: "upfront";
  consentTemplateId?: string;
  signwellDocumentId?: string;
  signwellSigningUrl?: string | null;
  signwellStatus?: "pending" | "signed" | "expired";
  upfrontFeeCents?: number;
  upfrontStatus?: "unpaid" | "paid";
  upfrontTxnId?: string;
  paidAt?: string;
  dossierId?: string | null;
}
