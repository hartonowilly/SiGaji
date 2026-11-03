/* SiGaji — template gaji per jabatan / grade */
/* exported cariGajiTemplate, terapkanGajiTemplate, gajiTplPerluKonfirmasi, gajiTplNormKey,
   renderGajiTplMaster, onSpJabatanGradeInput, refreshSpGajiTplHint */
var __gajiTplEditId = '';

function gajiTplNormKey(s) {
  return String(s == null ? '' : s)
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}
function gajiTplList() {
  if (!Array.isArray(gajiTemplates)) gajiTemplates = [];
  return gajiTemplates;
}
function gajiTplClone(v) {
  if (typeof deepCloneLite === 'function') return deepCloneLite(v);
  try {
    return JSON.parse(JSON.stringify(v));
  } catch (e) {
    return v;
  }
}
function gajiTplRp(n) {
  if (typeof sigajiRp === 'function') return Math.round(sigajiRp(n) || 0);
  if (typeof parseRpInput === 'function') return Math.round(parseRpInput(n) || 0);
  var x = Number(n);
  return isFinite(x) ? Math.round(x) : 0;
}
function gajiTplNormSiklus(v) {
  if (typeof sigajiNormalizeSiklusGaji === 'function') return sigajiNormalizeSiklusGaji(v);
  var s = String(v == null ? '' : v).toLowerCase();
  if (s === 'harian' || s === 'mingguan') return s;
  return s ? 'bulanan' : '';
}
function gajiTplCloneTunj(list) {
  return (list || []).map(function (t) {
    t = t || {};
    return {
      nama: String(t.nama || '').trim() || 'Tunjangan',
      nilai: gajiTplRp(t.nilai),
      tipe: t.tipe || 'tetap',
      thr_ikut: t.thr_ikut !== false,
      prorata_ikut: t.prorata_ikut !== false,
    };
  });
}
function gajiTplClonePot(list) {
  return (list || []).map(function (p) {
    p = p || {};
    return {
      nama: String(p.nama || '').trim() || 'Potongan',
      nilai: gajiTplRp(p.nilai),
      ket: String(p.ket || ''),
    };
  });
}
/** Cari template paling spesifik: jabatan+grade, lalu grade saja, lalu jabatan saja. */
function cariGajiTemplate(jabatan, grade, list) {
  var j = gajiTplNormKey(jabatan);
  var g = gajiTplNormKey(grade);
  if (!j && !g) return null;
  var arr = Array.isArray(list) ? list : gajiTplList();
  var combo = null;
  var gradeOnly = null;
  var jabOnly = null;
  for (var i = 0; i < arr.length; i++) {
    var t = arr[i];
    if (!t) continue;
    var tj = gajiTplNormKey(t.jabatan);
    var tg = gajiTplNormKey(t.grade);
    if (!tj && !tg) continue;
    if (j && g && tj === j && tg === g) {
      combo = t;
      break;
    }
    if (g && !tj && tg === g && !gradeOnly) gradeOnly = t;
    if (j && !tg && tj === j && !jabOnly) jabOnly = t;
  }
  return combo || gradeOnly || jabOnly || null;
}
/** Salin gapok/tunjangan/potongan/siklus ke karyawan. BPJS, natura, PPh return tidak diubah. */
function terapkanGajiTemplate(k, tpl) {
  if (!k || !tpl) return k;
  k.gapok = gajiTplRp(tpl.gapok);
  var sik = gajiTplNormSiklus(tpl.siklus_gaji);
  if (sik) k.siklus_gaji = sik;
  k.tunjangan = gajiTplCloneTunj(tpl.tunjangan);
  k.potongan = gajiTplClonePot(tpl.potongan);
  k._gajiTplId = tpl.id || '';
  return k;
}
function gajiTplPerluKonfirmasi(k) {
  if (!k || k._new || k._gajiTplFresh) return false;
  var tunj = k.tunjangan || [];
  var pot = k.potongan || [];
  var gapok = gajiTplRp(k.gapok);
  var tipe =
    typeof sigajiNormalizeKarTipe === 'function' ? sigajiNormalizeKarTipe(k.tipe_kerja, k) : k.tipe_kerja || 'tetap';
  if (tipe === 'tidak_tetap') {
    if (gapok !== 0) return true;
    if (tunj.length === 0 && pot.length === 0) return false;
    if (
      tunj.length === 1 &&
      pot.length === 0 &&
      String(tunj[0].nama || '') === 'Honor / Upah Bulanan' &&
      gajiTplRp(tunj[0].nilai) === 5000000
    )
      return false;
    return true;
  }
  if (gapok === 5000000 && tunj.length === 0 && pot.length === 0) return false;
  return gapok > 0 || tunj.length > 0 || pot.length > 0;
}
function gajiTplKunciLabel(tpl) {
  var j = String((tpl && tpl.jabatan) || '').trim();
  var g = String((tpl && tpl.grade) || '').trim();
  if (j && g) return j + ' · Grade ' + g;
  if (g) return 'Grade ' + g;
  if (j) return j;
  return '—';
}
function gajiTplNamaHint(tpl) {
  if (!tpl) return '';
  var nTunj = (tpl.tunjangan || []).length;
  var gap =
    typeof fmt === 'function' ? fmt(gajiTplRp(tpl.gapok)) : 'Rp ' + String(gajiTplRp(tpl.gapok));
  return (
    'Template: ' +
    (tpl.nama || gajiTplKunciLabel(tpl)) +
    ' — gapok ' +
    gap +
    (nTunj ? ' + ' + nTunj + ' tunjangan' : '')
  );
}
function gajiTplKaryawanCocok(tpl) {
  if (!tpl || !tpl.id) return [];
  return (karyawan || []).filter(function (k) {
    if (!k || k.dihapusPada) return false;
    var hit = cariGajiTemplate(k.jabatan, k.grade);
    return !!(hit && hit.id === tpl.id);
  });
}

