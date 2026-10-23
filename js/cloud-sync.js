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
  var PULL_INTERVAL_MS = 35000;
  var pullTimer = null;
  var pullInFlight = null;
  var lastPullAt = 0;
  /** Setelah coba pertama: 'tenant' (kolom tenant_key ada) atau 'legacy' (DB lama hanya user_id). */
  var cloudPayloadMode = null;

  var cloudTimer = null;
  /** Naik tiap perubahan dijadwalkan; cloudSyncedSeq menyusul saat unggah berhasil. Beda = ada perubahan belum di awan. */
  var cloudDirtySeq = 0;
  var cloudSyncedSeq = 0;
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

  var CLOUD_AUTH_TIMEOUT_MS = 20000;

  function withCloudTimeout(promise, label, ms) {
    var timer = null;
    return Promise.race([
      promise,
      new Promise(function (_, reject) {
        timer = setTimeout(function () {
          reject(new Error(label || 'Timeout memuat data cloud'));
        }, ms || CLOUD_FETCH_TIMEOUT_MS);
      }),
    ]).finally(function () {
      clearTimeout(timer);
    });
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
    withCloudTimeout(bootPromise || Promise.resolve(), 'boot', CLOUD_AUTH_TIMEOUT_MS)
      .catch(function (e) {
        // Boot (cek sesi lama) macet/gagal: tetap coba login bila klien Supabase sudah dibuat.
        console.warn('Sigaji cloud boot belum selesai:', e);
      })
      .then(function () {
        if (!clientReady || !window.sigajiSupabase) {
          clearLoginBusy();
          toastSafe(
            'Koneksi awan tidak tersedia. Coba refresh (Ctrl+Shift+R), periksa jaringan, atau buka F12 → Console bila pustaka Supabase gagal dimuat.'
          );
          return;
        }
        tryCloudLogin(email, pw);
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
          // Kunci lintas-tab bawaan (navigator.locks) bisa macet selamanya bila ada tab SiGaji lain yang
          // tertahan/di-suspend browser → getSession & login tidak pernah selesai.
          lock: function (_name, _acquireTimeout, fn) {
            return fn();
          },
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
      if (window.sigajiCloudTables && typeof window.sigajiCloudTables.forgetBase === 'function') {
        window.sigajiCloudTables.forgetBase();
      }
      if (!window.sigajiSupabase) return Promise.resolve();
      return window.sigajiSupabase.auth.signOut();
    };

    var hasSession = false;
    setResumeBootUi(true, false);
    try {
      var sess = { data: { session: null } };
      try {
        sess = await withCloudTimeout(
          window.sigajiSupabase.auth.getSession(),
          'Timeout cek sesi Supabase',
          CLOUD_AUTH_TIMEOUT_MS
        );
      } catch (eSess) {
        console.warn('Sigaji: cek sesi lama dilewati', eSess);
      }
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
    withCloudTimeout(
      sb.auth.signInWithPassword({ email: email.trim(), password: pw }),
      'Server login tidak merespons dalam 20 detik. Tutup tab SiGaji lain, refresh (Ctrl+Shift+R), lalu coba lagi',
      CLOUD_AUTH_TIMEOUT_MS
    )
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
    if (matched) return Object.assign({}, matched);
    var ct = window.sigajiCloudTables;
    var acc = ct && typeof ct.getAccess === 'function' ? ct.getAccess() : null;
    if (acc && acc.role && !acc.hq) {
      return {
        username: acc.username || em.split('@')[0] || 'hrd',
        email: em,
        nama: acc.username || em,
        role: acc.role,
        nik: acc.nik || null,
        cabangId: acc.cabang || '',
        aktif: true,
        auth_uid: uid,
      };
    }
    return null;
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
      if (typeof window.sigajiIsAbsenOnlyRole === 'function' && window.sigajiIsAbsenOnlyRole(cu.role)) {
        toastSafe(window.sigajiRejectWebLoginMessage || 'Akun hanya untuk aplikasi absen Android.');
        if (window.sigajiSupabase) await window.sigajiSupabase.auth.signOut();
        return;
      }
      if (typeof window.enterAppWithUser === 'function') {
        window.enterAppWithUser(cu);
      }
      if (cloudDirtySeq > cloudSyncedSeq) cloudUpsert();
      scheduleCloudPullLoop();
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

  function sigajiRefreshUiAfterCloudData() {
    try {
      if (typeof renderAll === 'function') renderAll();
      else {
        if (typeof renderKompgajiPage === 'function') renderKompgajiPage();
        else if (typeof renderKompgaji === 'function') renderKompgaji();
        if (typeof renderPenggajian === 'function') renderPenggajian(true);
        if (typeof renderTunjVariabelBulan === 'function') renderTunjVariabelBulan();
      }
    } catch (eUi) {
      sigajiCatchWarn('js/cloud-sync.js', eUi);
    }
  }
  window.sigajiRefreshUiAfterCloudData = sigajiRefreshUiAfterCloudData;

  function persistMemoryQuiet() {
    window.sigajiApplyingCloud = true;
    try {
      if (typeof saveAll === 'function') saveAll();
    } finally {
      window.sigajiApplyingCloud = false;
    }
  }

  async function pullTunjVarRefresh(opts) {
    opts = opts || {};
    if (!clientReady || !window.sigajiSupabase) return false;
    if (window.sigajiApplyingCloud) return false;
    if (typeof window.sigajiTunjVarIsEditingAny === 'function' && window.sigajiTunjVarIsEditingAny()) {
      return false;
    }
    if (cloudTimer && !opts.force) return false;
    if (upsertInFlight) return false;
    var sb = window.sigajiSupabase;
    var sess = await sb.auth.getSession();
    if (!sess.data || !sess.data.session) return false;
    var tablesOk = false;
    if (window.sigajiCloudTables && typeof window.sigajiCloudTables.tablesExist === 'function') {
      try {
        tablesOk = await window.sigajiCloudTables.tablesExist(sb);
      } catch (eT) {
        tablesOk = false;
      }
    }
    if (
      tablesOk &&
      window.sigajiCloudTables &&
      typeof window.sigajiCloudTables.pullTunjVarIntoMemory === 'function'
    ) {
      try {
        var changed = await window.sigajiCloudTables.pullTunjVarIntoMemory(sb);
        if (changed) {
          persistMemoryQuiet();
          sigajiRefreshUiAfterCloudData();
          if (typeof window.sigajiSetSyncStatus === 'function') {
            window.sigajiSetSyncStatus('synced', new Date().toLocaleTimeString('id-ID'));
          }
        }
        lastPullAt = Date.now();
        return changed;
      } catch (e) {
        console.warn('Sigaji pull tunj var:', e);
        return false;
      }
    }
    try {
      var payload = await fetchBlobPayload(sess.data.session.user.id);
      if (!payload || !payload.tunjVarBulan || typeof tunjVarBulan === 'undefined') return false;
      var mergeFn =
        window.sigajiCloudTables && window.sigajiCloudTables.mergeTunjVarForPull
          ? window.sigajiCloudTables.mergeTunjVarForPull
          : function (_l, c) {
              return c;
            };
      var mergedBlob = mergeFn(tunjVarBulan, payload.tunjVarBulan);
      var beforeBlob = JSON.stringify(tunjVarBulan);
      tunjVarBulan = mergedBlob;
      var changedBlob = beforeBlob !== JSON.stringify(mergedBlob);
      if (changedBlob) {
        persistMemoryQuiet();
        sigajiRefreshUiAfterCloudData();
      }
      lastPullAt = Date.now();
      return changedBlob;
    } catch (e2) {
      console.warn('Sigaji pull tunj var (blob):', e2);
      return false;
    }
  }

  function scheduleCloudPullLoop() {
    clearInterval(pullTimer);
    if (!clientReady) return;
    pullTimer = setInterval(function () {
      if (document.visibilityState === 'hidden') return;
      if (typeof window.sigajiTunjVarIsEditingAny === 'function' && window.sigajiTunjVarIsEditingAny()) {
        return;
      }
      pullTunjVarRefresh();
    }, PULL_INTERVAL_MS);
  }

  async function sigajiPullCloudRefresh(opts) {
    if (pullInFlight) return pullInFlight;
    pullInFlight = pullTunjVarRefresh(opts).finally(function () {
      pullInFlight = null;
    });
    return pullInFlight;
  }

  function onVisibilityPull() {
    if (document.visibilityState !== 'visible') return;
    if (Date.now() - lastPullAt < 8000) return;
    sigajiPullCloudRefresh();
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
    var appliedWithLicense = false;

    if (
      window.sigajiCloudTables &&
      typeof window.sigajiCloudTables.tryLoadKaryawanScoped === 'function'
    ) {
      try {
        var scopedEarly = await window.sigajiCloudTables.tryLoadKaryawanScoped(sb, uid);
        if (scopedEarly && typeof window.applyDbFromCloudPayload === 'function') {
          if (typeof window.sigajiCloudTables.resetBase === 'function') window.sigajiCloudTables.resetBase();
          window.applyDbFromCloudPayload(scopedEarly);
          appliedWithLicense = !!(scopedEarly.license);
          if (!appliedWithLicense) await refreshTenantLicenseFromCloud();
          return;
        }
      } catch (eK) {
        console.warn('Sigaji: load karyawan scoped', eK);
      }
    }

    if (window.sigajiCloudTables && typeof window.sigajiCloudTables.tryLoadWithTables === 'function') {
      var fromTables;
      try {
        fromTables = await window.sigajiCloudTables.tryLoadWithTables(sb, uid, fetchBlobPayload);
      } catch (e) {
        // Jangan jatuh ke blob: blob bukan salinan terbaru, dan simpan berikutnya bisa menimpa tabel dengan data lama.
        console.warn('Sigaji: load tabel gagal', e);
        throw new Error(
          'Gagal memuat data dari awan (' +
            ((e && (e.message || e.code)) || 'koneksi terputus') +
            '). Periksa jaringan lalu muat ulang halaman.'
        );
      }
      if (fromTables && typeof window.applyDbFromCloudPayload === 'function') {
        window.applyDbFromCloudPayload(fromTables);
        window.sigajiCloudTables.commitLoadedBase();
        appliedWithLicense = !!(fromTables.license);
        if (!appliedWithLicense) await refreshTenantLicenseFromCloud();
        return;
      }
    }

    try {
      var payload = await fetchBlobPayload(uid);
      if (window.sigajiCloudTables && typeof window.sigajiCloudTables.resetBase === 'function') {
        window.sigajiCloudTables.resetBase();
      }
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
    cloudDirtySeq++;
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

  /** Blob sigaji_cloud: salinan cadangan + sumber daftar user untuk aplikasi mobile. */
  var BLOB_BACKUP_MS = 6 * 60 * 60 * 1000;
  var BLOB_KEYS_FOR_MOBILE = ['users', 'roles'];
  var BLOB_WRITTEN_KEY = 'sigaji_blob_written_at';

  function blobWrittenAt() {
    try {
      return parseInt(localStorage.getItem(BLOB_WRITTEN_KEY), 10) || 0;
    } catch (e) {
      return 0;
    }
  }

  function markBlobWritten() {
    try {
      localStorage.setItem(BLOB_WRITTEN_KEY, String(Date.now()));
    } catch(e){sigajiCatchWarn("js/cloud-sync.js",e);}
  }

  /** @param {{upserts:number,deletes:number,storeKeys:string[]}|null} res null = tabel tak tersedia/gagal */
  function shouldWriteBlob(res) {
    // Blob berisi seluruh tenant — hanya kantor pusat yang boleh menulisnya (RLS v12).
    var ct = window.sigajiCloudTables;
    if (ct && typeof ct.isV12 === 'function' && ct.isV12() && !ct.getAccess().hq) return false;
    var want = blobOwed || blobWanted(res);
    if (want && ct && typeof ct.archivePending === 'function' && ct.archivePending()) {
      // Memori belum berisi periode arsip — blob dari memori ini akan menghapus riwayat lama.
      blobOwed = true;
      sigajiEnsureArchive().then(function (ok) {
        if (ok) cloudUpsert();
      });
      return false;
    }
    if (want) blobOwed = false;
    return want;
  }

  var blobOwed = false;

  function blobWanted(res) {
    if (!res) return true;
    if (!res.upserts && !res.deletes) return false;
    for (var i = 0; i < res.storeKeys.length; i++) {
      if (BLOB_KEYS_FOR_MOBILE.indexOf(res.storeKeys[i]) !== -1) return true;
    }
    return Date.now() - blobWrittenAt() > BLOB_BACKUP_MS;
  }

  /* ── Arsip periode lama: dimuat di latar saat pertama dibutuhkan ─────────────────────────── */
  var archiveJob = null;
  var archiveFailedAt = 0;

  function archivePending() {
    var ct = window.sigajiCloudTables;
    return !!(ct && typeof ct.archivePending === 'function' && ct.archivePending());
  }

  /** @returns {Promise<boolean>} true = arsip sudah ada di memori */
  function sigajiEnsureArchive() {
    if (!archivePending()) return Promise.resolve(true);
    if (archiveJob) return archiveJob;
    if (Date.now() - archiveFailedAt < 30000) return Promise.resolve(false);
    var sb = window.sigajiSupabase;
    if (!sb) return Promise.resolve(false);
    toastSafe('Memuat arsip periode lama…');
    archiveJob = window.sigajiCloudTables
      .loadArchive(sb)
      .then(function (changed) {
        if (archivePending()) return false;
        if (changed) {
          persistMemoryQuiet();
        }
        sigajiRefreshUiAfterCloudData();
        toastSafe('Arsip periode lama sudah dimuat.');
        return true;
      })
      .catch(function (e) {
        archiveFailedAt = Date.now();
        console.error('Sigaji arsip:', e);
        toastSafe('Gagal memuat arsip periode lama — coba lagi sebentar lagi.');
        return false;
      })
      .finally(function () {
        archiveJob = null;
      });
    return archiveJob;
  }
  window.sigajiEnsureArchive = sigajiEnsureArchive;

  /** Data periode ini sudah ada di memori? nik diisi = cukup untuk koreksi absensi karyawan itu. */
  window.sigajiPeriodeDataReady = function (pNama, nik) {
    var ct = window.sigajiCloudTables;
    return !ct || typeof ct.archiveReady !== 'function' || ct.archiveReady(pNama, nik);
  };

  /** Seperti sigajiPeriodeDataReady, tetapi bila belum siap langsung mulai muat arsip. */
  window.sigajiNeedPeriodeData = function (pNama) {
    if (window.sigajiPeriodeDataReady(pNama)) return true;
    sigajiEnsureArchive();
    return false;
  };

  /** Absensi pada tanggal ini sudah ada di memori? Bila belum, mulai muat arsip. */
  window.sigajiNeedTanggalData = function (iso) {
    var ct = window.sigajiCloudTables;
    if (!ct || typeof ct.archiveDateReady !== 'function' || ct.archiveDateReady(iso)) return true;
    sigajiEnsureArchive();
    return false;
  };

  /** Hasil gabung dengan perubahan pengguna lain: simpan lokal, gambar ulang, beri tahu bila ada bentrok. */
  function reportMergeResult(res) {
    if (res.memoryChanged) {
      persistMemoryQuiet();
      sigajiRefreshUiAfterCloudData();
    }
    var msgs = [];
    if (res.conflicts && res.conflicts.length) {
      msgs.push(
        'Diubah bersamaan oleh pengguna lain — nilai Anda yang dipakai untuk: ' +
          res.conflicts.slice(0, 3).join('; ') +
          (res.conflicts.length > 3 ? ' (+' + (res.conflicts.length - 3) + ' lainnya)' : '')
      );
    }
    if (res.kept && res.kept.length) {
      msgs.push(
        'Tidak jadi dihapus karena baru diubah pengguna lain: ' +
          res.kept.slice(0, 3).join(', ') +
          (res.kept.length > 3 ? ' (+' + (res.kept.length - 3) + ' lainnya)' : '')
      );
    }
    if (res.errors && res.errors.length) {
      msgs.push(
        'Tidak tersimpan ke awan: ' +
          res.errors.slice(0, 3).join('; ') +
          (res.errors.length > 3 ? ' (+' + (res.errors.length - 3) + ' lainnya)' : '')
      );
    }
    if (res.skipped && res.skipped.length) {
      msgs.push(
        'Hanya kantor pusat yang bisa mengubah: ' +
          res.skipped.slice(0, 3).join(', ') +
          (res.skipped.length > 3 ? ' (+' + (res.skipped.length - 3) + ' lainnya)' : '') +
          ' — perubahan itu tidak dikirim'
      );
    }
    if (msgs.length) toastSafe(msgs.join(' — '));
    else if (res.memoryChanged) toastSafe('Perubahan dari pengguna lain sudah digabung dengan perubahan Anda.');
  }

  var upsertInFlight = null;
  var upsertAgain = false;

  async function cloudUpsert() {
    if (upsertInFlight) {
      upsertAgain = true;
      return upsertInFlight;
    }
    upsertInFlight = cloudUpsertOnce().finally(function () {
      upsertInFlight = null;
      if (upsertAgain) {
        upsertAgain = false;
        if (cloudDirtySeq > cloudSyncedSeq) cloudUpsert();
      }
    });
    return upsertInFlight;
  }

  async function cloudUpsertOnce() {
    if (window.sigajiApplyingCloud) return;
    var seq = cloudDirtySeq;
    if (typeof window.sigajiLocalDataIncomplete === 'function' && window.sigajiLocalDataIncomplete()) return;
    if (typeof window.sigajiCanUploadCloudPayload === 'function' && !window.sigajiCanUploadCloudPayload()) {
      cloudSyncedSeq = seq;
      if (typeof window.sigajiSetSyncStatus === 'function') window.sigajiSetSyncStatus('idle');
      return;
    }
    var sb = window.sigajiSupabase;
    if (!sb) return;
    var sess = await sb.auth.getSession();
    if (!sess.data || !sess.data.session) {
      cloudSyncedSeq = seq;
      if (typeof window.sigajiSetSyncStatus === 'function') window.sigajiSetSyncStatus('idle');
      return;
    }
    var uid = sess.data.session.user.id;
    if (
      window.sigajiCloudTables &&
      typeof window.sigajiCloudTables.isBaseReady === 'function' &&
      !window.sigajiCloudTables.isBaseReady() &&
      window.sigajiCloudTables.storageMode() !== 'blob'
    ) {
      // Data awan sesi ini belum termuat: tahan (tetap "belum sinkron") — dijadwalkan ulang setelah muat.
      return;
    }
    if (typeof window.getPayloadForCloud !== 'function') return;
    var payload = window.getPayloadForCloud();
    if (typeof window.sigajiShouldSkipCloudUpload === 'function' && window.sigajiShouldSkipCloudUpload(payload)) {
      console.warn('Sigaji cloud: lewati unggah — payload masih template kosong (lindungi data tenant di Supabase).');
      cloudSyncedSeq = seq;
      if (typeof window.sigajiSetSyncStatus === 'function') window.sigajiSetSyncStatus('idle');
      return;
    }

    try {
      if (window.sigajiCloudTables && typeof window.sigajiCloudTables.trySaveWithTables === 'function') {
        var saved = await window.sigajiCloudTables.trySaveWithTables(sb, payload, function (res) {
          if (!shouldWriteBlob(res)) return;
          return upsertBlobOnly(uid, payload).then(markBlobWritten);
        });
        if (saved) {
          reportMergeResult(saved);
          // Masih bentrok setelah 3 putaran (banyak yang menyimpan bersamaan) — coba lagi sebentar lagi.
          if (saved.retry) setTimeout(scheduleUpsert, 3000);
        }
      } else {
        await upsertBlobOnly(uid, payload);
      }
      if (seq > cloudSyncedSeq) cloudSyncedSeq = seq;
      if (typeof window.sigajiSetSyncStatus === 'function') {
        window.sigajiSetSyncStatus('synced', new Date().toLocaleTimeString('id-ID'));
      }
    } catch (err) {
      var er = (err && (err.message || err.details || err.hint)) || String(err);
      if (typeof window.sigajiSetSyncStatus === 'function') window.sigajiSetSyncStatus('error', er);
      console.error('Sigaji cloud upsert:', err);
    }
  }

  /** Muat ulang seluruh data dari awan (setelah proses di server, mis. sinkron alpha / impor libur). */
  async function reloadCloudData() {
    var sb = window.sigajiSupabase;
    if (!clientReady || !sb) return false;
    var sess = await sb.auth.getSession();
    if (!sess.data || !sess.data.session) return false;
    if (cloudTimer) {
      clearTimeout(cloudTimer);
      cloudTimer = null;
    }
    await cloudUpsert();
    await withCloudTimeout(
      loadCloudPayloadIntoApp(sess.data.session.user.id),
      'Timeout memuat data cloud — periksa koneksi atau coba refresh'
    );
    if (typeof CU !== 'undefined' && CU && typeof window.sigajiApplyKaryawanDataRestriction === 'function') {
      window.sigajiApplyKaryawanDataRestriction(CU);
    }
    sigajiRefreshUiAfterCloudData();
    return true;
  }
  window.loadCloudData = reloadCloudData;

  window.sigajiTryCloudLogin = tryCloudLoginWhenReady;
  window.sigajiRetryCloudSync = function () {
    clearTimeout(cloudTimer);
    return cloudUpsert();
  };
  window.addEventListener('beforeunload', function (e) {
    if (cloudDirtySeq <= cloudSyncedSeq) return;
    if (cloudTimer) {
      clearTimeout(cloudTimer);
      cloudTimer = null;
      cloudUpsert();
    }
    e.preventDefault();
    e.returnValue = '';
  });

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

  window.sigajiPullCloudRefresh = sigajiPullCloudRefresh;
  window.sigajiPullTunjVarRefresh = pullTunjVarRefresh;
  if (typeof document !== 'undefined') {
    document.addEventListener('visibilitychange', onVisibilityPull);
  }

  bootPromise = boot().then(function () {
    scheduleCloudPullLoop();
  });
  window.sigajiCloudBootPromise = bootPromise;
})();
