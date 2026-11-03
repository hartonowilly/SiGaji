/**
 * Template gaji: pencocokan jabatan/grade dan salin komponen (tanpa menimpa BPJS).
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

function load() {
  const sandbox = {
    window: {},
    document: {
      getElementById: () => null,
      querySelectorAll: () => [],
      createElement: () => ({}),
    },
    console,
    gajiTemplates: [],
    karyawan: [],
    TUNJ_TYPES: { tetap: 'Tetap', tidak_tetap: 'Tidak Tetap' },
    sigajiRp: function (n) {
      const x = Number(n);
      return isFinite(x) ? x : 0;
    },
    deepCloneLite: function (v) {
      return JSON.parse(JSON.stringify(v));
    },
    sigajiNormalizeKarTipe: function (t) {
      return t === 'tidak_tetap' ? 'tidak_tetap' : 'tetap';
    },
    sigajiNormalizeSiklusGaji: function (v) {
      var s = String(v || '').toLowerCase();
      if (s === 'harian' || s === 'mingguan') return s;
      return s ? 'bulanan' : '';
    },
    fmt: function (n) {
      return 'Rp ' + String(Math.round(n || 0));
    },
    cabang: [
      { id: 'utama', nama: 'Kantor Pusat', umk: 5000000 },
      { id: 'c-sumbawa', nama: 'Sumbawa', umk: 3400000 },
    ],
    sigajiKarCabangId: function (k) {
      return String((k && (k.cabangId || k.cabang)) || 'utama');
    },
    sigajiCabangUmk: function (cabangId) {
      var list = sandbox.cabang || [];
      var c = list.find(function (x) {
        return x.id === cabangId;
      });
      return c && c.umk ? c.umk : 0;
    },
    escapeHtml: function (s) {
      return String(s);
    },
    escapeAttr: function (s) {
      return String(s);
    },
  };
  sandbox.window = sandbox;
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'js/modules/app-hr-gaji-tpl.js'), 'utf8'), vm.createContext(sandbox), {
    filename: 'app-hr-gaji-tpl.js',
  });
  return sandbox;
}

const px = load();
const list = [
  { id: 't-combo', nama: 'SPV 3', jabatan: 'Supervisor', grade: '3', gapok: 9000000, tunjangan: [{ nama: 'Jabatan', nilai: 1500000, tipe: 'tetap' }], potongan: [] },
  { id: 't-grade', nama: 'Grade 3', jabatan: '', grade: '3', gapok: 7000000, tunjangan: [{ nama: 'Grade', nilai: 500000, tipe: 'tetap' }], potongan: [] },
  { id: 't-jab', nama: 'Supervisor', jabatan: 'Supervisor', grade: '', gapok: 8000000, tunjangan: [{ nama: 'SPV', nilai: 1000000, tipe: 'tetap' }], potongan: [{ nama: 'Koperasi', nilai: 50000 }] },
];

assert(
  'kombinasi jabatan+grade menang',
  px.cariGajiTemplate('Supervisor', '3', list).id === 't-combo'
);
assert(
  'huruf besar/kecil dan spasi diabaikan',
  px.cariGajiTemplate('  supervisor ', '3', list).id === 't-combo'
);
assert(
  'grade saja jika jabatan tidak ada template kombinasi',
  px.cariGajiTemplate('Manager', '3', list).id === 't-grade'
);
assert(
  'jabatan saja jika grade tidak cocok',
  px.cariGajiTemplate('Supervisor', '2', list).id === 't-jab'
);
assert(
  'tidak ada yang cocok',
  px.cariGajiTemplate('Staff', '1', list) === null
);
assert(
  'tanpa jabatan dan grade tidak cocok',
  px.cariGajiTemplate('', '', list) === null
);

const k = {
  nik: 'K0001',
  gapok: 5000000,
  tunjangan: [],
  potongan: [],
  bpjs_aktif: { 'kes-kar': true, 'jht-kar': true },
  natura: [{ nama: 'Mobil', nilai: 1 }],
  pph_return: { nilai: 0, ket: '' },
  siklus_gaji: 'bulanan',
};
const bpjsSebelum = JSON.stringify(k.bpjs_aktif);
const natSebelum = JSON.stringify(k.natura);
px.terapkanGajiTemplate(k, list[2]);
assert('apply mengisi gapok', k.gapok === 8000000);
assert('apply menyalin tunjangan', k.tunjangan.length === 1 && k.tunjangan[0].nama === 'SPV');
assert('apply menyalin potongan', k.potongan.length === 1 && k.potongan[0].nama === 'Koperasi');
assert('apply tidak menimpa BPJS', JSON.stringify(k.bpjs_aktif) === bpjsSebelum);
assert('apply tidak menimpa natura', JSON.stringify(k.natura) === natSebelum);

const k2 = { ...k, siklus_gaji: 'bulanan' };
px.terapkanGajiTemplate(k2, { gapok: 1000, siklus_gaji: 'harian', tunjangan: [], potongan: [] });
assert('apply siklus jika diisi di template', k2.siklus_gaji === 'harian');

assert(
  'karyawan baru tidak perlu konfirmasi',
  px.gajiTplPerluKonfirmasi({ _gajiTplFresh: true, gapok: 5000000, tunjangan: [] }) === false
);
assert(
  'skeleton 5 juta tanpa tunjangan tidak perlu konfirmasi',
  px.gajiTplPerluKonfirmasi({ gapok: 5000000, tunjangan: [], potongan: [] }) === false
);
assert(
  'yang sudah punya tunjangan perlu konfirmasi',
  px.gajiTplPerluKonfirmasi({ gapok: 8000000, tunjangan: [{ nama: 'Jabatan', nilai: 1 }] }) === true
);

const tplUmk = {
  id: 't-umk',
  nama: 'Operator',
  jabatan: 'Operator',
  grade: '',
  gapok_dari: 'umk_cabang',
  gapok: 0,
  tunjangan: [{ nama: 'Makan', nilai: 200000, tipe: 'tetap' }],
  potongan: [],
};
const kPusat = { nik: 'K0002', cabangId: 'utama', gapok: 5000000, tunjangan: [], potongan: [] };
px.terapkanGajiTemplate(kPusat, tplUmk);
assert('UMK cabang pusat jadi gapok', kPusat.gapok === 5000000);
assert('tunjangan tetap tersalin walau gapok dari UMK', kPusat.tunjangan.length === 1);

const kSumbawa = { nik: 'K0003', cabangId: 'c-sumbawa', gapok: 5000000, tunjangan: [], potongan: [] };
px.terapkanGajiTemplate(kSumbawa, tplUmk);
assert('UMK Sumbawa jadi gapok (bukan angka pusat)', kSumbawa.gapok === 3400000);

const kNominal = { nik: 'K0004', cabangId: 'c-sumbawa', gapok: 1, tunjangan: [], potongan: [] };
px.terapkanGajiTemplate(kNominal, { gapok: 8000000, tunjangan: [], potongan: [] });
assert('template lama tanpa gapok_dari tetap pakai nominal', kNominal.gapok === 8000000);

const kNoUmk = { nik: 'K0005', cabangId: 'c-tidak-ada', gapok: 123456, tunjangan: [], potongan: [] };
px.terapkanGajiTemplate(kNoUmk, tplUmk);
assert('UMK cabang kosong tidak menimpa gapok jadi 0', kNoUmk.gapok === 123456);

console.log('\nTemplate gaji: semua tes lulus.');
