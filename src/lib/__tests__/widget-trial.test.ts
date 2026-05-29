// ---------------------------------------------------------------------------
// Tests for widget self-serve trial-key helpers.
// Run: npx tsx src/lib/__tests__/widget-trial.test.ts
// ---------------------------------------------------------------------------

import assert from "node:assert/strict";
import {
  generateTrialKey,
  parseTrialKey,
  hashSecret,
  verifyTrialKey,
  getTrialKeyHint,
  toPartialTariffResult,
  buildEmbedSnippet,
  type FullTariffResult,
} from "../widget-trial";

let passed = 0;
let failed = 0;

async function test(name: string, fn: () => void | Promise<void>) {
  try {
    await fn();
    passed++;
    console.log(`  ✓ ${name}`);
  } catch (err: unknown) {
    failed++;
    console.error(`  ✗ ${name}`);
    console.error(`    ${(err as Error).message}`);
  }
}

async function main() {
  console.log("\nwidget-trial helpers\n");

  // ── generateTrialKey ───────────────────────────────────────────────────────
  await test("generateTrialKey returns ftk_<keyId>.<secret> + parts", () => {
    const { apiKey, keyId, secret } = generateTrialKey();
    assert.ok(apiKey.startsWith("ftk_"), `expected ftk_ prefix, got ${apiKey}`);
    assert.equal(apiKey, `ftk_${keyId}.${secret}`);
    assert.match(keyId, /^[0-9a-f]{16}$/);
    assert.match(secret, /^[0-9a-f]{48}$/);
  });

  await test("generateTrialKey is unique across calls", () => {
    assert.notEqual(generateTrialKey().apiKey, generateTrialKey().apiKey);
  });

  // ── parseTrialKey ──────────────────────────────────────────────────────────
  await test("parseTrialKey round-trips a generated key", () => {
    const { apiKey, keyId, secret } = generateTrialKey();
    const parsed = parseTrialKey(apiKey);
    assert.deepEqual(parsed, { keyId, secret });
  });

  await test("parseTrialKey rejects malformed keys", () => {
    assert.equal(parseTrialKey("nope"), null);
    assert.equal(parseTrialKey("ftk_missingdot"), null);
    assert.equal(parseTrialKey("ftk_id.sec.extra"), null);
    assert.equal(parseTrialKey(""), null);
  });

  // ── hashSecret + verifyTrialKey ──────────────────────────────────────────────
  await test("verifyTrialKey accepts the real key against its stored hash", async () => {
    const { apiKey, secret } = generateTrialKey();
    const secretHash = await hashSecret(secret);
    assert.equal(await verifyTrialKey(apiKey, secretHash), true);
  });

  await test("verifyTrialKey rejects a wrong key against a stored hash", async () => {
    const a = generateTrialKey();
    const b = generateTrialKey();
    const secretHash = await hashSecret(a.secret);
    assert.equal(await verifyTrialKey(b.apiKey, secretHash), false);
  });

  await test("verifyTrialKey rejects a malformed key without throwing", async () => {
    const { secret } = generateTrialKey();
    const secretHash = await hashSecret(secret);
    assert.equal(await verifyTrialKey("garbage", secretHash), false);
  });

  await test("hashSecret produces a bcrypt hash (salted, non-deterministic)", async () => {
    const { secret } = generateTrialKey();
    const h1 = await hashSecret(secret);
    const h2 = await hashSecret(secret);
    assert.match(h1, /^\$2[aby]\$/); // bcrypt prefix
    assert.notEqual(h1, h2); // salted → different each time
  });

  // ── getTrialKeyHint ──────────────────────────────────────────────────────────
  await test("getTrialKeyHint shows last 8 chars with leading ellipsis", () => {
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

  await test("toPartialTariffResult hides every dollar/rate field", () => {
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

  await test("toPartialTariffResult keeps eligibility, deadlines, and counts", () => {
    const partial = toPartialTariffResult(fullResult);
    assert.equal(partial.eligibility, "eligible");
    assert.equal(partial.eligibilityReason, "Within CAPE Phase-1 window");
    assert.equal(partial.deadlineDays, 42);
    assert.equal(partial.isUrgent, true);
    assert.equal(partial.filingMethod, "cape_phase1");
    assert.equal(partial.countryOfOrigin, "CN");
    assert.equal(partial.entryDate, "2025-01-15");
  });

  await test("toPartialTariffResult flags refund as locked", () => {
    assert.equal(toPartialTariffResult(fullResult).refundLocked, true);
  });

  await test("toPartialTariffResult tolerates a result with no deadline fields", () => {
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
  await test("buildEmbedSnippet emits the exact script tag with key + origin", () => {
    const snippet = buildEmbedSnippet("ftk_demo", "https://x.test");
    assert.equal(
      snippet,
      '<script src="https://x.test/widget/tariff-trial.js" data-trial-key="ftk_demo"></script>',
    );
  });

  // ── summary ──────────────────────────────────────────────────────────────────
  console.log(`\n${passed} passed, ${failed} failed\n`);
  if (failed > 0) process.exit(1);
}

main();
