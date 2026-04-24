/**
 * Sentry — edge runtime config
 * Loaded in middleware and edge API routes.
 * Gracefully no-ops when SENTRY_DSN is not set.
 */
import * as Sentry from "@sentry/nextjs";

const dsn = process.env.SENTRY_DSN;

if (dsn) {
  Sentry.init({
    dsn,
    tracesSampleRate: parseFloat(process.env.SENTRY_TRACES_SAMPLE_RATE || "0.1"),
    environment: process.env.VERCEL_ENV || process.env.NODE_ENV || "development",
    // Include request context (headers, query, etc.) on edge events. Edge
    // runtime doesn't have a beforeSend scrubber here yet; if one is added
    // it should mirror the server config.
    sendDefaultPii: true,
    // Enable Sentry Logs product. Opt-in; no cost unless used.
    enableLogs: true,
  });
}
