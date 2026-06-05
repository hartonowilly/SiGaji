/**
 * Rakit index.html dari index.template.html + partials/*.html
 * Placeholder: <!-- @include partials/pg-absensi.html -->
 */
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const templatePath = path.join(root, 'index.template.html');
const outPath = path.join(root, 'index.html');

if (!fs.existsSync(templatePath)) {
  console.error('assemble-index: index.template.html tidak ditemukan');
  process.exit(1);
}

let html = fs.readFileSync(templatePath, 'utf8');
const re = /<!--\s*@include\s+([^\s]+)\s*-->/g;

html = html.replace(re, function (_match, rel) {
  const partialPath = path.join(root, rel.replace(/\//g, path.sep));
  if (!fs.existsSync(partialPath)) {
    console.error('assemble-index: partial tidak ada:', rel);
    process.exit(1);
  }
  return fs.readFileSync(partialPath, 'utf8').trim() + '\n';
});

fs.writeFileSync(outPath, html, 'utf8');
console.log('assemble-index: wrote index.html (' + html.split('\n').length + ' lines)');
