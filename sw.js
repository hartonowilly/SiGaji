/* SiGaji — SW: pasang PWA + halaman cadangan offline (data gaji tidak di-cache). */
var SIGAJI_OFFLINE_CACHE = 'sigaji-offline-v1';
var SIGAJI_OFFLINE_URL = '/offline.html';

self.addEventListener('install', function (e) {
  e.waitUntil(
    caches.open(SIGAJI_OFFLINE_CACHE).then(function (c) {
      return c.add(SIGAJI_OFFLINE_URL);
    }).then(function () {
      return self.skipWaiting();
    })
  );
});
self.addEventListener('activate', function (e) {
  e.waitUntil(self.clients.claim());
});
self.addEventListener('fetch', function (e) {
  if (e.request.method !== 'GET') return;
  if (e.request.mode === 'navigate') {
    e.respondWith(
      fetch(e.request).catch(function () {
        return caches.match(SIGAJI_OFFLINE_URL).then(function (r) {
          return r || new Response('Tidak ada koneksi', { status: 503, headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
        });
      })
    );
    return;
  }
  e.respondWith(fetch(e.request));
});
