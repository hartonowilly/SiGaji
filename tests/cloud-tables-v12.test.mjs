/**
 * cloud-tables.js mode v12 (sigaji_item + versi baris + RPC) dengan server Supabase palsu yang meniru
 * sql/supabase_sigaji_v12_versi_cabang.sql: simpan hanya bila versi cocok, tarik perubahan, jejak hapus.
 * Jalankan: node tests/cloud-tables-v12.test.mjs
 */
import fs from 'fs';
import path from 'path';
import vm from 'vm';
import { createRequire } from 'module';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const require = createRequire(import.meta.url);
const D = require(path.join(ROOT, 'js/cloud-delta.js'));

function assert(name, cond, extra) {
  if (!cond) throw new Error('FAIL: ' + name + (extra !== undefined ? ' — ' + JSON.stringify(extra) : ''));
  console.log('OK: ' + name);
}

const KEYS = {
  sigaji_karyawan: ['nik'],
  sigaji_periode: ['nama'],
  sigaji_store: ['store_key'],
  sigaji_item: ['kind', 'item_key'],
  sigaji_tunj_var_nilai: ['periode_nama', 'nik', 'kolom_id'],
  sigaji_tunj_var_kolom: ['id'],
  sigaji_tenant_meta: [],
  sigaji_user_roles: ['auth_uid'],
};
const RPC_TABLE = { karyawan: 'sigaji_karyawan', periode: 'sigaji_periode', store: 'sigaji_store', item: 'sigaji_item' };
const META = ['version', 'updated_at', 'updated_by', 'tenant_key', 'cabang_id'];

function content(row) {
  const o = {};
  Object.keys(row).forEach((k) => {
    if (META.indexOf(k) === -1) o[k] = row[k];
  });
  return D.stableStringify(o);
}

function clone(v) {
  return v === undefined ? undefined : JSON.parse(JSON.stringify(v));
}

