/* SiGaji v2 — tren 12 bulan, simulasi gaji, setup wizard, alert cards */
(function () {
  var SIM_DEFAULT = {
    gapokPct: 0,
    tunjPct: 0,
    dept: '',
    nik: '',
  };

  window.__sigajiSim = Object.assign({}, SIM_DEFAULT);

  function deepCloneKar(k) {
    try {
      return JSON.parse(JSON.stringify(k));
    } catch (e) {
      return Object.assign({}, k);
    }
  }

  window.sigajiPayrollTrendSeries = function () {
    if (typeof sortPeriodesByStart !== 'function') return [];
    var sorted = sortPeriodesByStart(periodes || [], false);
    var last = sorted.slice(-12);
    return last.map(function (p) {
      var list =
        typeof karyawanListPeriode === 'function' ? karyawanListPeriode(p) : [];
      if (typeof ensureKarSnapshotPeriode === 'function')
        ensureKarSnapshotPeriode(p.nama, list);
      var bruto = 0;
      var pph = 0;
      var neto = 0;
      list.forEach(function (k) {
        if (!k || !k.nik) return;
        var g = hitungGaji(k, p.nama);
        bruto += g.grossPPh || 0;
        pph += g.pph || 0;
        neto += g.neto || 0;
      });
      var lbl = p.nama || '-';
      if (p.start) {
        var parts = String(p.start).split('-');
        if (parts.length === 3) lbl = parts[1] + '/' + parts[0];
      }
      return {
        nama: p.nama,
        label: lbl,
        bruto: bruto,
        pph: pph,
        neto: neto,
        headcount: list.length,
      };
    });
  };

  window.renderDashPayrollTrend = function () {
    var el = document.getElementById('d-trend-chart');
    if (!el) return;
    var series = sigajiPayrollTrendSeries();
    if (!series.length) {
      el.innerHTML =
        typeof sigajiEmptyState === 'function'
          ? sigajiEmptyState({
              icon: '&#128200;',
              title: 'Belum ada data tren',
              desc: 'Buat minimal satu periode gaji di Master → Periode untuk melihat grafik 12 bulan.',
              btnLabel: 'Atur periode',
              btnAction:'showPg',btnActionArg:'master',
            })
          : '<div class="text-subtle font-12">Belum ada periode.</div>';
      return;
    }
    var maxB = Math.max.apply(
      null,
      series.map(function (s) {
        return s.bruto || 0;
      }).concat([1])
    );
    var maxN = Math.max.apply(
      null,
      series.map(function (s) {
        return s.headcount || 0;
      }).concat([1])
    );
    var bars = series
      .map(function (s) {
        var hB = Math.max(6, Math.round(((s.bruto || 0) / maxB) * 100));
        var hP = Math.max(4, Math.round(((s.pph || 0) / maxB) * 100));
        var hN = Math.max(4, Math.round(((s.neto || 0) / maxB) * 100));
        var hK = Math.max(6, Math.round(((s.headcount || 0) / maxN) * 48));
        var tip =
          s.nama +
          ': bruto ' +
          fmt(s.bruto) +
          ' · PPh ' +
          fmt(s.pph) +
          ' · neto ' +
          fmt(s.neto) +
          ' · ' +
          s.headcount +
          ' karyawan';
        return (
          '<div class="dash-trend-col" title="' +
          escapeHtml(tip) +
          '">' +
          '<div class="dash-trend-bars">' +
          '<div class="dash-trend-bar dash-trend-bar-bruto" style="height:' +
          hB +
          'px"></div>' +
          '<div class="dash-trend-bar dash-trend-bar-pph" style="height:' +
          hP +
          'px"></div>' +
          '<div class="dash-trend-bar dash-trend-bar-neto" style="height:' +
          hN +
          'px"></div>' +
          '</div>' +
          '<div class="dash-trend-hc" style="height:' +
          hK +
          'px" title="' +
          s.headcount +
          ' karyawan"></div>' +
          '<div class="dash-trend-lbl">' +
          escapeHtml(s.label) +
          '</div></div>'
        );
      })
      .join('');
    var totBruto = series.reduce(function (s, x) {
      return s + (x.bruto || 0);
    }, 0);
    var totPph = series.reduce(function (s, x) {
      return s + (x.pph || 0);
    }, 0);
    var h =
      '<p class="dash-att-hint">12 periode terakhir — batang: <span class="lg-bruto">bruto</span> / <span class="lg-pph">PPh</span> / <span class="lg-neto">neto</span> (skala relatif). Garis ungu = headcount.</p>' +
      '<div class="dash-trend-chart">' +
      bars +
      '</div>' +
      '<div class="dash-trend-summary">' +
      '<span>Σ bruto <strong>' +
      fmt(totBruto) +
      '</strong></span>' +
      '<span>Σ PPh <strong>' +
      fmt(totPph) +
      '</strong></span>' +
      '<span>' +
      String(series.length) +
      ' bulan</span></div>';
    el.innerHTML = h;
  };

  window.sigajiRenderDashAlerts = function (ctx) {
    ctx = ctx || {};
    var el = document.getElementById('d-alerts');
    if (!el) return;
    var cards = [];
    if (ctx.thrAktif) {
      cards.push({
        cls: 'dac-purple',
        icon: '&#127873;',
        title: 'THR aktif',
        desc:
          (ctx.thrNama || 'Hari Raya') +
          ' · bruto ' +
          fmt(ctx.thrTotal || 0) +
          ' · bayar ' +
          (ctx.thrBayar || '-'),
        action: 'showPg',
        actionArg: 'thr',
      });
    }
    if (ctx.pendingAp > 0) {
      cards.push({
        cls: 'dac-amber',
        icon: '&#9203;',
        title: ctx.pendingAp + ' approval tertunda',
        desc: 'Periksa sebelum finalisasi gaji',
        action: 'showPg',
        actionArg: 'penggajian',
      });
    }
    if (ctx.pphRet > 0) {
      cards.push({
        cls: 'dac-green',
        icon: '&#128176;',
        title: 'Pengembalian PPh 21',
        desc: fmt(ctx.pphRet),
        action: 'showPg',
        actionArg: 'laporan',
      });
    }
    if (typeof sigajiDetectPayrollAnomalies === 'function' && typeof PA === 'function') {
      var p = PA();
      if (p) {
        var anom = sigajiDetectPayrollAnomalies(p.nama).filter(function (a) {
          return a.severity === 'high';
        });
        if (anom.length) {
          cards.push({
            cls: 'dac-red',
            icon: '&#9888;',
            title: anom.length + ' anomali payroll',
            desc: 'Perlu dicek sebelum final',
            action: 'showPg',
            actionArg: 'dashboard',
          });
        }
      }
    }
    if (!cards.length) {
      el.innerHTML =
        '<div class="dash-alert-cards"><div class="dac dac-muted"><span class="dac-icon">&#10003;</span><div><strong>Semua beres</strong><div class="dac-desc">Tidak ada peringatan untuk periode ini.</div></div></div></div>';
      return;
    }
    el.innerHTML =
      '<div class="dash-alert-cards">' +
      cards
        .map(function (c) {
          return (
            '<button type="button" class="dac ' +
            c.cls +
            '"' +
            (c.action
              ? sigajiDataAction('invoke', { fn: c.action, arg: c.actionArg || '' })
              : '') +
            '>' +
            '<span class="dac-icon">' +
            c.icon +
            '</span>' +
            '<div class="dac-body"><strong>' +
            escapeHtml(c.title) +
            '</strong><div class="dac-desc">' +
            escapeHtml(c.desc) +
            '</div></div></button>'
          );
        })
        .join('') +
      '</div>';
  };

  window.sigajiApplySimToKar = function (k, pNama, sim) {
    if (!k) return k;
    var base =
      typeof resolveKarForPeriode === 'function'
        ? resolveKarForPeriode(k, pNama)
        : k;
    var out = deepCloneKar(base);
    var gp = parseFloat(sim.gapokPct) || 0;
    var tp = parseFloat(sim.tunjPct) || 0;
    if (gp) out.gapok = Math.round((out.gapok || 0) * (1 + gp / 100));
    if (tp && out.tunjangan) {
      out.tunjangan = (out.tunjangan || []).map(function (t) {
        if (!t) return t;
        if (t.tipe === 'tetap' || t.tipe === 'tetap_no_bpjs') {
          return Object.assign({}, t, {
            nilai: Math.round((parseFloat(t.nilai) || 0) * (1 + tp / 100)),
          });
        }
        return t;
      });
    }
    return out;
  };

  window.sigajiSimSet = function (field, val) {
    if (!window.__sigajiSim) window.__sigajiSim = Object.assign({}, SIM_DEFAULT);
    window.__sigajiSim[field] = val;
    renderSimulasiGaji();
  };

  window.sigajiSimReset = function () {
    window.__sigajiSim = Object.assign({}, SIM_DEFAULT);
    renderSimulasiGaji();
  };

  window.renderSimulasiGaji = function () {
    var wrap = document.getElementById('sim-results');
    var sumEl = document.getElementById('sim-summary');
    if (!wrap) return;
    var p = typeof PA === 'function' ? PA() : null;
    if (!p) {
      wrap.innerHTML =
        typeof sigajiEmptyState === 'function'
          ? sigajiEmptyState({
              icon: '&#128197;',
              title: 'Periode belum aktif',
              desc: 'Atur periode gaji di Master terlebih dahulu.',
              btnLabel: 'Master periode',
              btnAction:'showPg',btnActionArg:'master',
            })
          : '';
      return;
    }
    var sim = window.__sigajiSim || SIM_DEFAULT;
    var gpEl = document.getElementById('sim-gapok-pct');
    var tnEl = document.getElementById('sim-tunj-pct');
    var dpEl = document.getElementById('sim-dept');
    var nkEl = document.getElementById('sim-nik');
    if (gpEl) gpEl.value = sim.gapokPct || 0;
    if (tnEl) tnEl.value = sim.tunjPct || 0;
    if (dpEl && sim.dept) dpEl.value = sim.dept;
    if (nkEl && sim.nik) nkEl.value = sim.nik;

    var list =
      typeof karyawanListPeriode === 'function' ? karyawanListPeriode(p) : [];
    if (sim.dept)
      list = list.filter(function (k) {
        return k && k.dept === sim.dept;
      });
    if (sim.nik)
      list = list.filter(function (k) {
        return k && k.nik === sim.nik;
      });

    if (!list.length) {
      wrap.innerHTML =
        typeof sigajiEmptyState === 'function'
          ? sigajiEmptyState({
              icon: '&#128101;',
              title: 'Tidak ada karyawan',
              desc: 'Sesuaikan filter dept/NIK atau tambah karyawan.',
              btnLabel: 'Master karyawan',
              btnAction:'showPg',btnActionArg:'karyawan',
            })
          : '<div class="text-subtle p-md">Tidak ada data.</div>';
      if (sumEl) sumEl.innerHTML = '';
      return;
    }

    var totNow = { bruto: 0, pph: 0, neto: 0 };
    var totSim = { bruto: 0, pph: 0, neto: 0 };
    var rows = list.map(function (k, idx) {
      var g0 = hitungGaji(k, p.nama);
      var kSim = sigajiApplySimToKar(k, p.nama, sim);
      var g1 = hitungGaji(kSim, p.nama, { skipResolve: true });
      totNow.bruto += g0.grossPPh || 0;
      totNow.pph += g0.pph || 0;
      totNow.neto += g0.neto || 0;
      totSim.bruto += g1.grossPPh || 0;
      totSim.pph += g1.pph || 0;
      totSim.neto += g1.neto || 0;
      var dNeto = (g1.neto || 0) - (g0.neto || 0);
      var dCls = dNeto > 0 ? 'sim-up' : dNeto < 0 ? 'sim-down' : '';
      return (
        '<tr><td class="text-center fw-700 text-muted">' +
        (idx + 1) +
        '</td><td><strong>' +
        escapeHtml(k.nama) +
        '</strong><div class="font-10 text-subtle">' +
        escapeHtml(k.dept) +
        '</div></td><td>' +
        fmt(g0.neto) +
        '</td><td><strong>' +
        fmt(g1.neto) +
        '</strong></td><td class="' +
        dCls +
        '">' +
        (dNeto >= 0 ? '+' : '') +
        fmt(dNeto) +
        '</td><td>' +
        fmt(g1.pph) +
        '</td></tr>'
      );
    });

    wrap.innerHTML = rows.join('');
    var dB = totSim.bruto - totNow.bruto;
    var dN = totSim.neto - totNow.neto;
    if (sumEl) {
      sumEl.innerHTML =
        '<div class="sim-sum-grid">' +
        '<div><div class="sim-sum-lbl">Neto sekarang</div><div class="sim-sum-val">' +
        fmt(totNow.neto) +
        '</div></div>' +
        '<div><div class="sim-sum-lbl">Neto simulasi</div><div class="sim-sum-val sim-up">' +
        fmt(totSim.neto) +
        '</div></div>' +
        '<div><div class="sim-sum-lbl">Δ neto</div><div class="sim-sum-val ' +
        (dN >= 0 ? 'sim-up' : 'sim-down') +
        '">' +
        (dN >= 0 ? '+' : '') +
        fmt(dN) +
        '</div></div>' +
        '<div><div class="sim-sum-lbl">Δ bruto PPh</div><div class="sim-sum-val">' +
        (dB >= 0 ? '+' : '') +
        fmt(dB) +
        '</div></div>' +
        '</div><p class="font-11 text-muted" style="margin:.65rem 0 0">Sandbox — tidak mengubah snapshot/komponen gaji. Periode: <strong>' +
        escapeHtml(p.nama) +
        '</strong></p>';
    }
  };

  window.sigajiOnboardingNeeded = function () {
    if (!CU || (CU.role !== 'Admin' && CU.role !== 'HRD')) return false;
    if (perusahaan && perusahaan.onboarding_done) return false;
    var needs = false;
    if (!perusahaan || !String(perusahaan.nama || '').trim()) needs = true;
    if (!(periodes || []).length) needs = true;
    if (!(karyawan || []).length) needs = true;
    if (!(hariLibur || []).length) needs = true;
    return needs;
  };

  var wizStep = 0;

  window.sigajiShowSetupWizard = function (force) {
    if (!force && !sigajiOnboardingNeeded()) return;
    wizStep = 0;
    sigajiSetupWizardRender();
    var m = document.getElementById('m-setup-wizard');
    if (m) openModal('m-setup-wizard');
  };

  window.sigajiSetupWizardSkip = function () {
    if (!perusahaan) perusahaan = {};
    perusahaan.onboarding_done = true;
    saveAll();
    closeModal('m-setup-wizard');
    toast('Setup wizard dilewati — bisa dibuka lagi dari Backup → Sistem');
  };

  window.sigajiSetupWizardNext = function () {
    if (wizStep === 0) {
      if (!perusahaan) perusahaan = {};
      var nm = document.getElementById('wiz-prs-nama');
      if (nm && String(nm.value || '').trim())
        perusahaan.nama = nm.value.trim();
      saveAll();
      if (typeof loadPrsForm === 'function') loadPrsForm();
      if (typeof applyBranding === 'function') applyBranding();
    } else if (wizStep === 1) {
      /* periode — user klik buat di master atau lewati */
    } else if (wizStep === 2) {
      /* karyawan */
    } else if (wizStep === 3) {
      /* umk hint */
    } else if (wizStep === 4) {
      if (typeof loadLiburNasionalDinamis === 'function') {
        var libYr = document.getElementById('wiz-libur-yr');
        var libnasYr = document.getElementById('libnas-yr');
        if (libYr && libnasYr) libnasYr.value = libYr.value;
        loadLiburNasionalDinamis();
      }
      if (!perusahaan) perusahaan = {};
      perusahaan.onboarding_done = true;
      saveAll();
      closeModal('m-setup-wizard');
      toast('Setup awal selesai — SiGaji siap dipakai');
      if (typeof renderAll === 'function') renderAll();
      return;
    }
    wizStep = Math.min(4, wizStep + 1);
    sigajiSetupWizardRender();
  };

  window.sigajiSetupWizardPrev = function () {
    wizStep = Math.max(0, wizStep - 1);
    sigajiSetupWizardRender();
  };

  window.sigajiSetupWizardRender = function () {
    var body = document.getElementById('wiz-body');
    var stepEl = document.getElementById('wiz-step-lbl');
    var titles = [
      'Profil perusahaan',
      'Periode gaji',
      'Data karyawan',
      'UMK regional',
      'Libur nasional',
    ];
    if (stepEl) stepEl.textContent = 'Langkah ' + (wizStep + 1) + ' / 5 — ' + titles[wizStep];
    if (!body) return;
    var prsNama = (perusahaan && perusahaan.nama) || '';
    var nKar = (karyawan || []).length;
    var nPer = (periodes || []).length;
    var nLib = (hariLibur || []).length;
    var yr = new Date().getFullYear();
    var steps = [
      '<div class="wiz-step"><p class="font-12 text-body mb-lg m-0">Nama PT akan tampil di slip, laporan, dan branding login.</p>' +
        '<div class="fg"><label>Nama perusahaan</label><input id="wiz-prs-nama" value="' +
        escapeHtml(prsNama) +
        '" placeholder="PT Contoh Indonesia"></div>' +
        '<button type="button" class="btn btn-sm btn-out"' + sigajiDataAction('master-tab', { mstab: 'prs' }) + '>Buka profil lengkap</button></div>',
      '<div class="wiz-step"><p class="font-12 text-body">Buat periode gaji bulan pertama (mis. Januari ' +
        yr +
        ').</p>' +
        '<div class="wiz-stat-row"><span>Periode terdaftar</span><strong>' +
        nPer +
        '</strong></div>' +
        '<button type="button" class="btn btn-sm btn-p"' + sigajiDataAction('master-tab', { mstab: 'periode' }) + '>+ Atur periode gaji</button></div>',
      '<div class="wiz-step"><p class="font-12 text-body">Import Excel atau tambah manual pegawai tetap / tidak tetap.</p>' +
        '<div class="wiz-stat-row"><span>Karyawan</span><strong>' +
        nKar +
        '</strong></div>' +
        '<button type="button" class="btn btn-sm btn-p"' + sigajiDataAction('invoke', { fn: 'showPg', arg: 'karyawan' }) + '>Buka Master Karyawan</button></div>',
      '<div class="wiz-step"><p class="font-12 text-body">Pastikan UMK provinsi/kota sesuai untuk validasi upah minimum (opsional tapi disarankan).</p>' +
        '<button type="button" class="btn btn-sm btn-out"' + sigajiDataAction('master-tab', { mstab: 'umk' }) + '>Atur UMK</button></div>',
      '<div class="wiz-step"><p class="font-12 text-body">Muat kalender libur nasional agar absensi &amp; cuti akurat.</p>' +
        '<div class="wiz-stat-row"><span>Hari libur</span><strong>' +
        nLib +
        '</strong></div>' +
        '<div class="fg" style="max-width:140px"><label>Tahun</label><input type="number" id="wiz-libur-yr" value="' +
        yr +
        '" min="2017" max="2030"></div>' +
        '<button type="button" class="btn btn-sm btn-p"' + sigajiDataAction('invoke', { fn: 'loadLiburNasionalDinamis' }) + '>Muat libur nasional</button></div>',
    ];
    var h = steps[wizStep] || '';
    body.innerHTML = h;
    var prev = document.getElementById('wiz-btn-prev');
    var next = document.getElementById('wiz-btn-next');
    if (prev) prev.style.display = wizStep > 0 ? '' : 'none';
    if (next)
      next.textContent = wizStep === 4 ? 'Selesai' : 'Lanjut';
    document.querySelectorAll('#m-setup-wizard .wiz-dot').forEach(function (d, i) {
      d.classList.toggle('active', i <= wizStep);
      d.classList.toggle('done', i < wizStep);
    });
  };

  window.sigajiMaybeShowSetupWizard = function () {
    if (!sigajiOnboardingNeeded()) return;
    setTimeout(function () {
      sigajiShowSetupWizard(false);
    }, 600);
  };

  window.sigajiSetPanelDock = function (open) {
    if (open) document.body.classList.add('sigaji-panel-docked');
    else document.body.classList.remove('sigaji-panel-docked');
  };
})();
