/**
 * AI Knowledge Base — CRUD operations
 *
 * Handles adding, updating, approving, and previewing knowledge entries.
 * Uses existing Anthropic client for summarization/categorization (keeps
 * consistent with codebase — OpenAI is used ONLY for embeddings).
 */

import { prisma } from "@/lib/prisma";
import { generateEmbedding } from "@/lib/ai-embeddings";
import Anthropic from "@anthropic-ai/sdk";
import type { KnowledgeCategory, KnowledgeSourceType } from "@prisma/client";

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY || "";
const ANTHROPIC_MODEL = process.env.ANTHROPIC_MODEL || "claude-sonnet-4-6";

let _anthropic: Anthropic | null = null;
function getAnthropic(): Anthropic | null {
  if (!ANTHROPIC_API_KEY) return null;
  if (!_anthropic) _anthropic = new Anthropic({ apiKey: ANTHROPIC_API_KEY });
  return _anthropic;
}

const VALID_CATEGORIES: KnowledgeCategory[] = [
  "CAPE_UPDATE", "LEGAL_CHANGE", "TARIFF_RATE", "STRATEGY_TIP",
  "COUNTRY_POLICY", "BROKER_GUIDANCE", "LEGAL_GUIDANCE", "GENERAL",
];

export interface AddKnowledgeInput {
  title: string;
  content: string;
  category?: KnowledgeCategory;
  source?: string;
  sourceType?: KnowledgeSourceType;
  createdBy?: string;
  autoApprove?: boolean;
}

export async function summarizeContent(content: string): Promise<string> {
  const client = getAnthropic();
  if (!client) return content.slice(0, 200) + "...";

  const response = await client.messages.create({
    model: ANTHROPIC_MODEL,
    max_tokens: 200,
    messages: [
      {
        role: "user",
        content: `Summarize the following content in 2-3 sentences. Focus on key facts relevant to IEEPA tariff refunds, CAPE system, customs brokerage, or import trade law.\n\n${content.slice(0, 8000)}`,
      },
    ],
  });

  const block = response.content[0];
  return block.type === "text" ? block.text : content.slice(0, 200) + "...";
}

export async function categorizeContent(
  content: string
): Promise<{ category: KnowledgeCategory; tags: string[] }> {
  const client = getAnthropic();
  if (!client) return { category: "GENERAL", tags: [] };

  const response = await client.messages.create({
    model: ANTHROPIC_MODEL,
    max_tokens: 200,
    messages: [
      {
        role: "user",
        content: `Analyze this content and return a JSON object with:
1. "category" — one of: ${VALID_CATEGORIES.join(", ")}
2. "tags" — array of 3-6 lowercase keyword tags

Content:
${content.slice(0, 4000)}

Return ONLY the JSON object, no explanation.`,
      },
    ],
  });

  try {
    const block = response.content[0];
    const text = block.type === "text" ? block.text : "{}";
    const parsed = JSON.parse(text.replace(/```json?\n?/g, "").replace(/```/g, "").trim());
    const category = VALID_CATEGORIES.includes(parsed.category) ? parsed.category : "GENERAL";
    const tags = Array.isArray(parsed.tags)
      ? parsed.tags.filter((t: unknown) => typeof t === "string").slice(0, 10)
      : [];
    return { category, tags };
  } catch {
    return { category: "GENERAL", tags: [] };
  }
}

export async function addKnowledgeEntry(input: AddKnowledgeInput) {
  const { title, content, source, sourceType = "ADMIN_PASTE", createdBy, autoApprove = false } = input;

  const [summary, categorization, embedding] = await Promise.all([
    summarizeContent(content),
    input.category
      ? Promise.resolve({ category: input.category, tags: [] as string[] })
      : categorizeContent(content),
    generateEmbedding(`${title}\n\n${content}`),
  ]);

  const entry = await prisma.knowledgeEntry.create({
    data: {
      title,
      content,
      summary,
      category: categorization.category,
      source: source || "Admin Input",
      sourceType,
      tags: categorization.tags,
      isApproved: autoApprove || sourceType === "ADMIN_PASTE" || sourceType === "SYSTEM_SEED",
      createdBy,
    },
  });

  if (embedding) {
    await prisma.$executeRawUnsafe(
      `UPDATE "KnowledgeEntry" SET embedding = $1::vector WHERE id = $2`,
      `[${embedding.join(",")}]`,
      entry.id
    );
  }

  return entry;
}

export async function approveKnowledgeEntry(id: string) {
  const entry = await prisma.knowledgeEntry.update({
    where: { id },
    data: { isApproved: true },
  });

  if (!entry) return null;

  const embedding = await generateEmbedding(`${entry.title}\n\n${entry.content}`);
  if (embedding) {
    await prisma.$executeRawUnsafe(
      `UPDATE "KnowledgeEntry" SET embedding = $1::vector WHERE id = $2`,
      `[${embedding.join(",")}]`,
      entry.id
    );
  }

  return entry;
}

export async function updateKnowledgeEntry(
  id: string,
  data: {
    title?: string;
    content?: string;
    category?: KnowledgeCategory;
    tags?: string[];
    isActive?: boolean;
  }
) {
  const entry = await prisma.knowledgeEntry.update({
    where: { id },
    data,
  });

  if (data.content || data.title) {
    const current = await prisma.knowledgeEntry.findUnique({ where: { id } });
    if (current) {
      const embedding = await generateEmbedding(`${current.title}\n\n${current.content}`);
      if (embedding) {
        await prisma.$executeRawUnsafe(
          `UPDATE "KnowledgeEntry" SET embedding = $1::vector WHERE id = $2`,
          `[${embedding.join(",")}]`,
          id
        );
      }
      if (data.content) {
        const summary = await summarizeContent(current.content);
        await prisma.knowledgeEntry.update({
          where: { id },
          data: { summary },
        });
      }
    }
  }

  return entry;
}

export async function previewKnowledge(content: string, _title?: string) {
  const [summary, categorization] = await Promise.all([
    summarizeContent(content),
    categorizeContent(content),
  ]);
  return { summary, ...categorization };
}
