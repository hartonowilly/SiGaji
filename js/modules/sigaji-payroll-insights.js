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

    for (var m = 0; m < 4; m++) {
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
      return it.days == null || it.days >= -7;
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

      if (!String(k.npwp || '').replace(/\D/g, '')) {
        out.push({
          severity: 'warn',
          nik: k.nik,
          nama: nama,
          code: 'no_npwp',
          title: 'NPWP kosong',
          desc: 'Karyawan aktif tanpa NPWP — risiko e-Bupot/Coretax ditolak.',
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

    var order = { high: 0, warn: 1 };
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
        (detail ? '<br><span style="color:#6b7280">' + escapeHtml(detail) + '</span>' : '');
    }
    return line;
  };

  window.renderDashComplianceCalendar = function () {
    var el = document.getElementById('d-compliance-cal');
    if (!el) return;
    var items = sigajiComplianceDeadlines().slice(0, 8);
    if (!items.length) {
      el.innerHTML =
        '<div style="color:#9ca3af;font-size:12px;padding:.5rem 0">Tidak ada deadline dalam 90 hari.</div>';
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
    var list = sigajiDetectPayrollAnomalies(p.nama);
    if (!list.length) {
      el.innerHTML =
        '<div class="alert-item alert-green" style="margin:0">Tidak ada anomali terdeteksi untuk periode <strong>' +
        escapeHtml(p.nama) +
        '</strong>.</div>';
      return;
    }
    el.innerHTML =
      '<p style="font-size:11px;color:#6b7280;margin:0 0 .5rem">Periode <strong>' +
      escapeHtml(p.nama) +
      '</strong> — ' +
      list.length +
      ' item perlu dicek sebelum final:</p>' +
      list
        .slice(0, 12)
        .map(function (a) {
          var cls = a.severity === 'high' ? 'alert-amber' : 'alert-item';
          var nikEsc = String(a.nik).replace(/'/g, "\\'");
          return (
            '<div class="alert-item ' +
            cls +
            '" style="margin-bottom:.4rem">' +
            '<strong>' +
            escapeHtml(a.title) +
            '</strong> — ' +
            escapeHtml(a.nama) +
            ' <span style="color:#9ca3af">(' +
            escapeHtml(a.nik) +
            ')</span><br>' +
            '<span style="font-size:11px">' +
            escapeHtml(a.desc) +
            '</span> ' +
            '<button type="button" class="btn btn-xs btn-out" style="margin-top:4px" onclick="openPanel(\'' +
            nikEsc +
            '\')">Buka profil</button></div>'
          );
        })
        .join('');
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
              btnOnclick: "showPg('master')",
            })
          : '<div style="padding:1rem;color:#9ca3af">Perlu 2+ periode.</div>';
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
      '<div class="table-wrap"><table><thead><tr><th>Departemen</th><th>Bruto</th><th>Δ Bruto</th><th>PPh</th><th>Δ PPh</th><th>Neto</th><th>Δ Neto</th><th></th></tr></thead><tbody>';
    rows.forEach(function (row, idx) {
      var d = row.d;
      var dB = d.b - d.b0;
      var dP = d.p - d.p0;
      var dN = d.n - d.n0;
      var deptEsc = escapeHtml(row.dept).replace(/'/g, '&#39;');
      html +=
        '<tr class="lap-var-dept-row" data-idx="' +
        idx +
        '" onclick="sigajiToggleVarianceDrill(' +
        idx +
        ')" style="cursor:pointer">' +
        '<td><strong>' +
        escapeHtml(row.dept) +
        '</strong></td>' +
        '<td>' +
        fmt(d.b) +
        '</td>' +
        '<td style="color:' +
        (dB >= 0 ? '#2d6a0a' : '#9b2121') +
        '">' +
        (dB >= 0 ? '+' : '') +
        fmt(dB) +
        ' (' +
        pct(d.b, d.b0) +
        '%)</td>' +
        '<td>' +
        fmt(d.p) +
        '</td>' +
        '<td style="color:' +
        (dP >= 0 ? '#7d4800' : '#2d6a0a') +
        '">' +
        (dP >= 0 ? '+' : '') +
        fmt(dP) +
        '</td>' +
        '<td><strong>' +
        fmt(d.n) +
        '</strong></td>' +
        '<td style="color:' +
        (dN >= 0 ? '#2d6a0a' : '#9b2121') +
        ';font-weight:700">' +
        (dN >= 0 ? '+' : '') +
        fmt(dN) +
        ' (' +
        pct(d.n, d.n0) +
        '%)</td>' +
        '<td><span class="bdg b-info">drill-down</span></td></tr>';
      html +=
        '<tr id="lap-var-drill-' +
        idx +
        '" style="display:none"><td colspan="8" style="background:#f8fafc;padding:.65rem 1rem">' +
        '<div style="font-size:11px;font-weight:700;color:#6b7280;margin-bottom:.35rem">Top perubahan neto — ' +
        escapeHtml(row.dept) +
        '</div>' +
        '<table style="width:100%;font-size:11px"><thead><tr><th>Karyawan</th><th>' +
        escapeHtml(prev.nama) +
        '</th><th>' +
        escapeHtml(cur.nama) +
        '</th><th>Δ Neto</th></tr></thead><tbody>' +
        d.kar
          .slice(0, 8)
          .map(function (kr) {
            var nikEsc = String(kr.nik).replace(/'/g, "\\'");
            return (
              '<tr><td><a href="#" onclick="openPanel(\'' +
              nikEsc +
              '\');return false">' +
              escapeHtml(kr.nama) +
              '</a></td><td>' +
              fmt(kr.neto0) +
              '</td><td>' +
              fmt(kr.neto) +
              '</td><td style="font-weight:700;color:' +
              (kr.dN >= 0 ? '#2d6a0a' : '#9b2121') +
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
