import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit-log";

/**
 * POST /api/admin/partners/[id]/archive
 * Archive a partner — soft-delete that preserves data but blocks login
 * and hides them from active partner lists.
 *
 * Body (optional): { reason?: string }
 *
 * PATCH /api/admin/partners/[id]/archive
 * Restore an archived partner — sets status back to "pending" so they
 * must re-sign their agreement before going active again.
 */

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await auth();
  if (!session?.user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const role = (session.user as any).role;
  if (!["super_admin", "admin"].includes(role))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  try {
    const partner = await prisma.partner.findUnique({
      where: { id: params.id },
    });
    if (!partner)
      return NextResponse.json({ error: "Partner not found" }, { status: 404 });

    if (partner.status === "archived")
      return NextResponse.json(
        { error: "Partner is already archived" },
        { status: 400 }
      );

    // Parse optional reason from request body
    let reason: string | null = null;
    try {
      const body = await req.json();
      if (body?.reason && typeof body.reason === "string") {
        reason = body.reason.trim().slice(0, 500);
      }
    } catch {
      // No body or invalid JSON — that's fine, reason is optional
    }

    // Build the archive metadata to store in the notes field.
    // Preserve existing notes and append the archive record.
    const archiveRecord = `\n\n--- ARCHIVED ${new Date().toISOString()} ---\nBy: ${session.user.email || "admin"}\nReason: ${reason || "No reason provided"}`;
    const updatedNotes = (partner.notes || "") + archiveRecord;

    const updated = await prisma.partner.update({
      where: { id: params.id },
      data: {
        status: "archived",
        notes: updatedNotes,
      },
    });

    // Audit log
    logAudit({
      action: "partner.archived",
      actorEmail: session.user.email || "unknown",
      actorRole: role,
      actorId: session.user.id,
      targetType: "partner",
      targetId: partner.id,
      details: {
        partnerCode: partner.partnerCode,
        previousStatus: partner.status,
        reason: reason || null,
        archivedAt: new Date().toISOString(),
      },
      ipAddress: req.headers.get("x-forwarded-for") || undefined,
      userAgent: req.headers.get("user-agent") || undefined,
    }).catch(() => {});

    // Fire workflow trigger — fire-and-forget. The trigger key may not
    // exist yet in any workflow, so wrap in catch.
    import("@/lib/workflow-engine")
      .then(({ fireWorkflowTrigger }) =>
        fireWorkflowTrigger("partner.archived", {
          partner: updated,
          reason,
          archivedBy: session.user?.email || "admin",
        })
      )
      .catch(() => {});

    return NextResponse.json({ ok: true, status: "archived" });
  } catch (err: any) {
    console.error("[partner.archive POST]", err);
    return NextResponse.json(
      { error: err?.message || "Failed to archive partner" },
      { status: 500 }
    );
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await auth();
  if (!session?.user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const role = (session.user as any).role;
  if (!["super_admin", "admin"].includes(role))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  try {
    const partner = await prisma.partner.findUnique({
      where: { id: params.id },
    });
    if (!partner)
      return NextResponse.json({ error: "Partner not found" }, { status: 404 });

    if (partner.status !== "archived")
      return NextResponse.json(
        { error: "Partner is not archived — cannot restore" },
        { status: 400 }
      );

    // Restore to "pending" — they need to re-sign their agreement
    // before becoming active again.
    const restoreRecord = `\n\n--- RESTORED ${new Date().toISOString()} ---\nBy: ${session.user.email || "admin"}`;
    const updatedNotes = (partner.notes || "") + restoreRecord;

    await prisma.partner.update({
      where: { id: params.id },
      data: {
        status: "pending",
        notes: updatedNotes,
      },
    });

    // Audit log
    logAudit({
      action: "partner.restored",
      actorEmail: session.user.email || "unknown",
      actorRole: role,
      actorId: session.user.id,
      targetType: "partner",
      targetId: partner.id,
      details: {
        partnerCode: partner.partnerCode,
        restoredAt: new Date().toISOString(),
      },
      ipAddress: req.headers.get("x-forwarded-for") || undefined,
      userAgent: req.headers.get("user-agent") || undefined,
    }).catch(() => {});

    return NextResponse.json({ ok: true, status: "pending" });
  } catch (err: any) {
    console.error("[partner.archive PATCH]", err);
    return NextResponse.json(
      { error: err?.message || "Failed to restore partner" },
      { status: 500 }
    );
  }
}
