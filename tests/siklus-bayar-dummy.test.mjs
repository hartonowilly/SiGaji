/**
 * Simulasi dummy — gaji harian & mingguan Oktober 2026.
 * Data fiktif, tanpa database. Harus lulus sebelum logika masuk hitungGaji.
 *
 *   node tests/siklus-bayar-dummy.test.mjs
 */
import { loadPayrollCore } from './lib/payroll-harness.mjs';

function assertEq(name, actual, expected) {
  if (actual !== expected) {
    throw new Error('FAIL: ' + name + ' — dapat ' + JSON.stringify(actual) + ', harus ' + JSON.stringify(expected));
  }
  console.log('OK: ' + name);
}

function assert(name, cond) {
  if (!cond) throw new Error('FAIL: ' + name);
  console.log('OK: ' + name);
}

const P_OKT = {
  id: 10,
  nama: 'Oktober 2026',
  start: '2026-10-01',
  end: '2026-10-31',
  bayar: '2026-10-31',
  status: 'aktif',
  tipe_periode: 'biasa',
};

const bpjsOn = {
  'kes-prs': true,
  'kes-kar': true,
  'jht-prs': true,
  'jht-kar': true,
  'jp-prs': true,
  'jp-kar': true,
  'jkk-prs': true,
  'jkm-prs': true,
};

const px = loadPayrollCore({
  perusahaan: { hariKerja: 6 },
  periodes: [P_OKT],
  hariLibur: [],
});

const {
  isoDow,
  siklusTanggalBayar,
  siklusTanggalBayarMingguan,
  siklusBpjsUpahSebulan,
  pecahPotonganCadangan,
  siklusBuildPays,
  hitungPPhBln,
  calcBPJS,
} = px;

console.log('\n── Kalender & hari gaji ──');
assertEq('1 Okt 2026 Kamis', isoDow('2026-10-01'), 4);
assertEq('31 Okt 2026 Sabtu', isoDow('2026-10-31'), 6);
assertEq('Jumat kerja tetap Jumat', siklusTanggalBayar('2026-10-02', 6, {}), '2026-10-02');
assertEq('Jumat libur → Kamis', siklusTanggalBayar('2026-10-02', 6, { '2026-10-02': true }), '2026-10-01');
assertEq('Senin libur → Jumat sebelumnya', siklusTanggalBayar('2026-10-05', 6, { '2026-10-05': true }), '2026-10-03');

const jumatOkt = siklusTanggalBayarMingguan('2026-10-01', '2026-10-31', 5, 6, {}, '', '');
assertEq('Oktober 2026 ada 5 Jumat', jumatOkt.length, 5);
assertEq('Jumat pertama 2 Okt', jumatOkt[0], '2026-10-02');
assertEq('Jumat terakhir 30 Okt (bukan 31)', jumatOkt[4], '2026-10-30');
assert('31 Okt bukan hari gaji Jumat', jumatOkt.indexOf('2026-10-31') < 0);

console.log('\n── Dasar BPJS (bukan × jumlah Jumat) ──');
assertEq('harian 150rb × 25', siklusBpjsUpahSebulan('harian', 150_000, 6), 3_750_000);
assertEq('mingguan 1,5jt /6 × 25', siklusBpjsUpahSebulan('mingguan', 1_500_000, 6), 6_250_000);
assertEq('5 hari/mg harian × 21', siklusBpjsUpahSebulan('harian', 150_000, 5), 3_150_000);
assert('BPJS mingguan ≠ 5 Jumat', siklusBpjsUpahSebulan('mingguan', 1_500_000, 6) !== 1_500_000 * 5);
assert('BPJS mingguan ≠ 4 Jumat', siklusBpjsUpahSebulan('mingguan', 1_500_000, 6) !== 1_500_000 * 4);

