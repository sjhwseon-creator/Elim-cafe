const CACHE_NAME = "elim-cafe-i18n-v6";
const APP_SHELL = [
  "./",
  "index.html",
  "staff.html",
  "css/styles.css?v=20261009-2",
  "js/supabase-config.js",
  "js/menu.js?v=20261009",
  "js/i18n.js?v=20261009-2",
  "js/customer.js?v=20261009-2",
  "js/receipt.js",
  "js/printer-bridge.js",
  "js/printer-test.js",
  "js/staff.js?v=20261009",
  "manifest.json",
  "icons/elim-icon.svg",
  "icons/elim-maskable.svg"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;

  const requestUrl = new URL(event.request.url);
  if (requestUrl.origin !== self.location.origin) return;

  if (event.request.mode === "navigate") {
    event.respondWith(
      fetch(event.request).catch(() => caches.match("index.html"))
    );
    return;
  }

  event.respondWith(
    fetch(event.request).catch(() => caches.match(event.request))
  );
});
