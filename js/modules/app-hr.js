/* SiGaji — dashboard, karyawan, komponen gaji, proses gaji */
var karFilterTipe = '';

function karMatchesTipeFilter(k) {
  if (!karFilterTipe) return true;
  var t =
    typeof sigajiNormalizeKarTipe === 'function' ? sigajiNormalizeKarTipe(k.tipe_kerja, k) : 'tetap';
  return t === karFilterTipe;
}

function setKarFilterTipe(v) {
  karFilterTipe = v || '';
  renderKar();
}

function onSpTipeKerjaChange() {
  var sel = document.getElementById('sp-tipe-kerja-f');
  var hint = document.getElementById('sp-nik-hint');
  var inp = document.getElementById('sp-nik-f');
  if (!sel) return;
  var tipe = sel.value || 'tetap';
  var pfx = typeof sigajiNikPrefixForTipe === 'function' ? sigajiNikPrefixForTipe(tipe) : tipe === 'tidak_tetap' ? 'NT' : 'K';
  if (hint) {
    hint.textContent =
      'Format: ' + pfx + '0001 — terpisah dari ' + (tipe === 'tidak_tetap' ? 'K (tetap)' : 'NT (tidak tetap)');
  }
  var k = cpNik ? karyawan.find(function (x) { return x.nik === cpNik; }) : null;
  if (k && k._new && inp && typeof sigajiNextNik === 'function') {
    inp.value = sigajiNextNik(tipe);
    k.nik = inp.value;
    k.tipe_kerja = tipe;
    var spNik = document.getElementById('sp-nik');
    if (spNik) spNik.textContent = k.nik;
  }
}