console.log('\n── Dummy mingguan Oktober (Jumat, 1,5jt) ──');
const kMg = {
  nik: 'DUMMY-MG',
  nama: 'Dummy Mingguan (fiktif)',
  gapok: 1_500_000,
  siklus_gaji: 'mingguan',
  hari_gaji: 5,
  ptkp: 'TK0',
  masuk: '2024-01-01',
  tunjangan: [],
  potongan: [],
  natura: [],
  bpjs_aktif: bpjsOn,
};
const paysMg = siklusBuildPays(kMg, P_OKT, 6, {}, {});
assertEq('5 transfer Oktober', paysMg.length, 5);
assertEq('upah tiap Jumat', paysMg[0].upah, 1_500_000);
const upahMg = paysMg.reduce((s, p) => s + p.upah, 0);
assertEq('PPh bruto upah = 5 × 1,5jt', upahMg, 7_500_000);

const basisBpjsMg = siklusBpjsUpahSebulan('mingguan', 1_500_000, 6);
const bpjsMg = calcBPJS(kMg, basisBpjsMg, 0);
assertEq('BPJS dari 6,25jt bukan 7,5jt', bpjsMg.kes_kar, Math.round(6_250_000 * 0.01));
const grossMg = upahMg + bpjsMg.kes_prs + bpjsMg.jkk_prs + bpjsMg.jkm_prs;
const pphMg = hitungPPhBln(grossMg, 'TK0');
const potKarMg = bpjsMg.kes_kar + bpjsMg.jht_kar + bpjsMg.jp_kar + pphMg;
const pecahMg = pecahPotonganCadangan(paysMg, potKarMg);
assertEq('sisa potongan mingguan 0', pecahMg.sisaPotongan, 0);
pecahMg.items.forEach(function (it, i) {
  assert('Jumat ' + it.tgl + ' tidak minus', it.dibayar >= 0);
  assert('Jumat ' + it.tgl + ' potongan ≤ upah', it.potongan <= it.upah);
  if (i < pecahMg.items.length - 1) {
    assert('cadangan merata sebelum true-up', it.potongan === pecahMg.items[0].potongan);
  }
});
const jumlahPotMg = pecahMg.items.reduce((s, it) => s + it.potongan, 0);
assertEq('jumlah cadangan = PPh+BPJS kar', jumlahPotMg, potKarMg);

console.log('  upah sebulan', upahMg, '| dasar BPJS', basisBpjsMg, '| PPh TER', pphMg, '| pot kar', potKarMg);
console.log('  transfer:', pecahMg.items.map((it) => it.tgl + '=' + it.dibayar).join(', '));

console.log('\n── Dummy harian Oktober (150rb, opsi 1) ──');
const kHr = {
  nik: 'DUMMY-HR',
  nama: 'Dummy Harian (fiktif)',
  gapok: 150_000,
  siklus_gaji: 'harian',
  ptkp: 'TK0',
  masuk: '2024-01-01',
  tunjangan: [],
  potongan: [],
  natura: [],
  bpjs_aktif: bpjsOn,
};
const paysHr = siklusBuildPays(kHr, P_OKT, 6, {}, {});
assert('hari kerja Oktober > 20', paysHr.length > 20);
assertEq('31 Okt Sabtu 6-hari = hari kerja', paysHr[paysHr.length - 1].tgl, '2026-10-31');
const upahHr = paysHr.reduce((s, p) => s + p.upah, 0);
assertEq('upah = 150rb × hari', upahHr, 150_000 * paysHr.length);
const basisBpjsHr = siklusBpjsUpahSebulan('harian', 150_000, 6);
assertEq('BPJS harian ×25', basisBpjsHr, 3_750_000);
const bpjsHr = calcBPJS(kHr, basisBpjsHr, 0);
const grossHr = upahHr + bpjsHr.kes_prs + bpjsHr.jkk_prs + bpjsHr.jkm_prs;
const pphHr = hitungPPhBln(grossHr, 'TK0');
const potKarHr = bpjsHr.kes_kar + bpjsHr.jht_kar + bpjsHr.jp_kar + pphHr;
const pecahHr = pecahPotonganCadangan(paysHr, potKarHr);
assertEq('sisa potongan harian 0', pecahHr.sisaPotongan, 0);
pecahHr.items.forEach(function (it) {
  assert('harian ' + it.tgl + ' tidak minus', it.dibayar >= 0);
});
const cadangan = pecahHr.items[0].potongan;
assert('cadangan harian > 0', cadangan > 0);
assert('cadangan < upah sehari', cadangan < 150_000);
console.log('  hari kerja', paysHr.length, '| upah', upahHr, '| dasar BPJS', basisBpjsHr);
console.log('  cadangan/hari', cadangan, '| PPh TER', pphHr, '| hari terakhir dibayar', pecahHr.items[pecahHr.items.length - 1].dibayar);

