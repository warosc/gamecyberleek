const CACHE = 'leek-ops-v33';
const OFFLINE = '/offline.html';
const SHELL = ['/', '/manifest.webmanifest', OFFLINE];
self.addEventListener('install', (event) =>
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(SHELL)).then(() => self.skipWaiting())),
);
self.addEventListener('activate', (event) =>
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))),
      )
      .then(() => self.clients.claim()),
  ),
);
// Network first, so a deploy is picked up immediately; every successful response refreshes the
// cache, so a game that loaded once keeps working offline. A page request with neither network
// nor cache gets the offline page instead of the browser's error screen.
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        const copy = response.clone();
        caches.open(CACHE).then((cache) => cache.put(event.request, copy));
        return response;
      })
      .catch(() =>
        caches.match(event.request).then((cached) => {
          if (cached) return cached;
          if (event.request.mode === 'navigate') return caches.match('/').then((shell) => shell || caches.match(OFFLINE));
          return Response.error();
        }),
      ),
  );
});
