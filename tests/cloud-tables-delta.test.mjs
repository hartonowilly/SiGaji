/**
 * cloud-tables.js dengan Supabase palsu (memori): simpan hanya baris berubah, tanpa hapus-berdasarkan-absen,
 * gabung otomatis bila HRD lain menyimpan baris yang sama, tolak unggah sebelum data awan termuat.
 * Jalankan: node tests/cloud-tables-delta.test.mjs
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

const PK = {
  sigaji_tenant_meta: ['tenant_key'],
  sigaji_karyawan: ['tenant_key', 'nik'],
  sigaji_periode: ['tenant_key', 'nama'],
  sigaji_store: ['tenant_key', 'store_key'],
  sigaji_tunj_var_kolom: ['tenant_key', 'id'],
  sigaji_tunj_var_nilai: ['tenant_key', 'periode_nama', 'nik', 'kolom_id'],
};

function fakeSupabase(db) {
  const log = [];
  function from(table) {
    const st = { op: 'select', filters: [], rows: null };
    const match = (r) =>
      st.filters.every(([kind, c, v]) => {
        if (kind === 'eq') return r[c] === v;
        if (kind === 'in') return v.includes(r[c]);
        if (kind === 'gte') return String(r[c] || '') >= v;
        return true;
      });
    const api = {
      select() {
        return api;
      },
      eq(c, v) {
        st.filters.push(['eq', c, v]);
        return api;
      },
      in(c, v) {
        st.filters.push(['in', c, v]);
        return api;
      },
      gte(c, v) {
        st.filters.push(['gte', c, v]);
        return api;
      },
      order() {
        return api;
      },
      limit() {
        return api;
      },
      range(a, b) {
        st.range = [a, b];
        return api;
      },
      async maybeSingle() {
        const r = (db[table] || []).filter(match);
        return { data: r[0] ? JSON.parse(JSON.stringify(r[0])) : null, error: null };
      },
      upsert(rows) {
        st.op = 'upsert';
        st.rows = Array.isArray(rows) ? rows : [rows];
        return api;
      },
      delete() {
        st.op = 'delete';
        return api;
      },
      then(res, rej) {
        if (!db[table]) {
          return Promise.resolve({ data: null, error: { message: 'relation "' + table + '" does not exist', code: '42P01' } }).then(res, rej);
        }
        const list = db[table];
        let out;
        if (st.op === 'upsert') {
          log.push({ table, op: 'upsert', n: st.rows.length, keys: st.rows.map((r) => r.nik || r.nama || r.store_key || r.id || r.kolom_id) });
          st.rows.forEach((row) => {
            const pk = PK[table];
            const i = list.findIndex((x) => pk.every((k) => x[k] === row[k]));
            const copy = JSON.parse(JSON.stringify(row));
            if (i >= 0) list[i] = Object.assign({}, list[i], copy);
            else list.push(copy);
          });
          out = { data: null, error: null };
        } else if (st.op === 'delete') {
          const gone = list.filter(match);
          log.push({ table, op: 'delete', n: gone.length, keys: gone.map((r) => r.nik || r.nama || r.store_key || r.id) });
          db[table] = list.filter((r) => !match(r));
          out = { data: null, error: null };
        } else {
          log.push({ table, op: 'select' });
          let rows = list.filter(match);
          if (st.range) rows = rows.slice(st.range[0], st.range[1] + 1);
          out = { data: JSON.parse(JSON.stringify(rows)), error: null };
        }
        return Promise.resolve(out).then(res, rej);
      },
    };
    return api;
  }
  return { from, log };
}

/** Data awan nyata selalu punya semua kunci store (ditulis versi lama di setiap simpan). */
const STORE_FILL = {
  masterCuti: { kuota: 12, carryover: 'no', cbPotong: true },
  hariLibur: [],
  roles: {},
  lembur: {},
  prorata: {},
  approvals: [],
  notifikasi: [],
  thrManual: {},
  tunjVarLabels: { v1: 'Bonus', v2: 'Uang Makan', v3: 'Lain-lain' },
  karSnapshot: {},
  auditLog: [],
  bentoLayouts: {},
  cabang: [],
};

