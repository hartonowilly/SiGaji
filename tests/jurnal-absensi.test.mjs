/**
 * Jurnal absensi yang belum sampai awan: klik absensi lalu halaman ditutup sebelum unggahan selesai →
 * setelah dibuka lagi dan data awan termuat (menimpa memori), klik tadi dipulihkan dan dikirim ulang.
 * Jalankan: node tests/jurnal-absensi.test.mjs
 */
import fs from 'fs';
import path from 'path';
import vm from 'vm';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');

function assert(name, cond) {
  if (!cond) throw new Error('FAIL: ' + name);
  console.log('OK: ' + name);
}

function makeLocalStorage() {
  const map = new Map();
  return {
    map,
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => map.set(k, String(v)),
    removeItem: (k) => map.delete(k),
  };
}

/** Satu "buka halaman": constants.js + storage.js di konteks baru, localStorage yang sama. */
function boot(ls, opts) {
  opts = opts || {};
  const queued = [];
  const sandbox = {
    console: { log() {}, warn() {}, error() {} },
    setTimeout,
    clearTimeout,
    structuredClone,
    localStorage: ls,
    document: { getElementById: () => null, addEventListener() {}, visibilityState: 'visible' },
    addEventListener() {},
    sigajiCatchWarn() {},
    toast() {},
    sigajiIdb: undefined,
  };
  sandbox.window = sandbox;
  if (opts.cloud !== false) sandbox.sigajiQueueCloudSave = () => queued.push(Date.now());
  if (opts.canUpload != null) sandbox.sigajiCanUploadCloudPayload = () => opts.canUpload;
  if (opts.lockedDates) sandbox.canEditAbsensiPadaTanggalIso = (iso) => opts.lockedDates.indexOf(iso) < 0;
  const ctx = vm.createContext(sandbox);
  for (const rel of ['js/constants.js', 'js/storage.js']) {
    vm.runInContext(fs.readFileSync(path.join(ROOT, rel), 'utf8'), ctx, { filename: rel });
  }
  return { ctx, queued, run: (code) => vm.runInContext(code, ctx) };
}

const KAR = [
  { nik: 'K0001', nama: 'Satu' },
  { nik: 'K0002', nama: 'Dua' },
];
const CLOUD = { karyawan: KAR, periodes: [{ nama: 'Oktober 2026', start: '2026-10-01', end: '2026-10-31' }], absensi: {} };

// 1. Klik → ditutup sebelum unggah → buka lagi: awan menimpa memori, jurnal memulihkan & mengantre unggah.
{
  const ls = makeLocalStorage();
  const a = boot(ls);
  a.ctx.__k = KAR;
  a.run('karyawan=__k;absensi={};');
  a.run('sigajiJurnalAbsensiCatat("K0001","2026-10-05","sakit");absensi.K0001={"2026-10-05":"sakit"};saveAll();');
  a.run('sigajiJurnalAbsensiCatat("K0002","2026-10-06","alpha");absensi.K0002={"2026-10-06":"alpha"};saveAll();');
  assert('jurnal tercatat 2 klik', JSON.parse(ls.getItem('sigaji_jurnal_absensi')).length === 2);
  // Halaman ditutup; unggahan tidak pernah selesai (tidak ada sigajiJurnalAbsensiSelesai).

  const b = boot(ls);
  b.ctx.__cloud = structuredClone(CLOUD);
  b.run('applyDbFromCloudPayload(__cloud);');
  assert('awan menimpa memori: absensi kosong', Object.keys(b.run('absensi')).length === 0);
  const n = b.run('sigajiJurnalAbsensiPutar()');
  assert('2 klik dipulihkan', n === 2);
  assert('K0001 5 Okt sakit kembali', b.run('absensi.K0001["2026-10-05"]') === 'sakit');
  assert('K0002 6 Okt alpha kembali', b.run('absensi.K0002["2026-10-06"]') === 'alpha');
  assert('unggah ulang diantrekan', b.queued.length >= 1);
  assert('jurnal masih ada sampai unggahan sukses', JSON.parse(ls.getItem('sigaji_jurnal_absensi')).length === 2);

  // Unggahan sukses: payload dibangun sesudah entri → jurnal bersih.
  b.run('sigajiJurnalAbsensiSelesai(Date.now()+1)');
  assert('jurnal bersih setelah unggahan sukses', ls.getItem('sigaji_jurnal_absensi') == null);
}

