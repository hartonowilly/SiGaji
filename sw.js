/* SiGaji — service worker passthrough (syarat pasang ke layar utama).
   Tidak cache HTML/API supaya gaji dan absen selalu dari jaringan. */
self.addEventListener('install', function (e) {
  self.skipWaiting();
});
self.addEventListener('activate', function (e) {
  e.waitUntil(self.clients.claim());
});
self.addEventListener('fetch', function (e) {
  if (e.request.method !== 'GET') return;
  e.respondWith(fetch(e.request));
});
