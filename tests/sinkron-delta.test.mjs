/**
 * Sinkron awan per baris: hanya kirim yang berubah, tidak hapus baris milik sesi lain,
 * gabung 3 arah saat dua HRD mengubah data yang sama.
 * Jalankan: node tests/sinkron-delta.test.mjs
 */
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const D = require('../js/cloud-delta.js');

function assert(name, cond) {
  if (!cond) throw new Error('FAIL: ' + name);
  console.log('OK: ' + name);
}

function payload() {
  return {
    karyawan: [
      { nik: 'K001', nama: 'Ani', gapok: 5000000, cabangId: 'utama' },
      { nik: 'K002', nama: 'Budi', gapok: 6000000, cabangId: 'c2' },
    ],
    periodes: [{ nama: 'Okt 2026', start: '2026-09-25', end: '2026-10-24' }],
    perusahaan: { nama: 'PT Uji', hariKerja: 5 },
    users: [{ username: 'admin', role: 'Admin' }],
    absensi: { K001: { '2026-10-01': 'izin', '2026-09-30': 'sakit' } },
    lembur: { K002: [{ tanggal: '2026-10-02', jam: 2 }], K001: [] },
    thrManual: { 'THR 2026': { K001: { aktif: true, nilai: 100 } } },
    karSnapshot: { 'Okt 2026': { K002: { gapok: 6000000 } } },
    tunjVarColumns: [{ id: 'v1', nama: 'Bonus' }],
    tunjVarBulan: { 'Okt 2026': { K001: { v1: 250000 }, K002: { v1: 0 } } },
  };
}

function baseFrom(entities) {
  const base = D.createBase();
  entities.forEach((e) => base.put(e, 1));
  return base;
}

// ── kanonik ────────────────────────────────────────────────────────────────
assert(
  'stableStringify tak peduli urutan kunci (jsonb mengurutkan ulang)',
  D.stableStringify({ b: 1, a: { d: 2, c: 3 } }) === D.stableStringify({ a: { c: 3, d: 2 }, b: 1 })
);
assert('stableStringify buang undefined seperti JSON', D.stableStringify({ a: undefined, b: 1 }) === '{"b":1}');

// ── pecah payload ──────────────────────────────────────────────────────────
const ents = D.explodePayload(payload(), { items: false });
const ids = ents.map((e) => e.id);
assert('karyawan jadi baris per NIK', ids.includes('K|K001') && ids.includes('K|K002'));
assert('mode v11: absensi tetap satu dokumen store', ids.includes('S|absensi') && !ids.some((i) => i.startsWith('I|')));
assert('tunjangan 0 tidak dikirim', !ids.some((i) => i.includes('K002\u0001v1')));
{
  const dup = D.explodePayload({ karyawan: [{ nik: 'K1', nama: 'a' }, { nik: 'K1', nama: 'b' }] });
  assert('NIK dobel di memori → satu baris (upsert Postgres tidak gagal)', dup.filter((e) => e.t === 'K').length === 1);
}

const entsV12 = D.explodePayload(payload(), { items: true });
const idsV12 = entsV12.map((e) => e.id);
assert('mode v12: absensi per NIK per bulan', idsV12.includes('I|absensi|K001|2026-10') && idsV12.includes('I|absensi|K001|2026-09'));
assert('mode v12: store absensi tidak lagi dikirim', !idsV12.includes('S|absensi'));
assert('mode v12: lembur kosong tidak jadi baris', !idsV12.includes('I|lembur|K001') && idsV12.includes('I|lembur|K002'));
assert('mode v12: THR manual per periode|nik', idsV12.includes('I|thrManual|THR 2026|K001'));

// ── rencana unggah ─────────────────────────────────────────────────────────
{
  const base = baseFrom(ents);
  const p = payload();
  const plan0 = D.planChanges(D.explodePayload(p), base);
  assert('tanpa perubahan → tidak ada yang dikirim', plan0.upserts.length === 0 && plan0.deletes.length === 0);

  p.karyawan[0].gapok = 5500000;
  const plan1 = D.planChanges(D.explodePayload(p), base);
  assert('ubah satu karyawan → hanya satu baris dikirim', plan1.upserts.length === 1 && plan1.upserts[0].e.id === 'K|K001');

  const reordered = { nama: 'Ani', cabangId: 'utama', gapok: 5000000, nik: 'K001' };
  const p2 = payload();
  p2.karyawan[0] = reordered;
  assert('urutan kunci beda tidak dianggap berubah', D.planChanges(D.explodePayload(p2), base).upserts.length === 0);

  const p3 = payload();
  p3.karyawan.splice(1, 1);
  const plan3 = D.planChanges(D.explodePayload(p3), base);
  assert('hapus karyawan lokal → hapus eksplisit satu baris', plan3.deletes.length === 1 && plan3.deletes[0].id === 'K|K002');
}

