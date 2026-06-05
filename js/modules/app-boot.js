/* SiGaji — boot, registrasi, emergency restore (dulu inline di index.html) */
if (typeof exportCloudDatabaseBackup !== 'function') {
  window.exportCloudDatabaseBackup = async function () {
    var m = 'Modul js/app-master.js belum termuat. Deploy ulang (js/modules/* v11) lalu Ctrl+F5.';
    if (typeof toast === 'function') toast(m);
    else alert(m);
  };
}
if (typeof switchBackupTab !== 'function') {
  window.switchBackupTab = function () {
    if (typeof toast === 'function') toast('Tab backup belum siap — muat ulang halaman (Ctrl+F5)');
  };
}
if (typeof bindBackupTabsOnce === 'function') bindBackupTabsOnce();

(function () {
  function showConfigWarn() {
    if ((window.SIGAJI_SUPABASE_URL || '').trim() && (window.SIGAJI_SUPABASE_ANON_KEY || '').trim()) return;
    var h = document.getElementById('cloud-login-hint');
    if (!h) return;
    h.style.display = 'block';
    h.style.color = '#991b1b';
    h.style.background = '#fef2f2';
    h.style.borderColor = '#fecaca';
    h.innerHTML =
      '<strong>Login awan belum aktif.</strong> Di Cloudflare Pages → Settings → Environment variables, isi '
      + '<code>SIGAJI_SUPABASE_URL</code> dan <code>SIGAJI_SUPABASE_ANON_KEY</code>, lalu set Build command: '
      + '<code>npm install &amp;&amp; npm run build</code> dan deploy ulang.';
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', showConfigWarn);
  else showConfigWarn();
})();

(function () {
  var h = document.getElementById('file-protocol-hint');
  if (h && location.protocol === 'file:') h.style.display = 'block';
})();

(function () {
  function tryParse(s) {
    try {
      return JSON.parse(s);
    } catch (e) {
      return null;
    }
  }
  function rebuildDbFromUniversalRaw(raw) {
    var o = tryParse(raw);
    if (!o) return false;
    var db = {
      schemaVersion: 9,
      karyawan: o.karyawan || [],
      periodes: o.periodes || [],
      hariLibur: o.hariLibur || [],
      masterCuti: o.masterCuti || { kuota: 12, carryover: 'no', cbPotong: true },
      absensi: o.absensi || {},
      lembur: o.lembur || {},
      prorata: o.prorata || {},
      approvals: o.approvals || [],
      notifikasi: o.notifikasi || [],
      perusahaan: o.perusahaan || {},
      users: o.users || [],
      roles: o.roles || {},
      thrManual: o.thrManual || {},
      tunjVarBulan: o.tunjVarBulan || {},
      tunjVarLabels: o.tunjVarLabels || { v1: 'Bonus', v2: 'Uang Makan', v3: 'Lain-lain' },
      tunjVarColumns: o.tunjVarColumns || [],
      karSnapshot: o.karSnapshot || {},
      auditLog: o.auditLog || [],
    };
    localStorage.setItem('sigaji_db', JSON.stringify(db));
    return true;
  }
  if (typeof window.sigajiRestoreEmergencyLocalBackup === 'function') return;
  window.sigajiRestoreEmergencyLocalBackup = function () {
    try {
      var rec = localStorage.getItem('sigaji_recovery_last');
      if (rec) {
        var o = tryParse(rec);
        if (o) {
          var c = JSON.parse(JSON.stringify(o));
          delete c._tag;
          delete c._ts;
          if (c.schemaVersion == null) c.schemaVersion = 9;
          localStorage.setItem('sigaji_db', JSON.stringify(c));
          location.reload();
          return true;
        }
      }
      var prev = localStorage.getItem('sigaji_db_prev');
      if (prev && prev.length > 40) {
        localStorage.setItem('sigaji_db', prev);
        location.reload();
        return true;
      }
      var uniPrev = localStorage.getItem('sigaji_universal_prev');
      if (uniPrev && rebuildDbFromUniversalRaw(uniPrev)) {
        location.reload();
        return true;
      }
      var uni = localStorage.getItem('sigaji_universal');
      if (uni && uni.length > 120 && rebuildDbFromUniversalRaw(uni)) {
        location.reload();
        return true;
      }
      return false;
    } catch (e) {
      console.error('sigajiRestoreEmergencyLocalBackup', e);
      return false;
    }
  };
})();

async function sigajiWaitSupabase(maxMs) {
  var n = 0;
  var max = Math.max(10, Math.floor((maxMs || 5000) / 100));
  while (!window.sigajiSupabase && n < max) {
    await new Promise(function (res) {
      setTimeout(res, 100);
    });
    n++;
  }
  return !!window.sigajiSupabase;
}

async function sigajiRegisterViaSupabase(email, nama, nik) {
  if (!(await sigajiWaitSupabase(8000))) throw new Error('Supabase belum siap — cek js/config.js');
  var tenant = (window.SIGAJI_TENANT_KEY && String(window.SIGAJI_TENANT_KEY).trim()) || 'main';
  var sb = window.sigajiSupabase;
  var ex = await sb
    .from('sigaji_registration_requests')
    .select('id,status')
    .eq('tenant_key', tenant)
    .ilike('email', email)
    .order('created_at', { ascending: false })
    .limit(1);
  if (ex.error) throw new Error(ex.error.message);
  if (ex.data && ex.data[0] && ex.data[0].status === 'pending') return { ok: true, pending: true };
  var ins = await sb
    .from('sigaji_registration_requests')
    .insert({ tenant_key: tenant, email: email, nama: nama || null, nik: nik || null, status: 'pending' });
  if (ins.error) throw new Error(ins.error.message);
  return { ok: true };
}

async function submitRegisterRequest() {
  try {
    var email = (document.getElementById('reg-email') && document.getElementById('reg-email').value || '').trim();
    var nama = (document.getElementById('reg-nama') && document.getElementById('reg-nama').value || '').trim();
    var nik = (document.getElementById('reg-nik') && document.getElementById('reg-nik').value || '').trim();
    if (!email || email.indexOf('@') < 0) {
      toast('Email tidak valid.');
      return;
    }
    toast('Mengirim permintaan...');
    var j = null;
    try {
      var r = await fetch('/api/auth-register-request', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email: email, nama: nama, nik: nik }),
      });
      var ct = (r.headers && r.headers.get('content-type')) || '';
      if (ct.indexOf('application/json') >= 0) {
        j = await r.json();
        if (r.ok && j && j.ok) {
          closeModal('m-register');
          toast('Permintaan dikirim. Tunggu persetujuan Admin/HRD.');
          return;
        }
        if (j && j.error) {
          toast(j.error);
          return;
        }
      }
    } catch (e) {
      console.warn('register API', e);
    }
    j = await sigajiRegisterViaSupabase(email, nama, nik);
    if (j && j.ok) {
      closeModal('m-register');
      toast('Permintaan dikirim (via Supabase). Tunggu persetujuan Admin/HRD.');
      return;
    }
    toast('Gagal mengirim permintaan');
  } catch (e) {
    console.error('submitRegisterRequest', e);
    var msg = e.message || String(e);
    if (/policy|permission|row-level|42501/i.test(msg)) {
      toast('Supabase: jalankan sql/supabase_registration_anon_insert.sql');
    } else toast(msg || 'Gagal mengirim permintaan');
  }
}

