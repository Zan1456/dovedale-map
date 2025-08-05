
const CACHE_NAME = 'dovedale-map-cache-v1';
const urlsToCache = [
  '/',
  '/index.html',
  '/index.js',
  '/Inter.woff2',
  '/images/map-small.png',
  '/images/row-1-column-1.png',
  '/images/row-1-column-2.png',
  '/images/row-1-column-3.png',
  '/images/row-1-column-4.png',
  '/images/row-1-column-5.png',
  '/images/row-1-column-6.png',
  '/images/row-1-column-7.png',
  '/images/row-1-column-8.png',
  '/images/row-1-column-9.png',
  '/images/row-1-column-10.png',
  '/images/row-1-column-11.png',
  '/images/row-1-column-12.png',
  '/images/row-1-column-13.png',
  '/images/row-1-column-14.png',
  '/images/row-1-column-15.png',
  '/images/row-1-column-16.png'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Opened cache');
        return cache.addAll(urlsToCache);
      })
  );
});

self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        if (response) {
          return response;
        }
        return fetch(event.request);
      })
  );
});
