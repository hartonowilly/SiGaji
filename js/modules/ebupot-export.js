/* SiGaji — export data e-Bupot bulanan (acuan Coretax / template DJP) */
function ebupotEnsureXlsx(fn) {
  if (typeof XLSX !== 'undefined') {
    fn();
    return;
  }
  var s = document.createElement('script');
  s.src = 'https://cdn.sheetjs.com/xlsx-0.20.2/package/dist/xlsx.full.min.js';
  s.onload = function () {
    fn();
  };
  s.onerror = function () {
    toast('Gagal memuat library Excel. Cek koneksi internet.');
  };
  document.head.appendChild(s);
}

function ebupotDigitsOnly(s) {
  return String(s || '').replace(/\D/g, '');
}

/** NPWP 16 digit (tanpa titik/strip) — validasi minimal panjang */
function ebupotNpwp16(raw) {
  var d = ebupotDigitsOnly(raw);
  if (d.length === 16) return d;
  if (d.length === 15) return d + '0';
  return d;
}

function ebupotNik16(raw) {
  var d = ebupotDigitsOnly(raw);
  if (d.length >= 16) return d.substring(0, 16);
  return d;
}

function ebupotPtkpSlash(ptkp) {
  if (!ptkp) return '';
  var m = String(ptkp).match(/^([A-Z]+)(\d+)$/i);
  return m ? m[1].toUpperCase() + '/' + m[2] : String(ptkp);
}

function ebupotMasaFromPeriode(p) {
  var ref = (p && (p.bayar || p.end || p.start)) || '';
  var d = new Date(String(ref).trim() + 'T12:00:00');
  if (isNaN(d.getTime())) return { yyyymm: '', label: '', tahun: '', bulan: '' };
  var y = d.getFullYear();
  var m = String(d.getMonth() + 1).padStart(2, '0');
  var bln = [
    '',
    'Januari',
    'Februari',
    'Maret',
    'April',
    'Mei',
    'Juni',
    'Juli',
    'Agustus',
    'September',
    'Oktober',
    'November',
    'Desember',
  ];
  return {
    yyyymm: String(y) + m,
    label: bln[parseInt(m, 10)] + ' ' + y,
    tahun: String(y),
    bulan: m,
  };
}

function ebupotKodeObjek(k) {
  var tipe =
    typeof sigajiNormalizeKarTipe === 'function'
      ? sigajiNormalizeKarTipe(k.tipe_kerja, k)
      : 'tetap';
  return tipe === 'tidak_tetap' ? '21-100-02' : '21-100-01';
}

function ebupotKodeObjekLbl(kode) {
  if (kode === '21-100-02') return 'Pegawai tidak tetap';
  return 'Pegawai tetap';
}

/** NITKU / ID TKU 22 digit = NPWP 16 digit + 6 digit cabang */
function ebupotIdTku22(npwpRaw, nitkuSuffix) {
  var np = ebupotNpwp16(npwpRaw);
  var suf = ebupotDigitsOnly(nitkuSuffix != null ? nitkuSuffix : '0');
  while (suf.length < 6) suf = '0' + suf;
  if (suf.length > 6) suf = suf.slice(-6);
  return np + suf;
}

function ebupotCounterpartTin(k) {
  var npwp = ebupotNpwp16(k && k.npwp);
  if (npwp && npwp.length >= 15) return npwp;
  return ebupotNik16(k && k.nik);
}

function ebupotWithholdingDateIso(periode) {
  var ref = (periode && (periode.bayar || periode.end || periode.start)) || '';
  var d = new Date(String(ref).trim() + 'T12:00:00');
  if (isNaN(d.getTime())) d = new Date();
  return d.toISOString().split('T')[0];
}