console.log('\n── Harian: potongan > 1 hari upah tidak minus ──');
const pecahKetat = pecahPotonganCadangan(
  [{ tgl: '2026-10-01', upah: 150_000 }, { tgl: '2026-10-02', upah: 150_000 }],
  400_000
);
assertEq('hari 1 dibayar 0', pecahKetat.items[0].dibayar, 0);
assertEq('hari 2 dibayar 0', pecahKetat.items[1].dibayar, 0);
assertEq('sisa jadi utang 100rb', pecahKetat.sisaPotongan, 100_000);

console.log('\n── Dummy mingguan resign 14 Oktober ──');
const kRes = Object.assign({}, kMg, {
  nik: 'DUMMY-MG-RES',
  tgl_berhenti: '2026-10-14',
  phk: { alasan: 'resign_30hr' },
});
const paysRes = siklusBuildPays(kRes, P_OKT, 6, {}, {});
assert('resign: ada Jumat 2 & 9', paysRes.some((p) => p.tgl === '2026-10-02') && paysRes.some((p) => p.tgl === '2026-10-09'));
assert('resign: tidak ada Jumat 16/23/30', !paysRes.some((p) => p.tgl === '2026-10-16'));
assert('resign: ada bayar parsial sebelum 14', paysRes.some((p) => p.parsial));
const part = paysRes.find((p) => p.parsial);
assert('parsial tgl < 14 Okt', part.tgl < '2026-10-14');
assert('parsial upah < 1,5jt', part.upah > 0 && part.upah < 1_500_000);
const pecahRes = pecahPotonganCadangan(paysRes, 400_000);
pecahRes.items.forEach(function (it) {
  assert('resign ' + it.tgl + ' tidak minus', it.dibayar >= 0);
});
console.log('  transfer resign:', paysRes.map((p) => p.tgl + (p.parsial ? '(parsial)' : '') + '=' + p.upah).join(', '));

console.log('\n── hitungGaji Oktober (setelah apply) ──');
{
  const g = px.hitungGaji(kMg, 'Oktober 2026', { skipResolve: true });
  assertEq('hitungGaji upah 5 Jumat', g.gapokEff, 7_500_000);
  assertEq('hitungGaji dasar BPJS 6,25jt', g.gapokBpjs, 6_250_000);
  assertEq('hitungGaji kes kar dari 6,25jt', g.bpjs.kes_kar, bpjsMg.kes_kar);
  assert('jadwal 5 transfer', g.jadwalBayar && g.jadwalBayar.items.length === 5);
  assertEq('jadwal tidak minus', g.jadwalBayar.sisaPotongan, 0);
  assert('bukan masa pajak terakhir', g.isMasaPajakTerakhir !== true);
}
{
  const g = px.hitungGaji(kHr, 'Oktober 2026', { skipResolve: true });
  assertEq('hitungGaji harian 27 hari', g.gapokEff, 4_050_000);
  assertEq('hitungGaji BPJS harian ×25', g.gapokBpjs, 3_750_000);
  assert('jadwal harian = jumlah hari', g.jadwalBayar && g.jadwalBayar.items.length === 27);
  g.jadwalBayar.items.forEach(function (it) {
    assert('THP harian tidak minus ' + it.tgl, it.dibayar >= 0);
  });
}
{
  const g = px.hitungGaji(kRes, 'Oktober 2026', { skipResolve: true });
  assertEq('resign = masa pajak terakhir', g.isMasaPajakTerakhir, true);
  assert('resign tidak bayar Jumat 16', g.jadwalBayar.items.every((it) => it.tgl < '2026-10-16'));
  g.jadwalBayar.items.forEach(function (it) {
    assert('resign transfer tidak minus ' + it.tgl, it.dibayar >= 0);
  });
}

console.log('\nDummy harian & mingguan lulus.');
