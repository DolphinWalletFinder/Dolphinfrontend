// Safe, production-friendly SW: ignore APIs & non-GET, cache app shell only
const CACHE_NAME = "dolphin-cache-v3"; // bump version on each SW change
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
  self.skipWaiting();
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.map((k) => (k === CACHE_NAME ? null : caches.delete(k)))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  const url = new URL(req.url);

  // 0) Never touch non-GET (POST/PUT/PATCH/DELETE, beacons, etc.)
  if (req.method !== "GET") {
    event.respondWith(fetch(req).catch(() => new Response(null, { status: 502 })));
    return;
  }

  // 1) Bypass cross-origin requests (CDNs, APIs on other domains) to avoid polluting cache
  if (url.origin !== self.location.origin) {
    event.respondWith(fetch(req).catch(() => new Response(null, { status: 503 })));
    return;
  }

  // 2) Bypass API endpoints on same origin (/api/...) — always network
  if (url.pathname.startsWith("/api/")) {
    event.respondWith(
      fetch(req).catch(
        () =>
          new Response(JSON.stringify({ error: "offline" }), {
            status: 503,
            headers: { "Content-Type": "application/json" },
          })
      )
    );
    return;
  }

  // 3) Navigations (HTML): network-first, then cache, fallback to /index.html
  const isHTMLNavigation = req.mode === "navigate" || (req.headers.get("accept") || "").includes("text/html");

  if (isHTMLNavigation) {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const clone = res.clone();
          caches.open(CACHE_NAME).then((c) => c.put(req, clone)).catch(() => {});
          return res;
        })
        .catch(async () => {
          const cached = await caches.match(req);
          if (cached) return cached;
          return caches.match("/index.html");
        })
    );
    return;
  }

  // 4) Static assets: cache-first
  event.respondWith(
    caches.match(req).then((cached) => {
      if (cached) return cached;
      return fetch(req)
        .then((res) => {
          if (res && res.ok && res.type === "basic") {
            const clone = res.clone();
            caches.open(CACHE_NAME).then((c) => c.put(req, clone)).catch(() => {});
          }
          return res;
        })
        .catch(() => cached || new Response(null, { status: 504 }));
    })
  );
});
