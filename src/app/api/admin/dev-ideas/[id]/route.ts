import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if ((session.user as any).role !== "super_admin")
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json();
  const data: Record<string, any> = {};
  if (typeof body.title === "string") data.title = body.title.trim();
  if (typeof body.description === "string") data.description = body.description.trim();
  if (typeof body.category === "string") data.category = body.category;
  if (typeof body.priority === "string") data.priority = body.priority;
  if (typeof body.status === "string") data.status = body.status;
  if (typeof body.adminNotes === "string") data.adminNotes = body.adminNotes.trim() || null;
  if (typeof body.aiPlan === "string") data.aiPlan = body.aiPlan;
  if (typeof body.aiQuestions === "string") data.aiQuestions = body.aiQuestions;

  const idea = await prisma.devIdea.update({ where: { id: params.id }, data });
  return NextResponse.json({ idea });
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if ((session.user as any).role !== "super_admin")
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  await prisma.devIdea.delete({ where: { id: params.id } });
  return NextResponse.json({ success: true });
}
