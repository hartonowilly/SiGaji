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
window.SIGAJI_BUILD = '11.6.15';
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

/** Versi di file server (bukan database). Tab yang tertinggal membandingkan SIGAJI_BUILD. */
function sigajiParseBuildTag(src) {
  var m = String(src || '').match(/window\.SIGAJI_BUILD\s*=\s*'([^']+)'/);
  return m ? String(m[1]).trim() : '';
}
window.sigajiParseBuildTag = sigajiParseBuildTag;

(function () {
  var CHECK_MS = 3 * 60 * 1000;
  var shown = false;
  var lastAt = 0;
  var busy = false;

  function mine() {
    return String(window.SIGAJI_BUILD || '').trim();
  }

  function showBanner(remote) {
    if (shown || document.getElementById('sigaji-build-banner')) return;
    shown = true;
    var bar = document.createElement('div');
    bar.id = 'sigaji-build-banner';
    bar.setAttribute('role', 'status');
    bar.style.cssText = 'position:fixed;left:0;right:0;bottom:0;z-index:4000;display:flex;gap:12px;align-items:center;justify-content:space-between;flex-wrap:wrap;padding:10px 16px;background:#0c2340;color:#fff;font:600 13px/1.45 sans-serif;box-shadow:0 -4px 16px rgba(0,0,0,.22)';
    var text = document.createElement('div');
    text.textContent = 'Versi baru sudah terpasang (v' + remote + '). Muat ulang agar layar ini sama dengan server. Tab ini masih v' + mine() + '.';
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.textContent = 'Muat ulang';
    btn.style.cssText = 'border:0;border-radius:6px;background:#fff;color:#0c2340;font:700 13px sans-serif;padding:7px 12px;cursor:pointer';
    btn.addEventListener('click', function () { window.location.reload(); });
    bar.appendChild(text);
    bar.appendChild(btn);
    document.body.appendChild(bar);
  }

  function check() {
    var local = mine();
    if (!local || shown || busy || document.visibilityState === 'hidden') return;
    var now = Date.now();
    if (lastAt && now - lastAt < CHECK_MS) return;
    lastAt = now;
    busy = true;
    fetch('/js/modules/app-api-shim.js?sigaji_build=' + now, { cache: 'no-store', credentials: 'same-origin' })
      .then(function (r) { return r.ok ? r.text() : ''; })
      .then(function (txt) {
        var remote = sigajiParseBuildTag(txt);
        if (remote && remote !== local) showBanner(remote);
      })
      .catch(function () { return null; })
      .then(function () { busy = false; });
  }

  function arm() {
    check();
    document.addEventListener('visibilitychange', function () {
      if (document.visibilityState !== 'visible') return;
      lastAt = 0;
      check();
    });
    setInterval(check, CHECK_MS);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', arm);
  else arm();
})();