/** Server palsu: tabel + trigger versi + jejak hapus + RPC. deny(table,row) meniru RLS. */
function fakeServer(db) {
  let tick = 0;
  const log = [];
  const tombstones = [];
  const srv = { db, log, deny: () => false };
  const now = () => new Date(Date.UTC(2026, 9, 23) + ++tick * 1000).toISOString();
  const same = (table, a, b) => KEYS[table].every((k) => String(a[k]) === String(b[k]));

  function write(table, row) {
    const list = db[table];
    const i = list.findIndex((x) => same(table, x, row));
    const old = i >= 0 ? list[i] : null;
    const next = Object.assign({}, old || {}, clone(row));
    if (old && content(old) === content(next)) return old;
    next.version = old ? old.version + 1 : 1;
    next.updated_at = now();
    if (i >= 0) list[i] = next;
    else list.push(next);
    return next;
  }

  function remove(table, row) {
    db[table] = db[table].filter((x) => !same(table, x, row));
    const key = {};
    KEYS[table].forEach((k) => (key[k] = row[k]));
    tombstones.push({ tbl: table, key, at: now() });
  }

  function likeMatch(val, pat) {
    let re = '^';
    for (const c of String(pat)) {
      if (c === '%' || c === '*') re += '.*';
      else if (c === '_') re += '.';
      else re += c.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }
    return new RegExp(re + '$').test(String(val ?? ''));
  }
  function orMatch(r, expr) {
    return String(expr)
      .split(',')
      .some((part) => {
        const m = /^(\w+)\.(like|eq)\.(.*)$/.exec(part);
        if (!m) return false;
        if (m[2] === 'like') return likeMatch(r[m[1]], m[3]);
        return String(r[m[1]]) === m[3];
      });
  }
  function from(table) {
    const st = { op: 'select', filters: [], range: null };
    const match = (r) =>
      st.filters.every(([kind, c, v]) => {
        if (kind === 'eq') return r[c] === v;
        if (kind === 'in') return v.includes(r[c]);
        if (kind === 'notin') return !v.includes(r[c]);
        if (kind === 'gte') return String(r[c] || '') >= v;
        if (kind === 'like') return likeMatch(r[c], v);
        if (kind === 'or') return orMatch(r, v);
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
      not(c, op, v) {
        st.filters.push(['notin', c, String(v).replace(/[()]/g, '').split(',')]);
        return api;
      },
      gte(c, v) {
        st.filters.push(['gte', c, v]);
        return api;
      },
      like(c, v) {
        st.filters.push(['like', c, v]);
        return api;
      },
      or(expr) {
        st.filters.push(['or', '', expr]);
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
        if (!db[table]) return { data: null, error: { message: 'relation does not exist', code: '42P01' } };
        const r = db[table].filter(match);
        return { data: r[0] ? clone(r[0]) : null, error: null };
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
        let out;
        if (!db[table]) {
          out = { data: null, error: { message: 'relation "' + table + '" does not exist', code: '42P01' } };
        } else if (st.op === 'upsert') {
          log.push({ table, op: 'upsert', n: st.rows.length });
          st.rows.forEach((r) => write(table, r));
          out = { data: null, error: null };
        } else if (st.op === 'delete') {
          const gone = db[table].filter(match);
          log.push({ table, op: 'delete', n: gone.length });
          gone.forEach((r) => remove(table, r));
          out = { data: null, error: null };
        } else {
          let rows = db[table].filter(match);
          if (st.range) rows = rows.slice(st.range[0], st.range[1] + 1);
          out = { data: clone(rows), error: null };
        }
        return Promise.resolve(out).then(res, rej);
      },
    };
    return api;
  }

  function saveRows(args) {
    const table = RPC_TABLE[args.p_table];
    const res = { saved: [], deleted: [], conflicts: [], errors: [] };
    log.push({ table, op: 'rpc', ups: (args.p_upserts || []).length, dels: (args.p_deletes || []).length });
    (args.p_upserts || []).forEach((u) => {
      const cur = db[table].find((x) => same(table, x, u.key));
      if (srv.deny(table, Object.assign({}, u.key, { data: u.data }))) {
        res.errors.push({ key: u.key, code: '42501', message: 'Tidak diizinkan (hak akses cabang / kantor pusat)' });
        return;
      }
      if (!cur) {
        if (u.base_version != null && !u.blind) {
          res.conflicts.push({ key: u.key, missing: true });
          return;
        }
      } else if (!u.blind && String(u.base_version) !== String(cur.version)) {
        res.conflicts.push({ key: u.key, version: cur.version, data: clone(cur.data) });
        return;
      }
      const row = Object.assign({ tenant_key: 'main' }, u.key, { data: u.data });
      if (table === 'sigaji_item') row.nik = u.nik || '';
      const w = write(table, row);
      res.saved.push({ key: u.key, version: w.version });
    });
    (args.p_deletes || []).forEach((d) => {
      const cur = db[table].find((x) => same(table, x, d.key));
      if (!cur) {
        res.deleted.push(d.key);
        return;
      }
      if (d.base_version != null && String(d.base_version) !== String(cur.version)) {
        res.conflicts.push({ key: d.key, version: cur.version, data: clone(cur.data), delete: true });
        return;
      }
      remove(table, cur);
      res.deleted.push(d.key);
    });
    return res;
  }

  function changesSince(args) {
    const since = args.p_since;
    const pick = (table, f) => db[table].filter((r) => r.updated_at >= since).map(f);
    const exists = (t) => db[t.tbl].some((x) => same(t.tbl, x, t.key));
    return {
      now: now(),
      karyawan: pick('sigaji_karyawan', (r) => ({ nik: r.nik, data: r.data, version: r.version })),
      periode: pick('sigaji_periode', (r) => ({ nama: r.nama, data: r.data, version: r.version })),
      store: pick('sigaji_store', (r) => ({ store_key: r.store_key, data: r.data, version: r.version })),
      item: pick('sigaji_item', (r) => ({ kind: r.kind, item_key: r.item_key, nik: r.nik, data: r.data, version: r.version })),
      tunj_nilai: pick('sigaji_tunj_var_nilai', (r) => ({ periode_nama: r.periode_nama, nik: r.nik, kolom_id: r.kolom_id, nilai: r.nilai })),
      tunj_kolom: pick('sigaji_tunj_var_kolom', (r) => ({ id: r.id, nama: r.nama, sort_order: r.sort_order })),
      deleted: tombstones.filter((t) => t.at >= since && !exists(t)).map((t) => ({ tbl: t.tbl, key: t.key })),
    };
  }

  srv.client = function (uid) {
    return {
      from,
      auth: {
        async getSession() {
          return { data: { session: { user: { id: uid } } } };
        },
      },
      async rpc(name, args) {
        if (name === 'sigaji_save_rows') return { data: saveRows(args), error: null };
        if (name === 'sigaji_changes_since') return { data: changesSince(args), error: null };
        return { data: null, error: { message: 'Could not find the function', code: 'PGRST202' } };
      },
    };
  };
  srv.write = write;
  srv.remove = remove;
  return srv;
}

function seed() {
  const v = (row) => Object.assign({ tenant_key: 'main', version: 1, updated_at: '2026-10-01T00:00:00.000Z' }, row);
  const store = (k, data) => v({ store_key: k, data });
  return {
    sigaji_tenant_meta: [{ tenant_key: 'main', schema_version: 12 }],
    sigaji_user_roles: [
      { tenant_key: 'main', auth_uid: 'admin', role: 'Admin', cabang_id: null },
      { tenant_key: 'main', auth_uid: 'hrdc2', role: 'HRD', cabang_id: 'c2' },
    ],
    sigaji_karyawan: [
      v({ nik: 'K001', data: { nik: 'K001', nama: 'Ani', gapok: 5000000, alamat: 'Jl. A', cabangId: 'c2' } }),
      v({ nik: 'K002', data: { nik: 'K002', nama: 'Budi', gapok: 6000000 } }),
    ],
    sigaji_periode: [v({ nama: 'Okt 2026', data: { nama: 'Okt 2026', status: 'open' } })],
    sigaji_store: [
      store('perusahaan', { nama: 'PT Uji' }),
      store('users', [{ username: 'admin', role: 'Admin' }]),
      store('masterCuti', { kuota: 12, carryover: 'no', cbPotong: true }),
      store('hariLibur', []),
      store('roles', {}),
      store('approvals', []),
      store('notifikasi', []),
      store('tunjVarLabels', { v1: 'Bonus', v2: 'Uang Makan', v3: 'Lain-lain' }),
      store('auditLog', []),
      store('bentoLayouts', {}),
      store('cabang', []),
      // Dokumen lama (sebelum v12) — tidak boleh dibaca lagi.
      store('absensi', { K001: { '2026-10-01': 'LAMA' } }),
    ],
    sigaji_item: [
      v({ kind: 'absensi', item_key: 'K001|2026-10', nik: 'K001', data: { '2026-10-01': 'izin' } }),
      v({ kind: 'absensi', item_key: 'K001|2026-09', nik: 'K001', data: { '2026-09-30': 'sakit' } }),
      v({ kind: 'lembur', item_key: 'K002', nik: 'K002', data: [{ tanggal: '2026-10-03', jam: 2 }] }),
    ],
    sigaji_tunj_var_kolom: [v({ id: 'v1', nama: 'Bonus', sort_order: 0 })],
    sigaji_tunj_var_nilai: [v({ periode_nama: 'Okt 2026', nik: 'K001', kolom_id: 'v1', nilai: 100000 })],
  };
}

function makeApp() {
  const toasts = [];
  const ctx = { console, setTimeout, window: null, toast: (m) => toasts.push(m) };
  ctx.window = ctx;
  ctx.globalThis = ctx;
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'js/cloud-delta.js'), 'utf8'), ctx);
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'js/cloud-tables.js'), 'utf8'), ctx);
  ctx.mem = null;
  ctx.currentPayloadLite = () => ctx.mem;
  ctx.getPayloadForCloud = () => ctx.mem;
  ctx.tunjVarBulan = {};
  return { ctx, T: ctx.sigajiCloudTables, toasts };
}

