import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { bumpKnowledgeVersion } from "@/lib/ai-knowledge-version";
import { extractPdfTextFromUrl } from "@/lib/pdf-extraction";

/**
 * PUT /api/admin/training/resources/[id]
 *
 * Updates an existing training resource by ID.
 * Body contains optional fields to update.
 */
export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const role = (session.user as any).role;
  if (!["super_admin", "admin", "accounting", "partner_support"].includes(role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const id = params.id;
    const body = await req.json();

    // Build update data from provided fields only
    const updateData: Record<string, unknown> = {};
    const allowedFields = [
      "title",
      "description",
      "fileUrl",
      "fileType",
      "fileSize",
      "moduleId",
      "category",
      "sortOrder",
      "published",
    ];

    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        updateData[field] = body[field];
      }
    }

    // If fileUrl changed on a PDF resource, re-extract the text so Tara's
    // knowledge reflects the new file. Runs BEFORE the update so the row
    // can be written in one atomic operation.
    if (
      (updateData.fileUrl || updateData.fileType) &&
      updateData.fileType === "pdf"
    ) {
      const url = (updateData.fileUrl as string) || "";
      if (url) {
        const result = await extractPdfTextFromUrl(url);
        if (result.text) {
          updateData.extractedText = result.text;
          updateData.extractedAt = new Date();
        } else {
          // Empty result — clear any stale text from previous extraction
          updateData.extractedText = null;
          updateData.extractedAt = null;
        }
      }
    }

    const resource = await prisma.trainingResource.update({
      where: { id },
      data: updateData,
    });

    await bumpKnowledgeVersion().catch((e) =>
      console.error("[ai-knowledge] bumpKnowledgeVersion failed", e)
    );

    return NextResponse.json({ resource });
  } catch {
    return NextResponse.json(
      { error: "Failed to update training resource" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/admin/training/resources/[id]
 *
 * Deletes a training resource by ID.
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const role = (session.user as any).role;
  if (!["super_admin", "admin", "accounting", "partner_support"].includes(role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const id = params.id;

    await prisma.trainingResource.delete({
      where: { id },
    });

    await bumpKnowledgeVersion().catch((e) =>
      console.error("[ai-knowledge] bumpKnowledgeVersion failed", e)
    );

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json(
      { error: "Failed to delete training resource" },
      { status: 500 }
    );
  }
}
