import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/**
 * POST /api/partner/templates/share
 * Shares a template to the marketplace. Creates a SharedTemplate entry
 * with status "pending" for admin review before it goes live.
 */
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const partnerCode = (session.user as any).partnerCode;
  if (!partnerCode) return NextResponse.json({ error: "Not a partner" }, { status: 403 });

  try {
    const body = await req.json();
    const { templateId, templateType } = body;

    if (!templateId || !templateType) {
      return NextResponse.json({ error: "templateId and templateType are required" }, { status: 400 });
    }

    if (!["email", "sms"].includes(templateType)) {
      return NextResponse.json({ error: "templateType must be email or sms" }, { status: 400 });
    }

    // Check if already shared by this partner
    const existing = await prisma.sharedTemplate.findFirst({
      where: { sourceTemplateId: templateId, sharedByCode: partnerCode },
    });
    if (existing) {
      return NextResponse.json({
        error: "You have already shared this template",
        sharedStatus: existing.status,
      }, { status: 409 });
    }

    // Fetch the source template to build the preview
    let name: string;
    let bodyPreview: string;
    let category: string;
    let variableKeys: string[];
    let workflowTags: string[];
    let description: string | null = null;
    let styleId: string | null = null;

    if (templateType === "email") {
      const template = await prisma.emailTemplate.findUnique({ where: { id: templateId } });
      if (!template) return NextResponse.json({ error: "Template not found" }, { status: 404 });
      name = template.name;
      bodyPreview = template.bodyText || template.bodyHtml.replace(/<[^>]*>/g, "").slice(0, 500);
      category = template.category;
      variableKeys = template.variableKeys;
      workflowTags = template.workflowTags;
      description = template.description;
      styleId = template.styleId;
    } else {
      const template = await prisma.smsTemplate.findUnique({ where: { id: templateId } });
      if (!template) return NextResponse.json({ error: "Template not found" }, { status: 404 });
      name = template.name;
      bodyPreview = template.body;
      category = template.category;
      variableKeys = template.variableKeys;
      workflowTags = template.workflowTags;
      description = template.description;
      styleId = template.styleId;
    }

    const partnerName = session.user.name || partnerCode;

    const shared = await prisma.sharedTemplate.create({
      data: {
        name,
        description,
        templateType,
        sourceTemplateId: templateId,
        sharedByCode: partnerCode,
        sharedByName: partnerName,
        bodyPreview,
        category: category || "General",
        styleId,
        variableKeys,
        workflowTags,
        status: "pending",
      },
    });

    return NextResponse.json(shared, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Failed to share template" }, { status: 500 });
  }
}