async function loadInto(app, sb) {
  const p = await app.T.tryLoadWithTables(sb, 'uid', null);
  app.ctx.mem = JSON.parse(JSON.stringify(p));
  app.ctx.tunjVarBulan = app.ctx.mem.tunjVarBulan;
  app.T.commitLoadedBase();
  return app.ctx.mem;
}

function writesSince(srv, mark) {
  return srv.log.slice(mark);
}

// ── muat ───────────────────────────────────────────────────────────────────
{
  const srv = fakeServer(seed());
  const app = makeApp();
  const mem = await loadInto(app, srv.client('admin'));
  assert('mode v12 terdeteksi', app.T.isV12());
  assert('absensi disusun dari sigaji_item (dokumen store lama diabaikan)', mem.absensi.K001['2026-10-01'] === 'izin' && mem.absensi.K001['2026-09-30'] === 'sakit');
  assert('lembur dari sigaji_item', mem.lembur.K002.length === 1);
  const mark = srv.log.length;
  const r = await app.T.saveDelta(srv.client('admin'), mem);
  assert('tanpa perubahan → nol tulis', r.upserts === 0 && writesSince(srv, mark).length === 0);
}

// ── edit satu hari absensi → satu baris item dengan versi ─────────────────
{
  const srv = fakeServer(seed());
  const app = makeApp();
  const sb = srv.client('admin');
  const mem = await loadInto(app, sb);
  mem.absensi.K001['2026-10-02'] = 'hadir';
  const mark = srv.log.length;
  const r = await app.T.saveDelta(sb, mem);
  const w = writesSince(srv, mark);
  assert('hanya satu baris absensi (bulan Okt) dikirim lewat RPC', r.upserts === 1 && w.length === 1 && w[0].table === 'sigaji_item' && w[0].ups === 1);
  const row = srv.db.sigaji_item.find((x) => x.item_key === 'K001|2026-10');
  assert('versi naik di awan', row.version === 2 && row.data['2026-10-02'] === 'hadir');
  mem.absensi.K001['2026-10-03'] = 'hadir';
  await app.T.saveDelta(sb, mem);
  assert('simpan berikutnya memakai versi terbaru (tanpa bentrok)', srv.db.sigaji_item.find((x) => x.item_key === 'K001|2026-10').version === 3);
}

