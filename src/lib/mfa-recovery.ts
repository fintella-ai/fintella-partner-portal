/**
 * MFA break-glass recovery — shared constants + pure token validity check.
 *
 * A recovery token lets a partner who has lost their authenticator app AND run
 * out of backup codes remove 2FA from their account so they can sign in again.
 * It is only ever issued AFTER the correct password was supplied (see
 * /api/auth/mfa-recovery/request), so the email link alone is not enough — an
 * attacker would also need the password. Tokens are single-use and short-lived.
 *
 * Storage reuses the existing PasswordResetToken model with a distinct `role`
 * value (no schema migration). The distinct role keeps the two flows isolated:
 * the reset-password route rejects any non-"partner"/"admin" role, and the
 * recovery routes only accept MFA_RECOVERY_ROLE.
 */

export const MFA_RECOVERY_ROLE = "partner-mfa-recovery";

/** Break-glass tokens are deliberately short-lived. */
export const MFA_RECOVERY_TTL_MS = 15 * 60 * 1000; // 15 minutes

export type RecoveryTokenRow = {
  role: string;
  usedAt: Date | null;
  expiresAt: Date;
} | null;

export type RecoveryTokenState =
  | { ok: true }
  | { ok: false; reason: "not_found" | "wrong_type" | "used" | "expired" };

/**
 * Classify a recovery token row at time `now`. Pure — no I/O. The order matters:
 * an unknown token is "not_found"; a real token with the wrong role is
 * "wrong_type" (e.g. a password-reset token can't be used here); a consumed
 * token is "used"; one whose expiry has passed (or is exactly now) is "expired".
 */
export function classifyRecoveryToken(row: RecoveryTokenRow, now: Date): RecoveryTokenState {
  if (!row) return { ok: false, reason: "not_found" };
  if (row.role !== MFA_RECOVERY_ROLE) return { ok: false, reason: "wrong_type" };
  if (row.usedAt) return { ok: false, reason: "used" };
  if (row.expiresAt.getTime() <= now.getTime()) return { ok: false, reason: "expired" };
  return { ok: true };
}
