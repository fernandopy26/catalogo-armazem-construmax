const APP_VERSION = "2026-05-28-balanced-wood-bg";
const CACHE_PREFIX = "catalogo";

const STATIC_CACHE = `${CACHE_PREFIX}-static-${APP_VERSION}`;
const RUNTIME_CACHE = `${CACHE_PREFIX}-runtime-${APP_VERSION}`;
const IMAGE_CACHE = `${CACHE_PREFIX}-images-${APP_VERSION}`;
const FONT_CACHE = `${CACHE_PREFIX}-fonts-${APP_VERSION}`;

const OFFLINE_URL = "/offline.html";
const CORE_ASSETS = [
  "/",
  "/index.html",
  "/style.css",
  "/app.js",
  "/analytics.js",
  "/config/firebase.js",
  "/manifest.json",
  "/favicon.ico",
  OFFLINE_URL
];

const FONT_HOSTS = new Set(["fonts.googleapis.com", "fonts.gstatic.com"]);
const CDN_STATIC_HOSTS = new Set(["www.gstatic.com"]);
const MAX_RUNTIME_ENTRIES = 60;
const MAX_IMAGE_ENTRIES = 140;

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then((cache) => Promise.allSettled(
        CORE_ASSETS.map((url) => cache.add(new Request(url, { cache: "reload" })))
      ))
      .catch(() => {})
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys
          .filter((key) => key.startsWith(`${CACHE_PREFIX}-`) && ![
            STATIC_CACHE,
            RUNTIME_CACHE,
            IMAGE_CACHE,
            FONT_CACHE
          ].includes(key))
          .map((key) => caches.delete(key))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("message", (event) => {
  const data = event.data || {};

  if (data.type === "SKIP_WAITING") {
    self.skipWaiting();
    return;
  }

  if (data.type === "CACHE_URLS" && Array.isArray(data.urls)) {
    event.waitUntil(cacheUrls(data.urls.slice(0, 120)));
  }
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);

  if (request.mode === "navigate") {
    event.respondWith(networkFirstDocument(request));
    return;
  }

  if (FONT_HOSTS.has(url.hostname)) {
    event.respondWith(cacheFirst(request, FONT_CACHE, MAX_RUNTIME_ENTRIES));
    return;
  }

  if (CDN_STATIC_HOSTS.has(url.hostname) && ["script", "worker"].includes(request.destination)) {
    event.respondWith(staleWhileRevalidate(request, STATIC_CACHE));
    return;
  }

  if (request.destination === "image") {
    event.respondWith(cacheFirst(request, IMAGE_CACHE, MAX_IMAGE_ENTRIES));
    return;
  }

  if (url.origin === self.location.origin && isStaticAsset(request)) {
    event.respondWith(staleWhileRevalidate(request, STATIC_CACHE));
    return;
  }

  if (url.origin === self.location.origin) {
    event.respondWith(networkFirst(request, RUNTIME_CACHE, MAX_RUNTIME_ENTRIES));
  }
});

function isStaticAsset(request) {
  return ["style", "script", "worker", "manifest"].includes(request.destination) ||
    /\.(?:css|js|json|ico|webmanifest|svg|png|jpg|jpeg|webp|avif)$/i.test(new URL(request.url).pathname);
}

async function networkFirstDocument(request) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(RUNTIME_CACHE);
      cache.put(request, response.clone()).catch(() => {});
    }
    return response;
  } catch {
    return (await caches.match(request)) ||
      (await caches.match(OFFLINE_URL)) ||
      (await caches.match("/index.html")) ||
      Response.error();
  }
}

async function networkFirst(request, cacheName, maxEntries) {
  const cache = await caches.open(cacheName);

  try {
    const response = await fetch(request);
    if (podeCachear(response)) {
      cache.put(request, response.clone()).then(() => limitarCache(cacheName, maxEntries)).catch(() => {});
    }
    return response;
  } catch {
    return (await cache.match(request)) || Response.error();
  }
}

async function staleWhileRevalidate(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);

  const atualizar = fetch(request)
    .then((response) => {
      if (podeCachear(response)) {
        cache.put(request, response.clone()).catch(() => {});
      }
      return response;
    })
    .catch(() => cached);

  return cached || atualizar;
}

async function cacheFirst(request, cacheName, maxEntries) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  if (cached) return cached;

  const response = await fetch(request);
  if (podeCachear(response)) {
    cache.put(request, response.clone()).then(() => limitarCache(cacheName, maxEntries)).catch(() => {});
  }
  return response;
}

function podeCachear(response) {
  return response && (response.ok || response.type === "opaque");
}

async function cacheUrls(urls) {
  const cache = await caches.open(IMAGE_CACHE);

  await Promise.allSettled(urls
    .filter((url) => typeof url === "string" && /^https?:\/\//.test(url))
    .map(async (url) => {
      const request = new Request(url, { mode: "no-cors", credentials: "omit" });
      const cached = await cache.match(request);
      if (cached) return;

      const response = await fetch(request);
      if (podeCachear(response)) {
        await cache.put(request, response);
      }
    }));

  await limitarCache(IMAGE_CACHE, MAX_IMAGE_ENTRIES);
}

async function limitarCache(cacheName, maxEntries) {
  if (!maxEntries) return;

  const cache = await caches.open(cacheName);
  const keys = await cache.keys();
  const excesso = keys.length - maxEntries;

  if (excesso <= 0) return;

  await Promise.all(keys.slice(0, excesso).map((key) => cache.delete(key)));
}
