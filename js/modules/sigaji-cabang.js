/* SiGaji — multi-cabang (diaktifkan creator/penjual, dikelola Admin/HRD) */
(function () {
  var CABANG_FILTER_KEY = 'sigaji_cabang_filter';

  function creatorEmails() {
    return String(window.SIGAJI_CREATOR_EMAILS || '')
      .split(/[,;]/)
      .map(function (s) {
        return s.trim().toLowerCase();
      })
      .filter(Boolean);
  }

  window.sigajiIsCreator = function () {
    if (typeof CU === 'undefined' || !CU) return false;
    var emails = creatorEmails();
    if (!emails.length) return false;
    var me = String(CU.email || CU.username || '')
      .trim()
      .toLowerCase();
    return emails.indexOf(me) >= 0;
  };

  function configBranchEnabled() {
    return !!(
      typeof window.SIGAJI_MULTI_BRANCH_ENABLED !== 'undefined' &&
      window.SIGAJI_MULTI_BRANCH_ENABLED
    );
  }

  function configMaxBranches() {
    var n = parseInt(window.SIGAJI_MAX_BRANCHES, 10);
    return n > 0 ? n : 0;
  }

  window.sigajiMultiBranchEnabled = function () {
    if (configBranchEnabled()) return true;
    if (typeof tenantLicense !== 'undefined' && tenantLicense) {
      return !!tenantLicense.multiBranchEnabled;
    }
    return false;
  };

  window.sigajiMaxBranches = function () {
    var cfg = configMaxBranches();
    if (cfg > 0) return cfg;
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
    if (!sigajiMultiBranchEnabled()) return '';
    try {
      return String(sessionStorage.getItem(CABANG_FILTER_KEY) || '').trim();
    } catch (e) {
      return '';
    }
  };

  window.sigajiSetCabangFilter = function (id) {
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
    if (configBranchEnabled()) {
      tenantLicense.multiBranchEnabled = true;
      if (configMaxBranches() > 0) tenantLicense.maxBranches = configMaxBranches();
    } else {
      if (lic.multiBranchEnabled != null)
        tenantLicense.multiBranchEnabled = !!lic.multiBranchEnabled;
      if (lic.maxBranches != null) {
        var n = parseInt(lic.maxBranches, 10);
        tenantLicense.maxBranches = n > 0 ? n : 1;
      }
    }
  };

  window.sigajiRenderCabangTopbar = function () {
    var wrap = document.getElementById('sigaji-cabang-topbar');
    if (!wrap) return;
    if (!sigajiMultiBranchEnabled()) {
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
    var on = sigajiMultiBranchEnabled();
    if (tab) tab.style.display = on ? '' : 'none';
    if (!panel || !on) return;
    var list = sigajiEnsureCabangDefault();
    var max = sigajiMaxBranches();
    panel.innerHTML =
      '<div class="card" style="border-left:4px solid #1a56a0">' +
      '<div class="ct" style="color:#1a56a0">&#127970; Master Cabang</div>' +
      '<p style="font-size:12px;color:#374151;margin:0 0 .75rem">Satu perusahaan — beberapa cabang/lokasi. Filter cabang di topbar memengaruhi tabel karyawan, penggajian, dan dashboard.</p>' +
      '<div class="info-box info-blue" style="font-size:11px;margin-bottom:.75rem">Maks <strong>' +
      max +
      '</strong> cabang (diatur penjual SiGaji). Aktif: <strong>' +
      list.filter(function (c) {
        return c && c.aktif !== false;
      }).length +
      '</strong>.</div>' +
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
    if (!sigajiMultiBranchEnabled()) {
      toast('Multi-cabang belum diaktifkan penjual');
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
    if (!sigajiMultiBranchEnabled()) {
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

  window.sigajiRenderCreatorBranchPanel = function () {
    var el = document.getElementById('creator-branch-panel');
    if (!el) return;
    if (!sigajiIsCreator()) {
      el.style.display = 'none';
      return;
    }
    el.style.display = '';
    var on = sigajiMultiBranchEnabled();
    var max = sigajiMaxBranches();
    el.innerHTML =
      '<div class="card" style="border-left:4px solid #7c3aed">' +
      '<div class="ct" style="color:#5b21b6">&#128272; Multi-cabang (khusus Creator)</div>' +
      '<p style="font-size:12px;color:#374151;margin:0 0 .65rem">Hanya <strong>Anda (penjual/creator)</strong> yang bisa mengaktifkan fitur ini — Admin perusahaan tidak bisa. Setelah aktif, Admin/HRD mengelola daftar cabang di Master → Cabang.</p>' +
      '<div class="fg2" style="align-items:flex-end">' +
      '<label style="display:flex;align-items:center;gap:.45rem;font-size:13px;cursor:pointer">' +
      '<input type="checkbox" id="creator-mb-enabled"' +
      (on ? ' checked' : '') +
      ' style="width:16px;height:16px;accent-color:#5b21b6"> Aktifkan multi-cabang tenant ini</label>' +
      '<div class="fg"><label>Maks cabang</label><input type="number" id="creator-mb-max" min="1" max="99" value="' +
      max +
      '" style="max-width:88px"></div>' +
      '<button type="button" class="btn btn-sm btn-p" onclick="sigajiCreatorSaveBranchPolicy()">Simpan ke cloud</button>' +
      '</div>' +
      '<div id="creator-mb-status" style="font-size:11px;color:#6b7280;margin-top:.5rem"></div></div>';
  };

  window.sigajiCreatorSaveBranchPolicy = async function () {
    if (!sigajiIsCreator()) {
      toast('Hanya creator');
      return;
    }
    var en = !!(document.getElementById('creator-mb-enabled') && document.getElementById('creator-mb-enabled').checked);
    var max = parseInt(
      document.getElementById('creator-mb-max') && document.getElementById('creator-mb-max').value,
      10
    );
    if (!max || max < 1) max = 1;
    var st = document.getElementById('creator-mb-status');
    if (st) st.textContent = 'Menyimpan…';
    try {
      var t =
        typeof getCloudAccessToken === 'function' ? await getCloudAccessToken() : '';
      if (!t) {
        if (st) st.textContent = 'Login cloud diperlukan.';
        toast('Login Supabase diperlukan');
        return;
      }
      var r = await fetch(
        (typeof sigajiFunctionUrl === 'function'
          ? sigajiFunctionUrl('branch-policy-set')
          : '/api/branch-policy-set'),
        {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            authorization: 'Bearer ' + t,
          },
          body: JSON.stringify({
            multiBranchEnabled: en,
            maxBranches: max,
          }),
        }
      );
      var j = await r.json().catch(function () {
        return null;
      });
      if (!r.ok || !j || !j.ok) {
        var err = (j && j.error) || 'Gagal menyimpan';
        if (st) st.textContent = err;
        toast(err);
        return;
      }
      if (typeof tenantLicense !== 'undefined') {
        tenantLicense.multiBranchEnabled = en;
        tenantLicense.maxBranches = max;
      }
      if (typeof window.sigajiApplyBranchPolicyFromObject === 'function') {
        window.sigajiApplyBranchPolicyFromObject({
          multiBranchEnabled: en,
          maxBranches: max,
        });
      }
      if (en) sigajiEnsureCabangDefault();
      saveAll();
      sigajiRenderCreatorBranchPanel();
      sigajiRenderCabangTopbar();
      sigajiRenderCabangMasterTab();
      sigajiPopulateKarCabangSelect();
      if (st) st.textContent = 'Tersimpan. Minta Admin refresh (F5) di perangkat lain.';
      toast('Kebijakan multi-cabang disimpan');
    } catch (e) {
      if (st) st.textContent = String(e.message || e);
      toast('Gagal: ' + (e.message || e));
    }
  };

  window.sigajiUiCabangAfterRender = function () {
    sigajiRenderCabangTopbar();
    sigajiRenderCabangMasterTab();
    sigajiRenderCreatorBranchPanel();
    sigajiPopulateKarCabangSelect();
  };
})();
