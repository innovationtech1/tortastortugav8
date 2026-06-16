// sw.js — Service Worker para Tortas Tortuga PWA
const CACHE_NAME = 'tortuga-v2';
const ASSETS = [
    '/',
    '/index.html',
    '/ordenar.html',
    '/pages/admin.html',
    '/pages/auth.html',
    '/css/style.css',
    '/css/auth.css',
    '/js/app.js',
    '/js/menu.js',
    '/js/auth.js',
    '/js/firebase-config.js',
    '/js/script.js',
    '/manifest.json',
    '/icons/icon-192.png',
    '/icons/icon-512.png',
    '/icons/icon-apple.png',
    'https://fonts.googleapis.com/css2?family=Outfit:wght@400;600;800&display=swap'
];

self.addEventListener('install', (e) => {
    e.waitUntil(
        caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS))
    );
    self.skipWaiting();
});

self.addEventListener('activate', (e) => {
    e.waitUntil(
        caches.keys().then((keys) =>
            Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
        )
    );
    self.clients.claim();
});

self.addEventListener('fetch', (e) => {
    if (e.request.method !== 'GET') return;

    if (e.request.url.includes('openstreetmap') || e.request.url.includes('nominatim')) {
        e.respondWith(fetch(e.request).catch(() => new Response('', { status: 503 })));
        return;
    }

    e.respondWith(
        caches.match(e.request).then((cached) => {
            return cached || fetch(e.request).then((response) => {
                if (response && response.status === 200 && response.type !== 'opaque') {
                    const clone = response.clone();
                    caches.open(CACHE_NAME).then((cache) => cache.put(e.request, clone));
                }
                return response;
            });
        }).catch(() => {
            if (e.request.headers.get('accept').includes('text/html')) {
                return caches.match('/index.html');
            }
        })
    );
});
