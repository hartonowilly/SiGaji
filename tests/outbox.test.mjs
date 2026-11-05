/**
 * Outbox perubahan lokal yang belum sampai awan (js/outbox.js) — pengganti jurnal absensi.
 * Skenario: ubah data lalu halaman ditutup sebelum unggahan selesai → buka lagi, data awan
 * menimpa memori → outbox memulihkan perubahan dan mengantre unggah ulang.
 * Jalankan: node tests/outbox.test.mjs
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

/** Satu "buka halaman": constants + storage + cloud-delta + outbox di konteks baru, localStorage yang sama. */
function boot(ls, opts) {
  opts = opts || {};
  const queued = [];
  const counts = [];
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
    sigajiOutboxCountChanged: (n) => counts.push(n),
  };
  sandbox.window = sandbox;
  if (opts.cloud !== false) sandbox.sigajiQueueCloudSave = () => queued.push(Date.now());
  if (opts.canUpload != null) sandbox.sigajiCanUploadCloudPayload = () => opts.canUpload;
  if (opts.lockedDates) sandbox.canEditAbsensiPadaTanggalIso = (iso) => opts.lockedDates.indexOf(iso) < 0;
  const ctx = vm.createContext(sandbox);
  for (const rel of ['js/constants.js', 'js/storage.js', 'js/cloud-delta.js', 'js/outbox.js']) {
    vm.runInContext(fs.readFileSync(path.join(ROOT, rel), 'utf8'), ctx, { filename: rel });
  }
  return { ctx, queued, counts, run: (code) => vm.runInContext(code, ctx) };
}

const outbox = (ls) => {
  const raw = ls.getItem('sigaji_outbox');
  return raw ? JSON.parse(raw) : [];
};
const ids = (ls) => outbox(ls).map((e) => e.id).sort();

const KAR = [
  { nik: 'K0001', nama: 'Satu', gapok: 5000000 },
  { nik: 'K0002', nama: 'Dua', gapok: 6000000 },
];
const CLOUD = {
  karyawan: KAR,
  periodes: [{ nama: 'Oktober 2026', start: '2026-10-01', end: '2026-10-31' }],
  absensi: {},
  perusahaan: { nama: 'PT Awan', hariKerja: 6 },
};

// 1. Tanpa basis (awan belum pernah termuat sesi ini) → tidak mencatat apa pun.
{
  const ls = makeLocalStorage();
  const a = boot(ls);
  a.ctx.__k = structuredClone(KAR);
  a.run('karyawan=__k;absensi={};saveAll();');
  assert('tanpa basis: outbox kosong', ls.getItem('sigaji_outbox') == null);
  assert('adaBasis() false', a.run('sigajiOutbox.adaBasis()') === false);
}

