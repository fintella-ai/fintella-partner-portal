// ---------------------------------------------------------------------------
// Tests for backupCodesRemaining — counts how many single-use backup codes are
// still available from the stored JSON array of bcrypt hashes.
// Run: npx tsx src/lib/__tests__/totp.test.ts
// ---------------------------------------------------------------------------

import assert from "node:assert/strict";
import { backupCodesRemaining } from "../totp";

let passed = 0;
let failed = 0;
function test(name: string, fn: () => void) {
  try { fn(); passed++; console.log(`  ✓ ${name}`); }
  catch (e: unknown) { failed++; console.error(`  ✗ ${name}`); console.error(`    ${(e as Error).message}`); }
}

console.log("\nbackupCodesRemaining\n");

test("null (never enrolled / disabled) → 0", () => {
  assert.equal(backupCodesRemaining(null), 0);
});

test("empty JSON array (all codes consumed) → 0", () => {
  assert.equal(backupCodesRemaining("[]"), 0);
});

test("a fresh set of 10 hashed codes → 10", () => {
  const codes = JSON.stringify(Array.from({ length: 10 }, (_, i) => `$2a$10$hash${i}`));
  assert.equal(backupCodesRemaining(codes), 10);
});

test("a partially-consumed set of 3 → 3", () => {
  const codes = JSON.stringify(["$2a$10$a", "$2a$10$b", "$2a$10$c"]);
  assert.equal(backupCodesRemaining(codes), 3);
});

test("corrupt JSON → 0 (graceful, mirrors verifyTotpCode)", () => {
  assert.equal(backupCodesRemaining("{not valid json"), 0);
});

test("valid JSON that is not an array → 0 (defensive)", () => {
  assert.equal(backupCodesRemaining('{"foo":"bar"}'), 0);
  assert.equal(backupCodesRemaining('"a single string"'), 0);
  assert.equal(backupCodesRemaining("42"), 0);
});

console.log(`\n${passed} passed, ${failed} failed\n`);
if (failed > 0) process.exit(1);
