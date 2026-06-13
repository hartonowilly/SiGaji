/**
 * SiGaji — keamanan role: sinkron sigaji_user_roles + batasi data Karyawan di browser.
 */
(function () {
  var TK =
    typeof window.SIGAJI_TENANT_KEY === 'string' && window.SIGAJI_TENANT_KEY.trim()
      ? window.SIGAJI_TENANT_KEY.trim()
      : 'main';

  var KARYAWAN_STORE_READ = {
    perusahaan: true,
    masterCuti: true,
    hariLibur: true,
    notifikasi: true,
    roles: true,
  };

  window.sigajiIsStaffRole = function (role) {
    return role === 'Admin' || role === 'HRD';
  };

  /** Hanya absensi APK Android — tidak boleh login SiGaji web / PWA mobile browser. */
  window.sigajiIsAbsenOnlyRole = function (role) {
    return role === 'Absen';
  };

  window.sigajiRejectWebLoginMessage =
    'Akun ini hanya untuk aplikasi absen Android (APK). Tidak bisa login SiGaji web atau browser HP.';

  window.sigajiRejectMobilePwaMessage =
    'Akun ini hanya untuk aplikasi Android SiGaji Absen (APK), bukan halaman mobile browser.';

  window.sigajiCanUploadCloudPayload = function () {
    if (typeof CU === 'undefined' || !CU) return true;
    return window.sigajiIsStaffRole(CU.role);
  };

  function pickOwnAbsensi(absensi, nik) {
    if (!absensi || !nik || !absensi[nik]) return {};
    var o = {};
    o[nik] = absensi[nik];
    return o;
  }

  function pickOwnTunjVar(tunjVarBulan, nik) {
    var out = {};
    if (!tunjVarBulan || !nik) return out;
    Object.keys(tunjVarBulan).forEach(function (pn) {
      var byNik = tunjVarBulan[pn];
      if (byNik && byNik[nik]) {
        if (!out[pn]) out[pn] = {};
        out[pn][nik] = byNik[nik];
      }
    });
    return out;
  }

  function pickOwnKarSnapshot(karSnapshot, nik) {
    var out = {};
    if (!karSnapshot || !nik) return out;
    Object.keys(karSnapshot).forEach(function (pn) {
      var byNik = karSnapshot[pn];
      if (byNik && byNik[nik]) {
        if (!out[pn]) out[pn] = {};
        out[pn][nik] = byNik[nik];
      }
    });
    return out;
  }

  function pickOwnThrManual(thrManual, nik) {
    var out = {};
    if (!thrManual || !nik) return out;
    Object.keys(thrManual).forEach(function (pn) {
      var byNik = thrManual[pn];
      if (byNik && byNik[nik] != null) {
        if (!out[pn]) out[pn] = {};
        out[pn][nik] = byNik[nik];
      }
    });
    return out;
  }

  function sanitizeUserRow(u) {
    if (!u) return u;
    var c = Object.assign({}, u);
    delete c.password;
    return c;
  }

  /** Payload minimal untuk Karyawan — tidak simpan gaji rekan di memori/LS. */
  window.sigajiBuildKaryawanScopedPayload = function (full, cu) {
    if (!full || !cu || !cu.nik) return full;
    var nik = String(cu.nik).trim();
    var kar = (full.karyawan || []).filter(function (k) {
      return k && String(k.nik).trim() === nik;
    });
    var selfUser = (full.users || []).filter(function (u) {
      if (!u) return false;
      if (u.nik && String(u.nik).trim() === nik) return true;
      if (cu.username && u.username === cu.username) return true;
      if (cu.email && u.email && String(u.email).toLowerCase() === String(cu.email).toLowerCase()) return true;
      return false;
    });
    var roleKey = cu.role === 'Absen' ? 'Absen' : 'Karyawan';
    var roleMap =
      full.roles && full.roles[roleKey]
        ? (function () {
            var o = {};
            o[roleKey] = full.roles[roleKey].slice();
            return o;
          })()
        : (function () {
            var o = {};
            o[roleKey] = [];
            return o;
          })();
    return {
      schemaVersion: full.schemaVersion,
      karyawan: kar,
      periodes: Array.isArray(full.periodes) ? full.periodes : [],
      hariLibur: Array.isArray(full.hariLibur) ? full.hariLibur : [],
      masterCuti: full.masterCuti && typeof full.masterCuti === 'object' ? full.masterCuti : {},
      absensi: pickOwnAbsensi(full.absensi, nik),
      lembur: {},
      prorata: {},
      approvals: [],
      notifikasi: Array.isArray(full.notifikasi) ? full.notifikasi : [],
      perusahaan: full.perusahaan && typeof full.perusahaan === 'object' ? full.perusahaan : {},
      users: selfUser.map(sanitizeUserRow),
      roles: roleMap,
      thrManual: pickOwnThrManual(full.thrManual, nik),
      tunjVarBulan: pickOwnTunjVar(full.tunjVarBulan, nik),
      tunjVarLabels: full.tunjVarLabels || {},
      tunjVarColumns: Array.isArray(full.tunjVarColumns) ? full.tunjVarColumns : [],
      karSnapshot: pickOwnKarSnapshot(full.karSnapshot, nik),
      auditLog: [],
      bentoLayouts: {},
      cabang: [],
      license: full.license,
    };
  };

  /** Terapkan pembatasan setelah load cloud (sebelum enter app). */
  window.sigajiApplyKaryawanDataRestriction = function (cu) {
    if (!cu || !cu.nik || window.sigajiIsStaffRole(cu.role)) {
      window.sigajiKaryawanRestricted = false;
      return;
    }
    if (typeof currentPayloadLite !== 'function') return;
    var scoped = window.sigajiBuildKaryawanScopedPayload(currentPayloadLite(), cu);
    window.sigajiApplyingCloud = true;
    try {
      if (typeof applyDbFromCloudPayload === 'function') {
        applyDbFromCloudPayload(scoped);
      }
      window.sigajiKaryawanRestricted = true;
    } finally {
      window.sigajiApplyingCloud = false;
    }
  };

  /** Simpan localStorage — Karyawan tidak dapat salinan penuh tenant. */
  window.sigajiPayloadForLocalSave = function (full) {
    if (!window.sigajiKaryawanRestricted || typeof CU === 'undefined' || !CU) return full;
    return window.sigajiBuildKaryawanScopedPayload(full, CU);
  };

  function rowsFromUsers(usersList) {
    var rows = [];
    (usersList || []).forEach(function (u) {
      if (!u || u.aktif === false) return;
      var uid = String(u.auth_uid || '').trim();
      if (!uid) return;
      rows.push({
        tenant_key: TK,
        auth_uid: uid,
        role: u.role || 'Karyawan',
        nik: u.nik ? String(u.nik).trim() : null,
        email: u.email ? String(u.email).toLowerCase().trim() : null,
        username: u.username ? String(u.username).trim() : null,
        aktif: u.aktif !== false,
        updated_at: new Date().toISOString(),
      });
    });
    return rows;
  }

  /** Admin/HRD: sinkron mapping auth → role ke Supabase (RLS). */
  window.sigajiSyncUserRolesTable = async function (sb, usersList) {
    if (!sb) return;
    if (typeof CU !== 'undefined' && CU && !window.sigajiIsStaffRole(CU.role)) return;
    var rows = rowsFromUsers(usersList || (typeof users !== 'undefined' ? users : []));
    if (!rows.length) return;
    try {
      var r = await sb.from('sigaji_user_roles').upsert(rows, { onConflict: 'tenant_key,auth_uid' });
      if (r.error) {
        if (/does not exist|42P01|PGRST205|sigaji_user_roles/i.test(String(r.error.message || r.error.code))) {
          console.warn('Sigaji: tabel sigaji_user_roles belum ada — jalankan sql/supabase_sigaji_user_roles_rls.sql');
          return;
        }
        throw r.error;
      }
    } catch (e) {
      console.warn('Sigaji sync user roles:', e);
    }
  };

  window.sigajiCloudTablesKaryawanStoreKeys = KARYAWAN_STORE_READ;
})();
