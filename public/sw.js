// mediCetamol service worker — install only, NO caching.
// It exists so browsers treat the site as an installable app. Every request still goes
// straight to the network, so new deployments always load fresh. (Progress, bookmarks
// and streaks live in IndexedDB and are unaffected by this file.)

self.addEventListener("install", () => self.skipWaiting());

self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

// Pass-through fetch handler (installability signal); nothing is cached or rewritten.
self.addEventListener("fetch", (event) => {
  if (event.request.mode === "navigate") {
    event.respondWith(fetch(event.request));
  }
});
