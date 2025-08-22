// Service Worker for Gokseong AI Chatbot PWA

const CACHE_NAME = 'gokseong-chatbot-v1.0.2';

const urlsToCache = [
    './',
    './index.html',
    './style.css',
    './main.js',
    './utils.js',
    './rag-engine.js',
    './manifest.json'
];

// Install event - cache resources
self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => {
                console.log('Service Worker: Opened cache');
                return cache.addAll(urlsToCache);
            })
            .catch(error => {
                console.error('Service Worker: Cache add failed:', error);
            })
    );
});

// Fetch event - serve cached content when offline
self.addEventListener('fetch', event => {
    // API 요청은 캐시하지 않음
    if (event.request.url.includes('api.openai.com') || 
        event.request.url.includes('cdn.jsdelivr.net') ||
        event.request.url.includes('cdnjs.cloudflare.com') ||
        event.request.url.includes('fonts.googleapis.com')) {
        return;
    }

    event.respondWith(
        caches.match(event.request)
            .then(response => {
                // Return cached version or fetch from network
                return response || fetch(event.request);
            })
            .catch(error => {
                console.error('Service Worker: Fetch failed:', error);
                // 오프라인 시 기본 페이지 반환
                if (event.request.destination === 'document') {
                    return caches.match('./index.html');
                }
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