function seedDb() {
  const db = seedDbBase();
  Object.keys(STORE_FILL).forEach((k) => db.sigaji_store.push({ tenant_key: 'main', store_key: k, data: STORE_FILL[k] }));
  return db;
}

function seedDbBase() {
  return {
    sigaji_tenant_meta: [{ tenant_key: 'main', schema_version: 10 }],
    sigaji_karyawan: [
      { tenant_key: 'main', nik: 'K001', data: { nik: 'K001', nama: 'Ani', gapok: 5000000, alamat: 'Jl. A' } },
      { tenant_key: 'main', nik: 'K002', data: { nik: 'K002', nama: 'Budi', gapok: 6000000 } },
    ],
    sigaji_periode: [{ tenant_key: 'main', nama: 'Okt 2026', data: { nama: 'Okt 2026', status: 'open' } }],
    sigaji_store: [
      { tenant_key: 'main', store_key: 'perusahaan', data: { nama: 'PT Uji' } },
      { tenant_key: 'main', store_key: 'absensi', data: { K001: { '2026-10-01': 'izin' } } },
      { tenant_key: 'main', store_key: 'users', data: [{ username: 'admin', role: 'Admin' }] },
    ],
    sigaji_tunj_var_kolom: [{ tenant_key: 'main', id: 'v1', nama: 'Bonus', sort_order: 0 }],
    sigaji_tunj_var_nilai: [{ tenant_key: 'main', periode_nama: 'Okt 2026', nik: 'K001', kolom_id: 'v1', nilai: 100000 }],
  };
}

/** Muat cloud-delta.js + cloud-tables.js dalam konteks "browser" dengan memori aplikasi sendiri. */
function makeApp() {
  const toasts = [];
  const ctx = {
    console,
    setTimeout,
    window: null,
    toast: (m) => toasts.push(m),
  };
  ctx.window = ctx;
  ctx.globalThis = ctx;
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'js/cloud-delta.js'), 'utf8'), ctx);
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'js/cloud-tables.js'), 'utf8'), ctx);
  ctx.mem = null;
  ctx.currentPayloadLite = () => ctx.mem;
  return { ctx, T: ctx.sigajiCloudTables, toasts };
}

async function loadInto(app, sb) {
  const p = await app.T.tryLoadWithTables(sb, 'uid', null);
  app.ctx.mem = JSON.parse(JSON.stringify(p));
  app.T.commitLoadedBase();
  return app.ctx.mem;
}

function lastWrites(sb, from) {
  return sb.log.slice(from).filter((x) => x.op !== 'select');
}

// ── simpan sebelum muat ditolak ────────────────────────────────────────────
{
  const db = seedDb();
  const sb = fakeSupabase(db);
  const app = makeApp();
  let err = null;
  try {
    await app.T.saveDelta(sb, { karyawan: [] });
  } catch (e) {
    err = e;
  }
  assert('unggah sebelum data awan termuat ditolak (cegah timpa dengan data lokal lama)', err && /belum termuat/.test(err.message));
  assert('tidak ada yang ditulis', lastWrites(sb, 0).length === 0);
}

