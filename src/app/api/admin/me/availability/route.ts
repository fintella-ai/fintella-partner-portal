import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/**
 * /api/admin/me/availability — per-admin toggles for PartnerOS escalation
 * participation. Phase 3c.4b of the roadmap (spec §8.3).
 *
 * Fields:
 *   availableForLiveChat   — admin is willing to receive Ollie → live-chat
 *                            transfers when they're online
 *   availableForLiveCall   — same, for Twilio live-phone bridging
 *   personalCellPhone      — E.164 for IT-emergency outbound call chain
 *   isITEmergencyContact   — included in emergencyCallSuperAdmin fan-out
 *
 * Each admin edits only their OWN record. Any admin role can use this —
 * it's a per-user preference, not a portal-wide setting.
 */

export async function GET() {
  const session = await auth();
  if (!session?.user?.email)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      availableForLiveChat: true,
      availableForLiveCall: true,
      personalCellPhone: true,
      isITEmergencyContact: true,
      lastHeartbeatAt: true,
    },
  });
  if (!user)
    return NextResponse.json({ error: "Admin user not found" }, { status: 404 });

  return NextResponse.json({ availability: user });
}

export async function PUT(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.email)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const data: Record<string, unknown> = {};
  if (typeof body.availableForLiveChat === "boolean")
    data.availableForLiveChat = body.availableForLiveChat;
  if (typeof body.availableForLiveCall === "boolean")
    data.availableForLiveCall = body.availableForLiveCall;
  if (body.personalCellPhone === null) {
    data.personalCellPhone = null;
  } else if (typeof body.personalCellPhone === "string") {
    const trimmed = body.personalCellPhone.trim();
    if (trimmed === "") {
      data.personalCellPhone = null;
    } else {
      // Lenient format check — keep only digits + leading +.
      const clean = trimmed.replace(/[^\d+]/g, "");
      if (!/^\+?\d{7,15}$/.test(clean)) {
        return NextResponse.json(
          { error: "personalCellPhone must be 7-15 digits, optionally leading +" },
          { status: 400 }
        );
      }
      data.personalCellPhone = clean.startsWith("+") ? clean : `+${clean}`;
    }
  }
  // `isITEmergencyContact` is super_admin-only to change — it wires into
  // a paging path. Quietly ignore self-service attempts to set it true.
  if (
    typeof body.isITEmergencyContact === "boolean" &&
    (session.user as any).role === "super_admin"
  ) {
    data.isITEmergencyContact = body.isITEmergencyContact;
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json(
      { error: "No writable fields supplied" },
      { status: 400 }
    );
  }

  try {
    const updated = await prisma.user.update({
      where: { email: session.user.email },
      data,
      select: {
        id: true,
        availableForLiveChat: true,
        availableForLiveCall: true,
        personalCellPhone: true,
        isITEmergencyContact: true,
      },
    });
    return NextResponse.json({ availability: updated });
  } catch (err) {
    console.error("[api/admin/me/availability]", err);
    return NextResponse.json(
      { error: "Failed to update availability" },
      { status: 500 }
    );
  }
}
