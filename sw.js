// Service Worker — NETWORK FIRST para HTML/JS/CSS (nunca sirve código viejo)
const CACHE_NAME = 'tortas-v1787366666';

self.addEventListener('install', e => {
  // Activar de inmediato la nueva versión, sin esperar
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);

  // HTML / JS / CSS → SIEMPRE red fresca (network first).
  // Si no hay red, recién ahí usar caché como respaldo.
  if (url.pathname.endsWith('.html') || url.pathname.endsWith('.js') ||
      url.pathname.endsWith('.css') || url.pathname === '/' ||
      url.pathname.endsWith('/')) {
    e.respondWith(
      fetch(e.request)
        .then(resp => {
          // Guardar copia fresca por si luego no hay red
          const copia = resp.clone();
          caches.open(CACHE_NAME).then(c => c.put(e.request, copia)).catch(()=>{});
          return resp;
        })
        .catch(() => caches.match(e.request))
    );
    return;
  }

  // Firebase / Google → siempre red directa
  if (url.hostname.includes('firebase') || url.hostname.includes('googleapis') || url.hostname.includes('gstatic')) {
    return;
  }

  // Imágenes y demás → cache first (rápido)
  e.respondWith(
    caches.match(e.request).then(c => c || fetch(e.request))
  );
});
