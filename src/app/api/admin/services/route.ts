import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await auth();
  if (!(session?.user as any)?.role?.includes("admin")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const services = await prisma.service.findMany({ orderBy: { name: "asc" } });
  return NextResponse.json({ services });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if ((session?.user as any)?.role !== "super_admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const body = await req.json();
  const service = await prisma.service.create({ data: body });
  return NextResponse.json({ service }, { status: 201 });
}

export async function PATCH(req: NextRequest) {
  const session = await auth();
  if (!(session?.user as any)?.role?.includes("admin")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const body = await req.json();
  const { id, ...data } = body;
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
  const service = await prisma.service.update({ where: { id }, data });
  return NextResponse.json({ service });
}
