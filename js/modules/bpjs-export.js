/* SiGaji — file upah bulanan untuk SIPP (BPJS TK) dan e-Dabu (BPJS Kesehatan). */
var BPJS_TK_KEYS = ['jht-prs', 'jht-kar', 'jp-prs', 'jp-kar', 'jkk-prs', 'jkm-prs'];
var BPJS_KES_KEYS = ['kes-prs', 'kes-kar'];

function bpjsDigits(s) {
  return String(s || '').replace(/\D/g, '');
}

function bpjsUpahDariHitung(g) {
  var gapok = g && g.gapokBpjs != null ? Number(g.gapokBpjs) : 0;
  var tunj = g && g.tBPJS != null ? Number(g.tBPJS) : 0;
  if (!isFinite(gapok)) gapok = 0;
  if (!isFinite(tunj)) tunj = 0;
  return Math.round(gapok + tunj);
}

function bpjsAdaKomponen(k, keys, aktifFn) {
  var i;
  for (i = 0; i < keys.length; i++) {
    if (aktifFn(k, keys[i])) return true;
  }
  return false;
}

function bpjsMasaDariPeriode(p) {
  var ref = (p && (p.bayar || p.end || p.start)) || '';
  var d = new Date(String(ref).trim() + 'T12:00:00');
  if (isNaN(d.getTime())) return { bln: '', thn: '' };
  return { bln: d.getMonth() + 1, thn: d.getFullYear() };
}

/**
 * @param {Array} list
 * @param {{ aktif: function, hitung: function, masa: {bln: number|string, thn: number|string} }} opts
 */
function bpjsSusunBaris(list, opts) {
  opts = opts || {};
  var aktif = opts.aktif;
  var hitung = opts.hitung;
  var masa = opts.masa || { bln: '', thn: '' };
  var tk = [];
  var kes = [];
  var tanpaKpj = [];
  var tanpaKartu = [];
  (list || []).forEach(function (k) {
    if (!k || !k.nik) return;
    var g = hitung(k);
    var upah = bpjsUpahDariHitung(g);
    var nama = String(k.nama || '').trim();
    var nik = bpjsDigits(k.ktp);
    if (bpjsAdaKomponen(k, BPJS_TK_KEYS, aktif)) {
      var kpj = bpjsDigits(k.bpjs_kpj);
      tk.push({
        nik: nik,
        kpj: kpj,
        nama: nama,
        upah: upah,
        bln: masa.bln,
        thn: masa.thn,
      });
      if (!kpj) tanpaKpj.push(nama || k.nik);
    }
    if (bpjsAdaKomponen(k, BPJS_KES_KEYS, aktif)) {
      var kartu = bpjsDigits(k.bpjs_kes_kartu);
      kes.push({
        no: kes.length + 1,
        kartu: kartu,
        nik: nik,
        nama: nama,
        gaji: upah,
      });
      if (!kartu) tanpaKartu.push(nama || k.nik);
    }
  });
  return { tk: tk, kes: kes, tanpaKpj: tanpaKpj, tanpaKartu: tanpaKartu };
}

function bpjsEnsureXlsx(fn) {
  if (typeof XLSX !== 'undefined') {
    fn();
    return;
  }
  if (typeof ebupotEnsureXlsx === 'function') {
    ebupotEnsureXlsx(fn);
    return;
  }
  toast('Gagal memuat library Excel. Cek koneksi internet.');
}

function bpjsForceTextCols(ws, cols, fromRow, rowCount) {
  var r;
  var i;
  for (r = fromRow; r < rowCount; r++) {
    for (i = 0; i < cols.length; i++) {
      var addr = XLSX.utils.encode_cell({ c: cols[i], r: r });
      var cell = ws[addr];
      if (!cell) continue;
      cell.t = 's';
      cell.v = cell.v == null ? '' : String(cell.v);
      cell.z = '@';
    }
  }
}

function bpjsWriteBook(filename, sheets) {
  var wb = XLSX.utils.book_new();
  sheets.forEach(function (sh) {
    var ws = XLSX.utils.aoa_to_sheet(sh.rows);
    if (sh.textCols) bpjsForceTextCols(ws, sh.textCols, sh.textFrom || 1, sh.rows.length);
    XLSX.utils.book_append_sheet(wb, ws, sh.name);
  });
  XLSX.writeFile(wb, filename);
}

function bpjsNamaFile(prefix, periode) {
  var nama = String((periode && periode.nama) || 'periode').replace(/[^\w\d]+/g, '_');
  return prefix + '_' + nama + '.xlsx';
}

