// ---------------------------------------------------------------------------
// Tariff Intelligence Engine — Pre-Submission Audit Engine
//
// Pure validation functions for customs entry data against CAPE filing rules.
// No database calls, no side-effects, no framework imports.
// ---------------------------------------------------------------------------

import { validateEntryNumber } from "./tariff-calculator";
import { IEEPA_START_DATE, IEEPA_END_DATE } from "./tariff-countries";

// ── Types ──────────────────────────────────────────────────────────────────

export interface AuditCheck {
  id: string;
  category: "format" | "entry" | "eligibility" | "risk";
  severity: "error" | "warning" | "info";
  passed: boolean;
  message: string;
  detail?: string;
  entryIndex?: number;
  entryNumber?: string;
  fix?: string;
}

export interface AuditResult {
  passed: boolean;
  score: number;
  checks: AuditCheck[];
  errors: AuditCheck[];
  warnings: AuditCheck[];
  info: AuditCheck[];
  summary: {
    total: number;
    passed: number;
    failed: number;
    warnings: number;
  };
}

export interface AuditEntry {
  entryNumber?: string | null;
  entryDate: string | Date;
  entryType?: string | null;
  countryOfOrigin: string;
  enteredValue: number;
  liquidationDate?: string | Date | null;
  liquidationStatus?: string;
  hasAdCvd?: boolean;
  ieepaRate?: number;
  eligibility?: string;
}

// ── Constants ──────────────────────────────────────────────────────────────

const MAX_ENTRIES = 9999;
const ENTRY_NUMBER_PATTERN = /^[A-Z0-9]{3}-\d{7}-\d$/;
const EXCLUDED_ENTRY_TYPES = new Set(["08", "09", "23", "47"]);
const PROTEST_WINDOW_DAYS = 80;
const URGENT_THRESHOLD_DAYS = 14;

// ── Helpers ────────────────────────────────────────────────────────────────

function cleanEntryNumber(raw: string): string {
  // Normalize: strip whitespace, uppercase, ensure XXX-XXXXXXX-X format
  const stripped = raw.replace(/\s/g, "").toUpperCase();
  // If already has dashes in right places, return as-is
  if (ENTRY_NUMBER_PATTERN.test(stripped)) return stripped;
  // If 11 alphanumeric chars without dashes, insert them
  const noDashes = stripped.replace(/-/g, "");
  if (noDashes.length === 11) {
    return `${noDashes.slice(0, 3)}-${noDashes.slice(3, 10)}-${noDashes.slice(10)}`;
  }
  return stripped; // return as-is for format check to catch
}

function toDate(v: string | Date): Date {
  return v instanceof Date ? v : new Date(v);
}

function daysBetween(a: Date, b: Date): number {
  const msPerDay = 86_400_000;
  return Math.round((b.getTime() - a.getTime()) / msPerDay);
}

