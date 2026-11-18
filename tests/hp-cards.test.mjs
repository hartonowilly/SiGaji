/**
 * Kartu HP: Gaji, Karyawan, ringkas Laporan/THR.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

function assert(name, cond) {
  if (!cond) throw new Error('FAIL: ' + name);
  console.log('OK: ' + name);
}

const tpl = fs.readFileSync(path.join(ROOT, 'index.template.html'), 'utf8');
const hr = fs.readFileSync(path.join(ROOT, 'js/modules/app-hr.js'), 'utf8');
const pg = fs.readFileSync(path.join(ROOT, 'js/modules/app-hr-payroll.js'), 'utf8');
const lap = fs.readFileSync(path.join(ROOT, 'js/modules/app-reports.js'), 'utf8');
const css = fs.readFileSync(path.join(ROOT, 'css/sigaji-mobile-web.css'), 'utf8');

assert('wadah kartu HP di template', /id="kar-mobile-list"/.test(tpl) && /id="pg-mobile-wrap"/.test(tpl) && /id="lap-mobile-rekap"/.test(tpl) && /id="thr-mobile-list"/.test(tpl));
assert('kartu karyawan nama jabatan PTKP cuti', /function karMobileCardHtml/.test(hr) && /PTKP /.test(hr) && /Telepon/.test(hr) && /wa.me/.test(hr));
assert('kartu gaji THP dan perlu cek', /function pgBukaKartu/.test(pg) && /Perlu cek/.test(pg) && /Koreksi absensi/.test(pg));
assert('laporan HP total + unduh', /lap-mobile-rekap/.test(lap) && /Unduh CSV/.test(lap) && /Unduh Excel/.test(lap));
assert('CSS sembunyikan tabel lebar di HP', /#pg-penggajian \.pg-table-sticky/.test(css) && /hp-card-list/.test(css));

console.log('hp-cards.test.mjs: all passed');
