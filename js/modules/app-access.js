/* SiGaji — hak akses, user, branding, login */
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
}
// ── USER MANAGEMENT ──────────────────────────────
function renderUsers(){
  if(typeof sigajiWithSkeleton==='function'){
    return sigajiWithSkeleton('tb-users',7,renderUsersBody);
  }
  renderUsersBody();
}
function renderUsersBody(){
  const tb=document.getElementById('tb-users');if(!tb)return;
  tb.innerHTML=users.map((u,i)=>`<tr><td><strong>${escapeHtml(u.username)}</strong></td><td class="font-11" style="max-width:140px; word-break:break-all">${u.email?escapeHtml(u.email):'&#8212;'}</td><td>${escapeHtml(u.nama)}</td><td><span class="bdg ${u.role==='Admin'?'b-err':u.role==='HRD'?'b-warn':'b-ok'}">${escapeHtml(u.role)}</span></td><td>${u.nik?`<span class="bdg b-info">${escapeHtml(u.nik)}</span>`:'&#8212;'}</td><td><span class="bdg ${u.aktif!==false?'b-ok':'b-gray'}">${u.aktif!==false?'Aktif':'Nonaktif'}</span></td><td><div class="fl gap1"><button class="btn btn-sm btn-out"${sigajiDataAction('user-edit',{idx:i})}>Edit</button>${u.username!=='admin'?`<button class="btn btn-sm btn-r"${sigajiDataAction('user-delete',{idx:i})}>Hapus</button>`:''}</div></td></tr>`).join('');
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
  const rs=document.getElementById('u-role');var html=Object.keys(roles).map(function(r){return '<option value="'+escapeAttr(r)+'">'+escapeHtml(r)+'</option>';}).join('');rs.innerHTML=html;rs.value=u.role||'HRD';
  const ns=document.getElementById('u-nik');var h=typeof sigajiKarOptionsHtml==='function'?sigajiKarOptionsHtml(sortKaryawanByNik(karyawan||[]),'-- Tidak tertaut --'):'<option value="">-- Tidak tertaut --</option>'+sortKaryawanByNik(karyawan||[]).map(function(k){return '<option value="'+escapeAttr(k.nik)+'">'+escapeHtml(k.nik)+' &#8212; '+escapeHtml(k.nama)+'</option>';}).join('');ns.innerHTML=h;ns.value=u.nik||'';
  openModal('m-user');
}
function simpanUser(){
  const idx=parseInt(document.getElementById('u-idx').value);
  const uname=document.getElementById('u-username').value.trim().toLowerCase();
  const emailRaw=document.getElementById('u-email').value.trim().toLowerCase();
  const passRaw=document.getElementById('u-password').value;
  const nama=document.getElementById('u-nama').value.trim();
  const role=document.getElementById('u-role').value;const nik=document.getElementById('u-nik').value||null;
  const aktif=document.getElementById('u-aktif').checked;
  const cloud=typeof sigajiIsCloudConfigured==='function'&&sigajiIsCloudConfigured();
  if(!uname||!nama){toast('Username dan nama lengkap wajib');return;}
  if(cloud){
    if(!emailRaw){toast('Mode cloud: isi Email Supabase untuk tiap user yang boleh login.');return;}
  }else if(!passRaw){toast('Password wajib untuk login lokal');return;}
  if(emailRaw){
    const clash=users.find(function(u,i){return i!==idx&&u.email&&String(u.email).toLowerCase()===emailRaw;});
    if(clash){toast('Email Supabase ini sudah dipakai user: '+clash.username);return;}
  }
  var pass=passRaw;
  if(cloud){
    if(idx>=0&&users[idx]){
      pass=passRaw||(users[idx].password||'')||'\u2014cloud\u2014';
    }else{
      pass=passRaw||'\u2014cloud\u2014';
    }
  }
  if(idx<0){
    if(users.find(u=>u.username===uname)){toast('Username sudah dipakai');return;}
    const o={username:uname,password:pass,nama,role,nik,aktif};
    if(emailRaw)o.email=emailRaw;
    users.push(o);
  }else{
    users[idx]={...users[idx],username:uname,password:pass,nama,role,nik,aktif};
    if(emailRaw)users[idx].email=emailRaw;else delete users[idx].email;
  }
  saveAll();renderUsers();closeModal('m-user');toast('User disimpan');
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
      h+=`<div class="perm-row perm-mod-head"><div class="perm-cell fw-700 flex-col items-start" style="min-width:200px; flex:2">${m.icon} ${m.lbl}<span class="font-10 fw-600 text-muted mt-xs">Centang per sub-tab di bawah (atau semua sekaligus)</span></div>`;
      roleKeys.forEach(r=>{
        const isAdmin=r==='Admin';
        const allOn=isAdmin||subs.every(s=>(roles[r]||[]).includes(m.id+'.'+s));
        h+=`<div class="perm-cell"><input type="checkbox" ${allOn?'checked':''} ${isAdmin?'disabled':''} title="Aktifkan semua sub-tab modul ini" onchange="togglePermModuleAll('${r}','${m.id}',this.checked)"></div>`;
      });
      h+=`</div>`;
      subs.forEach(sub=>{
        const key=m.id+'.'+sub;
        const lbl=SUBTAB_LBL[key]||sub;
        h+=`<div class="perm-row perm-sub"><div class="perm-cell font-12 text-body fw-500" style="min-width:200px; flex:2; padding-left:1.1rem">${lbl}</div>`;
        roleKeys.forEach(r=>{
          const isAdmin=r==='Admin';
          const chk=isAdmin||(roles[r]||[]).includes(key);
          h+=`<div class="perm-cell"><input type="checkbox" ${chk?'checked':''} ${isAdmin?'disabled':''} onchange="toggleSubPerm('${r}','${m.id}','${sub}',this.checked)"></div>`;
        });
        h+=`</div>`;
      });
    }else{
      h+=`<div class="perm-row"><div class="perm-cell fw-600" style="min-width:200px; flex:2">${m.icon} ${m.lbl}</div>`;
      roleKeys.forEach(r=>{const isAdmin=r==='Admin';const chk=isAdmin||(roles[r]||[]).includes(m.id);h+=`<div class="perm-cell"><input type="checkbox" ${chk?'checked':''} ${isAdmin?'disabled':''} onchange="togglePerm('${r}','${m.id}',this.checked)"></div>`;});
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
function simpanRole(){const nama=document.getElementById('r-nama').value.trim();if(!nama){toast('Nama wajib');return;}if(roles[nama]){toast('Role sudah ada');return;}roles[nama]=[];saveAll();renderPermMatrix();closeModal('m-role');toast('Role "'+nama+'" ditambahkan');}
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
// ── BRANDING ────────────────────────────────────
function applyBranding(){
  var appEl=document.getElementById('app');
  var onLoginPage=!appEl||appEl.style.display==='none'||appEl.style.display==='';
  var cloudB=window.sigajiLoginBranding;
  var loginSrc=onLoginPage&&cloudB&&(cloudB.nama||cloudB.logo)?cloudB:perusahaan;
  var topSrc=String(perusahaan.nama||'').trim()||perusahaan.logo?perusahaan:cloudB||perusahaan;
  const logo=loginSrc.logo||'';
  const namaPt=String(loginSrc.nama||'').trim();
  const topLogoVal=topSrc.logo||'';
  const topNama=String(topSrc.nama||'').trim();
  const loginLogo=document.getElementById('login-logo');
  if(loginLogo){
    if(logo){loginLogo.src=logo;loginLogo.style.display='block';loginLogo.alt=namaPt||'Logo perusahaan';}
    else{loginLogo.removeAttribute('src');loginLogo.style.display='none';}
  }
  const topLogo=document.getElementById('topbar-logo');
  if(topLogo){if(topLogoVal){topLogo.src=topLogoVal;topLogo.style.display='block';}else{topLogo.removeAttribute('src');topLogo.style.display='none';}}
  const lt=document.getElementById('login-title');
  if(lt)lt.textContent='SiGaji';
  const lpt=document.getElementById('login-pt-nama');
  if(lpt){
    if(namaPt){lpt.textContent=namaPt;lpt.style.display='block';}
    else{lpt.textContent='';lpt.style.display='none';}
  }
  const tn=document.getElementById('topbar-nama');
  if(tn){
    tn.textContent=topNama||'SiGaji';
    tn.style.display=topLogoVal&&!topNama?'none':'inline';
  }
  const lp=document.getElementById('logo-preview');
  if(lp){if(logo){lp.src=logo;lp.style.display='block';}else lp.style.display='none';}
}
// ── LOGIN ────────────────────────────────────────
function sigajiIsCloudOnlyMode(){
  return window.SIGAJI_CLOUD_ONLY_MODE!==false;
}
function sigajiIsCloudConfigured(){
  return !!(window.SIGAJI_SUPABASE_URL||'').trim() && !!(window.SIGAJI_SUPABASE_ANON_KEY||'').trim();
}
/** UI login: selalu email Supabase (mode online saja). */
function sigajiApplyCloudLoginUi(){
  if(!sigajiIsCloudOnlyMode()&&!sigajiIsCloudConfigured())return;
  window.sigajiCloudOnlyMode=true;
  var lu=document.getElementById('lu');
  var lp=document.getElementById('lp');
  if(lu){lu.removeAttribute('value');lu.placeholder='nama@perusahaan.com';lu.type='email';lu.autocomplete='username';}
  if(lp){lp.removeAttribute('value');lp.type='password';lp.placeholder='';lp.autocomplete='current-password';}
  var l1=document.getElementById('lu-lbl');if(l1)l1.textContent='Email';
  var l2=document.getElementById('lp-lbl');if(l2)l2.textContent='Kata sandi';
  var remLbl=document.getElementById('remember-username-lbl');
  if(remLbl)remLbl.textContent='Ingat email';
  var h=document.getElementById('cloud-login-hint');
  if(h){
    if(!sigajiIsCloudConfigured()){
      h.style.display='block';
      h.innerHTML='<strong>Mode online.</strong> Server belum dikonfigurasi: isi <code>SIGAJI_SUPABASE_URL</code> dan <code>SIGAJI_SUPABASE_ANON_KEY</code> di Cloudflare Pages (Environment variables), lalu deploy ulang. Login <code>admin</code>/<code>hrd</code> lokal tidak dipakai lagi.';
    }else{
      h.style.display='none';
      h.innerHTML='';
    }
  }
  var fp=document.getElementById('forgot-pw-wrap');
  if(fp)fp.style.display=sigajiIsCloudConfigured()?'block':'none';
  var fileHint=document.getElementById('file-protocol-hint');
  if(fileHint)fileHint.style.display='none';
  try{if(typeof initRememberUsername==='function')initRememberUsername();}catch(e){sigajiCatchWarn("js/modules/app-access.js",e);}
}

function doForgotPassword(){
  if(typeof window.sigajiForgotPassword!=='function'){
    toast('Fitur ini hanya tersedia saat terhubung ke Supabase.');
    return;
  }
  try{
    var inp=document.getElementById('forgot-email');
    var lu=document.getElementById('lu');
    if(inp){
      inp.value=(lu&&lu.value?String(lu.value).trim():'');
      setTimeout(function(){try{inp.focus();}catch(e){sigajiCatchWarn("js/modules/app-access.js",e);}},0);
    }
    openModal('m-forgot');
  }catch(e){
    toast('Gagal membuka form lupa password.');
  }
}

function submitForgotPassword(){
  var email=(document.getElementById('forgot-email')&&document.getElementById('forgot-email').value||'').trim();
  if(!email||email.indexOf('@')<0){
    toast('Isi email yang valid.');
    return;
  }
  if(typeof window.sigajiForgotPassword!=='function'){
    toast('Koneksi awan tidak tersedia.');
    return;
  }
  window.sigajiForgotPassword(email);
  closeModal('m-forgot');
}

function openRegisterModal(){
  try{
    if(!sigajiIsCloudConfigured()){
      toast('Supabase belum dikonfigurasi di server.');
      return;
    }
    var lu=document.getElementById('lu');
    var em=(lu&&lu.value?String(lu.value).trim():'');
    var e=document.getElementById('reg-email');if(e)e.value=em;
    var n=document.getElementById('reg-nama');if(n)n.value='';
    var k=document.getElementById('reg-nik');if(k)k.value='';
    openModal('m-register');
    setTimeout(function(){try{if(e)e.focus();}catch(x){sigajiCatchWarn("js/modules/app-access.js",x);}},0);
  }catch(e){
    toast('Gagal membuka form register.');
  }
}

async function submitRegisterRequest(){
  try{
    var email=(document.getElementById('reg-email')&&document.getElementById('reg-email').value||'').trim();
    var nama=(document.getElementById('reg-nama')&&document.getElementById('reg-nama').value||'').trim();
    var nik=(document.getElementById('reg-nik')&&document.getElementById('reg-nik').value||'').trim();
    if(!email||email.indexOf('@')<0){toast('Email tidak valid.');return;}
    toast('Mengirim permintaan...');
    var regApi='/api/auth-register-request';
    regApi='/api/auth-register-request';
    const r=await fetch(regApi,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({email,nama,nik})});
    const j=typeof sigajiParseFunctionJson==='function'?await sigajiParseFunctionJson(r):await r.json().catch(()=>null);
    if(!r.ok||!j||!j.ok){toast((j&&j.error)||'Gagal mengirim permintaan');return;}
    closeModal('m-register');
    toast('Permintaan dikirim. Tunggu persetujuan Admin/HRD.');
  }catch(e){
    console.error('submitRegisterRequest',e);
    toast('Gagal mengirim permintaan');
  }
}

