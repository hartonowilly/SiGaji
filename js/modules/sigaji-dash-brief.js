/* SiGaji — layar pertama dashboard: status, perlu tindakan, 3 angka */
(function () {
  var MAX_TINDAKAN = 8;
  var ANOMALI_LABEL = {
    no_tax_id: 'belum punya NPWP / No. KTP lengkap',
    pph_zero: 'pajak 0 padahal seharusnya ada',
    neto_spike: 'gaji naik tajam dibanding bulan lalu',
    neto_drop: 'gaji turun tajam dibanding bulan lalu',
    neto_negative: 'gaji minus',
  };

  function eh(s) {
    return typeof escapeHtml === 'function' ? escapeHtml(String(s == null ? '' : s)) : String(s == null ? '' : s);
  }

  function money(n) {
    return typeof fmt === 'function' ? fmt(n) : String(Math.round(n || 0));
  }

  function isBranchHrd() {
    try {
      return !!(typeof CU !== 'undefined' && CU && CU.role === 'HRD' && CU.cabangId);
    } catch (e) {
      return false;
    }
  }

  function daysUntilIso(iso) {
    if (!iso) return null;
    var t = new Date(String(iso).trim() + 'T12:00:00').getTime();
    if (isNaN(t)) return null;
    return Math.ceil((t - Date.now()) / 86400000);
  }

  function sampleNames(arr, max) {
    max = max || 2;
    var names = arr
      .map(function (x) {
        return x.nama || x.nik;
      })
      .filter(Boolean)
      .slice(0, max);
    var more = arr.length - names.length;
    return names.join(', ') + (more > 0 ? ' +' + more + ' lain' : '');
  }

  function pushItem(out, item) {
    if (!item || !item.id) return;
    out.push(item);
  }

  window.sigajiDashStatusLine = function (p) {
    if (!p) return 'Belum ada periode aktif';
    var nama = p.nama || 'Periode';
    var locked = !!p.snapshot_locked;
    var parts = [nama];
    if (locked) {
      parts.push('terkunci');
    } else {
      var d = daysUntilIso(p.bayar);
      if (d == null) parts.push('belum dikunci');
      else if (d > 1) parts.push('gajian ' + d + ' hari lagi', 'belum dikunci');
      else if (d === 1) parts.push('gajian besok', 'belum dikunci');
      else if (d === 0) parts.push('gajian hari ini', 'belum dikunci');
      else parts.push('tanggal bayar lewat ' + Math.abs(d) + ' hari', 'belum dikunci');
    }
    return parts.join(' · ');
  };

  window.sigajiCollectDashTindakan = function (opts) {
    opts = opts || {};
    var p = opts.p || (typeof PA === 'function' ? PA() : null);
    var list =
      opts.list ||
      (p && typeof karyawanListPeriode === 'function' ? karyawanListPeriode(p) : []);
    var branch = opts.branchHrd != null ? !!opts.branchHrd : isBranchHrd();
    var out = [];
    if (!p) return out;

    var norekKosong = [];
    var gapokKosong = [];
    var absenKosong = [];
    var days = typeof absensiDaysFromPeriode === 'function' ? absensiDaysFromPeriode(p) : [];
    var absMap = typeof absensi !== 'undefined' ? absensi : opts.absensi || {};

    (list || []).forEach(function (k) {
      if (!k || !k.nik) return;
      if (!String(k.norek || '').replace(/[^\d]/g, '')) {
        norekKosong.push(k);
      }
      if (!(Number(k.gapok) > 0)) {
        gapokKosong.push(k);
      }
      if (days && days.length) {
        var rec = absMap[k.nik] || {};
        var ada = days.some(function (d) {
          return d && d.date && rec[d.date];
        });
        if (!ada) absenKosong.push(k);
      }
    });

    if (norekKosong.length) {
      pushItem(out, {
        id: 'norek',
        prio: 1,
        text:
          norekKosong.length +
          ' karyawan belum punya nomor rekening' +
          (norekKosong.length <= 3 ? ' (' + sampleNames(norekKosong, 3) + ')' : ''),
        btn: norekKosong.length === 1 ? 'Buka profil' : 'Buka karyawan',
        pg: 'karyawan',
        nik: norekKosong[0].nik,
      });
    }
    if (gapokKosong.length) {
      pushItem(out, {
        id: 'gapok',
        prio: 1,
        text:
          gapokKosong.length +
          ' karyawan gaji pokok masih 0' +
          (gapokKosong.length <= 3 ? ' (' + sampleNames(gapokKosong, 3) + ')' : ''),
        btn: 'Isi gaji',
        pg: 'karyawan',
        nik: gapokKosong[0].nik,
        openPayroll: true,
      });
    }

    var pending = 0;
    if (opts.pendingAp != null) {
      pending = Number(opts.pendingAp) || 0;
    } else if (typeof approvals !== 'undefined' && Array.isArray(approvals)) {
      pending = approvals.filter(function (a) {
        return a && a.status === 'pending' && a.period === p.nama;
      }).length;
    }
    if (pending > 0) {
      pushItem(out, {
        id: 'cuti',
        prio: 2,
        text: pending + ' pengajuan cuti menunggu persetujuan',
        btn: 'Buka pengajuan',
        pg: 'absensi',
        abpanel: 'abt-pengajuan',
      });
    }

    var anom =
      opts.anomalies ||
      (typeof sigajiPayrollAnomaliesActionable === 'function'
        ? sigajiPayrollAnomaliesActionable(p.nama)
        : []);
    var byCode = {};
    (anom || []).forEach(function (a) {
      var c = a.code || 'lain';
      if (!byCode[c]) byCode[c] = [];
      byCode[c].push(a);
    });
    Object.keys(byCode).forEach(function (code) {
      var arr = byCode[code];
      var sev = arr[0].severity === 'high' ? 1 : 4;
      var label = ANOMALI_LABEL[code] || arr[0].title || code;
      var first = arr[0];
      pushItem(out, {
        id: 'anom-' + code,
        prio: sev,
        text:
          arr.length === 1
            ? (first.nama || first.nik) + ' ' + label
            : arr.length + ' karyawan ' + label,
        btn: arr.length === 1 ? 'Buka' : 'Cek karyawan',
        pg: 'karyawan',
        nik: first.nik,
        openPayroll: code === 'pph_zero' || code === 'neto_negative' || code === 'neto_spike' || code === 'neto_drop',
      });
    });

    var makanCol = null;
    var cols =
      opts.tunjVarColumns ||
      (typeof tunjVarColumns !== 'undefined' ? tunjVarColumns : null);
    if (Array.isArray(cols)) {
      cols.forEach(function (c) {
        if (c && /makan/i.test(String(c.nama || ''))) makanCol = c;
      });
    }
    var tvBulan = opts.tunjVarBulan || (typeof tunjVarBulan !== 'undefined' ? tunjVarBulan : {});
    if (makanCol && p.nama) {
      var filled = 0;
      var empty = [];
      (list || []).forEach(function (k) {
        if (!k || !k.nik) return;
        var row = (tvBulan[p.nama] || {})[k.nik] || {};
        var v = Number(row[makanCol.id]) || 0;
        if (v > 0) filled++;
        else empty.push(k);
      });
      if (filled > 0 && empty.length > 0) {
        pushItem(out, {
          id: 'makan',
          prio: 4,
          text: empty.length + ' karyawan belum diisi uang makan',
          btn: 'Isi uang makan',
          pg: 'kompgaji',
        });
      }
    }

    if (absenKosong.length && absenKosong.length < (list || []).length) {
      pushItem(out, {
        id: 'absen',
        prio: 4,
        text: absenKosong.length + ' karyawan belum ada absensi di periode ini',
        btn: 'Buka absensi',
        pg: 'absensi',
        abpanel: 'abt-kalender',
      });
    }

    var deadlines =
      opts.deadlines ||
      (typeof sigajiComplianceDeadlines === 'function' ? sigajiComplianceDeadlines() : []);
    (deadlines || []).forEach(function (it, i) {
      if (!it) return;
      var d = it.days != null ? it.days : daysUntilIso(it.date);
      if (d == null || d > 7) return;
      if (branch && (it.cat === 'bpjs' || it.cat === 'pph')) return;
      var pg = 'penggajian';
      var btn = 'Buka penggajian';
      if (it.cat === 'thr') {
        pg = 'thr';
        btn = 'Buka THR';
      } else if (it.cat === 'bpjs') {
        pg = 'laporan';
        btn = 'Buka laporan';
      } else if (it.cat === 'pph') {
        pg = 'laporan';
        btn = 'Buka laporan';
      }
      var when =
        d < 0 ? 'lewat ' + Math.abs(d) + ' hari' : d === 0 ? 'hari ini' : 'H-' + d;
      pushItem(out, {
        id: 'dl-' + i,
        prio: d < 0 ? 0 : 3,
        text: (it.label || 'Deadline') + ' — ' + when,
        btn: btn,
        pg: pg,
      });
    });

    out.sort(function (a, b) {
      return (a.prio || 9) - (b.prio || 9);
    });
    return out.slice(0, MAX_TINDAKAN);
  };

  function applyDashMode() {
    var wrap = document.getElementById('dash-detail-wrap');
    if (wrap) {
      if (window.__sigajiDashDetail) wrap.classList.remove('u-hidden');
      else wrap.classList.add('u-hidden');
    }
    if (document.body) {
      document.body.classList.toggle('dash-arrange-on', !!window.__sigajiDashArrange);
    }
    var btnD = document.getElementById('btn-dash-detail');
    if (btnD) btnD.textContent = window.__sigajiDashDetail ? 'Sembunyikan detail' : 'Lihat detail';
    var btnA = document.getElementById('btn-dash-atur');
    if (btnA) btnA.textContent = window.__sigajiDashArrange ? 'Selesai atur' : 'Atur dashboard';
  }

  window.sigajiApplyDashMode = applyDashMode;

  window.sigajiToggleDashDetail = function () {
    var wasArrange = !!window.__sigajiDashArrange;
    window.__sigajiDashDetail = !window.__sigajiDashDetail;
    if (!window.__sigajiDashDetail) window.__sigajiDashArrange = false;
    if (wasArrange && !window.__sigajiDashArrange && typeof renderDash === 'function') {
      renderDash();
      return;
    }
    applyDashMode();
  };

  window.sigajiToggleDashArrange = function () {
    window.__sigajiDashArrange = !window.__sigajiDashArrange;
    if (window.__sigajiDashArrange) window.__sigajiDashDetail = true;
    if (typeof renderDash === 'function') renderDash();
    else applyDashMode();
  };

  window.sigajiDashGoTindakan = function (id) {
    var items = window.__sigajiDashTindakan || [];
    var item = null;
    for (var i = 0; i < items.length; i++) {
      if (items[i].id === id) {
        item = items[i];
        break;
      }
    }
    if (!item) return;
    if (item.pg && typeof showPg === 'function') showPg(item.pg);
    if (item.abpanel) {
      var tab = document.querySelector('#pg-absensi .tab[data-abpanel="' + item.abpanel + '"]');
      if (tab && typeof switchAbTab === 'function') switchAbTab(tab, item.abpanel);
    }
    var nik = item.nik;
    if (nik) {
      setTimeout(function () {
        if (item.openPayroll && typeof openPayrollPanel === 'function') openPayrollPanel(nik);
        else if (typeof openPanel === 'function') openPanel(nik);
      }, 80);
    }
  };

  window.sigajiRenderDashBrief = function (ctx) {
    ctx = ctx || {};
    var host = document.getElementById('dash-brief');
    if (!host) return;
    var p = ctx.p || (typeof PA === 'function' ? PA() : null);
    var status = window.sigajiDashStatusLine(p);
    var items = window.sigajiCollectDashTindakan({
      p: p,
      list: ctx.list,
      pendingAp: ctx.pAp,
      thrAktif: ctx.thrAktif,
    });
    window.__sigajiDashTindakan = items;

    var tindakanHtml;
    if (!items.length) {
      tindakanHtml =
        '<div class="dash-tindakan-ok">Semua beres untuk periode ini.</div>';
    } else {
      tindakanHtml =
        '<ul class="dash-tindakan-list">' +
        items
          .map(function (it) {
            return (
              '<li class="dash-tindakan-row">' +
              '<span class="dash-tindakan-text">' +
              eh(it.text) +
              '</span>' +
              '<button type="button" class="btn btn-xs btn-p" data-sigaji-action="invoke" data-fn="sigajiDashGoTindakan" data-arg="' +
              eh(it.id) +
              '">' +
              eh(it.btn || 'Buka') +
              '</button></li>'
            );
          })
          .join('') +
        '</ul>';
    }

    var nKar = ctx.nKar != null ? ctx.nKar : 0;
    var explain = function (type) {
      return typeof sigajiDataAction === 'function'
        ? sigajiDataAction('explain-summary', { type: type })
        : '';
    };
    var html =
      '<div class="dash-status" role="status">' +
      eh(status) +
      (ctx.thrAktif ? ' <span class="bdg b-pu">THR</span>' : '') +
      '</div>' +
      '<section class="dash-tindakan" aria-label="Perlu tindakan">' +
      '<h2 class="dash-brief-h">Perlu tindakan</h2>' +
      tindakanHtml +
      '</section>' +
      '<section class="dash-kpi3" aria-label="Ringkasan angka">' +
      '<button type="button" class="dash-kpi3-card" ' +
      explain('neto') +
      '><div class="dash-kpi3-lbl">Total dibayar ke karyawan</div>' +
      '<div class="dash-kpi3-val">' +
      eh(money(ctx.tN)) +
      '</div></button>' +
      '<button type="button" class="dash-kpi3-card" ' +
      explain('pph') +
      '><div class="dash-kpi3-lbl">Pajak dipotong (PPh 21)</div>' +
      '<div class="dash-kpi3-val">' +
      eh(money(ctx.tP)) +
      '</div></button>' +
      '<div class="dash-kpi3-card dash-kpi3-static"><div class="dash-kpi3-lbl">Jumlah karyawan</div>' +
      '<div class="dash-kpi3-val">' +
      eh(String(nKar)) +
      '</div></div></section>' +
      '<p class="dash-kpi3-hint">Perkiraan periode ini — bukan slip final. Klik angka untuk rincian. ' +
      '<button type="button" class="btn-link" ' +
      explain('bruto') +
      '>Lihat total sebelum pajak</button></p>';

    host.innerHTML = html;
    applyDashMode();
  };
})();
