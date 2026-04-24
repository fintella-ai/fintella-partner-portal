// src/lib/__tests__/commission-sliding-window.test.ts
//
// Phase 0 of Option B — prove the new sliding-window waterfall produces
// amounts identical to the legacy 3-tier calcWaterfallCommissions on every
// existing chain shape, while handling arbitrary-depth chains (L4+) by
// simply ignoring everything beyond index 2.

import assert from "node:assert/strict";
import { calcSlidingWindowWaterfall, calcWaterfallCommissions, type PartnerChainNode } from "../commission";

let passed = 0, failed = 0;
function test(name: string, fn: () => void) {
  try { fn(); passed++; console.log(`  ✓ ${name}`); }
  catch (e) { failed++; console.log(`  ✗ ${name}\n    ${(e as Error).message}`); }
}

console.log("commission — sliding-window waterfall");

const FEE = 10_000;

// ─── Backward compatibility: must match legacy 3-tier results ─────────────

test("L1 direct deal (chain length 1) matches legacy", () => {
  const legacy = calcWaterfallCommissions(FEE, [
    { partnerCode: "L1A", tier: "l1", commissionRate: 0.25 },
  ]);
  const slide = calcSlidingWindowWaterfall(FEE, [
    { partnerCode: "L1A", commissionRate: 0.25 },
  ]);

  assert.equal(slide.entries.length, 1, "only submitter paid");
  assert.equal(slide.entries[0].partnerCode, "L1A");
  assert.equal(slide.entries[0].amount, legacy.l1Amount);
  assert.equal(slide.totalAmount, legacy.l1Amount);
});

test("L2 deal (chain length 2) matches legacy", () => {
  const chain: PartnerChainNode[] = [
    { partnerCode: "L2A", tier: "l2", commissionRate: 0.20 },
    { partnerCode: "L1A", tier: "l1", commissionRate: 0.25 },
  ];
  const legacy = calcWaterfallCommissions(FEE, chain);
  const slide = calcSlidingWindowWaterfall(FEE, chain.map((n) => ({
    partnerCode: n.partnerCode, commissionRate: n.commissionRate,
  })));

  assert.equal(slide.entries.length, 2);
  // Submitter (L2A) matches legacy L2
  assert.equal(slide.entries[0].partnerCode, "L2A");
  assert.equal(slide.entries[0].amount, legacy.l2Amount);
  // Parent (L1A) matches legacy L1 override
  assert.equal(slide.entries[1].partnerCode, "L1A");
  assert.equal(slide.entries[1].amount, legacy.l1Amount);
  assert.equal(slide.totalAmount, legacy.l1Amount + legacy.l2Amount);
});

test("L3 deal (chain length 3) matches legacy", () => {
  const chain: PartnerChainNode[] = [
    { partnerCode: "L3A", tier: "l3", commissionRate: 0.10 },
    { partnerCode: "L2A", tier: "l2", commissionRate: 0.15 },
    { partnerCode: "L1A", tier: "l1", commissionRate: 0.25 },
  ];
  const legacy = calcWaterfallCommissions(FEE, chain);
  const slide = calcSlidingWindowWaterfall(FEE, chain.map((n) => ({
    partnerCode: n.partnerCode, commissionRate: n.commissionRate,
  })));

  assert.equal(slide.entries.length, 3);
  assert.equal(slide.entries[0].amount, legacy.l3Amount);
  assert.equal(slide.entries[1].amount, legacy.l2Amount);
  assert.equal(slide.entries[2].amount, legacy.l1Amount);
  assert.equal(slide.totalAmount, legacy.l1Amount + legacy.l2Amount + legacy.l3Amount);
});

// ─── New behavior: deeper chains cap at submitter + 2 ancestors ───────────

test("Chain length 4 (L4 submits) — great-grandparent earns $0", () => {
  const slide = calcSlidingWindowWaterfall(FEE, [
    { partnerCode: "DEEP", commissionRate: 0.05 }, // submitter
    { partnerCode: "PARENT", commissionRate: 0.10 },
    { partnerCode: "GRANDPARENT", commissionRate: 0.15 },
    { partnerCode: "GGPARENT", commissionRate: 0.20 }, // ignored
  ]);

  assert.equal(slide.entries.length, 3, "great-grandparent not emitted");
  assert.equal(slide.entries[0].partnerCode, "DEEP");
  assert.equal(slide.entries[0].amount, FEE * 0.05); // 500
  assert.equal(slide.entries[1].partnerCode, "PARENT");
  assert.equal(slide.entries[1].amount, FEE * (0.10 - 0.05)); // 500
  assert.equal(slide.entries[2].partnerCode, "GRANDPARENT");
  assert.equal(slide.entries[2].amount, FEE * (0.15 - 0.10)); // 500
  // Total = 1500 = 15% (the grandparent's absolute rate). Great-grandparent + root get nothing.
  assert.equal(slide.totalAmount, 1500);
});

