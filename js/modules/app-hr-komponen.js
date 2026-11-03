/* SiGaji — komponen gaji, slide panel, tunjangan, BPJS, natura */
// ── KOMPONEN GAJI (modul terpisah) ──────────────
function kompgajiRowHtml(k,no){
  const p=PA();const kPer=(p&&p.nama)?resolveKarForPeriode(k,p.nama):k;
  const bpjsKeys=['kes-prs','kes-kar','jht-prs','jht-kar','jp-prs','jp-kar','jkk-prs','jkm-prs'];
  const bpjsOn=bpjsKeys.filter(function(key){return bpjsKompAktif(kPer,key);}).length;
  const bst=bpjsOn===8?'b-ok':bpjsOn>0?'b-warn':'b-err';
  const bpjsLbl=bpjsOn===8?'Lengkap':bpjsOn===0?'Off':bpjsOn+'/8';
  const nTunj=(kPer.tunjangan||[]).length;
  const nNat=(kPer.natura||[]).length;
  const showGapok=CU&&(CU.role==='Admin'||canAccessPayrollSub('gaji'));
  const siklusKg=karSiklusGajiOf(kPer.siklus_gaji?kPer:k);
  const sufKg=siklusKg==='harian'?' /hari':siklusKg==='mingguan'?' /mg':'';
  return`<tr><td class="text-center text-muted fw-700 sticky-no">${no}</td><td class="sticky-name"><div class="fl gap2 items-center"><div class="ka">${ini(k.nama)}</div><div><div class="knl"${sigajiDataAction('open-payroll',{nik:k.nik})}>${escapeHtml(k.nama)} &#8599;</div><div class="u-muted-10">${escapeHtml(k.nik)}</div></div></div></td><td>${escapeHtml(k.dept)}</td>${showGapok?`<td class="num cell-money">${fmt(kPer.gapok||0)}${sufKg?`<div class="u-muted-10">${sufKg.trim()}</div>`:''}</td>`:'<td>—</td>'}<td><span class="bdg ${bst}">${escapeHtml(bpjsLbl)}</span></td><td>${nTunj} item</td><td>${nNat} item</td><td><button class="btn btn-sm btn-p"${sigajiDataAction('open-payroll',{nik:k.nik})}>Edit Komponen</button></td></tr>`;
}
function renderKompgaji(){
  if(typeof sigajiWithSkeleton==='function'){
    return sigajiWithSkeleton('tb-kompgaji',8,renderKompgajiBody);
  }
  renderKompgajiBody();
}
function renderKompgajiBody(){
  const p=PA();
  const list=karyawanListPeriode(p);
  const el=document.getElementById('kg-count');if(el)el.textContent=list.length+' karyawan • Periode aktif: '+(p&&p.nama?p.nama:'-');
  const tb=document.getElementById('tb-kompgaji');if(!tb)return;
  var rows=list.map((k,i)=>kompgajiRowHtml(k,i+1));
  if(typeof sigajiSetTbodyRows==='function')sigajiSetTbodyRows(tb,rows);
  else tb.innerHTML=rows.join('');
}
function filterKompgaji(q){
  const p=PA();
  const r=sortKaryawanByNik(karyawanListPeriode(p).filter(function(k){
    return (k.nama+k.nik+k.dept).toLowerCase().includes(q.toLowerCase());
  }));
  const el=document.getElementById('kg-count');if(el)el.textContent=r.length+' ditampilkan';
  var tb=document.getElementById('tb-kompgaji');
  var rows=r.map((k,i)=>kompgajiRowHtml(k,i+1));
  if(tb&&typeof sigajiSetTbodyRows==='function')sigajiSetTbodyRows(tb,rows);
  else if(tb)tb.innerHTML=rows.join('');
}
function hapusKar(nik){
  const k=karyawan.find(x=>x.nik===nik);
  if(!k||k.dihapusPada)return;
  sigajiConfirm({title:'Hapus karyawan',message:'Pindahkan "'+k.nama+'" ke sampah?\n\nNIK: '+k.nik+'\nBisa dipulihkan dari tab Sampah selama 30 hari. Absensi dan lembur ikut tersimpan.',danger:true,okText:'Ya, ke sampah'}).then(function(ok){
    if(!ok)return;
    k.dihapusPada=new Date().toISOString();
    saveAll();
    if(typeof closePanel==='function')try{closePanel();}catch(eC){sigajiCatchWarn('js/modules/app-hr.js',eC);}
    renderKar();renderDash();populateSelects();
    if(typeof sigajiToastUndo==='function'){
      sigajiToastUndo('Karyawan dipindah ke sampah.','Urungkan',function(){pulihkanKar(nik);});
    }else toast('Karyawan dipindah ke sampah (30 hari).');
  });
}
function pulihkanKar(nik){
  const k=karyawan.find(x=>x.nik===nik);
  if(!k||!k.dihapusPada)return;
  delete k.dihapusPada;
  saveAll();
  renderKar();renderDash();populateSelects();
  toast('Karyawan dipulihkan');
}
function hapusKarPermanen(nik){
  const k=karyawan.find(x=>x.nik===nik);
  if(!k)return;
  sigajiConfirm({title:'Hapus permanen',message:'Hapus permanen "'+k.nama+'"?\n\nNIK: '+k.nik+'\nAbsensi dan lembur ikut terhapus. Tidak dapat dibatalkan.',danger:true,okText:'Ya, hapus permanen'}).then(function(ok){
    if(!ok)return;
    karyawan=karyawan.filter(x=>x.nik!==nik);
    delete absensi[nik];
    delete lembur[nik];
    saveAll();
    renderKar();renderDash();populateSelects();
    toast('Karyawan dihapus permanen');
  });
}
function openNewKar(tipe){
  if(!canAccessSubTab('karyawan','info')){toast('Tidak punya akses menambah profil karyawan');return;}
  if(typeof sigajiAssertCanAddActiveEmployees==='function'&&!sigajiAssertCanAddActiveEmployees(1))return;
  tipe=(tipe==='tidak_tetap')?'tidak_tetap':'tetap';
  var cf=typeof sigajiGetCabangFilter==='function'?sigajiGetCabangFilter():'';
  var sk=typeof sigajiNewKaryawanSkeleton==='function'?sigajiNewKaryawanSkeleton(tipe,cf||'utama'):{nik:nextNikOtomatis(tipe),tipe_kerja:tipe,nama:'Karyawan Baru',status:'Tetap',dept:'Operasional',jabatan:'Staff',grade:'',masuk:new Date().toISOString().split('T')[0],ptkp:'TK0',gapok:5000000,tunjangan:[],potongan:[],bpjs_aktif:{},natura:[],pph_return:{nilai:0,ket:''},_new:true,_gajiTplFresh:true};
  if(cf)sk.cabangId=cf;
  karyawan.push(sk);
  saveAll();renderKar();populateSelects();openPanel(sk.nik);
  toast((tipe==='tidak_tetap'?'Pegawai tidak tetap':'Pegawai tetap')+' '+sk.nik+' dibuat');
}
// ── SLIDE PANEL KARYAWAN (profil SDM) ──────────
function openPanel(nik){
  if(!canAccessModule('karyawan')){toast('Tidak punya akses modul Master Karyawan');return;}
  closePayrollPanel();
  const k=karyawan.find(x=>x.nik===nik);if(!k)return;cpNik=nik;
  document.getElementById('sp-nik').textContent=k.nik;document.getElementById('sp-name').textContent=k.nama;document.getElementById('sp-sub').textContent=k.jabatan+' \u2014 '+k.dept;document.getElementById('sp-saved-lbl').textContent='ID: '+k.nik;
  const sv=(id,v)=>{const e=document.getElementById(id);if(e)e.value=v??'';};
  const isNew=k._new;
  if(isNew)delete k._new;
  var tipe=typeof sigajiNormalizeKarTipe==='function'?sigajiNormalizeKarTipe(k.tipe_kerja,k):'tetap';
  k.tipe_kerja=tipe;
  var tipeEl=document.getElementById('sp-tipe-kerja-f');if(tipeEl)tipeEl.value=tipe;
  k.siklus_gaji=karSiklusGajiOf(k);
  k.hari_gaji=typeof normalizeHariGaji==='function'?normalizeHariGaji(k.hari_gaji):5;
  var hgEl=document.getElementById('sp-hari-gaji-f');if(hgEl)hgEl.value=String(k.hari_gaji);
  sv('sp-nik-f',k.nik);sv('sp-nama-f',isNew?'':k.nama);sv('sp-jk-f',k.jk);sv('sp-agama-f',k.agama);
  onSpTipeKerjaChange();
  syncSiklusGajiLabels(k);
  sv('sp-ktp-f',isNew?'':k.ktp);sv('sp-npwp-f',isNew?'':k.npwp);sv('sp-bpjs-kpj-f',isNew?'':k.bpjs_kpj);sv('sp-bpjs-kes-f',isNew?'':k.bpjs_kes_kartu);sv('sp-hp-f',isNew?'':k.hp);sv('sp-email-f',isNew?'':k.email);sv('sp-alamat-f',isNew?'':k.alamat);
  try{if(typeof sigajiRefreshSpTaxIdHint==='function')sigajiRefreshSpTaxIdHint();}catch(eTax){sigajiCatchWarn("js/modules/app-hr.js",eTax);}
  sv('sp-dept-f',k.dept);sv('sp-jabatan-f',isNew?'':k.jabatan);sv('sp-grade-f',isNew?'':(k.grade||''));sv('sp-status-f',k.status);sv('sp-masuk-f',isNew?'':k.masuk);sv('sp-berhenti-f',k.tgl_berhenti||'');
  try{if(typeof populateGajiTplDatalists==='function')populateGajiTplDatalists();if(typeof refreshSpGajiTplHint==='function')refreshSpGajiTplHint();}catch(eGt){sigajiCatchWarn("js/modules/app-hr-komponen.js",eGt);}
  try{if(typeof sigajiPopulateKarCabangSelect==='function')sigajiPopulateKarCabangSelect();}catch(eCb){sigajiCatchWarn("js/modules/app-hr.js",eCb);}
  var cabEl=document.getElementById('sp-cabang-f');if(cabEl&&typeof sigajiKarCabangId==='function')cabEl.value=sigajiKarCabangId(k);
  populatePhkAlasanSelect();
  var spa=document.getElementById('sp-phk-alasan');if(spa)spa.value=(k.phk&&k.phk.alasan)?k.phk.alasan:'';
  toggleSpPhkWrap();
  sv('sp-ptkp-f',k.ptkp||'TK0');sv('sp-atasan-f',isNew?'':k.atasan);sv('sp-lokasi-f',isNew?'':k.lokasi);
  sv('sp-bank-f',k.bank||'BCA');sv('sp-norek-f',isNew?'':k.norek||'');
  sv('sp-reknam-f',k.reknam||k.nama||'');
  const re=document.getElementById('sp-reknam-f');if(re)re.dataset.manualEdit=(k.reknam&&k.reknam!==k.nama)?'1':'';
  var ptkpSel=document.getElementById('sp-ptkp-f');if(ptkpSel)delete ptkpSel.dataset.femaleOverride;
  if(typeof isJkPerempuan==='function'&&isJkPerempuan(k.jk)){
    if(ptkpSel)ptkpSel.value='TK0';
  }
  updatePTKPVal();
  if(typeof applyPtkpFieldState==='function')applyPtkpFieldState();
  sigajiCloseNavDrawer();
  document.getElementById('slide-panel').classList.add('show');document.getElementById('panel-overlay').classList.add('show');
  document.body.classList.add('sigaji-kar-panel-open');document.body.classList.remove('sigaji-payroll-panel-open');
  try{
    if(typeof sigajiApplyPanelDockForViewport==='function')sigajiApplyPanelDockForViewport();
    else if(typeof sigajiSetPanelDock==='function')sigajiSetPanelDock(window.matchMedia('(min-width:1200px)').matches);
  }catch(eDock){sigajiCatchWarn("js/modules/app-hr.js",eDock);}
  try{
    var spBody=document.querySelector('#slide-panel .spb');
    if(spBody)spBody.scrollTop=0;
  }catch(eScr){sigajiCatchWarn("js/modules/app-hr.js",eScr);}
  try{
    var spTg=document.getElementById('sp-btn-telegram');
    if(spTg)spTg.style.display=CU&&(CU.role==='Admin'||CU.role==='HRD')?'inline-block':'none';
  }catch(eTg){sigajiCatchWarn("js/modules/app-hr.js",eTg);}
}

