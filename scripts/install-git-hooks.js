/**
 * Pasang git hooks dari scripts/git-hooks/ → .git/hooks/
 * Jalankan: npm run install:hooks  (otomatis lewat npm install / prepare)
 */
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const gitDir = path.join(root, '.git');
const srcDir = path.join(__dirname, 'git-hooks');
const destDir = path.join(gitDir, 'hooks');

if (!fs.existsSync(gitDir)) {
  console.log('install-git-hooks: lewati — bukan repo git');
  process.exit(0);
}

if (!fs.existsSync(srcDir)) {
  console.warn('install-git-hooks: folder sumber tidak ada');
  process.exit(0);
}

if (!fs.existsSync(destDir)) fs.mkdirSync(destDir, { recursive: true });

const files = fs.readdirSync(srcDir).filter(function (f) {
  return fs.statSync(path.join(srcDir, f)).isFile();
});

files.forEach(function (name) {
  const from = path.join(srcDir, name);
  const to = path.join(destDir, name);
  fs.copyFileSync(from, to);
  try {
    fs.chmodSync(to, 0o755);
  } catch (e) {
    /* Windows: chmod opsional */
  }
  console.log('install-git-hooks: ' + name);
});
