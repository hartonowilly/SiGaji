/**
 * Tes Converter EXCEL transfer bank (.xlsm bermakro) — data FIKSI, tanpa database.
 *
 * Yang dijaga:
 *  1. Makro VBA & seluruh bagian template tersalin byte-per-byte (tombol tetap jalan).
 *  2. Debit/Credit Account & Transfer Amount ditulis sebagai ANGKA — makro memakai
 *     Format(...,"000...") untuk padding nol, jadi teks akan merusak hasil .txt.
 *  3. Sequence File tetap teks '001' (nol di depan tidak boleh hilang: masuk nama file .txt).
 *  4. Total Record = jumlah baris, dan nama file mengikuti bulan/tahun periode.
 *
 * Jalankan: node tests/converter-bank.test.mjs
 */
import fs from 'fs';
import path from 'path';
import vm from 'vm';
import zlib from 'zlib';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const TEMPLATE = path.join(ROOT, 'assets', 'templates', 'converter-bank-mandiri.xlsm');

function assertEq(name, actual, expected) {
  if (actual !== expected) {
    throw new Error('FAIL: ' + name + ' — dapat ' + actual + ', harus ' + expected);
  }
  console.log('OK: ' + name);
}

function assertTrue(name, cond) {
  assertEq(name, !!cond, true);
}

/** Muat modul converter di sandbox Node (tanpa DOM). */
function loadConverter() {
  const sandbox = { console, Date, Math, Object, Array, String, Number, JSON, Uint8Array, Int32Array, DataView, TextEncoder, TextDecoder, setTimeout, parseInt, parseFloat, isNaN };
  sandbox.window = sandbox;
  sandbox.document = { getElementById: () => null };
  const ctx = vm.createContext(sandbox);
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'js/modules/sigaji-converter-bank.js'), 'utf8'), ctx, {
    filename: 'sigaji-converter-bank.js',
  });
  return sandbox;
}

/** Pembaca zip minimal untuk memverifikasi hasil. */
function unzip(bytes) {
  const rd16 = (o) => bytes[o] | (bytes[o + 1] << 8);
  const rd32 = (o) => (bytes[o] | (bytes[o + 1] << 8) | (bytes[o + 2] << 16) | (bytes[o + 3] << 24)) >>> 0;
  let eocd = -1;
  for (let i = bytes.length - 22; i >= 0; i--) {
    if (rd32(i) === 0x06054b50) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) throw new Error('EOCD tidak ada');
  const count = rd16(eocd + 10);
  let p = rd32(eocd + 16);
  const out = new Map();
  for (let n = 0; n < count; n++) {
    const nameLen = rd16(p + 28);
    const extraLen = rd16(p + 30);
    const cmtLen = rd16(p + 32);
    const lho = rd32(p + 42);
    const method = rd16(p + 10);
    const csize = rd32(p + 20);
    const name = Buffer.from(bytes.subarray(p + 46, p + 46 + nameLen)).toString('utf8');
    const dataStart = lho + 30 + rd16(lho + 26) + rd16(lho + 28);
    const raw = Buffer.from(bytes.subarray(dataStart, dataStart + csize));
    out.set(name, { method, raw, data: method === 8 ? zlib.inflateRawSync(raw) : raw });
    p += 46 + nameLen + extraLen + cmtLen;
  }
  return out;
}

const px = loadConverter();
const template = new Uint8Array(fs.readFileSync(TEMPLATE));

const HEADER = {
  transaction_type: 'PY',
  mitra_id: '1610464',
  date: '20260831',
  sequence: '001',
  debit_account: '1610000863899',
  address_name: 'Sumbawa',
  city: 'Sumbawa',
  bank_code: '008',
  bank_name: 'BANK MANDIRI',
  bank_address: 'sumbawa',
  purpose: 'Gaji Agustus Cemerlang',
};

const ROWS = [
  { rekening: '1610002344328', nama: 'BUDI CONTOH', jumlah: 7554552 },
  { rekening: '1420011440764', nama: 'SITI CONTOH', jumlah: 12850216 },
  { rekening: '1610003135493', nama: 'AGUS & REKAN <QA>', jumlah: 1363148 },
];

const out = px.sigajiConverterBuildXlsm(template, HEADER, ROWS);
const before = unzip(template);
const after = unzip(out);

// ── 1. Semua bagian template ikut, makro utuh ──
{
  assertEq('jumlah entri zip sama', after.size, before.size);
  const vbaBefore = before.get('xl/vbaProject.bin').data;
  const vbaAfter = after.get('xl/vbaProject.bin').data;
  assertTrue('vbaProject.bin identik (makro utuh)', vbaBefore.equals(vbaAfter));
  assertTrue('makro Button7_Click ada', vbaAfter.includes(Buffer.from('Button7_Click')));
  ['xl/styles.xml', 'xl/drawings/drawing1.xml', 'xl/drawings/vmlDrawing1.vml',
    'xl/ctrlProps/ctrlProp1.xml', 'xl/printerSettings/printerSettings1.bin',
    'xl/worksheets/sheet1.xml', 'xl/workbook.xml'].forEach(function (name) {
    assertTrue('bagian disalin apa adanya: ' + name,
      before.get(name).data.equals(after.get(name).data));
  });
}