function populateGajiTplDatalists() {
  var jabDl = document.getElementById('sp-jabatan-dl');
  var grdDl = document.getElementById('sp-grade-dl');
  var seenJ = {};
  var seenG = {};
  function add(map, val, dl) {
    var n = String(val || '').trim();
    if (!n) return;
    var key = gajiTplNormKey(n);
    if (map[key]) return;
    map[key] = 1;
    if (dl) {
      var o = document.createElement('option');
      o.value = n;
      dl.appendChild(o);
    }
  }
  if (jabDl) jabDl.replaceChildren();
  if (grdDl) grdDl.replaceChildren();
  gajiTplList().forEach(function (t) {
    add(seenJ, t.jabatan, jabDl);
    add(seenG, t.grade, grdDl);
  });
  (karyawan || []).forEach(function (k) {
    if (!k || k.dihapusPada) return;
    add(seenJ, k.jabatan, jabDl);
    add(seenG, k.grade, grdDl);
  });
}
function refreshSpGajiTplHint() {
  var el = document.getElementById('sp-gaji-tpl-hint');
  if (!el) return;
  var jabEl = document.getElementById('sp-jabatan-f');
  var grdEl = document.getElementById('sp-grade-f');
  var jab = jabEl ? jabEl.value : '';
  var grd = grdEl ? grdEl.value : '';
  if (!gajiTplNormKey(jab) && !gajiTplNormKey(grd)) {
    el.textContent = 'Isi jabatan atau grade untuk mengisi komponen gaji dari template.';
    return;
  }
  var tpl = cariGajiTemplate(jab, grd);
  el.textContent = tpl ? gajiTplNamaHint(tpl) : 'Tidak ada template yang cocok.';
}
function onSpJabatanGradeInput() {
  refreshSpGajiTplHint();
  var k = (karyawan || []).find(function (x) {
    return x && x.nik === cpNik;
  });
  if (!k || !k._gajiTplFresh) return;
  var jabEl = document.getElementById('sp-jabatan-f');
  var grdEl = document.getElementById('sp-grade-f');
  var tpl = cariGajiTemplate(jabEl ? jabEl.value : '', grdEl ? grdEl.value : '');
  if (!tpl) return;
  terapkanGajiTemplate(k, tpl);
  var sik = document.getElementById('sp-siklus-gaji-f');
  if (sik && tpl.siklus_gaji) sik.value = gajiTplNormSiklus(tpl.siklus_gaji) || sik.value;
}

