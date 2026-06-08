/**
 * SiGaji — event delegation (nav, tab, tombol, overlay).
 * Ganti onclick inline; gunakan data-sigaji-action + data-*.
 */
(function () {
  function invokeFn(el) {
    var fnName = el.getAttribute('data-fn');
    if (!fnName || typeof window[fnName] !== 'function') return false;
    var fn = window[fnName];
    var arg = el.getAttribute('data-arg');
    var arg2 = el.getAttribute('data-arg2');
    var bool = el.getAttribute('data-bool');
    if (bool != null) fn(bool === '1');
    else if (arg2 != null) fn(arg, arg2);
    else if (arg != null) fn(arg);
    else fn();
    return true;
  }

  function runSigajiAction(action, el, ev) {
    var nik = el.getAttribute('data-nik');
    var periode = el.getAttribute('data-periode');
    var idx = el.getAttribute('data-idx');
    var id = el.getAttribute('data-id');
    var decision = el.getAttribute('data-decision');
    var i = el.getAttribute('data-i');
    var tgl = el.getAttribute('data-tgl');
    var colId = el.getAttribute('data-col-id');
    var key = el.getAttribute('data-key');
    var date = el.getAttribute('data-date');
    var delta = el.getAttribute('data-delta');
    var type = el.getAttribute('data-type');
    var mstab = el.getAttribute('data-mstab');
    var tipe = el.getAttribute('data-tipe');
    var target = el.getAttribute('data-target');

    switch (action) {
      case 'invoke':
        return invokeFn(el);
      case 'nav-drawer':
        if (typeof sigajiToggleNavDrawer === 'function') return !!sigajiToggleNavDrawer(ev);
        return false;
      case 'click-input': {
        var inp = target ? document.getElementById(target) : null;
        if (inp && typeof inp.click === 'function') {
          inp.click();
          return true;
        }
        return false;
      }
      case 'master-tab':
        if (typeof showPg === 'function') showPg('master');
        if (mstab && typeof switchTab === 'function') {
          var tabEl = document.querySelector('#pg-master .tab[data-mstab="' + mstab + '"]');
          if (tabEl) switchTab(tabEl, 'm-' + mstab);
        }
        return true;
      case 'open-new-kar':
        if (typeof showPg === 'function') showPg('karyawan');
        if (typeof openNewKar === 'function') openNewKar(tipe || 'tetap');
        return true;
      case 'open-profile':
        if (nik && typeof openPanel === 'function') openPanel(nik);
        return true;
      case 'open-payroll':
        if (nik && typeof openPayrollPanel === 'function') openPayrollPanel(nik);
        return true;
      case 'delete-kar':
        if (nik && typeof hapusKar === 'function') hapusKar(nik);
        return true;
      case 'telegram':
        if (nik && typeof openTelegramModalForNik === 'function') openTelegramModalForNik(nik);
        return true;
      case 'payroll-detail':
        if (nik && typeof detailGaji === 'function') detailGaji(nik, periode || '');
        return true;
      case 'explain':
        if (nik && typeof sigajiOpenExplain === 'function') sigajiOpenExplain(nik, periode || '');
        return true;
      case 'explain-summary':
        if (type && typeof sigajiOpenExplainSummary === 'function') sigajiOpenExplainSummary(type);
        return true;
      case 'pr-toggle':
        if (nik && periode && typeof setPREnabled === 'function') {
          setPREnabled(nik, periode, el.getAttribute('data-enabled') === '1');
        }
        return true;
      case 'approval-approve':
        if (id && typeof approveItem === 'function') approveItem(+id);
        return true;
      case 'approval-reject':
        if (id && typeof rejectItem === 'function') rejectItem(+id);
        return true;
      case 'user-edit':
        if (idx != null && typeof openUserModal === 'function') openUserModal(+idx);
        return true;
      case 'user-delete':
        if (idx != null && typeof hapusUser === 'function') hapusUser(+idx);
        return true;
      case 'reg-decide':
        if (id && decision && typeof decideRegReq === 'function') decideRegReq(id, decision);
        return true;
      case 'del-tunj':
        if (typeof delTunjEl === 'function') delTunjEl(el);
        return true;
      case 'del-pot':
        if (nik && i != null && typeof delPot === 'function') delPot(nik, +i);
        return true;
      case 'del-nat':
        if (nik && i != null && typeof delNat === 'function') delNat(nik, +i);
        return true;
      case 'toggle-manual':
        if (key && typeof toggleManual === 'function') toggleManual(key);
        return true;
      case 'ab-shift-month':
        if (delta != null && typeof abShiftViewMonth === 'function') abShiftViewMonth(+delta);
        return true;
      case 'toggle-ab':
        if (nik && date && typeof toggleAb === 'function') toggleAb(nik, date, el);
        return true;
      case 'del-lembur':
        if (nik && i != null && typeof delLembur === 'function') delLembur(nik, +i);
        return true;
      case 'hapus-libur':
        if (tgl && typeof hapusLibur === 'function') hapusLibur(tgl);
        return true;
      case 'hapus-tunjvar-col':
        if (colId && typeof hapusTunjVarColumn === 'function') hapusTunjVarColumn(colId);
        return true;
      case 'tunjvar-commit': {
        var inpEl = el.previousElementSibling;
        var val = inpEl ? inpEl.value : '';
        if (nik && colId && typeof tunjVarCommitCell === 'function') tunjVarCommitCell(nik, colId, val);
        return true;
      }
      case 'tunjvar-unlock':
        if (nik && colId && typeof tunjVarUnlockCell === 'function') tunjVarUnlockCell(nik, colId);
        return true;
      case 'thr-manual':
        if (typeof setTHRManual === 'function') setTHRManual(el);
        return true;
      case 'pesangon-save':
        if (typeof pesangonSimpan === 'function') pesangonSimpan();
        return true;
      case 'pesangon-pick':
        if (nik && typeof pesangonPilih === 'function') pesangonPilih(nik);
        return true;
      case 'periode-lock':
        if (id && typeof toggleLockPeriode === 'function') toggleLockPeriode(id);
        return true;
      case 'periode-rebuild':
        if (id && typeof rebuildSnapshotPeriode === 'function') rebuildSnapshotPeriode(id);
        return true;
      case 'periode-aktifkan':
        if (id && typeof aktifkanPeriode === 'function') aktifkanPeriode(id);
        return true;
      case 'periode-hapus':
        if (id && typeof hapusPeriode === 'function') hapusPeriode(id);
        return true;
      case 'hapus-notif':
        if (id && typeof hapusNotif === 'function') hapusNotif(+id);
        return true;
      case 'variance-drill':
        if (idx != null && typeof sigajiToggleVarianceDrill === 'function') sigajiToggleVarianceDrill(+idx);
        return true;
      case 'periode-timeline':
        if (id && typeof sigajiSwitchPeriodeTimeline === 'function') sigajiSwitchPeriodeTimeline(id);
        return true;
      case 'djp-nik-validasi': {
        var ktp = el.getAttribute('data-ktp');
        if (!ktp) {
          var ktpEl = document.getElementById('sp-ktp-f');
          ktp = ktpEl ? ktpEl.value : '';
        }
        if (typeof sigajiOpenDjpNikValidasi === 'function') sigajiOpenDjpNikValidasi(ktp);
        return true;
      }
      case 'sidebar-collapse':
        if (typeof sigajiToggleSidebarCollapse === 'function') sigajiToggleSidebarCollapse();
        return true;
      case 'mob-att-log':
        if (typeof renderMobileAttendanceLog === 'function') renderMobileAttendanceLog(el);
        return true;
      case 'mob-attendance-decide':
        if (id && decision && typeof mobAttendanceDecide === 'function') mobAttendanceDecide(id, decision);
        return true;
      case 'mobile-leave-decide':
        if (id && decision && typeof mobileLeaveDecide === 'function') mobileLeaveDecide(id, decision);
        return true;
      case 'mobile-loc-save':
        if (typeof saveMobileLocationModal === 'function') saveMobileLocationModal(el);
        return true;
      case 'confirm-backdrop':
        if (ev && ev.target === el && typeof sigajiConfirmClose === 'function') {
          sigajiConfirmClose(false);
          return true;
        }
        return false;
      default:
        return false;
    }
  }

  function bindDelegatedUi() {
    document.addEventListener('click', function (ev) {
      var t = ev.target;
      if (!t || !t.closest) return;

      var actEl = t.closest('[data-sigaji-action]');
      if (actEl) {
        var action = actEl.getAttribute('data-sigaji-action');
        if (action && runSigajiAction(action, actEl, ev)) {
          ev.preventDefault();
        }
        return;
      }

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

      var sim = t.closest('[data-simtab]');
      if (sim && typeof sigajiSimSwitchTab === 'function') {
        sigajiSimSwitchTab(sim.getAttribute('data-simtab'));
        return;
      }

      var pgCols = t.closest('[data-pg-cols]');
      if (pgCols && typeof sigajiSetPgGajiCols === 'function') {
        sigajiSetPgGajiCols(pgCols.getAttribute('data-pg-cols'));
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
