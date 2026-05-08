import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { tavilySearch } from "@/lib/ai-research";
import { writeFile, mkdir } from "fs/promises";
import { join } from "path";

const DEFAULT_QUERIES = [
  "IEEPA tariff refund service competitors 2026",
  "customs broker tariff recovery company review",
  "CAPE filing service provider comparison",
  "tariff duty refund consulting firms US importers",
  "automated tariff refund calculator tools",
];

export async function POST(req: Request) {
  const session = await auth();
  const role = (session?.user as any)?.role;
  if (!["super_admin", "admin"].includes(role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const queries = (body.queries && Array.isArray(body.queries) && body.queries.length > 0)
      ? body.queries as string[]
      : DEFAULT_QUERIES;

    const allResults: { title: string; url: string; content: string; query: string }[] = [];

    for (const query of queries) {
      const results = await tavilySearch(query, 5);
      for (const r of results) {
        if (!allResults.some((e) => e.url === r.url)) {
          allResults.push({ title: r.title || "", url: r.url || "", content: r.content || "", query });
        }
      }
    }

    const now = new Date();
    const dateStr = now.toISOString().split("T")[0];

    const sections = queries.map((q) => {
      const hits = allResults.filter((r) => r.query === q);
      return `## ${q}\n\n${hits.length === 0 ? "_No results found._\n" : hits.map((r) =>
        `- **[${r.title}](${r.url})**\n  ${r.content.slice(0, 300)}${r.content.length > 300 ? "..." : ""}\n`
      ).join("\n")}`;
    });

    const markdown = `# Competitive Intelligence Scan — ${dateStr}\n\nGenerated: ${now.toLocaleString()}\nQueries: ${queries.length} | Results: ${allResults.length}\n\n---\n\n${sections.join("\n---\n\n")}`;

    const dir = join(process.cwd(), "docs/competitive-intel");
    await mkdir(dir, { recursive: true });
    await writeFile(join(dir, `${dateStr}.md`), markdown, "utf-8");

    return NextResponse.json({
      success: true,
      date: dateStr,
      queriesRun: queries.length,
      resultsFound: allResults.length,
    });
  } catch (err) {
    console.error("[competitive-intel/scan] error:", err);
    return NextResponse.json({ error: "Scan failed" }, { status: 500 });
  }
}
