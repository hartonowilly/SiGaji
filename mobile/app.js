(function () {
  var sb = null;
  var session = null;
  var me = { nama: '', nik: '', role: '' };

  function apiBase() {
    var h = (location && location.hostname) || '';
    if (/\.netlify\.app$/i.test(h)) return '/.netlify/functions/';
    return '/api/';
  }
  function apiUrl(name) {
    return apiBase() + String(name).replace(/^\//, '');
  }
  function toast(msg) {
    var t = document.getElementById('toast');
    if (!t) return;
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(toast._tm);
    toast._tm = setTimeout(function () {
      t.classList.remove('show');
    }, 3200);
  }
  function showScreen(id) {
    document.querySelectorAll('.screen').forEach(function (s) {
      s.classList.toggle('active', s.id === id);
    });
  }
  async function parseJson(r) {
    var ct = (r.headers && r.headers.get('content-type')) || '';
    if (ct.indexOf('application/json') >= 0) return r.json().catch(function () { return null; });
    return { ok: false, error: 'API tidak aktif — deploy /api/mobile-*' };
  }
  async function getToken() {
    if (!sb) return '';
    var s = await sb.auth.getSession();
    return (s && s.data && s.data.session && s.data.session.access_token) || '';
  }
  async function mobileApi(name, body, method) {
    var t = await getToken();
    if (!t) {
      toast('Sesi habis — login lagi');
      return null;
    }
    var opts = {
      method: method || (body ? 'POST' : 'GET'),
      headers: { authorization: 'Bearer ' + t },
    };
    if (body) {
      opts.headers['content-type'] = 'application/json';
      opts.body = JSON.stringify(body);
    }
    var r = await fetch(apiUrl(name), opts);
    return parseJson(r);
  }
  function tenantKey() {
    return (window.SIGAJI_TENANT_KEY && String(window.SIGAJI_TENANT_KEY).trim()) || 'main';
  }
  async function initSupabase() {
    var url = window.SIGAJI_SUPABASE_URL;
    var key = window.SIGAJI_SUPABASE_ANON_KEY;
    if (!url || !key) {
      toast('config.js belum diisi');
      return false;
    }
    var lib = window.supabase || (window.supabase && window.supabase.createClient);
    if (typeof window.supabase === 'undefined' && typeof supabase === 'undefined') {
      toast('Supabase JS tidak termuat');
      return false;
    }
    var create = window.supabase.createClient;
    sb = create(url, key);
    var sess = await sb.auth.getSession();
    if (sess.data && sess.data.session) {
      session = sess.data.session;
      await afterLogin();
      return true;
    }
    showScreen('screen-login');
    return true;
  }
  async function loadMeFromCloud() {
    var email = (session.user.email || '').toLowerCase();
    var uid = session.user.id;
    var res = await sb.from('sigaji_cloud').select('payload').eq('tenant_key', tenantKey()).maybeSingle();
    var payload = (res.data && res.data.payload) || {};
    var users = payload.users || [];
    var u =
      users.find(function (x) {
        return x && x.aktif !== false && x.email && String(x.email).toLowerCase() === email;
      }) ||
      users.find(function (x) {
        return x && x.aktif !== false && x.auth_uid && String(x.auth_uid) === uid;
      });
    if (!u) {
      toast('User tidak ada di data SiGaji — hubungi HRD');
      return false;
    }
    me = { nama: u.nama || u.username, nik: u.nik || '', role: u.role || '' };
    if (!me.nik) {
      toast('Akun belum punya NIK — hubungi HRD');
      return false;
    }
    return true;
  }
  async function afterLogin() {
    var ok = await loadMeFromCloud();
    if (!ok) {
      await sb.auth.signOut();
      showScreen('screen-login');
      return;
    }
    document.getElementById('home-nama').textContent = me.nama;
    document.getElementById('home-nik').textContent = 'NIK: ' + me.nik;
    await refreshDayStatus();
    showScreen('screen-home');
  }
  async function refreshDayStatus() {
    var el = document.getElementById('day-status');
    if (!el) return;
    var j = await mobileApi('mobile-attendance', { action: 'day_status' });
    if (!j || !j.ok) {
      el.innerHTML = '<span class="status-pill status-err">' + (j && j.error ? j.error : 'Status gagal') + '</span>';
      return;
    }
    var html = 'Hari ini: ';
    if (j.complete) html += '<span class="status-pill status-ok">Check-in & check-out selesai</span>';
    else if (j.has_check_in && !j.has_check_out)
      html += '<span class="status-pill status-warn">Sudah check-in — check-out wajib</span>';
    else if (!j.has_check_in) html += '<span class="status-pill status-warn">Belum check-in</span>';
    el.innerHTML = html;
    document.getElementById('btn-checkout').disabled = !j.has_check_in || j.has_check_out;
    document.getElementById('btn-checkin').disabled = j.has_check_in;
  }
  function getGps() {
    return new Promise(function (resolve, reject) {
      if (!navigator.geolocation) {
        reject(new Error('GPS tidak didukung'));
        return;
      }
      navigator.geolocation.getCurrentPosition(
        function (p) {
          resolve({
            lat: p.coords.latitude,
            lon: p.coords.longitude,
            accuracy_m: p.coords.accuracy,
            is_mock: !!(p.coords && (p.coords.mocked || p.coords.isMock)),
          });
        },
        function (e) {
          reject(new Error(e.message || 'GPS gagal — izinkan lokasi'));
        },
        { enableHighAccuracy: true, timeout: 25000, maximumAge: 0 }
      );
    });
  }
  async function uploadPhoto(file, sub) {
    var t = await getToken();
    if (!t) throw new Error('Sesi habis');
    var fd = new FormData();
    var name = file.name || 'photo.jpg';
    if (!/\.(jpe?g|png|webp|heic|pdf)$/i.test(name)) {
      var guess = (file.type || '').indexOf('pdf') >= 0 ? 'pdf' : 'jpg';
      name = 'photo.' + guess;
    }
    fd.append('file', file, name);
    fd.append('subfolder', sub || 'attendance');
    var r = await fetch(apiUrl('mobile-upload'), {
      method: 'POST',
      headers: { authorization: 'Bearer ' + t },
      body: fd,
    });
    var j = await parseJson(r);
    if (j && j.ok && j.path) return j.path;
    var err = (j && j.error) || 'Upload gagal (HTTP ' + r.status + ')';
    if (r.status === 404) err = 'API mobile-upload belum deploy — push functions/api/mobile-upload.js';
    throw new Error(err);
  }
  async function submitAttendance(eventType) {
    var fileIn = document.getElementById(eventType === 'check_out' ? 'photo-out' : 'photo-in');
    var file = fileIn && fileIn.files[0];
    if (!file) {
      toast('Ambil foto dulu');
      return;
    }
    toast('Mengambil GPS…');
    var gps;
    try {
      gps = await getGps();
    } catch (e) {
      toast(e.message || 'GPS error');
      return;
    }
    toast('Mengunggah foto…');
    var path;
    try {
      path = await uploadPhoto(file, 'attendance');
    } catch (e) {
      toast(e.message || 'Upload error');
      return;
    }
    toast('Menyimpan…');
    var j = await mobileApi('mobile-attendance', {
      action: eventType,
      lat: gps.lat,
      lon: gps.lon,
      accuracy_m: gps.accuracy_m,
      is_mock: gps.is_mock,
      photo_path: path,
      device_id: navigator.userAgent.substring(0, 120),
    });
    if (j && j.ok) {
      toast(j.message || 'Berhasil');
      if (eventType === 'check_in') showScreen('screen-home');
      else showScreen('screen-home');
      fileIn.value = '';
      var prev = document.getElementById(eventType === 'check_out' ? 'preview-out' : 'preview-in');
      if (prev) prev.innerHTML = '';
      await refreshDayStatus();
    } else toast((j && j.error) || 'Gagal simpan');
  }
  async function loadLeaveHistory() {
    var el = document.getElementById('leave-history');
    if (!el) return;
    var j = await mobileApi('mobile-leave', { action: 'my_list' });
    if (!j || !j.ok) {
      el.textContent = j && j.error ? j.error : '-';
      return;
    }
    var items = j.items || [];
    el.innerHTML = items.length
      ? items
          .map(function (r) {
            return (
              '<div style="padding:.45rem 0;border-bottom:1px solid #f1f5f9;font-size:.85rem">' +
              '<b>' +
              r.request_type +
              '</b> ' +
              r.date_from +
              '–' +
              r.date_to +
              ' <span class="status-pill ' +
              (r.status === 'approved' ? 'status-ok' : r.status === 'pending' ? 'status-warn' : 'status-err') +
              '">' +
              r.status +
              '</span></div>'
            );
          })
          .join('')
      : 'Belum ada pengajuan';
  }
  async function submitLeave() {
    var type = document.getElementById('leave-type').value;
    var df = document.getElementById('leave-from').value;
    var dt = document.getElementById('leave-to').value;
    var reason = document.getElementById('leave-reason').value;
    var attachment_path = null;
    if (type === 'sakit') {
      var f = document.getElementById('leave-file').files[0];
      if (!f) {
        toast('Surat dokter wajib');
        return;
      }
      try {
        attachment_path = await uploadPhoto(f, 'leave');
      } catch (e) {
        toast(e.message);
        return;
      }
    }
    var j = await mobileApi('mobile-leave', {
      action: 'submit',
      request_type: type,
      date_from: df,
      date_to: dt,
      reason: reason,
      attachment_path: attachment_path,
    });
    if (j && j.ok) {
      toast('Pengajuan terkirim — tunggu HRD');
      showScreen('screen-home');
      loadLeaveHistory();
    } else toast((j && j.error) || 'Gagal');
  }
  function previewFile(inputId, previewId) {
    var inp = document.getElementById(inputId);
    var prev = document.getElementById(previewId);
    if (!inp || !prev) return;
    inp.onchange = function () {
      var f = inp.files[0];
      if (!f) {
        prev.innerHTML = '';
        return;
      }
      prev.innerHTML = '<img class="preview-img" alt="preview" src="' + URL.createObjectURL(f) + '">';
    };
  }
  window.sigajiMobileLogin = async function () {
    var email = document.getElementById('login-email').value.trim();
    var pw = document.getElementById('login-pw').value;
    if (!email || !pw) {
      toast('Isi email & sandi');
      return;
    }
    var r = await sb.auth.signInWithPassword({ email: email, password: pw });
    if (r.error) {
      toast(r.error.message || 'Login gagal');
      return;
    }
    session = r.data.session;
    await afterLogin();
  };
  window.sigajiMobileLogout = async function () {
    await sb.auth.signOut();
    session = null;
    showScreen('screen-login');
  };
  window.sigajiMobileGo = function (id) {
    showScreen(id);
    if (id === 'screen-leave') {
      document.getElementById('leave-file-wrap').style.display =
        document.getElementById('leave-type').value === 'sakit' ? 'block' : 'none';
      loadLeaveHistory();
    }
    if (id === 'screen-home') refreshDayStatus();
  };
  window.sigajiMobileSubmitIn = function () {
    submitAttendance('check_in');
  };
  window.sigajiMobileSubmitOut = function () {
    submitAttendance('check_out');
  };
  window.sigajiMobileSubmitLeave = function () {
    submitLeave();
  };
  document.addEventListener('DOMContentLoaded', function () {
    previewFile('photo-in', 'preview-in');
    previewFile('photo-out', 'preview-out');
    var lt = document.getElementById('leave-type');
    if (lt) {
      lt.onchange = function () {
        var w = document.getElementById('leave-file-wrap');
        if (w) w.style.display = lt.value === 'sakit' ? 'block' : 'none';
      };
    }
    initSupabase();
  });
})();
