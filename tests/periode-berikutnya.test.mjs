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
assertEq('30 Nov (akhir Nov) tetap 30 Des, bukan 31', n1.bayar, '2026-12-30');

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

const pay5 = sandbox.sigajiRancangPeriodeBerikutnya({
  nama: 'Oktober 2026',
  start: '2026-10-01',
  end: '2026-10-31',
  bayar: '2026-11-05',
});
assertEq('1–akhir Okt rentang Nov', pay5.start + '|' + pay5.end, '2026-11-01|2026-11-30');
assertEq('bayar 5 Nov → 5 Des', pay5.bayar, '2026-12-05');

const pay28 = sandbox.sigajiRancangPeriodeBerikutnya({
  nama: 'Oktober 2026',
  start: '2026-10-01',
  end: '2026-10-31',
  bayar: '2026-10-28',
});
assertEq('bayar 28 Okt → 28 Nov', pay28.bayar, '2026-11-28');

assertEq('30 Nov bukan akhir-bulan gajian', sandbox.sigajiGeserTanggalBayar('2026-11-30', 1), '2026-12-30');
assertEq('tanggal 5 tetap 5', sandbox.sigajiGeserTanggalBayar('2026-11-05', 1), '2026-12-05');
assertEq('31 Jan → akhir Feb', sandbox.sigajiGeserTanggalBayar('2027-01-31', 1), '2027-02-28');

function chainBayar(startIso, n) {
  var cur = {
    nama: 'Awal',
    start: startIso.slice(0, 8) + '01',
    end: startIso,
    bayar: startIso,
  };
  var hist = [cur];
  var out = [];
  var i;
  for (i = 0; i < n; i++) {
    var r = sandbox.sigajiRancangPeriodeBerikutnya(cur, hist);
    out.push(r.bayar);
    cur = { nama: r.nama, start: r.start, end: r.end, bayar: r.bayar };
    hist.push(cur);
  }
  return out.join(',');
}

assertEq(
  'gajian 28 melewati Feb tetap 28 Mar',
  chainBayar('2026-10-28', 5),
  '2026-11-28,2026-12-28,2027-01-28,2027-02-28,2027-03-28'
);
assertEq(
  'gajian 29: Feb clamp 28, Maret kembali 29',
  chainBayar('2027-01-29', 2),
  '2027-02-28,2027-03-29'
);
assertEq(
  'gajian 30: Feb clamp 28, Maret kembali 30',
  chainBayar('2027-01-30', 2),
  '2027-02-28,2027-03-30'
);
assertEq(
  'gajian akhir bulan 31: Feb 28 lalu 31 Mar',
  chainBayar('2027-01-31', 2),
  '2027-02-28,2027-03-31'
);

const lagPay = sandbox.sigajiRancangPeriodeBerikutnya({
  nama: 'November 2026',
  start: '2026-11-01',
  end: '2026-11-30',
  bayar: '2026-12-03',
});
assertEq('Des nama, bayar 3 Jan', lagPay.bayar, '2027-01-03');
assertEq('tipe mengikuti bulan bayar, bukan nama', lagPay.tipe_periode, 'normal');
assertEq('nama tetap Desember', lagPay.nama, 'Desember 2026');

console.log('\nPeriode berikutnya: semua tes lulus.');