// 2. Awan termuat → basis. Ubah absensi, karyawan, perusahaan, tambah karyawan baru → tercatat per entitas.
//    Halaman ditutup tanpa unggahan sukses → buka lagi, awan menimpa → putar() memulihkan semuanya.
{
  const ls = makeLocalStorage();
  const a = boot(ls);
  a.ctx.__cloud = structuredClone(CLOUD);
  a.run('applyDbFromCloudPayload(__cloud);');
  assert('basis terbentuk setelah awan termuat', a.run('sigajiOutbox.adaBasis()') === true);
  assert('belum ada perubahan: outbox kosong', ls.getItem('sigaji_outbox') == null);

  a.run('absensi.K0001={"2026-10-05":"sakit"};saveAll();');
  assert('1 entri absensi (per NIK per bulan)', ids(ls).join() === 'I|absensi|K0001|2026-10');
  a.run('karyawan[1].gapok=6500000;saveAll();');
  a.run('perusahaan.nama="PT Lokal";saveAll();');
  a.run('karyawan.push({nik:"K0003",nama:"Tiga",gapok:4000000});saveAll();');
  assert(
    'absensi + karyawan ubah + karyawan baru + perusahaan tercatat',
    ids(ls).join() === 'I|absensi|K0001|2026-10,K|K0002,K|K0003,S|perusahaan'
  );
  assert('indikator diberi tahu jumlah terakhir', a.counts[a.counts.length - 1] === 4);
  assert('unggah diantrekan', a.queued.length >= 4);

  // Halaman ditutup; unggahan tidak pernah selesai.
  const b = boot(ls);
  b.ctx.__cloud = structuredClone(CLOUD);
  b.run('applyDbFromCloudPayload(__cloud);');
  assert('awan menimpa memori: absensi kosong, nama PT Awan', Object.keys(b.run('absensi')).length === 0 && b.run('perusahaan.nama') === 'PT Awan');
  const n = b.run('sigajiOutbox.putar()');
  assert('4 entri dipulihkan', n === 4);
  assert('absensi K0001 5 Okt sakit kembali', b.run('absensi.K0001["2026-10-05"]') === 'sakit');
  assert('gapok K0002 kembali 6,5 jt', b.run('karyawan.find(k=>k.nik==="K0002").gapok') === 6500000);
  assert('karyawan baru K0003 kembali', b.run('karyawan.some(k=>k.nik==="K0003")') === true);
  assert('nama PT kembali PT Lokal', b.run('perusahaan.nama') === 'PT Lokal');
  assert('unggah ulang diantrekan', b.queued.length >= 1);
  assert('outbox masih berisi 4 sampai unggahan sukses', outbox(ls).length === 4);

  // Unggahan sukses (payload dibangun setelah semua entri) → outbox bersih, basis = memori.
  b.run('sigajiOutbox.selesai(Date.now()+1)');
  assert('outbox bersih setelah unggahan sukses', ls.getItem('sigaji_outbox') == null);
  b.run('saveAll()');
  assert('saveAll tanpa perubahan: tetap kosong', ls.getItem('sigaji_outbox') == null);
}

// 3. Perubahan SAAT unggahan berjalan tidak ikut dianggap terkirim.
{
  const ls = makeLocalStorage();
  const a = boot(ls);
  a.ctx.__cloud = structuredClone(CLOUD);
  a.run('applyDbFromCloudPayload(__cloud);');
  a.run('absensi.K0001={"2026-10-05":"sakit"};saveAll();');
  const dibangun = Date.now() + 5; // payload dibangun sesudah entri pertama
  await new Promise((r) => setTimeout(r, 15));
  a.run('absensi.K0002={"2026-10-07":"izin"};saveAll();'); // klik baru, sesudah payload dibangun
  a.run('sigajiOutbox.selesai(' + dibangun + ')');
  assert('hanya perubahan sesudah payload yang tersisa', ids(ls).join() === 'I|absensi|K0002|2026-10');
}

// 4. Sel sama diubah berulang → satu entri dengan status terakhir; sel dikosongkan ikut dipulihkan;
//    tanggal terkunci tidak disentuh; karyawan yang tak ada di awan tidak dibuatkan absensi.
{
  const ls = makeLocalStorage();
  const a = boot(ls);
  a.ctx.__cloud = structuredClone(CLOUD);
  a.ctx.__cloud.absensi = { K0001: { '2026-10-05': 'hadir', '2026-10-06': 'cuti', '2026-09-01': 'hadir' } };
  a.run('applyDbFromCloudPayload(__cloud);');
  a.run('absensi.K0001["2026-10-05"]="sakit";saveAll();absensi.K0001["2026-10-05"]="izin";saveAll();');
  a.run('delete absensi.K0001["2026-10-06"];saveAll();');
  a.run('delete absensi.K0001["2026-09-01"];saveAll();');
  a.run('absensi.K0009={"2026-10-05":"sakit"};saveAll();');
  assert('absensi K0001 Okt, Sep, dan K0009 tercatat', ids(ls).join() === 'I|absensi|K0001|2026-09,I|absensi|K0001|2026-10,I|absensi|K0009|2026-10');

  const b = boot(ls, { lockedDates: ['2026-09-01'] });
  b.ctx.__cloud = structuredClone(CLOUD);
  b.ctx.__cloud.absensi = { K0001: { '2026-10-05': 'hadir', '2026-10-06': 'cuti', '2026-09-01': 'hadir' } };
  b.run('applyDbFromCloudPayload(__cloud);');
  const n = b.run('sigajiOutbox.putar()');
  assert('hanya bulan Okt K0001 yang dipulihkan', n === 1);
  assert('status terakhir (izin) dipakai', b.run('absensi.K0001["2026-10-05"]') === 'izin');
  assert('sel yang dikosongkan ikut kosong', b.run('absensi.K0001["2026-10-06"]') === undefined);
  assert('tanggal terkunci tidak disentuh', b.run('absensi.K0001["2026-09-01"]') === 'hadir');
  assert('karyawan tak dikenal tidak dibuat', b.run('absensi.K0009') === undefined);
  assert('outbox dihitung ulang: hanya Okt K0001', ids(ls).join() === 'I|absensi|K0001|2026-10');
}

