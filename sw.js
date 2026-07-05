const CACHE_NAME = 'tortas-v1783284922';
const STATIC_ASSETS = [
  '/tortastortugav8/',
  '/tortastortugav8/index.html',
  '/tortastortugav8/ordenar.html',
  '/tortastortugav8/pages/admin.html',
  '/tortastortugav8/pages/cocina.html',
  '/tortastortugav8/pages/empleados.html',
  '/tortastortugav8/pages/auth.html',
  '/tortastortugav8/js/app.js',
  '/tortastortugav8/js/menu.js',
  '/tortastortugav8/manifest.json'
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE_NAME).then(c => c.addAll(STATIC_ASSETS)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  // Skip non-GET and Firebase requests
  if (e.request.method !== 'GET') return;
  if (url.hostname.includes('firebase') || url.hostname.includes('googleapis')) return;
  if (url.hostname.includes('stripe')) return;

  // HTML: Network-first (always fresh)
  if (e.request.headers.get('accept')?.includes('text/html') || url.pathname.endsWith('.html')) {
    e.respondWith(
      fetch(e.request).then(res => {
        if (res.ok) {
          const clone = res.clone();
          caches.open(CACHE_NAME).then(c => c.put(e.request, clone));
        }
        return res;
      }).catch(() => caches.match(e.request))
    );
    return;
  }

  // Assets: Cache-first (JS, CSS, images)
  e.respondWith(
    caches.match(e.request).then(cached => {
      if (cached) return cached;
      return fetch(e.request).then(res => {
        if (res.ok) {
          const clone = res.clone();
          caches.open(CACHE_NAME).then(c => c.put(e.request, clone));
        }
        return res;
      });
    })
  );
});
