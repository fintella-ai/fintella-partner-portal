// src/lib/__tests__/tariff-pricing.test.ts
//
// Pricing engine tests — volume tiers, contingency band, add-ons, 33% cap.
// Run: npx tsx src/lib/__tests__/tariff-pricing.test.ts

import assert from "node:assert/strict";
import {
  perFileCentsForCount,
  feeForPricingModel,
  computeEngagementPricing,
  TARIFF_UPFRONT_FEE_CENTS,
  TARIFF_WIDGET_UNLOCK_FEE_CENTS,
  TARIFF_MAX_BACKEND_BPS,
} from "../tariff-engagement";

let passed = 0;
let failed = 0;
function test(name: string, fn: () => void) {
  try { fn(); passed++; console.log(`  ✓ ${name}`); }
  catch (err) { failed++; console.error(`  ✗ ${name}\n    ${(err as Error).message}`); }
}

console.log("\n▸ perFileCentsForCount (volume tiers)");
test("1 file → premium sample rate ($250)", () => assert.equal(perFileCentsForCount(1), 25_000));
test("3 files → $150 each", () => assert.equal(perFileCentsForCount(3), 15_000));
test("10 files → $99 each", () => assert.equal(perFileCentsForCount(10), 9_900));
test("50 files → $59 each", () => assert.equal(perFileCentsForCount(50), 5_900));
test("more files never costs more per file", () => {
  for (let n = 2; n <= 100; n++) assert.ok(perFileCentsForCount(n) <= perFileCentsForCount(n - 1));
});

console.log("\n▸ feeForPricingModel");
test("upfront → flat fee", () => assert.equal(feeForPricingModel("upfront"), TARIFF_UPFRONT_FEE_CENTS));
test("widget_onetime → unlock fee", () => assert.equal(feeForPricingModel("widget_onetime"), TARIFF_WIDGET_UNLOCK_FEE_CENTS));
test("per_file_volume 10 files → 10 × $99", () => assert.equal(feeForPricingModel("per_file_volume", { fileCount: 10 }), 99_000));
test("refund_percent → $0 upfront (contingency)", () => assert.equal(feeForPricingModel("refund_percent"), 0));

console.log("\n▸ computeEngagementPricing");
test("contingency: 20% backend, $0 upfront", () => {
  const p = computeEngagementPricing("refund_percent", { refundCents: 1_000_000 });
  assert.equal(p.upfrontCents, 0);
  assert.equal(p.backendBps, 2_000);
});
test("dual: small upfront + 10% backend", () => {
  const p = computeEngagementPricing("dual");
  assert.ok(p.upfrontCents > 0);
  assert.equal(p.backendBps, 1_000);
});
test("legal review add-on stacks upfront + backend", () => {
  const base = computeEngagementPricing("upfront");
  const withReview = computeEngagementPricing("upfront", { addOns: ["legal_review"] });
  assert.ok(withReview.upfrontCents > base.upfrontCents);
  assert.equal(withReview.backendBps, 500);
});
test("litigation guarantee adds upfront, no backend", () => {
  const p = computeEngagementPricing("upfront", { addOns: ["litigation_guarantee"] });
  assert.ok(p.upfrontCents > TARIFF_UPFRONT_FEE_CENTS);
  assert.equal(p.backendBps, 0);
});
test("backend never exceeds 33% cap", () => {
  const p = computeEngagementPricing("refund_percent", { refundCents: 1_000_000, addOns: ["legal_review"] });
  assert.ok(p.backendBps <= TARIFF_MAX_BACKEND_BPS);
});
test("line items present for transparency", () => {
  const p = computeEngagementPricing("dual", { addOns: ["legal_review", "litigation_guarantee"] });
  assert.ok(p.lineItems.length >= 3);
});
test("buyout: upfront held (not $0), no backend, has buyout note", () => {
  const p = computeEngagementPricing("buyout", { refundCents: 1_000_000 });
  assert.ok(p.upfrontCents > 0); // held as an auth, not captured
  assert.equal(p.backendBps, 0);
  assert.ok(p.lineItems.some((li) => /buyout/i.test(li.label)));
});

console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
console.log(`  ${passed} passed, ${failed} failed, ${passed + failed} total`);
console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);
if (failed > 0) process.exit(1);
