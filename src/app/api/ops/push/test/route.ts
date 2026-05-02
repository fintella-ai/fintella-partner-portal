import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { sendPushNotification, isPushConfigured } from "@/lib/web-push";

/**
 * POST /api/ops/push/test
 * Send a test notification to ALL of the authenticated user's push subscriptions.
 */

export async function POST() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!isPushConfigured()) {
      return NextResponse.json(
        {
          ok: false,
          demo: true,
          message: "Push notifications not configured (VAPID keys missing)",
        },
        { status: 200 }
      );
    }

    const subscriptions = await prisma.opsPushSubscription.findMany({
      where: { userId: session.user.id },
    });

    if (subscriptions.length === 0) {
      return NextResponse.json(
        { ok: false, message: "No push subscriptions found for your account" },
        { status: 404 }
      );
    }

    const results = await Promise.allSettled(
      subscriptions.map(async (sub) => {
        const success = await sendPushNotification(
          {
            endpoint: sub.endpoint,
            keys: { p256dh: sub.p256dh, auth: sub.auth },
          },
          {
            title: "Ops Center",
            body: "Test notification — push is working!",
            icon: "/icons/icon-192x192.png",
            url: "/admin",
            tag: "ops-test",
          }
        );

        // If the subscription is gone (410/404), clean it up
        if (!success) {
          await prisma.opsPushSubscription
            .delete({ where: { id: sub.id } })
            .catch(() => {
              /* already gone */
            });
        }

        return { endpoint: sub.endpoint, success };
      })
    );

    const sent = results.filter(
      (r): r is PromiseFulfilledResult<{ endpoint: string; success: boolean }> =>
        r.status === "fulfilled" && r.value.success
    ).length;
    const failed = results.length - sent;

    return NextResponse.json({
      ok: true,
      sent,
      failed,
      total: results.length,
    });
  } catch (err) {
    console.error("[push/test] POST error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
