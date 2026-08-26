// Service Worker — STALE-WHILE-REVALIDATE
// Sirve la página AL INSTANTE desde caché (navegación rápida, sin recarga visible)
// y en segundo plano descarga la versión nueva para la próxima vez.
const CACHE_NAME = 'tortas-swr-v1787711158';

self.addEventListener('install', e => {
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        // Borrar cachés viejos que no sean el actual
        keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);

  // Solo manejar peticiones GET
  if (e.request.method !== 'GET') return;

  // Firebase / Google → siempre red directa (datos en vivo, nunca cachear)
  if (url.hostname.includes('firebase') || url.hostname.includes('googleapis') ||
      url.hostname.includes('gstatic') || url.hostname.includes('firestore')) {
    return;
  }

  // HTML / JS / CSS / imágenes → STALE-WHILE-REVALIDATE
  // 1. Responde de inmediato con la copia en caché (si existe) = navegación instantánea
  // 2. En paralelo, descarga la versión nueva y la guarda para la próxima
  const esNavegable = url.pathname.endsWith('.html') || url.pathname.endsWith('.js') ||
                      url.pathname.endsWith('.css') || url.pathname === '/' ||
                      url.pathname.endsWith('/') || url.pathname.endsWith('.png') ||
                      url.pathname.endsWith('.jpg') || url.pathname.endsWith('.jpeg') ||
                      url.pathname.endsWith('.svg') || url.pathname.endsWith('.webp') ||
                      url.pathname.endsWith('.ico');

  if (esNavegable) {
    e.respondWith(
      caches.open(CACHE_NAME).then(cache =>
        cache.match(e.request).then(cached => {
          // Descargar versión nueva en segundo plano
          const fetchPromise = fetch(e.request).then(resp => {
            if (resp && resp.status === 200) {
              cache.put(e.request, resp.clone()).catch(()=>{});
            }
            return resp;
          }).catch(() => cached); // si no hay red, usar caché

          // Responder YA con el caché si existe; si no, esperar la red
          return cached || fetchPromise;
        })
      )
    );
    return;
  }

  // Todo lo demás → red normal con respaldo de caché
  e.respondWith(
    fetch(e.request).catch(() => caches.match(e.request))
  );
});
