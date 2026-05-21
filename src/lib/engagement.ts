// Engagement scoring was descoped (PartnerActivity model marked DEAD).
// This stub keeps existing callers from breaking — all calls are fire-and-forget.
export async function recordActivity(
  _partnerCode: string,
  _type: string,
  _meta?: Record<string, any>
): Promise<void> {}
