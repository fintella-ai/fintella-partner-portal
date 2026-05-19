import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { generateVideoScript } from "@/lib/ai-video";
import {
  createAvatarVideo,
  scriptToNarration,
  isHeyGenEnabled,
} from "@/lib/heygen";

/**
 * POST /api/admin/training/modules/[id]/generate-heygen
 *
 * Fire-and-forget HeyGen avatar video generation.
 * Flow: generate script from module content → POST to HeyGen → store heygenVideoId → return 202
 * The client polls /heygen-status to check when rendering completes.
 *
 * Body (optional): { avatarId?: string, voiceId?: string }
 */
export async function POST(
  req: NextRequest,
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

  if (!isHeyGenEnabled()) {
    return NextResponse.json(
      { error: "HEYGEN_API_KEY not configured. Add it to your environment variables." },
      { status: 400 }
    );
  }

  const moduleId = params.id;

  try {
    const trainingModule = await prisma.trainingModule.findUnique({
      where: { id: moduleId },
    });

    if (!trainingModule) {
      return NextResponse.json(
        { error: "Training module not found" },
        { status: 404 }
      );
    }

    let body: { avatarId?: string; voiceId?: string } = {};
    try {
      body = await req.json();
    } catch {
      // No body is fine
    }

    // Step 1: Generate or reuse the AI script
    let videoScript: { scenes: { narration: string }[] };

    if (trainingModule.videoScript) {
      videoScript = JSON.parse(trainingModule.videoScript);
    } else {
      const resources = await prisma.trainingResource.findMany({
        where: {
          published: true,
          fileType: "pdf",
          extractedText: { not: null },
        },
        select: { title: true, extractedText: true },
        orderBy: { sortOrder: "asc" },
      });

      const pdfTexts = resources
        .filter((r) => r.extractedText)
        .map((r) => ({ title: r.title, text: r.extractedText! }));

      const script = await generateVideoScript({
        moduleTitle: trainingModule.title,
        moduleCategory: trainingModule.category,
        moduleContent: trainingModule.content,
        pdfTexts,
      });

      await prisma.trainingModule.update({
        where: { id: moduleId },
        data: { videoScript: JSON.stringify(script) },
      });

      videoScript = script;
    }

    // Step 2: Build the narration and submit to HeyGen (fire-and-forget)
    const narration = scriptToNarration(videoScript.scenes);

    const createResult = await createAvatarVideo({
      script: narration,
      title: trainingModule.title,
      avatarId: body.avatarId,
      voiceId: body.voiceId,
    });

    if (!createResult.success || !createResult.videoId) {
      return NextResponse.json(
        { error: createResult.error || "Failed to create HeyGen video" },
        { status: 500 }
      );
    }

    // Step 3: Store the video ID for polling — do NOT wait for render
    await prisma.trainingModule.update({
      where: { id: moduleId },
      data: {
        heygenVideoId: createResult.videoId,
        videoUrl: null, // clear any stale URL while re-rendering
      } as any, // heygenVideoId added in schema; types regenerate on deploy
    });

    return NextResponse.json({
      success: true,
      videoId: createResult.videoId,
      status: "rendering",
      message: "Video submitted to HeyGen. Poll /heygen-status for completion.",
    });
  } catch (err) {
    console.error("[generate-heygen] Error:", err);
    return NextResponse.json(
      { error: "Failed to generate HeyGen video" },
      { status: 500 }
    );
  }
}
