/* SiGaji — pasang ke layar utama (PWA). Tanpa onclick. */
(function () {
  var KEY = (location.pathname.indexOf('/mobile') === 0)
    ? 'sigaji_pwa_hint_dismissed_absen'
    : 'sigaji_pwa_hint_dismissed_gaji';
  var deferred = null;

  function standalone() {
    return (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches)
      || window.navigator.standalone === true;
  }
  function isiOS() {
    var ua = navigator.userAgent || '';
    return /iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  }
  function banner() {
    return document.getElementById('sigaji-pwa-banner');
  }
  function show() {
    var el = banner();
    if (!el || standalone()) return;
    try {
      if (localStorage.getItem(KEY) === '1') return;
    } catch (e) { /* ignore */ }
    el.hidden = false;
  }
  function hide() {
    var el = banner();
    if (el) el.hidden = true;
  }

  window.addEventListener('beforeinstallprompt', function (e) {
    e.preventDefault();
    deferred = e;
    var btn = document.getElementById('sigaji-pwa-pasang');
    if (btn) btn.hidden = false;
    var ios = document.getElementById('sigaji-pwa-ios');
    if (ios) ios.hidden = true;
    var other = document.getElementById('sigaji-pwa-other');
    if (other) other.hidden = true;
    show();
  });
  window.addEventListener('appinstalled', function () {
    try { localStorage.setItem(KEY, '1'); } catch (e2) { /* ignore */ }
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
      try { localStorage.setItem(KEY, '1'); } catch (e3) { /* ignore */ }
      hide();
    }
  });

  function boot() {
    if (standalone()) {
      hide();
    } else if (isiOS()) {
      var btn = document.getElementById('sigaji-pwa-pasang');
      if (btn) btn.hidden = true;
      var ios = document.getElementById('sigaji-pwa-ios');
      if (ios) ios.hidden = false;
      var other = document.getElementById('sigaji-pwa-other');
      if (other) other.hidden = true;
      show();
    } else {
      var ios2 = document.getElementById('sigaji-pwa-ios');
      if (ios2) ios2.hidden = true;
      show();
    }
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(function () {});
    }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
