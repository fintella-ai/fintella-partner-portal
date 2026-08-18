// ---------------------------------------------------------------------------
// Buyout underwriting — risk scoring (pure functions, no DB/framework imports).
//
// Turns the audit/eligibility signals already produced by the Tariff
// Intelligence Engine into a 0–100 risk score, a recommended buyout payout rate
// (within the configured band), and a suggested decision. This is a DECISION
// SUPPORT tool — the admin underwriting queue surfaces it; a human still
// approves/declines. The actual lending payout execution is out of scope until
// the lending-partner docs land.
// ---------------------------------------------------------------------------

import type { FilingMethod } from "./tariff-calculator";
import { TARIFF_BUYOUT_LOW_BPS, TARIFF_BUYOUT_HIGH_BPS } from "./tariff-engagement";

export interface RiskInput {
  /** Eligibility status from checkEligibility (e.g. "eligible" | "excluded_*" ). */
  eligibilityStatus: string;
  /** How the claim would be filed — cape_phase1 is cleanest, litigation riskiest. */
  filingMethod?: FilingMethod;
  isAdCvd?: boolean;       // antidumping/countervailing complications
  isDrawback?: boolean;    // CAPE rejects drawback entries
  isLiquidated?: boolean;  // entry already liquidated (protest/litigation territory)
  deadlineDays?: number | null; // days until the filing deadline (negative = passed)
  needsReview?: boolean;   // engine flagged for human review (mixed 232/301 etc.)
  estimatedRefundCents?: number; // claim size — informational, lightly weighted
}

export interface RiskFactor {
  label: string;
  points: number; // risk points contributed (higher = riskier)
}

export type RiskBand = "low" | "medium" | "high";
export type RiskDecision = "auto_approve" | "review" | "auto_decline";

export interface RiskScore {
  score: number;              // 0–100, higher = riskier
  band: RiskBand;
  recommendedBuyoutBps: number; // within [TARIFF_BUYOUT_LOW_BPS, TARIFF_BUYOUT_HIGH_BPS]
  decision: RiskDecision;     // suggestion only — admin makes the call
  factors: RiskFactor[];      // explainable breakdown
}

// ── Dossier → RiskInput extraction ───────────────────────────────────────────
// Structural (not Prisma) types so this stays pure + unit-testable.

export interface RiskEntryLike {
  eligibility?: string;
  eligibilityReason?: string | null;
  liquidationStatus?: string;
  hasAdCvd?: boolean;
  needsReview?: boolean;
  deadlineDays?: number | null;
}

export interface RiskDossierLike {
  eligibleCount?: number;
  deadlineDays?: number | null;
  totalEstRefund?: number | null;
  totalEstInterest?: number | null;
}

const DRAWBACK_RE = /drawback/i;

/** Aggregate a dossier + its entries into a single worst-case RiskInput. */
export function deriveRiskInput(dossier: RiskDossierLike, entries: RiskEntryLike[]): RiskInput {
  const anyEligible =
    (dossier.eligibleCount ?? 0) > 0 || entries.some((e) => e.eligibility === "eligible");
  const isLiquidated = entries.some((e) => e.liquidationStatus === "liquidated");

  const entryDeadlines = entries
    .map((e) => e.deadlineDays)
    .filter((d): d is number => typeof d === "number");
  const deadlineDays =
    typeof dossier.deadlineDays === "number"
      ? dossier.deadlineDays
      : entryDeadlines.length
        ? Math.min(...entryDeadlines)
        : null;

  let filingMethod: FilingMethod = "cape_phase1";
  if (isLiquidated) filingMethod = deadlineDays != null && deadlineDays <= 0 ? "litigation" : "protest";

  return {
    eligibilityStatus: anyEligible ? "eligible" : "excluded",
    filingMethod,
    isAdCvd: entries.some((e) => e.hasAdCvd),
    isDrawback: entries.some(
      (e) => DRAWBACK_RE.test(e.eligibilityReason ?? "") || DRAWBACK_RE.test(e.eligibility ?? ""),
    ),
    isLiquidated,
    needsReview: entries.some((e) => e.needsReview),
    deadlineDays,
    estimatedRefundCents: Math.round(
      ((dossier.totalEstRefund ?? 0) + (dossier.totalEstInterest ?? 0)) * 100,
    ),
  };
}

const FILING_RISK: Record<FilingMethod, number> = {
  cape_phase1: 0,
  cape_phase2: 5,  // slightly higher risk: filing-order sensitivity (must file CAPE before Type 09)
  protest: 15,
  litigation: 35,
  none: 60,
};

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

/**
 * Compute an explainable buyout risk score. Risk points accumulate from each
 * adverse signal, clamp to 0–100, then map to a band, a recommended payout rate
 * (riskier → lower advance), and a suggested decision.
 */
export function computeRiskScore(input: RiskInput): RiskScore {
  const factors: RiskFactor[] = [];

  // Ineligible claims dominate — no refund means nothing to buy.
  if (input.eligibilityStatus && input.eligibilityStatus !== "eligible") {
    factors.push({ label: `Not eligible (${input.eligibilityStatus})`, points: 60 });
  }

  const fm = input.filingMethod;
  if (fm && FILING_RISK[fm] > 0) {
    factors.push({ label: `Filing method: ${fm}`, points: FILING_RISK[fm] });
  }

  if (input.isAdCvd) factors.push({ label: "AD/CVD goods involved", points: 25 });
  if (input.isDrawback) factors.push({ label: "Entry on drawback (CAPE rejects)", points: 30 });
  if (input.isLiquidated) factors.push({ label: "Entry already liquidated", points: 10 });
  if (input.needsReview) factors.push({ label: "Flagged for human review", points: 15 });

  const dd = input.deadlineDays;
  if (typeof dd === "number") {
    if (dd <= 0) factors.push({ label: "Filing deadline has passed", points: 40 });
    else if (dd <= 15) factors.push({ label: `Deadline imminent (${dd}d)`, points: 20 });
    else if (dd <= 45) factors.push({ label: `Deadline near (${dd}d)`, points: 5 });
  }

  const score = clamp(
    factors.reduce((s, f) => s + f.points, 0),
    0,
    100,
  );

  const band: RiskBand = score <= 25 ? "low" : score <= 55 ? "medium" : "high";
  const decision: RiskDecision =
    score <= 25 ? "auto_approve" : score <= 55 ? "review" : "auto_decline";

  // Linear map: 0 risk → HIGH payout, 100 risk → LOW payout.
  const span = TARIFF_BUYOUT_HIGH_BPS - TARIFF_BUYOUT_LOW_BPS;
  const recommendedBuyoutBps = Math.round(
    clamp(TARIFF_BUYOUT_HIGH_BPS - (score / 100) * span, TARIFF_BUYOUT_LOW_BPS, TARIFF_BUYOUT_HIGH_BPS),
  );

  return { score, band, recommendedBuyoutBps, decision, factors };
}
