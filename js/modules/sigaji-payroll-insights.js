/* SiGaji — kalender kepatuhan, anomali payroll, variance, audit timeline */
(function () {
  function addDaysIso(iso, days) {
    if (!iso) return '';
    var d = new Date(String(iso).trim() + 'T12:00:00');
    if (isNaN(d.getTime())) return '';
    d.setDate(d.getDate() + days);
    return d.toISOString().substring(0, 10);
  }

  function daysUntil(iso) {
    if (!iso) return null;
    var t = new Date(String(iso).trim() + 'T12:00:00').getTime();
    if (isNaN(t)) return null;
    return Math.ceil((t - Date.now()) / 86400000);
  }

  function fmtAuditTs(ts) {
    if (!ts) return '-';
    try {
      return new Date(ts).toLocaleString('id-ID', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch (e) {
      return String(ts).replace('T', ' ').substring(0, 16);
    }
  }

  function karNama(nik) {
    var k = (karyawan || []).find(function (x) {
      return x && x.nik === nik;
    });
    return k ? k.nama : nik || '-';
  }

  function sigajiDigitsOnly(s) {
    return String(s || '').replace(/\D/g, '');
  }

  /** NIK Dukcapil 16 digit — dari field No. KTP */
  window.sigajiKarKtpNik16 = function (k) {
    var d = sigajiDigitsOnly(k && k.ktp);
    if (d.length >= 16) return d.substring(0, 16);
    return d;
  };

  window.sigajiKarNpwp16 = function (k) {
    var d = sigajiDigitsOnly(k && k.npwp);
    if (d.length === 16) return d;
    if (d.length === 15) return d + '0';
    return d;
  };

  /** has_npwp | npwp_empty_ok_nik | nik_incomplete | npwp_nik_missing */
  window.sigajiKarTaxIdStatus = function (k) {
    var npwp = sigajiKarNpwp16(k);
    if (npwp && npwp.length >= 15) return 'has_npwp';
    var nik = sigajiKarKtpNik16(k);
    if (nik.length === 16) return 'npwp_empty_ok_nik';
    if (nik.length > 0) return 'nik_incomplete';
    return 'npwp_nik_missing';
  };

  window.sigajiDjpNikPortalUrl = function () {
    return 'https://portalnpwp.pajak.go.id/';
  };

  window.sigajiOpenDjpNikValidasi = function (ktpRaw) {
    var nik = sigajiDigitsOnly(ktpRaw);
    var url = sigajiDjpNikPortalUrl();
    if (nik.length >= 16) {
      nik = nik.substring(0, 16);
      try {
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(nik).then(
            function () {
              toast('NIK disalin — tempel di portal DJP untuk cek validasi.');
            },
            function () {
              toast('Buka portal DJP — NIK: ' + nik);
            }
          );
        } else {
          toast('Buka portal DJP — NIK: ' + nik);
        }
      } catch (eClip) {
        toast('Buka portal DJP untuk cek validasi NIK.');
      }
    } else {
      toast('Isi No. KTP (NIK 16 digit) di profil karyawan terlebih dahulu.');
    }
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  window.sigajiRefreshSpTaxIdHint = function () {
    var ktpEl = document.getElementById('sp-ktp-f');
    var npwpEl = document.getElementById('sp-npwp-f');
    var ktpHint = document.getElementById('sp-ktp-hint');
    var npwpHint = document.getElementById('sp-npwp-hint');
    if (!ktpEl) return;
    var st = sigajiKarTaxIdStatus({ ktp: ktpEl.value, npwp: npwpEl ? npwpEl.value : '' });
    if (ktpHint) {
      if (st === 'npwp_empty_ok_nik' || st === 'has_npwp') {
        ktpHint.innerHTML = '<span class="ct-success">✓ NIK 16 digit terisi — boleh dipakai e-Bupot jika NPWP kosong</span>';
      } else if (st === 'nik_incomplete') {
        ktpHint.innerHTML =
          '<span class="ct-warn">NIK belum 16 digit — wajib untuk e-Bupot bila NPWP kosong</span>';
      } else {
        ktpHint.textContent = 'NIK Dukcapil (16 digit) — dipakai Coretax jika NPWP tidak diisi';
      }
    }
    if (npwpHint) {
      if (st === 'has_npwp') {
        npwpHint.innerHTML = '<span class="ct-success">✓ NPWP terisi</span>';
      } else if (st === 'npwp_empty_ok_nik') {
        npwpHint.innerHTML =
          '<span class="ct-brand">NPWP kosong — OK jika NIK 16 digit terisi. <a class="ct-indigo" href="#" data-sigaji-action="djp-nik-validasi">Cek validasi di portal DJP</a></span>';
      } else if (st === 'nik_incomplete') {
        npwpHint.innerHTML =
          '<span class="ct-warn">NPWP kosong &amp; NIK tidak lengkap — isi NPWP atau lengkapi KTP 16 digit</span>';
      } else {
        npwpHint.innerHTML =
          '<span class="ct-danger">NPWP kosong — NIK juga kosong. Isi NPWP atau No. KTP 16 digit sebelum e-Bupot.</span>';
      }
    }
  };

  window.sigajiPayrollCompKey = function (k, pNama) {
    if (!k) return '';
    var row = k;
    if (pNama && typeof karSnapshot !== 'undefined' && karSnapshot[pNama] && karSnapshot[pNama][k.nik]) {
      row = Object.assign({}, k, karSnapshot[pNama][k.nik]);
    }
    var tunj = (row.tunjangan || [])
      .filter(function (t) {
        return t && t.tipe === 'tetap';
      })
      .reduce(function (s, t) {
        return s + (parseFloat(t.nilai) || 0);
      }, 0);
    return String(row.gapok || 0) + '|' + String(Math.round(tunj));
  };

  window.sigajiPreviousPeriode = function (cur) {
    if (!cur || typeof sortPeriodesByStart !== 'function') return null;
    var sorted = sortPeriodesByStart(periodes || [], false);
    var i = sorted.findIndex(function (p) {
      return String(p.id) === String(cur.id) || p.nama === cur.nama;
    });
    if (i <= 0) return null;
    return sorted[i - 1];
  };

  /** Deadline regulasi Indonesia — 90 hari ke depan + konteks periode aktif */
  window.sigajiComplianceDeadlines = function () {
    var items = [];
    var now = new Date();
    var y = now.getFullYear();
    var p = typeof PA === 'function' ? PA() : null;

    if (p && p.bayar) {
      items.push({
        date: p.bayar,
        label: 'Bayar gaji — periode ' + (p.nama || ''),
        cat: 'payroll',
        hint: 'Transfer ke rekening karyawan',
      });
    }
    if (p && p.thr_aktif && p.thr_bayar) {
      items.push({
        date: addDaysIso(p.thr_bayar, -7),
        label: 'H-7 bayar THR ' + (p.thr_nama || 'Hari Raya'),
        cat: 'thr',
        hint: 'Siapkan dana & hitung PPh THR',
      });
      items.push({
        date: p.thr_bayar,
        label: 'Batas bayar THR ' + (p.thr_nama || ''),
        cat: 'thr',
        hint: 'PP 35/2021 — paling lambat H-7 Lebaran',
      });
    }

    for (var m = 0; m < 2; m++) {
      var dm = new Date(y, now.getMonth() + m, 1);
      var ym = dm.getFullYear();
      var mo = dm.getMonth();
      var bulan = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'][mo];
      var bpjsIso =
        ym +
        '-' +
        String(mo + 1).padStart(2, '0') +
        '-15';
      items.push({
        date: bpjsIso,
        label: 'Iuran BPJS JKK/JKM/JHT/Kes — ' + bulan + ' ' + ym,
        cat: 'bpjs',
        hint: 'Bayar & lapor via BPJS Daring (umumnya tgl 15)',
      });
      var nextMo = mo + 1;
      var nextY = ym;
      if (nextMo > 11) {
        nextMo = 0;
        nextY++;
      }
      var ebupotIso =
        nextY +
        '-' +
        String(nextMo + 1).padStart(2, '0') +
        '-20';
      items.push({
        date: ebupotIso,
        label: 'e-Bupot / unggah Coretax masa ' + bulan + ' ' + ym,
        cat: 'pph',
        hint: 'XML dari Laporan → PPh 21, unggah di Coretax DJP',
      });
    }

    var sptIso = y + '-03-31';
    items.push({
      date: sptIso,
      label: 'SPT Tahunan PPh 21 (pemotong) — ' + (y - 1),
      cat: 'pph',
      hint: 'Perusahaan pemotong — lapor SPT Masa Tahunan',
    });

    var seen = {};
    items = items.filter(function (it) {
      var k = it.date + '|' + it.label;
      if (seen[k]) return false;
      seen[k] = 1;
      return it.date;
    });

    items.forEach(function (it) {
      it.days = daysUntil(it.date);
    });
    items.sort(function (a, b) {
      return (a.days == null ? 9999 : a.days) - (b.days == null ? 9999 : b.days);
    });
    return items.filter(function (it) {
      if (it.days == null) return true;
      return it.days >= -3 && it.days <= 45;
    });
  };

  /** Anomali yang perlu tindakan — bukan info NPWP+NIK OK */
  window.sigajiPayrollAnomaliesActionable = function (pNama) {
    return (window.sigajiDetectPayrollAnomalies(pNama) || []).filter(function (a) {
      return a.severity !== 'info' && a.code !== 'npwp_ok_nik';
    });
  };

  window.sigajiDetectPayrollAnomalies = function (pNama) {
    var p =
      (periodes || []).find(function (x) {
        return x.nama === pNama;
      }) || (typeof PA === 'function' ? PA() : null);
    if (!p) return [];
    var prev = sigajiPreviousPeriode(p);
    var list = typeof karyawanListPeriode === 'function' ? karyawanListPeriode(p) : [];
    var out = [];

    list.forEach(function (k) {
      if (!k || !k.nik) return;
      var g = hitungGaji(k, p.nama);
      var nama = k.nama || k.nik;

      var taxSt = sigajiKarTaxIdStatus(k);
      if (taxSt === 'nik_incomplete') {
        out.push({
          severity: 'high',
          nik: k.nik,
          nama: nama,
          code: 'no_tax_id',
          title: 'NPWP kosong — NIK tidak lengkap',
          desc:
            'No. KTP kurang dari 16 digit dan NPWP kosong — e-Bupot/Coretax akan ditolak.',
        });
      } else if (taxSt === 'npwp_nik_missing') {
        out.push({
          severity: 'high',
          nik: k.nik,
          nama: nama,
          code: 'no_tax_id',
          title: 'NPWP kosong — NIK juga kosong',
          desc: 'Isi NPWP atau No. KTP (NIK 16 digit) di profil karyawan sebelum final gaji.',
        });
      }

      if (g.grossPPh >= 4500000 && g.pph === 0 && k.ptkp && k.ptkp !== 'TK/0') {
        out.push({
          severity: 'high',
          nik: k.nik,
          nama: nama,
          code: 'pph_zero',
          title: 'PPh 21 nol padahal bruto tinggi',
          desc:
            'Bruto ' +
            fmt(g.grossPPh) +
            ' · PPh 0 — cek PTKP, komponen, atau PPh Return.',
        });
      }

      if (prev) {
        var gPrev = hitungGaji(k, prev.nama);
        if (gPrev.neto > 0) {
          var pct = (g.neto - gPrev.neto) / gPrev.neto;
          var compNow = sigajiPayrollCompKey(k, p.nama);
          var compPrev = sigajiPayrollCompKey(k, prev.nama);
          if (pct > 0.4 && compNow === compPrev) {
            out.push({
              severity: 'high',
              nik: k.nik,
              nama: nama,
              code: 'neto_spike',
              title: 'Neto naik >40% tanpa ubah komponen',
              desc:
                prev.nama +
                ': ' +
                fmt(gPrev.neto) +
                ' → ' +
                p.nama +
                ': ' +
                fmt(g.neto) +
                ' (+' +
                Math.round(pct * 100) +
                '%)',
            });
          }
          if (pct < -0.4 && compNow === compPrev) {
            out.push({
              severity: 'warn',
              nik: k.nik,
              nama: nama,
              code: 'neto_drop',
              title: 'Neto turun >40% tanpa ubah komponen',
              desc:
                prev.nama +
                ': ' +
                fmt(gPrev.neto) +
                ' → ' +
                p.nama +
                ': ' +
                fmt(g.neto) +
                ' (' +
                Math.round(pct * 100) +
                '%)',
            });
          }
        }
      }

      if (g.neto < 0) {
        out.push({
          severity: 'high',
          nik: k.nik,
          nama: nama,
          code: 'neto_negative',
          title: 'Neto negatif',
          desc: 'THP ' + fmt(g.neto) + ' — cek potongan & PPh.',
        });
      }
    });

    var order = { high: 0, warn: 1, info: 2 };
    out.sort(function (a, b) {
      return (order[a.severity] || 9) - (order[b.severity] || 9);
    });
    return out;
  };

  window.sigajiFmtAuditTimeline = function (e) {
    if (!e) return '';
    var namaKar = karNama(e.nik);
    var detail = String(e.detail || '');
    var line = '';
    var action = String(e.action || '');

    if (action === 'Simpan Komponen Gaji') {
      var gm = detail.match(/gapok=(\d+)/);
      var gapok = gm ? fmt(parseInt(gm[1], 10)) : '';
      line =
        '<strong>' +
        escapeHtml(e.by || 'Sistem') +
        '</strong> menyimpan komponen gaji <strong>' +
        escapeHtml(namaKar) +
        '</strong>' +
        (gapok ? ' · gapok ' + escapeHtml(gapok) : '') +
        (detail.indexOf('snapshot') >= 0 ? ' <span class="bdg b-info">snapshot</span>' : '');
    } else if (action.indexOf('Update Tunjangan') >= 0 || action.indexOf('Update Potongan') >= 0) {
      var ch = detail.match(/→\s*(.+)$/);
      line =
        '<strong>' +
        escapeHtml(e.by || '-') +
        '</strong> mengubah ' +
        escapeHtml(action.replace('Update ', '')) +
        ' <strong>' +
        escapeHtml(namaKar) +
        '</strong>' +
        (ch ? ' → <em>' + escapeHtml(ch[1].trim()) + '</em>' : '');
    } else if (action.indexOf('Tambah') >= 0 || action.indexOf('Hapus') >= 0) {
      line =
        '<strong>' +
        escapeHtml(e.by || '-') +
        '</strong> ' +
        escapeHtml(action.toLowerCase()) +
        ' untuk <strong>' +
        escapeHtml(namaKar) +
        '</strong>' +
        (detail ? ' — ' + escapeHtml(detail) : '');
    } else if (action.indexOf('PPh Return') >= 0) {
      line =
        '<strong>' +
        escapeHtml(e.by || '-') +
        '</strong> mengubah PPh Return <strong>' +
        escapeHtml(namaKar) +
        '</strong> — ' +
        escapeHtml(detail);
    } else {
      line =
        '<strong>' +
        escapeHtml(e.by || '-') +
        '</strong> · ' +
        escapeHtml(action) +
        ' · <strong>' +
        escapeHtml(namaKar) +
        '</strong>' +
        (detail ? '<br><span class="text-muted">' + escapeHtml(detail) + '</span>' : '');
    }
    return line;
  };

  window.renderDashComplianceCalendar = function () {
    var el = document.getElementById('d-compliance-cal');
    if (!el) return;
    var items = sigajiComplianceDeadlines().slice(0, 6);
    if (!items.length) {
      el.innerHTML =
        '<div class="text-subtle font-12" style="padding:.5rem 0">Tidak ada deadline dalam 45 hari ke depan.</div>';
      return;
    }
    var catCls = {
      thr: 'b-pu',
      pph: 'b-warn',
      bpjs: 'b-teal',
      payroll: 'b-ok',
    };
    el.innerHTML = items
      .map(function (it) {
        var d = it.days;
        var cnt =
          d == null
            ? ''
            : d < 0
              ? '<span class="bdg b-gray">+' + Math.abs(d) + ' hari lalu</span>'
              : d === 0
                ? '<span class="bdg b-err">Hari ini</span>'
                : d <= 7
                  ? '<span class="bdg b-warn">' + d + ' hari lagi</span>'
                  : '<span class="bdg b-info">' + d + ' hari lagi</span>';
        return (
          '<div class="sigaji-comp-item">' +
          '<div class="sigaji-comp-main">' +
          '<span class="bdg ' +
          (catCls[it.cat] || 'b-gray') +
          '">' +
          escapeHtml(it.cat || 'info') +
          '</span> ' +
          '<strong>' +
          escapeHtml(it.label) +
          '</strong>' +
          '<div class="sigaji-comp-meta">' +
          escapeHtml(typeof fmtDate === 'function' ? fmtDate(it.date) : it.date) +
          (it.hint ? ' · ' + escapeHtml(it.hint) : '') +
          '</div></div>' +
          '<div class="sigaji-comp-count">' +
          cnt +
          '</div></div>'
        );
      })
      .join('');
  };

  window.renderDashPayrollAnomalies = function () {
    var el = document.getElementById('d-payroll-anomalies');
    if (!el) return;
    var p = typeof PA === 'function' ? PA() : null;
    if (!p) {
      el.innerHTML = '';
      return;
    }
    var list =
      typeof sigajiPayrollAnomaliesActionable === 'function'
        ? sigajiPayrollAnomaliesActionable(p.nama)
        : sigajiDetectPayrollAnomalies(p.nama);
    if (!list.length) {
      el.innerHTML =
        '<div class="alert-item alert-green m-0">Tidak ada anomali terdeteksi untuk periode <strong>' +
        escapeHtml(p.nama) +
        '</strong>.</div>';
      return;
    }
    var h =
      '<p class="font-11 text-muted mb-md m-0">Periode <strong>' +
      escapeHtml(p.nama) +
      '</strong> — ' +
      String(list.length) +
      ' item perlu dicek sebelum final:</p>' +
      list
        .slice(0, 12)
        .map(function (a) {
          var cls =
            a.severity === 'high'
              ? 'alert-amber'
              : a.severity === 'info'
                ? 'alert-blue'
                : 'alert-item';
          var djpBtn =
            a.code === 'npwp_ok_nik'
              ? '<button type="button" class="btn btn-xs btn-out mt-xs" style="margin-right:4px"' +
                sigajiDataAction('djp-nik-validasi', { ktp: a.ktpNik != null ? String(a.ktpNik) : '' }) +
                '>Cek validasi NIK (DJP)</button>'
              : '';
          return (
            '<div class="alert-item ' +
            cls +
            '" style="margin-bottom:.4rem">' +
            '<strong>' +
            escapeHtml(a.title) +
            '</strong> — ' +
            escapeHtml(a.nama) +
            ' <span class="text-subtle">(' +
            escapeHtml(a.nik) +
            ')</span><br>' +
            '<span class="font-11">' +
            escapeHtml(a.desc) +
            '</span><br>' +
            djpBtn +
            '<button type="button" class="btn btn-xs btn-out mt-xs"' +
            (typeof sigajiDataAction === 'function'
              ? sigajiDataAction('open-profile', { nik: a.nik })
              : '') +
            '>Buka profil</button></div>'
          );
        })
        .join('');
    el.innerHTML = h;
  };

  window.renderLaporanVariance = function () {
    var wrap = document.getElementById('lap-variance-wrap');
    if (!wrap) return;
    var cur = typeof PA === 'function' ? PA() : null;
    var prev = cur ? sigajiPreviousPeriode(cur) : null;
    var hint = document.getElementById('lap-variance-hint');
    if (hint) {
      hint.innerHTML = prev
        ? 'Membandingkan periode aktif <strong>' +
          escapeHtml(cur.nama) +
          '</strong> vs sebelumnya <strong>' +
          escapeHtml(prev.nama) +
          '</strong> per departemen. Klik baris dept untuk lihat karyawan penyebab perubahan neto terbesar.'
        : 'Perlu minimal 2 periode gaji untuk perbandingan variance.';
    }
    if (!cur || !prev) {
      wrap.innerHTML =
        typeof sigajiEmptyState === 'function'
          ? sigajiEmptyState({
              icon: '&#128200;',
              title: 'Belum bisa bandingkan',
              desc: 'Buat minimal dua periode gaji di Master → Periode.',
              btnLabel: 'Atur periode',
              btnAction:'showPg',btnActionArg:'master',
            })
          : '<div class="text-subtle p-md">Perlu 2+ periode.</div>';
      return;
    }

    var depts = {};
    function addDept(dept, g, gPrev, k) {
      if (!depts[dept]) depts[dept] = { b: 0, b0: 0, p: 0, p0: 0, n: 0, n0: 0, kar: [] };
      var d = depts[dept];
      d.b += g.grossPPh;
      d.b0 += gPrev.grossPPh;
      d.p += g.pph;
      d.p0 += gPrev.pph;
      d.n += g.neto;
      d.n0 += gPrev.neto;
      d.kar.push({
        nik: k.nik,
        nama: k.nama,
        dN: g.neto - gPrev.neto,
        neto: g.neto,
        neto0: gPrev.neto,
      });
    }

    var list = typeof karyawanListPeriode === 'function' ? karyawanListPeriode(cur) : [];
    list.forEach(function (k) {
      if (!k || !k.nik) return;
      var g = hitungGaji(k, cur.nama);
      var gPrev = hitungGaji(k, prev.nama);
      addDept(k.dept || '(Tanpa dept)', g, gPrev, k);
    });

    function pct(curV, prevV) {
      if (!prevV) return curV ? 100 : 0;
      return Math.round(((curV - prevV) / prevV) * 100);
    }

    var rows = Object.entries(depts)
      .map(function (entry) {
        var dept = entry[0];
        var d = entry[1];
        d.kar.sort(function (a, b) {
          return Math.abs(b.dN) - Math.abs(a.dN);
        });
        return { dept: dept, d: d };
      })
      .sort(function (a, b) {
        return Math.abs(b.d.n - b.d.n0) - Math.abs(a.d.n - a.d.n0);
      });

    var html =
      '<div class="table-wrap"><table class="sigaji-table"><thead><tr><th>Departemen</th><th class="num">Bruto</th><th class="num">Δ Bruto</th><th class="num">PPh</th><th class="num">Δ PPh</th><th class="num">Neto</th><th class="num">Δ Neto</th><th></th></tr></thead><tbody>';
    rows.forEach(function (row, idx) {
      var d = row.d;
      var dB = d.b - d.b0;
      var dP = d.p - d.p0;
      var dN = d.n - d.n0;
      var deptEsc = escapeHtml(row.dept).replace(/'/g, '&#39;');
      html +=
        '<tr class="lap-var-dept-row cursor-pointer" data-idx="' +
        idx +
        '"' + sigajiDataAction('variance-drill', { idx: idx }) + '>' +
        '<td><strong>' +
        escapeHtml(row.dept) +
        '</strong></td>' +
        '<td class="num">' +
        fmt(d.b) +
        '</td>' +
        '<td class="num ' +
        (dB >= 0 ? 'cell-delta-up' : 'cell-delta-down') +
        '">' +
        (dB >= 0 ? '+' : '') +
        fmt(dB) +
        ' (' +
        pct(d.b, d.b0) +
        '%)</td>' +
        '<td class="num">' +
        fmt(d.p) +
        '</td>' +
        '<td class="num ' +
        (dP >= 0 ? 'cell-delta-warn' : 'cell-delta-up') +
        '">' +
        (dP >= 0 ? '+' : '') +
        fmt(dP) +
        '</td>' +
        '<td class="num fw-700 cell-neto">' +
        fmt(d.n) +
        '</td>' +
        '<td class="num fw-700 ' +
        (dN >= 0 ? 'cell-delta-up' : 'cell-delta-down') +
        '">' +
        (dN >= 0 ? '+' : '') +
        fmt(dN) +
        ' (' +
        pct(d.n, d.n0) +
        '%)</td>' +
        '<td><span class="bdg b-info">drill-down</span></td></tr>';
      html +=
        '<tr class="u-hidden" id="lap-var-drill-' +
        idx +
        '"><td class="card-surface-neutral p-var-drill" colspan="8">' +
        '<div class="font-11 fw-700 text-muted mb-sm">Top perubahan neto — ' +
        escapeHtml(row.dept) +
        '</div>' +
        '<table class="w-full font-11 sigaji-table"><thead><tr><th>Karyawan</th><th class="num">' +
        escapeHtml(prev.nama) +
        '</th><th class="num">' +
        escapeHtml(cur.nama) +
        '</th><th class="num">Δ Neto</th></tr></thead><tbody>' +
        d.kar
          .slice(0, 8)
          .map(function (kr) {
            return (
              '<tr><td><a href="#"' +
              (typeof sigajiDataAction === 'function'
                ? sigajiDataAction('open-profile', { nik: kr.nik })
                : '') +
              '>' +
              escapeHtml(kr.nama) +
              '</a></td><td class="num">' +
              fmt(kr.neto0) +
              '</td><td class="num">' +
              fmt(kr.neto) +
              '</td><td class="num fw-700 ' +
              (kr.dN >= 0 ? 'cell-delta-up' : 'cell-delta-down') +
              '">' +
              (kr.dN >= 0 ? '+' : '') +
              fmt(kr.dN) +
              '</td></tr>'
            );
          })
          .join('') +
        '</tbody></table></td></tr>';
    });
    html += '</tbody></table></div>';
    wrap.innerHTML = html;
    window._lapVarDepts = rows;
  };

  window.sigajiToggleVarianceDrill = function (idx) {
    var row = document.getElementById('lap-var-drill-' + idx);
    if (!row) return;
    var open = row.style.display !== 'none';
    document.querySelectorAll('[id^="lap-var-drill-"]').forEach(function (r) {
      r.style.display = 'none';
    });
    if (!open) row.style.display = 'table-row';
  };
})();
