import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if ((session.user as any).role !== "super_admin")
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const ideas = await prisma.devIdea.findMany({ orderBy: { createdAt: "desc" } });
  return NextResponse.json({ ideas });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if ((session.user as any).role !== "super_admin")
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json();
  if (!body.title?.trim() || !body.description?.trim())
    return NextResponse.json({ error: "Title and description required" }, { status: 400 });

  const validCats = ["feature", "optimization", "integration", "bugfix", "research"];
  const validPri = ["low", "medium", "high", "critical"];

  const idea = await prisma.devIdea.create({
    data: {
      title: body.title.trim(),
      description: body.description.trim(),
      category: validCats.includes(body.category) ? body.category : "feature",
      priority: validPri.includes(body.priority) ? body.priority : "medium",
      adminNotes: body.adminNotes?.trim() || null,
    },
  });

  return NextResponse.json({ idea }, { status: 201 });
}