// ── DASHBOARD ───────────────────────────────────
function renderDash(){
  if(typeof sigajiWithSkeleton==='function'){
    return sigajiWithSkeleton('dash-bento-grid',12,renderDashBody);
  }
  renderDashBody();
}
function renderDashBody(){
  try{if(typeof sigajiRenderBranchWorkspaceBanner==='function')sigajiRenderBranchWorkspaceBanner();}catch(eWs){sigajiCatchWarn("js/modules/app-hr.js",eWs);}
  const p=PA();const hP=Math.max(0,Math.ceil((new Date(p.bayar)-Date.now())/86400000));
  const thrTag=p.thr_aktif?'<span class="bdg b-pu dash-thr-badge">&#127873; THR '+(p.thr_nama||'')+'</span>':'';
  let tB=0,tP=0,tN=0,tT=0;const depts={};
  const list=karyawanListPeriode(p);
  ensureKarSnapshotPeriode(p.nama,list);
  list.forEach(k=>{const g=hitungGaji(k,p.nama);tB+=g.grossPPh;tP+=g.pph;tN+=g.neto;tT+=g.thrBruto;if(!depts[k.dept])depts[k.dept]={n:0,b:0,n2:0};depts[k.dept].n++;depts[k.dept].b+=g.grossPPh;depts[k.dept].n2+=g.neto;});
  var todayIso=new Date().toISOString().substring(0,10);
  var periodeBelumSelesai=p.end&&todayIso<p.end;
  var hintHtml='<strong>Estimasi payroll</strong> — periode <em>'+escapeHtml(p.nama)+'</em> ('+fmtDate(p.start)+' – '+fmtDate(p.end)+'), '
    +(periodeBelumSelesai
      ?'<strong>bukan</strong> akumulasi s.d. hari ini.'
      :'bukan slip final — proses penggajian menentukan angka resmi.')
    +' Bayar: '+fmtDate(p.bayar)+'.';
  const pRet=list.reduce((s,k)=>s+(k.pph_return?.nilai||0),0);
  const pAp=approvals.filter(a=>a.status==='pending'&&a.period===p.nama).length;
  var attHtml='';
  {
    var periodDays=typeof absensiDaysFromPeriode==='function'?absensiDaysFromPeriode(p):[];
    periodDays=periodDays.filter(function(x){return x.date<=todayIso;});
    var stats={hadir:0,cuti:0,izin:0,sakit:0,alpha:0};
    var bars=[];
    periodDays.forEach(function(x){
      var iso=x.date;
      var daySt={hadir:0,izin:0,sakit:0,alpha:0};
      list.forEach(function(k){
        if(!k||!k.nik)return;
        var isLN=typeof isHL==='function'?isHL(iso):false;
        var isLK=typeof isHariLiburKerja==='function'?isHariLiburKerja(x.dow):false;
        var st=(absensi[k.nik]&&absensi[k.nik][iso])||(isLN?'libnas':isLK?'libur':'hadir');
        if(st==='hadir'||st==='libur'||st==='libnas'){stats.hadir++;daySt.hadir++;}
        else if(st==='cuti')stats.cuti++;
        else if(st==='izin'||st==='setengah_ijin'){stats.izin++;daySt.izin++;}
        else if(st==='sakit'||st==='setengah_sakit'){stats.sakit++;daySt.sakit++;}
        else if(st==='alpha'){stats.alpha++;daySt.alpha++;}
      });
      var maxK=list.length||1;
      var h=Math.max(4,Math.round((daySt.hadir/maxK)*120));
      bars.push({d:x.d,iso:iso,h:h,hadir:daySt.hadir,izin:daySt.izin,sakit:daySt.sakit,alpha:daySt.alpha});
    });
    var nKar=list.length;
    var nDays=bars.length;
    var barHtml=bars.map(function(b){
      var tip='Tgl '+b.d+' ('+b.iso+'): '+b.hadir+' dari '+nKar+' karyawan hadir';
      if(b.izin)tip+=' · izin '+b.izin;
      if(b.sakit)tip+=' · sakit '+b.sakit;
      if(b.alpha)tip+=' · alpha '+b.alpha;
      return '<div class="dash-att-bar-wrap"><div class="dash-att-bar" style="height:'+b.h+'px" title="'+tip+'"></div>'
        +'<div class="dash-att-bar-lbl">'+b.d+'</div>'
        +(nKar?'<div class="dash-att-bar-sub">'+b.hadir+'/'+nKar+'</div>':'')+'</div>';
    }).join('');
    var avgHadir=nDays&&nKar?Math.round((stats.hadir/(nDays*nKar))*100):0;
    attHtml='<p class="dash-att-hint">Grafik harian — proporsi hadir per hari.</p>'
      +(barHtml?'<div class="dash-att-chart">'+barHtml+'</div>':typeof sigajiEmptyState==='function'?sigajiEmptyState({icon:'&#128197;',title:'Belum ada hari',desc:'Periode belum valid.',btnLabel:'Atur periode',btnAction:'showPg',btnActionArg:'master'}):'<div class="text-subtle p-md">—</div>')
      +'<div class="dash-att-legend">'
      +'<span class="lg-hadir">Hadir: '+stats.hadir+'</span>'
      +'<span class="lg-izin">Izin: '+stats.izin+'</span>'
      +'<span class="lg-sakit">Sakit: '+stats.sakit+'</span>'
      +'<span class="lg-alpha">Alpha: '+stats.alpha+'</span>'
      +'<span class="ml-auto font-10 text-subtle">~'+avgHadir+'% kehadiran</span></div>';
  }
  var deptTableHtml=Object.entries(depts).map(function(ent){
    var d=ent[0],v=ent[1];
    var spark=typeof sigajiDeptSparklineCell==='function'?sigajiDeptSparklineCell(d):'';
    return '<tr><td><strong>'+escapeHtml(d)+'</strong></td><td>'+v.n+'</td><td class="dept-spark-cell">'+spark+'</td><td>'+fmt(v.b)+'</td><td>'+fmt(v.n2)+'</td></tr>';
  }).join('');
  try{
    if(typeof sigajiRenderBentoDashboard==='function')sigajiRenderBentoDashboard({
      p:p,hP:hP,thrTag:thrTag,tB:tB,tP:tP,tN:tN,tT:tT,nKar:list.length,depts:depts,
      hintHtml:hintHtml,thrAktif:!!p.thr_aktif,thrNama:p.thr_nama,thrBayar:p.thr_bayar,
      pRet:pRet,pAp:pAp,attHtml:attHtml,deptTableHtml:deptTableHtml
    });
  }catch(eBento){console.error('bento',eBento);}
  try{if(typeof sigajiUpdatePeriodStickyBar==='function')sigajiUpdatePeriodStickyBar();}catch(ePs){sigajiCatchWarn("js/modules/app-hr.js",ePs);}
  try{if(typeof sigajiRenderPeriodTimeline==='function')sigajiRenderPeriodTimeline();}catch(eTl){sigajiCatchWarn("js/modules/app-hr.js",eTl);}
}
// ── MASTER KARYAWAN ─────────────────────────────
function karRowHtml(k,no){
  const yrKar=new Date().getFullYear();
  const t=cutiTerpakai(k.nik,yrKar);
  const kuotaCut=masterCuti.kuota||12;
  const s=kuotaCut-t;
  const sCls=s<=0?'b-err':s<=3?'b-warn':'b-teal';
  const sLbl=s+'/'+kuotaCut;
  const stCls=k.status==='Tetap'?'b-ok':k.status==='Kontrak'?'b-warn':'b-gray';
  const tipe=typeof sigajiNormalizeKarTipe==='function'?sigajiNormalizeKarTipe(k.tipe_kerja,k):'tetap';
  const tipeLbl=typeof sigajiKarTipeLabel==='function'?sigajiKarTipeLabel(tipe):(tipe==='tidak_tetap'?'Tidak Tetap':'Tetap');
  const tipeCls=tipe==='tidak_tetap'?'b-warn':'b-teal';
  const cutiCell=tipe==='tidak_tetap'?'<span class="bdg b-gray" title="Cuti tahunan biasanya tidak dipakai">—</span>':`<span class="bdg ${sCls}" title="Saldo cuti tahun ${yrKar}">${sLbl}</span>`;
  const tgBtn=(CU&&(CU.role==='Admin'||CU.role==='HRD'))?`<button class="btn btn-sm btn-out"${sigajiDataAction('telegram',{nik:k.nik})}>Telegram</button>`:'';
  var cabCol=typeof sigajiCabangColTd==='function'?sigajiCabangColTd(k):'';
  return`<tr><td class="text-center text-muted fw-700 sticky-no">${no}</td><td class="sticky-name"><div class="fl gap2 items-center"><div class="ka">${ini(k.nama)}</div><div><div class="knl"${sigajiDataAction('open-profile',{nik:k.nik})}>${escapeHtml(k.nama)} &#8599;</div><div class="font-10 text-muted" style="font-family:monospace">${escapeHtml(k.nik)}</div></div></div></td><td><span class="bdg ${tipeCls}">${escapeHtml(tipeLbl)}</span></td>${cabCol}<td>${escapeHtml(k.dept)}</td><td>${escapeHtml(k.jabatan)}</td><td><span class="bdg ${stCls}">${escapeHtml(k.status)}</span></td><td><span class="bdg b-info">${escapeHtml(k.ptkp)}</span></td><td>${cutiCell}</td><td><div class="fl gap1"><button class="btn btn-sm btn-p"${sigajiDataAction('open-profile',{nik:k.nik})}>Profil</button>${tgBtn}<button class="btn btn-sm btn-r"${sigajiDataAction('delete-kar',{nik:k.nik})}>Hapus</button></div></td></tr>`;
}
function renderKar(){
  if(typeof sigajiWithSkeleton==='function'){
    return sigajiWithSkeleton('tb-kar',9,renderKarBody);
  }
  renderKarBody();
}
function renderKarBody(){
  try{if(typeof sigajiSyncKarTableHead==='function')sigajiSyncKarTableHead();}catch(eTh){sigajiCatchWarn("js/modules/app-hr.js",eTh);}
  const p=PA();
  const list=karyawanListPeriode(p).filter(karMatchesTipeFilter);
  const el=document.getElementById('kar-count');if(el)el.textContent=list.length+' karyawan • Data profil SDM';
  try{if(typeof sigajiRenderLicenseQuotaUi==='function')sigajiRenderLicenseQuotaUi();}catch(eLq){sigajiCatchWarn("js/modules/app-hr.js",eLq);}
  const tb=document.getElementById('tb-kar');if(!tb)return;
  if(!list.length&&typeof sigajiEmptyState==='function'){
    var karColspan=9+(typeof sigajiMultiBranchEnabled==='function'&&sigajiMultiBranchEnabled()&&!(typeof sigajiInBranchWorkspace==='function'&&sigajiInBranchWorkspace())?1:0);
    var html='<tr><td colspan="'+String(karColspan)+'">'+sigajiEmptyState({icon:'&#128101;',title:'Belum ada karyawan',desc:'Tambah pegawai tetap/tidak tetap atau import Excel untuk mulai payroll.',btnLabel:'+ Pegawai Tetap',btnAction:'openNewKar',btnActionArg:'tetap'})+'</td></tr>';
    tb.innerHTML=html;
    return;
  }
  var rows=list.map((k,i)=>karRowHtml(k,i+1));
  if(typeof sigajiSetTbodyRows==='function')sigajiSetTbodyRows(tb,rows);
  else tb.innerHTML=rows.join('');
}
function filterKar(q){
  const p=PA();
  const r=sortKaryawanByNik(karyawanListPeriode(p).filter(karMatchesTipeFilter).filter(function(k){
    return (k.nama+k.nik+k.jabatan+k.dept).toLowerCase().includes(q.toLowerCase());
  }));
  document.getElementById('kar-count').textContent=r.length+' ditampilkan';
  var tb=document.getElementById('tb-kar');
  var rows=r.map((k,i)=>karRowHtml(k,i+1));
  if(tb&&typeof sigajiSetTbodyRows==='function')sigajiSetTbodyRows(tb,rows);
  else if(tb)tb.innerHTML=rows.join('');
}
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
  return`<tr><td class="text-center text-muted fw-700 sticky-no">${no}</td><td class="sticky-name"><div class="fl gap2 items-center"><div class="ka">${ini(k.nama)}</div><div><div class="knl"${sigajiDataAction('open-payroll',{nik:k.nik})}>${escapeHtml(k.nama)} &#8599;</div><div class="u-muted-10">${escapeHtml(k.nik)}</div></div></div></td><td>${escapeHtml(k.dept)}</td>${showGapok?`<td class="num cell-money">${fmt(kPer.gapok||0)}</td>`:'<td>—</td>'}<td><span class="bdg ${bst}">${escapeHtml(bpjsLbl)}</span></td><td>${nTunj} item</td><td>${nNat} item</td><td><button class="btn btn-sm btn-p"${sigajiDataAction('open-payroll',{nik:k.nik})}>Edit Komponen</button></td></tr>`;
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
function hapusKar(nik){const k=karyawan.find(x=>x.nik===nik);if(!k)return;sigajiConfirm({title:'Hapus karyawan',message:'Apakah Anda yakin ingin menghapus karyawan "'+k.nama+'"?\n\nNIK: '+k.nik+'\nAbsensi, lembur, dan data terkait ikut terhapus. Tindakan ini tidak dapat dibatalkan.',danger:true,okText:'Ya, hapus'}).then(function(ok){if(!ok)return;karyawan=karyawan.filter(x=>x.nik!==nik);delete absensi[nik];delete lembur[nik];saveAll();renderKar();renderDash();populateSelects();toast('Karyawan dihapus');});}
function openNewKar(tipe){
  if(!canAccessSubTab('karyawan','info')){toast('Tidak punya akses menambah profil karyawan');return;}
  if(typeof sigajiAssertCanAddActiveEmployees==='function'&&!sigajiAssertCanAddActiveEmployees(1))return;
  tipe=(tipe==='tidak_tetap')?'tidak_tetap':'tetap';
  var cf=typeof sigajiGetCabangFilter==='function'?sigajiGetCabangFilter():'';
  var sk=typeof sigajiNewKaryawanSkeleton==='function'?sigajiNewKaryawanSkeleton(tipe,cf||'utama'):{nik:nextNikOtomatis(tipe),tipe_kerja:tipe,nama:'Karyawan Baru',status:'Tetap',dept:'Operasional',jabatan:'Staff',masuk:new Date().toISOString().split('T')[0],ptkp:'TK0',gapok:5000000,tunjangan:[],potongan:[],bpjs_aktif:{},natura:[],pph_return:{nilai:0,ket:''},_new:true};
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
  sv('sp-nik-f',k.nik);sv('sp-nama-f',isNew?'':k.nama);sv('sp-jk-f',k.jk);sv('sp-agama-f',k.agama);
  onSpTipeKerjaChange();
  sv('sp-ktp-f',isNew?'':k.ktp);sv('sp-npwp-f',isNew?'':k.npwp);sv('sp-hp-f',isNew?'':k.hp);sv('sp-email-f',isNew?'':k.email);sv('sp-alamat-f',isNew?'':k.alamat);
  try{if(typeof sigajiRefreshSpTaxIdHint==='function')sigajiRefreshSpTaxIdHint();}catch(eTax){sigajiCatchWarn("js/modules/app-hr.js",eTax);}
  sv('sp-dept-f',k.dept);sv('sp-jabatan-f',isNew?'':k.jabatan);sv('sp-status-f',k.status);sv('sp-masuk-f',isNew?'':k.masuk);sv('sp-berhenti-f',k.tgl_berhenti||'');
  try{if(typeof sigajiPopulateKarCabangSelect==='function')sigajiPopulateKarCabangSelect();}catch(eCb){sigajiCatchWarn("js/modules/app-hr.js",eCb);}
  var cabEl=document.getElementById('sp-cabang-f');if(cabEl&&typeof sigajiKarCabangId==='function')cabEl.value=sigajiKarCabangId(k);
  populatePhkAlasanSelect();
  var spa=document.getElementById('sp-phk-alasan');if(spa)spa.value=(k.phk&&k.phk.alasan)?k.phk.alasan:'';
  toggleSpPhkWrap();
  sv('sp-ptkp-f',k.ptkp);sv('sp-atasan-f',isNew?'':k.atasan);sv('sp-lokasi-f',isNew?'':k.lokasi);
  sv('sp-bank-f',k.bank||'BCA');sv('sp-norek-f',isNew?'':k.norek||'');
  sv('sp-reknam-f',k.reknam||k.nama||'');
  const re=document.getElementById('sp-reknam-f');if(re)re.dataset.manualEdit=(k.reknam&&k.reknam!==k.nama)?'1':'';
  updatePTKPVal();
  sigajiCloseNavDrawer();
  document.getElementById('slide-panel').classList.add('show');document.getElementById('panel-overlay').classList.add('show');
  document.body.classList.add('sigaji-kar-panel-open');document.body.classList.remove('sigaji-payroll-panel-open');
  try{if(typeof sigajiSetPanelDock==='function')sigajiSetPanelDock(true);}catch(eDock){sigajiCatchWarn("js/modules/app-hr.js",eDock);}
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
    openModal('m-tg');
  }catch(e){console.error(e);toast('Gagal membuka Telegram');}
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
  var simple=typeof SIGAJI_UI_SIMPLE!=='undefined'&&SIGAJI_UI_SIMPLE;
  var wrap=document.getElementById('payroll-spt-wrap');
  if(!wrap)return;
  var adv=wrap.querySelectorAll('[data-payroll-adv="1"]');
  var btn=document.getElementById('payroll-sp-more-btn');
  if(!simple){
    adv.forEach(function(el){
      if(typeof sigajiShowEl==='function')sigajiShowEl(el,'reset');
      else{el.classList.remove('u-hidden');el.style.removeProperty('display');}
    });
    if(btn&&typeof sigajiHideEl==='function')sigajiHideEl(btn);
    else if(btn)btn.style.display='none';
    return;
  }
  var show=wrap.dataset.payrollAdvShow==='1';
  adv.forEach(function(el){
    if(el.id==='payroll-sp-more-btn')return;
    if(typeof sigajiSetPanelVisible==='function')sigajiSetPanelVisible(el,show,'reset');
    else el.style.display=show?'':'none';
  });
  if(btn){
    if(typeof sigajiShowEl==='function')sigajiShowEl(btn,'reset');
    else btn.style.display='';
    btn.textContent=show?'\u2212 Ringkas':'+ Lanjutan';
  }
}
function sigajiTogglePayrollAdvTabs(){
  var wrap=document.getElementById('payroll-spt-wrap');
  if(!wrap)return;
  wrap.dataset.payrollAdvShow=wrap.dataset.payrollAdvShow==='1'?'0':'1';
  applyPayrollSpTabSimpleUi();
}
if(typeof window!=='undefined')window.sigajiTogglePayrollAdvTabs=sigajiTogglePayrollAdvTabs;
function applyPayrollSlideTabsVisibility(){
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
  try{if(typeof sigajiSetPanelDock==='function')sigajiSetPanelDock(true);}catch(eDock){sigajiCatchWarn("js/modules/app-hr.js",eDock);}
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
function simpanKarPanel(){
  const k=karyawan.find(x=>x.nik===cpNik);if(!k)return;
  const gv=id=>{const e=document.getElementById(id);return e?e.value:'';};
  const oldNik=k.nik,newNik=gv('sp-nik-f').trim()||k.nik;
  var tipeKerja=gv('sp-tipe-kerja-f')||'tetap';
  if(typeof sigajiValidateKarNik==='function'){
    var vNik=sigajiValidateKarNik(newNik,tipeKerja,oldNik);
    if(!vNik.ok){toast(vNik.msg);return;}
  }
  var tbh=gv('sp-berhenti-f').trim();
  var phkAl=document.getElementById('sp-phk-alasan');
  if(tbh){
    if(!phkAl||!String(phkAl.value||'').trim()){toast('Jika tanggal berhenti diisi, wajib pilih alasan PHK (sesuai UU Cipta Kerja).');return;}
    if(!k.phk)k.phk={};
    k.phk.alasan=phkAl.value;
  }else{
    delete k.tgl_berhenti;
    delete k.phk;
  }
  Object.assign(k,{nik:newNik,tipe_kerja:tipeKerja,nama:gv('sp-nama-f'),dept:gv('sp-dept-f'),jabatan:gv('sp-jabatan-f'),status:gv('sp-status-f'),masuk:gv('sp-masuk-f'),tgl_berhenti:tbh||undefined,ptkp:gv('sp-ptkp-f'),atasan:gv('sp-atasan-f'),lokasi:gv('sp-lokasi-f'),bank:gv('sp-bank-f'),norek:gv('sp-norek-f'),reknam:gv('sp-reknam-f'),jk:gv('sp-jk-f'),agama:gv('sp-agama-f'),ktp:gv('sp-ktp-f'),npwp:gv('sp-npwp-f'),hp:gv('sp-hp-f'),email:gv('sp-email-f'),alamat:gv('sp-alamat-f')});
  if(typeof sigajiMultiBranchEnabled==='function'&&sigajiMultiBranchEnabled()&&typeof sigajiCanAssignCabang==='function'&&sigajiCanAssignCabang()){
    var cabInp=document.getElementById('sp-cabang-f');
    if(cabInp)k.cabangId=cabInp.value||'utama';
  }
  if(newNik!==oldNik){if(absensi[oldNik]){absensi[newNik]=absensi[oldNik];delete absensi[oldNik];}if(lembur[oldNik]){lembur[newNik]=lembur[oldNik];delete lembur[oldNik];}cpNik=newNik;}
  saveAll();document.getElementById('sp-nik').textContent=k.nik;document.getElementById('sp-name').textContent=k.nama;document.getElementById('sp-sub').textContent=k.jabatan+' \u2014 '+k.dept;
  renderKar();renderKompgaji();renderDash();renderPenggajian();renderPPH();if(typeof renderPesangon==='function')renderPesangon();populateSelects();toast('Profil '+k.nama+' disimpan');
}
function hapusKarFromPanel(){const k=karyawan.find(x=>x.nik===cpNik);if(!k)return;sigajiConfirm({title:'Hapus karyawan',message:'Apakah Anda yakin ingin menghapus karyawan "'+k.nama+'"?\n\nNIK: '+k.nik+'\nAbsensi, lembur, dan data terkait ikut terhapus. Tindakan ini tidak dapat dibatalkan.',danger:true,okText:'Ya, hapus'}).then(function(ok){if(!ok)return;karyawan=karyawan.filter(x=>x.nik!==cpNik);delete absensi[cpNik];delete lembur[cpNik];saveAll();closePanel();renderKar();renderDash();populateSelects();toast('Karyawan dihapus');});}
function renderTunjPanel(k){
  const list=k.tunjangan||[];
  const nik=k.nik;
  const snapMode=isPayrollSnapshotMode();
  document.getElementById('tunj-list').innerHTML=list.length?list.map(function(t,i){
    const showThr=t.tipe==='tetap'||t.tipe==='tetap_no_bpjs';
    const thrIkut=showThr&&t.thr_ikut!==false;
    const prIkut=t.prorata_ikut!==false;
    const sel1=Object.entries(TUNJ_TYPES).map(function(e){return'<option value="'+e[0]+'" '+(t.tipe===e[0]?'selected':'')+'>'+e[1]+'</option>';}).join('');
    return '<div class="comp-row-card comp-row-tunj">'
      +'<div class="comp-row-grid comp-row-grid-tunj">'
      +'<div class="fg m-0"><label>Nama</label><input value="'+t.nama+'" data-nik="'+nik+'" data-i="'+i+'" data-f="nama" onchange="updTunjEl(this)"></div>'
      +'<div class="fg m-0"><label>Nominal</label><input type="text" class="inp-rp'+(snapMode?'':' snap-field-disabled')+'" value="'+t.nilai+'" '+(snapMode?'':'readonly title="Nominal tunjangan diisi pada mode Snapshot Periode"')+' data-nik="'+nik+'" data-i="'+i+'" data-f="nilai" data-rp="1" onchange="updTunjEl(this)"></div>'
      +'<div class="fg m-0"><label>Tipe</label><select data-nik="'+nik+'" data-i="'+i+'" data-f="tipe" onchange="updTunjEl(this);refreshTunjPanel(this.dataset.nik)">'+sel1+'</select></div>'
      +'<div class="fg m-0"><label>THR</label><select title="Ikut THR?" style="'+(showThr?'':'opacity:.35;pointer-events:none')+'" data-nik="'+nik+'" data-i="'+i+'" data-f="thr_ikut" onchange="updTunjEl(this)">'
        +'<option value="ya" '+(thrIkut?'selected':'')+'>&#127873; Ikut</option>'
        +'<option value="tidak" '+(!thrIkut?'selected':'')+'>Exclude</option>'
      +'</select></div>'
      +'<div class="fg m-0"><label>Prorata</label><select data-nik="'+nik+'" data-i="'+i+'" data-f="prorata_ikut" onchange="updTunjEl(this)">'
        +'<option value="ya" '+(prIkut?'selected':'')+'>Ikut</option>'
        +'<option value="tidak" '+(!prIkut?'selected':'')+'>Penuh</option>'
      +'</select></div>'
      +'</div>'
      +'<button type="button" class="btn btn-xs btn-r comp-row-del"'+sigajiDataAction('del-tunj',{nik:nik,i:i})+'>&#10007;</button>'
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
}
function delTunjEl(el){delTunj(el.dataset.nik,parseInt(el.dataset.i));}
function renderPotPanel(k){const list=k.potongan||[];document.getElementById('pot-list').innerHTML=list.length?list.map((p,i)=>`<div class="comp-row-card comp-row-pot"><div class="comp-row-grid comp-row-grid-pot"><div class="fg m-0"><label>Nama</label><input value="${p.nama}" onchange="updPot('${k.nik}',${i},'nama',this.value)"></div><div class="fg m-0"><label>Nominal</label><input type="text" class="inp-rp" value="${p.nilai}" data-rp="1" onchange="updPot('${k.nik}',${i},'nilai',parseRpInput(this.value))"></div><div class="fg m-0"><label>Keterangan</label><input value="${p.ket||''}" placeholder="Opsional" onchange="updPot('${k.nik}',${i},'ket',this.value)"></div></div><button type="button" class="btn btn-xs btn-r comp-row-del"${sigajiDataAction('del-pot',{nik:k.nik,i:i})}>&#10007;</button></div>`).join(''):'<div class="font-12 text-muted" style="padding:.5rem">Belum ada potongan.</div>';sigajiBindRpInputs(document.getElementById('pot-list'));}
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
// ── BPJS PANEL ──────────────────────────────────
function loadBPJSPanel(k){
  const tB=(k.tunjangan||[]).filter(function(t){return t.tipe==='tetap';}).reduce(function(s,t){return s+t.nilai;},0);
  const basis=k.gapok+tB;const bm=k.bpjs_manual||{};
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
    const def=BPJS_DEF[c.key];const b=def.basis?Math.min(basis,def.basis):basis;
    const autoV=Math.round(b*def.pct/100);const isMn=bm[c.key]!==undefined;bmState[c.key]=isMn;
    const chk='<label class="fl items-center cursor-pointer m-0"><input class="cursor-pointer m-0 chk-brand" type="checkbox" data-nik="'+k.nik+'" data-key="'+c.key+'" '+(ok?'checked':'')+' onchange="onBPJSKompChange(this)" style="width:15px; height:15px"></label>';
    const nomVal=ok?(isMn?bm[c.key]:autoV):0;
    const nomEl='<input type="text" class="bi inp-rp '+(isMn?'manual':'')+'" id="b-'+c.key+'-v" value="'+formatRpInputNum(nomVal)+'" data-rp="1" '+(!isMn||!ok?'readonly':'')+' data-nik="'+k.nik+'" data-key="'+c.key+'" oninput="onBMChange2(this)">';
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
  else{delete k.bpjs_manual[key];ve.readOnly=true;ve.className='bi inp-rp';ve.oninput=null;te.textContent='Auto';te.className='tm auto';const ok=bpjsKompAktif(k,key);if(!ok){ve.value=formatRpInputNum(0);}else{const tB2=(k.tunjangan||[]).filter(t=>t.tipe==='tetap').reduce((s,t)=>s+t.nilai,0);const b2=k.gapok+tB2;const def=BPJS_DEF[key];const bas=def.basis?Math.min(b2,def.basis):b2;ve.value=formatRpInputNum(Math.round(bas*def.pct/100));}}
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
  const list=k.natura||[];document.getElementById('natura-list').innerHTML=list.length?list.map((n,i)=>`<div class="nat-row ${n.kp?'kp':''}"><input class="font-12 w-full" value="${n.nama}" style="padding:5px 8px; border:1.5px solid #dde1e9; border-radius:6px; font-family:inherit; outline:none" onchange="updNat('${k.nik}',${i},'nama',this.value)"><input type="text" class="inp-rp font-12 w-full" value="${n.nilai}" data-rp="1" style="padding:5px 8px; border:1.5px solid #dde1e9; border-radius:6px; font-family:inherit; outline:none" onchange="updNat('${k.nik}',${i},'nilai',parseRpInput(this.value))"><select class="font-11" style="padding:5px 8px; border:1.5px solid #dde1e9; border-radius:6px; font-family:inherit; outline:none" onchange="updNat('${k.nik}',${i},'kp',this.value==='true');renderNaturaPanel(karyawan.find(x=>x.nik==='${k.nik}'))"><option value="false" ${!n.kp?'selected':''}>Tidak Kena Pajak</option><option value="true" ${n.kp?'selected':''}>Kena Pajak</option></select><button class="btn btn-xs btn-r"${sigajiDataAction('del-nat',{nik:k.nik,i:i})}>&#10007;</button></div>`).join(''):'<div class="font-12 text-muted" style="padding:.5rem">Belum ada natura.</div>';const kp=list.filter(n=>n.kp).reduce((s,n)=>s+n.nilai,0);const nkp=list.filter(n=>!n.kp).reduce((s,n)=>s+n.nilai,0);document.getElementById('natura-total').innerHTML=list.length?`<div class="pph-box"><div class="pr-row-info"><span>Natura Tidak KP</span><span class="ct-success fw-700">${fmt(nkp)}</span></div><div class="pr-row-info"><span>Natura Kena Pajak</span><span class="ct-danger fw-700">${fmt(kp)}</span></div><div class="pph-box-tit"><span>Total</span><span>${fmt(kp+nkp)}</span></div></div>`:'';sigajiBindRpInputs(document.getElementById('natura-list'));
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
  var h='<div class="gs"><div class="stit" style="margin-top:0">Gross Income (Dasar PPh 21)</div><div class="gs-row"><span>Gaji Pokok</span><span>'+fmt(k.gapok)+'</span></div>';
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
  if(g.thrBruto>0){var thrBayarLbl=PA()&&PA().thr_bayar?PA().thr_bayar:'H-7 lebaran';h+='<div class="thr-callout-lg">&#127873; THR '+fmt(g.thrBruto)+' dibayar full netto terpisah pada '+escapeHtml(thrBayarLbl)+'</div>';}
  h+='<div class="stit">Beban Perusahaan</div><div class="gs-row"><span>BPJS Kes Prs</span><span>'+fmt(g.bpjs.kes_prs)+'</span></div>';
  h+='<div class="gs-row"><span>BPJS JHT+JP Prs</span><span>'+fmt(g.bpjs.jht_prs+g.bpjs.jp_prs)+'</span></div>';
  h+='<div class="gs-row"><span>JKK+JKM Prs</span><span>'+fmt(g.bpjs.jkk_prs+g.bpjs.jkm_prs)+'</span></div>';
  h+='<div class="gs-row fw-700"><span>Total Cost of Employment</span><span>'+fmt(g.brutoTH+g.bebanPrs)+'</span></div></div>';
  el.innerHTML=h;
}
// ── PENGGAJIAN ───────────────────────────────────
function switchPenggajianTab(el,tid){
  if(el&&el.parentElement){
    el.parentElement.querySelectorAll('.tab').forEach(function(t){t.classList.remove('active');});
    el.classList.add('active');
  }
  var pro=document.getElementById('pg-gaji-proses');
  if(pro)pro.style.display='block';
}
function switchKompgajiTab(el,tid){
  if(el&&el.parentElement){
    el.parentElement.querySelectorAll('.tab').forEach(function(t){t.classList.remove('active');});
    el.classList.add('active');
  }
  var kgSubs={'kg-tab-daftar':'gaji','kg-tab-tunjvar':'tunjvar'};
  if(kgSubs[tid]&&!canAccessSubTab('kompgaji',kgSubs[tid])){toast('Tidak punya akses ke tab ini');return;}
  var daftar=document.getElementById('kg-tab-daftar');
  var tv=document.getElementById('kg-tab-tunjvar');
  if(daftar&&typeof sigajiSetPanelVisible==='function')sigajiSetPanelVisible(daftar,tid==='kg-tab-daftar');
  else if(daftar)daftar.style.display=tid==='kg-tab-daftar'?'block':'none';
  if(tv&&typeof sigajiSetPanelVisible==='function')sigajiSetPanelVisible(tv,tid==='kg-tab-tunjvar');
  else if(tv)tv.style.display=tid==='kg-tab-tunjvar'?'block':'none';
  if(tid==='kg-tab-tunjvar'){
    var card=document.getElementById('tunjvar-card');
    if(card&&typeof sigajiShowEl==='function')sigajiShowEl(card);
    else if(card){card.classList.remove('u-hidden');card.removeAttribute('hidden');card.style.display='';}
    renderTunjVariabelBulan();
  }else if(tid==='kg-tab-daftar')renderKompgaji();
}
function renderKompgajiPage(){
  var tv=document.getElementById('kg-tab-tunjvar');
  var tunjOn=tv&&(typeof sigajiIsPanelVisible==='function'?sigajiIsPanelVisible(tv):tv.style.display!=='none'&&!tv.classList.contains('u-hidden'));
  if(tunjOn&&typeof renderTunjVariabelBulan==='function')renderTunjVariabelBulan();
  else renderKompgaji();
}
if(typeof window!=='undefined')window.renderKompgajiPage=renderKompgajiPage;
function applyKompgajiSubtabVisibility(){
  var tabs=document.querySelectorAll('#pg-kompgaji .tabs .tab');
  var first=null;
  tabs.forEach(function(t){
    var panel=t.getAttribute('data-kgpanel')||(t.getAttribute('data-kgtab')==='tunjvar'?'kg-tab-tunjvar':'kg-tab-daftar');
    var sub=panel==='kg-tab-tunjvar'?'tunjvar':'gaji';
    var ok=canAccessSubTab('kompgaji',sub);
    t.style.display=ok?'':'none';
    if(ok&&!first)first={el:t,panel:panel};
  });
  ['kg-tab-daftar','kg-tab-tunjvar'].forEach(function(id){var d=document.getElementById(id);if(d&&typeof sigajiSetPanelVisible==='function')sigajiSetPanelVisible(d,false);else if(d)d.style.display='none';});
  if(first&&first.panel)switchKompgajiTab(first.el,first.panel);
}
function initLemburPage(){
  var ls=document.getElementById('lembur-kar-sel');
  if(ls){var h=typeof sigajiKarOptionsHtml==='function'?sigajiKarOptionsHtml(karyawanListPeriode(PA()),''):karyawanListPeriode(PA()).map(function(k){return'<option value="'+escapeAttr(k.nik)+'">'+escapeHtml(k.nik)+' — '+escapeHtml(k.nama)+'</option>';}).join('');ls.innerHTML=h;}
  renderLemburList();
}
/** Tombol "Hitung Ulang" — render ulang tabel; opsional sinkron gapok/tunjangan dari Master. */
function hitungUlangPenggajian(){
  var p=PA();
  if(!p||!p.nama){toast('Tidak ada periode aktif');return;}
  var locked=isPeriodeLocked(p.nama);
  var synced=false;
  if(!locked){
    synced=confirm(
      'Hitung ulang periode "'+p.nama+'".\n\n'+
      'OK = perbarui gapok/tunjangan dari Master lalu hitung ulang\n'+
      'Batal = hitung ulang saja (komponen periode tidak diubah)'
    );
    if(synced)refreshKarSnapshotFromMaster(p.nama,karyawanListPeriode(p));
  }
  renderPenggajian();
  if(locked)toast('Perhitungan diperbarui (pro-rata, absensi, lembur, tunj. variabel). Periode terkunci: komponen gaji dari snapshot.');
  else if(synced)toast('Snapshot diperbarui dari Master — perhitungan selesai.');
  else toast('Perhitungan diperbarui (pro-rata, absensi, lembur, tunj. variabel).');
}
function renderPenggajian(skipTunjVar){
  if(typeof sigajiWithSkeleton==='function'){
    return sigajiWithSkeleton('tb-penggajian',12,function(){
      renderPenggajianBody(skipTunjVar);
    });
  }
  renderPenggajianBody(skipTunjVar);
}
function renderPenggajianBody(skipTunjVar){
  try{if(typeof sigajiSyncPgGajiTableHead==='function')sigajiSyncPgGajiTableHead();}catch(eTh2){sigajiCatchWarn("js/modules/app-hr.js",eTh2);}
  const p=PA();
  // Buat snapshot master untuk periode aktif (agar periode yang sudah dikerjakan tidak berubah)
  const listPeriode=karyawanListPeriode(p);
  ensureKarSnapshotPeriode(p.nama,listPeriode);
  const snap=getKarSnapshotProgress(p.nama,listPeriode);
  const el=document.getElementById('pg-periode-lbl');
  if(el)el.textContent='Periode: '+p.nama+' ('+p.start+' - '+p.end+') | Snapshot: '+snap.done+'/'+snap.total+(snap.ok?' ✓':'');
  const hk=hariKerjaRange(p.start,p.end);
  const hkEl=document.getElementById('hk-periode');if(hkEl)hkEl.textContent=hk+' hari';
  const thrInfo=document.getElementById('thr-period-info');
  if(thrInfo){
    var html=p.thr_aktif?
      '<div class="card-surface-purple p-inset rounded-md mb-lg border-default">'+
      '<div class="fw-700 ct-purple mb-sm">&#127873; Periode ini ada THR - '+escapeHtml(p.thr_nama||'Hari Raya')+'</div>'+
      '<div class="font-12 text-purple">Tgl Bayar THR: <strong>'+escapeHtml(p.thr_bayar||'-')+'</strong> &nbsp;|&nbsp; PPh THR digabung ke PPh 21</div></div>':
      '';
    thrInfo.innerHTML=html;
  }
  let prAktif=0;
  const rows=karyawanListPeriode(p).map(function(k,idx){
    const g=hitungGaji(k,p.nama);
    const ap=approvals.find(function(a){return a.nik===k.nik&&a.period===p.nama;});
    const st=ap?ap.status:'draft';
    const stBdg={pending:'<span class="bdg b-warn">Pending</span>',approved:'<span class="bdg b-ok">Disetujui</span>',rejected:'<span class="bdg b-err">Ditolak</span>',draft:''}[st]||'';
    const pr=getPR(k.nik,p.nama);
    if(!pr.manual){pr.hk=hk;const ed=new Date(p.end);pr.hh=hariHadirBulan(k.nik,ed.getFullYear(),ed.getMonth()+1);}
    if(pr.enabled)prAktif++;
    const prBtn='<button class="pr-toggle '+(pr.enabled?'on':'off')+'"'+sigajiDataAction('pr-toggle',{nik:k.nik,periode:p.nama,enabled:!pr.enabled?'1':'0'})+'>'+( pr.enabled?'&#9203; Aktif':'&#9711; Off')+'</button>';
    const prInputs=pr.enabled?'<div class="pr-input-row"><span class="u-muted-10">HK:</span><input class="pr-input" type="number" value="'+pr.hk+'" min="1" max="31" onchange="setPRField(\''+k.nik+'\',\''+p.nama+'\',\'hk\',parseInt(this.value)||1)"><span class="u-muted-10">HH:</span><input class="pr-input" type="number" value="'+pr.hh+'" min="0" max="31" onchange="setPRField(\''+k.nik+'\',\''+p.nama+'\',\'hh\',parseInt(this.value)||0)"></div>':'';
    const thrExplain=g.thrBruto>0?sigajiDataAction('explain',{nik:k.nik,periode:p.nama})+' title="Kenapa angka THR ini?"':'';
    const thrCell=g.thrBruto>0?'<div class="sigaji-money-click ct-purple fw-700"'+thrExplain+'>'+fmt(g.thrBruto)+'</div><div class="font-10 text-purple">PPh THR: '+fmt(g.pphAtasThr)+'</div>'+(typeof sigajiExplainMoneyBtn==='function'?sigajiExplainMoneyBtn(k.nik,p.nama):''):'&#8212;';
    var rowCls=[];
    if(pr.enabled)rowCls.push('pg-row-prorate');
    if(g.neto<0)rowCls.push('pg-row-neto-neg');
    if(st==='pending')rowCls.push('pg-row-pending');
    var cabPg=typeof sigajiCabangColTd==='function'?sigajiCabangColTd(k):'';
    return '<tr class="'+rowCls.join(' ')+'">'
      +'<td class="pg-sticky-no text-center fw-700 text-muted">'+(idx+1)+'</td>'
      +'<td class="pg-sticky-name"><div class="fl gap2 items-center"><div class="ka">'+ini(k.nama)+'</div>'
      +'<div><div class="knl"'+sigajiDataAction('open-profile',{nik:k.nik})+'>'+k.nama+'</div><small class="text-muted">'+k.dept+'</small></div></div></td>'
      +cabPg
      +'<td><div>'+prBtn+prInputs+'</div></td>'
      +'<td class="num cell-money"><span class="sigaji-money-click"'+sigajiDataAction('explain',{nik:k.nik,periode:p.nama})+' title="Kenapa gross ini?">'+fmt(g.grossPPh)+'</span>'+(typeof sigajiExplainMoneyBtn==='function'?sigajiExplainMoneyBtn(k.nik,p.nama):'')+'</td><td class="pg-col-adv num cell-money">'+thrCell+'</td>'
      +'<td class="pg-col-adv num cell-money">'+fmt(g.brutoTH)+'</td>'
      +'<td class="pg-col-adv num cell-money">'+fmt(g.bpjs.kes_kar+g.bpjs.jht_kar+g.bpjs.jp_kar)+'</td>'
      +'<td class="num cell-money'+(g.reconciliation&&g.reconciliation.kurangBayar>0?' cell-deduction':'')+'"><span class="sigaji-money-click"'+sigajiDataAction('explain',{nik:k.nik,periode:p.nama})+' title="Kenapa angka ini?">'+fmt(g.pph)+'</span>'+(typeof sigajiExplainMoneyBtn==='function'?sigajiExplainMoneyBtn(k.nik,p.nama):'')+(g.reconciliation&&g.reconciliation.lebihBayar>0?'<div class="font-9 text-success fw-700">&#10003; Lebih Bayar '+fmt(g.reconciliation.lebihBayar)+'</div>':g.reconciliation&&g.reconciliation.kurangBayar>0?'<div class="font-9 ct-danger">&#9650; Kurang Bayar '+fmt(g.reconciliation.kurangBayar)+'</div>':'')+'</td>'
      +'<td class="pg-col-adv num cell-money">'+(g.pphRet>0?'<span class="ct-success fw-700">+'+fmt(g.pphRet)+'</span>':'&#8212;')+'</td>'
      +'<td class="num cell-neto"><strong class="sigaji-money-click cell-neto-strong"'+sigajiDataAction('explain',{nik:k.nik,periode:p.nama})+' title="Waterfall THP">'+fmt(g.neto)+'</strong>'+(typeof sigajiExplainMoneyBtn==='function'?sigajiExplainMoneyBtn(k.nik,p.nama):'')+'</td>'
      +'<td>'+stBdg+'</td>'
      +'<td><button class="btn btn-sm btn-out"'+sigajiDataAction('payroll-detail',{nik:k.nik,periode:p.nama})+'>Detail</button></td></tr>';
  });
  var tbPg=document.getElementById('tb-penggajian');
  if(!rows.length&&typeof sigajiEmptyState==='function'){
    var pgColspan=12+(typeof sigajiMultiBranchEnabled==='function'&&sigajiMultiBranchEnabled()&&!(typeof sigajiInBranchWorkspace==='function'&&sigajiInBranchWorkspace())?1:0);
    html='<tr><td colspan="'+String(pgColspan)+'">'+sigajiEmptyState({illust:'money',title:'Belum ada karyawan di periode ini',desc:'Tambahkan karyawan atau aktifkan periode gaji yang sesuai.',btnLabel:'Buka Master Karyawan',btnAction:'showPg',btnActionArg:'karyawan'})+'</td></tr>';
    tbPg.innerHTML=html;
  }else tbPg.innerHTML=rows.join('');
  const ae=document.getElementById('pr-aktif');if(ae)ae.textContent=prAktif+' karyawan';
}
function kirimApproval(){
  const p=PA();let added=0;
  karyawanListPeriode(p).forEach(function(k){
    if(!approvals.find(function(a){return a.nik===k.nik&&a.period===p.nama;})){
      const g=hitungGaji(k,p.nama);
      approvals.push({id:Date.now()+Math.random(),nik:k.nik,nama:k.nama,period:p.nama,bruto:g.grossPPh,neto:g.neto,status:'pending',time:new Date().toLocaleTimeString('id-ID',{hour:'2-digit',minute:'2-digit'})});
      added++;
    }
  });
  if(added>0){saveAll();renderApproval();renderDash();toast(added+' slip dikirim');}else toast('Semua sudah dikirim');
}
function renderApproval(){
  const pend=approvals.filter(function(a){return a.status==='pending';});
  const hist=approvals.filter(function(a){return a.status!=='pending';});
  document.getElementById('ap-pend-list').innerHTML=pend.length?pend.map(function(a){
    const k=karyawan.find(function(x){return x.nik===a.nik;});
    const g=k?hitungGaji(k,a.period):null;
    return '<div class="approval-pending-card fl items-start flex-wrap gap-md mb-md">'
      +'<div class="flex-1"><div class="font-12 fw-700">'+a.nama+' - '+a.period+'</div>'
      +'<div class="u-muted-11">'+a.time+' | Neto: <strong>'+(g?fmt(g.neto):fmt(a.neto))+'</strong></div></div>'
      +'<div class="fl gap1"><button class="btn btn-sm btn-g"'+sigajiDataAction('approval-approve',{id:a.id})+'>&#10003; Setujui</button><button class="btn btn-sm btn-r"'+sigajiDataAction('approval-reject',{id:a.id})+'>&#10007; Tolak</button></div></div>';
  }).join(''):'<div class="text-center text-muted" style="padding:1.5rem">Tidak ada yang tertunda</div>';
  document.getElementById('ap-hist-list').innerHTML=hist.map(function(a){
    return '<div class="approval-done-card fl justify-between items-center flex-wrap gap-xs '+(a.status==='approved'?'is-approved':'is-rejected')+'">'
      +'<div><div class="font-12 fw-700">'+a.nama+' - '+a.period+'</div>'
      +'<div class="u-muted-11">'+a.time+(a.approvedBy?' | '+a.approvedBy:'')+'</div></div>'
      +'<span class="bdg '+(a.status==='approved'?'b-ok':'b-err')+'">'+(a.status==='approved'?'Disetujui':'Ditolak')+'</span></div>';
  }).join('');
}
function approveItem(id){const a=approvals.find(function(x){return sigajiSameId(x.id,id);});if(!a)return;a.status='approved';a.approvedBy=CU.nama;saveAll();renderApproval();renderPenggajian();toast('Disetujui');}
function rejectItem(id){const a=approvals.find(function(x){return sigajiSameId(x.id,id);});if(!a)return;a.status='rejected';a.approvedBy=CU.nama;saveAll();renderApproval();renderPenggajian();toast('Ditolak');}
function hapusApproval(){if(!confirm('Hapus riwayat?'))return;approvals=[];saveAll();renderApproval();toast('Dihapus');}
function detailGaji(nik,pNama){
  const k=karyawan.find(function(x){return x.nik===nik;});if(!k)return;
  const pN=pNama||PA().nama;
  const p=periodes.find(function(x){return x.nama===pN;})||PA();
  const g=hitungGaji(k,pN);
  const tbl=getTERTable(k.ptkp);
  const rate=(tbl.find(function(r){return g.grossPPh<=r[0];})||[0,.34])[1];
  document.getElementById('m-gaji-t').textContent='Detail Gaji - '+k.nama+' ('+pN+')';
  let h='';
  if(g.thrBruto>0)h+='<div class="card-surface-purple p-inset-sm tabs-spaced-lg font-12"><strong>&#127873; THR:</strong> '+fmt(g.thrBruto)+' dibayar full netto. PPh THR: <strong>'+fmt(g.pphAtasThr)+'</strong> dipotong dari gaji ini.</div>';
  h+='<div class="gross-sec"><div class="gross-tit">GROSS INCOME (dasar PPh 21)</div>';
  h+='<div class="cr"><span>Gaji Pokok'+(g.isPR?' (Pro-Rata '+g.pr.hh+'/'+g.pr.hk+')':'')+'</span><span>'+fmt(g.gapokEff)+'</span></div>';
  g.tItems.forEach(function(t){h+='<div class="cr"><span>'+t.nama+(t.isHarian?' [masuk PPh, tidak TH]':(t.inTH===false?' [tidak TH]':''))+'</span><span>'+fmt(t.eff)+'</span></div>';});
  if(g.natKP>0)h+='<div class="cr"><span>Natura KP</span><span>'+fmt(g.natKP)+'</span></div>';
  if(g.lb>0)h+='<div class="cr"><span>Lembur</span><span>'+fmt(g.lb)+'</span></div>';
  if(g.bpjsPrsNatKP>0)h+='<div class="cr ct-brand"><span>BPJS Prs JKK+JKM+Kes (Natura KP)</span><span>'+fmt(g.bpjsPrsNatKP)+'</span></div>';
  if(g.thrBruto>0)h+='<div class="cr ct-purple fw-700"><span>THR Bruto</span><span>'+fmt(g.thrBruto)+'</span></div>';
  h+='<div class="cr bold"><span>Total Gross PPh 21</span><span>'+fmt(g.grossPPh)+'</span></div></div>';
  h+='<div class="pph-calc-sec"><div class="pph-calc-tit">PPh 21 - TER PMK 168/2023</div>';
  h+='<div class="cr"><span>Penghasilan Bruto</span><span>'+fmt(g.grossPPh)+'</span></div>';
  if(g.thrBruto>0)h+='<div class="cr ct-purple"><span>Porsi PPh atas THR</span><span>'+fmt(g.pphAtasThr)+'</span></div>';
  h+='<div class="cr result"><span>TER '+k.ptkp+': '+(rate*100).toFixed(2)+'% × '+fmt(g.grossPPh)+' = <strong>PPh 21 bulan ini</strong></span><span><strong>'+fmt(g.pph)+'</strong></span></div></div>';
  h+='<div class="fl mt-lg flex-wrap" style="gap:.75rem">';
  h+='<div class="flex-1"><div class="stit">Take Home Bruto</div><div class="pr-row-info"><span>Gaji + Tunjangan + Lembur</span><span>'+fmt(g.brutoTH-g.natNKP)+'</span></div>';
  if(g.natNKP>0)h+='<div class="pr-row-info"><span>Natura Tidak KP</span><span>'+fmt(g.natNKP)+'</span></div>';
  h+='<div class="pr-row-info fw-700 gs-divider"><span>Total Take Home Bruto</span><span>'+fmt(g.brutoTH)+'</span></div>';
  if(g.thrBruto>0)h+='<div class="font-10 text-purple">THR TIDAK masuk TH (dibayar terpisah)</div>';
  h+='</div>';
  h+='<div class="flex-1"><div class="stit">Potongan</div><div class="pr-row-info"><span>PPh 21</span><span>- '+fmt(g.pph)+'</span></div><div class="pr-row-info"><span>BPJS Kar</span><span>- '+fmt(g.bpjs.kes_kar+g.bpjs.jht_kar+g.bpjs.jp_kar)+'</span></div>';
  (k.potongan||[]).forEach(function(x){h+='<div class="pr-row-info"><span>'+x.nama+'</span><span>- '+fmt(x.nilai)+'</span></div>';});
  if(g.pphRet>0)h+='<div class="pr-row-info ct-success"><span>Return PPh</span><span>+ '+fmt(g.pphRet)+'</span></div>';
  h+='</div></div>';
  h+='<div class="rounded-sm p-inset-sm fl justify-between fw-800 mt-lg font-14 btn-email"><span>TAKE HOME PAY</span><span>'+fmt(g.neto)+'</span></div>';
  // Tambahkan reconciliation box untuk masa pajak terakhir
  if(g.reconciliation){
    const r=g.reconciliation;
    const isLebih=r.lebihBayar>0;
    h+='<div class="recon-panel '+(isLebih?'is-refund':'is-owe')+'">';
    h+='<div class="fw-800 mb-md recon-panel-title '+(isLebih?'is-refund':'is-owe')+'">&#9654; Rekonsiliasi PPh 21 '+(r.tipePeriode==='resign'?'(Masa Pajak Terakhir - Resign)':'(Desember - Progresif)')+'</div>';
    if(r.saldoAwalBruto>0||r.saldoAwalPph>0){
      h+='<div class="cr ct-brand"><span>Saldo migrasi'+(r.saldoSdBulan?' (s/d bln '+r.saldoSdBulan+')':'')+' — bruto / PPh</span><span>'+fmt(r.saldoAwalBruto)+' / '+fmt(r.saldoAwalPph)+'</span></div>';
      if(r.brutoDariPeriode>0||r.pphDariPeriode>0)h+='<div class="cr"><span>+ Dari periode SiGaji (sebelum bulan ini)</span><span>'+fmt(r.brutoDariPeriode)+' / '+fmt(r.pphDariPeriode)+'</span></div>';
    }
    h+='<div class="cr"><span>Total Bruto YTD (kumulatif sebelum bulan ini)</span><span>'+fmt(r.brutoYTD)+'</span></div>';
    h+='<div class="cr"><span>Bruto bulan ini</span><span>'+fmt(g.grossPPh)+'</span></div>';
    h+='<div class="cr bold"><span>Total Bruto Setahun</span><span>'+fmt(r.brutoTahunan)+'</span></div>';
    h+='<div class="cr mt-xs"><span>PPh Tahunan (Progresif Pasal 17)</span><span>'+fmt(r.pphTahunan)+'</span></div>';
    h+='<div class="cr"><span>PPh sudah dipotong (Jan s.d. bulan lalu)</span><span>- '+fmt(r.pphYTD)+'</span></div>';
    h+='<div class="cr bold recon-panel-amount '+(isLebih?'is-refund':'is-owe')+'"><span>'+(isLebih?'&#10003; Lebih Bayar (dikembalikan)':'&#9888; Kurang Bayar (dipotong)')+' </span><span>'+( isLebih?'+ ':'')+fmt(isLebih?r.lebihBayar:r.kurangBayar)+'</span></div>';
    if(isLebih&&r.opsiLebihBayar==='carryover')h+='<div class="font-10 ct-purple mt-xs">&#8594; Lebih bayar di-carry over ke Januari tahun depan</div>';
    if(isLebih&&r.opsiLebihBayar==='refund')h+='<div class="font-10 ct-success mt-xs">&#8594; Lebih bayar dikembalikan langsung bulan ini (PPh = Rp 0)</div>';
    h+='</div>';
  }
  document.getElementById('m-gaji-c').innerHTML=h;
  openModal('m-gaji');
}