function escapeCSV(value: string): string {
  if (value.includes(",") || value.includes('"') || value.includes("\n")) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

// ── Main Audit Function ────────────────────────────────────────────────────

/**
 * Runs all CAPE pre-submission audit checks against an array of entries.
 * Pure function — no database calls, no side effects.
 */
export function runAudit(entries: AuditEntry[]): AuditResult {
  const checks: AuditCheck[] = [];

  // ── 1. Format checks ──────────────────────────────────────────────────

  checks.push({
    id: "FMT_EMPTY",
    category: "format",
    severity: "error",
    passed: entries.length > 0,
    message: entries.length > 0
      ? `${entries.length} entries provided`
      : "No entries provided — at least one entry is required",
  });

  checks.push({
    id: "FMT_MAX_ENTRIES",
    category: "format",
    severity: "error",
    passed: entries.length <= MAX_ENTRIES,
    message: entries.length <= MAX_ENTRIES
      ? `Entry count (${entries.length}) within CAPE batch limit of ${MAX_ENTRIES}`
      : `Entry count (${entries.length}) exceeds CAPE batch limit of ${MAX_ENTRIES}`,
    fix: entries.length > MAX_ENTRIES
      ? "Split into multiple CAPE submissions of 9,999 entries each"
      : undefined,
  });

  // ── 2. Per-entry checks ───────────────────────────────────────────────

  const seenEntryNumbers = new Map<string, number>(); // entryNumber -> first index
  const filerCodes = new Set<string>();

  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i];
    const entryNum = entry.entryNumber?.trim() || null;

    // ENT_FORMAT — entry number format check
    if (entryNum) {
      const cleaned = cleanEntryNumber(entryNum);
      const formatOk = ENTRY_NUMBER_PATTERN.test(cleaned);
      checks.push({
        id: "ENT_FORMAT",
        category: "entry",
        severity: "error",
        passed: formatOk,
        message: formatOk
          ? `Entry ${cleaned} matches XXX-XXXXXXX-X format`
          : `Entry "${entryNum}" does not match XXX-XXXXXXX-X format`,
        entryIndex: i,
        entryNumber: entryNum,
        fix: !formatOk
          ? "Entry numbers must be 3-char filer code, 7-digit number, 1 check digit (e.g., ABC-1234567-8)"
          : undefined,
      });

      // ENT_CHECK_DIGIT — mod-10 check digit validation
      if (formatOk) {
        const checkDigitOk = validateEntryNumber(cleaned);
        checks.push({
          id: "ENT_CHECK_DIGIT",
          category: "entry",
          severity: "error",
          passed: checkDigitOk,
          message: checkDigitOk
            ? `Entry ${cleaned} check digit valid`
            : `Entry ${cleaned} has invalid mod-10 check digit`,
          entryIndex: i,
          entryNumber: cleaned,
          fix: !checkDigitOk
            ? "Verify the entry number — the last digit must be a valid CBP mod-10 check digit"
            : undefined,
        });
      }

      // ENT_DUPLICATE — duplicate detection
      const cleanedKey = cleanEntryNumber(entryNum).toUpperCase();
      if (seenEntryNumbers.has(cleanedKey)) {
        checks.push({
          id: "ENT_DUPLICATE",
          category: "entry",
          severity: "error",
          passed: false,
          message: `Duplicate entry number ${cleanedKey} (first seen at row ${seenEntryNumbers.get(cleanedKey)! + 1})`,
          entryIndex: i,
          entryNumber: cleanedKey,
          fix: "Remove duplicate entry — CAPE will reject files with duplicate entry numbers",
        });
      } else {
        seenEntryNumbers.set(cleanedKey, i);
      }

      // Track filer codes for ENT_FILER_CODE check
      const filerCode = cleanedKey.slice(0, 3);
      filerCodes.add(filerCode);
    }

    // ── 3. Eligibility checks ─────────────────────────────────────────────

    const entryDate = toDate(entry.entryDate);

    // ELIG_DATE_RANGE
    const dateInRange = entryDate >= IEEPA_START_DATE && entryDate <= IEEPA_END_DATE;
    checks.push({
      id: "ELIG_DATE_RANGE",
      category: "eligibility",
      severity: "error",
      passed: dateInRange,
      message: dateInRange
        ? `Entry date ${entryDate.toISOString().slice(0, 10)} within IEEPA period`
        : `Entry date ${entryDate.toISOString().slice(0, 10)} outside IEEPA period (Feb 1, 2025 – Feb 23, 2026)`,
      entryIndex: i,
      entryNumber: entryNum || undefined,
      fix: !dateInRange
        ? "Only entries between February 1, 2025 and February 23, 2026 qualify for IEEPA refunds"
        : undefined,
    });

    // ELIG_ENTRY_TYPE
    const entryType = entry.entryType || "01";
    const typeOk = !EXCLUDED_ENTRY_TYPES.has(entryType);
    checks.push({
      id: "ELIG_ENTRY_TYPE",
      category: "eligibility",
      severity: "error",
      passed: typeOk,
      message: typeOk
        ? `Entry type ${entryType} is eligible for CAPE`
        : `Entry type ${entryType} is excluded from CAPE Phase 1`,
      entryIndex: i,
      entryNumber: entryNum || undefined,
      fix: !typeOk
        ? `Entry types 08, 09, 23, and 47 are excluded from CAPE Phase 1 automated refunds`
        : undefined,
    });

    // ELIG_IEEPA_RATE
    const hasRate = (entry.ieepaRate ?? 0) > 0;
    checks.push({
      id: "ELIG_IEEPA_RATE",
      category: "eligibility",
      severity: "error",
      passed: hasRate,
      message: hasRate
        ? `IEEPA rate ${((entry.ieepaRate ?? 0) * 100).toFixed(1)}% applies`
        : "No IEEPA tariff rate found — entry may not have been subject to IEEPA duties",
      entryIndex: i,
      entryNumber: entryNum || undefined,
      fix: !hasRate
        ? "Verify the country of origin and entry date — only goods subject to IEEPA tariffs qualify for refund"
        : undefined,
    });

    // ELIG_LIQUIDATION — 80-day protest window
    if (entry.liquidationDate) {
      const liqDate = toDate(entry.liquidationDate);
      const deadlineDate = new Date(liqDate);
      deadlineDate.setDate(deadlineDate.getDate() + PROTEST_WINDOW_DAYS);
      const now = new Date();
      const daysRemaining = daysBetween(now, deadlineDate);
      const windowOk = daysRemaining >= 0;

      checks.push({
        id: "ELIG_LIQUIDATION",
        category: "eligibility",
        severity: "error",
        passed: windowOk,
        message: windowOk
          ? `Protest window open — ${daysRemaining} days remaining (deadline ${deadlineDate.toISOString().slice(0, 10)})`
          : `Protest window EXPIRED ${Math.abs(daysRemaining)} days ago — cannot file CAPE refund`,
        entryIndex: i,
        entryNumber: entryNum || undefined,
        fix: !windowOk
          ? "The 80-day protest window from liquidation has expired. Consult legal counsel for CIT options."
          : undefined,
      });

      // RISK_DEADLINE — urgent if <= 14 days
      if (windowOk && daysRemaining <= URGENT_THRESHOLD_DAYS) {
        checks.push({
          id: "RISK_DEADLINE",
          category: "risk",
          severity: "warning",
          passed: true, // it's a warning, not a failure
          message: `URGENT: Only ${daysRemaining} days remaining to file protest for entry ${entryNum || `at row ${i + 1}`}`,
          detail: `Liquidation date: ${liqDate.toISOString().slice(0, 10)}, deadline: ${deadlineDate.toISOString().slice(0, 10)}`,
          entryIndex: i,
          entryNumber: entryNum || undefined,
        });
      }
    }

    // ELIG_ADCVD — unliquidated AD/CVD entries excluded
    if (entry.hasAdCvd) {
      const isUnliquidated = !entry.liquidationDate;
      const adcvdOk = !isUnliquidated;
      checks.push({
        id: "ELIG_ADCVD",
        category: "eligibility",
        severity: "error",
        passed: adcvdOk,
        message: adcvdOk
          ? "AD/CVD entry is liquidated — eligible for CAPE"
          : "Unliquidated AD/CVD entry is excluded from CAPE Phase 1",
        entryIndex: i,
        entryNumber: entryNum || undefined,
        fix: !adcvdOk
          ? "Unliquidated AD/CVD entries require legal counsel — cannot use CAPE automated refund"
          : undefined,
      });
    }
  }

  // ── ENT_FILER_CODE — multi-broker detection (once, not per-entry) ─────
  if (filerCodes.size > 1) {
    checks.push({
      id: "ENT_FILER_CODE",
      category: "entry",
      severity: "warning",
      passed: true, // warning, not error
      message: `Multiple filer codes detected: ${Array.from(filerCodes).join(", ")}`,
      detail: "This may indicate entries from multiple brokers — verify all entries belong to the same importer",
    });
  }

  // ── 4. Risk checks (global, show once) ────────────────────────────────

  checks.push({
    id: "RISK_OFFSET",
    category: "risk",
    severity: "info",
    passed: true,
    message: "Government may offset refunds against outstanding CBP debts per 19 CFR §24.72",
    detail: "If the importer has any outstanding duties, penalties, or fees owed to CBP, the refund amount may be reduced by those amounts.",
  });

  checks.push({
    id: "RISK_ACH",
    category: "risk",
    severity: "info",
    passed: true,
    message: "Verify importer has ACH enrollment for refunds (separate from payment ACH)",
    detail: "Refund ACH enrollment is different from the ACH used for duty payments. The importer must enroll separately to receive electronic refund deposits.",
  });

  if (filerCodes.size > 1) {
    checks.push({
      id: "RISK_MULTI_BROKER",
      category: "risk",
      severity: "warning",
      passed: true,
      message: `Entries span ${filerCodes.size} different filer codes — may require coordination across brokers`,
      detail: `Filer codes: ${Array.from(filerCodes).join(", ")}. Each broker may need to file separately.`,
    });
  }

  // ── Score calculation ─────────────────────────────────────────────────

  const errorChecks = checks.filter((c) => c.severity === "error");
  const passedErrors = errorChecks.filter((c) => c.passed).length;
  const totalErrors = errorChecks.length;
  const score = totalErrors > 0 ? Math.round((passedErrors / totalErrors) * 100) : 100;

  const errors = checks.filter((c) => c.severity === "error" && !c.passed);
  const warnings = checks.filter((c) => c.severity === "warning");
  const info = checks.filter((c) => c.severity === "info");

  return {
    passed: errors.length === 0,
    score,
    checks,
    errors,
    warnings,
    info,
    summary: {
      total: checks.length,
      passed: checks.filter((c) => c.passed).length,
      failed: errors.length,
      warnings: warnings.length,
    },
  };
}

