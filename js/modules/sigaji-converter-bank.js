/**
 * SiGaji — Converter EXCEL transfer bank (format Mandiri bulk payment).
 *
 * Output berupa .xlsm yang menyalin template asli apa adanya: makro VBA
 * (tombol CONVERT TO TXT), styles, dan pengaturan cetak. Hanya isi Sheet1
 * yang ditulis ulang, jadi tombol makro tetap berfungsi seperti file contoh.
 *
 * Catatan penting untuk makro: kolom Debit Account, Credit Account, dan
 * Transfer Amount harus berupa ANGKA, karena makro memakai Format(...,"000..")
 * untuk memberi padding nol. Kalau ditulis sebagai teks, hasil .txt jadi salah.
 */
(function () {
  'use strict';

  var TEMPLATE_URL = '/assets/templates/converter-bank-mandiri.xlsm';
  var SHEET_PART = 'xl/worksheets/sheet2.xml';
  var COLS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M'];
  var BULAN = [
    'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
    'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
  ];
  /* Indeks style diambil dari template agar tampilan sama dengan file contoh. */
  var S_HDR1 = ['4', '15', '6', '3', '3'];
  var S_ROW2 = ['8', '16', '12', '14', '8'];
  var S_HDR4 = ['21', '27', '28', '21', '21', '29', '21', '21', '21', '21', '21', '21', '21'];
  var S_DATA = ['19', '30', '31', '20', '20', '32', '12', '21', '21', '21', '21', '21', '21'];
  var HDR1 = ['Transaction Type', 'Mitra ID', 'Date', 'Sequence File', 'Total Record'];
  var HDR4 = [
    'Debit Account', 'Credit Account', 'Account Name', 'Address Name',
    'Transfer Currency', 'Transfer Amount', 'Customer Ref No.', 'FT Service',
    'To Acc Bank Code', 'To Acc Bank Name', 'To Acc Bank Address',
    'Bank City Name/ Country Name', 'Purpose of Transaction',
  ];
  var DEFAULTS = {
    transaction_type: 'PY',
    mitra_id: '',
    debit_account: '',
    sequence: '001',
    address_name: '',
    city: '',
    bank_code: '008',
    bank_name: 'BANK MANDIRI',
    bank_address: '',
    purpose_prefix: 'Gaji',
    purpose_suffix: '',
    label: '',
  };

  /* ── CRC32 ───────────────────────────────────── */
  var CRC_TABLE = (function () {
    var t = new Int32Array(256);
    for (var i = 0; i < 256; i++) {
      var c = i;
      for (var k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      t[i] = c;
    }
    return t;
  })();

  function crc32(buf) {
    var c = -1;
    for (var i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
    return (c ^ -1) >>> 0;
  }

  function utf8Bytes(str) {
    if (typeof TextEncoder !== 'undefined') return new TextEncoder().encode(str);
    var out = [];
    for (var i = 0; i < str.length; i++) {
      var c = str.charCodeAt(i);
      if (c < 0x80) out.push(c);
      else if (c < 0x800) out.push(0xc0 | (c >> 6), 0x80 | (c & 0x3f));
      else out.push(0xe0 | (c >> 12), 0x80 | ((c >> 6) & 0x3f), 0x80 | (c & 0x3f));
    }
    return new Uint8Array(out);
  }

  function utf8String(bytes) {
    if (typeof TextDecoder !== 'undefined') return new TextDecoder('utf-8').decode(bytes);
    var s = '';
    for (var i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
    return decodeURIComponent(escape(s));
  }

  /* ── ZIP: baca daftar entri dari central directory ── */
  function rd16(b, o) {
    return b[o] | (b[o + 1] << 8);
  }
  function rd32(b, o) {
    return (b[o] | (b[o + 1] << 8) | (b[o + 2] << 16) | (b[o + 3] << 24)) >>> 0;
  }

  function zipRead(bytes) {
    var eocd = -1;
    for (var i = bytes.length - 22; i >= 0 && i >= bytes.length - 70000; i--) {
      if (rd32(bytes, i) === 0x06054b50) {
        eocd = i;
        break;
      }
    }
    if (eocd < 0) throw new Error('Template rusak: EOCD zip tidak ditemukan');
    var count = rd16(bytes, eocd + 10);
    var cdOff = rd32(bytes, eocd + 16);
    var entries = [];
    var p = cdOff;
    for (var n = 0; n < count; n++) {
      if (rd32(bytes, p) !== 0x02014b50) throw new Error('Template rusak: central directory');
      var nameLen = rd16(bytes, p + 28);
      var extraLen = rd16(bytes, p + 30);
      var cmtLen = rd16(bytes, p + 32);
      var lho = rd32(bytes, p + 42);
      var lNameLen = rd16(bytes, lho + 26);
      var lExtraLen = rd16(bytes, lho + 28);
      var dataStart = lho + 30 + lNameLen + lExtraLen;
      var csize = rd32(bytes, p + 20);
      entries.push({
        name: utf8String(bytes.subarray(p + 46, p + 46 + nameLen)),
        method: rd16(bytes, p + 10),
        crc: rd32(bytes, p + 16),
        csize: csize,
        usize: rd32(bytes, p + 24),
        data: bytes.subarray(dataStart, dataStart + csize),
      });
      p += 46 + nameLen + extraLen + cmtLen;
    }
    return entries;
  }

  /**
   * Susun ulang zip. Entri yang diganti disimpan tanpa kompresi (method 0);
   * entri lain disalin byte-per-byte sehingga vbaProject.bin & styles utuh.
   */
  function zipWrite(entries, replacements) {
    var parts = [];
    var central = [];
    var offset = 0;
    var DOS_TIME = 0;
    var DOS_DATE = 0x2821; /* 2020-01-01 — tetap agar hasil bisa direproduksi */

    function push(arr) {
      parts.push(arr);
      offset += arr.length;
    }

    entries.forEach(function (e) {
      var name = utf8Bytes(e.name);
      var method = e.method;
      var data = e.data;
      var crc = e.crc;
      var csize = e.csize;
      var usize = e.usize;
      if (replacements && Object.prototype.hasOwnProperty.call(replacements, e.name)) {
        data = replacements[e.name];
        method = 0;
        crc = crc32(data);
        csize = data.length;
        usize = data.length;
      }
      var localOffset = offset;
      var head = new Uint8Array(30);
      var hv = new DataView(head.buffer);
      hv.setUint32(0, 0x04034b50, true);
      hv.setUint16(4, 20, true);
      hv.setUint16(6, 0, true);
      hv.setUint16(8, method, true);
      hv.setUint16(10, DOS_TIME, true);
      hv.setUint16(12, DOS_DATE, true);
      hv.setUint32(14, crc, true);
      hv.setUint32(18, csize, true);
      hv.setUint32(22, usize, true);
      hv.setUint16(26, name.length, true);
      hv.setUint16(28, 0, true);
      push(head);
      push(name);
      push(data);

      var cd = new Uint8Array(46);
      var cv = new DataView(cd.buffer);
      cv.setUint32(0, 0x02014b50, true);
      cv.setUint16(4, 20, true);
      cv.setUint16(6, 20, true);
      cv.setUint16(8, 0, true);
      cv.setUint16(10, method, true);
      cv.setUint16(12, DOS_TIME, true);
      cv.setUint16(14, DOS_DATE, true);
      cv.setUint32(16, crc, true);
      cv.setUint32(20, csize, true);
      cv.setUint32(24, usize, true);
      cv.setUint16(28, name.length, true);
      cv.setUint16(30, 0, true);
      cv.setUint16(32, 0, true);
      cv.setUint16(34, 0, true);
      cv.setUint16(36, 0, true);
      cv.setUint32(38, 0, true);
      cv.setUint32(42, localOffset, true);
      central.push(cd);
      central.push(name);
    });

    var cdStart = offset;
    central.forEach(push);
    var cdSize = offset - cdStart;
    var end = new Uint8Array(22);
    var ev = new DataView(end.buffer);
    ev.setUint32(0, 0x06054b50, true);
    ev.setUint16(8, entries.length, true);
    ev.setUint16(10, entries.length, true);
    ev.setUint32(12, cdSize, true);
    ev.setUint32(16, cdStart, true);
    push(end);

    var total = 0;
    parts.forEach(function (a) {
      total += a.length;
    });
    var out = new Uint8Array(total);
    var at = 0;
    parts.forEach(function (a) {
      out.set(a, at);
      at += a.length;
    });
    return out;
  }

  /* ── XML sheet ────────────────────────────────── */
  /** Karakter kontrol tidak sah di XML — dibuang agar file tidak korup. */
  function stripControl(s) {
    var out = '';
    for (var i = 0; i < s.length; i++) {
      var c = s.charCodeAt(i);
      if (c === 9 || c === 10 || c === 13 || c >= 32) out += s.charAt(i);
    }
    return out;
  }

  function esc(v) {
    return stripControl(String(v == null ? '' : v))
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  function cStr(ref, style, text) {
    if (text === '' || text == null) return '<c r="' + ref + '" s="' + style + '"/>';
    return '<c r="' + ref + '" s="' + style + '" t="inlineStr"><is><t xml:space="preserve">' +
      esc(text) + '</t></is></c>';
  }

  function cNum(ref, style, num) {
    return '<c r="' + ref + '" s="' + style + '"><v>' + num + '</v></c>';
  }

  /** Nomor rekening aman ditulis sebagai angka? (dibutuhkan makro untuk padding) */
  function isPlainAccount(v) {
    var s = String(v == null ? '' : v);
    return /^[1-9]\d{0,14}$/.test(s);
  }

  function buildSheetData(header, rows) {
    var x = '<row r="1" spans="1:13" ht="16" customHeight="1">';
    for (var i = 0; i < 5; i++) x += cStr(COLS[i] + '1', S_HDR1[i], HDR1[i]);
    x += '<c r="F1" s="9"/><c r="G1"/></row>';

    x += '<row r="2" spans="1:13" s="5" customFormat="1" ht="15.65" customHeight="1">';
    x += cStr('A2', S_ROW2[0], header.transaction_type);
    x += cStr('B2', S_ROW2[1], header.mitra_id);
    x += cStr('C2', S_ROW2[2], header.date);
    x += cStr('D2', S_ROW2[3], header.sequence);
    x += cStr('E2', S_ROW2[4], String(rows.length));
    x += '<c r="F2" s="10"/><c r="G2"/></row>';

    x += '<row r="3" spans="1:13"><c r="F3" s="11"/></row>';

    x += '<row r="4" spans="1:13" ht="32.5" customHeight="1">';
    for (var j = 0; j < 13; j++) x += cStr(COLS[j] + '4', S_HDR4[j], HDR4[j]);
    x += '</row>';

    rows.forEach(function (r, idx) {
      var rn = 5 + idx;
      x += '<row r="' + rn + '" spans="1:13">';
      x += isPlainAccount(header.debit_account)
        ? cNum('A' + rn, S_DATA[0], header.debit_account)
        : cStr('A' + rn, S_DATA[0], header.debit_account);
      x += isPlainAccount(r.rekening)
        ? cNum('B' + rn, S_DATA[1], r.rekening)
        : cStr('B' + rn, S_DATA[1], r.rekening);
      x += cStr('C' + rn, S_DATA[2], r.nama);
      x += cStr('D' + rn, S_DATA[3], header.address_name);
      x += cStr('E' + rn, S_DATA[4], 'IDR');
      x += cNum('F' + rn, S_DATA[5], Math.round(r.jumlah));
      x += cStr('G' + rn, S_DATA[6], header.date);
      x += cStr('H' + rn, S_DATA[7], 'IBU');
      x += cStr('I' + rn, S_DATA[8], header.bank_code);
      x += cStr('J' + rn, S_DATA[9], header.bank_name);
      x += cStr('K' + rn, S_DATA[10], header.bank_address);
      x += cStr('L' + rn, S_DATA[11], header.city);
      x += cStr('M' + rn, S_DATA[12], header.purpose);
      x += '</row>';
    });
    return x;
  }

  function replaceSheetData(xml, header, rows) {
    var open = xml.indexOf('<sheetData');
    if (open < 0) throw new Error('Template rusak: sheetData tidak ada');
    var selfClose = xml.substring(open, open + 40).indexOf('/>');
    var close;
    if (selfClose >= 0 && xml.indexOf('</sheetData>') < 0) close = open + selfClose + 2;
    else close = xml.indexOf('</sheetData>') + '</sheetData>'.length;
    var out = xml.substring(0, open) +
      '<sheetData>' + buildSheetData(header, rows) + '</sheetData>' +
      xml.substring(close);
    return out.replace(/<dimension ref="[^"]*"\/>/, '<dimension ref="A1:M' + (4 + rows.length) + '"/>');
  }

  /* ── API inti (dipakai juga oleh tes Node) ───── */

  /** Rangkai .xlsm final dari byte template + data. */
  function buildXlsm(templateBytes, header, rows) {
    if (!templateBytes || !templateBytes.length) throw new Error('Template kosong');
    if (!rows || !rows.length) throw new Error('Tidak ada baris transfer');
    var entries = zipRead(templateBytes);
    var sheet = null;
    entries.forEach(function (e) {
      if (e.name === SHEET_PART) sheet = e;
    });
    if (!sheet) throw new Error('Template rusak: ' + SHEET_PART + ' tidak ada');
    if (sheet.method !== 0 && sheet.method !== 8) throw new Error('Kompresi template tidak dikenal');
    var xml = sheet.method === 0 ? utf8String(sheet.data) : inflateRaw(sheet.data);
    var rep = {};
    rep[SHEET_PART] = utf8Bytes(replaceSheetData(xml, header, rows));
    return zipWrite(entries, rep);
  }

  /**
   * Template disimpan dengan sheet1 ter-deflate. Karena kita hanya butuh
   * membacanya sekali, inflate-nya memakai DecompressionStream bila ada.
   * Bila tidak tersedia, template harus disimpan tanpa kompresi.
   */
  function inflateRaw() {
    throw new Error('Template harus menyimpan ' + SHEET_PART + ' tanpa kompresi (stored)');
  }

  function pad2(n) {
    return String(n).padStart(2, '0');
  }

  /** 'YYYY-MM-DD' → 'YYYYMMDD' (dipakai makro untuk nama file .txt) */
  function toCompactDate(iso) {
    var s = String(iso || '').substring(0, 10);
    var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
    if (m) return m[1] + m[2] + m[3];
    var d = new Date();
    return d.getFullYear() + pad2(d.getMonth() + 1) + pad2(d.getDate());
  }

  function monthYearFromIso(iso) {
    var s = String(iso || '').substring(0, 10);
    var m = /^(\d{4})-(\d{2})-/.exec(s);
    var d = m ? new Date(Number(m[1]), Number(m[2]) - 1, 1) : new Date();
    return { bulan: BULAN[d.getMonth()], tahun: d.getFullYear() };
  }

  /** 'Converter EXCEL Agustus 2026 Cemerlang.xlsm' — bulan & tahun ikut periode. */
  function fileName(iso, label) {
    var my = monthYearFromIso(iso);
    var tail = String(label || '').trim();
    return 'Converter EXCEL ' + my.bulan + ' ' + my.tahun + (tail ? ' ' + tail : '') + '.xlsm';
  }

  window.sigajiConverterBuildXlsm = buildXlsm;
  window.sigajiConverterSheetXml = replaceSheetData;
  window.sigajiConverterFileName = fileName;
  window.sigajiConverterCompactDate = toCompactDate;
  window.sigajiConverterMonthYear = monthYearFromIso;
  window.sigajiConverterDefaults = DEFAULTS;
  window.sigajiConverterZipRead = zipRead;
  window.sigajiConverterZipWrite = zipWrite;

  /* ── Bagian yang butuh data SiGaji & DOM ─────── */

  function cfgGet() {
    var saved = (typeof perusahaan !== 'undefined' && perusahaan && perusahaan.converter_bank) || {};
    var out = {};
    Object.keys(DEFAULTS).forEach(function (k) {
      out[k] = saved[k] != null && saved[k] !== '' ? saved[k] : DEFAULTS[k];
    });
    if (!out.label && typeof perusahaan !== 'undefined' && perusahaan && perusahaan.nama) {
      out.label = String(perusahaan.nama).replace(/^\s*(PT|CV)[\s.]+/i, '').trim();
    }
    return out;
  }

  function cfgSave(cfg) {
    if (typeof perusahaan === 'undefined' || !perusahaan) return;
    perusahaan.converter_bank = cfg;
    if (typeof saveAll === 'function') saveAll();
  }

  /** Baris transfer dari karyawan periode aktif; THP dipakai sebagai nominal. */
  function collectRows(p) {
    var list = typeof karyawanListPeriode === 'function' ? karyawanListPeriode(p) : [];
    var rows = [];
    var lewat = [];
    var catatan = [];
    list.forEach(function (k) {
      var g = hitungGaji(k, p.nama);
      var jumlah = Math.round(g.neto || 0);
      var rek = String(k.norek || '').replace(/[^\d]/g, '');
      var nama = String(k.reknam || k.nama || '').toUpperCase().trim();
      if (!rek) {
        lewat.push(k.nama + ' — no. rekening kosong');
        return;
      }
      if (jumlah <= 0) {
        lewat.push(k.nama + ' — THP nol');
        return;
      }
      if (!isPlainAccount(rek)) {
        catatan.push(k.nama + ' — no. rekening ' + rek + ' tidak lazim, cek manual');
      }
      var bank = String(k.bank || '').toUpperCase();
      if (bank && bank.indexOf('MANDIRI') < 0) {
        catatan.push(k.nama + ' — bank ' + bank + ', bukan Mandiri');
      }
      rows.push({ rekening: rek, nama: nama, jumlah: jumlah });
    });
    return { rows: rows, lewat: lewat, catatan: catatan };
  }

  function headerFromCfg(cfg, p, jumlahBaris) {
    var iso = p.bayar || p.end || p.start;
    var my = monthYearFromIso(iso);
    var purpose = [cfg.purpose_prefix, my.bulan, cfg.purpose_suffix]
      .map(function (s) {
        return String(s || '').trim();
      })
      .filter(Boolean)
      .join(' ');
    return {
      transaction_type: cfg.transaction_type,
      mitra_id: cfg.mitra_id,
      date: toCompactDate(iso),
      sequence: cfg.sequence,
      debit_account: String(cfg.debit_account || '').replace(/[^\d]/g, ''),
      address_name: cfg.address_name,
      city: cfg.city,
      bank_code: cfg.bank_code,
      bank_name: cfg.bank_name,
      bank_address: cfg.bank_address,
      purpose: purpose,
      total_record: jumlahBaris,
    };
  }

  function fieldRow(key, label, hint, value) {
    return '<div class="conv-field"><label for="conv-' + key + '">' + label +
      (hint ? ' <span class="u-muted-10">' + hint + '</span>' : '') + '</label>' +
      '<input class="comp-inp" id="conv-' + key + '" value="' + escapeAttr(String(value || '')) + '"></div>';
  }

  window.openConverterBankModal = function () {
    var p = typeof PA === 'function' ? PA() : null;
    if (!p || !p.nama) {
      toast('Tidak ada periode aktif');
      return;
    }
    var cfg = cfgGet();
    var hasil = collectRows(p);
    var my = monthYearFromIso(p.bayar || p.end || p.start);
    var host = document.getElementById('m-converter-c');
    var titleEl = document.getElementById('m-converter-t');
    if (!host) {
      toast('Modal converter tidak ditemukan');
      return;
    }
    if (titleEl) titleEl.textContent = 'Converter EXCEL Transfer Bank — ' + p.nama;
    var h = '<div class="info-box info-amber font-11 mb-lg">' +
      'File hasil berformat <strong>.xlsm</strong> lengkap dengan makro <strong>CONVERT TO TXT</strong> ' +
      'dari template bank. Buka di Excel, aktifkan makro, lalu klik tombolnya untuk membuat file .txt.' +
      '</div>';
    h += '<div class="conv-grid">';
    h += fieldRow('debit_account', 'Debit Account', '(rekening perusahaan)', cfg.debit_account);
    h += fieldRow('mitra_id', 'Mitra ID', '', cfg.mitra_id);
    h += fieldRow('transaction_type', 'Transaction Type', '', cfg.transaction_type);
    h += fieldRow('sequence', 'Sequence File', '(mis. 001)', cfg.sequence);
    h += fieldRow('address_name', 'Address Name', '', cfg.address_name);
    h += fieldRow('city', 'Bank City Name', '', cfg.city);
    h += fieldRow('bank_code', 'To Acc Bank Code', '', cfg.bank_code);
    h += fieldRow('bank_name', 'To Acc Bank Name', '', cfg.bank_name);
    h += fieldRow('bank_address', 'To Acc Bank Address', '', cfg.bank_address);
    h += fieldRow('purpose_prefix', 'Keterangan', '(depan)', cfg.purpose_prefix);
    h += fieldRow('purpose_suffix', 'Keterangan', '(belakang, mis. SBW)', cfg.purpose_suffix);
    h += fieldRow('label', 'Label nama file', '(mis. Cemerlang)', cfg.label);
    h += '</div>';
    h += '<div class="conv-summary">' +
      '<div><strong>' + hasil.rows.length + '</strong> baris transfer siap dibuat</div>' +
      '<div class="u-muted-11">Nama file: <strong id="conv-preview-name">' +
      escapeHtml(fileName(p.bayar || p.end || p.start, cfg.label)) + '</strong></div>' +
      '<div class="u-muted-11">Keterangan tiap baris: <strong>' +
      escapeHtml([cfg.purpose_prefix, my.bulan, cfg.purpose_suffix].filter(Boolean).join(' ')) +
      '</strong></div></div>';
    if (hasil.lewat.length) {
      h += '<div class="info-box info-amber font-11 mt-lg"><strong>Tidak diikutkan (' +
        hasil.lewat.length + ')</strong><ul class="conv-list">' +
        hasil.lewat.map(function (s) {
          return '<li>' + escapeHtml(s) + '</li>';
        }).join('') + '</ul></div>';
    }
    if (hasil.catatan.length) {
      h += '<div class="info-box font-11 mt-lg"><strong>Perlu dicek (' + hasil.catatan.length +
        ')</strong><ul class="conv-list">' +
        hasil.catatan.map(function (s) {
          return '<li>' + escapeHtml(s) + '</li>';
        }).join('') + '</ul></div>';
    }
    host.innerHTML = h;
    openModal('m-converter');
  };

  function readCfgFromForm() {
    var cfg = {};
    Object.keys(DEFAULTS).forEach(function (k) {
      var el = document.getElementById('conv-' + k);
      cfg[k] = el ? String(el.value || '').trim() : DEFAULTS[k];
    });
    return cfg;
  }

  window.unduhConverterBank = function () {
    var p = typeof PA === 'function' ? PA() : null;
    if (!p || !p.nama) {
      toast('Tidak ada periode aktif');
      return;
    }
    var cfg = readCfgFromForm();
    if (!cfg.debit_account) {
      toast('Debit Account wajib diisi');
      return;
    }
    if (!cfg.mitra_id) {
      toast('Mitra ID wajib diisi');
      return;
    }
    var hasil = collectRows(p);
    if (!hasil.rows.length) {
      toast('Tidak ada karyawan dengan no. rekening & THP > 0');
      return;
    }
    cfgSave(cfg);
    var header = headerFromCfg(cfg, p, hasil.rows.length);
    var iso = p.bayar || p.end || p.start;
    var url = TEMPLATE_URL +
      (typeof SIGAJI_MODULES_CACHE !== 'undefined' ? '?v=' + SIGAJI_MODULES_CACHE : '');
    fetch(url)
      .then(function (res) {
        if (!res.ok) throw new Error('Template tidak bisa dimuat (' + res.status + ')');
        return res.arrayBuffer();
      })
      .then(function (buf) {
        var out = buildXlsm(new Uint8Array(buf), header, hasil.rows);
        var blob = new Blob([out], {
          type: 'application/vnd.ms-excel.sheet.macroEnabled.12',
        });
        var a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = fileName(iso, cfg.label);
        a.click();
        setTimeout(function () {
          URL.revokeObjectURL(a.href);
        }, 4000);
        if (typeof closeModal === 'function') closeModal('m-converter');
        toast(hasil.rows.length + ' baris transfer diunduh: ' + a.download);
      })
      .catch(function (e) {
        toast('Gagal: ' + (e && e.message ? e.message : e));
      });
  };
})();
