/**
 * Quality gate pre-push — dipanggil dari .git/hooks/pre-push (Windows + Unix).
 */
const { spawnSync } = require('child_process');
const path = require('path');

const root = path.join(__dirname, '..');
const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';

console.log('SiGaji pre-push: npm run check:quality');

const r = spawnSync(npm, ['run', 'check:quality'], {
  cwd: root,
  stdio: 'inherit',
  shell: process.platform === 'win32',
});

process.exit(typeof r.status === 'number' ? r.status : 1);
