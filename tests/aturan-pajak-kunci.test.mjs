/**
 * Tarif pajak/BPJS baru tidak mengubah periode yang tanggal bayarnya lebih lama,
 * dan periode terkunci mengembalikan angka slip yang sudah disimpan.
 */
import { loadPayrollCore } from './lib/payroll-harness.mjs';

function assertEq(name, actual, expected) {
  if (actual !== expected) {
    throw new Error('FAIL: ' + name + ' — dapat ' + actual + ', harus ' + expected);
  }
  console.log('OK: ' + name);
}

const px = loadPayrollCore();
const k = {
  nik: 'TES-KUNCI',
  nama: 'Kunci Contoh',
  gapok: 8_000_000,
  ptkp: 'TK0',
  masuk: '2020-01-01',
  tunjangan: [],
  potongan: [],
  natura: [],
  bpjs_aktif: {
    'kes-prs': true,
    'kes-kar': true,
    'jht-prs': true,
    'jht-kar': true,
    'jp-prs': true,
    'jp-kar': true,
    'jkk-prs': true,
    'jkm-prs': true,
  },
};
px.karyawan = [k];
px.periodes.push({
  id: 2,
  nama: 'Februari 2026',
  start: '2026-01-26',
  end: '2026-02-24',
  bayar: '2026-02-25',
  status: 'tutup',
  tipe_periode: 'biasa',
});

const maretAwal = px.hitungGaji(k, 'Maret 2026');
const febAwal = px.hitungGaji(k, 'Februari 2026');
assertEq('sebelum aturan baru, Maret = Februari', maretAwal.pph, febAwal.pph);
assertEq('buku berjalan PMK 168', maretAwal.aturanId, 'pmk-168-2024');

const bukuLama = px.aturanPajakUntukTanggal('2026-02-01');
const bpjsBaru = {};
Object.keys(bukuLama.bpjs).forEach(function (key) {
  bpjsBaru[key] = Object.assign({}, bukuLama.bpjs[key]);
});
bpjsBaru['kes-kar'] = Object.assign({}, bpjsBaru['kes-kar'], { pct: 9 });
bpjsBaru['kes-prs'] = Object.assign({}, bpjsBaru['kes-prs'], { pct: 9 });

px.sigajiDaftarAturanPajak({
  id: 'uji-ter-2026-03',
  berlakuMulai: '2026-03-01',
  ptkp: px.DEFAULT_PTKP,
  ter: {
    A: [[Infinity, 0.5]],
    B: [[Infinity, 0.5]],
    C: [[Infinity, 0.5]],
  },
  progresif: { bjRate: 0.05, bjCap: 6e6, lapis: px.SIGAJI_PROGRESIF_168 },
  pesangon: px.SIGAJI_PESANGON_68,
  bpjs: bpjsBaru,
});

const febSetelah = px.hitungGaji(k, 'Februari 2026');
const marSetelah = px.hitungGaji(k, 'Maret 2026');
assertEq('Februari tetap PPh lama', febSetelah.pph, febAwal.pph);
assertEq('Februari tetap iuran Kes karyawan', febSetelah.bpjs.kes_kar, febAwal.bpjs.kes_kar);
assertEq('Maret memakai buku baru', marSetelah.aturanId, 'uji-ter-2026-03');
assertEq('Maret PPh berubah', marSetelah.pph !== maretAwal.pph, true);
assertEq('Maret iuran Kes berubah', marSetelah.bpjs.kes_kar !== maretAwal.bpjs.kes_kar, true);

const pMar = px.periodes.find(function (p) {
  return p.nama === 'Maret 2026';
});
pMar.snapshot_locked = true;
px.sigajiBekukanHasilPeriode(pMar, { skipSave: true });
px.sigajiDaftarAturanPajak({
  id: 'uji-ter-2026-03',
  berlakuMulai: '2026-03-01',
  ptkp: px.DEFAULT_PTKP,
  ter: {
    A: [[Infinity, 0.2]],
    B: [[Infinity, 0.2]],
    C: [[Infinity, 0.2]],
  },
  progresif: { bjRate: 0.05, bjCap: 6e6, lapis: px.SIGAJI_PROGRESIF_168 },
  pesangon: px.SIGAJI_PESANGON_68,
  bpjs: bukuLama.bpjs,
});
const marKunci = px.hitungGaji(k, 'Maret 2026');
assertEq('periode terkunci mempertahankan PPh', marKunci.pph, marSetelah.pph);
assertEq('periode terkunci mempertahankan Kes', marKunci.bpjs.kes_kar, marSetelah.bpjs.kes_kar);

pMar.snapshot_locked = false;
delete pMar.hasil_gaji;
px.perusahaan.ter_custom = {};
const mulai = px.sigajiKunciEraOverrideLama();
assertEq('override baru mulai tanggal bayar Maret', mulai, '2026-03-25');
px.perusahaan.ter_custom = { A: { 0: 0.04 } };
const febOverride = px.hitungGaji(k, 'Februari 2026');
const marOverride = px.hitungGaji(k, 'Maret 2026');
assertEq('override TER tidak mengubah Februari', febOverride.pph, febAwal.pph);
assertEq('Maret terbuka memakai TER baru', marOverride.terRate, 0.04);

console.log('Kunci aturan pajak: semua tes lulus.');
