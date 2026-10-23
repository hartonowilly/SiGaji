/**
 * Cloudflare Functions: data tenant dibaca dari tabel, tulis hanya selisih (absensi per tanggal, hari libur),
 * digabung dengan versi awan terbaru — tidak lagi menimpa blob utuh.
 * Jalankan: node tests/server-tenant-data.test.mjs
 */
import fs from 'fs';
import os from 'os';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';

// functions/ berformat ESM tapi package.json bukan "type": "module" — muat lewat salinan .mjs.
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const tmp = path.join(os.tmpdir(), 'sigaji-tenant-data-' + process.pid + '.mjs');
fs.copyFileSync(path.join(__dirname, '..', 'functions', '_lib', 'tenant-data.js'), tmp);
const {
  diffAbsensi,
  applyAbsensiChanges,
  mergeHariLibur,
  loadCloudPayload,
  saveCloudPayload,
  updateUsersList,
  getAbsensiStatus,
  saveAbsensiChanges,
  cabangScope,
  filterKaryawanByScope,
  assertHq,
  locationVisible,
  filterLocationsByScope,
} = await import(pathToFileURL(tmp).href);
fs.unlinkSync(tmp);

function assert(name, cond) {
  if (!cond) throw new Error('FAIL: ' + name);
  console.log('OK: ' + name);
}

