/**
 * Tes fixture slip emas (JSON) — salin angka dari slip nyata ke tests/fixtures/slip-emas.json.
 * Tidak menyentuh database.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { loadPayrollCore } from './lib/payroll-harness.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FIXTURE_PATH = path.join(__dirname, 'fixtures', 'slip-emas.json');

function assertEq(name, actual, expected) {
  if (actual !== expected) {
    throw new Error('FAIL: ' + name + ' — dapat ' + actual + ', harus ' + expected);
  }
  console.log('OK: ' + name);
}

const raw = JSON.parse(fs.readFileSync(FIXTURE_PATH, 'utf8'));
const cases = raw.cases || [];
if (!cases.length) throw new Error('slip-emas.json kosong');

const px = loadPayrollCore();
let n = 0;

for (const c of cases) {
  const label = c.id || 'case';
  const g = px.hitungGaji(c.karyawan, c.periode, { skipResolve: true });
  const exp = c.expected || {};
  if (exp.grossPPh != null) {
    assertEq(label + ' grossPPh', g.grossPPh, exp.grossPPh);
    n++;
  }
  if (exp.pph != null) {
    assertEq(label + ' pph', g.pph, exp.pph);
    n++;
  }
  if (exp.neto != null) {
    assertEq(label + ' neto', g.neto, exp.neto);
    n++;
  }
  if (exp.thrBruto != null) {
    assertEq(label + ' thrBruto', g.thrBruto, exp.thrBruto);
    n++;
  }
}

console.log('\nFixture slip emas: semua tes lulus (' + n + ' assert).');
