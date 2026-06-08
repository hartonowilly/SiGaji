/* SiGaji — UX Web HRD: periode sticky, sync cloud, skeleton, empty state */
(function () {
  var _syncHideT = null;
  var _saveHideT = null;
  var _pgGajiCols = 'ringkas';
  var _cloudLoadCount = 0;
  var _cloudLoadFailsafe = null;
  var CLOUD_LOAD_TIMEOUT_MS = 45000;

  function el(id) {
    return document.getElementById(id);
  }

  window.sigajiEmptyState = function (opts) {
    opts = opts || {};
    var btn = '';
    if (opts.btnLabel && (opts.btnAction || opts.btnOnclick)) {
      var actAttrs = opts.btnAction
        ? sigajiDataAction('invoke', { fn: opts.btnAction, arg: opts.btnActionArg || '' })
        : ' onclick="' + opts.btnOnclick + '"';
      btn =
        '<button type="button" class="btn btn-sm btn-p sigaji-empty-btn"' +
        actAttrs +
        '>' +
        escapeHtml(opts.btnLabel) +
        '</button>';
    }
    var iconHtml = opts.icon || '&#128196;';
    if (opts.illust && typeof sigajiEmptyIllustSvg === 'function') {
      iconHtml = sigajiEmptyIllustSvg(opts.illust);
    }
    return (
      '<div class="sigaji-empty">' +
      '<div class="sigaji-empty-icon" aria-hidden="true">' +
      iconHtml +
      '</div>' +
      '<div class="sigaji-empty-title">' +
      escapeHtml(opts.title || 'Belum ada data') +
      '</div>' +
      (opts.desc
        ? '<p class="sigaji-empty-desc">' + escapeHtml(opts.desc) + '</p>'
        : '') +
      btn +
      '</div>'
    );
  };

  window.sigajiSkeleton = function (kind) {
    if (kind === 'table') {
      return (
        '<div class="sigaji-skeleton-wrap" aria-busy="true" aria-label="Memuat data">' +
        '<div class="sigaji-skel sigaji-skel-row"></div>'.repeat(5) +
        '</div>'
      );
    }
    if (kind === 'kpi') {
      return (
        '<div class="sigaji-skeleton-wrap sigaji-skeleton-kpi" aria-busy="true">' +
        '<div class="sigaji-skel sigaji-skel-kpi"></div>'.repeat(4) +
        '</div>'
      );
    }
    return (
      '<div class="sigaji-skeleton-wrap" aria-busy="true">' +
      '<div class="sigaji-skel sigaji-skel-block"></div></div>'
    );
  };

  window.sigajiBtnLoading = function (btn, loading, label) {
    if (!btn) return;
    if (loading) {
      if (!btn.dataset.sigajiOrigHtml) btn.dataset.sigajiOrigHtml = btn.innerHTML;
      btn.disabled = true;
      btn.classList.add('is-loading');
      btn.innerHTML =
        '<span class="btn-spinner" aria-hidden="true"></span> ' +
        escapeHtml(label || 'Memproses…');
    } else {
      btn.disabled = false;
      btn.classList.remove('is-loading');
      if (btn.dataset.sigajiOrigHtml) {
        btn.innerHTML = btn.dataset.sigajiOrigHtml;
        delete btn.dataset.sigajiOrigHtml;
      }
    }
  };

  /** Indikator simpan lokal (#save-ind): menyimpan → tersimpan. */
  window.sigajiSaveFeedback = function (state) {
    var node = el('save-ind');
    if (!node) return;
    clearTimeout(_saveHideT);
    if (state === 'saving') {
      node.dataset.state = 'saving';
      node.textContent = 'Menyimpan…';
      return;
    }
    if (state === 'saved') {
      node.dataset.state = 'saved';
      node.textContent = '✓ Tersimpan';
      _saveHideT = setTimeout(function () {
        if (node.dataset.state === 'saved') {
          node.dataset.state = '';
          node.textContent = '';
        }
      }, 2500);
      return;
    }
    if (state === 'error') {
      node.dataset.state = 'error';
      node.textContent = '✗ Gagal simpan';
    }
  };

  window.sigajiSetSyncStatus = function (state, detail) {
    var node = el('sync-status');
    if (!node) return;
    clearTimeout(_syncHideT);
    node.dataset.state = state || 'idle';
    node.title = '';
    if (state === 'local') {
      if (typeof sigajiSaveFeedback === 'function') sigajiSaveFeedback('saved');
      node.innerHTML = '';
      return;
    }
    if (state === 'pending') {
      node.innerHTML = '&#8635; Menyinkronkan…';
      return;
    }
    if (state === 'synced') {
      node.innerHTML = '&#9729; Cloud tersimpan';
      if (detail) node.title = detail;
      _syncHideT = setTimeout(function () {
        if (node.dataset.state === 'synced') {
          node.dataset.state = 'idle';
          node.innerHTML = '';
          node.title = '';
        }
      }, 5000);
      return;
    }
    if (state === 'error') {
      var short = detail ? String(detail).slice(0, 48) : '';
      node.innerHTML =
        '&#9888; Gagal sync' +
        (short ? ' — ' + escapeHtml(short) : '') +
        ' <button type="button" class="sync-retry-btn" data-sigaji-action="invoke" data-fn="sigajiRetryCloudSync">Coba lagi</button>';
      node.title = detail || '';
      return;
    }
    node.innerHTML = '';
  };

  function sigajiCloudLoadDismiss() {
    var ov = el('sigaji-cloud-load');
    if (ov) {
      ov.classList.add('u-hidden');
      ov.setAttribute('aria-busy', 'false');
    }
    document.documentElement.removeAttribute('data-sigaji-cloud-loading');
  }

  /** Paksa tutup overlay (timeout / recovery). */
  window.sigajiCloudLoadForceEnd = function () {
    clearTimeout(_cloudLoadFailsafe);
    _cloudLoadFailsafe = null;
    _cloudLoadCount = 0;
    sigajiCloudLoadDismiss();
  };

  /** Overlay skeleton saat fetch payload Supabase. */
  window.sigajiCloudLoadStart = function () {
    _cloudLoadCount++;
    var ov = el('sigaji-cloud-load');
    if (!ov) return;
    ov.classList.remove('u-hidden');
    ov.setAttribute('aria-busy', 'true');
    document.documentElement.setAttribute('data-sigaji-cloud-loading', '1');
    clearTimeout(_cloudLoadFailsafe);
    _cloudLoadFailsafe = setTimeout(function () {
      if (_cloudLoadCount <= 0) return;
      console.warn('Sigaji: cloud load timeout — menutup overlay');
      window.sigajiCloudLoadForceEnd();
      if (typeof toast === 'function') {
        toast('Memuat data cloud terlalu lama. Periksa koneksi lalu refresh (Ctrl+F5).');
      }
    }, CLOUD_LOAD_TIMEOUT_MS);
  };

  window.sigajiCloudLoadEnd = function () {
    clearTimeout(_cloudLoadFailsafe);
    _cloudLoadFailsafe = null;
    _cloudLoadCount = Math.max(0, _cloudLoadCount - 1);
    if (_cloudLoadCount > 0) return;
    sigajiCloudLoadDismiss();
  };

  /** Konfirmasi hapus massal dengan jumlah item. */
  window.sigajiConfirmBulkDelete = function (opts) {
    opts = opts || {};
    var n = opts.count != null ? opts.count : 0;
    if (!n) {
      if (typeof toast === 'function') toast('Tidak ada data untuk dihapus.');
      return Promise.resolve(false);
    }
    var noun = opts.noun || 'item';
    var msg =
      'Anda akan menghapus ' +
      n +
      ' ' +
      noun +
      '.\n\nTindakan ini tidak dapat dibatalkan.';
    if (opts.hint) msg += '\n\n' + opts.hint;
    return sigajiConfirm({
      title: opts.title || 'Hapus data',
      message: msg,
      danger: true,
      okText: opts.okText || 'Ya, hapus semua',
    });
  };

  window.sigajiUpdatePeriodStickyBar = function () {
    var bar = el('period-sticky-bar');
    if (!bar || typeof PA !== 'function') return;
    var p = PA();
    if (!p || !p.nama) {
      bar.classList.add('is-hidden');
      return;
    }
    bar.classList.remove('is-hidden');
    var nameEl = el('period-sticky-name');
    var rangeEl = el('period-sticky-range');
    var bayarEl = el('period-sticky-bayar');
    var lockEl = el('period-sticky-lock');
    var daysEl = el('period-sticky-days');
    var topPer = el('top-periode');
    if (topPer) topPer.textContent = p.nama;
    if (nameEl) nameEl.textContent = p.nama;
    if (rangeEl) {
      rangeEl.textContent =
        (typeof fmtDate === 'function' ? fmtDate(p.start) : p.start) +
        ' – ' +
        (typeof fmtDate === 'function' ? fmtDate(p.end) : p.end);
    }
    if (bayarEl) {
      bayarEl.textContent =
        'Bayar: ' + (typeof fmtDate === 'function' ? fmtDate(p.bayar) : p.bayar || '-');
    }
    var locked =
      typeof isPeriodeSnapshotLocked === 'function' && isPeriodeSnapshotLocked(p.nama);
    if (lockEl) {
      lockEl.textContent = locked ? '\uD83D\uDD12 Snapshot terkunci' : '\u270E Dapat diedit';
      lockEl.className = 'period-sticky-chip ' + (locked ? 'is-lock' : 'is-edit');
    }
    if (daysEl) {
      var hP = Math.max(
        0,
        Math.ceil((new Date(p.bayar) - Date.now()) / 86400000)
      );
      daysEl.textContent = hP + ' hari menuju bayar';
    }
    if (p.thr_aktif && daysEl) {
      daysEl.textContent += ' · THR ' + (p.thr_nama || '');
    }
  };

  window.sigajiGetPgGajiCols = function () {
    return _pgGajiCols;
  };

  window.sigajiSetPgGajiCols = function (mode) {
    _pgGajiCols = mode === 'lengkap' ? 'lengkap' : 'ringkas';
    try {
      localStorage.setItem('sigaji_pg_gaji_cols', _pgGajiCols);
    } catch (e) {}
    document.body.setAttribute('data-pg-cols', _pgGajiCols);
    document.querySelectorAll('[data-pg-cols]').forEach(function (b) {
      b.classList.toggle('active', b.dataset.pgCols === _pgGajiCols);
    });
    if (typeof renderPenggajian === 'function') renderPenggajian();
  };

  try {
    var saved = localStorage.getItem('sigaji_pg_gaji_cols');
    if (saved === 'lengkap' || saved === 'ringkas') _pgGajiCols = saved;
  } catch (e) {}

  window.sigajiPatchMobileFetch = function () {
    if (typeof sigajiMobileFetch !== 'function' || sigajiMobileFetch._sigajiUxPatched) return;
    var orig = sigajiMobileFetch;
    window.sigajiMobileFetch = async function (name, opts) {
      opts = opts || {};
      var host = opts.loadingHost;
      var btn = opts.loadingBtn;
      if (host) host.innerHTML = sigajiSkeleton('table');
      if (btn) sigajiBtnLoading(btn, true);
      try {
        return await orig(name, opts);
      } finally {
        if (btn) sigajiBtnLoading(btn, false);
      }
    };
    window.sigajiMobileFetch._sigajiUxPatched = true;
  };

  /* Wizard lokasi GPS */
  var _mobLocWizardStep = 1;

  window.mobLocWizardGo = function (step) {
    _mobLocWizardStep = step;
    [1, 2, 3].forEach(function (n) {
      var pane = el('mob-loc-step-' + n);
      var dot = el('mob-loc-wiz-dot-' + n);
      if (pane) pane.style.display = n === step ? 'block' : 'none';
      if (dot) dot.classList.toggle('active', n === step);
      if (dot) dot.classList.toggle('done', n < step);
    });
    var prev = el('mob-loc-wiz-prev');
    var next = el('mob-loc-wiz-next');
    var save = el('mob-loc-wiz-save');
    if (prev) prev.style.display = step > 1 ? 'inline-flex' : 'none';
    if (next) next.style.display = step < 3 ? 'inline-flex' : 'none';
    if (save) save.style.display = step === 3 ? 'inline-flex' : 'none';
    if (step === 2) setTimeout(mobLocInitMapPicker, 200);
    if (step === 3) mobLocWizardPreview();
  };

  window.mobLocWizardNext = function () {
    if (_mobLocWizardStep === 1) {
      var nama = (el('mob-loc-nama') || {}).value.trim();
      if (!nama) {
        toast('Isi nama lokasi dulu');
        return;
      }
    }
    if (_mobLocWizardStep === 2) {
      var lat = parseFloat((el('mob-loc-lat') || {}).value);
      var lon = parseFloat((el('mob-loc-lon') || {}).value);
      if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
        toast('Tempatkan pin di peta atau gunakan lokasi saya');
        return;
      }
    }
    mobLocWizardGo(Math.min(3, _mobLocWizardStep + 1));
  };

  window.mobLocWizardPrev = function () {
    mobLocWizardGo(Math.max(1, _mobLocWizardStep - 1));
  };

  window.mobLocWizardPreview = function () {
    var box = el('mob-loc-wiz-preview');
    if (!box) return;
    var nama = (el('mob-loc-nama') || {}).value.trim();
    var tipe = (el('mob-loc-tipe') || {}).value || 'site';
    var rad = (el('mob-loc-radius') || {}).value || '250';
    box.innerHTML =
      '<div class="mob-loc-preview-card">' +
      '<div><strong>' +
      escapeHtml(nama) +
      '</strong> <span class="bdg b-info">' +
      escapeHtml(tipe) +
      '</span></div>' +
      '<div class="font-12 text-muted mt-sm">Radius geofence: <strong>' +
      escapeHtml(String(rad)) +
      ' m</strong>' +
      (typeof mobLocRadiusHint === 'function' ? mobLocRadiusHint(rad) : '') +
      '</div>' +
      '<div class="font-11 text-subtle mt-xs">Karyawan harus berada dalam radius ini saat check-in di APK.</div></div>';
  };

  window.mobLocWizardReset = function () {
    _mobLocWizardStep = 1;
    mobLocWizardGo(1);
  };

  function _initHrdUx() {
    document.body.setAttribute('data-pg-cols', _pgGajiCols);
    document.querySelectorAll('[data-pg-cols]').forEach(function (b) {
      b.classList.toggle('active', b.dataset.pgCols === _pgGajiCols);
    });
    if (typeof sigajiUpdatePeriodStickyBar === 'function') sigajiUpdatePeriodStickyBar();
    if (typeof sigajiPatchMobileFetch === 'function') sigajiPatchMobileFetch();
  }

  document.addEventListener('DOMContentLoaded', _initHrdUx);
  if (document.readyState !== 'loading') _initHrdUx();
})();