function bpjsKumpulkan() {
  var p = typeof PA === 'function' ? PA() : null;
  if (!p || !p.nama) return { ok: false, error: 'Periode gaji aktif tidak ditemukan' };
  var list = typeof karyawanListPeriode === 'function' ? karyawanListPeriode(p) : [];
  if (!list.length) return { ok: false, error: 'Tidak ada karyawan di periode ini' };
  var built = null;
  var run = function () {
    built = bpjsSusunBaris(list, {
      masa: bpjsMasaDariPeriode(p),
      aktif: function (k, key) {
        return typeof bpjsKompAktif === 'function' ? bpjsKompAktif(k, key) : false;
      },
      hitung: function (k) {
        return hitungGaji(k, p.nama);
      },
    });
  };
  if (typeof sigajiWithHitungCache === 'function') sigajiWithHitungCache(run);
  else run();
  return { ok: true, periode: p, built: built, perusahaan: typeof perusahaan !== 'undefined' ? perusahaan : {} };
}

function bpjsToastKosong(label, missing, missingLabel) {
  var msg = label + ': ' + missing.length + ' karyawan tanpa ' + missingLabel + '.';
  if (missing.length && missing.length <= 4) msg += ' ' + missing.join(', ') + '.';
  msg += ' Isi di profil karyawan, lalu unduh ulang.';
  return msg;
}

function exportBpjsTkUpah() {
  var pack = bpjsKumpulkan();
  if (!pack.ok) {
    toast(pack.error);
    return;
  }
  if (!pack.built.tk.length) {
    toast('Tidak ada karyawan dengan BPJS Ketenagakerjaan aktif di periode ini');
    return;
  }
  bpjsEnsureXlsx(function () {
    var rows = [['NIK', 'KPJ', 'NAMA_LENGKAP', 'UPAH', 'BLN', 'THN']];
    pack.built.tk.forEach(function (r) {
      rows.push([r.nik, r.kpj, r.nama, r.upah, r.bln, r.thn]);
    });
    var petunjuk = [
      ['Unggah di SIPP → Upload Upah.'],
      ['Upah = gaji pokok yang dipakai BPJS + tunjangan tetap. Bukan nominal iuran, bukan THR, bukan lembur.'],
      ['SIPP yang menghitung iuran JHT, JP, JKK, dan JKM, termasuk batas JP.'],
      ['Jika portal menolak karena kolom template resmi berbeda, salin kolom KPJ, nama, dan UPAH ke template yang diunduh dari SIPP. Jangan ketik ulang.'],
      ['Kode tenaga kerja dan tanggal lahir, bila diminta template SIPP, diisi dari data SIPP — SiGaji tidak menyimpannya.'],
    ];
    bpjsWriteBook(bpjsNamaFile('BPJS_TK_Upah', pack.periode), [
      { name: 'Upah', rows: rows, textCols: [0, 1], textFrom: 1 },
      { name: 'Petunjuk', rows: petunjuk },
    ]);
    var msg = 'File upah BPJS TK diunduh (' + pack.built.tk.length + ' orang).';
    if (pack.built.tanpaKpj.length) msg += ' ' + bpjsToastKosong('Perhatian', pack.built.tanpaKpj, 'nomor KPJ');
    toast(msg);
  });
}

function exportBpjsKesUpah() {
  var pack = bpjsKumpulkan();
  if (!pack.ok) {
    toast(pack.error);
    return;
  }
  if (!pack.built.kes.length) {
    toast('Tidak ada karyawan dengan BPJS Kesehatan aktif di periode ini');
    return;
  }
  var prs = pack.perusahaan || {};
  bpjsEnsureXlsx(function () {
    var rows = [
      ['Nama Badan Usaha', prs.nama || ''],
      ['Kode Virtual Account', prs.bpjs_kes_va || ''],
      [],
      ['No', 'No JKN-KIS', 'NIK', 'Nama', 'Gaji'],
    ];
    pack.built.kes.forEach(function (r) {
      rows.push([r.no, r.kartu, r.nik, r.nama, r.gaji]);
    });
    var petunjuk = [
      ['Unggah di e-Dabu → Peserta → Upload Data → jenis mutasi Gaji. Sheet data bernama GAJI.'],
      ['Gaji = dasar upah BPJS (gaji pokok + tunjangan tetap). e-Dabu yang memotong batas iuran Kesehatan.'],
      ['Isi Kode Virtual Account di Master → Profil Perusahaan bila masih kosong.'],
      ['Jika e-Dabu menolak karena formulir resmi berubah, salin kolom No JKN-KIS dan Gaji ke formulir yang diunduh dari menu Referensi. Format formulir resmi jangan diubah.'],
    ];
    bpjsWriteBook(bpjsNamaFile('BPJS_Kes_Gaji', pack.periode), [
      { name: 'GAJI', rows: rows, textCols: [1, 2], textFrom: 4 },
      { name: 'Petunjuk', rows: petunjuk },
    ]);
    var msg = 'File gaji BPJS Kesehatan diunduh (' + pack.built.kes.length + ' orang).';
    if (pack.built.tanpaKartu.length) msg += ' ' + bpjsToastKosong('Perhatian', pack.built.tanpaKartu, 'nomor kartu');
    toast(msg);
  });
}
