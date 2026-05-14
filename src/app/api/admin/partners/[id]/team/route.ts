import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { hash } from "bcryptjs";

async function requireSuperAdmin() {
  const session = await auth();
  const role = (session?.user as any)?.role;
  if (role !== "super_admin") return null;
  return session;
}

// GET — list team members for a partner
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  if (!(await requireSuperAdmin()))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const partner = await prisma.partner.findUnique({ where: { id: params.id } });
  if (!partner) return NextResponse.json({ error: "Partner not found" }, { status: 404 });
  if (partner.partnerType !== "corporate")
    return NextResponse.json({ error: "Team members are only available for corporate partners" }, { status: 400 });

  const members = await prisma.partnerUser.findMany({
    where: { partnerCode: partner.partnerCode },
    select: { id: true, email: true, firstName: true, lastName: true, active: true, createdAt: true },
    orderBy: { createdAt: "asc" },
  });

  return NextResponse.json({ members });
}

// POST — add a team member
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  if (!(await requireSuperAdmin()))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const partner = await prisma.partner.findUnique({ where: { id: params.id } });
  if (!partner) return NextResponse.json({ error: "Partner not found" }, { status: 404 });
  if (partner.partnerType !== "corporate")
    return NextResponse.json({ error: "Team members are only available for corporate partners" }, { status: 400 });

  const body = await req.json();
  const { firstName, lastName, email, password } = body;

  if (!firstName?.trim() || !lastName?.trim() || !email?.trim() || !password?.trim())
    return NextResponse.json({ error: "All fields are required" }, { status: 400 });

  if (password.trim().length < 6)
    return NextResponse.json({ error: "Password must be at least 6 characters" }, { status: 400 });

  // Check email isn't already used by another partner or team member
  const existingPartner = await prisma.partner.findFirst({
    where: { email: { equals: email.trim(), mode: "insensitive" } },
  });
  if (existingPartner)
    return NextResponse.json({ error: "This email is already used by a partner account" }, { status: 409 });

  const existingUser = await prisma.partnerUser.findFirst({
    where: { email: { equals: email.trim(), mode: "insensitive" } },
  });
  if (existingUser)
    return NextResponse.json({ error: "This email is already used by another team member" }, { status: 409 });

  const passwordHash = await hash(password.trim(), 12);

  const member = await prisma.partnerUser.create({
    data: {
      partnerCode: partner.partnerCode,
      email: email.trim().toLowerCase(),
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      passwordHash,
    },
    select: { id: true, email: true, firstName: true, lastName: true, active: true, createdAt: true },
  });

  return NextResponse.json({ member }, { status: 201 });
}

// PATCH — toggle active status
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  if (!(await requireSuperAdmin()))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const partner = await prisma.partner.findUnique({ where: { id: params.id } });
  if (!partner) return NextResponse.json({ error: "Partner not found" }, { status: 404 });

  const { memberId, active } = await req.json();
  if (!memberId || typeof active !== "boolean")
    return NextResponse.json({ error: "memberId and active are required" }, { status: 400 });

  const member = await prisma.partnerUser.findUnique({ where: { id: memberId } });
  if (!member || member.partnerCode !== partner.partnerCode)
    return NextResponse.json({ error: "Team member not found" }, { status: 404 });

  await prisma.partnerUser.update({ where: { id: memberId }, data: { active } });

  return NextResponse.json({ ok: true });
}

// DELETE — remove a team member
export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  if (!(await requireSuperAdmin()))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const partner = await prisma.partner.findUnique({ where: { id: params.id } });
  if (!partner) return NextResponse.json({ error: "Partner not found" }, { status: 404 });

  const { memberId } = await req.json();
  if (!memberId) return NextResponse.json({ error: "memberId is required" }, { status: 400 });

  const member = await prisma.partnerUser.findUnique({ where: { id: memberId } });
  if (!member || member.partnerCode !== partner.partnerCode)
    return NextResponse.json({ error: "Team member not found" }, { status: 404 });

  await prisma.partnerUser.delete({ where: { id: memberId } });

  return NextResponse.json({ ok: true });
}
