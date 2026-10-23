/**
 * Web Worker hitung gaji: skrip worker + hasil identik dengan hitungGaji di thread yang sama.
 * Jalankan: node tests/payroll-worker.test.mjs
 */
import fs from 'fs';
import path from 'path';
import vm from 'vm';
import { fileURLToPath } from 'url';
import { loadPayrollCore } from './lib/payroll-harness.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');

function assert(name, cond, extra) {
  if (!cond) throw new Error('FAIL: ' + name + (extra !== undefined ? ' — ' + JSON.stringify(extra).slice(0, 400) : ''));
  console.log('OK: ' + name);
}

const src = fs.readFileSync(path.join(ROOT, 'js/payroll-worker.js'), 'utf8');
assert('skrip worker tidak memakai DOM halaman', !/document\.body/.test(src) && /importScripts/.test(src));
assert('skrip worker menangani boot + hitung', /msg\.type === 'boot'/.test(src) && /msg\.type === 'hitung'/.test(src));

const host = fs.readFileSync(path.join(ROOT, 'js/payroll-worker-host.js'), 'utf8');
assert('host memakai Worker dan fallback sinkron', /new Worker/.test(host) && /syncMap/.test(host));
assert('host hanya ke worker bila karyawan ≥ ambang', /THRESHOLD = 60/.test(host));

const px = loadPayrollCore({
  karyawan: [
    { nik: 'W1', nama: 'Wati', gapok: 5_000_000, ptkp: 'TK0', masuk: '2020-01-01', tunjangan: [], potongan: [], natura: [], bpjs_aktif: {} },
    { nik: 'W2', nama: 'Wawan', gapok: 6_500_000, ptkp: 'K1', masuk: '2019-06-01', tunjangan: [{ nama: 'Transport', nilai: 300_000, tipe: 'tetap' }], potongan: [], natura: [], bpjs_aktif: {} },
  ],
  absensi: { W1: { '2026-03-02': 'alpha' }, W2: {} },
  lembur: { W2: [{ tanggal: '2026-03-10', jam: 2 }] },
});
const pNama = px.periodes[0].nama;
const utama = {};
px.sigajiWithHitungCache(() => {
  px.karyawan.forEach((k) => {
    utama[k.nik] = px.hitungGaji(k, pNama);
  });
});

const replies = [];
const sandbox = {
  console,
  Date,
  Math,
  Object,
  Array,
  String,
  Number,
  parseInt,
  parseFloat,
  isNaN,
  JSON,
  setTimeout,
  clearTimeout,
  WeakMap,
  Map,
  Promise,
  Error,
  self: null,
  importScripts: function () {
    const files = ['js/constants.js', 'js/pajak-aturan.js', 'js/ptkp.js', 'js/karyawan-tipe.js', 'js/siklus-bayar.js', 'js/modules/app-core.js', 'js/pesangon.js'];
    files.forEach((rel) => {
      vm.runInContext(fs.readFileSync(path.join(ROOT, rel), 'utf8'), sandbox, { filename: rel });
    });
  },
  postMessage: function (msg) {
    replies.push(msg);
  },
};
sandbox.self = sandbox;
sandbox.window = sandbox;
vm.createContext(sandbox);
vm.runInContext(src, sandbox, { filename: 'js/payroll-worker.js' });
assert('worker memasang onmessage', typeof sandbox.onmessage === 'function');

sandbox.onmessage({ data: { type: 'boot', id: 'boot', scripts: ['x'] } });
assert('boot: worker siap setelah importScripts', replies[0] && replies[0].type === 'ready');

sandbox.onmessage({
  data: {
    type: 'hitung',
    id: 'h1',
    jobs: px.karyawan.map((k) => ({ nik: k.nik, pNama })),
    snap: {
      perusahaan: px.perusahaan,
      periodes: px.periodes,
      hariLibur: px.hariLibur,
      masterCuti: px.masterCuti,
      absensi: px.absensi,
      prorata: px.prorata,
      thrManual: px.thrManual,
      lembur: px.lembur,
      karSnapshot: px.karSnapshot,
      karyawan: px.karyawan,
      tunjVarBulan: px.tunjVarBulan,
      tunjVarLabels: px.tunjVarLabels,
      tunjVarColumns: [],
    },
  },
});
const hasil = replies.find((m) => m.type === 'hasil');
assert('hitung: ada hasil untuk semua karyawan', hasil && hasil.hasil && hasil.hasil.W1 && hasil.hasil.W2, hasil);
assert(
  'hasil worker = hitungGaji di harness',
  JSON.stringify(hasil.hasil.W1) === JSON.stringify(utama.W1) && JSON.stringify(hasil.hasil.W2) === JSON.stringify(utama.W2)
);
assert('alpha memotong neto W1 vs W2', hasil.hasil.W1.neto < hasil.hasil.W2.neto);

console.log('\nSemua tes payroll worker lulus.');
