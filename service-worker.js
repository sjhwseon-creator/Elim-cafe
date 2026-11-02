const CACHE_NAME = "elim-cafe-staff-upgrade-v14";
const APP_SHELL = [
  "./",
  "index.html",
  "staff.html",
  "css/styles.css?v=20261104",
  "js/supabase-config.js?v=20261025",
  "js/menu.js?v=20261009",
  "js/notification-config.js?v=20261102",
  "js/i18n.js?v=20261103",
  "js/customer.js?v=20261103",
  "js/receipt.js?v=20261104",
  "js/printer-bridge.js?v=20261018",
  "js/printer-test.js?v=20261018",
  "js/staff.js?v=20261104",
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

self.addEventListener("push", (event) => {
  event.waitUntil((async () => {
    let payload = {};
    try {
      payload = event.data?.json() || {};
    } catch (error) {
      console.error("Could not parse order-ready push payload:", error);
    }

    const openClients = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    const visibleClient = openClients.find((client) => client.visibilityState === "visible");
    if (visibleClient) {
      visibleClient.postMessage({ type: "ORDER_READY", payload });
      return;
    }

    const title = payload.title || "Elim Café";
    await self.registration.showNotification(title, {
      body: payload.body || "Your order is ready!",
      icon: "icons/elim-icon.svg",
      badge: "icons/elim-icon.svg",
      tag: `elim-order-ready-${payload.orderId || payload.orderNumber || "order"}`,
      renotify: false,
      data: {
        url: payload.url || "./index.html",
        orderId: payload.orderId,
        orderNumber: payload.orderNumber
      }
    });
  })());
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil((async () => {
    const targetUrl = new URL(event.notification.data?.url || "./index.html", self.registration.scope).href;
    const openClients = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    const existingClient = openClients.find((client) => client.url.startsWith(self.registration.scope));

    if (existingClient) {
      if ("navigate" in existingClient) await existingClient.navigate(targetUrl);
      existingClient.postMessage({
        type: "ORDER_READY",
        payload: {
          orderId: event.notification.data?.orderId,
          orderNumber: event.notification.data?.orderNumber
        }
      });
      return existingClient.focus();
    }

    return self.clients.openWindow(targetUrl);
  })());
});
