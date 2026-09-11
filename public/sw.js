// Service worker: PWA install support + Web Push notifications.
const CACHE = "investpro-v1";

self.addEventListener("install", () => { self.skipWaiting(); });
self.addEventListener("activate", (e) => { e.waitUntil(self.clients.claim()); });

self.addEventListener("fetch", (e) => {
  // Network-first passthrough; lets the app keep working offline-tolerant for cached shell.
  if (e.request.method !== "GET") return;
  e.respondWith(
    fetch(e.request).catch(() => caches.match(e.request).then((r) => r || Response.error()))
  );
});

self.addEventListener("push", (event) => {
  let p = {};
  try { p = event.data ? event.data.json() : {}; } catch { p = { title: "AutoVest", body: event.data ? event.data.text() : "" }; }

  const title = p.title || "AutoVest";
  const options = {
    body: p.body || "",
    icon: p.icon || "/favicon.png",
    badge: "/favicon.png",
    image: p.image || undefined,
    tag: p.tag || p.id || undefined,
    renotify: false,
    timestamp: p.timestamp ? Number(p.timestamp) : Date.now(),
    data: { url: p.url || "/", id: p.id || null },
    vibrate: [80, 40, 80],
    actions: p.action_label ? [{ action: "open", title: String(p.action_label).slice(0, 24) }] : undefined,
  };

  event.waitUntil(
    self.registration.getNotifications({ tag: options.tag || "" }).then((existing) => {
      // Avoid duplicates for the same notification id/tag
      if (options.tag && existing.some((n) => n.tag === options.tag)) return;
      return self.registration.showNotification(title, options);
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = (event.notification.data && event.notification.data.url) || "/";
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((list) => {
      for (const client of list) {
        if ("focus" in client) {
          client.focus();
          if ("navigate" in client) client.navigate(target).catch(() => {});
          return;
        }
      }
      return self.clients.openWindow(target);
    })
  );
});

self.addEventListener("pushsubscriptionchange", (event) => {
  // Let the app re-register on next open; store a flag clients can read.
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((list) => {
      list.forEach((c) => c.postMessage({ type: "push-subscription-change" }));
    })
  );
});
