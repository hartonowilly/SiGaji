/**
 * SiGaji — pemisahan ID karyawan tetap vs tidak tetap.
 * Tetap: K0001, K0002, … | Tidak tetap: NT0001, NT0002, … (tidak berbagi urutan angka).
 * Multi-cabang: cabang selain pusat → {KODE}-K0001 (urutan & prefiks terpisah per lokasi).
 */
(function () {
  var PFX = { tetap: 'K', tidak_tetap: 'NT' };

  function normalizeTipe(tipe, k) {
    if (tipe === 'tidak_tetap' || tipe === 'tetap') return tipe;
    if (k && (k.tipe_kerja === 'tidak_tetap' || k.tipe_kerja === 'tetap')) return k.tipe_kerja;
    var n = String((k && k.nik) || '').trim().toUpperCase();
    if (/^([A-Z0-9]{1,6}-)?NT\d/.test(n)) return 'tidak_tetap';
    return 'tetap';
  }

  function nikPrefixForTipe(tipe) {
    return PFX[normalizeTipe(tipe)] || PFX.tetap;
  }

  function parseNikCore(nik) {
    var n = String(nik || '').trim().toUpperCase();
    var m = n.match(/^([A-Z0-9]{1,6}-)?(K|NT)(\d+)$/i);
    if (!m) return null;
    return {
      branch: m[1] || '',
      prefix: m[2].toUpperCase(),
      num: m[3],
    };
  }

  function isNikForTipe(nik, tipe) {
    var parsed = parseNikCore(nik);
    if (!parsed) return false;
    return parsed.prefix === nikPrefixForTipe(tipe).toUpperCase();
  }

  function branchNikPrefixFor(cabangId) {
    if (
      typeof sigajiMultiBranchEnabled === 'function' &&
      !sigajiMultiBranchEnabled()
    )
      return '';
    if (!cabangId || cabangId === 'utama') return '';
    if (typeof sigajiBranchNikPrefix === 'function')
      return sigajiBranchNikPrefix(cabangId);
    return '';
  }

  function resolveCabangIdForNik(cabangId) {
    if (cabangId) return cabangId;
    if (typeof sigajiGetCabangFilter === 'function') {
      var f = sigajiGetCabangFilter();
      if (f) return f;
    }
    return 'utama';
  }

  function nextNik(tipe, cabangId) {
    tipe = normalizeTipe(tipe);
    var p = nikPrefixForTipe(tipe);
    cabangId = resolveCabangIdForNik(cabangId);
    var brPrefix = branchNikPrefixFor(cabangId);
    var maxNum = 0;
    var esc = brPrefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    var re = new RegExp('^' + esc + p + '(\\d+)$', 'i');
    var list =
      typeof karyawan !== 'undefined' && Array.isArray(karyawan) ? karyawan : [];
    list.forEach(function (k) {
      if (
        cabangId &&
        typeof sigajiKarCabangId === 'function' &&
        sigajiKarCabangId(k) !== cabangId
      )
        return;
      var m = String((k && k.nik) || '').trim().match(re);
      if (m) {
        var n = parseInt(m[1], 10);
        if (!isNaN(n) && n > maxNum) maxNum = n;
      }
    });
    return brPrefix + p + String(maxNum + 1).padStart(4, '0');
  }

  function validateNik(nik, tipe, exceptNik) {
    nik = String(nik || '').trim();
    tipe = normalizeTipe(tipe);
    if (!nik) return { ok: false, msg: 'NIK wajib diisi' };
    if (!isNikForTipe(nik, tipe)) {
      var brHint =
        typeof sigajiMultiBranchEnabled === 'function' &&
        sigajiMultiBranchEnabled()
          ? ' (cabang non-pusat: {KODE}-K0001, contoh C2-K0001)'
          : '';
      return {
        ok: false,
        msg:
          'NIK harus format ' +
          nikPrefixForTipe(tipe) +
          '0001' +
          brHint +
          ' untuk ' +
          (tipe === 'tidak_tetap' ? 'pegawai tidak tetap' : 'pegawai tetap'),
      };
    }
    var parsed = parseNikCore(nik);
    var lain = tipe === 'tidak_tetap' ? 'tetap' : 'tidak_tetap';
    if (parsed && parsed.prefix === nikPrefixForTipe(lain).toUpperCase()) {
      return {
        ok: false,
        msg:
          'NIK ' +
          nik +
          ' memakai prefiks ' +
          nikPrefixForTipe(lain) +
          ' — gunakan ' +
          nikPrefixForTipe(tipe),
      };
    }
    var list =
      typeof karyawan !== 'undefined' && Array.isArray(karyawan) ? karyawan : [];
    var dup = list.some(function (k) {
      return (
        k &&
        String(k.nik).trim().toUpperCase() === nik.toUpperCase() &&
        String(k.nik).trim() !== String(exceptNik || '').trim()
      );
    });
    if (dup) return { ok: false, msg: 'NIK sudah dipakai karyawan lain' };
    return { ok: true };
  }

  function labelTipe(tipe) {
    return tipe === 'tidak_tetap' ? 'Pegawai Tidak Tetap' : 'Pegawai Tetap';
  }

  function defaultBpjsAktif(tipe) {
    var on = normalizeTipe(tipe) === 'tetap';
    return {
      'kes-prs': on,
      'kes-kar': on,
      'jht-prs': on,
      'jht-kar': on,
      'jp-prs': on,
      'jp-kar': on,
      'jkk-prs': on,
      'jkm-prs': on,
    };
  }

  function newKaryawanSkeleton(tipe, cabangId) {
    tipe = normalizeTipe(tipe);
    cabangId = resolveCabangIdForNik(cabangId);
    var nik = nextNik(tipe, cabangId);
    var sk = {
      nik: nik,
      tipe_kerja: tipe,
      cabangId: cabangId,
      nama: tipe === 'tidak_tetap' ? 'Pegawai Tidak Tetap Baru' : 'Karyawan Baru',
      dept: 'Operasional',
      jabatan: tipe === 'tidak_tetap' ? 'Tenaga Tidak Tetap' : 'Staff',
      status: tipe === 'tidak_tetap' ? 'Kontrak' : 'Tetap',
      masuk: new Date().toISOString().split('T')[0],
      ptkp: 'TK0',
      jk: 'L',
      agama: 'Islam',
      ktp: '',
      npwp: '',
      hp: '',
      email: '',
      alamat: '',
      atasan: '',
      lokasi: '',
      bank: 'BCA',
      norek: '',
      reknam: '',
      gapok: tipe === 'tidak_tetap' ? 0 : 5000000,
      tunjangan:
        tipe === 'tidak_tetap'
          ? [
              {
                nama: 'Honor / Upah Bulanan',
                nilai: 5000000,
                tipe: 'tidak_tetap',
                thr_ikut: false,
                prorata_ikut: true,
              },
            ]
          : [],
      potongan: [],
      bpjs_aktif: defaultBpjsAktif(tipe),
      bpjs_manual: {},
      natura: [],
      pph_return: { nilai: 0, ket: '' },
      _new: true,
    };
    return sk;
  }

  function migrateKaryawanTipeKerja(list) {
    if (!Array.isArray(list)) return;
    list.forEach(function (k) {
      if (!k || typeof k !== 'object') return;
      k.tipe_kerja = normalizeTipe(k.tipe_kerja, k);
    });
  }

  window.sigajiNormalizeKarTipe = normalizeTipe;
  window.sigajiNikPrefixForTipe = nikPrefixForTipe;
  window.sigajiIsNikForTipe = isNikForTipe;
  window.sigajiNextNik = nextNik;
  window.sigajiValidateKarNik = validateNik;
  window.sigajiKarTipeLabel = labelTipe;
  window.sigajiNewKaryawanSkeleton = newKaryawanSkeleton;
  window.sigajiMigrateKaryawanTipeKerja = migrateKaryawanTipeKerja;

  /** Urutan daftar karyawan: NIK (K0001, K0002, NT0001, …), bukan abjad nama. */
  function sortKaryawanByNik(list) {
    return (list || []).slice().sort(function (a, b) {
      return String(a.nik || '').localeCompare(String(b.nik || ''), 'id', {
        numeric: true,
        sensitivity: 'base',
      });
    });
  }
  window.sigajiSortKaryawanByNik = sortKaryawanByNik;
})();
