/**
 * Penyimpanan lokal skala besar: satu salinan localStorage, salinan ringkas bila data besar / kuota penuh,
 * salinan lengkap di IndexedDB, dan peringatan bila tidak ada yang tersimpan.
 * Jalankan: node tests/penyimpanan-lokal.test.mjs
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

function makeLocalStorage(quotaChars) {
  const map = new Map();
  const used = () => Array.from(map.entries()).reduce((s, [k, v]) => s + k.length + v.length, 0);
  return {
    map,
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => {
      v = String(v);
      const prev = map.has(k) ? k.length + map.get(k).length : 0;
      if (quotaChars && used() - prev + k.length + v.length > quotaChars) {
        const e = new Error('quota');
        e.name = 'QuotaExceededError';
        throw e;
      }
      map.set(k, v);
    },
    removeItem: (k) => map.delete(k),
  };
}

function makeIdb(available) {
  const map = new Map();
  return {
    map,
    available: () => available,
    get: (k) => Promise.resolve(map.has(k) ? structuredClone(map.get(k)) : undefined),
    put: (k, v) => {
      map.set(k, structuredClone(v));
      return Promise.resolve();
    },
    del: (k) => {
      map.delete(k);
      return Promise.resolve();
    },
  };
}

/** Satu "buka halaman": constants.js + storage.js dimuat ulang di konteks baru dengan penyimpanan yang sama. */
function boot(ls, idb) {
  const toasts = [];
  const sandbox = {
    console: { log() {}, warn() {}, error() {} },
    setTimeout,
    clearTimeout,
    structuredClone,
    localStorage: ls,
    document: { getElementById: () => null, addEventListener() {}, visibilityState: 'visible' },
    addEventListener() {},
    sigajiCatchWarn() {},
    toast: (m) => toasts.push(m),
    sigajiIdb: idb || undefined,
  };
  sandbox.window = sandbox;
  const ctx = vm.createContext(sandbox);
  for (const rel of ['js/constants.js', 'js/storage.js']) {
    vm.runInContext(fs.readFileSync(path.join(ROOT, rel), 'utf8'), ctx, { filename: rel });
  }
  return {
    ctx,
    toasts,
    run: (code) => vm.runInContext(code, ctx),
    ready: () => sandbox.sigajiLocalReady,
    flush: () => sandbox.sigajiFlushLocalSave(),
    incomplete: () => sandbox.sigajiLocalDataIncomplete(),
  };
}

function bigAbsensi(nKar, days) {
  const ab = {};
  for (let n = 1; n <= nKar; n++) {
    const row = {};
    const d = new Date('2026-01-01T12:00:00');
    for (let i = 0; i < days; i++) {
      row[d.toISOString().slice(0, 10)] = 'hadir';
      d.setDate(d.getDate() + 1);
    }
    ab['K' + String(n).padStart(4, '0')] = row;
  }
  return ab;
}

function karyawanList(n) {
  const out = [];
  for (let i = 1; i <= n; i++) out.push({ nik: 'K' + String(i).padStart(4, '0'), nama: 'Dummy ' + i, gapok: 5000000 });
  return out;
}

const lsRaw = (ls) => JSON.parse(ls.getItem('sigaji_db'));

// 1. Data kecil: satu salinan penuh di localStorage, tanpa sigaji_universal; salinan lengkap juga di IndexedDB.
{
  const ls = makeLocalStorage(0);
  const idb = makeIdb(true);
  const a = boot(ls, idb);
  await a.ready();
  a.ctx.__k = karyawanList(14);
  a.run('karyawan=__k;absensi={K0001:{"2026-01-05":"hadir"}};saveAll();');
  await a.flush();
  const db = lsRaw(ls);
  assert('kecil: localStorage salinan penuh', db && !db._partial && db.karyawan.length === 14);
  assert('kecil: tidak ada sigaji_universal / _prev', ls.getItem('sigaji_universal') == null && ls.getItem('sigaji_universal_prev') == null);
  assert('kecil: tidak ada sigaji_db_prev di localStorage', ls.getItem('sigaji_db_prev') == null);
  assert('kecil: IndexedDB punya salinan', idb.map.get('db') && idb.map.get('db').karyawan.length === 14);
}

// 2. Salinan lama dipindah ke IndexedDB lalu dihapus dari localStorage.
{
  const ls = makeLocalStorage(0);
  const idb = makeIdb(true);
  const base = { schemaVersion: 22, karyawan: karyawanList(2), periodes: [] };
  ls.setItem('sigaji_db', JSON.stringify(base));
  ls.setItem('sigaji_universal', JSON.stringify(base));
  ls.setItem('sigaji_universal_prev', JSON.stringify(base));
  ls.setItem('sigaji_recovery_last', JSON.stringify(Object.assign({ _tag: 'before_cloud_apply' }, base)));
  ls.setItem('sigaji_db_prev', JSON.stringify(base));
  ls.setItem('sigaji_autobackup', JSON.stringify(base));
  const a = boot(ls, idb);
  await a.ready();
  assert('migrasi: universal dihapus', ls.getItem('sigaji_universal') == null && ls.getItem('sigaji_universal_prev') == null);
  assert('migrasi: auto-backup 30 menit pindah ke IndexedDB', ls.getItem('sigaji_autobackup') == null && !!idb.map.get('autobackup'));
  assert('migrasi: recovery & prev pindah ke IndexedDB', !!idb.map.get('recovery_last') && !!idb.map.get('db_prev'));
  assert('migrasi: recovery & prev hilang dari localStorage', ls.getItem('sigaji_recovery_last') == null && ls.getItem('sigaji_db_prev') == null);
  assert('migrasi: sigaji_db tetap ada', lsRaw(ls).karyawan.length === 2);
}

