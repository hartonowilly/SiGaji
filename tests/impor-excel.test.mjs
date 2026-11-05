/**
 * Parser impor Excel: rupiah ID, NIK nol di depan, tanggal serial Excel.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { loadPayrollCore } from './lib/payroll-harness.mjs';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

function assertEq(name, actual, expected) {
  if (actual !== expected) {
    throw new Error('FAIL: ' + name + ' — dapat ' + JSON.stringify(actual) + ', harus ' + JSON.stringify(expected));
  }
  console.log('OK: ' + name);
}

const px = loadPayrollCore();

assertEq('1.500.000 bukan 1,5', px.sigajiRp('1.500.000'), 1500000);
assertEq('angka Excel 1500000 utuh', px.sigajiRp(1500000), 1500000);
assertEq('NIK teks tetap', px.sigajiExcelNik('00123'), '00123');
assertEq('NIK angka tanpa ilmiah', px.sigajiExcelNik(123), '123');

const map = { '00123': { nik: '00123' }, K9: { nik: 'K9' } };
assertEq('cari NIK tepat', px.sigajiCariByNik(map, '00123').nik, '00123');
assertEq('cari NIK Excel hilang nol', px.sigajiCariByNik(map, 123).nik, '00123');
assertEq('kode non-angka tetap', px.sigajiCariByNik(map, 'K9').nik, 'K9');

const serial = Math.round(Date.UTC(2026, 2, 10) / 86400000 + 25569);
assertEq('serial Excel → ISO', px.sigajiExcelTanggal(serial), '2026-03-10');
assertEq('dd/mm/yyyy', px.sigajiExcelTanggal('10/03/2026'), '2026-03-10');
assertEq('serial Excel sebagai teks', px.sigajiExcelTanggal(String(serial)), '2026-03-10');
assertEq('1,5 tidak dibaca juta', px.sigajiRp('1,5') < 100 ? 1 : 0, 1);
assertEq('format ID 1.500,50', px.sigajiRp('1.500,50'), 1501);
assertEq('baris kosong', px.sigajiExcelBarisKosong(['', '  ', null]), true);
assertEq('baris ada NIK', px.sigajiExcelBarisKosong(['00123', '']), false);
assertEq('NIK ilmiah rusak dibuang', px.sigajiExcelNik('1.23e+16'), '');
assertEq('NIK ilmiah koma Excel rusak', px.sigajiExcelNikRusak('1,23457E+11') ? 1 : 0, 1);
assertEq('NIK ilmiah koma tidak dipakai', px.sigajiExcelNik('1,23457E+11'), '');
assertEq(
  'pesan NIK ilmiah',
  px.sigajiExcelNikRusakPesan(2).indexOf('Teks') >= 0 && px.sigajiExcelNikRusakPesan(2).indexOf('2') >= 0 ? 1 : 0,
  1
);

const slipSrc = fs.readFileSync(path.join(ROOT, 'js/modules/app-slip.js'), 'utf8');
if (!/function makeSlip\([\s\S]*?hitungGaji\(k,pNama\)/.test(slipSrc)) throw new Error('FAIL: makeSlip harus hitungGaji');
if (!/function buildGajiSlipPDF\([\s\S]*?hitungGaji\(k,pNama\)/.test(slipSrc)) throw new Error('FAIL: PDF slip harus hitungGaji');
if (!/function loadMySlip\([\s\S]*?karyawanInPeriode/.test(slipSrc)) throw new Error('FAIL: Slip Gaji Saya menolak periode di luar masa kerja');
if (!/function loadMySlip\([\s\S]*?makeSlip\(k,p\.nama\)/.test(slipSrc)) throw new Error('FAIL: Slip Gaji Saya harus makeSlip');
console.log('OK: myslip/PDF memakai hitungGaji (hasil beku jika terkunci)');
const authSrc = fs.readFileSync(path.join(ROOT, 'js/modules/app-auth.js'), 'utf8');
if (!/buildGajiSlipPDF\(k, p\.nama/.test(authSrc)) throw new Error('FAIL: Telegram slip harus PDF yang sama');
if (!/karyawanInPeriode/.test(authSrc)) throw new Error('FAIL: Telegram hanya periode masa kerja (resign di periode itu tetap)');
if (!/isKarSampah/.test(authSrc)) throw new Error('FAIL: Telegram tidak mengirim karyawan terhapus');
if (/typeof isKarResign/.test(authSrc)) throw new Error('FAIL: Telegram tidak boleh memblokir resign');
console.log('OK: Telegram memakai PDF slip yang sama');

console.log('Impor Excel: semua tes lulus.');
