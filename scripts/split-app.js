/**
 * Pecah js/app.js menjadi modul di js/modules/
 * Jalankan: node scripts/split-app.js
 */
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const legacy = path.join(root, 'js', 'app.legacy.js');
const src = fs.existsSync(legacy) ? legacy : path.join(root, 'js', 'app.js');
const outDir = path.join(root, 'js', 'modules');
const lines = fs.readFileSync(src, 'utf8').split(/\r?\n/);

const chunks = [
  { file: 'app-globals.js', start: 1, end: 0, header: '/* Slot modul pertama — cpNik/bmState/CU hanya di js/storage.js (jangan redeklarasi). */\n' },
  { file: 'app-core.js', start: 1, end: 813, header: '/* SiGaji — inti: helper, snapshot, hitung gaji, BPJS, THR calc */\n' },
  { file: 'app-access.js', start: 814, end: 2065, header: '/* SiGaji — hak akses, user, branding, login */\n' },
  { file: 'app-hr.js', start: 2066, end: 2977, header: '/* SiGaji — dashboard, karyawan, komponen gaji, proses gaji */\n' },
  { file: 'app-slip.js', start: 2978, end: 3693, header: '/* SiGaji — slip, kirim, PDF */\n' },
  { file: 'app-reports.js', start: 3694, end: 4195, header: '/* SiGaji — PPh 21, laporan, THR */\n' },
  { file: 'app-absensi.js', start: 4196, end: 4418, header: '/* SiGaji — absensi, cuti, lembur, hari libur */\n' },
  { file: 'app-master.js', start: 4419, end: 5026, header: '/* SiGaji — periode, master perusahaan, backup, import */\n' },
  { file: 'app-shell.js', start: 5027, end: lines.length, header: '/* SiGaji — navigasi, init, TER, lisensi UI */\n' },
];

if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

for (const c of chunks) {
  if (c.file === 'app-globals.js') {
    fs.writeFileSync(path.join(outDir, c.file), c.header, 'utf8');
    continue;
  }
  const slice = lines.slice(c.start - 1, c.end).join('\n');
  fs.writeFileSync(path.join(outDir, c.file), c.header + slice + '\n', 'utf8');
  console.log(c.file, c.end - c.start + 1, 'lines');
}

// app.js loader tipis
const loader = `/**
 * SiGaji — muat modul per domain (urutan di index.html).
 * File monolit lama: js/app.legacy.js (arsip).
 */
console.warn('SiGaji: muat js/modules/*.js dari index.html, bukan app.js tunggal.');
`;
const legacyPath = path.join(root, 'js', 'app.legacy.js');
if (!fs.existsSync(legacyPath) || fs.statSync(legacyPath).size < 50000) {
  fs.copyFileSync(src, legacyPath);
  console.log('app.legacy.js = backup monolit');
}
fs.writeFileSync(path.join(root, 'js', 'app.js'), loader, 'utf8');
console.log('Done. Muat js/modules/* di index.html');
