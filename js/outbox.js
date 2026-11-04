/**
 * SiGaji — Outbox perubahan lokal yang belum sampai awan.
 *
 * Setiap simpan lokal (saveAll) dikirim ke awan ±2 detik kemudian. Bila halaman ditutup/di-refresh
 * sebelum unggahan selesai, data awan yang dimuat ulang menimpa memori dan perubahan tadi hilang
 * walau salinannya ada di perangkat. Dulu hanya klik absensi yang dilindungi (jurnal absensi);
 * outbox ini melindungi semua jenis data: karyawan, periode, absensi, lembur, tunjangan variabel,
 * pengaturan perusahaan, user, libur, dst.
 *
 * Cara kerja:
 *  - `basis` = salinan kanonik (per entitas, lihat cloud-delta.js) dari data yang diyakini sudah ada di awan.
 *  - `catat()` saat saveAll: outbox := selisih memori vs basis, disimpan ke localStorage.
 *  - `selesai(dibangunPada)` setelah unggahan sukses: basis := memori, kecuali entri yang berubah
 *    setelah payload dibangun (tetap menunggu).
 *  - `putar()` setelah data awan termuat: terapkan entri outbox ke memori (lokal menang), lalu saveAll
 *    → tercatat lagi dan diunggah ulang.
 *
 * Hanya aktif bila ada awan (sigajiQueueCloudSave) dan akun boleh mengunggah (bukan Karyawan).
 */
