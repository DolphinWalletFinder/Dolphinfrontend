// service-worker.js

const CACHE_NAME = "dolphin-cache-v4";
const APP_SHELL = [
  "/",
  "/index.html",
  "/pages/login.html",
  "/pages/profile.html",
  "/pages/license.html",
  "/pages/results.html",
  "/pages/scan.html",
  "/pages/success.html",
  "/pages/transaction.html",
  "/assets/style-neon.css",
  "/assets/wallets.js",
  "/js/login-api.js"
];

self.addEventListener("install", (event) => {
  // activate new SW immediately
  self.skipWaiting();
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    // Use allSettled so one missing file doesn’t break the whole install
    await Promise.allSettled(
      APP_SHELL.map((p) =>
        cache.add(new Request(p, { cache: "reload", credentials: "same-origin" }))
      )
    );
  })());
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(
      keys.map((k) => (k === CACHE_NAME ? null : caches.delete(k)))
    );
    // Navigation preload makes navigations respond sooner by starting network early
    if (self.registration.navigationPreload) {
      try { await self.registration.navigationPreload.enable(); } catch (_) {}
    }
    await self.clients.claim();
  })());
});

// ----- FETCH: only handle same-origin GETs that are NOT /api/*
self.addEventListener("fetch", (event) => {
  const req = event.request;
  const url = new URL(req.url);

  // 0) Never handle non-GET (POST/PUT/PATCH/DELETE/beacon, etc.)
  if (req.method !== "GET") return;

  // 1) Skip cross-origin (CDNs, Google Fonts, 3rd party APIs)
  if (url.origin !== self.location.origin) return;

  // 2) Skip same-origin API (e.g., /api/*) so they always hit the network
  if (url.pathname.startsWith("/api/")) return;

  // 3) Navigations: network-first with fallback to cache and /index.html
  const isHTMLNavigation =
    req.mode === "navigate" ||
    (req.headers.get("accept") || "").includes("text/html");

  if (isHTMLNavigation) {
    event.respondWith((async () => {
      // Try preloaded response first (if navigation preload is on)
      try {
        const preloaded = await event.preloadResponse;
        if (preloaded) {
          const cache = await caches.open(CACHE_NAME);
          cache.put(req, preloaded.clone()).catch(() => {});
          return preloaded;
        }
      } catch (_) {}

      // Try network
      try {
        const netRes = await fetch(req);
        const cache = await caches.open(CACHE_NAME);
        cache.put(req, netRes.clone()).catch(() => {});
        return netRes;
      } catch (_) {
        // Offline: try cache (ignore query string), then fallback to /
        const cached = await caches.match(req, { ignoreSearch: true });
        if (cached) return cached;
        const root = await caches.match("/index.html");
        return root || new Response("Offline", { status: 503, statusText: "Offline" });
      }
    })());
    return;
  }

  // 4) Static assets: cache-first, then network, then cached-or-504
  event.respondWith((async () => {
    const cached = await caches.match(req, { ignoreSearch: true });
    if (cached) return cached;

    try {
      const res = await fetch(req);
      // Only cache same-origin "basic" responses
      if (res && res.ok && res.type === "basic") {
        const c = await caches.open(CACHE_NAME);
        c.put(req, res.clone()).catch(() => {});
      }
      return res;
    } catch (_) {
      // If previously cached, return it; otherwise, a controlled error
      return cached || new Response(null, { status: 504, statusText: "Gateway Timeout" });
    }
  })());
});
