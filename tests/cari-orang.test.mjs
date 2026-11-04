/**
 * Cari karyawan dari nama/NIK — tanpa potong 200 orang di depan.
 */
import fs from 'fs';
import path from 'path';
import vm from 'vm';
import { fileURLToPath } from 'url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

function assert(name, cond) {
  if (!cond) throw new Error('FAIL: ' + name);
  console.log('OK: ' + name);
}

const src = fs.readFileSync(path.join(ROOT, 'js/modules/sigaji-ui-polish.js'), 'utf8');
const m = src.match(/window\.sigajiCariKaryawanFilter = function \(list, q\) \{[\s\S]*?\n\s{2}\};/);
if (!m) throw new Error('sigajiCariKaryawanFilter tidak ketemu');
const sandbox = { window: {}, isKarSampah: undefined };
sandbox.window = sandbox;
vm.runInNewContext(m[0], sandbox, { filename: 'sigajiCariKaryawanFilter.js' });

const list = [];
for (let i = 1; i <= 250; i++) {
  list.push({ nik: 'K' + String(i).padStart(4, '0'), nama: 'Orang ' + i, dept: 'Ops' });
}
list.push({ nik: 'K9999', nama: 'Syamsul Bahri', dept: 'Keuangan', jabatan: 'Staff' });

assert('kosong tanpa kata kunci', sandbox.sigajiCariKaryawanFilter(list, '').length === 0);
const byNama = sandbox.sigajiCariKaryawanFilter(list, 'syamsul');
assert('ketemu di luar 200 pertama', byNama.length === 1 && byNama[0].nik === 'K9999');
const byNik = sandbox.sigajiCariKaryawanFilter(list, 'k0005');
assert('ketemu by NIK', byNik.length === 1 && byNik[0].nama === 'Orang 5');
assert(
  'tanpa helper sampah tetap ketemu',
  sandbox.sigajiCariKaryawanFilter([{ nik: 'X', nama: 'Buang', dihapusPada: '2026-01-01' }], 'buang').length === 1
);
sandbox.isKarSampah = function (k) {
  return !!k.dihapusPada;
};
assert(
  'sampah disaring jika helper ada',
  sandbox.sigajiCariKaryawanFilter([{ nik: 'X', nama: 'Buang', dihapusPada: '2026-01-01' }], 'buang').length === 0
);

console.log('cari-orang.test.mjs: all passed');
