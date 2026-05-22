import type { ServiceRow } from "@/lib/services";

interface FulfillmentPayload {
  event: "deal.created" | "deal.updated";
  deal: Record<string, any>;
  partner: { partnerCode: string; firstName: string; lastName: string; email: string };
  service: { slug: string; name: string };
}

export async function routeToFulfillment(
  service: ServiceRow,
  payload: FulfillmentPayload
): Promise<{ ok: boolean; status?: number; body?: string }> {
  if (service.fulfillmentType !== "internal" || !service.webhookUrl) {
    return { ok: true };
  }

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(service.webhookHeaders && typeof service.webhookHeaders === "object"
      ? (service.webhookHeaders as Record<string, string>)
      : {}),
  };

  try {
    const res = await fetch(service.webhookUrl, {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
    });
    const body = await res.text().catch(() => "");
    if (!res.ok) {
      console.error(
        `[fulfillment] POST ${service.webhookUrl} returned ${res.status}: ${body.slice(0, 500)}`
      );
    }
    return { ok: res.ok, status: res.status, body };
  } catch (err: any) {
    console.error(`[fulfillment] POST ${service.webhookUrl} failed:`, err.message);
    return { ok: false, body: err.message };
  }
}
