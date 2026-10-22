/**
 * Pemilih tahun di timeline periode: hanya bulan tahun itu, tahun dari data 3 tahun.
 * Jalankan: node tests/timeline-tahun.test.mjs
 */
import fs from 'fs';
import path from 'path';
import vm from 'vm';
import { fileURLToPath } from 'url';
import { loadPayrollCore } from './lib/payroll-harness.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');

function assert(name, cond) {
  if (!cond) throw new Error('FAIL: ' + name);
  console.log('OK: ' + name);
}

function assertEq(name, actual, expected) {
  if (actual !== expected) {
    throw new Error('FAIL: ' + name + ' — dapat ' + actual + ', harus ' + expected);
  }
  console.log('OK: ' + name);
}

function periode(nama, start, end, extra) {
  return Object.assign(
    {
      id: start,
      nama: nama,
      start: start,
      end: end,
      bayar: end,
      status: 'tutup',
      thr_aktif: false,
      tipe_periode: 'biasa',
    },
    extra || {}
  );
}

const periodes = [
  periode('Maret 2024', '2024-03-01', '2024-03-31'),
  periode('Desember 2024', '2024-12-01', '2024-12-31'),
  periode('Januari 2025', '2025-01-01', '2025-01-31'),
  periode('Oktober 2025', '2025-10-01', '2025-10-31'),
  periode('Januari 2026', '2026-01-01', '2026-01-31'),
  periode('September 2026', '2026-09-01', '2026-09-30', { snapshot_locked: true }),
  periode('Oktober 2026', '2026-10-01', '2026-10-31', { status: 'aktif' }),
];

const px = loadPayrollCore({ periodes: periodes });
px.document.addEventListener = function () {};
px.document.readyState = 'loading';
px.document.querySelectorAll = function () {
  return [];
};
px.escapeHtml = function (s) {
  return String(s);
};
px.sigajiDataAction = function () {
  return '';
};
px.sigajiCatchWarn = function () {};
px.localStorage = {
  getItem: function () {
    return null;
  },
  setItem: function () {},
};

vm.runInContext(
  fs.readFileSync(path.join(ROOT, 'js/modules/sigaji-product-v3.js'), 'utf8'),
  px,
  { filename: 'sigaji-product-v3.js' }
);

const years = px.sigajiCollectTimelineYears(periodes, 2026);
assertEq('tahun 2024–2026 terkumpul', years.join(','), '2024,2025,2026');

const y2024 = px.sigajiTimelineItemsForYear(periodes, 2024).map(function (p) {
  return p.nama;
});
assertEq('2024 hanya Mar+Des', y2024.join('|'), 'Maret 2024|Desember 2024');

const y2025 = px.sigajiTimelineItemsForYear(periodes, 2025).map(function (p) {
  return p.nama;
});
assertEq('2025 tidak mencampur 2026', y2025.join('|'), 'Januari 2025|Oktober 2025');

const y2026 = px.sigajiTimelineItemsForYear(periodes, 2026).map(function (p) {
  return p.nama;
});
assertEq('2026 Jan+Sep+Okt', y2026.join('|'), 'Januari 2026|September 2026|Oktober 2026');

const y2027 = px.sigajiTimelineItemsForYear(periodes, 2027);
assert('tahun tanpa periode = kosong (bukan 12 terakhir)', y2027.length === 0);

const yearsNow = px.sigajiCollectTimelineYears(
  [periode('Maret 2024', '2024-03-01', '2024-03-31')],
  2026
);
assertEq('tahun kalender sekarang tetap ada meski belum ada periode', yearsNow.join(','), '2024,2026');

let barHtml = '';
const barEl = {
  get innerHTML() {
    return barHtml;
  },
  set innerHTML(v) {
    barHtml = v;
  },
};
px.document.getElementById = function (id) {
  return id === 'period-timeline-bar' ? barEl : null;
};
px.window.__sigajiTimelineYear = 2025;
px.sigajiRenderPeriodTimeline();
assert('HTML punya pemilih tahun', barHtml.indexOf('ptl-year-sel') >= 0);
assert('opsi 2025 terpilih', barHtml.indexOf('value="2025" selected') >= 0);
assert('bulan 2025 tampil', barHtml.indexOf('Jan') >= 0 && barHtml.indexOf('Okt') >= 0);
assert('Oktober 2026 tidak ikut di 2025', barHtml.indexOf('Oktober 2026') < 0);

px.sigajiSetTimelineYear(2027);
assert('tahun kosong: pesan buat periode', barHtml.indexOf('Belum ada periode 2027') >= 0);

console.log('\nPemilih tahun timeline: semua tes lulus.');