// 5. Entri kedaluwarsa (> 3 hari) dibuang; hapus karyawan massal mencurigakan tidak diputar.
{
  const ls = makeLocalStorage();
  const a = boot(ls);
  a.ctx.__cloud = structuredClone(CLOUD);
  a.run('applyDbFromCloudPayload(__cloud);');
  a.run('perusahaan.nama="Lama";saveAll();');
  const list = outbox(ls);
  list[0].ts = Date.now() - 4 * 24 * 60 * 60 * 1000;
  ls.setItem('sigaji_outbox', JSON.stringify(list));
  const b = boot(ls);
  b.ctx.__cloud = structuredClone(CLOUD);
  b.run('applyDbFromCloudPayload(__cloud);');
  assert('entri > 3 hari dibuang', b.run('sigajiOutbox.putar()') === 0 && b.run('perusahaan.nama') === 'PT Awan');
  assert('outbox dikosongkan', ls.getItem('sigaji_outbox') == null);

  const ls2 = makeLocalStorage();
  const c = boot(ls2);
  const banyak = [];
  for (let i = 1; i <= 10; i++) banyak.push({ nik: 'K' + String(i).padStart(4, '0'), nama: 'P' + i });
  c.ctx.__cloud = Object.assign(structuredClone(CLOUD), { karyawan: structuredClone(banyak) });
  c.run('applyDbFromCloudPayload(__cloud);');
  c.run('karyawan.splice(0,6);saveAll();');
  assert('6 penghapusan karyawan tercatat', outbox(ls2).filter((e) => e.t === 'K' && e.d === null).length === 6);
  const d = boot(ls2);
  d.ctx.__cloud = Object.assign(structuredClone(CLOUD), { karyawan: structuredClone(banyak) });
  d.run('applyDbFromCloudPayload(__cloud);');
  d.run('sigajiOutbox.putar()');
  assert('hapus massal (6 dari 10) tidak diputar', d.run('karyawan.length') === 10);
  assert('outbox dibersihkan dari penghapusan yang ditolak', ls2.getItem('sigaji_outbox') == null);
}

// 6. Perubahan yang ditarik dari awan (persistMemoryQuiet → tandaiBasis(-1)) bukan perubahan lokal,
//    tetapi entri yang sudah menunggu tetap menunggu.
{
  const ls = makeLocalStorage();
  const a = boot(ls);
  a.ctx.__cloud = structuredClone(CLOUD);
  a.run('applyDbFromCloudPayload(__cloud);');
  a.run('karyawan[0].gapok=5555555;saveAll();');
  assert('perubahan lokal K0001 menunggu', ids(ls).join() === 'K|K0001');
  // Tarik perubahan orang lain (K0002) ke memori, lalu perbarui basis sambil mempertahankan yang menunggu.
  a.run('karyawan[1].gapok=7000000;window.sigajiApplyingCloud=true;saveAll();window.sigajiApplyingCloud=false;sigajiOutbox.tandaiBasis(-1);');
  a.run('saveAll()');
  assert('K0002 (dari awan) tidak dianggap perubahan lokal; K0001 tetap menunggu', ids(ls).join() === 'K|K0001');
}

