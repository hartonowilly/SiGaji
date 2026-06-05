(function () {
  var sb = null;
  var session = null;
  var me = { nama: '', nik: '', role: '' };
  var lastUnreadCount = 0;
  var notifPollTimer = null;

  function apiBase() {
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
    await refreshNotifBadge(true);
    startNotifPolling();
    showScreen('screen-home');
  }
  function fmtNotifTime(iso) {
    if (!iso) return '';
    try {
      var d = new Date(iso);
      return d.toLocaleString('id-ID', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
    } catch (e) {
      return iso;
    }
  }
  function updateNotifBadgeUi(n) {
    var badge = document.getElementById('notif-badge');
    if (!badge) return;
    if (n > 0) {
      badge.style.display = 'block';
      badge.textContent = n > 99 ? '99+' : String(n);
    } else badge.style.display = 'none';
  }
  async function refreshNotifBadge(silent) {
    var j = await mobileApi('mobile-notifications', { action: 'unread_count' });
    if (!j || !j.ok) return;
    var n = j.unread || 0;
    if (!silent && n > lastUnreadCount && lastUnreadCount >= 0) {
      toast('Ada notifikasi baru — buka lonceng');
    }
    lastUnreadCount = n;
    updateNotifBadgeUi(n);
  }
  function startNotifPolling() {
    if (notifPollTimer) clearInterval(notifPollTimer);
    notifPollTimer = setInterval(function () {
      var home = document.getElementById('screen-home');
      if (home && home.classList.contains('active')) refreshNotifBadge(false);
    }, 45000);
  }
  async function loadNotifList() {
    var el = document.getElementById('notif-list');
    var btnAll = document.getElementById('btn-notif-read-all');
    if (!el) return;
    el.textContent = 'Memuat…';
    var j = await mobileApi('mobile-notifications', { action: 'list', limit: 50 });
    if (!j || !j.ok) {
      el.textContent = (j && j.error) || 'Gagal memuat notifikasi';
      if (btnAll) btnAll.style.display = 'none';
      return;
    }
    var items = j.items || [];
    if (!items.length) {
      el.innerHTML = '<div style="text-align:center;padding:.5rem 0">Belum ada notifikasi</div>';
      if (btnAll) btnAll.style.display = 'none';
      await refreshNotifBadge(true);
      return;
    }
    var hasUnread = items.some(function (n) {
      return !n.read_at;
    });
    if (btnAll) btnAll.style.display = hasUnread ? 'block' : 'none';
    el.innerHTML = items
      .map(function (n) {
        var unread = !n.read_at;
        return (
          '<div class="notif-item' +
          (unread ? ' unread' : '') +
          '">' +
          '<div class="notif-item-title">' +
          escapeHtml(n.title || '') +
          '</div>' +
          '<div class="notif-item-body">' +
          escapeHtml(n.body || '') +
          '</div>' +
          '<div class="notif-item-time">' +
          fmtNotifTime(n.created_at) +
          '</div></div>'
        );
      })
      .join('');
    if (hasUnread) {
      await mobileApi('mobile-notifications', { action: 'mark_read', all: true });
    }
    await refreshNotifBadge(true);
  }
  function escapeHtml(s) {
    return String(s || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }
  function statusLbl(st) {
    var map = {
      ok: 'OK',
      pending_review: 'Menunggu HRD',
      rejected: 'Ditolak — ulangi',
      outside_geofence: 'Luar radius',
    };
    return map[st] || st || '';
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
    else if (j.check_in_status === 'rejected')
      html += '<span class="status-pill status-err">Check-in ditolak — silakan check-in ulang</span>';
    else if (j.check_in_status === 'pending_review')
      html += '<span class="status-pill status-warn">Check-in menunggu HRD (' + statusLbl(j.check_in_status) + ')</span>';
    else if (j.has_check_in && !j.has_check_out)
      html += '<span class="status-pill status-warn">Sudah check-in — check-out wajib</span>';
    else if (!j.has_check_in) html += '<span class="status-pill status-warn">Belum check-in</span>';
    if (j.check_out_status === 'pending_review')
      html += ' <span class="status-pill status-warn">Check-out review HRD</span>';
    if (j.check_out_status === 'rejected')
      html += ' <span class="status-pill status-err">Check-out ditolak — ulangi</span>';
    el.innerHTML = html;
    var btnIn = document.getElementById('btn-checkin');
    var btnOut = document.getElementById('btn-checkout');
    var pwaBlock = document.getElementById('pwa-absen-block');
    var apkLink = document.getElementById('pwa-apk-link');
    if (pwaBlock) pwaBlock.style.display = 'block';
    if (apkLink && !apkLink.dataset.bound) {
      apkLink.dataset.bound = '1';
      var apkUrl = (window.SIGAJI_MOBILE_APK_URL && String(window.SIGAJI_MOBILE_APK_URL).trim()) || '/downloads/sigaji-absen.apk';
      apkLink.href = apkUrl;
    }
    if (btnIn) {
      btnIn.style.display = 'none';
      btnIn.disabled = true;
    }
    if (btnOut) {
      btnOut.style.display = 'none';
      btnOut.disabled = true;
    }
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
    toast('Absensi wajah hanya di APK SiGaji Absen (Flutter). PWA tidak menyimpan foto lagi.');
    return;
    /* legacy upload dinonaktifkan — gunakan APK untuk validasi wajah on-device */
    if (j && j.ok) {
      toast(j.message || 'Berhasil');
      showScreen('screen-home');
      fileIn.value = '';
      var prev = document.getElementById(eventType === 'check_out' ? 'preview-out' : 'preview-in');
      if (prev) prev.innerHTML = '';
      await refreshDayStatus();
      return;
    }
    var err = (j && j.error) || 'Gagal simpan';
    if (j && j.retry) err += ' — silakan coba lagi.';
    toast(err);
    await refreshDayStatus();
  }
  function formatCutiBalance(b) {
    if (!b) return 'Memuat sisa cuti…';
    var sisa = b.sisa != null ? b.sisa : 0;
    var col = sisa <= 0 ? 'status-err' : sisa <= 3 ? 'status-warn' : 'status-ok';
    return (
      '<span class="status-pill ' +
      col +
      '">Sisa cuti ' +
      b.year +
      ': <b>' +
      Math.max(0, sisa) +
      '</b> hari</span> ' +
      '(kuota ' +
      (b.kuota || 12) +
      ', terpakai ' +
      (b.terpakai || 0) +
      (b.pending_pengajuan ? ', termasuk ' + b.pending_pengajuan + ' hari pending' : '') +
      ')'
    );
  }
  async function loadLeaveBalance() {
    var box = document.getElementById('leave-balance-box');
    var prev = document.getElementById('leave-preview-box');
    if (!box) return;
    var type = document.getElementById('leave-type');
    if (type && type.value !== 'cuti') {
      box.style.display = 'none';
      if (prev) prev.style.display = 'none';
      return;
    }
    box.style.display = 'block';
    box.innerHTML = 'Memuat sisa cuti…';
    var yr = new Date().getFullYear();
    var df = document.getElementById('leave-from');
    if (df && df.value) yr = parseInt(String(df.value).substring(0, 4), 10) || yr;
    var j = await mobileApi('mobile-leave', { action: 'cuti_balance', year: yr });
    if (!j || !j.ok) {
      box.innerHTML = (j && j.error) || 'Gagal memuat sisa cuti';
      return;
    }
    box.innerHTML = formatCutiBalance(j.balance);
    await refreshLeavePreview();
  }
  async function refreshLeavePreview() {
    var prev = document.getElementById('leave-preview-box');
    if (!prev) return;
    var type = document.getElementById('leave-type').value;
    var df = document.getElementById('leave-from').value;
    var dt = document.getElementById('leave-to').value;
    if (type !== 'cuti' || !df || !dt) {
      prev.style.display = 'none';
      return;
    }
    if (dt < df) {
      prev.style.display = 'block';
      prev.innerHTML = '<span style="color:#b91c1c">Tanggal akhir harus ≥ tanggal mulai</span>';
      return;
    }
    prev.style.display = 'block';
    prev.innerHTML = 'Menghitung hari kerja…';
    var j = await mobileApi('mobile-leave', {
      action: 'validate_cuti',
      date_from: df,
      date_to: dt,
    });
    if (!j || !j.ok) {
      prev.innerHTML = (j && j.error) || 'Validasi gagal';
      return;
    }
    var req = j.requested_work_days || 0;
    var bal = j.balance;
    var sisa = bal && bal.sisa != null ? bal.sisa : 0;
    if (j.allowed) {
      prev.innerHTML =
        'Mengajukan <b>' +
        req +
        '</b> hari kerja. Sisa setelah ini: <b>' +
        Math.max(0, sisa - req) +
        '</b> hari.';
      prev.style.color = '#166534';
    } else {
      prev.innerHTML =
        '<span style="color:#b91c1c">' +
        (j.error || 'Melebihi sisa cuti') +
        '</span> (mengajukan ' +
        req +
        ' hari, sisa ' +
        Math.max(0, sisa) +
        ' hari)';
      prev.style.color = '#b91c1c';
    }
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
    if (!df || !dt) {
      toast('Isi tanggal mulai & akhir');
      return;
    }
    if (dt < df) {
      toast('Tanggal akhir harus ≥ tanggal mulai');
      return;
    }
    if (type === 'cuti') {
      var v = await mobileApi('mobile-leave', {
        action: 'validate_cuti',
        date_from: df,
        date_to: dt,
      });
      if (!v || !v.ok) {
        toast((v && v.error) || 'Validasi gagal');
        return;
      }
      if (!v.allowed) {
        toast(v.error || 'Cuti melebihi sisa kuota');
        await refreshLeavePreview();
        return;
      }
    }
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
    if (notifPollTimer) clearInterval(notifPollTimer);
    notifPollTimer = null;
    lastUnreadCount = 0;
    await sb.auth.signOut();
    session = null;
    showScreen('screen-login');
  };
  window.sigajiMobileGo = function (id) {
    showScreen(id);
    if (id === 'screen-notif') loadNotifList();
    if (id === 'screen-leave') {
      document.getElementById('leave-file-wrap').style.display =
        document.getElementById('leave-type').value === 'sakit' ? 'block' : 'none';
      loadLeaveHistory();
      loadLeaveBalance();
    }
    if (id === 'screen-home') {
      refreshDayStatus();
      refreshNotifBadge(true);
    }
  };
  window.sigajiMobileMarkAllNotifRead = async function () {
    await mobileApi('mobile-notifications', { action: 'mark_read', all: true });
    await loadNotifList();
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
        loadLeaveBalance();
      };
    }
    var lf = document.getElementById('leave-from');
    var lto = document.getElementById('leave-to');
    if (lf) lf.onchange = function () { loadLeaveBalance(); };
    if (lto) lto.onchange = refreshLeavePreview;
    if (lf) lf.oninput = function () { loadLeaveBalance(); };
    if (lto) lto.oninput = refreshLeavePreview;
    initSupabase();
  });
})();
