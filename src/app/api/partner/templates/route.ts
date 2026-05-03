import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/partner/templates
 * Returns all active email + SMS templates available to the partner,
 * plus any SharedTemplate entries the partner has already submitted.
 */
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const partnerCode = (session.user as any).partnerCode;
  if (!partnerCode) return NextResponse.json({ error: "Not a partner" }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const tab = searchParams.get("type") || "email";

  try {
    if (tab === "email") {
      const templates = await prisma.emailTemplate.findMany({
        where: { status: { in: ["active", "draft"] } },
        orderBy: { updatedAt: "desc" },
        select: {
          id: true,
          key: true,
          name: true,
          subject: true,
          category: true,
          bodyHtml: true,
          bodyText: true,
          status: true,
          aiGenerated: true,
          variableKeys: true,
          workflowTags: true,
          updatedAt: true,
        },
        take: 100,
      });

      // Check which templates this partner has already shared
      const sharedEntries = await prisma.sharedTemplate.findMany({
        where: { sharedByCode: partnerCode },
        select: { sourceTemplateId: true, status: true },
      });
      const sharedMap = new Map(sharedEntries.map(s => [s.sourceTemplateId, s.status]));

      const enriched = templates.map(t => ({
        ...t,
        sharedStatus: sharedMap.get(t.id) || null,
      }));

      return NextResponse.json({ templates: enriched });
    }

    // SMS templates
    const templates = await prisma.smsTemplate.findMany({
      where: { status: { in: ["active", "draft"] } },
      orderBy: { updatedAt: "desc" },
      select: {
        id: true,
        key: true,
        name: true,
        body: true,
        category: true,
        status: true,
        aiGenerated: true,
        variableKeys: true,
        workflowTags: true,
        characterCount: true,
        segmentCount: true,
        updatedAt: true,
      },
      take: 100,
    });

    const sharedEntries = await prisma.sharedTemplate.findMany({
      where: { sharedByCode: partnerCode },
      select: { sourceTemplateId: true, status: true },
    });
    const sharedMap = new Map(sharedEntries.map(s => [s.sourceTemplateId, s.status]));

    const enriched = templates.map(t => ({
      ...t,
      sharedStatus: sharedMap.get(t.id) || null,
    }));

    return NextResponse.json({ templates: enriched });
  } catch {
    return NextResponse.json({ error: "Failed to fetch templates" }, { status: 500 });
  }
}
