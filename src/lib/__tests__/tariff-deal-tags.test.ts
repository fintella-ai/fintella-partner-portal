// src/lib/__tests__/tariff-deal-tags.test.ts
// Run: npx tsx src/lib/__tests__/tariff-deal-tags.test.ts

import assert from "node:assert/strict";
import {
  deriveTariffTags,
  addTags,
  isFrozen,
  isFrostConverted,
  frostKpis,
  DEAL_TAG,
  STAGE_SUBMITTED_TO_FROST,
} from "../tariff-deal-tags";

let passed = 0, failed = 0;
function test(name: string, fn: () => void) {
  try { fn(); passed++; console.log(`  ✓ ${name}`); }
  catch (e) { failed++; console.error(`  ✗ ${name}\n    ${(e as Error).message}`); }
}

console.log("\n▸ tariff-deal-tags");
test("tier-1 tariff deal tags", () => {
  const t = deriveTariffTags(500_000, true);
  assert.ok(t.includes("tariff") && t.includes("internal_lead") && t.includes("tier1"));
});
test("non-tier1 omits tier1 tag", () => {
  assert.ok(!deriveTariffTags(2_000_000, false).includes("tier1"));
});
test("addTags dedupes", () => {
  assert.deepEqual(addTags(["a"], "a", "b"), ["a", "b"]);
});
test("frozen by tag", () => assert.equal(isFrozen({ tags: [DEAL_TAG.SUBMITTED_TO_FROST] }), true));
test("frozen by stage", () => assert.equal(isFrozen({ stage: STAGE_SUBMITTED_TO_FROST }), true));
test("not frozen otherwise", () => assert.equal(isFrozen({ tags: ["tariff"], stage: "lead_submitted" }), false));
test("converted by closedwon stage", () => assert.equal(isFrostConverted({ stage: "closedwon" }), true));
test("converted by actual refund", () => assert.equal(isFrostConverted({ actualRefundAmount: 5000 }), true));
test("frostKpis: sent vs converted", () => {
  const k = frostKpis([
    { tags: ["submitted_to_frost"], estimatedRefundAmount: 100, stage: "closedwon", actualRefundAmount: 90 },
    { tags: ["submitted_to_frost"], estimatedRefundAmount: 200, stage: "meeting_booked" },
    { tags: ["tariff"], estimatedRefundAmount: 50 },
  ]);
  assert.equal(k.sentCount, 2);
  assert.equal(k.convertedCount, 1);
  assert.equal(k.conversionRate, 50);
  assert.equal(k.convertedValue, 90);
});

console.log(`\n  ${passed} passed, ${failed} failed, ${passed + failed} total\n`);
if (failed > 0) process.exit(1);
