import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getVapidPublicKey } from "@/lib/web-push";

/**
 * POST /api/ops/push/subscribe
 * Save a push subscription for the authenticated user.
 *
 * Body: { subscription: { endpoint, keys: { p256dh, auth } } }
 *
 * GET /api/ops/push/subscribe
 * Returns the VAPID public key (needed client-side to subscribe).
 */

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const vapidPublicKey = getVapidPublicKey();

    return NextResponse.json({ vapidPublicKey });
  } catch (err) {
    console.error("[push/subscribe] GET error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { subscription } = body;

    if (
      !subscription?.endpoint ||
      !subscription?.keys?.p256dh ||
      !subscription?.keys?.auth
    ) {
      return NextResponse.json(
        { error: "Invalid subscription: endpoint, keys.p256dh, and keys.auth are required" },
        { status: 400 }
      );
    }

    // Upsert: if endpoint already exists, update keys (browser may regenerate)
    const record = await prisma.opsPushSubscription.upsert({
      where: { endpoint: subscription.endpoint },
      create: {
        userId: session.user.id,
        endpoint: subscription.endpoint,
        p256dh: subscription.keys.p256dh,
        auth: subscription.keys.auth,
      },
      update: {
        userId: session.user.id,
        p256dh: subscription.keys.p256dh,
        auth: subscription.keys.auth,
      },
    });

    return NextResponse.json({ ok: true, id: record.id });
  } catch (err) {
    console.error("[push/subscribe] POST error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
