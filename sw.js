const CACHE_NAME = 'fps-rice-register-v1.5.0';

const APP_SHELL = [
  './',
  './index.html',
  './manifest.json'
];

/* ============================================================
   INSTALL
   Cache the basic app files.
   ============================================================ */

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
  );
});


/* ============================================================
   ACTIVATE
   Remove old caches and take control immediately.
   ============================================================ */

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames
            .filter((name) => name !== CACHE_NAME)
            .map((name) => caches.delete(name))
        );
      })
      .then(() => self.clients.claim())
  );
});


/* ============================================================
   FETCH
   Offline-first strategy.
   
   IMPORTANT:
   Google Apps Script requests are NEVER cached.
   ============================================================ */

self.addEventListener('fetch', (event) => {

  const request = event.request;

  // Only handle GET requests.
  if (request.method !== 'GET') {
    return;
  }

  const url = new URL(request.url);

  // Never cache Google Apps Script / Googleusercontent API calls.
  if (
    url.hostname.includes('script.google.com') ||
    url.hostname.includes('googleusercontent.com')
  ) {
    return;
  }

  event.respondWith(

    caches.match(request)

      .then((cachedResponse) => {

        // Serve cached version immediately when available.
        if (cachedResponse) {
          return cachedResponse;
        }

        // Otherwise try the network.
        return fetch(request)

          .then((networkResponse) => {

            // Do not cache failed responses.
            if (
              !networkResponse ||
              !networkResponse.ok
            ) {
              return networkResponse;
            }

            // Save a copy for future offline use.
            const responseCopy =
              networkResponse.clone();

            caches.open(CACHE_NAME)
              .then((cache) => {
                cache.put(
                  request,
                  responseCopy
                ).catch(() => {});
              });

            return networkResponse;
          })

          .catch(() => {

            /*
             * If navigation fails while offline,
             * return the cached application shell.
             */

            if (request.mode === 'navigate') {
              return caches.match(
                './index.html'
              );
            }

            return Response.error();
          });
      })
  );
});


/* ============================================================
   BACKGROUND SYNC
   Ask any open app window to send pending IndexedDB records.
   ============================================================ */

self.addEventListener('sync', (event) => {

  if (
    event.tag !== 'fps-rice-sync'
  ) {
    return;
  }

  event.waitUntil(

    self.clients.matchAll({
      type: 'window',
      includeUncontrolled: true
    })

    .then((clients) => {

      return Promise.all(

        clients.map((client) => {

          return client.postMessage({
            type: 'SYNC_NOW'
          });

        })

      );

    })

  );

});


/* ============================================================
   MESSAGE HANDLER
   Allows the page to tell the service worker to update.
   ============================================================ */

self.addEventListener('message', (event) => {

  if (!event.data) {
    return;
  }

  if (
    event.data.type === 'SKIP_WAITING'
  ) {

    self.skipWaiting();

  }

});