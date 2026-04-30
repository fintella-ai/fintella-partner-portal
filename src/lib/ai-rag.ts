/**
 * AI Knowledge Base — RAG search pipeline
 *
 * Hybrid search: pgvector cosine similarity (primary) with PostgreSQL
 * full-text search fallback. Returns KnowledgeEntry results ranked by
 * relevance, filtered to approved + active entries only.
 */

import { prisma } from "@/lib/prisma";
import { generateEmbedding } from "@/lib/ai-embeddings";
import type { KnowledgeCategory } from "@prisma/client";

export interface KnowledgeSearchResult {
  id: string;
  title: string;
  content: string;
  summary: string | null;
  category: KnowledgeCategory;
  source: string | null;
  tags: string[];
  similarity?: number;
}

export async function searchByVector(
  query: string,
  limit: number = 5
): Promise<KnowledgeSearchResult[]> {
  const embedding = await generateEmbedding(query);
  if (!embedding) return [];

  const vectorStr = `[${embedding.join(",")}]`;

  const results = await prisma.$queryRawUnsafe<
    (KnowledgeSearchResult & { similarity: number })[]
  >(
    `SELECT id, title, content, summary, category, source, tags,
            1 - (embedding <=> $1::vector) AS similarity
     FROM "KnowledgeEntry"
     WHERE "isApproved" = true
       AND "isActive" = true
       AND embedding IS NOT NULL
     ORDER BY embedding <=> $1::vector
     LIMIT $2`,
    vectorStr,
    limit
  );

  return results.filter((r) => r.similarity > 0.3);
}

export async function searchByFullText(
  query: string,
  limit: number = 5
): Promise<KnowledgeSearchResult[]> {
  const tsQuery = query
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w.replace(/[^a-zA-Z0-9]/g, ""))
    .filter(Boolean)
    .join(" & ");

  if (!tsQuery) return [];

  const results = await prisma.$queryRawUnsafe<KnowledgeSearchResult[]>(
    `SELECT id, title, content, summary, category, source, tags
     FROM "KnowledgeEntry"
     WHERE "isApproved" = true
       AND "isActive" = true
       AND (
         to_tsvector('english', title || ' ' || content) @@ to_tsquery('english', $1)
         OR title ILIKE $2
         OR content ILIKE $2
       )
     LIMIT $3`,
    tsQuery,
    `%${query}%`,
    limit
  );

  return results;
}

export async function searchKnowledge(
  query: string,
  limit: number = 5
): Promise<KnowledgeSearchResult[]> {
  // Try vector search first (best quality)
  const vectorResults = await searchByVector(query, limit);
  if (vectorResults.length >= 2) return vectorResults;

  // Fall back to full-text if vector search found < 2 results
  const textResults = await searchByFullText(query, limit);

  // Merge and deduplicate
  const seen = new Set(vectorResults.map((r) => r.id));
  const merged = [...vectorResults];
  for (const r of textResults) {
    if (!seen.has(r.id)) {
      merged.push(r);
      seen.add(r.id);
    }
  }

  return merged.slice(0, limit);
}

export function formatKnowledgeForPrompt(entries: KnowledgeSearchResult[]): string {
  if (entries.length === 0) return "";

  const sections = entries.map((e, i) => {
    const sim = e.similarity ? ` (relevance: ${(e.similarity * 100).toFixed(0)}%)` : "";
    return `### Source ${i + 1}: ${e.title}${sim}\n[Category: ${e.category}] [Source: ${e.source || "Unknown"}]\n\n${e.summary || e.content.slice(0, 500)}`;
  });

  return [
    "# Retrieved Knowledge Base Articles",
    "The following articles were retrieved as potentially relevant to the partner's question. Use them to inform your response. Cite specific sources when you reference their content.",
    "",
    ...sections,
  ].join("\n\n");
}
