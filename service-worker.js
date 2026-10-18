const CACHE_NAME = "elim-cafe-printer-v9";
const APP_SHELL = [
  "./",
  "index.html",
  "staff.html",
  "css/styles.css?v=20261018-2",
  "js/supabase-config.js",
  "js/menu.js?v=20261009",
  "js/i18n.js?v=20261009-2",
  "js/customer.js?v=20261009-2",
  "js/receipt.js?v=20261018-2",
  "js/printer-bridge.js?v=20261018",
  "js/printer-test.js?v=20261018",
  "js/staff.js?v=20261018-2",
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
    const fallbackPage = requestUrl.pathname.endsWith("/staff.html")
      ? "staff.html"
      : "index.html";

    event.respondWith(
      fetch(event.request).catch(() => caches.match(fallbackPage))
    );
    return;
  }

  event.respondWith(
    fetch(event.request).catch(() => caches.match(event.request))
  );
});
