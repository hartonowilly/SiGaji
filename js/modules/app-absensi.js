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
    }catch(e){}
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
    document.getElementById('ab-grid-wrap').innerHTML=typeof sigajiEmptyState==='function'?sigajiEmptyState({icon:'&#128101;',title:'Belum ada karyawan',desc:'Import Excel atau tambah manual di Master Karyawan untuk mulai mengisi absensi.',btnLabel:'Tambah karyawan',btnOnclick:"showPg('karyawan')"}):'<div class="text-center text-subtle" style="padding:2rem">Belum ada karyawan.</div>';
    document.getElementById('ab-rekap-wrap').innerHTML='';
    return;
  }
  if(!pAbs||!pAbs.start||!pAbs.end){
    hideKalBanner();
    document.getElementById('ab-grid-wrap').innerHTML=typeof sigajiEmptyState==='function'?sigajiEmptyState({icon:'&#128197;',title:'Periode gaji belum lengkap',desc:'Atur tanggal mulai dan akhir di Master → Periode Gaji.',btnLabel:'Atur periode',btnOnclick:"showPg('master')"}):'<div class="text-center text-subtle" style="padding:2rem">Belum ada periode gaji dengan tanggal mulai/akhir. Atur di Master → Periode Gaji.</div>';
    document.getElementById('ab-rekap-wrap').innerHTML='';
    return;
  }
  const ST_LBL={hadir:'H',cuti:'C',izin:'I',sakit:'S',setengah_sakit:'1/2S',setengah_ijin:'1/2I',alpha:'A',libur:'L',libnas:'LN'};
  const ST_BG={hadir:'#e8f4de',cuti:'#ede9fe',izin:'#e8f0fb',sakit:'#fef3e2',setengah_sakit:'#fff0e0',setengah_ijin:'#e0f0ff',alpha:'#fdeaea',libur:'#f3f4f6',libnas:'#fef9c3'};
  const ST_TX={hadir:'#2d6a0a',cuti:'#5b21b6',izin:'#1a56a0',sakit:'#7d4800',setengah_sakit:'#b45309',setengah_ijin:'#0369a1',alpha:'#9b2121',libur:'#9ca3af',libnas:'#713f12'};
  const bulanSingkat=['','Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agu','Sep','Okt','Nov','Des'];
  const daysAll=absensiDaysFromPeriode(pAbs);
  if(!daysAll.length){
    hideKalBanner();
    document.getElementById('ab-grid-wrap').innerHTML='<div class="text-center text-subtle" style="padding:2rem">Rentang periode tidak valid.</div>';
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
    +'<button type="button" class="btn btn-xs btn-out" onclick="abShiftViewMonth(-1)"'+(mi<=0?' disabled':'')+'>&#9664;</button>'
    +'<span class="ab-month-lbl">'+abMonthLabel(window.__sigajiAbMonth)+'</span>'
    +'<button type="button" class="btn btn-xs btn-out" onclick="abShiftViewMonth(1)"'+(mi>=monthKeys.length-1?' disabled':'')+'>&#9654;</button>'
    +'<select class="toolbar-select ab-month-sel" onchange="abSetViewMonth(this.value)">'
    +monthKeys.map(function(k){return'<option value="'+k+'" '+(k===window.__sigajiAbMonth?'selected':'')+'>'+abMonthLabel(k)+'</option>';}).join('')
    +'</select></div>';
  var hdrSub='Kalender absensi — '+pAbs.nama+' · '+fmtDate(pAbs.start)+' – '+fmtDate(pAbs.end)+' · '+daysAll.length+' hari (tampil: '+days.length+' hari)';
  if(infoEl){infoEl.style.display='block';infoEl.textContent=hdrSub;}
  var adaSelTerkunci=CU&&CU.role!=='Admin'&&days.some(function(x){return !canEditDataPadaTanggalIso(x.date);});
  var roBanner=adaSelTerkunci?'<div class="info-box info-amber font-11 mb-lg">Sebagian tanggal di kalender termasuk <strong>periode gaji yang snapshot-nya terkunci</strong>. Anda hanya dapat melihat (tidak mengubah absensi hari itu). Hubungi <strong>Admin</strong> untuk koreksi atau buka kunci di Master → Periode.</div>':'';
  var listKar=typeof karyawanListPeriode==='function'?karyawanListPeriode(pAbs):sortKaryawanByNik(karyawan||[]);
  listKar.forEach(function(k){if(!absensi[k.nik])absensi[k.nik]={};});
  var AB_NO=44,AB_NAME=272,AB_JAB_L=AB_NO+AB_NAME;
  var prevMY='';
  var html='<table class="font-11 w-full" style="border-collapse:collapse; min-width:max-content"><thead><tr style="background:#1e2330;color:#fff">'
    +'<th class="text-center" style="position:sticky; left:0; top:0; z-index:8; background:#1e2330; padding:6px 6px; width:'+AB_NO+'px; min-width:'+AB_NO+'px; border-right:1px solid #374151; box-shadow:1px 0 0 #374151">No</th>'
    +'<th class="text-left" style="position:sticky; left:'+AB_NO+'px; top:0; z-index:8; background:#1e2330; padding:6px 10px; border-right:2px solid #374151; min-width:'+AB_NAME+'px; width:'+AB_NAME+'px; max-width:320px; box-shadow:1px 0 0 #374151; vertical-align:bottom">Nama</th>'
    +'<th class="text-left font-11" style="position:sticky; left:'+AB_JAB_L+'px; top:0; z-index:8; background:#1e2330; padding:6px 8px; white-space:nowrap; border-right:2px solid #374151; min-width:112px; box-shadow:1px 0 0 #374151; vertical-align:bottom">Jabatan</th>';
  days.forEach(function(x){
    var dowN=['Min','Sen','Sel','Rab','Kam','Jum','Sab'][x.dow];
    var myKey=x.date.substring(0,7);
    var tglParts=x.date.split('-');
    var showMon=myKey!==prevMY;
    prevMY=myKey;
    var bg=isHL(x.date)?'#fef9c3':isHariLiburKerja(x.dow)?'#374151':'#1e2330';
    var co=isHL(x.date)?'#713f12':isHariLiburKerja(x.dow)?'#9ca3af':'#d1d5db';
    var dd=parseInt(tglParts[2],10);
    html+='<th class="text-center" style="position:sticky; top:0; z-index:6; background:'+bg+'; color:'+co+'; padding:4px 3px; min-width:36px; border-right:1px solid #374151"><div class="font-9">'+dowN+'</div><div class="font-12 fw-700">'+dd+'</div>'
      +(showMon?'<div style="font-size:8px;opacity:.85">'+bulanSingkat[x.m]+'</div>':'')+'</th>';
  });
  html+='<th class="text-center" style="position:sticky; top:0; z-index:6; background:#0d3d7a; color:#fff; padding:6px 4px; min-width:32px; border-left:2px solid #374151">H</th><th class="text-center" style="position:sticky; top:0; z-index:6; background:#0d3d7a; color:#fff; padding:6px 4px; min-width:32px">C</th><th class="text-center" style="position:sticky; top:0; z-index:6; background:#0d3d7a; color:#fff; padding:6px 4px; min-width:32px">S</th><th class="text-center" style="position:sticky; top:0; z-index:6; background:#0d3d7a; color:#fff; padding:6px 4px; min-width:32px">I</th><th class="text-center" style="position:sticky; top:0; z-index:6; background:#0d3d7a; color:#fff; padding:6px 4px; min-width:32px">A</th></tr></thead><tbody>';
  var mobileCards='';
  listKar.forEach(function(k,ki){
    var rb=ki%2===0?'#fff':'#f8f9fc';
    html+='<tr style="background:'+rb+'"><td class="text-center fw-800 text-subtle" style="position:sticky; left:0; z-index:3; background:'+rb+'; padding:5px 6px; border-right:1px solid #e5e7eb; border-bottom:1px solid #f3f4f6; box-shadow:1px 0 0 #e5e7eb">'+(ki+1)+'</td><td class="fw-700" style="position:sticky; left:'+AB_NO+'px; z-index:3; background:'+rb+'; padding:5px 10px; border-right:2px solid #e5e7eb; border-bottom:1px solid #f3f4f6; min-width:'+AB_NAME+'px; width:'+AB_NAME+'px; max-width:320px; box-shadow:1px 0 0 #e5e7eb; vertical-align:middle"><div class="fl items-start gap-xs"><div class="ct-brand fl items-center font-9 fw-800 mt-2px" style="width:24px; height:24px; border-radius:50%; background:#e8f0fb; justify-content:center; flex-shrink:0">'+ini(k.nama)+'</div><div class="flex-1" style="min-width:0"><div class="font-12 fw-700" style="line-height:1.25; word-break:break-word; white-space:normal">'+escapeHtml(k.nama)+'</div><div class="font-10 text-subtle" style="word-break:break-all">'+escapeHtml(k.nik)+'</div></div></div></td><td class="font-11 text-muted" style="position:sticky; left:'+AB_JAB_L+'px; z-index:3; background:'+rb+'; padding:5px 8px; white-space:nowrap; border-right:2px solid #e5e7eb; border-bottom:1px solid #f3f4f6; min-width:112px; box-shadow:1px 0 0 #e5e7eb">'+(k.jabatan||'')+'</td>';
    var cH=0,cC=0,cS=0,cI=0,cA=0;
    days.forEach(function(x){
      var isLN=isHL(x.date);
      var isLK=isHariLiburKerja(x.dow);
      var st=absensi[k.nik][x.date]||(isLN?'libnas':isLK?'libur':'hadir');
      var bg=ST_BG[st]||'#f3f4f6';var tx=ST_TX[st]||'#6b7280';var lbl=ST_LBL[st]||'-';var cc=!isLK&&!isLN;
      if(st==='hadir')cH++;else if(st==='cuti')cC++;else if(st==='sakit'||st==='setengah_sakit')cS++;else if(st==='izin'||st==='setengah_ijin')cI++;else if(st==='alpha')cA++;
      var canCell=cc&&canEditDataPadaTanggalIso(x.date);
      var mobTip=(st==='hadir'||st==='libur'||st==='libnas')?absensiMobileTip(k.nik,x.date):'';
      html+='<td class="p-0 text-center font-10" style="background:'+bg+'; color:'+tx+'; border-right:1px solid rgba(0,0,0,.06); border-bottom:1px solid #f3f4f6; opacity:'+(canCell?'1':cc?'0.88':'1')+'; '+(canCell?'cursor:pointer; ':cc?'cursor:not-allowed; ':'')+'font-weight:700" '+(canCell?'onclick="toggleAb(\''+k.nik+'\',\''+x.date+'\',this)"':cc?'title="Periode terkunci — hubungi Admin"':'')+mobTip+'>'+lbl+'</td>';
    });
    html+='<td class="text-center fw-800 ct-success" style="border-left:2px solid #e5e7eb; border-bottom:1px solid #f3f4f6; background:#e8f4de">'+(cH||'')+'</td><td class="text-center fw-800 ct-purple" style="border-bottom:1px solid #f3f4f6; background:#ede9fe">'+(cC||'')+'</td><td class="text-center fw-800 ct-warn" style="border-bottom:1px solid #f3f4f6; background:#fef3e2">'+(cS||'')+'</td><td class="text-center fw-800 ct-brand" style="border-bottom:1px solid #f3f4f6; background:#e8f0fb">'+(cI||'')+'</td><td class="text-center fw-800 ct-danger" style="border-bottom:1px solid #f3f4f6; background:#fdeaea">'+(cA||'')+'</td></tr>';
    mobileCards+='<div class="ab-mobile-card"><h4>'+escapeHtml(k.nama)+'</h4><div class="font-10 text-subtle">'+escapeHtml(k.nik)+' · '+(k.jabatan||'-')+'</div>'
      +'<div class="ab-mobile-stats">'
      +'<span class="ab-mobile-stat ct-success" style="background:#e8f4de">H '+cH+'</span>'
      +'<span class="ab-mobile-stat ct-purple" style="background:#ede9fe">C '+cC+'</span>'
      +'<span class="ab-mobile-stat ct-warn" style="background:#fef3e2">S '+cS+'</span>'
      +'<span class="ab-mobile-stat ct-brand" style="background:#e8f0fb">I '+cI+'</span>'
      +'<span class="ab-mobile-stat ct-danger" style="background:#fdeaea">A '+cA+'</span>'
      +'</div></div>';
  });
  html+='</tbody></table>';
  document.getElementById('ab-grid-wrap').innerHTML=roBanner+monthNav
    +'<div class="table-wrap ab-grid-desktop">'+html+'</div>'
    +'<div class="ab-grid-mobile">'+mobileCards+'</div>';
  var hkP=hariKerjaRange(pAbs.start,pAbs.end);
  var cbB=0;
  if(masterCuti.cbPotong){
    hariLibur.forEach(function(l){
      if(l.tipe==='cuti-bersama'&&l.tgl>=pAbs.start&&l.tgl<=pAbs.end&&!isHariLiburKerja(new Date(l.tgl+'T12:00:00').getDay()))cbB++;
    });
  }
  document.getElementById('ab-rekap-wrap').innerHTML='<div class="card fl gap2 flex-wrap items-center"><span class="font-11 fw-700 text-muted">'+escapeHtml(pAbs.nama)+':</span><span class="ct-success rounded-pill fw-700" style="background:#e8f4de; padding:3px 12px">Hari Kerja (dalam rentang): '+hkP+'</span>'+(cbB>0?'<span class="ct-purple rounded-pill fw-700" style="background:#ede9fe; padding:3px 12px">Cuti Bersama (dalam rentang): '+cbB+' hari</span>':'')+'<span class="font-10 text-subtle ml-auto">Pola: Senin-'+((perusahaan.hariKerja||6)===6?'Sabtu':'Jumat')+' · hover H = jam check-in mobile</span></div>';
  absensiPrefetchMobileLogs(pAbs.start,pAbs.end);
}
function toggleAb(nik,date,el){
  if(!canEditDataPadaTanggalIso(date)){toast('Tanggal ini di periode yang snapshot-nya terkunci. Hanya Admin yang dapat mengubah absensi.');return;}
  if(!absensi[nik])absensi[nik]={};
  const S=['hadir','cuti','izin','sakit','setengah_sakit','setengah_ijin','alpha'];
  const SL={hadir:'H',cuti:'C',izin:'I',sakit:'S',setengah_sakit:'1/2S',setengah_ijin:'1/2I',alpha:'A'};
  const SB={hadir:'#e8f4de',cuti:'#ede9fe',izin:'#e8f0fb',sakit:'#fef3e2',setengah_sakit:'#fff0e0',setengah_ijin:'#e0f0ff',alpha:'#fdeaea'};
  const ST={hadir:'#2d6a0a',cuti:'#5b21b6',izin:'#1a56a0',sakit:'#7d4800',setengah_sakit:'#b45309',setengah_ijin:'#0369a1',alpha:'#9b2121'};
  const cur=absensi[nik][date]||'hadir';const next=S[(S.indexOf(cur)+1)%S.length];
  absensi[nik][date]=next;el.textContent=SL[next];el.style.background=SB[next];el.style.color=ST[next];saveAll();
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
    return '<tr><td class="text-center fw-700 text-muted">'+(idx+1)+'</td><td>'+k.nik+'</td><td><div class="knl" onclick="openPanel(\''+k.nik+'\')">'+k.nama+'</div></td>'
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
    return '<div class="tabs-spaced-lg"><div class="fw-700 font-12 ct-brand" style="margin-bottom:.4rem">'+num+'. '+k.nama+'</div>'
      +ld.map(function(r,i){const j=parseFloat(r.jam)||0;let h=0;if(j>=1)h+=upj*1.5;if(j>=2)h+=upj*2*(j-1);
        var lr=r.tanggal&&periodeSnapshotLockedUntukTanggal(r.tanggal);
        var lemRo=CU&&CU.role!=='Admin'&&lr;
        return '<div class="fl gap1 mb1 items-center flex-wrap">'
          +'<input type="date" value="'+(r.tanggal||'')+'" '+(lemRo?'disabled ':'')+'style="width:135px;padding:5px 8px;border:1.5px solid #dde1e9;border-radius:6px;font-size:12px;font-family:inherit;outline:none" onchange="updLembur(\''+k.nik+'\','+i+',\'tanggal\',this.value)">'
          +'<input type="number" placeholder="Jam" value="'+(r.jam||'')+'" '+(lemRo?'disabled ':'')+'style="width:65px;padding:5px 8px;border:1.5px solid #dde1e9;border-radius:6px;font-size:12px;font-family:inherit;outline:none" min="1" max="12" onchange="updLembur(\''+k.nik+'\','+i+',\'jam\',this.value)">'
          +'<span class="font-11 text-muted" style="min-width:90px">'+(j>0?fmt(Math.round(h)):'')+'</span>'
          +(lemRo?'':'<button class="btn btn-sm btn-r" onclick="delLembur(\''+k.nik+'\','+i+')">&#10007;</button>')+'</div>';
      }).join('')+'</div>';
  }).join('')||(typeof sigajiEmptyState==='function'?sigajiEmptyState({icon:'&#9203;',title:'Belum ada lembur',desc:'Pilih karyawan lalu tambah baris lembur per tanggal.',btnLabel:'+ Tambah lembur',btnOnclick:'addLemburForKar()'}):'<div class="text-subtle font-12">Belum ada.</div>');
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
function hapusLemburBulan(){
  if(CU&&CU.role!=='Admin'){
    var ada=false;
    karyawan.forEach(function(k){(lembur[k.nik]||[]).forEach(function(r){if(r.tanggal&&periodeSnapshotLockedUntukTanggal(r.tanggal))ada=true;});});
    if(ada){toast('Ada lembur di periode terkunci. Hanya Admin yang dapat menghapus semua.');return;}
  }
  if(!confirm('Hapus semua lembur?'))return;karyawan.forEach(function(k){lembur[k.nik]=[];});saveAll();renderLemburList();toast('Semua dihapus');
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
    return '<div class="tabs-spaced-lg"><div class="font-11 fw-700 text-muted" style="padding:4px 0; border-bottom:1px solid #e5e7eb; margin-bottom:.4rem">'+kv[0]+' — '+kv[1].length+' hari</div>'
      +kv[1].map(function(l){
        return '<div class="libur-item"><div><strong>'+l.nama+'</strong>'+(l.tipe==='cuti-bersama'&&masterCuti.cbPotong?'<span class="font-9 ct-purple" style="margin-left:4px">-1 kuota</span>':'')+'<br><span class="u-muted-10">'+l.tgl+'</span></div><div class="fl gap1"><span class="bdg '+(tc[l.tipe]||'b-gray')+'">'+(tn[l.tipe]||l.tipe)+'</span><button class="btn btn-sm btn-r" onclick="hapusLibur(\''+l.tgl+'\')">&#10007;</button></div></div>';
      }).join('')+'</div>';
  }).join('');
}
function tambahLibur(){var tgl=document.getElementById('lib-tgl').value;var nama=document.getElementById('lib-nama').value.trim();var tipe=document.getElementById('lib-tipe').value;if(!tgl||!nama){toast('Wajib diisi');return;}if(hariLibur.find(function(l){return l.tgl===tgl;})){toast('Tanggal sudah ada');return;}hariLibur.push({tgl:tgl,nama:nama,tipe:tipe});saveAll();renderHariLibur();renderAbsensi();renderCutiRekap();toast('Ditambahkan');}
function hapusLibur(tgl){hariLibur=hariLibur.filter(function(l){return l.tgl!==tgl;});saveAll();renderHariLibur();renderAbsensi();renderCutiRekap();toast('Dihapus');}
function hapusSemuaLibur(){if(!confirm('Hapus SEMUA hari libur?'))return;hariLibur=[];saveAll();renderHariLibur();renderAbsensi();renderCutiRekap();toast('Semua dihapus');}
function loadLiburNasionalDinamis(){var yr=parseInt((document.getElementById('libnas-yr')&&document.getElementById('libnas-yr').value)||new Date().getFullYear());var lb=getLiburNasionalTahun(yr);var added=0;lb.forEach(function(l){if(!hariLibur.find(function(x){return x.tgl===l.tgl;})){hariLibur.push(l);added++;}});saveAll();renderHariLibur();renderAbsensi();renderCutiRekap();toast(added>0?added+' hari libur '+yr+' dimuat':'Semua tanggal '+yr+' sudah ada');}
