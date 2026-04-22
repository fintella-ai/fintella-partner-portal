/**
 * Pure deal-financial resolution. Cross-calculates missing Firm Fee / Commission
 * rate and amount values from whichever siblings are known on a Deal row.
 *
 * No prisma, no React, no side effects — safe to import from both client and
 * server components and from API routes. Used by /admin/deals and
 * /dashboard/deals to render tables where some deals are missing the rate
 * or the amount but have enough information to compute the missing field.
 *
 * Precedence:
 *   1. If a stored value is present (> 0 for amounts, != null for rates),
 *      use it as-is.
 *   2. Otherwise, compute from the known siblings:
 *        firmFeeRate       = firmFeeAmount / refund
 *        firmFeeAmount     = refund * firmFeeRate
 *        commissionAmount  = firmFeeAmount * commissionRate
 *        commissionRate    = commissionAmount / firmFeeAmount
 *   3. If neither the value nor a way to compute it exists, the rate is
 *      returned as `null` and the amount stays at 0 (so the table cell
 *      can render an em-dash fallback).
 *
 * The `computed*` flags in the output let the caller render computed values
 * differently if desired (e.g. italic) — currently unused but kept for
 * future UX polish.
 */

export interface DealFinancialsInput {
  estimatedRefundAmount: number;
  /** Actual refund received after closing. Preferred over estimated once the
   * deal is closed_won — see `effectiveRefund` logic below. */
  actualRefundAmount?: number | null;
  /** Deal stage string. When "closedwon" with a non-zero actualRefundAmount,
   * commissions and firm-fee computations use the actual refund. */
  stage?: string | null;
  firmFeeRate: number | null;
  firmFeeAmount: number;
  /** Stored per-deal commission rate — usually null unless a custom rate was negotiated. */
  l1CommissionRate?: number | null;
  /**
   * Server-side resolved commission rate (used by /admin/deals — set in
   * /api/admin/deals GET as `l1CommissionRate ?? submittingPartner.commissionRate`).
   */
  effectiveCommissionRate?: number | null;
  l1CommissionAmount: number;
}

export interface DealFinancialsOutput {
  refund: number;
  firmFeeRate: number | null;
  firmFeeAmount: number;
  commissionRate: number | null;
  commissionAmount: number;
  firmFeeRateComputed: boolean;
  firmFeeAmountComputed: boolean;
  commissionRateComputed: boolean;
  commissionAmountComputed: boolean;
}

/**
 * Resolve a deal's financial values by cross-calculating from siblings.
 *
 * @param deal - The Deal row (or a subset of its financial fields)
 * @param partnerRate - Optional commission-rate fallback used by /dashboard/deals
 *                      where the logged-in partner's own commissionRate is the
 *                      authoritative source for the L1 rate on their direct deals.
 */
export function resolveDealFinancials(
  deal: DealFinancialsInput,
  partnerRate?: number | null
): DealFinancialsOutput {
  // Refund base for firm-fee + commission math. Once a deal is closed_won
  // with an actual refund recorded, the actual supersedes the estimate so
  // firm fee and commissions track reality, not the opening ticket. When
  // this happens any stored firmFeeAmount / l1CommissionAmount from earlier
  // (estimated-based) is treated as stale and recomputed below.
  const usingActualRefund =
    deal.stage === "closedwon" &&
    typeof deal.actualRefundAmount === "number" &&
    deal.actualRefundAmount > 0;
  const refund = usingActualRefund
    ? (deal.actualRefundAmount as number)
    : deal.estimatedRefundAmount || 0;

  // ── Firm fee ──
  let firmFeeRate: number | null = deal.firmFeeRate;
  let firmFeeAmount = deal.firmFeeAmount || 0;
  let firmFeeRateComputed = false;
  let firmFeeAmountComputed = false;

  // If amount is missing (0 or null) OR we're overriding with the actual
  // refund post-close, recompute from rate + effective refund. The override
  // case ensures a stale stored amount (written when the deal was based on
  // estimated) gets refreshed once the actual lands.
  if ((firmFeeAmount <= 0 || usingActualRefund) && firmFeeRate != null && refund > 0) {
    firmFeeAmount = refund * firmFeeRate;
    firmFeeAmountComputed = true;
  }
  // If rate is null but we have amount + refund, compute rate
  if (firmFeeRate == null && firmFeeAmount > 0 && refund > 0) {
    firmFeeRate = firmFeeAmount / refund;
    firmFeeRateComputed = true;
  }

  // ── Commission ──
  // Rate sources in order:
  //   1. deal.l1CommissionRate (stored per-deal override, usually null)
  //   2. deal.effectiveCommissionRate (server-resolved by /api/admin/deals)
  //   3. partnerRate (client fallback for /dashboard/deals "me" path)
  let commissionRate: number | null =
    deal.l1CommissionRate ??
    deal.effectiveCommissionRate ??
    partnerRate ??
    null;
  let commissionAmount = deal.l1CommissionAmount || 0;
  let commissionRateComputed = false;
  let commissionAmountComputed = false;

  // If amount is missing OR we're overriding with actual-refund-based firm
  // fee, recompute commission. Same staleness guard as firm fee above.
  if ((commissionAmount <= 0 || usingActualRefund) && commissionRate != null && firmFeeAmount > 0) {
    commissionAmount = firmFeeAmount * commissionRate;
    commissionAmountComputed = true;
  }
  // If rate is still null but we have amount + firm fee, compute rate
  if (commissionRate == null && commissionAmount > 0 && firmFeeAmount > 0) {
    commissionRate = commissionAmount / firmFeeAmount;
    commissionRateComputed = true;
  }

  return {
    refund,
    firmFeeRate,
    firmFeeAmount,
    commissionRate,
    commissionAmount,
    firmFeeRateComputed,
    firmFeeAmountComputed,
    commissionRateComputed,
    commissionAmountComputed,
  };
}

/** Format a rate (0..1) as a rounded percentage string like "20%", or null for "—". */
export function formatRate(rate: number | null): string {
  if (rate == null) return "—";
  return `${(rate * 100).toFixed(0)}%`;
}
