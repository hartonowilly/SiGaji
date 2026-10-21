/**
 * SiGaji — jadwal bayar harian/mingguan, dasar BPJS (×25/×21), cadangan potongan.
 * Pajak mengikuti tanggal transfer; BPJS memakai upah sebulan tetap.
 */
(function (root) {
  function isoAddDays(iso, n) {
    var t = String(iso || '').slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(t)) return '';
    var d = new Date(t + 'T12:00:00');
    if (isNaN(d.getTime())) return '';
    d.setDate(d.getDate() + (n || 0));
    return (
      d.getFullYear() +
      '-' +
      String(d.getMonth() + 1).padStart(2, '0') +
      '-' +
      String(d.getDate()).padStart(2, '0')
    );
  }

  function isoDow(iso) {
    var t = String(iso || '').slice(0, 10);
    var d = new Date(t + 'T12:00:00');
    if (isNaN(d.getTime())) return -1;
    return d.getDay();
  }

  function liburSetFrom(list) {
    var o = {};
    (list || []).forEach(function (l) {
      var t = String((l && l.tgl) || l || '').slice(0, 10);
      if (t) o[t] = true;
    });
    return o;
  }

  function normalizeHariGaji(v) {
    var n = parseInt(v, 10);
    if (n >= 1 && n <= 5) return n;
    return 5;
  }

  function siklusIsHariKerja(iso, hariKerja, libur) {
    var dow = isoDow(iso);
    if (dow < 0) return false;
    var hk = hariKerja === 5 ? 5 : 6;
    if (hk === 5 && (dow === 0 || dow === 6)) return false;
    if (hk === 6 && dow === 0) return false;
    if (libur && libur[String(iso).slice(0, 10)]) return false;
    return true;
  }

  /** Jumat libur → Kamis; Senin libur → Jumat sebelumnya. */
  function siklusTanggalBayar(iso, hariKerja, libur) {
    var d = String(iso || '').slice(0, 10);
    var guard = 0;
    while (d && !siklusIsHariKerja(d, hariKerja, libur) && guard < 21) {
      d = isoAddDays(d, -1);
      guard++;
    }
    return d;
  }

  function eachDate(start, end, fn) {
    var d = String(start || '').slice(0, 10);
    var last = String(end || '').slice(0, 10);
    var guard = 0;
    while (d && last && d <= last && guard < 400) {
      fn(d);
      d = isoAddDays(d, 1);
      guard++;
    }
  }

  function siklusTanggalBayarMingguan(start, end, hariGaji, hariKerja, libur, masuk, stop) {
    hariGaji = normalizeHariGaji(hariGaji);
    var dates = [];
    var seen = {};
    var masukIso = masuk ? String(masuk).slice(0, 10) : '';
    var stopIso = stop ? String(stop).slice(0, 10) : '';
    eachDate(start, end, function (d) {
      if (isoDow(d) !== hariGaji) return;
      var pay = siklusTanggalBayar(d, hariKerja, libur);
      if (!pay) return;
      if (pay < String(start).slice(0, 10) || pay > String(end).slice(0, 10)) return;
      if (masukIso && pay < masukIso) return;
      if (stopIso && pay >= stopIso) return;
      if (seen[pay]) return;
      seen[pay] = 1;
      dates.push(pay);
    });
    return dates;
  }

  function siklusHariKerjaCount(from, to, hariKerja, libur, masuk, stop) {
    var n = 0;
    var masukIso = masuk ? String(masuk).slice(0, 10) : '';
    var stopIso = stop ? String(stop).slice(0, 10) : '';
    eachDate(from, to, function (d) {
      if (masukIso && d < masukIso) return;
      if (stopIso && d >= stopIso) return;
      if (siklusIsHariKerja(d, hariKerja, libur)) n++;
    });
    return n;
  }

  /**
   * Minggu resign: upah hari kerja setelah payday terakhir s.d. sehari sebelum tgl_berhenti.
   * tgl_berhenti = hari pertama tidak dibayar.
   */
  function siklusBayarParsialResign(start, end, stop, hariGaji, hariKerja, libur, rate, masuk) {
    if (!stop) return null;
    var stopIso = String(stop).slice(0, 10);
    var startIso = String(start).slice(0, 10);
    var endIso = String(end).slice(0, 10);
    if (!stopIso || stopIso <= startIso) return null;
    var lastWork = isoAddDays(stopIso, -1);
    if (!lastWork || lastWork < startIso) return null;
    if (lastWork > endIso) lastWork = endIso;
    var pays = siklusTanggalBayarMingguan(start, end, hariGaji, hariKerja, libur, masuk, stop);
    if (pays.indexOf(lastWork) >= 0) return null;
    var prev = null;
    pays.forEach(function (p) {
      if (p <= lastWork) prev = p;
    });
    var from = prev ? isoAddDays(prev, 1) : startIso;
    var hkM = hariKerja === 5 ? 5 : 6;
    var days = siklusHariKerjaCount(from, lastWork, hariKerja, libur, masuk, stop);
    if (days <= 0) return null;
    var tgl = siklusIsHariKerja(lastWork, hariKerja, libur)
      ? lastWork
      : siklusTanggalBayar(lastWork, hariKerja, libur);
    return {
      tgl: tgl,
      upah: Math.round((Number(rate) || 0) / hkM * days),
      hari: days,
      parsial: true,
    };
  }

  function isSetengah(st) {
    return st === 'setengah_sakit' || st === 'setengah_ijin';
  }

  function siklusTanggalBayarHarian(start, end, hariKerja, libur, masuk, stop, absensi) {
    var out = [];
    var masukIso = masuk ? String(masuk).slice(0, 10) : '';
    var stopIso = stop ? String(stop).slice(0, 10) : '';
    var abs = absensi || {};
    eachDate(start, end, function (d) {
      if (masukIso && d < masukIso) return;
      if (stopIso && d >= stopIso) return;
      if (!siklusIsHariKerja(d, hariKerja, libur)) return;
      var st = abs[d] || 'hadir';
      if (
        st === 'libur' ||
        st === 'libnas' ||
        st === 'resign' ||
        st === 'alpha' ||
        st === 'izin' ||
        st === 'sakit' ||
        st === 'cuti'
      )
        return;
      out.push({ tgl: d, factor: isSetengah(st) ? 0.5 : 1 });
    });
    return out;
  }

  /** Dasar iuran BPJS: harian ×25 (6 hari/mg) atau ×21 (5 hari/mg). Bukan jumlah Jumat. */
  function siklusBpjsUpahSebulan(siklus, rate, hariKerja) {
    var hk = hariKerja === 5 ? 5 : 6;
    var kali = hariKerja === 5 ? 21 : 25;
    rate = Math.round(Number(rate) || 0);
    var s =
      typeof normalizeSiklusGaji === 'function'
        ? normalizeSiklusGaji(siklus)
        : String(siklus || 'bulanan');
    if (s === 'harian') return Math.round(rate * kali);
    if (s === 'mingguan') return Math.round((rate / hk) * kali);
    return rate;
  }

  /**
   * Opsi 1: cadangan merata, true-up di bayar terakhir.
   * Tidak pernah transfer minus; sisa potongan yang tak tertampung dikembalikan (utang).
   */
  function pecahPotonganCadangan(pays, totalPot) {
    var items = (pays || []).map(function (p) {
      var upah = Math.round(Number(p.upah) || 0);
      return {
        tgl: p.tgl,
        upah: upah,
        potongan: 0,
        dibayar: upah,
        parsial: !!p.parsial,
      };
    });
    var need = Math.max(0, Math.round(Number(totalPot) || 0));
    var n = items.length;
    if (!n) return { items: items, sisaPotongan: need };
    if (need <= 0) return { items: items, sisaPotongan: 0 };
    var cadangan = Math.floor(need / n);
    var i;
    for (i = 0; i < n - 1; i++) {
      var pot = Math.min(cadangan, items[i].upah);
      items[i].potongan = pot;
      items[i].dibayar = items[i].upah - pot;
    }
    var already = 0;
    for (i = 0; i < n - 1; i++) already += items[i].potongan;
    var lastNeed = need - already;
    for (i = n - 1; i >= 0 && lastNeed > 0; i--) {
      var room = items[i].upah - items[i].potongan;
      var take = Math.min(room, lastNeed);
      items[i].potongan += take;
      items[i].dibayar = items[i].upah - items[i].potongan;
      lastNeed -= take;
    }
    items.forEach(function (it) {
      if (it.dibayar < 0) it.dibayar = 0;
    });
    return { items: items, sisaPotongan: lastNeed };
  }

  function siklusBuildPays(k, p, hariKerja, libur, absensi) {
    var siklus =
      typeof normalizeSiklusGaji === 'function'
        ? normalizeSiklusGaji(k && k.siklus_gaji)
        : String((k && k.siklus_gaji) || 'bulanan');
    var rate = Math.round(Number(k && k.gapok) || 0);
    var start = p && p.start;
    var end = p && p.end;
    var masuk = k && k.masuk;
    var stop = k && k.tgl_berhenti;
    if (siklus === 'harian') {
      return siklusTanggalBayarHarian(start, end, hariKerja, libur, masuk, stop, absensi).map(
        function (d) {
          return { tgl: d.tgl, upah: Math.round(rate * d.factor), parsial: false };
        }
      );
    }
    if (siklus === 'mingguan') {
      var hariGaji = normalizeHariGaji(k && k.hari_gaji);
      var dates = siklusTanggalBayarMingguan(
        start,
        end,
        hariGaji,
        hariKerja,
        libur,
        masuk,
        stop
      );
      var pays = dates.map(function (tgl) {
        return { tgl: tgl, upah: rate, parsial: false };
      });
      var part = siklusBayarParsialResign(
        start,
        end,
        stop,
        hariGaji,
        hariKerja,
        libur,
        rate,
        masuk
      );
      if (part && part.upah > 0) pays.push(part);
      pays.sort(function (a, b) {
        return String(a.tgl).localeCompare(String(b.tgl));
      });
      return pays;
    }
    return [{ tgl: (p && (p.bayar || p.end)) || end, upah: rate, parsial: false }];
  }

  var api = {
    isoAddDays: isoAddDays,
    isoDow: isoDow,
    liburSetFrom: liburSetFrom,
    normalizeHariGaji: normalizeHariGaji,
    siklusIsHariKerja: siklusIsHariKerja,
    siklusTanggalBayar: siklusTanggalBayar,
    siklusTanggalBayarMingguan: siklusTanggalBayarMingguan,
    siklusTanggalBayarHarian: siklusTanggalBayarHarian,
    siklusBayarParsialResign: siklusBayarParsialResign,
    siklusBpjsUpahSebulan: siklusBpjsUpahSebulan,
    pecahPotonganCadangan: pecahPotonganCadangan,
    siklusBuildPays: siklusBuildPays,
  };

  Object.keys(api).forEach(function (key) {
    root[key] = api[key];
  });
  if (typeof window !== 'undefined') {
    Object.keys(api).forEach(function (key) {
      window[key] = api[key];
    });
  }
})(typeof globalThis !== 'undefined' ? globalThis : this);
