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

  function isUtamaCabang(c, i) {
    return !!(c && (c.id === 'utama' || i === 0));
  }

  function migrateCabangTaxFields(list) {
    var prs = typeof perusahaan !== 'undefined' ? perusahaan : {};
    return (list || []).map(function (c, i) {
      if (!c || typeof c !== 'object') return c;
      var out = Object.assign({}, c);
      if (isUtamaCabang(out, i)) {
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
      return out;
    });
  }

  window.sigajiInBranchWorkspace = function () {
    return !!(sigajiMultiBranchEnabled() && sigajiGetCabangFilter());
  };

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

  /** Prefiks NIK internal cabang (bukan pusat): C2-K0001 — urutan terpisah per lokasi */
  window.sigajiBranchNikPrefix = function (cabangId) {
    if (!cabangId || cabangId === 'utama') return '';
    var c = sigajiCabangById(cabangId);
    var k = String((c && c.kode) || '')
      .replace(/[^A-Za-z0-9]/g, '')
      .toUpperCase();
    if (!k) k = 'CB';
    return k.slice(0, 6) + '-';
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
    var isUtama = !cabangId || cabangId === 'utama' || c.id === 'utama';
    var nitku = String(c.nitku != null ? c.nitku : '').trim();
    if (!nitku && isUtama) nitku = String(prs.nitku || '').trim() || '000000';
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
    } catch(e2){sigajiCatchWarn("js/modules/sigaji-cabang.js",e2);}
    sigajiUpdateWorkspaceChrome();
    if (id && typeof showPg === 'function') showPg('dashboard');
    else if (typeof renderAll === 'function') renderAll();
    else {
      try {
        if (typeof renderKar === 'function') renderKar();
        if (typeof renderPenggajian === 'function') renderPenggajian();
        if (typeof renderDash === 'function') renderDash();
      } catch(e3){sigajiCatchWarn("js/modules/sigaji-cabang.js",e3);}
    }
    if (id) {
      var c = sigajiCabangById(id);
      toast(
        'Workspace: ' +
          (c ? c.nama || id : id) +
          ' — data payroll & laporan hanya untuk lokasi ini'
      );
    } else if (sigajiMultiBranchEnabled()) toast('Mode gabungan — semua lokasi');
  };

  window.sigajiBranchKarCount = function (cabangId) {
    if (!cabangId) return (karyawan || []).length;
    return (karyawan || []).filter(function (k) {
      return sigajiKarCabangId(k) === cabangId;
    }).length;
  };

  window.sigajiUpdateWorkspaceChrome = function () {
    sigajiRenderCabangTopbar();
    sigajiRenderBranchWorkspaceBanner();
    sigajiSyncKarTableHead();
    sigajiSyncPgGajiTableHead();
    var tn = document.getElementById('topbar-nama');
    if (!tn || !sigajiMultiBranchEnabled()) return;
    var f = sigajiGetCabangFilter();
    var base =
      (typeof perusahaan !== 'undefined' && perusahaan && perusahaan.nama) || 'SiGaji';
    if (f) {
      var c = sigajiCabangById(f);
      tn.textContent = base + ' · ' + (c ? c.nama || f : f);
      tn.title = 'Workspace cabang aktif — klik Lokasi di toolbar untuk ganti';
    } else {
      tn.textContent = base;
      tn.title = '';
      if (typeof applyBranding === 'function') applyBranding();
    }
  };

  window.sigajiRenderBranchWorkspaceBanner = function () {
    var el = document.getElementById('sigaji-branch-workspace-banner');
    if (!el) return;
    var f = sigajiGetCabangFilter();
    if (!f || !sigajiMultiBranchEnabled()) {
      el.style.display = 'none';
      el.innerHTML = '';
      return;
    }
    var c = sigajiCabangById(f);
    var nama = c ? c.nama || f : f;
    var nKar = sigajiBranchKarCount(f);
    var nitku = c && c.nitku != null ? String(c.nitku).trim() : '';
    el.style.display = '';
    var h =
      '<div class="sigaji-branch-ws-inner">' +
      '<div class="sigaji-branch-ws-title">&#127970; Workspace: <strong>' +
      escapeHtml(nama) +
      '</strong></div>' +
      '<div class="sigaji-branch-ws-desc">Payroll, karyawan, dan laporan di halaman ini hanya untuk cabang ini — terpisah dari lokasi lain.' +
      (nitku ? ' NITKU: <code>' + escapeHtml(nitku) + '</code>.' : ' <span style="color:#b45309">NITKU belum diisi — Admin isi di Master → Daftar Cabang.</span>') +
      '</div>' +
      (nKar
        ? '<div class="sigaji-branch-ws-meta">' +
          String(nKar) +
          ' karyawan · NIK otomatis: <code>' +
          escapeHtml(
            (typeof sigajiBranchNikPrefix === 'function'
              ? sigajiBranchNikPrefix(f)
              : '') + 'K0001'
          ) +
          '</code> (terpisah dari pusat)</div>'
        : '<div class="sigaji-branch-ws-empty">' +
          'Belum ada karyawan di cabang ini. NIK dimulai dari <code>' +
          escapeHtml(
            (typeof sigajiBranchNikPrefix === 'function'
              ? sigajiBranchNikPrefix(f)
              : '') + 'K0001'
          ) +
          ' — tidak melanjutkan nomor kantor pusat.' +
          ' <button type="button" class="btn btn-xs btn-p"' + sigajiDataAction('open-new-kar', { tipe: 'tetap' }) + '>+ Pegawai</button>' +
          ' <button type="button" class="btn btn-xs btn-out"' + sigajiDataAction('invoke', { fn: 'sigajiSetCabangFilter', arg: '' }) + '>Kembali gabungan</button>' +
          '</div>') +
      '</div>';
    el.innerHTML = h;
  };

  window.sigajiTogglePrsNitkuField = function () {
    var row = document.getElementById('prs-nitku-row');
    var hint = document.getElementById('prs-nitku-cabang-hint');
    var on = sigajiMultiBranchEnabled();
    if (row) row.style.display = on ? 'none' : '';
    if (hint) hint.style.display = on ? '' : 'none';
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
    if (!sigajiMultiBranchEnabled() || sigajiInBranchWorkspace()) return '';
    return '<th>Lokasi</th>';
  };

  window.sigajiCabangColTd = function (k) {
    if (!sigajiMultiBranchEnabled() || sigajiInBranchWorkspace()) return '';
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
    var thead =
      '<th>No</th><th>Karyawan</th><th>Tipe</th>' +
      (sigajiMultiBranchEnabled() && !sigajiInBranchWorkspace() ? '<th>Lokasi</th>' : '') +
      '<th>Dept</th><th>Jabatan</th><th>Status</th><th>PTKP</th><th>Saldo Cuti</th><th>Aksi</th>';
    row.innerHTML = thead;
  };

  window.sigajiSyncPgGajiTableHead = function () {
    var tables = document.querySelectorAll('#pg-penggajian table thead tr');
    if (!tables.length) return;
    var cab =
      sigajiMultiBranchEnabled() && !sigajiInBranchWorkspace() ? '<th>Lokasi</th>' : '';
    var thead =
      '<th class="pg-sticky-no">No</th><th class="pg-sticky-name">Karyawan</th>' +
      cab +
      '<th>Pro-Rata</th><th>Gross PPh</th><th class="pg-col-adv">THR</th><th class="pg-col-adv">TH Bruto</th><th class="pg-col-adv">BPJS Kar</th><th>PPh 21</th><th class="pg-col-adv">PPh Return</th><th>Neto (THP)</th><th>Status</th><th>Aksi</th>';
    tables[0].innerHTML = thead;
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
      '<label class="sigaji-cabang-lbl" for="sigaji-cabang-sel">Lokasi</label>' +
      '<select id="sigaji-cabang-sel" class="toolbar-select sigaji-cabang-sel' +
      (cur ? ' sigaji-cabang-sel-active' : '') +
      '" title="Buka workspace cabang — data payroll terpisah per lokasi" onchange="sigajiSetCabangFilter(this.value)">' +
      '<option value="">Gabungan (semua)</option>' +
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
      '</strong> <span class="u-muted-10">ID: ' +
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
        ? '<button type="button" class="btn btn-xs btn-r"' + sigajiDataAction('invoke', { fn: 'sigajiCabangHapus', arg: String(i) }) + '>Hapus cabang</button>'
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
        '<div class="info-box info-blue font-12">Multi-cabang aktif. HRD mengisi cabang di profil karyawan — kelola master cabang hanya Admin.</div>';
      return;
    }
    var list = sigajiEnsureCabangDefault();
    var max = sigajiMaxBranches();
    var h =
      '<div class="card border-accent-left">' +
      '<div class="ct ct-brand">&#127970; Master Cabang &amp; Identitas Pemotong</div>' +
      '<div class="info-box info-blue font-11 tabs-spaced-lg leading-tight">' +
      '<strong>Aturan pajak:</strong> Satu badan hukum = NPWP sama, <strong>NITKU (6 digit) beda per cabang</strong>. ' +
      'e-Bupot &amp; XML Coretax memakai TKU cabang karyawan. NPWP benar-benar beda (PT terpisah) → gunakan <code>tenant_key</code> terpisah, bukan cabang.' +
      '</div>' +
      '<p class="font-12 text-body" style="margin:0 0 .65rem">Maks <strong>' +
      String(max) +
      '</strong> cabang · aktif <strong>' +
      String(list.filter(function (c) {
        return c && c.aktif !== false;
      }).length) +
      '</strong></p>' +
      '<div class="sigaji-cabang-cards">' +
      list.map(cabangCardHtml).join('') +
      '</div>' +
      '<div class="fl gap1 mt-lg flex-wrap">' +
      '<button type="button" class="btn btn-sm btn-p"' + sigajiDataAction('invoke', { fn: 'sigajiCabangTambah' }) + '>+ Cabang</button>' +
      '<button type="button" class="btn btn-sm btn-out"' + sigajiDataAction('invoke', { fn: 'sigajiCabangSimpan' }) + '>Simpan</button>' +
      '</div></div>';
    panel.innerHTML = h;
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
      if (!nit && list[i].id !== 'utama') {
        toast('NITKU wajib diisi untuk setiap cabang (bukan pusat)');
        return;
      }
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
    sigajiUpdateWorkspaceChrome();
    sigajiRenderCabangMasterTab();
    sigajiPopulateKarCabangSelect();
    sigajiTogglePrsNitkuField();
  };
})();