function doUpdatePassword(){
  var np=(document.getElementById('pw-reset-new').value||'');
  var nc=(document.getElementById('pw-reset-confirm').value||'');
  if(!np||np.length<6){toast('Password minimal 6 karakter.');return;}
  if(np!==nc){toast('Konfirmasi password tidak cocok.');return;}
  if(typeof window.sigajiUpdatePassword!=='function'){
    toast('Koneksi awan tidak tersedia.');
    return;
  }
  window.sigajiUpdatePassword(np).then(function(r){
    if(r.error){
      toast('Gagal: '+(r.error.message||String(r.error)));
    }else{
      closeModal('m-pw-reset');
      toast('Password berhasil diperbarui. Silakan login dengan password baru.');
      if(window.sigajiSupabase)window.sigajiSupabase.auth.signOut();
    }
  });
}
/** Akun Admin utama (username admin) — password ini yang wajib untuk reset data. */
function getPrimaryAdminUser(){
  if(!users||!users.length)return null;
  var u=users.find(function(x){
    return x.username==='admin'&&x.role==='Admin'&&x.aktif!==false;
  });
  if(u)return u;
  return users.find(function(x){return x.role==='Admin'&&x.aktif!==false;})||null;
}
/** Verifikasi password akun Admin (bukan user yang sedang login). */
async function verifyAdminPasswordForReset(pw){
  if(!CU||CU.role!=='Admin'||!pw)return false;
  var adminRec=getPrimaryAdminUser();
  if(!adminRec)return false;
  var cloudOn=typeof sigajiIsCloudConfigured==='function'&&sigajiIsCloudConfigured();
  if((sigajiIsCloudOnlyMode()||cloudOn)&&window.sigajiSupabase&&window.sigajiSupabase.auth){
    var email=(adminRec.email||'').trim();
    if(!email||email.indexOf('@')<0)return false;
    try{
      var prevSess=await window.sigajiSupabase.auth.getSession();
      var prev=prevSess&&prevSess.data&&prevSess.data.session;
      var r=await window.sigajiSupabase.auth.signInWithPassword({email:email,password:pw});
      if(r.error)return false;
      var curEmail=(CU.email||'').trim().toLowerCase();
      if(prev&&curEmail&&curEmail!==email.toLowerCase()){
        await window.sigajiSupabase.auth.setSession({
          access_token:prev.access_token,
          refresh_token:prev.refresh_token,
        });
      }
      return true;
    }catch(e){return false;}
  }
  if(sigajiIsCloudOnlyMode())return false;
  return adminRec.password===pw;
}
if(typeof window!=='undefined'){
  window.sigajiApplyCloudLoginUi=sigajiApplyCloudLoginUi;
  window.sigajiIsCloudConfigured=sigajiIsCloudConfigured;
  window.sigajiIsCloudOnlyMode=sigajiIsCloudOnlyMode;
  window.sigajiEmailSmtpPing=sigajiEmailSmtpPing;
  window.getPrimaryAdminUser=getPrimaryAdminUser;
  window.verifyAdminPasswordForReset=verifyAdminPasswordForReset;
}

async function getCloudAccessToken(){
  try{
    if(!window.sigajiSupabase||!window.sigajiSupabase.auth)return'';
    const sess=await window.sigajiSupabase.auth.getSession();
    return (sess&&sess.data&&sess.data.session&&sess.data.session.access_token)||'';
  }catch(e){return'';}
}

/** Buat kode link Telegram untuk NIK (HRD/Admin). */
async function telegramCreateLinkCode(nik){
  const t=await getCloudAccessToken();
  if(!t){toast('Belum login awan / sesi tidak ada');return null;}
  var res=typeof sigajiFetchJson==='function'?await sigajiFetchJson(sigajiFunctionUrl('telegram-create-link'),{method:'POST',headers:{'content-type':'application/json','authorization':'Bearer '+t},body:JSON.stringify({nik,ttlMin:30})}):null;
  if(!res||!res.ok){if(typeof sigajiApiToast==='function')sigajiApiToast(res);else toast((res&&res.error)||'Gagal buat kode Telegram');return null;}
  return res.data;
}

