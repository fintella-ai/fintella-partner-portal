import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getCommsGraphData, buildCommsGraph } from "@/lib/comms-graph";

export const dynamic = "force-dynamic";

/**
 * GET /api/admin/comms-graph
 *
 * Returns computed comms graph summaries + top edges for the admin dashboard.
 * Any admin role can read.
 */
export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const role = (session.user as Record<string, unknown>).role as string;
  if (
    !["super_admin", "admin", "accounting", "partner_support"].includes(role)
  ) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const data = await getCommsGraphData();
    return NextResponse.json(data);
  } catch {
    // Tables might not exist yet (pre-migration)
    return NextResponse.json({
      summaries: [],
      topEdges: [],
    });
  }
}

/**
 * POST /api/admin/comms-graph
 *
 * Triggers a full comms graph rebuild. Super_admin only — this runs
 * correlation queries across EmailLog, Deal, Partner, and WidgetReferral.
 */
export async function POST() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const role = (session.user as Record<string, unknown>).role as string;
  if (role !== "super_admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const result = await buildCommsGraph();
    return NextResponse.json({
      ok: true,
      ...result,
      computedAt: new Date().toISOString(),
    });
  } catch (e) {
    console.error("[comms-graph POST] error:", e);
    return NextResponse.json(
      { error: "Comms graph build failed", detail: String(e) },
      { status: 500 }
    );
  }
}
