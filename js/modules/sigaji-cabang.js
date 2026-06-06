/* SiGaji — multi-cabang + identitas pemotong per TKU (PMK / e-Bupot) */
(function () {
  var CABANG_FILTER_KEY = 'sigaji_cabang_filter';

  window.sigajiCanManageCabang = function () {
    return typeof CU !== 'undefined' && CU && CU.role === 'Admin';
  };

  window.sigajiCanAssignCabang = function () {
    return (
      typeof CU !== 'undefined' &&
      CU &&
      (CU.role === 'Admin' || CU.role === 'HRD')
    );
  };

  window.sigajiMultiBranchEnabled = function () {
    if (typeof tenantLicense !== 'undefined' && tenantLicense) {
      return !!tenantLicense.multiBranchEnabled;
    }
    return false;
  };

  window.sigajiMaxBranches = function () {
    if (typeof tenantLicense !== 'undefined' && tenantLicense) {
      var n = parseInt(tenantLicense.maxBranches, 10);
      return n > 0 ? n : 1;
    }
    return 1;
  };

  function migrateCabangTaxFields(list) {
    var prs = typeof perusahaan !== 'undefined' ? perusahaan : {};
    return (list || []).map(function (c, i) {
      if (!c || typeof c !== 'object') return c;
      var out = Object.assign({}, c);
      if (out.id === 'utama' || i === 0) {
        if (!out.npwp && prs.npwp) out.npwp = prs.npwp;
        if (out.nitku == null || out.nitku === '') out.nitku = prs.nitku || '000000';
        if (!out.alamat && prs.alamat) out.alamat = prs.alamat;
        if (!out.namaPemotong && prs.nama) out.namaPemotong = prs.nama;
        if (!out.a1_kota && prs.a1_kota) out.a1_kota = prs.a1_kota;
        if (!out.a1_ttd_nama && prs.a1_ttd_nama) out.a1_ttd_nama = prs.a1_ttd_nama;
        if (!out.a1_ttd_jabatan && prs.a1_ttd_jabatan)
          out.a1_ttd_jabatan = prs.a1_ttd_jabatan;
        if (out.a1_prefix == null || out.a1_prefix === '')
          out.a1_prefix = prs.a1_prefix != null ? prs.a1_prefix : 'A1';
      }
      if (out.nitku == null || out.nitku === '') out.nitku = '000000';
      return out;
    });
  }

  window.sigajiEnsureCabangDefault = function () {
    if (typeof cabang === 'undefined') cabang = [];
    if (!Array.isArray(cabang)) cabang = [];
    if (!cabang.length) {
      cabang.push({
        id: 'utama',
        nama: 'Kantor Pusat',
        kode: 'HQ',
        aktif: true,
      });
    }
    cabang = migrateCabangTaxFields(cabang);
    return cabang;
  };

  window.sigajiGetCabangList = function () {
    if (!sigajiMultiBranchEnabled()) return [];
    return sigajiEnsureCabangDefault().filter(function (c) {
      return c && c.aktif !== false;
    });
  };

  window.sigajiCabangById = function (id) {
    var list = sigajiEnsureCabangDefault();
    return (
      list.find(function (c) {
        return c && c.id === id;
      }) || null
    );
  };

  window.sigajiKarCabangId = function (k) {
    if (!k) return 'utama';
    var id = String(k.cabangId || k.cabang || '').trim();
    if (!id) return 'utama';
    return id;
  };

  window.sigajiKarCabangLabel = function (k) {
    var c = sigajiCabangById(sigajiKarCabangId(k));
    return c ? c.nama || c.id : 'Kantor Pusat';
  };

  /** Identitas pemotong per cabang — NPWP + NITKU (TKU) untuk e-Bupot / 1721-A1 */
  window.sigajiCabangPemotongMeta = function (cabangId) {
    sigajiEnsureCabangDefault();
    var prs = typeof perusahaan !== 'undefined' ? perusahaan : {};
    var c = sigajiCabangById(cabangId || 'utama') || {};
    var npwpRaw = String(c.npwp || '').trim() || String(prs.npwp || '').trim();
    var nitku = String(c.nitku != null ? c.nitku : '').trim();
    if (!nitku) nitku = String(prs.nitku || '').trim() || '000000';
    var npwp16 =
      typeof ebupotNpwp16 === 'function' ? ebupotNpwp16(npwpRaw) : npwpRaw;
    var idTku22 =
      typeof ebupotIdTku22 === 'function'
        ? ebupotIdTku22(npwpRaw, nitku)
        : npwp16 + nitku;
    return {
      cabangId: cabangId || 'utama',
      cabangNama: c.nama || 'Kantor Pusat',
      cabangKode: c.kode || '',
      nama:
        String(c.namaPemotong || '').trim() ||
        String(c.nama || '').trim() ||
        String(prs.nama || '').trim(),
      npwp: npwp16,
      npwpRaw: npwpRaw,
      nitku: nitku,
      idTku22: idTku22,
      alamat: String(c.alamat || '').trim() || String(prs.alamat || '').trim(),
      a1_kota: String(c.a1_kota || '').trim() || String(prs.a1_kota || '').trim(),
      a1_ttd_nama:
        String(c.a1_ttd_nama || '').trim() || String(prs.a1_ttd_nama || '').trim(),
      a1_ttd_jabatan:
        String(c.a1_ttd_jabatan || '').trim() ||
        String(prs.a1_ttd_jabatan || '').trim(),
      a1_prefix:
        String(c.a1_prefix != null ? c.a1_prefix : '').trim() ||
        (prs.a1_prefix != null ? String(prs.a1_prefix).trim() : '') ||
        'A1',
    };
  };

  window.sigajiKarCabangPemotongMeta = function (k) {
    return sigajiCabangPemotongMeta(sigajiKarCabangId(k));
  };

  window.sigajiGetCabangFilter = function () {
    if (!sigajiMultiBranchEnabled() || !sigajiCanAssignCabang()) return '';
    try {
      return String(sessionStorage.getItem(CABANG_FILTER_KEY) || '').trim();
    } catch (e) {
      return '';
    }
  };

  window.sigajiSetCabangFilter = function (id) {
    if (!sigajiCanAssignCabang()) return;
    try {
      if (!id) sessionStorage.removeItem(CABANG_FILTER_KEY);
      else sessionStorage.setItem(CABANG_FILTER_KEY, String(id));
    } catch (e2) {}
    if (typeof renderAll === 'function') renderAll();
    else {
      try {
        if (typeof renderKar === 'function') renderKar();
        if (typeof renderPenggajian === 'function') renderPenggajian();
        if (typeof renderDash === 'function') renderDash();
      } catch (e3) {}
    }
  };

  window.sigajiFilterKaryawanByCabang = function (list) {
    if (!sigajiMultiBranchEnabled()) return list || [];
    var f = sigajiGetCabangFilter();
    if (!f) return list || [];
    return (list || []).filter(function (k) {
      return sigajiKarCabangId(k) === f;
    });
  };

  window.sigajiApplyBranchPolicyFromObject = function (lic) {
    if (!lic || typeof lic !== 'object' || typeof tenantLicense === 'undefined') return;
    if (lic.multiBranchEnabled != null)
      tenantLicense.multiBranchEnabled = !!lic.multiBranchEnabled;
    if (lic.maxBranches != null) {
      var n = parseInt(lic.maxBranches, 10);
      tenantLicense.maxBranches = n > 0 ? n : 1;
    }
  };

  window.sigajiCabangColTh = function () {
    if (!sigajiMultiBranchEnabled()) return '';
    return '<th>Cabang</th>';
  };

  window.sigajiCabangColTd = function (k) {
    if (!sigajiMultiBranchEnabled()) return '';
    var pm = sigajiKarCabangPemotongMeta(k);
    return (
      '<td><span class="bdg b-info" title="TKU: ' +
      escapeHtml(pm.idTku22 || '-') +
      '">' +
      escapeHtml(pm.cabangNama) +
      '</span></td>'
    );
  };

  window.sigajiSyncKarTableHead = function () {
    var row = document.getElementById('kar-thead-row');
    if (!row) return;
    var base =
      '<th>No</th><th>Karyawan</th><th>Tipe</th>' +
      (sigajiMultiBranchEnabled() ? '<th>Cabang</th>' : '') +
      '<th>Dept</th><th>Jabatan</th><th>Status</th><th>PTKP</th><th>Saldo Cuti</th><th>Aksi</th>';
    row.innerHTML = base;
  };

  window.sigajiSyncPgGajiTableHead = function () {
    var tables = document.querySelectorAll('#pg-penggajian table thead tr');
    if (!tables.length) return;
    var cab = sigajiMultiBranchEnabled() ? '<th>Cabang</th>' : '';
    tables[0].innerHTML =
      '<th class="pg-sticky-no">No</th><th class="pg-sticky-name">Karyawan</th>' +
      cab +
      '<th>Pro-Rata</th><th>Gross PPh</th><th class="pg-col-adv">THR</th><th class="pg-col-adv">TH Bruto</th><th class="pg-col-adv">BPJS Kar</th><th>PPh 21</th><th class="pg-col-adv">PPh Return</th><th>Neto (THP)</th><th>Status</th><th>Aksi</th>';
  };

  window.sigajiRenderCabangTopbar = function () {
    var wrap = document.getElementById('sigaji-cabang-topbar');
    if (!wrap) return;
    if (!sigajiMultiBranchEnabled() || !sigajiCanAssignCabang()) {
      wrap.style.display = 'none';
      wrap.innerHTML = '';
      return;
    }
    var list = sigajiGetCabangList();
    var cur = sigajiGetCabangFilter();
    wrap.style.display = '';
    wrap.innerHTML =
      '<label class="sigaji-cabang-lbl" for="sigaji-cabang-sel">Cabang</label>' +
      '<select id="sigaji-cabang-sel" class="toolbar-select sigaji-cabang-sel" title="Filter tampilan &amp; laporan per cabang" onchange="sigajiSetCabangFilter(this.value)">' +
      '<option value="">Semua cabang</option>' +
      list
        .map(function (c) {
          return (
            '<option value="' +
            escapeHtml(c.id) +
            '"' +
            (cur === c.id ? ' selected' : '') +
            '>' +
            escapeHtml(c.nama || c.id) +
            '</option>'
          );
        })
        .join('') +
      '</select>';
  };

  function cabangCardHtml(c, i) {
    var ro = !sigajiCanManageCabang();
    var dis = ro ? ' readonly' : '';
    return (
      '<div class="sigaji-cabang-card" data-cab-idx="' +
      i +
      '">' +
      '<div class="sigaji-cabang-card-head"><strong>' +
      escapeHtml(c.nama || 'Cabang') +
      '</strong> <span style="font-size:10px;color:#6b7280">ID: ' +
      escapeHtml(c.id) +
      '</span></div>' +
      '<div class="fg2">' +
      '<div class="fg"><label>Nama cabang</label><input class="cabang-inp-nama" data-idx="' +
      i +
      '" value="' +
      escapeHtml(c.nama || '') +
      '"' +
      dis +
      '></div>' +
      '<div class="fg"><label>Kode internal</label><input class="cabang-inp-kode" data-idx="' +
      i +
      '" value="' +
      escapeHtml(c.kode || '') +
      '"' +
      dis +
      '></div>' +
      '<div class="fg"><label>Nama pemotong (di bukti potong)</label><input class="cabang-inp-namapem" data-idx="' +
      i +
      '" value="' +
      escapeHtml(c.namaPemotong || '') +
      '" placeholder="Kosongkan = nama perusahaan"' +
      dis +
      '></div>' +
      '<div class="fg"><label>NPWP cabang</label><input class="cabang-inp-npwp" data-idx="' +
      i +
      '" value="' +
      escapeHtml(c.npwp || '') +
      '" placeholder="Kosongkan = NPWP pusat (badan sama)"' +
      dis +
      ' oninput="formatNPWP(this)"></div>' +
      '<div class="fg"><label>NITKU / Kode TKU (6 digit)</label><input class="cabang-inp-nitku" data-idx="' +
      i +
      '" value="' +
      escapeHtml(c.nitku != null ? c.nitku : '') +
      '" maxlength="6" placeholder="Wajib unik per cabang"' +
      dis +
      '></div>' +
      '<div class="fg ff"><label>Alamat pemotong</label><input class="cabang-inp-alamat" data-idx="' +
      i +
      '" value="' +
      escapeHtml(c.alamat || '') +
      '"' +
      dis +
      '></div>' +
      '<div class="fg"><label>Kota tanda tangan A1</label><input class="cabang-inp-a1kota" data-idx="' +
      i +
      '" value="' +
      escapeHtml(c.a1_kota || '') +
      '"' +
      dis +
      '></div>' +
      '<div class="fg"><label>Penandatangan A1</label><input class="cabang-inp-a1ttd" data-idx="' +
      i +
      '" value="' +
      escapeHtml(c.a1_ttd_nama || '') +
      '"' +
      dis +
      '></div>' +
      '<div class="fg"><label>Jabatan penandatangan</label><input class="cabang-inp-a1jab" data-idx="' +
      i +
      '" value="' +
      escapeHtml(c.a1_ttd_jabatan || '') +
      '"' +
      dis +
      '></div>' +
      '</div>' +
      (c.id !== 'utama' && !ro
        ? '<button type="button" class="btn btn-xs btn-r" onclick="sigajiCabangHapus(' +
          i +
          ')">Hapus cabang</button>'
        : '') +
      '</div>'
    );
  }

  window.sigajiRenderCabangMasterTab = function () {
    var tab = document.getElementById('mstab-cabang');
    var panel = document.getElementById('m-cabang');
    var on = sigajiMultiBranchEnabled();
    if (tab) tab.style.display = on && sigajiCanManageCabang() ? '' : 'none';
    if (!panel || !on) {
      if (panel) panel.innerHTML = '';
      return;
    }
    if (!sigajiCanManageCabang()) {
      panel.innerHTML =
        '<div class="info-box info-blue" style="font-size:12px">Multi-cabang aktif. HRD mengisi cabang di profil karyawan — kelola master cabang hanya Admin.</div>';
      return;
    }
    var list = sigajiEnsureCabangDefault();
    var max = sigajiMaxBranches();
    panel.innerHTML =
      '<div class="card" style="border-left:4px solid #1a56a0">' +
      '<div class="ct" style="color:#1a56a0">&#127970; Master Cabang &amp; Identitas Pemotong</div>' +
      '<div class="info-box info-blue" style="font-size:11px;margin-bottom:.75rem;line-height:1.55">' +
      '<strong>Aturan pajak:</strong> Satu badan hukum = NPWP sama, <strong>NITKU (6 digit) beda per cabang</strong>. ' +
      'e-Bupot &amp; XML Coretax memakai TKU cabang karyawan. NPWP benar-benar beda (PT terpisah) → gunakan <code>tenant_key</code> terpisah, bukan cabang.' +
      '</div>' +
      '<p style="font-size:12px;color:#374151;margin:0 0 .65rem">Maks <strong>' +
      max +
      '</strong> cabang · aktif <strong>' +
      list.filter(function (c) {
        return c && c.aktif !== false;
      }).length +
      '</strong></p>' +
      '<div class="sigaji-cabang-cards">' +
      list.map(cabangCardHtml).join('') +
      '</div>' +
      '<div class="fl gap1" style="margin-top:.75rem;flex-wrap:wrap">' +
      '<button type="button" class="btn btn-sm btn-p" onclick="sigajiCabangTambah()">+ Cabang</button>' +
      '<button type="button" class="btn btn-sm btn-out" onclick="sigajiCabangSimpan()">Simpan</button>' +
      '</div></div>';
  };

  function readCabangInputs(list) {
    document.querySelectorAll('.cabang-inp-nama').forEach(function (inp) {
      var i = parseInt(inp.getAttribute('data-idx'), 10);
      if (list[i]) list[i].nama = inp.value.trim() || list[i].nama;
    });
    document.querySelectorAll('.cabang-inp-kode').forEach(function (inp) {
      var i = parseInt(inp.getAttribute('data-idx'), 10);
      if (list[i]) list[i].kode = inp.value.trim();
    });
    document.querySelectorAll('.cabang-inp-namapem').forEach(function (inp) {
      var i = parseInt(inp.getAttribute('data-idx'), 10);
      if (list[i]) list[i].namaPemotong = inp.value.trim();
    });
    document.querySelectorAll('.cabang-inp-npwp').forEach(function (inp) {
      var i = parseInt(inp.getAttribute('data-idx'), 10);
      if (list[i]) list[i].npwp = inp.value.trim();
    });
    document.querySelectorAll('.cabang-inp-nitku').forEach(function (inp) {
      var i = parseInt(inp.getAttribute('data-idx'), 10);
      if (list[i]) list[i].nitku = inp.value.trim();
    });
    document.querySelectorAll('.cabang-inp-alamat').forEach(function (inp) {
      var i = parseInt(inp.getAttribute('data-idx'), 10);
      if (list[i]) list[i].alamat = inp.value.trim();
    });
    document.querySelectorAll('.cabang-inp-a1kota').forEach(function (inp) {
      var i = parseInt(inp.getAttribute('data-idx'), 10);
      if (list[i]) list[i].a1_kota = inp.value.trim();
    });
    document.querySelectorAll('.cabang-inp-a1ttd').forEach(function (inp) {
      var i = parseInt(inp.getAttribute('data-idx'), 10);
      if (list[i]) list[i].a1_ttd_nama = inp.value.trim();
    });
    document.querySelectorAll('.cabang-inp-a1jab').forEach(function (inp) {
      var i = parseInt(inp.getAttribute('data-idx'), 10);
      if (list[i]) list[i].a1_ttd_jabatan = inp.value.trim();
    });
    return list;
  }

  window.sigajiCabangSimpan = function () {
    if (!sigajiCanManageCabang()) {
      toast('Hanya Admin yang boleh mengelola cabang');
      return;
    }
    if (!sigajiMultiBranchEnabled()) {
      toast('Multi-cabang belum diaktifkan — hubungi penjual SiGaji');
      return;
    }
    var list = readCabangInputs(sigajiEnsureCabangDefault().slice());
    var nitkus = {};
    for (var i = 0; i < list.length; i++) {
      var nit = String(list[i].nitku || '').replace(/\D/g, '');
      while (nit.length < 6) nit = '0' + nit;
      if (nit.length > 6) nit = nit.slice(-6);
      list[i].nitku = nit;
      var np = list[i].npwp || (perusahaan && perusahaan.npwp) || '';
      var key = (typeof ebupotNpwp16 === 'function' ? ebupotNpwp16(np) : np) + ':' + nit;
      if (nitkus[key]) {
        toast('NITKU + NPWP duplikat antar cabang — setiap TKU harus unik');
        return;
      }
      nitkus[key] = true;
    }
    cabang = list;
    saveAll();
    sigajiRenderCabangMasterTab();
    sigajiRenderCabangTopbar();
    sigajiPopulateKarCabangSelect();
    toast('Data cabang & pemotong disimpan');
  };

  window.sigajiCabangTambah = function () {
    if (!sigajiCanManageCabang()) {
      toast('Hanya Admin yang boleh menambah cabang');
      return;
    }
    if (!sigajiMultiBranchEnabled()) return;
    var list = sigajiEnsureCabangDefault();
    var max = sigajiMaxBranches();
    var aktif = list.filter(function (c) {
      return c && c.aktif !== false;
    }).length;
    if (aktif >= max) {
      toast('Kuota cabang maks ' + max + ' — hubungi penjual SiGaji');
      return;
    }
    var n = list.length + 1;
    var pad = String(n).padStart(2, '0');
    list.push({
      id: 'cab' + Date.now(),
      nama: 'Cabang ' + n,
      kode: 'C' + n,
      nitku: pad + '0000',
      aktif: true,
    });
    cabang = list;
    saveAll();
    sigajiRenderCabangMasterTab();
    toast('Cabang ditambahkan — isi NITKU unik lalu Simpan');
  };

  window.sigajiCabangHapus = function (idx) {
    if (!sigajiCanManageCabang()) {
      toast('Hanya Admin yang boleh menghapus cabang');
      return;
    }
    var list = sigajiEnsureCabangDefault();
    var c = list[idx];
    if (!c || c.id === 'utama') return;
    var used = (karyawan || []).some(function (k) {
      return sigajiKarCabangId(k) === c.id;
    });
    if (used) {
      toast('Cabang masih dipakai karyawan — pindahkan dulu');
      return;
    }
    list.splice(idx, 1);
    cabang = list;
    saveAll();
    sigajiRenderCabangMasterTab();
    sigajiRenderCabangTopbar();
    toast('Cabang dihapus');
  };

  window.sigajiPopulateKarCabangSelect = function () {
    var row = document.getElementById('sp-cabang-row');
    var sel = document.getElementById('sp-cabang-f');
    if (!row || !sel) return;
    if (!sigajiMultiBranchEnabled() || !sigajiCanAssignCabang()) {
      row.style.display = 'none';
      return;
    }
    row.style.display = '';
    var list = sigajiGetCabangList();
    sel.innerHTML = list
      .map(function (c) {
        return (
          '<option value="' +
          escapeHtml(c.id) +
          '">' +
          escapeHtml(c.nama || c.id) +
          '</option>'
        );
      })
      .join('');
  };

  window.sigajiUiCabangAfterRender = function () {
    sigajiRenderCabangTopbar();
    sigajiRenderCabangMasterTab();
    sigajiPopulateKarCabangSelect();
    sigajiSyncKarTableHead();
    sigajiSyncPgGajiTableHead();
  };
})();
