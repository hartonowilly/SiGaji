/* SiGaji — layar pertama dashboard: status, perlu tindakan, 3 angka */
(function () {
  var MAX_TINDAKAN = 8;
  var ANOMALI_LABEL = {
    no_tax_id: 'belum punya NPWP / No. KTP lengkap',
    pph_zero: 'pajak 0 padahal seharusnya ada',
    neto_spike: 'gaji naik tajam dibanding bulan lalu',
    neto_drop: 'gaji turun tajam dibanding bulan lalu',
    komp_naik: 'komponen gaji naik dibanding bulan lalu',
    komp_turun: 'komponen gaji turun dibanding bulan lalu',
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

  function peopleFrom(arr) {
    return (arr || [])
      .map(function (x) {
        if (!x || !x.nik) return null;
        return {
          nik: String(x.nik),
          nama: x.nama || x.nik,
          hint: x.desc || x.hint || '',
        };
      })
      .filter(Boolean);
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

    var janNama =
      typeof isNamaPeriodeJanuari === 'function'
        ? isNamaPeriodeJanuari(p.nama)
        : /^januari\b/i.test(String(p.nama || '').trim());
    var janStart = String(p.start || '').length >= 7 && String(p.start).substring(5, 7) === '01';
    if (janNama || janStart) {
      var thJan =
        typeof sigajiTahunPtkpJanuari === 'function' ? sigajiTahunPtkpJanuari(p) : '';
      if (!thJan) {
        var ym = String(p.nama || '').match(/(\d{4})/);
        thJan = ym ? ym[1] : String(p.start || '').slice(0, 4);
      }
      var prs = opts.perusahaan || (typeof perusahaan !== 'undefined' ? perusahaan : null);
      var sudah = !!(prs && thJan && String(prs.ptkpJanuariTahun || '') === String(thJan));
      if (thJan && !sudah) {
        pushItem(out, {
          id: 'ptkp-januari',
          prio: 0,
          text: 'Update status PTKP awal tahun ' + thJan + ' (karyawan di periode ini)',
          btn: 'Buka formulir',
          openPtkp: true,
          periodeNama: p.nama,
        });
      }
    }

    if (norekKosong.length) {
      pushItem(out, {
        id: 'norek',
        prio: 1,
        text:
          norekKosong.length +
          ' karyawan belum punya nomor rekening (' +
          sampleNames(norekKosong, 3) +
          ')',
        btn: norekKosong.length === 1 ? 'Buka profil' : 'Lihat siapa',
        pg: 'karyawan',
        nik: norekKosong[0].nik,
        people: peopleFrom(norekKosong),
      });
    }
    if (gapokKosong.length) {
      pushItem(out, {
        id: 'gapok',
        prio: 1,
        text:
          gapokKosong.length +
          ' karyawan gaji pokok masih 0 (' +
          sampleNames(gapokKosong, 3) +
          ')',
        btn: gapokKosong.length === 1 ? 'Isi gaji' : 'Lihat siapa',
        pg: 'karyawan',
        nik: gapokKosong[0].nik,
        openPayroll: true,
        people: peopleFrom(gapokKosong),
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
      var payroll =
        code === 'pph_zero' ||
        code === 'neto_negative' ||
        code === 'neto_spike' ||
        code === 'neto_drop' ||
        code === 'komp_naik' ||
        code === 'komp_turun';
      pushItem(out, {
        id: 'anom-' + code,
        prio: sev,
        text:
          arr.length === 1
            ? (first.nama || first.nik) + ' ' + label
            : arr.length + ' karyawan ' + label + ' (' + sampleNames(arr, 3) + ')',
        btn: arr.length === 1 ? 'Buka' : 'Lihat siapa',
        pg: payroll ? 'kompgaji' : 'karyawan',
        nik: first.nik,
        openPayroll: payroll,
        people: peopleFrom(arr),
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
          text: empty.length + ' karyawan belum diisi uang makan (' + sampleNames(empty, 3) + ')',
          btn: empty.length === 1 ? 'Isi uang makan' : 'Lihat siapa',
          pg: 'kompgaji',
          people: peopleFrom(empty),
        });
      }
    }

    if (absenKosong.length && absenKosong.length < (list || []).length) {
      pushItem(out, {
        id: 'absen',
        prio: 4,
        text: absenKosong.length + ' karyawan belum ada absensi di periode ini (' + sampleNames(absenKosong, 3) + ')',
        btn: absenKosong.length === 1 ? 'Buka absensi' : 'Lihat siapa',
        pg: 'absensi',
        abpanel: 'abt-kalender',
        people: peopleFrom(absenKosong),
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

  function findTindakan(id) {
    var items = window.__sigajiDashTindakan || [];
    for (var i = 0; i < items.length; i++) {
      if (items[i].id === id) return items[i];
    }
    return null;
  }

  function goTindakanPage(item) {
    if (!item) return;
    if (item.fn && typeof window[item.fn] === 'function') {
      window[item.fn](item.fnArg);
      return;
    }
    if (item.openPtkp && typeof openPtkpJanuariModal === 'function') {
      openPtkpJanuariModal(item.periodeNama);
      return;
    }
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
  }

  window.sigajiDashCloseTindakanOrang = function () {
    var m = document.getElementById('m-dash-tindakan-orang');
    if (m) m.remove();
    if (document.body) document.body.style.overflow = '';
  };

  window.sigajiDashOpenOrang = function (nik, mode) {
    window.sigajiDashCloseTindakanOrang();
    if (!nik) return;
    if (mode === 'payroll') {
      if (typeof showPg === 'function') showPg('kompgaji');
      setTimeout(function () {
        if (typeof openPayrollPanel === 'function') openPayrollPanel(nik);
      }, 80);
      return;
    }
    if (typeof showPg === 'function') showPg('karyawan');
    setTimeout(function () {
      if (typeof openPanel === 'function') openPanel(nik);
    }, 80);
  };

  window.sigajiDashShowTindakanOrang = function (item) {
    if (!item || !item.people || !item.people.length) return;
    window.sigajiDashCloseTindakanOrang();
    var mode = item.openPayroll ? 'payroll' : 'profil';
    var btnLbl = item.openPayroll ? 'Buka gaji' : 'Buka profil';
    var rows = item.people
      .map(function (p) {
        return (
          '<li class="dash-tindakan-orang-row">' +
          '<div class="dash-tindakan-orang-meta"><strong>' +
          eh(p.nama) +
          '</strong><div class="u-muted-10">' +
          eh(p.nik) +
          (p.hint ? ' · ' + eh(p.hint) : '') +
          '</div></div>' +
          '<span class="dash-tindakan-orang-aksi"><button type="button" class="btn btn-xs btn-p" data-sigaji-action="invoke" data-fn="sigajiDashOpenOrang" data-arg="' +
          eh(p.nik) +
          '" data-arg2="' +
          mode +
          '">' +
          eh(btnLbl) +
          '</button></span></li>'
        );
      })
      .join('');
    var wrap = document.createElement('div');
    wrap.id = 'm-dash-tindakan-orang';
    wrap.className = 'mbd show';
    var html =
      '<div class="modal dash-tindakan-orang-modal">' +
      '<div class="modal-head"><strong>' +
      eh(item.text) +
      '</strong></div>' +
      '<p class="font-11 text-muted mt-0 mb-md">Ini orangnya — buka satu per satu.</p>' +
      '<ul class="dash-tindakan-orang-list">' +
      rows +
      '</ul>' +
      '<div class="mfoot mt-lg">' +
      '<button type="button" class="btn btn-sm btn-out" data-sigaji-action="invoke" data-fn="sigajiDashCloseTindakanOrang">Tutup</button>' +
      '</div></div>';
    wrap.innerHTML = html;
    document.body.appendChild(wrap);
    document.body.style.overflow = 'hidden';
    wrap.addEventListener('click', function (ev) {
      if (ev.target === wrap) window.sigajiDashCloseTindakanOrang();
    });
  };

  function isoInRange(iso, start, end) {
    var d = String(iso || '').slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) return false;
    var a = String(start || '').slice(0, 10);
    var b = String(end || '').slice(0, 10);
    if (a && d < a) return false;
    if (b && d > b) return false;
    return true;
  }

  window.sigajiCollectTutupBulan = function (opts) {
    opts = opts || {};
    var p = opts.p || (typeof PA === 'function' ? PA() : null);
    var list =
      opts.list ||
      (p && typeof karyawanListPeriode === 'function' ? karyawanListPeriode(p) : []);
    var out = [];
    if (!p) return out;

    var locked = !!p.snapshot_locked;
    out.push({
      id: 'tutup-kunci',
      ok: locked,
      text: locked ? 'Snapshot terkunci' : 'Belum kunci periode ini',
      btn: locked ? 'Periode berikutnya' : 'Kunci sekarang',
      fn: locked ? 'buatPeriodeBerikutnya' : 'dashTutupKunciAktif',
    });

    var norekKosong = (list || []).filter(function (k) {
      return k && k.nik && !String(k.norek || '').replace(/[^\d]/g, '');
    });
    out.push({
      id: 'tutup-norek',
      ok: !norekKosong.length,
      text: norekKosong.length
        ? norekKosong.length + ' NIK tanpa rekening (' + sampleNames(norekKosong, 3) + ')'
        : 'Semua NIK punya rekening',
      btn: norekKosong.length ? (norekKosong.length === 1 ? 'Buka profil' : 'Lihat siapa') : '',
      pg: norekKosong.length ? 'karyawan' : '',
      nik: norekKosong[0] && norekKosong[0].nik,
      people: peopleFrom(norekKosong),
    });

    var masuk = (list || []).filter(function (k) {
      return k && isoInRange(k.masuk, p.start, p.end);
    });
    out.push({
      id: 'tutup-masuk',
      ok: true,
      info: true,
      text: masuk.length
        ? masuk.length + ' masuk di periode ini (' + sampleNames(masuk, 3) + ')'
        : 'Tidak ada karyawan masuk di periode ini',
      btn: masuk.length > 1 ? 'Lihat siapa' : masuk.length === 1 ? 'Buka profil' : '',
      pg: masuk.length ? 'karyawan' : '',
      nik: masuk[0] && masuk[0].nik,
      people: peopleFrom(masuk),
    });

    var resign = (list || []).filter(function (k) {
      return k && isoInRange(k.tgl_berhenti, p.start, p.end);
    });
    out.push({
      id: 'tutup-resign',
      ok: true,
      info: true,
      text: resign.length
        ? resign.length + ' resign di periode ini (' + sampleNames(resign, 3) + ')'
        : 'Tidak ada resign di periode ini',
      btn: resign.length > 1 ? 'Lihat siapa' : resign.length === 1 ? 'Buka profil' : '',
      pg: resign.length ? 'karyawan' : '',
      nik: resign[0] && resign[0].nik,
      people: peopleFrom(resign),
    });

    var prs = opts.perusahaan || (typeof perusahaan !== 'undefined' ? perusahaan : null);
    var stamp = prs && prs.bpjs_file_periode && prs.bpjs_file_periode[p.nama];
    var bpjsOk = !!(stamp && stamp.tk && stamp.kes);
    var bpjsParts = [];
    if (!(stamp && stamp.tk)) bpjsParts.push('TK');
    if (!(stamp && stamp.kes)) bpjsParts.push('Kesehatan');
    out.push({
      id: 'tutup-bpjs',
      ok: bpjsOk,
      text: bpjsOk ? 'File BPJS TK & Kesehatan sudah diunduh' : 'BPJS belum file' + (bpjsParts.length ? ' (' + bpjsParts.join(' & ') + ')' : ''),
      btn: bpjsOk ? '' : 'Unduh file',
      pg: bpjsOk ? '' : 'laporan',
    });

    var meta = opts.slipMeta;
    if (!meta) {
      out.push({
        id: 'tutup-slip-tg',
        ok: false,
        pending: true,
        text: 'Slip Telegram: memuat status…',
        btn: 'Buka slip',
        pg: 'slip',
      });
      out.push({
        id: 'tutup-slip-em',
        ok: false,
        pending: true,
        text: 'Slip email: memuat status…',
        btn: 'Buka slip',
        pg: 'slip',
      });
    } else if (meta.offline) {
      out.push({
        id: 'tutup-slip-tg',
        ok: true,
        info: true,
        text: 'Slip Telegram/email: mode online dibutuhkan untuk status kirim',
        btn: 'Buka slip',
        pg: 'slip',
      });
    } else {
      var tgB = (meta.tg || {});
      var emB = (meta.email || {});
      var linked = tgB.linked;
      var tgSent = 0;
      var tgUnlinked = 0;
      var tgBelum = 0;
      var emSent = 0;
      var emBelum = 0;
      (list || []).forEach(function (k) {
        if (!k || !k.nik) return;
        var nk = String(k.nik).trim();
        var L = linked && typeof linked.has === 'function' && linked.has(nk);
        var tgSm = (tgB.sentMap && tgB.sentMap[nk]) || {};
        var emSm = (emB.sentMap && emB.sentMap[nk]) || {};
        if (tgSm.gaji) tgSent++;
        else if (!L) tgUnlinked++;
        else tgBelum++;
        if (emSm.gaji) emSent++;
        else emBelum++;
      });
      var tgOk = tgBelum === 0 && tgUnlinked === 0;
      var tgTxt = tgOk
        ? 'Slip Telegram: semua terkirim (' + tgSent + ')'
        : 'Slip Telegram belum kirim: ' +
          (tgBelum ? tgBelum + ' gagal/belum' : '') +
          (tgBelum && tgUnlinked ? ', ' : '') +
          (tgUnlinked ? tgUnlinked + ' belum taut' : '');
      out.push({
        id: 'tutup-slip-tg',
        ok: tgOk,
        text: tgTxt,
        btn: 'Buka slip',
        pg: 'slip',
      });
      out.push({
        id: 'tutup-slip-em',
        ok: emBelum === 0,
        text:
          emBelum === 0
            ? 'Slip email: semua terkirim (' + emSent + ')'
            : 'Slip email belum kirim: ' + emBelum + ' orang',
        btn: 'Buka slip',
        pg: 'slip',
      });
    }
    return out;
  };

  window.dashTutupKunciAktif = function () {
    var p = typeof PA === 'function' ? PA() : null;
    if (!p) return;
    if (typeof toggleLockPeriode === 'function') toggleLockPeriode(p.id);
  };

  function renderTutupRows(items) {
    return (
      '<ul class="dash-tindakan-list dash-tutup-list">' +
      items
        .map(function (it) {
          var cls = it.ok ? 'dash-tutup-ok' : it.info ? 'dash-tutup-info' : 'dash-tutup-todo';
          var btn = it.btn
            ? '<button type="button" class="btn btn-xs ' +
              (it.ok || it.info ? 'btn-out' : 'btn-p') +
              '" data-sigaji-action="invoke" data-fn="sigajiDashGoTindakan" data-arg="' +
              eh(it.id) +
              '">' +
              eh(it.btn) +
              '</button>'
            : '';
          return (
            '<li class="dash-tindakan-row ' +
            cls +
            '"><span class="dash-tindakan-text">' +
            eh(it.text) +
            '</span>' +
            btn +
            '</li>'
          );
        })
        .join('') +
      '</ul>'
    );
  }

  window.sigajiDashGoTindakan = function (id) {
    var item = findTindakan(id);
    if (!item) return;
    if (item.people && item.people.length > 1) {
      window.sigajiDashShowTindakanOrang(item);
      return;
    }
    goTindakanPage(item);
  };

  window.sigajiRenderDashBrief = function (ctx) {
    ctx = ctx || {};
    var host = document.getElementById('dash-brief');
    if (!host) return;
    var p = ctx.p || (typeof PA === 'function' ? PA() : null);
    var status = window.sigajiDashStatusLine(p);
    var slipKey = p && p.nama;
    if (window.__sigajiDashSlipMetaKey !== slipKey) {
      window.__sigajiDashSlipMeta = null;
      window.__sigajiDashSlipMetaKey = slipKey;
      window.__sigajiDashSlipMetaLoading = false;
    }
    var items = window.sigajiCollectDashTindakan({
      p: p,
      list: ctx.list,
      pendingAp: ctx.pAp,
      thrAktif: ctx.thrAktif,
    });
    var cloudOn =
      typeof sigajiIsCloudConfigured === 'function' &&
      sigajiIsCloudConfigured() &&
      window.sigajiSupabase;
    if (!ctx.slipMeta && !window.__sigajiDashSlipMeta && !cloudOn) {
      window.__sigajiDashSlipMeta = { offline: true };
    }
    var tutup = window.sigajiCollectTutupBulan({
      p: p,
      list: ctx.list,
      perusahaan: ctx.perusahaan,
      slipMeta: ctx.slipMeta != null ? ctx.slipMeta : window.__sigajiDashSlipMeta,
    });
    window.__sigajiDashTindakan = items.concat(tutup);

    if (!ctx.slipMeta && !window.__sigajiDashSlipMeta && !window.__sigajiDashSlipMetaLoading && cloudOn && p && typeof loadSlipSendMetaBundle === 'function') {
      window.__sigajiDashSlipMetaLoading = true;
      loadSlipSendMetaBundle(p)
        .then(function (bundle) {
          window.__sigajiDashSlipMeta = bundle;
          window.__sigajiDashSlipMetaLoading = false;
          window.sigajiRenderDashBrief(ctx);
        })
        .catch(function () {
          window.__sigajiDashSlipMeta = { offline: true };
          window.__sigajiDashSlipMetaLoading = false;
          window.sigajiRenderDashBrief(ctx);
        });
    }

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
      '<section class="dash-tindakan dash-tutup-bulan" id="dash-tutup-bulan" aria-label="Tutup bulan">' +
      '<h2 class="dash-brief-h">Tutup bulan</h2>' +
      renderTutupRows(tutup) +
      '</section>' +
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