// ── dua HRD mengubah karyawan yang sama bersamaan ──────────────────────────
{
  const srv = fakeServer(seed());
  const a = makeApp();
  const b = makeApp();
  const memA = await loadInto(a, srv.client('admin'));
  const memB = await loadInto(b, srv.client('admin'));
  memA.karyawan[0].gapok = 7000000;
  memB.karyawan[0].alamat = 'Jl. B (HRD lain)';
  await b.T.saveDelta(srv.client('admin'), memB);
  const r = await a.T.saveDelta(srv.client('admin'), memA);
  const row = srv.db.sigaji_karyawan.find((x) => x.nik === 'K001');
  assert('versi berubah → RPC menolak, klien gabung lalu simpan ulang: dua perubahan tersimpan', row.data.gapok === 7000000 && row.data.alamat === 'Jl. B (HRD lain)' && row.version === 3);
  assert('memori HRD A ikut diperbarui, tanpa bentrok field', memA.karyawan[0].alamat === 'Jl. B (HRD lain)' && r.memoryChanged && r.conflicts.length === 0);
}

// ── absensi bulan sama, tanggal berbeda, dari dua sesi ─────────────────────
{
  const srv = fakeServer(seed());
  const a = makeApp();
  const b = makeApp();
  const memA = await loadInto(a, srv.client('admin'));
  const memB = await loadInto(b, srv.client('admin'));
  memA.absensi.K001['2026-10-05'] = 'hadir';
  memB.absensi.K001['2026-10-06'] = 'sakit';
  await a.T.saveDelta(srv.client('admin'), memA);
  await b.T.saveDelta(srv.client('admin'), memB);
  const d = srv.db.sigaji_item.find((x) => x.item_key === 'K001|2026-10').data;
  assert('absensi dua sesi digabung per tanggal', d['2026-10-05'] === 'hadir' && d['2026-10-06'] === 'sakit' && d['2026-10-01'] === 'izin');
}

