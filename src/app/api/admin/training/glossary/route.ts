import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { bumpKnowledgeVersion } from "@/lib/ai-knowledge-version";

/**
 * GET /api/admin/training/glossary
 * Returns ALL glossary entries (including unpublished) for admin management.
 */
export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const entries = await prisma.trainingGlossary.findMany({
      orderBy: [{ sortOrder: "asc" }, { term: "asc" }],
    });
    return NextResponse.json({ entries });
  } catch {
    return NextResponse.json(
      { error: "Failed to fetch glossary entries" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/admin/training/glossary
 * Creates a new glossary entry.
 */
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const role = (session.user as any).role;
  if (!["super_admin", "admin", "accounting", "partner_support"].includes(role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  try {
    const body = await req.json();
    const {
      term,
      aliases = [],
      definition,
      category = null,
      sortOrder = 0,
      published = true,
    } = body as {
      term?: string;
      aliases?: string[];
      definition?: string;
      category?: string | null;
      sortOrder?: number;
      published?: boolean;
    };

    if (!term || !definition) {
      return NextResponse.json(
        { error: "Term and definition are required" },
        { status: 400 }
      );
    }

    const entry = await prisma.trainingGlossary.create({
      data: {
        term: term.trim(),
        aliases: Array.isArray(aliases)
          ? aliases.filter((a) => typeof a === "string" && a.trim())
          : [],
        definition,
        category: category || null,
        sortOrder,
        published,
      },
    });

    await bumpKnowledgeVersion().catch((e) =>
      console.error("[ai-knowledge] bumpKnowledgeVersion failed", e)
    );

    return NextResponse.json({ entry }, { status: 201 });
  } catch (err: any) {
    if (err?.code === "P2002") {
      return NextResponse.json(
        { error: "A glossary entry with that term already exists" },
        { status: 409 }
      );
    }
    return NextResponse.json(
      { error: "Failed to create glossary entry" },
      { status: 500 }
    );
  }
}
