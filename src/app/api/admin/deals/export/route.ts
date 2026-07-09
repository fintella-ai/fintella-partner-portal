import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { csvField } from "@/lib/csv";
import {
  DEAL_COLUMNS_BY_KEY,
  DEFAULT_VISIBLE_DEAL_COLUMNS,
  csvValue,
  type DealColumnKey,
  type DealColumnCtx,
  type DealLike,
} from "@/lib/dealColumns";
import { deriveDealWorkflowFields } from "@/lib/workflow-engine";

/**
 * GET /api/admin/deals/export
 * Exports filtered deals as a downloadable CSV file.
 * Super admin only.
 */
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const role = (session.user as any).role;
  if (role !== "super_admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  try {
    const where: any = {};

    const stage = req.nextUrl.searchParams.get("stage");
    if (stage && stage !== "all") where.stage = stage;

    const partner = req.nextUrl.searchParams.get("partner");
    if (partner) where.partnerCode = partner;

    const search = req.nextUrl.searchParams.get("search");
    if (search) {
      where.OR = [
        { id: { contains: search } },
        { dealName: { contains: search } },
        { clientName: { contains: search } },
        { clientEmail: { contains: search } },
        { partnerCode: { contains: search.toUpperCase() } },
      ];
    }

    const deals = await prisma.deal.findMany({
      where,
      orderBy: { createdAt: "desc" },
    });

    // Build partner lookup for name resolution
    const partners = await prisma.partner.findMany({
      select: {
        partnerCode: true,
        firstName: true,
        lastName: true,
        commissionRate: true,
      },
    });
    const partnerMap: Record<string, { name: string; commissionRate: number }> = {};
    for (const p of partners) {
      partnerMap[p.partnerCode] = {
        name: `${p.firstName} ${p.lastName}`,
        commissionRate: p.commissionRate,
      };
    }

    // Resolve the requested columns from the registry. Unknown/stale keys are
    // silently dropped; an absent or empty-after-validation param falls back to
    // the registry defaults (preserves back-compat with bookmarked links that
    // pass no `columns` param).
    const columnsParam = req.nextUrl.searchParams.get("columns");
    const requestedColumns: DealColumnKey[] = columnsParam
      ? (columnsParam
          .split(",")
          .map((k) => k.trim())
          .filter((k): k is DealColumnKey => k in DEAL_COLUMNS_BY_KEY))
      : [];
    const columns: DealColumnKey[] =
      requestedColumns.length > 0 ? requestedColumns : DEFAULT_VISIBLE_DEAL_COLUMNS;

    // CSV header from the registry labels
    const headerRow = columns.map((key) => csvField(DEAL_COLUMNS_BY_KEY[key].label)).join(",");

    const rows = deals.map((d) => {
      // Prisma types `serviceFields` as the wider `JsonValue`; the registry's
      // `DealLike` expects an object-or-null. Coerce non-object JSON to null so
      // the shapes line up without an unsafe blanket cast.
      const deal: DealLike = {
        ...d,
        serviceFields:
          d.serviceFields && typeof d.serviceFields === "object" && !Array.isArray(d.serviceFields)
            ? (d.serviceFields as Record<string, unknown>)
            : null,
      };
      const ctx: DealColumnCtx = {
        partnerName: partnerMap[d.partnerCode]?.name || d.partnerCode,
        effectiveCommissionRate:
          d.l1CommissionRate ?? partnerMap[d.partnerCode]?.commissionRate ?? null,
        workflowFields: deriveDealWorkflowFields(d as Record<string, unknown>),
      };
      return columns.map((key) => csvField(csvValue(key, deal, ctx))).join(",");
    });

    const csv = [headerRow, ...rows].join("\r\n");
    const today = new Date().toISOString().split("T")[0];

    return new NextResponse(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="deals-export-${today}.csv"`,
      },
    });
  } catch {
    return NextResponse.json({ error: "Failed to export deals" }, { status: 500 });
  }
}
