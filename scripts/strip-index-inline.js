const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const indexPath = path.join(root, 'index.html');
let html = fs.readFileSync(indexPath, 'utf8');

const marker = '<script src="/js/modules/app-shell.js?v=11.5.1"></script>';
const bodyEnd = '</body>';

const i = html.indexOf(marker);
const j = html.indexOf(bodyEnd);
if (i < 0 || j < 0) {
  console.error('strip-index-inline: marker tidak ditemukan');
  process.exit(1);
}

const tail =
  marker +
  '\n<script src="/js/pesangon.js?v=11.5.1"></script>\n'
  + '<script src="/js/config.js?v=10.0.0"></script>\n'
  + '<script src="/js/vendor/supabase.js?v=2.105.4"></script>\n'
  + '<script src="/js/cloud-branding.js?v=10.0.0"></script>\n'
  + '<script src="/js/cloud-tables.js?v=11.3.0"></script>\n'
  + "<script>if(typeof sigajiApplyCloudLoginUi==='function')sigajiApplyCloudLoginUi();</script>\n"
  + '<script src="/js/cloud-sync.js?v=11.5.1"></script>\n'
  + '<script src="/js/modules/app-boot.js?v=11.5.1"></script>\n'
  + html.slice(j);

html = html.slice(0, i) + tail;
fs.writeFileSync(indexPath, html, 'utf8');
fs.writeFileSync(path.join(root, 'index.template.html'), html, 'utf8');
console.log('strip-index-inline: ok,', html.split('\n').length, 'lines');
