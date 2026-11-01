/**
 * CORS /api/*: hanya origin yang sama dengan host API, domain produksi, atau localhost
 * yang mendapat Access-Control-Allow-Origin. Origin asing → tanpa header (browser memblokir).
 * Jalankan: node tests/cors-origin.test.mjs
 */
import fs from 'fs';
import os from 'os';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const tmp = path.join(os.tmpdir(), 'sigaji-cf-shared-' + process.pid + '.mjs');
// cf-shared.js mengimpor supabase-js (tidak dibutuhkan di sini) — ganti dengan stub.
const src = fs
  .readFileSync(path.join(__dirname, '..', 'functions', '_lib', 'cf-shared.js'), 'utf8')
  .replace(/import \{ createClient \} from '@supabase\/supabase-js';/, 'const createClient = () => null;');
fs.writeFileSync(tmp, src);
const { isAllowedOrigin, corsHeaders, handleOptions } = await import(pathToFileURL(tmp).href);
fs.unlinkSync(tmp);

let fails = 0;
function ok(cond, msg) {
  if (cond) console.log('OK:', msg);
  else {
    fails++;
    console.error('GAGAL:', msg);
  }
}
function req(origin, host) {
  const h = new Headers();
  if (origin != null) h.set('Origin', origin);
  h.set('host', host || 'www.cemerlang.online');
  return { headers: h };
}

ok(isAllowedOrigin('https://www.cemerlang.online', req('x', 'www.cemerlang.online')), 'host sama → boleh');
ok(isAllowedOrigin('https://sigaji-abc.pages.dev', req('x', 'sigaji-abc.pages.dev')), 'preview pages.dev host sama → boleh');
ok(isAllowedOrigin('https://cemerlang.online', req('x', 'sigaji.pages.dev')), 'domain produksi dari host lain → boleh');
ok(isAllowedOrigin('http://localhost:3333', req('x', 'www.cemerlang.online')), 'localhost dev → boleh');
ok(!isAllowedOrigin('https://evil.example', req('x', 'www.cemerlang.online')), 'origin asing → tolak');
ok(!isAllowedOrigin('https://www.cemerlang.online.evil.example', req('x', 'www.cemerlang.online')), 'subdomain tiruan → tolak');
ok(!isAllowedOrigin('null', req('x', 'www.cemerlang.online')), 'origin "null" (file://, sandbox) → tolak');
ok(!isAllowedOrigin('', req('x')), 'kosong → tolak');

const hAsing = corsHeaders(req('https://evil.example'));
ok(!hAsing['Access-Control-Allow-Origin'], 'header: origin asing tidak dapat ACAO');
ok(hAsing.Vary === 'Origin', 'header: Vary: Origin tetap dikirim');
const hOk = corsHeaders(req('https://www.cemerlang.online'));
ok(hOk['Access-Control-Allow-Origin'] === 'https://www.cemerlang.online', 'header: origin sah dipantulkan');
ok(/Authorization/.test(hOk['Access-Control-Allow-Headers']), 'header: Authorization diizinkan');
const hNoOrigin = corsHeaders(req(null));
ok(Object.keys(hNoOrigin).length === 0, 'tanpa Origin (APK Android / curl) → tanpa header CORS');
const pre = handleOptions(req('https://evil.example'));
ok(pre.status === 204 && !pre.headers.get('Access-Control-Allow-Origin'), 'preflight origin asing → 204 tanpa ACAO');

if (fails) {
  console.error(fails + ' tes CORS gagal');
  process.exit(1);
}
console.log('CORS origin: semua tes lulus.');
