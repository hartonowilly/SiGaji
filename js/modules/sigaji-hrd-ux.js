/* SiGaji — UX Web HRD: periode sticky, sync cloud, skeleton, empty state */
(function () {
  var _syncHideT = null;
  var _pgGajiCols = 'ringkas';

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

  window.sigajiSetSyncStatus = function (state, detail) {
    var node = el('sync-status');
    if (!node) return;
    clearTimeout(_syncHideT);
    node.dataset.state = state || 'idle';
    var map = {
      idle: '',
      local: '&#10003; Tersimpan lokal',
      pending: '&#8635; Menyinkronkan…',
      synced: '&#9729; Cloud tersimpan',
      error: '&#9888; Gagal sync cloud',
    };
    var txt = map[state] || '';
    if (detail && state === 'error') txt += ' — ' + detail;
    if (detail && state === 'synced') node.title = detail;
    node.innerHTML = txt;
    if (state === 'local' || state === 'synced') {
      _syncHideT = setTimeout(function () {
        if (node.dataset.state === state) {
          node.dataset.state = 'idle';
          node.innerHTML = '';
          node.title = '';
        }
      }, state === 'synced' ? 5000 : 2500);
    }
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
      '<div class="font-11 text-subtle" style="margin-top:.25rem">Karyawan harus berada dalam radius ini saat check-in di APK.</div></div>';
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