function openTelegramModalForNik(nik){
  try{
    var k=karyawan.find(function(x){return x.nik===nik;});
    if(!k){toast('Karyawan tidak ditemukan');return;}
    document.getElementById('tg-nik').value=nik;
    document.getElementById('tg-nama').value=k.nama||'';
    document.getElementById('tg-code').value='';
    var stEl=document.getElementById('tg-link-status');
    if(stEl)stEl.textContent='Memeriksa status tautan…';
    var btnUn=document.getElementById('tg-btn-unlink');
    if(btnUn)btnUn.style.display='none';
    openModal('m-tg');
    refreshTelegramModalStatus(nik);
  }catch(e){console.error(e);toast('Gagal membuka Telegram');}
}
async function refreshTelegramModalStatus(nik){
  var stEl=document.getElementById('tg-link-status');
  var btnUn=document.getElementById('tg-btn-unlink');
  try{
    var st=typeof telegramGetLinkStatus==='function'?await telegramGetLinkStatus(nik):null;
    if(!st){
      if(stEl)stEl.innerHTML='<span class="text-muted">Status tidak bisa dicek (cloud / API).</span>';
      if(btnUn)btnUn.style.display='none';
      return;
    }
    if(st.linked){
      var u=(st.link&&st.link.tg_username)?' @'+st.link.tg_username:'';
      var nm=[st.link&&st.link.tg_first_name,st.link&&st.link.tg_last_name].filter(Boolean).join(' ');
      if(stEl)stEl.innerHTML='<span class="bdg b-ok">Tertaut</span> '+escapeHtml(nm||'')+escapeHtml(u)+
        (st.link&&st.link.linked_at?' <span class="u-muted-10">· sejak '+fmtDate(String(st.link.linked_at).substring(0,10))+'</span>':'');
      if(btnUn)btnUn.style.display='inline-block';
    }else{
      if(stEl)stEl.innerHTML='<span class="bdg b-gray">Belum tertaut</span> — buat kode lalu minta karyawan /start.';
      if(btnUn)btnUn.style.display='none';
    }
  }catch(e){
    if(stEl)stEl.textContent='Gagal cek status.';
    if(btnUn)btnUn.style.display='none';
  }
}
/** Dari panel samping profil karyawan: sama dengan tombol Telegram di tabel Master. */
function openTelegramFromKarPanel(){
  if(!CU||(CU.role!=='Admin'&&CU.role!=='HRD')){toast('Hanya Admin/HRD');return;}
  if(!cpNik){toast('Buka profil karyawan dulu');return;}
  openTelegramModalForNik(cpNik);
}

