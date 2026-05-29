// src/lib/__tests__/tariff-audit.test.ts
//
// Pre-submission audit engine test suite — verifies CAPE filing-rule checks,
// the 180-day protest deadline, and the new drawback / USMCA / 232 / 301 checks.
//
// Run: npx tsx src/lib/__tests__/tariff-audit.test.ts

import assert from "node:assert/strict";
import { runAudit, runDoubleAudit, type AuditEntry } from "../tariff-audit";

let passed = 0;
let failed = 0;

function test(name: string, fn: () => void) {
  try {
    fn();
    passed++;
    console.log(`  ✓ ${name}`);
  } catch (err: unknown) {
    failed++;
    console.error(`  ✗ ${name}`);
    console.error(`    ${(err as Error).message}`);
  }
}

function daysAgo(n: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d;
}

function findCheck(result: ReturnType<typeof runAudit>, id: string) {
  return result.checks.find((c) => c.id === id);
}

// A clean, eligible base entry (unliquidated, in IEEPA period, valid number).
const cleanEntry: AuditEntry = {
  entryNumber: "ABC-1234567-5", // valid mod-10 check digit
  entryDate: "2025-06-15",
  entryType: "01",
  countryOfOrigin: "CN",
  enteredValue: 100_000,
  ieepaRate: 0.145,
};

// ── 1. Basic structure ───────────────────────────────────────────────────────

console.log("\n▸ runAudit — structure");

test("empty entries → FMT_EMPTY fails", () => {
  const r = runAudit([]);
  const c = findCheck(r, "FMT_EMPTY");
  assert.equal(c?.passed, false);
});

test("clean entry → no error-severity failures", () => {
  const r = runAudit([cleanEntry]);
  assert.equal(r.errors.length, 0, `unexpected errors: ${r.errors.map((e) => e.id).join(", ")}`);
});

test("score is 100 for a clean entry", () => {
  const r = runAudit([cleanEntry]);
  assert.equal(r.score, 100);
});

// ── 2. Protest deadline (180 days) ───────────────────────────────────────────

console.log("\n▸ runAudit — protest deadline (180-day)");

test("liquidated 120 days ago → ELIG_LIQUIDATION passes (within 180)", () => {
  const r = runAudit([{ ...cleanEntry, liquidationDate: daysAgo(120) }]);
  const c = findCheck(r, "ELIG_LIQUIDATION");
  assert.equal(c?.passed, true);
});

test("liquidated 120 days ago → message mentions formal protest", () => {
  const r = runAudit([{ ...cleanEntry, liquidationDate: daysAgo(120) }]);
  const c = findCheck(r, "ELIG_LIQUIDATION");
  assert.ok(/protest/i.test(c?.message ?? ""));
});

test("liquidated 200 days ago → ELIG_LIQUIDATION fails (past 180)", () => {
  const r = runAudit([{ ...cleanEntry, liquidationDate: daysAgo(200) }]);
  const c = findCheck(r, "ELIG_LIQUIDATION");
  assert.equal(c?.passed, false);
});

test("liquidated 30 days ago → CAPE Phase 1 message", () => {
  const r = runAudit([{ ...cleanEntry, liquidationDate: daysAgo(30) }]);
  const c = findCheck(r, "ELIG_LIQUIDATION");
  assert.ok(/CAPE Phase 1/i.test(c?.message ?? ""));
});

// ── 3. New eligibility checks ────────────────────────────────────────────────

console.log("\n▸ runAudit — drawback / USMCA / 232 / 301");

test("drawback entry → ELIG_DRAWBACK error", () => {
  const r = runAudit([{ ...cleanEntry, isDrawback: true }]);
  const c = findCheck(r, "ELIG_DRAWBACK");
  assert.equal(c?.passed, false);
  assert.ok(r.errors.some((e) => e.id === "ELIG_DRAWBACK"));
});

test("USMCA CA goods after Mar 7 2025 → ELIG_USMCA error", () => {
  const r = runAudit([{ ...cleanEntry, countryOfOrigin: "CA", isUsmca: true }]);
  const c = findCheck(r, "ELIG_USMCA");
  assert.equal(c?.passed, false);
});

test("USMCA flag on CN → no ELIG_USMCA check", () => {
  const r = runAudit([{ ...cleanEntry, countryOfOrigin: "CN", isUsmca: true }]);
  assert.equal(findCheck(r, "ELIG_USMCA"), undefined);
});

test("Section 232 goods → ELIG_SECTION_232 warning (not error)", () => {
  const r = runAudit([{ ...cleanEntry, hasSection232: true }]);
  const c = findCheck(r, "ELIG_SECTION_232");
  assert.equal(c?.severity, "warning");
  assert.equal(r.errors.length, 0);
});

test("Section 301 goods → ELIG_SECTION_301 warning", () => {
  const r = runAudit([{ ...cleanEntry, hasSection301: true }]);
  const c = findCheck(r, "ELIG_SECTION_301");
  assert.equal(c?.severity, "warning");
});

// ── 4. Cross-validation still works ──────────────────────────────────────────

console.log("\n▸ runDoubleAudit — cross-validation");

test("duplicate entry numbers → ENT_DUPLICATE error", () => {
  const r = runDoubleAudit([cleanEntry, { ...cleanEntry }]);
  assert.ok(r.errors.some((e) => e.id === "ENT_DUPLICATE"));
});

test("rate > 100% → XVAL_REFUND_RATIO warning", () => {
  const r = runDoubleAudit([
    { ...cleanEntry, ieepaRate: 1.45 },
    { ...cleanEntry, entryNumber: "ABD-1234567-4", ieepaRate: 25 }, // valid distinct number
  ]);
  assert.ok(r.warnings.some((c) => c.id === "XVAL_REFUND_RATIO"));
});

// ── Summary ──────────────────────────────────────────────────────────────────

console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
console.log(`  ${passed} passed, ${failed} failed, ${passed + failed} total`);
console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);

if (failed > 0) process.exit(1);
