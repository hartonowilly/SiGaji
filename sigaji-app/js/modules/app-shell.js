/* SiGaji — navigasi, init, TER, lisensi UI */
// ── NAVIGASI (drawer HP) ──
function sigajiIsMobileNav(){
  try{
    if(window.matchMedia('(max-width:900px)').matches)return true;
    if(window.matchMedia('(hover:none) and (pointer:coarse)').matches)return true;
  }catch(e){}
  return false;
}
function sigajiApplyMobileNavMode(){
  var on=sigajiIsMobileNav();
  try{document.documentElement.classList.toggle('sigaji-mobile-nav',on);}catch(e){}
  if(on)sigajiMountNavToBody();
  else{sigajiCloseNavDrawer();sigajiRestoreNavDom();}
}
function sigajiRestoreNavDom(){
  var sb=document.getElementById('sidebar-wrap');
  var bd=document.getElementById('nav-backdrop');
  var app=document.getElementById('app');
  var layout=document.querySelector('.layout');
  var slot=layout?layout.querySelector('.sidebar-slot'):null;
  if(!sb||!bd||!app||!layout)return;
  if(bd.parentNode!==app){
    var topbar=app.querySelector('.topbar');
    if(topbar&&topbar.nextSibling)app.insertBefore(bd,topbar.nextSibling);
    else app.insertBefore(bd,layout);
  }
  if(sb.parentNode!==layout){
    if(slot&&slot.nextSibling)layout.insertBefore(sb,slot.nextSibling);
    else layout.insertBefore(sb,layout.firstChild);
  }
}
function sigajiMountNavToBody(){
  if(!sigajiIsMobileNav()||!document.body.classList.contains('sigaji-app-active')){
    sigajiRestoreNavDom();
    return;
  }
  var sb=document.getElementById('sidebar-wrap');
  var bd=document.getElementById('nav-backdrop');
  if(!sb||!bd)return;
  if(bd.parentNode!==document.body)document.body.appendChild(bd);
  if(sb.parentNode!==document.body)document.body.appendChild(sb);
}
function sigajiSyncNavDrawerA11y(){
  try{
    var open=document.documentElement.classList.contains('sigaji-nav-open');
    var btn=document.getElementById('nav-drawer-btn');
    if(btn){
      btn.setAttribute('aria-expanded',open?'true':'false');
      btn.setAttribute('aria-label',open?'Tutup menu modul':'Buka menu modul');
    }
    var sb=document.getElementById('sidebar-wrap');
    if(sb)sb.setAttribute('aria-hidden',open?'false':'true');
    var bd=document.getElementById('nav-backdrop');
    if(bd)bd.setAttribute('aria-hidden',open?'false':'true');
  }catch(e){}
}
function sigajiSetNavDrawerOpen(open){
  try{
    sigajiMountNavToBody();
    var sb=document.getElementById('sidebar-wrap');
    var bd=document.getElementById('nav-backdrop');
    if(open){
      document.documentElement.classList.add('sigaji-nav-open');
      if(sb){sb.classList.add('sigaji-nav-drawer-open');sb.style.display='flex';sb.style.visibility='visible';}
      if(bd){bd.classList.add('sigaji-nav-drawer-open');bd.style.display='block';}
    }else{
      document.documentElement.classList.remove('sigaji-nav-open');
      if(sb){sb.classList.remove('sigaji-nav-drawer-open');sb.style.display=sigajiIsMobileNav()?'none':'';sb.style.visibility='';}
      if(bd){bd.classList.remove('sigaji-nav-drawer-open');bd.style.display='none';}
    }
    sigajiSyncNavDrawerA11y();
  }catch(e){console.error('sigajiSetNavDrawerOpen',e);}
}
function sigajiCloseNavDrawer(){sigajiSetNavDrawerOpen(false);}
function sigajiOpenNavDrawer(){sigajiApplyMobileNavMode();sigajiSetNavDrawerOpen(true);}
function sigajiToggleNavDrawer(ev){
  try{
    if(ev){ev.preventDefault();ev.stopPropagation();}
    sigajiApplyMobileNavMode();
    sigajiSetNavDrawerOpen(!document.documentElement.classList.contains('sigaji-nav-open'));
  }catch(e){console.error('sigajiToggleNavDrawer',e);}
  return false;
}
function initSigajiNavDrawer(){
  sigajiApplyMobileNavMode();
  var backdrop=document.getElementById('nav-backdrop');
  if(backdrop&&backdrop.dataset.sigajiNavBound!=='1'){
    backdrop.dataset.sigajiNavBound='1';
    backdrop.addEventListener('click',function(ev){
      if(ev){ev.preventDefault();ev.stopPropagation();}
      sigajiCloseNavDrawer();
    });
  }
  if(!window._sigajiNavResizeBound){
    window._sigajiNavResizeBound=true;
    window.addEventListener('resize',function(){sigajiApplyMobileNavMode();},{passive:true});
    window.addEventListener('orientationchange',function(){setTimeout(sigajiApplyMobileNavMode,120);},{passive:true});
    document.addEventListener('keydown',function(ev){
      if(ev&&ev.key==='Escape'&&document.documentElement.classList.contains('sigaji-nav-open'))sigajiCloseNavDrawer();
    });
  }
  sigajiSetNavDrawerOpen(false);
}
if(typeof window!=='undefined'){
  window.sigajiIsMobileNav=sigajiIsMobileNav;
  window.sigajiApplyMobileNavMode=sigajiApplyMobileNavMode;
  window.sigajiCloseNavDrawer=sigajiCloseNavDrawer;
  window.sigajiOpenNavDrawer=sigajiOpenNavDrawer;
  window.sigajiToggleNavDrawer=sigajiToggleNavDrawer;
}
function showPg(pg){
  if(!canAccess(pg)){toast('Tidak punya akses ke modul ini');return;}
  sigajiCloseNavDrawer();
  document.querySelectorAll('.pg').forEach(function(p){p.classList.remove('active');});
  document.querySelectorAll('.ni').forEach(function(n){n.classList.remove('active');});
  var el=document.getElementById('pg-'+pg);if(el)el.classList.add('active');
  document.querySelectorAll('.ni').forEach(function(n){if(n.dataset.pg===pg)n.classList.add('active');});
  if(pg==='notifikasi'){notifikasi.forEach(function(n){n.read=true;});saveAll();renderNotif();updateNotifBadge();}
  if(pg==='absensi')setTimeout(function(){applyAbsensiSubtabVisibility();renderAbsensi();},50);
  if(pg==='slip')setTimeout(function(){renderPeriodeSelects();populateSelects();onSlipPeriodeChange();},50);
  if(pg==='master'){renderPeriodes();renderHariLibur();renderCutiRekap();loadPrsForm();applyBranding();initLibnasYearSelect();applyMasterSubtabVisibility();}
  if(pg==='thr')renderTHR();
  if(pg==='mycuti')renderMyCuti();
  if(pg==='myslip')loadMySlip();
  if(pg==='pph')renderPPH();
  if(pg==='laporan')renderLaporan();
  if(pg==='backup'){sigajiUpdateCloudBackupUi();renderBackupRiwayat();renderMigrationStatus();renderAuditLog();}
  if(pg==='users'){renderUsers();renderPermMatrix();}
  if(pg==='sysstatus'){
    if(typeof renderSysStatus==='function')renderSysStatus();
    else{
      var sp=document.getElementById('sysstatus-panel');
      if(sp)sp.innerHTML='<div class="info-box" style="border-color:#fecaca;background:#fef2f2;color:#991b1b">Modul status belum termuat. Deploy <code>js/modules/app-access.js</code> terbaru lalu Ctrl+F5.</div>';
    }
  }
  if(pg==='approval')applyApprovalSubtabVisibility();
  if(pg==='pesangon')try{if(typeof renderPesangon==='function')renderPesangon();}catch(e){console.error('renderPesangon',e);toast('Modul Pesangon error — cek konsol (F12).');}
  if(pg==='kompgaji')setTimeout(function(){applyKompgajiSubtabVisibility();},30);
  if(pg==='lembur')setTimeout(function(){initLemburPage();},30);
  if(pg==='penggajian')setTimeout(function(){renderPenggajian();},0);
}
function applyMasterSubtabVisibility(){
  var tabs=document.querySelectorAll('#pg-master .tabs .tab');
  var first=null;
  tabs.forEach(function(t){
    var sub=t.dataset.mstab;if(!sub)return;
    var ok=canAccessSubTab('master',sub);
    t.style.display=ok?'':'none';
    if(ok&&!first)first=t;
  });
  ['m-prs','m-periode','m-umk','m-libur','m-potongan','m-ter'].forEach(function(id){var d=document.getElementById(id);if(d)d.style.display='none';});
  if(first&&first.dataset.panel)switchTab(first,first.dataset.panel);
  else toast('Tidak ada sub-tab Master Perusahaan yang diizinkan untuk role ini.');
}
function applyApprovalSubtabVisibility(){
  var tabs=document.querySelectorAll('#pg-approval .tabs .tab');
  var first=null;
  tabs.forEach(function(t){
    var sub=t.dataset.aptab;if(!sub)return;
    var ok=canAccessSubTab('approval',sub);
    t.style.display=ok?'':'none';
    if(ok&&!first)first=t;
  });
  ['ap-pend','ap-hist'].forEach(function(id){var d=document.getElementById(id);if(d)d.style.display='none';});
  if(first&&first.dataset.panel)switchTab(first,first.dataset.panel);
  else toast('Tidak ada sub-tab Approval yang diizinkan untuk role ini.');
}
function applyAbsensiSubtabVisibility(){
  var tabs=document.querySelectorAll('#pg-absensi .tabs .tab');
  var first=null;
  tabs.forEach(function(t){
    var sub=t.dataset.abtab;if(!sub)return;
    var ok=canAccessSubTab('absensi',sub);
    t.style.display=ok?'':'none';
    if(ok&&!first)first=t;
  });
  ['abt-kalender','abt-cuti'].forEach(function(id){var d=document.getElementById(id);if(d)d.style.display='none';});
  if(first&&first.dataset.abpanel)switchAbTab(first,first.dataset.abpanel);
  else toast('Tidak ada sub-tab Absensi yang diizinkan untuk role ini.');
}
function switchTab(el,tid){
  var masterSubs={'m-prs':'prs','m-periode':'periode','m-umk':'umk','m-libur':'libur','m-potongan':'potongan','m-ter':'ter'};
  var apprSubs={'ap-pend':'pend','ap-hist':'hist'};
  if(masterSubs[tid]&&!canAccessSubTab('master',masterSubs[tid])){toast('Tidak punya akses ke tab ini');return;}
  if(apprSubs[tid]&&!canAccessSubTab('approval',apprSubs[tid])){toast('Tidak punya akses ke tab ini');return;}
  el.parentElement.querySelectorAll('.tab').forEach(function(t){t.classList.remove('active');});el.classList.add('active');['m-prs','m-periode','m-umk','m-libur','m-potongan','m-ter','ap-pend','ap-hist'].forEach(function(id){var d=document.getElementById(id);if(d)d.style.display=id===tid?'block':'none';});
  if(tid==='m-potongan')loadAturanPotongan();
  if(tid==='m-ter'){renderPTKPForm();renderTERTable();}
  if(tid==='m-umk')renderUmkPanel();
  if(tid==='m-libur'){initLibnasYearSelect();renderHariLibur();renderCutiRekap();}
}
function switchAbTab(el,tid){
  var abSubs={'abt-kalender':'kalender','abt-cuti':'cuti'};
  if(abSubs[tid]&&!canAccessSubTab('absensi',abSubs[tid])){toast('Tidak punya akses ke tab ini');return;}
  el.parentElement.querySelectorAll('.tab').forEach(function(t){t.classList.remove('active');});el.classList.add('active');['abt-kalender','abt-cuti'].forEach(function(id){var d=document.getElementById(id);if(d)d.style.display=id===tid?'block':'none';});if(tid==='abt-cuti')renderCutiRekap();}
