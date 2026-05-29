// ---------------------------------------------------------------------------
// Tests for the accuracy-scoring engine (field extraction + calc accuracy).
// Run: npx tsx src/lib/__tests__/accuracy-scoring.test.ts
// ---------------------------------------------------------------------------

import assert from "node:assert/strict";
import {
  scoreExtraction,
  scoreCalc,
  aggregateRun,
  type ExtractedFields,
} from "../accuracy-scoring";

let passed = 0;
let failed = 0;
function test(name: string, fn: () => void) {
  try { fn(); passed++; console.log(`  ✓ ${name}`); }
  catch (e: unknown) { failed++; console.error(`  ✗ ${name}`); console.error(`    ${(e as Error).message}`); }
}

console.log("\naccuracy-scoring\n");

const expected: ExtractedFields = {
  entryNumber: "ABC-1234567-8",
  entryDate: "2025-01-15",
  entryType: "01",
  countryOfOrigin: "CN",
  enteredValue: 100000,
  dutyPaid: 14500,
  htsCode: "8501.10.4020",
  importerNumber: "12-3456789",
  liquidationDate: "2025-06-01",
  filerCode: "ABC",
};

test("a perfect extraction scores 100% precision, all fields matched", () => {
  const s = scoreExtraction(expected, { ...expected });
  assert.equal(s.correct, s.total);
  assert.equal(s.precision, 1);
  assert.ok(s.fields.every((f) => f.match));
});

test("string fields match case/space-insensitively", () => {
  const s = scoreExtraction(expected, { ...expected, countryOfOrigin: " cn ", filerCode: "abc" });
  assert.equal(s.precision, 1);
});

test("number fields match within tolerance but flag larger drift", () => {
  const within = scoreExtraction(expected, { ...expected, enteredValue: 100000.004 });
  assert.equal(within.fields.find((f) => f.field === "enteredValue")!.match, true);
  const off = scoreExtraction(expected, { ...expected, enteredValue: 99000 });
  assert.equal(off.fields.find((f) => f.field === "enteredValue")!.match, false);
});

test("date fields normalize ISO timestamps to the calendar day", () => {
  const s = scoreExtraction(expected, { ...expected, entryDate: "2025-01-15T00:00:00.000Z" });
  assert.equal(s.fields.find((f) => f.field === "entryDate")!.match, true);
});

test("a wrong field lowers precision and is flagged", () => {
  const s = scoreExtraction(expected, { ...expected, entryNumber: "WRONG" });
  assert.ok(s.precision < 1);
  assert.equal(s.fields.find((f) => f.field === "entryNumber")!.match, false);
});

test("null vs null matches; null vs value does not", () => {
  const exp: ExtractedFields = { ...expected, liquidationDate: null };
  assert.equal(scoreExtraction(exp, { ...exp }).precision, 1);
  const s = scoreExtraction(exp, { ...exp, liquidationDate: "2025-06-01" });
  assert.equal(s.fields.find((f) => f.field === "liquidationDate")!.match, false);
});

// ── scoreCalc ────────────────────────────────────────────────────────────────
test("scoreCalc passes within tolerance and fails outside it", () => {
  assert.equal(scoreCalc(150000, 150000).withinTolerance, true);
  assert.equal(scoreCalc(150000, 150010).withinTolerance, true); // < 0.5% default
  const off = scoreCalc(150000, 160000);
  assert.equal(off.withinTolerance, false);
  assert.ok(Math.abs(off.pctError - 0.0667) < 0.001);
});

test("scoreCalc handles a zero-expected value without dividing by zero", () => {
  assert.equal(scoreCalc(0, 0).withinTolerance, true);
  assert.equal(scoreCalc(0, 100).withinTolerance, false);
});

// ── aggregateRun ─────────────────────────────────────────────────────────────
test("aggregateRun rolls up per-field precision across fixtures", () => {
  const s1 = scoreExtraction(expected, { ...expected });
  const s2 = scoreExtraction(expected, { ...expected, entryNumber: "WRONG" });
  const agg = aggregateRun([{ score: s1, confidence: 0.95 }, { score: s2, confidence: 0.4 }]);
  assert.equal(agg.totalFixtures, 2);
  const en = agg.fieldPrecision.find((f) => f.field === "entryNumber")!;
  assert.equal(en.total, 2);
  assert.equal(en.correct, 1);
  assert.equal(en.precision, 0.5);
  assert.ok(agg.overallPrecision > 0 && agg.overallPrecision < 1);
});

test("aggregateRun bins confidence calibration", () => {
  const perfect = scoreExtraction(expected, { ...expected });
  const wrong = scoreExtraction(expected, { ...expected, entryNumber: "X", countryOfOrigin: "XX" });
  const agg = aggregateRun([
    { score: perfect, confidence: 0.95 },
    { score: wrong, confidence: 0.15 },
  ]);
  const hi = agg.confidenceCalibration.find((b) => b.bin === "0.9-1.0")!;
  assert.equal(hi.count, 1);
  assert.equal(hi.accuracy, 1);
  const lo = agg.confidenceCalibration.find((b) => b.bin === "0.1-0.2")!;
  assert.equal(lo.count, 1);
  assert.ok(lo.accuracy < 1);
});

console.log(`\n${passed} passed, ${failed} failed\n`);
if (failed > 0) process.exit(1);
