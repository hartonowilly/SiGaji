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
function renderAbsensi(){
  var infoEl=document.getElementById('ab-kal-periode-info');
  function hideKalBanner(){if(infoEl){infoEl.style.display='none';infoEl.textContent='';}}
  populateAbsensiPeriodeSelect();
  var pid=document.getElementById('ab-periode-sel')&&document.getElementById('ab-periode-sel').value;
  var pAbs=periodes.find(function(x){return String(x.id)===String(pid);})||PA();
  if(!karyawan.length){hideKalBanner();document.getElementById('ab-grid-wrap').innerHTML='<div style="padding:2rem;text-align:center;color:#9ca3af">Belum ada karyawan.</div>';document.getElementById('ab-rekap-wrap').innerHTML='';return;}
  if(!pAbs||!pAbs.start||!pAbs.end){
    hideKalBanner();
    document.getElementById('ab-grid-wrap').innerHTML='<div style="padding:2rem;text-align:center;color:#9ca3af">Belum ada periode gaji dengan tanggal mulai/akhir. Atur di Master → Periode Gaji.</div>';
    document.getElementById('ab-rekap-wrap').innerHTML='';
    return;
  }
  const ST_LBL={hadir:'H',cuti:'C',izin:'I',sakit:'S',setengah_sakit:'1/2S',setengah_ijin:'1/2I',alpha:'A',libur:'L',libnas:'LN'};
  const ST_BG={hadir:'#e8f4de',cuti:'#ede9fe',izin:'#e8f0fb',sakit:'#fef3e2',setengah_sakit:'#fff0e0',setengah_ijin:'#e0f0ff',alpha:'#fdeaea',libur:'#f3f4f6',libnas:'#fef9c3'};
  const ST_TX={hadir:'#2d6a0a',cuti:'#5b21b6',izin:'#1a56a0',sakit:'#7d4800',setengah_sakit:'#b45309',setengah_ijin:'#0369a1',alpha:'#9b2121',libur:'#9ca3af',libnas:'#713f12'};
  const bulanSingkat=['','Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agu','Sep','Okt','Nov','Des'];
  const days=absensiDaysFromPeriode(pAbs);
  if(!days.length){
    hideKalBanner();
    document.getElementById('ab-grid-wrap').innerHTML='<div style="padding:2rem;text-align:center;color:#9ca3af">Rentang periode tidak valid.</div>';
    document.getElementById('ab-rekap-wrap').innerHTML='';
    return;
  }
  var hdrSub='Kalender absensi — '+pAbs.nama+' · '+fmtDate(pAbs.start)+' – '+fmtDate(pAbs.end)+' · '+days.length+' hari';
  if(infoEl){infoEl.style.display='block';infoEl.textContent=hdrSub;}
  var adaSelTerkunci=CU&&CU.role!=='Admin'&&days.some(function(x){return !canEditDataPadaTanggalIso(x.date);});
  var roBanner=adaSelTerkunci?'<div class="info-box info-amber" style="font-size:11px;margin-bottom:.65rem">Sebagian tanggal di kalender termasuk <strong>periode gaji yang snapshot-nya terkunci</strong>. Anda hanya dapat melihat (tidak mengubah absensi hari itu). Hubungi <strong>Admin</strong> untuk koreksi atau buka kunci di Master → Periode.</div>':'';
  var listKar=typeof karyawanListPeriode==='function'?karyawanListPeriode(pAbs):sortKaryawanByNik(karyawan||[]);
  listKar.forEach(function(k){if(!absensi[k.nik])absensi[k.nik]={};});
  var AB_NO=44,AB_NAME=272,AB_JAB_L=AB_NO+AB_NAME;
  var prevMY='';
  var html='<table style="border-collapse:collapse;font-size:11px;min-width:max-content;width:100%"><thead><tr style="background:#1e2330;color:#fff">'
    +'<th style="position:sticky;left:0;top:0;z-index:8;background:#1e2330;padding:6px 6px;text-align:center;width:'+AB_NO+'px;min-width:'+AB_NO+'px;border-right:1px solid #374151;box-shadow:1px 0 0 #374151">No</th>'
    +'<th style="position:sticky;left:'+AB_NO+'px;top:0;z-index:8;background:#1e2330;padding:6px 10px;text-align:left;border-right:2px solid #374151;min-width:'+AB_NAME+'px;width:'+AB_NAME+'px;max-width:320px;box-shadow:1px 0 0 #374151;vertical-align:bottom">Nama</th>'
    +'<th style="position:sticky;left:'+AB_JAB_L+'px;top:0;z-index:8;background:#1e2330;padding:6px 8px;text-align:left;font-size:11px;white-space:nowrap;border-right:2px solid #374151;min-width:112px;box-shadow:1px 0 0 #374151;vertical-align:bottom">Jabatan</th>';
  days.forEach(function(x){
    var dowN=['Min','Sen','Sel','Rab','Kam','Jum','Sab'][x.dow];
    var myKey=x.date.substring(0,7);
    var tglParts=x.date.split('-');
    var showMon=myKey!==prevMY;
    prevMY=myKey;
    var bg=isHL(x.date)?'#fef9c3':isHariLiburKerja(x.dow)?'#374151':'#1e2330';
    var co=isHL(x.date)?'#713f12':isHariLiburKerja(x.dow)?'#9ca3af':'#d1d5db';
    var dd=parseInt(tglParts[2],10);
    html+='<th style="position:sticky;top:0;z-index:6;background:'+bg+';color:'+co+';padding:4px 3px;text-align:center;min-width:36px;border-right:1px solid #374151"><div style="font-size:9px">'+dowN+'</div><div style="font-size:12px;font-weight:700">'+dd+'</div>'
      +(showMon?'<div style="font-size:8px;opacity:.85">'+bulanSingkat[x.m]+'</div>':'')+'</th>';
  });
  html+='<th style="position:sticky;top:0;z-index:6;background:#0d3d7a;color:#fff;padding:6px 4px;text-align:center;min-width:32px;border-left:2px solid #374151">H</th><th style="position:sticky;top:0;z-index:6;background:#0d3d7a;color:#fff;padding:6px 4px;text-align:center;min-width:32px">C</th><th style="position:sticky;top:0;z-index:6;background:#0d3d7a;color:#fff;padding:6px 4px;text-align:center;min-width:32px">S</th><th style="position:sticky;top:0;z-index:6;background:#0d3d7a;color:#fff;padding:6px 4px;text-align:center;min-width:32px">I</th><th style="position:sticky;top:0;z-index:6;background:#0d3d7a;color:#fff;padding:6px 4px;text-align:center;min-width:32px">A</th></tr></thead><tbody>';
  listKar.forEach(function(k,ki){
    var rb=ki%2===0?'#fff':'#f8f9fc';
    html+='<tr style="background:'+rb+'"><td style="position:sticky;left:0;z-index:3;background:'+rb+';padding:5px 6px;text-align:center;font-weight:800;color:#9ca3af;border-right:1px solid #e5e7eb;border-bottom:1px solid #f3f4f6;box-shadow:1px 0 0 #e5e7eb">'+(ki+1)+'</td><td style="position:sticky;left:'+AB_NO+'px;z-index:3;background:'+rb+';padding:5px 10px;font-weight:700;border-right:2px solid #e5e7eb;border-bottom:1px solid #f3f4f6;min-width:'+AB_NAME+'px;width:'+AB_NAME+'px;max-width:320px;box-shadow:1px 0 0 #e5e7eb;vertical-align:middle"><div style="display:flex;align-items:flex-start;gap:6px"><div style="width:24px;height:24px;border-radius:50%;background:#e8f0fb;color:#1a56a0;display:flex;align-items:center;justify-content:center;font-size:9px;font-weight:800;flex-shrink:0;margin-top:2px">'+ini(k.nama)+'</div><div style="min-width:0;flex:1"><div style="font-size:12px;font-weight:700;line-height:1.25;word-break:break-word;white-space:normal">'+escapeHtml(k.nama)+'</div><div style="font-size:10px;color:#9ca3af;word-break:break-all">'+escapeHtml(k.nik)+'</div></div></div></td><td style="position:sticky;left:'+AB_JAB_L+'px;z-index:3;background:'+rb+';padding:5px 8px;font-size:11px;color:#6b7280;white-space:nowrap;border-right:2px solid #e5e7eb;border-bottom:1px solid #f3f4f6;min-width:112px;box-shadow:1px 0 0 #e5e7eb">'+(k.jabatan||'')+'</td>';
    var cH=0,cC=0,cS=0,cI=0,cA=0;
    days.forEach(function(x){
      var isLN=isHL(x.date);
      var isLK=isHariLiburKerja(x.dow);
      var st=absensi[k.nik][x.date]||(isLN?'libnas':isLK?'libur':'hadir');
      var bg=ST_BG[st]||'#f3f4f6';var tx=ST_TX[st]||'#6b7280';var lbl=ST_LBL[st]||'-';var cc=!isLK&&!isLN;
      if(st==='hadir')cH++;else if(st==='cuti')cC++;else if(st==='sakit'||st==='setengah_sakit')cS++;else if(st==='izin'||st==='setengah_ijin')cI++;else if(st==='alpha')cA++;
      var canCell=cc&&canEditDataPadaTanggalIso(x.date);
      var mobTip=(st==='hadir'||st==='libur'||st==='libnas')?absensiMobileTip(k.nik,x.date):'';
      html+='<td style="background:'+bg+';color:'+tx+';padding:0;text-align:center;border-right:1px solid rgba(0,0,0,.06);border-bottom:1px solid #f3f4f6;opacity:'+(canCell?'1':cc?'0.88':'1')+';'+(canCell?'cursor:pointer;':cc?'cursor:not-allowed;':'')+'font-weight:700;font-size:10px" '+(canCell?'onclick="toggleAb(\''+k.nik+'\',\''+x.date+'\',this)"':cc?'title="Periode terkunci — hubungi Admin"':'')+mobTip+'>'+lbl+'</td>';
    });
    html+='<td style="text-align:center;font-weight:800;color:#2d6a0a;border-left:2px solid #e5e7eb;border-bottom:1px solid #f3f4f6;background:#e8f4de">'+(cH||'')+'</td><td style="text-align:center;font-weight:800;color:#5b21b6;border-bottom:1px solid #f3f4f6;background:#ede9fe">'+(cC||'')+'</td><td style="text-align:center;font-weight:800;color:#7d4800;border-bottom:1px solid #f3f4f6;background:#fef3e2">'+(cS||'')+'</td><td style="text-align:center;font-weight:800;color:#1a56a0;border-bottom:1px solid #f3f4f6;background:#e8f0fb">'+(cI||'')+'</td><td style="text-align:center;font-weight:800;color:#9b2121;border-bottom:1px solid #f3f4f6;background:#fdeaea">'+(cA||'')+'</td></tr>';
  });
  html+='</tbody></table>';
  document.getElementById('ab-grid-wrap').innerHTML=roBanner+html;
  var hkP=hariKerjaRange(pAbs.start,pAbs.end);
  var cbB=0;
  if(masterCuti.cbPotong){
    hariLibur.forEach(function(l){
      if(l.tipe==='cuti-bersama'&&l.tgl>=pAbs.start&&l.tgl<=pAbs.end&&!isHariLiburKerja(new Date(l.tgl+'T12:00:00').getDay()))cbB++;
    });
  }
  document.getElementById('ab-rekap-wrap').innerHTML='<div class="card" style="display:flex;gap:1rem;flex-wrap:wrap;align-items:center"><span style="font-size:11px;font-weight:700;color:#6b7280">'+escapeHtml(pAbs.nama)+':</span><span style="background:#e8f4de;color:#2d6a0a;padding:3px 12px;border-radius:20px;font-weight:700">Hari Kerja (dalam rentang): '+hkP+'</span>'+(cbB>0?'<span style="background:#ede9fe;color:#5b21b6;padding:3px 12px;border-radius:20px;font-weight:700">Cuti Bersama (dalam rentang): '+cbB+' hari</span>':'')+'<span style="font-size:10px;color:#9ca3af;margin-left:auto">Pola: Senin-'+((perusahaan.hariKerja||6)===6?'Sabtu':'Jumat')+' · hover H = jam check-in mobile</span></div>';
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
    tb.innerHTML='<tr><td colspan="10" style="text-align:center;color:#9ca3af;padding:1.25rem">Tidak ada karyawan aktif untuk tahun ini.</td></tr>';
    return;
  }
  tb.innerHTML=list.map(function(k,idx){
    const mb=masaKerjaBulan(k);const manual=cutiManualTrackingYear(k.nik,yr);const total=manual+cb;
    const kuota=masterCuti.kuota||12;
    const sisa=kuota-total;
    const pct=kuota>0?Math.min(100,Math.round(total/kuota*100)):0;
    const sisaCls=sisa<=0?'b-err':sisa<=3?'b-warn':'b-teal';
    return '<tr><td style="text-align:center;font-weight:700;color:#6b7280">'+(idx+1)+'</td><td>'+k.nik+'</td><td><div class="knl" onclick="openPanel(\''+k.nik+'\')">'+k.nama+'</div></td>'
      +'<td>'+Math.floor(mb/12)+'thn '+mb%12+'bln</td>'
      +'<td>'+kuota+'</td><td><span class="bdg '+(manual>0?'b-warn':'b-gray')+'">'+manual+'</span></td>'
      +'<td>'+(cb>0?'<span class="bdg b-pu">'+cb+'</span>':'<span style="color:#9ca3af">0</span>')+'</td>'
      +'<td><span class="bdg '+(total>kuota?'b-err':total>0?'b-warn':'b-gray')+'">'+total+'</span></td>'
      +'<td><span class="bdg '+sisaCls+'">'+sisa+'</span></td>'
      +'<td><div class="cuti-bar" style="width:120px;display:inline-block"><div class="cuti-fill" style="width:'+pct+'%"></div></div> '+pct+'%</td></tr>';
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
    return '<div style="margin-bottom:.75rem"><div style="font-weight:700;font-size:12px;margin-bottom:.4rem;color:#1a56a0">'+num+'. '+k.nama+'</div>'
      +ld.map(function(r,i){const j=parseFloat(r.jam)||0;let h=0;if(j>=1)h+=upj*1.5;if(j>=2)h+=upj*2*(j-1);
        var lr=r.tanggal&&periodeSnapshotLockedUntukTanggal(r.tanggal);
        var lemRo=CU&&CU.role!=='Admin'&&lr;
        return '<div class="fl gap1 mb1" style="align-items:center;flex-wrap:wrap">'
          +'<input type="date" value="'+(r.tanggal||'')+'" '+(lemRo?'disabled ':'')+'style="width:135px;padding:5px 8px;border:1.5px solid #dde1e9;border-radius:6px;font-size:12px;font-family:inherit;outline:none" onchange="updLembur(\''+k.nik+'\','+i+',\'tanggal\',this.value)">'
          +'<input type="number" placeholder="Jam" value="'+(r.jam||'')+'" '+(lemRo?'disabled ':'')+'style="width:65px;padding:5px 8px;border:1.5px solid #dde1e9;border-radius:6px;font-size:12px;font-family:inherit;outline:none" min="1" max="12" onchange="updLembur(\''+k.nik+'\','+i+',\'jam\',this.value)">'
          +'<span style="font-size:11px;color:#6b7280;min-width:90px">'+(j>0?fmt(Math.round(h)):'')+'</span>'
          +(lemRo?'':'<button class="btn btn-sm btn-r" onclick="delLembur(\''+k.nik+'\','+i+')">&#10007;</button>')+'</div>';
      }).join('')+'</div>';
  }).join('')||'<div style="color:#9ca3af;font-size:12px">Belum ada.</div>';
  let tot=0;karyawan.forEach(function(k){const upj=k.gapok/173;(lembur[k.nik]||[]).forEach(function(r){const j=parseFloat(r.jam)||0;let h=0;if(j>=1)h+=upj*1.5;if(j>=2)h+=upj*2*(j-1);tot+=Math.round(h);});});
  const re=document.getElementById('lembur-result');if(re)re.innerHTML=tot>0?'<div class="pph-box"><div class="pph-box-tit"><span>Total Lembur</span><span>'+fmt(tot)+'</span></div></div>':'<div style="color:#9ca3af;font-size:12px">Belum ada.</div>';
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
  if(!s.length){el.innerHTML='<div style="color:#6b7280;font-size:12px;padding:.5rem">Belum ada.</div>';return;}
  var grouped={};s.forEach(function(l){var yr=l.tgl.substring(0,4);if(!grouped[yr])grouped[yr]=[];grouped[yr].push(l);});
  el.innerHTML=Object.entries(grouped).sort(function(a,b){return b[0]-a[0];}).map(function(kv){
    return '<div style="margin-bottom:.75rem"><div style="font-size:11px;font-weight:700;color:#6b7280;padding:4px 0;border-bottom:1px solid #e5e7eb;margin-bottom:.4rem">'+kv[0]+' — '+kv[1].length+' hari</div>'
      +kv[1].map(function(l){
        return '<div class="libur-item"><div><strong>'+l.nama+'</strong>'+(l.tipe==='cuti-bersama'&&masterCuti.cbPotong?'<span style="font-size:9px;color:#5b21b6;margin-left:4px">-1 kuota</span>':'')+'<br><span style="font-size:10px;color:#6b7280">'+l.tgl+'</span></div><div class="fl gap1"><span class="bdg '+(tc[l.tipe]||'b-gray')+'">'+(tn[l.tipe]||l.tipe)+'</span><button class="btn btn-sm btn-r" onclick="hapusLibur(\''+l.tgl+'\')">&#10007;</button></div></div>';
      }).join('')+'</div>';
  }).join('');
}
function tambahLibur(){var tgl=document.getElementById('lib-tgl').value;var nama=document.getElementById('lib-nama').value.trim();var tipe=document.getElementById('lib-tipe').value;if(!tgl||!nama){toast('Wajib diisi');return;}if(hariLibur.find(function(l){return l.tgl===tgl;})){toast('Tanggal sudah ada');return;}hariLibur.push({tgl:tgl,nama:nama,tipe:tipe});saveAll();renderHariLibur();renderAbsensi();renderCutiRekap();toast('Ditambahkan');}
function hapusLibur(tgl){hariLibur=hariLibur.filter(function(l){return l.tgl!==tgl;});saveAll();renderHariLibur();renderAbsensi();renderCutiRekap();toast('Dihapus');}
function hapusSemuaLibur(){if(!confirm('Hapus SEMUA hari libur?'))return;hariLibur=[];saveAll();renderHariLibur();renderAbsensi();renderCutiRekap();toast('Semua dihapus');}
function loadLiburNasionalDinamis(){var yr=parseInt((document.getElementById('libnas-yr')&&document.getElementById('libnas-yr').value)||new Date().getFullYear());var lb=getLiburNasionalTahun(yr);var added=0;lb.forEach(function(l){if(!hariLibur.find(function(x){return x.tgl===l.tgl;})){hariLibur.push(l);added++;}});saveAll();renderHariLibur();renderAbsensi();renderCutiRekap();toast(added>0?added+' hari libur '+yr+' dimuat':'Semua tanggal '+yr+' sudah ada');}
