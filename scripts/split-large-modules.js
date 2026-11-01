/**
 * Pecah app-access.js dan app-hr.js di penanda seksi yang sudah ada.
 * Jalankan: node scripts/split-large-modules.js
 */
'use strict';

const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const modDir = path.join(root, 'js', 'modules');

function splitFile(srcName, parts) {
  const srcPath = path.join(modDir, srcName);
  const text = fs.readFileSync(srcPath, 'utf8');
  const idx = parts.map(function (p) {
    if (!p.marker) return 0;
    const i = text.indexOf(p.marker);
    if (i < 0) {
      console.error('Penanda tidak ada di', srcName, p.marker);
      process.exit(1);
    }
    return i;
  });
  parts.forEach(function (p, n) {
    const start = idx[n];
    const end = n + 1 < parts.length ? idx[n + 1] : text.length;
    let body = text.slice(start, end);
    if (p.header && n > 0) body = p.header + body;
    fs.writeFileSync(path.join(modDir, p.file), body.replace(/\s+$/, '') + '\n', 'utf8');
    console.log(p.file, (body.length / 1024).toFixed(1) + ' KB');
  });
}

splitFile('app-access.js', [
  { file: 'app-access.js', marker: null },
  {
    file: 'app-auth.js',
    marker: '// ── BRANDING',
    header: '/* SiGaji — branding, login, idle, unggah logo, kirim slip massal */\n',
  },
  {
    file: 'app-sys.js',
    marker: 'function sigajiReadStoredSchemaVersion(){',
    header: '/* SiGaji — status sistem, renderAll */\n',
  },
]);

splitFile('app-hr.js', [
  { file: 'app-hr.js', marker: null },
  {
    file: 'app-hr-komponen.js',
    marker: '// ── KOMPONEN GAJI',
    header: '/* SiGaji — komponen gaji, slide panel, tunjangan, BPJS, natura */\n',
  },
  {
    file: 'app-hr-payroll.js',
    marker: '// ── PENGGAJIAN',
    header: '/* SiGaji — proses gaji, approval */\n',
  },
]);

const templatePath = path.join(root, 'index.template.html');
let html = fs.readFileSync(templatePath, 'utf8');
if (!html.includes('app-auth.js')) {
  html = html.replace(
    '<script src="/js/modules/app-access.js?v=',
    '<script src="/js/modules/app-access.js?v='
  );
  html = html.replace(
    /(<script src="\/js\/modules\/app-access\.js\?v=[^"]+"><\/script>\s*)(<script src="\/js\/modules\/app-hr\.js\?v=[^"]+"><\/script>)/,
    function (_m, access, hr) {
      const ver = (access.match(/\?v=([^"]+)/) || [])[1] || '11.7.3';
      return (
        access +
        '<script src="/js/modules/app-auth.js?v=' +
        ver +
        '"></script>\n' +
        '<script src="/js/modules/app-sys.js?v=' +
        ver +
        '"></script>\n' +
        hr +
        '\n<script src="/js/modules/app-hr-komponen.js?v=' +
        ver +
        '"></script>\n' +
        '<script src="/js/modules/app-hr-payroll.js?v=' +
        ver +
        '"></script>'
      );
    }
  );
  fs.writeFileSync(templatePath, html);
  console.log('index.template.html: script pecahan ditambah');
} else {
  console.log('index.template.html: script pecahan sudah ada');
}