// 2. Klik yang terjadi SAAT unggahan berjalan tidak ikut terhapus.
{
  const ls = makeLocalStorage();
  const a = boot(ls);
  a.ctx.__k = KAR;
  a.run('karyawan=__k;absensi={};');
  const t0 = Date.now() - 50;
  a.run('sigajiJurnalAbsensiCatat("K0001","2026-10-05","sakit")');
  const list = JSON.parse(ls.getItem('sigaji_jurnal_absensi'));
  list[0].t = t0 - 10; // klik lama, sebelum payload dibangun
  list.push({ nik: 'K0002', tgl: '2026-10-07', status: 'izin', t: t0 + 20 }); // klik baru, sesudahnya
  ls.setItem('sigaji_jurnal_absensi', JSON.stringify(list));
  a.run('sigajiJurnalAbsensiSelesai(' + t0 + ')');
  const sisa = JSON.parse(ls.getItem('sigaji_jurnal_absensi'));
  assert('hanya klik sebelum payload yang dihapus', sisa.length === 1 && sisa[0].nik === 'K0002');
}

// 3. Klik berulang pada sel yang sama: hanya status terakhir yang dipulihkan; sel dikosongkan ikut dipulihkan.
{
  const ls = makeLocalStorage();
  const a = boot(ls);
  a.ctx.__k = KAR;
  a.run('karyawan=__k;absensi={};');
  a.run('sigajiJurnalAbsensiCatat("K0001","2026-10-05","sakit");sigajiJurnalAbsensiCatat("K0001","2026-10-05","izin");');
  a.run('sigajiJurnalAbsensiCatat("K0001","2026-10-06",null);');
  assert('sel sama tidak dobel', JSON.parse(ls.getItem('sigaji_jurnal_absensi')).length === 2);
  const b = boot(ls);
  b.ctx.__cloud = structuredClone(CLOUD);
  b.ctx.__cloud.absensi = { K0001: { '2026-10-05': 'hadir', '2026-10-06': 'cuti' } };
  b.run('applyDbFromCloudPayload(__cloud);');
  b.run('sigajiJurnalAbsensiPutar()');
  assert('status terakhir (izin) yang dipakai', b.run('absensi.K0001["2026-10-05"]') === 'izin');
  assert('sel yang dikosongkan ikut dikosongkan', b.run('absensi.K0001["2026-10-06"]') === undefined);
}

// 4. Entri yang tidak relevan dibuang: karyawan tak terlihat (cabang lain / terhapus), tanggal terkunci, terlalu lama.
{
  const ls = makeLocalStorage();
  const a = boot(ls);
  a.ctx.__k = KAR;
  a.run('karyawan=__k;absensi={};');
  a.run('sigajiJurnalAbsensiCatat("K0001","2026-10-05","sakit");sigajiJurnalAbsensiCatat("K0001","2026-09-01","alpha");sigajiJurnalAbsensiCatat("K0009","2026-10-05","sakit");');
  const list = JSON.parse(ls.getItem('sigaji_jurnal_absensi'));
  list.push({ nik: 'K0002', tgl: '2026-10-02', status: 'izin', t: Date.now() - 4 * 24 * 60 * 60 * 1000 });
  ls.setItem('sigaji_jurnal_absensi', JSON.stringify(list));
  const b = boot(ls, { lockedDates: ['2026-09-01'] });
  b.ctx.__cloud = structuredClone(CLOUD);
  b.run('applyDbFromCloudPayload(__cloud);');
  const n = b.run('sigajiJurnalAbsensiPutar()');
  assert('hanya 1 klik yang sah dipulihkan', n === 1);
  assert('karyawan tak terlihat tidak dibuat', b.run('absensi.K0009') === undefined);
  assert('tanggal terkunci tidak disentuh', b.run('absensi.K0001["2026-09-01"]') === undefined);
  assert('klik > 3 hari dibuang', b.run('absensi.K0002') === undefined);
  assert('jurnal hanya menyisakan yang sah', JSON.parse(ls.getItem('sigaji_jurnal_absensi')).length === 1);
}

// 5. Tanpa awan / akun tidak boleh mengunggah: tidak ada jurnal.
{
  const ls = makeLocalStorage();
  const a = boot(ls, { cloud: false });
  a.ctx.__k = KAR;
  a.run('karyawan=__k;absensi={};sigajiJurnalAbsensiCatat("K0001","2026-10-05","sakit");');
  assert('tanpa awan: jurnal kosong', ls.getItem('sigaji_jurnal_absensi') == null);
  const c = boot(ls, { canUpload: false });
  c.ctx.__k = KAR;
  c.run('karyawan=__k;absensi={};sigajiJurnalAbsensiCatat("K0001","2026-10-05","sakit");');
  assert('akun Karyawan: jurnal kosong', ls.getItem('sigaji_jurnal_absensi') == null);
  assert('putar tanpa jurnal = 0', c.run('sigajiJurnalAbsensiPutar()') === 0);
}

console.log('\nJurnal absensi: semua tes lulus.');
