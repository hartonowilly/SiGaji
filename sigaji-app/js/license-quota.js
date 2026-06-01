/**
 * Kuota karyawan aktif — diatur penjual (Supabase / Netlify license-set / config deploy).
 * Admin perusahaan pelanggan TIDAK bisa mengubah kuota dari aplikasi.
 */
(function () {
  function parseMax(v) {
    var n = parseInt(v, 10);
    return n > 0 ? n : 0;
  }

  function configMax() {
    if (typeof window.SIGAJI_MAX_EMPLOYEES === 'undefined' || window.SIGAJI_MAX_EMPLOYEES === null)
      return 0;
    return parseMax(window.SIGAJI_MAX_EMPLOYEES);
  }

  function isKaryawanAktifLic(k) {
    if (!k || !k.nik) return false;
    return !String(k.tgl_berhenti || '').trim();
  }

  function countActiveEmployees(arr) {
    var list = arr || (typeof karyawan !== 'undefined' ? karyawan : []);
    var n = 0;
    for (var i = 0; i < list.length; i++) {
      if (isKaryawanAktifLic(list[i])) n++;
    }
    return n;
  }

  function getStoredLicense() {
    if (typeof tenantLicense !== 'undefined' && tenantLicense) return tenantLicense;
    return { maxEmployees: 0, planLabel: '' };
  }

  function getEffectiveMaxEmployees() {
    var cfg = configMax();
    if (cfg > 0) return cfg;
    return parseMax(getStoredLicense().maxEmployees);
  }

  function getLicensePlanLabel() {
    var lic = getStoredLicense();
    var lbl = String(lic.planLabel || '').trim();
    if (lbl) return lbl;
    if (configMax() > 0) return 'Paket';
    return '';
  }

  /** Kuota tidak pernah diedit dari UI aplikasi (hanya penjual). */
  function isLicenseVendorControlled() {
    return true;
  }

  function applyLicenseFromObject(lic) {
    if (!lic || typeof lic !== 'object') return;
    if (typeof tenantLicense === 'undefined') return;
    var cfg = configMax();
    if (cfg > 0) {
      tenantLicense.maxEmployees = cfg;
    } else {
      tenantLicense.maxEmployees = parseMax(lic.maxEmployees);
    }
    tenantLicense.planLabel = String(lic.planLabel || '').trim();
  }

  function licenseQuotaMessage(addCount) {
    var max = getEffectiveMaxEmployees();
    if (!max) return '';
    var cur = countActiveEmployees();
    var add = addCount || 0;
    var plan = getLicensePlanLabel();
    var head = plan ? 'Paket ' + plan + ': ' : 'Kuota lisensi: ';
    return (
      head +
      'maks ' +
      max +
      ' karyawan aktif (saat ini ' +
      cur +
      '). Tambah ' +
      add +
      ' akan melebihi batas. Hubungi penyedia SiGaji untuk upgrade atau perpanjangan kuota.'
    );
  }

  function canAddActiveEmployees(addCount, arr) {
    var max = getEffectiveMaxEmployees();
    if (!max) return { ok: true };
    var add = addCount || 0;
    if (add <= 0) return { ok: true };
    var cur = countActiveEmployees(arr);
    if (cur + add <= max) return { ok: true };
    return { ok: false, message: licenseQuotaMessage(add) };
  }

  function assertCanAddActiveEmployees(addCount, arr) {
    var r = canAddActiveEmployees(addCount, arr);
    if (r.ok) return true;
    if (typeof toast === 'function') toast(r.message);
    return false;
  }

  function renderLicenseQuotaUi() {
    var badge = document.getElementById('kar-quota-badge');
    if (badge) {
      var max = getEffectiveMaxEmployees();
      var cur = countActiveEmployees();
      if (!max) {
        badge.textContent = cur + ' karyawan aktif';
        badge.className = 'bdg b-info';
      } else {
        var plan = getLicensePlanLabel();
        badge.textContent =
          (plan ? plan + ' · ' : '') + cur + ' / ' + max + ' karyawan aktif';
        badge.className = 'bdg ' + (cur >= max ? 'b-err' : cur >= max - 2 ? 'b-warn' : 'b-ok');
      }
    }
    var card = document.getElementById('lic-card');
    if (!card) return;
    var showAdmin = typeof CU !== 'undefined' && CU && CU.role === 'Admin';
    card.style.display = showAdmin ? '' : 'none';
    var stat = document.getElementById('lic-stat');
    if (stat) {
      var mx = getEffectiveMaxEmployees();
      var c = countActiveEmployees();
      stat.textContent = mx
        ? 'Karyawan aktif: ' + c + ' dari maks ' + mx + ' (resign tidak dihitung).'
        : 'Karyawan aktif: ' + c + ' (belum ada batas kuota dari penyedia).';
    }
    var note = document.getElementById('lic-vendor-note');
    if (note) {
      note.textContent =
        'Kuota dan nama paket diatur oleh penyedia SiGaji (bukan dari menu ini). Untuk menambah kuota atau upgrade paket, hubungi penyedia layanan Anda.';
    }
  }

  function simpanKuotaLisensi() {
    if (typeof toast === 'function') {
      toast('Kuota hanya dapat diatur oleh penyedia SiGaji. Hubungi penyedia layanan Anda.');
    }
  }

  window.sigajiCountActiveEmployees = countActiveEmployees;
  window.sigajiGetEffectiveMaxEmployees = getEffectiveMaxEmployees;
  window.sigajiCanAddActiveEmployees = canAddActiveEmployees;
  window.sigajiAssertCanAddActiveEmployees = assertCanAddActiveEmployees;
  window.sigajiApplyLicenseFromObject = applyLicenseFromObject;
  window.sigajiRenderLicenseQuotaUi = renderLicenseQuotaUi;
  window.sigajiIsLicenseVendorControlled = isLicenseVendorControlled;
  window.simpanKuotaLisensi = simpanKuotaLisensi;
})();
