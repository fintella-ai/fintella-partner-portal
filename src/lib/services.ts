import { prisma } from "@/lib/prisma";

export type ServiceRow = {
  id: string;
  slug: string;
  name: string;
  shortName: string | null;
  description: string | null;
  active: boolean;
  defaultCommissionRate: number;
  l2RateMultiplier: number;
  l3RateMultiplier: number;
  firmFeeRate: number | null;
  formFieldsConfig: any;
  fulfillmentType: string;
  webhookUrl: string | null;
  webhookHeaders: any;
  landingPageSlug: string | null;
  landingPageContent: any;
  stages: any;
  accentColor: string | null;
  iconEmoji: string | null;
};

export async function getActiveServices(): Promise<ServiceRow[]> {
  return prisma.service.findMany({
    where: { active: true },
    orderBy: { name: "asc" },
  });
}

export async function getServiceBySlug(slug: string): Promise<ServiceRow | null> {
  return prisma.service.findUnique({ where: { slug } });
}

export async function getServiceById(id: string): Promise<ServiceRow | null> {
  return prisma.service.findUnique({ where: { id } });
}

export async function getCommissionRateForPartner(
  partnerCode: string,
  serviceId: string
): Promise<number> {
  const override = await prisma.partnerServiceRate.findUnique({
    where: { partnerCode_serviceId: { partnerCode, serviceId } },
  });
  if (override) return override.commissionRate;

  const service = await prisma.service.findUnique({
    where: { id: serviceId },
    select: { defaultCommissionRate: true },
  });
  return service?.defaultCommissionRate ?? 0.25;
}

export function getStageLabels(service: ServiceRow | null): Record<string, { label: string; color: string }> {
  if (service?.stages && Array.isArray(service.stages)) {
    const map: Record<string, { label: string; color: string }> = {};
    for (const s of service.stages as Array<{ key: string; label: string; color: string }>) {
      map[s.key] = { label: s.label, color: s.color };
    }
    return map;
  }
  const { STAGE_LABELS } = require("@/lib/constants");
  return STAGE_LABELS;
}