async function tgBuatKode(){
  const nik=(document.getElementById('tg-nik')&&document.getElementById('tg-nik').value)||'';
  if(!nik){toast('NIK kosong');return;}
  const r=await telegramCreateLinkCode(nik);
  if(!r)return;
  document.getElementById('tg-code').value=r.code;
  toast('Kode dibuat (berlaku 30 menit)');
}
async function tgPutusTautan(){
  const nik=(document.getElementById('tg-nik')&&document.getElementById('tg-nik').value)||'';
  if(!nik){toast('NIK kosong');return;}
  var nama=(document.getElementById('tg-nama')&&document.getElementById('tg-nama').value)||nik;
  var ok=true;
  if(typeof sigajiConfirm==='function'){
    ok=await sigajiConfirm({
      title:'Putus tautan Telegram?',
      message:'Putus tautan Telegram untuk '+nama+' ('+nik+')?\n\nSlip tidak bisa dikirim ke bot sampai di-link ulang.',
      danger:true,
      okText:'Ya, putus tautan'
    });
  }else{
    ok=confirm('Putus tautan Telegram '+nama+'?');
  }
  if(!ok)return;
  var done=await telegramUnlinkNik(nik);
  if(!done)return;
  document.getElementById('tg-code').value='';
  toast('Tautan Telegram diputus');
  refreshTelegramModalStatus(nik);
}
if(typeof window!=='undefined'){
  window.openTelegramModalForNik=openTelegramModalForNik;
  window.openTelegramFromKarPanel=openTelegramFromKarPanel;
  window.tgBuatKode=tgBuatKode;
  window.tgPutusTautan=tgPutusTautan;
  window.refreshTelegramModalStatus=refreshTelegramModalStatus;
}
function closePanel(){
  sigajiCloseNavDrawer();
  document.getElementById('slide-panel').classList.remove('show');
  document.body.classList.remove('sigaji-kar-panel-open');
  if(!document.getElementById('slide-panel-payroll').classList.contains('show')){
    document.getElementById('panel-overlay').classList.remove('show');
    try{if(typeof sigajiSetPanelDock==='function')sigajiSetPanelDock(false);}catch(eDock){sigajiCatchWarn("js/modules/app-hr.js",eDock);}
  }
  cpNik=null;
}
function closeAnyPanel(){closePanel();closePayrollPanel();}
// ── SLIDE PANEL KOMPONEN GAJI ────────────────────
const PAYROLL_SP_TABS=[['sp-gaji','gaji'],['sp-bpjs','bpjs'],['sp-natura','natura'],['sp-pphret','pphret'],['sp-ring','ring']];
function applyPayrollSpTabSimpleUi(){
  var wrap=document.getElementById('payroll-spt-wrap');
  if(!wrap)return;
  wrap.querySelectorAll('.spt[data-kgstab]').forEach(function(el){
    el.classList.remove('u-hidden');
    el.style.removeProperty('display');
  });
  var btn=document.getElementById('payroll-sp-more-btn');
  if(btn)btn.style.display='none';
}
function sigajiTogglePayrollAdvTabs(){
  var wrap=document.getElementById('payroll-spt-wrap');
  if(!wrap)return;
  wrap.dataset.payrollAdvShow=wrap.dataset.payrollAdvShow==='1'?'0':'1';
  applyPayrollSpTabSimpleUi();
}
if(typeof window!=='undefined')window.sigajiTogglePayrollAdvTabs=sigajiTogglePayrollAdvTabs;
function applyPayrollSlideTabsVisibility(){
  /** @type {{btn: Element, tid: string}|null} */
  let first=null;
  PAYROLL_SP_TABS.forEach(function(pair){
    var tid=pair[0],sub=pair[1];
    var ok=canAccessPayrollSub(sub);
    var btn=document.querySelector('#slide-panel-payroll .spt[data-kgstab="'+sub+'"]');
    if(btn){btn.style.display=ok?'':'none';if(ok&&!first)first={btn:btn,tid:tid};}
    var d=document.getElementById(tid);
    if(d&&typeof sigajiSetPanelVisible==='function')sigajiSetPanelVisible(d,false);
    else if(d)d.style.display='none';
  });
  applyPayrollSpTabSimpleUi();
  if(!first){toast('Role Anda tidak punya akses tab Komponen Gaji.');return false;}
  switchPayrollSpTab(first.btn,first.tid);
  return true;
}
function openPayrollPanel(nik){
  if(!canAccessModule('kompgaji')){toast('Tidak punya akses modul Komponen Gaji');return;}
  closePanel();
  const k=karyawan.find(x=>x.nik===nik);if(!k)return;cpNik=nik;
  spPayrollView='periode';
  document.getElementById('kg-sp-nik').textContent=k.nik;document.getElementById('kg-sp-name').textContent=k.nama;document.getElementById('kg-sp-sub').textContent=k.jabatan+' \u2014 '+k.dept;document.getElementById('kg-sp-saved-lbl').textContent='ID: '+k.nik;
  const sv=(id,v)=>{const e=document.getElementById(id);if(e)e.value=v??'';};
  var kp=getPayrollTargetByNik(k.nik,true,'periode')||k;
  if(canAccessPayrollSub('gaji'))syncGapokRpInput(document.getElementById('sp-gapok-f'),kp.gapok||0);
  else syncGapokRpInput(document.getElementById('sp-gapok-f'),0);
  syncSiklusGajiLabels({siklus_gaji:(kp&&kp.siklus_gaji)||k.siklus_gaji});
  if(canAccessPayrollSub('pphret')){
    syncPphRetRpInput(document.getElementById('sp-pphret-val'),kp.pph_return?.nilai||0);
    sv('sp-pphret-ket',kp.pph_return?.ket||'');
  }else{
    syncPphRetRpInput(document.getElementById('sp-pphret-val'),0);
    sv('sp-pphret-ket','');
  }
  if(canAccessPayrollSub('gaji')){renderTunjPanel(kp);renderPotPanel(kp);}else{const tj=document.getElementById('tunj-list'),pt=document.getElementById('pot-list');if(tj)tj.innerHTML='';if(pt)pt.innerHTML='';}
  if(canAccessPayrollSub('bpjs'))loadBPJSPanel(kp);else{const k1=document.getElementById('bpjs-kes-rows'),k2=document.getElementById('bpjs-tk-rows');if(k1)k1.innerHTML='';if(k2)k2.innerHTML='';}
  if(canAccessPayrollSub('natura')){renderNaturaPanel(kp);document.getElementById('natura-kar-lbl').textContent=k.nama;}
  else{const nl=document.getElementById('natura-list'),nt=document.getElementById('natura-total');if(nl)nl.innerHTML='';if(nt)nt.innerHTML='';}
  if(canAccessPayrollSub('pphret'))renderPPhRetPanel(kp);else{const el=document.getElementById('pphret-preview');if(el)el.innerHTML='';}
  sigajiCloseNavDrawer();
  document.getElementById('slide-panel-payroll').classList.add('show');document.getElementById('panel-overlay').classList.add('show');
  document.body.classList.add('sigaji-payroll-panel-open');document.body.classList.remove('sigaji-kar-panel-open');
  try{
    if(typeof sigajiApplyPanelDockForViewport==='function')sigajiApplyPanelDockForViewport();
    else if(typeof sigajiSetPanelDock==='function')sigajiSetPanelDock(window.matchMedia('(min-width:1200px)').matches);
  }catch(eDock){sigajiCatchWarn("js/modules/app-hr.js",eDock);}
  if(!applyPayrollSlideTabsVisibility()){closePayrollPanel();return;}
  setSpPayrollView('periode');
  syncPphReturnFieldState();
  updateGajiSummary();
  bindPayrollRpInputs();
}
function closePayrollPanel(){
  sigajiCloseNavDrawer();
  document.getElementById('slide-panel-payroll').classList.remove('show');
  document.body.classList.remove('sigaji-payroll-panel-open');
  if(!document.getElementById('slide-panel').classList.contains('show')){
    document.getElementById('panel-overlay').classList.remove('show');
    try{if(typeof sigajiSetPanelDock==='function')sigajiSetPanelDock(false);}catch(eDock){sigajiCatchWarn("js/modules/app-hr.js",eDock);}
  }
  cpNik=null;
}
function simpanPayrollPanel(){
  const k=karyawan.find(x=>x.nik===cpNik);if(!k)return;
  const gv=id=>{const e=document.getElementById(id);return e?e.value:'';};
  var pAktif=PA();
  var locked=!!(pAktif&&pAktif.nama&&isPeriodeLocked(pAktif.nama));
  var tgt=getPayrollTargetByNik(k.nik,true,spPayrollView||'periode');
  if(!locked&&tgt){
    if(canAccessPayrollSub('gaji')&&isPayrollSnapshotMode())tgt.gapok=parseRpInput(gv('sp-gapok-f'));
    if(canAccessPayrollSub('pphret'))tgt.pph_return={nilai:parseRpInput(gv('sp-pphret-val')),ket:gv('sp-pphret-ket')||''};
    logPayrollAudit(k.nik,'Simpan Komponen Gaji',(isPayrollSnapshotMode()?'snapshot':'master')+` gapok=${tgt.gapok||k.gapok} pph_return=${(tgt.pph_return&&tgt.pph_return.nilai)||0}`);
  }
  if(locked&&typeof toast==='function')toast('Periode '+pAktif.nama+' terkunci: snapshot tidak diubah.');
  saveAll();
  renderKompgaji();renderDash();renderPenggajian();renderPPH();if(typeof renderPesangon==='function')renderPesangon();updateGajiSummary();toast('Komponen gaji '+k.nama+' disimpan');
}
async function simpanKarPanel(){
  const k=karyawan.find(x=>x.nik===cpNik);if(!k)return;
  const gv=id=>{const e=document.getElementById(id);return e?e.value:'';};
  const oldNik=k.nik,newNik=gv('sp-nik-f').trim()||k.nik;
  var tipeKerja=gv('sp-tipe-kerja-f')||'tetap';
  var siklusGaji=karSiklusGajiOf({siklus_gaji:gv('sp-siklus-gaji-f')});
  var hariGaji=typeof normalizeHariGaji==='function'?normalizeHariGaji(gv('sp-hari-gaji-f')):5;
  if(typeof sigajiValidateKarNik==='function'){
    var vNik=sigajiValidateKarNik(newNik,tipeKerja,oldNik);
    if(!vNik.ok){toast(vNik.msg);return;}
  }
  var tbh=gv('sp-berhenti-f').trim();
  var phkAl=document.getElementById('sp-phk-alasan');
  if(tbh){
    if(!phkAl||!String(phkAl.value||'').trim()){
      try{if(typeof toggleSpPhkWrap==='function')toggleSpPhkWrap();}catch(eTw){sigajiCatchWarn("js/modules/app-hr.js",eTw);}
      toast('Jika tanggal berhenti diisi, wajib pilih alasan PHK di kolom "Alasan PHK / berhenti" (langsung di bawah tanggal berhenti).');
      try{var wPhk=document.getElementById('sp-phk-wrap');if(wPhk)wPhk.scrollIntoView({block:'center',behavior:'smooth'});}catch(eSc){sigajiCatchWarn("js/modules/app-hr.js",eSc);}
      return;
    }
    if(!k.phk)k.phk={};
    k.phk.alasan=phkAl.value;
  }else{
    delete k.tgl_berhenti;
    delete k.phk;
  }
  var jk=gv('sp-jk-f');
  var newPtkp=gv('sp-ptkp-f')||'TK0';
  var ptkpSel=document.getElementById('sp-ptkp-f');
  var femaleOv=!!(ptkpSel&&ptkpSel.dataset.femaleOverride==='1'&&typeof isSigajiAdminUser==='function'&&isSigajiAdminUser());
  if(typeof isJkPerempuan==='function'&&isJkPerempuan(jk)&&!femaleOv)newPtkp='TK0';
  var oldPtkp=k.ptkp||'TK0';
  if(oldPtkp!==newPtkp&&typeof canEditPtkpStatus==='function'){
    var gate=canEditPtkpStatus(jk,{adminFemaleOverride:femaleOv});
    if(!gate.ok){
      toast(gate.msg||'PTKP terkunci');
      if(ptkpSel){ptkpSel.value=oldPtkp;if(typeof applyPtkpFieldState==='function')applyPtkpFieldState();}
      return;
    }
    if(gate.needConfirm&&typeof sigajiConfirm==='function'){
      var okOv=await sigajiConfirm({
        title:'Override PTKP (Admin)?',
        message:'Status PTKP biasanya hanya diubah di Januari (awal tahun pajak).\n\n'+
          (k.nama||'')+': '+oldPtkp+' → '+newPtkp+'\n\nLanjutkan override Admin?',
        danger:true,
        okText:'Ya, override'
      });
      if(!okOv){
        if(ptkpSel){ptkpSel.value=oldPtkp;if(typeof applyPtkpFieldState==='function')applyPtkpFieldState();}
        return;
      }
    }
  }
  if(oldPtkp!==newPtkp&&typeof sigajiCatatPtkpKaryawan==='function')sigajiCatatPtkpKaryawan(k,newPtkp);
  var jabatanBaru=gv('sp-jabatan-f');
  var gradeBaru=gv('sp-grade-f');
  var appliedTpl=false;
  try{
    if(typeof maybeApplyGajiTplOnSave==='function')appliedTpl=!!(await maybeApplyGajiTplOnSave(k,jabatanBaru,gradeBaru));
  }catch(eTpl){sigajiCatchWarn("js/modules/app-hr-komponen.js",eTpl);}
  if(appliedTpl&&k.siklus_gaji){
    siklusGaji=karSiklusGajiOf(k);
    var sikEl=document.getElementById('sp-siklus-gaji-f');
    if(sikEl)sikEl.value=siklusGaji;
  }
  Object.assign(k,{nik:newNik,tipe_kerja:tipeKerja,siklus_gaji:siklusGaji,hari_gaji:hariGaji,nama:gv('sp-nama-f'),dept:gv('sp-dept-f'),jabatan:jabatanBaru,grade:gradeBaru,status:gv('sp-status-f'),masuk:gv('sp-masuk-f'),tgl_berhenti:tbh||undefined,ptkp:newPtkp,atasan:gv('sp-atasan-f'),lokasi:gv('sp-lokasi-f'),bank:gv('sp-bank-f'),norek:gv('sp-norek-f'),reknam:gv('sp-reknam-f'),jk:jk,agama:gv('sp-agama-f'),ktp:gv('sp-ktp-f'),npwp:gv('sp-npwp-f'),bpjs_kpj:gv('sp-bpjs-kpj-f'),bpjs_kes_kartu:gv('sp-bpjs-kes-f'),hp:gv('sp-hp-f'),email:gv('sp-email-f'),alamat:gv('sp-alamat-f')});
  delete k._gajiTplFresh;
  if(typeof sigajiMultiBranchEnabled==='function'&&sigajiMultiBranchEnabled()&&typeof sigajiCanAssignCabang==='function'&&sigajiCanAssignCabang()){
    var cabInp=document.getElementById('sp-cabang-f');
    if(cabInp)k.cabangId=cabInp.value||'utama';
  }
  try{
    var pAktif=typeof PA==='function'?PA():null;
    if(pAktif&&pAktif.nama&&typeof isPeriodeLocked==='function'&&!isPeriodeLocked(pAktif.nama)&&typeof karSnapshot!=='undefined'&&karSnapshot[pAktif.nama]&&karSnapshot[pAktif.nama][k.nik]){
      karSnapshot[pAktif.nama][k.nik].siklus_gaji=siklusGaji;
      karSnapshot[pAktif.nama][k.nik].hari_gaji=hariGaji;
    }
  }catch(eSk){sigajiCatchWarn("js/modules/app-hr.js",eSk);}
  if(newNik!==oldNik){if(absensi[oldNik]){absensi[newNik]=absensi[oldNik];delete absensi[oldNik];}if(lembur[oldNik]){lembur[newNik]=lembur[oldNik];delete lembur[oldNik];}cpNik=newNik;}
  try{if(typeof syncProrataDariResign==='function')syncProrataDariResign(k);}catch(eSync){sigajiCatchWarn("js/modules/app-hr.js",eSync);}
  saveAll();document.getElementById('sp-nik').textContent=k.nik;document.getElementById('sp-name').textContent=k.nama;document.getElementById('sp-sub').textContent=k.jabatan+' \u2014 '+k.dept;
  renderKar();renderKompgaji();renderDash();renderPenggajian();renderPPH();if(typeof renderPesangon==='function')renderPesangon();if(typeof renderAbsensi==='function')renderAbsensi();populateSelects();toast('Profil '+k.nama+' disimpan'+(appliedTpl?' — komponen gaji dari template':''));
  /* Resign: tawarkan putus tautan Telegram (tidak otomatis — harus konfirmasi). */
  if(tbh&&typeof telegramGetLinkStatus==='function'&&typeof telegramUnlinkNik==='function'){
    try{
      var tgSt=await telegramGetLinkStatus(k.nik);
      if(tgSt&&tgSt.linked){
        var putus=false;
        if(typeof sigajiConfirm==='function'){
          putus=await sigajiConfirm({
            title:'Putus tautan Telegram?',
            message:k.nama+' sudah punya tanggal berhenti, tetapi Telegram masih tertaut.\n\nPutus sekarang agar bot slip tidak bisa dipakai lagi?',
            danger:true,
            okText:'Ya, putus tautan',
            cancelText:'Nanti saja'
          });
        }
        if(putus){
          var okU=await telegramUnlinkNik(k.nik);
          if(okU)toast('Tautan Telegram '+k.nama+' diputus');
        }
      }
    }catch(eTg){sigajiCatchWarn("js/modules/app-hr.js",eTg);}
  }
}
function hapusKarFromPanel(){hapusKar(cpNik);}
function renderTunjPanel(k){
  const list=k.tunjangan||[];
  const nik=k.nik;
  const snapMode=isPayrollSnapshotMode();
  const nilaiLock=snapMode?'':' readonly title="Nominal tunjangan diisi pada mode Snapshot Periode"';
  const nilaiCls=snapMode?'comp-inp inp-rp':'comp-inp inp-rp snap-field-disabled';
  document.getElementById('tunj-list').innerHTML=list.length?list.map(function(t,i){
    const showThr=t.tipe==='tetap'||t.tipe==='tetap_no_bpjs';
    const thrIkut=showThr&&t.thr_ikut!==false;
    const prIkut=t.prorata_ikut!==false;
    const sel1=Object.entries(TUNJ_TYPES).map(function(e){return'<option value="'+e[0]+'" '+(t.tipe===e[0]?'selected':'')+'>'+e[1]+'</option>';}).join('');
    return '<div class="tr-row payroll-tunj-row">'
      +'<input class="comp-inp" value="'+escapeAttr(t.nama)+'" placeholder="Nama tunjangan" data-nik="'+escapeAttr(nik)+'" data-i="'+i+'" data-f="nama" data-sigaji-action="call-value" data-fn="updTunjEl" data-arg="$this">'
      +'<input type="text" class="'+nilaiCls+'" value="'+t.nilai+'" placeholder="Nominal (Rp)"'+nilaiLock+' data-nik="'+escapeAttr(nik)+'" data-i="'+i+'" data-f="nilai" data-rp="1" data-sigaji-action="call-value" data-fn="updTunjEl" data-arg="$this">'
      +'<select class="comp-inp" data-nik="'+escapeAttr(nik)+'" data-i="'+i+'" data-f="tipe" data-sigaji-action="call-value" data-fn="updTunjEl" data-arg="$this">'+sel1+'</select>'
      +'<select class="comp-inp" title="Ikut THR?" style="'+(showThr?'':'opacity:.35;pointer-events:none')+'" data-nik="'+escapeAttr(nik)+'" data-i="'+i+'" data-f="thr_ikut" data-sigaji-action="call-value" data-fn="updTunjEl" data-arg="$this">'
        +'<option value="ya" '+(thrIkut?'selected':'')+'>THR</option>'
        +'<option value="tidak" '+(!thrIkut?'selected':'')+'>Excl</option>'
      +'</select>'
      +'<select class="comp-inp" title="Ikut perhitungan prorata gaji?" data-nik="'+escapeAttr(nik)+'" data-i="'+i+'" data-f="prorata_ikut" data-sigaji-action="call-value" data-fn="updTunjEl" data-arg="$this">'
        +'<option value="ya" '+(prIkut?'selected':'')+'>Prorata</option>'
        +'<option value="tidak" '+(!prIkut?'selected':'')+'>Penuh</option>'
      +'</select>'
      +'<button type="button" class="btn btn-xs btn-r"'+sigajiDataAction('del-tunj',{nik:nik,i:i})+'>&#10007;</button>'
    +'</div>';
  }).join(''):'<div class="font-12 text-muted" style="padding:.5rem">Belum ada tunjangan.</div>';
  sigajiBindRpInputs(document.getElementById('tunj-list'));
}
function refreshTunjPanel(nik){
  const k=getPayrollTargetByNik(nik,true);
  if(k)renderTunjPanel(k);
}
function updTunjEl(el){
  if(el.dataset.f==='nilai'&&!isPayrollSnapshotMode()){toast('Nominal tunjangan diubah pada mode Snapshot Periode');el.blur();return;}
  if(!guardPayrollEditUnlocked())return;
  const nik=el.dataset.nik;const i=parseInt(el.dataset.i);const f=el.dataset.f;
  let v=el.value;
  if(f==='nilai'||el.dataset.rp==='1')v=parseRpInput(v);
  else if(el.dataset.num)v=parseFloat(v)||0;
  if(f==='thr_ikut'||f==='prorata_ikut')v=v==='ya';
  updTunj(nik,i,f,v);
  if(f==='tipe'&&typeof refreshTunjPanel==='function')refreshTunjPanel(nik);
}
function delTunjEl(el){delTunj(el.dataset.nik,parseInt(el.dataset.i));}
function renderPotPanel(k){const list=k.potongan||[];document.getElementById('pot-list').innerHTML=list.length?list.map((p,i)=>`<div class="tr-row payroll-pot-row"><input class="comp-inp" value="${escapeAttr(p.nama)}" placeholder="Nama potongan"${sigajiDataAction('upd-pot',{nik:k.nik,i:i,f:'nama'})}><input type="text" class="comp-inp inp-rp" value="${p.nilai}" data-rp="1" placeholder="Nominal"${sigajiDataAction('upd-pot',{nik:k.nik,i:i,f:'nilai'})}><input class="comp-inp" value="${escapeAttr(p.ket||'')}" placeholder="Ket."${sigajiDataAction('upd-pot',{nik:k.nik,i:i,f:'ket'})}><button type="button" class="btn btn-xs btn-r"${sigajiDataAction('del-pot',{nik:k.nik,i:i})}>&#10007;</button></div>`).join(''):'<div class="font-12 text-muted p-empty-sm">Belum ada potongan.</div>';sigajiBindRpInputs(document.getElementById('pot-list'));}
function addTunj(){
  if(!canAccessPayrollSub('gaji'))return;
  if(!guardPayrollEditUnlocked())return;
  const k=getPayrollTargetByNik(cpNik,true);if(!k)return;
  if(!k.tunjangan)k.tunjangan=[];
  k.tunjangan.push({nama:'Komponen Baru',nilai:0,tipe:'tetap',thr_ikut:true,prorata_ikut:true});
  logPayrollAudit(cpNik,'Tambah Tunjangan','Komponen Baru');
  saveAll();
  renderTunjPanel(k);updateGajiSummary();
}
function addPot(){
  if(!canAccessPayrollSub('gaji'))return;
  if(!guardPayrollEditUnlocked())return;
  const k=getPayrollTargetByNik(cpNik,true);if(!k)return;
  if(!k.potongan)k.potongan=[];
  k.potongan.push({nama:'Potongan Baru',nilai:0,ket:''});
  logPayrollAudit(cpNik,'Tambah Potongan','Potongan Baru');
  saveAll();
  renderPotPanel(k);updateGajiSummary();
}
function updTunj(nik,i,f,v){
  if(!guardPayrollEditUnlocked())return;
  const k=getPayrollTargetByNik(nik,true);if(!k)return;
  const before=deepCloneLite(k.tunjangan&&k.tunjangan[i]?k.tunjangan[i][f]:undefined);
  k.tunjangan[i][f]=v;
  logPayrollAudit(nik,'Update Tunjangan',`idx=${i} field=${f} ${String(before)} → ${String(v)}`);
  saveAll();
  updateGajiSummary();
}
function updPot(nik,i,f,v){
  if(!guardPayrollEditUnlocked())return;
  const k=getPayrollTargetByNik(nik,true);if(!k)return;
  const before=deepCloneLite(k.potongan&&k.potongan[i]?k.potongan[i][f]:undefined);
  k.potongan[i][f]=v;
  logPayrollAudit(nik,'Update Potongan',`idx=${i} field=${f} ${String(before)} → ${String(v)}`);
  saveAll();
  updateGajiSummary();
}
function delTunj(nik,i){
  if(!guardPayrollEditUnlocked())return;
  const k=getPayrollTargetByNik(nik,true);if(!k)return;
  const before=deepCloneLite((k.tunjangan||[])[i]||{});
  k.tunjangan.splice(i,1);
  logPayrollAudit(nik,'Hapus Tunjangan',`idx=${i} ${before&&before.nama?before.nama:''}`);
  saveAll();
  renderTunjPanel(k);updateGajiSummary();
}
function delPot(nik,i){
  if(!guardPayrollEditUnlocked())return;
  const k=getPayrollTargetByNik(nik,true);if(!k)return;
  const before=deepCloneLite((k.potongan||[])[i]||{});
  k.potongan.splice(i,1);
  logPayrollAudit(nik,'Hapus Potongan',`idx=${i} ${before&&before.nama?before.nama:''}`);
  saveAll();
  renderPotPanel(k);updateGajiSummary();
}
function updatePTKPVal(){const e=document.getElementById('sp-ptkp-f');const v=document.getElementById('sp-ptkp-val-f');if(!e||!v)return;v.value=fmtPTKPVal(nilaiPTKP(e.value));}
function onNamaChange(){const n=document.getElementById('sp-nama-f')?.value||'';const r=document.getElementById('sp-reknam-f');if(r&&!r.dataset.manualEdit)r.value=n;}
function onReknamEdit(){const e=document.getElementById('sp-reknam-f');if(e)e.dataset.manualEdit='1';}
function formatNPWP(input){let v=input.value.replace(/[^0-9]/g,'');if(v.length>15)v=v.slice(0,15);let r='';if(v.length>0)r+=v.slice(0,2);if(v.length>2)r+='.'+v.slice(2,5);if(v.length>5)r+='.'+v.slice(5,8);if(v.length>8)r+='.'+v.slice(8,9);if(v.length>9)r+='-'+v.slice(9,12);if(v.length>12)r+='.'+v.slice(12,15);input.value=r;}
function onSpNpwpInput(el){
  if(typeof formatNPWP==='function')formatNPWP(el);
  if(typeof sigajiRefreshSpTaxIdHint==='function')sigajiRefreshSpTaxIdHint();
}
// ── BPJS PANEL ──────────────────────────────────
function loadBPJSPanel(k){
  const tB=(k.tunjangan||[]).filter(function(t){return t.tipe==='tetap';}).reduce(function(s,t){return s+sigajiRp(t.nilai);},0);
  const basis=sigajiRp(k.gapok)+tB;const bm=k.bpjs_manual||{};
  const KOMP=[
    {key:'kes-prs',tarif:'4%',lbl:'BPJS Kes Perusahaan (4%)',sec:'kes'},
    {key:'kes-kar',tarif:'1%',lbl:'BPJS Kes Karyawan (1%)',sec:'kes'},
    {key:'jht-prs',tarif:'3,7%',lbl:'JHT Perusahaan (3,7%)',sec:'tk'},
    {key:'jht-kar',tarif:'2%',lbl:'JHT Karyawan (2%)',sec:'tk'},
    {key:'jp-prs',tarif:'2%',lbl:'JP Perusahaan (2%)',sec:'tk'},
    {key:'jp-kar',tarif:'1%',lbl:'JP Karyawan (1%)',sec:'tk'},
    {key:'jkk-prs',tarif:'0,24%',lbl:'JKK Perusahaan (0,24%)',sec:'tk'},
    {key:'jkm-prs',tarif:'0,3%',lbl:'JKM Perusahaan (0,3%)',sec:'tk'}
  ];
  const mkRow=function(c){
    const ok=bpjsKompAktif(k,c.key);
    const def=typeof bpjsKomponenDef==='function'?bpjsKomponenDef(c.key,typeof tglAturanDariPeriode==='function'?tglAturanDariPeriode(typeof PA==='function'?PA():null):''):BPJS_DEF[c.key];const b=def.basis?Math.min(basis,def.basis):basis;
    const autoV=Math.round(b*def.pct/100);const isMn=bm[c.key]!==undefined;bmState[c.key]=isMn;
    const chk='<label class="fl items-center cursor-pointer m-0"><input class="cursor-pointer m-0 chk-brand" type="checkbox" data-nik="'+k.nik+'" data-key="'+c.key+'" '+(ok?'checked':'')+' data-sigaji-action="call-value" data-fn="onBPJSKompChange" data-arg="$this" style="width:15px; height:15px"></label>';
    const nomVal=ok?(isMn?bm[c.key]:autoV):0;
    const nomEl='<input type="text" class="bi inp-rp '+(isMn?'manual':'')+'" id="b-'+c.key+'-v" value="'+formatRpInputNum(nomVal)+'" data-rp="1" '+(!isMn||!ok?'readonly':'')+' data-nik="'+k.nik+'" data-key="'+c.key+'" data-sigaji-action="call-value" data-fn="onBMChange2" data-arg="$this" data-sigaji-live="1">';
    const modeEl=ok?('<button class="tm '+(isMn?'manual':'auto')+'" id="tm-'+c.key+'"'+sigajiDataAction('toggle-manual',{key:c.key})+'>'+(isMn?'Manual':'Auto')+'</button>'):'<span class="bdg b-gray font-10">Off</span>';
    return '<div class="bpjs-row '+(ok?'':'off')+'">'+chk+'<div class="font-11 fw-600">'+c.lbl+'</div><div><input class="bi font-11" value="'+c.tarif+'" readonly></div>'+nomEl+modeEl+'</div>';
  };
  document.getElementById('bpjs-kes-rows').innerHTML=KOMP.filter(function(c){return c.sec==='kes';}).map(mkRow).join('');
  document.getElementById('bpjs-tk-rows').innerHTML=KOMP.filter(function(c){return c.sec==='tk';}).map(mkRow).join('');
  var bpjsRoot=document.getElementById('sp-bpjs');
  if(bpjsRoot&&typeof sigajiBindRpInputs==='function')sigajiBindRpInputs(bpjsRoot);
}
function onBPJSKompChange(el){
  if(!canAccessPayrollSub('bpjs'))return;
  if(!guardPayrollEditUnlocked()){
    const kb=karyawan.find(function(x){return x.nik===el.dataset.nik;});
    if(kb)loadBPJSPanel(kb);
    return;
  }
  const nik=el.dataset.nik;const key=el.dataset.key;
  const k=getPayrollTargetByNik(nik,true);if(!k)return;
  const before=!!(k.bpjs_aktif&&k.bpjs_aktif[key]===true);
  if(!k.bpjs_aktif)k.bpjs_aktif={};
  k.bpjs_aktif[key]=el.checked;
  if(!el.checked&&k.bpjs_manual)delete k.bpjs_manual[key];
  logPayrollAudit(nik,'Update BPJS Aktif',`${key} ${before?'on':'off'} → ${el.checked?'on':'off'}`);
  saveAll();loadBPJSPanel(k);updateGajiSummary();
  // Sinkronkan badge BPJS di tabel Master Karyawan & dashboard ringkas
  try{renderKar();}catch(e){sigajiCatchWarn("js/modules/app-hr.js",e);}
  try{renderDash();}catch(e){sigajiCatchWarn("js/modules/app-hr.js",e);}
}
function onBMChange2(el){
  const nik=el.dataset.nik;const key=el.dataset.key;
  onBMChange(nik,key,el.value);
}
function bpjsSetAll(aktif){
  if(!canAccessPayrollSub('bpjs'))return;
  if(!guardPayrollEditUnlocked())return;
  const k=getPayrollTargetByNik(cpNik,true);if(!k)return;
  if(!k.bpjs_aktif)k.bpjs_aktif={};
  ['kes-prs','kes-kar','jht-prs','jht-kar','jp-prs','jp-kar','jkk-prs','jkm-prs'].forEach(function(key){k.bpjs_aktif[key]=aktif;});
  saveAll();loadBPJSPanel(k);updateGajiSummary();toast(aktif?'Semua BPJS diaktifkan':'Semua BPJS dinonaktifkan');
  try{renderKar();}catch(e){sigajiCatchWarn("js/modules/app-hr.js",e);};try{renderDash();}catch(e){sigajiCatchWarn("js/modules/app-hr.js",e);}
}
function bpjsSetPreset(preset){
  if(!canAccessPayrollSub('bpjs'))return;
  if(!guardPayrollEditUnlocked())return;
  const k=getPayrollTargetByNik(cpNik,true);if(!k)return;
  if(!k.bpjs_aktif)k.bpjs_aktif={};
  if(preset==='jkk-jkm'){
    ['kes-prs','kes-kar','jht-prs','jht-kar','jp-prs','jp-kar','jkk-prs','jkm-prs'].forEach(function(key){
      k.bpjs_aktif[key]=(key==='jkk-prs'||key==='jkm-prs');
    });
  }
  saveAll();loadBPJSPanel(k);updateGajiSummary();toast('Preset diterapkan');
  try{renderKar();}catch(e){sigajiCatchWarn("js/modules/app-hr.js",e);};try{renderDash();}catch(e){sigajiCatchWarn("js/modules/app-hr.js",e);}
}
function onBPJSAktifChange(){const k=karyawan.find(function(x){return x.nik===cpNik;});if(k){loadBPJSPanel(k);updateGajiSummary();}}
function onBMChange(nik,key,val){
  if(!canAccessPayrollSub('bpjs'))return;
  if(!guardPayrollEditUnlocked())return;
  const k=getPayrollTargetByNik(nik,true);if(!k||!bmState[key])return;
  if(!k.bpjs_manual)k.bpjs_manual={};
  const before=k.bpjs_manual[key];
  k.bpjs_manual[key]=parseRpInput(val);
  logPayrollAudit(nik,'Update BPJS Manual',`${key} ${String(before)} → ${String(k.bpjs_manual[key])}`);
  saveAll();
  updateGajiSummary();
}
function toggleManual(key){
  if(!canAccessPayrollSub('bpjs'))return;
  if(!guardPayrollEditUnlocked())return;
  const k=getPayrollTargetByNik(cpNik,true);if(!k)return;if(!k.bpjs_manual)k.bpjs_manual={};
  const isNow=!bmState[key];bmState[key]=isNow;const ve=document.getElementById('b-'+key+'-v');const te=document.getElementById('tm-'+key);
  if(isNow){ve.readOnly=false;ve.className='bi inp-rp manual';ve.setAttribute('data-rp','1');te.textContent='Manual';te.className='tm manual';k.bpjs_manual[key]=parseRpInput(ve.value);ve.oninput=function(){k.bpjs_manual[key]=parseRpInput(ve.value);updateGajiSummary();};if(typeof sigajiBindRpInputs==='function')sigajiBindRpInputs(ve);}
  else{delete k.bpjs_manual[key];ve.readOnly=true;ve.className='bi inp-rp';ve.oninput=null;te.textContent='Auto';te.className='tm auto';const ok=bpjsKompAktif(k,key);if(!ok){ve.value=formatRpInputNum(0);}else{const tB2=(k.tunjangan||[]).filter(t=>t.tipe==='tetap').reduce((s,t)=>s+sigajiRp(t.nilai),0);const b2=sigajiRp(k.gapok)+tB2;const def=typeof bpjsKomponenDef==='function'?bpjsKomponenDef(key,typeof tglAturanDariPeriode==='function'?tglAturanDariPeriode(typeof PA==='function'?PA():null):''):BPJS_DEF[key];const bas=def.basis?Math.min(b2,def.basis):b2;ve.value=formatRpInputNum(Math.round(bas*def.pct/100));}}
  logPayrollAudit(cpNik,'Toggle BPJS Manual',`${key} → ${isNow?'manual':'auto'}`);
  saveAll();
  updateGajiSummary();
  try{renderKar();}catch(e){sigajiCatchWarn("js/modules/app-hr.js",e);};try{renderDash();}catch(e){sigajiCatchWarn("js/modules/app-hr.js",e);}
}
// ── NATURA PANEL ─────────────────────────────────
function naturaListForNikPeriode(nik,pNama){
  if(!nik)return[];
  var k=karyawan.find(function(x){return x.nik===nik;});
  if(!k)return[];
  if(!pNama)return k.natura||[];
  var snap=karSnapshot&&karSnapshot[pNama]&&karSnapshot[pNama][nik];
  if(snap&&snap.natura!==undefined)return snap.natura||[];
  return k.natura||[];
}
function renderNaturaPeriodeHint(nik){
  var el=document.getElementById('natura-periode-hint');
  if(!el||!nik)return;
  var km=karyawan.find(function(x){return x.nik===nik;});
  if(!km){
    if(typeof sigajiHideEl==='function')sigajiHideEl(el);
    else el.style.display='none';
    return;
  }
  var masterN=(km.natura||[]).length;
  var pAct=PA();
  var rows=[];
  (periodes||[]).slice().sort(function(a,b){return String(a.start||'').localeCompare(String(b.start||''));}).forEach(function(p){
    if(!p||!p.nama)return;
    var n=naturaListForNikPeriode(nik,p.nama).length;
    var tag=p.nama+(p.status==='aktif'?' • aktif':'');
    rows.push('<strong>'+escapeHtml(p.nama)+'</strong>: '+n+' baris'+(p.status==='aktif'?' (periode aktif)':''));
  });
  var mode=isPayrollSnapshotMode()?'Snapshot '+((pAct&&pAct.nama)||'-'):'Master global';
  var cur=naturaListForNikPeriode(nik,pAct&&pAct.nama).length;
  var html='<div><strong>Sumber tampilan:</strong> '+escapeHtml(mode)+' — '+String(cur)+' baris natura.</div>'
    +'<div class="mt-xs"><strong>Master global:</strong> '+String(masterN)+' baris. Saat periode baru dibuka, snapshot pertama kali <em>menyalin</em> master (termasuk natura).</div>'
    +(rows.length?'<div class="mt-xs"><strong>Per periode:</strong> '+rows.join(' · ')+'</div>':'')
    +'<div class="mt-xs text-muted">Item seperti "Makan Siang Kantor" Rp 550.000 berasal dari tombol <em>Template Cepat</em> (bukan diisi otomatis sistem).</div>';
  el.innerHTML=html;
  if(typeof sigajiShowEl==='function')sigajiShowEl(el);
  else el.style.display='block';
}
function renderNaturaPanel(k){
  renderNaturaPeriodeHint(k&&k.nik);
  const list=k.natura||[];document.getElementById('natura-list').innerHTML=list.length?list.map((n,i)=>`<div class="nat-row ${n.kp?'kp':''}"><input class="comp-inp font-12 w-full" value="${escapeAttr(n.nama)}"${sigajiDataAction('upd-nat',{nik:k.nik,i:i,f:'nama'})}><input type="text" class="inp-rp comp-inp font-12 w-full" value="${n.nilai}" data-rp="1"${sigajiDataAction('upd-nat',{nik:k.nik,i:i,f:'nilai'})}><select class="comp-inp font-11"${sigajiDataAction('upd-nat',{nik:k.nik,i:i,f:'kp'})}><option value="false" ${!n.kp?'selected':''}>Tidak Kena Pajak</option><option value="true" ${n.kp?'selected':''}>Kena Pajak</option></select><button class="btn btn-xs btn-r"${sigajiDataAction('del-nat',{nik:k.nik,i:i})}>&#10007;</button></div>`).join(''):'<div class="font-12 text-muted p-empty-sm">Belum ada natura.</div>';const kp=list.filter(n=>n.kp).reduce((s,n)=>s+sigajiRp(n.nilai),0);const nkp=list.filter(n=>!n.kp).reduce((s,n)=>s+sigajiRp(n.nilai),0);document.getElementById('natura-total').innerHTML=list.length?`<div class="pph-box"><div class="pr-row-info"><span>Natura Tidak KP</span><span class="ct-success fw-700">${fmt(nkp)}</span></div><div class="pr-row-info"><span>Natura Kena Pajak</span><span class="ct-danger fw-700">${fmt(kp)}</span></div><div class="pph-box-tit"><span>Total</span><span>${fmt(kp+nkp)}</span></div></div>`:'';sigajiBindRpInputs(document.getElementById('natura-list'));
}
function addNatura(){if(!canAccessPayrollSub('natura'))return;if(!guardPayrollEditUnlocked())return;const k=getPayrollTargetByNik(cpNik,true);if(!k)return;if(!k.natura)k.natura=[];k.natura.push({nama:'Natura Baru',nilai:0,kp:false});logPayrollAudit(cpNik,'Tambah Natura','Natura Baru (manual)');saveAll();renderNaturaPanel(k);updateGajiSummary();}
function addNatTmpl(nama,nilai,kp){
  if(!canAccessPayrollSub('natura'))return;
  if(!guardPayrollEditUnlocked())return;
  var modeLbl=isPayrollSnapshotMode()?('snapshot '+((PA()&&PA().nama)||'periode aktif')):'master global';
  if(!confirm('Tambah natura "'+nama+'" ('+fmt(nilai)+') ke '+modeLbl+'?\n\nPastikan ini memang benar — template cepat sering ter-tap tidak sengaja di HP.'))return;
  const k=getPayrollTargetByNik(cpNik,true);if(!k)return;if(!k.natura)k.natura=[];k.natura.push({nama,nilai,kp});
  logPayrollAudit(cpNik,'Tambah Natura (template)',nama+' '+fmt(nilai)+' kp='+(kp?'ya':'tidak'));
  saveAll();renderNaturaPanel(k);updateGajiSummary();toast(nama+' ditambahkan');
}
function updNat(nik,i,f,v){
  if(!guardPayrollEditUnlocked())return;
  const k=getPayrollTargetByNik(nik,true);if(!k)return;
  const before=deepCloneLite(k.natura&&k.natura[i]?k.natura[i][f]:undefined);
  k.natura[i][f]=v;
  logPayrollAudit(nik,'Update Natura',`idx=${i} field=${f} ${String(before)} → ${String(v)}`);
  saveAll();
  renderNaturaPanel(k);updateGajiSummary();
}
function delNat(nik,i){
  if(!guardPayrollEditUnlocked())return;
  const k=getPayrollTargetByNik(nik,true);if(!k)return;
  const before=deepCloneLite((k.natura||[])[i]||{});
  k.natura.splice(i,1);
  logPayrollAudit(nik,'Hapus Natura',`idx=${i} ${before&&before.nama?before.nama:''}`);
  saveAll();
  renderNaturaPanel(k);updateGajiSummary();
}
function renderPPhRetPanel(k){const val=k.pph_return?.nilai||0;const el=document.getElementById('pphret-preview');if(!el)return;el.innerHTML=val>0?`<div class="pr-row-info mt1"><span>Pengembalian ke Take Home</span><span class="ct-success fw-700">${fmt(val)}</span></div>`:'';}
// ── GAJI SUMMARY PANEL ──────────────────────────
function updateGajiSummary(){
  const km=karyawan.find(x=>x.nik===cpNik);if(!km)return;
  const k=getPayrollTargetByNik(cpNik,true)||km;
  const gpEl=document.getElementById('sp-gapok-f');if(gpEl&&isPayrollSnapshotMode())k.gapok=parseRpInput(gpEl.value)||k.gapok;
  let prv=0;
  if(isPayrollSnapshotMode()){
    prv=parseRpInput(document.getElementById('sp-pphret-val')?.value)||0;
    k.pph_return={nilai:prv,ket:document.getElementById('sp-pphret-ket')?.value||''};
  }
  renderPPhRetPanel(k);const g=hitungGaji(km,PA().nama);const el=document.getElementById('gaji-summary-panel');if(!el)return;
  var siklusSm=karSiklusGajiOf(km.siklus_gaji?km:k);
  var h='<div class="gs"><div class="stit" style="margin-top:0">Gross Income (Dasar PPh 21)</div>';
  if(siklusSm!=='bulanan'){
    var sufSm=typeof sigajiSiklusGajiRateSuffix==='function'?sigajiSiklusGajiRateSuffix(siklusSm):siklusSm;
    h+='<div class="gs-row"><span>Tarif '+escapeHtml(sufSm)+'</span><span>'+fmt(k.gapok)+'</span></div>';
  }
  h+='<div class="gs-row"><span>'+(siklusSm==='bulanan'?'Gaji Pokok':'Gaji Pokok sebulan')+'</span><span>'+fmt(g.gapokEff)+'</span></div>';
  g.tItems.forEach(function(t){h+='<div class="gs-row"><span>'+escapeHtml(t.nama)+(t.isHarian?' [Lump Sum]':'')+'</span><span>'+fmt(t.eff)+'</span></div>';});
  if(g.natKP>0)h+='<div class="gs-row"><span>Natura Kena Pajak</span><span>'+fmt(g.natKP)+'</span></div>';
  if(g.lb>0)h+='<div class="gs-row"><span>Uang Lembur</span><span>'+fmt(g.lb)+'</span></div>';
  if(g.thrBruto>0)h+='<div class="gs-row ct-purple fw-700"><span>THR Bruto (digabung ke Gross PPh)</span><span>'+fmt(g.thrBruto)+'</span></div>';
  h+='<div class="gs-row gs-row-total"><span>Total Gross PPh 21</span><span>'+fmt(g.grossPPh)+'</span></div>';
  if(g.thrBruto>0)h+='<div class="thr-callout">THR sudah digabung ke Gross PPh. Take Home akhir bulan = gaji saja (THR dibayar full netto terpisah).</div>';
  h+='<div class="stit">Take Home Bruto (akhir bulan)</div><div class="gs-row"><span>Gaji + Tunjangan + Lembur</span><span>'+fmt(g.brutoTH-g.natNKP)+'</span></div>';
  if(g.natNKP>0)h+='<div class="gs-row"><span>Natura Tidak KP</span><span>'+fmt(g.natNKP)+'</span></div>';
  h+='<div class="gs-row fw-700"><span>Total Take Home Bruto</span><span>'+fmt(g.brutoTH)+'</span></div>';
  h+='<div class="stit">Potongan</div><div class="gs-row"><span>PPh 21'+(g.thrBruto>0?' (incl. PPh THR '+fmt(g.pphAtasThr)+')':'')+'</span><span>&#8212; '+fmt(g.pph)+'</span></div>';
  h+='<div class="gs-row"><span>BPJS Kes Karyawan</span><span>&#8212; '+fmt(g.bpjs.kes_kar)+'</span></div>';
  h+='<div class="gs-row"><span>BPJS JHT Karyawan</span><span>&#8212; '+fmt(g.bpjs.jht_kar)+'</span></div>';
  h+='<div class="gs-row"><span>BPJS JP Karyawan</span><span>&#8212; '+fmt(g.bpjs.jp_kar)+'</span></div>';
  (k.potongan||[]).forEach(function(pot){h+='<div class="gs-row"><span>'+escapeHtml(pot.nama)+'</span><span>&#8212; '+fmt(pot.nilai)+'</span></div>';});
  if(prv>0)h+='<div class="gs-row ct-success"><span>&#9312; Pengembalian PPh</span><span>+ '+fmt(prv)+'</span></div>';
  h+='<div class="gs-total"><span>TAKE HOME PAY (akhir bulan)</span><span>'+fmt(g.neto)+'</span></div>';
  if(g.jadwalBayar&&g.jadwalBayar.items&&g.jadwalBayar.items.length){
    h+='<div class="stit">Jadwal transfer (cadangan PPh+BPJS, tidak minus)</div>';
    g.jadwalBayar.items.forEach(function(it){
      h+='<div class="gs-row"><span>'+escapeHtml(fmtDate(it.tgl))+(it.parsial?' parsial':'')+' · upah '+fmt(it.upah)+'</span><span>'+fmt(it.dibayar)+'</span></div>';
    });
    if(g.jadwalBayar.sisaPotongan>0)h+='<div class="gs-row ct-danger"><span>Sisa potongan (utang)</span><span>'+fmt(g.jadwalBayar.sisaPotongan)+'</span></div>';
  }
  if(g.thrBruto>0){var thrBayarLbl=PA()&&PA().thr_bayar?PA().thr_bayar:'H-7 lebaran';h+='<div class="thr-callout-lg">&#127873; THR '+fmt(g.thrBruto)+' dibayar full netto terpisah pada '+escapeHtml(thrBayarLbl)+'</div>';}
  h+='<div class="stit">Beban Perusahaan</div><div class="gs-row"><span>BPJS Kes Prs</span><span>'+fmt(g.bpjs.kes_prs)+'</span></div>';
  h+='<div class="gs-row"><span>BPJS JHT+JP Prs</span><span>'+fmt(g.bpjs.jht_prs+g.bpjs.jp_prs)+'</span></div>';
  h+='<div class="gs-row"><span>JKK+JKM Prs</span><span>'+fmt(g.bpjs.jkk_prs+g.bpjs.jkm_prs)+'</span></div>';
  h+='<div class="gs-row fw-700"><span>Total Cost of Employment</span><span>'+fmt(g.brutoTH+g.bebanPrs)+'</span></div></div>';
  el.innerHTML=h;
}
