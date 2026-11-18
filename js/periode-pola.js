/**
 * Pola tanggal periode gaji (1–akhir, 25–24, 21–20) dan rancangan bulan berikutnya.
 */
function sigajiPad2(n) {
  return String(n).padStart(2, '0');
}
function sigajiLastDayOfMonth(y, m0) {
  return new Date(y, m0 + 1, 0).getDate();
}
function sigajiIsoYmd(y, m0, day) {
  return y + '-' + sigajiPad2(m0 + 1) + '-' + sigajiPad2(day);
}
function sigajiParseIsoYmd(iso) {
  var s = String(iso || '').slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  return {
    y: parseInt(s.slice(0, 4), 10),
    m0: parseInt(s.slice(5, 7), 10) - 1,
    d: parseInt(s.slice(8, 10), 10),
  };
}
function sigajiNamaBulanTahun(m0, tahun) {
  var bulan = [
    'Januari',
    'Februari',
    'Maret',
    'April',
    'Mei',
    'Juni',
    'Juli',
    'Agustus',
    'September',
    'Oktober',
    'November',
    'Desember',
  ];
  var i = ((m0 % 12) + 12) % 12;
  return bulan[i] + ' ' + tahun;
}
function sigajiGeserBulan(y, m0, delta) {
  var n = y * 12 + m0 + delta;
  return { y: Math.floor(n / 12), m0: ((n % 12) + 12) % 12 };
}
function sigajiGeserIsoSatuBulan(iso, delta) {
  var p = sigajiParseIsoYmd(iso);
  if (!p) return '';
  var n = sigajiGeserBulan(p.y, p.m0, delta);
  var last = sigajiLastDayOfMonth(n.y, n.m0);
  var d = p.d > last ? last : p.d;
  return sigajiIsoYmd(n.y, n.m0, d);
}
/**
 * Patokan hari gajian: angka 1–31, atau 'akhir' (31 / selalu hari terakhir).
 * 28 Feb dan 30 Nov adalah akhir bulan kalender, tetapi bukan “gajian akhir bulan”.
 * Lihat 2–3 periode: kalau ada yang bukan akhir bulan (mis. 28 Jan), patokannya tanggal itu.
 */
