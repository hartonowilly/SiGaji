/**
 * Skala tenant ~400 karyawan, 2 cabang: HRD A vs B, ganti periode lama, jejak audit.
 * Bukan pengganti uji login produksi — di sini ketahuan hitung NaN, arsip salah jendela, atau bocoran daftar.
 * Jalankan: node tests/skala-cabang.test.mjs
 */
import fs from 'fs';
import path from 'path';
import vm from 'vm';
import { fileURLToPath } from 'url';
import { loadPayrollCore } from './lib/payroll-harness.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');

function assert(name, cond, extra) {
  if (!cond) throw new Error('FAIL: ' + name + (extra !== undefined ? ' — ' + JSON.stringify(extra).slice(0, 400) : ''));
  console.log('OK: ' + name);
}

const pad = (n) => String(n).padStart(3, '0');
const N = 400;

function buildTenant() {
  const cabang = [
    { id: 'cA', nama: 'Cabang A', aktif: true },
    { id: 'cB', nama: 'Cabang B', aktif: true },
  ];
  const periodes = [
    {
      id: 1,
      nama: 'Jan 2024',
      start: '2023-12-25',
      end: '2024-01-24',
      bayar: '2024-01-25',
      status: 'tutup',
      snapshot_locked: true,
    },
    {
      id: 2,
      nama: 'Sep 2026',
      start: '2026-08-25',
      end: '2026-09-24',
      bayar: '2026-09-25',
      status: 'tutup',
      snapshot_locked: true,
    },
    {
      id: 3,
      nama: 'Okt 2026',
      start: '2026-09-25',
      end: '2026-10-24',
      bayar: '2026-10-25',
      status: 'aktif',
      snapshot_locked: false,
    },
  ];
  const karyawan = [];
  const absensi = {};
  const karSnapshot = { 'Jan 2024': {}, 'Sep 2026': {} };
  const users = [
    { username: 'admin', role: 'Admin', email: 'admin@pt.co', nama: 'Admin' },
    { username: 'hrda', role: 'HRD', email: 'hrd.a@pt.co', nama: 'Sari HRD A', cabangId: 'cA' },
    { username: 'hrdb', role: 'HRD', email: 'hrd.b@pt.co', nama: 'Budi HRD B', cabangId: 'cB' },
  ];
  const approvals = [];
  const auditLog = [];
  for (let i = 0; i < N; i++) {
    const cab = i < N / 2 ? 'cA' : 'cB';
    const nik = (cab === 'cA' ? 'A' : 'B') + pad(i % (N / 2));
    const k = {
      nik,
      nama: (cab === 'cA' ? 'Ani ' : 'Budi ') + (i % (N / 2)),
      cabangId: cab,
      gapok: 4_000_000 + (i % 50) * 50_000 + (cab === 'cB' ? 75_000 : 0),
      ptkp: 'TK0',
      masuk: '2019-01-15',
      tunjangan: [{ nama: 'Transport', nilai: 200_000 }],
      potongan: [],
      natura: [],
      bpjs_aktif: { 'kes-prs': true, 'kes-kar': true, 'jht-prs': true, 'jht-kar': true, 'jkk-prs': true, 'jkm-prs': true },
    };
    karyawan.push(k);
    absensi[nik] = { '2026-10-01': 'hadir', '2026-10-02': i % 17 === 0 ? 'izin' : 'hadir' };
    karSnapshot['Jan 2024'][nik] = Object.assign({}, k, { gapok: k.gapok - 100_000 });
    karSnapshot['Sep 2026'][nik] = Object.assign({}, k);
    if (i % 40 === 0) approvals.push({ id: 'ap-' + nik, nik, status: 'pending' });
    if (i % 55 === 0) {
      auditLog.push({
        ts: '2026-10-02T08:00:00.000Z',
        nik,
        nama: k.nama,
        by: 'Admin',
        action: 'Simpan Komponen Gaji',
        detail: 'gapok=' + k.gapok,
      });
    }
  }
  return { cabang, periodes, karyawan, absensi, karSnapshot, users, approvals, auditLog };
}

const data = buildTenant();
assert('fixture 400 karyawan, 200 per cabang', data.karyawan.length === 400 && data.karyawan.filter((k) => k.cabangId === 'cA').length === 200);

const core = loadPayrollCore({
  perusahaan: { hariKerja: 6, nama: 'PT Skala' },
  periodes: data.periodes,
  karyawan: data.karyawan,
  absensi: data.absensi,
  karSnapshot: data.karSnapshot,
  prorata: {},
  hariLibur: [],
  masterCuti: { kuota: 12, cbPotong: false },
  auditLog: [],
  CU: { nama: 'Sari HRD A', username: 'hrda', email: 'hrd.a@pt.co', role: 'HRD', cabangId: 'cA' },
});

