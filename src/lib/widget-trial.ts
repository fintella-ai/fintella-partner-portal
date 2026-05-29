// ---------------------------------------------------------------------------
// Widget self-serve trial-key helpers.
//
// A trial key lets a CRM/TMS prospect run the Tariff Intelligence Engine from
// their own workflow and get a PARTIAL analysis (eligibility + deadlines +
// counts) — the refund dollar amounts stay locked until they upgrade to a
// paid plan via the existing engage flow.
//
// Key format: `ftk_<keyId>.<secret>`
//   - keyId   — non-secret, stored plaintext + @unique → O(1) findUnique lookup
//   - secret  — the actual credential, stored only as a bcrypt hash
//
// This is the standard prefixed-token pattern (cf. Stripe-style keys): fast
// lookup by the public id, then a slow KDF (bcrypt) verify of the secret half.
// We deliberately bcrypt the secret (not a plain digest) so a DB leak can't be
// used to recover or verify live keys offline.
// ---------------------------------------------------------------------------

import crypto from "crypto";
import { hash, compare } from "bcryptjs";
import type { FilingMethod } from "./tariff-calculator";

const TRIAL_KEY_PREFIX = "ftk_";

/** Generate a fresh trial key plus its decomposed parts. */
export function generateTrialKey(): { apiKey: string; keyId: string; secret: string } {
  const keyId = crypto.randomBytes(8).toString("hex"); // 16 hex chars — public lookup id
  const secret = crypto.randomBytes(24).toString("hex"); // 48 hex chars — the credential
  return { apiKey: `${TRIAL_KEY_PREFIX}${keyId}.${secret}`, keyId, secret };
}

/** Split a presented key into its lookup id + secret, or null if malformed. */
export function parseTrialKey(apiKey: string): { keyId: string; secret: string } | null {
  if (typeof apiKey !== "string" || !apiKey.startsWith(TRIAL_KEY_PREFIX)) return null;
  const body = apiKey.slice(TRIAL_KEY_PREFIX.length);
  const parts = body.split(".");
  if (parts.length !== 2) return null;
  const [keyId, secret] = parts;
  if (!keyId || !secret) return null;
  return { keyId, secret };
}

/** Bcrypt-hash the secret half for storage (cost 10, matching widget-auth). */
export async function hashSecret(secret: string): Promise<string> {
  return hash(secret, 10);
}

/** Verify a presented key against the stored bcrypt hash of its secret. */
export async function verifyTrialKey(apiKey: string, secretHash: string): Promise<boolean> {
  const parsed = parseTrialKey(apiKey);
  if (!parsed) return false;
  try {
    return await compare(parsed.secret, secretHash);
  } catch {
    return false;
  }
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
