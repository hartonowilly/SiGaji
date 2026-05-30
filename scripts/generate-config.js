/**
 * Membuat js/config.js saat deploy Netlify dari Environment Variables.
 * Repo publik: config.js tidak di-commit (.gitignore).
 * Lokal: salin js/config.example.js → js/config.js ATAU set env lalu npm run build.
 */
const fs = require('fs');
const path = require('path');

const outPath = path.join(__dirname, '..', 'js', 'config.js');

const url = (process.env.SIGAJI_SUPABASE_URL || '').trim();
const anon = (process.env.SIGAJI_SUPABASE_ANON_KEY || '').trim();

if (!url || !anon) {
  if (fs.existsSync(outPath)) {
    console.log('generate-config: lewati (env kosong, js/config.js sudah ada — mode lokal).');
    process.exit(0);
  }
  console.error(
    'generate-config: wajib set SIGAJI_SUPABASE_URL dan SIGAJI_SUPABASE_ANON_KEY (Netlify env) atau buat js/config.js dari config.example.js'
  );
  process.exit(1);
}

function esc(v) {
  return JSON.stringify(String(v));
}

function envStr(name, fallback) {
  const v = process.env[name];
  if (v === undefined || v === null || String(v).trim() === '') return fallback;
  return String(v).trim();
}

function envBool(name, fallback) {
  const v = envStr(name, '');
  if (!v) return fallback;
  return v === '1' || /^true$/i.test(v);
}

function envInt(name, fallback) {
  const n = parseInt(process.env[name], 10);
  return Number.isFinite(n) ? n : fallback;
}

const tenant = envStr('SIGAJI_TENANT_KEY', '');
const maxEmp = envInt('SIGAJI_MAX_EMPLOYEES', 0);
const bootstrap = envStr('SIGAJI_BOOTSTRAP_ADMIN_EMAIL', '');
const storage = envStr('SIGAJI_STORAGE_MODE', 'dual');
const resume = envBool('SIGAJI_RESUME_SESSION_ON_LOAD', false);
const idleMin = envInt('SIGAJI_IDLE_LOGOUT_MINUTES', 30);

const content = [
  '// File ini dibuat otomatis saat deploy Netlify — jangan commit ke Git.',
  '// Sumber: Environment variables SIGAJI_SUPABASE_* di Netlify.',
  `window.SIGAJI_SUPABASE_URL = ${esc(url)};`,
  `window.SIGAJI_SUPABASE_ANON_KEY = ${esc(anon)};`,
  `window.SIGAJI_TENANT_KEY = ${esc(tenant)};`,
  `window.SIGAJI_MAX_EMPLOYEES = ${maxEmp};`,
  `window.SIGAJI_BOOTSTRAP_ADMIN_EMAIL = ${esc(bootstrap)};`,
  `window.SIGAJI_STORAGE_MODE = ${esc(storage)};`,
  `window.SIGAJI_RESUME_SESSION_ON_LOAD = ${resume};`,
  `window.SIGAJI_IDLE_LOGOUT_MINUTES = ${idleMin};`,
  '',
].join('\n');

fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, content, 'utf8');
console.log('generate-config: wrote js/config.js');
