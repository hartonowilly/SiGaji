/**
 * Optimasi hitungGaji (indeks absensi per bulan, cache satu render, cache hari kerja / meta periode)
 * tidak boleh mengubah angka: dibandingkan dengan jalur tanpa indeks/cache pada data yang sengaja rumit
 * (tanggal format campuran, cuti bersama, periode lintas tahun, prorata, koreksi absensi, resign).
 * Jalankan: node tests/hitung-cepat-setara.test.mjs
 */
import { loadPayrollCore } from './lib/payroll-harness.mjs';

let failed = 0;
function assert(name, cond, extra) {
  if (!cond) {
    failed++;
    console.error('GAGAL: ' + name + (extra !== undefined ? ' — ' + JSON.stringify(extra).slice(0, 400) : ''));
  } else console.log('OK: ' + name);
}

const pad = (n) => String(n).padStart(2, '0');
const iso = (d) => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
const NAMA = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
let seed = 7;
const rnd = (n) => ((seed = (seed * 1103515245 + 12345) % 2147483648) % n);

function dataset() {
  const periodes = [];
  for (let i = 0; i < 26; i++) {
    const s = new Date(2024, i - 1, 25);
    const e = new Date(2024, i, 24);
    periodes.push({
      id: i + 1,
      nama: NAMA[e.getMonth()] + ' ' + e.getFullYear(),
      start: iso(s),
      end: iso(e),
      bayar: iso(new Date(e.getFullYear(), e.getMonth(), 25)),
      status: i === 25 ? 'aktif' : 'tutup',
      tipe_periode: e.getMonth() === 11 ? 'desember' : 'normal',
      snapshot_locked: i < 25,
    });
  }
  const hariLibur = [
    { tgl: '2024-12-26', nama: 'CB Natal', tipe: 'cuti-bersama' },
    { tgl: '2025-01-01', nama: 'Tahun Baru', tipe: 'libnas' },
    { tgl: '2025-04-02', nama: 'CB Lebaran', tipe: 'cuti-bersama' },
    { tgl: '2025-12-26', nama: 'CB Natal', tipe: 'cuti-bersama' },
  ];
  const ST = ['hadir', 'hadir', 'hadir', 'izin', 'sakit', 'alpha', 'cuti', 'cuti', 'setengah_sakit', 'setengah_ijin'];
  const karyawan = [];
  const absensi = {};
  const prorata = {};
  const karSnapshot = {};
  for (let i = 0; i < 12; i++) {
    const nik = 'S' + pad(i);
    const k = {
      nik,
      nama: 'Setara ' + i,
      gapok: 4_500_000 + i * 350_000,
      ptkp: ['TK0', 'K0', 'K1', 'K3'][i % 4],
      masuk: i === 3 ? '2024-06-10' : '2018-03-01',
      tunjangan: [{ nama: 'Transport', nilai: 250_000 }],
      potongan: [],
      natura: [],
      bpjs_aktif: { 'kes-prs': true, 'kes-kar': true, 'jht-prs': true, 'jht-kar': true, 'jkk-prs': true, 'jkm-prs': true },
    };
    if (i === 5) k.tgl_berhenti = '2025-11-10';
    karyawan.push(k);
    absensi[nik] = {};
    periodes.forEach((p) => {
      for (let d = new Date(p.start + 'T12:00:00'); iso(d) <= p.end; d.setDate(d.getDate() + 1)) {
        if (rnd(3) === 0) continue;
        const day = iso(d);
        // Sebagian kunci berformat lain (impor lama / salin-tempel) — harus tetap ikut terhitung.
        const key = rnd(17) === 0 ? pad(d.getDate()) + '/' + pad(d.getMonth() + 1) + '/' + d.getFullYear() : day;
        absensi[nik][key] = ST[rnd(ST.length)];
      }
      if (rnd(5) === 0) (karSnapshot[p.nama] = karSnapshot[p.nama] || {})[nik] = Object.assign({}, k, { gapok: k.gapok - 200_000 });
    });
    prorata[nik] = { [periodes[10].nama]: { enabled: true, hk: 22, hh: 11 + (i % 7), manual: true } };
  }
  return { periodes, hariLibur, karyawan, absensi, prorata, karSnapshot };
}

