import { randomInt } from "crypto";
import { hash } from "bcryptjs";

/**
 * Backup-code generation — Node-runtime ONLY (imports node:crypto for an
 * unbiased RNG). Kept separate from src/lib/totp.ts so the login-verify helper
 * stays Edge-safe (auth.ts → middleware.ts runs on the Edge). Import this only
 * from API routes under /api/* (Node runtime).
 */

/**
 * Generate `count` unbiased uppercase-alphanumeric backup codes (no ambiguous
 * I/O/0/1). Returns the plaintext (shown to the user once) plus their bcrypt
 * hashes as a JSON string for storage. Matches the admin flow's format so both
 * portals present identical backup codes. crypto.randomInt is rejection-sampled
 * (CodeQL-clean — no modulo bias).
 */
export async function makeBackupCodes(
  count = 10
): Promise<{ plain: string[]; hashedJson: string }> {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no I, O, 0, 1
  const plain: string[] = [];
  for (let i = 0; i < count; i++) {
    let code = "";
    for (let j = 0; j < 8; j++) code += alphabet[randomInt(alphabet.length)];
    plain.push(code);
  }
  const hashed = await Promise.all(plain.map((c) => hash(c, 10)));
  return { plain, hashedJson: JSON.stringify(hashed) };
}
