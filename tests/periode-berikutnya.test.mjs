/**
 * Rancangan periode bulan berikutnya mengikuti pola tanggal.
 */
import fs from 'fs';
import path from 'path';
import vm from 'vm';
import { fileURLToPath } from 'url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

function assertEq(name, actual, expected) {
  if (actual !== expected) {
    throw new Error('FAIL: ' + name + ' — dapat ' + JSON.stringify(actual) + ', harus ' + JSON.stringify(expected));
  }
  console.log('OK: ' + name);
}

const sandbox = { console };
vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(path.join(ROOT, 'js/periode-pola.js'), 'utf8'), sandbox, {
  filename: 'periode-pola.js',
});

assertEq(
  '1–akhir November',
  sandbox.sigajiInferPolaPeriode({ start: '2026-11-01', end: '2026-11-30' }),
  '1-akhir'
);
assertEq(
  '25–24 November',
  sandbox.sigajiInferPolaPeriode({ start: '2026-10-25', end: '2026-11-24' }),
  '25-24'
);
assertEq(
  '21–20',
  sandbox.sigajiInferPolaPeriode({ start: '2026-10-21', end: '2026-11-20' }),
  '21-20'
);

const n1 = sandbox.sigajiRancangPeriodeBerikutnya({
  nama: 'November 2026',
  start: '2026-11-01',
  end: '2026-11-30',
  bayar: '2026-11-30',
});
assertEq('nama Desember', n1.nama, 'Desember 2026');
assertEq('Desember tipe rekonsiliasi', n1.tipe_periode, 'desember');
assertEq('Desember 1–akhir start', n1.start, '2026-12-01');
assertEq('Desember 1–akhir end', n1.end, '2026-12-31');

const n25 = sandbox.sigajiRancangPeriodeBerikutnya({
  nama: 'November 2026',
  start: '2026-10-25',
  end: '2026-11-24',
  bayar: '2026-11-25',
});
assertEq('25–24 Des start', n25.start, '2026-11-25');
assertEq('25–24 Des end', n25.end, '2026-12-24');
assertEq('25–24 Des bayar', n25.bayar, '2026-12-25');

const jan = sandbox.sigajiRancangPeriodeBerikutnya({
  nama: 'Desember 2026',
  start: '2026-12-01',
  end: '2026-12-31',
  bayar: '2026-12-31',
});
assertEq('setelah Des = Januari', jan.nama, 'Januari 2027');
assertEq('Januari bukan rekonsiliasi', jan.tipe_periode, 'normal');
assertEq('Feb dari 31 Jan tidak 31 Feb', sandbox.sigajiGeserIsoSatuBulan('2026-01-31', 1), '2026-02-28');

console.log('\nPeriode berikutnya: semua tes lulus.');
