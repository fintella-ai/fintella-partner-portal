"use client";

import { useCallback, useEffect, useState } from "react";

type PermissionState = "default" | "granted" | "denied" | "unsupported";

interface Preferences {
  quietStart: string | null;
  quietEnd: string | null;
  entityFilter: string | null;
}

/**
 * PushNotificationSetup — "use client" component for the Ops Center.
 *
 * - Checks browser push support + Notification.permission
 * - Shows "Enable Notifications" button if not yet subscribed
 * - Handles the permission request → push subscription → server registration flow
 * - Displays quiet hours configuration when subscribed
 */
export default function PushNotificationSetup() {
  const [permission, setPermission] = useState<PermissionState>("default");
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<string | null>(null);
  const [preferences, setPreferences] = useState<Preferences>({
    quietStart: null,
    quietEnd: null,
    entityFilter: null,
  });
  const [prefsLoading, setPrefsLoading] = useState(false);

  // Check initial state on mount
  useEffect(() => {
    async function checkState() {
      // Check browser support
      if (
        typeof window === "undefined" ||
        !("serviceWorker" in navigator) ||
        !("PushManager" in window) ||
        !("Notification" in window)
      ) {
        setPermission("unsupported");
        setLoading(false);
        return;
      }

      setPermission(
        Notification.permission as "default" | "granted" | "denied"
      );

      if (Notification.permission === "granted") {
        // Check if we have an active subscription
        try {
          const reg = await navigator.serviceWorker.getRegistration(
            "/ops-sw.js"
          );
          if (reg) {
            const sub = await reg.pushManager.getSubscription();
            setIsSubscribed(!!sub);
          }
        } catch {
          // Service worker not registered yet — not subscribed
        }

        // Fetch preferences
        try {
          const res = await fetch("/api/ops/push/preferences");
          if (res.ok) {
            const data = await res.json();
            if (data.preferences) {
              setPreferences(data.preferences);
            }
            if (data.subscriptionCount > 0) {
              setIsSubscribed(true);
            }
          }
        } catch {
          // Preferences fetch failed — not critical
        }
      }

      setLoading(false);
    }

    checkState();
  }, []);

  // Subscribe to push notifications
  const subscribe = useCallback(async () => {
    setActionLoading(true);
    setError(null);

    try {
      // 1. Get VAPID public key from server
      const keyRes = await fetch("/api/ops/push/subscribe");
      if (!keyRes.ok) throw new Error("Failed to fetch VAPID key");
      const { vapidPublicKey } = await keyRes.json();

      if (!vapidPublicKey) {
        setError(
          "Push notifications are not configured on this server (VAPID keys missing)"
        );
        setActionLoading(false);
        return;
      }

      // 2. Request notification permission
      const perm = await Notification.requestPermission();
      setPermission(perm as PermissionState);
      if (perm !== "granted") {
        setError("Notification permission was denied");
        setActionLoading(false);
        return;
      }

      // 3. Register service worker
      const registration = await navigator.serviceWorker.register(
        "/ops-sw.js",
        { scope: "/" }
      );
      await navigator.serviceWorker.ready;

      // 4. Subscribe via Push API
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidPublicKey) as BufferSource,
      });

      const subJson = subscription.toJSON();

      // 5. Send subscription to server
      const saveRes = await fetch("/api/ops/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subscription: {
            endpoint: subJson.endpoint,
            keys: subJson.keys,
          },
        }),
      });

      if (!saveRes.ok) {
        throw new Error("Failed to save subscription on server");
      }

      setIsSubscribed(true);
    } catch (err) {
      console.error("[PushNotificationSetup] Subscribe error:", err);
      setError(
        err instanceof Error ? err.message : "Failed to enable notifications"
      );
    } finally {
      setActionLoading(false);
    }
  }, []);

  // Unsubscribe from push notifications
  const unsubscribe = useCallback(async () => {
    setActionLoading(true);
    setError(null);

    try {
      const reg = await navigator.serviceWorker.getRegistration("/ops-sw.js");
      if (reg) {
        const sub = await reg.pushManager.getSubscription();
        if (sub) {
          // Remove from server first
          await fetch("/api/ops/push/unsubscribe", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ endpoint: sub.endpoint }),
          });

          // Then unsubscribe locally
          await sub.unsubscribe();
        }
      }

      setIsSubscribed(false);
    } catch (err) {
      console.error("[PushNotificationSetup] Unsubscribe error:", err);
      setError(
        err instanceof Error
          ? err.message
          : "Failed to disable notifications"
      );
    } finally {
      setActionLoading(false);
    }
  }, []);

  // Send test notification
  const sendTest = useCallback(async () => {
    setTestResult(null);
    setActionLoading(true);

    try {
      const res = await fetch("/api/ops/push/test", { method: "POST" });
      const data = await res.json();

      if (data.demo) {
        setTestResult("Push is in demo mode (VAPID keys not set on server)");
      } else if (data.ok) {
        setTestResult(
          `Sent ${data.sent}/${data.total} notification${data.total !== 1 ? "s" : ""}`
        );
      } else {
        setTestResult(data.message || "Test failed");
      }
    } catch {
      setTestResult("Failed to send test notification");
    } finally {
      setActionLoading(false);
    }
  }, []);

  // Save quiet hours
  const savePreferences = useCallback(
    async (updates: Partial<Preferences>) => {
      setPrefsLoading(true);
      setError(null);

      try {
        const res = await fetch("/api/ops/push/preferences", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(updates),
        });

        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error || "Failed to save preferences");
        }

        setPreferences((prev) => ({ ...prev, ...updates }));
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : "Failed to save preferences"
        );
      } finally {
        setPrefsLoading(false);
      }
    },
    []
  );

  // ── Render ────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="rounded-lg border border-white/10 bg-white/5 p-4">
        <div className="flex items-center gap-2 text-sm text-white/50">
          <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white/20 border-t-white/60" />
          Checking notification support...
        </div>
      </div>
    );
  }

  if (permission === "unsupported") {
    return (
      <div className="rounded-lg border border-white/10 bg-white/5 p-4">
        <p className="text-sm text-white/50">
          Push notifications are not supported in this browser.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-white/10 bg-white/5 p-4 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-medium text-white">
            Push Notifications
          </h3>
          <p className="text-xs text-white/50 mt-0.5">
            {isSubscribed
              ? "You will receive push notifications for Ops Center updates"
              : "Enable push notifications to stay informed in real-time"}
          </p>
        </div>

        <div className="flex items-center gap-2">
          {isSubscribed && (
            <button
              onClick={sendTest}
              disabled={actionLoading}
              className="rounded-md bg-white/10 px-3 py-1.5 text-xs font-medium text-white/70 hover:bg-white/15 hover:text-white transition-colors disabled:opacity-50"
            >
              Test
            </button>
          )}

          {isSubscribed ? (
            <button
              onClick={unsubscribe}
              disabled={actionLoading}
              className="rounded-md bg-red-500/20 px-3 py-1.5 text-xs font-medium text-red-400 hover:bg-red-500/30 transition-colors disabled:opacity-50"
            >
              {actionLoading ? "..." : "Disable"}
            </button>
          ) : (
            <button
              onClick={subscribe}
              disabled={actionLoading || permission === "denied"}
              className="rounded-md bg-blue-500/20 px-3 py-1.5 text-xs font-medium text-blue-400 hover:bg-blue-500/30 transition-colors disabled:opacity-50"
            >
              {actionLoading
                ? "Enabling..."
                : permission === "denied"
                  ? "Blocked by browser"
                  : "Enable Notifications"}
            </button>
          )}
        </div>
      </div>

      {permission === "denied" && !isSubscribed && (
        <p className="text-xs text-amber-400/80">
          Notifications are blocked in your browser settings. To enable them,
          click the lock icon in the address bar and allow notifications for
          this site.
        </p>
      )}

      {error && (
        <p className="text-xs text-red-400">{error}</p>
      )}

      {testResult && (
        <p className="text-xs text-green-400">{testResult}</p>
      )}

      {/* Quiet hours — only show when subscribed */}
      {isSubscribed && (
        <div className="border-t border-white/10 pt-3 space-y-3">
          <h4 className="text-xs font-medium text-white/70 uppercase tracking-wider">
            Quiet Hours
          </h4>
          <p className="text-xs text-white/40">
            Notifications will be silenced during quiet hours.
          </p>
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-1.5 text-xs text-white/60">
              From
              <input
                type="time"
                value={preferences.quietStart || ""}
                onChange={(e) =>
                  savePreferences({
                    quietStart: e.target.value || null,
                  })
                }
                disabled={prefsLoading}
                className="rounded bg-white/10 border border-white/10 px-2 py-1 text-xs text-white [color-scheme:dark] disabled:opacity-50"
              />
            </label>
            <label className="flex items-center gap-1.5 text-xs text-white/60">
              To
              <input
                type="time"
                value={preferences.quietEnd || ""}
                onChange={(e) =>
                  savePreferences({
                    quietEnd: e.target.value || null,
                  })
                }
                disabled={prefsLoading}
                className="rounded bg-white/10 border border-white/10 px-2 py-1 text-xs text-white [color-scheme:dark] disabled:opacity-50"
              />
            </label>
            {(preferences.quietStart || preferences.quietEnd) && (
              <button
                onClick={() =>
                  savePreferences({
                    quietStart: null,
                    quietEnd: null,
                  })
                }
                disabled={prefsLoading}
                className="text-xs text-white/40 hover:text-white/60 transition-colors"
              >
                Clear
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding)
    .replace(/-/g, "+")
    .replace(/_/g, "/");

  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}