/** Kirim slip PDF (base64) ke Telegram untuk NIK (HRD/Admin). */
async function telegramSendSlipPdf(nik,filename,caption,pdfBase64){
  const t=await getCloudAccessToken();
  if(!t){toast('Belum login awan / sesi tidak ada');return false;}
  var res=typeof sigajiFetchJson==='function'?await sigajiFetchJson(sigajiFunctionUrl('telegram-send-slip'),{method:'POST',headers:{'content-type':'application/json','authorization':'Bearer '+t},body:JSON.stringify({nik,filename,caption,pdfBase64})}):null;
  if(!res||!res.ok){if(typeof sigajiApiToast==='function')sigajiApiToast(res);else toast((res&&res.error)||'Gagal kirim slip Telegram');return false;}
  return true;
}

function arrayBufferToBase64(buf){
  try{
    var bytes=new Uint8Array(buf);
    var chunk=0x8000;
    var bin='';
    for(var i=0;i<bytes.length;i+=chunk){
      bin+=String.fromCharCode.apply(null,bytes.subarray(i,i+chunk));
    }
    return btoa(bin);
  }catch(e){
    return '';
  }
}

function jsPdfToBase64(doc){
  try{
    var ab=doc.output('arraybuffer');
    return arrayBufferToBase64(ab);
  }catch(e){
    return '';
  }
}

/** Setelah slip gaji terkirim: kirim slip THR terpisah jika periode punya THR & karyawan eligible (jeda singkat antar dokumen). */
async function trySendThrTelegramAfterGaji(k,p){
  if(!p||!p.thr_aktif||!k)return false;
  try{
    var th=hitungTHRBruto(k,p.nama);
    if(!th||!th.eligible)return false;
    var oThr=buildTHRSlipPDF(k,p);
    var pdfThr=jsPdfToBase64(oThr.doc);
    if(!pdfThr)return false;
    await new Promise(function(r){setTimeout(r,450);});
    var capThr='Slip THR '+(p.nama||'')+' — '+(k.nama||k.nik);
    var okT=await telegramSendSlipPdf(k.nik,oThr.fileName||('SlipTHR_'+k.nik+'.pdf'),capThr,pdfThr);
    if(okT){
      await recordSlipTelegramSentToCloud(k.nik,p.nama,'thr');
      return true;
    }
  }catch(e){console.warn('trySendThrTelegramAfterGaji',e);}
  return false;
}

async function sendCurrentSlipToTelegram(){
  try{
    if(!CU||(CU.role!=='Admin'&&CU.role!=='HRD')){toast('Hanya Admin/HRD');return;}
    const nik=document.getElementById('slip-kar')&&document.getElementById('slip-kar').value;
    const k=nik?karyawan.find(function(x){return x.nik===nik;}):null;
    if(!k){toast('Pilih karyawan');return;}
    const pid=document.getElementById('slip-per')&&document.getElementById('slip-per').value;
    const p=periodesFindById(pid)||PA();
    const type=(document.getElementById('slip-type')&&document.getElementById('slip-type').value)||'gaji';

    var o=null;
    if(type==='thr'&&p.thr_aktif)o=buildTHRSlipPDF(k,p);
    else o=buildGajiSlipPDF(k,p.nama,p.bayar);
    if(!o||!o.doc){toast('Gagal menyiapkan PDF');return;}

    var pdfBase64=jsPdfToBase64(o.doc);
    if(!pdfBase64){toast('Gagal encode PDF');return;}

    var caption=(type==='thr'?'Slip THR ':'Slip Gaji ')+(p.nama||'')+' — '+(k.nama||k.nik);
    toast('Mengirim ke Telegram...');
    var ok=await telegramSendSlipPdf(k.nik,o.fileName||('Slip_'+k.nik+'.pdf'),caption,pdfBase64);
    if(ok){
      await recordSlipTelegramSentToCloud(k.nik,p.nama,type==='thr'&&p.thr_aktif?'thr':'gaji');
      var alsoThr=false;
      if(type!=='thr'&&p.thr_aktif){
        toast('Mengirim slip THR...');
        alsoThr=await trySendThrTelegramAfterGaji(k,p);
      }
      slipSendInvalidateMetaCache();
      renderSlipSendBatchChecklist(true);
      toast(alsoThr?'Terkirim: slip gaji + slip THR':'Terkirim ke Telegram');
    }
  }catch(e){
    console.error('sendCurrentSlipToTelegram',e);
    toast(e.message||'Gagal kirim Telegram');
  }
}

