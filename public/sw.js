/* Drywall Toolbox Service Worker */
const CACHE_VERSION = 'v1';
const CACHE_NAME = `drywall-toolbox-${CACHE_VERSION}`;

/* Assets to pre-cache on install */
const PRECACHE_ASSETS = [
  '/drywall-toolbox/',
  '/drywall-toolbox/index.html',
  '/drywall-toolbox/manifest.json',
  '/drywall-toolbox/logo.svg',
  '/drywall-toolbox/logo2.svg',
  '/drywall-toolbox/icons/icon-192x192.png',
  '/drywall-toolbox/icons/icon-512x512.png',
];

/* ── Install: pre-cache shell assets ───────────────────────────────────── */
self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE_ASSETS))
  );
});

/* ── Activate: delete old caches ────────────────────────────────────────── */
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key.startsWith('drywall-toolbox-') && key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      )
    ).then(() => self.clients.claim())
  );
});

/* ── Fetch: network-first for navigation, cache-first for assets ─────────── */
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  /* Skip non-GET and cross-origin requests */
  if (request.method !== 'GET' || url.origin !== self.location.origin) {
    return;
  }

  /* Navigation requests: network-first with offline fallback */
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          return response;
        })
        .catch(() =>
          caches.match('/drywall-toolbox/index.html').then(
            (cached) => cached || new Response('Offline', { status: 503 })
          )
        )
    );
    return;
  }

  /* Static assets (images, fonts, icons): cache-first */
  if (
    url.pathname.match(/\.(png|jpg|jpeg|webp|svg|gif|ico|woff2?|ttf|otf|eot)$/)
  ) {
    event.respondWith(
      caches.match(request).then(
        (cached) =>
          cached ||
          fetch(request).then((response) => {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
            return response;
          })
      )
    );
    return;
  }

  /* JS/CSS bundles: network-first (always get latest code) */
  if (url.pathname.match(/\.(js|css)$/)) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          return response;
        })
        .catch(() => caches.match(request))
    );
    return;
  }
});
