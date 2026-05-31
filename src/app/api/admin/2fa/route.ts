import { NextResponse } from "next/server";
import { randomInt } from "crypto";
import { authenticator } from "otplib";
import QRCode from "qrcode";
import { hash } from "bcryptjs";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { verifyTotpCode, backupCodesRemaining } from "@/lib/totp";
import { checkAuthRateLimit } from "@/lib/auth-rate-limit";

const ADMIN_ROLES = ["super_admin", "admin", "accounting", "partner_support"];

/**
 * Opt-in admin Two-Factor Authentication (TOTP).
 *
 * GET   → { enabled, backupCodesRemaining } for the current admin.
 * POST  → action-based: "setup" | "enable" | "regenerate" | "disable".
 *
 * Strictly opt-in: an admin who never enrolls logs in exactly as before.
 * Nothing here enforces 2FA — see src/lib/auth.ts admin-login provider, which
 * only requires a code when the user's totpEnabled flag is true.
 */

async function currentAdmin() {
  const session = await auth();
  const email = session?.user?.email;
  const role = (session?.user as any)?.role as string | undefined;
  if (!email || !role || !ADMIN_ROLES.includes(role)) return null;
  return prisma.user.findFirst({
    where: { email: { equals: email.trim(), mode: "insensitive" } },
  });
}

/** Generate N random uppercase-alphanumeric backup codes (no ambiguous chars). */
function makeBackupCodes(count: number): string[] {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no I,O,0,1
  const codes: string[] = [];
  for (let i = 0; i < count; i++) {
    let code = "";
    for (let j = 0; j < 8; j++) {
      // randomInt is rejection-sampled (unbiased) — avoids the modulo bias
      // CodeQL flags on randomBytes % n.
      code += alphabet[randomInt(alphabet.length)];
    }
    codes.push(code);
  }
  return codes;
}

export async function GET() {
  const user = await currentAdmin();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return NextResponse.json({
    enabled: user.totpEnabled,
    // Only meaningful once enrolled — null while disabled so the card never
    // flashes a false "0 of 10 backup codes left" warning before enrollment.
    backupCodesRemaining: user.totpEnabled ? backupCodesRemaining(user.totpBackupCodes) : null,
  });
}

export async function POST(req: Request) {
  // Throttle code-verifying actions (enable/regenerate/disable) per IP so a
  // hijacked session can't brute-force the 6-digit TOTP space (~1M, 90s window).
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  const limit = checkAuthRateLimit(ip);
  if (!limit.ok) {
    return NextResponse.json(
      { error: "Too many attempts. Please try again later." },
      { status: 429, headers: { "Retry-After": String(Math.ceil((limit.retryAfterMs || 60000) / 1000)) } },
    );
  }

  const user = await currentAdmin();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: { action?: string; code?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const action = body.action;
  const code = typeof body.code === "string" ? body.code.trim() : "";

  // ── SETUP: generate a pending secret + enrollment QR. Does NOT enable 2FA. ──
  if (action === "setup") {
    const secret = authenticator.generateSecret();
    await prisma.user.update({
      where: { id: user.id },
      data: { totpPendingSecret: secret },
    });
    const otpauthUrl = authenticator.keyuri(user.email, "Fintella Admin", secret);
    const qrDataUrl = await QRCode.toDataURL(otpauthUrl);
    return NextResponse.json({ qrDataUrl, secret });
  }

  // ── ENABLE: verify a code against the pending secret, then activate. ──
  if (action === "enable") {
    const pending = user.totpPendingSecret;
    if (!pending) {
      return NextResponse.json(
        { error: "No enrollment in progress. Start setup first." },
        { status: 400 },
      );
    }
    if (!code) {
      return NextResponse.json({ error: "Verification code required." }, { status: 400 });
    }
    const valid = authenticator.verify({ token: code, secret: pending });
    if (!valid) {
      return NextResponse.json({ error: "Invalid verification code." }, { status: 400 });
    }

    const plainCodes = makeBackupCodes(10);
    const hashedCodes = await Promise.all(plainCodes.map((c) => hash(c, 10)));

    await prisma.user.update({
      where: { id: user.id },
      data: {
        totpSecret: pending,
        totpEnabled: true,
        totpPendingSecret: null,
        totpBackupCodes: JSON.stringify(hashedCodes),
      },
    });

    // Plaintext backup codes are shown exactly once and never stored.
    return NextResponse.json({ enabled: true, backupCodes: plainCodes });
  }

  // ── REGENERATE: replace ALL backup codes with a fresh set of 10. Requires a
  // valid current code (same bar as disable) so a hijacked session can't
  // silently rotate codes out from under the admin. ──
  if (action === "regenerate") {
    if (!user.totpEnabled || !user.totpSecret) {
      return NextResponse.json(
        { error: "Enable two-factor authentication first." },
        { status: 400 },
      );
    }
    if (!code) {
      return NextResponse.json(
        { error: "Enter a current 2FA or backup code to regenerate." },
        { status: 400 },
      );
    }
    const res = await verifyTotpCode(user, code);
    if (!res.ok) {
      return NextResponse.json({ error: "Invalid code." }, { status: 400 });
    }
    // A fresh set fully replaces the old one (any code used to authorize above is
    // now invalid alongside the rest). Shown exactly once.
    const plainCodes = makeBackupCodes(10);
    const hashedCodes = await Promise.all(plainCodes.map((c) => hash(c, 10)));
    await prisma.user.update({
      where: { id: user.id },
      data: { totpBackupCodes: JSON.stringify(hashedCodes) },
    });
    return NextResponse.json({ backupCodes: plainCodes });
  }

  // ── DISABLE: require a valid current TOTP or backup code first. ──
  if (action === "disable") {
    if (!user.totpEnabled || !user.totpSecret) {
      return NextResponse.json({ enabled: false });
    }
    if (!code) {
      return NextResponse.json(
        { error: "Enter a current 2FA or backup code to disable." },
        { status: 400 },
      );
    }
    const res = await verifyTotpCode(user, code);
    if (!res.ok) {
      return NextResponse.json({ error: "Invalid code." }, { status: 400 });
    }

    await prisma.user.update({
      where: { id: user.id },
      data: {
        totpSecret: null,
        totpEnabled: false,
        totpPendingSecret: null,
        totpBackupCodes: null,
      },
    });
    return NextResponse.json({ enabled: false });
  }

  return NextResponse.json({ error: "Unknown action." }, { status: 400 });
}
