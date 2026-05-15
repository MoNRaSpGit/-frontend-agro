/* global self, caches, fetch, URL */

const CACHE_NAME = "saaspro-agro-v3";

function isStaticAssetRequest(request) {
  return ["script", "style", "worker"].includes(request.destination);
}

function isCacheableSupportAssetRequest(request) {
  return ["image", "font", "manifest"].includes(request.destination);
}

async function updateCache(cache, request, response) {
  if (!response || response.status !== 200 || response.type === "opaque") {
    return response;
  }

  await cache.put(request, response.clone());
  return response;
}

self.addEventListener("install", (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))).then(() => self.clients.claim())
    )
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;

  if (request.method !== "GET") {
    return;
  }

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) {
    return;
  }

  if (url.pathname.endsWith("/app-build.json")) {
    event.respondWith(fetch(request, { cache: "no-store" }));
    return;
  }

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request, { cache: "no-store" })
        .then((response) => {
          return caches.open(CACHE_NAME).then((cache) => updateCache(cache, request, response));
        })
        .catch(async () => {
          const cached = await caches.match(request);
          return cached || caches.match("/-frontend-agro/");
        })
    );
    return;
  }

  if (isStaticAssetRequest(request)) {
    event.respondWith(
      fetch(request, { cache: "no-store" })
        .then((response) => caches.open(CACHE_NAME).then((cache) => updateCache(cache, request, response)))
        .catch(async () => {
          const cached = await caches.match(request);
          if (cached) {
            return cached;
          }

          throw new Error("Static asset unavailable");
        })
    );
    return;
  }

  if (isCacheableSupportAssetRequest(request)) {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) {
          return cached;
        }

        return fetch(request).then((response) => caches.open(CACHE_NAME).then((cache) => updateCache(cache, request, response)));
      })
    );
    return;
  }

  event.respondWith(fetch(request).catch(() => caches.match(request)));
});
