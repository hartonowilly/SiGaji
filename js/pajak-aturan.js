/**
 * Buku aturan pajak & BPJS menurut tanggal bayar periode.
 * Jangan mengubah angka buku yang sudah ada. Aturan baru = buku baru
 * (sigajiDaftarAturanPajak) dengan berlakuMulai yang lebih baru.
 * Periode terkunci menyimpan hasil hitung (lihat sigajiBekukanHasilPeriode).
 */
var SIGAJI_ATURAN_PAJAK = [];

var SIGAJI_PROGRESIF_168 = [
  { sampai: 60e6, rate: 0.05 },
  { sampai: 250e6, rate: 0.15 },
  { sampai: 500e6, rate: 0.25 },
  { sampai: Infinity, rate: 0.3 },
];
var SIGAJI_PESANGON_68 = [
  { cap: 50e6, rate: 0 },
  { cap: 100e6, rate: 0.05 },
  { cap: 500e6, rate: 0.15 },
  { cap: Infinity, rate: 0.25 },
];

function sigajiCloneBarisAngka(tbl) {
  return (tbl || []).map(function (r) {
    return [r[0], r[1]];
  });
}
function sigajiCloneObj(o) {
  if (o == null) return o;
  var out = {};
  Object.keys(o).forEach(function (k) {
    out[k] = o[k];
  });
  return out;
}

function sigajiDaftarAturanPajak(buku) {
  if (!buku || !buku.id || !buku.berlakuMulai) return null;
  var copy = {
    id: String(buku.id),
    berlakuMulai: String(buku.berlakuMulai).slice(0, 10),
    ptkp: sigajiCloneObj(buku.ptkp || (typeof DEFAULT_PTKP !== 'undefined' ? DEFAULT_PTKP : {})),
    ter: {
      A: sigajiCloneBarisAngka(buku.ter && buku.ter.A),
      B: sigajiCloneBarisAngka(buku.ter && buku.ter.B),
      C: sigajiCloneBarisAngka(buku.ter && buku.ter.C),
    },
    progresif: {
      bjRate: buku.progresif && buku.progresif.bjRate != null ? buku.progresif.bjRate : 0.05,
      bjCap: buku.progresif && buku.progresif.bjCap != null ? buku.progresif.bjCap : 6e6,
      lapis: (buku.progresif && buku.progresif.lapis ? buku.progresif.lapis : SIGAJI_PROGRESIF_168).map(
        function (l) {
          return { sampai: l.sampai, rate: l.rate };
        }
      ),
    },
    pesangon: (buku.pesangon || SIGAJI_PESANGON_68).map(function (l) {
      return { cap: l.cap, rate: l.rate };
    }),
    bpjs: sigajiCloneObj(buku.bpjs || (typeof BPJS_DEF !== 'undefined' ? BPJS_DEF : {})),
  };
  Object.keys(copy.bpjs).forEach(function (k) {
    copy.bpjs[k] = sigajiCloneObj(copy.bpjs[k]);
  });
  SIGAJI_ATURAN_PAJAK = SIGAJI_ATURAN_PAJAK.filter(function (b) {
    return b.id !== copy.id;
  });
  SIGAJI_ATURAN_PAJAK.push(copy);
  SIGAJI_ATURAN_PAJAK.sort(function (a, b) {
    return a.berlakuMulai < b.berlakuMulai ? -1 : a.berlakuMulai > b.berlakuMulai ? 1 : 0;
  });
  return copy;
}

sigajiDaftarAturanPajak({
  id: 'pmk-168-2024',
  berlakuMulai: '2024-01-01',
  ptkp: typeof DEFAULT_PTKP !== 'undefined' ? DEFAULT_PTKP : {},
  ter: {
    A: typeof TER_A !== 'undefined' ? TER_A : [],
    B: typeof TER_B !== 'undefined' ? TER_B : [],
    C: typeof TER_C !== 'undefined' ? TER_C : [],
  },
  progresif: { bjRate: 0.05, bjCap: 6e6, lapis: SIGAJI_PROGRESIF_168 },
  pesangon: SIGAJI_PESANGON_68,
  bpjs: typeof BPJS_DEF !== 'undefined' ? BPJS_DEF : {},
});

function sigajiTanggalHariIni() {
  var d = new Date();
  return (
    d.getFullYear() +
    '-' +
    String(d.getMonth() + 1).padStart(2, '0') +
    '-' +
    String(d.getDate()).padStart(2, '0')
  );
}

