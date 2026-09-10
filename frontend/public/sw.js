// Bumped from v1 so activate() below drops the old cache on every browser that still
// holds it - v1 had frozen an index.html from an earlier build and served it forever.
const CACHE_NAME = "wiser-core-v2";

// Only files whose names do not change between builds. index.html is deliberately not
// here: it is cached by the fetch handler below, and only after the network has spoken.
const ASSETS = [
  "/favicon.svg",
  "/icons.svg"
];

self.addEventListener("install", (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS);
    }).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  if (e.request.method !== "GET") return;

  // Navigations go to the network first; the cache is the offline fallback, never the
  // default answer. Cache-first on index.html is what took the site down: index.html is
  // the only thing pointing at the hashed /assets/index-<hash>.js, so a copy frozen in
  // v1 kept asking for a bundle that no later deploy had. nginx answered that missing
  // path with index.html (try_files), the browser got a module with MIME text/html,
  // refused to execute it, and rendered nothing - with no server-side error anywhere and
  // no way for the visitor to clear it, since the service worker outranks browser cache.
  if (e.request.mode === "navigate") {
    e.respondWith(
      fetch(e.request).then((networkResponse) => {
        const copy = networkResponse.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put("/index.html", copy));
        return networkResponse;
      }).catch(() => {
        return caches.match("/index.html").then((cached) => cached || Response.error());
      })
    );
    return;
  }

  e.respondWith(
    caches.match(e.request).then((cachedResponse) => {
      if (cachedResponse) {
        return cachedResponse;
      }
      return fetch(e.request);
    })
  );
});
