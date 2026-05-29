// ---------------------------------------------------------------------------
// Tests for widget self-serve trial-key helpers.
// Run: npx tsx src/lib/__tests__/widget-trial.test.ts
// ---------------------------------------------------------------------------

import assert from "node:assert/strict";
import {
  generateTrialKey,
  hashTrialKey,
  getTrialKeyHint,
  toPartialTariffResult,
  buildEmbedSnippet,
  type FullTariffResult,
} from "../widget-trial";

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

console.log("\nwidget-trial helpers\n");

// ── generateTrialKey ─────────────────────────────────────────────────────────
test("generateTrialKey returns an ftk_ prefixed key", () => {
  const key = generateTrialKey();
  assert.ok(key.startsWith("ftk_"), `expected ftk_ prefix, got ${key}`);
});

test("generateTrialKey body is 64 hex chars (32 bytes)", () => {
  const key = generateTrialKey();
  const body = key.slice("ftk_".length);
  assert.equal(body.length, 64);
  assert.match(body, /^[0-9a-f]+$/);
});

test("generateTrialKey is unique across calls", () => {
  const a = generateTrialKey();
  const b = generateTrialKey();
  assert.notEqual(a, b);
});

// ── hashTrialKey ─────────────────────────────────────────────────────────────
test("hashTrialKey is deterministic (sha256, same input → same hash)", () => {
  const key = "ftk_abc123";
  assert.equal(hashTrialKey(key), hashTrialKey(key));
});

test("hashTrialKey produces a 64-char sha256 hex digest", () => {
  const h = hashTrialKey("ftk_abc123");
  assert.equal(h.length, 64);
  assert.match(h, /^[0-9a-f]+$/);
});

test("hashTrialKey differs for different keys", () => {
  assert.notEqual(hashTrialKey("ftk_aaa"), hashTrialKey("ftk_bbb"));
});

// ── getTrialKeyHint ──────────────────────────────────────────────────────────
test("getTrialKeyHint shows last 8 chars with leading ellipsis", () => {
  assert.equal(getTrialKeyHint("ftk_0123456789abcdef"), "...89abcdef");
});

// ── toPartialTariffResult ────────────────────────────────────────────────────
const fullResult: FullTariffResult = {
  countryOfOrigin: "CN",
  entryDate: "2025-01-15",
  enteredValue: 100_000,
  ieepaRate: 1.45,
  rateName: "Fentanyl + Reciprocal",
  rateBreakdown: { fentanyl: 0.2, reciprocal: 1.25 },
  ieepaDuty: 145_000,
  estimatedInterest: 5_000,
  estimatedRefund: 150_000,
  eligibility: "eligible",
  eligibilityReason: "Within CAPE Phase-1 window",
  deadlineDays: 42,
  isUrgent: true,
  deadlineDate: new Date("2025-03-01"),
  filingMethod: "cape_phase1",
};

test("toPartialTariffResult hides every dollar/rate field", () => {
  const partial = toPartialTariffResult(fullResult) as unknown as Record<string, unknown>;
  for (const hidden of [
    "ieepaDuty",
    "estimatedInterest",
    "estimatedRefund",
    "ieepaRate",
    "rateName",
    "rateBreakdown",
  ]) {
    assert.ok(!(hidden in partial), `expected ${hidden} to be hidden, but it leaked`);
  }
});

test("toPartialTariffResult keeps eligibility, deadlines, and counts", () => {
  const partial = toPartialTariffResult(fullResult);
  assert.equal(partial.eligibility, "eligible");
  assert.equal(partial.eligibilityReason, "Within CAPE Phase-1 window");
  assert.equal(partial.deadlineDays, 42);
  assert.equal(partial.isUrgent, true);
  assert.equal(partial.filingMethod, "cape_phase1");
  assert.equal(partial.countryOfOrigin, "CN");
  assert.equal(partial.entryDate, "2025-01-15");
});

test("toPartialTariffResult flags refund as locked", () => {
  const partial = toPartialTariffResult(fullResult);
  assert.equal(partial.refundLocked, true);
});

test("toPartialTariffResult tolerates a result with no deadline fields", () => {
  const minimal: FullTariffResult = {
    countryOfOrigin: "DE",
    entryDate: "2025-06-01",
    enteredValue: 5_000,
    ieepaRate: 0,
    rateName: "None",
    rateBreakdown: {},
    ieepaDuty: 0,
    estimatedInterest: 0,
    estimatedRefund: 0,
    eligibility: "excluded_date",
    eligibilityReason: "Outside IEEPA window",
  };
  const partial = toPartialTariffResult(minimal);
  assert.equal(partial.eligibility, "excluded_date");
  assert.equal(partial.refundLocked, true);
  assert.equal(partial.deadlineDays, undefined);
});

// ── buildEmbedSnippet ────────────────────────────────────────────────────────
test("buildEmbedSnippet embeds the api key and origin", () => {
  const snippet = buildEmbedSnippet("ftk_demo", "https://fintella.partners");
  assert.ok(snippet.includes("ftk_demo"), "snippet should include the key");
  assert.ok(snippet.includes("https://fintella.partners"), "snippet should include the origin");
});

// ── summary ──────────────────────────────────────────────────────────────────
console.log(`\n${passed} passed, ${failed} failed\n`);
if (failed > 0) process.exit(1);
