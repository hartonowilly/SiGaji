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
   * Minggu pertama setelah tanggal masuk: upah hari kerja dari tgl masuk s.d. payday
   * Jumat pertama. Termasuk join di celah setelah payday sebelumnya (meski masuk ≤ awal periode).
   */
  function siklusBayarParsialMasuk(start, end, masuk, hariGaji, hariKerja, libur, rate, stop) {
    if (!masuk) return null;
    var masukIso = String(masuk).slice(0, 10);
    var startIso = String(start).slice(0, 10);
    if (!masukIso) return null;
    var prevPay = siklusPaydaySebelum(startIso, hariGaji, hariKerja, libur);
    if (prevPay && masukIso <= prevPay) return null;
    var pays = siklusTanggalBayarMingguan(start, end, hariGaji, hariKerja, libur, masuk, stop);
    if (!pays.length) return null;
    var firstPay = pays[0];
    var hkM = hariKerja === 5 ? 5 : 6;
    var days = siklusHariKerjaCount(masukIso, firstPay, hariKerja, libur, masuk, stop);
    if (days <= 0 || days >= hkM) return null;
    return {
      tgl: firstPay,
      upah: Math.round((Number(rate) || 0) / hkM * days),
      hari: days,
      parsial: true,
    };
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

  function siklusAturanPotongan() {
    return (typeof perusahaan !== 'undefined' && perusahaan && perusahaan.aturan_potongan) || {};
  }

  function siklusModePotongan(aturan, key, fallback) {
    var slot = (aturan || {})[key];
    var mode = slot && slot.mode != null ? String(slot.mode) : '';
    return mode || fallback;
  }

  function siklusMingguanFaktorCuti(dalamKuota, aturan) {
    var key = dalamKuota ? 'cuti_dalam_kuota' : 'cuti_luar_kuota';
    var fallback = dalamKuota ? 'tidak_dipotong' : 'prorata';
    var mode = siklusModePotongan(aturan, key, fallback);
    if (mode === 'tidak_dipotong') return 0;
    if (mode === 'prorata_setengah') return 0.5;
    return 1;
  }

  /** 0 = tetap dibayar, 1 = potong 1 hari, 0.5 = setengah. Cuti dalam kuota default tidak dipotong. */
  function siklusMingguanFaktorPotong(st, aturan) {
    aturan = aturan || siklusAturanPotongan();
    if (st === 'cuti') {
      return siklusMingguanFaktorCuti(true, aturan);
    }
    if (st === 'alpha') {
      return siklusModePotongan(aturan, 'alpha', 'prorata') === 'tidak_dipotong' ? 0 : 1;
    }
    if (st === 'izin') {
      return siklusModePotongan(aturan, 'izin', 'prorata') === 'tidak_dipotong' ? 0 : 1;
    }
    if (st === 'sakit') {
      return siklusModePotongan(aturan, 'sakit', 'prorata') === 'tidak_dipotong' ? 0 : 1;
    }
    if (st === 'setengah_sakit') {
      var ms = siklusModePotongan(aturan, 'setengah_sakit', 'prorata_setengah');
      if (ms === 'tidak_dipotong') return 0;
      return 0.5;
    }
    if (st === 'setengah_ijin') {
      var mi = siklusModePotongan(aturan, 'setengah_ijin', 'prorata_setengah');
      if (mi === 'tidak_dipotong') return 0;
      return 0.5;
    }
    return 0;
  }

  function siklusCutiTerpakaiSebelum(k, beforeIso, absensi) {
    var batas = String(beforeIso || '').slice(0, 10);
    if (!batas) return 0;
    var yr = batas.slice(0, 4);
    var n = 0;
    var abs = absensi || {};
    var nik = k && k.nik;
    var masuk = k && k.masuk ? String(k.masuk).slice(0, 10) : '';
    var stop = k && k.tgl_berhenti ? String(k.tgl_berhenti).slice(0, 10) : '';
    Object.keys(abs).forEach(function (raw) {
      if (abs[raw] !== 'cuti') return;
      var d = typeof toIsoDate === 'function' ? toIsoDate(raw) : String(raw).slice(0, 10);
      if (!d || d.slice(0, 4) !== yr) return;
      if (d >= batas) return;
      if (masuk && d < masuk) return;
      if (stop && d >= stop) return;
      if (typeof isCutiBersamaPotongKuotaTgl === 'function' && isCutiBersamaPotongKuotaTgl(d)) return;
      if (typeof cutiDalamMasaKerja === 'function' && nik && !cutiDalamMasaKerja(d, nik)) return;
      n++;
    });
    var sampai = isoAddDays(batas, -1);
    if (typeof countCutiBersama === 'function') n += countCutiBersama(yr, nik, sampai) || 0;
    return n;
  }

  /** Jumlah hari kerja tidak dibayar di rentang minggu, mengikuti aturan potongan perusahaan. */
  function siklusMingguanHariTidakDibayar(from, to, hariKerja, libur, masuk, stop, absensi, aturan, k) {
    var n = 0;
    var abs = absensi || {};
    var masukIso = masuk ? String(masuk).slice(0, 10) : '';
    var stopIso = stop ? String(stop).slice(0, 10) : '';
    aturan = aturan || siklusAturanPotongan();
    var sisaKuota = null;
    if (k) {
      var yr = String(from || '').slice(0, 4);
      var kuota = typeof kuotaCutiKaryawan === 'function' ? kuotaCutiKaryawan(k, yr) : 12;
      sisaKuota = Math.max(0, kuota - siklusCutiTerpakaiSebelum(k, from, abs));
    }
    eachDate(from, to, function (d) {
      if (masukIso && d < masukIso) return;
      if (stopIso && d >= stopIso) return;
      if (!siklusIsHariKerja(d, hariKerja, libur)) return;
      var st = abs[d] || 'hadir';
      if (st === 'cuti' && sisaKuota != null) {
        if (sisaKuota > 0) {
          sisaKuota--;
          n += siklusMingguanFaktorCuti(true, aturan);
        } else {
          n += siklusMingguanFaktorCuti(false, aturan);
        }
        return;
      }
      n += siklusMingguanFaktorPotong(st, aturan);
    });
    return n;
  }

  /** Jumat gaji terakhir sebelum tanggal (untuk celah antar-periode). */
  function siklusPaydaySebelum(beforeIso, hariGaji, hariKerja, libur) {
    var batas = String(beforeIso || '').slice(0, 10);
    if (!batas) return '';
    hariGaji = normalizeHariGaji(hariGaji);
    var d = isoAddDays(batas, -1);
    var guard = 0;
    while (d && guard < 21) {
      if (isoDow(d) === hariGaji) {
        var pay = siklusTanggalBayar(d, hariKerja, libur);
        if (pay && pay < batas) return pay;
      }
      d = isoAddDays(d, -1);
      guard++;
    }
    return '';
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
    var rate = Math.round(sigajiRp(k && k.gapok));
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
      var hkM = hariKerja === 5 ? 5 : 6;
      var startIso = String(start || '').slice(0, 10);
      var partMasuk = siklusBayarParsialMasuk(
        start,
        end,
        masuk,
        hariGaji,
        hariKerja,
        libur,
        rate,
        stop
      );
      var prevPay0 = siklusPaydaySebelum(startIso, hariGaji, hariKerja, libur);
      var aturanPot = siklusAturanPotongan();
      var pays = dates.map(function (tgl, i) {
        var from;
        if (i === 0) {
          from = prevPay0 ? isoAddDays(prevPay0, 1) : startIso;
        } else {
          from = isoAddDays(dates[i - 1], 1);
        }
        var unpaid = siklusMingguanHariTidakDibayar(
          from,
          tgl,
          hariKerja,
          libur,
          masuk,
          stop,
          absensi,
          aturanPot,
          k
        );
        var base = rate;
        var parsial = false;
        if (partMasuk && tgl === partMasuk.tgl) {
          base = partMasuk.upah;
          parsial = true;
        }
        var pot = Math.round((Number(rate) || 0) / hkM * unpaid);
        var upah = Math.max(0, base - pot);
        if (pot > 0) parsial = true;
        return { tgl: tgl, upah: upah, parsial: parsial };
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
    siklusPaydaySebelum: siklusPaydaySebelum,
    siklusBayarParsialMasuk: siklusBayarParsialMasuk,
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
