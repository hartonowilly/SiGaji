/* SiGaji — SW: pasang PWA + halaman cadangan offline (data gaji tidak di-cache). */
/* Cloudflare Pages 308 /offline.html → /offline; simpan dan match URL tanpa .html. */
var SIGAJI_OFFLINE_CACHE = 'sigaji-offline-v3';
var SIGAJI_OFFLINE_PAGE = '/offline';
var SIGAJI_OFFLINE_JS = '/js/offline-retry.js';

function sigajiAsCachedResponse(r) {
  if (!r || !r.ok) return null;
  return new Response(r.body, {
    status: 200,
    statusText: 'OK',
    headers: r.headers,
  });
}

function sigajiCacheFromNetwork(cache, storeUrl, tryUrls) {
  function next(i) {
    if (i >= tryUrls.length) return Promise.reject(new Error('cache ' + storeUrl));
    return fetch(tryUrls[i], { redirect: 'follow' }).then(function (r) {
      var copy = sigajiAsCachedResponse(r);
      if (!copy) return next(i + 1);
      return cache.put(storeUrl, copy);
    }).catch(function () {
      return next(i + 1);
    });
  }
  return next(0);
}

self.addEventListener('install', function (e) {
  e.waitUntil(
    caches.open(SIGAJI_OFFLINE_CACHE).then(function (c) {
      return sigajiCacheFromNetwork(c, SIGAJI_OFFLINE_PAGE, [SIGAJI_OFFLINE_PAGE, '/offline.html']).then(function () {
        return sigajiCacheFromNetwork(c, SIGAJI_OFFLINE_JS, [SIGAJI_OFFLINE_JS]);
      });
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
        return caches.match(SIGAJI_OFFLINE_PAGE).then(function (r) {
          if (!r) {
            return new Response('Tidak ada koneksi', {
              status: 503,
              headers: { 'Content-Type': 'text/plain; charset=utf-8' },
            });
          }
          return new Response(r.body, { status: r.status, statusText: r.statusText, headers: r.headers });
        });
      })
    );
    return;
  }
  var path = new URL(e.request.url).pathname;
  if (path === SIGAJI_OFFLINE_JS) {
    e.respondWith(
      caches.match(SIGAJI_OFFLINE_JS).then(function (cached) {
        return cached || fetch(e.request);
      })
    );
    return;
  }
  if (path === SIGAJI_OFFLINE_PAGE || path === '/offline.html') {
    e.respondWith(
      caches.match(SIGAJI_OFFLINE_PAGE).then(function (cached) {
        if (!cached) return fetch(e.request);
        return new Response(cached.body, {
          status: cached.status,
          statusText: cached.statusText,
          headers: cached.headers,
        });
      })
    );
    return;
  }
  e.respondWith(fetch(e.request));
});