function switchPayrollSpTab(el,tid){
  const tabMap={'sp-gaji':'gaji','sp-bpjs':'bpjs','sp-natura':'natura','sp-pphret':'pphret','sp-ring':'ring'};
  const subId=tabMap[tid];
  if(subId&&!canAccessPayrollSub(subId)){toast('Tidak punya akses ke tab ini');return;}
  document.querySelectorAll('#slide-panel-payroll .spt').forEach(function(t){t.classList.remove('active');});
  el.classList.add('active');
  ['sp-gaji','sp-bpjs','sp-natura','sp-pphret','sp-ring'].forEach(function(id){var d=document.getElementById(id);if(d)d.style.display=id===tid?'block':'none';});
  if(tid==='sp-ring')updateGajiSummary();
  if(tid==='sp-bpjs'){var k=getPayrollTargetByNik(cpNik,true);if(k)loadBPJSPanel(k);}
  if(tid==='sp-gaji'){var k2=getPayrollTargetByNik(cpNik,true);if(k2){renderTunjPanel(k2);renderPotPanel(k2);}}
  if(tid==='sp-natura'){var k3=getPayrollTargetByNik(cpNik,true);if(k3)renderNaturaPanel(k3);}
  if(tid==='sp-pphret'){var k4=getPayrollTargetByNik(cpNik,true);if(k4)renderPPhRetPanel(k4);}
}
function openModal(id){document.getElementById(id).classList.add('show');}
function closeModal(id){document.getElementById(id).classList.remove('show');}
var tT;function toast(msg){var t=document.getElementById('toast9');if(!t){try{console.warn(msg);}catch(e){}return;}t.textContent=msg;t.classList.add('show');clearTimeout(tT);tT=setTimeout(function(){t.classList.remove('show');},3200);}
function execReset(){
  karyawan=[];periodes=[];hariLibur=[];masterCuti={kuota:12,carryover:'no',cbPotong:true};absensi={};lembur={};prorata={};approvals=[];notifikasi=[];
  perusahaan={nama:'',npwp:'',alamat:'',telp:'',email:'',web:'',logo:'',hariKerja:6,umk:{},aturan_potongan:{cuti_dalam_kuota:{mode:'tidak_dipotong',nilai:0},cuti_luar_kuota:{mode:'prorata',nilai:0},izin:{mode:'prorata',nilai:0},sakit:{mode:'prorata',nilai:0},setengah_sakit:{mode:'prorata_setengah',nilai:0},setengah_ijin:{mode:'prorata_setengah',nilai:0},alpha:{mode:'prorata',nilai:0}}};
  users=[{username:'admin',password:'admin123',role:'Admin',nama:'Administrator',nik:null,aktif:true},{username:'hrd',password:'hrd123',role:'HRD',nama:'Budi HR',nik:null,aktif:true},{username:'karyawan',password:'kar123',role:'Karyawan',nama:'Sari Dewi',nik:null,aktif:true}];
  roles={Admin:MODULES.map(function(m){return m.id;}),HRD:['dashboard','notifikasi','karyawan.info','kompgaji.tunjvar','kompgaji.bpjs','kompgaji.ring','absensi.kalender','absensi.cuti','lembur','master.prs','master.periode','master.umk','master.libur','master.potongan','master.ter','thr','pesangon','kompgaji','penggajian','slip','pph','laporan'],Karyawan:['myslip','mycuti','notifikasi']};
  thrManual={};tunjVarBulan={};tunjVarLabels={v1:'Bonus',v2:'Uang Makan',v3:'Lain-lain'};tunjVarColumns=[{id:'v1',nama:'Bonus'},{id:'v2',nama:'Uang Makan'},{id:'v3',nama:'Lain-lain'}];localStorage.removeItem(DB_KEY);localStorage.removeItem('sigaji_universal');saveAll();closeModal('m-reset');renderSidebar();renderAll();updateNotifBadge();applyBranding();
  document.getElementById('reset-inp').value='';document.getElementById('btn-reset').disabled=true;toast('Reset selesai');
}
// ── LIBUR NASIONAL DATABASE ──────────────────────
function getLiburNasionalTahun(yr){
  var tetap=[{tgl:yr+'-01-01',nama:'Tahun Baru Masehi',tipe:'nasional'},{tgl:yr+'-05-01',nama:'Hari Buruh Internasional',tipe:'nasional'},{tgl:yr+'-06-01',nama:'Hari Lahir Pancasila',tipe:'nasional'},{tgl:yr+'-08-17',nama:'HUT RI ke-'+(yr-1945),tipe:'nasional'},{tgl:yr+'-12-25',nama:'Hari Natal',tipe:'nasional'}];
  var variabel={
    2025:[{tgl:'2025-01-27',nama:'Isra Mikraj 1446 H',tipe:'nasional'},{tgl:'2025-01-29',nama:'Tahun Baru Imlek 2576',tipe:'nasional'},{tgl:'2025-03-29',nama:'Hari Raya Nyepi 1947',tipe:'nasional'},{tgl:'2025-03-28',nama:'Cuti Bersama Idul Fitri',tipe:'cuti-bersama'},{tgl:'2025-03-31',nama:'Idul Fitri 1446 H (1)',tipe:'nasional'},{tgl:'2025-04-01',nama:'Idul Fitri 1446 H (2)',tipe:'nasional'},{tgl:'2025-04-02',nama:'Cuti Bersama Idul Fitri',tipe:'cuti-bersama'},{tgl:'2025-04-03',nama:'Cuti Bersama Idul Fitri',tipe:'cuti-bersama'},{tgl:'2025-04-04',nama:'Cuti Bersama Idul Fitri',tipe:'cuti-bersama'},{tgl:'2025-04-18',nama:'Wafat Isa Almasih',tipe:'nasional'},{tgl:'2025-05-12',nama:'Hari Raya Waisak',tipe:'nasional'},{tgl:'2025-05-29',nama:'Kenaikan Isa Almasih',tipe:'nasional'},{tgl:'2025-06-07',nama:'Idul Adha 1446 H',tipe:'nasional'},{tgl:'2025-06-27',nama:'Tahun Baru Islam 1447 H',tipe:'nasional'},{tgl:'2025-09-05',nama:'Maulid Nabi 1447 H',tipe:'nasional'},{tgl:'2025-12-26',nama:'Cuti Bersama Natal',tipe:'cuti-bersama'}],
    2026:[{tgl:'2026-01-17',nama:'Isra Mikraj 1447 H',tipe:'nasional'},{tgl:'2026-01-29',nama:'Tahun Baru Imlek 2577',tipe:'nasional'},{tgl:'2026-03-11',nama:'Hari Raya Nyepi 1948',tipe:'nasional'},{tgl:'2026-03-17',nama:'Cuti Bersama Idul Fitri',tipe:'cuti-bersama'},{tgl:'2026-03-18',nama:'Cuti Bersama Idul Fitri',tipe:'cuti-bersama'},{tgl:'2026-03-19',nama:'Cuti Bersama Idul Fitri',tipe:'cuti-bersama'},{tgl:'2026-03-20',nama:'Idul Fitri 1447 H (1)',tipe:'nasional'},{tgl:'2026-03-21',nama:'Idul Fitri 1447 H (2)',tipe:'nasional'},{tgl:'2026-03-23',nama:'Cuti Bersama Idul Fitri',tipe:'cuti-bersama'},{tgl:'2026-03-24',nama:'Cuti Bersama Idul Fitri',tipe:'cuti-bersama'},{tgl:'2026-04-02',nama:'Wafat Isa Almasih',tipe:'nasional'},{tgl:'2026-05-14',nama:'Kenaikan Isa Almasih',tipe:'nasional'},{tgl:'2026-05-23',nama:'Hari Raya Waisak',tipe:'nasional'},{tgl:'2026-05-27',nama:'Idul Adha 1447 H',tipe:'nasional'},{tgl:'2026-07-16',nama:'Tahun Baru Islam 1448 H',tipe:'nasional'},{tgl:'2026-09-25',nama:'Maulid Nabi 1448 H',tipe:'nasional'},{tgl:'2026-12-26',nama:'Cuti Bersama Natal',tipe:'cuti-bersama'}],
    2027:[{tgl:'2027-01-06',nama:'Isra Mikraj 1448 H',tipe:'nasional'},{tgl:'2027-02-17',nama:'Tahun Baru Imlek 2578',tipe:'nasional'},{tgl:'2027-03-01',nama:'Hari Raya Nyepi 1949',tipe:'nasional'},{tgl:'2027-03-10',nama:'Idul Fitri 1448 H (1)',tipe:'nasional'},{tgl:'2027-03-11',nama:'Idul Fitri 1448 H (2)',tipe:'nasional'},{tgl:'2027-03-08',nama:'Cuti Bersama Idul Fitri',tipe:'cuti-bersama'},{tgl:'2027-03-09',nama:'Cuti Bersama Idul Fitri',tipe:'cuti-bersama'},{tgl:'2027-03-12',nama:'Cuti Bersama Idul Fitri',tipe:'cuti-bersama'},{tgl:'2027-03-26',nama:'Wafat Isa Almasih',tipe:'nasional'},{tgl:'2027-05-03',nama:'Kenaikan Isa Almasih',tipe:'nasional'},{tgl:'2027-05-10',nama:'Hari Raya Waisak',tipe:'nasional'},{tgl:'2027-05-17',nama:'Idul Adha 1448 H',tipe:'nasional'},{tgl:'2027-07-06',nama:'Tahun Baru Islam 1449 H',tipe:'nasional'},{tgl:'2027-09-14',nama:'Maulid Nabi 1449 H',tipe:'nasional'},{tgl:'2027-12-27',nama:'Cuti Bersama Natal',tipe:'cuti-bersama'}]
  };
  var varTahun=variabel[yr]||[];
  var semua=tetap.concat(varTahun);
  var seen={};
  return semua.filter(function(l){if(seen[l.tgl])return false;seen[l.tgl]=true;return true;}).sort(function(a,b){return a.tgl.localeCompare(b.tgl);});
}

