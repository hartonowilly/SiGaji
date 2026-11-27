/* SiGaji — SW: pasang PWA + halaman cadangan offline (data gaji tidak di-cache). */
var SIGAJI_OFFLINE_CACHE = 'sigaji-offline-v2';
var SIGAJI_OFFLINE_URLS = ['/offline.html', '/js/offline-retry.js'];

self.addEventListener('install', function (e) {
  e.waitUntil(
    caches.open(SIGAJI_OFFLINE_CACHE).then(function (c) {
      return c.addAll(SIGAJI_OFFLINE_URLS);
    }).then(function () {
      return self.skipWaiting();
    })
  );
});
self.addEventListener('activate', function (e) {
  e.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(
        keys.filter(function (k) {
          return k.indexOf('sigaji-offline-') === 0 && k !== SIGAJI_OFFLINE_CACHE;
        }).map(function (k) {
          return caches.delete(k);
        })
      );
    }).then(function () {
      return self.clients.claim();
    })
  );
});
self.addEventListener('fetch', function (e) {
  if (e.request.method !== 'GET') return;
  if (e.request.mode === 'navigate') {
    e.respondWith(
      fetch(e.request).catch(function () {
        return caches.match('/offline.html').then(function (r) {
          return r || new Response('Tidak ada koneksi', { status: 503, headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
        });
      })
    );
    return;
  }
  var path = new URL(e.request.url).pathname;
  if (path === '/js/offline-retry.js' || path === '/offline.html') {
    e.respondWith(
      caches.match(e.request).then(function (cached) {
        return cached || fetch(e.request);
      })
    );
    return;
  }
  e.respondWith(fetch(e.request));
});
