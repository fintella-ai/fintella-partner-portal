import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/training/glossary
 * Partner-facing read — returns PUBLISHED glossary entries only.
 * Used by the Glossary tab on /dashboard/training.
 */
export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const entries = await prisma.trainingGlossary.findMany({
      where: { published: true },
      orderBy: [{ category: "asc" }, { sortOrder: "asc" }, { term: "asc" }],
      select: {
        id: true,
        term: true,
        aliases: true,
        definition: true,
        category: true,
      },
    });
    return NextResponse.json({ entries });
  } catch {
    return NextResponse.json(
      { error: "Failed to fetch glossary entries" },
      { status: 500 }
    );
  }
}
