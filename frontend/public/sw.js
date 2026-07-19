/* Aasrah service worker: app-shell caching, push, background sync. */
const CACHE = "aasrah-v1";
const APP_SHELL = ["/", "/offline"];

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

// Background sync hook for queued volunteer updates (see offline-queue.ts).
self.addEventListener("sync", (event) => {
  if (event.tag === "aasrah-sync") {
    event.waitUntil(
      self.clients.matchAll().then((clients) => {
        clients.forEach((c) => c.postMessage({ type: "flush-queue" }));
      }),
    );
  }
});
