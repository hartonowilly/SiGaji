/**
 * SiGaji — event delegation (nav sidebar, tab modul).
 * Ganti onclick inline bertahap; tab cukup atribut data-*.
 */
(function () {
  function bindDelegatedUi() {
    document.addEventListener('click', function (ev) {
      var t = ev.target;
      if (!t || !t.closest) return;

      var ni = t.closest('.ni[data-pg]');
      if (ni && typeof showPg === 'function') {
        var pg = ni.getAttribute('data-pg');
        if (pg) {
          ev.preventDefault();
          showPg(pg);
        }
        return;
      }

      var lap = t.closest('#pg-laporan .tab[data-laptab][data-panel]');
      if (lap && typeof switchLaporanTab === 'function') {
        switchLaporanTab(lap, lap.getAttribute('data-panel'));
        return;
      }

      var kg = t.closest('#pg-kompgaji .tab[data-kgpanel]');
      if (kg && typeof switchKompgajiTab === 'function') {
        switchKompgajiTab(kg, kg.getAttribute('data-kgpanel'));
        return;
      }

      var ab = t.closest('#pg-absensi .tab[data-abpanel]');
      if (ab && typeof switchAbTab === 'function') {
        switchAbTab(ab, ab.getAttribute('data-abpanel'));
        return;
      }

      var slip = t.closest('#pg-slip .tab[data-slipanel]');
      if (slip && typeof switchSlipTab === 'function') {
        switchSlipTab(slip, slip.getAttribute('data-slipanel'));
        return;
      }

      var appr = t.closest('#pg-approval .tab[data-panel]');
      if (appr && typeof switchTab === 'function') {
        switchTab(appr, appr.getAttribute('data-panel'));
        return;
      }

      var master = t.closest('#pg-master .tab[data-panel]');
      if (master && typeof switchTab === 'function') {
        switchTab(master, master.getAttribute('data-panel'));
        return;
      }

      var usr = t.closest('#pg-users .tab[data-usrpanel]');
      if (usr && typeof switchUsrTab === 'function') {
        switchUsrTab(usr, usr.getAttribute('data-usrpanel'));
        return;
      }

      var sp = t.closest('#slide-panel-payroll .spt[data-kgstab]');
      if (sp && typeof switchPayrollSpTab === 'function') {
        var spMap = {
          gaji: 'sp-gaji',
          bpjs: 'sp-bpjs',
          natura: 'sp-natura',
          pphret: 'sp-pphret',
          ring: 'sp-ring',
        };
        var sub = sp.getAttribute('data-kgstab');
        if (spMap[sub]) switchPayrollSpTab(sp, spMap[sub]);
        return;
      }

      var bk = t.closest('#backup-tabs .tab[data-bktab]');
      if (bk && typeof switchBackupTab === 'function') {
        switchBackupTab(bk, bk.getAttribute('data-bktab'));
      }
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bindDelegatedUi);
  } else {
    bindDelegatedUi();
  }
})();