// ── tanpa perubahan / satu perubahan ───────────────────────────────────────
{
  const db = seedDb();
  const sb = fakeSupabase(db);
  const app = makeApp();
  const mem = await loadInto(app, sb);
  let mark = sb.log.length;
  const r0 = await app.T.saveDelta(sb, mem);
  assert('tanpa perubahan → nol tulis', r0.upserts === 0 && r0.deletes === 0 && lastWrites(sb, mark).length === 0);

  mem.karyawan[0].gapok = 5500000;
  mark = sb.log.length;
  const r1 = await app.T.saveDelta(sb, mem);
  const w = lastWrites(sb, mark).filter((x) => x.table !== 'sigaji_tenant_meta');
  assert('edit satu karyawan → satu baris karyawan saja yang dikirim', r1.upserts === 1 && w.length === 1 && w[0].keys[0] === 'K001');
  assert('nilai baru tersimpan di awan', db.sigaji_karyawan.find((r) => r.nik === 'K001').data.gapok === 5500000);

  mark = sb.log.length;
  await app.T.saveDelta(sb, mem);
  assert('simpan ulang tanpa edit → nol tulis', lastWrites(sb, mark).length === 0);
}

// ── karyawan baru dari HRD lain tidak terhapus ─────────────────────────────
{
  const db = seedDb();
  const sb = fakeSupabase(db);
  const app = makeApp();
  const mem = await loadInto(app, sb);
  db.sigaji_karyawan.push({ tenant_key: 'main', nik: 'K777', data: { nik: 'K777', nama: 'Dari cabang lain' } });
  mem.periodes[0].status = 'closed';
  await app.T.saveDelta(sb, mem);
  assert('karyawan yang ditambah HRD lain tetap ada setelah sesi ini menyimpan', db.sigaji_karyawan.some((r) => r.nik === 'K777'));
}

// ── hapus eksplisit ────────────────────────────────────────────────────────
{
  const db = seedDb();
  const sb = fakeSupabase(db);
  const app = makeApp();
  const mem = await loadInto(app, sb);
  mem.karyawan = mem.karyawan.filter((k) => k.nik !== 'K002');
  app.ctx.mem = mem;
  const r = await app.T.saveDelta(sb, mem);
  assert('karyawan yang dihapus di sesi ini terhapus di awan', r.deletes === 1 && !db.sigaji_karyawan.some((x) => x.nik === 'K002'));
  delete mem.tunjVarBulan['Okt 2026'].K001.v1;
  await app.T.saveDelta(sb, mem);
  assert('sel tunjangan yang dikosongkan terhapus', db.sigaji_tunj_var_nilai.length === 0);
}

// ── HRD lain mengubah karyawan yang sama ───────────────────────────────────
{
  const db = seedDb();
  const sb = fakeSupabase(db);
  const app = makeApp();
  const mem = await loadInto(app, sb);
  db.sigaji_karyawan[0].data = Object.assign({}, db.sigaji_karyawan[0].data, { alamat: 'Jl. B (HRD lain)' });
  mem.karyawan[0].gapok = 7000000;
  const r = await app.T.saveDelta(sb, mem);
  const row = db.sigaji_karyawan.find((x) => x.nik === 'K001').data;
  assert('gaji (sesi ini) + alamat (HRD lain) dua-duanya tersimpan', row.gapok === 7000000 && row.alamat === 'Jl. B (HRD lain)');
  assert('memori lokal ikut diperbarui', mem.karyawan[0].alamat === 'Jl. B (HRD lain)' && r.memoryChanged === true);
  assert('tanpa bentrok field', r.conflicts.length === 0);
}

// ── absensi (dokumen store) diubah bersamaan ───────────────────────────────
{
  const db = seedDb();
  const sb = fakeSupabase(db);
  const app = makeApp();
  const mem = await loadInto(app, sb);
  db.sigaji_store.find((r) => r.store_key === 'absensi').data = { K001: { '2026-10-01': 'izin', '2026-10-02': 'hadir' } };
  mem.absensi.K002 = { '2026-10-03': 'sakit' };
  await app.T.saveDelta(sb, mem);
  const abs = db.sigaji_store.find((r) => r.store_key === 'absensi').data;
  assert('absensi dari HP/HRD lain tidak tertimpa', abs.K001['2026-10-02'] === 'hadir' && abs.K002['2026-10-03'] === 'sakit');
}

