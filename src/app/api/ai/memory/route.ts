import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const partnerCode = (session.user as any).partnerCode as string | undefined;
  const userId = partnerCode || session.user.email || "";
  const userType = partnerCode ? "partner" : "admin";

  const memories = await prisma.aiMemory.findMany({
    where: {
      userId,
      userType,
      OR: [
        { expiresAt: null },
        { expiresAt: { gt: new Date() } },
      ],
    },
    orderBy: { updatedAt: "desc" },
    take: 50,
  });

  return NextResponse.json({ memories });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const partnerCode = (session.user as any).partnerCode as string | undefined;
  const userId = partnerCode || session.user.email || "";
  const userType = partnerCode ? "partner" : "admin";

  const { content, type = "instruction", expiresAt } = await req.json();
  if (!content?.trim()) {
    return NextResponse.json({ error: "Content required" }, { status: 400 });
  }

  const memory = await prisma.aiMemory.create({
    data: {
      userId,
      userType,
      type,
      content: content.trim(),
      source: "user",
      confidence: 1.0,
      expiresAt: expiresAt ? new Date(expiresAt) : null,
    },
  });

  return NextResponse.json({ memory });
}

export async function DELETE(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const partnerCode = (session.user as any).partnerCode as string | undefined;
  const userId = partnerCode || session.user.email || "";

  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Memory ID required" }, { status: 400 });

  await prisma.aiMemory.deleteMany({
    where: { id, userId },
  });

  return NextResponse.json({ deleted: true });
}
