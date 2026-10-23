/**
 * Thread terpisah: hitungGaji massal agar UI tidak beku.
 * Dijalankan lewat js/payroll-worker-host.js (bukan <script> di halaman).
 */
(function (root) {
  var document = {
    getElementById: function () {
      return null;
    },
    querySelector: function () {
      return null;
    },
    querySelectorAll: function () {
      return [];
    },
    createElement: function () {
      return { style: {}, setAttribute: function () {}, appendChild: function () {} };
    },
  };
  root.document = document;
  root.window = root;
  root.toast = function () {};
  root.saveAll = function () {};
  root.renderPenggajian = function () {};
  root.sigajiCatchWarn = function () {};
  root.sigajiConfirm = function () {
    return Promise.resolve(false);
  };

  function applySnap(s) {
    s = s || {};
    root.perusahaan = s.perusahaan || {};
    root.periodes = s.periodes || [];
    root.hariLibur = s.hariLibur || [];
    root.masterCuti = s.masterCuti || { kuota: 12, carryover: 'no', cbPotong: true };
    root.absensi = s.absensi || {};
    root.prorata = s.prorata || {};
    root.thrManual = s.thrManual || {};
    root.lembur = s.lembur || {};
    root.karSnapshot = s.karSnapshot || {};
    root.karyawan = s.karyawan || [];
    root.tunjVarBulan = s.tunjVarBulan || {};
    root.tunjVarLabels = s.tunjVarLabels || {};
    root.tunjVarColumns = s.tunjVarColumns || [];
  }

  function hitungJobs(jobs) {
    var out = {};
    var hitung = root.hitungGaji;
    var byNik = root.sigajiKarByNik;
    if (typeof hitung !== 'function') throw new Error('hitungGaji tidak termuat di worker');
    var run = function () {
      (jobs || []).forEach(function (j) {
        var nik = j.nik;
        var k = typeof byNik === 'function' ? byNik(nik) : null;
        if (!k && root.karyawan) {
          for (var i = 0; i < root.karyawan.length; i++) {
            if (root.karyawan[i] && root.karyawan[i].nik === nik) {
              k = root.karyawan[i];
              break;
            }
          }
        }
        out[nik] = k ? hitung(k, j.pNama) : null;
      });
    };
    if (typeof root.sigajiWithHitungCache === 'function') root.sigajiWithHitungCache(run);
    else run();
    return out;
  }

  root.onmessage = function (ev) {
    var msg = ev.data || {};
    try {
      if (msg.type === 'boot') {
        if (typeof root.importScripts === 'function' && msg.scripts && msg.scripts.length) {
          root.importScripts.apply(root, msg.scripts);
        }
        root.postMessage({ type: 'ready', id: msg.id });
        return;
      }
      if (msg.type === 'hitung') {
        applySnap(msg.snap);
        root.postMessage({ type: 'hasil', id: msg.id, hasil: hitungJobs(msg.jobs) });
      }
    } catch (e) {
      root.postMessage({ type: 'error', id: msg.id, message: String((e && e.message) || e) });
    }
  };
})(self);
