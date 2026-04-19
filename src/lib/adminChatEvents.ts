// src/lib/adminChatEvents.ts
import { prisma } from "@/lib/prisma";

export type AdminChatEvent =
  | { event: "message.created"; threadId: string; messageId: string }
  | { event: "message.updated"; threadId: string; messageId: string }
  | { event: "message.deleted"; threadId: string; messageId: string };

/** Fire a Postgres NOTIFY so SSE subscribers see the event. Best-effort. */
export async function publishAdminChatEvent(event: AdminChatEvent): Promise<void> {
  try {
    const payload = JSON.stringify(event);
    await prisma.$executeRawUnsafe(`SELECT pg_notify('admin_chat_events', $1)`, payload);
  } catch (e) {
    console.warn("[adminChatEvents] pg_notify failed:", (e as Error).message);
  }
}