function core() {
  const d = dataset();
  const px = loadPayrollCore(Object.assign(d, { masterCuti: { cbPotong: true, kuota: 12 }, perusahaan: { hariKerja: 5 } }));
  // Baseline saat dikunci lalu absensi diubah (koreksi bulan berikutnya harus muncul).
  px.sigajiWithHitungCache(() => {
    d.periodes.forEach((p) => {
      if (!p.snapshot_locked) return;
      p.absensi_pot_baseline = {};
      d.karyawan.forEach((k) => {
        p.absensi_pot_baseline[k.nik] = { total: px.sigajiPotKehadiranUntukPeriodeNik(k.nik, p).total, details: [] };
      });
    });
  });
  d.karyawan.forEach((k, i) => {
    const p = d.periodes[20 + (i % 4)];
    px.absensi[k.nik][p.start] = i % 2 ? 'alpha' : 'hadir';
  });
  return px;
}

/** Hitung tanpa indeks absensi & tanpa cache satu render (jalur asli). */
function plain(px, fn) {
  const save = { idx: px.sigajiAbsensiIndex, scope: px.sigajiHitungScopeNik };
  px.sigajiAbsensiIndex = () => null;
  px.sigajiHitungScopeNik = () => ({ idx: null, pot: new Map() });
  try {
    return fn();
  } finally {
    px.sigajiAbsensiIndex = save.idx;
    px.sigajiHitungScopeNik = save.scope;
  }
}

const px = core();
const strip = (g) => JSON.stringify(g);
let diff = null;
let n = 0;
let koreksi = 0;
const cepat = {};
px.sigajiWithHitungCache(() => {
  px.periodes.forEach((p) =>
    px.karyawan.forEach((k) => {
      cepat[k.nik + '@' + p.nama] = strip(px.hitungGaji(k, p.nama));
    })
  );
});
plain(px, () => {
  px.periodes.forEach((p) =>
    px.karyawan.forEach((k) => {
      const g = px.hitungGaji(k, p.nama);
      n++;
      if (g.koreksiAbsensi && g.koreksiAbsensi.total) koreksi++;
      const a = cepat[k.nik + '@' + p.nama];
      if (!diff && a !== strip(g)) diff = { nik: k.nik, periode: p.nama, cepat: a, asli: strip(g) };
    })
  );
});
assert('data uji memicu koreksi absensi periode terkunci', koreksi > 5, koreksi);
assert('hasil hitungGaji identik dengan jalur tanpa indeks/cache (' + n + ' kombinasi karyawan × periode)', !diff, diff);

const tanggalLain = Object.keys(px.absensi.S00).filter((t) => t.includes('/'));
assert('data uji berisi tanggal berformat dd/mm/yyyy', tanggalLain.length > 0);
const p0 = px.periodes.find((p) => tanggalLain.some((t) => px.toIsoDate(t) >= p.start && px.toIsoDate(t) <= p.end));
const idx = px.sigajiAbsensiIndex('S00');
const a = px.hitungPotonganKehadiran('S00', p0, 21, 5_000_000);
const b = px.hitungPotonganKehadiran('S00', p0, 21, 5_000_000, idx);
assert('potongan kehadiran: indeks per bulan = pindai semua tanggal', JSON.stringify(a) === JSON.stringify(b), { a, b });

const p = px.periodes[3];
const hk1 = px.hariKerjaRange(p.start, p.end);
px.hariLibur.push({ tgl: p.end, nama: 'Libur baru', tipe: 'libnas' });
const hk2 = px.hariKerjaRange(p.start, p.end);
const endDow = new Date(p.end + 'T12:00:00').getDay();
assert('hari kerja: libur baru langsung terhitung (cache tidak basi)', endDow === 0 || endDow === 6 ? hk2 === hk1 : hk2 === hk1 - 1, { hk1, hk2 });
px.hariLibur.pop();

const meta1 = px.sigajiPeriodePayrollMeta(p).ym;
const old = p.nama;
p.nama = 'Desember 2030';
assert('meta periode: nama diubah → bulan gaji ikut berubah', px.sigajiPeriodePayrollMeta(p).ym === '2030-12' && meta1 !== '2030-12');
p.nama = old;

const k0 = px.karyawan[0];
px.karyawan.unshift({ nik: 'BARU', gapok: 1 });
assert('cari karyawan per NIK tetap benar setelah daftar berubah', px.sigajiKarByNik(k0.nik) === k0 && px.sigajiKarByNik('BARU').gapok === 1);
px.karyawan.shift();
assert('NIK yang tidak ada → null', px.sigajiKarByNik('TIDAK-ADA') === null);

assert('toIsoDate: format lain tetap dinormalisasi', px.toIsoDate('05/01/2025') === '2025-01-05' && px.toIsoDate('2025-01-05T10:00:00Z') === '2025-01-05' && px.toIsoDate('2025-1-5') !== '2025-1-5');

if (failed) {
  console.error('\n' + failed + ' tes hitung cepat gagal.');
  process.exit(1);
}
console.log('\nHitung cepat setara: semua tes lulus.');
