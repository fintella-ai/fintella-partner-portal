import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCorsHeaders } from "@/lib/widget-auth";

export async function OPTIONS(req: NextRequest) {
  return new NextResponse(null, {
    status: 204,
    headers: getCorsHeaders(req.headers.get("origin"), null),
  });
}

/**
 * GET /api/widget/variant?name=control
 *
 * Public endpoint (no auth needed -- widget pages are public).
 * Returns the variant config JSON for the given name.
 * Falls back to a sensible default if not found or inactive.
 */
export async function GET(req: NextRequest) {
  const origin = req.headers.get("origin");
  const cors = getCorsHeaders(origin, null);
  const name = req.nextUrl.searchParams.get("name");

  if (!name) {
    return NextResponse.json(
      { config: { defaultTab: "dashboard" }, name: "default" },
      { headers: cors },
    );
  }

  try {
    const variant = await prisma.widgetVariant.findUnique({
      where: { name },
      select: { id: true, name: true, config: true, isActive: true },
    });

    if (!variant || !variant.isActive) {
      return NextResponse.json(
        { config: { defaultTab: "dashboard" }, name: "default" },
        { headers: cors },
      );
    }

    return NextResponse.json(
      { id: variant.id, name: variant.name, config: variant.config },
      { headers: cors },
    );
  } catch {
    return NextResponse.json(
      { config: { defaultTab: "dashboard" }, name: "default" },
      { headers: cors },
    );
  }
}
