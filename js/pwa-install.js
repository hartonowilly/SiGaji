/* SiGaji — pasang ke layar utama (PWA). Tanpa onclick. */
(function () {
  var KEY = (location.pathname.indexOf('/mobile') === 0)
    ? 'sigaji_pwa_hint_session_absen'
    : 'sigaji_pwa_hint_session_gaji';
  var deferred = null;

  function standalone() {
    return (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches)
      || window.navigator.standalone === true;
  }
  function isiOS() {
    var ua = navigator.userAgent || '';
    return /iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  }
  function banners() {
    return document.querySelectorAll('.sigaji-pwa-banner');
  }
  function dismissed() {
    try { return sessionStorage.getItem(KEY) === '1'; } catch (e) { return false; }
  }
  function show() {
    if (standalone() || dismissed()) return;
    banners().forEach(function (el) { el.hidden = false; });
  }
  function hide() {
    banners().forEach(function (el) { el.hidden = true; });
  }

  window.addEventListener('beforeinstallprompt', function (e) {
    e.preventDefault();
    deferred = e;
    document.querySelectorAll('[data-sigaji-pwa="pasang"]').forEach(function (btn) { btn.hidden = false; });
    document.querySelectorAll('.sigaji-pwa-ios').forEach(function (el) { el.hidden = true; });
    document.querySelectorAll('.sigaji-pwa-other').forEach(function (el) { el.hidden = true; });
    show();
  });
  window.addEventListener('appinstalled', function () {
    hide();
  });
  document.addEventListener('click', function (ev) {
    var t = ev.target && ev.target.closest ? ev.target.closest('[data-sigaji-pwa]') : null;
    if (!t) return;
    var act = t.getAttribute('data-sigaji-pwa');
    if (act === 'pasang' && deferred) {
      deferred.prompt();
      deferred.userChoice.then(function () {
        deferred = null;
        hide();
      }, function () {
        deferred = null;
        hide();
      });
    }
    if (act === 'tutup') {
      try { sessionStorage.setItem(KEY, '1'); } catch (e3) { /* ignore */ }
      hide();
    }
  });

  function boot() {
    if (standalone()) {
      hide();
    } else if (isiOS()) {
      document.querySelectorAll('[data-sigaji-pwa="pasang"]').forEach(function (btn) { btn.hidden = true; });
      document.querySelectorAll('.sigaji-pwa-ios').forEach(function (el) { el.hidden = false; });
      document.querySelectorAll('.sigaji-pwa-other').forEach(function (el) { el.hidden = true; });
      show();
    } else {
      document.querySelectorAll('.sigaji-pwa-ios').forEach(function (el) { el.hidden = true; });
      show();
    }
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(function () {});
    }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
