/**
 * Tunjangan variabel: sel langsung input, tanpa tombol Edit/Simpan.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

function assert(name, cond) {
  if (!cond) throw new Error('FAIL: ' + name);
  console.log('OK: ' + name);
}

const src = fs.readFileSync(path.join(ROOT, 'js/modules/app-hr-tunjvar.js'), 'utf8');
const html = fs.readFileSync(path.join(ROOT, 'index.template.html'), 'utf8');

assert('sel selalu input tunjvar-inp', src.indexOf("class=\"tunjvar-inp inp-rp tunjvar-inp-narrow\"") >= 0);
assert('tidak ada tombol Edit sel', !/sigajiDataAction\('tunjvar-unlock'/.test(src));
assert('tidak ada tombol Simpan sel', !/>Simpan<\/button>/.test(src));
const setFn = src.match(/function setTunjVarNilai\([\s\S]*?\nfunction /);
assert('setTunjVarNilai ketemu', !!(setFn && setFn[0]));
assert('commit tidak menggambar ulang tabel', setFn[0].indexOf('tunjVarJadwalHitungGaji') >= 0 && setFn[0].indexOf('renderTunjVariabelBulan') < 0);
assert('hint isi langsung', html.indexOf('Isi langsung di sel') >= 0);
assert('Enter pindah baris', src.indexOf('function tunjVarFocusNextRow') >= 0);

console.log('tunjvar-grid.test.mjs: all passed');
