// Service Worker for Gokseong AI Chatbot PWA (Cloudflare 최적화)

const CACHE_NAME = 'gokseong-chatbot-v1.1.0';

const urlsToCache = [
    './',
    './index.html',
    './main.js',
    './utils.js',
    './manifest.json'
];

// RAG 엔진은 조건부로 캐시
const conditionalCache = [
    './rag-engine.js'
];

// Install event - cache resources
self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => {
                console.log('Service Worker: Opened cache');
                
                // 기본 파일들 캐시
                const basicCachePromise = cache.addAll(urlsToCache);
                
                // 조건부 파일들 캐시 (실패해도 설치는 계속)
                const conditionalCachePromise = Promise.allSettled(
                    conditionalCache.map(url => cache.add(url))
                );
                
                return Promise.all([basicCachePromise, conditionalCachePromise]);
            })
            .catch(error => {
                console.error('Service Worker: Cache add failed:', error);
            })
    );
    
    // 즉시 활성화
    self.skipWaiting();
});

// Fetch event - serve cached content when offline
self.addEventListener('fetch', event => {
    const requestUrl = new URL(event.request.url);
    
    // API 요청은 캐시하지 않음
    if (requestUrl.hostname.includes('api.openai.com') ||
        requestUrl.hostname.includes('cdn.jsdelivr.net') ||
        requestUrl.hostname.includes('cdnjs.cloudflare.com') ||
        requestUrl.hostname.includes('fonts.googleapis.com') ||
        requestUrl.hostname.includes('fonts.gstatic.com') ||
        requestUrl.hostname.includes('cdn.tailwindcss.com')) {
        
        // 네트워크 우선, 캐시 폴백 전략
        event.respondWith(
            fetch(event.request).catch(() => {
                // 네트워크 실패 시 기본 응답
                if (event.request.destination === 'document') {
                    return caches.match('./index.html');
                }
                return new Response('오프라인 상태입니다.', {
                    status: 503,
                    statusText: 'Service Unavailable'
                });
            })
        );
        return;
    }
    
    // 로컬 파일들에 대한 캐시 전략
    event.respondWith(
        caches.match(event.request)
            .then(response => {
                // 캐시에서 발견되면 반환, 아니면 네트워크에서 가져오기
                if (response) {
                    return response;
                }
                
                return fetch(event.request).then(fetchResponse => {
                    // 유효한 응답인지 확인
                    if (!fetchResponse || fetchResponse.status !== 200 || fetchResponse.type !== 'basic') {
                        return fetchResponse;
                    }
                    
                    // 응답을 복제하여 캐시에 저장
                    const responseToCache = fetchResponse.clone();
                    caches.open(CACHE_NAME).then(cache => {
                        cache.put(event.request, responseToCache);
                    });
                    
                    return fetchResponse;
                });
            })
            .catch(error => {
                console.error('Service Worker: Fetch failed:', error);
                
                // 오프라인 시 기본 페이지 반환
                if (event.request.destination === 'document') {
                    return caches.match('./index.html');
                }
                
                return new Response('리소스를 로드할 수 없습니다.', {
                    status: 404,
                    statusText: 'Not Found'
                });
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
        }).then(() => {
            // 즉시 클라이언트 제어
            return self.clients.claim();
        })
    );
});

// 메시지 이벤트 처리
self.addEventListener('message', event => {
    if (event.data && event.data.type === 'SKIP_WAITING') {
        self.skipWaiting();
    }
});

// 백그라운드 동기화 (선택적)
self.addEventListener('sync', event => {
    if (event.tag === 'background-sync') {
        console.log('Service Worker: Background sync triggered');
    }
});

// 푸시 알림 (향후 기능)
self.addEventListener('push', event => {
    if (event.data) {
        const data = event.data.json();
        const options = {
            body: data.body,
            icon: './icon-192.png',
            badge: './badge-72.png',
            tag: 'gokseong-notification'
        };
        
        event.waitUntil(
            self.registration.showNotification(data.title, options)
        );
    }
});


