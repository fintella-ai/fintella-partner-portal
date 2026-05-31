import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { checkAuthRateLimit } from "@/lib/auth-rate-limit";
import { classifyRecoveryToken, MFA_RECOVERY_ROLE } from "@/lib/mfa-recovery";

/**
 * MFA break-glass recovery — token validation + consumption.
 *
 * GET  ?token=XXX → { valid, reason? } without consuming (so the page can show
 *                   "expired / used" before the user clicks).
 * POST { token }  → disables 2FA on the owning identity (clears all TOTP fields)
 *                   and marks the token used. The token itself is the proof of
 *                   ownership: it was emailed only after the password was
 *                   verified (see ../request), is single-use, and expires in
 *                   15 minutes.
 *
 * After recovery, if the portal requires partner MFA, the post-login
 * MfaEnforcementGate forces immediate re-enrollment — so break-glass never
 * leaves an account permanently without 2FA.
 */

const STATUS: Record<string, number> = { not_found: 404, wrong_type: 404, used: 410, expired: 410 };

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token");
  if (!token) return NextResponse.json({ valid: false, reason: "missing_token" }, { status: 400 });

  const row = await prisma.passwordResetToken.findUnique({ where: { token } }).catch(() => null);
  const state = classifyRecoveryToken(row, new Date());
  if (!state.ok) {
    return NextResponse.json({ valid: false, reason: state.reason }, { status: STATUS[state.reason] || 400 });
  }
  return NextResponse.json({ valid: true });
}

const CLEAR_TOTP = {
  totpSecret: null,
  totpEnabled: false,
  totpPendingSecret: null,
  totpBackupCodes: null,
};

export async function POST(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  const limit = checkAuthRateLimit(ip);
  if (!limit.ok) {
    return NextResponse.json(
      { error: "Too many requests. Please try again later." },
      { status: 429, headers: { "Retry-After": String(Math.ceil((limit.retryAfterMs || 60000) / 1000)) } }
    );
  }

  let token = "";
  try {
    const body = await req.json();
    token = typeof body?.token === "string" ? body.token : "";
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
  if (!token) return NextResponse.json({ error: "Missing token" }, { status: 400 });

  const row = await prisma.passwordResetToken.findUnique({ where: { token } }).catch(() => null);
  const state = classifyRecoveryToken(row, new Date());
  if (!state.ok || !row) {
    const reason = state.ok ? "not_found" : state.reason;
    const messages: Record<string, string> = {
      not_found: "This link is invalid.",
      wrong_type: "This link is invalid.",
      used: "This link has already been used.",
      expired: "This link has expired. Please request a new one.",
    };
    return NextResponse.json({ error: messages[reason] || "This link is invalid." }, { status: STATUS[reason] || 400 });
  }

  // Burn the token FIRST, atomically: only the request that flips usedAt from
  // null wins. A concurrent duplicate (or replay) gets count 0 → already-used.
  // Doing this before any TOTP write makes single-use race-safe and means a
  // failed burn never returns success with a still-live token.
  let burned;
  try {
    burned = await prisma.passwordResetToken.updateMany({
      where: { token, role: MFA_RECOVERY_ROLE, usedAt: null },
      data: { usedAt: new Date() },
    });
  } catch (err) {
    console.error("[mfa-recovery] token consume failed:", err);
    return NextResponse.json({ error: "Recovery failed. Please try again." }, { status: 500 });
  }
  if (burned.count === 0) {
    return NextResponse.json({ error: "This link has already been used." }, { status: 410 });
  }

  // Token is now spent. Resolve the owning identity by email, same order as
  // login (active PartnerUser first, then Partner), re-check it isn't
  // blocked/archived, and clear all TOTP fields.
  let disabled = false;
  const partnerUser = await prisma.partnerUser
    .findFirst({ where: { email: { equals: row.email, mode: "insensitive" }, active: true } })
    .catch(() => null);
  if (partnerUser) {
    const owner = await prisma.partner
      .findFirst({ where: { partnerCode: partnerUser.partnerCode }, select: { status: true } })
      .catch(() => null);
    if (owner && owner.status !== "blocked" && owner.status !== "archived") {
      await prisma.partnerUser.update({ where: { id: partnerUser.id }, data: CLEAR_TOTP });
      disabled = true;
    }
  } else {
    const partner = await prisma.partner
      .findFirst({ where: { email: { equals: row.email, mode: "insensitive" } } })
      .catch(() => null);
    if (partner && partner.status !== "blocked" && partner.status !== "archived") {
      await prisma.partner.update({ where: { id: partner.id }, data: CLEAR_TOTP });
      disabled = true;
    }
  }
  if (!disabled) return NextResponse.json({ error: "Account no longer exists." }, { status: 404 });

  return NextResponse.json({ ok: true });
}
