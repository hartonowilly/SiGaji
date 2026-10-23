/**
 * Jalankan semua tes payroll (Lapisan A + B).
 * Aman: tidak konek Supabase, tidak ubah data produksi.
 *
 *   npm test
 *   npm run test:payroll
 */
import { spawnSync } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const node = process.execPath;

const suites = [
  'payroll-pure.test.mjs',
  'payroll-scenario.test.mjs',
  'payroll-scenario-advanced.test.mjs',
  'payroll-scenario-resign.test.mjs',
  'payroll-slip-fixture.test.mjs',
  'absensi-setengah-hari.test.mjs',
  'koreksi-absensi.test.mjs',
  'cuti-rincian.test.mjs',
  'mutasi-cabang.test.mjs',
  'siklus-gaji.test.mjs',
  'siklus-bayar-dummy.test.mjs',
  'karyawan-in-periode.test.mjs',
  'timeline-tahun.test.mjs',
  'angka-teks.test.mjs',
  'penyimpanan-lokal.test.mjs',
  'migrasi-pph-import.test.mjs',
  'sinkron-delta.test.mjs',
  'cloud-tables-delta.test.mjs',
  'cloud-tables-v12.test.mjs',
  'arsip-boot.test.mjs',
  'skala-cabang.test.mjs',
  'hitung-cepat-setara.test.mjs',
  'payroll-worker.test.mjs',
  'sql-v12.test.mjs',
  'server-tenant-data.test.mjs',
  'bpjs-upah.test.mjs',
  'aturan-pajak-kunci.test.mjs',
  'build-banner.test.mjs',
];
let failed = 0;

console.log('SiGaji — tes payroll (data fiktif, tanpa database)\n');

for (const file of suites) {
  console.log('── ' + file + ' ──');
  const r = spawnSync(node, [path.join(__dirname, file)], {
    stdio: 'inherit',
    encoding: 'utf8',
  });
  if (r.status !== 0) failed++;
  console.log('');
}

if (failed) {
  console.error('GAGAL: ' + failed + ' suite.');
  process.exit(1);
}
console.log('Semua suite payroll lulus.');