core.logPayrollAudit('A000', 'Simpan Komponen Gaji', 'master gapok=4000000');
const entry = (core.auditLog || [])[0];
assert('jejak audit: siapa, NIK, jam, aksi', !!(entry && entry.by === 'Sari HRD A' && entry.nik === 'A000' && entry.ts && entry.action === 'Simpan Komponen Gaji'), entry);
assert('jejak audit: email & nama karyawan ikut', entry.byEmail === 'hrd.a@pt.co' && entry.nama === 'Ani 0', entry);

core.logPayrollAudit('A000', 'Ubah Absensi', '2026-10-01 H → A');
assert('jejak audit: ubah absensi tercatat', core.auditLog[0].action === 'Ubah Absensi' && /2026-10-01/.test(core.auditLog[0].detail));

const t0 = Date.now();
let nan = 0;
let sumA = 0;
let sumB = 0;
data.karyawan.forEach((k) => {
  const g = core.hitungGaji(k, 'Okt 2026');
  const take = Number(g && g.neto);
  if (!Number.isFinite(take)) nan++;
  if (k.cabangId === 'cA') sumA += Number(g && g.gapokEff) || 0;
  else sumB += Number(g && g.gapokEff) || 0;
});
const msHitung = Date.now() - t0;
assert('hitung 400 karyawan periode aktif: tanpa NaN', nan === 0);
assert('total gapok efektif cabang A dan B beda (bukan angka aneh sama rata)', sumA > 0 && sumB > 0 && sumA !== sumB, { sumA, sumB });
assert('hitung 400 karyawan selesai dalam 20 detik', msHitung < 20_000, msHitung);
console.log('  hitung 400 karyawan: ' + msHitung + ' ms');

nan = 0;
data.karyawan.slice(0, 40).forEach((k) => {
  const g = core.hitungGaji(k, 'Jan 2024');
  const take = Number(g && g.neto);
  if (!Number.isFinite(take)) nan++;
});
assert('ganti periode lama (Jan 2024 terkunci): hitung 40 sampel tanpa NaN', nan === 0);

const ctx = { console, setTimeout, window: null };
ctx.window = ctx;
ctx.globalThis = ctx;
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(ROOT, 'js/cloud-delta.js'), 'utf8'), ctx);
vm.runInContext(fs.readFileSync(path.join(ROOT, 'js/cloud-tables.js'), 'utf8'), ctx);
const T = ctx.sigajiCloudTables;

const now = new Date(Date.UTC(2026, 9, 23));
const plan = T.archivePlan(data.periodes, now);
assert('arsip: periode terkunci 2024 masuk jendela dingin', plan && plan.cold['Jan 2024'] === true, plan);
assert('arsip: periode 2026 tetap panas', plan && !plan.cold['Sep 2026'] && !plan.cold['Okt 2026'], plan);

const payload = {
  karyawan: data.karyawan,
  users: data.users,
  approvals: data.approvals,
  auditLog: data.auditLog,
};
const accA = { hq: false, cabang: 'cA', username: 'hrda', email: 'hrd.a@pt.co', role: 'HRD' };
const accB = { hq: false, cabang: 'cB', username: 'hrdb', email: 'hrd.b@pt.co', role: 'HRD' };
const a = T.scopePayloadForBranch(JSON.parse(JSON.stringify(payload)), accA);
const b = T.scopePayloadForBranch(JSON.parse(JSON.stringify(payload)), accB);
assert('HRD A hanya 200 karyawan cabang A', a.karyawan.length === 200 && a.karyawan.every((k) => k.cabangId === 'cA'));
assert('HRD B hanya 200 karyawan cabang B', b.karyawan.length === 200 && b.karyawan.every((k) => k.cabangId === 'cB'));
assert('HRD A tidak melihat user Admin / HRD B', !a.users.some((u) => u.username === 'admin' || u.username === 'hrdb'));
assert('HRD B tidak melihat user Admin / HRD A', !b.users.some((u) => u.username === 'admin' || u.username === 'hrda'));
assert(
  'HRD A tidak melihat persetujuan cabang B',
  a.approvals.every((x) => String(x.nik).charAt(0) === 'A') && b.approvals.every((x) => String(x.nik).charAt(0) === 'B')
);
assert(
  'HRD A tidak melihat jejak audit cabang B',
  a.auditLog.every((e) => String(e.nik).charAt(0) === 'A') && b.auditLog.every((e) => String(e.nik).charAt(0) === 'B')
);

const hq = T.scopePayloadForBranch(JSON.parse(JSON.stringify(payload)), { hq: true, cabang: '' });
assert('Admin tetap melihat seluruh 400 karyawan', hq.karyawan.length === 400);

console.log('\nSemua tes skala cabang lulus.');
