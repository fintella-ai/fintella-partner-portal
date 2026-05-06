import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { readdir, readFile } from "fs/promises";
import { join } from "path";

export async function GET() {
  const session = await auth();
  const role = (session?.user as any)?.role;
  if (!["super_admin", "admin"].includes(role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const dir = join(process.cwd(), "docs/competitive-intel");
  try {
    const files = await readdir(dir);
    const reports = await Promise.all(
      files
        .filter((f) => f.endsWith(".md"))
        .sort()
        .reverse()
        .map(async (f) => ({
          filename: f,
          date: f.replace(".md", ""),
          content: await readFile(join(dir, f), "utf-8"),
        }))
    );
    return NextResponse.json({ reports });
  } catch {
    return NextResponse.json({ reports: [] });
  }
}
