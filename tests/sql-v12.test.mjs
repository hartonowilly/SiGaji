/**
 * Uji SQL v12 (RLS cabang, versi baris, RPC) di Postgres sungguhan (PGlite) dengan tiruan skema auth Supabase.
 * Lewati bila @electric-sql/pglite belum terpasang.
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
let PGlite;
try {
  ({ PGlite } = await import('@electric-sql/pglite'));
} catch {
  console.log('Lewati tes SQL v12: @electric-sql/pglite belum terpasang (npm ci).');
  process.exit(0);
}

process.on('unhandledRejection', (e) => {
  console.error('GAGAL (error SQL): ' + (e && e.message) + (e && e.where ? ' @ ' + e.where : ''));
  process.exit(1);
});

let failed = 0;
function assert(name, cond, extra) {
  if (cond) console.log('OK: ' + name);
  else {
    failed++;
    console.error('GAGAL: ' + name + (extra !== undefined ? ' — ' + JSON.stringify(extra) : ''));
  }
}

const sqlV11 = readFileSync(join(root, 'sql/supabase_sigaji_tables_v11.sql'), 'utf8');
const sqlRoles = readFileSync(join(root, 'sql/supabase_sigaji_user_roles_rls.sql'), 'utf8');
const sqlV12 = readFileSync(join(root, 'sql/supabase_sigaji_v12_versi_cabang.sql'), 'utf8');
const sqlKetat = readFileSync(join(root, 'sql/supabase_sigaji_v12_cabang_ketat.sql'), 'utf8');

const UID = {
  admin: '00000000-0000-0000-0000-00000000000a',
  hrdPusat: '00000000-0000-0000-0000-00000000000b',
  hrdC2: '00000000-0000-0000-0000-00000000000c',
  kar1: '00000000-0000-0000-0000-00000000000d',
  admin2: '00000000-0000-0000-0000-00000000000e',
  baru: '00000000-0000-0000-0000-00000000000f',
};

const SUPABASE_MOCK = `
  create role authenticated nologin;
  create role service_role nologin bypassrls;
  create schema auth;
  create table auth.users (id uuid primary key, email text, created_at timestamptz default now());
  create function auth.uid() returns uuid language sql stable as
    $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
  grant usage on schema auth to authenticated, service_role;
  grant execute on function auth.uid() to authenticated, service_role;
  create table public.sigaji_cloud (
    tenant_key text primary key, user_id uuid, payload jsonb, updated_at timestamptz default now()
  );
`;

function users(list) {
  return JSON.stringify(list).replace(/'/g, "''");
}

async function freshDb(usersMain) {
  const db = new PGlite();
  await db.exec(SUPABASE_MOCK);
  await db.exec(sqlV11);
  await db.exec(`
    grant usage on schema public to authenticated, service_role;
    grant select, insert, update, delete on all tables in schema public to authenticated, service_role;
  `);
  await db.exec(`
    insert into auth.users (id, email) values
      ('${UID.admin}', 'admin@pt.co'), ('${UID.hrdPusat}', 'hrd@pt.co'), ('${UID.hrdC2}', 'hrd.c2@pt.co'),
      ('${UID.kar1}', 'kar1@pt.co'), ('${UID.admin2}', 'admin@pt2.co'), ('${UID.baru}', 'baru@pt.co');
    insert into public.sigaji_tenant_meta (tenant_key, schema_version) values ('main', 11), ('pt2', 11);
    insert into public.sigaji_karyawan (tenant_key, nik, data) values
      ('main', 'K1', '{"nik":"K1","nama":"Ani","cabangId":"c2","gaji":5000000}'),
      ('main', 'K2', '{"nik":"K2","nama":"Budi","gaji":7000000}'),
      ('main', 'K3', '{"nik":"K3","nama":"Cici","cabang":"c2","gaji":6000000}'),
      ('pt2', 'X1', '{"nik":"X1","nama":"Xena","gaji":9000000}');
    insert into public.sigaji_periode (tenant_key, nama, data) values ('main', 'Okt 2026', '{"nama":"Okt 2026","status":"aktif"}');
    insert into public.sigaji_store (tenant_key, store_key, data) values
      ('main', 'users', '${users(usersMain)}'),
      ('main', 'perusahaan', '{"nama":"PT Contoh"}'),
      ('main', 'approvals', '[]'),
      ('main', 'absensi', '{"K1":{"2026-10-01":"H","2026-09-30":"S","2026-10-02":""},"K2":{"2026-10-01":"I"}}'),
      ('main', 'lembur', '{"K1":[{"tanggal":"2026-10-03","jam":2}],"K2":[]}'),
      ('main', 'thrManual', '{"Okt 2026":{"K3":1500000}}'),
      ('pt2', 'users', '[{"username":"adm2","role":"Admin","email":"admin@pt2.co"}]');
    insert into public.sigaji_tunj_var_nilai (tenant_key, periode_nama, nik, kolom_id, nilai) values
      ('main', 'Okt 2026', 'K1', 'v1', 100000), ('main', 'Okt 2026', 'K2', 'v1', 200000);
    create policy "sigaji_karyawan_pt2" on public.sigaji_karyawan for all to authenticated
      using (tenant_key = 'pt2') with check (tenant_key = 'pt2');
  `);
  return db;
}

const USERS_MAIN = [
  { username: 'admin', role: 'Admin', email: 'Admin@PT.co' },
  { username: 'hrd', role: 'HRD', email: 'hrd@pt.co' },
  { username: 'hrdc2', role: 'HRD', email: 'hrd.c2@pt.co', cabangId: 'c2' },
  { username: 'ani', role: 'Karyawan', email: 'kar1@pt.co', nik: 'K1' },
  { username: 'tanpaakun', role: 'Karyawan', email: 'belum@pt.co', nik: 'K2' },
];

async function as(db, who, fn) {
  await db.exec(`set role authenticated; set request.jwt.claim.sub = '${UID[who]}';`);
  try {
    return await fn();
  } finally {
    await db.exec(`reset role; set request.jwt.claim.sub = '';`);
  }
}

async function rows(db, sql, params) {
  return (await db.query(sql, params || [])).rows;
}

async function fails(db, sql, params) {
  try {
    await db.query(sql, params || []);
    return false;
  } catch {
    return true;
  }
}

async function rpc(db, fn, args) {
  const ph = args.map((_, i) => '$' + (i + 1)).join(', ');
  const r = await db.query(`select public.${fn}(${ph}) as r`, args);
  return r.rows[0].r;
}

// ── Terkunci: tanpa Admin/HRD tertaut → SQL berhenti tanpa mengubah apa pun ──
{
  const db = await freshDb([{ username: 'admin', role: 'Admin', email: 'tidak.ada@pt.co' }]);
  let msg = '';
  try {
    await db.exec(sqlV12);
  } catch (e) {
    msg = String(e.message);
    await db.exec('rollback');
  }
  assert('tenant tanpa Admin tertaut → SQL dibatalkan dengan pesan jelas', /belum punya Admin\/HRD/.test(msg), msg);
  const it = await rows(db, `select to_regclass('public.sigaji_item') as t`);
  assert('dibatalkan = tidak ada perubahan (sigaji_item belum dibuat)', it[0].t === null);
}

const db = await freshDb(USERS_MAIN);
await db.exec(sqlRoles);
await db.exec(sqlV12);
await db.exec(sqlV12);
assert('SQL v12 bisa dijalankan dua kali', true);
await db.exec(sqlKetat);
await db.exec(sqlKetat);
assert('SQL cabang ketat bisa dijalankan dua kali', true);

{
  const r = await rows(db, `select username, role, cabang_id, aktif from public.sigaji_user_roles where tenant_key='main' order by username`);
  const by = Object.fromEntries(r.map((x) => [x.username, x]));
  assert('peta role diisi lewat email (huruf besar diabaikan)', by.admin && by.admin.role === 'Admin', r);
  assert('HRD cabang dapat cabang_id dari daftar user', by.hrdc2 && by.hrdc2.cabang_id === 'c2');
  assert('user tanpa akun login dilewati', !by.tanpaakun);
  const k = await rows(db, `select nik, cabang_id from public.sigaji_karyawan where tenant_key='main' order by nik`);
  assert('cabang_id karyawan dari data (cabangId / cabang / utama)', k.map((x) => x.cabang_id).join(',') === 'c2,utama,c2');
  const it = await rows(db, `select kind, item_key, nik, cabang_id, data from public.sigaji_item where tenant_key='main' order by kind, item_key`);
  const keys = it.map((x) => x.kind + ':' + x.item_key);
  assert(
    'store dipecah ke sigaji_item (absensi per bulan, lembur kosong dilewati, THR periode|nik)',
    keys.join(' ') === 'absensi:K1|2026-09 absensi:K1|2026-10 absensi:K2|2026-10 lembur:K1 thrManual:Okt 2026|K3',
    keys
  );
  const okt = it.find((x) => x.item_key === 'K1|2026-10');
  assert('tanggal kosong tidak ikut', okt && Object.keys(okt.data).join() === '2026-10-01');
  assert('cabang item = cabang karyawan', it.find((x) => x.item_key === 'Okt 2026|K3').cabang_id === 'c2');
}

// ── RLS ──
await as(db, 'admin', async () => {
  const k = await rows(db, `select nik from public.sigaji_karyawan order by nik`);
  assert('Admin: semua karyawan tenant sendiri, tenant lain tidak (kebijakan lama per tenant dihapus)', k.map((x) => x.nik).join() === 'K1,K2,K3', k);
  const b = await rows(db, `select tenant_key from public.sigaji_cloud`);
  assert('Admin boleh baca blob tenant sendiri (kosong di tes)', Array.isArray(b));
});

await as(db, 'hrdC2', async () => {
  const k = await rows(db, `select nik from public.sigaji_karyawan order by nik`);
  assert('HRD cabang: hanya karyawan cabangnya', k.map((x) => x.nik).join() === 'K1,K3', k);
  const it = await rows(db, `select distinct nik from public.sigaji_item order by nik`);
  assert('HRD cabang: absensi/THR hanya cabangnya', it.map((x) => x.nik).join() === 'K1,K3', it);
  const tv = await rows(db, `select nik from public.sigaji_tunj_var_nilai`);
  assert('HRD cabang: tunjangan hanya cabangnya', tv.map((x) => x.nik).join() === 'K1');
  const s = await rows(db, `select store_key from public.sigaji_store order by store_key`);
  assert('HRD cabang: daftar user tidak terbaca (bocoran ditutup)', !s.some((x) => x.store_key === 'users') && s.some((x) => x.store_key === 'approvals'), s);
  assert('HRD cabang: tidak bisa ubah profil perusahaan', (await rows(db, `update public.sigaji_store set data='{"nama":"X"}' where store_key='perusahaan' returning 1`)).length === 0);
  assert('HRD cabang: boleh simpan persetujuan', (await rows(db, `update public.sigaji_store set data='[{"id":1}]' where store_key='approvals' returning 1`)).length === 1);
  assert('HRD cabang: tidak bisa ubah periode', (await rows(db, `update public.sigaji_periode set data='{}' returning 1`)).length === 0);
  assert('HRD cabang: tidak bisa tambah karyawan cabang lain', await fails(db, `insert into public.sigaji_karyawan (tenant_key, nik, data) values ('main','K9','{"nik":"K9"}')`));
  assert('HRD cabang: tidak bisa pindahkan karyawan ke cabang lain', await fails(db, `update public.sigaji_karyawan set data = data - 'cabangId' where nik='K1'`));
  assert('HRD cabang: boleh tambah karyawan di cabangnya', (await rows(db, `insert into public.sigaji_karyawan (tenant_key, nik, data) values ('main','K4','{"nik":"K4","cabangId":"c2"}') returning cabang_id`))[0].cabang_id === 'c2');
  assert('HRD cabang: tidak bisa baca blob', (await rows(db, `select 1 from public.sigaji_cloud`)).length === 0);
  assert('HRD cabang: tidak bisa ubah peta role', await fails(db, `select public.sigaji_sync_user_roles('main', '[]'::jsonb)`));
});

await as(db, 'kar1', async () => {
  const k = await rows(db, `select nik from public.sigaji_karyawan`);
  assert('Karyawan: hanya data dirinya', k.map((x) => x.nik).join() === 'K1', k);
  const it = await rows(db, `select distinct nik from public.sigaji_item`);
  assert('Karyawan: absensi rekan tidak terbaca (kebocoran ditutup)', it.map((x) => x.nik).join() === 'K1', it);
  const s = await rows(db, `select store_key from public.sigaji_store order by store_key`);
  assert('Karyawan: store hanya profil/master (tanpa users & absensi)', s.map((x) => x.store_key).join() === 'perusahaan', s);
  assert('Karyawan: tidak bisa menulis', (await rows(db, `update public.sigaji_karyawan set data='{}' returning 1`)).length === 0);
  const r = await rpc(db, 'sigaji_save_rows', ['item', JSON.stringify([{ key: { kind: 'absensi', item_key: 'K1|2026-11' }, nik: 'K1', data: { '2026-11-01': 'H' } }]), '[]', 'main']);
  assert('Karyawan: RPC simpan ditolak RLS', r.saved.length === 0 && r.errors.length === 1, r);
});

await as(db, 'admin2', async () => {
  const k = await rows(db, `select tenant_key, nik from public.sigaji_karyawan`);
  assert('Admin tenant lain hanya lihat tenant-nya', k.length === 1 && k[0].nik === 'X1', k);
});

// ── Versi + simpan atomik ──
await as(db, 'admin', async () => {
  const v0 = (await rows(db, `select version from public.sigaji_karyawan where nik='K2'`))[0].version;
  await db.query(`update public.sigaji_karyawan set data = data where nik='K2'`);
  const vSame = (await rows(db, `select version from public.sigaji_karyawan where nik='K2'`))[0].version;
  assert('upsert tanpa perubahan isi tidak menaikkan versi', String(vSame) === String(v0));

  let r = await rpc(db, 'sigaji_save_rows', ['karyawan', JSON.stringify([{ key: { nik: 'K2' }, data: { nik: 'K2', nama: 'Budi', gaji: 7500000 }, base_version: Number(v0) }]), '[]', 'main']);
  assert('simpan dengan versi cocok → tersimpan, versi naik', r.saved.length === 1 && Number(r.saved[0].version) === Number(v0) + 1, r);

  r = await rpc(db, 'sigaji_save_rows', ['karyawan', JSON.stringify([{ key: { nik: 'K2' }, data: { nik: 'K2', nama: 'Budi', gaji: 1 }, base_version: Number(v0) }]), '[]', 'main']);
  assert('simpan dengan versi usang → bentrok + data awan, tidak menimpa', r.saved.length === 0 && r.conflicts.length === 1 && r.conflicts[0].data.gaji === 7500000, r);

  r = await rpc(db, 'sigaji_save_rows', ['karyawan', JSON.stringify([{ key: { nik: 'K2' }, data: { nik: 'K2' }, base_version: null }]), '[]', 'main']);
  assert('"baru" padahal sudah dibuat orang lain → bentrok', r.conflicts.length === 1);

  r = await rpc(db, 'sigaji_save_rows', ['item', JSON.stringify([{ key: { kind: 'absensi', item_key: 'K3|2026-11' }, nik: 'K3', data: { '2026-11-02': 'H' }, base_version: null }]), '[]', 'main']);
  const ni = (await rows(db, `select cabang_id, version from public.sigaji_item where item_key='K3|2026-11'`))[0];
  assert('item baru via RPC: versi 1, cabang dari karyawan', r.saved.length === 1 && ni.cabang_id === 'c2' && Number(ni.version) === 1, { r, ni });

  r = await rpc(db, 'sigaji_save_rows', ['periode', '[]', JSON.stringify([{ key: { nama: 'Okt 2026' }, base_version: 99 }]), 'main']);
  assert('hapus dengan versi usang → bentrok, tidak terhapus', r.deleted.length === 0 && r.conflicts.length === 1, r);

  r = await rpc(db, 'sigaji_save_rows', ['periode', '[]', JSON.stringify([{ key: { nama: 'Tidak Ada' }, base_version: 1 }]), 'main']);
  assert('hapus baris yang sudah tidak ada → dianggap terhapus', r.deleted.length === 1);

  const t0 = (await rows(db, `select now() - interval '1 second' as t`))[0].t;
  await rpc(db, 'sigaji_save_rows', ['item', '[]', JSON.stringify([{ key: { kind: 'lembur', item_key: 'K1' } }]), 'main']);
  await db.query(`update public.sigaji_karyawan set data = data || '{"cabangId":"utama"}' where nik='K1'`);
  const ch = await rpc(db, 'sigaji_changes_since', [t0, 'main']);
  assert('tarik perubahan: baris berubah + jejak hapus', ch.karyawan.some((x) => x.nik === 'K1') && ch.deleted.some((d) => d.tbl === 'sigaji_item' && d.key.item_key === 'K1'), ch);
  const moved = await rows(db, `select distinct cabang_id from public.sigaji_item where nik='K1'`);
  assert('pindah cabang karyawan → absensinya ikut pindah', moved.length === 1 && moved[0].cabang_id === 'utama', moved);

  const sync = await rpc(db, 'sigaji_sync_user_roles', [
    'main',
    JSON.stringify([
      { username: 'admin', role: 'Admin', email: 'admin@pt.co' },
      { username: 'hrdc2', role: 'HRD', email: 'hrd.c2@pt.co', cabangId: 'c3' },
      { username: 'ani', role: 'Karyawan', email: 'kar1@pt.co', nik: 'K1' },
      { username: 'baru', role: 'Karyawan', email: 'baru@pt.co', nik: 'K3' },
      { username: 'hantu', role: 'Karyawan', email: 'hantu@pt.co' },
    ]),
  ]);
  const ur = await rows(db, `select username, cabang_id, aktif from public.sigaji_user_roles where tenant_key='main' order by username`);
  const by = Object.fromEntries(ur.map((x) => [x.username, x]));
  assert('sinkron user: cabang diperbarui, user baru tertaut lewat email', by.hrdc2.cabang_id === 'c3' && by.baru && by.baru.aktif, ur);
  assert('sinkron user: yang dihapus dari daftar dinonaktifkan', by.hrd && by.hrd.aktif === false);
  assert('sinkron user: email tanpa akun dilaporkan', sync.unmatched.includes('hantu'), sync);
});

await as(db, 'hrdC2', async () => {
  const k = await rows(db, `select nik from public.sigaji_karyawan`);
  assert('HRD dipindah ke cabang lain → data cabang lama tidak terlihat lagi', k.length === 0, k);
});
await as(db, 'hrdPusat', async () => {
  assert('HRD yang dinonaktifkan kehilangan akses', (await rows(db, `select 1 from public.sigaji_karyawan`)).length === 0);
});

{
  const tenantAdd = readFileSync(join(root, 'sql/supabase_tenant_add.sql'), 'utf8');
  const core = tenantAdd.slice(0, tenantAdd.indexOf('-- ── 5–8)'));
  const pt3Admin = '00000000-0000-0000-0000-000000000031';
  await db.exec(`
    insert into auth.users (id, email) values ('${pt3Admin}', 'admin@pt3.co');
    alter table public.sigaji_tenant_meta add column if not exists max_employees int,
      add column if not exists plan_label text, add column if not exists storage_note text;
  `);
  await db.exec(core.replace(/__TENANT_KEY__/g, 'pt3').replace(/__ADMIN_EMAIL__/g, 'Admin@PT3.co'));
  await db.exec(`insert into public.sigaji_karyawan (tenant_key, nik, data) values ('pt3', 'Z1', '{"nik":"Z1"}')`);
  const pol = await rows(db, `select policyname from pg_policies where policyname like '%pt3%'`);
  assert('tenant baru setelah v12: tidak ada kebijakan longgar per tenant', pol.length === 0, pol);
  await as(db, 'admin', async () => {
    assert('tenant baru: Admin tenant lain tidak bisa baca', (await rows(db, `select 1 from public.sigaji_karyawan where tenant_key='pt3'`)).length === 0);
  });
  UID.pt3 = pt3Admin;
  await as(db, 'pt3', async () => {
    const k = await rows(db, `select nik from public.sigaji_karyawan`);
    assert('tenant baru: Admin pertama terdaftar & hanya melihat tenantnya', k.map((x) => x.nik).join() === 'Z1', k);
  });
}

{
  await db.exec(`update public.sigaji_user_roles set cabang_id = 'c2', aktif = true where username = 'hrdc2'`);
  await db.exec(`
    create table if not exists public.sigaji_work_locations (
      id uuid primary key,
      tenant_key text not null,
      nama text not null,
      lat double precision not null default 0,
      lon double precision not null default 0,
      radius_m int not null default 200,
      cabang_id text
    );
    alter table public.sigaji_work_locations enable row level security;
    grant select, insert, update, delete on public.sigaji_work_locations to authenticated;
    insert into public.sigaji_work_locations (id, tenant_key, nama, cabang_id) values
      ('00000000-0000-0000-0000-0000000000a1', 'main', 'Site A', 'c2'),
      ('00000000-0000-0000-0000-0000000000b1', 'main', 'Site B', 'c9'),
      ('00000000-0000-0000-0000-0000000000c1', 'main', 'Kantor bersama', null);
  `);
  await db.exec(sqlKetat);
  await as(db, 'hrdC2', async () => {
    const loc = await rows(db, `select nama from public.sigaji_work_locations order by nama`);
    assert(
      'HRD cabang: lokasi hanya cabangnya + bersama',
      loc.map((x) => x.nama).join() === 'Kantor bersama,Site A',
      loc
    );
    assert(
      'HRD cabang: tidak bisa tulis lokasi cabang lain',
      (await rows(db, `update public.sigaji_work_locations set nama='X' where nama='Site B' returning 1`)).length === 0
    );
  });
  await as(db, 'admin', async () => {
    const loc = await rows(db, `select nama from public.sigaji_work_locations`);
    assert('Admin: semua lokasi kerja', loc.length === 3, loc);
  });
}

if (failed) {
  console.error('\n' + failed + ' tes SQL v12 gagal.');
  process.exit(1);
}
console.log('\nSemua tes SQL v12 lulus.');
