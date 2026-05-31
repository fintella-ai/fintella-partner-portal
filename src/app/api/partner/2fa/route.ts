import { NextResponse } from "next/server";
import { authenticator } from "otplib";
import QRCode from "qrcode";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { verifyTotpCode, backupCodesRemaining } from "@/lib/totp";
import { makeBackupCodes } from "@/lib/totp-codes";
import { checkAuthRateLimit } from "@/lib/auth-rate-limit";

/**
 * Partner-facing 2FA (TOTP) enrollment + management. Mirrors /api/admin/2fa's
 * action contract exactly (setup / enable / disable, `code` field, `qrDataUrl`)
 * so the same enrollment UI drives both portals — but it operates on the
 * partner's login identity:
 *   - corporate team member  → PartnerUser row (matched by email)
 *   - direct partner login   → Partner row    (matched by email)
 * Same resolution order as the partner-login provider in src/lib/auth.ts.
 *
 * GET                    → { enabled, backupCodesRemaining }
 * POST {setup}           → { qrDataUrl, secret }  (pending secret stored, NOT enabled)
 * POST {enable,code}     → { enabled, backupCodes } (codes shown ONCE)
 * POST {regenerate,code} → { backupCodes } (new set, old codes invalidated; shown ONCE)
 * POST {disable,code}    → { enabled:false } (blocked while enforcement is ON)
 */

type Identity = {
  kind: "partnerUser" | "partner";
  id: string;
  email: string;
  totpEnabled: boolean;
  totpSecret: string | null;
  totpPendingSecret: string | null;
  totpBackupCodes: string | null;
};

async function currentPartnerIdentity(): Promise<Identity | null> {
  const session = await auth();
  const email = session?.user?.email;
  const role = (session?.user as any)?.role;
  if (!email || role !== "partner") return null;

  const partnerUser = await prisma.partnerUser.findFirst({
    where: { email: { equals: email.trim(), mode: "insensitive" }, active: true },
  });
  if (partnerUser) {
    return {
      kind: "partnerUser",
      id: partnerUser.id,
      email: partnerUser.email,
      totpEnabled: partnerUser.totpEnabled,
      totpSecret: partnerUser.totpSecret,
      totpPendingSecret: partnerUser.totpPendingSecret,
      totpBackupCodes: partnerUser.totpBackupCodes,
    };
  }
  const partner = await prisma.partner.findFirst({
    where: { email: { equals: email.trim(), mode: "insensitive" } },
  });
  if (partner) {
    return {
      kind: "partner",
      id: partner.id,
      email: partner.email,
      totpEnabled: partner.totpEnabled,
      totpSecret: partner.totpSecret,
      totpPendingSecret: partner.totpPendingSecret,
      totpBackupCodes: partner.totpBackupCodes,
    };
  }
  return null;
}

// Precise shape so Prisma accepts it for BOTH models (Record<string, unknown>
// would be rejected — Prisma's update `data` is strongly typed). Every field
// here exists identically on Partner and PartnerUser.
type TotpUpdate = {
  totpSecret?: string | null;
  totpEnabled?: boolean;
  totpPendingSecret?: string | null;
  totpBackupCodes?: string | null;
};

function persist(kind: Identity["kind"], id: string, data: TotpUpdate) {
  return kind === "partnerUser"
    ? prisma.partnerUser.update({ where: { id }, data })
    : prisma.partner.update({ where: { id }, data });
}

export async function GET() {
  const identity = await currentPartnerIdentity();
  if (!identity) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return NextResponse.json({
    enabled: identity.totpEnabled,
    // Only meaningful once enrolled — null while disabled so the card never
    // flashes a false "0 of 10 backup codes left" warning before enrollment.
    backupCodesRemaining: identity.totpEnabled
      ? backupCodesRemaining(identity.totpBackupCodes)
      : null,
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
      { status: 429, headers: { "Retry-After": String(Math.ceil((limit.retryAfterMs || 60000) / 1000)) } }
    );
  }

  const identity = await currentPartnerIdentity();
  if (!identity) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

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
    await persist(identity.kind, identity.id, { totpPendingSecret: secret });
    const otpauthUrl = authenticator.keyuri(identity.email, "Fintella Partner", secret);
    const qrDataUrl = await QRCode.toDataURL(otpauthUrl);
    return NextResponse.json({ qrDataUrl, secret });
  }

  // ── ENABLE: verify a code against the pending secret, then activate. ──
  if (action === "enable") {
    const pending = identity.totpPendingSecret;
    if (!pending) {
      return NextResponse.json(
        { error: "No enrollment in progress. Start setup first." },
        { status: 400 }
      );
    }
    if (!code) {
      return NextResponse.json({ error: "Verification code required." }, { status: 400 });
    }
    if (!authenticator.verify({ token: code, secret: pending })) {
      return NextResponse.json({ error: "Invalid verification code." }, { status: 400 });
    }

    const { plain, hashedJson } = await makeBackupCodes(10);
    await persist(identity.kind, identity.id, {
      totpSecret: pending,
      totpEnabled: true,
      totpPendingSecret: null,
      totpBackupCodes: hashedJson,
    });
    // Plaintext backup codes are shown exactly once and never stored.
    return NextResponse.json({ enabled: true, backupCodes: plain });
  }

  // ── REGENERATE: replace ALL backup codes with a fresh set of 10. Requires a
  // valid current code (same bar as disable) so a hijacked session can't
  // silently rotate codes out from under the partner. ──
  if (action === "regenerate") {
    if (!identity.totpEnabled || !identity.totpSecret) {
      return NextResponse.json(
        { error: "Enable two-factor authentication first." },
        { status: 400 }
      );
    }
    if (!code) {
      return NextResponse.json(
        { error: "Enter a current 2FA or backup code to regenerate." },
        { status: 400 }
      );
    }
    const res = await verifyTotpCode(identity, code);
    if (!res.ok) {
      return NextResponse.json({ error: "Invalid code." }, { status: 400 });
    }
    // A fresh set fully replaces the old one (any code consumed by the verify
    // above is moot — every prior code is now invalid). Shown exactly once.
    const { plain, hashedJson } = await makeBackupCodes(10);
    await persist(identity.kind, identity.id, { totpBackupCodes: hashedJson });
    return NextResponse.json({ backupCodes: plain });
  }

  // ── DISABLE: require a valid current code, AND block while enforced. ──
  if (action === "disable") {
    // Can't opt out while the portal requires MFA for partners.
    const settings = await prisma.portalSettings.findFirst();
    if (settings?.mfaRequiredPartners) {
      return NextResponse.json(
        { error: "Two-factor authentication is required and cannot be disabled." },
        { status: 403 }
      );
    }
    if (!identity.totpEnabled || !identity.totpSecret) {
      return NextResponse.json({ enabled: false });
    }
    if (!code) {
      return NextResponse.json(
        { error: "Enter a current 2FA or backup code to disable." },
        { status: 400 }
      );
    }
    const res = await verifyTotpCode(identity, code);
    if (!res.ok) {
      return NextResponse.json({ error: "Invalid code." }, { status: 400 });
    }
    await persist(identity.kind, identity.id, {
      totpSecret: null,
      totpEnabled: false,
      totpPendingSecret: null,
      totpBackupCodes: null,
    });
    return NextResponse.json({ enabled: false });
  }

  return NextResponse.json({ error: "Unknown action." }, { status: 400 });
}
