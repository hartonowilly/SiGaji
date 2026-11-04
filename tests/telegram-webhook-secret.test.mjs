/**
 * Webhook Telegram menolak jika SIGAJI_TELEGRAM_WEBHOOK_SECRET kosong atau salah.
 */
import fs from 'fs';
import os from 'os';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const tmpCf = path.join(os.tmpdir(), 'sigaji-cf-wh-' + process.pid + '.mjs');
const tmpWh = path.join(os.tmpdir(), 'sigaji-wh-' + process.pid + '.mjs');
const cfSrc = fs
  .readFileSync(path.join(ROOT, 'functions', '_lib', 'cf-shared.js'), 'utf8')
  .replace(/import \{ createClient \} from '@supabase\/supabase-js';/, 'const createClient = () => null;');
fs.writeFileSync(tmpCf, cfSrc);
const whSrc = fs
  .readFileSync(path.join(ROOT, 'functions', 'api', 'telegram-webhook.js'), 'utf8')
  .replace(/from '\.\.\/_lib\/cf-shared\.js'/, "from '" + pathToFileURL(tmpCf).href + "'");
fs.writeFileSync(tmpWh, whSrc);
const { onRequestPost } = await import(pathToFileURL(tmpWh).href);
fs.unlinkSync(tmpWh);
fs.unlinkSync(tmpCf);

function req(headers) {
  return {
    headers: { get: (k) => headers[k.toLowerCase()] || headers[k] || null },
    json: async () => ({}),
  };
}

function assert(name, cond) {
  if (!cond) throw new Error('FAIL: ' + name);
  console.log('OK: ' + name);
}

{
  const r = await onRequestPost({
    request: req({}),
    env: { SIGAJI_TELEGRAM_BOT_TOKEN: 'x', SIGAJI_TENANT_KEY: 'main' },
  });
  assert('tanpa secret → 503', r.status === 503);
}

{
  const r = await onRequestPost({
    request: req({ 'x-telegram-bot-api-secret-token': 'salah' }),
    env: {
      SIGAJI_TELEGRAM_BOT_TOKEN: 'x',
      SIGAJI_TELEGRAM_WEBHOOK_SECRET: 'rahasia',
      SIGAJI_TENANT_KEY: 'main',
    },
  });
  assert('secret salah → 401', r.status === 401);
}

console.log('\nWebhook Telegram secret: semua tes lulus.');
