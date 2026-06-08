/**
 * SiGaji — sinkron payload ke Supabase (tabel sigaji_cloud).
 * Butuh: js/config.js terisi + SQL sql/supabase_sigaji_cloud.sql sudah dijalankan.
 * Login awan: email + sandi Supabase Auth di kolom username/password (isi EMAIL lengkap).
 */
(function () {
  var CLOUD_TABLE = 'sigaji_cloud';
  /** Satu payload untuk semua orang di perusahaan (wajib pakai sql/supabase_migrate_to_shared_payload.sql). */
  var TENANT_KEY = (typeof window.SIGAJI_TENANT_KEY === 'string' && window.SIGAJI_TENANT_KEY.trim())
    ? window.SIGAJI_TENANT_KEY.trim()
    : 'main';
  var DEBOUNCE_MS = 1600;
  /** Setelah coba pertama: 'tenant' (kolom tenant_key ada) atau 'legacy' (DB lama hanya user_id). */
  var cloudPayloadMode = null;

  var cloudTimer = null;
  var clientReady = false;
  /** Promise selesai saat klien Supabase siap (atau gagal). */
  var bootPromise;
  var SUPABASE_VENDOR_VER = '2.105.4';

  /** Muat UMD (same-origin) — bukan dynamic import esm.sh (diblokir CSP). */
  function loadSupabaseLibrary() {
    if (window.supabase && typeof window.supabase.createClient === 'function') {
      return Promise.resolve(window.supabase);
    }
    var urls = [
      '/js/vendor/supabase.js?v=' + SUPABASE_VENDOR_VER,
      'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@' +
        SUPABASE_VENDOR_VER +
        '/dist/umd/supabase.js',
    ];
    return new Promise(function (resolve, reject) {
      var i = 0;
      function tryNext() {
        if (window.supabase && typeof window.supabase.createClient === 'function') {
          resolve(window.supabase);
          return;
        }
        if (i >= urls.length) {
          reject(new Error('Pustaka Supabase tidak tersedia — deploy ulang (npm run build) atau cek /js/vendor/supabase.js'));
          return;
        }
        var src = urls[i++];
        var existing = document.querySelector('script[data-sigaji-supabase="' + src + '"]');
        if (existing) {
          existing.addEventListener('load', function () {
            if (window.supabase && window.supabase.createClient) resolve(window.supabase);
            else tryNext();
          });
          existing.addEventListener('error', tryNext);
          return;
        }
        var s = document.createElement('script');
        s.src = src;
        s.async = true;
        s.crossOrigin = 'anonymous';
        s.setAttribute('data-sigaji-supabase', src);
        s.onload = function () {
          if (window.supabase && typeof window.supabase.createClient === 'function') resolve(window.supabase);
          else tryNext();
        };
        s.onerror = function () {
          s.remove();
          tryNext();
        };
        document.head.appendChild(s);
      }
      tryNext();
    });
  }

  function isMissingTenantKeyColumn(err) {
    if (!err) return false;
    var blob = String(err.message || '') + String(err.details || '') + String(err.hint || '') + String(err.code || '');
    return /tenant_key|does not exist|42703|undefined_column/i.test(blob);
  }

  function toastSafe(msg) {
    if (typeof toast === 'function') toast(msg);
    else console.warn(msg);
  }

  var CLOUD_FETCH_TIMEOUT_MS = 45000;

  function withCloudTimeout(promise, label) {
    return Promise.race([
      promise,
      new Promise(function (_, reject) {
        setTimeout(function () {
          reject(new Error(label || 'Timeout memuat data cloud'));
        }, CLOUD_FETCH_TIMEOUT_MS);
      }),
    ]);
  }

  function setResumeBootUi(booting, hasSession) {
    if (window.SIGAJI_RESUME_SESSION_ON_LOAD !== true) return;
    try {
      var login = document.getElementById('login');
      var app = document.getElementById('app');
      if (!login || !app) return;
      if (booting) {
        // Hindari flicker: saat cek session, sembunyikan login dulu.
        document.documentElement.setAttribute('data-sigaji-resume-pending', '1');
        login.style.display = 'none';
        app.style.display = 'none';
      } else if (!hasSession) {
        // Jika tidak ada sesi valid, tampilkan login normal.
        document.documentElement.removeAttribute('data-sigaji-resume-pending');
        login.style.display = 'flex';
        app.style.display = 'none';
      } else {
        document.documentElement.removeAttribute('data-sigaji-resume-pending');
      }
    } catch(e){sigajiCatchWarn("js/cloud-sync.js",e);}
  }

  /** Dipanggil segera — login menunggu boot Supabase (tidak lagi bergantung pada fungsi yang baru ada setelah import). */
  function tryCloudLoginWhenReady(email, pw) {
    (bootPromise || Promise.resolve())
      .then(function () {
        if (!clientReady || !window.sigajiSupabase) {
          toastSafe(
            'Koneksi awan tidak tersedia. Periksa URL dan anon key di js/config.js, jaringan, atau buka konsol (F12) bila pustaka Supabase gagal dimuat.'
          );
          return;
        }
        tryCloudLogin(email, pw);
      })
      .catch(function (e) {
        console.error('Sigaji cloud boot:', e);
        toastSafe(
          'Gagal memuat Supabase. Coba refresh (Ctrl+F5), pastikan deploy terbaru (npm run build), atau buka F12 → Console.'
        );
      });
  }

  async function boot() {
    var url = (window.SIGAJI_SUPABASE_URL || '').trim();
    var key = (window.SIGAJI_SUPABASE_ANON_KEY || '').trim();
    if (!url || !key) {
      return;
    }

    // WAJIB parse URL sebelum createClient: detectSessionInUrl bisa menghapus ?code=... lebih dulu.
    var urlAuthSnap = (function () {
      try {
        var qs = new URLSearchParams(window.location.search || '');
        var code = (qs.get('code') || '').trim();
        var type = (qs.get('type') || '').trim();
        var hp = '';
        if (window.location.hash && window.location.hash.length > 1) {
          hp = window.location.hash.charAt(0) === '#' ? window.location.hash.substring(1) : window.location.hash;
        }
        var qh = hp ? new URLSearchParams(hp) : null;
        if (qh) {
          if (!code) code = (qh.get('code') || '').trim();
          if (!type) type = (qh.get('type') || '').trim();
        }
        var accessToken = ((qs.get('access_token') || '') + '').trim();
        var refreshToken = ((qs.get('refresh_token') || '') + '').trim();
        var expiresIn = ((qs.get('expires_in') || '') + '').trim();
        var tokenType = ((qs.get('token_type') || '') + '').trim();
        if (qh) {
          if (!accessToken) accessToken = ((qh.get('access_token') || '') + '').trim();
          if (!refreshToken) refreshToken = ((qh.get('refresh_token') || '') + '').trim();
          if (!expiresIn) expiresIn = ((qh.get('expires_in') || '') + '').trim();
          if (!tokenType) tokenType = ((qh.get('token_type') || '') + '').trim();
        }
        var accessFromQs = !!accessToken;
        var accessFromHash = !!(qh && (qh.get('access_token') || '').trim());
        var hasAccessToken = accessFromQs || accessFromHash;
        // PKCE (?code= / #code=)
        var typeOkPkce = !type || /(recovery|invite|signup|magiclink|email)/i.test(type);
        var expectPkce = !!(code && typeOkPkce);
        // Fragment token (#access_token=...) — tidak punya code=; undangan/recovery pakai ini
        var typeOkPw = type && /(recovery|invite|signup)/i.test(type);
        var expectImplicit = !!(hasAccessToken && typeOkPw);
        return {
          code: code,
          type: type,
          expectPw: expectPkce || expectImplicit,
          accessToken: accessToken,
          refreshToken: refreshToken,
          expiresIn: expiresIn,
          tokenType: tokenType,
        };
      } catch (e) {
        return { code: '', type: '', expectPw: false };
      }
    })();

    try {
      var lib = await loadSupabaseLibrary();
      window.sigajiSupabase = lib.createClient(url, key, {
        auth: {
          persistSession: true,
          storage: window.localStorage,
          detectSessionInUrl: true,
        },
      });
      clientReady = true;
      if (typeof window.sigajiFetchLoginBranding === 'function') {
        window.sigajiFetchLoginBranding(window.sigajiSupabase).catch(function (e) {
          console.warn('Sigaji: branding login dari cloud', e);
        });
      }
      if (typeof window.sigajiUpdateCloudBackupUi === 'function') {
        try {
          window.sigajiUpdateCloudBackupUi();
        } catch(eBu){sigajiCatchWarn("js/cloud-sync.js",eBu);}
      }
    } catch (e) {
      console.error('Sigaji cloud:', e);
      toastSafe('Gagal memuat pustaka Supabase');
      throw e;
    }

    // Link email (invite/reset): jangan auto-resume — pakai modal set password dulu.
    var skipResumeForPasswordModal = false;
    if (urlAuthSnap.expectPw) {
      skipResumeForPasswordModal = true;
      try {
        if (urlAuthSnap.code) {
          await window.sigajiSupabase.auth.exchangeCodeForSession(urlAuthSnap.code);
        }
      } catch (e) {
        console.warn('Sigaji: exchangeCodeForSession (mungkin sudah diproses otomatis oleh Supabase)', e);
      }
      // Fallback untuk link implicit (#access_token=...): jika detectSessionInUrl gagal membentuk sesi,
      // coba setSession secara manual dari token yang kita snapshot sebelum URL dibersihkan.
      try {
        if (urlAuthSnap.accessToken && urlAuthSnap.refreshToken) {
          var s0 = await window.sigajiSupabase.auth.getSession();
          if (!s0.data || !s0.data.session) {
            await window.sigajiSupabase.auth.setSession({
              access_token: urlAuthSnap.accessToken,
              refresh_token: urlAuthSnap.refreshToken,
            });
          }
        }
      } catch (e3) {
        console.warn('Sigaji: setSession fallback gagal', e3);
      }
      if (typeof openModal === 'function') openModal('m-pw-reset');
      try {
        window.history.replaceState({}, document.title, window.location.origin + window.location.pathname);
      } catch(e2){sigajiCatchWarn("js/cloud-sync.js",e2);}
    }

    // Tangkap event PASSWORD_RECOVERY saat user klik link dari email reset
    window.sigajiSupabase.auth.onAuthStateChange(function (event) {
      if (event === 'PASSWORD_RECOVERY') {
        if (typeof openModal === 'function') openModal('m-pw-reset');
        else {
          var m = document.getElementById('m-pw-reset');
          if (m) m.classList.add('show');
        }
      }
    });

    if (typeof window.sigajiApplyCloudLoginUi === 'function') window.sigajiApplyCloudLoginUi();

    window.sigajiQueueCloudSave = scheduleUpsert;

    window.sigajiCloudLogout = function () {
      try { localStorage.removeItem('sigaji_resume_hint'); } catch(e){sigajiCatchWarn("js/cloud-sync.js",e);}
      try { localStorage.removeItem('sigaji_last_pg'); } catch(e){sigajiCatchWarn("js/cloud-sync.js",e);}
      if (!window.sigajiSupabase) return Promise.resolve();
      return window.sigajiSupabase.auth.signOut();
    };

    var hasSession = false;
    setResumeBootUi(true, false);
    try {
      var sess = await window.sigajiSupabase.auth.getSession();
      if (
        sess.data &&
        sess.data.session &&
        window.SIGAJI_RESUME_SESSION_ON_LOAD === true &&
        !skipResumeForPasswordModal
      ) {
        if (typeof window.sigajiIsIdleExpired === 'function' && window.sigajiIsIdleExpired()) {
          toastSafe('Sesi berakhir karena melewati batas tidak ada aktivitas. Silakan login lagi.');
          await window.sigajiSupabase.auth.signOut();
          hasSession = false;
        } else {
          hasSession = true;
          await enterFromSession(sess.data.session);
        }
      } else if (skipResumeForPasswordModal && sess.data && sess.data.session) {
        try {
          document.documentElement.removeAttribute('data-sigaji-resume-pending');
          var lg0 = document.getElementById('login');
          var ap0 = document.getElementById('app');
          if (lg0) lg0.style.display = 'flex';
          if (ap0) ap0.style.display = 'none';
        } catch(eUi){sigajiCatchWarn("js/cloud-sync.js",eUi);}
        toastSafe('Silakan buat password baru di jendela ini, lalu login.');
      }
    } finally {
      setResumeBootUi(false, hasSession);
      if (typeof window.sigajiCloudLoadForceEnd === 'function') window.sigajiCloudLoadForceEnd();
    }
  }

  function clearLoginBusy() {
    if (typeof window.sigajiSetLoginBusy === 'function') window.sigajiSetLoginBusy(false);
  }

  function tryCloudLogin(email, pw) {
    var sb = window.sigajiSupabase;
    sb.auth
      .signInWithPassword({ email: email.trim(), password: pw })
      .then(function (r) {
        if (r.error) {
          var msg = r.error.message || 'Login gagal';
          if (/invalid login credentials|invalid_credentials/i.test(msg))
            msg = 'Email atau sandi salah — pastikan user ada di Supabase → Authentication → Users (Password yang sama yang Anda ketik di sini).';
          else if (/email not confirmed/i.test(msg))
            msg =
              'Email belum dikonfirmasi. Supabase → Authentication → Providers → Email → nonaktifkan Confirm email untuk uji coba, atau konfirmasi lewat email.';
          toastSafe(msg);
          return;
        }
        return enterFromSession(r.data.session);
      })
      .catch(function (e) {
        console.error(e);
        var m = e && (e.message || e.toString()) ? String(e.message || e) : 'error';
        toastSafe(
          'Login awan gagal: ' +
            m +
            '. Cek jaringan dan konsol F12. Data lokal tidak diubah jika login tidak selesai.'
        );
      })
      .finally(clearLoginBusy);
  }

  /**
   * Cocokkan baris user SiGaji dengan Auth: (1) email sama, (2) opsional auth_uid dari payload (setelah approve undangan).
   * Urutan email dulu agar jelas niat admin; auth_uid membantu bila email di JSON terkorup/spasi beda.
   */
  function pickCuAfterCloudLoad(email, authUserId) {
    var em = (email || '').toLowerCase().trim();
    var uid = (authUserId || '').trim();
    var matched = users.find(function (x) {
      return x.email && String(x.email).toLowerCase().trim() === em && x.aktif !== false;
    });
    if (!matched && uid) {
      matched = users.find(function (x) {
        return x.aktif !== false && String(x.auth_uid || '') === uid;
      });
    }
    return matched ? Object.assign({}, matched) : null;
  }

  /**
   * Sekali saja: jika belum ada satu pun user dengan email di database, dan Anda mengisi SIGAJI_BOOTSTRAP_ADMIN_EMAIL = email Admin di config.js,
   * maka login dengan email itu akan mengisi kolom Email pada user Admin bawaan (username admin).
   */
  function bootstrapAdminEmailIfNeeded(authUser) {
    if (!authUser || !authUser.email) return;
    var em = String(authUser.email).toLowerCase();
    var boot = (window.SIGAJI_BOOTSTRAP_ADMIN_EMAIL || '').trim().toLowerCase();
    if (!boot || boot !== em) return;
    if (
      users.some(function (u) {
        return u.email && String(u.email).trim();
      })
    )
      return;
    var adm = users.find(function (u) {
      return u.username === 'admin' && u.role === 'Admin' && u.aktif !== false;
    });
    if (!adm || adm.email) return;
    adm.email = em;
    if (typeof saveAll === 'function') saveAll();
  }

  async function enterFromSession(session) {
    if (typeof window.sigajiCloudLoadStart === 'function') window.sigajiCloudLoadStart();
    try {
      try { localStorage.setItem('sigaji_resume_hint', '1'); } catch(e){sigajiCatchWarn("js/cloud-sync.js",e);}
      await withCloudTimeout(
        loadCloudPayloadIntoApp(session.user.id),
        'Timeout memuat data cloud — periksa koneksi atau coba refresh'
      );
      bootstrapAdminEmailIfNeeded(session.user);
      var cu = pickCuAfterCloudLoad(session.user.email, session.user.id);
      if (cu && typeof window.sigajiApplyKaryawanDataRestriction === 'function') {
        window.sigajiApplyKaryawanDataRestriction(cu);
      }
      if (!cu) {
        toastSafe(
          'Akun Supabase sudah cocok, tapi pengguna tidak ditemukan di data SiGaji. Pastikan di Manajemen User kolom "Email Supabase" sama persis dengan email login, atau approve ulang pendaftar agar sistem menyimpan tautan akun (auth_uid). Minta Admin cek juga baris payload di Supabase (sigaji_cloud) dan kebijakan RLS/shared.'
        );
        if (window.sigajiSupabase) await window.sigajiSupabase.auth.signOut();
        return;
      }
      if (typeof window.enterAppWithUser === 'function') {
        window.enterAppWithUser(cu);
      }
    } catch (e) {
      console.error('Sigaji enterFromSession:', e);
      toastSafe((e && e.message) || 'Gagal memuat data cloud');
    } finally {
      if (typeof window.sigajiCloudLoadEnd === 'function') window.sigajiCloudLoadEnd();
    }
  }

  async function fetchBlobPayload(uid) {
    var sb = window.sigajiSupabase;
    var res;

    if (cloudPayloadMode === 'legacy') {
      res = await sb.from(CLOUD_TABLE).select('payload').eq('user_id', uid).maybeSingle();
    } else if (cloudPayloadMode === 'tenant') {
      res = await sb.from(CLOUD_TABLE).select('payload').eq('tenant_key', TENANT_KEY).maybeSingle();
    } else {
      res = await sb.from(CLOUD_TABLE).select('payload').eq('tenant_key', TENANT_KEY).maybeSingle();
      if (res.error && isMissingTenantKeyColumn(res.error)) {
        cloudPayloadMode = 'legacy';
        res = await sb.from(CLOUD_TABLE).select('payload').eq('user_id', uid).maybeSingle();
      } else if (!res.error) {
        cloudPayloadMode = 'tenant';
      }
    }

    if (res.error) throw res.error;
    return res.data && res.data.payload ? res.data.payload : null;
  }

  async function refreshTenantLicenseFromCloud() {
    var sb = window.sigajiSupabase;
    if (!sb || !window.sigajiCloudTables || typeof window.sigajiCloudTables.fetchTenantLicenseMeta !== 'function') {
      return;
    }
    var lic = await window.sigajiCloudTables.fetchTenantLicenseMeta(sb);
    if (!lic) return;
    if (typeof tenantLicense !== 'undefined') {
      tenantLicense.maxEmployees = lic.maxEmployees;
      tenantLicense.planLabel = lic.planLabel;
      if (lic.multiBranchEnabled != null) tenantLicense.multiBranchEnabled = !!lic.multiBranchEnabled;
      if (lic.maxBranches != null) tenantLicense.maxBranches = parseInt(lic.maxBranches, 10) || 1;
    }
    if (typeof window.sigajiApplyLicenseFromObject === 'function') window.sigajiApplyLicenseFromObject(lic);
    if (typeof window.sigajiApplyBranchPolicyFromObject === 'function') window.sigajiApplyBranchPolicyFromObject(lic);
    if (typeof window.sigajiRenderLicenseQuotaUi === 'function') window.sigajiRenderLicenseQuotaUi();
    try{if(typeof window.sigajiUiCabangAfterRender==='function')window.sigajiUiCabangAfterRender();}catch(eCb){sigajiCatchWarn("js/cloud-sync.js",eCb);}
  }

  async function loadCloudPayloadIntoApp(uid) {
    var sb = window.sigajiSupabase;

    if (
      window.sigajiCloudTables &&
      typeof window.sigajiCloudTables.tryLoadKaryawanScoped === 'function'
    ) {
      try {
        var scopedEarly = await window.sigajiCloudTables.tryLoadKaryawanScoped(sb, uid);
        if (scopedEarly && typeof window.applyDbFromCloudPayload === 'function') {
          window.applyDbFromCloudPayload(scopedEarly);
          await refreshTenantLicenseFromCloud();
          return;
        }
      } catch (eK) {
        console.warn('Sigaji: load karyawan scoped', eK);
      }
    }

    if (window.sigajiCloudTables && typeof window.sigajiCloudTables.tryLoadWithTables === 'function') {
      try {
        var fromTables = await window.sigajiCloudTables.tryLoadWithTables(sb, uid, fetchBlobPayload);
        if (fromTables && typeof window.applyDbFromCloudPayload === 'function') {
          window.applyDbFromCloudPayload(fromTables);
          await refreshTenantLicenseFromCloud();
          return;
        }
      } catch (e) {
        console.warn('Sigaji: load tabel gagal, coba blob', e);
      }
    }

    try {
      var payload = await fetchBlobPayload(uid);
      if (payload && typeof window.applyDbFromCloudPayload === 'function') {
        window.applyDbFromCloudPayload(payload);
      }
      await refreshTenantLicenseFromCloud();
    } catch (err) {
      console.error(err);
      var er = err.message || String(err.code || '') || 'Gagal membaca cloud';
      if (/row-level security|RLS|42501|permission denied/i.test(String(err.message) + String(err.details || '')))
        er +=
          ' — cek kebijakan RLS tabel sigaji_cloud / sigaji_karyawan (user terautentikasi).';
      toastSafe(er);
    }
  }

  function scheduleUpsert() {
    if (!clientReady || !window.sigajiSupabase) return;
    if (typeof window.sigajiSetSyncStatus === 'function') window.sigajiSetSyncStatus('pending');
    clearTimeout(cloudTimer);
    cloudTimer = setTimeout(function () {
      cloudUpsert();
    }, DEBOUNCE_MS);
  }

  async function upsertBlobOnly(uid, payload) {
    var sb = window.sigajiSupabase;
    var ts = new Date().toISOString();
    var r;
    if (cloudPayloadMode === 'legacy') {
      r = await sb
        .from(CLOUD_TABLE)
        .upsert({ user_id: uid, payload: payload, updated_at: ts }, { onConflict: 'user_id' });
    } else if (cloudPayloadMode === 'tenant') {
      r = await sb.from(CLOUD_TABLE).upsert(
        { tenant_key: TENANT_KEY, user_id: uid, payload: payload, updated_at: ts },
        { onConflict: 'tenant_key' }
      );
    } else {
      r = await sb.from(CLOUD_TABLE).upsert(
        { tenant_key: TENANT_KEY, user_id: uid, payload: payload, updated_at: ts },
        { onConflict: 'tenant_key' }
      );
      if (r.error && isMissingTenantKeyColumn(r.error)) {
        cloudPayloadMode = 'legacy';
        r = await sb
          .from(CLOUD_TABLE)
          .upsert({ user_id: uid, payload: payload, updated_at: ts }, { onConflict: 'user_id' });
      } else if (!r.error) {
        cloudPayloadMode = 'tenant';
      }
    }
    if (r.error) {
      console.error('Sigaji cloud save:', r.error);
      throw r.error;
    }
  }

  async function cloudUpsert() {
    if (window.sigajiApplyingCloud) return;
    if (typeof window.sigajiCanUploadCloudPayload === 'function' && !window.sigajiCanUploadCloudPayload()) {
      if (typeof window.sigajiSetSyncStatus === 'function') window.sigajiSetSyncStatus('idle');
      return;
    }
    var sb = window.sigajiSupabase;
    if (!sb) return;
    var sess = await sb.auth.getSession();
    if (!sess.data || !sess.data.session) {
      if (typeof window.sigajiSetSyncStatus === 'function') window.sigajiSetSyncStatus('idle');
      return;
    }
    var uid = sess.data.session.user.id;
    if (typeof window.getPayloadForCloud !== 'function') return;
    var payload = window.getPayloadForCloud();
    if (typeof window.sigajiShouldSkipCloudUpload === 'function' && window.sigajiShouldSkipCloudUpload(payload)) {
      console.warn('Sigaji cloud: lewati unggah — payload masih template kosong (lindungi data tenant di Supabase).');
      if (typeof window.sigajiSetSyncStatus === 'function') window.sigajiSetSyncStatus('idle');
      return;
    }

    try {
      if (window.sigajiCloudTables && typeof window.sigajiCloudTables.trySaveWithTables === 'function') {
        await window.sigajiCloudTables.trySaveWithTables(sb, payload, function () {
          return upsertBlobOnly(uid, payload);
        });
      } else {
        await upsertBlobOnly(uid, payload);
      }
      if (typeof window.sigajiSetSyncStatus === 'function') {
        window.sigajiSetSyncStatus('synced', new Date().toLocaleTimeString('id-ID'));
      }
    } catch (err) {
      var er = (err && (err.message || err.details || err.hint)) || String(err);
      if (typeof window.sigajiSetSyncStatus === 'function') window.sigajiSetSyncStatus('error', er);
      console.error('Sigaji cloud upsert:', err);
    }
  }

  window.sigajiTryCloudLogin = tryCloudLoginWhenReady;
  window.sigajiRetryCloudSync = function () {
    clearTimeout(cloudTimer);
    return cloudUpsert();
  };

  function friendlyAuthEmailError(msg) {
    var m = String(msg || '').toLowerCase();
    if (/limit|exceeded|quota|rate|too many|429/i.test(m))
      return 'Kuota email Supabase habis (batas pengiriman terlampaui). Tunggu beberapa jam/hari atau hubungi Admin: aktifkan SMTP custom di Supabase (Authentication → SMTP), atau upgrade paket.';
    if (/smtp|mail delivery/i.test(m))
      return 'Pengiriman email gagal (SMTP). Periksa pengaturan email di Supabase Dashboard.';
    return String(msg || 'Gagal mengirim email');
  }

  window.sigajiForgotPassword = function (email) {
    (bootPromise || Promise.resolve()).then(function () {
      if (!clientReady || !window.sigajiSupabase) {
        toastSafe('Koneksi awan tidak tersedia.');
        return;
      }
      var redirectUrl = window.location.origin + window.location.pathname;
      window.sigajiSupabase.auth
        .resetPasswordForEmail(email.trim(), { redirectTo: redirectUrl })
        .then(function (r) {
          if (r.error) {
            toastSafe(friendlyAuthEmailError(r.error.message || r.error));
          } else {
            toastSafe(
              'Email reset password telah dikirim ke ' +
                email +
                '. Buka link dari email (akan kembali ke halaman ini), lalu masukkan password baru.'
            );
          }
        });
    });
  };

  window.sigajiUpdatePassword = function (newPassword) {
    if (!window.sigajiSupabase) {
      return Promise.resolve({ error: { message: 'Koneksi awan tidak tersedia' } });
    }
    return window.sigajiSupabase.auth.updateUser({ password: newPassword });
  };

  bootPromise = boot();
  window.sigajiCloudBootPromise = bootPromise;
})();
