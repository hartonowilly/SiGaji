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

  function cabangOfUser(u) {
    var c = u && u.role === 'HRD' && u.cabangId ? String(u.cabangId).trim() : '';
    return c || null;
  }

  function rowsFromUsers(usersList, withCabang) {
    var rows = [];
    (usersList || []).forEach(function (u) {
      if (!u || u.aktif === false) return;
      var uid = String(u.auth_uid || '').trim();
      if (!uid) return;
      var row = {
        tenant_key: TK,
        auth_uid: uid,
        role: u.role || 'Karyawan',
        nik: u.nik ? String(u.nik).trim() : null,
        email: u.email ? String(u.email).toLowerCase().trim() : null,
        username: u.username ? String(u.username).trim() : null,
        aktif: u.aktif !== false,
        updated_at: new Date().toISOString(),
      };
      if (withCabang) row.cabang_id = cabangOfUser(u);
      rows.push(row);
    });
    return rows;
  }

  /** Daftar untuk RPC sigaji_sync_user_roles — server mencocokkan akun login lewat auth_uid lalu email. */
  function usersForRpc(usersList) {
    return (usersList || [])
      .filter(function (u) {
        return u && (u.email || u.auth_uid);
      })
      .map(function (u) {
        return {
          username: u.username || null,
          role: u.role || 'Karyawan',
          nik: u.nik ? String(u.nik).trim() : null,
          email: u.email ? String(u.email).toLowerCase().trim() : null,
          aktif: u.aktif !== false,
          auth_uid: u.auth_uid || null,
          cabangId: cabangOfUser(u),
        };
      });
  }

  function isMissingObject(err) {
    return /does not exist|42P01|42883|PGRST202|PGRST205|Could not find the function/i.test(
      String((err && (err.message || '')) + ' ' + (err && err.code))
    );
  }

  /**
   * Admin/HRD pusat: sinkron peta akun login → role/NIK/cabang (dasar RLS).
   * @returns {Promise<{saved:number, deactivated:number, unmatched:string[]}|null>}
   */
  window.sigajiSyncUserRolesTable = async function (sb, usersList) {
    if (!sb) return null;
    if (typeof CU !== 'undefined' && CU && !window.sigajiIsStaffRole(CU.role)) return null;
    var list = usersList || (typeof users !== 'undefined' ? users : []);
    if (!usersForRpc(list).length) return null;
    if (typeof window.sigajiKaryawanRestricted !== 'undefined' && window.sigajiKaryawanRestricted) return null;
    try {
      var rr = await sb.rpc('sigaji_sync_user_roles', { p_tenant: TK, p_users: usersForRpc(list) });
      if (!rr.error) return rr.data || null;
      if (!isMissingObject(rr.error)) {
        console.warn('Sigaji sync user roles:', rr.error.message || rr.error);
        return null;
      }
      var rows = rowsFromUsers(list, true);
      if (!rows.length) return null;
      var r = await sb.from('sigaji_user_roles').upsert(rows, { onConflict: 'tenant_key,auth_uid' });
      if (r.error && /cabang_id/i.test(String(r.error.message || ''))) {
        r = await sb.from('sigaji_user_roles').upsert(rowsFromUsers(list, false), { onConflict: 'tenant_key,auth_uid' });
      }
      if (r.error) {
        if (isMissingObject(r.error)) {
          console.warn('Sigaji: tabel sigaji_user_roles belum ada — jalankan sql/supabase_sigaji_v12_versi_cabang.sql');
          return null;
        }
        throw r.error;
      }
    } catch (e) {
      console.warn('Sigaji sync user roles:', e);
    }
    return null;
  };

  window.sigajiCloudTablesKaryawanStoreKeys = KARYAWAN_STORE_READ;
})();
