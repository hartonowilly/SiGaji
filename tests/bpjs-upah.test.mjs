/**
 * Baris file upah BPJS TK / Kesehatan: dasar upah = gapok BPJS + tunjangan tetap,
 * karyawan tanpa komponen tidak ikut.
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

const ctx = {};
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(ROOT, 'js/modules/bpjs-export.js'), 'utf8'), ctx);

const aktifPenuh = function () {
  return true;
};
const hanyaKes = function (_k, key) {
  return key === 'kes-prs' || key === 'kes-kar';
};
const hanyaJkk = function (_k, key) {
  return key === 'jkk-prs';
};
const mati = function () {
  return false;
};

const masa = { bln: 10, thn: 2026 };
const list = [
  { nik: 'K0001', nama: 'Budi', ktp: '3171 0000 0000 0001', bpjs_kpj: '123-456-78901', bpjs_kes_kartu: '0001234567890' },
  { nik: 'K0002', nama: 'Siti', ktp: '', bpjs_kpj: '', bpjs_kes_kartu: '' },
];

function hitung(k) {
  if (k.nik === 'K0001') return { gapokBpjs: 5000000, tBPJS: 400000 };
  return { gapokBpjs: 3000000, tBPJS: 0 };
}

const penuh = ctx.bpjsSusunBaris(list, { aktif: aktifPenuh, hitung: hitung, masa: masa });
assertEq('upah Budi = gapok BPJS + tunjangan tetap', penuh.tk[0].upah, 5400000);
assertEq('KPJ digit saja', penuh.tk[0].kpj, '12345678901');
assertEq('NIK KTP digit saja', penuh.tk[0].nik, '3171000000000001');
assertEq('bulan dari periode', penuh.tk[0].bln, 10);
assertEq('TK dua orang', penuh.tk.length, 2);
assertEq('Kesehatan dua orang', penuh.kes.length, 2);
assertEq('nomor urut Kesehatan', penuh.kes[1].no, 2);
assertEq('Siti tanpa KPJ tercatat', penuh.tanpaKpj.length, 1);
assertEq('Siti tanpa kartu tercatat', penuh.tanpaKartu[0], 'Siti');

const kesOnly = ctx.bpjsSusunBaris(list, { aktif: hanyaKes, hitung: hitung, masa: masa });
assertEq('hanya Kesehatan: file TK kosong', kesOnly.tk.length, 0);
assertEq('hanya Kesehatan: file Kes ada', kesOnly.kes.length, 2);

const jkk = ctx.bpjsSusunBaris([list[0]], { aktif: hanyaJkk, hitung: hitung, masa: masa });
assertEq('JKK saja tetap masuk file TK', jkk.tk.length, 1);
assertEq('JKK saja tidak masuk Kesehatan', jkk.kes.length, 0);

const off = ctx.bpjsSusunBaris(list, { aktif: mati, hitung: hitung, masa: masa });
assertEq('semua komponen mati: TK kosong', off.tk.length, 0);
assertEq('semua komponen mati: Kes kosong', off.kes.length, 0);

assertEq('upah tanpa objek = 0', ctx.bpjsUpahDariHitung(null), 0);

console.log('File upah BPJS: semua tes lulus.');
