/**
 * Tes rumus mutasi cabang: total gapok + tunjangan tetap dipertahankan.
 * Jalankan: node tests/mutasi-cabang.test.mjs
 */
import fs from 'fs';
import path from 'path';
import vm from 'vm';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');

function assertEq(name, actual, expected) {
  if (actual !== expected) {
    throw new Error('FAIL: ' + name + ' — dapat ' + actual + ', harus ' + expected);
  }
  console.log('OK: ' + name);
}

const sandbox = {
  window: {},
  document: {
    getElementById: () => null,
    querySelector: () => null,
    querySelectorAll: () => [],
  },
  console,
  Date,
  Math,
  Object,
  Array,
  String,
  Number,
  parseInt,
  parseFloat,
  isNaN,
  JSON,
  cabang: [
    { id: 'utama', nama: 'Cabang A', umk: 2_500_000, aktif: true },
    { id: 'b', nama: 'Cabang B', umk: 2_400_000, aktif: true },
  ],
  karyawan: [],
  periodes: [],
  karSnapshot: {},
  perusahaan: { umk: { 2026: 2_500_000 } },
  tenantLicense: { multiBranchEnabled: true, maxBranches: 5 },
  CU: { role: 'Admin', nama: 'Tes' },
  toast() {},
  saveAll() {},
  escapeHtml(s) {
    return String(s);
  },
  fmt(n) {
    return String(n);
  },
  parseRpInput(v) {
    return Math.round(Number(v) || 0);
  },
  sigajiCatchWarn() {},
  sigajiDataAction() {
    return '';
  },
};
sandbox.window = sandbox;
vm.createContext(sandbox);
vm.runInContext(
  fs.readFileSync(path.join(ROOT, 'js/modules/sigaji-cabang.js'), 'utf8'),
  sandbox,
  { filename: 'sigaji-cabang.js' }
);

const hitung = sandbox.sigajiHitungMutasiKomponen;
const applyTunj = sandbox.sigajiApplyTunjTetapTotal;
const umkOf = sandbox.sigajiCabangUmk;

const k = {
  nik: 'K0001',
  gapok: 2_500_000,
  tunjangan: [
    { nama: 'Tunjangan Tetap', nilai: 300_000, tipe: 'tetap', thr_ikut: true },
    { nama: 'Lembur lump', nilai: 50_000, tipe: 'tidak_tetap' },
  ],
};

const turun = hitung(k, 2_400_000);
assertEq('UMK turun: gapok baru = UMK B', turun.gapokBaru, 2_400_000);
assertEq('UMK turun: tunj naik 100rb', turun.tunjBaru, 400_000);
assertEq('UMK turun: total sama', turun.totalBaru, 2_800_000);
assertEq('UMK turun: tidak floor', turun.floorUmk, false);

const naik = hitung(
  { gapok: 2_400_000, tunjangan: [{ nama: 'TT', nilai: 400_000, tipe: 'tetap' }] },
  2_500_000
);
assertEq('UMK naik: gapok = UMK A', naik.gapokBaru, 2_500_000);
assertEq('UMK naik: tunj dipotong 100rb', naik.tunjBaru, 300_000);
assertEq('UMK naik: total sama', naik.totalBaru, 2_800_000);

const floor = hitung(
  { gapok: 2_400_000, tunjangan: [{ nama: 'TT', nilai: 50_000, tipe: 'tetap' }] },
  2_500_000
);
assertEq('Floor: tunj 0', floor.tunjBaru, 0);
assertEq('Floor: gapok UMK', floor.gapokBaru, 2_500_000);
assertEq('Floor: total naik', floor.totalBaru, 2_500_000);
assertEq('Floor flag', floor.floorUmk, true);

const applied = applyTunj(k.tunjangan, 400_000);
const tetap = applied.filter((t) => t.tipe === 'tetap');
const lain = applied.filter((t) => t.tipe !== 'tetap');
assertEq('Apply: tunj tetap total 400rb', tetap.reduce((s, t) => s + t.nilai, 0), 400_000);
assertEq('Apply: tunj tidak tetap utuh', lain[0].nilai, 50_000);

const created = applyTunj([], 200_000);
assertEq('Apply: buat baris baru', created[0].nilai, 200_000);
assertEq('Apply: tipe tetap', created[0].tipe, 'tetap');

assertEq('UMK cabang B dari master cabang', umkOf('b'), 2_400_000);
assertEq('UMK cabang A dari master cabang', umkOf('utama'), 2_500_000);

console.log('Semua tes mutasi cabang lulus.');