(function (root) {
  var KEY = 'sigaji_outbox';
  var MAX_ENTRI = 600;
  var UMUR_MS = 3 * 24 * 60 * 60 * 1000;
  /** Store yang tidak perlu dilindungi (besar / bukan data inti) — tetap diunggah lewat jalur biasa. */
  var STORE_ABAIKAN = { auditLog: true, notifikasi: true, bentoLayouts: true };

  var basis = null; // id → {j, e} ; null = belum ada data awan di sesi ini
  var cache = null; // entri terakhir yang ditulis (hindari parse berulang)
  var lastJumlah = -1;

  function D() {
    return root.sigajiCloudDelta || null;
  }
  function catchWarn(e) {
    if (typeof root.sigajiCatchWarn === 'function') root.sigajiCatchWarn('js/outbox.js', e);
  }
  function aktif() {
    if (typeof root.sigajiQueueCloudSave !== 'function') return false;
    if (typeof root.sigajiCanUploadCloudPayload === 'function' && !root.sigajiCanUploadCloudPayload()) return false;
    return !!D();
  }
  function baca() {
    if (cache) return cache;
    try {
      var raw = root.localStorage.getItem(KEY);
      var a = raw ? JSON.parse(raw) : [];
      cache = Array.isArray(a) ? a : [];
    } catch (e) {
      cache = [];
    }
    return cache;
  }
  function tulis(list) {
    cache = list;
    try {
      if (!list.length) root.localStorage.removeItem(KEY);
      else root.localStorage.setItem(KEY, JSON.stringify(list.slice(-MAX_ENTRI)));
    } catch (e) {
      catchWarn(e);
    }
    if (list.length !== lastJumlah) {
      lastJumlah = list.length;
      try {
        if (typeof root.sigajiOutboxCountChanged === 'function') root.sigajiOutboxCountChanged(list.length);
      } catch (e2) {
        catchWarn(e2);
      }
    }
  }

  function entitasMemori() {
    var d = D();
    if (!d || typeof root.getPayloadForCloud !== 'function') return null;
    var list = d.explodePayload(root.getPayloadForCloud(), { items: true });
    return list.filter(function (e) {
      return !(e.t === 'S' && STORE_ABAIKAN[e.key.store_key]);
    });
  }
  function petaEntitas(list) {
    var d = D();
    var m = Object.create(null);
    list.forEach(function (e) {
      m[e.id] = { j: d.stableStringify(e.data), e: e };
    });
    return m;
  }

  /**
   * Tetapkan basis = memori sekarang.
   * @param {number} [sejak] entri outbox dengan ts > sejak tetap dianggap menunggu (basis lamanya dipertahankan);
   *   kosong = reset penuh (data awan baru termuat).
   */
  function tandaiBasis(sejak) {
    var list = entitasMemori();
    if (!list) return;
    var baru = petaEntitas(list);
    if (basis && sejak != null) {
      baca().forEach(function (en) {
        if (!en || !(en.ts > sejak)) return;
        if (basis[en.id]) baru[en.id] = basis[en.id];
        else delete baru[en.id];
      });
    }
    basis = baru;
  }

  /** Hitung ulang outbox = selisih memori vs basis. Dipanggil saveAll. */
  function catat() {
    if (!basis || !aktif()) return 0;
    var d = D();
    var list = entitasMemori();
    if (!list) return 0;
    var lama = Object.create(null);
    baca().forEach(function (en) {
      if (en && en.id) lama[en.id] = en;
    });
    var now = Date.now();
    var out = [];
    var seen = Object.create(null);
    list.forEach(function (e) {
      seen[e.id] = true;
      var j = d.stableStringify(e.data);
      var b = basis[e.id];
      if (b && b.j === j) return;
      var prev = lama[e.id];
      out.push({
        id: e.id,
        t: e.t,
        key: e.key,
        nik: e.nik,
        d: e.data,
        ts: prev && prev.j === j ? prev.ts : now,
        j: j,
      });
    });
    Object.keys(basis).forEach(function (id) {
      if (seen[id]) return;
      var b = basis[id];
      var prev = lama[id];
      out.push({
        id: id,
        t: b.e.t,
        key: b.e.key,
        nik: b.e.nik,
        d: null,
        ts: prev && prev.j === 'null' ? prev.ts : now,
        j: 'null',
      });
    });
    tulis(out);
    return out.length;
  }

  /** Unggahan yang payload-nya dibangun pada `dibangunPada` berhasil. */
  function selesai(dibangunPada) {
    if (!basis) {
      tandaiBasis();
    } else {
      tandaiBasis(dibangunPada == null ? Date.now() : dibangunPada);
    }
    if (aktif()) catat();
    else tulis([]);
  }

  function bisaEditTanggal(iso) {
    if (typeof root.canEditAbsensiPadaTanggalIso === 'function') return root.canEditAbsensiPadaTanggalIso(iso);
    return true;
  }
  function bulanDari(iso) {
    var m = /^(\d{4}-\d{2})/.exec(String(iso));
    return m ? m[1] : 'lain';
  }

  /** Absensi: ganti isi satu bulan untuk satu NIK, hanya tanggal yang masih boleh diubah. */
  function putarAbsensi(mem, en) {
    var nik = en.nik != null ? String(en.nik) : '';
    if (!nik || !mem.absensi) return false;
    var bulan = String(en.key.item_key).slice(nik.length + 1);
    var data = en.d && typeof en.d === 'object' ? en.d : {};
    var hari = mem.absensi[nik] || (mem.absensi[nik] = {});
    var ubah = false;
    Object.keys(hari).forEach(function (d) {
      if (bulanDari(d) !== bulan || data[d] != null) return;
      if (!bisaEditTanggal(d)) return;
      delete hari[d];
      ubah = true;
    });
    Object.keys(data).forEach(function (d) {
      if (bulanDari(d) !== bulan || !bisaEditTanggal(d)) return;
      if (hari[d] === data[d]) return;
      hari[d] = data[d];
      ubah = true;
    });
    if (!Object.keys(hari).length) delete mem.absensi[nik];
    return ubah;
  }

  function memRefs() {
    if (typeof root.sigajiOutboxMemRefs === 'function') return root.sigajiOutboxMemRefs();
    return null;
  }

  /**
   * Terapkan entri outbox ke memori setelah data awan termuat, lalu saveAll (= unggah ulang).
   * @returns {number} jumlah entri yang dipulihkan
   */
  function putar() {
    var d = D();
    var list = baca();
    if (!d || !list.length) return 0;
    if (!aktif()) {
      tulis([]);
      return 0;
    }
    var mem = memRefs();
    if (!mem) return 0;
    var now = Date.now();
    var sah = list.filter(function (en) {
      return en && en.id && en.key && en.t && now - (en.ts || 0) <= UMUR_MS;
    });
    // Hapus massal karyawan/periode dari perangkat lama mencurigakan — jangan diputar.
    var hapusK = sah.filter(function (en) {
      return en.t === 'K' && en.d == null;
    }).length;
    var totalK = (mem.karyawan || []).length;
    var tolakHapusK = hapusK >= 5 && hapusK * 5 >= totalK;
    var urutan = { K: 0, P: 1, C: 2, S: 3, I: 4, T: 5 };
    sah.sort(function (a, b) {
      return (urutan[a.t] || 9) - (urutan[b.t] || 9);
    });
    var niks = Object.create(null);
    var n = 0;
    sah.forEach(function (en) {
      try {
        if (en.t === 'K') {
          if (en.d == null && tolakHapusK) return;
          d.applyEntityToMemory(mem, en, en.d);
          n++;
          return;
        }
        if (en.t === 'I' || en.t === 'T') {
          if (!Object.keys(niks).length) {
            (mem.karyawan || []).forEach(function (k) {
              if (k && k.nik != null) niks[String(k.nik)] = true;
            });
          }
          var nik = en.t === 'T' ? en.key.nik : en.nik;
          if (nik == null || !niks[String(nik)]) return;
          if (en.t === 'I' && en.key.kind === 'absensi') {
            if (putarAbsensi(mem, en)) n++;
            return;
          }
          if (
            en.t === 'I' &&
            en.key &&
            (en.key.kind === 'hasilGaji' || en.key.kind === 'absensiPotBaseline')
          ) {
            var ik = String(en.key.item_key || '');
            var sep = ik.lastIndexOf('|');
            var pn = sep >= 0 ? ik.slice(0, sep) : '';
            var per = null;
            (mem.periodes || []).forEach(function (p) {
              if (p && p.nama === pn) per = p;
            });
            if (!per || !per.snapshot_locked) return;
          }
        }
        d.applyEntityToMemory(mem, en, en.d);
        n++;
      } catch (e) {
        catchWarn(e);
      }
    });
    if (n && typeof root.saveAll === 'function') root.saveAll();
    else if (!n) tulis([]);
    return n;
  }

  function jumlah() {
    return baca().length;
  }
  function reset() {
    basis = null;
    tulis([]);
  }

  root.sigajiOutbox = {
    KEY: KEY,
    catat: catat,
    selesai: selesai,
    putar: putar,
    tandaiBasis: tandaiBasis,
    jumlah: jumlah,
    reset: reset,
    adaBasis: function () {
      return !!basis;
    },
  };
})(typeof window !== 'undefined' ? window : globalThis);