function ebupotXmlEscape(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function ebupotXmlEl(name, value, opts) {
  opts = opts || {};
  if (opts.nil) return '\t\t<' + name + ' xsi:nil="true"/>';
  return '\t\t<' + name + '>' + ebupotXmlEscape(value) + '</' + name + '>';
}

function ebupotDownloadText(filename, text, mime) {
  var blob = new Blob([text], { type: mime || 'application/xml;charset=utf-8' });
  var a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  setTimeout(function () {
    URL.revokeObjectURL(a.href);
  }, 4000);
}

function ebupotKarTipe(k) {
  return typeof sigajiNormalizeKarTipe === 'function'
    ? sigajiNormalizeKarTipe(k.tipe_kerja, k)
    : 'tetap';
}

function ebupotBuildRows(periode) {
  periode = periode || (typeof PA === 'function' ? PA() : null);
  if (!periode || !periode.nama) {
    return { ok: false, error: 'Periode gaji aktif tidak ditemukan' };
  }
  var list =
    typeof karyawanListPeriode === 'function'
      ? karyawanListPeriode(periode)
      : (karyawan || []).filter(function (k) {
          return k && k.aktif !== false;
        });
  if (!list.length) return { ok: false, error: 'Tidak ada karyawan di periode ini' };

  var prs = perusahaan || {};
  var npwpPemotong = ebupotNpwp16(prs.npwp);
  var nitku = String(prs.nitku || '').trim();
  var masa = ebupotMasaFromPeriode(periode);
  var warnings = [];
  if (!npwpPemotong || npwpPemotong.length < 15) {
    warnings.push('NPWP perusahaan belum lengkap (Master → Profil Perusahaan).');
  }
  if (!nitku) warnings.push('NITKU belum diisi — wajib untuk impor Coretax.');

  var rows = [];
  var totalBruto = 0;
  var totalPph = 0;

  list.forEach(function (k, idx) {
    if (!k || !k.nik) return;
    var g = hitungGaji(k, periode.nama);
    var bruto = Math.round(g.grossPPh || 0);
    var pph = Math.round(g.pph || 0);
    totalBruto += bruto;
    totalPph += pph;
    var terI =
      typeof terInfoForExport === 'function'
        ? terInfoForExport(k.ptkp, g.grossPPh)
        : { lampiran: '', ratePct: 0 };
    var npwpKar = ebupotNpwp16(k.npwp);
    var nikKar = ebupotNik16(k.nik);
    if (!npwpKar && nikKar.length < 15) {
      warnings.push('NIK/NPWP kurang lengkap: ' + (k.nama || k.nik));
    }
    var kode = ebupotKodeObjek(k);
    var tipeKerja = ebupotKarTipe(k);
    var counterpartTin = ebupotCounterpartTin(k);
    var idTkuPemotong = ebupotIdTku22(npwpPemotong, nitku);
    rows.push({
      no: idx + 1,
      masaYyyymm: masa.yyyymm,
      masaLabel: masa.label,
      masaBulan: parseInt(masa.bulan, 10) || '',
      masaTahun: masa.tahun,
      npwpPemotong: npwpPemotong,
      nitkuPemotong: nitku,
      idTkuPemotong: idTkuPemotong,
      idTkuPenerima: ebupotIdTku22(counterpartTin, '000000'),
      namaPemotong: prs.nama || '',
      npwpPenerima: npwpKar,
      nikPenerima: nikKar,
      counterpartTin: counterpartTin,
      namaPenerima: k.nama || '',
      jabatan: (k.jabatan || 'Staff').trim() || 'Staff',
      statusPegawai: 'Resident',
      ptkp: ebupotPtkpSlash(k.ptkp),
      kodeObjek: kode,
      kodeObjekLbl: ebupotKodeObjekLbl(kode),
      tipeKerja: tipeKerja,
      penghasilanBruto: bruto,
      pphDipotong: pph,
      tarifTerPct: terI.ratePct || 0,
      lampiranTer: terI.lampiran || '',
      fasilitas: 'N/A',
      thrBruto: Math.round(g.thrBruto || 0),
      periodeGaji: periode.nama,
      tglBayar: periode.bayar || '',
      withholdingDate: ebupotWithholdingDateIso(periode),
      metode: g.reconciliation ? 'Rekonsiliasi' : 'TER PMK 168',
    });
  });

  return {
    ok: true,
    periode: periode,
    masa: masa,
    rows: rows,
    totalBruto: totalBruto,
    totalPph: totalPph,
    warnings: warnings,
    npwpPemotong: npwpPemotong,
    nitku: nitku,
  };
}

function ebupotDataHeaders() {
  return [
    'No',
    'Masa Pajak (YYYYMM)',
    'Masa Pajak (label)',
    'NPWP Pemotong (16 digit)',
    'NITKU Pemotong',
    'Nama Pemotong',
    'NPWP Penerima (16 digit)',
    'NIK Penerima',
    'Nama Penerima Penghasilan',
    'Status PTKP',
    'Kode Objek Pajak',
    'Keterangan Objek',
    'Penghasilan Bruto',
    'PPh 21 Dipotong',
    'Tarif TER (%)',
    'Lampiran TER',
    'THR Bruto (periode)',
    'Metode PPh',
    'Periode Gaji SiGaji',
    'Tanggal Bayar Gaji',
  ];
}

function ebupotRowToArray(r) {
  return [
    r.no,
    r.masaYyyymm,
    r.masaLabel,
    r.npwpPemotong,
    r.nitkuPemotong,
    r.namaPemotong,
    r.npwpPenerima,
    r.nikPenerima,
    r.namaPenerima,
    r.ptkp,
    r.kodeObjek,
    r.kodeObjekLbl,
    r.penghasilanBruto,
    r.pphDipotong,
    r.tarifTerPct,
    r.lampiranTer,
    r.thrBruto,
    r.metode,
    r.periodeGaji,
    r.tglBayar,
  ];
}

function exportExcelEbupotBulanan() {
  var built = ebupotBuildRows();
  if (!built.ok) {
    toast(built.error || 'Gagal menyiapkan data');
    return;
  }
  if (built.warnings.length) toast('Perhatian: ' + built.warnings[0]);
  ebupotEnsureXlsx(function () {
    try {
      var wb = XLSX.utils.book_new();
      var panduan = [
        ['PANDUAN — Export e-Bupot bulanan SiGaji → Coretax'],
        [],
        ['1. File ini berisi data per karyawan dari periode gaji aktif di SiGaji.'],
        ['2. Untuk upload Coretax tanpa copy-paste: gunakan tombol "Unduh XML Coretax" di SiGaji.'],
        ['3. XML mengikuti schema resmi DJP (BPMP pegawai tetap / BP21 tidak tetap).'],
        ['4. File Excel ini opsional — acuan audit atau salin manual ke template DJP jika perlu.'],
        ['5. Upload XML di Coretax → e-Bupot → Impor Data.'],
        [],
        ['Periode SiGaji: ' + built.periode.nama],
        ['Masa pajak (acuan): ' + built.masa.label + ' (' + built.masa.yyyymm + ')'],
        ['NPWP pemotong: ' + (built.npwpPemotong || '(kosong)')],
        ['NITKU pemotong: ' + (built.nitku || '(kosong — isi di Master Perusahaan)')],
        ['Total bruto: ' + built.totalBruto],
        ['Total PPh 21: ' + built.totalPph],
        ['Dicetak: ' + new Date().toISOString().split('T')[0]],
        [],
        ['Kode objek default SiGaji:'],
        ['  21-100-01 = Pegawai tetap'],
        ['  21-100-02 = Pegawai tidak tetap'],
        ['Verifikasi kode di template DJP terbaru sebelum upload.'],
      ];
      var wsP = XLSX.utils.aoa_to_sheet(panduan);
      wsP['!cols'] = [{ wch: 90 }];
      XLSX.utils.book_append_sheet(wb, wsP, 'PANDUAN');

      var dataRows = [ebupotDataHeaders()];
      built.rows.forEach(function (r) {
        dataRows.push(ebupotRowToArray(r));
      });
      var wsD = XLSX.utils.aoa_to_sheet(dataRows);
      wsD['!cols'] = [
        { wch: 4 },
        { wch: 14 },
        { wch: 16 },
        { wch: 18 },
        { wch: 12 },
        { wch: 28 },
        { wch: 18 },
        { wch: 18 },
        { wch: 28 },
        { wch: 8 },
        { wch: 12 },
        { wch: 18 },
        { wch: 16 },
        { wch: 14 },
        { wch: 10 },
        { wch: 12 },
        { wch: 14 },
        { wch: 14 },
        { wch: 18 },
        { wch: 12 },
      ];
      for (var c = 12; c <= 14; c++) {
        if (typeof xlsxSetNumFmtRange === 'function') {
          xlsxSetNumFmtRange(wsD, c, 1, built.rows.length, '#,##0');
        }
      }
      XLSX.utils.book_append_sheet(wb, wsD, 'DATA');

      var ring = [
        ['RINGKASAN VALIDASI'],
        ['Periode gaji', built.periode.nama],
        ['Masa pajak', built.masa.label],
        ['Jumlah karyawan', built.rows.length],
        ['Total penghasilan bruto', built.totalBruto],
        ['Total PPh 21 dipotong', built.totalPph],
        [],
        ['Peringatan'],
      ];
      if (built.warnings.length) {
        built.warnings.forEach(function (w) {
          ring.push([w]);
        });
      } else ring.push(['Tidak ada peringatan data wajib.']);
      var wsR = XLSX.utils.aoa_to_sheet(ring);
      wsR['!cols'] = [{ wch: 28 }, { wch: 40 }];
      XLSX.utils.book_append_sheet(wb, wsR, 'RINGKASAN');

      var fn =
        'eBupot_SiGaji_' +
        built.masa.yyyymm +
        '_' +
        String(built.periode.nama).replace(/[^\w\d]+/g, '_') +
        '.xlsx';
      XLSX.writeFile(wb, fn);
      toast(
        'Excel e-Bupot diunduh (' +
          built.rows.length +
          ' karyawan · PPh ' +
          fmt(built.totalPph) +
          ')'
      );
    } catch (e) {
      toast('Gagal export: ' + (e.message || e));
    }
  });
}

function ebupotBuildMmPayrollXml(built) {
  var tetap = built.rows.filter(function (r) {
    return r.tipeKerja !== 'tidak_tetap';
  });
  if (!tetap.length) return { ok: false, error: 'Tidak ada pegawai tetap untuk BPMP' };
  var lines = [
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>',
    '<MmPayrollBulk xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">',
    '\t<TIN>' + ebupotXmlEscape(built.npwpPemotong) + '</TIN>',
    '\t<ListOfMmPayroll>',
  ];
  tetap.forEach(function (r) {
    lines.push('\t\t<MmPayroll>');
    lines.push(ebupotXmlEl('TaxPeriodMonth', r.masaBulan));
    lines.push(ebupotXmlEl('TaxPeriodYear', r.masaTahun));
    lines.push(ebupotXmlEl('CounterpartOpt', r.statusPegawai));
    lines.push('\t\t<CounterpartPassport xsi:nil="true"/>');
    lines.push(ebupotXmlEl('CounterpartTin', r.counterpartTin));
    lines.push(ebupotXmlEl('StatusTaxExemption', r.ptkp));
    lines.push(ebupotXmlEl('Position', r.jabatan));
    lines.push(ebupotXmlEl('TaxCertificate', r.fasilitas));
    lines.push(ebupotXmlEl('TaxObjectCode', r.kodeObjek));
    lines.push(ebupotXmlEl('Gross', r.penghasilanBruto));
    lines.push(ebupotXmlEl('Rate', r.tarifTerPct));
    lines.push(ebupotXmlEl('IDPlaceOfBusinessActivity', r.idTkuPemotong));
    lines.push(ebupotXmlEl('WithholdingDate', r.withholdingDate));
    lines.push('\t\t</MmPayroll>');
  });
  lines.push('\t</ListOfMmPayroll>');
  lines.push('</MmPayrollBulk>');
  return { ok: true, xml: lines.join('\n'), count: tetap.length };
}

function ebupotBuildBp21Xml(built) {
  var tt = built.rows.filter(function (r) {
    return r.tipeKerja === 'tidak_tetap';
  });
  if (!tt.length) return { ok: false, error: 'Tidak ada pegawai tidak tetap untuk BP21' };
  var lines = [
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>',
    '<Bp21Bulk xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">',
    '\t<TIN>' + ebupotXmlEscape(built.npwpPemotong) + '</TIN>',
    '\t<ListOfBp21>',
  ];
  tt.forEach(function (r) {
    lines.push('\t\t<Bp21>');
    lines.push(ebupotXmlEl('TaxPeriodMonth', r.masaBulan));
    lines.push(ebupotXmlEl('TaxPeriodYear', r.masaTahun));
    lines.push(ebupotXmlEl('CounterpartTin', r.counterpartTin));
    lines.push(
      ebupotXmlEl('IDPlaceOfBusinessActivityOfIncomeRecipient', r.idTkuPenerima)
    );
    lines.push(ebupotXmlEl('StatusTaxExemption', r.ptkp));
    lines.push(ebupotXmlEl('TaxCertificate', r.fasilitas));
    lines.push(ebupotXmlEl('TaxObjectCode', r.kodeObjek));
    lines.push(ebupotXmlEl('Gross', r.penghasilanBruto));
    lines.push(ebupotXmlEl('Deemed', 100));
    lines.push(ebupotXmlEl('Rate', r.tarifTerPct));
    lines.push(ebupotXmlEl('Document', 'CommercialInvoice'));
    lines.push(ebupotXmlEl('DocumentNumber', r.periodeGaji + '-' + r.counterpartTin));
    lines.push(ebupotXmlEl('DocumentDate', r.withholdingDate));
    lines.push(ebupotXmlEl('IDPlaceOfBusinessActivity', r.idTkuPemotong));
    lines.push(ebupotXmlEl('WithholdingDate', r.withholdingDate));
    lines.push('\t\t</Bp21>');
  });
  lines.push('\t</ListOfBp21>');
  lines.push('</Bp21Bulk>');
  return { ok: true, xml: lines.join('\n'), count: tt.length };
}

function exportXmlEbupotCoretax() {
  var built = ebupotBuildRows();
  if (!built.ok) {
    toast(built.error || 'Gagal menyiapkan data');
    return;
  }
  if (built.warnings.length) toast('Perhatian: ' + built.warnings[0]);
  if (!built.npwpPemotong || built.npwpPemotong.length < 15) {
    toast('NPWP perusahaan wajib diisi (Master → Profil Perusahaan)');
    return;
  }

  var bpmp = ebupotBuildMmPayrollXml(built);
  var bp21 = ebupotBuildBp21Xml(built);
  var slug = String(built.periode.nama).replace(/[^\w\d]+/g, '_');
  var downloaded = 0;

  if (bpmp.ok) {
    ebupotDownloadText('BPMP_SiGaji_' + built.masa.yyyymm + '_' + slug + '.xml', bpmp.xml);
    downloaded++;
  }
  if (bp21.ok) {
    setTimeout(function () {
      ebupotDownloadText('BP21_SiGaji_' + built.masa.yyyymm + '_' + slug + '.xml', bp21.xml);
    }, downloaded ? 350 : 0);
    downloaded++;
  }

  if (!downloaded) {
    toast('Tidak ada data yang bisa diekspor ke XML');
    return;
  }

  var msg = 'XML Coretax diunduh';
  if (bpmp.ok) msg += ' · BPMP ' + bpmp.count + ' pegawai tetap';
  if (bp21.ok) msg += ' · BP21 ' + bp21.count + ' tidak tetap';
  msg += ' — upload langsung di e-Bupot → Impor Data';
  toast(msg);
}

function exportCsvEbupotBulanan() {
  var built = ebupotBuildRows();
  if (!built.ok) {
    toast(built.error || 'Gagal menyiapkan data');
    return;
  }
  var hdr = ebupotDataHeaders();
  var lines = [hdr.map(function (h) {
    return '"' + String(h).replace(/"/g, '""') + '"';
  }).join(',')];
  built.rows.forEach(function (r) {
    lines.push(
      ebupotRowToArray(r)
        .map(function (v) {
          return '"' + String(v == null ? '' : v).replace(/"/g, '""') + '"';
        })
        .join(',')
    );
  });
  var blob = new Blob(['\uFEFF' + lines.join('\n')], { type: 'text/csv;charset=utf-8' });
  var a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download =
    'eBupot_SiGaji_' + built.masa.yyyymm + '_' + built.periode.nama.replace(/[^\w\d]+/g, '_') + '.csv';
  a.click();
  toast('CSV e-Bupot diunduh — untuk arsip/referensi (Coretax butuh XML via template DJP)');
}

if (typeof window !== 'undefined') {
  window.exportExcelEbupotBulanan = exportExcelEbupotBulanan;
  window.exportCsvEbupotBulanan = exportCsvEbupotBulanan;
  window.exportXmlEbupotCoretax = exportXmlEbupotCoretax;
}