async function maybeApplyGajiTplOnSave(k, jabatanBaru, gradeBaru) {
  if (!k) return false;
  var fresh = !!(k._gajiTplFresh || k._new);
  var keysChanged =
    gajiTplNormKey(jabatanBaru) !== gajiTplNormKey(k.jabatan) ||
    gajiTplNormKey(gradeBaru) !== gajiTplNormKey(k.grade);
  if (!fresh && !keysChanged) return false;
  var tpl = cariGajiTemplate(jabatanBaru, gradeBaru);
  if (!tpl) return false;
  if (!fresh && gajiTplPerluKonfirmasi(k)) {
    var ok = true;
    if (typeof sigajiConfirm === 'function') {
      ok = await sigajiConfirm({
        title: 'Timpa komponen gaji?',
        message:
          'Jabatan/grade berubah. Timpa gaji pokok dan tunjangan dengan ' +
          (tpl.nama || gajiTplKunciLabel(tpl)) +
          '?\n\nBPJS dan natura tidak diubah. Setelah ini HRD masih bisa mengoreksi di Komponen Gaji.',
        okText: 'Ya, pakai template',
      });
    }
    if (!ok) return false;
  }
  terapkanGajiTemplate(k, tpl);
  return true;
}

function gajiTplTunjTypesHtml(selected) {
  var types = typeof TUNJ_TYPES === 'object' && TUNJ_TYPES ? TUNJ_TYPES : { tetap: 'Tetap' };
  return Object.keys(types)
    .map(function (id) {
      return (
        '<option value="' +
        escapeAttr(id) +
        '"' +
        (id === selected ? ' selected' : '') +
        '>' +
        escapeHtml(types[id]) +
        '</option>'
      );
    })
    .join('');
}
function gajiTplAppendTunjRow(t) {
  t = t || { nama: '', nilai: 0, tipe: 'tetap', thr_ikut: true, prorata_ikut: true };
  var wrap = document.getElementById('gaji-tpl-tunj-list');
  if (!wrap) return;
  var row = document.createElement('div');
  row.className = 'tr-row gaji-tpl-tunj-row';
  var html =
    '<input class="comp-inp gt-tunj-nama" placeholder="Nama tunjangan" value="' +
    escapeAttr(t.nama || '') +
    '">' +
    '<input type="text" class="comp-inp inp-rp gt-tunj-nilai" data-rp="1" placeholder="Nominal" value="' +
    escapeAttr(String(t.nilai == null ? '' : t.nilai)) +
    '">' +
    '<select class="comp-inp gt-tunj-tipe">' +
    gajiTplTunjTypesHtml(t.tipe || 'tetap') +
    '</select>' +
    '<select class="comp-inp gt-tunj-thr" title="Ikut THR?"><option value="ya"' +
    (t.thr_ikut !== false ? ' selected' : '') +
    '>THR</option><option value="tidak"' +
    (t.thr_ikut === false ? ' selected' : '') +
    '>Excl</option></select>' +
    '<select class="comp-inp gt-tunj-pr" title="Prorata"><option value="ya"' +
    (t.prorata_ikut !== false ? ' selected' : '') +
    '>Prorata</option><option value="tidak"' +
    (t.prorata_ikut === false ? ' selected' : '') +
    '>Penuh</option></select>' +
    '<button type="button" class="btn btn-xs btn-r" data-sigaji-action="call-value" data-fn="hapusGajiTplTunjRow" data-arg="$this">&#10007;</button>';
  row.innerHTML = html;
  wrap.appendChild(row);
  if (typeof sigajiBindRpInputs === 'function') sigajiBindRpInputs(row);
}
function hapusGajiTplTunjRow(el) {
  var row = el && el.closest ? el.closest('.gaji-tpl-tunj-row') : null;
  if (row && row.parentNode) row.parentNode.removeChild(row);
}
function addGajiTplTunjRow() {
  gajiTplAppendTunjRow({ nama: 'Tunjangan', nilai: 0, tipe: 'tetap', thr_ikut: true, prorata_ikut: true });
}
function gajiTplAppendPotRow(p) {
  p = p || { nama: '', nilai: 0, ket: '' };
  var wrap = document.getElementById('gaji-tpl-pot-list');
  if (!wrap) return;
  var row = document.createElement('div');
  row.className = 'tr-row gaji-tpl-pot-row';
  var html =
    '<input class="comp-inp gt-pot-nama" placeholder="Nama potongan" value="' +
    escapeAttr(p.nama || '') +
    '">' +
    '<input type="text" class="comp-inp inp-rp gt-pot-nilai" data-rp="1" placeholder="Nominal" value="' +
    escapeAttr(String(p.nilai == null ? '' : p.nilai)) +
    '">' +
    '<input class="comp-inp gt-pot-ket" placeholder="Ket." value="' +
    escapeAttr(p.ket || '') +
    '">' +
    '<button type="button" class="btn btn-xs btn-r" data-sigaji-action="call-value" data-fn="hapusGajiTplPotRow" data-arg="$this">&#10007;</button>';
  row.innerHTML = html;
  wrap.appendChild(row);
  if (typeof sigajiBindRpInputs === 'function') sigajiBindRpInputs(row);
}
function hapusGajiTplPotRow(el) {
  var row = el && el.closest ? el.closest('.gaji-tpl-pot-row') : null;
  if (row && row.parentNode) row.parentNode.removeChild(row);
}
function addGajiTplPotRow() {
  gajiTplAppendPotRow({ nama: 'Potongan', nilai: 0, ket: '' });
}
function gajiTplReadTunjFromForm() {
  var rows = document.querySelectorAll('#gaji-tpl-tunj-list .gaji-tpl-tunj-row');
  var out = [];
  rows.forEach(function (row) {
    var nama = (row.querySelector('.gt-tunj-nama') || {}).value || '';
    var nilai = gajiTplRp((row.querySelector('.gt-tunj-nilai') || {}).value);
    if (!String(nama).trim() && !nilai) return;
    out.push({
      nama: String(nama).trim() || 'Tunjangan',
      nilai: nilai,
      tipe: (row.querySelector('.gt-tunj-tipe') || {}).value || 'tetap',
      thr_ikut: (row.querySelector('.gt-tunj-thr') || {}).value !== 'tidak',
      prorata_ikut: (row.querySelector('.gt-tunj-pr') || {}).value !== 'tidak',
    });
  });
  return out;
}
function gajiTplReadPotFromForm() {
  var rows = document.querySelectorAll('#gaji-tpl-pot-list .gaji-tpl-pot-row');
  var out = [];
  rows.forEach(function (row) {
    var nama = (row.querySelector('.gt-pot-nama') || {}).value || '';
    var nilai = gajiTplRp((row.querySelector('.gt-pot-nilai') || {}).value);
    if (!String(nama).trim() && !nilai) return;
    out.push({
      nama: String(nama).trim() || 'Potongan',
      nilai: nilai,
      ket: String((row.querySelector('.gt-pot-ket') || {}).value || ''),
    });
  });
  return out;
}