test("Chain length 6 — only first 3 entries are paid", () => {
  const slide = calcSlidingWindowWaterfall(FEE, [
    { partnerCode: "A", commissionRate: 0.02 },
    { partnerCode: "B", commissionRate: 0.05 },
    { partnerCode: "C", commissionRate: 0.10 },
    { partnerCode: "D", commissionRate: 0.15 },
    { partnerCode: "E", commissionRate: 0.20 },
    { partnerCode: "F", commissionRate: 0.25 },
  ]);

  assert.equal(slide.entries.length, 3);
  assert.deepEqual(
    slide.entries.map((e) => e.partnerCode),
    ["A", "B", "C"],
  );
});

// ─── Edge cases ────────────────────────────────────────────────────────────

test("Empty chain returns zero-entry result", () => {
  const slide = calcSlidingWindowWaterfall(FEE, []);
  assert.equal(slide.entries.length, 0);
  assert.equal(slide.totalAmount, 0);
});

test("Zero firm fee returns zero-entry result", () => {
  const slide = calcSlidingWindowWaterfall(0, [
    { partnerCode: "L1A", commissionRate: 0.25 },
  ]);
  assert.equal(slide.entries.length, 0);
});

test("Parent rate below submitter rate clamps override to 0 (no negative payouts)", () => {
  // Defensive — should never happen with correct invite validation, but
  // the function must not produce negative amounts if it does.
  const slide = calcSlidingWindowWaterfall(FEE, [
    { partnerCode: "SUB", commissionRate: 0.20 },
    { partnerCode: "BADPARENT", commissionRate: 0.10 }, // lower than submitter
  ]);
  assert.equal(slide.entries.length, 1, "only submitter — parent override clamps to 0 and is dropped");
  assert.equal(slide.entries[0].partnerCode, "SUB");
});

test("Equal parent/submitter rate: parent emits no row", () => {
  const slide = calcSlidingWindowWaterfall(FEE, [
    { partnerCode: "SUB", commissionRate: 0.15 },
    { partnerCode: "PARENT", commissionRate: 0.15 }, // exact tie
  ]);
  assert.equal(slide.entries.length, 1);
});

test("Custom L1 rate at new 30% ceiling — math still works", () => {
  const slide = calcSlidingWindowWaterfall(FEE, [
    { partnerCode: "DEEP", commissionRate: 0.075 },
    { partnerCode: "MID", commissionRate: 0.15 },
    { partnerCode: "TOP", commissionRate: 0.30 }, // new max
  ]);
  assert.equal(slide.entries.length, 3);
  assert.equal(slide.entries[0].amount, FEE * 0.075); // 750
  assert.equal(slide.entries[1].amount, FEE * (0.15 - 0.075)); // 750
  assert.equal(slide.entries[2].amount, FEE * (0.30 - 0.15)); // 1500
  assert.equal(slide.totalAmount, 3000); // 30% of 10k
});

test("Non-5%-multiple rates (free-form) — no rounding surprise", () => {
  const slide = calcSlidingWindowWaterfall(FEE, [
    { partnerCode: "SUB", commissionRate: 0.0375 }, // 3.75%
    { partnerCode: "PAR", commissionRate: 0.1225 }, // 12.25%
    { partnerCode: "GP",  commissionRate: 0.20 },
  ]);
  assert.equal(slide.entries[0].amount, FEE * 0.0375); // 375
  // Parent override: 12.25 - 3.75 = 8.50%
  assert.equal(Math.round(slide.entries[1].amount * 100) / 100, Math.round(FEE * 0.085 * 100) / 100);
  // Grandparent override: 20 - 12.25 = 7.75%
  assert.equal(Math.round(slide.entries[2].amount * 100) / 100, Math.round(FEE * 0.0775 * 100) / 100);
});

// ─── Summary ──────────────────────────────────────────────────────────────

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