// ── hapus baris yang baru diubah orang lain ────────────────────────────────
{
  const srv = fakeServer(seed());
  const a = makeApp();
  const memA = await loadInto(a, srv.client('admin'));
  srv.write('sigaji_karyawan', { tenant_key: 'main', nik: 'K002', data: { nik: 'K002', nama: 'Budi', gapok: 9999999 } });
  memA.karyawan.splice(1, 1);
  const r = await a.T.saveDelta(srv.client('admin'), memA);
  assert('tidak dihapus karena versi awan lebih baru', srv.db.sigaji_karyawan.some((x) => x.nik === 'K002') && r.kept.length === 1);
  assert('muncul lagi di memori dengan data terbaru', memA.karyawan.some((k) => k.nik === 'K002' && k.gapok === 9999999));
}

// ── tarik perubahan inkremental ────────────────────────────────────────────
{
  const srv = fakeServer(seed());
  const a = makeApp();
  const b = makeApp();
  const memA = await loadInto(a, srv.client('admin'));
  const memB = await loadInto(b, srv.client('admin'));
  memB.karyawan[1].gapok = 6500000;
  memB.absensi.K001['2026-10-07'] = 'cuti';
  memB.karyawan.push({ nik: 'K003', nama: 'Cici' });
  await b.T.saveDelta(srv.client('admin'), memB);
  memA.karyawan[0].alamat = 'Jl. Lokal (belum disimpan)';
  const changed = await a.T.pullChanges(srv.client('admin'));
  assert('tarik: perubahan sesi lain masuk memori', changed && memA.karyawan.find((k) => k.nik === 'K002').gapok === 6500000 && memA.absensi.K001['2026-10-07'] === 'cuti');
  assert('tarik: karyawan baru dari sesi lain muncul', memA.karyawan.some((k) => k.nik === 'K003'));
  assert('tarik: editan lokal yang belum disimpan tidak hilang', memA.karyawan[0].alamat === 'Jl. Lokal (belum disimpan)');
  const mark = srv.log.length;
  await a.T.saveDelta(srv.client('admin'), memA);
  const w = writesSince(srv, mark);
  assert('setelah tarik, simpan hanya mengirim editan lokal (tanpa bentrok)', w.length === 1 && w[0].table === 'sigaji_karyawan' && w[0].ups === 1);

  b.ctx.mem.karyawan = b.ctx.mem.karyawan.filter((k) => k.nik !== 'K003');
  await b.T.pullChanges(srv.client('admin'));
  await b.T.saveDelta(srv.client('admin'), b.ctx.mem);
  await a.T.pullChanges(srv.client('admin'));
  assert('tarik: karyawan yang dihapus sesi lain hilang (jejak hapus)', !memA.karyawan.some((k) => k.nik === 'K003'));
  const again = await a.T.pullChanges(srv.client('admin'));
  assert('tarik berulang tanpa perubahan baru → memori tidak berubah', again === false);
}

// ── HRD cabang ─────────────────────────────────────────────────────────────
{
  const srv = fakeServer(seed());
  srv.deny = (table, row) => table === 'sigaji_karyawan' && (row.data && row.data.cabangId) !== 'c2';
  const app = makeApp();
  const sb = srv.client('hrdc2');
  const mem = await loadInto(app, sb);
  assert('akses: HRD cabang dikenali (bukan pusat)', app.T.getAccess().hq === false && app.T.getAccess().cabang === 'c2');
  mem.periodes[0].status = 'closed';
  mem.perusahaan.nama = 'PT Diubah Cabang';
  mem.karyawan[0].gapok = 5100000;
  mem.approvals.push({ id: 1, nik: 'K001' });
  const mark = srv.log.length;
  const r = await app.T.saveDelta(sb, mem);
  const tables = writesSince(srv, mark).map((x) => x.table + ':' + (x.ups || x.n));
  assert('periode & profil perusahaan tidak dikirim (khusus pusat), dilaporkan', r.skipped.length === 2 && srv.db.sigaji_periode[0].data.status === 'open', r.skipped);
  assert('karyawan cabangnya & persetujuan tersimpan', srv.db.sigaji_karyawan[0].data.gapok === 5100000 && srv.db.sigaji_store.find((s) => s.store_key === 'approvals').data.length === 1, tables);
  const r2 = await app.T.saveDelta(sb, mem);
  assert('yang dilewati tidak dilaporkan berulang', r2.skipped.length === 0);

  mem.karyawan[1].gapok = 1;
  const r3 = await app.T.saveDelta(sb, mem);
  assert('ditolak RLS → dilaporkan per baris', r3.errors.length === 1 && /Budi/.test(r3.errors[0]), r3.errors);
  const mark2 = srv.log.length;
  await app.T.saveDelta(sb, mem);
  assert('baris yang ditolak tidak dikirim ulang terus-menerus', writesSince(srv, mark2).length === 0);
}

