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
    const { partnerCode, content } = body;
    const attachments: any[] = Array.isArray(body.attachments) ? body.attachments : [];

    // Back-compat: older clients send a single `attachment*` set. Fold it
    // into the attachments array so the write path is always the same.
    if (!attachments.length && typeof body.attachmentUrl === "string" && body.attachmentUrl.length > 0) {
      attachments.push({
        name: body.attachmentName,
        url: body.attachmentUrl,
        type: body.attachmentType,
        size: body.attachmentSize,
      });
    }

    // Allow empty content when at least one attachment is provided —
    // "here's the doc" is a legitimate note on its own.
    const trimmedContent = typeof content === "string" ? content.trim() : "";
    if (!partnerCode || (!trimmedContent && attachments.length === 0)) {
      return NextResponse.json({ error: "Partner code and either note content or an attachment are required" }, { status: 400 });
    }

    // Per-attachment cap ~4MB raw (5.5MB base64). Total cap keeps the
    // whole POST under ~15MB so the route doesn't OOM on huge batches.
    let total = 0;
    for (const a of attachments) {
      if (typeof a?.url !== "string" || !a.url) {
        return NextResponse.json({ error: "Each attachment requires a data url" }, { status: 400 });
      }
      if (a.url.length > 5_500_000) {
        return NextResponse.json({ error: `Attachment ${a.name || ""} too large (max ~4MB each)` }, { status: 413 });
      }
      total += a.url.length;
    }
    if (total > 15_000_000) {
      return NextResponse.json({ error: "Combined attachment size too large (max ~11MB)" }, { status: 413 });
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
        ...(attachments.length > 0 ? {
          attachments: {
            create: attachments.map((a: any) => ({
              name: typeof a.name === "string" ? a.name.slice(0, 255) : "attachment",
              url: a.url,
              type: typeof a.type === "string" ? a.type.slice(0, 128) : null,
              size: typeof a.size === "number" && isFinite(a.size) ? Math.round(a.size) : null,
            })),
          },
        } : {}),
      },
      include: { attachments: true },
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
