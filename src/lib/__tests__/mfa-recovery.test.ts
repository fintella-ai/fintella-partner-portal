// ---------------------------------------------------------------------------
// Tests for classifyRecoveryToken — pure validity check for an MFA break-glass
// recovery token (reuses the PasswordResetToken row shape with a distinct role).
// Run: npx tsx src/lib/__tests__/mfa-recovery.test.ts
// ---------------------------------------------------------------------------

import assert from "node:assert/strict";
import {
  classifyRecoveryToken,
  MFA_RECOVERY_ROLE,
  MFA_RECOVERY_TTL_MS,
} from "../mfa-recovery";

let passed = 0;
let failed = 0;
function test(name: string, fn: () => void) {
  try { fn(); passed++; console.log(`  ✓ ${name}`); }
  catch (e: unknown) { failed++; console.error(`  ✗ ${name}`); console.error(`    ${(e as Error).message}`); }
}

console.log("\nclassifyRecoveryToken\n");

const NOW = new Date("2026-05-31T12:00:00.000Z");
const future = new Date(NOW.getTime() + MFA_RECOVERY_TTL_MS);
const past = new Date(NOW.getTime() - 1000);

test("a 15-minute TTL is enforced", () => {
  assert.equal(MFA_RECOVERY_TTL_MS, 15 * 60 * 1000);
});

test("missing row → not_found", () => {
  const s = classifyRecoveryToken(null, NOW);
  assert.equal(s.ok, false);
  assert.equal((s as any).reason, "not_found");
});

test("a password-reset token (wrong role) is rejected → wrong_type", () => {
  const s = classifyRecoveryToken({ role: "partner", usedAt: null, expiresAt: future }, NOW);
  assert.equal(s.ok, false);
  assert.equal((s as any).reason, "wrong_type");
});

test("an already-consumed token → used", () => {
  const s = classifyRecoveryToken(
    { role: MFA_RECOVERY_ROLE, usedAt: new Date(NOW.getTime() - 60_000), expiresAt: future },
    NOW,
  );
  assert.equal(s.ok, false);
  assert.equal((s as any).reason, "used");
});

test("an expired token → expired", () => {
  const s = classifyRecoveryToken({ role: MFA_RECOVERY_ROLE, usedAt: null, expiresAt: past }, NOW);
  assert.equal(s.ok, false);
  assert.equal((s as any).reason, "expired");
});

test("a token expiring exactly now is treated as expired (no off-by-one grace)", () => {
  const s = classifyRecoveryToken({ role: MFA_RECOVERY_ROLE, usedAt: null, expiresAt: NOW }, NOW);
  assert.equal(s.ok, false);
  assert.equal((s as any).reason, "expired");
});

test("a fresh, correct-role, unexpired, unused token → ok", () => {
  const s = classifyRecoveryToken({ role: MFA_RECOVERY_ROLE, usedAt: null, expiresAt: future }, NOW);
  assert.equal(s.ok, true);
});

console.log(`\n${passed} passed, ${failed} failed\n`);
if (failed > 0) process.exit(1);
