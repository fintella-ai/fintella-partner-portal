import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/**
 * POST /api/admin/notes
 * Add an immutable admin note to a partner's record.
 * Notes cannot be edited or deleted (audit trail).
 */
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const role = (session.user as any).role;
  if (!["super_admin", "admin", "accounting", "partner_support"].includes(role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const body = await req.json();
    const { partnerCode, content, attachmentName, attachmentUrl, attachmentType, attachmentSize } = body;

    // Allow empty content when an attachment is provided — "here's the doc"
    // is a legitimate note on its own. Either a text note OR an attachment
    // is required.
    const hasAttachment = typeof attachmentUrl === "string" && attachmentUrl.length > 0;
    const trimmedContent = typeof content === "string" ? content.trim() : "";
    if (!partnerCode || (!trimmedContent && !hasAttachment)) {
      return NextResponse.json({ error: "Partner code and either note content or an attachment are required" }, { status: 400 });
    }

    // Cap attachment size at ~5MB base64 (~3.7MB raw). The DB text column
    // can hold more but we don't want to balloon notes payloads.
    if (hasAttachment && attachmentUrl.length > 5_500_000) {
      return NextResponse.json({ error: "Attachment too large (max ~4MB)" }, { status: 413 });
    }

    // Get admin name from account
    let authorName = session.user.name || "Admin";
    let authorEmail = session.user.email || "";

    try {
      const adminUser = await prisma.user.findUnique({
        where: { email: session.user.email || "" },
        select: { name: true, email: true },
      });
      if (adminUser?.name) authorName = adminUser.name;
      if (adminUser?.email) authorEmail = adminUser.email;
    } catch {}

    const note = await prisma.adminNote.create({
      data: {
        partnerCode,
        content: trimmedContent,
        authorName,
        authorEmail,
        ...(hasAttachment ? {
          attachmentName: typeof attachmentName === "string" ? attachmentName.slice(0, 255) : null,
          attachmentUrl,
          attachmentType: typeof attachmentType === "string" ? attachmentType.slice(0, 128) : null,
          attachmentSize: typeof attachmentSize === "number" && isFinite(attachmentSize) ? Math.round(attachmentSize) : null,
        } : {}),
      },
    });

    return NextResponse.json({ note }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Failed to add note" }, { status: 500 });
  }
}

/**
 * PATCH /api/admin/notes
 * Toggle pin status on a note. Only admins can pin/unpin.
 */
export async function PATCH(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const role = (session.user as any).role;
  if (!["super_admin", "admin", "accounting", "partner_support"].includes(role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const body = await req.json();
    const { noteId, isPinned } = body;

    if (!noteId) return NextResponse.json({ error: "noteId is required" }, { status: 400 });

    const note = await prisma.adminNote.update({
      where: { id: noteId },
      data: { isPinned: !!isPinned },
    });

    return NextResponse.json({ note });
  } catch {
    return NextResponse.json({ error: "Failed to update note" }, { status: 500 });
  }
}
