/**
 * Memuat fungsi payroll SiGaji asli (app-core.js) di Node — tanpa browser, tanpa Supabase.
 * Data karyawan di sini hanya variabel memori kosong / contoh fiktif, bukan database Anda.
 */
import fs from 'fs';
import path from 'path';
import vm from 'vm';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..', '..');

/** Sandbox minimal: stub UI/cloud agar app-core.js bisa diparse tanpa error. */
export function createPayrollSandbox(overrides = {}) {
  const sandbox = {
    window: {},
    document: { getElementById: () => null, querySelector: () => null },
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
    setTimeout,
    clearTimeout,
    perusahaan: { hariKerja: 6 },
    periodes: [
      {
        id: 1,
        nama: 'Maret 2026',
        start: '2026-02-25',
        end: '2026-03-24',
        bayar: '2026-03-25',
        status: 'aktif',
        thr_aktif: false,
        tipe_periode: 'biasa',
      },
    ],
    hariLibur: [],
    masterCuti: { cbPotong: false, kuota: 12 },
    absensi: {},
    prorata: {},
    thrManual: {},
    lembur: {},
    karSnapshot: {},
    karyawan: [],
    tunjVarBulan: {},
    tunjVarLabels: {},
    approvals: [],
    notifikasi: [],
    saveAll: () => {},
    renderPenggajian: () => {},
    toast: () => {},
    ...overrides,
  };
  sandbox.window = sandbox;
  return sandbox;
}

/** Muat constants.js + ptkp.js + app-core.js ke sandbox; kembalikan API payroll. */
export function loadPayrollCore(overrides = {}) {
  const sandbox = createPayrollSandbox(overrides);
  const ctx = vm.createContext(sandbox);
  const run = (rel) => {
    const file = path.join(ROOT, rel);
    vm.runInContext(fs.readFileSync(file, 'utf8'), ctx, { filename: rel });
  };
  run('js/constants.js');
  run('js/ptkp.js');
  run('js/modules/app-core.js');
  return sandbox;
}
