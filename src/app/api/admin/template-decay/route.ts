import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { detectTemplateDecay } from "@/lib/template-decay";

export const dynamic = "force-dynamic";

/**
 * GET /api/admin/template-decay
 *
 * Returns all TemplatePerformanceBaseline records for the admin dashboard.
 * Open to super_admin + admin roles.
 */
export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const role = (session.user as any).role;
  if (!["super_admin", "admin"].includes(role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const baselines = await prisma.templatePerformanceBaseline.findMany({
      orderBy: [{ isDecaying: "desc" }, { lastComputedAt: "desc" }],
    });

    return NextResponse.json({ baselines });
  } catch (e) {
    console.error("[template-decay GET] error:", e);
    return NextResponse.json(
      { error: "Failed to fetch template decay data" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/admin/template-decay
 *
 * Triggers decay detection computation. Super_admin only — this runs
 * aggregation queries across EmailLog + EmailEvent tables.
 */
export async function POST() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const role = (session.user as any).role;
  if (role !== "super_admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const result = await detectTemplateDecay();
    return NextResponse.json(result);
  } catch (e) {
    console.error("[template-decay POST] error:", e);
    return NextResponse.json(
      { error: "Failed to run decay detection" },
      { status: 500 }
    );
  }
}
