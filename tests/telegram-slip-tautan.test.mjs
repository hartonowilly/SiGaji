/**
 * Tautan Telegram: satu chat satu NIK, pindah saat ganti NIK, putus saat hapus permanen,
 * kirim satuan memakai filter periode + hasil beku.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

function assert(name, cond, extra) {
  if (!cond) throw new Error('FAIL: ' + name + (extra !== undefined ? ' — ' + extra : ''));
  console.log('OK: ' + name);
}

const auth = fs.readFileSync(path.join(root, 'js/modules/app-auth.js'), 'utf8');
const hr = fs.readFileSync(path.join(root, 'js/modules/app-hr-komponen.js'), 'utf8');
const wh = fs.readFileSync(path.join(root, 'functions/api/telegram-webhook.js'), 'utf8');
const move = fs.readFileSync(path.join(root, 'functions/api/telegram-move-link.js'), 'utf8');
const moveGuard = fs.readFileSync(path.join(root, 'functions/_lib/telegram-move-link-guard.js'), 'utf8');
const sql = fs.readFileSync(path.join(root, 'sql/supabase_telegram_chat_unik.sql'), 'utf8');

assert(
  'kirim satuan Telegram menolak lewat slipAlasanTidakKirim',
  /function sendCurrentSlipToTelegram[\s\S]{0,600}slipAlasanTidakKirim\(k,p/.test(auth)
);
assert(
  'kirim satuan email menolak lewat slipAlasanTidakKirim',
  /function sendCurrentSlipToEmail[\s\S]{0,900}slipAlasanTidakKirim\(k, p/.test(auth)
);
assert('alasan kirim cek periode', /karyawanInPeriode\(k,p\)/.test(auth) && /sigajiAmbilHasilBeku/.test(auth));
assert('API pindah tautan ada', /fromNik/.test(move) && /toNik/.test(move));
assert('API cek cabang NIK tujuan', /assertNikInScope\(sb, tenant, caller\.me, toNik\)/.test(move));
assert(
  'API tidak hapus tautan NIK tujuan',
  !/sigaji_telegram_links'[\s\S]{0,200}\.delete\(\)[\s\S]{0,160}eq\('nik', toNik\)/.test(move)
);
assert('API pakai penolakan NIK/tautan tujuan', /telegramMoveDestConflict\(destK, destLink\)/.test(move));
assert('pesan NIK tujuan terpakai', /NIK tujuan sudah dipakai karyawan lain/.test(moveGuard));
assert('pesan NIK tujuan sudah bertautan', /NIK tujuan sudah punya tautan Telegram/.test(moveGuard));

function telegramMoveDestConflict(destKaryawan, destHasLink) {
  if (destKaryawan) return { status: 409, error: 'NIK tujuan sudah dipakai karyawan lain' };
  if (destHasLink) return { status: 409, error: 'NIK tujuan sudah punya tautan Telegram' };
  return null;
}
function cabangScope(me) {
  if (!me || me.role === 'Admin') return null;
  const ids = String(me.cabangId || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  return ids.length ? new Set(ids) : null;
}
function karyawanCabangId(k) {
  const id = String((k && (k.cabangId || k.cabang)) || '').trim();
  return id || 'utama';
}
const andi = { nik: 'A001', nama: 'Andi', cabangId: 'jakarta' };
const budi = { nik: 'B001', nama: 'Budi', cabangId: 'surabaya' };
const hrdJakarta = { role: 'HRD', cabangId: 'jakarta' };
const tautan = {
  A001: { nik: 'A001', chat_id: 'andi-chat' },
  B001: { nik: 'B001', chat_id: 'budi-chat' },
};
function hrdBolehNik(me, k) {
  const scope = cabangScope(me);
  if (!scope) return true;
  return !!(k && scope.has(karyawanCabangId(k)));
}
function cobaPindah(me, fromNik, toNik, karyawanList, links) {
  const fromK = karyawanList.find((x) => x.nik === fromNik);
  if (!hrdBolehNik(me, fromK)) return { status: 403, links: { ...links } };
  const destK = karyawanList.find((x) => x.nik === toNik) || null;
  if (destK && !hrdBolehNik(me, destK)) return { status: 403, links: { ...links } };
  const conflict = telegramMoveDestConflict(destK, links[toNik] || null);
  if (conflict) return { status: conflict.status, links: { ...links } };
  const next = { ...links };
  if (next[fromNik]) {
    next[toNik] = { nik: toNik, chat_id: next[fromNik].chat_id };
    delete next[fromNik];
  }
  return { status: 200, links: next };
}
const curang = cobaPindah(hrdJakarta, 'A001', 'B001', [andi, budi], tautan);
assert('HRD Jakarta tidak boleh pindah tautan ke NIK Surabaya', curang.status === 403);
assert('Tautan Budi tetap milik Budi', curang.links.B001 && curang.links.B001.chat_id === 'budi-chat');
assert('Tautan Andi tidak pindah ke B001', !curang.links.B001 || curang.links.B001.chat_id !== 'andi-chat');
assert('NIK baru kosong boleh (ganti NIK profil)', telegramMoveDestConflict(null, null) === null);
assert('NIK tujuan sudah karyawan lain ditolak', telegramMoveDestConflict(budi, tautan.B001).status === 409);
assert('NIK tujuan sudah bertautan ditolak', telegramMoveDestConflict(null, tautan.B001).status === 409);
const gantiNik = cobaPindah(hrdJakarta, 'A001', 'A009', [andi, budi], tautan);
assert('ganti NIK ke kode baru: tautan pindah', gantiNik.status === 200 && gantiNik.links.A009.chat_id === 'andi-chat' && !gantiNik.links.A001);
assert('ganti NIK ke kode baru: tautan Budi utuh', gantiNik.links.B001.chat_id === 'budi-chat');
assert('webhook lepas chat_id dari NIK lain', /eq\('chat_id', chatId\)/.test(wh) && /neq\('nik', req\.nik\)/.test(wh));
assert('SQL unik chat_id', /sigaji_telegram_links_chat_uidx/.test(sql));
assert('hapus permanen putus Telegram', /function hapusKarPermanen[\s\S]{0,900}telegramUnlinkNik\(nik/.test(hr));
assert('ganti NIK pindah tautan', /telegramMoveNikLink\(oldNik,newNik\)/.test(hr));

function slipAlasanTidakKirim(k, p, opts) {
  opts = opts || {};
  if (!k) return 'Pilih karyawan';
  if (typeof isKarSampah === 'function' && isKarSampah(k)) return 'Karyawan di sampah — tidak dikirim';
  if (p && typeof karyawanInPeriode === 'function' && !karyawanInPeriode(k, p)) {
    return (k.nama || k.nik) + ' tidak termasuk periode ' + (p.nama || '');
  }
  if (!opts.thr && p && typeof isPeriodeLocked === 'function' && isPeriodeLocked(p.nama)) {
    var beku = typeof sigajiAmbilHasilBeku === 'function' ? sigajiAmbilHasilBeku(p, k.nik) : null;
    if (!beku) return 'Periode terkunci, belum ada hasil beku untuk ' + (k.nama || k.nik);
  }
  return '';
}
function isKarSampah(k) {
  return !!(k && k.dihapusPada);
}
function karyawanInPeriode(k, p) {
  if (!k || k.dihapusPada) return false;
  if (!p || !p.start) return true;
  var t = k.tgl_berhenti;
  if (!t) return true;
  return t >= p.start;
}
function isPeriodeLocked(nama) {
  return nama === 'Kunci';
}
function sigajiAmbilHasilBeku(p, nik) {
  return p && p.hasil_gaji && p.hasil_gaji.byNik && p.hasil_gaji.byNik[nik] ? p.hasil_gaji.byNik[nik] : null;
}

const pNov = { nama: 'Nov 2026', start: '2026-11-01', end: '2026-11-30' };
const pKunci = { nama: 'Kunci', start: '2026-10-01', hasil_gaji: { v: 1, byNik: { K1: { neto: 1 } } } };
assert('resign di dalam periode boleh kirim', slipAlasanTidakKirim({ nik: 'K1', nama: 'Ani', tgl_berhenti: '2026-11-15' }, pNov) === '');
assert(
  'resign sebelum periode ditolak',
  /tidak termasuk periode/.test(slipAlasanTidakKirim({ nik: 'K1', nama: 'Ani', tgl_berhenti: '2026-10-31' }, pNov))
);
assert('sampah ditolak', /sampah/.test(slipAlasanTidakKirim({ nik: 'K1', dihapusPada: 'x' }, pNov)));
assert('terkunci tanpa beku ditolak', /hasil beku/.test(slipAlasanTidakKirim({ nik: 'K2', nama: 'Budi' }, pKunci)));
assert('terkunci dengan beku boleh', slipAlasanTidakKirim({ nik: 'K1', nama: 'Ani' }, pKunci) === '');

console.log('\nTelegram tautan slip: semua tes lulus.');
