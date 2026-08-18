// ---------------------------------------------------------------------------
// Tests for buyout underwriting risk-score helpers.
// Run: npx tsx src/lib/__tests__/tariff-risk-score.test.ts
// ---------------------------------------------------------------------------

import assert from "node:assert/strict";
import { computeRiskScore, deriveRiskInput, type RiskInput } from "../tariff-risk-score";
import { TARIFF_BUYOUT_LOW_BPS, TARIFF_BUYOUT_HIGH_BPS } from "../tariff-engagement";

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

console.log("\ntariff-risk-score\n");

const cleanLowRisk: RiskInput = {
  eligibilityStatus: "eligible",
  filingMethod: "cape_phase1",
  isAdCvd: false,
  isDrawback: false,
  isLiquidated: false,
  deadlineDays: 120,
  needsReview: false,
  estimatedRefundCents: 5_000_00,
};

test("a clean CAPE Phase-1 claim scores low risk and recommends the high payout", () => {
  const r = computeRiskScore(cleanLowRisk);
  assert.equal(r.band, "low");
  assert.ok(r.score <= 25, `expected low score, got ${r.score}`);
  assert.equal(r.recommendedBuyoutBps, TARIFF_BUYOUT_HIGH_BPS);
  assert.equal(r.decision, "auto_approve");
});

test("an excluded (ineligible) claim is high risk and auto-declines", () => {
  const r = computeRiskScore({ ...cleanLowRisk, eligibilityStatus: "excluded_date" });
  assert.equal(r.band, "high");
  assert.equal(r.decision, "auto_decline");
  assert.ok(r.factors.some((f) => /eligib/i.test(f.label)));
});

test("drawback + AD/CVD stack risk points", () => {
  const base = computeRiskScore(cleanLowRisk).score;
  const r = computeRiskScore({ ...cleanLowRisk, isDrawback: true, isAdCvd: true });
  assert.ok(r.score > base, "drawback + adcvd should raise the score");
  assert.ok(r.factors.some((f) => /drawback/i.test(f.label)));
  assert.ok(r.factors.some((f) => /ad\/?cvd/i.test(f.label)));
});

test("litigation filing method is riskier than protest, which is riskier than cape", () => {
  const cape1 = computeRiskScore({ ...cleanLowRisk, filingMethod: "cape_phase1" }).score;
  const cape2 = computeRiskScore({ ...cleanLowRisk, filingMethod: "cape_phase2" }).score;
  const protest = computeRiskScore({ ...cleanLowRisk, filingMethod: "protest" }).score;
  const litigation = computeRiskScore({ ...cleanLowRisk, filingMethod: "litigation" }).score;
  assert.ok(cape2 >= cape1, "cape_phase2 >= cape_phase1 (sequencing complexity)");
  assert.ok(protest > cape2, "protest > cape_phase2");
  assert.ok(litigation > protest, "litigation > protest");
});

test("a passed deadline is heavily penalized", () => {
  const r = computeRiskScore({ ...cleanLowRisk, deadlineDays: -3 });
  assert.ok(r.score > computeRiskScore(cleanLowRisk).score);
  assert.ok(r.factors.some((f) => /deadline/i.test(f.label)));
});

test("recommendedBuyoutBps always stays within the configured band", () => {
  for (const input of [
    cleanLowRisk,
    { ...cleanLowRisk, filingMethod: "litigation" as const, isAdCvd: true, isDrawback: true, deadlineDays: -1 },
    { ...cleanLowRisk, eligibilityStatus: "excluded_adcvd" },
  ]) {
    const r = computeRiskScore(input);
    assert.ok(r.recommendedBuyoutBps >= TARIFF_BUYOUT_LOW_BPS, `bps ${r.recommendedBuyoutBps} >= low`);
    assert.ok(r.recommendedBuyoutBps <= TARIFF_BUYOUT_HIGH_BPS, `bps ${r.recommendedBuyoutBps} <= high`);
  }
});

test("score is clamped to 0..100", () => {
  const r = computeRiskScore({
    eligibilityStatus: "excluded_drawback",
    filingMethod: "litigation",
    isAdCvd: true,
    isDrawback: true,
    isLiquidated: true,
    deadlineDays: -30,
    needsReview: true,
  });
  assert.ok(r.score >= 0 && r.score <= 100, `score ${r.score} in range`);
});

test("higher risk monotonically lowers the recommended payout", () => {
  const low = computeRiskScore(cleanLowRisk);
  const mid = computeRiskScore({ ...cleanLowRisk, filingMethod: "protest", deadlineDays: 20 });
  assert.ok(mid.recommendedBuyoutBps <= low.recommendedBuyoutBps);
});

// ── deriveRiskInput ──────────────────────────────────────────────────────────
test("deriveRiskInput maps a clean unliquidated dossier to a cape_phase1 input", () => {
  const ri = deriveRiskInput(
    { eligibleCount: 2, deadlineDays: 90, totalEstRefund: 40_000, totalEstInterest: 2_000 },
    [
      { eligibility: "eligible", liquidationStatus: "unliquidated", hasAdCvd: false, deadlineDays: 90 },
      { eligibility: "eligible", liquidationStatus: "unliquidated", hasAdCvd: false, deadlineDays: 120 },
    ],
  );
  assert.equal(ri.eligibilityStatus, "eligible");
  assert.equal(ri.filingMethod, "cape_phase1");
  assert.equal(ri.isAdCvd, false);
  assert.equal(ri.deadlineDays, 90);
  assert.equal(ri.estimatedRefundCents, 4_200_000);
});

test("deriveRiskInput flags adcvd, drawback, liquidation and picks litigation when deadline passed", () => {
  const ri = deriveRiskInput(
    { eligibleCount: 0, deadlineDays: -5, totalEstRefund: 0 },
    [
      { eligibility: "excluded_drawback", eligibilityReason: "Entry on drawback", liquidationStatus: "liquidated", hasAdCvd: true, needsReview: true, deadlineDays: -5 },
    ],
  );
  assert.equal(ri.eligibilityStatus, "excluded");
  assert.equal(ri.isAdCvd, true);
  assert.equal(ri.isDrawback, true);
  assert.equal(ri.isLiquidated, true);
  assert.equal(ri.needsReview, true);
  assert.equal(ri.filingMethod, "litigation");
  // and it should score high risk end-to-end
  assert.equal(computeRiskScore(ri).band, "high");
});

console.log(`\n${passed} passed, ${failed} failed\n`);
if (failed > 0) process.exit(1);
