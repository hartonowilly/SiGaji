/**
 * Sama seperti kemarin: satu tanggal dari hari kerja sebelumnya, bukan merambat sebulan.
 */
function pad(n) {
  return String(n).padStart(2, '0');
}
function isoKemarin(iso) {
  var d = new Date(String(iso) + 'T12:00:00');
  d.setDate(d.getDate() - 1);
  return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
}
function hariKerjaSebelum(iso, isHL, isLiburKerja) {
  var d = iso;
  var i;
  for (i = 0; i < 21; i++) {
    d = isoKemarin(d);
    var dt = new Date(d + 'T12:00:00');
    if (isHL(d)) continue;
    if (isLiburKerja(dt.getDay())) continue;
    return d;
  }
  return '';
}

function assertEq(name, actual, expected) {
  if (actual !== expected) {
    throw new Error('FAIL: ' + name + ' — dapat ' + JSON.stringify(actual) + ', harus ' + JSON.stringify(expected));
  }
  console.log('OK: ' + name);
}

const sunSat = function (dow) {
  return dow === 0 || dow === 6;
};
const noHL = function () {
  return false;
};

assertEq('Senin 2 Nov 2026 ← Jumat 30 Okt', hariKerjaSebelum('2026-11-02', noHL, sunSat), '2026-10-30');
assertEq('Selasa 3 Nov ← Senin 2 Nov, bukan merambat', hariKerjaSebelum('2026-11-03', noHL, sunSat), '2026-11-02');
assertEq('izin tgl 2 tidak ikut tertimpa rumus tgl 3', hariKerjaSebelum('2026-11-03', noHL, sunSat) === '2026-11-02', true);

console.log('absensi-kemarin.test.mjs: all passed');
