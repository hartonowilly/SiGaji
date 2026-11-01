/* SiGaji — status sistem, renderAll */
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
      el.innerHTML='<div class="info-box is-danger">Halaman ini hanya untuk Administrator.</div>';
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
      return '<tr><td class="p-inset-xs fw-600 text-body border-bottom-muted">'+lbl+'</td>'
        +'<td class="p-inset-xs font-12 border-bottom-muted">'+val+b+'</td></tr>';
    }
    var cloudLbl=sigajiIsCloudOnlyMode()?'Online (Supabase wajib)':(cloudOn?(cloudOnly?'Cloud (wajib email)':'Cloud aktif'):'Lokal (legacy)');
    var schemaLbl=schemaStored==null?'belum ada data tersimpan':String(schemaStored);
    if(schemaStored!=null&&!schemaOk)schemaLbl+=' - buka app sekali untuk migrasi otomatis';
    var deployWarn=!modOk
      ?'<div id="sysstatus-deploy-warn" class="info-box is-warn tabs-spaced-lg">'
        +(modVers.length>1
          ?'<strong>Versi cache tidak seragam di kode lokal.</strong> Browser memuat beberapa <code>?v=</code> ('+escapeHtml(modVerTxt)+') — target <strong>'+escapeHtml(targetVer)+'</strong> (<code>SIGAJI_BUILD</code>). Jalankan <code>npm run bump -- '+escapeHtml(targetVer)+'</code> (samakan css+js+SIGAJI_BUILD, lalu assemble otomatis).'
          :'<strong>Browser masih cache lama.</strong> Target deploy: <strong>'+escapeHtml(targetVer)+'</strong>, browser: <strong>'+escapeHtml(modVerTxt||'-')+'</strong>. Ctrl+F5; jika tetap beda, push <code>index.html</code> ke GitHub dan tunggu Cloudflare deploy.')
        +'</div>'
      :'<div class="u-hidden" id="sysstatus-deploy-warn"></div>';
    var html=
      deployWarn
      +'<div class="card border-accent-left">'
      +'<div class="ct ct-brand">Ringkasan</div>'
      +'<table class="w-full sysstatus-table" style="border-collapse:collapse"><tbody>'
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
    el.innerHTML='<div class="info-box is-danger">Gagal memuat status: '
      +escapeHtml(String(err&&err.message?err.message:err))+'. Coba Ctrl+F5 atau pastikan js/modules/app-access.js terbaru termuat.</div>';
  }
}
if(typeof window!=='undefined')window.renderSysStatus=renderSysStatus;

function renderAll(){renderDash();renderKar();try{if(typeof sigajiRenderLicenseQuotaUi==='function')sigajiRenderLicenseQuotaUi();}catch(eLq){sigajiCatchWarn("js/modules/app-access.js",eLq);}if(typeof renderKompgajiPage==='function')renderKompgajiPage();else renderKompgaji();renderPenggajian();renderPPH();renderLaporan();renderNotif();renderPeriodes();renderHariLibur();renderCutiRekap();renderTHR();try{if(typeof renderPesangon==='function')renderPesangon();}catch(e){console.error('renderPesangon',e);}populateSelects();renderPeriodeSelects();loadPrsForm();applyBranding();renderUsers();renderPermMatrix();populatePhkAlasanSelect();renderMigrationStatus();try{sigajiUpdateCloudBackupUi();}catch(eCb){sigajiCatchWarn("js/modules/app-access.js",eCb);}try{if(typeof sigajiUpdatePeriodStickyBar==='function')sigajiUpdatePeriodStickyBar();}catch(ePs){sigajiCatchWarn("js/modules/app-access.js",ePs);}if(typeof sigajiBindRpInputs==='function')sigajiBindRpInputs(document.body);try{if(typeof sigajiMaybeShowSetupWizard==='function')sigajiMaybeShowSetupWizard();}catch(eWiz){sigajiCatchWarn("js/modules/app-access.js",eWiz);}try{if(typeof sigajiMaybeProductTour==='function')sigajiMaybeProductTour();}catch(eTour){sigajiCatchWarn("js/modules/app-access.js",eTour);}try{if(typeof sigajiRenderPeriodTimeline==='function')sigajiRenderPeriodTimeline();}catch(eTl){sigajiCatchWarn("js/modules/app-access.js",eTl);}try{if(typeof sigajiApplyUiPrefs==='function')sigajiApplyUiPrefs(sigajiGetUiPrefs());}catch(eUi){sigajiCatchWarn("js/modules/app-access.js",eUi);}try{if(typeof sigajiUiCabangAfterRender==='function')sigajiUiCabangAfterRender();}catch(eCab){sigajiCatchWarn("js/modules/app-access.js",eCab);}}
/** Setelah login: warm halaman non-dashboard tanpa memblokir first paint. */
function renderAllDeferred(){
  try{renderKar();}catch(e){sigajiCatchWarn("js/modules/app-access.js",e);}
  try{if(typeof sigajiRenderLicenseQuotaUi==='function')sigajiRenderLicenseQuotaUi();}catch(eLq){sigajiCatchWarn("js/modules/app-access.js",eLq);}
  try{if(typeof renderKompgajiPage==='function')renderKompgajiPage();else renderKompgaji();}catch(e){sigajiCatchWarn("js/modules/app-access.js",e);}
  try{renderPenggajian();}catch(e){sigajiCatchWarn("js/modules/app-access.js",e);}
  try{renderPPH();}catch(e){sigajiCatchWarn("js/modules/app-access.js",e);}
  try{renderLaporan();}catch(e){sigajiCatchWarn("js/modules/app-access.js",e);}
  try{renderPeriodes();}catch(e){sigajiCatchWarn("js/modules/app-access.js",e);}
  try{renderHariLibur();}catch(e){sigajiCatchWarn("js/modules/app-access.js",e);}
  try{renderCutiRekap();}catch(e){sigajiCatchWarn("js/modules/app-access.js",e);}
  try{renderTHR();}catch(e){sigajiCatchWarn("js/modules/app-access.js",e);}
  try{if(typeof renderPesangon==='function')renderPesangon();}catch(e){console.error('renderPesangon',e);}
  try{loadPrsForm();}catch(e){sigajiCatchWarn("js/modules/app-access.js",e);}
  try{renderUsers();renderPermMatrix();}catch(e){sigajiCatchWarn("js/modules/app-access.js",e);}
  try{populatePhkAlasanSelect();renderMigrationStatus();}catch(e){sigajiCatchWarn("js/modules/app-access.js",e);}
  if(typeof sigajiBindRpInputs==='function')sigajiBindRpInputs(document.body);
  try{if(typeof sigajiMaybeShowSetupWizard==='function')sigajiMaybeShowSetupWizard();}catch(eWiz){sigajiCatchWarn("js/modules/app-access.js",eWiz);}
  try{if(typeof sigajiMaybeProductTour==='function')sigajiMaybeProductTour();}catch(eTour){sigajiCatchWarn("js/modules/app-access.js",eTour);}
  try{if(typeof sigajiRenderPeriodTimeline==='function')sigajiRenderPeriodTimeline();}catch(eTl){sigajiCatchWarn("js/modules/app-access.js",eTl);}
  try{if(typeof sigajiUiCabangAfterRender==='function')sigajiUiCabangAfterRender();}catch(eCab){sigajiCatchWarn("js/modules/app-access.js",eCab);}
}
if(typeof window!=='undefined')window.renderAllDeferred=renderAllDeferred;