async function loadRegRequests() {
  try {
    if (!CU || (CU.role !== 'Admin' && CU.role !== 'HRD')) {
      toast('Hanya Admin/HRD');
      return;
    }
    var t = typeof getCloudAccessToken === 'function' ? await getCloudAccessToken() : '';
    if (!t) {
      toast('Belum login awan');
      return;
    }
    var host = document.getElementById('reg-req-list');
    if (host) host.innerHTML = 'Memuat...';
    var j = null;
    var apiErr = '';
    try {
      var r = await fetch('/api/auth-registration-list?status=pending', {
        headers: { authorization: 'Bearer ' + t },
      });
      var ct = (r.headers && r.headers.get('content-type')) || '';
      if (ct.indexOf('application/json') >= 0) {
        j = await r.json();
        if (!(r.ok && j && j.ok)) {
          apiErr = (j && j.error) || 'HTTP ' + r.status;
          j = null;
        }
      } else apiErr = 'API tidak aktif (deploy /api/)';
    } catch (e) {
      apiErr = e.message || String(e);
    }
    if (!j && typeof sigajiLoadRegRequestsViaSupabase === 'function') {
      try {
        j = await sigajiLoadRegRequestsViaSupabase('pending');
      } catch (e2) {
        toast(apiErr || e2.message || 'Gagal memuat');
        if (host) host.innerHTML = '';
        return;
      }
    } else if (!j) {
      await sigajiWaitSupabase(8000);
      if (window.sigajiSupabase) {
        var tenant = (window.SIGAJI_TENANT_KEY && String(window.SIGAJI_TENANT_KEY).trim()) || 'main';
        var q = await window.sigajiSupabase
          .from('sigaji_registration_requests')
          .select('id,email,nama,nik,status,created_at,decided_at,note')
          .eq('tenant_key', tenant)
          .eq('status', 'pending')
          .order('created_at', { ascending: false })
          .limit(200);
        if (q.error) {
          toast(apiErr || q.error.message);
          if (host) host.innerHTML = '';
          return;
        }
        j = { ok: true, items: q.data || [] };
      } else {
        toast(apiErr || 'Gagal memuat');
        if (host) host.innerHTML = '';
        return;
      }
    }
    var items = j.items || [];
    if (!host) return;
    if (!items.length) {
      host.innerHTML =
        '<div style="font-size:12px;color:#6b7280;padding:.5rem">Tidak ada permintaan pending.</div>';
      return;
    }
    host.innerHTML =
      '<table style="min-width:720px"><thead><tr><th>Email</th><th>Nama</th><th>NIK</th><th>Tanggal</th><th>Aksi</th></tr></thead><tbody>'
      + items
        .map(function (it) {
          var em = String(it.email || '');
          var nm = String(it.nama || '');
          var nk = String(it.nik || '');
          var dt = String(it.created_at || '').slice(0, 19).replace('T', ' ');
          return (
            '<tr>'
            + '<td style="font-weight:800">' + em + '</td>'
            + '<td>' + (typeof escapeHtml === 'function' ? escapeHtml(nm) : nm) + '</td>'
            + '<td>' + (typeof escapeHtml === 'function' ? escapeHtml(nk) : nk) + '</td>'
            + '<td style="font-size:11px;color:#6b7280">' + (typeof escapeHtml === 'function' ? escapeHtml(dt) : dt) + '</td>'
            + '<td><div class="fl gap1">'
            + '<button class="btn btn-sm btn-g" onclick="decideRegReq(\'' + String(it.id).replace(/'/g, '') + '\',\'approve\')">Approve</button>'
            + '<button class="btn btn-sm btn-r" onclick="decideRegReq(\'' + String(it.id).replace(/'/g, '') + '\',\'reject\')">Reject</button>'
            + '</div></td>'
            + '</tr>'
          );
        })
        .join('')
      + '</tbody></table>';
  } catch (e) {
    console.error('loadRegRequests', e);
    toast('Gagal memuat permintaan');
  }
}

async function decideRegReq(id, action) {
  try {
    if (!id) return;
    if (action === 'reject' && !confirm('Tolak permintaan ini?')) return;
    if (action === 'approve' && !confirm('Setujui dan kirim undangan email reset password?')) return;
    var t = typeof getCloudAccessToken === 'function' ? await getCloudAccessToken() : '';
    if (!t) {
      toast('Belum login awan');
      return;
    }
    toast(action === 'approve' ? 'Menyetujui...' : 'Menolak...');
    var r = await fetch('/api/auth-registration-decide', {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: 'Bearer ' + t },
      body: JSON.stringify({ id: id, action: action }),
    });
    var j =
      typeof sigajiParseFunctionJson === 'function'
        ? await sigajiParseFunctionJson(r)
        : await r.json().catch(function () {
            return null;
          });
    if (!r.ok || !j || !j.ok) {
      var err = (j && j.error) || 'Gagal memproses';
      if (/Missing env|SERVICE_ROLE|Forbidden/i.test(err)) {
        err += ' — cek SIGAJI_SUPABASE_SERVICE_ROLE_KEY di Cloudflare Pages';
      }
      toast(err);
      return;
    }
    toast(
      action === 'approve'
        ? 'Approved. Email undangan dikirim (atau user sudah ada).'
        : 'Rejected.'
    );
    loadRegRequests();
  } catch (e) {
    console.error('decideRegReq', e);
    toast('Gagal memproses');
  }
}
