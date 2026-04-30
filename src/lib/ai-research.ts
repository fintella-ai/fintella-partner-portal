/**
 * AI Knowledge Base — Tavily-powered research agent
 *
 * Runs a daily research cycle (via Vercel cron) that searches for
 * IEEPA/CAPE/tariff updates using rotating queries, deduplicates
 * against existing entries, and creates unapproved KnowledgeEntry
 * rows for admin review.
 *
 * Demo-gated: if TAVILY_API_KEY or AI_RESEARCH_ENABLED is not set,
 * all functions return early with zero results.
 */

import { prisma } from "@/lib/prisma";
import { addKnowledgeEntry } from "@/lib/ai-knowledge-crud";

const TAVILY_API_KEY = process.env.TAVILY_API_KEY || "";
const AI_RESEARCH_ENABLED = process.env.AI_RESEARCH_ENABLED === "true";

const ROTATING_QUERIES = [
  "CAPE IEEPA tariff refund CBP update",
  "IEEPA tariff executive order change",
  "ACE portal CAPE system update customs broker",
  "Court of International Trade IEEPA tariff ruling",
  "CBP IEEPA duty refund news",
  "tariff refund importer eligible HTS Chapter 99 update",
];

interface TavilyResult {
  title: string;
  url: string;
  content: string;
  score: number;
}

interface TavilyResponse {
  results: TavilyResult[];
}

async function tavilySearch(query: string): Promise<TavilyResult[]> {
  if (!TAVILY_API_KEY) return [];

  const response = await fetch("https://api.tavily.com/search", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      api_key: TAVILY_API_KEY,
      query,
      search_depth: "advanced",
      max_results: 5,
      include_answer: false,
      include_raw_content: false,
    }),
  });

  if (!response.ok) {
    console.error(`[research] Tavily error: ${response.status} ${response.statusText}`);
    return [];
  }

  const data = (await response.json()) as TavilyResponse;
  return data.results || [];
}

export async function runResearchCycle(): Promise<{
  jobId: string;
  resultsFound: number;
  entriesCreated: number;
  error?: string;
}> {
  if (!AI_RESEARCH_ENABLED || !TAVILY_API_KEY) {
    return { jobId: "", resultsFound: 0, entriesCreated: 0, error: "Research disabled or Tavily key not set" };
  }

  const now = new Date();
  const monthYear = now.toLocaleDateString("en-US", { month: "long", year: "numeric" });

  const queryIndex = now.getDate() % ROTATING_QUERIES.length;
  const baseQuery = ROTATING_QUERIES[queryIndex];
  const query = `${baseQuery} ${monthYear}`;

  const job = await prisma.researchJob.create({
    data: { query, status: "RUNNING", runAt: now },
  });

  try {
    const results = await tavilySearch(query);

    let entriesCreated = 0;
    for (const result of results) {
      // Dedup by source URL
      const exists = await prisma.knowledgeEntry.findFirst({
        where: { source: result.url },
      });
      if (exists) continue;

      // Skip very short content
      if (result.content.length < 100) continue;

      try {
        await addKnowledgeEntry({
          title: result.title,
          content: result.content,
          source: result.url,
          sourceType: "WEB_RESEARCH",
          autoApprove: false,
        });
        entriesCreated++;
      } catch (err) {
        console.error(`[research] Failed to add entry for ${result.url}:`, err);
      }
    }

    await prisma.researchJob.update({
      where: { id: job.id },
      data: {
        status: "COMPLETED",
        completedAt: new Date(),
        resultsFound: results.length,
        entriesCreated,
      },
    });

    return { jobId: job.id, resultsFound: results.length, entriesCreated };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    await prisma.researchJob.update({
      where: { id: job.id },
      data: {
        status: "FAILED",
        completedAt: new Date(),
        errorMessage: message,
      },
    });

    return { jobId: job.id, resultsFound: 0, entriesCreated: 0, error: message };
  }
}