function gajiTplFillForm(tpl) {
  tpl = tpl || {};
  __gajiTplEditId = tpl.id || '';
  var set = function (id, v) {
    var e = document.getElementById(id);
    if (e) e.value = v == null ? '' : v;
  };
  var title = document.getElementById('gaji-tpl-form-title');
  if (title) title.textContent = __gajiTplEditId ? 'Edit template' : 'Template baru';
  set('gaji-tpl-nama', tpl.nama || '');
  set('gaji-tpl-jabatan', tpl.jabatan || '');
  set('gaji-tpl-grade', tpl.grade || '');
  set('gaji-tpl-gapok', tpl.gapok != null ? tpl.gapok : '');
  set('gaji-tpl-siklus', tpl.siklus_gaji || '');
  var tunjWrap = document.getElementById('gaji-tpl-tunj-list');
  var potWrap = document.getElementById('gaji-tpl-pot-list');
  if (tunjWrap) tunjWrap.replaceChildren();
  if (potWrap) potWrap.replaceChildren();
  (tpl.tunjangan && tpl.tunjangan.length ? tpl.tunjangan : []).forEach(gajiTplAppendTunjRow);
  (tpl.potongan && tpl.potongan.length ? tpl.potongan : []).forEach(gajiTplAppendPotRow);
  if (typeof sigajiBindRpInputs === 'function') {
    var form = document.getElementById('gaji-tpl-form');
    if (form) sigajiBindRpInputs(form);
  }
  gajiTplRefreshApplyCount();
}
function resetGajiTplForm() {
  gajiTplFillForm({});
}
function editGajiTemplate(id) {
  var tpl = gajiTplList().find(function (t) {
    return t && t.id === id;
  });
  if (!tpl) {
    toast('Template tidak ditemukan');
    return;
  }
  gajiTplFillForm(tpl);
  var form = document.getElementById('gaji-tpl-form');
  if (form && form.scrollIntoView) form.scrollIntoView({ block: 'start', behavior: 'smooth' });
}
function hapusGajiTemplate(id) {
  var list = gajiTplList();
  var tpl = list.find(function (t) {
    return t && t.id === id;
  });
  if (!tpl) return;
  var go = function () {
    gajiTemplates = list.filter(function (t) {
      return t && t.id !== id;
    });
    if (__gajiTplEditId === id) resetGajiTplForm();
    saveAll();
    renderGajiTplMaster();
    toast('Template dihapus');
  };
  if (typeof sigajiConfirm === 'function') {
    sigajiConfirm({
      title: 'Hapus template?',
      message: 'Hapus "' + (tpl.nama || gajiTplKunciLabel(tpl)) + '"? Karyawan yang sudah terisi tidak diubah.',
      danger: true,
      okText: 'Hapus',
    }).then(function (ok) {
      if (ok) go();
    });
  } else go();
}
function gajiTplNewId() {
  return 'gt-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 6);
}
function simpanGajiTemplate() {
  if (typeof canAccessSubTab === 'function' && !canAccessSubTab('master', 'gaji-tpl')) {
    toast('Tidak punya akses Template Gaji');
    return;
  }
  var nama = (document.getElementById('gaji-tpl-nama') || {}).value || '';
  var jabatan = String((document.getElementById('gaji-tpl-jabatan') || {}).value || '').trim();
  var grade = String((document.getElementById('gaji-tpl-grade') || {}).value || '').trim();
  if (!jabatan && !grade) {
    toast('Isi jabatan, grade, atau keduanya');
    return;
  }
  var gapok = gajiTplRp((document.getElementById('gaji-tpl-gapok') || {}).value);
  var siklus = String((document.getElementById('gaji-tpl-siklus') || {}).value || '').trim();
  var tpl = {
    id: __gajiTplEditId || gajiTplNewId(),
    nama: String(nama).trim() || gajiTplKunciLabel({ jabatan: jabatan, grade: grade }),
    jabatan: jabatan,
    grade: grade,
    gapok: gapok,
    siklus_gaji: siklus ? gajiTplNormSiklus(siklus) : '',
    tunjangan: gajiTplReadTunjFromForm(),
    potongan: gajiTplReadPotFromForm(),
  };
  var list = gajiTplList();
  var dup = list.find(function (t) {
    return (
      t &&
      t.id !== tpl.id &&
      gajiTplNormKey(t.jabatan) === gajiTplNormKey(tpl.jabatan) &&
      gajiTplNormKey(t.grade) === gajiTplNormKey(tpl.grade)
    );
  });
  if (dup) {
    toast('Sudah ada template dengan kunci yang sama: ' + (dup.nama || gajiTplKunciLabel(dup)));
    return;
  }
  var idx = list.findIndex(function (t) {
    return t && t.id === tpl.id;
  });
  if (idx >= 0) list[idx] = tpl;
  else list.push(tpl);
  gajiTemplates = list;
  __gajiTplEditId = tpl.id;
  saveAll();
  renderGajiTplMaster();
  gajiTplFillForm(tpl);
  toast('Template "' + tpl.nama + '" disimpan');
}
async function terapkanGajiTplKeKaryawan() {
  var id = __gajiTplEditId;
  var tpl = gajiTplList().find(function (t) {
    return t && t.id === id;
  });
  if (!tpl) {
    toast('Simpan template dulu');
    return;
  }
  var cocok = gajiTplKaryawanCocok(tpl);
  if (!cocok.length) {
    toast('Tidak ada karyawan yang cocok dengan kunci ini');
    return;
  }
  var ok = true;
  if (typeof sigajiConfirm === 'function') {
    ok = await sigajiConfirm({
      title: 'Terapkan template?',
      message:
        'Timpa gaji pokok dan tunjangan ' +
        cocok.length +
        ' karyawan yang cocok dengan "' +
        tpl.nama +
        '"?\n\nPeriode terkunci tidak diubah. Snapshot periode aktif tidak otomatis ikut — gunakan Ambil dari Master jika perlu.',
      danger: true,
      okText: 'Ya, terapkan',
    });
  }
  if (!ok) return;
  cocok.forEach(function (k) {
    terapkanGajiTemplate(k, tpl);
  });
  saveAll();
  if (typeof renderKompgaji === 'function') renderKompgaji();
  if (typeof renderKar === 'function') renderKar();
  toast('Template diterapkan ke ' + cocok.length + ' karyawan');
}
function gajiTplRefreshApplyCount() {
  var btn = document.getElementById('gaji-tpl-btn-apply');
  if (!btn) return;
  var tpl = gajiTplList().find(function (t) {
    return t && t.id === __gajiTplEditId;
  });
  var n = tpl ? gajiTplKaryawanCocok(tpl).length : 0;
  btn.textContent = n ? 'Terapkan ke ' + n + ' karyawan yang cocok' : 'Terapkan ke karyawan yang cocok';
  btn.disabled = !n;
}
function gajiTplDariKaryawan() {
  var sel = document.getElementById('gaji-tpl-dari-kar');
  var nik = sel ? sel.value : '';
  var k = (karyawan || []).find(function (x) {
    return x && x.nik === nik;
  });
  if (!k) {
    toast('Pilih karyawan');
    return;
  }
  var nama = String(k.jabatan || k.nama || 'Template').trim();
  if (k.grade) nama += ' Grade ' + k.grade;
  gajiTplFillForm({
    id: '',
    nama: nama,
    jabatan: k.jabatan || '',
    grade: k.grade || '',
    gapok: k.gapok || 0,
    siklus_gaji: k.siklus_gaji || '',
    tunjangan: k.tunjangan || [],
    potongan: k.potongan || [],
  });
  toast('Disalin dari ' + (k.nama || k.nik) + ' — simpan untuk membuat template');
}
function gajiTplFillDariKarSelect() {
  var sel = document.getElementById('gaji-tpl-dari-kar');
  if (!sel) return;
  var opts = (karyawan || []).filter(function (k) {
    return k && !k.dihapusPada;
  });
  if (typeof sortKaryawanByNik === 'function') opts = sortKaryawanByNik(opts);
  sel.innerHTML =
    '<option value="">— Pilih karyawan —</option>' +
    opts
      .map(function (k) {
        return (
          '<option value="' +
          escapeAttr(k.nik) +
          '">' +
          escapeHtml((k.nama || k.nik) + ' · ' + (k.jabatan || '-') + (k.grade ? ' / ' + k.grade : '')) +
          '</option>'
        );
      })
      .join('');
}
function renderGajiTplMaster() {
  if (typeof canAccessSubTab === 'function' && !canAccessSubTab('master', 'gaji-tpl')) return;
  var tb = document.getElementById('tb-gaji-tpl');
  var list = gajiTplList().slice().sort(function (a, b) {
    var ka = gajiTplKunciLabel(a);
    var kb = gajiTplKunciLabel(b);
    return ka.localeCompare(kb, 'id');
  });
  if (tb) {
    if (!list.length) {
      tb.innerHTML =
        '<tr><td colspan="5">' +
        (typeof sigajiEmptyState === 'function'
          ? sigajiEmptyState({
              icon: '&#128176;',
              title: 'Belum ada template gaji',
              desc: 'Buat template per jabatan, per grade, atau kombinasi. Saat HRD isi jabatan/grade di profil, komponen gaji terisi otomatis.',
            })
          : '<div class="text-muted font-12 p-md">Belum ada template.</div>') +
        '</td></tr>';
    } else {
      tb.innerHTML = list
        .map(function (t) {
          var nTunj = (t.tunjangan || []).length;
          return (
            '<tr><td><strong>' +
            escapeHtml(t.nama || '—') +
            '</strong></td><td>' +
            escapeHtml(gajiTplKunciLabel(t)) +
            '</td><td class="num cell-money">' +
            (typeof fmt === 'function' ? fmt(gajiTplRp(t.gapok)) : gajiTplRp(t.gapok)) +
            '</td><td>' +
            nTunj +
            ' item</td><td><div class="fl gap1"><button type="button" class="btn btn-sm btn-p" data-sigaji-action="invoke" data-fn="editGajiTemplate" data-arg="' +
            escapeAttr(t.id) +
            '">Edit</button><button type="button" class="btn btn-sm btn-r" data-sigaji-action="invoke" data-fn="hapusGajiTemplate" data-arg="' +
            escapeAttr(t.id) +
            '">Hapus</button></div></td></tr>'
          );
        })
        .join('');
    }
  }
  gajiTplFillDariKarSelect();
  if (!__gajiTplEditId) {
    var namaEl = document.getElementById('gaji-tpl-nama');
    if (namaEl && !namaEl.value) gajiTplFillForm({});
  } else {
    gajiTplRefreshApplyCount();
  }
  populateGajiTplDatalists();
}