// ── TER TABLE DISPLAY & EDIT ──────────────────────────
function getTERDisplayData(lbl,tbl){
  return tbl.map(function(r,i){
    const prev=i===0?0:tbl[i-1][0];
    const max=r[0]===Infinity?'~tak terbatas':r[0].toLocaleString('id-ID');
    const from=prev===0?'0':prev.toLocaleString('id-ID');
    const rate=(r[1]*100).toFixed(2);
    return{from:from,to:max,rate:rate,idx:i,lbl:lbl};
  });
}
function renderTERTable(){
  const custom=perusahaan.ter_custom||{};
  const TER_TABLES={A:TER_A,B:TER_B,C:TER_C};
  const ids={A:'ter-a-table',B:'ter-b-table',C:'ter-c-table'};
  Object.entries(TER_TABLES).forEach(function(e){
    const lmp=e[0];const tbl=e[1];const elId=ids[lmp];
    const el=document.getElementById(elId);if(!el)return;
    const rows=getTERDisplayData(lmp,tbl);
    el.innerHTML='<table style="font-size:11px;width:100%"><thead><tr><th>Bruto dari</th><th>s.d.</th><th>TER (%)</th></tr></thead><tbody>'+
      rows.map(function(r){
        const customRate=(custom[lmp]||{})[r.idx];
        const displayRate=customRate!==undefined?(customRate*100).toFixed(2):r.rate;
        return'<tr><td style="color:#6b7280">'+r.from+'</td><td style="color:#6b7280">'+r.to+'</td>'+
          '<td><input type="number" step="0.01" min="0" max="100" value="'+displayRate+'" '+
          'data-lmp="'+lmp+'" data-idx="'+r.idx+'" '+
          'style="width:70px;padding:2px 5px;border:1px solid #dde1e9;border-radius:4px;font-size:11px;font-family:inherit;text-align:right" '+
          'onchange="onTERCellChange(this)">%</td></tr>';
      }).join('')+
    '</tbody></table>';
  });
}
function onTERCellChange(el){
  if(!perusahaan.ter_custom)perusahaan.ter_custom={};
  const lmp=el.dataset.lmp;const idx=parseInt(el.dataset.idx);
  if(!perusahaan.ter_custom[lmp])perusahaan.ter_custom[lmp]={};
  perusahaan.ter_custom[lmp][idx]=parseFloat(el.value)/100;
}
function saveTERCustom(){saveAll();toast('Tabel TER disimpan');renderTERTable();}
function resetTERCustom(){
  if(!confirm('Reset tabel TER ke nilai default PMK 168/2023?'))return;
  perusahaan.ter_custom={};saveAll();renderTERTable();toast('TER direset ke default PMK 168/2023');
}

