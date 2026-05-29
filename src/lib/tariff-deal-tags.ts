// ---------------------------------------------------------------------------
// Deal tags — segmented pipelines, filters, and Frost-handoff KPI tracking.
//
// Tags live on Deal.tags (String[]). They let the same Deal table power
// multiple pipeline views (Kwong vs Tariff vs internal leads) and track which
// internal Tier-1 deals we escalated to the law-firm partner and how many
// converted — without forking the deal model.
// ---------------------------------------------------------------------------

export const DEAL_TAG = {
  TARIFF: "tariff",
  KWONG: "kwong",
  INTERNAL_LEAD: "internal_lead",
  TIER1: "tier1", // under $1M total duties
  SUBMITTED_TO_FROST: "submitted_to_frost", // escalated to the law-firm partner — FROZEN
  FROST_CONVERTED: "frost_converted", // that escalated deal later closed won
} as const;

export type DealTag = (typeof DEAL_TAG)[keyof typeof DEAL_TAG];

/** The stage marking the end of the internal pipeline — escalation to Frost. */
export const STAGE_SUBMITTED_TO_FROST = "submitted_to_frost";

/** Stages that count as "converted" once a deal has been escalated to Frost. */
export const CONVERTED_STAGES = new Set(["closedwon", "completed"]);

/** Tags applied to a new tariff DIY engagement, given its total estimated refund. */
export function deriveTariffTags(totalEstRefund: number, isTier1: boolean): string[] {
  const tags: string[] = [DEAL_TAG.TARIFF, DEAL_TAG.INTERNAL_LEAD];
  if (isTier1) tags.push(DEAL_TAG.TIER1);
  return tags;
}

/** Merge tags without duplicates. */
export function addTags(existing: string[] | null | undefined, ...add: string[]): string[] {
  return Array.from(new Set([...(existing ?? []), ...add]));
}

/**
 * A deal is FROZEN once it's been submitted to Frost: it cannot be deleted, its
 * frost tag cannot be removed, and it cannot be manually moved out of the
 * submitted-to-Frost stage. (Conversion sync happens via the normal flow, which
 * sets frost_converted — see markFrostConverted.)
 */
export function isFrozen(deal: { tags?: string[] | null; stage?: string | null }): boolean {
  const tags = deal.tags ?? [];
  return tags.includes(DEAL_TAG.SUBMITTED_TO_FROST) || deal.stage === STAGE_SUBMITTED_TO_FROST;
}

/** Has this escalated deal converted (closed won) downstream? */
export function isFrostConverted(deal: { tags?: string[] | null; stage?: string | null; actualRefundAmount?: number | null }): boolean {
  const tags = deal.tags ?? [];
  if (tags.includes(DEAL_TAG.FROST_CONVERTED)) return true;
  if (deal.stage && CONVERTED_STAGES.has(deal.stage)) return true;
  return (deal.actualRefundAmount ?? 0) > 0;
}

/** KPI rollup for the "sent to Frost vs converted" funnel. */
export function frostKpis(deals: Array<{ tags?: string[] | null; stage?: string | null; actualRefundAmount?: number | null; estimatedRefundAmount?: number | null }>) {
  const sent = deals.filter((d) => (d.tags ?? []).includes(DEAL_TAG.SUBMITTED_TO_FROST));
  const converted = sent.filter(isFrostConverted);
  const sentValue = sent.reduce((s, d) => s + (d.estimatedRefundAmount ?? 0), 0);
  const convertedValue = converted.reduce((s, d) => s + (d.actualRefundAmount ?? d.estimatedRefundAmount ?? 0), 0);
  return {
    sentCount: sent.length,
    convertedCount: converted.length,
    conversionRate: sent.length ? Math.round((converted.length / sent.length) * 100) : 0,
    sentValue,
    convertedValue,
  };
}
