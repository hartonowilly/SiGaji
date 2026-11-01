/**
 * Smoke browser (Playwright) — 5 alur inti.
 * Lewati otomatis jika paket playwright belum terpasang (tidak memutus check:quality).
 *
 *   npm i -D playwright && npx playwright install chromium
 *   npm run test:e2e
 */
import { spawn } from 'child_process';
import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const PORT = 8768;

let playwright;
try {
  playwright = await import('playwright');
} catch {
  console.log('Lewati e2e: paket playwright belum terpasang (npm i -D playwright).');
  process.exit(0);
}

function waitHttp() {
  return new Promise(function (resolve, reject) {
    var n = 0;
    (function tick() {
      http
        .get('http://127.0.0.1:' + PORT + '/', function (res) {
          res.resume();
          resolve();
        })
        .on('error', function () {
          if (++n > 40) reject(new Error('server tidak nyala'));
          else setTimeout(tick, 150);
        });
    })();
  });
}

const server = spawn(process.execPath, ['scripts/static-server.mjs', String(PORT)], {
  cwd: ROOT,
  stdio: 'ignore',
});
if (!server.pid) {
  /* fallback: python */
}

let py;
try {
  await waitHttp();
} catch {
  py = spawn('python', ['-m', 'http.server', String(PORT)], { cwd: ROOT, stdio: 'ignore' });
  await waitHttp();
}

const browser = await playwright.chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
const errors = [];
page.on('pageerror', function (e) {
  errors.push(String(e));
});

await page.goto('http://127.0.0.1:' + PORT + '/?e2e=1', { waitUntil: 'domcontentloaded' });

async function masukDummy() {
  await page.evaluate(function () {
    var people = [];
    for (var i = 1; i <= 4; i++) {
      people.push({
        nik: 'N' + String(i).padStart(2, '0'),
        nama: 'Karyawan ' + i,
        jabatan: 'Staff',
        dept: 'HRD',
        status: 'Tetap',
        ptkp: 'TK/0',
        masuk: '2020-01-01',
        gapok: 5000000,
        tunjangan: [],
        potongan: [],
        natura: [],
        bpjs_aktif: {},
        aktif: true,
      });
    }
    karyawan = people;
    periodes = [
      { id: 1, nama: 'Oktober 2026', start: '2026-10-01', end: '2026-10-31', bayar: '2026-10-30', status: 'aktif' },
    ];
    absensi = {};
    perusahaan.hariKerja = 6;
    perusahaan.nama = 'PT Uji';
    localStorage.setItem('sigaji_setup_wizard_done', '1');
    enterAppWithUser({ nama: 'Admin Uji', role: 'Admin', username: 'admin', email: 'admin@uji.local' });
    var w = document.getElementById('m-setup-wizard');
    if (w) {
      w.classList.remove('show');
      w.style.display = 'none';
    }
  });
}

await masukDummy();

function assert(name, cond) {
  if (!cond) throw new Error('FAIL e2e: ' + name);
  console.log('OK: ' + name);
}

assert('app tampil', await page.evaluate(function () {
  return !!document.getElementById('app');
}));

/* 1. Tema */
await page.evaluate(function () {
  sigajiSetUiPref('theme', 'kertas');
});
assert(
  'tema kertas',
  await page.evaluate(function () {
    return document.documentElement.getAttribute('data-theme') === 'kertas';
  })
);
await page.evaluate(function () {
  sigajiSetUiPref('theme', 'light');
});

/* 2. Halaman utama tanpa error konsol */
for (const pg of ['dashboard', 'karyawan', 'absensi', 'penggajian']) {
  await page.evaluate(function (p) {
    showPg(p);
  }, pg);
}
assert('tanpa error JS di 4 halaman', errors.length === 0);

/* 3. Sampah karyawan */
await page.evaluate(function () {
  showPg('karyawan');
  var k = karyawan.find(function (x) {
    return x.nik === 'N01';
  });
  k.dihapusPada = new Date().toISOString();
  renderKar();
});
assert(
  'N01 tidak di daftar aktif',
  await page.evaluate(function () {
    return !document.body.innerText.includes('N01') || document.getElementById('tb-kar').innerText.indexOf('N01') < 0;
  })
);

/* 4. HP: drawer prefs ada */
await page.setViewportSize({ width: 390, height: 844 });
await page.evaluate(function () {
  window.dispatchEvent(new Event('resize'));
});
await page.waitForTimeout(400);
assert(
  'select tema mobile ada',
  await page.evaluate(function () {
    return !!document.getElementById('ui-pref-theme-mobile');
  })
);

/* 5. Outbox API ada */
assert(
  'outbox terpasang',
  await page.evaluate(function () {
    return !!(window.sigajiOutbox && typeof window.sigajiOutbox.catat === 'function');
  })
);

await browser.close();
if (py) py.kill();
server.kill();
console.log('E2E smoke: semua tes lulus.');