const sheet = after.get('xl/worksheets/sheet2.xml').data.toString('utf8');

// ── 2. Header ──
{
  assertTrue('A2 transaction type PY', sheet.includes('<c r="A2" s="8" t="inlineStr"><is><t xml:space="preserve">PY</t></is></c>'));
  assertTrue('B2 mitra id', sheet.includes('>1610464</t>'));
  assertTrue('C2 tanggal YYYYMMDD', sheet.includes('<c r="C2" s="12" t="inlineStr"><is><t xml:space="preserve">20260831</t></is></c>'));
  assertTrue('D2 sequence tetap teks 001', sheet.includes('<c r="D2" s="14" t="inlineStr"><is><t xml:space="preserve">001</t></is></c>'));
  assertTrue('E2 total record = jumlah baris', sheet.includes('<c r="E2" s="8" t="inlineStr"><is><t xml:space="preserve">3</t></is></c>'));
  assertTrue('judul kolom baris 4 utuh', sheet.includes('Purpose of Transaction'));
  assertEq('dimension ikut jumlah baris', /<dimension ref="([^"]+)"\/>/.exec(sheet)[1], 'A1:M7');
}

// ── 3. Tipe sel yang dibutuhkan makro ──
{
  assertTrue('debit account numerik', sheet.includes('<c r="A5" s="19"><v>1610000863899</v></c>'));
  assertTrue('credit account numerik', sheet.includes('<c r="B5" s="30"><v>1610002344328</v></c>'));
  assertTrue('amount numerik tanpa pemisah ribuan', sheet.includes('<c r="F5" s="32"><v>7554552</v></c>'));
  assertTrue('bank code tetap teks 008', sheet.includes('<c r="I5" s="21" t="inlineStr"><is><t xml:space="preserve">008</t></is></c>'));
  assertTrue('mata uang IDR', sheet.includes('>IDR</t>'));
  assertTrue('FT service IBU', sheet.includes('>IBU</t>'));
  assertTrue('customer ref = tanggal', sheet.includes('<c r="G5" s="12" t="inlineStr"><is><t xml:space="preserve">20260831</t></is></c>'));
  assertTrue('keterangan per baris', sheet.includes('>Gaji Agustus Cemerlang</t>'));
}

// ── 4. Baris data ──
{
  const rows = sheet.match(/<row r="\d+"/g).map((s) => Number(/\d+/.exec(s)[0]));
  assertEq('baris terakhir', Math.max.apply(null, rows), 7);
  assertEq('jumlah baris data', rows.filter((r) => r >= 5).length, ROWS.length);
  assertTrue('nama karyawan huruf besar', sheet.includes('>BUDI CONTOH</t>'));
  assertTrue('karakter XML di-escape', sheet.includes('>AGUS &amp; REKAN &lt;QA&gt;</t>'));
  assertTrue('tanpa data karyawan template', !sheet.includes('DEDE HARTONO'));
}

// ── 5. Nama file mengikuti bulan & tahun periode ──
{
  assertEq('Agustus 2026', px.sigajiConverterFileName('2026-08-31', 'Cemerlang'),
    'Converter EXCEL Agustus 2026 Cemerlang.xlsm');
  assertEq('Januari 2027', px.sigajiConverterFileName('2027-01-05', 'Cemerlang'),
    'Converter EXCEL Januari 2027 Cemerlang.xlsm');
  assertEq('tanpa label', px.sigajiConverterFileName('2026-12-24', ''),
    'Converter EXCEL Desember 2026.xlsm');
  assertEq('tanggal ringkas', px.sigajiConverterCompactDate('2026-08-31'), '20260831');
}

// ── 6. Nomor rekening tak lazim tidak dipaksa jadi angka ──
{
  const out2 = px.sigajiConverterBuildXlsm(template, HEADER, [
    { rekening: '0012345678', nama: 'NOL DEPAN', jumlah: 100000 },
  ]);
  const s2 = unzip(out2).get('xl/worksheets/sheet2.xml').data.toString('utf8');
  assertTrue('rekening berawalan 0 ditulis sebagai teks',
    s2.includes('<c r="B5" s="30" t="inlineStr"><is><t xml:space="preserve">0012345678</t></is></c>'));
}

// ── 7. Penolakan input kosong ──
{
  let err = '';
  try {
    px.sigajiConverterBuildXlsm(template, HEADER, []);
  } catch (e) {
    err = e.message;
  }
  assertEq('tanpa baris → error jelas', err, 'Tidak ada baris transfer');
}

console.log('\nConverter bank: semua tes lulus.');
