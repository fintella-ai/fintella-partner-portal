import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const ALLOWED_ROLES = ["super_admin", "admin", "partner_support", "accounting"];

/**
 * GET /api/admin/email-templates/by-key/[key]
 *
 * Single-template lookup used by the Compose form's template picker to
 * prefill subject + body when an admin selects a saved template. Returns
 * only the fields the compose UI needs (no CTA/variables metadata), and
 * only for enabled + non-draft rows — disabled/draft templates aren't
 * eligible for manual send.
 */
export async function GET(_req: NextRequest, { params }: { params: { key: string } }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const role = (session.user as any).role;
  if (!ALLOWED_ROLES.includes(role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const key = (params.key || "").trim();
  if (!key) return NextResponse.json({ error: "key is required" }, { status: 400 });

  const tpl = await prisma.emailTemplate.findUnique({
    where: { key },
    select: {
      key: true,
      name: true,
      subject: true,
      bodyText: true,
      bodyHtml: true,
      enabled: true,
      isDraft: true,
      fromEmail: true,
    },
  });

  if (!tpl) return NextResponse.json({ error: "Template not found" }, { status: 404 });
  if (!tpl.enabled || tpl.isDraft) {
    return NextResponse.json({ error: "Template is disabled or draft" }, { status: 400 });
  }

  return NextResponse.json({ template: tpl });
}
