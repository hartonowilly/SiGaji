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

  function isMissingTenantKeyColumn(err) {
    if (!err) return false;
    var blob = String(err.message || '') + String(err.details || '') + String(err.hint || '') + String(err.code || '');
    return /tenant_key|does not exist|42703|undefined_column/i.test(blob);
  }

  function toastSafe(msg) {
    if (typeof toast === 'function') toast(msg);
    else console.warn(msg);
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
    } catch (e) {}
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
          'Gagal memuat Supabase (sering karena jaringan / esm.sh diblokir). Coba refresh, matikan pemblokir iklan, atau koneksi lain. Buka F12 → Console untuk detail.'
        );
      });
  }

  async function boot() {
    var url = (window.SIGAJI_SUPABASE_URL || '').trim();
    var key = (window.SIGAJI_SUPABASE_ANON_KEY || '').trim();
    if (!url || !key) {
      return;
    }

    try {
      var mod = await import('https://esm.sh/@supabase/supabase-js@2');
      window.sigajiSupabase = mod.createClient(url, key, {
        auth: {
          persistSession: true,
          storage: window.localStorage,
          detectSessionInUrl: true,
        },
      });
      clientReady = true;
    } catch (e) {
      console.error('Sigaji cloud:', e);
      toastSafe('Gagal memuat pustaka Supabase');
      throw e;
    }

    // Supabase email link (mode baru/PKCE) bisa berupa ?code=...&type=recovery / invite / signup
    // Agar modal reset benar-benar muncul di Netlify, kita tukar code -> session secara eksplisit.
    try {
      var qs = new URLSearchParams(window.location.search || '');
      var code = (qs.get('code') || '').trim();
      var type = (qs.get('type') || '').trim();
      if (code && /(recovery|invite|signup)/i.test(type)) {
        await window.sigajiSupabase.auth.exchangeCodeForSession(code);
        if (typeof openModal === 'function') openModal('m-pw-reset');
        // bersihkan URL (jaga privasi & hindari re-run)
        try {
          window.history.replaceState({}, document.title, window.location.origin + window.location.pathname);
        } catch (e2) {}
      }
    } catch (e) {
      console.warn('Sigaji cloud recovery parse:', e);
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
      try { localStorage.removeItem('sigaji_resume_hint'); } catch (e) {}
      if (!window.sigajiSupabase) return Promise.resolve();
      return window.sigajiSupabase.auth.signOut();
    };

    var hasSession = false;
    setResumeBootUi(true, false);
    try {
      var sess = await window.sigajiSupabase.auth.getSession();
      if (sess.data && sess.data.session && window.SIGAJI_RESUME_SESSION_ON_LOAD === true) {
        hasSession = true;
        await enterFromSession(sess.data.session);
      }
    } finally {
      setResumeBootUi(false, hasSession);
    }
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
            '. Cek jaringan, blokir iklan (esm.sh), dan konsol F12. Data lokal tidak diubah jika login tidak selesai.'
        );
      });
  }

  /** Hanya baris user SiGaji yang punya email sama dengan Auth — tidak ada fallback ke Admin (itu yang bikin HRD terlihat seperti Admin). */
  function pickCuAfterCloudLoad(email) {
    var em = (email || '').toLowerCase();
    var matched = users.find(function (x) {
      return x.email && String(x.email).toLowerCase() === em && x.aktif !== false;
    });
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
    try { localStorage.setItem('sigaji_resume_hint', '1'); } catch (e) {}
    await loadCloudPayloadIntoApp(session.user.id);
    bootstrapAdminEmailIfNeeded(session.user);
    var cu = pickCuAfterCloudLoad(session.user.email);
    if (!cu) {
      toastSafe(
        'Email ini belum terdaftar di SiGaji atau tidak aktif. Minta Admin buka Manajemen User → Edit user Anda → isi Email Supabase persis seperti email login (role HRD/Admin mengikuti pengaturan di situ).'
      );
      if (window.sigajiSupabase) await window.sigajiSupabase.auth.signOut();
      return;
    }
    if (typeof window.enterAppWithUser === 'function') {
      window.enterAppWithUser(cu);
    }
  }

  async function loadCloudPayloadIntoApp(uid) {
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

    if (res.error) {
      console.error(res.error);
      var er = res.error.message || String(res.error.code || '') || 'Gagal membaca cloud';
      if (/row-level security|RLS|42501|permission denied/i.test(String(res.error.message) + String(res.error.details || '')))
        er +=
          ' — cek kebijakan RLS tabel sigaji_cloud (baca/insert untuk user terautentikasi).';
      toastSafe(er);
      return;
    }
    if (res.data && res.data.payload && typeof window.applyDbFromCloudPayload === 'function') {
      window.applyDbFromCloudPayload(res.data.payload);
    }
  }

  function scheduleUpsert() {
    if (!clientReady || !window.sigajiSupabase) return;
    clearTimeout(cloudTimer);
    cloudTimer = setTimeout(function () {
      cloudUpsert();
    }, DEBOUNCE_MS);
  }

  async function cloudUpsert() {
    if (window.sigajiApplyingCloud) return;
    var sb = window.sigajiSupabase;
    if (!sb) return;
    var sess = await sb.auth.getSession();
    if (!sess.data || !sess.data.session) return;
    var uid = sess.data.session.user.id;
    if (typeof window.getPayloadForCloud !== 'function') return;
    var payload = window.getPayloadForCloud();
    if (typeof window.sigajiShouldSkipCloudUpload === 'function' && window.sigajiShouldSkipCloudUpload(payload)) {
      console.warn('Sigaji cloud: lewati unggah — payload masih template kosong (lindungi data tenant di Supabase).');
      return;
    }
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
    if (r.error) console.error('Sigaji cloud save:', r.error);
  }

  window.sigajiTryCloudLogin = tryCloudLoginWhenReady;

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
            toastSafe('Gagal mengirim email: ' + (r.error.message || r.error));
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
})();
