/* SiGaji — absensi, cuti, lembur, hari libur */
// ── ABSENSI ──────────────────────────────────────
/** Daftar tanggal ISO (YYYY-MM-DD) dari p.start s.d. p.end untuk grid kalender */
function absensiDaysFromPeriode(p){
  if(!p||!p.start||!p.end)return[];
  var days=[];
  var cur=new Date(String(p.start).trim()+'T12:00:00');
  var end=new Date(String(p.end).trim()+'T12:00:00');
  if(isNaN(cur.getTime())||isNaN(end.getTime()))return[];
  while(cur<=end){
    var y=cur.getFullYear();
    var m=cur.getMonth()+1;
    var da=cur.getDate();
    var dt=y+'-'+String(m).padStart(2,'0')+'-'+String(da).padStart(2,'0');
    days.push({date:dt,dow:cur.getDay(),d:da,m:m});
    cur.setDate(cur.getDate()+1);
  }
  return days;
}
function populateAbsensiPeriodeSelect(){
  var sel=document.getElementById('ab-periode-sel');
  if(!sel)return;
  var prev=sel.value;
  var sorted=(periodes||[]).slice().sort(function(a,b){return new Date(a.start||0)-new Date(b.start||0);});
  sel.innerHTML=sorted.map(function(p){
    var label=(p.nama||'')+' · '+fmtDate(p.start)+' – '+fmtDate(p.end);
    return '<option value="'+p.id+'">'+escapeHtml(label)+'</option>';
  }).join('');
  if(prev&&sorted.some(function(p){return String(p.id)===String(prev);}))sel.value=prev;
  else{
    var aktif=PA();
    if(aktif&&sorted.some(function(p){return p.id===aktif.id;}))sel.value=String(aktif.id);
    else if(sorted.length)sel.value=String(sorted[sorted.length-1].id);
  }
}
async function absensiPrefetchMobileLogs(dateFrom,dateTo){
  if(typeof sigajiIsCloudConfigured!=='function'||!sigajiIsCloudConfigured())return;
  if(typeof sigajiMobileFetch!=='function')return;
  window._mobLogByNikDate=window._mobLogByNikDate||{};
  var cur=new Date(String(dateFrom).trim()+'T12:00:00');
  var end=new Date(String(dateTo).trim()+'T12:00:00');
  if(isNaN(cur.getTime())||isNaN(end.getTime()))return;
  while(cur<=end){
    var iso=cur.toISOString().substring(0,10);
    try{
      var j=await sigajiMobileFetch('mobile-attendance?work_date='+encodeURIComponent(iso),{method:'GET'});
      if(j&&j.ok)(j.items||[]).forEach(function(row){
        if(!row||!row.nik||row.event_type!=='check_in')return;
        if(row.validation_status!=='ok'&&row.validation_status!=='pending_review')return;
        var key=row.nik+'|'+iso;
        var t=row.created_at?String(row.created_at).substring(11,16):'';
        if(t)window._mobLogByNikDate[key]=mobFmtTimeIso?mobFmtTimeIso(row.created_at):t;
      });
    }catch(e){sigajiCatchWarn("js/modules/app-absensi.js",e);}
    cur.setDate(cur.getDate()+1);
  }
}
function absensiMobileTip(nik,date){
  var m=window._mobLogByNikDate||{};
  var t=m[nik+'|'+date];
  return t?' title="Check-in mobile: '+t+' WIB"':'';
}
function abMonthLabel(ym){
  if(!ym)return '-';
  var p=ym.split('-');
  var bln=['','Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'];
  return (bln[parseInt(p[1],10)]||p[1])+' '+p[0];
}
function abSetViewMonth(ym){
  window.__sigajiAbMonth=ym||'';
  renderAbsensi();
}
function abShiftViewMonth(delta){
  var keys=window.__sigajiAbMonthKeys||[];
  if(!keys.length)return;
  var cur=window.__sigajiAbMonth||keys[0];
  var i=keys.indexOf(cur);
  if(i<0)i=0;
  i=Math.max(0,Math.min(keys.length-1,i+(delta||0)));
  abSetViewMonth(keys[i]);
}
function renderAbsensi(){
  if(typeof sigajiWithSkeleton==='function'){
    return sigajiWithSkeleton('ab-grid-wrap',12,renderAbsensiBody);
  }
  renderAbsensiBody();
}
function renderAbsensiBody(){
  var infoEl=document.getElementById('ab-kal-periode-info');
  function hideKalBanner(){if(infoEl){infoEl.style.display='none';infoEl.textContent='';}}
  populateAbsensiPeriodeSelect();
  var pid=document.getElementById('ab-periode-sel')&&document.getElementById('ab-periode-sel').value;
  var pAbs=periodes.find(function(x){return String(x.id)===String(pid);})||PA();
  if(!karyawan.length){
    hideKalBanner();
    document.getElementById('ab-grid-wrap').innerHTML=typeof sigajiEmptyState==='function'?sigajiEmptyState({icon:'&#128101;',title:'Belum ada karyawan',desc:'Import Excel atau tambah manual di Master Karyawan untuk mulai mengisi absensi.',btnLabel:'Tambah karyawan',btnAction:'showPg',btnActionArg:'karyawan'}):'<div class="text-center text-subtle p-empty-pad">Belum ada karyawan.</div>';
    document.getElementById('ab-rekap-wrap').innerHTML='';
    return;
  }
  if(!pAbs||!pAbs.start||!pAbs.end){
    hideKalBanner();
    document.getElementById('ab-grid-wrap').innerHTML=typeof sigajiEmptyState==='function'?sigajiEmptyState({icon:'&#128197;',title:'Periode gaji belum lengkap',desc:'Atur tanggal mulai dan akhir di Master → Periode Gaji.',btnLabel:'Atur periode',btnAction:'showPg',btnActionArg:'master'}):'<div class="text-center text-subtle p-empty-pad">Belum ada periode gaji dengan tanggal mulai/akhir. Atur di Master → Periode Gaji.</div>';
    document.getElementById('ab-rekap-wrap').innerHTML='';
    return;
  }
  const ST_LBL={hadir:'H',cuti:'C',izin:'I',sakit:'S',setengah_sakit:'1/2S',setengah_ijin:'1/2I',alpha:'A',libur:'L',libnas:'LN'};
  const ST_BG={hadir:'var(--ab-hadir-bg)',cuti:'var(--ab-cuti-bg)',izin:'var(--ab-izin-bg)',sakit:'var(--ab-sakit-bg)',setengah_sakit:'var(--ab-half-sakit-bg)',setengah_ijin:'var(--ab-half-ijin-bg)',alpha:'var(--ab-alpha-bg)',libur:'var(--ab-libur-bg)',libnas:'var(--ab-libnas-bg)'};
  const ST_TX={hadir:'var(--ab-hadir-fg)',cuti:'var(--ab-cuti-fg)',izin:'var(--ab-izin-fg)',sakit:'var(--ab-sakit-fg)',setengah_sakit:'var(--ab-half-sakit-fg)',setengah_ijin:'var(--ab-half-ijin-fg)',alpha:'var(--ab-alpha-fg)',libur:'var(--ab-libur-fg)',libnas:'var(--ab-libnas-fg)'};
  const bulanSingkat=['','Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agu','Sep','Okt','Nov','Des'];
  const daysAll=absensiDaysFromPeriode(pAbs);
  if(!daysAll.length){
    hideKalBanner();
    document.getElementById('ab-grid-wrap').innerHTML='<div class="text-center text-subtle p-empty-pad">Rentang periode tidak valid.</div>';
    document.getElementById('ab-rekap-wrap').innerHTML='';
    return;
  }
  var monthMap={};
  daysAll.forEach(function(x){monthMap[x.date.substring(0,7)]=x.m;});
  var monthKeys=Object.keys(monthMap).sort();
  window.__sigajiAbMonthKeys=monthKeys;
  if(!window.__sigajiAbMonth||monthKeys.indexOf(window.__sigajiAbMonth)<0)
    window.__sigajiAbMonth=monthKeys[0]||'';
  var days=daysAll.filter(function(x){return x.date.substring(0,7)===window.__sigajiAbMonth;});
  var mi=monthKeys.indexOf(window.__sigajiAbMonth);
  var monthNav='<div class="ab-month-nav">'
    +'<button type="button" class="btn btn-xs btn-out"'+sigajiDataAction('ab-shift-month',{delta:-1})+(mi<=0?' disabled':'')+'>&#9664;</button>'
    +'<span class="ab-month-lbl">'+abMonthLabel(window.__sigajiAbMonth)+'</span>'
    +'<button type="button" class="btn btn-xs btn-out"'+sigajiDataAction('ab-shift-month',{delta:1})+(mi>=monthKeys.length-1?' disabled':'')+'>&#9654;</button>'
    +'<select class="toolbar-select ab-month-sel" onchange="abSetViewMonth(this.value)">'
    +monthKeys.map(function(k){return'<option value="'+k+'" '+(k===window.__sigajiAbMonth?'selected':'')+'>'+abMonthLabel(k)+'</option>';}).join('')
    +'</select></div>';
  var hdrSub='Kalender absensi — '+pAbs.nama+' · '+fmtDate(pAbs.start)+' – '+fmtDate(pAbs.end)+' · '+daysAll.length+' hari (tampil: '+days.length+' hari)';
  if(infoEl){
    if(typeof sigajiShowEl==='function')sigajiShowEl(infoEl);
    else infoEl.style.display='block';
    infoEl.textContent=hdrSub;
  }
  var adaSelTerkunci=CU&&CU.role!=='Admin'&&days.some(function(x){return !canEditDataPadaTanggalIso(x.date);});
  var roBanner=adaSelTerkunci?'<div class="info-box info-amber font-11 mb-lg">Sebagian tanggal di kalender termasuk <strong>periode gaji yang snapshot-nya terkunci</strong>. Anda hanya dapat melihat (tidak mengubah absensi hari itu). Hubungi <strong>Admin</strong> untuk koreksi atau buka kunci di Master → Periode.</div>':'';
  var listKar=typeof karyawanListPeriode==='function'?karyawanListPeriode(pAbs):sortKaryawanByNik(karyawan||[]);
  listKar.forEach(function(k){if(!absensi[k.nik])absensi[k.nik]={};});
  var prevMY='';
  var html='<table class="font-11 w-full sigaji-table ab-grid-table"><thead><tr class="ab-grid-head">'
    +'<th class="text-center ab-grid-head-sticky ab-sticky-no">No</th>'
    +'<th class="text-left ab-grid-head-sticky ab-sticky-name">Nama</th>'
    +'<th class="text-left font-11 ab-grid-head-sticky ab-sticky-jab">Jabatan</th>';
  days.forEach(function(x){
    var dowN=['Min','Sen','Sel','Rab','Kam','Jum','Sab'][x.dow];
    var myKey=x.date.substring(0,7);
    var tglParts=x.date.split('-');
    var showMon=myKey!==prevMY;
    prevMY=myKey;
    var thCls='ab-day-th '+(isHL(x.date)?'is-libnas':isHariLiburKerja(x.dow)?'is-libur':'is-normal');
    var dd=parseInt(tglParts[2],10);
    html+='<th class="'+thCls+'"><div class="font-9">'+dowN+'</div><div class="font-12 fw-700">'+dd+'</div>'
      +(showMon?'<div class="ab-day-mon-lbl">'+bulanSingkat[x.m]+'</div>':'')+'</th>';
  });
  html+='<th class="text-center ab-grid-sum-head ab-day-th">H</th><th class="text-center ab-grid-sum-head ab-day-th">C</th><th class="text-center ab-grid-sum-head ab-day-th">S</th><th class="text-center ab-grid-sum-head ab-day-th">I</th><th class="text-center ab-grid-sum-head ab-day-th">A</th></tr></thead><tbody>';
  var mobileCards='';
  listKar.forEach(function(k,ki){
    var rowCls=ki%2===0?'ab-row-even':'ab-row-odd';
    html+='<tr class="'+rowCls+'"><td class="text-center fw-800 text-subtle ab-sticky-no">'+(ki+1)+'</td><td class="fw-700 ab-sticky-name"><div class="fl items-start gap-xs"><div class="ab-kar-avatar">'+ini(k.nama)+'</div><div class="flex-1 min-w-0"><div class="font-12 fw-700 ab-kar-name">'+escapeHtml(k.nama)+'</div><div class="font-10 text-subtle ab-kar-nik">'+escapeHtml(k.nik)+'</div></div></div></td><td class="font-11 text-muted ab-sticky-jab">'+escapeHtml(k.jabatan||'')+'</td>';
    var cH=0,cC=0,cS=0,cI=0,cA=0;
    days.forEach(function(x){
      var isLN=isHL(x.date);
      var isLK=isHariLiburKerja(x.dow);
      var st=absensi[k.nik][x.date]||(isLN?'libnas':isLK?'libur':'hadir');
      var lbl=ST_LBL[st]||'-';var cc=!isLK&&!isLN;
      if(st==='hadir')cH++;else if(st==='cuti')cC++;else if(st==='sakit'||st==='setengah_sakit')cS++;else if(st==='izin'||st==='setengah_ijin')cI++;else if(st==='alpha')cA++;
      var canCell=cc&&canEditDataPadaTanggalIso(x.date);
      var mobTip=(st==='hadir'||st==='libur'||st==='libnas')?absensiMobileTip(k.nik,x.date):'';
      var cellCls='ab-cell ab-st-'+(st||'libur')+(canCell?' is-clickable':'')+(cc&&!canCell?' is-readonly':'');
      html+='<td class="'+cellCls+'" '+(canCell?sigajiDataAction('toggle-ab',{nik:k.nik,date:x.date}):cc?'title="Periode terkunci — hubungi Admin"':'')+mobTip+'>'+lbl+'</td>';
    });
    html+='<td class="text-center fw-800 ct-success num ab-total-h">'+(cH||'')+'</td><td class="text-center fw-800 ct-purple num ab-total-c">'+(cC||'')+'</td><td class="text-center fw-800 ct-warn num ab-total-s">'+(cS||'')+'</td><td class="text-center fw-800 ct-brand num ab-total-i">'+(cI||'')+'</td><td class="text-center fw-800 ct-danger num ab-total-a">'+(cA||'')+'</td></tr>';
    mobileCards+='<div class="ab-mobile-card"><h4>'+escapeHtml(k.nama)+'</h4><div class="font-10 text-subtle">'+escapeHtml(k.nik)+' · '+(k.jabatan||'-')+'</div>'
      +'<div class="ab-mobile-stats">'
      +'<span class="ab-mobile-stat is-hadir">H '+cH+'</span>'
      +'<span class="ab-mobile-stat is-cuti">C '+cC+'</span>'
      +'<span class="ab-mobile-stat is-warn">S '+cS+'</span>'
      +'<span class="ab-mobile-stat is-brand">I '+cI+'</span>'
      +'<span class="ab-mobile-stat is-danger">A '+cA+'</span>'
      +'</div></div>';
  });
  html+='</tbody></table>';
  var h=roBanner+monthNav
    +'<div class="table-wrap ab-grid-desktop">'+html+'</div>'
    +'<div class="ab-grid-mobile">'+mobileCards+'</div>';
  document.getElementById('ab-grid-wrap').innerHTML=h;
  var hkP=hariKerjaRange(pAbs.start,pAbs.end);
  var cbB=0;
  if(masterCuti.cbPotong){
    hariLibur.forEach(function(l){
      if(l.tipe==='cuti-bersama'&&l.tgl>=pAbs.start&&l.tgl<=pAbs.end&&!isHariLiburKerja(new Date(l.tgl+'T12:00:00').getDay()))cbB++;
    });
  }
  h='<div class="card fl gap2 flex-wrap items-center"><span class="font-11 fw-700 text-muted">'+escapeHtml(pAbs.nama)+':</span><span class="ab-stat-pill is-hadir">Hari Kerja (dalam rentang): '+String(hkP)+'</span>'+(cbB>0?'<span class="ab-stat-pill is-cuti">Cuti Bersama (dalam rentang): '+String(cbB)+' hari</span>':'')+'<span class="font-10 text-subtle ml-auto">Pola: Senin-'+((perusahaan.hariKerja||6)===6?'Sabtu':'Jumat')+' · hover H = jam check-in mobile</span></div>';
  document.getElementById('ab-rekap-wrap').innerHTML=h;
  absensiPrefetchMobileLogs(pAbs.start,pAbs.end);
}
function toggleAb(nik,date,el){
  if(!canEditDataPadaTanggalIso(date)){toast('Tanggal ini di periode yang snapshot-nya terkunci. Hanya Admin yang dapat mengubah absensi.');return;}
  if(!absensi[nik])absensi[nik]={};
  const S=['hadir','cuti','izin','sakit','setengah_sakit','setengah_ijin','alpha'];
  const SL={hadir:'H',cuti:'C',izin:'I',sakit:'S',setengah_sakit:'1/2S',setengah_ijin:'1/2I',alpha:'A'};
  const cur=absensi[nik][date]||'hadir';const next=S[(S.indexOf(cur)+1)%S.length];
  absensi[nik][date]=next;el.textContent=SL[next];
  el.className='ab-cell ab-st-'+next+(el.classList.contains('is-readonly')?' is-readonly':' is-clickable');
  saveAll();
}
// ── CUTI REKAP ───────────────────────────────────
function renderCutiRekap(){
  const yr=parseInt((document.getElementById('ab-yr')&&document.getElementById('ab-yr').value)||2026);
  const el=document.getElementById('cuti-yr-lbl');if(el)el.textContent=yr;
  const kuotaEl=document.getElementById('cuti-kuota');if(kuotaEl)kuotaEl.value=masterCuti.kuota;
  const coEl=document.getElementById('cuti-carryover');if(coEl)coEl.value=masterCuti.carryover;
  const cbEl=document.getElementById('cuti-cb-potong');if(cbEl)cbEl.checked=masterCuti.cbPotong!==false;
  const tb=document.getElementById('tb-cuti-rekap');if(!tb)return;
  const cb=countCutiBersamaTrackingYear(yr);
  // Tracking cuti = rekap tahunan (tidak terpengaruh periode gaji). Filter: karyawan aktif / belum berhenti sebelum tahun tsb.
  const yearStart=String(yr)+'-01-01';
  var list=sortKaryawanByNik((karyawan||[]).filter(function(k){
    var t=toIsoDate(k&&k.tgl_berhenti);
    return !t||t>=yearStart;
  }));
  if(!list.length){
    tb.innerHTML='<tr><td class="text-center text-subtle" colspan="10" style="padding:1.25rem">Tidak ada karyawan aktif untuk tahun ini.</td></tr>';
    return;
  }
  tb.innerHTML=list.map(function(k,idx){
    const mb=masaKerjaBulan(k);const manual=cutiManualTrackingYear(k.nik,yr);const total=manual+cb;
    const kuota=masterCuti.kuota||12;
    const sisa=kuota-total;
    const pct=kuota>0?Math.min(100,Math.round(total/kuota*100)):0;
    const sisaCls=sisa<=0?'b-err':sisa<=3?'b-warn':'b-teal';
    return '<tr><td class="text-center fw-700 text-muted">'+(idx+1)+'</td><td>'+k.nik+'</td><td><div class="knl"'+sigajiDataAction('open-profile',{nik:k.nik})+'>'+k.nama+'</div></td>'
      +'<td>'+Math.floor(mb/12)+'thn '+mb%12+'bln</td>'
      +'<td>'+kuota+'</td><td><span class="bdg '+(manual>0?'b-warn':'b-gray')+'">'+manual+'</span></td>'
      +'<td>'+(cb>0?'<span class="bdg b-pu">'+cb+'</span>':'<span class="text-subtle">0</span>')+'</td>'
      +'<td><span class="bdg '+(total>kuota?'b-err':total>0?'b-warn':'b-gray')+'">'+total+'</span></td>'
      +'<td><span class="bdg '+sisaCls+'">'+sisa+'</span></td>'
      +'<td><div class="cuti-bar u-inline-block" style="width:120px"><div class="cuti-fill" style="width:'+pct+'%"></div></div> '+pct+'%</td></tr>';
  }).join('');
}
function simpanMasterCuti(){
  masterCuti.kuota=parseInt(document.getElementById('cuti-kuota').value)||12;
  masterCuti.carryover=document.getElementById('cuti-carryover').value;
  masterCuti.cbPotong=!!(document.getElementById('cuti-cb-potong')&&document.getElementById('cuti-cb-potong').checked);
  saveAll();renderCutiRekap();renderKar();renderHariLibur();renderAbsensi();toast('Setting cuti disimpan');
}
// ── LEMBUR ───────────────────────────────────────
function addLemburForKar(){const sel=document.getElementById('lembur-kar-sel');const nik=sel&&sel.value;if(!nik){toast('Pilih karyawan');return;}if(!lembur[nik])lembur[nik]=[];lembur[nik].push({tanggal:'',jam:''});saveAll();renderLemburList();}
function renderLemburList(){
  const el=document.getElementById('lembur-list');if(!el)return;
  var num=0;
  var listLem=sortKaryawanByNik(karyawan||[]);
  el.innerHTML=listLem.map(function(k){
    const ld=lembur[k.nik]||[];const upj=k.gapok/173;if(!ld.length)return'';
    num++;
    return '<div class="tabs-spaced-lg"><div class="fw-700 font-12 ct-brand mb-xs">'+escapeHtml(k.nama)+' <span class="text-muted">#'+num+'</span></div>'
      +ld.map(function(r,i){const j=parseFloat(r.jam)||0;let h=0;if(j>=1)h+=upj*1.5;if(j>=2)h+=upj*2*(j-1);
        var lr=r.tanggal&&periodeSnapshotLockedUntukTanggal(r.tanggal);
        var lemRo=CU&&CU.role!=='Admin'&&lr;
        return '<div class="fl gap1 mb1 items-center flex-wrap">'
          +'<input type="date" class="comp-inp lembur-inp-date" value="'+(r.tanggal||'')+'" '+(lemRo?'disabled ':'')+'onchange="updLembur(\''+k.nik+'\','+i+',\'tanggal\',this.value)">'
          +'<input type="number" class="comp-inp lembur-inp-jam" placeholder="Jam" value="'+(r.jam||'')+'" '+(lemRo?'disabled ':'')+'min="1" max="12" onchange="updLembur(\''+k.nik+'\','+i+',\'jam\',this.value)">'
          +'<span class="font-11 text-muted lembur-inp-amt">'+(j>0?fmt(Math.round(h)):'')+'</span>'
          +(lemRo?'':'<button class="btn btn-sm btn-r"'+sigajiDataAction('del-lembur',{nik:k.nik,i:i})+'>&#10007;</button>')+'</div>';
      }).join('')+'</div>';
  }).join('')||(typeof sigajiEmptyState==='function'?sigajiEmptyState({icon:'&#9203;',title:'Belum ada lembur',desc:'Pilih karyawan lalu tambah baris lembur per tanggal.',btnLabel:'+ Tambah lembur',btnAction:'addLemburForKar'}):'<div class="text-subtle font-12">Belum ada.</div>');
  let tot=0;karyawan.forEach(function(k){const upj=k.gapok/173;(lembur[k.nik]||[]).forEach(function(r){const j=parseFloat(r.jam)||0;let h=0;if(j>=1)h+=upj*1.5;if(j>=2)h+=upj*2*(j-1);tot+=Math.round(h);});});
  const re=document.getElementById('lembur-result');if(re)re.innerHTML=tot>0?'<div class="pph-box"><div class="pph-box-tit"><span>Total Lembur</span><span>'+fmt(tot)+'</span></div></div>':(typeof sigajiEmptyState==='function'?sigajiEmptyState({icon:'&#128200;',title:'Rekap kosong',desc:'Total lembur muncul setelah ada input jam.'}):'<div class="text-subtle font-12">Belum ada.</div>');
}
function updLembur(nik,i,f,v){
  if(!lembur[nik])lembur[nik]=[];
  var row=lembur[nik][i]||{};
  var tglLama=String(row.tanggal||'').trim();
  var tglBaru=f==='tanggal'?String(v||'').trim():tglLama;
  if(CU&&CU.role!=='Admin'){
    if(tglLama&&!canEditDataPadaTanggalIso(tglLama)){toast('Lembur di periode terkunci tidak dapat diubah.');renderLemburList();return;}
    if(tglBaru&&!canEditDataPadaTanggalIso(tglBaru)){toast('Tanggal lembur termasuk periode yang snapshot-nya terkunci.');renderLemburList();return;}
  }
  lembur[nik][i][f]=v;saveAll();renderLemburList();
}
function delLembur(nik,i){
  var row=(lembur[nik]||[])[i];
  if(row&&row.tanggal&&!canEditDataPadaTanggalIso(row.tanggal)){toast('Lembur di periode terkunci tidak dapat dihapus.');return;}
  lembur[nik].splice(i,1);saveAll();renderLemburList();
}
function countLemburEntries(){
  var n=0;
  (karyawan||[]).forEach(function(k){n+=(lembur[k.nik]||[]).length;});
  return n;
}
function hapusLemburBulan(){
  if(CU&&CU.role!=='Admin'){
    var ada=false;
    karyawan.forEach(function(k){(lembur[k.nik]||[]).forEach(function(r){if(r.tanggal&&periodeSnapshotLockedUntukTanggal(r.tanggal))ada=true;});});
    if(ada){toast('Ada lembur di periode terkunci. Hanya Admin yang dapat menghapus semua.');return;}
  }
  var n=countLemburEntries();
  var go=typeof sigajiConfirmBulkDelete==='function'
    ?sigajiConfirmBulkDelete({title:'Hapus semua lembur',count:n,noun:'baris lembur',hint:'Semua entri lembur semua karyawan akan dihapus.',okText:'Ya, hapus '+n+' baris'})
    :sigajiConfirm({title:'Hapus semua lembur',message:'Hapus '+n+' baris lembur?',danger:true,okText:'Ya, hapus'});
  Promise.resolve(go).then(function(ok){
    if(!ok)return;
    karyawan.forEach(function(k){lembur[k.nik]=[];});
    saveAll();renderLemburList();toast(n+' baris lembur dihapus');
  });
}
// ── HARI LIBUR ───────────────────────────────────
function initLibnasYearSelect(){var el=document.getElementById('libnas-yr');if(!el)return;var thn=new Date().getFullYear();el.innerHTML='';for(var y=thn+1;y>=2017;y--){var opt=document.createElement('option');opt.value=y;opt.textContent=y;if(y===thn)opt.selected=true;el.appendChild(opt);}}
function renderHariLibur(){
  var el=document.getElementById('libur-list');if(!el)return;
  var s=[].concat(hariLibur).sort(function(a,b){return a.tgl.localeCompare(b.tgl);});
  var tc={nasional:'b-err','cuti-bersama':'b-pu',perusahaan:'b-info'};var tn={nasional:'Nasional','cuti-bersama':'Cuti Bersama',perusahaan:'Perusahaan'};
  if(!s.length){el.innerHTML='<div class="text-muted font-12" style="padding:.5rem">Belum ada.</div>';return;}
  var grouped={};s.forEach(function(l){var yr=l.tgl.substring(0,4);if(!grouped[yr])grouped[yr]=[];grouped[yr].push(l);});
  el.innerHTML=Object.entries(grouped).sort(function(a,b){return b[0]-a[0];}).map(function(kv){
    return '<div class="tabs-spaced-lg"><div class="font-11 fw-700 text-muted border-bottom-muted" style="padding:4px 0; margin-bottom:.4rem">'+kv[0]+' — '+kv[1].length+' hari</div>'
      +kv[1].map(function(l){
        return '<div class="libur-item"><div><strong>'+l.nama+'</strong>'+(l.tipe==='cuti-bersama'&&masterCuti.cbPotong?'<span class="font-9 ct-purple" style="margin-left:4px">-1 kuota</span>':'')+'<br><span class="u-muted-10">'+l.tgl+'</span></div><div class="fl gap1"><span class="bdg '+(tc[l.tipe]||'b-gray')+'">'+(tn[l.tipe]||l.tipe)+'</span><button class="btn btn-sm btn-r"'+sigajiDataAction('hapus-libur',{tgl:l.tgl})+'>&#10007;</button></div></div>';
      }).join('')+'</div>';
  }).join('');
}
function tambahLibur(){var tgl=document.getElementById('lib-tgl').value;var nama=document.getElementById('lib-nama').value.trim();var tipe=document.getElementById('lib-tipe').value;if(!tgl||!nama){toast('Wajib diisi');return;}if(hariLibur.find(function(l){return l.tgl===tgl;})){toast('Tanggal sudah ada');return;}hariLibur.push({tgl:tgl,nama:nama,tipe:tipe});saveAll();renderHariLibur();renderAbsensi();renderCutiRekap();toast('Ditambahkan');}
function hapusLibur(tgl){hariLibur=hariLibur.filter(function(l){return l.tgl!==tgl;});saveAll();renderHariLibur();renderAbsensi();renderCutiRekap();toast('Dihapus');}
function hapusSemuaLibur(){
  var n=(hariLibur||[]).length;
  var go=typeof sigajiConfirmBulkDelete==='function'
    ?sigajiConfirmBulkDelete({title:'Hapus semua hari libur',count:n,noun:'hari libur',hint:'Kalender libur nasional, cuti bersama, dan libur perusahaan akan dikosongkan.',okText:'Ya, hapus '+n+' hari'})
    :sigajiConfirm({title:'Hapus semua hari libur',message:'Hapus '+n+' hari libur?',danger:true,okText:'Ya, hapus'});
  Promise.resolve(go).then(function(ok){
    if(!ok)return;
    hariLibur=[];saveAll();renderHariLibur();renderAbsensi();renderCutiRekap();toast(n+' hari libur dihapus');
  });
}
function loadLiburNasionalDinamis(){var yr=parseInt((document.getElementById('libnas-yr')&&document.getElementById('libnas-yr').value)||new Date().getFullYear());var lb=getLiburNasionalTahun(yr);var added=0;lb.forEach(function(l){if(!hariLibur.find(function(x){return x.tgl===l.tgl;})){hariLibur.push(l);added++;}});saveAll();renderHariLibur();renderAbsensi();renderCutiRekap();toast(added>0?added+' hari libur '+yr+' dimuat':'Semua tanggal '+yr+' sudah ada');}
