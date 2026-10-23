/**
 * Host Web Worker hitung gaji massal. Fallback ke thread UI bila Worker tidak ada / gagal.
 */
(function () {
  var THRESHOLD = 60;
  var worker = null;
  var ready = null;
  var seq = 0;
  var pending = Object.create(null);
  var failed = false;

  function cacheVer() {
    return typeof SIGAJI_MODULES_CACHE === 'string' && SIGAJI_MODULES_CACHE ? SIGAJI_MODULES_CACHE : '0';
  }

  function scriptUrls() {
    var v = cacheVer();
    return [
      '/js/constants.js?v=' + v,
      '/js/ptkp.js?v=' + v,
      '/js/karyawan-tipe.js?v=' + v,
      '/js/siklus-bayar.js?v=' + v,
      '/js/modules/app-core.js?v=' + v,
      '/js/pesangon.js?v=' + v,
    ];
  }

  function snapFor(list) {
    var niks = Object.create(null);
    (list || []).forEach(function (k) {
      if (k && k.nik) niks[k.nik] = true;
    });
    function pick(src) {
      var out = {};
      Object.keys(niks).forEach(function (nik) {
        if (src && src[nik] != null) out[nik] = src[nik];
      });
      return out;
    }
    var tv = {};
    if (typeof tunjVarBulan !== 'undefined' && tunjVarBulan) {
      Object.keys(tunjVarBulan).forEach(function (pn) {
        var row = tunjVarBulan[pn];
        if (!row) return;
        var slim = {};
        var any = false;
        Object.keys(niks).forEach(function (nik) {
          if (row[nik] != null) {
            slim[nik] = row[nik];
            any = true;
          }
        });
        if (any) tv[pn] = slim;
      });
    }
    var snaps = {};
    if (typeof karSnapshot !== 'undefined' && karSnapshot) {
      Object.keys(karSnapshot).forEach(function (pn) {
        var row = karSnapshot[pn];
        if (!row) return;
        var slim = {};
        var any = false;
        Object.keys(niks).forEach(function (nik) {
          if (row[nik] != null) {
            slim[nik] = row[nik];
            any = true;
          }
        });
        if (any) snaps[pn] = slim;
      });
    }
    return {
      perusahaan: typeof perusahaan !== 'undefined' ? perusahaan : {},
      periodes: typeof periodes !== 'undefined' ? periodes : [],
      hariLibur: typeof hariLibur !== 'undefined' ? hariLibur : [],
      masterCuti: typeof masterCuti !== 'undefined' ? masterCuti : { kuota: 12 },
      absensi: typeof absensi !== 'undefined' ? pick(absensi) : {},
      prorata: typeof prorata !== 'undefined' ? pick(prorata) : {},
      thrManual: typeof thrManual !== 'undefined' ? thrManual : {},
      lembur: typeof lembur !== 'undefined' ? pick(lembur) : {},
      karSnapshot: snaps,
      karyawan: list || [],
      tunjVarBulan: tv,
      tunjVarLabels: typeof tunjVarLabels !== 'undefined' ? tunjVarLabels : {},
      tunjVarColumns: typeof tunjVarColumns !== 'undefined' ? tunjVarColumns : [],
    };
  }

  function syncMap(pNama, list) {
    var out = {};
    var run = function () {
      (list || []).forEach(function (k) {
        if (k && k.nik) out[k.nik] = hitungGaji(k, pNama);
      });
    };
    if (typeof sigajiWithHitungCache === 'function') sigajiWithHitungCache(run);
    else run();
    return out;
  }

  function ensureWorker() {
    if (failed) return Promise.resolve(null);
    if (typeof Worker === 'undefined') {
      failed = true;
      return Promise.resolve(null);
    }
    if (worker && ready) return ready;
    try {
      worker = new Worker('/js/payroll-worker.js?v=' + cacheVer());
    } catch (e) {
      failed = true;
      return Promise.resolve(null);
    }
    ready = new Promise(function (resolve) {
      var bootId = 'boot';
      var timer = setTimeout(function () {
        failed = true;
        resolve(null);
      }, 8000);
      worker.onmessage = function (ev) {
        var msg = ev.data || {};
        if (msg.type === 'ready' && msg.id === bootId) {
          clearTimeout(timer);
          resolve(worker);
          return;
        }
        var p = pending[msg.id];
        if (!p) return;
        delete pending[msg.id];
        if (msg.type === 'hasil') p.resolve(msg.hasil || {});
        else p.reject(new Error(msg.message || 'Worker hitung gaji gagal'));
      };
      worker.onerror = function () {
        failed = true;
        clearTimeout(timer);
        resolve(null);
      };
      worker.postMessage({ type: 'boot', id: bootId, scripts: scriptUrls() });
    });
    return ready;
  }

  /**
   * Hitung gaji banyak karyawan untuk satu periode.
   * @returns {Promise<Record<string, object>>} peta nik → hasil hitungGaji
   */
  window.sigajiHitungGajiMassal = function (pNama, list) {
    list = list || [];
    if (!list.length) return Promise.resolve({});
    if (list.length < THRESHOLD) return Promise.resolve(syncMap(pNama, list));
    return ensureWorker().then(function (w) {
      if (!w) return syncMap(pNama, list);
      var id = 'h' + ++seq;
      var jobs = list.map(function (k) {
        return { nik: k.nik, pNama: pNama };
      });
      return new Promise(function (resolve, reject) {
        pending[id] = { resolve: resolve, reject: reject };
        try {
          w.postMessage({ type: 'hitung', id: id, snap: snapFor(list), jobs: jobs });
        } catch (e) {
          delete pending[id];
          resolve(syncMap(pNama, list));
        }
      }).catch(function () {
        return syncMap(pNama, list);
      });
    });
  };
  window.sigajiHitungGajiMassal.THRESHOLD = THRESHOLD;
})();