/** Supabase palsu: cukup untuk from().select().eq().in().maybeSingle() / upsert / update. */
function fakeSb(tables) {
  const calls = [];
  function q(table) {
    const st = { table, filters: [], op: 'select', payload: null, range: null };
    const rows = () =>
      (tables[table] || []).filter((r) =>
        st.filters.every(([c, v, kind]) => (kind === 'in' ? v.includes(r[c]) : r[c] === v))
      );
    const missing = () => (tables[table] ? null : { message: 'relation "' + table + '" does not exist', code: '42P01' });
    const api = {
      select() {
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
      eq(c, v) {
        st.filters.push([c, v, 'eq']);
        return api;
      },
      in(c, v) {
        st.filters.push([c, v, 'in']);
        return api;
      },
      async maybeSingle() {
        const r = rows();
        return { data: r[0] || null, error: null };
      },
      upsert(row) {
        calls.push({ table, op: 'upsert', row });
        const list = tables[table] || (tables[table] = []);
        const i = list.findIndex((x) => x.tenant_key === row.tenant_key && x.store_key === row.store_key);
        if (i >= 0) list[i] = Object.assign({}, list[i], row);
        else list.push(row);
        return Promise.resolve({ error: null });
      },
      update(patch) {
        st.op = 'update';
        st.payload = patch;
        return api;
      },
      then(res, rej) {
        if (st.op === 'update') {
          calls.push({ table, op: 'update', patch: st.payload });
          rows().forEach((r) => Object.assign(r, st.payload));
          return Promise.resolve({ error: null }).then(res, rej);
        }
        if (missing()) return Promise.resolve({ data: null, error: missing() }).then(res, rej);
        let out = rows();
        if (st.range) out = out.slice(st.range[0], st.range[1] + 1);
        return Promise.resolve({ data: out, error: null }).then(res, rej);
      },
    };
    return api;
  }
  /** sigaji_save_rows (item): simpan hanya bila base_version = versi awan. beforeSave meniru HRD lain. */
  async function rpc(name, args) {
    calls.push({ op: 'rpc', name, args });
    if (name !== 'sigaji_save_rows') return { data: null, error: { message: 'unknown rpc' } };
    if (fake.beforeSave) fake.beforeSave();
    const list = tables.sigaji_item;
    const find = (k) => list.find((r) => r.tenant_key === args.p_tenant && r.kind === k.kind && r.item_key === k.item_key);
    const out = { saved: [], deleted: [], conflicts: [], errors: [] };
    args.p_upserts.forEach((u) => {
      const cur = find(u.key);
      if ((cur ? cur.version : null) !== u.base_version) {
        out.conflicts.push({ key: u.key, version: cur && cur.version });
        return;
      }
      if (cur) Object.assign(cur, { data: u.data, version: cur.version + 1 });
      else list.push(Object.assign({ tenant_key: args.p_tenant, nik: u.nik, data: u.data, version: 1 }, u.key));
      out.saved.push({ key: u.key });
    });
    args.p_deletes.forEach((d) => {
      const cur = find(d.key);
      if (cur && cur.version !== d.base_version) out.conflicts.push({ key: d.key, delete: true });
      else {
        if (cur) list.splice(list.indexOf(cur), 1);
        out.deleted.push(d.key);
      }
    });
    return { data: out, error: null };
  }
  const fake = { from: q, rpc, calls, beforeSave: null };
  return fake;
}

// ── murni ──────────────────────────────────────────────────────────────────
{
  const d = diffAbsensi(
    { A: { '2026-10-01': 'izin', '2026-10-02': 'sakit' } },
    { A: { '2026-10-01': 'izin', '2026-10-03': 'cuti' }, B: { '2026-10-01': 'alpha' } }
  );
  assert('diff: tanggal dihapus = null', d.A['2026-10-02'] === null);
  assert('diff: tanggal baru', d.A['2026-10-03'] === 'cuti' && d.B['2026-10-01'] === 'alpha');
  assert('diff: tanggal sama tidak ikut', !('2026-10-01' in d.A));
}
{
  const out = applyAbsensiChanges({ A: { '2026-10-02': 'sakit', '2026-10-09': 'izin' } }, { A: { '2026-10-02': null, '2026-10-05': 'hadir' } });
  assert('terapkan selisih: edit HRD lain (09) tetap ada', out.A['2026-10-09'] === 'izin' && out.A['2026-10-05'] === 'hadir' && !out.A['2026-10-02']);
}
{
  const merged = mergeHariLibur(
    [{ tgl: '2026-01-01', nama: 'Tahun Baru' }],
    [{ tgl: '2026-01-01', nama: 'Tahun Baru' }, { tgl: '2026-03-20', nama: 'Nyepi', tipe: 'libnas' }],
    [{ tgl: '2026-01-01', nama: 'Tahun Baru' }, { tgl: '2026-08-17', nama: 'HUT RI' }]
  );
  assert('hari libur: tambahan server + tambahan impor digabung', merged.length === 3 && merged[1].tgl === '2026-03-20');
}

// ── mode tabel ─────────────────────────────────────────────────────────────
{
  const tables = {
    sigaji_tenant_meta: [{ tenant_key: 't1' }],
    sigaji_karyawan: [{ tenant_key: 't1', nik: 'A', data: { nama: 'Ani' } }],
    sigaji_periode: [],
    sigaji_store: [
      { tenant_key: 't1', store_key: 'absensi', data: { A: { '2026-10-01': 'izin' } } },
      { tenant_key: 't1', store_key: 'hariLibur', data: [] },
      { tenant_key: 't1', store_key: 'users', data: [{ username: 'admin' }] },
    ],
    sigaji_cloud: [{ tenant_key: 't1', payload: { users: [{ username: 'admin' }], absensi: { LAMA: {} } } }],
  };
  const sb = fakeSb(tables);
  const p = await loadCloudPayload(sb, 't1');
  assert('muat dari tabel, bukan blob', p.karyawan[0].nik === 'A' && p.karyawan[0].nama === 'Ani' && !p.absensi.LAMA);

  // HRD di web menyimpan tanggal lain setelah function memuat
  tables.sigaji_store[0].data = { A: { '2026-10-01': 'izin', '2026-10-07': 'sakit' } };
  p.absensi.A['2026-10-02'] = 'hadir';
  await saveCloudPayload(sb, 't1', p);
  const abs = tables.sigaji_store.find((r) => r.store_key === 'absensi').data;
  assert('simpan function tidak menimpa edit HRD bersamaan', abs.A['2026-10-07'] === 'sakit' && abs.A['2026-10-02'] === 'hadir');
  assert('blob tidak ditulis di mode tabel', !sb.calls.some((c) => c.table === 'sigaji_cloud'));
  assert('hari libur tak berubah → tidak ditulis', !sb.calls.some((c) => c.row && c.row.store_key === 'hariLibur'));

  const n0 = sb.calls.length;
  await saveCloudPayload(sb, 't1', p);
  assert('simpan kedua tanpa perubahan → tidak ada tulis', sb.calls.length === n0);

  await updateUsersList(sb, 't1', (list) => {
    list.push({ username: 'baru', email: 'b@x.id' });
    return true;
  });
  const storeUsers = tables.sigaji_store.find((r) => r.store_key === 'users').data;
  assert('user baru masuk tabel', storeUsers.length === 2);
  assert('user baru juga ke blob (aplikasi mobile)', tables.sigaji_cloud[0].payload.users.length === 2);
}

// ── mode blob (tabel belum dipakai) ────────────────────────────────────────
{
  const tables = {
    sigaji_tenant_meta: [],
    sigaji_cloud: [{ tenant_key: 't2', payload: { karyawan: [{ nik: 'Z' }], absensi: {} } }],
  };
  const sb = fakeSb(tables);
  const p = await loadCloudPayload(sb, 't2');
  assert('tanpa tabel → muat blob', p.karyawan[0].nik === 'Z');
  p.absensi.Z = { '2026-10-01': 'alpha' };
  await saveCloudPayload(sb, 't2', p);
  assert('tanpa tabel → simpan blob', tables.sigaji_cloud[0].payload.absensi.Z['2026-10-01'] === 'alpha');
}

// ── mode v12 (absensi per baris sigaji_item) ───────────────────────────────
{
  const tables = {
    sigaji_tenant_meta: [{ tenant_key: 't3' }],
    sigaji_karyawan: [{ tenant_key: 't3', nik: 'A', data: { nama: 'Ani' } }],
    sigaji_periode: [],
    sigaji_store: [{ tenant_key: 't3', store_key: 'absensi', data: { A: { '2026-10-01': 'LAMA' } } }],
    sigaji_item: [
      { tenant_key: 't3', kind: 'absensi', item_key: 'A|2026-10', nik: 'A', data: { '2026-10-01': 'izin' }, version: 1 },
      { tenant_key: 't3', kind: 'absensi', item_key: 'A|2026-09', nik: 'A', data: { '2026-09-30': 'sakit' }, version: 1 },
    ],
  };
  const sb = fakeSb(tables);
  const p = await loadCloudPayload(sb, 't3');
  assert('v12: absensi dari sigaji_item, bukan dokumen store lama', p.absensi.A['2026-10-01'] === 'izin' && p.absensi.A['2026-09-30'] === 'sakit');
  assert('v12: status per tanggal dibaca dari item', (await getAbsensiStatus(sb, 't3', 'A', '2026-09-30')) === 'sakit');

  let once = true;
  sb.beforeSave = () => {
    if (!once) return;
    once = false;
    const row = tables.sigaji_item.find((r) => r.item_key === 'A|2026-10');
    row.data = Object.assign({}, row.data, { '2026-10-07': 'cuti' });
    row.version++;
  };
  await saveAbsensiChanges(sb, 't3', { A: { '2026-10-02': 'hadir', '2026-09-30': null } });
  const okt = tables.sigaji_item.find((r) => r.item_key === 'A|2026-10');
  assert('v12: versi bentrok → baca ulang & simpan lagi, edit HRD lain tetap ada', okt.data['2026-10-07'] === 'cuti' && okt.data['2026-10-02'] === 'hadir' && okt.data['2026-10-01'] === 'izin');
  assert('v12: bulan yang kosong dihapus', !tables.sigaji_item.some((r) => r.item_key === 'A|2026-09'));
  assert('v12: dokumen store lama tidak ditulis', tables.sigaji_store[0].data.A['2026-10-01'] === 'LAMA' && !sb.calls.some((c) => c.table === 'sigaji_store'));
}

// ── cakupan cabang di functions ────────────────────────────────────────────
{
  assert('Admin & HRD tanpa cabang = kantor pusat', cabangScope({ role: 'Admin', cabangId: 'c1' }) === null && cabangScope({ role: 'HRD' }) === null);
  const sc = cabangScope({ role: 'HRD', cabangId: 'c1, c2' });
  const list = [{ nik: 'A', cabangId: 'c1' }, { nik: 'B', cabang: 'c2' }, { nik: 'C' }];
  assert('HRD cabang hanya melihat karyawan cabangnya', filterKaryawanByScope(list, sc).map((k) => k.nik).join() === 'A,B');
  let thrown = false;
  try {
    assertHq({ role: 'HRD', cabangId: 'c1' });
  } catch {
    thrown = true;
  }
  assert('HRD cabang ditolak untuk fitur kantor pusat', thrown);
  const locs = [
    { id: 1, nama: 'A', cabang_id: 'c1' },
    { id: 2, nama: 'B', cabang_id: 'c9' },
    { id: 3, nama: 'Bersama', cabang_id: '' },
  ];
  assert('lokasi bersama terlihat HRD cabang', locationVisible(locs[2], sc) === true);
  assert('lokasi cabang lain tersembunyi', locationVisible(locs[1], sc) === false);
  assert(
    'daftar lokasi HRD cabang = cabangnya + bersama',
    filterLocationsByScope(locs, sc)
      .map((l) => l.nama)
      .join() === 'A,Bersama'
  );
}

console.log('\nSemua tes data tenant server lulus.');
