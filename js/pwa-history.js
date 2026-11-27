/* SiGaji — riwayat halaman/modal untuk tombol kembali PWA (iOS geser, Android back). */
(function (w) {
  var pop = false;

  function enabled() {
    return typeof w.history !== 'undefined' && typeof w.history.pushState === 'function';
  }

  function currentPg() {
    var el = document.querySelector && document.querySelector('.pg.active');
    if (!el || !el.id) return '';
    return el.id.replace(/^pg-/, '');
  }

  function baseUrl() {
    return w.location.pathname + (w.location.search || '');
  }

  function hashFor(pg) {
    return pg ? '#' + encodeURIComponent(pg) : '';
  }

  w.sigajiHistIsPop = function () {
    return pop;
  };

  w.sigajiHistPush = function (state) {
    if (pop || !enabled()) return;
    try {
      var pg = (state && state.pg) || currentPg();
      var st = Object.assign({ sigaji: 1, pg: pg }, state || {});
      w.history.pushState(st, '', baseUrl() + hashFor(pg));
    } catch (e) { /* ignore */ }
  };

  w.sigajiHistReplacePg = function (pg) {
    if (!enabled() || !pg) return;
    try {
      var st = Object.assign({}, w.history.state || {}, { sigaji: 1, pg: pg });
      w.history.replaceState(st, '', baseUrl() + hashFor(pg));
    } catch (e2) { /* ignore */ }
  };

  w.sigajiHistCloseTopLayer = function () {
    var mbd = document.querySelector && document.querySelector('.mbd.show');
    if (mbd && mbd.id) {
      mbd.classList.remove('show');
      return true;
    }
    var ov = document.getElementById('panel-overlay');
    if (ov && ov.classList.contains('show') && typeof w.closeAnyPanel === 'function') {
      w.closeAnyPanel();
      return true;
    }
    if (w.__sigajiPgOpenNik && typeof w.pgBukaKartu === 'function') {
      w.pgBukaKartu(w.__sigajiPgOpenNik);
      return true;
    }
    if (w.__sigajiKarOpenNik && typeof w.karBukaKartu === 'function') {
      w.karBukaKartu(w.__sigajiKarOpenNik);
      return true;
    }
    return false;
  };

  w.addEventListener('popstate', function (ev) {
    pop = true;
    try {
      w.sigajiHistCloseTopLayer();
      var st = ev.state || {};
      var pg = st.pg || '';
      if (!pg) {
        try {
          var h = w.location.hash;
          if (h && h.length > 1) pg = decodeURIComponent(h.substring(1).split('?')[0]);
        } catch (e3) { /* ignore */ }
      }
      if (pg && pg !== currentPg() && typeof w.showPg === 'function') w.showPg(pg);
    } finally {
      pop = false;
    }
  });
})(typeof window !== 'undefined' ? window : this);
