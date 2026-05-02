import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/ops/push/preferences
 * Get the user's notification preferences (quiet hours, entity filter)
 * across all their subscriptions.
 *
 * PATCH /api/ops/push/preferences
 * Update preferences. Body: { quietStart?, quietEnd?, entityFilter? }
 * Applies to ALL of the user's subscriptions.
 */

const HH_MM_REGEX = /^([01]\d|2[0-3]):[0-5]\d$/;

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Return preferences from the first subscription (they're synced across all)
    const sub = await prisma.opsPushSubscription.findFirst({
      where: { userId: session.user.id },
      select: {
        quietStart: true,
        quietEnd: true,
        entityFilter: true,
      },
    });

    // Count total subscriptions for the user
    const count = await prisma.opsPushSubscription.count({
      where: { userId: session.user.id },
    });

    return NextResponse.json({
      subscriptionCount: count,
      preferences: sub
        ? {
            quietStart: sub.quietStart,
            quietEnd: sub.quietEnd,
            entityFilter: sub.entityFilter,
          }
        : null,
    });
  } catch (err) {
    console.error("[push/preferences] GET error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { quietStart, quietEnd, entityFilter } = body;

    // Validate quiet hours format
    if (quietStart !== undefined && quietStart !== null) {
      if (typeof quietStart !== "string" || !HH_MM_REGEX.test(quietStart)) {
        return NextResponse.json(
          { error: "quietStart must be in HH:mm format (e.g. '22:00')" },
          { status: 400 }
        );
      }
    }

    if (quietEnd !== undefined && quietEnd !== null) {
      if (typeof quietEnd !== "string" || !HH_MM_REGEX.test(quietEnd)) {
        return NextResponse.json(
          { error: "quietEnd must be in HH:mm format (e.g. '08:00')" },
          { status: 400 }
        );
      }
    }

    // Build update data — only include fields that were provided
    const updateData: Record<string, string | null> = {};
    if (quietStart !== undefined) updateData.quietStart = quietStart;
    if (quietEnd !== undefined) updateData.quietEnd = quietEnd;
    if (entityFilter !== undefined) updateData.entityFilter = entityFilter;

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json(
        { error: "No fields to update" },
        { status: 400 }
      );
    }

    // Apply to all of the user's subscriptions
    const result = await prisma.opsPushSubscription.updateMany({
      where: { userId: session.user.id },
      data: updateData,
    });

    return NextResponse.json({ ok: true, updated: result.count });
  } catch (err) {
    console.error("[push/preferences] PATCH error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
