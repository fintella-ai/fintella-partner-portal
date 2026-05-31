import { authenticator } from "otplib";
import { compare } from "bcryptjs";

/**
 * Shared TOTP (authenticator-app) LOGIN-VERIFY helper.
 *
 * `verifyTotpCode` is the single source of truth for verifying a submitted code
 * at login time — used identically by all three credential providers in
 * src/lib/auth.ts (admin, direct partner, corporate PartnerUser).
 *
 * IMPORTANT: this module is in the import graph of src/lib/auth.ts, which
 * src/middleware.ts pulls into the Edge runtime. Keep it free of Node-only APIs
 * (no `crypto`, no `fs`). otplib + bcryptjs are Edge-safe. Backup-code
 * GENERATION (which needs node:crypto for an unbiased RNG) lives in
 * src/lib/totp-codes.ts, imported only by the Node-runtime API routes.
 */

export interface TotpIdentity {
  totpSecret: string | null;
  totpBackupCodes: string | null; // JSON array of bcrypt-hashed codes
}

export interface TotpVerifyResult {
  ok: boolean;
  /**
   * When a single-use backup code was consumed this holds the new JSON array
   * (used code removed) that the caller must persist on the row. Null when no
   * backup code was consumed (a normal TOTP code, or failure) — nothing to save.
   */
  consumedBackupCodes: string | null;
}

/**
 * Verify a submitted code against an identity's TOTP secret, falling back to a
 * single-use hashed backup code. Pure — performs NO database writes; the caller
 * persists `consumedBackupCodes` when non-null (it knows which model/row to hit).
 */
export async function verifyTotpCode(
  identity: TotpIdentity,
  submitted: string
): Promise<TotpVerifyResult> {
  const token = (submitted || "").trim();
  if (!token || !identity.totpSecret) {
    return { ok: false, consumedBackupCodes: null };
  }

  if (authenticator.verify({ token, secret: identity.totpSecret })) {
    return { ok: true, consumedBackupCodes: null };
  }

  // Fall back to a single-use backup code.
  if (identity.totpBackupCodes) {
    try {
      const hashedCodes: string[] = JSON.parse(identity.totpBackupCodes);
      for (let i = 0; i < hashedCodes.length; i++) {
        if (await compare(token, hashedCodes[i])) {
          hashedCodes.splice(i, 1);
          return { ok: true, consumedBackupCodes: JSON.stringify(hashedCodes) };
        }
      }
    } catch {
      // Corrupt JSON → treat as no valid backup code.
    }
  }

  return { ok: false, consumedBackupCodes: null };
}

/**
 * Count how many single-use backup codes are still available, given the stored
 * JSON array of bcrypt hashes (`totpBackupCodes`). Pure and defensive: null,
 * empty, corrupt, or non-array input all yield 0 — never throws. Used to surface
 * a "X of 10 codes left" indicator and a low-codes warning in the 2FA settings
 * card (the hashes themselves are never exposed — only the count).
 */
export function backupCodesRemaining(totpBackupCodes: string | null): number {
  if (!totpBackupCodes) return 0;
  try {
    const parsed = JSON.parse(totpBackupCodes);
    return Array.isArray(parsed) ? parsed.length : 0;
  } catch {
    return 0;
  }
}