/** Tanggal yang memilih buku aturan: tanggal bayar, lalu akhir, lalu awal periode. */
function sigajiTanggalAcuanPeriode(p) {
  if (!p) return '';
  return String(p.bayar || p.end || p.start || '').slice(0, 10);
}

function aturanPajakUntukTanggal(tanggal) {
  var t = String(tanggal || '').slice(0, 10);
  if (!t) t = sigajiTanggalHariIni();
  var pick = null;
  SIGAJI_ATURAN_PAJAK.forEach(function (b) {
    if (b.berlakuMulai && b.berlakuMulai <= t) pick = b;
  });
  return pick || SIGAJI_ATURAN_PAJAK[0] || null;
}

function bpjsKomponenDef(key, tanggal) {
  var buku = aturanPajakUntukTanggal(tanggal);
  var def = buku && buku.bpjs && buku.bpjs[key];
  if (def) return def;
  return typeof BPJS_DEF !== 'undefined' ? BPJS_DEF[key] : { pct: 0, basis: null };
}

/**
 * Override Master (TER / nilai PTKP) yang berlaku pada tanggal itu.
 * Tanpa riwayat, isian Master sekarang dipakai untuk semua tanggal (data lama).
 * Setelah ada pergantian, tanggal sebelum aturan_override_berlaku memakai salinan lama.
 */
function aturanOverrideUntukTanggal(tanggal) {
  var prs = typeof perusahaan !== 'undefined' && perusahaan ? perusahaan : {};
  var sekarang = {
    ter_custom: prs.ter_custom || null,
    ptkp_nilai: prs.ptkp_nilai || null,
  };
  var batas = prs.aturan_override_berlaku ? String(prs.aturan_override_berlaku).slice(0, 10) : '';
  if (!batas) return sekarang;
  var t = String(tanggal || '').slice(0, 10) || sigajiTanggalHariIni();
  if (t >= batas) return sekarang;
  var hist = Array.isArray(prs.aturan_override_riwayat) ? prs.aturan_override_riwayat : [];
  var pick = null;
  hist.forEach(function (h) {
    if (!h || !h.berlakuMulai) return;
    if (h.berlakuMulai <= t && (!pick || h.berlakuMulai >= pick.berlakuMulai)) pick = h;
  });
  if (!pick) return { ter_custom: null, ptkp_nilai: null };
  return { ter_custom: pick.ter_custom || null, ptkp_nilai: pick.ptkp_nilai || null };
}

/** Salin override yang sedang tersimpan, lalu tandai tanggal mulai override baru. Sekali per pergantian. */
function sigajiKunciEraOverrideLama() {
  if (typeof perusahaan === 'undefined' || !perusahaan) return '';
  if (perusahaan.aturan_override_berlaku) return String(perusahaan.aturan_override_berlaku).slice(0, 10);
  var hist = Array.isArray(perusahaan.aturan_override_riwayat) ? perusahaan.aturan_override_riwayat.slice() : [];
  var terLama = {};
  var ptkpLama = {};
  try {
    terLama = JSON.parse(JSON.stringify(perusahaan.ter_custom || {}));
  } catch (e1) {
    terLama = {};
  }
  try {
    ptkpLama = JSON.parse(JSON.stringify(perusahaan.ptkp_nilai || {}));
  } catch (e2) {
    ptkpLama = {};
  }
  hist.push({ berlakuMulai: '1970-01-01', ter_custom: terLama, ptkp_nilai: ptkpLama });
  perusahaan.aturan_override_riwayat = hist;
  var p = typeof PA === 'function' ? PA() : null;
  var mulai = '';
  if (p && !p.snapshot_locked) mulai = sigajiTanggalAcuanPeriode(p);
  if (!mulai) mulai = sigajiTanggalHariIni();
  perusahaan.aturan_override_berlaku = mulai;
  return mulai;
}

function sigajiPesanBerlakuOverride() {
  var mulai =
    typeof perusahaan !== 'undefined' && perusahaan && perusahaan.aturan_override_berlaku
      ? String(perusahaan.aturan_override_berlaku).slice(0, 10)
      : '';
  if (!mulai) return '';
  return ' Berlaku untuk tanggal bayar ' + mulai + ' dan setelahnya. Periode sebelumnya tetap memakai tarif lama.';
}