{
  const base = D.createBase();
  const plan = D.planChanges(D.explodePayload(payload()), base);
  assert('base kosong (muat dari blob/lokal) → tidak pernah menghapus', plan.deletes.length === 0 && plan.upserts.length > 0);
}

{
  const base = baseFrom(ents);
  base.put(D.entityFromRow('K', { nik: 'K999', data: { nik: 'K999' } }), 1);
  const plan = D.planChanges(D.explodePayload(payload()), base);
  assert(
    'karyawan baru dari HRD lain (ada di base, tak ada lokal) hanya terhapus jika memang ada di base sesi ini',
    plan.deletes.length === 1 && plan.deletes[0].id === 'K|K999'
  );
  const fresh = baseFrom(ents);
  const plan2 = D.planChanges(D.explodePayload(payload()), fresh);
  assert('baris awan yang belum pernah dimuat sesi ini tidak dihapus', plan2.deletes.length === 0);
}

{
  const big = { karyawan: [] };
  for (let i = 0; i < 20; i++) big.karyawan.push({ nik: 'N' + i });
  const base = baseFrom(D.explodePayload(big));
  const plan = D.planChanges(D.explodePayload({ karyawan: big.karyawan.slice(0, 2) }), base, ['K']);
  const sus = D.suspiciousMassDelete(plan, base);
  assert('hapus 18 dari 20 karyawan terdeteksi mencurigakan', sus && sus.t === 'K' && sus.n === 18);
  const plan2 = D.planChanges(D.explodePayload({ karyawan: big.karyawan.slice(0, 18) }), base, ['K']);
  assert('hapus 2 karyawan normal', D.suspiciousMassDelete(plan2, base) === null);
}

{
  const base = baseFrom(entsV12);
  const plan = D.planChanges(D.explodePayload(payload(), { items: false }), base, ['K', 'P', 'S', 'C', 'T']);
  assert('jenis yang tidak dikelola (item) tidak ikut dihapus', !plan.deletes.some((d) => d.base.t === 'I'));
}

// ── gabung 3 arah ──────────────────────────────────────────────────────────
{
  const base = { nik: 'K001', gapok: 5000000, alamat: 'Jl. A' };
  const local = { nik: 'K001', gapok: 5500000, alamat: 'Jl. A' };
  const server = { nik: 'K001', gapok: 5000000, alamat: 'Jl. B' };
  const r = D.mergeEntity(base, local, server);
  assert('HRD A ubah gaji + HRD B ubah alamat → keduanya tersimpan', r.value.gapok === 5500000 && r.value.alamat === 'Jl. B');
  assert('tanpa bentrok', r.conflicts.length === 0);
}
{
  const r = D.mergeEntity({ gapok: 1 }, { gapok: 2 }, { gapok: 3 });
  assert('field sama diubah dua sisi → nilai lokal + dilaporkan', r.value.gapok === 2 && r.conflicts[0] === 'gapok');
}
{
  const base = [{ id: 1, t: 'a' }];
  const local = [{ id: 1, t: 'a' }, { id: 2, t: 'lokal' }];
  const server = [{ id: 1, t: 'a' }, { id: 3, t: 'awan' }];
  const r = D.mergeEntity(base, local, server);
  assert(
    'daftar ber-id (notifikasi/audit) digabung: entri baru dua sisi tetap ada',
    r.value.length === 3 && r.conflicts.length === 0
  );
}
{
  const e0 = { ts: '1', nik: 'K1', action: 'lama' };
  const mine = { ts: '3', nik: 'K1', action: 'sesi ini' };
  const theirs = { ts: '2', nik: 'K1', action: 'HRD lain' };
  const r = D.mergeEntity([e0], [mine, e0], [theirs, e0]);
  assert(
    'log audit tanpa id: entri dua HRD sama-sama tersimpan, tambahan sesi ini di depan',
    r.value.length === 3 && r.value[0].action === 'sesi ini' && r.value[1].action === 'HRD lain' && r.conflicts.length === 0
  );
  const r2 = D.mergeEntity([e0, theirs], [theirs], [e0, theirs, mine]);
  assert('daftar tanpa id: hapusan lokal diterapkan, tambahan awan tetap', r2.value.length === 2 && !r2.value.some((x) => x.action === 'lama'));
}
{
  const r = D.mergeEntity(
    { '2026-10-01': 'izin' },
    { '2026-10-01': 'izin', '2026-10-02': 'sakit' },
    { '2026-10-01': 'hadir' }
  );
  assert('absensi bulan sama: tanggal berbeda digabung', r.value['2026-10-01'] === 'hadir' && r.value['2026-10-02'] === 'sakit');
}
{
  const r = D.mergeEntity(null, { nik: 'X' }, null);
  assert('baru lokal, tidak ada di awan → tetap', r.value && r.value.nik === 'X');
  const r2 = D.mergeEntity({ a: 1 }, { a: 1 }, null);
  assert('dihapus di awan, lokal tak berubah → ikut terhapus', r2.value === null && r2.conflicts.length === 0);
}

