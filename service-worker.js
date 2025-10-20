const CACHE_NAME = "dolphin-cache-v2";
const urlsToCache = [
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

// Install service worker and cache essential files
self.addEventListener("install", (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(urlsToCache))
  );
});

// Activate and clean up old caches
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.map((k) => (k !== CACHE_NAME ? caches.delete(k) : null)))
    ).then(() => self.clients.claim())
  );
});

// Fetch handler: network-first for pages, cache-first for assets
self.addEventListener("fetch", (event) => {
  const req = event.request;

  // Handle navigation requests (HTML)
  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req).catch(() => caches.match("/index.html"))
    );
    return;
  }

  // Handle static assets
  event.respondWith(
    caches.match(req).then((res) => {
      if (res) return res;
      return fetch(req).then((netRes) => {
        // Cache valid responses
        if (
          netRes &&
          netRes.ok &&
          req.method === "GET" &&
          netRes.type !== "opaqueredirect"
        ) {
          const clone = netRes.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(req, clone));
        }
        return netRes;
      });
    })
  );
});
