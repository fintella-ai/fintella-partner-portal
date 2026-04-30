/**
 * AI Knowledge Base — OpenAI embeddings client
 *
 * Used ONLY for generating vector embeddings (text-embedding-3-small).
 * Chat stays on Anthropic Claude via existing ai.ts. This module is
 * demo-gated: if OPENAI_API_KEY is not set, all functions return null
 * and the RAG pipeline falls back to full-text search.
 */

import OpenAI from "openai";

const OPENAI_API_KEY = process.env.OPENAI_API_KEY || "";
const EMBEDDING_MODEL = "text-embedding-3-small";
const EMBEDDING_DIMENSIONS = 1536;

let _client: OpenAI | null = null;
function getClient(): OpenAI | null {
  if (!OPENAI_API_KEY) return null;
  if (!_client) _client = new OpenAI({ apiKey: OPENAI_API_KEY });
  return _client;
}

export async function generateEmbedding(text: string): Promise<number[] | null> {
  const client = getClient();
  if (!client) return null;

  const cleaned = text.replace(/\n+/g, " ").trim();
  if (!cleaned) return null;

  const response = await client.embeddings.create({
    model: EMBEDDING_MODEL,
    input: cleaned,
    dimensions: EMBEDDING_DIMENSIONS,
  });

  return response.data[0]?.embedding ?? null;
}

export async function batchEmbed(texts: string[]): Promise<(number[] | null)[]> {
  const client = getClient();
  if (!client) return texts.map(() => null);

  const cleaned = texts.map((t) => t.replace(/\n+/g, " ").trim());
  const nonEmpty = cleaned.filter(Boolean);
  if (nonEmpty.length === 0) return texts.map(() => null);

  const response = await client.embeddings.create({
    model: EMBEDDING_MODEL,
    input: nonEmpty,
    dimensions: EMBEDDING_DIMENSIONS,
  });

  const resultMap = new Map<number, number[]>();
  let nonEmptyIdx = 0;
  for (let i = 0; i < cleaned.length; i++) {
    if (cleaned[i]) {
      resultMap.set(i, response.data[nonEmptyIdx]?.embedding ?? []);
      nonEmptyIdx++;
    }
  }

  return cleaned.map((_, i) => resultMap.get(i) ?? null);
}

export const EMBEDDING_CONFIG = {
  model: EMBEDDING_MODEL,
  dimensions: EMBEDDING_DIMENSIONS,
  enabled: !!OPENAI_API_KEY,
};
