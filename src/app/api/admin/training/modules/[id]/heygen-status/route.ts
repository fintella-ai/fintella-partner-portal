import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { checkVideoStatus, isHeyGenEnabled } from "@/lib/heygen";

/**
 * GET /api/admin/training/modules/[id]/heygen-status
 *
 * Polls HeyGen for the render status of the video associated with this module.
 * When completed, stores the videoUrl on the module and clears heygenVideoId.
 *
 * Returns:
 *   { status: "no_video" }                        — no render in progress
 *   { status: "rendering", videoId }              — still rendering
 *   { status: "completed", videoUrl, duration }   — done, videoUrl now stored
 *   { status: "failed", error }                   — HeyGen reported failure
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const role = (session.user as any).role;
  if (!["super_admin", "admin"].includes(role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const moduleId = params.id;

  try {
    const trainingModule = await prisma.trainingModule.findUnique({
      where: { id: moduleId },
      select: { id: true, heygenVideoId: true, videoUrl: true } as any,
    });

    if (!trainingModule) {
      return NextResponse.json({ error: "Module not found" }, { status: 404 });
    }

    const mod = trainingModule as any;

    if (!mod.heygenVideoId) {
      return NextResponse.json({ status: "no_video" });
    }

    if (!isHeyGenEnabled()) {
      return NextResponse.json(
        { error: "HEYGEN_API_KEY not configured" },
        { status: 400 }
      );
    }

    const result = await checkVideoStatus(mod.heygenVideoId);

    if (result.status === "completed" && result.videoUrl) {
      // Store the final URL and clear the pending videoId
      await prisma.trainingModule.update({
        where: { id: moduleId },
        data: {
          videoUrl: result.videoUrl,
          heygenVideoId: null,
        } as any,
      });

      return NextResponse.json({
        status: "completed",
        videoUrl: result.videoUrl,
        thumbnailUrl: result.thumbnailUrl,
        duration: result.duration,
      });
    }

    if (result.status === "failed") {
      // Clear the stale videoId so the admin can retry
      await prisma.trainingModule.update({
        where: { id: moduleId },
        data: { heygenVideoId: null } as any,
      });

      return NextResponse.json({
        status: "failed",
        error: result.error || "Video rendering failed",
      });
    }

    return NextResponse.json({
      status: "rendering",
      videoId: mod.heygenVideoId,
    });
  } catch (err) {
    console.error("[heygen-status] Error:", err);
    return NextResponse.json(
      { error: "Failed to check HeyGen status" },
      { status: 500 }
    );
  }
}
