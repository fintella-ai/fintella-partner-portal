import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * POST /api/auth/check-status
 *
 * Lightweight endpoint used by the login page after a failed credentials
 * sign-in to determine whether the account is archived (vs wrong password
 * or non-existent). Only reveals the "archived" status — never leaks
 * whether an email exists for other statuses.
 */
export async function POST(req: NextRequest) {
  try {
    const { email } = await req.json();
    if (!email || typeof email !== "string") {
      return NextResponse.json({ status: "unknown" });
    }

    const partner = await prisma.partner.findFirst({
      where: { email: { equals: email.trim(), mode: "insensitive" } },
      select: { status: true },
    });

    if (partner?.status === "archived") {
      return NextResponse.json({ status: "archived" });
    }

    // Don't reveal whether the email exists for non-archived statuses
    return NextResponse.json({ status: "unknown" });
  } catch {
    return NextResponse.json({ status: "unknown" });
  }
}
