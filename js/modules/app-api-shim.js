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
window.SIGAJI_BUILD = '11.5.53';
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
  applyMobileNavClass();
  try {
    var mq = window.matchMedia('(max-width:900px)');
    if (typeof mq.addEventListener === 'function') {
      mq.addEventListener('change', applyMobileNavClass);
    } else if (typeof mq.addListener === 'function') {
      mq.addListener(applyMobileNavClass);
    }
  } catch (e2) {
    sigajiCatchWarn('js/modules/app-api-shim.js', e2);
  }
})();