// 7. Tanpa awan / akun tidak boleh mengunggah: tidak ada outbox.
{
  const ls = makeLocalStorage();
  const a = boot(ls, { cloud: false });
  a.ctx.__cloud = structuredClone(CLOUD);
  a.run('applyDbFromCloudPayload(__cloud);perusahaan.nama="X";saveAll();');
  assert('tanpa awan: outbox kosong', ls.getItem('sigaji_outbox') == null);
  const c = boot(ls, { canUpload: false });
  c.ctx.__cloud = structuredClone(CLOUD);
  c.run('applyDbFromCloudPayload(__cloud);perusahaan.nama="X";saveAll();');
  assert('akun Karyawan: outbox kosong', ls.getItem('sigaji_outbox') == null);
  assert('putar tanpa outbox = 0', c.run('sigajiOutbox.putar()') === 0);
}

// 8. Store yang diabaikan (auditLog, notifikasi, bentoLayouts) tidak masuk outbox.
{
  const ls = makeLocalStorage();
  const a = boot(ls);
  a.ctx.__cloud = structuredClone(CLOUD);
  a.run('applyDbFromCloudPayload(__cloud);');
  a.run('auditLog.push({t:1});notifikasi.push({id:1});bentoLayouts.x=1;saveAll();');
  assert('auditLog/notifikasi/bentoLayouts diabaikan', ls.getItem('sigaji_outbox') == null);
}

{
  const ls = makeLocalStorage();
  const a = boot(ls);
  a.ctx.__cloud = structuredClone(CLOUD);
  a.run('applyDbFromCloudPayload(__cloud);');
  const now = Date.now();
  ls.setItem(
    'sigaji_outbox',
    JSON.stringify([
      {
        id: 'I|hasilGaji|Oktober 2026|K0001',
        t: 'I',
        key: { kind: 'hasilGaji', item_key: 'Oktober 2026|K0001' },
        nik: 'K0001',
        d: { neto: 111 },
        ts: now,
        j: 'x',
      },
    ])
  );
  a.run('periodes[0].snapshot_locked=false;');
  a.run('sigajiOutbox.putar()');
  assert(
    'outbox freeze tidak dipasang ke periode terbuka',
    a.run('periodes[0].hasil_gaji') == null
  );
}

{
  const ls = makeLocalStorage();
  const a = boot(ls);
  a.ctx.__cloud = structuredClone(CLOUD);
  a.run('applyDbFromCloudPayload(__cloud);');
  a.run("absensi.K0001={'2026-10-05':'sakit'};");
  a.run("sigajiCloudDelta.markDirtyAbsensi('K0001','2026-10-05');");
  const n = a.run('sigajiOutbox.catat()');
  assert('catat scoped: 1 entri absensi', n === 1);
  assert('catat scoped: id bulan Okt', ids(ls).join() === 'I|absensi|K0001|2026-10');
}

{
  const ls = makeLocalStorage();
  const a = boot(ls);
  a.ctx.__cloud = structuredClone(CLOUD);
  a.run('applyDbFromCloudPayload(__cloud);');
  a.run("absensi.K0001={'2026-10-05':'sakit'};");
  a.run("sigajiCloudDelta.markDirtyAbsensi('K0001','2026-10-05');");
  a.run("karyawan[0].nama='Nama Diubah';");
  a.run('saveAll()');
  const got = ids(ls);
  assert('saveAll tanpa delta: absensi tetap tercatat', got.indexOf('I|absensi|K0001|2026-10') >= 0);
  assert('saveAll tanpa delta: profil karyawan ikut tercatat', got.indexOf('K|K0001') >= 0);
}

{
  const ls = makeLocalStorage();
  const a = boot(ls);
  a.ctx.__cloud = structuredClone(CLOUD);
  a.run('applyDbFromCloudPayload(__cloud);');
  a.run("absensi.K0001={'2026-10-05':'sakit'};");
  a.run("sigajiCloudDelta.markDirtyAbsensi('K0001','2026-10-05');");
  a.run("karyawan[0].nama='Nama Diubah';");
  a.run('sigajiOutbox.catat()');
  assert(
    'catat scoped setelah edit profil tanpa markDirtyFull: hanya absensi (celah lama)',
    ids(ls).join() === 'I|absensi|K0001|2026-10'
  );
}

console.log('\nOutbox: semua tes lulus.');
