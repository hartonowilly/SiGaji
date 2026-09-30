/**
 * Rincian tanggal cuti (modal saldo) harus berjumlah sama dengan penghitung kuota.
 */
import fs from 'fs';
import vm from 'vm';
import { loadPayrollCore } from './lib/payroll-harness.mjs';

function assertEq(name, actual, expected) {
  if (actual !== expected) {
    throw new Error('FAIL: ' + name + ' — dapat ' + JSON.stringify(actual) + ', harus ' + JSON.stringify(expected));
  }
  console.log('OK: ' + name);
}

const px = loadPayrollCore({
  perusahaan: { hariKerja: 6 },
  masterCuti: { cbPotong: true, kuota: 12 },
  hariLibur: [
    { tgl: '2026-01-01', nama: 'Tahun Baru', tipe: 'cuti-bersama' },
    { tgl: '2026-01-04', nama: 'Minggu', tipe: 'cuti-bersama' },
    { tgl: '2025-12-26', nama: 'Cuti Bersama Natal', tipe: 'cuti-bersama' },
  ],
  absensi: {
    'K0001': {
      '2026-01-01': 'cuti',
      '2026-01-05': 'cuti',
      '2026-01-06': 'cuti',
      '2025-12-29': 'cuti',
      '2026-02-02': 'sakit',
    },
  },
  periodes: [
    {
      id: 1,
      nama: 'Jan 2026',
      start: '2025-12-20',
      end: '2026-01-19',
      bayar: '2026-01-25',
      status: 'aktif',
    },
  ],
});

const r = px.rincianCutiTahun('K0001', 2026);
assertEq('manual = cutiManual', r.manual, px.cutiManual('K0001', 2026));
assertEq('cb = countCutiBersama', r.cb, px.countCutiBersama(2026));
assertEq('manual 2 hari (5 & 6 Jan; 1 Jan tidak dobel)', r.manual, 2);
assertEq('cuti bersama hari kerja 1 hari', r.cb, 1);

const jan1 = r.items.find((it) => it.tgl === '2026-01-01');
assertEq('1 Jan jenis cuti bersama', jan1 && jan1.hitung, 'cuti_bersama');
assertEq('1 Jan nama libur', jan1 && jan1.namaLibur, 'Tahun Baru');
assertEq('1 Jan tetap tercatat di absensi', jan1 && jan1.diAbsensi, true);

const sun = r.items.find((it) => it.tgl === '2026-01-04');
assertEq('Minggu cuti bersama tidak potong kuota', sun && sun.hitung, 'tidak');

const sakit = r.items.find((it) => it.tgl === '2026-02-02');
assertEq('sakit tidak masuk rincian cuti', sakit, undefined);

const tr = px.rincianCutiTahun('K0001', 2026, { tracking: true });
assertEq(
  'tracking manual = cutiManualTrackingYear',
  tr.manual,
  px.cutiManualTrackingYear('K0001', 2026)
);
assertEq(
  'tracking cb = countCutiBersamaTrackingYear',
  tr.cb,
  px.countCutiBersamaTrackingYear(2026)
);
const tail = tr.items.find((it) => it.tgl === '2025-12-29');
assertEq('ekor tahun lalu masuk tracking', tail && tail.hitung, 'manual');
assertEq('ekor ditandai tahun lalu', tail && tail.tahunLalu, true);
const natal = tr.items.find((it) => it.tgl === '2025-12-26');
assertEq('cuti bersama di ekor tahun lalu', natal && natal.hitung, 'cuti_bersama');
assertEq('nama cuti bersama ikut master libur', natal && natal.namaLibur, 'Cuti Bersama Natal');

px.masterCuti.cbPotong = false;
const off = px.rincianCutiTahun('K0001', 2026);
assertEq('cb mati: tidak ada potongan cuti bersama', off.cb, 0);
assertEq('cb mati: 1 Jan yang diabsen jadi cuti manual', off.manual, px.cutiManual('K0001', 2026));
const jan1off = off.items.find((it) => it.tgl === '2026-01-01');
assertEq('cb mati: 1 Jan dihitung manual', jan1off && jan1off.hitung, 'manual');

px.masterCuti.cbPotong = true;
px.karyawan = [{ nik: 'K0001', nama: 'Budi Contoh' }];
px.escapeHtml = function (s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
};
px.toast = function () {};
px.openModal = function (id) {
  px._opened = id;
};
const els = {};
px.document = {
  getElementById: function (id) {
    if (!els[id]) els[id] = { textContent: '', innerHTML: '' };
    return els[id];
  },
};
vm.runInContext(fs.readFileSync(new URL('../js/modules/app-absensi.js', import.meta.url), 'utf8'), px, {
  filename: 'js/modules/app-absensi.js',
});
px.detailCuti('K0001', 2026, false);
const html = els['m-cuti-c'].innerHTML;
assertEq('modal terbuka', px._opened, 'm-cuti');
assertEq('judul memuat nama', els['m-cuti-t'].textContent.includes('Budi Contoh'), true);
assertEq('baris cuti bersama', html.includes('Cuti Bersama') && html.includes('Tahun Baru'), true);
assertEq('baris cuti manual', html.includes('>Cuti<'), true);
assertEq('minggu tidak potong kuota', html.includes('tidak potong kuota'), true);

console.log('\nRincian cuti: semua tes lulus.');
