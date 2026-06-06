/* SiGaji Product v3 — bento dashboard, timeline, tema, waterfall, narasi, tour */
(function () {
  var WIDGET_DEFS = {
    hero: { label: 'Periode & countdown', col: 8, row: 2, icon: '&#128197;' },
    sparkline: { label: 'Sparkline neto', col: 4, row: 2, icon: '&#128200;' },
    kpis: { label: 'Ringkasan KPI', col: 12, row: 1, icon: '&#128176;' },
    dept_chips: { label: 'Chip departemen', col: 4, row: 1, icon: '&#127970;' },
    compliance: { label: 'Deadline kepatuhan', col: 4, row: 2, icon: '&#128337;' },
    anomalies: { label: 'Anomali payroll', col: 4, row: 2, icon: '&#9888;' },
    narrative: { label: 'Cerita payroll', col: 8, row: 2, icon: '&#128221;' },
    alerts: { label: 'Peringatan', col: 4, row: 1, icon: '&#128276;' },
    att: { label: 'Kehadiran', col: 6, row: 2, icon: '&#128100;' },
    dept_table: { label: 'Tabel dept', col: 6, row: 2, icon: '&#128203;' },
  };

  var DEFAULT_ORDER = [
    'hero',
    'sparkline',
    'kpis',
    'dept_chips',
    'compliance',
    'anomalies',
    'narrative',
    'alerts',
    'att',
    'dept_table',
  ];

  var TOUR_STEPS = [
    {
      sel: '#period-timeline-bar',
      title: 'Timeline periode',
      body: 'Fokus per bulan — klik bulan untuk mengubah seluruh aplikasi (gaji, absensi, slip, PPh).',
    },
    {
      sel: '#dash-bento-grid [data-widget="hero"]',
      title: 'Periode aktif',
      body: 'Countdown menuju tanggal bayar gaji. Angka estimasi mengikuti periode di timeline.',
    },
    {
      sel: '#dash-bento-grid [data-widget="anomalies"]',
      title: 'Cek sebelum final',
      body: 'Anomali otomatis — pastikan bersih sebelum transfer gaji.',
    },
    {
      sel: '#dash-bento-grid [data-widget="narrative"]',
      title: 'Cerita untuk direksi',
      body: 'Ringkasan naratif bulan ini — bisa export PDF.',
    },
    {
      sel: '.ni[data-pg="penggajian"]',
      title: 'Cara final gaji',
      body: 'Proses Gaji → cek tabel, klik PPh / Neto / THR untuk waterfall, lalu final periode saat siap bayar.',
      goto: 'penggajian',
      highlightSel: '#pg-penggajian .pg-table-sticky',
    },
    {
      sel: '.topbar-theme-wrap',
      title: 'Tema & kepadatan',
      body: 'Comfortable, compact, dark mode, atau warna brand PT.',
    },
  ];

  function layoutKey() {
    var role = (typeof CU !== 'undefined' && CU && CU.role) || 'Guest';
    return 'sigaji_bento_layout_' + role;
  }

  function loadLayout() {
    try {
      var raw = localStorage.getItem(layoutKey());
      if (raw) {
        var arr = JSON.parse(raw);
        if (Array.isArray(arr) && arr.length) return arr.filter(function (id) {
          return WIDGET_DEFS[id];
        });
      }
    } catch (e) {}
    return DEFAULT_ORDER.slice();
  }

  function saveLayout(order) {
    try {
      localStorage.setItem(layoutKey(), JSON.stringify(order));
    } catch (e2) {}
  }

  function sparklineSvg(values, w, h) {
    if (!values || !values.length) return '';
    var max = Math.max.apply(null, values.concat([1]));
    var pts = values
      .map(function (v, i) {
        var x = (i / Math.max(1, values.length - 1)) * w;
        var y = h - (v / max) * (h - 4) - 2;
        return x.toFixed(1) + ',' + y.toFixed(1);
      })
      .join(' ');
    return (
      '<svg class="bento-spark-svg" viewBox="0 0 ' +
      w +
      ' ' +
      h +
      '" preserveAspectRatio="none"><polyline fill="none" stroke="currentColor" stroke-width="2" points="' +
      pts +
      '"/><polygon fill="currentColor" fill-opacity="0.12" points="0,' +
      h +
      ' ' +
      pts +
      ' ' +
      w +
      ',' +
      h +
      '"/></svg>'
    );
  }

  function explainMoneyBtn(nik, pNama, label) {
    if (!nik) return '';
    var pe = String(pNama || '').replace(/'/g, "\\'");
    var ne = String(nik).replace(/'/g, "\\'");
    return (
      ' <button type="button" class="sigaji-explain-btn" title="Kenapa angka ini?" onclick="sigajiOpenExplain(\'' +
      ne +
      "','" +
      pe +
      '\')">?</button>'
    );
  }

  window.sigajiExplainMoneyBtn = explainMoneyBtn;

  window.sigajiRenderBentoDashboard = function (ctx) {
    ctx = ctx || {};
    var grid = document.getElementById('dash-bento-grid');
    if (!grid) return;
    var order = loadLayout();
    var p = ctx.p || (typeof PA === 'function' ? PA() : null);
    var series =
      typeof sigajiPayrollTrendSeries === 'function' ? sigajiPayrollTrendSeries() : [];
    var netoSeries = series.slice(-6).map(function (s) {
      return s.neto || 0;
    });
    var depts = ctx.depts || {};

    function widgetShell(id, inner) {
      var def = WIDGET_DEFS[id] || { col: 4, row: 1, label: id };
      return (
        '<div class="bento-widget" data-widget="' +
        id +
        '" data-col="' +
        def.col +
        '" data-row="' +
        def.row +
        '" draggable="true">' +
        '<div class="bento-widget-head">' +
        '<span class="bento-drag" title="Seret untuk ubah urutan">⠿</span>' +
        '<span class="bento-widget-title">' +
        def.icon +
        ' ' +
        escapeHtml(def.label) +
        '</span></div>' +
        '<div class="bento-widget-body">' +
        inner +
        '</div></div>'
      );
    }

    var widgets = {
      hero:
        '<div class="bento-hero">' +
        '<div class="bento-hero-main">' +
        '<div class="bento-hero-lbl">Periode aktif</div>' +
        '<div class="bento-hero-title">' +
        escapeHtml((p && p.nama) || '-') +
        (ctx.thrTag || '') +
        '</div>' +
        '<div class="bento-hero-meta">' +
        (p ? fmtDate(p.start) + ' — ' + fmtDate(p.end) + ' · Bayar ' + fmtDate(p.bayar) : '') +
        '</div></div>' +
        '<div class="bento-hero-count-wrap">' +
        '<div class="bento-hero-count">' +
        (ctx.hP != null ? ctx.hP : '-') +
        '</div>' +
        '<div class="bento-hero-count-lbl">hari menuju bayar gaji</div></div></div>',

      sparkline:
        '<div class="bento-spark-wrap">' +
        (netoSeries.length
          ? sparklineSvg(netoSeries, 200, 56)
          : '<div style="color:#9ca3af;font-size:11px">Belum cukup periode</div>') +
        '<div class="bento-spark-lbl">Neto 6 bulan terakhir</div>' +
        (netoSeries.length
          ? '<div class="bento-spark-val">' + fmt(netoSeries[netoSeries.length - 1]) + '</div>'
          : '') +
        '</div>',

      kpis:
        '<div class="bento-kpi-row">' +
        '<div class="bento-kpi" data-tour="kpi-kar"><span class="bento-kpi-lbl">Karyawan</span><span class="bento-kpi-val">' +
        (ctx.nKar != null ? ctx.nKar : '-') +
        '</span></div>' +
        '<div class="bento-kpi bento-kpi-click" onclick="sigajiOpenExplainSummary(\'bruto\')"><span class="bento-kpi-lbl">Gross PPh</span><span class="bento-kpi-val sigaji-money">' +
        fmt(ctx.tB || 0) +
        '</span><span class="bento-kpi-hint">klik → waterfall</span></div>' +
        '<div class="bento-kpi bento-kpi-click" onclick="sigajiOpenExplainSummary(\'pph\')"><span class="bento-kpi-lbl">PPh 21</span><span class="bento-kpi-val sigaji-money-warn">' +
        fmt(ctx.tP || 0) +
        '</span></div>' +
        '<div class="bento-kpi bento-kpi-click" onclick="sigajiOpenExplainSummary(\'neto\')"><span class="bento-kpi-lbl">Neto</span><span class="bento-kpi-val sigaji-money-ok">' +
        fmt(ctx.tN || 0) +
        '</span></div></div>' +
        (ctx.hintHtml ? '<div class="dash-kpi-hint" style="margin-top:.5rem">' + ctx.hintHtml + '</div>' : ''),

      dept_chips:
        '<div class="bento-dept-chips">' +
        (Object.keys(depts).length
          ? Object.entries(depts)
              .map(function (ent) {
                var d = ent[0];
                var v = ent[1];
                return (
                  '<span class="bento-dept-chip" title="Neto ' +
                  fmt(v.n2) +
                  '"><strong>' +
                  escapeHtml(d) +
                  '</strong> ' +
                  v.n +
                  ' org · ' +
                  fmt(v.b) +
                  '</span>'
                );
              })
              .join('')
          : '<span style="color:#9ca3af;font-size:11px">Belum ada data dept</span>') +
        '</div>',

      compliance:
        '<p style="font-size:10px;color:#6b7280;margin:0 0 .4rem">THR, BPJS, e-Bupot, bayar gaji</p><div id="d-compliance-cal"></div>',

      anomalies:
        '<div id="d-payroll-anomalies"></div>',

      narrative: '<div id="dash-narrative-wrap"></div>',

      alerts: '<div id="d-alerts"></div>',

      att: '<div id="d-att-chart"></div>',

      dept_table:
        '<div class="table-wrap"><table><thead><tr><th>Dept</th><th>Kar</th><th>Gross</th><th>Neto</th></tr></thead><tbody id="d-table"></tbody></table></div>',
    };

    grid.innerHTML = order
      .map(function (id) {
        return widgetShell(id, widgets[id] || '');
      })
      .join('');

    sigajiBindBentoDrag(grid);
    try {
      if (typeof renderDashComplianceCalendar === 'function') renderDashComplianceCalendar();
    } catch (e1) {}
    try {
      if (typeof renderDashPayrollAnomalies === 'function') renderDashPayrollAnomalies();
    } catch (e2) {}
    try {
      if (typeof sigajiRenderDashAlerts === 'function')
        sigajiRenderDashAlerts({
          thrAktif: ctx.thrAktif,
          thrNama: ctx.thrNama,
          thrTotal: ctx.tT,
          thrBayar: ctx.thrBayar,
          pendingAp: ctx.pAp,
          pphRet: ctx.pRet,
        });
    } catch (e3) {}
    if (ctx.attHtml && document.getElementById('d-att-chart')) {
      document.getElementById('d-att-chart').innerHTML = ctx.attHtml;
    }
    if (ctx.deptTableHtml && document.getElementById('d-table')) {
      document.getElementById('d-table').innerHTML = ctx.deptTableHtml;
    }
    try {
      if (typeof sigajiRenderPayrollNarrative === 'function') sigajiRenderPayrollNarrative(ctx);
    } catch (e4) {}
  };

  function sigajiBindBentoDrag(grid) {
    var dragId = null;
    grid.querySelectorAll('.bento-widget').forEach(function (w) {
      w.addEventListener('dragstart', function (e) {
        dragId = w.getAttribute('data-widget');
        w.classList.add('bento-dragging');
        e.dataTransfer.effectAllowed = 'move';
      });
      w.addEventListener('dragend', function () {
        w.classList.remove('bento-dragging');
        dragId = null;
      });
      w.addEventListener('dragover', function (e) {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
      });
      w.addEventListener('drop', function (e) {
        e.preventDefault();
        var targetId = w.getAttribute('data-widget');
        if (!dragId || dragId === targetId) return;
        var order = loadLayout();
        var from = order.indexOf(dragId);
        var to = order.indexOf(targetId);
        if (from < 0 || to < 0) return;
        order.splice(from, 1);
        order.splice(to, 0, dragId);
        saveLayout(order);
        if (typeof renderDash === 'function') renderDash();
        toast('Layout dashboard disimpan');
      });
    });
  }

  window.sigajiResetBentoLayout = function () {
    localStorage.removeItem(layoutKey());
    if (typeof renderDash === 'function') renderDash();
    toast('Layout dashboard direset');
  };

  /* ── Waterfall explain ── */
  window.sigajiBuildWaterfallHtml = function (k, pNama, g) {
    if (!k || !g) return '';
    var tbl = typeof getTERTable === 'function' ? getTERTable(k.ptkp) : TER_A;
    var rate = (tbl.find(function (r) {
      return g.grossPPh <= r[0];
    }) || [0, 0.34])[1];
    var bpjsKar = (g.bpjs.kes_kar || 0) + (g.bpjs.jht_kar || 0) + (g.bpjs.jp_kar || 0);
    var potTotal = (g.potT || 0) + (g.potKehadiran && g.potKehadiran.total ? g.potKehadiran.total : 0);
    var steps = [
      { lbl: 'Gaji pokok' + (g.isPR ? ' (pro-rata ' + g.pr.hh + '/' + g.pr.hk + ')' : ''), val: g.gapokEff, type: 'up' },
    ];
    (g.tItems || []).forEach(function (t) {
      steps.push({ lbl: t.nama, val: t.eff, type: 'up' });
    });
    if (g.lb) steps.push({ lbl: 'Lembur', val: g.lb, type: 'up' });
    if (g.thrBruto) steps.push({ lbl: 'THR bruto', val: g.thrBruto, type: 'up' });
    steps.push({ lbl: '= Gross PPh 21', val: g.grossPPh, type: 'sum' });
    steps.push({
      lbl: 'PPh 21 (TER ' + k.ptkp + ' ' + (rate * 100).toFixed(2) + '%)',
      val: -g.pph,
      type: 'down',
      tip: 'PMK 168/2023 — tarif efektif rata-rata',
    });
    steps.push({ lbl: 'BPJS karyawan', val: -bpjsKar, type: 'down' });
    if (potTotal) steps.push({ lbl: 'Potongan lain + kehadiran', val: -potTotal, type: 'down' });
    if (g.pphRet) steps.push({ lbl: 'Pengembalian PPh', val: g.pphRet, type: 'up' });
    steps.push({ lbl: 'Take Home Pay', val: g.neto, type: 'final' });

    var maxAbs = Math.max.apply(
      null,
      steps.map(function (s) {
        return Math.abs(s.val || 0);
      }).concat([1])
    );

    return (
      '<div class="wf-header"><strong>' +
      escapeHtml(k.nama) +
      '</strong><span>' +
      escapeHtml(k.nik) +
      ' · ' +
      escapeHtml(pNama) +
      '</span></div>' +
      '<div class="wf-steps">' +
      steps
        .map(function (s) {
          var w = Math.max(8, Math.round((Math.abs(s.val) / maxAbs) * 100));
          var cls = 'wf-step wf-step-' + (s.type || 'mid');
          return (
            '<div class="' +
            cls +
            '">' +
            '<div class="wf-step-lbl">' +
            escapeHtml(s.lbl) +
            (s.tip ? '<span class="wf-tip" title="' + escapeHtml(s.tip) + '">ⓘ</span>' : '') +
            '</div>' +
            '<div class="wf-step-bar-wrap"><div class="wf-step-bar" style="width:' +
            w +
            '%"></div></div>' +
            '<div class="wf-step-val">' +
            (s.val < 0 ? '−' : '') +
            fmt(Math.abs(s.val)) +
            '</div></div>'
          );
        })
        .join('') +
      '</div>'
    );
  };

  window.sigajiOpenExplain = function (nik, pNama) {
    var k = (karyawan || []).find(function (x) {
      return x && x.nik === nik;
    });
    if (!k) {
      toast('Karyawan tidak ditemukan');
      return;
    }
    var pn = pNama || (typeof PA === 'function' ? PA().nama : '');
    var g = hitungGaji(k, pn);
    var body = document.getElementById('wf-explain-body');
    var panel = document.getElementById('wf-explain-panel');
    var ov = document.getElementById('wf-explain-overlay');
    if (!body || !panel) return;
    body.innerHTML = sigajiBuildWaterfallHtml(k, pn, g);
    panel.classList.add('show');
    if (ov) ov.classList.add('show');
  };

  window.sigajiOpenExplainSummary = function (focus) {
    var p = typeof PA === 'function' ? PA() : null;
    if (!p) return;
    var list = typeof karyawanListPeriode === 'function' ? karyawanListPeriode(p) : [];
    var tB = 0;
    var tP = 0;
    var tN = 0;
    var tBpjs = 0;
    list.forEach(function (k) {
      var g = hitungGaji(k, p.nama);
      tB += g.grossPPh || 0;
      tP += g.pph || 0;
      tN += g.neto || 0;
      tBpjs += (g.bpjs.kes_kar || 0) + (g.bpjs.jht_kar || 0) + (g.bpjs.jp_kar || 0);
    });
    var steps = [
      { lbl: 'Total gross PPh 21 (semua karyawan)', val: tB, type: 'sum' },
      { lbl: 'Total PPh 21 terutang', val: -tP, type: 'down' },
      { lbl: 'Total BPJS karyawan', val: -tBpjs, type: 'down' },
      { lbl: 'Total neto (THP)', val: tN, type: 'final' },
    ];
    var maxAbs = Math.max(tB, tP, tN, 1);
    var body = document.getElementById('wf-explain-body');
    var panel = document.getElementById('wf-explain-panel');
    var ov = document.getElementById('wf-explain-overlay');
    if (!body || !panel) return;
    body.innerHTML =
      '<div class="wf-header"><strong>Ringkasan periode</strong><span>' +
      escapeHtml(p.nama) +
      '</span></div><p style="font-size:11px;color:#6b7280">Agregat ' +
      list.length +
      ' karyawan. Fokus: <strong>' +
      escapeHtml(focus || 'neto') +
      '</strong>. Klik ? di tabel penggajian untuk per orang.</p>' +
      '<div class="wf-steps">' +
      steps
        .map(function (s) {
          var w = Math.max(8, Math.round((Math.abs(s.val) / maxAbs) * 100));
          return (
            '<div class="wf-step wf-step-' +
            s.type +
            '"><div class="wf-step-lbl">' +
            escapeHtml(s.lbl) +
            '</div><div class="wf-step-bar-wrap"><div class="wf-step-bar" style="width:' +
            w +
            '%"></div></div><div class="wf-step-val">' +
            (s.val < 0 ? '−' : '') +
            fmt(Math.abs(s.val)) +
            '</div></div>'
          );
        })
        .join('') +
      '</div>';
    panel.classList.add('show');
    if (ov) ov.classList.add('show');
  };

  window.sigajiCloseExplain = function () {
    var panel = document.getElementById('wf-explain-panel');
    var ov = document.getElementById('wf-explain-overlay');
    if (panel) panel.classList.remove('show');
    if (ov) ov.classList.remove('show');
  };

  /* ── Period timeline ── */
  window.sigajiRenderPeriodTimeline = function () {
    var bar = document.getElementById('period-timeline-bar');
    if (!bar || typeof sigajiPeriodePayrollMeta !== 'function') return;
    var yr = new Date().getFullYear();
    var sorted =
      typeof sortPeriodesByPayrollYm === 'function'
        ? sortPeriodesByPayrollYm(periodes || [], false)
        : periodes || [];
    var filtered = sorted.filter(function (p) {
      var meta = sigajiPeriodePayrollMeta(p);
      return meta.year === yr;
    });
    if (filtered.length < 3) {
      filtered = sorted.slice(-12);
    }
    var byYm = {};
    filtered.forEach(function (p) {
      var meta = sigajiPeriodePayrollMeta(p);
      if (!meta.ym) return;
      var prev = byYm[meta.ym];
      if (
        !prev ||
        p.status === 'aktif' ||
        (prev.status !== 'aktif' && String(p.end || '') > String(prev.end || ''))
      ) {
        byYm[meta.ym] = p;
      }
    });
    var items = Object.keys(byYm)
      .sort()
      .map(function (k) {
        return byYm[k];
      });
    if (!items.length) items = sorted.slice(-12);
    var active = typeof PA === 'function' ? PA() : null;
    bar.innerHTML =
      '<div class="ptl-scroll">' +
      items
        .map(function (p) {
          var meta = sigajiPeriodePayrollMeta(p);
          var lbl = meta.label || p.nama || '-';
          var tip = (p.nama || '-') + ' · ' + (typeof fmtDate === 'function' ? fmtDate(p.start) : p.start) + ' – ' + (typeof fmtDate === 'function' ? fmtDate(p.end) : p.end);
          if (meta.crossesPriorMonth && meta.priorDays > 0) {
            tip += ' (termasuk ' + meta.priorDays + ' hari bulan sebelumnya)';
          }
          var cls = 'ptl-item';
          if (active && (active.id === p.id || active.nama === p.nama)) cls += ' active';
          if (p.snapshot_locked) cls += ' locked';
          if (meta.crossesPriorMonth) cls += ' ptl-cross';
          return (
            '<button type="button" class="' +
            cls +
            '" onclick="sigajiSwitchPeriodeTimeline(\'' +
            String(p.id).replace(/'/g, "\\'") +
            '\')" title="' +
            escapeHtml(tip) +
            '">' +
            escapeHtml(lbl) +
            '</button>'
          );
        })
        .join('') +
      '</div>';
  };

  window.sigajiSwitchPeriodeTimeline = function (id) {
    window.__sigajiAbMonth = '';
    if (typeof aktifkanPeriode === 'function') aktifkanPeriode(id);
    sigajiRenderPeriodTimeline();
    try {
      if (typeof sigajiUpdatePeriodStickyBar === 'function') sigajiUpdatePeriodStickyBar();
    } catch (e) {}
  };

  /* ── Theme & density ── */
  function prefsKey() {
    return 'sigaji_ui_prefs';
  }

  window.sigajiGetUiPrefs = function () {
    try {
      var raw = localStorage.getItem(prefsKey());
      if (raw) return JSON.parse(raw);
    } catch (e) {}
    return { theme: 'light', density: 'comfortable' };
  };

  function brandAccent() {
    var logo = document.getElementById('topbar-logo');
    if (logo && logo.src) return '#1a56a0';
    return (perusahaan && perusahaan.brand_color) || '#1a56a0';
  }

  window.sigajiApplyUiPrefs = function (prefs) {
    prefs = prefs || sigajiGetUiPrefs();
    var root = document.documentElement;
    root.setAttribute('data-theme', prefs.theme || 'light');
    root.setAttribute('data-density', prefs.density || 'comfortable');
    if (prefs.theme === 'brand') {
      root.style.setProperty('--ux-accent', brandAccent());
    } else {
      root.style.removeProperty('--ux-accent');
    }
    try {
      localStorage.setItem(prefsKey(), JSON.stringify(prefs));
    } catch (e2) {}
    var densEl = document.getElementById('ui-pref-density');
    var themeEl = document.getElementById('ui-pref-theme');
    if (densEl) densEl.value = prefs.density || 'comfortable';
    if (themeEl) themeEl.value = prefs.theme || 'light';
  };

  window.sigajiSetUiPref = function (key, val) {
    var p = sigajiGetUiPrefs();
    p[key] = val;
    sigajiApplyUiPrefs(p);
    toast('Tampilan: ' + (key === 'theme' ? val : val));
  };

  /* ── Narrative report ── */
  window.sigajiRenderPayrollNarrative = function (ctx) {
    var wrap = document.getElementById('dash-narrative-wrap');
    if (!wrap) return;
    var p = ctx.p || (typeof PA === 'function' ? PA() : null);
    if (!p) {
      wrap.innerHTML = '';
      return;
    }
    var text = sigajiGenerateNarrativeText(ctx);
    wrap.innerHTML =
      '<div class="narrative-box">' +
      '<div class="narrative-text">' +
      text +
      '</div>' +
      '<div class="fl gap1" style="margin-top:.65rem;flex-wrap:wrap">' +
      '<button type="button" class="btn btn-sm btn-p" onclick="sigajiExportNarrativePdf()">&#128196; Export PDF</button>' +
      '<button type="button" class="btn btn-sm btn-out" onclick="sigajiCopyNarrative()">Salin teks</button>' +
      '</div></div>';
    window.__sigajiNarrativePlain = wrap.querySelector('.narrative-text')
      ? wrap.querySelector('.narrative-text').innerText
      : '';
  };

  window.sigajiGenerateNarrativeText = function (ctx) {
    ctx = ctx || {};
    var p = ctx.p;
    var prev =
      typeof sigajiPreviousPeriode === 'function' ? sigajiPreviousPeriode(p) : null;
    var nNow = ctx.nKar || 0;
    var nPrev = 0;
    var tNPrev = 0;
    if (prev) {
      var listP =
        typeof karyawanListPeriode === 'function' ? karyawanListPeriode(prev) : [];
      nPrev = listP.length;
      listP.forEach(function (k) {
        tNPrev += hitungGaji(k, prev.nama).neto || 0;
      });
    }
    var tN = ctx.tN || 0;
    var tB = ctx.tB || 0;
    var tP = ctx.tP || 0;
    var pctNeto = tNPrev > 0 ? (((tN - tNPrev) / tNPrev) * 100).toFixed(1) : null;
    var pctPph = prev && ctx.tP != null && tNPrev
      ? null
      : null;
    var hireDelta = nNow - nPrev;
    var paras = [];
    paras.push(
      '<p><strong>Ringkasan payroll ' +
        escapeHtml(p.nama) +
        '</strong> (' +
        fmtDate(p.start) +
        ' – ' +
        fmtDate(p.end) +
        '). Perkiraan total biaya tenaga kerja (neto) <strong>' +
        fmt(tN) +
        '</strong> untuk <strong>' +
        nNow +
        '</strong> karyawan aktif.</p>'
    );
    if (pctNeto != null) {
      paras.push(
        '<p>Neto ' +
          (parseFloat(pctNeto) >= 0 ? 'naik' : 'turun') +
          ' <strong>' +
          Math.abs(parseFloat(pctNeto)) +
          '%</strong> dibanding periode sebelumnya' +
          (prev ? ' (' + escapeHtml(prev.nama) + ')' : '') +
          (hireDelta !== 0
            ? ' — headcount ' + (hireDelta > 0 ? 'bertambah ' + hireDelta : 'berkurang ' + Math.abs(hireDelta))
            : '') +
          '.</p>'
      );
    }
    paras.push(
      '<p>Estimasi gross PPh <strong>' +
        fmt(tB) +
        '</strong>, PPh 21 <strong>' +
        fmt(tP) +
        '</strong>. Bayar gaji: <strong>' +
        fmtDate(p.bayar) +
        '</strong>' +
        (p.thr_aktif ? '; periode termasuk <strong>THR ' + escapeHtml(p.thr_nama || '') + '</strong>.' : '.') +
        '</p>'
    );
    if (ctx.pAp > 0) {
      paras.push('<p><span class="narrative-warn">⚠ ' + ctx.pAp + ' approval masih tertunda — selesaikan sebelum transfer.</span></p>');
    }
    var anom =
      typeof sigajiDetectPayrollAnomalies === 'function'
        ? sigajiDetectPayrollAnomalies(p.nama).filter(function (a) {
            return a.severity === 'high';
          })
        : [];
    if (anom.length) {
      paras.push('<p><span class="narrative-warn">⚠ ' + anom.length + ' anomali payroll perlu dicek (NPWP/NIK, neto, PPh).</span></p>');
    }
    paras.push('<p style="font-size:11px;color:#6b7280">Dokumen estimasi — angka final mengikuti proses penggajian &amp; snapshot periode.</p>');
    return paras.join('');
  };

  window.sigajiCopyNarrative = function () {
    var t = window.__sigajiNarrativePlain || '';
    if (navigator.clipboard && t) {
      navigator.clipboard.writeText(t).then(function () {
        toast('Cerita payroll disalin');
      });
    }
  };

  window.sigajiExportNarrativePdf = function () {
    var t = window.__sigajiNarrativePlain || '';
    if (!t || typeof window.jspdf === 'undefined') {
      toast('PDF tidak tersedia — muat ulang halaman');
      return;
    }
    var doc = new window.jspdf.jsPDF({ format: 'a4', unit: 'mm' });
    var nama = (perusahaan && perusahaan.nama) || 'Perusahaan';
    doc.setFontSize(14);
    doc.text('Cerita Payroll — ' + nama, 14, 18);
    doc.setFontSize(10);
    var lines = doc.splitTextToSize(t, 180);
    doc.text(lines, 14, 28);
    doc.save('cerita-payroll-' + (PA() && PA().nama ? PA().nama.replace(/\s+/g, '-') : 'periode') + '.pdf');
    toast('PDF cerita payroll diunduh');
  };

  /* ── Product tour ── */
  var tourIdx = 0;

  window.sigajiProductTourStart = function (force) {
    if (!force) {
      try {
        if (localStorage.getItem('sigaji_tour_done') === '1') return;
      } catch (e) {}
    }
    tourIdx = 0;
    sigajiProductTourShowStep();
    var ov = document.getElementById('sigaji-tour-overlay');
    if (ov) ov.classList.add('show');
  };

  function sigajiProductTourShowStep() {
    var step = TOUR_STEPS[tourIdx];
    var pop = document.getElementById('sigaji-tour-popover');
    if (!step || !pop) return;
    document.querySelectorAll('.sigaji-tour-highlight').forEach(function (el) {
      el.classList.remove('sigaji-tour-highlight');
    });
    if (step.goto && typeof showPg === 'function') showPg(step.goto);
    document.getElementById('sigaji-tour-title').textContent = step.title;
    document.getElementById('sigaji-tour-body').textContent = step.body;
    document.getElementById('sigaji-tour-step-lbl').textContent =
      'Langkah ' + (tourIdx + 1) + ' / ' + TOUR_STEPS.length;
    var prev = document.getElementById('sigaji-tour-prev');
    if (prev) prev.style.display = tourIdx > 0 ? '' : 'none';
    var place = function () {
      var target = document.querySelector(step.highlightSel || step.sel);
      pop.style.transform = '';
      if (target) {
        target.classList.add('sigaji-tour-highlight');
        target.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
        var r = target.getBoundingClientRect();
        pop.style.top = Math.min(window.innerHeight - 200, r.bottom + 12) + 'px';
        pop.style.left = Math.max(12, Math.min(window.innerWidth - 320, r.left)) + 'px';
      } else {
        pop.style.top = '120px';
        pop.style.left = '50%';
        pop.style.transform = 'translateX(-50%)';
      }
    };
    if (step.goto) setTimeout(place, 280);
    else place();
  }

  window.sigajiProductTourNext = function () {
    tourIdx++;
    if (tourIdx >= TOUR_STEPS.length) {
      sigajiProductTourEnd(true);
      return;
    }
    sigajiProductTourShowStep();
  };

  window.sigajiProductTourPrev = function () {
    tourIdx = Math.max(0, tourIdx - 1);
    sigajiProductTourShowStep();
  };

  window.sigajiProductTourEnd = function (done) {
    var ov = document.getElementById('sigaji-tour-overlay');
    if (ov) ov.classList.remove('show');
    document.querySelectorAll('.sigaji-tour-highlight').forEach(function (el) {
      el.classList.remove('sigaji-tour-highlight');
    });
    if (done) {
      try {
        localStorage.setItem('sigaji_tour_done', '1');
      } catch (e) {}
    }
  };

  window.sigajiMaybeProductTour = function () {
    if (typeof sigajiOnboardingNeeded === 'function' && sigajiOnboardingNeeded()) return;
    setTimeout(function () {
      if (typeof sigajiOnboardingNeeded === 'function' && sigajiOnboardingNeeded()) return;
      sigajiProductTourStart(false);
    }, 1200);
  };

  document.addEventListener('DOMContentLoaded', function () {
    sigajiApplyUiPrefs(sigajiGetUiPrefs());
  });
  if (document.readyState !== 'loading') sigajiApplyUiPrefs(sigajiGetUiPrefs());
})();