/** Tenant key konsisten dengan Netlify SIGAJI_TENANT_KEY / cloud-sync.js */
function getSlipTenantKey(){
  return (window.SIGAJI_TENANT_KEY && String(window.SIGAJI_TENANT_KEY).trim()) || 'main';
}
function fmtSlipTgSentAt(iso){
  try{
    return new Date(iso).toLocaleString('id-ID', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  }catch(e){
    return String(iso || '');
  }
}
var __slipTgMetaCacheKey = '';
var __slipTgMetaBundle = null;
var __slipEmailMetaCacheKey = '';
var __slipEmailMetaBundle = null;
var __slipSendMetaCacheKey = '';
var __slipSendMetaBundle = null;
function slipSendInvalidateMetaCache(){
  __slipTgMetaCacheKey = '';
  __slipTgMetaBundle = null;
  __slipEmailMetaCacheKey = '';
  __slipEmailMetaBundle = null;
  __slipSendMetaCacheKey = '';
  __slipSendMetaBundle = null;
}
function slipTgInvalidateMetaCache(){ slipSendInvalidateMetaCache(); }
function slipEmailInvalidateMetaCache(){ slipSendInvalidateMetaCache(); }
async function loadSlipTelegramMetaBundle(p){
  var linked = new Set();
  var sentMap = {};
  var out = { linked: linked, sentMap: sentMap, sentTableMissing: false, linksError: false };
  if (!window.sigajiSupabase || typeof sigajiIsCloudConfigured !== 'function' || !sigajiIsCloudConfigured()) return out;
  var tk = getSlipTenantKey();
  var sb = window.sigajiSupabase;
  var lr = await sb.from('sigaji_telegram_links').select('nik').eq('tenant_key', tk);
  if (lr.error) {
    out.linksError = true;
    if (!/42703|relation|does not exist/i.test(String(lr.error.message || ''))) console.warn('sigaji_telegram_links', lr.error);
  } else if (lr.data) {
    lr.data.forEach(function (r) {
      if (r.nik) linked.add(String(r.nik).trim());
    });
  }
  var sr = await sb.from('sigaji_slip_tg_sent').select('nik,slip_type,sent_at').eq('tenant_key', tk).eq('period_nama', p.nama);
  if (sr.error) {
    var blob = String(sr.error.message || '') + String(sr.error.code || '');
    if (/42703|does not exist|relation|sigaji_slip_tg_sent|42P01/i.test(blob)) out.sentTableMissing = true;
    else console.warn('sigaji_slip_tg_sent', sr.error);
  } else if (sr.data) {
    sr.data.forEach(function (r) {
      if (!r.nik) return;
      var nk = String(r.nik).trim();
      if (!sentMap[nk]) sentMap[nk] = {};
      if (r.slip_type === 'gaji') sentMap[nk].gaji = r.sent_at;
      if (r.slip_type === 'thr') sentMap[nk].thr = r.sent_at;
    });
  }
  return out;
}
async function loadSlipSendMetaBundle(p){
  var tg = await loadSlipTelegramMetaBundle(p);
  var em = await loadSlipEmailMetaBundle(p);
  return { tg: tg, email: em };
}

function renderSlipSendBatchTableRows(list, p, slipType, bundle){
  var wrap = document.getElementById('slip-send-batch-wrap');
  if (!wrap) return;
  var isThr = slipType === 'thr' && p.thr_aktif;
  var tgB = bundle.tg || {};
  var emB = bundle.email || {};
  var foot = '';
  if (tgB.sentTableMissing)
    foot +=
      '<div>Riwayat Telegram: jalankan <code>sql/supabase_sigaji_slip_tg_sent.sql</code> di Supabase.</div>';
  if (emB.sentTableMissing)
    foot +=
      '<div class="font-10 ct-danger mt-sm">Riwayat email: jalankan <code>sql/supabase_sigaji_slip_email_sent.sql</code> di Supabase.</div>';
  if (tgB.linksError) foot += '<div class="font-10 ct-danger mt-sm">Gagal membaca tautan Telegram (cek login &amp; RLS).</div>';
  var rows = list
    .map(function (k) {
      var nikEsc = escapeAttr(k.nik || '');
      var nk = String(k.nik || '').trim();
      var L = tgB.linked && tgB.linked.has(nk);
      var tgSm = (tgB.sentMap && tgB.sentMap[nk]) || {};
      var emSm = (emB.sentMap && emB.sentMap[nk]) || {};
      var tgSentIso = isThr ? tgSm.thr : tgSm.gaji;
      var emSentRec = isThr ? emSm.thr : emSm.gaji;
      var hasEm = slipEmailHasValidAddress(k);
      var tgCell = L
        ? '<span class="bdg b-ok font-10">Terhubung</span>'
        : '<span class="bdg b-gray font-10">Belum</span>';
      var emCell = hasEm
        ? '<span class="bdg b-ok font-10" title="' + escapeHtml(String(k.email).trim()) + '">Ada</span>'
        : '<span class="bdg b-err font-10">Kosong</span>';
      var tgSl = tgSentIso
        ? '<span class="bdg b-ok font-10">Ya</span><div class="font-9 text-muted">' + escapeHtml(fmtSlipTgSentAt(tgSentIso)) + '</div>'
        : '<span class="bdg b-gray font-10">Belum</span>';
      var emSl = emSentRec
        ? '<span class="bdg b-ok font-10">Ya</span><div class="font-9 text-muted">' + escapeHtml(fmtSlipTgSentAt(emSentRec.at)) + '</div>'
        : '<span class="bdg b-gray font-10">Belum</span>';
      return (
        '<tr><td class="text-center" style="width:40px"><input type="checkbox" class="slip-send-cb" data-nik="' +
        nikEsc +
        '"></td><td class="font-11 fw-600" style="white-space:nowrap">' +
        escapeHtml(k.nik) +
        '</td><td>' +
        escapeHtml(k.nama) +
        '</td><td style="white-space:nowrap">' +
        tgCell +
        '</td><td>' +
        emCell +
        '</td><td style="min-width:88px">' +
        tgSl +
        '</td><td style="min-width:88px">' +
        emSl +
        '</td></tr>'
      );
    })
    .join('');
  var html =
    '<div class="rounded-sm" style="overflow-x:auto; max-height:300px; overflow-y:auto; border:1px solid var(--bd)"><table class="w-full font-12"><thead><tr><th style="width:40px"><input type="checkbox" id="slip-send-cb-all" title="Pilih semua" onchange="slipSendToggleAll(this.checked)"></th><th>Kode</th><th>Nama</th><th>Telegram</th><th>Email</th><th>Slip TG</th><th>Slip email</th></tr></thead><tbody>' +
    rows +
    '</tbody></table></div>' +
    foot;
  wrap.innerHTML = html;
}

/** Satu tabel centang — kirim Telegram atau email. forceReload = ambil ulang status dari Supabase. */
function renderSlipSendBatchChecklist(forceReload){
  var wrap = document.getElementById('slip-send-batch-wrap');
  var card = document.getElementById('slip-send-batch');
  var hint = document.getElementById('slip-tg-hint');
  if (hint) {
    var showHint =
      CU && (CU.role === 'Admin' || CU.role === 'HRD') && typeof sigajiIsCloudConfigured === 'function' && sigajiIsCloudConfigured();
    if (typeof sigajiSetPanelVisible === 'function') sigajiSetPanelVisible(hint, showHint);
    else hint.style.display = showHint ? 'block' : 'none';
  }
  if (!wrap || !card) return;
  if (!CU || (CU.role !== 'Admin' && CU.role !== 'HRD')) {
    if (typeof sigajiSetPanelVisible === 'function') sigajiSetPanelVisible(card, false);
    else card.style.display = 'none';
    return;
  }
  var pid = document.getElementById('slip-per') && document.getElementById('slip-per').value;
  var p = periodesFindById(pid) || PA();
  if (!p) {
    if (typeof sigajiSetPanelVisible === 'function') sigajiSetPanelVisible(card, false);
    else card.style.display = 'none';
    return;
  }
  var slipType = (document.getElementById('slip-type') && document.getElementById('slip-type').value) || 'gaji';
  var list = karyawanListPeriode(p);
  if (!list.length) {
    wrap.innerHTML = '<div class="u-muted-12">Tidak ada karyawan aktif di periode ini.</div>';
    if (typeof sigajiSetPanelVisible === 'function') sigajiSetPanelVisible(card, true);
    else card.style.display = 'block';
    return;
  }
  if (typeof sigajiSetPanelVisible === 'function') sigajiSetPanelVisible(card, true);
  else card.style.display = 'block';
  if (typeof sigajiIsCloudConfigured !== 'function' || !sigajiIsCloudConfigured()) {
    wrap.innerHTML =
      '<div class="u-muted-12">Fitur ini membutuhkan <strong>mode online</strong> (Supabase + deploy Netlify).</div>';
    return;
  }
  var cacheKey =
    getSlipTenantKey() + '|' + p.nama + '|' + slipType + '|' + list.map(function (k) { return k.nik; }).join(',');
  if (!forceReload && __slipSendMetaCacheKey === cacheKey && __slipSendMetaBundle) {
    renderSlipSendBatchTableRows(list, p, slipType, __slipSendMetaBundle);
    return;
  }
  wrap.innerHTML =
    '<div class="font-12 text-muted" style="padding:.75rem">Memuat status Telegram &amp; email…</div>';
  loadSlipSendMetaBundle(p).then(function (bundle) {
    __slipSendMetaCacheKey = cacheKey;
    __slipSendMetaBundle = bundle;
    __slipTgMetaCacheKey = cacheKey;
    __slipTgMetaBundle = bundle.tg;
    __slipEmailMetaCacheKey = cacheKey;
    __slipEmailMetaBundle = bundle.email;
    renderSlipSendBatchTableRows(list, p, slipType, bundle);
  });
}

function renderSlipTelegramBatchChecklist(forceReload){ renderSlipSendBatchChecklist(forceReload); }
function renderSlipEmailBatchChecklist(forceReload){ renderSlipSendBatchChecklist(forceReload); }

function slipSendToggleAll(checked){
  var v = !!checked;
  document.querySelectorAll('.slip-send-cb').forEach(function (el) {
    el.checked = v;
  });
  var h = document.getElementById('slip-send-cb-all');
  if (h) h.checked = v;
}
function slipTgToggleAll(checked){ slipSendToggleAll(checked); }
function slipEmailToggleAll(checked){ slipSendToggleAll(checked); }

async function recordSlipTelegramSentToCloud(nik, periodNama, slipTypeUi){
  try{
    if (!window.sigajiSupabase) return;
    var tk = getSlipTenantKey();
    var st = slipTypeUi === 'thr' ? 'thr' : 'gaji';
    await window.sigajiSupabase.from('sigaji_slip_tg_sent').upsert(
      {
        tenant_key: tk,
        nik: String(nik || '').trim(),
        period_nama: String(periodNama || '').trim(),
        slip_type: st,
        sent_at: new Date().toISOString(),
      },
      { onConflict: 'tenant_key,nik,period_nama,slip_type' }
    );
  }catch(e){
    console.warn('recordSlipTelegramSentToCloud', e);
  }
}

async function sendSlipTelegramBatch(){
  if (!CU || (CU.role !== 'Admin' && CU.role !== 'HRD')) {
    toast('Hanya Admin/HRD');
    return;
  }
  var niks = [];
  document.querySelectorAll('.slip-send-cb:checked').forEach(function (cb) {
    if (cb.dataset.nik) niks.push(cb.dataset.nik);
  });
  if (!niks.length) {
    toast('Centang minimal satu karyawan');
    return;
  }
  var pid = document.getElementById('slip-per') && document.getElementById('slip-per').value;
  var p = periodesFindById(pid) || PA();
  var type = (document.getElementById('slip-type') && document.getElementById('slip-type').value) || 'gaji';
  var isThr = type === 'thr' && p.thr_aktif;
  var ok = 0,
    fail = 0,
    skip = 0;
  toast('Mengirim ' + niks.length + ' slip ke Telegram...');
  for (var i = 0; i < niks.length; i++) {
    var nik = niks[i];
    var k = karyawan.find(function (x) {
      return x.nik === nik;
    });
    if (!k) {
      skip++;
      continue;
    }
    if (isThr) {
      try{
        if (!hitungTHRBruto(k, p.nama).eligible) {
          skip++;
          continue;
        }
      }catch(e0){
        skip++;
        continue;
      }
    }
    try{
      var o = isThr ? buildTHRSlipPDF(k, p) : buildGajiSlipPDF(k, p.nama, p.bayar);
      var pdfBase64 = jsPdfToBase64(o.doc);
      if (!pdfBase64) {
        fail++;
        continue;
      }
      var caption = (isThr ? 'Slip THR ' : 'Slip Gaji ') + (p.nama || '') + ' — ' + (k.nama || k.nik);
      var sent = await telegramSendSlipPdf(k.nik, o.fileName || 'Slip_' + k.nik + '.pdf', caption, pdfBase64);
      if (sent) {
        ok++;
        await recordSlipTelegramSentToCloud(k.nik, p.nama, isThr ? 'thr' : 'gaji');
        if (!isThr && p.thr_aktif) {
          var thr2 = await trySendThrTelegramAfterGaji(k, p);
          if (thr2) ok++;
        }
      } else fail++;
    }catch(e){
      console.error('sendSlipTelegramBatch', nik, e);
      fail++;
    }
    await new Promise(function (r) {
      setTimeout(r, 450);
    });
  }
  slipSendInvalidateMetaCache();
  renderSlipSendBatchChecklist(true);
  toast('Selesai: terkirim ' + ok + ', gagal ' + fail + (skip ? ', tidak diproses ' + skip + ' (mis. THR tidak eligible)' : ''));
}

function slipEmailHasValidAddress(k) {
  var e = String((k && k.email) || '').trim().toLowerCase();
  return e.length > 3 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);
}

