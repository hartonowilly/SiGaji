/**
 * Absensi HP: daftar ringkas seperti Gaji, kalender hanya setelah Isi.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

function assert(name, cond) {
  if (!cond) throw new Error('FAIL: ' + name);
  console.log('OK: ' + name);
}

const abs = fs.readFileSync(path.join(ROOT, 'js/modules/app-absensi.js'), 'utf8');
const html = fs.readFileSync(path.join(ROOT, 'partials/pg-absensi.html'), 'utf8');

assert('cari absensi HP', /function abSetCari/.test(abs) && /id="ab-mobile-cari"/.test(html));
assert('buka satu kartu', /function abBukaKartu/.test(abs) && /Tutup/.test(abs) && /Isi/.test(abs));
assert('kalender minggu hanya saat terbuka', /if\(isOpen\)/.test(abs) && /ab-mobile-week/.test(abs));
assert('tab singkat HP', /tab-short/.test(html) && /Kalender/.test(html));
assert('cuti kartu HP', /cuti-rekap-mobile/.test(html) && /cuti-mobile-card/.test(abs));
assert('HP pilih status, bukan putar', /ab-open-status/.test(abs) && /function abPilihStatus/.test(abs));
assert('desktop tetap putar toggleAb', /function toggleAb/.test(abs) && /S=\['hadir','cuti','izin','sakit'/.test(abs));
assert('HP satu baris audit', /function abSetStatus/.test(abs) && /Sisa cuti 0/.test(abs));
assert('isi massal HP', /function abIsiSemuaHadir/.test(abs) && /function abIsiSepertiKemarin/.test(abs));
assert('kemarin satu tanggal, bukan sebulan', /function abIsoHariKerjaSebelum/.test(abs) && /function abTerapSepertiKemarin/.test(abs) && /Tanggal lain tidak diubah/.test(abs));
assert('kemarin tidak merambat hadir', !/Salin status hari sebelumnya ke setiap tanggal kerja/.test(abs));
assert('semua hadir skip yang sudah terisi', /sudah berisi status lain, tidak diubah/.test(abs) && /function abStatusTersimpan/.test(abs));
assert('konfirmasi lembar HP', /function abConfirmSheet/.test(abs) && /ab-confirm-sheet/.test(abs));

const ev = fs.readFileSync(path.join(ROOT, 'js/sigaji-events.js'), 'utf8');
assert('event picker HP', /ab-open-status/.test(ev) && /ab-set-status/.test(ev) && /ab-copy-kemarin/.test(ev));

console.log('absensi-mobile-card.test.mjs: all passed');
