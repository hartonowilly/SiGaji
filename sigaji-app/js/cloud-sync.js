/**
 * SiGaji — sinkron payload ke Supabase (tabel sigaji_cloud).
 * Butuh: js/config.js terisi + SQL sql/supabase_sigaji_cloud.sql sudah dijalankan.
 * Login awan: email + sandi Supabase Auth di kolom username/password (isi EMAIL lengkap).
 */
(function () {
  var CLOUD_TABLE = 'sigaji_cloud';
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
    if (sess.data && sess.data.session) {
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

  function displayNameFromAuth(authUser, emailLower) {
    var md = authUser && authUser.user_metadata;
    if (md && md.full_name) return String(md.full_name);
    if (md && md.name) return String(md.name);
    var em = emailLower || '';
    var at = em.indexOf('@');
    if (at > 0) return em.slice(0, at);
    return em || 'Pengguna';
  }

  /** Satu sumber kebenaran: user SiGaji dengan field email = email Supabase. */
  function pickCuAfterCloudLoad(email, authUser) {
    var em = (email || '').toLowerCase();
    var localPart = em.split('@')[0] || '';
    var matchedEmail = users.find(function (x) {
      return x.email && String(x.email).toLowerCase() === em;
    });
    var u =
      matchedEmail ||
      users.find(function (x) {
        return x.role === 'Admin' && x.aktif !== false;
      }) ||
      users[0];

    if (!u) {
      return {
        username: localPart || 'admin',
        password: '',
        role: 'Admin',
        nama: displayNameFromAuth(authUser, em),
        nik: null,
        aktif: true,
        email: em,
      };
    }
    var cu = Object.assign({}, u);
    if (!matchedEmail) {
      cu.nama = displayNameFromAuth(authUser, em);
      if (localPart) cu.username = localPart;
    }
    return cu;
  }

  /** Pertama kali login cloud: isi email di user Admin yang masih kosong, atau buat baris user baru — supaya tidak bergantung username lokal. */
  function ensureSiGajiUserLinkedToSession(authUser) {
    if (!authUser || !authUser.email) return;
    var em = String(authUser.email).toLowerCase();
    if (
      users.some(function (u) {
        return u.email && String(u.email).toLowerCase() === em;
      })
    )
      return;
    var adminBare = users.find(function (u) {
      return u.role === 'Admin' && u.aktif !== false && !u.email;
    });
    if (adminBare) {
      adminBare.email = em;
      if (typeof saveAll === 'function') saveAll();
      return;
    }
    var localPart = em.split('@')[0].replace(/[^a-z0-9_]/gi, '') || 'user';
    var uname = localPart;
    for (var n = 2; users.some(function (u) { return u.username === uname; }); n++)
      uname = localPart + String(n);
    users.push({
      username: uname,
      password: '\u2014cloud\u2014',
      nama: displayNameFromAuth(authUser, em),
      role: 'Admin',
      nik: null,
      aktif: true,
      email: em,
    });
    if (typeof saveAll === 'function') saveAll();
  }

  async function enterFromSession(session) {
    await loadCloudPayloadIntoApp(session.user.id);
    ensureSiGajiUserLinkedToSession(session.user);
    var cu = pickCuAfterCloudLoad(session.user.email, session.user);
    if (typeof window.enterAppWithUser === 'function') {
      window.enterAppWithUser(cu);
    }
  }

  async function loadCloudPayloadIntoApp(uid) {
    var sb = window.sigajiSupabase;
    var res = await sb.from(CLOUD_TABLE).select('payload').eq('user_id', uid).maybeSingle();
    if (res.error) {
      console.error(res.error);
      toastSafe(res.error.message || 'Gagal membaca data dari Supabase');
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
      user_id: uid,
      payload: payload,
      updated_at: new Date().toISOString(),
    };
    var r = await sb.from(CLOUD_TABLE).upsert(row, { onConflict: 'user_id' });
    if (r.error) console.error('Sigaji cloud save:', r.error);
  }

  boot();
})();
