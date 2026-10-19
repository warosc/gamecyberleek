// The build replaces the marker below with "<package version>-<git sha>-<build time>" (see
// stampServiceWorker in vite.config.ts), so every deploy gets a fresh cache and drops the old one
// in 'activate'. The name used to be a hand-bumped literal, and a forgotten bump kept serving the
// previous deploy's cached files.
const CACHE = 'leek-ops-__LEEK_BUILD__';
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
// Only a complete, same-origin 200 is worth keeping. A 404/503 served mid-deploy would otherwise
// overwrite a good entry and be replayed offline; a 206 (audio range request) makes cache.put
// reject; an opaque or redirected response has no usable status at all.
const cacheable = (response) => response.status === 200 && response.type === 'basic';
// Network first, so a deploy is picked up immediately; every successful response refreshes the
// cache, so a game that loaded once keeps working offline. A page request with neither network
// nor cache gets the offline page instead of the browser's error screen.
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  // Cross-origin requests (the Supabase backend, extension schemes) go to the network untouched:
  // a cached leaderboard or cloud save replayed offline shows "top today" and cloud-ahead
  // notices that are no longer true.
  if (new URL(event.request.url).origin !== self.location.origin) return;
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        if (cacheable(response)) {
          const copy = response.clone();
          // A failed write (quota, storage evicted) only costs offline coverage; uncaught it
          // surfaces as an unhandled rejection in the worker.
          caches
            .open(CACHE)
            .then((cache) => cache.put(event.request, copy))
            .catch(() => {});
        }
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
