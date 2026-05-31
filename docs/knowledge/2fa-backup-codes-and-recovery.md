# 2FA backup codes + MFA recovery — architecture & patterns

Durable reference for the TOTP/2FA system (PRs #1106, #1107, #1108, #1109). For Finn/Stella when answering partner 2FA questions.

## Data model (no dedicated tables)
- TOTP fields live on **three** login identities, identically: `User` (admin), `Partner` (direct), `PartnerUser` (corporate team member): `totpSecret`, `totpEnabled`, `totpPendingSecret`, `totpBackupCodes`.
- `totpBackupCodes` = JSON array of **bcryptjs hashes** (string). No per-code "used" flag — consumption splices the matched entry out and rewrites the field. Empty set = `"[]"`.
- Enforcement toggles on `PortalSettings`: `mfaRequiredPartners`, `mfaRequiredAdmins`.
- **Recovery tokens reuse `PasswordResetToken`** with a distinct `role` = `"partner-mfa-recovery"` (no migration). `reset-password` rejects non-`partner`/`admin` roles; recovery routes only accept the recovery role → the two flows can't cross-consume tokens.

## Key modules
- `src/lib/totp.ts` — **Edge-safe** (in `auth.ts` → middleware import graph; no `node:crypto`). `verifyTotpCode(identity, code)` → `{ok, consumedBackupCodes}` (TOTP first, then single-use backup code; caller persists `consumedBackupCodes` when non-null). `backupCodesRemaining(json)` → count, defensive (null/corrupt/non-array → 0), count-only (never exposes hashes).
- `src/lib/totp-codes.ts` — **Node-only** (`makeBackupCodes`, `crypto.randomInt` rejection-sampled = CodeQL-clean). Import only from `/api/*` routes.
- `src/lib/mfa-recovery.ts` — `MFA_RECOVERY_ROLE`, `MFA_RECOVERY_TTL_MS` (15 min), pure `classifyRecoveryToken(row, now)` → `not_found`/`wrong_type`/`used`/`expired`/`ok`.

## API contract
- `GET/POST /api/{partner,admin}/2fa` — actions: `setup` → `{qrDataUrl,secret}`; `enable` → `{enabled,backupCodes}` (shown ONCE); `regenerate` → `{backupCodes}` (fresh 10, old invalidated, requires current code); `disable` → `{enabled:false}` (partner: 403 while `mfaRequiredPartners`). GET → `{enabled, backupCodesRemaining}` (null while disabled). **All POSTs rate-limited** via `checkAuthRateLimit(ip)` (10/IP/15min).
- `POST /api/auth/mfa-recovery/request {email,password}` — verifies password (active PartnerUser → Partner, same order as `auth.ts`), emails single-use link only on valid password + `totpEnabled`. Always generic `200` (anti-enumeration). Rate-limited.
- `GET/POST /api/auth/mfa-recovery/confirm` — GET validates (no consume); POST **burns token first** atomically (`updateMany where {token, role, usedAt:null}` → count 0 = already used → 410), then clears all TOTP fields. Re-checks blocked/archived.

## Login enforcement (the lockout this fixes)
- `auth.ts` challenges only enrolled identities: `if (totpEnabled && totpSecret) verifyTotpCode(...)`. A required-MFA partner with no authenticator + 0 backup codes → `authorize()` returns null → **locked out at login** (never reaches the post-login gate). Recovery clears TOTP so login proceeds; then `mfa-gate.ts` (`mustEnrollMfa`: `!totpEnabled && mfaRequiredPartners`) forces re-enrollment via `MfaEnforcementGate` → no permanent unprotected state.

## CodeQL-safe patterns reused
- Unbiased RNG: `crypto.randomInt(n)` (never `randomBytes % n`).
- Single-use token: optimistic-lock `updateMany({where:{usedAt:null}})`, burn before the protected mutation, never `.catch()`-swallow the burn.
- Anti-enumeration: generic `200`, send/act only on verified credentials; structural email checks (no backtracking regex).