function buildSlipEmailText(k, p, isThr) {
  var pt = String((perusahaan && perusahaan.nama) || 'Perusahaan').trim();
  var line1 = isThr
    ? 'Berikut lampiran slip THR periode ' + (p.thr_nama || p.nama || '') + '.'
    : 'Berikut lampiran slip gaji periode ' + (p.nama || '') + '.';
  return (
    'Yth. ' +
    (k.nama || k.nik) +
    ',\n\n' +
    line1 +
    '\n\nDikirim oleh sistem SiGaji — ' +
    pt +
    '.\nMohon simpan dokumen ini dengan aman.\n\nHormat kami,\nHRD ' +
    pt
  );
}

function formatSlipEmailApiError(j, status) {
  var errMsg = (j && j.error) || ('Gagal kirim slip email (HTTP ' + status + ')');
  if (j && j.detail && String(j.detail) !== String(j.error)) errMsg += ' — ' + j.detail;
  if (j && j.smtpAttempts && j.smtpAttempts.length) {
    errMsg +=
      ' [' +
      j.smtpAttempts
        .map(function (a) {
          return (a.label || '?') + ': ' + (a.error || a.name || 'gagal');
        })
        .join('; ') +
      ']';
  }
  if (status === 404) errMsg = 'API email belum deploy — push functions/api/slip-email-send.js';
  return errMsg;
}

/** Tes koneksi SMTP di server (tanpa kirim email). Panggil dari Console: sigajiEmailSmtpPing() */
async function sigajiEmailSmtpPing() {
  var t = await getCloudAccessToken();
  if (!t) {
    toast('Belum login awan');
    return null;
  }
  var r = await fetch(sigajiFunctionUrl('slip-email-ping'), {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: 'Bearer ' + t },
  });
  var j = typeof sigajiParseFunctionJson === 'function' ? await sigajiParseFunctionJson(r) : await r.json().catch(function () { return null; });
  console.log('slip-email-ping', j);
  if (j && j.ok) toast('SMTP OK — ' + (j.attempts && j.attempts[0] && j.attempts[0].label));
  else toast((j && j.error) || formatSlipEmailApiError(j, r.status) || 'Tes SMTP gagal');
  return j;
}

/** Kirim satu slip PDF ke email karyawan (HRD/Admin, SMTP server). */
async function emailSendSlipPdf(to, subject, bodyText, filename, pdfBase64, nik) {
  var t = await getCloudAccessToken();
  if (!t) {
    toast('Belum login awan / sesi tidak ada');
    return false;
  }
  var r = await fetch(sigajiFunctionUrl('slip-email-send'), {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: 'Bearer ' + t },
    body: JSON.stringify({ to: to, subject: subject, text: bodyText, filename: filename, pdfBase64: pdfBase64, nik: nik || '' }),
  });
  var j = typeof sigajiParseFunctionJson === 'function' ? await sigajiParseFunctionJson(r) : await r.json().catch(function () { return null; });
  if (!r.ok || !j || !j.ok) {
    var errMsg = formatSlipEmailApiError(j, r.status);
    console.error('slip-email-send', r.status, j);
    toast(errMsg);
    return false;
  }
  return true;
}

async function trySendThrEmailAfterGaji(k, p) {
  if (!p || !p.thr_aktif || !k) return false;
  if (!slipEmailHasValidAddress(k)) return false;
  try {
    var th = hitungTHRBruto(k, p.nama);
    if (!th || !th.eligible) return false;
    var oThr = buildTHRSlipPDF(k, p);
    var pdfThr = jsPdfToBase64(oThr.doc);
    if (!pdfThr) return false;
    await new Promise(function (r) {
      setTimeout(r, 600);
    });
    var subThr = 'Slip THR - ' + (k.nama || k.nik) + ' - ' + (p.thr_nama || p.nama || '');
    var okT = await emailSendSlipPdf(
      String(k.email).trim().toLowerCase(),
      subThr,
      buildSlipEmailText(k, p, true),
      oThr.fileName || 'SlipTHR_' + k.nik + '.pdf',
      pdfThr,
      k.nik
    );
    if (okT) {
      await recordSlipEmailSentToCloud(k.nik, p.nama, 'thr', k.email);
      return true;
    }
  } catch (e) {
    console.warn('trySendThrEmailAfterGaji', e);
  }
  return false;
}

async function sendCurrentSlipToEmail() {
  try {
    if (!CU || (CU.role !== 'Admin' && CU.role !== 'HRD')) {
      toast('Hanya Admin/HRD');
      return;
    }
    var nik = document.getElementById('slip-kar') && document.getElementById('slip-kar').value;
    var k = nik ? karyawan.find(function (x) { return x.nik === nik; }) : null;
    if (!k) {
      toast('Pilih karyawan');
      return;
    }
    if (!slipEmailHasValidAddress(k)) {
      toast('Email karyawan kosong atau tidak valid — isi di profil karyawan');
      return;
    }
    var pid = document.getElementById('slip-per') && document.getElementById('slip-per').value;
    var p = periodesFindById(pid) || PA();
    var type = (document.getElementById('slip-type') && document.getElementById('slip-type').value) || 'gaji';
    var isThr = type === 'thr' && p.thr_aktif;
    var o = isThr ? buildTHRSlipPDF(k, p) : buildGajiSlipPDF(k, p.nama, p.bayar);
    if (!o || !o.doc) {
      toast('Gagal menyiapkan PDF');
      return;
    }
    var pdfBase64 = jsPdfToBase64(o.doc);
    if (!pdfBase64) {
      toast('Gagal encode PDF');
      return;
    }
    var subj = isThr
      ? 'Slip THR - ' + k.nama + ' - ' + (p.thr_nama || p.nama || '')
      : 'Slip Gaji ' + p.nama + ' - ' + k.nama;
    toast('Mengirim email...');
    var ok = await emailSendSlipPdf(
      String(k.email).trim().toLowerCase(),
      subj,
      buildSlipEmailText(k, p, isThr),
      o.fileName || 'Slip_' + k.nik + '.pdf',
      pdfBase64,
      k.nik
    );
    if (ok) {
      await recordSlipEmailSentToCloud(k.nik, p.nama, isThr ? 'thr' : 'gaji', k.email);
      if (!isThr && p.thr_aktif) {
        toast('Mengirim slip THR (email kedua)...');
        await trySendThrEmailAfterGaji(k, p);
      }
      slipSendInvalidateMetaCache();
      renderSlipSendBatchChecklist(true);
      toast('Slip terkirim ke ' + k.email);
    }
  } catch (e) {
    console.error('sendCurrentSlipToEmail', e);
    toast(e.message || 'Gagal kirim email');
  }
}

async function loadSlipEmailMetaBundle(p) {
  var sentMap = {};
  var out = { sentMap: sentMap, sentTableMissing: false };
  if (!window.sigajiSupabase || typeof sigajiIsCloudConfigured !== 'function' || !sigajiIsCloudConfigured()) return out;
  var tk = getSlipTenantKey();
  var sb = window.sigajiSupabase;
  var sr = await sb
    .from('sigaji_slip_email_sent')
    .select('nik,slip_type,sent_at,sent_to')
    .eq('tenant_key', tk)
    .eq('period_nama', p.nama);
  if (sr.error) {
    var blob = String(sr.error.message || '') + String(sr.error.code || '');
    if (/42703|does not exist|relation|sigaji_slip_email_sent|42P01/i.test(blob)) out.sentTableMissing = true;
    else console.warn('sigaji_slip_email_sent', sr.error);
  } else if (sr.data) {
    sr.data.forEach(function (r) {
      if (!r.nik) return;
      var nk = String(r.nik).trim();
      if (!sentMap[nk]) sentMap[nk] = {};
      if (r.slip_type === 'gaji') sentMap[nk].gaji = { at: r.sent_at, to: r.sent_to };
      if (r.slip_type === 'thr') sentMap[nk].thr = { at: r.sent_at, to: r.sent_to };
    });
  }
  return out;
}

async function recordSlipEmailSentToCloud(nik, periodNama, slipTypeUi, sentTo) {
  try {
    if (!window.sigajiSupabase) return;
    var tk = getSlipTenantKey();
    var st = slipTypeUi === 'thr' ? 'thr' : 'gaji';
    await window.sigajiSupabase.from('sigaji_slip_email_sent').upsert(
      {
        tenant_key: tk,
        nik: String(nik || '').trim(),
        period_nama: String(periodNama || '').trim(),
        slip_type: st,
        sent_at: new Date().toISOString(),
        sent_to: String(sentTo || '').trim().toLowerCase() || null,
      },
      { onConflict: 'tenant_key,nik,period_nama,slip_type' }
    );
  } catch (e) {
    console.warn('recordSlipEmailSentToCloud', e);
  }
}