// ── bentrok terus-menerus → coba lagi nanti ────────────────────────────────
{
  const srv = fakeServer(seed());
  const app = makeApp();
  const sb = srv.client('admin');
  const mem = await loadInto(app, sb);
  const orig = sb.rpc;
  let n = 0;
  sb.rpc = async (name, args) => {
    if (name === 'sigaji_save_rows' && args.p_table === 'karyawan') {
      n++;
      srv.write('sigaji_karyawan', { tenant_key: 'main', nik: 'K001', data: Object.assign({}, srv.db.sigaji_karyawan[0].data, { x: n }) });
    }
    return orig(name, args);
  };
  mem.karyawan[0].gapok = 1234;
  const r = await app.T.saveDelta(sb, mem);
  assert('maks. 3 putaran lalu minta dicoba lagi', n === 3 && r.retry === true);
}

// ── boot tidak mengunduh absensi periode terkunci yang sudah lama ──────────
{
  const db = seed();
  const meta = { tenant_key: 'main', version: 1, updated_at: '2026-10-01T00:00:00.000Z' };
  db.sigaji_periode.push(
    Object.assign({}, meta, {
      nama: 'Jan 2020',
      data: {
        nama: 'Jan 2020',
        start: '2019-12-25',
        end: '2020-01-24',
        bayar: '2020-01-25',
        status: 'tutup',
        snapshot_locked: true,
      },
    })
  );
  db.sigaji_periode[0].data.start = '2026-09-25';
  db.sigaji_periode[0].data.end = '2026-10-24';
  db.sigaji_periode[0].data.status = 'aktif';
  db.sigaji_item.push(
    Object.assign({}, meta, { kind: 'absensi', item_key: 'K001|2020-01', nik: 'K001', data: { '2020-01-15': 'alpha' } }),
    Object.assign({}, meta, { kind: 'karSnapshot', item_key: 'Jan 2020|K001', nik: 'K001', data: { nik: 'K001', gapok: 1 } })
  );
  db.sigaji_tunj_var_nilai.push(Object.assign({}, meta, { periode_nama: 'Jan 2020', nik: 'K001', kolom_id: 'v1', nilai: 777 }));
  const srv = fakeServer(db);
  const app = makeApp();
  const mem = await loadInto(app, srv.client('admin'));
  assert('boot: absensi bulan berjalan ada', mem.absensi.K001 && mem.absensi.K001['2026-10-01'] === 'izin');
  assert('boot: absensi periode terkunci 2020 tidak dimuat', !(mem.absensi.K001 && mem.absensi.K001['2020-01-15']));
  assert('boot: snapshot & tunjangan periode arsip tidak dimuat', !((mem.karSnapshot['Jan 2020'] || {}).K001) && !((mem.tunjVarBulan['Jan 2020'] || {}).K001));
  assert('ada arsip yang belum dimuat', app.T.archivePending() === true);
  const changed = await app.T.loadArchive(srv.client('admin'));
  assert('muat arsip: data lama masuk memori', changed && mem.absensi.K001['2020-01-15'] === 'alpha' && mem.karSnapshot['Jan 2020'].K001.gapok === 1);
  assert('muat arsip: tunjangan periode lama ikut', mem.tunjVarBulan['Jan 2020'].K001.v1 === 777);
  assert('setelah muat, arsip tidak pending', app.T.archivePending() === false);
}

console.log('\nSemua tes cloud-tables v12 lulus.');
