/**
 * Impor Excel saldo PPh tengah tahun (app-migrasi-pph.js) — jalankan fungsi asli dengan Excel tiruan.
 * Jalankan: node tests/migrasi-pph-import.test.mjs
 */
import fs from 'fs';
import path from 'path';
import vm from 'vm';
import { fileURLToPath } from 'url';
import { loadPayrollCore } from './lib/payroll-harness.mjs';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

function assertEq(name, actual, expected) {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error('FAIL: ' + name + ' — dapat ' + JSON.stringify(actual) + ', harus ' + JSON.stringify(expected));
  }
  console.log('OK: ' + name);
}

function runImport(rows, karyawan) {
  const toasts = [];
  const px = loadPayrollCore({
    karyawan,
    toast: (m) => toasts.push(m),
    renderKar: () => {},
    renderDash: () => {},
    populateSelects: () => {},
    sigajiAssertCanAddActiveEmployees: () => true,
    sigajiCanAddActiveEmployees: () => ({ ok: true }),
    XLSX: {
      read: () => ({ SheetNames: ['S'], Sheets: { S: {} } }),
      utils: { sheet_to_json: () => rows },
    },
    FileReader: class {
      readAsArrayBuffer() {
        this.onload({ target: { result: new ArrayBuffer(0) } });
      }
    },
    document: {
      getElementById: (id) => (id === 'migrasi-pph-tahun' ? { value: '2026' } : null),
      querySelector: () => null,
    },
  });
  const ctx = vm.createContext(px);
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'js/modules/app-migrasi-pph.js'), 'utf8'), ctx);
  const inp = { files: [{}], value: 'x.xlsx' };
  px.importMigrasiPphExcel(inp);
  return { toasts, karyawan: vm.runInContext('karyawan', ctx) };
}

const header = ['NIK', 'Nama', 'Status', 'Tgl berhenti', 'S/d bulan', 'Bruto PPh 21', 'PPh terpotong', 'PTKP', 'Gaji pokok'];

{
  const kar = [{ nik: '001', nama: 'Lama', gapok: 5_000_000, ptkp: 'TK0' }];
  const { toasts, karyawan } = runImport([header, ['001', '', 'Aktif', '', 4, '24.000.000', '480.000', '', '']], kar);
  assertEq('impor tanpa kolom Tahun tidak crash', toasts[0].indexOf('Gagal'), -1);
  assertEq('saldo masuk ke tahun UI', karyawan[0].pph_ytd_awal['2026'], { bruto: 24_000_000, pph: 480_000, sd_bulan: 4 });
}

{
  const kar = [{ nik: '001', nama: 'Lama', gapok: 5_000_000, ptkp: 'TK0' }];
  const { toasts, karyawan } = runImport([[...header, 'Tahun'], ['001', '', 'Aktif', '', 3, 18_000_000, 360_000, '', '', 2025]], kar);
  assertEq('impor dengan kolom Tahun tidak crash', toasts[0].indexOf('Gagal'), -1);
  assertEq('kolom Tahun dipakai', Object.keys(karyawan[0].pph_ytd_awal), ['2025']);
}

console.log('\nImpor migrasi PPh: semua tes lulus.');