async function sendSlipEmailBatch() {
  if (!CU || (CU.role !== 'Admin' && CU.role !== 'HRD')) {
    toast('Hanya Admin/HRD');
    return;
  }
  var niks = [];
  document.querySelectorAll('.slip-send-cb:checked').forEach(function (cb) {
    if (cb.dataset.nik) niks.push(cb.dataset.nik);
  });
  if (!niks.length) {
    toast('Centang minimal satu karyawan (yang punya email)');
    return;
  }
  var pid = document.getElementById('slip-per') && document.getElementById('slip-per').value;
  var p = periodesFindById(pid) || PA();
  var type = (document.getElementById('slip-type') && document.getElementById('slip-type').value) || 'gaji';
  var isThr = type === 'thr' && p.thr_aktif;
  var ok = 0,
    fail = 0,
    skip = 0;
  toast('Mengirim ' + niks.length + ' slip ke email...');
  for (var i = 0; i < niks.length; i++) {
    var nik = niks[i];
    var k = karyawan.find(function (x) {
      return x.nik === nik;
    });
    if (!k) {
      skip++;
      continue;
    }
    if (!slipEmailHasValidAddress(k)) {
      skip++;
      continue;
    }
    if (isThr) {
      try {
        if (!hitungTHRBruto(k, p.nama).eligible) {
          skip++;
          continue;
        }
      } catch (e0) {
        skip++;
        continue;
      }
    }
    try {
      var o = isThr ? buildTHRSlipPDF(k, p) : buildGajiSlipPDF(k, p.nama, p.bayar);
      var pdfBase64 = jsPdfToBase64(o.doc);
      if (!pdfBase64) {
        fail++;
        continue;
      }
      var subj = isThr
        ? 'Slip THR - ' + k.nama + ' - ' + (p.thr_nama || p.nama || '')
        : 'Slip Gaji ' + p.nama + ' - ' + k.nama;
      var sent = await emailSendSlipPdf(
        String(k.email).trim().toLowerCase(),
        subj,
        buildSlipEmailText(k, p, isThr),
        o.fileName || 'Slip_' + k.nik + '.pdf',
        pdfBase64,
        k.nik
      );
      if (sent) {
        ok++;
        await recordSlipEmailSentToCloud(k.nik, p.nama, isThr ? 'thr' : 'gaji', k.email);
        if (!isThr && p.thr_aktif) {
          var thr2 = await trySendThrEmailAfterGaji(k, p);
          if (thr2) ok++;
        }
      } else fail++;
    } catch (e) {
      console.error('sendSlipEmailBatch', nik, e);
      fail++;
    }
    await new Promise(function (r) {
      setTimeout(r, 600);
    });
  }
  slipSendInvalidateMetaCache();
  renderSlipSendBatchChecklist(true);
  toast(
    'Email selesai: terkirim ' +
      ok +
      ', gagal ' +
      fail +
      (skip ? ', dilewati ' + skip + ' (tanpa email / THR tidak eligible)' : '')
  );
}

/** Dipakai login lokal + login Supabase (cloud-sync.js). */
function enterAppWithUser(user){
  if(!user)return;
  CU={...user};
  // Remember username (localStorage)
  try{
    var cb=document.getElementById('remember-username');
    var lu=document.getElementById('lu');
    if(cb){
      localStorage.setItem('sigaji_remember_username',cb.checked?'1':'0');
      if(cb.checked&&lu&&lu.value!=null)localStorage.setItem('sigaji_last_username',String(lu.value||''));
      if(!cb.checked)localStorage.removeItem('sigaji_last_username');
    }
  }catch(e){sigajiCatchWarn("js/modules/app-access.js",e);}
  sigajiSetLoginBusy(false);
  document.getElementById('login').style.display='none';document.getElementById('app').style.display='flex';
  try{document.body.classList.add('sigaji-app-active');}catch(e){sigajiCatchWarn("js/modules/app-access.js",e);}
  document.getElementById('uav').textContent=ini(CU.nama);document.getElementById('uname').textContent=CU.nama;document.getElementById('urbadge').textContent=CU.role;
  document.getElementById('top-periode').textContent=PA().nama;
  applyBranding();renderSidebar();renderAll();
  try{sigajiUpdateCloudBackupUi();}catch(eCu){sigajiCatchWarn("js/modules/app-access.js",eCu);}
  try{sigajiApplyMobileNavMode();initSigajiNavDrawer();}catch(e){sigajiCatchWarn("js/modules/app-access.js",e);}
  var startPg=typeof sigajiResolveStartupPg==='function'?sigajiResolveStartupPg():'dashboard';
  showPg(startPg);
  updateNotifBadge();
  initIdleSession();
}
function sigajiSetLoginBusy(busy){
  var btn=document.getElementById('btn-login');
  if(!btn)return;
  btn.classList.toggle('is-busy',!!busy);
  btn.disabled=!!busy;
}
if(typeof window!=='undefined')window.sigajiSetLoginBusy=sigajiSetLoginBusy;

function doLogin(){
  const rawU=document.getElementById('lu').value.trim();
  const u=rawU.toLowerCase();
  const pw=document.getElementById('lp').value;
  // Persist remember-username choice early (before async cloud login)
  try{
    var cb=document.getElementById('remember-username');
    if(cb){
      localStorage.setItem('sigaji_remember_username',cb.checked?'1':'0');
      if(cb.checked)localStorage.setItem('sigaji_last_username',rawU);
      else localStorage.removeItem('sigaji_last_username');
    }
  }catch(e){sigajiCatchWarn("js/modules/app-access.js",e);}
  if(sigajiIsCloudOnlyMode()||sigajiIsCloudConfigured()||window.sigajiCloudOnlyMode){
    if(!sigajiIsCloudConfigured()){
      toast('Supabase belum dikonfigurasi di server. Set env SIGAJI_SUPABASE_* di Cloudflare lalu deploy ulang.');
      return;
    }
    if(rawU.indexOf('@')<0){
      toast('Gunakan email lengkap (contoh: anda@perusahaan.com). Login lokal admin/hrd tidak dipakai.');
      return;
    }
    if(typeof window.sigajiTryCloudLogin!=='function'){
      toast('File js/cloud-sync.js tidak termuat. Periksa deploy / urutan script di index.html.');
      return;
    }
    if(!pw){toast('Isi sandi akun Supabase Anda.');return;}
    sigajiSetLoginBusy(true);
    window.sigajiTryCloudLogin(rawU,pw);
    return;
  }
  toast('Mode lokal dinonaktifkan. Hubungi Admin untuk akun email Supabase.');
}

function initRememberUsername(){
  try{
    var cb=document.getElementById('remember-username');
    var lu=document.getElementById('lu');
    if(!cb||!lu)return;
    var on=localStorage.getItem('sigaji_remember_username')==='1';
    cb.checked=on;
    if(on){
      var last=localStorage.getItem('sigaji_last_username')||'';
      if(last)lu.value=last;
    }
    // Persist preference changes immediately
    cb.onchange=function(){
      try{
        localStorage.setItem('sigaji_remember_username',cb.checked?'1':'0');
        if(cb.checked)localStorage.setItem('sigaji_last_username',String(lu.value||''));
        else localStorage.removeItem('sigaji_last_username');
      }catch(e){sigajiCatchWarn("js/modules/app-access.js",e);}
    };
    // If enabled, keep saving latest username as user types
    lu.oninput=function(){
      try{
        if(localStorage.getItem('sigaji_remember_username')==='1'){
          localStorage.setItem('sigaji_last_username',String(lu.value||''));
        }
      }catch(e){sigajiCatchWarn("js/modules/app-access.js",e);}
    };
  }catch(e){sigajiCatchWarn("js/modules/app-access.js",e);}
}

