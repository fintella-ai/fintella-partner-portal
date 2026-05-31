import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { compare } from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { sendMfaRecoveryEmail } from "@/lib/sendgrid";
import { checkAuthRateLimit } from "@/lib/auth-rate-limit";
import { MFA_RECOVERY_ROLE, MFA_RECOVERY_TTL_MS } from "@/lib/mfa-recovery";

const PORTAL_URL =
  process.env.PORTAL_URL?.replace(/\/+$/, "") ||
  process.env.NEXT_PUBLIC_PORTAL_URL?.replace(/\/+$/, "") ||
  "https://fintella.partners";

/**
 * POST /api/auth/mfa-recovery/request
 * Body: { email, password }
 *
 * Break-glass recovery for a partner locked out of a 2FA-required account who
 * has lost their authenticator AND run out of backup codes. We email a single-
 * use, 15-minute link to remove 2FA — but ONLY after verifying the password, so
 * recovery needs BOTH the inbox (possession) and the password (knowledge). This
 * is strictly stronger than the email-only password reset.
 *
 * Always returns 200 with a generic body regardless of whether the email/
 * password matched or whether 2FA is enrolled — no account enumeration.
 *
 * Identity resolution matches the partner-login provider in src/lib/auth.ts:
 * an active PartnerUser (corporate team member) first, then the direct Partner.
 */
export async function POST(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  const limit = checkAuthRateLimit(ip);
  if (!limit.ok) {
    return NextResponse.json(
      { message: "Too many requests. Please try again later." },
      { status: 429, headers: { "Retry-After": String(Math.ceil((limit.retryAfterMs || 60000) / 1000)) } }
    );
  }

  const genericOk = NextResponse.json({ ok: true });

  let email = "";
  let password = "";
  try {
    const body = await req.json();
    email = typeof body?.email === "string" ? body.email.trim() : "";
    password = typeof body?.password === "string" ? body.password : "";
  } catch {
    return genericOk;
  }
  if (!email || !password) return genericOk;

  // Resolve the login identity exactly as auth.ts does: active PartnerUser
  // (with a non-blocked/archived owner partner) first, then direct Partner.
  let identity:
    | { email: string; name: string | null; passwordHash: string | null; totpEnabled: boolean }
    | null = null;

  const partnerUser = await prisma.partnerUser
    .findFirst({ where: { email: { equals: email, mode: "insensitive" }, active: true } })
    .catch(() => null);
  if (partnerUser) {
    const owner = await prisma.partner
      .findFirst({ where: { partnerCode: partnerUser.partnerCode }, select: { status: true } })
      .catch(() => null);
    if (owner && owner.status !== "blocked" && owner.status !== "archived") {
      identity = {
        email: partnerUser.email,
        name: `${partnerUser.firstName} ${partnerUser.lastName}`.trim() || null,
        passwordHash: partnerUser.passwordHash,
        totpEnabled: partnerUser.totpEnabled,
      };
    }
  }
  if (!identity) {
    const partner = await prisma.partner
      .findFirst({ where: { email: { equals: email, mode: "insensitive" } } })
      .catch(() => null);
    if (partner && partner.status !== "blocked" && partner.status !== "archived") {
      identity = {
        email: partner.email,
        name: `${partner.firstName} ${partner.lastName}`.trim() || null,
        passwordHash: partner.passwordHash,
        totpEnabled: partner.totpEnabled,
      };
    }
  }

  // Send the link only when the password checks out AND 2FA is actually on
  // (recovery is pointless otherwise). Anything else: generic success, no email.
  if (identity?.passwordHash && identity.totpEnabled) {
    const valid = await compare(password, identity.passwordHash).catch(() => false);
    if (valid) {
      const token = randomBytes(32).toString("hex");
      const expiresAt = new Date(Date.now() + MFA_RECOVERY_TTL_MS);
      await prisma.passwordResetToken
        .create({ data: { token, email: identity.email, role: MFA_RECOVERY_ROLE, expiresAt } })
        .catch((err) => console.error("[mfa-recovery] token create failed:", err));

      const recoveryUrl = `${PORTAL_URL}/mfa-recovery?token=${token}`;
      // Fire-and-forget so send latency/failures don't leak via response timing.
      sendMfaRecoveryEmail({ email: identity.email, name: identity.name, recoveryUrl }).catch((err) =>
        console.error("[mfa-recovery] email send failed:", err)
      );
    }
  }

  return genericOk;
}
