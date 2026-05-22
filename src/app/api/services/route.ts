import { NextResponse } from "next/server";
import { getActiveServices } from "@/lib/services";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const services = await getActiveServices();
    return NextResponse.json({ services });
  } catch (err: any) {
    console.error("[api/services] error:", err.message);
    return NextResponse.json({ error: "Failed to load services" }, { status: 500 });
  }
}
