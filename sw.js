// sw.js — Service Worker para Tortas Tortuga PWA
const CACHE_NAME = 'tortas-v1782712931';

// Solo cachear assets estáticos esenciales — NO las páginas HTML
// para evitar que el SW recargue la app y saque al usuario de su sesión
const STATIC_ASSETS = [
    '/tortastortugav8/icons/icon-192.png',
    '/tortastortugav8/icons/icon-512.png',
    '/tortastortugav8/manifest.json',
    'https://fonts.googleapis.com/css2?family=Outfit:wght@400;600;800&display=swap'
];

self.addEventListener('install', (e) => {
    e.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            // Cachear solo iconos y manifest — NO páginas HTML ni JS
            return cache.addAll(STATIC_ASSETS).catch(() => {
                // Si falla algún asset, continuar igual
                return Promise.resolve();
            });
        })
    );
    // NO usar skipWaiting() — evita que el SW tome control abruptamente
    // y recargue la página sacando al usuario de su sesión
});

self.addEventListener('activate', (e) => {
    e.waitUntil(
        caches.keys().then((keys) =>
            Promise.all(keys
                .filter(k => k !== CACHE_NAME)
                .map(k => caches.delete(k))
            )
        )
    );
    // NO usar clients.claim() — evita tomar control de páginas abiertas
});

self.addEventListener('fetch', (e) => {
    if (e.request.method !== 'GET') return;

    const url = e.request.url;

    // Nunca interceptar Firebase, Google APIs o páginas HTML
    // para no interferir con la autenticación ni la sesión
    if (
        url.includes('firebase') ||
        url.includes('google') ||
        url.includes('gstatic') ||
        url.includes('googleapis') ||
        url.includes('identitytoolkit') ||
        url.includes('securetoken') ||
        url.includes('firestore') ||
        e.request.headers.get('accept')?.includes('text/html')
    ) {
        // Ir directo a la red — no usar caché
        e.respondWith(fetch(e.request).catch(() => new Response('', { status: 503 })));
        return;
    }

    // Solo para assets estáticos (imágenes, iconos) usar caché
    if (url.includes('/icons/') || url.includes('/img/')) {
        e.respondWith(
            caches.match(e.request).then((cached) => {
                return cached || fetch(e.request).then((response) => {
                    if (response && response.status === 200) {
                        const clone = response.clone();
                        caches.open(CACHE_NAME).then((cache) => cache.put(e.request, clone));
                    }
                    return response;
                }).catch(() => new Response('', { status: 404 }));
            })
        );
        return;
    }

    // Todo lo demás (JS, CSS, HTML): siempre red primero
    e.respondWith(
        fetch(e.request).catch(() => caches.match(e.request))
    );
});
