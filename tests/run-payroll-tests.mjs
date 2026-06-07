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
