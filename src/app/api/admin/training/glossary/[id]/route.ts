import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { bumpKnowledgeVersion } from "@/lib/ai-knowledge-version";

/**
 * PUT /api/admin/training/glossary/[id]
 * Updates a glossary entry.
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

    const updateData: Record<string, unknown> = {};
    const scalarFields = ["term", "definition", "category", "sortOrder", "published"];
    for (const field of scalarFields) {
      if (body[field] !== undefined) updateData[field] = body[field];
    }
    if (Array.isArray(body.aliases)) {
      updateData.aliases = (body.aliases as unknown[]).filter(
        (a): a is string => typeof a === "string" && !!a.trim()
      );
    }

    const entry = await prisma.trainingGlossary.update({
      where: { id },
      data: updateData,
    });

    await bumpKnowledgeVersion().catch((e) =>
      console.error("[ai-knowledge] bumpKnowledgeVersion failed", e)
    );

    return NextResponse.json({ entry });
  } catch (err: any) {
    if (err?.code === "P2002") {
      return NextResponse.json(
        { error: "A glossary entry with that term already exists" },
        { status: 409 }
      );
    }
    return NextResponse.json(
      { error: "Failed to update glossary entry" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/admin/training/glossary/[id]
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
    await prisma.trainingGlossary.delete({ where: { id } });

    await bumpKnowledgeVersion().catch((e) =>
      console.error("[ai-knowledge] bumpKnowledgeVersion failed", e)
    );

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json(
      { error: "Failed to delete glossary entry" },
      { status: 500 }
    );
  }
}
