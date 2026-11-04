/* SiGaji — branding, login, idle, unggah logo, kirim slip massal */
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
  try{if(typeof sigajiApplyUiPrefs==='function')sigajiApplyUiPrefs();}catch(eBr){sigajiCatchWarn('js/modules/app-access.js',eBr);}
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

/** Status tautan Telegram untuk NIK. */
async function telegramGetLinkStatus(nik){
  const t=await getCloudAccessToken();
  if(!t)return null;
  var res=typeof sigajiFetchJson==='function'?await sigajiFetchJson(sigajiFunctionUrl('telegram-status'),{method:'POST',headers:{'content-type':'application/json','authorization':'Bearer '+t},body:JSON.stringify({nik})}):null;
  if(!res||!res.ok)return null;
  return res.data;
}

/** Putus tautan Telegram untuk NIK (HRD/Admin). */
async function telegramUnlinkNik(nik){
  const t=await getCloudAccessToken();
  if(!t){toast('Belum login awan / sesi tidak ada');return false;}
  var res=typeof sigajiFetchJson==='function'?await sigajiFetchJson(sigajiFunctionUrl('telegram-unlink'),{method:'POST',headers:{'content-type':'application/json','authorization':'Bearer '+t},body:JSON.stringify({nik})}):null;
  if(!res||!res.ok){if(typeof sigajiApiToast==='function')sigajiApiToast(res);else toast((res&&res.error)||'Gagal putus tautan Telegram');return false;}
  return true;
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
    '<div class="rounded-sm sigaji-slip-send-scroll" style="overflow-x:auto; border:1px solid var(--bd)"><table class="w-full font-12"><thead><tr><th style="width:40px"><input type="checkbox" id="slip-send-cb-all" title="Pilih semua" data-sigaji-action="call-value" data-fn="slipSendToggleAll" data-arg="$checked"></th><th>Kode</th><th>Nama</th><th>Telegram</th><th>Email</th><th>Slip TG</th><th>Slip email</th></tr></thead><tbody>' +
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
    if (typeof isKarSampah === 'function' && isKarSampah(k)) {
      skip++;
      continue;
    }
    if (typeof karyawanInPeriode === 'function' && p && !karyawanInPeriode(k, p)) {
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
    if (typeof isKarSampah === 'function' && isKarSampah(k)) {
      skip++;
      continue;
    }
    if (typeof karyawanInPeriode === 'function' && p && !karyawanInPeriode(k, p)) {
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
  if(typeof window.sigajiIsAbsenOnlyRole==='function'&&window.sigajiIsAbsenOnlyRole(user.role)){
    sigajiSetLoginBusy(false);
    toast(window.sigajiRejectWebLoginMessage||'Akun hanya untuk aplikasi absen Android.');
    try{if(window.sigajiSupabase)window.sigajiSupabase.auth.signOut();}catch(e){sigajiCatchWarn("js/modules/app-access.js",e);}
    return;
  }
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
  applyBranding();renderSidebar();
  try{if(typeof sigajiSyncViewportVars==='function')sigajiSyncViewportVars();}catch(eVp){sigajiCatchWarn("js/modules/app-access.js",eVp);}
  try{sigajiApplyMobileNavMode();initSigajiNavDrawer();}catch(e){sigajiCatchWarn("js/modules/app-access.js",e);}
  /* Login cepat: render shell + dashboard dulu; halaman berat ditunda */
  try{populateSelects();renderPeriodeSelects();}catch(eSel){sigajiCatchWarn("js/modules/app-access.js",eSel);}
  try{if(typeof sigajiUpdatePeriodStickyBar==='function')sigajiUpdatePeriodStickyBar();}catch(ePs){sigajiCatchWarn("js/modules/app-access.js",ePs);}
  try{if(typeof sigajiApplyUiPrefs==='function')sigajiApplyUiPrefs(sigajiGetUiPrefs());}catch(eUi){sigajiCatchWarn("js/modules/app-access.js",eUi);}
  try{renderDash();}catch(eD){sigajiCatchWarn("js/modules/app-access.js",eD);}
  try{renderNotif();}catch(eN){sigajiCatchWarn("js/modules/app-access.js",eN);}
  try{sigajiUpdateCloudBackupUi();}catch(eCu){sigajiCatchWarn("js/modules/app-access.js",eCu);}
  var startPg=typeof sigajiResolveStartupPg==='function'?sigajiResolveStartupPg():'dashboard';
  showPg(startPg);
  updateNotifBadge();
  initIdleSession();
  if((CU.role==='Admin'||CU.role==='HRD')&&typeof window.sigajiSyncUserRolesTable==='function'&&window.sigajiSupabase){
    window.sigajiSyncUserRolesTable(window.sigajiSupabase,users);
  }
  setTimeout(function(){
    try{if(typeof renderAllDeferred==='function')renderAllDeferred();}
    catch(eDef){try{renderAll();}catch(eAll){sigajiCatchWarn("js/modules/app-access.js",eAll);}}
  },40);
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
  /* Bawaan 30 menit bila config.js tidak mengisi (komputer bersama / data gaji). 0 = nonaktif. */
  var raw=typeof window.SIGAJI_IDLE_LOGOUT_MINUTES!=='undefined'?window.SIGAJI_IDLE_LOGOUT_MINUTES:30;
  var m=parseInt(raw,10);
  if(!isFinite(m)||m<0)m=30;
  return m*60*1000;
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
  try{if(typeof sigajiUpdateMobileBottomNavVisibility==='function')sigajiUpdateMobileBottomNavVisibility();}catch(eNav){sigajiCatchWarn("js/modules/app-access.js",eNav);}
  CU=null;
}
if(typeof window!=='undefined')window.enterAppWithUser=enterAppWithUser;
function uploadLogo(inp){const f=inp.files[0];if(!f)return;if(f.size>2097152){toast('Maks 2MB');return;}const r=new FileReader();r.onload=e=>{perusahaan.logo=String(e.target.result);saveAll();applyBranding();toast('Logo diupload');};r.readAsDataURL(f);}
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
  var on=!!(ber&&String(ber.value||'').trim());
  if(typeof sigajiSetPanelVisible==='function')sigajiSetPanelVisible(w,on,'');
  else{
    if(on){w.classList.remove('u-hidden');w.style.removeProperty('display');}
    else{w.classList.add('u-hidden');w.style.display='none';}
  }
  if(on){
    populatePhkAlasanSelect();
    try{
      var spa=document.getElementById('sp-phk-alasan');
      if(spa&&!spa.options.length)populatePhkAlasanSelect();
      w.scrollIntoView({block:'nearest',behavior:'smooth'});
    }catch(e){sigajiCatchWarn("js/modules/app-access.js",e);}
  }
}
if(typeof window!=='undefined')window.toggleSpPhkWrap=toggleSpPhkWrap;