var _sigajiIdleTimer=null;
var _sigajiIdleHandlers=[];
window.SIGAJI_LAST_ACTIVITY_KEY='sigaji_last_activity_ts';
function getIdleLogoutMs(){
  var m=(typeof window.SIGAJI_IDLE_LOGOUT_MINUTES!=='undefined'?parseInt(window.SIGAJI_IDLE_LOGOUT_MINUTES,10):0)||0;
  return Math.max(0,m)*60*1000;
}
function destroyIdleSession(){
  if(_sigajiIdleTimer){clearTimeout(_sigajiIdleTimer);_sigajiIdleTimer=null;}
  _sigajiIdleHandlers.forEach(function(h){
    try{document.removeEventListener(h.e,h.fn,h.opt||false);}catch(e){sigajiCatchWarn("js/modules/app-access.js",e);}
  });
  _sigajiIdleHandlers=[];
}
function scheduleIdleLogout(){
  if(_sigajiIdleTimer)clearTimeout(_sigajiIdleTimer);
  _sigajiIdleTimer=null;
  var ms=getIdleLogoutMs();
  if(ms<=0||!CU)return;
  _sigajiIdleTimer=setTimeout(function(){
    _sigajiIdleTimer=null;
    if(!CU)return;
    window._sigajiIdleLogout=true;
    try{toast('Sesi berakhir karena tidak ada aktivitas. Silakan login lagi.');}catch(e){sigajiCatchWarn("js/modules/app-access.js",e);}
    doLogout();
    window._sigajiIdleLogout=false;
  },ms);
}
function bumpActivityTs(){
  try{localStorage.setItem(window.SIGAJI_LAST_ACTIVITY_KEY,String(Date.now()));}catch(e){sigajiCatchWarn("js/modules/app-access.js",e);}
  scheduleIdleLogout();
}
function initIdleSession(){
  destroyIdleSession();
  if(getIdleLogoutMs()<=0)return;
  bumpActivityTs();
  function onAct(){bumpActivityTs();}
  var evts=[{e:'mousedown',opt:{passive:true}},{e:'keydown',opt:{}},{e:'click',opt:{passive:true}},{e:'touchstart',opt:{passive:true}},{e:'scroll',opt:{passive:true}}];
  evts.forEach(function(x){
    document.addEventListener(x.e,onAct,x.opt||false);
    _sigajiIdleHandlers.push({e:x.e,fn:onAct,opt:x.opt});
  });
  function vis(){
    if(document.visibilityState==='visible'&&typeof window.sigajiCheckIdleExpiredNow==='function')window.sigajiCheckIdleExpiredNow();
  }
  document.addEventListener('visibilitychange',vis);
  _sigajiIdleHandlers.push({e:'visibilitychange',fn:vis,opt:false});
}
window.sigajiIsIdleExpired=function(){
  var ms=getIdleLogoutMs();
  if(ms<=0)return false;
  try{
    var raw=localStorage.getItem(window.SIGAJI_LAST_ACTIVITY_KEY);
    if(!raw)return false;
    var ts=parseInt(raw,10);
    if(!isFinite(ts))return false;
    return Date.now()-ts>ms;
  }catch(e){return false;}
};
window.sigajiCheckIdleExpiredNow=function(){
  if(!CU)return;
  if(window.sigajiIsIdleExpired()){
    window._sigajiIdleLogout=true;
    try{toast('Sesi berakhir karena tidak ada aktivitas. Silakan login lagi.');}catch(e){sigajiCatchWarn("js/modules/app-access.js",e);}
    doLogout();
    window._sigajiIdleLogout=false;
  }else bumpActivityTs();
};

