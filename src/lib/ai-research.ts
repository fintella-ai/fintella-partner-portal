/**
 * AI Knowledge Base — Tavily-powered research agent
 *
 * Uses @tavily/core SDK for search + extract + crawl.
 * Runs daily via Vercel cron, searches for IEEPA/CAPE/tariff updates,
 * deduplicates against existing entries, creates unapproved KnowledgeEntry
 * rows for admin review.
 *
 * Demo-gated: if TAVILY_API_KEY or AI_RESEARCH_ENABLED is not set,
 * all functions return early with zero results.
 */

import { prisma } from "@/lib/prisma";
import { addKnowledgeEntry } from "@/lib/ai-knowledge-crud";
import { tavily } from "@tavily/core";

const TAVILY_API_KEY = process.env.TAVILY_API_KEY || "";
const AI_RESEARCH_ENABLED = process.env.AI_RESEARCH_ENABLED === "true";

function getClient() {
  if (!TAVILY_API_KEY) return null;
  return tavily({ apiKey: TAVILY_API_KEY });
}

const ROTATING_QUERIES = [
  "CAPE IEEPA tariff refund CBP update 2026",
  "IEEPA tariff executive order change customs",
  "ACE portal CAPE system update customs broker filing",
  "Court of International Trade IEEPA tariff ruling 2026",
  "CBP IEEPA duty refund news importers",
  "tariff refund importer eligible HTS Chapter 99 update",
  "CAPE rejection rate CBP automated refund problems",
  "customs broker IEEPA referral commission opportunity",
  "Section 122 tariff surcharge replacement IEEPA",
  "trade compliance CAPE filing deadline protest window",
];

export async function tavilySearch(query: string, maxResults = 5) {
  const client = getClient();
  if (!client) return [];

  try {
    const response = await client.search(query, {
      searchDepth: "advanced",
      maxResults,
      includeAnswer: false,
      includeRawContent: false,
    });
    return response.results || [];
  } catch (err) {
    console.error("[research] Tavily search error:", err);
    return [];
  }
}

export async function tavilyExtract(urls: string[]) {
  const client = getClient();
  if (!client) return [];

  try {
    const response = await client.extract(urls);
    return response.results || [];
  } catch (err) {
    console.error("[research] Tavily extract error:", err);
    return [];
  }
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
  const queryIndex = now.getDate() % ROTATING_QUERIES.length;
  const query = ROTATING_QUERIES[queryIndex];

  const job = await prisma.researchJob.create({
    data: { query, status: "RUNNING", runAt: now },
  });

  try {
    const results = await tavilySearch(query, 8);

    let entriesCreated = 0;
    for (const result of results) {
      const exists = await prisma.knowledgeEntry.findFirst({
        where: { source: result.url },
      });
      if (exists) continue;

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

export async function runDeepResearch(topic: string): Promise<{
  searchResults: number;
  extractedPages: number;
  entriesCreated: number;
}> {
  if (!TAVILY_API_KEY) {
    return { searchResults: 0, extractedPages: 0, entriesCreated: 0 };
  }

  const searchResults = await tavilySearch(topic, 10);

  const urls = searchResults
    .filter((r) => r.score > 0.5)
    .map((r) => r.url)
    .slice(0, 5);

  let extractedPages = 0;
  let entriesCreated = 0;

  if (urls.length > 0) {
    const extracted = await tavilyExtract(urls);
    extractedPages = extracted.length;

    for (const page of extracted) {
      const exists = await prisma.knowledgeEntry.findFirst({
        where: { source: page.url },
      });
      if (exists) continue;

      const content = typeof page.rawContent === "string" ? page.rawContent : "";
      if (content.length < 200) continue;

      try {
        await addKnowledgeEntry({
          title: `Deep Research: ${topic} — ${new URL(page.url).hostname}`,
          content: content.slice(0, 10000),
          source: page.url,
          sourceType: "WEB_RESEARCH",
          autoApprove: false,
        });
        entriesCreated++;
      } catch {}
    }
  }

  return { searchResults: searchResults.length, extractedPages, entriesCreated };
}
