/* SiGaji UI Polish — command palette, sidebar collapse, toast stack, dept sparkline, PDF magazine */
(function () {
  var CMDK_OPEN = false;
  var SIDEBAR_KEY = 'sigaji_sidebar_collapsed';

  /* ── SVG ilustrasi empty state ── */
  window.sigajiEmptyIllustSvg = function (kind) {
    var accent = 'var(--ux-accent, #1a56a0)';
    var maps = {
      people:
        '<svg class="sigaji-empty-svg" viewBox="0 0 120 80" aria-hidden="true"><circle cx="40" cy="28" r="14" fill="' +
        accent +
        '" opacity=".15"/><circle cx="40" cy="26" r="8" fill="' +
        accent +
        '"/><path d="M22 58c0-10 8-16 18-16s18 6 18 16" fill="' +
        accent +
        '" opacity=".35"/><circle cx="78" cy="30" r="11" fill="' +
        accent +
        '" opacity=".1"/><circle cx="78" cy="29" r="6" fill="' +
        accent +
        '" opacity=".5"/></svg>',
      money:
        '<svg class="sigaji-empty-svg" viewBox="0 0 120 80" aria-hidden="true"><rect x="18" y="22" width="84" height="36" rx="6" fill="' +
        accent +
        '" opacity=".12"/><rect x="26" y="30" width="68" height="8" rx="2" fill="' +
        accent +
        '" opacity=".35"/><rect x="26" y="44" width="40" height="6" rx="2" fill="' +
        accent +
        '" opacity=".2"/><circle cx="88" cy="48" r="10" fill="' +
        accent +
        '"/></svg>',
      calendar:
        '<svg class="sigaji-empty-svg" viewBox="0 0 120 80" aria-hidden="true"><rect x="24" y="18" width="72" height="52" rx="8" fill="' +
        accent +
        '" opacity=".12"/><rect x="24" y="18" width="72" height="14" rx="8" fill="' +
        accent +
        '" opacity=".35"/><rect x="34" y="40" width="10" height="10" rx="2" fill="' +
        accent +
        '" opacity=".25"/><rect x="50" y="40" width="10" height="10" rx="2" fill="' +
        accent +
        '"/><rect x="66" y="40" width="10" height="10" rx="2" fill="' +
        accent +
        '" opacity=".25"/></svg>',
      chart:
        '<svg class="sigaji-empty-svg" viewBox="0 0 120 80" aria-hidden="true"><polyline points="20,58 40,42 58,48 78,28 98,34" fill="none" stroke="' +
        accent +
        '" stroke-width="3" stroke-linecap="round"/><circle cx="78" cy="28" r="4" fill="' +
        accent +
        '"/></svg>',
      legal:
        '<svg class="sigaji-empty-svg" viewBox="0 0 120 80" aria-hidden="true"><path d="M60 14 L92 28 V52 C92 62 60 68 60 68 C60 68 28 62 28 52 V28 Z" fill="' +
        accent +
        '" opacity=".15"/><path d="M48 40 H72 M48 48 H68" stroke="' +
        accent +
        '" stroke-width="3" stroke-linecap="round"/></svg>',
    };
    return maps[kind] || maps.chart;
  };

  /* ── Toast stack ── */
  function ensureToastStack() {
    var stack = document.getElementById('sigaji-toast-stack');
    if (!stack) {
      stack = document.createElement('div');
      stack.id = 'sigaji-toast-stack';
      stack.className = 'sigaji-toast-stack';
      stack.setAttribute('aria-live', 'polite');
      document.body.appendChild(stack);
    }
    return stack;
  }

  window.sigajiToastPush = function (msg, type) {
    var stack = ensureToastStack();
    var item = document.createElement('div');
    item.className = 'sigaji-toast-item' + (type ? ' sigaji-toast-' + type : '');
    item.textContent = msg;
    stack.appendChild(item);
    requestAnimationFrame(function () {
      item.classList.add('show');
    });
    setTimeout(function () {
      item.classList.remove('show');
      setTimeout(function () {
        if (item.parentNode) item.parentNode.removeChild(item);
      }, 320);
    }, 3800);
  };

  function patchToast() {
    if (typeof window.toast !== 'function' || window._sigajiToastPatched) return;
    window._sigajiToastPatched = true;
    window.toast = function (msg) {
      sigajiToastPush(msg);
    };
  }
  patchToast();
  window.addEventListener('load', patchToast);

  /* ── Skeleton helper ── */
  window.sigajiTableSkeletonRows = function (cols, rows) {
    cols = cols || 8;
    rows = rows || 6;
    if (typeof sigajiSkeleton !== 'function') return '';
    return (
      '<tr><td colspan="' +
      cols +
      '">' +
      sigajiSkeleton('table') +
      '</td></tr>'
    );
  };

  /** Flash skeleton lalu panggil renderFn — untuk tbody atau div host. */
  window.sigajiWithSkeleton = function (elOrId, colspan, renderFn) {
    var el =
      typeof elOrId === 'string' ? document.getElementById(elOrId) : elOrId;
    if (typeof renderFn !== 'function') return;
    if (!el) {
      renderFn();
      return;
    }
    if (el.dataset.sigajiSkel === '1') {
      renderFn();
      return;
    }
    var hasSkel =
      typeof sigajiTableSkeletonRows === 'function' ||
      typeof sigajiSkeleton === 'function';
    if (!hasSkel) {
      renderFn();
      return;
    }
    el.dataset.sigajiSkel = '1';
    if (el.tagName === 'TBODY' && typeof sigajiTableSkeletonRows === 'function') {
      el.innerHTML = sigajiTableSkeletonRows(colspan || 8, 6);
    } else if (typeof sigajiSkeleton === 'function') {
      el.innerHTML =
        '<div class="sigaji-skel-host">' + sigajiSkeleton('table') + '</div>';
    }
    requestAnimationFrame(function () {
      requestAnimationFrame(function () {
        if (el) delete el.dataset.sigajiSkel;
        renderFn();
      });
    });
  };

  /* ── Dept sparkline ── */
  window.sigajiDeptNetoSeries = function (deptName, n) {
    n = n || 6;
    if (typeof sortPeriodesByPayrollYm !== 'function') return [];
    var sorted = sortPeriodesByPayrollYm(periodes || [], false).slice(-n);
    return sorted.map(function (p) {
      var list = typeof karyawanListPeriode === 'function' ? karyawanListPeriode(p) : [];
      var sum = 0;
      list.forEach(function (k) {
        if (k && k.dept === deptName) sum += hitungGaji(k, p.nama).neto || 0;
      });
      return sum;
    });
  };

  window.sigajiDeptSparklineCell = function (deptName) {
    var vals = sigajiDeptNetoSeries(deptName, 6);
    if (!vals.length || vals.every(function (v) { return !v; }))
      return '<span class="text-subtle font-10">—</span>';
    var max = Math.max.apply(null, vals.concat([1]));
    var w = 72;
    var h = 22;
    var pts = vals
      .map(function (v, i) {
        var x = (i / Math.max(1, vals.length - 1)) * w;
        var y = h - (v / max) * (h - 4) - 2;
        return x.toFixed(1) + ',' + y.toFixed(1);
      })
      .join(' ');
    return (
      '<svg class="dept-spark-mini" viewBox="0 0 ' +
      w +
      ' ' +
      h +
      '" width="' +
      w +
      '" height="' +
      h +
      '"><polyline fill="none" stroke="var(--ux-accent,#1a56a0)" stroke-width="1.8" points="' +
      pts +
      '"/></svg>'
    );
  };

  /* ── Magazine PDF helpers ── */
  window.sigajiPdfMagazineCover = function (doc, opts) {
    opts = opts || {};
    var pw = doc.internal.pageSize.getWidth();
    var accent = opts.accentRgb || [26, 86, 160];
    doc.setFillColor(accent[0], accent[1], accent[2]);
    doc.rect(0, 0, pw, 42, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(9);
    doc.text(String(opts.eyebrow || 'SiGaji · Dokumen Resmi'), 14, 12);
    doc.setFontSize(16);
    doc.setFont(undefined, 'bold');
    doc.text(String(opts.title || 'Laporan'), 14, 22);
    doc.setFontSize(9);
    doc.setFont(undefined, 'normal');
    doc.text(String(opts.subtitle || ''), 14, 30);
    if (opts.meta) {
      doc.setFontSize(8);
      doc.text(String(opts.meta), pw - 14, 22, { align: 'right' });
    }
    doc.setTextColor(40, 40, 40);
    return 48;
  };

  window.sigajiPdfMagazineFooter = function (doc, pageNum) {
    var pw = doc.internal.pageSize.getWidth();
    var ph = doc.internal.pageSize.getHeight();
    doc.setFontSize(7);
    doc.setTextColor(120, 120, 120);
    doc.text(
      String((perusahaan && perusahaan.nama) || 'Perusahaan') + ' · SiGaji',
      14,
      ph - 8
    );
    doc.text('Hal. ' + pageNum, pw - 14, ph - 8, { align: 'right' });
  };

  /* ── Sidebar collapse ── */
  function syncSidebarCollapseUi(collapsed) {
    var title = collapsed ? 'Tampilkan menu' : 'Sembunyikan menu';
    var btn = document.getElementById('sidebar-collapse-btn');
    if (!btn) return;
    var ico = btn.querySelector('.sidebar-collapse-btn-ico');
    var lbl = btn.querySelector('.sidebar-collapse-btn-lbl');
    if (ico) ico.innerHTML = collapsed ? '&#9654;' : '&#9664;';
    if (lbl) lbl.textContent = collapsed ? 'Menu' : 'Sembunyikan menu';
    btn.title = title;
    btn.setAttribute('aria-label', title);
    btn.classList.toggle('is-collapsed', collapsed);
  }

  window.sigajiToggleSidebarCollapse = function () {
    var on = !document.documentElement.classList.contains('sidebar-collapsed');
    document.documentElement.classList.toggle('sidebar-collapsed', on);
    try {
      localStorage.setItem(SIDEBAR_KEY, on ? '1' : '0');
    } catch (e) {}
    syncSidebarCollapseUi(on);
    return false;
  };

  function applySidebarCollapsed() {
    try {
      var collapsed = localStorage.getItem(SIDEBAR_KEY) === '1';
      if (collapsed) document.documentElement.classList.add('sidebar-collapsed');
      syncSidebarCollapseUi(collapsed);
    } catch (e2) {}
  }

  function injectSidebarCollapseBtn() {
    var head = document.getElementById('nav-top');
    if (!head || document.getElementById('sidebar-collapse-btn')) return;
    head.innerHTML =
      '<button type="button" id="sidebar-collapse-btn" class="sidebar-collapse-btn sidebar-collapse-btn-top" data-sigaji-action="sidebar-collapse" title="Sembunyikan menu" aria-label="Sembunyikan menu">' +
      '<span class="sidebar-collapse-btn-ico">&#9664;</span>' +
      '<span class="sidebar-collapse-btn-lbl">Sembunyikan menu</span>' +
      '</button>';
  }

  /* ── Command palette ── */
  function cmdkItems(q) {
    q = String(q || '')
      .toLowerCase()
      .trim();
    var items = [];
    (MODULES || []).forEach(function (m) {
      if (m.sec === 'Saya') return;
      if (typeof canAccessModule === 'function' && !canAccessModule(m.id)) return;
      items.push({
        type: 'modul',
        label: m.lbl,
        sub: m.sec,
        icon: m.icon || '&#9670;',
        run: "showPg('" + m.id + "')",
        hay: (m.lbl + ' ' + m.id + ' ' + m.sec).toLowerCase(),
      });
    });
    (karyawan || []).slice(0, 200).forEach(function (k) {
      if (!k || !k.nik) return;
      var hay = (k.nama + ' ' + k.nik + ' ' + (k.dept || '') + ' ' + (k.jabatan || '')).toLowerCase();
      items.push({
        type: 'karyawan',
        label: k.nama,
        sub: k.nik + ' · ' + (k.dept || '-'),
        icon: '&#128100;',
        run: "openPanel('" + String(k.nik).replace(/'/g, "\\'") + "')",
        hay: hay,
      });
    });
    [
      { label: 'Finalisasi gaji', sub: 'Proses penggajian', run: "showPg('penggajian')", hay: 'final gaji bayar' },
      { label: 'Simulasi what-if', sub: 'Sandbox THR & pesangon', run: "showPg('simulasi')", hay: 'simulasi thr pesangon' },
      { label: 'Export e-Bupot', sub: 'Laporan PPh', run: "showPg('laporan')", hay: 'ebupot pph coretax' },
    ].forEach(function (x) {
      items.push({
        type: 'aksi',
        label: x.label,
        sub: x.sub,
        icon: '&#9889;',
        run: x.run,
        hay: x.hay,
      });
    });
    if (!q) return items.slice(0, 14);
    return items
      .filter(function (it) {
        return it.hay.indexOf(q) >= 0;
      })
      .slice(0, 12);
  }

  function cmdkRender(q) {
    var box = document.getElementById('sigaji-cmdk-results');
    if (!box) return;
    var items = cmdkItems(q);
    if (!items.length) {
      box.innerHTML = '<div class="sigaji-cmdk-empty">Tidak ada hasil</div>';
      return;
    }
    box.innerHTML = items
      .map(function (it, i) {
        return (
          '<button type="button" class="sigaji-cmdk-item' +
          (i === 0 ? ' active' : '') +
          '" data-run="' +
          escapeHtml(it.run) +
          '"><span class="sigaji-cmdk-icon">' +
          it.icon +
          '</span><span><span class="sigaji-cmdk-lbl">' +
          escapeHtml(it.label) +
          '</span><span class="sigaji-cmdk-sub">' +
          escapeHtml(it.sub) +
          '</span></span><span class="sigaji-cmdk-type">' +
          escapeHtml(it.type) +
          '</span></button>'
        );
      })
      .join('');
  }

  window.sigajiCmdkOpen = function () {
    var ov = document.getElementById('sigaji-cmdk-overlay');
    var inp = document.getElementById('sigaji-cmdk-input');
    if (!ov || !inp) return;
    CMDK_OPEN = true;
    ov.classList.add('show');
    ov.setAttribute('aria-hidden', 'false');
    inp.value = '';
    cmdkRender('');
    setTimeout(function () {
      inp.focus();
    }, 30);
  };

  window.sigajiCmdkClose = function () {
    var ov = document.getElementById('sigaji-cmdk-overlay');
    if (!ov) return;
    CMDK_OPEN = false;
    ov.classList.remove('show');
    ov.setAttribute('aria-hidden', 'true');
  };

  function cmdkRun(btn) {
    var run = btn && btn.getAttribute('data-run');
    sigajiCmdkClose();
    if (run) try {
      eval(run);
    } catch (e) {
      console.error(e);
    }
  }

  function bindCmdk() {
    var ov = document.getElementById('sigaji-cmdk-overlay');
    var inp = document.getElementById('sigaji-cmdk-input');
    if (!ov || !inp) return;
    ov.addEventListener('click', function (e) {
      if (e.target === ov) sigajiCmdkClose();
    });
    inp.addEventListener('input', function () {
      cmdkRender(inp.value);
    });
    inp.addEventListener('keydown', function (e) {
      var items = ov.querySelectorAll('.sigaji-cmdk-item');
      var active = ov.querySelector('.sigaji-cmdk-item.active');
      var idx = active ? Array.prototype.indexOf.call(items, active) : 0;
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        idx = Math.min(items.length - 1, idx + 1);
        items.forEach(function (el, i) {
          el.classList.toggle('active', i === idx);
        });
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        idx = Math.max(0, idx - 1);
        items.forEach(function (el, i) {
          el.classList.toggle('active', i === idx);
        });
      } else if (e.key === 'Enter') {
        e.preventDefault();
        var pick = items[idx] || items[0];
        if (pick) cmdkRun(pick);
      } else if (e.key === 'Escape') {
        sigajiCmdkClose();
      }
    });
    ov.addEventListener('click', function (e) {
      var btn = e.target.closest('.sigaji-cmdk-item');
      if (btn) cmdkRun(btn);
    });
  }

  document.addEventListener('keydown', function (e) {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
      e.preventDefault();
      if (CMDK_OPEN) sigajiCmdkClose();
      else sigajiCmdkOpen();
    }
  });

  window.sigajiUiPolishAfterRender = function () {
    injectSidebarCollapseBtn();
    applySidebarCollapsed();
  };

  document.addEventListener('DOMContentLoaded', function () {
    ensureToastStack();
    bindCmdk();
    applySidebarCollapsed();
  });
  if (document.readyState !== 'loading') {
    ensureToastStack();
    bindCmdk();
  }
})();