function doLogout(){
  sigajiCloseNavDrawer();
  try{localStorage.removeItem('sigaji_resume_hint');}catch(e){sigajiCatchWarn("js/modules/app-access.js",e);}
  try{localStorage.removeItem('sigaji_last_pg');}catch(e){sigajiCatchWarn("js/modules/app-access.js",e);}
  try{localStorage.removeItem(window.SIGAJI_LAST_ACTIVITY_KEY);}catch(e){sigajiCatchWarn("js/modules/app-access.js",e);}
  try{
    if(window.history&&window.history.replaceState){
      window.history.replaceState(null,'',window.location.pathname+(window.location.search||''));
    }
  }catch(e){sigajiCatchWarn("js/modules/app-access.js",e);}
  destroyIdleSession();
  try{if(typeof window.sigajiCloudLogout==='function')window.sigajiCloudLogout().catch(function(){});}catch(e){sigajiCatchWarn("js/modules/app-access.js",e);}
  document.getElementById('login').style.display='flex';document.getElementById('app').style.display='none';
  try{document.body.classList.remove('sigaji-app-active');}catch(e){sigajiCatchWarn("js/modules/app-access.js",e);}
  CU=null;
}
if(typeof window!=='undefined')window.enterAppWithUser=enterAppWithUser;
function uploadLogo(inp){const f=inp.files[0];if(!f)return;if(f.size>2097152){toast('Maks 2MB');return;}const r=new FileReader();r.onload=e=>{perusahaan.logo=e.target.result;saveAll();applyBranding();toast('Logo diupload');};r.readAsDataURL(f);}
function hapusLogo(){perusahaan.logo='';saveAll();applyBranding();toast('Logo dihapus');}
function populatePhkAlasanSelect(){
  try{
    var el=document.getElementById('sp-phk-alasan');if(!el||typeof PHK_ALASAN_OPTS==='undefined')return;
    el.innerHTML=PHK_ALASAN_OPTS.map(function(o){return '<option value="'+String(o.id).replace(/"/g,'&quot;')+'">'+(String(o.lbl||'').replace(/</g,'&lt;'))+'</option>';}).join('');
  }catch(e){console.error('populatePhkAlasanSelect',e);}
}
function toggleSpPhkWrap(){
  var ber=document.getElementById('sp-berhenti-f');
  var w=document.getElementById('sp-phk-wrap');
  if(!w)return;
  var on=ber&&String(ber.value||'').trim();
  w.style.display=on?'':'none';
  if(on&&(!document.getElementById('sp-phk-alasan')||!document.getElementById('sp-phk-alasan').options.length))populatePhkAlasanSelect();
}
function sigajiReadStoredSchemaVersion(){
  try{
    var key=typeof DB_KEY!=='undefined'?DB_KEY:'sigaji_db';
    var raw=localStorage.getItem(key);
    if(!raw)return null;
    var db=JSON.parse(raw);
    return db&&db.schemaVersion!=null?parseInt(db.schemaVersion,10):null;
  }catch(e){return null;}
}
function sigajiDetectModuleCacheVersions(){
  var vers=[];
  try{
    document.querySelectorAll('script[src*="js/modules/"]').forEach(function(s){
      var m=/[?&]v=([^&]+)/.exec(s.src||'');
      if(m&&vers.indexOf(m[1])<0)vers.push(m[1]);
    });
  }catch(e){sigajiCatchWarn("js/modules/app-access.js",e);}
  return vers;
}
function sigajiParseModuleVersionsFromHtml(html){
  var vers=[];
  try{
    var re=/js\/modules\/[^"']+\?v=([^"'&\s]+)/gi;
    var m;
    while((m=re.exec(html))){if(vers.indexOf(m[1])<0)vers.push(m[1]);}
  }catch(e){sigajiCatchWarn("js/modules/app-access.js",e);}
  return vers;
}
function sigajiExpectedDeployVersion(){
  if(typeof window.SIGAJI_BUILD==='string'&&String(window.SIGAJI_BUILD).trim())return String(window.SIGAJI_BUILD).trim();
  return typeof SIGAJI_MODULES_CACHE!=='undefined'?String(SIGAJI_MODULES_CACHE):'';
}
function sigajiVersionsMatchTarget(vers){
  var tgt=sigajiExpectedDeployVersion();
  if(!tgt)return false;
  return vers.length===1&&vers[0]===tgt;
}
function sigajiFetchServerIndexModuleVersions(cb){
  if(typeof fetch!=='function'){cb(null,'fetch tidak didukung');return;}
  var url=(location.origin||'')+'/index.html?_='+Date.now();
  fetch(url,{cache:'no-store',credentials:'same-origin'})
    .then(function(r){if(!r.ok)throw new Error('HTTP '+r.status);return r.text();})
    .then(function(html){cb(sigajiParseModuleVersionsFromHtml(html),null);})
    .catch(function(e){cb(null,e&&e.message?e.message:String(e));});
}
function renderSysStatus(){
  var el=document.getElementById('sysstatus-panel');
  if(!el)return;
  try{
    if(!CU||CU.role!=='Admin'){
      el.innerHTML='<div class="info-box" style="border-color:#fecaca;background:#fef2f2;color:#991b1b">Halaman ini hanya untuk Administrator.</div>';
      return;
    }
    var appLabel=typeof SIGAJI_APP_LABEL!=='undefined'?SIGAJI_APP_LABEL:'SiGaji';
    var schemaExp=typeof SCHEMA_VERSION!=='undefined'?SCHEMA_VERSION:'?';
    var schemaStored=sigajiReadStoredSchemaVersion();
    var schemaOk=schemaStored==null||schemaStored===schemaExp;
    var cloudOn=typeof sigajiIsCloudConfigured==='function'&&sigajiIsCloudConfigured();
    var cloudOnly=!!window.sigajiCloudOnlyMode;
    var sbReady=!!window.sigajiSupabase;
    var storageMode=typeof window.SIGAJI_STORAGE_MODE!=='undefined'?String(window.SIGAJI_STORAGE_MODE||'').trim():'';
    var targetVer=sigajiExpectedDeployVersion()||'?';
    var modVers=sigajiDetectModuleCacheVersions();
    var modVerTxt=modVers.length?modVers.join(', '):'-';
    var modOk=sigajiVersionsMatchTarget(modVers);
    var modBadge=modOk?{cls:'b-ok',txt:'OK'}:modVers.length>1?{cls:'b-warn',txt:'tidak seragam'}:{cls:'b-warn',txt:'lama'};
    var host='';
    try{host=location.hostname+(location.port?':'+location.port:'');}catch(eH){sigajiCatchWarn("js/modules/app-access.js",eH);}
    var prot=location.protocol||'';
    var periodeAktif='-';
    try{var pa=typeof PA==='function'?PA():null;if(pa&&pa.nama)periodeAktif=pa.nama+(pa.status?' ('+pa.status+')':'');}catch(eP){sigajiCatchWarn("js/modules/app-access.js",eP);}
    var nKar=(karyawan||[]).filter(function(k){return k&&k.nik&&!String(k.tgl_berhenti||'').trim();}).length;
    function row(lbl,val,badge){
      var b=badge?'<span class="bdg '+escapeAttr(badge.cls)+'" style="margin-left:8px">'+escapeHtml(badge.txt)+'</span>':'';
      return '<tr><td class="p-inset-xs fw-600 text-body" style="width:38%; border-bottom:1px solid #f3f4f6">'+lbl+'</td>'
        +'<td class="p-inset-xs font-12" style="border-bottom:1px solid #f3f4f6">'+val+b+'</td></tr>';
    }
    var cloudLbl=sigajiIsCloudOnlyMode()?'Online (Supabase wajib)':(cloudOn?(cloudOnly?'Cloud (wajib email)':'Cloud aktif'):'Lokal (legacy)');
    var schemaLbl=schemaStored==null?'belum ada data tersimpan':String(schemaStored);
    if(schemaStored!=null&&!schemaOk)schemaLbl+=' - buka app sekali untuk migrasi otomatis';
    var deployWarn=!modOk
      ?'<div id="sysstatus-deploy-warn" class="info-box tabs-spaced-lg" style="border-color:#f6d088; background:#fff8e6; color:#713f12">'
        +(modVers.length>1
          ?'<strong>Versi cache tidak seragam di kode lokal.</strong> Browser memuat beberapa <code>?v=</code> ('+escapeHtml(modVerTxt)+') — target <strong>'+escapeHtml(targetVer)+'</strong> (<code>SIGAJI_BUILD</code>). Jalankan <code>npm run bump -- '+escapeHtml(targetVer)+'</code> (samakan css+js+SIGAJI_BUILD, lalu assemble otomatis).'
          :'<strong>Browser masih cache lama.</strong> Target deploy: <strong>'+escapeHtml(targetVer)+'</strong>, browser: <strong>'+escapeHtml(modVerTxt||'-')+'</strong>. Ctrl+F5; jika tetap beda, push <code>index.html</code> ke GitHub dan tunggu Cloudflare deploy.')
        +'</div>'
      :'<div class="u-hidden" id="sysstatus-deploy-warn"></div>';
    var html=
      deployWarn
      +'<div class="card border-accent-left">'
      +'<div class="ct ct-brand">Ringkasan</div>'
      +'<table class="w-full" style="border-collapse:collapse"><tbody>'
      +row('Versi aplikasi',escapeHtml(appLabel)+' <span class="text-muted">(label rilis)</span>')
      +row('Target cache (kode)',escapeHtml(targetVer),{cls:'b-info',txt:'deploy'})
      +row('Modul JS (browser)',escapeHtml(modVerTxt),modBadge)
      +row('index.html di server','<span id="sysstatus-server-index">Memeriksa...</span>')
      +row('Schema (kode)',String(schemaExp),{cls:'b-info',txt:'target'})
      +row('Schema (data tersimpan)',escapeHtml(schemaLbl),schemaOk?{cls:'b-ok',txt:'sesuai'}:{cls:'b-warn',txt:'cek'})
      +row('Mode cloud',escapeHtml(cloudLbl),cloudOn?{cls:'b-ok',txt:'ON'}:{cls:'b-err',txt:'config?'})
      +row('Klien Supabase',sbReady?'terhubung':'belum / tidak dipakai',sbReady?{cls:'b-ok',txt:'siap'}:{cls:'b-gray',txt:'-'})
      +(storageMode?row('Penyimpanan cloud',escapeHtml(storageMode)):'')
      +row('Situs',escapeHtml(prot+'//'+host))
      +row('Periode aktif',escapeHtml(periodeAktif))
      +row('Karyawan aktif',String(nKar))
      +row('User login',escapeHtml((CU.nama||'')+' ('+(CU.username||'')+')'))
      +'</tbody></table>'
      +'<p class="font-11 text-muted" style="margin:.75rem 0 0; line-height:1.5">Baris <strong>index.html di server</strong> = isi file di Cloudflare (bukan cache browser). Harus sama dengan <code>SIGAJI_BUILD</code> di halaman ini ('+escapeHtml(targetVer)+').</p>'
      +'</div>';
    el.innerHTML=html;
    var srvEl=document.getElementById('sysstatus-server-index');
    if(srvEl){
      sigajiFetchServerIndexModuleVersions(function(vers,err){
        var html;
        if(err){
          srvEl.textContent='tidak bisa baca: '+err;
          return;
        }
        var txt=vers&&vers.length?vers.join(', '):'(tidak ada js/modules di index)';
        var ok=sigajiVersionsMatchTarget(vers||[]);
        srvEl.innerHTML=escapeHtml(txt);
        if(!ok){
          var w=document.getElementById('sysstatus-deploy-warn');
          if(w){
            w.style.display='block';
            var sameAsBrowser=modVerTxt===txt;
            w.innerHTML=sameAsBrowser&&modVers.length>1
              ?'<strong>index.html belum diseragamkan (bukan sekadar belum deploy).</strong> Server &amp; browser sama-sama campur versi: <code>'+escapeHtml(txt)+'</code>. Target: <strong>'+escapeHtml(targetVer)+'</strong>. Jalankan <code>node scripts/bump-cache-version.js '+escapeHtml(targetVer)+'</code>, <code>npm run assemble</code>, push ke GitHub.'
              :'<strong>index.html di server belum terbaru.</strong> Server: <code>'+escapeHtml(txt)+'</code> — diharapkan satu versi: <strong>'+escapeHtml(targetVer)+'</strong>. Push <code>index.html</code> ke GitHub, tunggu Cloudflare deploy, Ctrl+F5.';
          }
          var rowCell=srvEl.closest('td');
          if(rowCell){
            var srvBadge=vers.length>1?'tidak seragam':(modVerTxt===txt&&modVers.length>1?'tidak seragam':'belum deploy');
            html=escapeHtml(txt)+' <span class="bdg b-warn" style="margin-left:8px">'+escapeHtml(srvBadge)+'</span>';
            rowCell.innerHTML=html;
          }
        }else if(srvEl.closest('td')){
          html=escapeHtml(txt)+' <span class="bdg b-ok" style="margin-left:8px">OK</span>';
          srvEl.closest('td').innerHTML=html;
        }
      });
    }
  }catch(err){
    console.error('renderSysStatus',err);
    el.innerHTML='<div class="info-box" style="border-color:#fecaca;background:#fef2f2;color:#991b1b">Gagal memuat status: '
      +escapeHtml(String(err&&err.message?err.message:err))+'. Coba Ctrl+F5 atau pastikan js/modules/app-access.js terbaru termuat.</div>';
  }
}
if(typeof window!=='undefined')window.renderSysStatus=renderSysStatus;

function renderAll(){renderDash();renderKar();try{if(typeof sigajiRenderLicenseQuotaUi==='function')sigajiRenderLicenseQuotaUi();}catch(eLq){sigajiCatchWarn("js/modules/app-access.js",eLq);}renderKompgaji();renderPenggajian();renderPPH();renderLaporan();renderNotif();renderPeriodes();renderHariLibur();renderCutiRekap();renderTHR();try{if(typeof renderPesangon==='function')renderPesangon();}catch(e){console.error('renderPesangon',e);}populateSelects();renderPeriodeSelects();loadPrsForm();applyBranding();renderUsers();renderPermMatrix();populatePhkAlasanSelect();renderMigrationStatus();try{sigajiUpdateCloudBackupUi();}catch(eCb){sigajiCatchWarn("js/modules/app-access.js",eCb);}try{if(typeof sigajiUpdatePeriodStickyBar==='function')sigajiUpdatePeriodStickyBar();}catch(ePs){sigajiCatchWarn("js/modules/app-access.js",ePs);}if(typeof sigajiBindRpInputs==='function')sigajiBindRpInputs(document.body);try{if(typeof sigajiMaybeShowSetupWizard==='function')sigajiMaybeShowSetupWizard();}catch(eWiz){sigajiCatchWarn("js/modules/app-access.js",eWiz);}try{if(typeof sigajiMaybeProductTour==='function')sigajiMaybeProductTour();}catch(eTour){sigajiCatchWarn("js/modules/app-access.js",eTour);}try{if(typeof sigajiRenderPeriodTimeline==='function')sigajiRenderPeriodTimeline();}catch(eTl){sigajiCatchWarn("js/modules/app-access.js",eTl);}try{if(typeof sigajiApplyUiPrefs==='function')sigajiApplyUiPrefs(sigajiGetUiPrefs());}catch(eUi){sigajiCatchWarn("js/modules/app-access.js",eUi);}try{if(typeof sigajiUiCabangAfterRender==='function')sigajiUiCabangAfterRender();}catch(eCab){sigajiCatchWarn("js/modules/app-access.js",eCab);}}
