const CACHE_NAME = "jaxmoney-shell-v9";
const APP_SHELL = ["./", "./index.html", "./apple-touch-icon.png", "./manifest.json"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(APP_SHELL))
      .catch(() => {})
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      // Navigation Preload: if a navigation request DOES reach this service worker while it's
      // still spinning up (the brief window between the SW being invoked and being ready to run
      // its fetch handler), the browser starts the network request in parallel instead of making
      // the page wait for the SW to finish booting before anything is even requested. This only
      // helps the "SW is a little slow to start" case — it does nothing for a navigation that
      // bypasses the SW entirely, which is a separate, not-fully-in-our-control iOS behavior.
      if (self.registration.navigationPreload) {
        try { await self.registration.navigationPreload.enable(); } catch (e) {}
      }
      const keys = await caches.keys();
      await Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)));
    })()
  );
  self.clients.claim();
});

// Stale-while-revalidate for same-origin GET requests (the app shell): if we already have a
// cached copy, return it immediately so the app paints without waiting on the network at all,
// then refresh the cache in the background for next time. Only waits on the network when there
// is truly nothing cached yet (first-ever visit) — and even then, prefers the navigation-preload
// response (already in flight) over starting a brand new fetch from scratch.
// API requests to third-party domains (the exchange-rate API) are left untouched here — that
// fallback is handled at the app level via localStorage, since it needs per-currency logic.
self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;
  if (event.request.method !== "GET") return;

  event.respondWith(
    (async () => {
      const cache = await caches.open(CACHE_NAME);
      const cached = await cache.match(event.request);

      if (cached) {
        // Background revalidation — don't block the response on this.
        fetch(event.request)
          .then((response) => cache.put(event.request, response.clone()))
          .catch(() => {});
        return cached;
      }

      try {
        const preload = await event.preloadResponse;
        if (preload) {
          cache.put(event.request, preload.clone());
          return preload;
        }
      } catch (e) {}

      try {
        const response = await fetch(event.request);
        cache.put(event.request, response.clone());
        return response;
      } catch (e) {
        return (await cache.match("./index.html")) || Response.error();
      }
    })()
  );
});
