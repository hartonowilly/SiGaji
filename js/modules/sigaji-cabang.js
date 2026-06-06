/* SiGaji — multi-cabang: kebijakan hanya via SQL Supabase (penjual); Admin kelola; HRD isi profil */
(function () {
  var CABANG_FILTER_KEY = 'sigaji_cabang_filter';

  window.sigajiCanManageCabang = function () {
    return typeof CU !== 'undefined' && CU && CU.role === 'Admin';
  };

  /** HRD + Admin boleh pilih cabang di profil karyawan & filter topbar */
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
      '<select id="sigaji-cabang-sel" class="toolbar-select sigaji-cabang-sel" title="Filter tampilan per cabang" onchange="sigajiSetCabangFilter(this.value)">' +
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

  window.sigajiRenderCabangMasterTab = function () {
    var tab = document.getElementById('mstab-cabang');
    var panel = document.getElementById('m-cabang');
    var on = sigajiMultiBranchEnabled() && sigajiCanManageCabang();
    if (tab) tab.style.display = on ? '' : 'none';
    if (!panel || !on) {
      if (panel) panel.innerHTML = '';
      return;
    }
    var list = sigajiEnsureCabangDefault();
    var max = sigajiMaxBranches();
    panel.innerHTML =
      '<div class="card" style="border-left:4px solid #1a56a0">' +
      '<div class="ct" style="color:#1a56a0">&#127970; Master Cabang</div>' +
      '<p style="font-size:12px;color:#374151;margin:0 0 .75rem">Kelola cabang perusahaan. Fitur &amp; kuota diaktifkan penjual SiGaji lewat Supabase (bukan dari aplikasi).</p>' +
      '<div class="info-box info-blue" style="font-size:11px;margin-bottom:.75rem">Maks <strong>' +
      max +
      '</strong> cabang · aktif <strong>' +
      list.filter(function (c) {
        return c && c.aktif !== false;
      }).length +
      '</strong>. HRD hanya mengisi cabang di profil karyawan.</div>' +
      '<div class="table-wrap"><table><thead><tr><th>Nama</th><th>Kode</th><th>Status</th><th></th></tr></thead><tbody id="tb-cabang"></tbody></table></div>' +
      '<div class="fl gap1" style="margin-top:.65rem;flex-wrap:wrap">' +
      '<button type="button" class="btn btn-sm btn-p" onclick="sigajiCabangTambah()">+ Cabang</button>' +
      '<button type="button" class="btn btn-sm btn-out" onclick="sigajiCabangSimpan()">Simpan</button>' +
      '</div></div>';
    var tb = document.getElementById('tb-cabang');
    if (!tb) return;
    tb.innerHTML = list
      .map(function (c, i) {
        return (
          '<tr><td><input class="cabang-inp-nama" data-idx="' +
          i +
          '" value="' +
          escapeHtml(c.nama || '') +
          '" style="width:100%"></td><td><input class="cabang-inp-kode" data-idx="' +
          i +
          '" value="' +
          escapeHtml(c.kode || '') +
          '" style="width:72px"></td><td>' +
          (c.aktif !== false
            ? '<span class="bdg b-ok">Aktif</span>'
            : '<span class="bdg b-gray">Nonaktif</span>') +
          '</td><td>' +
          (c.id !== 'utama'
            ? '<button type="button" class="btn btn-xs btn-r" onclick="sigajiCabangHapus(' +
              i +
              ')">Hapus</button>'
            : '<span style="font-size:10px;color:#9ca3af">Pusat</span>') +
          '</td></tr>'
        );
      })
      .join('');
  };

  window.sigajiCabangSimpan = function () {
    if (!sigajiCanManageCabang()) {
      toast('Hanya Admin yang boleh mengelola cabang');
      return;
    }
    if (!sigajiMultiBranchEnabled()) {
      toast('Multi-cabang belum diaktifkan — hubungi penjual SiGaji');
      return;
    }
    var list = sigajiEnsureCabangDefault().slice();
    document.querySelectorAll('.cabang-inp-nama').forEach(function (inp) {
      var i = parseInt(inp.getAttribute('data-idx'), 10);
      if (list[i]) list[i].nama = inp.value.trim() || list[i].nama;
    });
    document.querySelectorAll('.cabang-inp-kode').forEach(function (inp) {
      var j = parseInt(inp.getAttribute('data-idx'), 10);
      if (list[j]) list[j].kode = inp.value.trim();
    });
    cabang = list;
    saveAll();
    sigajiRenderCabangMasterTab();
    sigajiRenderCabangTopbar();
    sigajiPopulateKarCabangSelect();
    toast('Cabang disimpan');
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
    list.push({
      id: 'cab' + Date.now(),
      nama: 'Cabang ' + n,
      kode: 'C' + n,
      aktif: true,
    });
    cabang = list;
    saveAll();
    sigajiRenderCabangMasterTab();
    toast('Cabang ditambahkan — isi nama lalu Simpan');
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
  };
})();
