// Service Worker for Gokseong AI Chatbot PWA

const CACHE_NAME = 'gokseong-chatbot-v1.1.0'; // 버전 업데이트
const urlsToCache = [
    './',
    './index.html',
    './css/style.css',
    './js/main.js',
    './js/utils.js',
    './manifest.json'
];

// Install event - cache core assets
self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => {
                console.log('Service Worker: Caching core assets');
                return cache.addAll(urlsToCache);
            })
    );
});

// Fetch event - handle network requests
self.addEventListener('fetch', event => {
    const { request } = event;
    const url = new URL(request.url);

    // For external APIs and CDNs, always go to the network.
    // This prevents caching issues with dynamic content or third-party libraries.
    if (url.hostname !== self.location.hostname) {
        event.respondWith(fetch(request));
        return;
    }

    // For local assets, use a cache-first strategy.
    event.respondWith(
        caches.match(request)
            .then(cachedResponse => {
                // Return from cache if found
                if (cachedResponse) {
                    return cachedResponse;
                }
                // Otherwise, fetch from network
                return fetch(request);
            })
    );
});

// Activate event - clean up old caches
self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys().then(cacheNames => {
            return Promise.all(
                cacheNames.map(cacheName => {
                    if (cacheName !== CACHE_NAME) {
                        console.log('Service Worker: Deleting old cache:', cacheName);
                        return caches.delete(cacheName);
                    }
                })
            );
        })
    );
});
