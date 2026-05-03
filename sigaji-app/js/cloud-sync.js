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

  var cloudTimer = null;
  var clientReady = false;

  function toastSafe(msg) {
    if (typeof toast === 'function') toast(msg);
    else console.warn(msg);
  }

  async function boot() {
    var url = (window.SIGAJI_SUPABASE_URL || '').trim();
    var key = (window.SIGAJI_SUPABASE_ANON_KEY || '').trim();
    if (!url || !key) return;

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
      return;
    }

    if (typeof window.sigajiApplyCloudLoginUi === 'function') window.sigajiApplyCloudLoginUi();

    window.sigajiTryCloudLogin = function (email, pw) {
      if (!clientReady || !window.sigajiSupabase) {
        toastSafe('Koneksi awan belum siap. Tunggu sebentar lalu coba lagi.');
        return;
      }
      tryCloudLogin(email, pw);
    };

    window.sigajiQueueCloudSave = scheduleUpsert;

    window.sigajiCloudLogout = function () {
      if (!window.sigajiSupabase) return Promise.resolve();
      return window.sigajiSupabase.auth.signOut();
    };

    var sess = await window.sigajiSupabase.auth.getSession();
    if (sess.data && sess.data.session && window.SIGAJI_RESUME_SESSION_ON_LOAD === true) {
      await enterFromSession(sess.data.session);
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
        toastSafe('Login awan error');
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
    var res = await sb.from(CLOUD_TABLE).select('payload').eq('tenant_key', TENANT_KEY).maybeSingle();
    if (res.error) {
      console.error(res.error);
      toastSafe(
        (res.error.message || 'Gagal membaca cloud') +
          ' — jika baru migrate, jalankan sql/supabase_migrate_to_shared_payload.sql di Supabase.'
      );
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
    var row = {
      tenant_key: TENANT_KEY,
      user_id: uid,
      payload: payload,
      updated_at: new Date().toISOString(),
    };
    var r = await sb.from(CLOUD_TABLE).upsert(row, { onConflict: 'tenant_key' });
    if (r.error) console.error('Sigaji cloud save:', r.error);
  }

  boot();
})();
