/**
 * Ops Center Service Worker — Web Push Notifications
 *
 * Handles push events, notification display, and click navigation.
 * Registered separately from the main PWA service worker (sw.js).
 */

/* eslint-disable no-restricted-globals */

self.addEventListener("push", function (event) {
  if (!event.data) return;

  let payload;
  try {
    payload = event.data.json();
  } catch {
    payload = {
      title: "Ops Center",
      body: event.data.text(),
    };
  }

  const title = payload.title || "Ops Center";
  const options = {
    body: payload.body || "",
    icon: payload.icon || "/icons/icon-192x192.png",
    badge: "/icons/icon-72x72.png",
    tag: payload.tag || "ops-notification",
    data: {
      url: payload.url || "/admin",
      entitySlug: payload.entitySlug || null,
    },
    // Vibrate: short-long-short
    vibrate: [100, 200, 100],
    // Renotify if same tag — update instead of silently dropping
    renotify: true,
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", function (event) {
  event.notification.close();

  const url = event.notification.data?.url || "/admin";

  event.waitUntil(
    // Try to focus an existing tab with this URL, otherwise open a new one
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then(function (clientList) {
        // Check if there's already a tab open at the target URL
        for (let i = 0; i < clientList.length; i++) {
          const client = clientList[i];
          if (client.url.includes(url) && "focus" in client) {
            return client.focus();
          }
        }
        // No existing tab — open a new one
        if (self.clients.openWindow) {
          return self.clients.openWindow(url);
        }
      })
  );
});

// Handle subscription change (browser rotated keys)
self.addEventListener("pushsubscriptionchange", function (event) {
  event.waitUntil(
    self.registration.pushManager
      .subscribe(event.oldSubscription.options)
      .then(function (newSubscription) {
        // Re-register with the server
        return fetch("/api/ops/push/subscribe", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ subscription: newSubscription.toJSON() }),
        });
      })
  );
});