// ── Clean CAPE Entry Generation ────────────────────────────────────────────

/**
 * Filters entries to those that passed all error-level checks AND have
 * eligibility = "eligible" AND have a valid entry number.
 * Returns just the entry numbers for CAPE CSV generation.
 */
export function generateCleanCapeEntries(
  entries: AuditEntry[],
  auditResult: AuditResult,
): string[] {
  // Collect indices of entries that have any error-level failure
  const failedIndices = new Set<number>();
  for (const check of auditResult.errors) {
    if (check.entryIndex !== undefined) {
      failedIndices.add(check.entryIndex);
    }
  }

  const cleanNumbers: string[] = [];

  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i];

    // Skip entries with errors
    if (failedIndices.has(i)) continue;

    // Must be eligible
    if (entry.eligibility !== "eligible") continue;

    // Must have a valid entry number
    if (!entry.entryNumber?.trim()) continue;

    const cleaned = cleanEntryNumber(entry.entryNumber.trim());
    if (ENTRY_NUMBER_PATTERN.test(cleaned) && validateEntryNumber(cleaned)) {
      cleanNumbers.push(cleaned);
    }
  }

  return cleanNumbers;
}

// ── CAPE CSV Generation ────────────────────────────────────────────────────

/**
 * Generates a CAPE-ready CSV file with one entry number per line.
 * UTF-8 encoding, LF line endings.
 */
export function formatCapeCSV(entryNumbers: string[]): string {
  const lines = ["Entry Number", ...entryNumbers];
  return lines.join("\n");
}

// ── Audit Report CSV ───────────────────────────────────────────────────────

/**
 * Generates a detailed audit report CSV with one row per check.
 */
export function generateAuditReportCSV(auditResult: AuditResult): string {
  const header = "Check ID,Category,Severity,Passed,Message,Entry Number,Fix";
  const rows = auditResult.checks.map((check) => {
    return [
      escapeCSV(check.id),
      escapeCSV(check.category),
      escapeCSV(check.severity),
      check.passed ? "Yes" : "No",
      escapeCSV(check.message),
      escapeCSV(check.entryNumber || ""),
      escapeCSV(check.fix || ""),
    ].join(",");
  });

  return [header, ...rows].join("\n");
}