// ── INIT ─────────────────────────────────────────
setInterval(function(){try{var d=buildExportData();localStorage.setItem('sigaji_autobackup',JSON.stringify(Object.assign({},d,{_meta:Object.assign({},d._meta,{catatan:'Auto backup'})})));}catch(e){}},30*60*1000);
initLibnasYearSelect();
if(typeof document!=='undefined'){
  function sigajiDomReady(){
    if(typeof sigajiIsCloudConfigured==='function'&&!sigajiIsCloudConfigured())applyBranding();
    initRememberUsername();
    initSigajiNavDrawer();
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',sigajiDomReady);
  else sigajiDomReady();
}
if(typeof window!=='undefined'){
  try{
    window.addEventListener('load',function(){
      if(typeof sigajiIsCloudConfigured==='function'&&!sigajiIsCloudConfigured())applyBranding();
      initRememberUsername();initSigajiNavDrawer();
      if(typeof sigajiBindRpInputs==='function')sigajiBindRpInputs(document.body);
    });
    window.sigajiApplyMobileNavMode=sigajiApplyMobileNavMode;
  }catch(e){}
}
/** Kuota karyawan aktif — diatur penjual (Supabase / Netlify license-set / config deploy). */
(function () {
  function parseMax(v) {
    var n = parseInt(v, 10);
    return n > 0 ? n : 0;
  }
  function configMax() {
    if (typeof window.SIGAJI_MAX_EMPLOYEES === 'undefined' || window.SIGAJI_MAX_EMPLOYEES === null) return 0;
    return parseMax(window.SIGAJI_MAX_EMPLOYEES);
  }
  function isKaryawanAktifLic(k) {
    if (!k || !k.nik) return false;
    return !String(k.tgl_berhenti || '').trim();
  }
  function countActiveEmployees(arr) {
    var list = arr || (typeof karyawan !== 'undefined' ? karyawan : []);
    var n = 0;
    for (var i = 0; i < list.length; i++) if (isKaryawanAktifLic(list[i])) n++;
    return n;
  }
  function getStoredLicense() {
    if (typeof tenantLicense !== 'undefined' && tenantLicense) return tenantLicense;
    return { maxEmployees: 0, planLabel: '' };
  }
  function getEffectiveMaxEmployees() {
    var cfg = configMax();
    if (cfg > 0) return cfg;
    return parseMax(getStoredLicense().maxEmployees);
  }
  function getLicensePlanLabel() {
    var lic = getStoredLicense();
    var lbl = String(lic.planLabel || '').trim();
    if (lbl) return lbl;
    if (configMax() > 0) return 'Paket';
    return '';
  }
  function isLicenseVendorControlled() {
    return true;
  }
  function applyLicenseFromObject(lic) {
    if (!lic || typeof lic !== 'object') return;
    if (typeof tenantLicense === 'undefined') return;
    var cfg = configMax();
    if (cfg > 0) tenantLicense.maxEmployees = cfg;
    else tenantLicense.maxEmployees = parseMax(lic.maxEmployees);
    tenantLicense.planLabel = String(lic.planLabel || '').trim();
  }
  function licenseQuotaMessage(addCount) {
    var max = getEffectiveMaxEmployees();
    if (!max) return '';
    var cur = countActiveEmployees();
    var add = addCount || 0;
    var plan = getLicensePlanLabel();
    var head = plan ? 'Paket ' + plan + ': ' : 'Kuota lisensi: ';
    return (
      head +
      'maks ' +
      max +
      ' karyawan aktif (saat ini ' +
      cur +
      '). Tambah ' +
      add +
      ' akan melebihi batas. Hubungi penyedia SiGaji untuk upgrade atau perpanjangan kuota.'
    );
  }
  function canAddActiveEmployees(addCount, arr) {
    var max = getEffectiveMaxEmployees();
    if (!max) return { ok: true };
    var add = addCount || 0;
    if (add <= 0) return { ok: true };
    var cur = countActiveEmployees(arr);
    if (cur + add <= max) return { ok: true };
    return { ok: false, message: licenseQuotaMessage(add) };
  }
  function assertCanAddActiveEmployees(addCount, arr) {
    var r = canAddActiveEmployees(addCount, arr);
    if (r.ok) return true;
    if (typeof toast === 'function') toast(r.message);
    return false;
  }
  function renderLicenseQuotaUi() {
    var badge = document.getElementById('kar-quota-badge');
    if (badge) {
      var max = getEffectiveMaxEmployees();
      var cur = countActiveEmployees();
      if (!max) {
        badge.textContent = cur + ' karyawan aktif';
        badge.className = 'bdg b-info';
      } else {
        var plan = getLicensePlanLabel();
        badge.textContent = (plan ? plan + ' · ' : '') + cur + ' / ' + max + ' karyawan aktif';
        badge.className = 'bdg ' + (cur >= max ? 'b-err' : cur >= max - 2 ? 'b-warn' : 'b-ok');
      }
    }
    var card = document.getElementById('lic-card');
    if (!card) return;
    var showAdmin = typeof CU !== 'undefined' && CU && CU.role === 'Admin';
    card.style.display = showAdmin ? '' : 'none';
    var stat = document.getElementById('lic-stat');
    if (stat) {
      var mx = getEffectiveMaxEmployees();
      var c = countActiveEmployees();
      stat.textContent = mx
        ? 'Karyawan aktif: ' + c + ' dari maks ' + mx + ' (resign tidak dihitung).'
        : 'Karyawan aktif: ' + c + ' (belum ada batas kuota dari penyedia).';
    }
    var note = document.getElementById('lic-vendor-note');
    if (note) {
      note.textContent =
        'Kuota dan nama paket diatur oleh penyedia SiGaji (bukan dari menu ini). Untuk menambah kuota atau upgrade paket, hubungi penyedia layanan Anda.';
    }
  }
  function simpanKuotaLisensi() {
    if (typeof toast === 'function') toast('Kuota hanya dapat diatur oleh penyedia SiGaji. Hubungi penyedia layanan Anda.');
  }
  window.sigajiCountActiveEmployees = countActiveEmployees;
  window.sigajiGetEffectiveMaxEmployees = getEffectiveMaxEmployees;
  window.sigajiCanAddActiveEmployees = canAddActiveEmployees;
  window.sigajiAssertCanAddActiveEmployees = assertCanAddActiveEmployees;
  window.sigajiApplyLicenseFromObject = applyLicenseFromObject;
  window.sigajiRenderLicenseQuotaUi = renderLicenseQuotaUi;
  window.sigajiIsLicenseVendorControlled = isLicenseVendorControlled;
  window.simpanKuotaLisensi = simpanKuotaLisensi;
})();

