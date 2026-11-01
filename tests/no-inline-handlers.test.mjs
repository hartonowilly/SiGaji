/**
 * CSP script-src 'self' menolak onclick=/onchange=/oninput= di HTML.
 * Gagal jika handler inline masih ada di template, partials, atau string JS.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const INLINE = /\son(?:click|change|input|keydown|submit)="/i;
const SKIP_DIR = new Set(['node_modules', '.git', '_archive', 'vendor', 'sigaji_mobile', 'scripts']);

function walk(dir, acc) {
  for (const name of fs.readdirSync(dir)) {
    if (SKIP_DIR.has(name)) continue;
    const p = path.join(dir, name);
    const st = fs.statSync(p);
    if (st.isDirectory()) walk(p, acc);
    else if (/\.(html|js)$/.test(name)) acc.push(p);
  }
  return acc;
}

const files = walk(root, []).concat(
  walk(path.join(root, 'js'), []),
  walk(path.join(root, 'partials'), []),
  walk(path.join(root, 'mobile'), [])
).filter(function (p, i, arr) {
  return arr.indexOf(p) === i;
});

const hits = [];
for (const file of files) {
  const rel = path.relative(root, file).replace(/\\/g, '/');
  if (rel.startsWith('js/vendor/')) continue;
  if (rel.startsWith('_archive/')) continue;
  const lines = fs.readFileSync(file, 'utf8').split(/\r?\n/);
  lines.forEach(function (line, i) {
    if (INLINE.test(line) && !/\.\s*on(?:click|change|input)\s*=/.test(line)) {
      hits.push(rel + ':' + (i + 1) + ': ' + line.trim().slice(0, 160));
    }
  });
}

if (hits.length) {
  console.error('Handler inline tersisa (blokir CSP):\n' + hits.join('\n'));
  process.exit(1);
}
console.log('no-inline-handlers: ' + files.length + ' berkas bersih');
