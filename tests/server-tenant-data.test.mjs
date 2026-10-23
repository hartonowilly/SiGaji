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
const { diffAbsensi, applyAbsensiChanges, mergeHariLibur, loadCloudPayload, saveCloudPayload, updateUsersList } =
  await import(pathToFileURL(tmp).href);
fs.unlinkSync(tmp);

function assert(name, cond) {
  if (!cond) throw new Error('FAIL: ' + name);
  console.log('OK: ' + name);
}

/** Supabase palsu: cukup untuk from().select().eq().in().maybeSingle() / upsert / update. */
function fakeSb(tables) {
  const calls = [];
  function q(table) {
    const st = { table, filters: [], op: 'select', payload: null };
    const rows = () =>
      (tables[table] || []).filter((r) =>
        st.filters.every(([c, v, kind]) => (kind === 'in' ? v.includes(r[c]) : r[c] === v))
      );
    const api = {
      select() {
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
        return Promise.resolve({ data: rows(), error: null }).then(res, rej);
      },
    };
    return api;
  }
  return { from: q, calls };
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

console.log('\nSemua tes data tenant server lulus.');
