import webPush from "web-push";

// ─── VAPID Configuration ───────────────────────────────────────────────────
// Demo-gated: if VAPID keys aren't set, all push operations are no-ops.
// Generate keys with: npx web-push generate-vapid-keys

const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY;
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY;
const VAPID_SUBJECT =
  process.env.VAPID_SUBJECT || "mailto:admin@fintella.partners";

const isConfigured = !!(VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY);

if (isConfigured) {
  webPush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY!, VAPID_PRIVATE_KEY!);
}

// ─── Types ──────────────────────────────────────────────────────────────────

export interface PushPayload {
  title: string;
  body: string;
  icon?: string;
  url?: string;
  tag?: string;
  entitySlug?: string;
}

export interface PushSubscriptionData {
  endpoint: string;
  keys: {
    p256dh: string;
    auth: string;
  };
}

// ─── Send push notification ─────────────────────────────────────────────────

export async function sendPushNotification(
  subscription: PushSubscriptionData,
  payload: PushPayload
): Promise<boolean> {
  if (!isConfigured) {
    console.log(
      "[web-push] VAPID keys not configured — skipping push (demo mode)"
    );
    return false;
  }

  try {
    await webPush.sendNotification(
      {
        endpoint: subscription.endpoint,
        keys: subscription.keys,
      },
      JSON.stringify(payload),
      {
        TTL: 60 * 60, // 1 hour
        urgency: "normal",
      }
    );
    return true;
  } catch (err: unknown) {
    const statusCode =
      err && typeof err === "object" && "statusCode" in err
        ? (err as { statusCode: number }).statusCode
        : undefined;

    if (statusCode === 410 || statusCode === 404) {
      // Subscription expired or invalid — caller should remove it
      console.log(
        `[web-push] Subscription gone (${statusCode}): ${subscription.endpoint}`
      );
      return false;
    }

    console.error("[web-push] Failed to send notification:", err);
    return false;
  }
}

// ─── Utilities ──────────────────────────────────────────────────────────────

/** Get the public VAPID key for client-side subscription */
export function getVapidPublicKey(): string | null {
  return VAPID_PUBLIC_KEY || null;
}

/** Check if push is configured (non-demo) */
export function isPushConfigured(): boolean {
  return isConfigured;
}

/**
 * Generate a new VAPID key pair.
 * Utility for initial setup — run once and store in env vars.
 */
export function generateVAPIDKeys(): { publicKey: string; privateKey: string } {
  return webPush.generateVAPIDKeys();
}