function sigajiPatokanHariBayar(p, riwayat) {
  var dates = [];
  function push(x) {
    if (!x || !x.bayar) return;
    var parsed = sigajiParseIsoYmd(x.bayar);
    if (!parsed) return;
    dates.push({
      d: parsed.d,
      last: sigajiLastDayOfMonth(parsed.y, parsed.m0),
    });
  }
  push(p);
  var list = (riwayat && riwayat.length
    ? riwayat
    : typeof periodes !== 'undefined' && periodes
      ? periodes
      : []
  ).slice();
  list.sort(function (a, b) {
    return String((b && b.start) || '').localeCompare(String((a && a.start) || ''));
  });
  var i;
  var n = 0;
  var pStart = p && p.start ? String(p.start) : '';
  var pNama = p && p.nama;
  for (i = 0; i < list.length && n < 2; i++) {
    var x = list[i];
    if (!x) continue;
    if (pNama && x.nama === pNama && String(x.start || '') === pStart) continue;
    if (pStart && x.start && String(x.start) >= pStart) continue;
    push(x);
    n++;
  }
  var bukanAkhir = [];
  var maxD = 0;
  for (i = 0; i < dates.length; i++) {
    maxD = Math.max(maxD, dates[i].d);
    if (dates[i].d !== dates[i].last) bukanAkhir.push(dates[i].d);
  }
  if (bukanAkhir.length) return bukanAkhir[0];
  if (maxD >= 31) return 'akhir';
  return dates.length ? dates[0].d : 0;
}
function sigajiIsoBayarDariPatokan(fromIso, delta, patokan) {
  var p = sigajiParseIsoYmd(fromIso);
  if (!p) return '';
  var n = sigajiGeserBulan(p.y, p.m0, delta);
  var last = sigajiLastDayOfMonth(n.y, n.m0);
  if (patokan === 'akhir') return sigajiIsoYmd(n.y, n.m0, last);
  var d = parseInt(patokan, 10);
  if (!(d > 0)) d = p.d;
  if (d > last) d = last;
  return sigajiIsoYmd(n.y, n.m0, d);
}
/** Geser 1 bulan: tgl 28 tetap 28; hanya tgl 31 yang mengikuti akhir bulan. */
function sigajiGeserTanggalBayar(iso, delta) {
  var p = sigajiParseIsoYmd(iso);
  if (!p) return '';
  return sigajiIsoBayarDariPatokan(iso, delta, p.d >= 31 ? 'akhir' : p.d);
}
function sigajiInferPolaPeriode(p) {
  if (!p || !p.start || !p.end) return 'custom';
  var s = sigajiParseIsoYmd(p.start);
  var e = sigajiParseIsoYmd(p.end);
  if (!s || !e) return 'custom';
  var last = sigajiLastDayOfMonth(e.y, e.m0);
  if (s.d === 1 && e.d === last && s.y === e.y && s.m0 === e.m0) return '1-akhir';
  if (s.d === 25 && e.d === 24) return '25-24';
  if (s.d === 21 && e.d === 20) return '21-20';
  return 'custom';
}
function sigajiTanggalPolaUntukBulan(pola, y, m0) {
  var last = sigajiLastDayOfMonth(y, m0);
  if (pola === '1-akhir') {
    return { start: sigajiIsoYmd(y, m0, 1), end: sigajiIsoYmd(y, m0, last), bayar: sigajiIsoYmd(y, m0, last) };
  }
  if (pola === '25-24') {
    var prev = sigajiGeserBulan(y, m0, -1);
    return {
      start: sigajiIsoYmd(prev.y, prev.m0, 25),
      end: sigajiIsoYmd(y, m0, 24),
      bayar: sigajiIsoYmd(y, m0, 25),
    };
  }
  if (pola === '21-20') {
    var prev2 = sigajiGeserBulan(y, m0, -1);
    return {
      start: sigajiIsoYmd(prev2.y, prev2.m0, 21),
      end: sigajiIsoYmd(y, m0, 20),
      bayar: sigajiIsoYmd(y, m0, 21),
    };
  }
  return null;
}
function sigajiBulanGajiDariPeriode(p) {
  if (typeof parseNamaPeriodeBulanTahun === 'function') {
    var named = parseNamaPeriodeBulanTahun(p && p.nama);
    if (named) return { y: named.tahun, m0: named.bulan };
  }
  if (typeof sigajiPeriodePayrollMeta === 'function') {
    var meta = sigajiPeriodePayrollMeta(p);
    if (meta && meta.year && meta.month) return { y: meta.year, m0: meta.month - 1 };
  }
  var e = sigajiParseIsoYmd(p && p.end);
  if (e) return { y: e.y, m0: e.m0 };
  return null;
}
/** Rancangan periode bulan depan dari periode acuan. */
function sigajiRancangPeriodeBerikutnya(p, riwayat) {
  var bl = sigajiBulanGajiDariPeriode(p);
  if (!bl) return null;
  var next = sigajiGeserBulan(bl.y, bl.m0, 1);
  var pola = sigajiInferPolaPeriode(p);
  var tgl = sigajiTanggalPolaUntukBulan(pola, next.y, next.m0);
  if (!tgl) {
    tgl = {
      start: sigajiGeserIsoSatuBulan(p.start, 1),
      end: sigajiGeserIsoSatuBulan(p.end, 1),
    };
  }
  var patokan = sigajiPatokanHariBayar(p, riwayat);
  var bayar = p.bayar
    ? sigajiIsoBayarDariPatokan(p.bayar, 1, patokan)
    : tgl.bayar || sigajiIsoBayarDariPatokan(p.end, 1, patokan || 'akhir');
  tgl = { start: tgl.start, end: tgl.end, bayar: bayar };
  var bp = sigajiParseIsoYmd(tgl.bayar);
  var tipe = bp && bp.m0 === 11 ? 'desember' : 'normal';
  return {
    nama: sigajiNamaBulanTahun(next.m0, next.y),
    pola: pola,
    start: tgl.start,
    end: tgl.end,
    bayar: tgl.bayar,
    tipe_periode: tipe,
    opsi_lebih_bayar: tipe === 'desember' ? p.opsi_lebih_bayar || 'refund' : p.opsi_lebih_bayar || 'refund',
    thr_aktif: false,
  };
}
