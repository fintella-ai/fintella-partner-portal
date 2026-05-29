// ---------------------------------------------------------------------------
// Widget self-serve trial-key helpers.
//
// A trial key lets a CRM/TMS prospect run the Tariff Intelligence Engine from
// their own workflow and get a PARTIAL analysis (eligibility + deadlines +
// counts) — the refund dollar amounts stay locked until they upgrade to a
// paid plan via the existing engage flow.
//
// Keys are hashed with sha256 (deterministic) so the calculate endpoint can
// look them up directly with prisma.widgetTrialKey.findUnique({ where: { keyHash } }).
// (Contrast widget-auth.ts, which bcrypts widget API keys behind a JWT session.)
// ---------------------------------------------------------------------------

import crypto from "crypto";
import type { FilingMethod } from "./tariff-calculator";

const TRIAL_KEY_PREFIX = "ftk_";

/** Generate a fresh trial key: `ftk_` + 32 random bytes (64 hex chars). */
export function generateTrialKey(): string {
  return `${TRIAL_KEY_PREFIX}${crypto.randomBytes(32).toString("hex")}`;
}

/** Deterministic sha256 hex digest — stored as `keyHash` (@unique) for lookup. */
export function hashTrialKey(apiKey: string): string {
  return crypto.createHash("sha256").update(apiKey).digest("hex");
}

/** Display hint: leading ellipsis + last 8 chars (matches widget-auth convention). */
export function getTrialKeyHint(apiKey: string): string {
  return `...${apiKey.slice(-8)}`;
}

// ── Partial-result gating ────────────────────────────────────────────────────

/** Full single-entry calculation, as produced internally by the calculate route. */
export interface FullTariffResult {
  countryOfOrigin: string;
  entryDate: string;
  enteredValue: number;
  // Locked behind a paid plan ↓
  ieepaRate: number;
  rateName: string;
  rateBreakdown: { fentanyl?: number; reciprocal?: number; section122?: number };
  ieepaDuty: number;
  estimatedInterest: number;
  estimatedRefund: number;
  // Always visible ↓
  eligibility: string;
  eligibilityReason: string;
  deadlineDays?: number;
  isUrgent?: boolean;
  deadlineDate?: Date;
  filingMethod?: FilingMethod;
}

/** What a trial key sees: eligibility + deadlines + counts, refund $ locked. */
export interface PartialTariffResult {
  countryOfOrigin: string;
  entryDate: string;
  enteredValue: number;
  eligibility: string;
  eligibilityReason: string;
  deadlineDays?: number;
  isUrgent?: boolean;
  deadlineDate?: Date;
  filingMethod?: FilingMethod;
  refundLocked: true;
}

/**
 * Strip the rate + dollar fields from a full result, leaving only the
 * eligibility/deadline teaser. Anything that would let the caller reconstruct
 * the refund (the rate, the breakdown, the duty/interest/refund amounts) is
 * dropped — not just nulled — so it never leaves the server.
 */
export function toPartialTariffResult(full: FullTariffResult): PartialTariffResult {
  return {
    countryOfOrigin: full.countryOfOrigin,
    entryDate: full.entryDate,
    enteredValue: full.enteredValue,
    eligibility: full.eligibility,
    eligibilityReason: full.eligibilityReason,
    deadlineDays: full.deadlineDays,
    isUrgent: full.isUrgent,
    deadlineDate: full.deadlineDate,
    filingMethod: full.filingMethod,
    refundLocked: true,
  };
}

// ── Embed snippet ────────────────────────────────────────────────────────────

/** One-line embed snippet a prospect can paste into their CRM/TMS. */
export function buildEmbedSnippet(apiKey: string, origin: string): string {
  return `<script src="${origin}/widget/tariff-trial.js" data-trial-key="${apiKey}"></script>`;
}