// ── terapkan ke memori ─────────────────────────────────────────────────────
{
  const mem = payload();
  const absRef = mem.absensi;
  const usersRef = mem.users;
  D.applyEntityToMemory(mem, D.entityFromRow('K', { nik: 'K003', data: { nik: 'K003', nama: 'Cici' } }), { nik: 'K003', nama: 'Cici' });
  assert('karyawan baru dari awan masuk memori', mem.karyawan.length === 3);
  D.applyEntityToMemory(mem, { t: 'K', key: { nik: 'K001' } }, null);
  assert('karyawan dihapus di awan hilang dari memori', !mem.karyawan.some((k) => k.nik === 'K001'));
  D.applyEntityToMemory(mem, { t: 'S', key: { store_key: 'users' } }, [{ username: 'baru' }]);
  assert('store diganti di tempat (referensi tetap)', mem.users === usersRef && usersRef[0].username === 'baru');
  const absEnt = D.entityFromRow('I', { kind: 'absensi', item_key: 'K001|2026-10', nik: 'K001', data: { '2026-10-05': 'cuti' } });
  D.applyEntityToMemory(mem, absEnt, absEnt.data);
  assert(
    'absensi bulan Okt diganti, bulan lain tetap',
    mem.absensi === absRef && absRef.K001['2026-10-05'] === 'cuti' && !absRef.K001['2026-10-01'] && absRef.K001['2026-09-30'] === 'sakit'
  );
  const thr = D.entityFromRow('I', { kind: 'thrManual', item_key: 'THR 2026|K001', nik: 'K001', data: null });
  D.applyEntityToMemory(mem, thr, null);
  assert('THR manual dihapus', !mem.thrManual['THR 2026']);
}

{
  const parts = D.itemsToPayloadParts([
    { kind: 'absensi', item_key: 'K1|2026-10', nik: 'K1', data: { '2026-10-01': 'izin' } },
    { kind: 'absensi', item_key: 'K1|2026-09', nik: 'K1', data: { '2026-09-01': 'sakit' } },
    { kind: 'karSnapshot', item_key: 'Okt|2026|K1', nik: 'K1', data: { gapok: 1 } },
    { kind: 'lembur', item_key: 'K1', nik: 'K1', data: [{ jam: 1 }] },
  ]);
  assert('susun ulang absensi dari banyak bulan', Object.keys(parts.absensi.K1).length === 2);
  assert('nama periode berisi "|" tetap utuh', parts.karSnapshot['Okt|2026'].K1.gapok === 1);
  assert('lembur per NIK', parts.lembur.K1.length === 1);
}

{
  const p = payload();
  const roundTrip = D.itemsToPayloadParts(
    D.explodePayload(p, { items: true })
      .filter((e) => e.t === 'I')
      .map((e) => ({ kind: e.key.kind, item_key: e.key.item_key, nik: e.nik, data: e.data }))
  );
  assert(
    'pecah lalu susun ulang item = data asal (tanpa lembur kosong)',
    D.stableStringify(roundTrip.absensi) === D.stableStringify(p.absensi) &&
      D.stableStringify(roundTrip.thrManual) === D.stableStringify(p.thrManual) &&
      D.stableStringify(roundTrip.lembur) === D.stableStringify({ K002: p.lembur.K002 })
  );
}

console.log('\nSemua tes sinkron delta lulus.');
