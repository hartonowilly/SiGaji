/* SiGaji — hak akses, user, matriks izin */
if(typeof sigajiFunctionUrl!=='function'){
  window.sigajiFunctionUrl=function(name){
    var pre='/api';
    return pre+'/'+String(name||'').replace(/^\//,'');
  };
}
if(typeof sigajiParseFunctionJson!=='function'){
  window.sigajiParseFunctionJson=function(r){
    var ct=(r.headers&&r.headers.get('content-type'))||'';
    if(ct.indexOf('application/json')>=0)return r.json().catch(function(){return null;});
    return Promise.resolve({ok:false,error:'API tidak aktif (deploy /api/ terbaru belum termuat — Ctrl+F5)'});
  };
}
// ── PERMISSIONS & SIDEBAR ────────────────────────
function canAccessModule(mid){
  if(!CU)return false;
  if(mid==='pph')return canAccessModule('laporan');
  if(mid==='sysstatus')return canAccessModule('backup');
  if(mid==='backup')return CU.role==='Admin';
  if(CU.role==='Admin')return true;
  const p=roles[CU.role]||[];
  const subs=SUBTABS[mid];
  if(subs&&subs.length)return subs.some(s=>p.includes(mid+'.'+s));
  return p.includes(mid);
}
function canAccess(id){return canAccessModule(id);}
function canAccessSubTab(moduleId,subTabId){
  if(!CU)return false;
  if(CU.role==='Admin')return true;
  var p=roles[CU.role]||[];
  if(p.includes(moduleId+'.'+subTabId))return true;
  /* Akses modul penuh (mis. 'laporan') → semua sub-tab modul itu */
  if(p.includes(moduleId))return true;
  return false;
}
function canAccessLaporanTab(laptab){
  if(!laptab)return false;
  if(canAccessSubTab('laporan',laptab))return true;
  if(laptab==='variance')return canAccessSubTab('laporan','rekap');
  return false;
}
function canAccessPayrollSub(subTabId){return canAccessSubTab('kompgaji',subTabId);}
if(typeof window!=='undefined')window.canAccessLaporanTab=canAccessLaporanTab;
function renderSidebar(){
  const secs={};
  MODULES.forEach(m=>{
    if(m.sec==='Saya')return;
    if(!canAccessModule(m.id))return;
    if(!secs[m.sec])secs[m.sec]=[];
    secs[m.sec].push(m);
  });
  let h='';Object.entries(secs).forEach(([sec,mods])=>{h+='<div class="nsec">'+escapeHtml(sec)+'</div>';mods.forEach(m=>{var ic=typeof sigajiNavIcon==='function'?sigajiNavIcon(m.id):m.icon;h+=`<div class="ni" data-pg="${m.id}" role="button" tabindex="0"><span class="nic">${ic}</span>${escapeHtml(m.lbl)}${m.id==='notifikasi'?'<span class="nbadge u-hidden" id="nc-badge">0</span>':''}</div>`;});});
  document.getElementById('nav-dynamic').innerHTML=h;
  document.getElementById('nav-bottom').innerHTML='';
  try{if(typeof sigajiUiPolishAfterRender==='function')sigajiUiPolishAfterRender();}catch(ePol){sigajiCatchWarn("js/modules/app-access.js",ePol);}
  try{if(typeof sigajiUiCabangAfterRender==='function')sigajiUiCabangAfterRender();}catch(eCb){sigajiCatchWarn("js/modules/app-access.js",eCb);}
  try{if(typeof sigajiRenderMobileBottomNav==='function')sigajiRenderMobileBottomNav();}catch(eMbn){sigajiCatchWarn("js/modules/app-access.js",eMbn);}
}
// ── USER MANAGEMENT ──────────────────────────────
var SIGAJI_BUILTIN_ROLES=['Admin','HRD','Karyawan','Absen'];
var SIGAJI_USER_ROLE_LABELS={
  Admin:'Admin — akses penuh',
  HRD:'HRD — penggajian & HR',
  Karyawan:'Karyawan — slip/cuti (web, browser HP, APK)',
  Absen:'Hanya APK Android — absen saja'
};
function sigajiEnsureBuiltinRoles(){
  if(typeof roles!=='object'||!roles)roles={};
  if(!roles.Admin)roles.Admin=typeof MODULES!=='undefined'?MODULES.map(function(m){return m.id;}):[];
  if(!roles.HRD)roles.HRD=['dashboard','notifikasi'];
  if(!roles.Karyawan)roles.Karyawan=['myslip','mycuti','notifikasi'];
  if(!roles.Absen)roles.Absen=[];
}
function sigajiUserRoleDisplay(role){
  if(role==='Absen')return 'APK Android (absen saja)';
  return role||'';
}
function sigajiBuildUserRoleOptions(selectedRole){
  sigajiEnsureBuiltinRoles();
  var pick=selectedRole==='Absen'?'Karyawan':(selectedRole||'HRD');
  var seen={};
  var order=['Admin','HRD','Karyawan'];
  var html='';
  order.forEach(function(r){
    if(!roles[r])return;
    seen[r]=1;
    var lbl=SIGAJI_USER_ROLE_LABELS[r]||r;
    html+='<option value="'+escapeAttr(r)+'">'+escapeHtml(lbl)+'</option>';
  });
  Object.keys(roles).sort().forEach(function(r){
    if(seen[r]||r==='Absen')return;
    html+='<option value="'+escapeAttr(r)+'">'+escapeHtml(r)+' (role kustom)</option>';
  });
  return {html:html,value:roles[pick]?pick:(order.find(function(r){return roles[r];})||'HRD')};
}
function sigajiSyncUserApkOnlyUi(){
  var rs=document.getElementById('u-role');
  var wrap=document.getElementById('u-apk-only-wrap');
  var cb=document.getElementById('u-apk-only');
  var hint=document.getElementById('u-nik-req-hint');
  if(!rs||!wrap||!cb)return;
  var role=rs.value;
  var staff=role==='Admin'||role==='HRD';
  var cabWrap=document.getElementById('u-cabang-wrap');
  if(cabWrap)cabWrap.style.display=role==='HRD'&&sigajiUserCabangOptions().length?'':'none';
  wrap.style.display=staff?'none':'';
  if(staff)cb.checked=false;
  if(hint)hint.textContent=cb.checked&&!staff?'(wajib untuk APK)':'(wajib untuk APK; opsional untuk Karyawan biasa)';
}
/** Cabang untuk HRD (multi-cabang aktif). HRD bercabang hanya melihat & mengubah karyawan cabang itu (RLS v12). */
function sigajiUserCabangOptions(){
  if(typeof sigajiGetCabangList!=='function')return [];
  var list=sigajiGetCabangList()||[];
  return list.length>1?list:[];
}
function sigajiFillUserCabangSelect(selected){
  var sel=document.getElementById('u-cabang');
  if(!sel)return;
  var html='<option value="">Kantor pusat — semua cabang</option>'+sigajiUserCabangOptions().map(function(c){
    return '<option value="'+escapeAttr(c.id)+'">'+escapeHtml((c.kode?c.kode+' — ':'')+(c.nama||c.id))+'</option>';
  }).join('');
  sel.innerHTML=html;
  sel.value=selected||'';
}
function sigajiBindUserApkOnlyUi(){
  var rs=document.getElementById('u-role');
  var cb=document.getElementById('u-apk-only');
  if(!rs||rs.dataset.sigajiApkUiBound==='1')return;
  rs.dataset.sigajiApkUiBound='1';
  rs.addEventListener('change',sigajiSyncUserApkOnlyUi);
  if(cb)cb.addEventListener('change',sigajiSyncUserApkOnlyUi);
}
function renderUsers(){
  if(typeof sigajiWithSkeleton==='function'){
    return sigajiWithSkeleton('tb-users',7,renderUsersBody);
  }
  renderUsersBody();
}
function renderUsersBody(){
  const tb=document.getElementById('tb-users');if(!tb)return;
  tb.innerHTML=users.map((u,i)=>`<tr><td><strong>${escapeHtml(u.username)}</strong></td><td class="font-11" style="max-width:140px; word-break:break-all">${u.email?escapeHtml(u.email):'&#8212;'}</td><td>${escapeHtml(u.nama)}</td><td><span class="bdg ${u.role==='Admin'?'b-err':u.role==='HRD'?'b-warn':u.role==='Absen'?'b-info':u.role==='Karyawan'?'b-ok':'b-gray'}">${escapeHtml(sigajiUserRoleDisplay(u.role))}</span></td><td>${u.nik?`<span class="bdg b-info">${escapeHtml(u.nik)}</span>`:'&#8212;'}</td><td><span class="bdg ${u.aktif!==false?'b-ok':'b-gray'}">${u.aktif!==false?'Aktif':'Nonaktif'}</span></td><td><div class="fl gap1"><button class="btn btn-sm btn-out"${sigajiDataAction('user-edit',{idx:i})}>Edit</button>${u.username!=='admin'?`<button class="btn btn-sm btn-r"${sigajiDataAction('user-delete',{idx:i})}>Hapus</button>`:''}</div></td></tr>`).join('');
}
function openUserModal(idx=-1){
  var cloud=typeof sigajiIsCloudConfigured==='function'&&sigajiIsCloudConfigured();
  var pwWrap=document.getElementById('u-password-wrap');
  if(pwWrap)pwWrap.style.display=cloud?'none':'';
  document.getElementById('u-idx').value=idx;
  const u=idx>=0?users[idx]:{username:'',password:'',nama:'',role:'HRD',nik:null,aktif:true,email:''};
  document.getElementById('m-user-tit').textContent=idx>=0?'Edit User':'Tambah User';
  document.getElementById('u-username').value=u.username||'';
  document.getElementById('u-email').value=u.email||'';
  document.getElementById('u-password').value=cloud?'':(u.password||'');
  document.getElementById('u-nama').value=u.nama||'';
  document.getElementById('u-aktif').checked=u.aktif!==false;
  sigajiEnsureBuiltinRoles();
  const rs=document.getElementById('u-role');
  var ro=sigajiBuildUserRoleOptions(u.role||'HRD');
  var html=ro.html;
  rs.innerHTML=html;
  rs.value=ro.value;
  var apkCb=document.getElementById('u-apk-only');
  if(apkCb)apkCb.checked=u.role==='Absen';
  sigajiFillUserCabangSelect(u.cabangId||'');
  sigajiBindUserApkOnlyUi();
  sigajiSyncUserApkOnlyUi();
  const ns=document.getElementById('u-nik');var h=typeof sigajiKarOptionsHtml==='function'?sigajiKarOptionsHtml(sortKaryawanByNik(karyawan||[]),'-- Tidak tertaut --'):'<option value="">-- Tidak tertaut --</option>'+sortKaryawanByNik(karyawan||[]).map(function(k){return '<option value="'+escapeAttr(k.nik)+'">'+escapeHtml(k.nik)+' &#8212; '+escapeHtml(k.nama)+'</option>';}).join('');ns.innerHTML=h;ns.value=u.nik||'';
  openModal('m-user');
}
function simpanUser(){
  const idx=parseInt(document.getElementById('u-idx').value);
  const uname=document.getElementById('u-username').value.trim().toLowerCase();
  const emailRaw=document.getElementById('u-email').value.trim().toLowerCase();
  const passRaw=document.getElementById('u-password').value;
  const nama=document.getElementById('u-nama').value.trim();
  var role=document.getElementById('u-role').value;
  const nik=document.getElementById('u-nik').value||null;
  const apkOnly=!!(document.getElementById('u-apk-only')&&document.getElementById('u-apk-only').checked);
  const aktif=document.getElementById('u-aktif').checked;
  var cabSel=document.getElementById('u-cabang');
  const cabangId=role==='HRD'&&cabSel?String(cabSel.value||'').trim():'';
  const cloud=typeof sigajiIsCloudConfigured==='function'&&sigajiIsCloudConfigured();
  if(!uname||!nama){toast('Username dan nama lengkap wajib');return;}
  if(apkOnly&&role!=='Admin'&&role!=='HRD'){
    if(!nik){toast('Untuk login APK Android, wajib tautkan NIK karyawan');return;}
    role='Absen';
  }
  if(cloud){
    if(!emailRaw){toast('Mode cloud: isi Email Supabase untuk tiap user yang boleh login.');return;}
  }else if(!passRaw){toast('Password wajib untuk login lokal');return;}
  if(emailRaw){
    const clash=users.find(function(u,i){return i!==idx&&u.email&&String(u.email).toLowerCase()===emailRaw;});
    if(clash){toast('Email Supabase ini sudah dipakai user: '+clash.username);return;}
  }
  var pass=passRaw;
  /* Mode cloud: login lewat Supabase Auth — jangan simpan password di payload awan. */
  if(idx<0){
    if(users.find(u=>u.username===uname)){toast('Username sudah dipakai');return;}
    const o={username:uname,nama,role,nik,aktif};
    if(!cloud&&pass)o.password=pass;
    if(emailRaw)o.email=emailRaw;
    if(cabangId)o.cabangId=cabangId;
    users.push(o);
  }else{
    users[idx]={...users[idx],username:uname,nama,role,nik,aktif};
    if(cloud)delete users[idx].password;
    else if(pass)users[idx].password=pass;
    if(emailRaw)users[idx].email=emailRaw;else delete users[idx].email;
    if(cabangId)users[idx].cabangId=cabangId;else delete users[idx].cabangId;
  }
  saveAll();renderUsers();closeModal('m-user');toast('User disimpan');
  if(cloud&&typeof window.sigajiSyncUserRolesTable==='function'&&window.sigajiSupabase){
    window.sigajiSyncUserRolesTable(window.sigajiSupabase,users).then(function(res){
      if(res&&Array.isArray(res.unmatched)&&res.unmatched.indexOf(uname)!==-1){
        toast('Catatan: '+emailRaw+' belum punya akun login Supabase — undang / daftarkan dulu agar bisa masuk.');
      }
    });
  }
}
async function hapusUser(i){
  var u=users[i];
  if(!u)return;
  if(!(await sigajiConfirm({title:'Hapus user',message:'Apakah Anda yakin ingin menghapus user "'+(u.nama||u.username)+'" (@'+u.username+')?',danger:true,okText:'Ya, hapus'})))return;
  var email=(u.email?String(u.email).toLowerCase().trim():'');
  var cloud=typeof sigajiIsCloudConfigured==='function'&&sigajiIsCloudConfigured();
  if(cloud&&email){
    try{
      var t=await getCloudAccessToken();
      if(t){
        var r=await fetch(sigajiFunctionUrl('auth-delete-user'),{
          method:'POST',
          headers:{'content-type':'application/json','authorization':'Bearer '+t},
          body:JSON.stringify({email:email})
        });
        var j=await r.json().catch(()=>null);
        if(!r.ok||!j||!j.ok){
          if(!confirm('Gagal hapus akun Supabase: '+((j&&j.error)||'unknown')+'\nLanjut hapus dari SiGaji saja?'))return;
        }
      }else{
        if(!confirm('Token cloud tidak tersedia. Lanjut hapus dari SiGaji saja?'))return;
      }
    }catch(e){
      if(!confirm('Error saat hapus akun Supabase: '+(e.message||e)+'.\nLanjut hapus dari SiGaji saja?'))return;
    }
  }
  users.splice(i,1);
  saveAll();
  renderUsers();
  toast('User dihapus');
}
function renderPermMatrix(){
  const el=document.getElementById('perm-matrix-wrap');if(!el)return;
  const roleKeys=Object.keys(roles);
  let h=`<div class="perm-grid"><div class="perm-hdr"><div class="perm-hdr-cell text-left" style="min-width:200px; flex:2">Modul / Sub-tab</div>`;
  roleKeys.forEach(r=>h+=`<div class="perm-hdr-cell">${r}</div>`);h+=`</div>`;
  MODULES.forEach(m=>{
    if(m.adminOnly)return;
    const subs=SUBTABS[m.id];
    if(subs&&subs.length){
      h+=`<div class="perm-row perm-mod-head"><div class="perm-cell fw-700 flex-col items-start" style="min-width:200px; flex:2">${typeof sigajiNavIcon==='function'?sigajiNavIcon(m.id):m.icon} ${m.lbl}<span class="font-10 fw-600 text-muted mt-xs">Centang per sub-tab di bawah (atau semua sekaligus)</span></div>`;
      roleKeys.forEach(r=>{
        const isAdmin=r==='Admin';
        const allOn=isAdmin||subs.every(s=>(roles[r]||[]).includes(m.id+'.'+s));
        h+=`<div class="perm-cell"><input type="checkbox" ${allOn?'checked':''} ${isAdmin?'disabled':''} title="Aktifkan semua sub-tab modul ini"${sigajiDataAction('toggle-perm-mod',{role:r,mod:m.id})}></div>`;
      });
      h+=`</div>`;
      subs.forEach(sub=>{
        const key=m.id+'.'+sub;
        const lbl=SUBTAB_LBL[key]||sub;
        h+=`<div class="perm-row perm-sub"><div class="perm-cell font-12 text-body fw-500" style="min-width:200px; flex:2; padding-left:1.1rem">${lbl}</div>`;
        roleKeys.forEach(r=>{
          const isAdmin=r==='Admin';
          const chk=isAdmin||(roles[r]||[]).includes(key);
          h+=`<div class="perm-cell"><input type="checkbox" ${chk?'checked':''} ${isAdmin?'disabled':''}${sigajiDataAction('toggle-sub-perm',{role:r,mod:m.id,sub:sub})}></div>`;
        });
        h+=`</div>`;
      });
    }else{
      h+=`<div class="perm-row"><div class="perm-cell fw-600" style="min-width:200px; flex:2">${typeof sigajiNavIcon==='function'?sigajiNavIcon(m.id):m.icon} ${m.lbl}</div>`;
      roleKeys.forEach(r=>{const isAdmin=r==='Admin';const chk=isAdmin||(roles[r]||[]).includes(m.id);h+=`<div class="perm-cell"><input type="checkbox" ${chk?'checked':''} ${isAdmin?'disabled':''}${sigajiDataAction('toggle-perm',{role:r,mod:m.id})}></div>`;});
      h+=`</div>`;
    }
  });h+=`</div>`;el.innerHTML=h;
}
function togglePermModuleAll(role,moduleId,val){
  if(role==='Admin')return;
  if(!roles[role])roles[role]=[];
  const subs=SUBTABS[moduleId];
  if(!subs||!subs.length)return;
  if(val)subs.forEach(s=>{const k=moduleId+'.'+s;if(!roles[role].includes(k))roles[role].push(k);});
  else roles[role]=roles[role].filter(x=>!x.startsWith(moduleId+'.'));
  saveAll();renderPermMatrix();toast('Hak akses diperbarui');
}
function toggleSubPerm(role,moduleId,subId,val){
  if(role==='Admin')return;
  if(!roles[role])roles[role]=[];
  const key=moduleId+'.'+subId;
  if(val){if(!roles[role].includes(key))roles[role].push(key);}
  else roles[role]=roles[role].filter(x=>x!==key);
  saveAll();renderPermMatrix();toast('Hak akses diperbarui');
}
function togglePerm(role,moduleId,val){
  if(role==='Admin')return;if(!roles[role])roles[role]=[];
  if(val){if(!roles[role].includes(moduleId))roles[role].push(moduleId);}else{roles[role]=roles[role].filter(x=>x!==moduleId);}
  saveAll();renderPermMatrix();toast('Hak akses diperbarui');
}
function openRoleModal(){openModal('m-role');document.getElementById('r-nama').value='';}
function simpanRole(){const nama=document.getElementById('r-nama').value.trim();if(!nama){toast('Nama wajib');return;}if(SIGAJI_BUILTIN_ROLES.indexOf(nama)>=0){toast('Nama "'+nama+'" sudah dipakai sistem. Untuk karyawan absen APK: buat user dengan role Karyawan lalu centang "Hanya APK Android".');return;}if(roles[nama]){toast('Role sudah ada');return;}roles[nama]=[];saveAll();renderPermMatrix();closeModal('m-role');toast('Role "'+nama+'" ditambahkan');}
function switchUsrTab(el,tid){
  el.parentElement.querySelectorAll('.tab').forEach(t=>t.classList.remove('active'));
  el.classList.add('active');
  ['um-daftar','um-reg','um-roles'].forEach(function(id){
    var d=document.getElementById(id);
    if(d&&typeof sigajiSetPanelVisible==='function')sigajiSetPanelVisible(d,id===tid);
    else if(d)d.style.display=id===tid?'block':'none';
  });
  if(tid==='um-roles')renderPermMatrix();
  if(tid==='um-reg')loadRegRequests();
}

async function sigajiLoadRegRequestsViaSupabase(status){
  status=status||'pending';
  var n=0;
  while(!window.sigajiSupabase&&n<80){await new Promise(function(res){setTimeout(res,100);});n++;}
  if(!window.sigajiSupabase)throw new Error('Supabase belum siap');
  var tenant=(window.SIGAJI_TENANT_KEY&&String(window.SIGAJI_TENANT_KEY).trim())||'main';
  var sess=await window.sigajiSupabase.auth.getSession();
  if(!sess||!sess.data||!sess.data.session)throw new Error('Belum login awan');
  var q=await window.sigajiSupabase.from('sigaji_registration_requests')
    .select('id,email,nama,nik,status,created_at,decided_at,note')
    .eq('tenant_key',tenant).eq('status',status).order('created_at',{ascending:false}).limit(200);
  if(q.error)throw new Error(q.error.message);
  return{ok:true,items:q.data||[]};
}

async function loadRegRequests(){
  try{
    if(!CU||(CU.role!=='Admin'&&CU.role!=='HRD')){toast('Hanya Admin/HRD');return;}
    var t=await getCloudAccessToken();
    if(!t){toast('Belum login awan');return;}
    var host=document.getElementById('reg-req-list');if(host)host.innerHTML='Memuat...';
    var j=null;
    var apiErr='';
    try{
      var r=await fetch(sigajiFunctionUrl('auth-registration-list')+'?status=pending',{headers:{'authorization':'Bearer '+t}});
      j=typeof sigajiParseFunctionJson==='function'?await sigajiParseFunctionJson(r):await r.json().catch(()=>null);
      if(r.ok&&j&&j.ok){/* ok */}else{apiErr=(j&&j.error)||('HTTP '+r.status);j=null;}
    }catch(e){apiErr=e.message||String(e);j=null;}
    if(!j){
      try{
        j=await sigajiLoadRegRequestsViaSupabase('pending');
      }catch(e2){
        var msg=apiErr||e2.message||'Gagal memuat';
        if(/policy|permission|row-level|42501/i.test(String(e2.message||'')))msg+=' — jalankan sql/supabase_sigaji_registration.sql (policy read)';
        toast(msg);
        if(host)host.innerHTML='';
        return;
      }
    }
    var items=j.items||[];
    if(!host)return;
    if(!items.length){host.innerHTML='<div class="font-12 text-muted" style="padding:.5rem">Tidak ada permintaan pending.</div>';return;}
    host.innerHTML='<table style="min-width:720px"><thead><tr><th>Email</th><th>Nama</th><th>NIK</th><th>Tanggal</th><th>Aksi</th></tr></thead><tbody>'
      +items.map(function(it){
        var em=String(it.email||'');
        var nm=String(it.nama||'');
        var nk=String(it.nik||'');
        var dt=String(it.created_at||'').slice(0,19).replace('T',' ');
        return '<tr>'
          +'<td class="fw-800">'+em+'</td>'
          +'<td>'+escapeHtml(nm)+'</td>'
          +'<td>'+escapeHtml(nk)+'</td>'
          +'<td class="u-muted-11">'+escapeHtml(dt)+'</td>'
          +'<td><div class="fl gap1">'
            +'<button class="btn btn-sm btn-g"'+sigajiDataAction('reg-decide',{id:it.id,decision:'approve'})+'>Approve</button>'
            +'<button class="btn btn-sm btn-r"'+sigajiDataAction('reg-decide',{id:it.id,decision:'reject'})+'>Reject</button>'
          +'</div></td>'
        +'</tr>';
      }).join('')
      +'</tbody></table>';
  }catch(e){
    console.error('loadRegRequests',e);
    toast('Gagal memuat permintaan');
  }
}

async function decideRegReq(id,action){
  try{
    if(!id)return;
    if(action==='reject'&&!confirm('Tolak permintaan ini?'))return;
    if(action==='approve'&&!confirm('Setujui dan kirim undangan email reset password?'))return;
    var t=await getCloudAccessToken();
    if(!t){toast('Belum login awan');return;}
    toast(action==='approve'?'Menyetujui...':'Menolak...');
    var r=await fetch(sigajiFunctionUrl('auth-registration-decide'),{
      method:'POST',
      headers:{'content-type':'application/json','authorization':'Bearer '+t},
      body:JSON.stringify({id:id,action:action})
    });
    var j=typeof sigajiParseFunctionJson==='function'?await sigajiParseFunctionJson(r):await r.json().catch(()=>null);
    if(!r.ok||!j||!j.ok){
      var err=(j&&j.error)||'Gagal memproses';
      if(/Missing env|SERVICE_ROLE|Forbidden/i.test(err))err+=' — cek env SIGAJI_SUPABASE_SERVICE_ROLE_KEY di Cloudflare Pages';
      toast(err);
      return;
    }
    toast(action==='approve'?'Approved. Email undangan dikirim (atau user sudah ada).':'Rejected.');
    loadRegRequests();
  }catch(e){
    console.error('decideRegReq',e);
    toast('Gagal memproses');
  }
}
