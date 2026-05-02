import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/**
 * POST /api/ops/push/unsubscribe
 * Remove a push subscription by endpoint.
 *
 * Body: { endpoint: string }
 */

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { endpoint } = body;

    if (!endpoint) {
      return NextResponse.json(
        { error: "endpoint is required" },
        { status: 400 }
      );
    }

    // Only allow users to unsubscribe their own subscriptions
    const existing = await prisma.opsPushSubscription.findUnique({
      where: { endpoint },
    });

    if (!existing) {
      // Already gone — idempotent success
      return NextResponse.json({ ok: true });
    }

    if (existing.userId !== session.user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    await prisma.opsPushSubscription.delete({
      where: { endpoint },
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[push/unsubscribe] POST error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
