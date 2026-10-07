/* SiGaji — modul produk (payroll / ERP / POS), lisensi tenant, pintasan dashboard */
(function () {
  var DEFAULT_SKUS = ['payroll'];

  function normEmail(e) {
    return String(e || '')
      .trim()
      .toLowerCase();
  }

  function parseOwnerEmails() {
    var raw =
      (typeof window !== 'undefined' && window.SIGAJI_PLATFORM_OWNER_EMAILS) ||
      '';
    var list = String(raw || '')
      .split(/[,;\s]+/)
      .map(normEmail)
      .filter(Boolean);
    var boot =
      typeof window !== 'undefined' && window.SIGAJI_BOOTSTRAP_ADMIN_EMAIL
        ? normEmail(window.SIGAJI_BOOTSTRAP_ADMIN_EMAIL)
        : '';
    if (boot && list.indexOf(boot) < 0) list.push(boot);
    return list;
  }

  function sigajiGetProductSkuCatalog() {
    if (typeof SIGAJI_PRODUCT_SKUS !== 'undefined' && SIGAJI_PRODUCT_SKUS.length) {
      return SIGAJI_PRODUCT_SKUS;
    }
    return [
      { id: 'payroll', lbl: 'Payroll & SDM', desc: 'Penggajian, absensi, PPh, slip gaji' },
      { id: 'erp', lbl: 'ERP Toko', desc: 'Master barang, stok, pembelian' },
      { id: 'pos_web', lbl: 'Kasir Web', desc: 'Penjualan di browser (PC/tablet toko)' },
      { id: 'pos_android', lbl: 'Kasir Android', desc: 'App POS + cetak USB / Bluetooth' },
      { id: 'akuntansi', lbl: 'Akuntansi lite', desc: 'Jurnal otomatis & laporan sederhana' },
    ];
  }

  function sigajiNormalizeEnabledModules(arr) {
    var catalog = sigajiGetProductSkuCatalog();
    var valid = {};
    catalog.forEach(function (s) {
      valid[s.id] = 1;
    });
    var src = Array.isArray(arr) ? arr : [];
    var out = [];
    src.forEach(function (id) {
      id = String(id || '').trim();
      if (id && valid[id] && out.indexOf(id) < 0) out.push(id);
    });
    if (!out.length) return DEFAULT_SKUS.slice();
    return out;
  }

  function sigajiGetEnabledProductSkus() {
    if (typeof tenantLicense === 'undefined' || !tenantLicense) {
      return DEFAULT_SKUS.slice();
    }
    if (!tenantLicense.enabledModules) {
      tenantLicense.enabledModules = DEFAULT_SKUS.slice();
    }
    tenantLicense.enabledModules = sigajiNormalizeEnabledModules(tenantLicense.enabledModules);
    return tenantLicense.enabledModules.slice();
  }

  function sigajiIsProductSkuEnabled(sku) {
    var s = String(sku || '').trim();
    if (!s || s === 'core') return true;
    return sigajiGetEnabledProductSkus().indexOf(s) >= 0;
  }

  function sigajiModuleProductSku(moduleId) {
    if (typeof SIGAJI_MODULE_PRODUCT_SKU === 'object' && SIGAJI_MODULE_PRODUCT_SKU) {
      if (SIGAJI_MODULE_PRODUCT_SKU[moduleId]) return SIGAJI_MODULE_PRODUCT_SKU[moduleId];
    }
    if (moduleId === 'langganan') return 'core';
    if (moduleId === 'kasir') return 'pos_web';
    if (moduleId === 'erp') return 'erp';
    if (moduleId === 'akuntansi') return 'akuntansi';
    return 'payroll';
  }

  function sigajiIsModuleLicensed(moduleId) {
    if (moduleId === 'langganan') {
      return typeof CU !== 'undefined' && CU && CU.role === 'Admin';
    }
    return sigajiIsProductSkuEnabled(sigajiModuleProductSku(moduleId));
  }

  function sigajiIsPlatformOwner() {
    if (typeof CU === 'undefined' || !CU) return false;
    var owners = parseOwnerEmails();
    if (!owners.length) {
      return CU.role === 'Admin';
    }
    var em = normEmail(CU.email || CU.username || '');
    if (!em) return false;
    return owners.indexOf(em) >= 0;
  }

  function sigajiApplyRoleChrome() {
    try {
      if (!CU) return;
      document.body.dataset.sigajiRole = CU.role || '';
      document.body.classList.toggle('sigaji-role-kasir', CU.role === 'Kasir');
    } catch (e) {
      sigajiCatchWarn('js/modules/app-products.js', e);
    }
  }

  function sigajiRenderDashboardProductShortcuts() {
    var el = document.getElementById('dash-product-shortcuts');
    if (!el || typeof CU === 'undefined' || !CU) return;
    if (CU.role === 'Kasir') {
      el.innerHTML = '';
      el.classList.add('u-hidden');
      return;
    }
    var skus = sigajiGetEnabledProductSkus();
    var cards = [];
    if (CU.role === 'Admin' || CU.role === 'HRD') {
      if (sigajiIsProductSkuEnabled('payroll') && typeof canAccessModule === 'function' && canAccessModule('dashboard')) {
        cards.push({
          title: 'Payroll & SDM',
          desc: 'Proses gaji, absensi, laporan',
          pg: 'penggajian',
          btn: 'Buka Proses Gaji',
        });
      }
    }
    if (sigajiIsProductSkuEnabled('erp') && typeof canAccessModule === 'function' && canAccessModule('erp')) {
      cards.push({
        title: 'ERP Toko',
        desc: 'Barang, stok, pembelian',
        pg: 'erp',
        btn: 'Buka ERP',
      });
    }
    if (sigajiIsProductSkuEnabled('pos_web') && typeof canAccessModule === 'function' && canAccessModule('kasir')) {
      cards.push({
        title: 'Kasir (Web)',
        desc: 'Layar penjualan — bookmark untuk meja kasir',
        pg: 'kasir',
        btn: 'Buka Kasir',
      });
    }
    if (sigajiIsProductSkuEnabled('pos_android')) {
      cards.push({
        title: 'Kasir Android',
        desc: 'App POS + cetak USB/BT per mesin kasir (rilis berikutnya)',
        pg: '',
        btn: '',
        static: true,
      });
    }
    if (CU.role === 'Admin' && typeof canAccessModule === 'function' && canAccessModule('langganan')) {
      cards.push({
        title: 'Modul aktif',
        desc: 'Lihat paket langganan tenant ini',
        pg: 'langganan',
        btn: 'Kelola / lihat',
      });
    }
    if (cards.length < 2) {
      el.innerHTML = '';
      el.classList.add('u-hidden');
      return;
    }
    el.classList.remove('u-hidden');
    el.innerHTML =
      '<div class="sigaji-product-shortcuts-head">Pintasan modul</div><div class="sigaji-product-shortcuts-grid">' +
      cards
        .map(function (c) {
          if (c.static) {
            return (
              '<div class="sigaji-product-card sigaji-product-card-muted">' +
              '<div class="sigaji-product-card-title">' +
              escapeHtml(c.title) +
              '</div><p class="sigaji-product-card-desc">' +
              escapeHtml(c.desc) +
              '</p><span class="bdg b-info">Segera</span></div>'
            );
          }
          return (
            '<div class="sigaji-product-card">' +
            '<div class="sigaji-product-card-title">' +
            escapeHtml(c.title) +
            '</div><p class="sigaji-product-card-desc">' +
            escapeHtml(c.desc) +
            '</p><button type="button" class="btn btn-sm btn-p" data-sigaji-action="invoke" data-fn="showPg" data-arg="' +
            escapeAttr(c.pg) +
            '">' +
            escapeHtml(c.btn) +
            '</button></div>'
          );
        })
        .join('') +
      '</div>';
  }

  function sigajiRenderLanggananPage() {
    var wrap = document.getElementById('langganan-cards');
    if (!wrap) return;
    var skus = sigajiGetEnabledProductSkus();
    var catalog = sigajiGetProductSkuCatalog();
    var owner = sigajiIsPlatformOwner();
    var edit = document.getElementById('langganan-owner-edit');
    if (edit) edit.classList.toggle('u-hidden', !owner);

    wrap.innerHTML = catalog
      .map(function (s) {
        var on = skus.indexOf(s.id) >= 0;
        return (
          '<div class="sigaji-product-card ' +
          (on ? 'sigaji-product-card-on' : 'sigaji-product-card-off') +
          '">' +
          '<div class="flb items-start gap1">' +
          '<div><div class="sigaji-product-card-title">' +
          escapeHtml(s.lbl) +
          '</div><p class="sigaji-product-card-desc">' +
          escapeHtml(s.desc || '') +
          '</p></div>' +
          '<span class="bdg ' +
          (on ? 'b-ok' : 'b-gray') +
          '">' +
          (on ? 'Aktif' : 'Nonaktif') +
          '</span></div></div>'
        );
      })
      .join('');

    if (owner) {
      var form = document.getElementById('langganan-owner-form');
      if (form) {
        catalog.forEach(function (s) {
          var cb = document.getElementById('lic-sku-' + s.id);
          if (cb) cb.checked = skus.indexOf(s.id) >= 0;
        });
        var me = document.getElementById('lic-max-kasir');
        if (me && tenantLicense) {
          me.value = String(parseInt(tenantLicense.maxPosUsers, 10) > 0 ? tenantLicense.maxPosUsers : 5);
        }
        var plan = document.getElementById('lic-plan-label');
        if (plan && tenantLicense) plan.value = tenantLicense.planLabel || '';
      }
    }

    var hint = document.getElementById('langganan-readonly-hint');
    if (hint) {
      hint.textContent = owner
        ? 'Anda login sebagai pemilik platform — centang modul untuk pelanggan ini lalu Simpan.'
        : 'Daftar modul yang aktif untuk perusahaan Anda. Untuk menambah modul, hubungi penyedia SiGaji.';
    }
  }

  function sigajiSaveTenantModulesFromForm() {
    if (!sigajiIsPlatformOwner()) {
      toast('Hanya pemilik platform yang boleh mengubah modul pelanggan.');
      return;
    }
    if (typeof tenantLicense === 'undefined') return;
    var catalog = sigajiGetProductSkuCatalog();
    var next = [];
    catalog.forEach(function (s) {
      var cb = document.getElementById('lic-sku-' + s.id);
      if (cb && cb.checked) next.push(s.id);
    });
    tenantLicense.enabledModules = sigajiNormalizeEnabledModules(next);
    var mk = document.getElementById('lic-max-kasir');
    if (mk) tenantLicense.maxPosUsers = Math.max(1, parseInt(mk.value, 10) || 5);
    var pl = document.getElementById('lic-plan-label');
    if (pl) tenantLicense.planLabel = String(pl.value || '').trim();
    saveAll();
    renderSidebar();
    sigajiRenderLanggananPage();
    sigajiRenderDashboardProductShortcuts();
    toast('Modul langganan disimpan untuk tenant ini');
  }

  function sigajiRenderKasirPage() {
    var el = document.getElementById('kasir-pos-root');
    if (!el) return;
    var cab =
      typeof sigajiGetActiveCabangLabel === 'function'
        ? sigajiGetActiveCabangLabel()
        : perusahaan && perusahaan.nama
          ? perusahaan.nama
          : 'Toko';
    el.innerHTML =
      '<div class="sigaji-kasir-mock">' +
      '<div class="sigaji-kasir-mock-head"><div><strong>Kasir Web</strong><span class="u-muted-12 ml-sm">' +
      escapeHtml(cab) +
      '</span></div><span class="bdg b-warn">Preview UI</span></div>' +
      '<p class="u-muted-12">Layar penuh untuk meja kasir — scan/barcode, keranjang, bayar, cetak nota (fase berikutnya). Login user role <strong>Kasir</strong> langsung masuk ke sini.</p>' +
      '<div class="sigaji-kasir-mock-grid">' +
      '<div class="sigaji-kasir-panel"><div class="sigaji-kasir-panel-title">Keranjang</div><div class="sigaji-kasir-empty">Belum ada item — modul stok &amp; harga akan terhubung dari ERP.</div></div>' +
      '<div class="sigaji-kasir-panel sigaji-kasir-panel-numpad">' +
      '<div class="sigaji-kasir-total">Rp 0</div>' +
      '<button type="button" class="btn btn-p btn-full" disabled>Bayar (segera)</button>' +
      '<button type="button" class="btn btn-out btn-full" disabled>Cetak nota — per kasir USB/BT di Android</button>' +
      '</div></div></div>';
  }

  function sigajiRenderErpPage() {
    var el = document.getElementById('erp-root');
    if (!el) return;
    el.innerHTML =
      '<div class="card p-md">' +
      '<p><strong>ERP Toko (MVP)</strong> — master barang, stok per cabang, pembelian, dan penjualan akan dibangun di modul ini.</p>' +
      '<ul class="u-muted-12"><li>Barang &amp; harga jual/grosir</li><li>Stok masuk (beli) / keluar (kasir)</li><li>Laporan penjualan harian</li></ul>' +
      '</div>';
  }

  if (typeof window !== 'undefined') {
    window.sigajiGetEnabledProductSkus = sigajiGetEnabledProductSkus;
    window.sigajiIsProductSkuEnabled = sigajiIsProductSkuEnabled;
    window.sigajiModuleProductSku = sigajiModuleProductSku;
    window.sigajiIsModuleLicensed = sigajiIsModuleLicensed;
    window.sigajiIsPlatformOwner = sigajiIsPlatformOwner;
    window.sigajiNormalizeEnabledModules = sigajiNormalizeEnabledModules;
    window.sigajiApplyRoleChrome = sigajiApplyRoleChrome;
    window.sigajiRenderDashboardProductShortcuts = sigajiRenderDashboardProductShortcuts;
    window.sigajiRenderLanggananPage = sigajiRenderLanggananPage;
    window.sigajiSaveTenantModulesFromForm = sigajiSaveTenantModulesFromForm;
    window.sigajiRenderKasirPage = sigajiRenderKasirPage;
    window.sigajiRenderErpPage = sigajiRenderErpPage;
  }
})();
