/* SiGaji — tunjangan variabel bulanan (dipisah dari app-hr.js) */
var __tunjVarEditCells = {};
function tunjVarCellKey(nik, colId) {
  return String(nik) + '|' + String(colId);
}
function tunjVarUnlockCell(nik, colId) {
  __tunjVarEditCells[tunjVarCellKey(nik, colId)] = true;
  renderTunjVariabelBulan();
}
function tunjVarCommitCell(nik, colId, rawVal) {
  setTunjVarNilai(nik, colId, rawVal);
}
function renderTunjVarColEditor() {
  var wrap = document.getElementById('tunjvar-col-editor');
  if (!wrap) return;
  var cols = getTunjVarColumnsResolved();
  wrap.innerHTML =
    '<div class="fl flex-wrap gap-md items-end">' +
    cols
      .map(function (c) {
        var idEsc = String(c.id).replace(/\\/g, '\\\\').replace(/'/g, "\\'");
        return (
          '<div class="fg m-0" style="min-width:160px"><label class="font-10">Nama kolom</label><div class="fl items-center" style="gap:4px">' +
          '<input class="flex-1 font-12" value="' +
          escapeHtml(c.nama) +
          '" placeholder="Nama" style="padding:5px 8px; border:1.5px solid #dde1e9; border-radius:6px; font-family:inherit; outline:none" onchange="setTunjVarColNama(\'' +
          idEsc +
          "',this.value)\">" +
          (cols.length > 1
            ? '<button type="button" class="btn btn-xs btn-r" title="Hapus kolom"' +
              sigajiDataAction('hapus-tunjvar-col', { 'col-id': id }) +
              '>&#10007;</button>'
            : '') +
          '</div></div>'
        );
      })
      .join('') +
    '</div>';
}
function setTunjVarColNama(id, nama) {
  var cols = tunjVarColumns || [];
  var c = cols.find(function (x) {
    return x.id === id;
  });
  if (c) c.nama = String(nama || '').trim() || c.nama;
  syncTunjVarLabelsFromColumns();
  saveAll();
  renderTunjVariabelBulan();
  renderPenggajian(true);
}
function addTunjVarColumn() {
  if (!tunjVarColumns) tunjVarColumns = [];
  var n = tunjVarColumns.length + 1;
  tunjVarColumns.push({
    id: 'tv_' + Date.now() + '_' + Math.random().toString(36).slice(2, 5),
    nama: 'Tunjangan ' + n,
  });
  syncTunjVarLabelsFromColumns();
  saveAll();
  renderTunjVariabelBulan();
  toast('Kolom ditambahkan');
}
function hapusTunjVarColumn(id) {
  if (!tunjVarColumns || tunjVarColumns.length <= 1) {
    toast('Minimal satu kolom');
    return;
  }
  if (!confirm('Hapus kolom ini beserta nilai terkait di semua periode?')) return;
  tunjVarColumns = tunjVarColumns.filter(function (x) {
    return x.id !== id;
  });
  var pn, s;
  for (pn in tunjVarBulan) {
    if (!tunjVarBulan[pn]) continue;
    for (s in tunjVarBulan[pn]) {
      if (tunjVarBulan[pn][s] && tunjVarBulan[pn][s][id] !== undefined)
        delete tunjVarBulan[pn][s][id];
    }
  }
  syncTunjVarLabelsFromColumns();
  saveAll();
  renderTunjVariabelBulan();
  renderPenggajian(true);
  toast('Kolom dihapus');
}
function refreshTunjVarTotals() {
  var pn = PA().nama;
  var cols = getTunjVarColumnsResolved();
  var Lsum = {};
  cols.forEach(function (c) {
    Lsum[c.id] = 0;
  });
  if (!tunjVarBulan[pn]) return;
  karyawan.forEach(function (k) {
    var r = tunjVarBulan[pn][k.nik] || {};
    var sum = 0;
    cols.forEach(function (c) {
      var v = parseFloat(r[c.id]);
      if (isNaN(v)) v = 0;
      Lsum[c.id] += v;
      sum += v;
    });
    var el = document.querySelector('[data-tunjvar-sum="' + k.nik + '"]');
    if (el) el.textContent = fmt(sum);
  });
  var foot = document.getElementById('tunjvar-foot');
  if (foot) {
    var parts = cols.map(function (c) {
      return '<strong>' + escapeHtml(c.nama) + '</strong> ' + fmt(Lsum[c.id] || 0);
    });
    var grand = cols.reduce(function (s, c) {
      return s + (Lsum[c.id] || 0);
    }, 0);
    foot.innerHTML =
      'Ringkasan periode ini: ' +
      parts.join(' · ') +
      ' · Total keseluruhan <strong>' +
      fmt(grand) +
      '</strong>';
  }
}
function setTunjVarNilai(nik, vKey, val) {
  var pn = PA().nama;
  if (!tunjVarBulan[pn]) tunjVarBulan[pn] = {};
  if (!tunjVarBulan[pn][nik]) tunjVarBulan[pn][nik] = {};
  tunjVarBulan[pn][nik][vKey] = Math.max(0, parseRpInput(val));
  delete __tunjVarEditCells[tunjVarCellKey(nik, vKey)];
  saveAll();
  refreshTunjVarTotals();
  renderPenggajian(true);
  renderTunjVariabelBulan();
}
function salinTunjVarDariPeriodeLalu() {
  var pn = PA().nama;
  var prev = prevPeriodeChrono(pn);
  if (!prev) {
    toast('Tidak ada periode sebelumnya di data');
    return;
  }
  if (!confirm('Salin nilai tunjangan variabel dari "' + prev + '" ke periode aktif "' + pn + '"?'))
    return;
  if (!tunjVarBulan[pn]) tunjVarBulan[pn] = {};
  var src = tunjVarBulan[prev] || {};
  karyawan.forEach(function (k) {
    if (src[k.nik]) tunjVarBulan[pn][k.nik] = JSON.parse(JSON.stringify(src[k.nik]));
  });
  saveAll();
  renderPenggajian();
  toast('Disalin dari ' + prev);
}
function ensureXlsxForTunjVar(cb) {
  if (typeof ensureXLSX === 'function') {
    ensureXLSX(cb);
    return;
  }
  if (typeof XLSX !== 'undefined') {
    cb();
    return;
  }
  toast('Pustaka Excel belum dimuat');
}
function exportTunjVarExcelTemplate() {
  ensureXlsxForTunjVar(function () {
    var p = PA(),
      pn = p.nama;
    var cols = getTunjVarColumnsResolved();
    var listK = karyawanListPeriode(p);
    var hdr = ['NIK', 'Nama'].concat(
      cols.map(function (c) {
        return c.nama;
      })
    );
    var aoa = [hdr];
    listK.forEach(function (k) {
      var r = (tunjVarBulan[pn] || {})[k.nik] || {};
      var row = [k.nik, k.nama];
      cols.forEach(function (c) {
        var v = parseFloat(r[c.id]);
        row.push(isNaN(v) ? 0 : v);
      });
      aoa.push(row);
    });
    var ws = XLSX.utils.aoa_to_sheet(aoa);
    var wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'TunjVar');
    var fn =
      'TunjVar_' +
      pn.replace(/[^\w\d]+/g, '_') +
      '_' +
      new Date().toISOString().split('T')[0] +
      '.xlsx';
    XLSX.writeFile(wb, fn);
    toast('Template diunduh — isi kolom nilai lalu Import Excel');
  });
}
function importTunjVarExcel(inp) {
  var f = inp && inp.files && inp.files[0];
  if (!f) return;
  ensureXlsxForTunjVar(function () {
    var reader = new FileReader();
    reader.onload = function (ev) {
      try {
        var wb = XLSX.read(ev.target.result, { type: 'array' });
        var sh = wb.Sheets[wb.SheetNames[0]];
        if (!sh) {
          toast('Sheet kosong');
          inp.value = '';
          return;
        }
        var rows = XLSX.utils.sheet_to_json(sh, { header: 1, defval: '' });
        if (!rows.length || rows.length < 2) {
          toast('Minimal baris header + 1 data');
          inp.value = '';
          return;
        }
        var hdr = rows[0].map(function (x) {
          return String(x || '').trim();
        });
        var nikIdx = hdr.findIndex(function (h) {
          return /^nik$/i.test(h);
        });
        if (nikIdx < 0) {
          toast('Kolom NIK wajib di baris pertama');
          inp.value = '';
          return;
        }
        var cols = getTunjVarColumnsResolved();
        var colMap = [];
        hdr.forEach(function (h, i) {
          if (i === nikIdx || /^nama$/i.test(h)) return;
          var hLow = h.toLowerCase();
          var c = cols.find(function (x) {
            return String(x.id).toLowerCase() === hLow || String(x.nama).toLowerCase() === hLow;
          });
          if (c) colMap.push({ idx: i, id: c.id });
        });
        if (!colMap.length) {
          toast('Header kolom tidak cocok dengan definisi tunjangan (nama/id kolom)');
          inp.value = '';
          return;
        }
        var pn = PA().nama;
        if (!tunjVarBulan[pn]) tunjVarBulan[pn] = {};
        var nikSet = {};
        karyawan.forEach(function (k) {
          nikSet[String(k.nik)] = k;
        });
        var ok = 0,
          skip = 0;
        for (var r = 1; r < rows.length; r++) {
          var row = rows[r];
          if (!row || !row.length) continue;
          var nik = String(row[nikIdx] || '').trim();
          if (!nik || !nikSet[nik]) {
            skip++;
            continue;
          }
          if (!tunjVarBulan[pn][nik]) tunjVarBulan[pn][nik] = {};
          colMap.forEach(function (cm) {
            var v = parseFloat(row[cm.idx]);
            if (!isNaN(v) && v !== 0) tunjVarBulan[pn][nik][cm.id] = Math.max(0, Math.round(v));
          });
          ok++;
        }
        __tunjVarEditCells = {};
        saveAll();
        renderTunjVariabelBulan();
        renderPenggajian(true);
        toast('Import selesai: ' + ok + ' karyawan' + (skip ? ' (' + skip + ' baris dilewati)' : ''));
      } catch (e) {
        console.error(e);
        toast('Gagal baca Excel: ' + (e.message || e));
      }
      inp.value = '';
    };
    reader.readAsArrayBuffer(f);
  });
}
function renderTunjVariabelBulan() {
  var card = document.getElementById('tunjvar-card'),
    wrap = document.getElementById('tunjvar-tabel-wrap'),
    foot = document.getElementById('tunjvar-foot');
  if (!card || !wrap) return;
  if (typeof sigajiShowEl === 'function') sigajiShowEl(card);
  else {
    card.classList.remove('u-hidden');
    card.removeAttribute('hidden');
    card.style.removeProperty('display');
  }
  if (!periodes.length) {
    wrap.innerHTML =
      '<div class="info-box info-amber font-12">Belum ada periode gaji. Buat di <strong>Master → Periode Gaji &amp; THR</strong> terlebih dahulu.</div>';
    if (foot) foot.textContent = '';
    var sub0 = document.getElementById('tunjvar-per-lbl');
    if (sub0) sub0.textContent = '-';
    return;
  }
  var p = PA(),
    pn = p.nama;
  var cols = getTunjVarColumnsResolved();
  if (!tunjVarColumns || !tunjVarColumns.length) {
    tunjVarColumns = cols.slice();
    syncTunjVarLabelsFromColumns();
    saveAll();
  }
  renderTunjVarColEditor();
  var sub = document.getElementById('tunjvar-per-lbl');
  if (sub) sub.textContent = pn;
  var listK = karyawanListPeriode(p);
  if (!listK.length) {
    wrap.innerHTML = '<div>Belum ada karyawan aktif untuk periode ini.</div>';
    if (foot) foot.textContent = '';
    return;
  }
  if (!tunjVarBulan[pn]) tunjVarBulan[pn] = {};
  var thead =
    '<th class="text-center" style="min-width:42px">No</th><th>Karyawan</th>' +
    cols
      .map(function (c) {
        return '<th style="min-width:110px">' + escapeHtml(c.nama) + '</th>';
      })
      .join('') +
    '<th>Jumlah</th>';
  var rows = listK.map(function (k, idx) {
    var r = tunjVarBulan[pn][k.nik] || {};
    var sum = 0;
    var nikA = escNik(k.nik);
    var tds = cols
      .map(function (c) {
        var v = parseFloat(r[c.id]);
        if (isNaN(v)) v = 0;
        sum += v;
        var idEsc = String(c.id).replace(/\\/g, '\\\\').replace(/"/g, '&quot;');
        var cellKey = tunjVarCellKey(k.nik, c.id);
        if (__tunjVarEditCells[cellKey]) {
          return (
            '<td><div class="fl gap1 items-center" style="flex-wrap:nowrap">' +
            '<input type="text" class="tunjvar-inp inp-rp" style="max-width:100px" value="' +
            formatRpInputNum(v) +
            '" data-rp="1" onkeydown="if(event.key===\'Enter\'){event.preventDefault();tunjVarCommitCell(\'' +
            nikA +
            "','" +
            idEsc +
            '\',this.value);}">' +
            '<button type="button" class="btn btn-xs btn-g"' +
            sigajiDataAction('tunjvar-commit', { nik: k.nik, 'col-id': c.id }) +
            '>Simpan</button></div></td>'
          );
        }
        return (
          '<td><div class="fl gap1 items-center" style="flex-wrap:nowrap">' +
          '<span class="font-12 fw-600" style="min-width:76px">' +
          formatRpInputNum(v) +
          '</span>' +
          '<button type="button" class="btn btn-xs btn-out"' +
          sigajiDataAction('tunjvar-unlock', { nik: k.nik, 'col-id': c.id }) +
          '>Edit</button></div></td>'
        );
      })
      .join('');
    return (
      '<tr><td class="text-center fw-700 text-muted">' +
      (idx + 1) +
      '</td><td><div class="fl gap2 items-center"><div class="ka">' +
      ini(k.nama) +
      '</div><div><div class="fw-600 font-12">' +
      escapeHtml(k.nama) +
      '</div><div class="u-muted-10">' +
      escapeHtml(k.nik) +
      '</div></div></div></td>' +
      tds +
      '<td class="font-11 fw-700 ct-brand" data-tunjvar-sum="' +
      escapeAttr(k.nik) +
      '">' +
      fmt(sum) +
      '</td></tr>'
    );
  });
  if (typeof sigajiSetTbodyRows === 'function') {
    wrap.innerHTML = '<table><thead><tr>' + thead + '</tr></thead><tbody></tbody></table>';
    var tb = wrap.querySelector('tbody');
    sigajiSetTbodyRows(tb, rows, 50);
  } else {
    wrap.innerHTML =
      '<table><thead><tr>' + thead + '</tr></thead><tbody>' + rows.join('') + '</tbody></table>';
  }
  sigajiBindRpInputs(wrap);
  refreshTunjVarTotals();
}
