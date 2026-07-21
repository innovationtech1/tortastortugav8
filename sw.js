// Service Worker — NETWORK ONLY para HTML/JS (sin caché de código)
const CACHE_NAME = 'tortas-v1784600791';

self.addEventListener('install', e => { self.skipWaiting(); });

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys => Promise.all(keys.map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  // NUNCA cachear HTML, JS, CSS — siempre red fresca
  if (url.pathname.endsWith('.html') || url.pathname.endsWith('.js') ||
      url.pathname.endsWith('.css') || url.pathname === '/' ||
      url.pathname.endsWith('/ordenar.html')) {
    e.respondWith(fetch(e.request).catch(() => caches.match(e.request)));
    return;
  }
  // Firebase — siempre red
  if (url.hostname.includes('firebase') || url.hostname.includes('googleapis') || url.hostname.includes('gstatic')) {
    return;
  }
  // Imágenes — cache first
  e.respondWith(
    caches.match(e.request).then(c => c || fetch(e.request))
  );
});