// ── bentrok field sama ─────────────────────────────────────────────────────
{
  const db = seedDb();
  const sb = fakeSupabase(db);
  const app = makeApp();
  const mem = await loadInto(app, sb);
  db.sigaji_karyawan[1].data = Object.assign({}, db.sigaji_karyawan[1].data, { gapok: 6100000 });
  mem.karyawan[1].gapok = 6200000;
  const r = await app.T.saveDelta(sb, mem);
  assert('field sama → nilai sesi ini dipakai + dilaporkan', db.sigaji_karyawan[1].data.gapok === 6200000 && r.conflicts.length === 1 && /Budi/.test(r.conflicts[0]));
}

// ── hapus baris yang baru diubah orang lain ────────────────────────────────
{
  const db = seedDb();
  const sb = fakeSupabase(db);
  const app = makeApp();
  const mem = await loadInto(app, sb);
  db.sigaji_karyawan[1].data = Object.assign({}, db.sigaji_karyawan[1].data, { gapok: 9999999 });
  mem.karyawan.splice(1, 1);
  const r = await app.T.saveDelta(sb, mem);
  assert('tidak dihapus karena baru diubah HRD lain', db.sigaji_karyawan.some((x) => x.nik === 'K002') && r.kept.length === 1);
  assert('muncul lagi di memori dengan data terbaru', mem.karyawan.some((k) => k.nik === 'K002' && k.gapok === 9999999));
}

// ── hapus massal minta konfirmasi ──────────────────────────────────────────
{
  const db = seedDb();
  for (let i = 0; i < 20; i++) db.sigaji_karyawan.push({ tenant_key: 'main', nik: 'X' + i, data: { nik: 'X' + i } });
  const sb = fakeSupabase(db);
  const app = makeApp();
  const mem = await loadInto(app, sb);
  let asked = 0;
  app.ctx.sigajiConfirm = async () => {
    asked++;
    return false;
  };
  mem.karyawan.length = 1;
  mem.perusahaan.nama = 'PT Uji Baru';
  await app.T.saveDelta(sb, mem);
  assert('memori kosong mendadak → minta konfirmasi', asked === 1);
  assert('ditolak → karyawan tetap di awan, perubahan lain tetap tersimpan', db.sigaji_karyawan.length === 22 && db.sigaji_store[0].data.nama === 'PT Uji Baru');
  await app.T.saveDelta(sb, mem);
  assert('tidak ditanya berulang tiap simpan', asked === 1 && db.sigaji_karyawan.length === 22);
}

// ── migrasi blob → tabel kosong ────────────────────────────────────────────
{
  const db = {
    sigaji_tenant_meta: [{ tenant_key: 'main' }],
    sigaji_karyawan: [],
    sigaji_periode: [],
    sigaji_store: [],
    sigaji_tunj_var_kolom: [],
    sigaji_tunj_var_nilai: [],
  };
  const sb = fakeSupabase(db);
  const app = makeApp();
  const blob = { karyawan: [{ nik: 'B1' }], periodes: [{ nama: 'P1' }], users: [{ username: 'admin' }] };
  const p = await app.T.tryLoadWithTables(sb, 'uid', async () => blob);
  assert('tabel kosong → isi dari blob lalu muat dari tabel', p.karyawan.length === 1 && db.sigaji_karyawan.length === 1);
}

// ── > 1000 baris (batas respons PostgREST) termuat semua ───────────────────
{
  const db = seedDb();
  for (let i = 0; i < 2500; i++) {
    db.sigaji_tunj_var_nilai.push({ tenant_key: 'main', periode_nama: 'Okt 2026', nik: 'N' + i, kolom_id: 'v1', nilai: i + 1 });
  }
  const sb = fakeSupabase(db);
  const app = makeApp();
  const mem = await loadInto(app, sb);
  assert('2.501 sel tunjangan termuat semua (bertahap per 1.000)', Object.keys(mem.tunjVarBulan['Okt 2026']).length === 2501);
}

console.log('\nSemua tes cloud-tables delta lulus.');
