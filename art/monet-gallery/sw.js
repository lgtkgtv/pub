// Service Worker for L'Impressionnisme Vivant
const CACHE_NAME = 'monet-gallery-v24';

const CORE_PRECACHE_URLS = [
  './',
  'index.html',
  'styles.css?v=24',
  'config.js?v=24',
  'app.js?v=24',
  'data.js?v=24',
  'data.json?v=24',
  'jszip.min.js',
  'manifest.json',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'icons/icon.svg'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(CORE_PRECACHE_URLS).catch((err) => {
        console.warn('Some precache assets could not be cached immediately:', err);
      });
    }).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((name) => {
          if (name !== CACHE_NAME) {
            console.log(`[SW] Deleting obsolete cache: ${name}`);
            return caches.delete(name);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  const url = new URL(request.url);

  // Ignore non-GET requests and cross-origin YouTube iframe calls
  if (request.method !== 'GET' || !url.protocol.startsWith('http')) return;
  if (
    url.origin.includes('youtube.com') ||
    url.origin.includes('youtube-nocookie.com') ||
    url.origin.includes('googlevideo.com') ||
    url.origin.includes('i.ytimg.com')
  ) {
    return;
  }

  // Strategy 1: Cache-First with runtime caching for images and audio
  if (
    request.destination === 'image' ||
    request.destination === 'audio' ||
    url.pathname.endsWith('.jpg') ||
    url.pathname.endsWith('.png') ||
    url.pathname.endsWith('.mp3') ||
    url.pathname.endsWith('.svg')
  ) {
    event.respondWith(
      caches.match(request).then((cachedResponse) => {
        if (cachedResponse) {
          return cachedResponse;
        }
        return fetch(request).then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const responseClone = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(request, responseClone);
            });
          }
          return networkResponse;
        }).catch(() => cachedResponse);
      })
    );
    return;
  }

  // Strategy 2: Network-First with Cache fallback for HTML, JS, CSS, JSON
  event.respondWith(
    fetch(request)
      .then((networkResponse) => {
        if (networkResponse && networkResponse.status === 200) {
          const responseClone = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(request, responseClone);
          });
        }
        return networkResponse;
      })
      .catch(() => {
        return caches.match(request, { ignoreSearch: true }).then((cachedResponse) => {
          if (cachedResponse) {
            return cachedResponse;
          }
          if (request.mode === 'navigate') {
            return caches.match('./index.html') || caches.match('index.html');
          }
        });
      })
  );
});