// 3. Data 300 karyawan × 1 tahun: localStorage salinan ringkas, IndexedDB lengkap; buka ulang = data utuh.
{
  const ls = makeLocalStorage(0);
  const idb = makeIdb(true);
  const a = boot(ls, idb);
  await a.ready();
  a.ctx.__k = karyawanList(300);
  a.ctx.__ab = bigAbsensi(300, 365);
  a.run('karyawan=__k;absensi=__ab;saveAll();');
  await a.flush();
  const raw = ls.getItem('sigaji_db');
  const db = JSON.parse(raw);
  assert('besar: localStorage ringkas (_partial)', db._partial === true && db.absensi === undefined);
  assert('besar: ringkas jauh di bawah kuota (<500 rb karakter)', raw.length < 500000);
  assert('besar: karyawan tetap ada di ringkas', db.karyawan.length === 300);
  assert('besar: IndexedDB lengkap', Object.keys(idb.map.get('db').absensi).length === 300);

  const b = boot(ls, idb);
  assert('buka ulang: ditahan sampai data lengkap termuat', b.incomplete() === true);
  await b.ready();
  assert('buka ulang: absensi dipulihkan dari IndexedDB', b.run('Object.keys(absensi).length') === 300);
  assert('buka ulang: simpan normal lagi', b.incomplete() === false);
}

// 4. Kuota localStorage penuh sebelum batas 2 jt: pindah ke salinan ringkas, tidak gagal diam-diam.
{
  const ls = makeLocalStorage(1000000);
  const idb = makeIdb(true);
  const a = boot(ls, idb);
  await a.ready();
  a.ctx.__k = karyawanList(200);
  a.ctx.__ab = bigAbsensi(200, 250);
  a.run('karyawan=__k;absensi=__ab;saveAll();');
  await a.flush();
  assert('kuota: localStorage ringkas', lsRaw(ls)._partial === true);
  assert('kuota: tidak ada peringatan (IndexedDB aman)', a.toasts.length === 0);
  assert('kuota: IndexedDB lengkap', Object.keys(idb.map.get('db').absensi).length === 200);
}

// 5. Salinan ringkas tanpa salinan lengkap: jangan timpa apa pun sampai data awan masuk.
{
  const ls = makeLocalStorage(0);
  ls.setItem('sigaji_db', JSON.stringify({ schemaVersion: 22, karyawan: karyawanList(3), periodes: [], _partial: true, _savedAt: 1 }));
  const idb = makeIdb(true);
  const a = boot(ls, idb);
  await a.ready();
  const before = ls.getItem('sigaji_db');
  assert('ringkas tanpa IndexedDB: migrasi skema tetap ringkas', JSON.parse(before)._partial === true);
  assert('ringkas tanpa IndexedDB: tetap ditahan', a.incomplete() === true);
  a.run('saveAll();');
  await a.flush();
  assert('ringkas tanpa IndexedDB: localStorage tidak ditimpa', ls.getItem('sigaji_db') === before);
  assert('ringkas tanpa IndexedDB: IndexedDB tidak diisi data setengah', !idb.map.has('db'));
  a.ctx.__cloud = { karyawan: karyawanList(3), periodes: [{ nama: 'Januari 2026', start: '2026-01-01', end: '2026-01-31' }], absensi: { K0001: { '2026-01-05': 'hadir' } }, users: [{ username: 'hrd@pt.co.id', role: 'HRD', aktif: true }] };
  a.run('applyDbFromCloudPayload(__cloud);');
  await a.flush();
  assert('setelah data awan: simpan jalan lagi', a.incomplete() === false && !lsRaw(ls)._partial);
  assert('setelah data awan: IndexedDB terisi', idb.map.get('db').absensi.K0001 != null);
}

// 6. Tanpa IndexedDB dan localStorage penuh: harus ada peringatan, bukan diam.
{
  const ls = makeLocalStorage(200000);
  const a = boot(ls, makeIdb(false));
  await a.ready();
  a.ctx.__k = karyawanList(50);
  a.ctx.__ab = bigAbsensi(50, 200);
  const ok = a.run('karyawan=__k;absensi=__ab;dbSave(currentPayloadLite());');
  assert('tanpa IndexedDB: dbSave melapor gagal', ok === false);
  assert('tanpa IndexedDB: toast peringatan muncul', a.toasts.length === 1 && /penuh/.test(a.toasts[0]));
  a.run('saveAll();');
  assert('tanpa IndexedDB: toast tidak berulang tiap simpan', a.toasts.length === 1);
}

// 7. Pemulihan darurat membaca salinan di IndexedDB.
{
  const ls = makeLocalStorage(0);
  const idb = makeIdb(true);
  const a = boot(ls, idb);
  await a.ready();
  a.ctx.__k = karyawanList(5);
  a.run('karyawan=__k;saveAll();');
  a.run('markRecoveryBackup("tes");');
  await Promise.resolve();
  a.ctx.__k2 = karyawanList(1);
  a.run('karyawan=__k2;saveAll();');
  a.ctx.renderAll = () => {};
  const restored = await a.run('window.sigajiRestoreEmergencyLocalBackup()');
  assert('pemulihan: berhasil', restored === true);
  assert('pemulihan: data sebelum perubahan kembali', a.run('karyawan.length') === 5);
}

console.log('\nPenyimpanan lokal: semua tes lulus.');
