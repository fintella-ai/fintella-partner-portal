// src/lib/__tests__/channelSegments.test.ts
import assert from "node:assert/strict";
import { evaluateSegmentRule, parseSegmentRule, type SegmentRule } from "../channelSegments";

let passed = 0, failed = 0;
function test(name: string, fn: () => void) {
  try { fn(); passed++; console.log(`  ✓ ${name}`); }
  catch (e) { failed++; console.log(`  ✗ ${name}\n    ${(e as Error).message}`); }
}

console.log("channelSegments");

const partnerActiveL1 = {
  tier: "l1",
  status: "active",
  l3Enabled: false,
  profile: { state: "TX" },
  signedAgreement: true,
};
const partnerPendingL2 = {
  tier: "l2",
  status: "pending",
  l3Enabled: false,
  profile: { state: "CA" },
  signedAgreement: false,
};

const ruleL1Active: SegmentRule = {
  filters: [
    { field: "tier", op: "in", value: ["l1"] },
    { field: "status", op: "eq", value: "active" },
  ],
};

test("matches when all filters satisfied", () => {
  assert.equal(evaluateSegmentRule(ruleL1Active, partnerActiveL1), true);
});

test("fails when any filter fails", () => {
  assert.equal(evaluateSegmentRule(ruleL1Active, partnerPendingL2), false);
});

test("in op with multiple values", () => {
  const r: SegmentRule = { filters: [{ field: "tier", op: "in", value: ["l1", "l2"] }] };
  assert.equal(evaluateSegmentRule(r, partnerActiveL1), true);
  assert.equal(evaluateSegmentRule(r, partnerPendingL2), true);
});

test("state filter reads from profile.state", () => {
  const r: SegmentRule = { filters: [{ field: "state", op: "eq", value: "TX" }] };
  assert.equal(evaluateSegmentRule(r, partnerActiveL1), true);
  assert.equal(evaluateSegmentRule(r, partnerPendingL2), false);
});

test("signedAgreement boolean filter", () => {
  const r: SegmentRule = { filters: [{ field: "signedAgreement", op: "eq", value: true }] };
  assert.equal(evaluateSegmentRule(r, partnerActiveL1), true);
  assert.equal(evaluateSegmentRule(r, partnerPendingL2), false);
});

test("neq op", () => {
  const r: SegmentRule = { filters: [{ field: "status", op: "neq", value: "active" }] };
  assert.equal(evaluateSegmentRule(r, partnerActiveL1), false);
  assert.equal(evaluateSegmentRule(r, partnerPendingL2), true);
});

test("empty filters matches all", () => {
  assert.equal(evaluateSegmentRule({ filters: [] }, partnerActiveL1), true);
});

test("parseSegmentRule validates structure", () => {
  const ok = parseSegmentRule('{"filters":[{"field":"tier","op":"in","value":["l1"]}]}');
  assert.equal(ok.ok, true);
  const bad = parseSegmentRule('{"filters":[{"field":"nope","op":"eq","value":1}]}');
  assert.equal(bad.ok, false);
});

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
