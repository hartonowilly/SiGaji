/**
 * Sinkron alpha harus paging check-in (batas PostgREST 1.000 baris).
 * node tests/sync-alpha-page.test.mjs
 */
import fs from 'fs';
import os from 'os';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const tmpTenant = path.join(os.tmpdir(), 'sigaji-td-' + process.pid + '.mjs');
const tmpMob = path.join(os.tmpdir(), 'sigaji-mob-' + process.pid + '.mjs');
fs.copyFileSync(path.join(ROOT, 'functions', '_lib', 'tenant-data.js'), tmpTenant);
const tenantHref = pathToFileURL(tmpTenant).href;
const mobSrc = fs
  .readFileSync(path.join(ROOT, 'functions', '_lib', 'mobile-shared.js'), 'utf8')
  .replace(/import \{[\s\S]*?\} from '\.\/cf-shared\.js';/, '')
  .replace(
    /import \{[\s\S]*?\} from '\.\/tenant-data\.js';/,
    "import { fetchAll } from '" +
      tenantHref +
      "';\nasync function saveCloudPayload() {}\n"
  )
  .replace(/export \{ loadCloudPayload, saveCloudPayload \};/, '');
fs.writeFileSync(tmpMob, mobSrc);
const { syncAlphaFromMobileAttendance, enumerateWorkDates } = await import(pathToFileURL(tmpMob).href);
fs.unlinkSync(tmpMob);
fs.unlinkSync(tmpTenant);

function assert(name, cond) {
  if (!cond) throw new Error('FAIL: ' + name);
  console.log('OK: ' + name);
}

function fakeSb(tables, maxRows) {
  function q(table) {
    const st = { table, filters: [], orders: [], range: null, gte: [], lte: [] };
    const rows = () => {
      let list = (tables[table] || []).filter((r) =>
        st.filters.every(([c, v, kind]) => (kind === 'in' ? v.includes(r[c]) : r[c] === v))
      );
      st.gte.forEach(([c, v]) => {
        list = list.filter((r) => String(r[c]) >= v);
      });
      st.lte.forEach(([c, v]) => {
        list = list.filter((r) => String(r[c]) <= v);
      });
      if (st.orders.length) {
        list = list.slice().sort((a, b) => {
          for (let i = 0; i < st.orders.length; i++) {
            const c = st.orders[i];
            if (a[c] < b[c]) return -1;
            if (a[c] > b[c]) return 1;
          }
          return 0;
        });
      }
      return list;
    };
    const api = {
      select() {
        return api;
      },
      order(c) {
        st.orders.push(c);
        return api;
      },
      limit() {
        return api;
      },
      range(a, b) {
        st.range = [a, b];
        return api;
      },
      eq(c, v) {
        st.filters.push([c, v, 'eq']);
        return api;
      },
      gte(c, v) {
        st.gte.push([c, v]);
        return api;
      },
      lte(c, v) {
        st.lte.push([c, v]);
        return api;
      },
      then(res, rej) {
        let out = rows();
        if (st.range) out = out.slice(st.range[0], st.range[1] + 1);
        else if (maxRows) out = out.slice(0, maxRows);
        return Promise.resolve({ data: out, error: null }).then(res, rej);
      },
    };
    return api;
  }
  return { from: q };
}

const payload = {
  perusahaan: { hariKerja: 6 },
  hariLibur: [],
  karyawan: [],
  absensi: {},
};
const dateFrom = '2026-03-02';
const dateTo = '2026-03-31';
const workDates = enumerateWorkDates(payload, dateFrom, dateTo, true);
assert('periode Maret 6 hari: lebih dari 20 hari kerja', workDates.length > 20);

const nMobile = 60;
const logs = [];
for (let i = 1; i <= nMobile; i++) {
  const nik = 'M' + String(i).padStart(3, '0');
  payload.karyawan.push({ nik, nama: nik, aktif: true, masuk: '2020-01-01' });
  workDates.forEach((d) => {
    logs.push({
      tenant_key: 't1',
      nik,
      work_date: d,
      event_type: 'check_in',
      validation_status: 'ok',
    });
  });
}
payload.karyawan.push({ nik: 'OFF', nama: 'Kantor', aktif: true, masuk: '2020-01-01' });
payload.karyawan.push({ nik: 'ABS', nama: 'Alpha murni', aktif: true, masuk: '2020-01-01' });
assert('check-in sebulan > 1.000', logs.length > 1000);

const sb = fakeSb(
  {
    sigaji_attendance_logs: logs,
    sigaji_location_assignments: [{ tenant_key: 't1', nik: 'ABS' }],
  },
  1000
);

const result = await syncAlphaFromMobileAttendance(sb, 't1', payload, dateFrom, dateTo);
const last = workDates[workDates.length - 1];
assert('hadir lengkap tidak ditandai alpha di hari terakhir', payload.absensi['M001'] && payload.absensi['M001'][last] !== 'alpha');
assert('hadir lengkap tanpa alpha sama sekali', !payload.absensi['M001'] || Object.keys(payload.absensi['M001']).length === 0);
assert('non-mobile tanpa assignment tidak ditandai', !payload.absensi.OFF);
assert('mobile tanpa check-in (ada assignment) ditandai alpha', payload.absensi.ABS && payload.absensi.ABS[last] === 'alpha');
assert('jumlah alpha = hari kerja untuk yang absen', result.marked === workDates.length);

console.log('\nPaging sinkron alpha: semua tes lulus.');
