const CACHE_NAME = "jaxmoney-shell-v5";
const APP_SHELL = ["./", "./index.html", "./apple-touch-icon.png"];

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
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Stale-while-revalidate for same-origin requests (the app shell): if we already have a
// cached copy, return it immediately so the app paints without waiting on the network at
// all, then fetch in the background and refresh the cache for next time. Falls back to
// waiting on the network only on a true first-ever visit (nothing cached yet).
// API requests to third-party domains (the exchange-rate API) are left untouched here —
// that fallback is handled at the app level via localStorage, since it needs per-currency logic.
self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;
  if (event.request.method !== "GET") return;

  event.respondWith(
    caches.open(CACHE_NAME).then((cache) =>
      cache.match(event.request).then((cached) => {
        const networkFetch = fetch(event.request)
          .then((response) => {
            cache.put(event.request, response.clone());
            return response;
          })
          .catch(() => cached || cache.match("./index.html"));

        return cached || networkFetch;
      })
    )
  );
});
