/* SiGaji — dashboard, master karyawan */
var karFilterTipe = '';
var karFilterSiklus = '';

function karMatchesTipeFilter(k) {
  if (!karFilterTipe) return true;
  var t =
    typeof sigajiNormalizeKarTipe === 'function' ? sigajiNormalizeKarTipe(k.tipe_kerja, k) : 'tetap';
  return t === karFilterTipe;
}

function karMatchesSiklusFilter(k) {
  if (!karFilterSiklus) return true;
  return karSiklusGajiOf(k) === karFilterSiklus;
}

function karRefreshMasterList() {
  var q = (document.getElementById('kar-search') && document.getElementById('kar-search').value) || '';
  if (q) filterKar(q);
  else renderKar();
}

function setKarFilterTipe(v) {
  karFilterTipe = v || '';
  karRefreshMasterList();
}

function setKarFilterSiklus(v) {
  karFilterSiklus = v === 'harian' || v === 'mingguan' || v === 'bulanan' ? v : '';
  karRefreshMasterList();
}
if (typeof window !== 'undefined') window.setKarFilterSiklus = setKarFilterSiklus;

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

function karSiklusGajiOf(k){
  var v=k&&k.siklus_gaji;
  return typeof sigajiNormalizeSiklusGaji==='function'?sigajiNormalizeSiklusGaji(v):(typeof normalizeSiklusGaji==='function'?normalizeSiklusGaji(v):'bulanan');
}
function syncSiklusGajiLabels(k){
  var sel=document.getElementById('sp-siklus-gaji-f');
  var siklus=k?karSiklusGajiOf(k):(sel?karSiklusGajiOf({siklus_gaji:sel.value}):'bulanan');
  if(sel&&k)sel.value=siklus;
  var suf=typeof sigajiSiklusGajiRateSuffix==='function'?sigajiSiklusGajiRateSuffix(siklus):(siklus==='harian'?'per Hari':siklus==='mingguan'?'per Minggu':'per Bulan');
  var lbl=document.getElementById('sp-gapok-lbl');
  if(lbl)lbl.textContent='Gaji Pokok '+suf+' (Rp)';
  var hint=document.getElementById('sp-gapok-siklus-hint');
  if(hint){
    hint.textContent=siklus==='bulanan'
      ?'PPh 21 & BPJS dihitung dari total penghasilan sebulan.'
      :siklus==='harian'
        ?'Upah = tarif × hari hadir. BPJS = tarif × 25 (atau × 21 jika 5 hari/minggu). PPh dari total sebulan. Tiap hari ada cadangan potongan, true-up di hari terakhir.'
        :'PPh dari jumlah transfer di masa pajak (contoh Oktober Jumat × 5). BPJS tetap upah sehari × 25, bukan × jumlah Jumat.';
  }
  var rowHg=document.getElementById('sp-hari-gaji-row');
  if(rowHg)rowHg.style.display=siklus==='mingguan'?'':'none';
}
function onSpSiklusGajiChange(){
  var sel=document.getElementById('sp-siklus-gaji-f');
  syncSiklusGajiLabels(sel?{siklus_gaji:sel.value}:null);
}
if(typeof window!=='undefined'){
  window.onSpSiklusGajiChange=onSpSiklusGajiChange;
  window.syncSiklusGajiLabels=syncSiklusGajiLabels;
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
  const p=PA();const hP=Math.max(0,Math.ceil((new Date(p.bayar).getTime()-Date.now())/86400000));
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
        else if(st==='izin'){stats.izin++;daySt.izin++;}
        else if(st==='setengah_ijin'){stats.izin+=.5;daySt.izin+=.5;stats.hadir+=.5;daySt.hadir+=.5;}
        else if(st==='sakit'){stats.sakit++;daySt.sakit++;}
        else if(st==='setengah_sakit'){stats.sakit+=.5;daySt.sakit+=.5;stats.hadir+=.5;daySt.hadir+=.5;}
        else if(st==='alpha'){stats.alpha++;daySt.alpha++;}
      });
      var maxK=list.length||1;
      var h=Math.max(4,Math.round((daySt.hadir/maxK)*120));
      bars.push({d:x.d,iso:iso,h:h,hadir:daySt.hadir,izin:daySt.izin,sakit:daySt.sakit,alpha:daySt.alpha});
    });
    var nKar=list.length;
    var nDays=bars.length;
    var fmtHr=function(n){return typeof fmtHariAbsen==='function'?fmtHariAbsen(n,false):String(n||0);};
    var barHtml=bars.map(function(b){
      var tip='Tgl '+b.d+' ('+b.iso+'): '+fmtHr(b.hadir)+' dari '+nKar+' karyawan hadir';
      if(b.izin)tip+=' · izin '+fmtHr(b.izin);
      if(b.sakit)tip+=' · sakit '+fmtHr(b.sakit);
      if(b.alpha)tip+=' · alpha '+fmtHr(b.alpha);
      return '<div class="dash-att-bar-wrap"><div class="dash-att-bar" style="height:'+b.h+'px" title="'+tip+'"></div>'
        +'<div class="dash-att-bar-lbl">'+b.d+'</div>'
        +(nKar?'<div class="dash-att-bar-sub">'+fmtHr(b.hadir)+'/'+nKar+'</div>':'')+'</div>';
    }).join('');
    var avgHadir=nDays&&nKar?Math.round((stats.hadir/(nDays*nKar))*100):0;
    attHtml='<p class="dash-att-hint">Grafik harian — proporsi hadir per hari.</p>'
      +(barHtml?'<div class="dash-att-chart">'+barHtml+'</div>':typeof sigajiEmptyState==='function'?sigajiEmptyState({icon:'&#128197;',title:'Belum ada hari',desc:'Periode belum valid.',btnLabel:'Atur periode',btnAction:'showPg',btnActionArg:'master'}):'<div class="text-subtle p-md">—</div>')
      +'<div class="dash-att-legend">'
      +'<span class="lg-hadir">Hadir: '+fmtHr(stats.hadir)+'</span>'
      +'<span class="lg-izin">Izin: '+fmtHr(stats.izin)+'</span>'
      +'<span class="lg-sakit">Sakit: '+fmtHr(stats.sakit)+'</span>'
      +'<span class="lg-alpha">Alpha: '+fmtHr(stats.alpha)+'</span>'
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
var __karListMode='aktif'; /* aktif | resign | sampah */
var KAR_SAMPAH_MS=30*24*60*60*1000;
function isKarSampah(k){return !!(k&&k.dihapusPada);}
function isKarResign(k){return !isKarSampah(k)&&!!String((k&&k.tgl_berhenti)||'').trim();}
function bersihkanSampahKadaluarsa(){
  var now=Date.now();
  var berubah=false;
  (karyawan||[]).forEach(function(k){
    if(!k||!k.dihapusPada)return;
    var t=Date.parse(k.dihapusPada);
    if(!isFinite(t)||now-t<KAR_SAMPAH_MS)return;
    delete absensi[k.nik];
    delete lembur[k.nik];
    k._buang=true;
    berubah=true;
  });
  if(!berubah)return;
  karyawan=(karyawan||[]).filter(function(k){return !k._buang;});
  saveAll();
}
function listKarMasterBase(){
  bersihkanSampahKadaluarsa();
  if(__karListMode==='sampah'){
    var sampah=sortKaryawanByNik((karyawan||[]).filter(isKarSampah));
    if(typeof sigajiFilterKaryawanByCabang==='function')sampah=sigajiFilterKaryawanByCabang(sampah);
    return sampah.filter(karMatchesTipeFilter).filter(karMatchesSiklusFilter);
  }
  var list=typeof karyawanSortedAll==='function'?karyawanSortedAll():sortKaryawanByNik(karyawan||[]);
  if(typeof sigajiFilterKaryawanByCabang==='function')list=sigajiFilterKaryawanByCabang(list);
  list=list.filter(karMatchesTipeFilter).filter(karMatchesSiklusFilter);
  var p=typeof PA==='function'?PA():null;
  if(__karListMode==='resign'){
    return list.filter(function(k){
      return typeof karyawanResignSampaiPeriode==='function'?karyawanResignSampaiPeriode(k,p):isKarResign(k);
    }).sort(typeof cmpKarResignTglDesc==='function'?cmpKarResignTglDesc:function(a,b){
      var d=String(b.tgl_berhenti||'').localeCompare(String(a.tgl_berhenti||''));
      if(d)return d;
      return karSiklusThenNikCmp(a,b);
    });
  }
  if(p&&typeof karyawanInPeriode==='function'){
    list=list.filter(function(k){return karyawanInPeriode(k,p);});
  }
  return list.filter(function(k){
    return typeof karyawanResignSampaiPeriode==='function'? !karyawanResignSampaiPeriode(k,p) : !isKarResign(k);
  }).sort(karSiklusThenNikCmp);
}
function karSiklusThenNikCmp(a,b){
  var ra=typeof sigajiSiklusGajiSortRank==='function'?sigajiSiklusGajiSortRank(karSiklusGajiOf(a)):(karSiklusGajiOf(a)==='harian'?2:karSiklusGajiOf(a)==='mingguan'?1:0);
  var rb=typeof sigajiSiklusGajiSortRank==='function'?sigajiSiklusGajiSortRank(karSiklusGajiOf(b)):(karSiklusGajiOf(b)==='harian'?2:karSiklusGajiOf(b)==='mingguan'?1:0);
  if(ra!==rb)return ra-rb;
  return String(a.nik||'').localeCompare(String(b.nik||''),'id',{numeric:true,sensitivity:'base'});
}
function updateKarResignTabBadge(){
  var ns=0;
  (karyawan||[]).forEach(function(k){
    if(isKarSampah(k))ns++;
  });
  var sb=document.getElementById('kar-sampah-badge');
  if(sb){
    sb.textContent=String(ns);
    sb.style.display=ns>0?'inline-block':'none';
  }
  var acts=document.getElementById('kar-actions-aktif');
  if(acts)acts.style.display=__karListMode==='aktif'?'':'none';
  var search=document.getElementById('kar-search');
  if(search){
    search.placeholder=__karListMode==='resign'?'Cari resign (nama, NIK, tgl…)…':__karListMode==='sampah'?'Cari di sampah…':'Cari nama, NIK, dept...';
  }
}
function switchKarListTab(el,mode){
  __karListMode=mode==='sampah'?'sampah':mode==='resign'?'resign':'aktif';
  document.querySelectorAll('#kar-list-tabs .tab').forEach(function(t){
    t.classList.toggle('active',t.getAttribute('data-kartab')===__karListMode);
  });
  updateKarResignTabBadge();
  karRefreshMasterList();
}
if(typeof window!=='undefined')window.switchKarListTab=switchKarListTab;
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
  const cutiCell=tipe==='tidak_tetap'?'<span class="bdg b-gray" title="Cuti tahunan biasanya tidak dipakai">—</span>':`<span class="bdg ${sCls} sigaji-money-click"${sigajiDataAction('cuti-detail',{nik:k.nik,yr:yrKar})} title="Klik: lihat tanggal cuti ${yrKar}">${sLbl}</span>`;
  const tgBtn=(CU&&(CU.role==='Admin'||CU.role==='HRD'))?`<button class="btn btn-sm btn-out"${sigajiDataAction('telegram',{nik:k.nik})}>Telegram</button>`:'';
  var cabCol=typeof sigajiCabangColTd==='function'?sigajiCabangColTd(k):'';
  var stop=String(k.tgl_berhenti||'').trim();
  var resignBadge=stop?' <span class="bdg b-err" title="Tgl. berhenti '+escapeAttr(stop)+'">Resign</span>':'';
  var siklus=karSiklusGajiOf(k);
  var siklusLbl=typeof sigajiSiklusGajiLabel==='function'?sigajiSiklusGajiLabel(siklus):(siklus==='harian'?'Harian':siklus==='mingguan'?'Mingguan':'Bulanan');
  var siklusCls=siklus==='harian'?'b-teal':siklus==='mingguan'?'b-warn':'b-info';
  var subLine=escapeHtml(k.nik)+(stop?' · berhenti '+fmtDate(stop):'');
  var aksi=__karListMode==='sampah'
    ?`<button class="btn btn-sm btn-p"${sigajiDataAction('restore-kar',{nik:k.nik})}>Pulihkan</button><button class="btn btn-sm btn-r"${sigajiDataAction('purge-kar',{nik:k.nik})}>Hapus permanen</button>`
    :`<button class="btn btn-sm btn-p"${sigajiDataAction('open-profile',{nik:k.nik})}>Profil</button>${tgBtn}<button class="btn btn-sm btn-r"${sigajiDataAction('delete-kar',{nik:k.nik})}>Hapus</button>`;
  return`<tr><td class="text-center text-muted fw-700 sticky-no">${no}</td><td class="sticky-name"><div class="fl gap2 items-center"><div class="ka">${ini(k.nama)}</div><div><div class="knl"${sigajiDataAction('open-profile',{nik:k.nik})}>${escapeHtml(k.nama)} &#8599;${resignBadge}</div><div class="font-10 text-muted font-mono">${subLine}</div></div></div></td><td><span class="bdg ${tipeCls}">${escapeHtml(tipeLbl)}</span></td><td><span class="bdg ${siklusCls}">${escapeHtml(siklusLbl)}</span></td>${cabCol}<td>${escapeHtml(k.dept)}</td><td>${escapeHtml(k.jabatan)}</td><td><span class="bdg ${stCls}">${escapeHtml(k.status)}</span></td><td><span class="bdg b-info">${escapeHtml(k.ptkp)}</span></td><td>${cutiCell}</td><td><div class="fl gap1">${aksi}</div></td></tr>`;
}
function renderKar(){
  if(typeof sigajiWithSkeleton==='function'){
    return sigajiWithSkeleton('tb-kar',10,renderKarBody);
  }
  renderKarBody();
}
function renderKarBody(){
  try{if(typeof sigajiSyncKarTableHead==='function')sigajiSyncKarTableHead();}catch(eTh){sigajiCatchWarn("js/modules/app-hr.js",eTh);}
  updateKarResignTabBadge();
  var list=listKarMasterBase();
  const el=document.getElementById('kar-count');
  if(el){
    var pNama=(typeof PA==='function'&&PA()&&PA().nama)?PA().nama:'';
    var pSuf=pNama?' • '+pNama:'';
    el.textContent=__karListMode==='sampah'
      ?(list.length+' di sampah (pulihkan dalam 30 hari)'+pSuf)
      :__karListMode==='resign'
      ?(list.length+' resign'+pSuf)
      :(list.length+' karyawan aktif'+pSuf);
  }
  try{if(typeof sigajiRenderLicenseQuotaUi==='function')sigajiRenderLicenseQuotaUi();}catch(eLq){sigajiCatchWarn("js/modules/app-hr.js",eLq);}
  const tb=document.getElementById('tb-kar');if(!tb)return;
  if(!list.length&&typeof sigajiEmptyState==='function'){
    var karColspan=10+(typeof sigajiMultiBranchEnabled==='function'&&sigajiMultiBranchEnabled()&&!(typeof sigajiInBranchWorkspace==='function'&&sigajiInBranchWorkspace())?1:0);
    var filtered=!!(karFilterTipe||karFilterSiklus);
    var empty=__karListMode==='sampah'
      ?sigajiEmptyState({icon:'&#128465;',title:filtered?'Tidak ada yang cocok':'Sampah kosong',desc:'Karyawan yang dihapus tersimpan 30 hari di sini, lalu dihapus permanen.'})
      :__karListMode==='resign'
      ?sigajiEmptyState({icon:'&#128101;',title:filtered?'Tidak ada resign yang cocok':'Belum ada karyawan resign sampai periode ini',desc:filtered?'Ubah filter tipe pegawai atau tipe gaji.':'Semua yang sudah berhenti sampai akhir periode terpilih tampil di sini, yang resign paling baru di atas.'})
      :filtered
        ?sigajiEmptyState({icon:'&#128101;',title:'Tidak ada karyawan yang cocok',desc:'Ubah filter tipe pegawai atau tipe gaji.'})
        :sigajiEmptyState({icon:'&#128101;',title:'Belum ada karyawan aktif',desc:'Tambah pegawai tetap/tidak tetap atau import Excel untuk mulai payroll.',btnLabel:'+ Pegawai Tetap',btnAction:'openNewKar',btnActionArg:'tetap'});
    var emptyKarRow='<tr><td colspan="'+String(karColspan)+'">'+empty+'</td></tr>';
    if(typeof sigajiSetTbodyRows==='function')sigajiSetTbodyRows(tb,[emptyKarRow],1);
    else tb.replaceChildren();
    return;
  }
  var rows=list.map((k,i)=>karRowHtml(k,i+1));
  if(typeof sigajiSetTbodyRows==='function')sigajiSetTbodyRows(tb,rows);
  else tb.innerHTML=rows.join('');
}
function filterKar(q){
  var base=listKarMasterBase();
  var qq=String(q||'').toLowerCase();
  const r=!qq?base:base.filter(function(k){
    var sik=karSiklusGajiOf(k);
    var sikLbl=typeof sigajiSiklusGajiLabel==='function'?sigajiSiklusGajiLabel(sik):sik;
    return (k.nama+k.nik+k.jabatan+k.dept+sikLbl+(k.tgl_berhenti||'')).toLowerCase().includes(qq);
  });
  var cnt=document.getElementById('kar-count');
  if(cnt)cnt.textContent=r.length+' ditampilkan';
  var tb=document.getElementById('tb-kar');
  var rows=r.map((k,i)=>karRowHtml(k,i+1));
  if(tb&&typeof sigajiSetTbodyRows==='function')sigajiSetTbodyRows(tb,rows);
  else if(tb)tb.innerHTML=rows.join('');
}
