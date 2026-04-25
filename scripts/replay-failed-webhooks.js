/**
 * One-shot script: replays failed webhook requests from the WebhookRequestLog.
 *
 * Finds all 500-status POST /api/webhook/referral entries from the last 48h,
 * parses their stored request body, and re-POSTs them to the live webhook
 * endpoint. The fix for numeric hs_object_id (PR #588) must be deployed
 * before running this.
 *
 * Usage:
 *   DATABASE_URL="..." WEBHOOK_REPLAY_KEY="..." node scripts/replay-failed-webhooks.js
 *
 * WEBHOOK_REPLAY_KEY should be the value of FROST_LAW_API_KEY (the x-fintella-api-key).
 */

const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();
const BASE_URL = process.env.REPLAY_BASE_URL || "https://fintella.partners";
const API_KEY = process.env.WEBHOOK_REPLAY_KEY;

if (!API_KEY) {
  console.error("WEBHOOK_REPLAY_KEY env var is required (set to the x-fintella-api-key value)");
  process.exit(1);
}

async function main() {
  const cutoff = new Date(Date.now() - 48 * 60 * 60 * 1000);

  const failedLogs = await prisma.webhookRequestLog.findMany({
    where: {
      path: "/api/webhook/referral",
      method: "POST",
      responseStatus: 500,
      createdAt: { gte: cutoff },
    },
    orderBy: { createdAt: "asc" },
    select: { id: true, body: true, createdAt: true, responseBody: true },
  });

  console.log("Found " + failedLogs.length + " failed webhook requests in the last 48h\n");

  if (failedLogs.length === 0) {
    console.log("Nothing to replay.");
    return;
  }

  var succeeded = 0;
  var failed = 0;

  for (var i = 0; i < failedLogs.length; i++) {
    var log = failedLogs[i];
    if (!log.body) {
      console.log("[" + (i + 1) + "/" + failedLogs.length + "] SKIP — no body stored (id: " + log.id + ")");
      continue;
    }

    var parsedBody;
    try {
      parsedBody = JSON.parse(log.body);
    } catch (e) {
      console.log("[" + (i + 1) + "/" + failedLogs.length + "] SKIP — unparseable body (id: " + log.id + ")");
      continue;
    }

    var hsId = parsedBody.hs_object_id || parsedBody.dealId || parsedBody.externalDealId || "unknown";
    console.log("[" + (i + 1) + "/" + failedLogs.length + "] Replaying hs_object_id=" + hsId + " from " + log.createdAt.toISOString());

    try {
      var res = await fetch(BASE_URL + "/api/webhook/referral", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-fintella-api-key": API_KEY,
        },
        body: log.body,
      });
      var resBody = await res.text();

      if (res.ok) {
        console.log("  ✓ " + res.status + " — " + resBody.slice(0, 200));
        succeeded++;
      } else {
        console.log("  ✗ " + res.status + " — " + resBody.slice(0, 200));
        failed++;
      }
    } catch (e) {
      console.log("  ✗ Network error: " + e.message);
      failed++;
    }

    // Small delay between requests to avoid rate limiting
    await new Promise(function(r) { setTimeout(r, 500); });
  }

  console.log("\nDone. Succeeded: " + succeeded + ", Failed: " + failed + ", Total: " + failedLogs.length);
}

main()
  .catch(function(e) { console.error("Replay error:", e); process.exit(1); })
  .finally(function() { prisma.$disconnect(); });
