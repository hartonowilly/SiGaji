/* SiGaji — simulasi sandbox THR & pesangon/PHK (what-if, tidak menyimpan profil) */
(function () {
  var THR_SIM_DEFAULT = {
    gapokPct: 0,
    tunjPct: 0,
    mkBulan: '',
    dept: '',
    nik: '',
  };

  var PSG_SIM_DEFAULT = {
    nik: '',
    tglBerhenti: '',
    alasan: 'phk_1x',
    sisaCuti: '',
    upManual: '',
    upmkManual: '',
    uphManual: '',
    uphTambahan: '',
    pisah: '',
  };

  window.__sigajiSimThr = Object.assign({}, THR_SIM_DEFAULT);
  window.__sigajiSimPsg = Object.assign({}, PSG_SIM_DEFAULT);
  window.__sigajiSimTab = 'gaji';

  function deepCloneKar(k) {
    try {
      return JSON.parse(JSON.stringify(k));
    } catch (e) {
      return Object.assign({}, k);
    }
  }

  function simKarForThr(k, pNama, sim) {
    if (!k) return k;
    var out =
      typeof sigajiApplySimToKar === 'function'
        ? sigajiApplySimToKar(k, pNama, sim)
        : deepCloneKar(k);
    if (sim.mkBulan !== '' && sim.mkBulan != null && !isNaN(parseFloat(sim.mkBulan))) {
      var months = Math.max(0, parseFloat(sim.mkBulan));
      var d = new Date();
      d.setMonth(d.getMonth() - Math.floor(months));
      out.masuk = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-01';
    }
    return out;
  }

  function simKarForPesangon(k, sim) {
    if (!k) return null;
    var out = deepCloneKar(k);
    out.tgl_berhenti = sim.tglBerhenti || out.tgl_berhenti || '';
    if (!out.tgl_berhenti) return null;
    out.phk = Object.assign({}, out.phk || {});
    if (sim.alasan) out.phk.alasan = sim.alasan;
    function setNum(key, val) {
      if (val === '' || val == null) delete out.phk[key];
      else out.phk[key] = parseFloat(val) || 0;
    }
    setNum('sisa_cuti_hari', sim.sisaCuti);
    setNum('up_manual', sim.upManual);
    setNum('upmk_manual', sim.upmkManual);
    setNum('uph_manual', sim.uphManual);
    setNum('uph_tambahan', sim.uphTambahan);
    setNum('pisah', sim.pisah);
    return out;
  }

  window.sigajiSimSwitchTab = function (tab) {
    window.__sigajiSimTab = tab || 'gaji';
    ['gaji', 'thr', 'pesangon'].forEach(function (t) {
      var panel = document.getElementById('sim-panel-' + t);
      if (panel && typeof sigajiSetPanelVisible === 'function') sigajiSetPanelVisible(panel, t === tab);
      else if (panel) panel.style.display = t === tab ? '' : 'none';
      var btn = document.querySelector('.sim-sandbox-tabs [data-simtab="' + t + '"]');
      if (btn) btn.classList.toggle('active', t === tab);
    });
    if (tab === 'gaji' && typeof renderSimulasiGaji === 'function') renderSimulasiGaji();
    if (tab === 'thr') renderSimulasiThr();
    if (tab === 'pesangon') renderSimulasiPesangon();
  };

  window.sigajiSimThrSet = function (field, val) {
    if (!window.__sigajiSimThr) window.__sigajiSimThr = Object.assign({}, THR_SIM_DEFAULT);
    window.__sigajiSimThr[field] = val;
    renderSimulasiThr();
  };

  window.sigajiSimThrReset = function () {
    window.__sigajiSimThr = Object.assign({}, THR_SIM_DEFAULT);
    renderSimulasiThr();
  };

  window.sigajiSimPsgSet = function (field, val) {
    if (!window.__sigajiSimPsg) window.__sigajiSimPsg = Object.assign({}, PSG_SIM_DEFAULT);
    window.__sigajiSimPsg[field] = val;
    if (field === 'nik' && val) {
      var k = (karyawan || []).find(function (x) {
        return x && x.nik === val;
      });
      if (k) {
        if (k.tgl_berhenti) window.__sigajiSimPsg.tglBerhenti = k.tgl_berhenti;
        if (k.phk && k.phk.alasan) window.__sigajiSimPsg.alasan = k.phk.alasan;
      }
    }
    renderSimulasiPesangon();
  };

  window.sigajiSimPsgReset = function () {
    window.__sigajiSimPsg = Object.assign({}, PSG_SIM_DEFAULT);
    renderSimulasiPesangon();
  };

  function populateSimThrNik(list) {
    var sel = document.getElementById('sim-thr-nik');
    if (!sel) return;
    var prev = sel.value;
    sel.innerHTML =
      '<option value="">Semua karyawan</option>' +
      list
        .map(function (k) {
          return (
            '<option value="' +
            escapeHtml(k.nik) +
            '">' +
            escapeHtml(k.nik + ' — ' + k.nama) +
            '</option>'
          );
        })
        .join('');
    if (prev && list.some(function (k) { return k.nik === prev; })) sel.value = prev;
  }

  function populateSimPsgNik() {
    var sel = document.getElementById('sim-psg-nik');
    if (!sel) return;
    var prev = sel.value;
    var list = typeof sortKaryawanByNik === 'function' ? sortKaryawanByNik(karyawan || []) : karyawan || [];
    sel.innerHTML =
      '<option value="">— Pilih karyawan —</option>' +
      list
        .map(function (k) {
          return (
            '<option value="' +
            escapeHtml(k.nik) +
            '">' +
            escapeHtml(k.nik + ' — ' + k.nama) +
            '</option>'
          );
        })
        .join('');
    if (prev) sel.value = prev;
    if (!sel.value && list.length === 1) {
      sel.value = list[0].nik;
      window.__sigajiSimPsg.nik = list[0].nik;
    }
  }

  window.renderSimulasiThr = function () {
    var wrap = document.getElementById('sim-thr-results');
    var sumEl = document.getElementById('sim-thr-summary');
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
              btnOnclick: "showPg('master')",
            })
          : '';
      if (sumEl) sumEl.innerHTML = '';
      return;
    }
    var sim = window.__sigajiSimThr || THR_SIM_DEFAULT;
    var gpEl = document.getElementById('sim-thr-gapok-pct');
    var tnEl = document.getElementById('sim-thr-tunj-pct');
    var mkEl = document.getElementById('sim-thr-mk');
    var dpEl = document.getElementById('sim-thr-dept');
    var nkEl = document.getElementById('sim-thr-nik');
    if (gpEl) gpEl.value = sim.gapokPct || 0;
    if (tnEl) tnEl.value = sim.tunjPct || 0;
    if (mkEl) mkEl.value = sim.mkBulan !== '' ? sim.mkBulan : '';
    if (dpEl && sim.dept) dpEl.value = sim.dept;

    var list = typeof karyawanListPeriode === 'function' ? karyawanListPeriode(p) : [];
    populateSimThrNik(list);
    if (nkEl && sim.nik) nkEl.value = sim.nik;
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
              icon: '&#127873;',
              title: 'Tidak ada karyawan',
              desc: 'Sesuaikan filter atau tambah karyawan.',
              btnLabel: 'Master karyawan',
              btnOnclick: "showPg('karyawan')",
            })
          : '';
      if (sumEl) sumEl.innerHTML = '';
      return;
    }

    var totNow = 0;
    var totSim = 0;
    var eligibleNow = 0;
    var eligibleSim = 0;
    var rows = list.map(function (k, idx) {
      var t0 = hitungTHRBruto(k, p.nama);
      var kSim = simKarForThr(k, p.nama, sim);
      var t1 = hitungTHRBruto(kSim, p.nama);
      if (t0.eligible) {
        totNow += t0.nilai || 0;
        eligibleNow++;
      }
      if (t1.eligible) {
        totSim += t1.nilai || 0;
        eligibleSim++;
      }
      var d = (t1.nilai || 0) - (t0.nilai || 0);
      var dCls = d > 0 ? 'sim-up' : d < 0 ? 'sim-down' : '';
      return (
        '<tr><td class="text-center fw-700 text-muted">' +
        (idx + 1) +
        '</td><td><strong>' +
        escapeHtml(k.nama) +
        '</strong><div class="font-10 text-subtle">' +
        escapeHtml(k.dept) +
        ' · MK ' +
        (t0.mb != null ? t0.mb : '-') +
        ' bln</div></td><td>' +
        (t0.eligible ? fmt(t0.nilai) + ' <span class="font-9 text-subtle">(' + escapeHtml(t0.pl) + ')</span>' : '<span class="text-subtle">—</span>') +
        '</td><td><strong>' +
        (t1.eligible ? fmt(t1.nilai) : '—') +
        '</strong></td><td class="' +
        dCls +
        '">' +
        (t0.eligible && t1.eligible ? (d >= 0 ? '+' : '') + fmt(d) : '—') +
        '</td><td class="font-10">' +
        (t1.eligible ? escapeHtml(t1.pl) : 'Tidak eligible') +
        '</td></tr>'
      );
    });

    wrap.innerHTML = rows.join('');
    var dT = totSim - totNow;
    if (sumEl) {
      sumEl.innerHTML =
        '<div class="sim-sum-grid">' +
        '<div><div class="sim-sum-lbl">THR sekarang</div><div class="sim-sum-val">' +
        fmt(totNow) +
        '</div><div class="font-9 text-subtle">' +
        eligibleNow +
        ' eligible</div></div>' +
        '<div><div class="sim-sum-lbl">THR simulasi</div><div class="sim-sum-val sim-up">' +
        fmt(totSim) +
        '</div><div class="font-9 text-subtle">' +
        eligibleSim +
        ' eligible</div></div>' +
        '<div><div class="sim-sum-lbl">Δ total THR</div><div class="sim-sum-val ' +
        (dT >= 0 ? 'sim-up' : 'sim-down') +
        '">' +
        (dT >= 0 ? '+' : '') +
        fmt(dT) +
        '</div></div>' +
        '<div><div class="sim-sum-lbl">Dasar THR</div><div class="sim-sum-val font-12">Gapok + tunjangan tetap (ikut THR)</div></div>' +
        '</div><p class="font-11 text-muted" style="margin:.65rem 0 0">Sandbox THR — tidak mengubah <code>thrManual</code> atau profil. Periode: <strong>' +
        escapeHtml(p.nama) +
        '</strong>' +
        (p.thr_aktif ? ' · <span class="ct-purple">THR aktif di periode ini</span>' : '') +
        '</p>';
    }
  };

  window.renderSimulasiPesangon = function () {
    var wrap = document.getElementById('sim-psg-results');
    var detail = document.getElementById('sim-psg-detail');
    if (!wrap) return;
    populateSimPsgNik();
    var alSel = document.getElementById('sim-psg-alasan');
    if (alSel && alSel.options.length <= 1 && typeof PHK_ALASAN_OPTS !== 'undefined') {
      alSel.innerHTML = PHK_ALASAN_OPTS.map(function (o) {
        return '<option value="' + escapeHtml(o.id) + '">' + escapeHtml(o.lbl || o.id) + '</option>';
      }).join('');
    }
    var sim = window.__sigajiSimPsg || PSG_SIM_DEFAULT;
    var nkEl = document.getElementById('sim-psg-nik');
    var tglEl = document.getElementById('sim-psg-tgl');
    var alEl = document.getElementById('sim-psg-alasan');
    var scEl = document.getElementById('sim-psg-sisa-cuti');
    if (nkEl) {
      if (!sim.nik && nkEl.value) sim.nik = nkEl.value;
      nkEl.value = sim.nik || nkEl.value || '';
    }
    var k = (karyawan || []).find(function (x) {
      return x && x.nik === (sim.nik || (nkEl && nkEl.value));
    });
    if (k && !sim.tglBerhenti && k.tgl_berhenti) sim.tglBerhenti = k.tgl_berhenti;
    if (tglEl) tglEl.value = sim.tglBerhenti || '';
    if (alEl) alEl.value = sim.alasan || 'phk_1x';
    if (scEl) scEl.value = sim.sisaCuti !== '' ? sim.sisaCuti : '';

    if (!k) {
      wrap.innerHTML =
        typeof sigajiEmptyState === 'function'
          ? sigajiEmptyState({
              icon: '&#9878;',
              title: 'Pilih karyawan',
              desc: 'Simulasi pesangon membutuhkan satu karyawan — tidak menyimpan ke profil.',
              btnLabel: 'Master karyawan',
              btnOnclick: "showPg('karyawan')",
            })
          : '';
      if (detail) detail.innerHTML = '';
      return;
    }

    var kSim = simKarForPesangon(k, sim);
    if (!kSim || !kSim.tgl_berhenti) {
      wrap.innerHTML =
        '<div class="info-box info-amber font-12">Isi <strong>tanggal berhenti</strong> untuk menghitung UP, UPMK, UPH, dan total pesangon.</div>';
      if (detail) detail.innerHTML = '';
      return;
    }

    var r0 = typeof hitungPesangon === 'function' ? hitungPesangon(k) : { ok: false };
    var r1 = hitungPesangon(kSim);
    if (!r1.ok) {
      wrap.innerHTML = '<div class="ct-danger" style="padding:1rem">' + escapeHtml(r1.pesan || 'Tidak dapat dihitung') + '</div>';
      if (detail) detail.innerHTML = '';
      return;
    }

    wrap.innerHTML =
      '<div class="sim-sum-grid">' +
      '<div><div class="sim-sum-lbl">UP</div><div class="sim-sum-val">' +
      fmt(r1.up) +
      '</div></div>' +
      '<div><div class="sim-sum-lbl">UPMK</div><div class="sim-sum-val">' +
      fmt(r1.upmk) +
      '</div></div>' +
      '<div><div class="sim-sum-lbl">UPH + tambahan</div><div class="sim-sum-val">' +
      fmt(r1.uph) +
      '</div></div>' +
      '<div><div class="sim-sum-lbl">Uang pisah</div><div class="sim-sum-val">' +
      fmt(r1.pisah) +
      '</div></div>' +
      '<div class="rounded-md mt-sm" style="grid-column:1/-1; padding:.75rem; background:#f0fdf4; border:1px solid #86efac">' +
      '<div class="sim-sum-lbl">Total estimasi pesangon (simulasi)</div>' +
      '<div class="sim-sum-val" style="font-size:1.35rem;color:#166534">' +
      fmt(r1.total) +
      '</div></div></div>';

    var alasanLbl =
      typeof PHK_ALASAN_OPTS !== 'undefined'
        ? (PHK_ALASAN_OPTS.find(function (o) { return o.id === sim.alasan; }) || {}).lbl || sim.alasan
        : sim.alasan;
    var delta = r0.ok ? r1.total - r0.total : null;

    if (detail) {
      detail.innerHTML =
        '<div class="card card-surface-neutral border-accent-purple">' +
        '<div class="ct ct-purple">Rincian simulasi — ' +
        escapeHtml(k.nama) +
        '</div>' +
        '<div class="u-hint-12">' +
        '<p><strong>Alasan:</strong> ' +
        escapeHtml(alasanLbl) +
        '<br><strong>Tgl berhenti:</strong> ' +
        fmtDate(kSim.tgl_berhenti) +
        '<br><strong>Masa kerja:</strong> ' +
        r1.mk +
        ' bulan · <strong>Dasar upah:</strong> ' +
        fmt(r1.dasar) +
        '/bulan</p>' +
        '<p>UP: ' +
        r1.bUp +
        ' × dasar × faktor · UPMK: ' +
        r1.bUpmk +
        ' × dasar · UPH cuti: ' +
        r1.sisaCuti +
        ' hari (otomatis: ' +
        r1.sisaCutiAuto +
        ')</p>' +
        (delta != null && delta !== 0
          ? '<p class="' +
            (delta > 0 ? 'sim-up' : 'sim-down') +
            '">Δ vs profil saat ini: <strong>' +
            (delta > 0 ? '+' : '') +
            fmt(delta) +
            '</strong></p>'
          : '') +
        '<p class="font-11 text-muted m-0">Estimasi PP 35/2021 — bukan pengganti konsultasi hukum. Simpan resmi lewat modul <em>Pesangon &amp; PHK</em>.</p>' +
        '</div></div>';
    }
  };

  window.renderSimulasiSandbox = function () {
    sigajiSimSwitchTab(window.__sigajiSimTab || 'gaji');
  };
})();
