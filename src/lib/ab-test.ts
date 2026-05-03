/**
 * A/B Test Variant Selector (Phase 19b wiring)
 *
 * When a template has an active TemplateAbTest, this module selects the
 * correct variant template and fire-and-forget increments the sends counter.
 * If no active test exists or the lookup fails, returns null so the caller
 * falls through to the default template.
 */

import { prisma } from "@/lib/prisma";

export interface AbVariantResult {
  templateId: string;
  variant: string;
}

export async function resolveAbVariant(
  workflowTag: string,
  templateType: "email" | "sms"
): Promise<AbVariantResult | null> {
  try {
    const test = await prisma.templateAbTest.findFirst({
      where: { workflowTag, templateType, status: "running" },
      include: { variants: true },
    });

    if (!test || test.variants.length === 0) return null;

    let selected: typeof test.variants[number] | undefined;

    if (test.winnerVariant) {
      selected = test.variants.find((v) => v.variant === test.winnerVariant);
    } else {
      const coin = Math.random() < 0.5 ? "A" : "B";
      selected = test.variants.find((v) => v.variant === coin);
    }

    if (!selected) return null;

    prisma.templateAbVariant.update({
      where: { id: selected.id },
      data: { sends: { increment: 1 } },
    }).catch(() => {});

    return { templateId: selected.templateId, variant: selected.variant };
  } catch {
    return null;
  }
}
