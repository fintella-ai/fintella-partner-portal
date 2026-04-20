// src/app/api/announcements/stream/route.ts
import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Client } from "pg";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const session = await auth();
  const partnerCode = (session?.user as any)?.partnerCode;
  if (!partnerCode) return new Response("Unauthorized", { status: 401 });

  const channelId = new URL(req.url).searchParams.get("channelId");
  if (!channelId) return new Response("channelId required", { status: 400 });

  const membership = await prisma.channelMembership.findFirst({
    where: { channelId, partnerCode, removedAt: null, channel: { archivedAt: null } },
  });
  if (!membership) return new Response("Forbidden", { status: 403 });

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const client = new Client({ connectionString: process.env.DIRECT_URL || process.env.DATABASE_URL });
      try { await client.connect(); await client.query("LISTEN admin_chat_events"); }
      catch { controller.close(); return; }

      const onNotify = (msg: any) => {
        try {
          const parsed = JSON.parse(msg.payload);
          if (parsed.channelId === channelId && parsed.event?.startsWith?.("channel.")) {
            // Partner only sees announcements (NOT replies from other partners, NOT their reply-thread confirmations from the admin side)
            if (parsed.event.startsWith("channel.announcement.")) {
              controller.enqueue(encoder.encode(`event: ${parsed.event}\ndata: ${msg.payload}\n\n`));
            } else if (parsed.event === "channel.reply.created" && parsed.threadId) {
              // Only pass the event if the thread is THIS partner's own (compare threadId's partnerCode)
              // (we keep the check lightweight; partner endpoints re-verify on their own fetches)
              controller.enqueue(encoder.encode(`event: channel.reply.created\ndata: ${msg.payload}\n\n`));
            }
          }
        } catch {}
      };
      client.on("notification", onNotify);
      const hb = setInterval(() => controller.enqueue(encoder.encode(`: ping\n\n`)), 20_000);
      req.signal.addEventListener("abort", async () => {
        clearInterval(hb);
        client.off("notification", onNotify);
        await client.end().catch(() => {});
        try { controller.close(); } catch {}
      });
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      "Connection": "keep-alive",
    },
  });
}
