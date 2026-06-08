/**
 * Migrasi onclick inline di index.template.html → data-sigaji-action delegation.
 */
'use strict';

const fs = require('fs');
const path = require('path');

const file = path.join(__dirname, '..', 'index.template.html');
let html = fs.readFileSync(file, 'utf8');

const SPECIAL = {
  'return sigajiToggleNavDrawer(event)': 'data-sigaji-action="nav-drawer"',
  "document.getElementById('inp-tunjvar-xlsx').click()":
    'data-sigaji-action="click-input" data-target="inp-tunjvar-xlsx"',
  "document.getElementById('logo-input').click()":
    'data-sigaji-action="click-input" data-target="logo-input"',
  "document.getElementById('import-file-input').click()":
    'data-sigaji-action="click-input" data-target="import-file-input"',
  "document.getElementById('inp-migrasi-pph-xlsx').click()":
    'data-sigaji-action="click-input" data-target="inp-migrasi-pph-xlsx"',
};

function convertOnclick(body) {
  if (SPECIAL[body]) return SPECIAL[body];
  let m = body.match(/^(\w+)\(\)$/);
  if (m) return 'data-sigaji-action="invoke" data-fn="' + m[1] + '"';
  m = body.match(/^(\w+)\((true|false)\)$/);
  if (m) return 'data-sigaji-action="invoke" data-fn="' + m[1] + '" data-bool="' + (m[2] === 'true' ? '1' : '0') + '"';
  m = body.match(/^(\w+)\('([^']*)'\)$/);
  if (m) return 'data-sigaji-action="invoke" data-fn="' + m[1] + '" data-arg="' + m[2] + '"';
  m = body.match(/^(\w+)\((-?\d+)\)$/);
  if (m) return 'data-sigaji-action="invoke" data-fn="' + m[1] + '" data-arg="' + m[2] + '"';
  console.warn('UNHANDLED onclick:', body);
  return null;
}

let count = 0;
html = html.replace(/\s+onclick="([^"]+)"/g, function (full, body) {
  const conv = convertOnclick(body);
  if (!conv) return full;
  count++;
  return ' ' + conv;
});

fs.writeFileSync(file, html);
console.log('migrate-template-onclick: converted', count, 'handlers in index.template.html');
