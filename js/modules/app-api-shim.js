/* SiGaji — shim API Cloudflare (muat di <head> sebelum modul lain) */
window.sigajiFunctionUrl = function (n) {
  n = String(n || '').replace(/^\//, '');
  return '/api/' + n;
};
window.sigajiParseFunctionJson = async function (r) {
  var ct = (r.headers && r.headers.get('content-type')) || '';
  if (ct.indexOf('application/json') >= 0) return r.json().catch(function () { return null; });
  if (ct.indexOf('text/html') >= 0 || r.status === 404) {
    return { ok: false, error: 'API tidak aktif — deploy /api/ + env SIGAJI_SUPABASE_* di Cloudflare' };
  }
  return r.json().catch(function () { return null; });
};
window.SIGAJI_BUILD = '11.5.79';
function sigajiPaintBuildChip() {
  var el = document.getElementById('sigaji-build-chip');
  if (el && window.SIGAJI_BUILD) el.textContent = 'v' + window.SIGAJI_BUILD;
}
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', sigajiPaintBuildChip);
} else {
  sigajiPaintBuildChip();
}
(function () {
  function applyMobileNavClass() {
    try {
      var narrow = window.matchMedia('(max-width:900px)').matches;
      var touch = window.matchMedia('(hover:none) and (pointer:coarse)').matches;
      document.documentElement.classList.toggle('sigaji-mobile-nav', narrow || touch);
    } catch (e) {
      sigajiCatchWarn('js/modules/app-api-shim.js', e);
    }
  }
  /** Desktop: biarkan CSS 100dvh. Mobile/keyboard: override px dari visualViewport. */
  function syncViewportHeight() {
    try {
      var ih = window.innerHeight || document.documentElement.clientHeight || 0;
      var iw = window.innerWidth || document.documentElement.clientWidth || 0;
      var vv = window.visualViewport;
      var vvh = vv && vv.height > 0 ? Math.round(vv.height) : 0;
      var vvw = vv && vv.width > 0 ? Math.round(vv.width) : 0;
      var needPx = vvh > 0 && Math.abs(vvh - ih) > 2;
      if (needPx) {
        document.documentElement.style.setProperty('--sigaji-app-height', vvh + 'px');
        if (vvw > 0) document.documentElement.style.setProperty('--sigaji-vw', vvw + 'px');
      } else {
        document.documentElement.style.removeProperty('--sigaji-app-height');
        document.documentElement.style.removeProperty('--sigaji-vw');
      }
      if (ih > 0) document.documentElement.style.setProperty('--sigaji-inner-h', ih + 'px');
      if (iw > 0) document.documentElement.style.setProperty('--sigaji-inner-w', iw + 'px');
      document.documentElement.style.setProperty('--sigaji-doc-w', Math.max(iw, vvw || 0) + 'px');
    } catch (e) {
      sigajiCatchWarn('js/modules/app-api-shim.js', e);
    }
  }
  function onViewportChange() {
    syncViewportHeight();
    applyMobileNavClass();
    if (typeof window.sigajiOnViewportResize === 'function' && window._sigajiNavResizeBound) {
      /* full handler di app-shell (nav + panel dock) — dipanggil dari listener di sana */
    }
  }
  syncViewportHeight();
  applyMobileNavClass();
  if (!window._sigajiShimResizeBound) {
    window._sigajiShimResizeBound = true;
    var t = null;
    function schedule() {
      clearTimeout(t);
      t = setTimeout(onViewportChange, 50);
    }
    window.addEventListener('resize', schedule, { passive: true });
    window.addEventListener('orientationchange', function () {
      setTimeout(onViewportChange, 100);
    }, { passive: true });
    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', schedule, { passive: true });
      window.visualViewport.addEventListener('scroll', schedule, { passive: true });
    }
  }
  try {
    var mq = window.matchMedia('(max-width:900px)');
    if (typeof mq.addEventListener === 'function') {
      mq.addEventListener('change', function () {
        applyMobileNavClass();
        syncViewportHeight();
      });
    } else if (typeof mq.addListener === 'function') {
      mq.addListener(function () {
        applyMobileNavClass();
        syncViewportHeight();
      });
    }
  } catch (e2) {
    sigajiCatchWarn('js/modules/app-api-shim.js', e2);
  }
  window.sigajiSyncViewportHeightEarly = syncViewportHeight;
})();