if (typeof window !== 'undefined') {
  window.cariGajiTemplate = cariGajiTemplate;
  window.terapkanGajiTemplate = terapkanGajiTemplate;
  window.gajiTplPerluKonfirmasi = gajiTplPerluKonfirmasi;
  window.gajiTplNormKey = gajiTplNormKey;
  window.maybeApplyGajiTplOnSave = maybeApplyGajiTplOnSave;
  window.renderGajiTplMaster = renderGajiTplMaster;
  window.onSpJabatanGradeInput = onSpJabatanGradeInput;
  window.refreshSpGajiTplHint = refreshSpGajiTplHint;
  window.populateGajiTplDatalists = populateGajiTplDatalists;
  window.simpanGajiTemplate = simpanGajiTemplate;
  window.editGajiTemplate = editGajiTemplate;
  window.hapusGajiTemplate = hapusGajiTemplate;
  window.resetGajiTplForm = resetGajiTplForm;
  window.addGajiTplTunjRow = addGajiTplTunjRow;
  window.addGajiTplPotRow = addGajiTplPotRow;
  window.hapusGajiTplTunjRow = hapusGajiTplTunjRow;
  window.hapusGajiTplPotRow = hapusGajiTplPotRow;
  window.terapkanGajiTplKeKaryawan = terapkanGajiTplKeKaryawan;
  window.gajiTplDariKaryawan = gajiTplDariKaryawan;
}
