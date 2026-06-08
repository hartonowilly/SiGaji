/**
 * Ganti hex umum → var(--token) di file CSS prioritas.
 * Jalankan: node scripts/migrate-css-hex.js
 */
import fs from 'fs';
import path from 'path';

const ROOT = path.resolve(import.meta.dirname, '..');

/** Urutan: hex panjang dulu agar tidak partial-match */
const MAP = [
  ['#ffffff', 'var(--wh)'],
  ['#1a56a0', 'var(--color-primary)'],
  ['#0d3d7a', 'var(--color-primary-dark)'],
  ['#3b82f6', 'var(--color-primary-light)'],
  ['#2563eb', 'var(--indigo)'],
  ['#1d4ed8', 'var(--indigo-ink)'],
  ['#e8f0fb', 'var(--color-primary-subtle)'],
  ['#eff6ff', 'var(--color-blue-50)'],
  ['#dbeafe', 'var(--color-blue-100)'],
  ['#bfdbfe', 'var(--color-blue-200)'],
  ['#c5d9f5', 'var(--color-primary-border)'],
  ['#f1f5f9', 'var(--table-head-bg)'],
  ['#e2e8f0', 'var(--color-slate-200)'],
  ['#cbd5e1', 'var(--color-slate-300)'],
  ['#64748b', 'var(--color-slate-500)'],
  ['#475569', 'var(--table-head-color)'],
  ['#f8fafc', 'var(--color-surface-elevated)'],
  ['#f8f9fc', 'var(--row-hover)'],
  ['#f3f4f6', 'var(--color-surface-muted)'],
  ['#e5e7eb', 'var(--color-border-light)'],
  ['#dde1e9', 'var(--color-border)'],
  ['#374151', 'var(--ink-body)'],
  ['#1e2330', 'var(--sidebar)'],
  ['#6b7280', 'var(--color-text-muted)'],
  ['#9ca3af', 'var(--ink-subtle)'],
  ['#2d6a0a', 'var(--color-success)'],
  ['#e8f4de', 'var(--color-success-bg)'],
  ['#b3d98f', 'var(--color-success-border)'],
  ['#7d4800', 'var(--color-warning)'],
  ['#fef3e2', 'var(--color-warning-bg)'],
  ['#f5a623', 'var(--color-warning-border)'],
  ['#9b2121', 'var(--color-danger)'],
  ['#fdeaea', 'var(--color-danger-bg)'],
  ['#f5a3a3', 'var(--color-danger-border)'],
  ['#5b21b6', 'var(--color-purple)'],
  ['#f5f0ff', 'var(--color-purple-bg)'],
  ['#ede9fe', 'var(--color-purple-muted)'],
  ['#c4b5fd', 'var(--color-purple-border)'],
  ['#fffbeb', 'var(--row-pending-bg)'],
  ['#fffbf5', 'var(--row-prorate-bg)'],
  ['#fef2f2', 'var(--row-neto-neg-bg)'],
  ['#fff', 'var(--wh)'],
];

const SKIP_FILES = new Set(['css/sigaji-tokens.css']);

const FILES = [
  'css/ui-refresh.css',
  'css/sigaji-ui-enhance.css',
  'css/styles.css',
  'css/sigaji-utilities.css',
  'css/sigaji-components.css',
  'css/sigaji-print.css',
];

/** Jangan ganti hex di baris definisi token (--foo: #hex) agar tidak circular */
function replaceHexSafe(text, hex, token) {
  const re = new RegExp(hex.replace('#', '#'), 'gi');
  return text.replace(re, (match, offset, src) => {
    const lineStart = src.lastIndexOf('\n', offset) + 1;
    const lineEnd = src.indexOf('\n', offset);
    const line = src.slice(lineStart, lineEnd === -1 ? src.length : lineEnd);
    if (/^\s*--[\w-]+\s*:\s*/.test(line) && line.includes(match)) return match;
    return token;
  });
}

function migrate(file) {
  if (SKIP_FILES.has(file)) {
    console.log(file + ': skipped (token source)');
    return;
  }
  const p = path.join(ROOT, file);
  let t = fs.readFileSync(p, 'utf8');
  let n = 0;
  for (const [hex, token] of MAP) {
    const before = t;
    t = replaceHexSafe(t, hex, token);
    if (t !== before) n++;
  }
  fs.writeFileSync(p, t);
  const left = (t.match(/#[0-9a-fA-F]{3,8}\b/g) || []).length;
  console.log(file + ': replaced batches ' + n + ', hex remaining ~' + left);
}

FILES.forEach(migrate);
