// Minimal service worker — needed so Chrome/Edge fires the
// 'beforeinstallprompt' event so we can offer in-page PWA install.
const CACHE = "investpro-v1";
self.addEventListener("install", (e) => { self.skipWaiting(); });
self.addEventListener("activate", (e) => { e.waitUntil(self.clients.claim()); });
self.addEventListener("fetch", (e) => {
  // Network-first passthrough; lets the app keep working offline-tolerant for cached shell.
  if (e.request.method !== "GET") return;
  e.respondWith(
    fetch(e.request).catch(() => caches.match(e.request).then((r) => r || Response.error()))
  );
});
