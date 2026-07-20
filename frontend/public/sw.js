/* Aasrah service worker: app-shell caching and web push.

   Note: there is no offline submission queue. Anything submitted without a
   connection is NOT saved — do not add a "will sync later" promise to the UI
   unless a real IndexedDB queue is implemented behind it. */
const CACHE = "aasrah-v2";
const APP_SHELL = ["/", "/offline"];

/* Never cache signed-in pages. The cache is origin-scoped and shared across
   accounts, so on a shared field device the next user would be served the
   previous user's portal/admin shell. */
const PRIVATE_PREFIXES = ["/portal", "/admin", "/volunteer-portal"];
const isPrivate = (pathname) =>
  PRIVATE_PREFIXES.some((p) => pathname === p || pathname.startsWith(p + "/"));

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((c) => c.addAll(APP_SHELL)).catch(() => {}));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))),
  );
  self.clients.claim();
});

// Network-first for navigations (fall back to cache/offline page); cache-first
// for static assets. API calls (/api) always go to the network.
self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  if (request.method !== "GET" || url.pathname.startsWith("/api")) return;

  if (request.mode === "navigate") {
    if (isPrivate(url.pathname)) {
      // Authenticated shell: network-only, and fall back to the generic
      // offline page rather than a cached copy of someone's dashboard.
      event.respondWith(fetch(request).catch(() => caches.match("/offline")));
      return;
    }
    event.respondWith(
      fetch(request)
        .then((resp) => {
          const copy = resp.clone();
          caches.open(CACHE).then((c) => c.put(request, copy)).catch(() => {});
          return resp;
        })
        .catch(() => caches.match(request).then((r) => r || caches.match("/offline"))),
    );
    return;
  }

  event.respondWith(
    caches.match(request).then((cached) => cached || fetch(request)),
  );
});

// Web push: show a notification from the pushed payload.
self.addEventListener("push", (event) => {
  let data = { title: "Aasrah", body: "" };
  try {
    if (event.data) data = event.data.json();
  } catch (_e) {
    /* ignore */
  }
  event.waitUntil(
    self.registration.showNotification(data.title || "Aasrah", {
      body: data.body || "",
      icon: "/icon-192.png",
      badge: "/icon-192.png",
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(self.clients.openWindow("/"));
});

// No "sync" handler: nothing registers the tag and there is no queue to flush.
// A handler here previously implied an offline-submission feature that does
// not exist. Reinstate it together with a real IndexedDB queue, not before.
