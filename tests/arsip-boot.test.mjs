/**
 * Jendela boot vs arsip periode terkunci (js/cloud-tables.js archivePlan).
 * Jalankan: node tests/arsip-boot.test.mjs
 */
import fs from 'fs';
import path from 'path';
import vm from 'vm';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');

function assert(name, cond, extra) {
  if (!cond) throw new Error('FAIL: ' + name + (extra !== undefined ? ' — ' + JSON.stringify(extra) : ''));
  console.log('OK: ' + name);
}

const ctx = { console, setTimeout, window: null };
ctx.window = ctx;
ctx.globalThis = ctx;
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(ROOT, 'js/cloud-delta.js'), 'utf8'), ctx);
vm.runInContext(fs.readFileSync(path.join(ROOT, 'js/cloud-tables.js'), 'utf8'), ctx);
const planOf = ctx.sigajiCloudTables.archivePlan;

const now = new Date(Date.UTC(2026, 9, 23)); // 23 Okt 2026
const P = (nama, extra) => Object.assign({ nama, start: extra.start, end: extra.end, status: extra.status || 'tutup', snapshot_locked: extra.locked }, extra);

{
  const plan = planOf(
    [
      P('Okt 2026', { start: '2026-09-25', end: '2026-10-24', status: 'aktif' }),
      P('Jun 2025', { start: '2025-05-25', end: '2025-06-24', locked: true }),
      P('Nov 2024', { start: '2024-10-25', end: '2024-11-24', locked: true }),
    ],
    now
  );
  assert('jendela boot mulai Januari tahun lalu (Okt 2026 → 2025-01)', plan && plan.cutoff === '2025-01', plan && plan.cutoff);
  assert('periode terkunci 2024 = arsip', plan.cold['Nov 2024'] === true);
  assert('periode terkunci 2025 masih di jalur panas (cuti/PPh/THR)', !plan.cold['Jun 2025'] && plan.hot.indexOf('Jun 2025') !== -1);
  assert('bulan absensi jendela boot mencakup Jan 2025–Okt 2026', plan.months[0] === '2025-01' && plan.months.indexOf('2026-10') !== -1);
  assert('bulan 2024 tidak masuk jendela boot', plan.months.indexOf('2024-11') === -1);
}

{
  const plan = planOf([P('Okt 2026', { start: '2026-09-25', end: '2026-10-24', status: 'aktif' })], now);
  assert('tanpa periode terkunci lama → tidak ada arsip (muat semua item)', plan === null);
}

{
  const plan = planOf(
    [
      P('Okt 2026', { start: '2026-09-25', end: '2026-10-24', status: 'aktif' }),
      P('Mar 2023', { start: '2023-02-25', end: '2023-03-24', locked: false }),
      P('Jan 2020', { start: '2019-12-25', end: '2020-01-24', locked: true }),
    ],
    now
  );
  assert('periode lama yang belum dikunci tetap panas', plan && !plan.cold['Mar 2023']);
  assert('periode terkunci 2020 = arsip', plan.cold['Jan 2020'] === true);
}

{
  const jan = new Date(Date.UTC(2026, 0, 10));
  const plan = planOf(
    [
      P('Jan 2026', { start: '2025-12-25', end: '2026-01-24', status: 'aktif' }),
      P('Des 2024', { start: '2024-11-25', end: '2024-12-24', locked: true }),
      P('Nov 2024', { start: '2024-10-25', end: '2024-11-24', locked: true }),
    ],
    jan
  );
  assert('awal tahun: jendela mundur 12 bulan (2025-01), Des 2024 tetap arsip', plan && plan.cutoff === '2025-01' && plan.cold['Des 2024'] && plan.cold['Nov 2024'], plan && plan.cutoff);
}

assert('sigajiNeedPeriodeData belum wajib sebelum cloud-sync dimuat', typeof ctx.sigajiNeedPeriodeData !== 'function' || ctx.sigajiNeedPeriodeData('x') === true);

console.log('\nSemua tes arsip boot lulus.');
