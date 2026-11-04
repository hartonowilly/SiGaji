/* SiGaji — proses gaji, approval */
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
    var afterPull=function(){renderTunjVariabelBulan();};
    if(typeof window.sigajiPullTunjVarRefresh==='function'){
      window.sigajiPullTunjVarRefresh({force:true}).then(afterPull).catch(afterPull);
    }else afterPull();
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
  /** @type {{el: Element, panel: string}|null} */
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
/** Tombol "Hitung Ulang" — hanya hitung ulang (pro-rata, absensi, lembur, tunj. var).
 *  Tidak menimpa gapok/tunjangan snapshot periode. Untuk ambil ulang dari Master:
 *  Master → Periode → Rebuild Snapshot (aksi terpisah, dengan konfirmasi). */
function hitungUlangPenggajian(){
  var p=PA();
  if(!p||!p.nama){toast('Tidak ada periode aktif');return;}
  var locked=isPeriodeLocked(p.nama);
  /* Pastikan snapshot periode ada (karyawan baru), tanpa menimpa yang sudah diedit. */
  try{
    if(!locked&&typeof ensureKarSnapshotPeriode==='function'){
      ensureKarSnapshotPeriode(p.nama,karyawanListPeriode(p));
    }
  }catch(eEns){sigajiCatchWarn("js/modules/app-hr.js",eEns);}
  /* Sinkron ulang pro-rata resign / karyawan baru dari tanggal. */
  try{
    if(!locked){
      karyawanListPeriode(p).forEach(function(k){
        if(!k)return;
        if(String(k.tgl_berhenti||'').trim()&&typeof syncProrataDariResign==='function')syncProrataDariResign(k);
        if(typeof syncProrataDariMasuk==='function')syncProrataDariMasuk(k);
      });
    }
  }catch(eRes){sigajiCatchWarn("js/modules/app-hr.js",eRes);}
  renderPenggajian();
  if(typeof renderAbsensi==='function')renderAbsensi();
  if(locked){
    toast('Perhitungan diperbarui (pro-rata, absensi, lembur, tunj. variabel). Periode terkunci: komponen gaji dari snapshot.');
  }else{
    toast('Perhitungan diperbarui. Gapok/tunjangan periode aktif tidak diubah. Resign & karyawan baru: pro-rata otomatis dari tanggal.');
  }
}
/** Opsional: timpa snapshot periode aktif dari Master (aksi berbahaya — konfirmasi eksplisit). */
function sinkronSnapshotPeriodeDariMaster(){
  var p=PA();
  if(!p||!p.nama){toast('Tidak ada periode aktif');return;}
  if(isPeriodeLocked(p.nama)){toast('Periode terkunci — buka kunci dulu');return;}
  var msg=
    'PERINGATAN: Gapok, tunjangan, potongan, BPJS, dan PPh Return di periode "'+p.nama+
    '" akan diganti dengan data Master Karyawan.\n\n'+
    'Perubahan gaji yang sudah Anda isi di periode ini akan hilang.\n\nLanjutkan?';
  var go=function(){
    refreshKarSnapshotFromMaster(p.nama,karyawanListPeriode(p));
    renderPenggajian();
    toast('Snapshot '+p.nama+' diganti dari Master — perhitungan diperbarui.');
  };
  if(typeof sigajiConfirm==='function'){
    sigajiConfirm({title:'Ambil ulang dari Master?',message:msg,danger:true,okText:'Ya, timpa dari Master'}).then(function(ok){if(ok)go();});
  }else if(confirm(msg))go();
}
if(typeof window!=='undefined'){
  window.hitungUlangPenggajian=hitungUlangPenggajian;
  window.sinkronSnapshotPeriodeDariMaster=sinkronSnapshotPeriodeDariMaster;
}
var __sigajiPgGen=0;
function sigajiCapturePgScroll(){
  var content=document.querySelector('.content');
  var wrap=document.querySelector('#pg-penggajian .table-wrap');
  return {content:content,wrap:wrap,top:content?content.scrollTop:0,left:wrap?wrap.scrollLeft:0};
}
function sigajiRestorePgScroll(s){
  if(!s)return;
  if(s.content)s.content.scrollTop=s.top;
  if(s.wrap)s.wrap.scrollLeft=s.left;
}
function segarkanProrataBaris(k,p){
  if(!k||!p)return null;
  var pr=typeof ensureProrataResignUntukPeriode==='function'?ensureProrataResignUntukPeriode(k,p):null;
  if(typeof ensureProrataMasukUntukPeriode==='function')pr=ensureProrataMasukUntukPeriode(k,p);
  if(!pr||pr.manual||typeof prorataHkHhOtomatis!=='function')return pr;
  var stop=typeof toIsoDate==='function'?toIsoDate(k.tgl_berhenti):String(k.tgl_berhenti||'').trim();
  var ps=typeof toIsoDate==='function'?toIsoDate(p.start):p.start;
  var pe=typeof toIsoDate==='function'?toIsoDate(p.end):p.end;
  if(!(stop&&ps&&pe&&stop>=ps&&stop<=pe)){
    var autoPr=prorataHkHhOtomatis(k,p);
    pr.hk=autoPr.hk;
    pr.hh=autoPr.hh;
  }
  return pr;
}
/** Input HK/HH yang sedang dipegang pengguna (fokus) — tabel tidak boleh digambar ulang di bawah jarinya. */
function sigajiPgActivePrInput(){
  var a=document.activeElement;
  if(!a||!a.classList||!a.classList.contains('pr-input'))return null;
  var tb=document.getElementById('tb-penggajian');
  if(!tb||!tb.contains(a))return null;
  return a;
}
var __sigajiPgRenderTunda=false;
/** Dipanggil saat input HK/HH dilepas: bila ada render yang ditunda, jalankan sekarang. */
function sigajiPgFlushTunda(){
  if(!__sigajiPgRenderTunda)return;
  __sigajiPgRenderTunda=false;
  renderPenggajian(false,{instant:true,keepScroll:true});
}
if(typeof window!=='undefined')window.sigajiPgFlushTunda=sigajiPgFlushTunda;
function renderPenggajian(skipTunjVar,opts){
  opts=opts||{};
  var tbEl=document.getElementById('tb-penggajian');
  var sudahAdaBaris=!!(tbEl&&tbEl.dataset.sigajiSkel!=='1'&&tbEl.querySelector('tr td.pg-sticky-name'));
  // Pengguna sedang mengetik HK/HH: jangan ganti tabel (fokus & posisi layar hilang). Gambar ulang setelah dilepas.
  if(!opts.instant&&sigajiPgActivePrInput()){
    __sigajiPgRenderTunda=true;
    return;
  }
  // Tabel sudah terisi → gambar ulang di tempat, tanpa skeleton, posisi scroll dipertahankan
  // (render dari sinkron awan / approval / halaman lain tidak boleh melempar layar ke atas).
  var instant=!!opts.instant||sudahAdaBaris;
  var keepScroll=opts.keepScroll!==false&&(opts.keepScroll||sudahAdaBaris);
  var my=++__sigajiPgGen;
  var kept=keepScroll?sigajiCapturePgScroll():null;
  var fokus=sigajiPgActivePrInput();
  var fokusKey=fokus?{nik:fokus.getAttribute('data-nik'),per:fokus.getAttribute('data-periode'),f:fokus.getAttribute('data-f')}:null;
  var p=typeof PA==='function'?PA():null;
  var list=p&&typeof karyawanListPeriode==='function'?karyawanListPeriode(p):[];
  var finish=function(map){
    if(my!==__sigajiPgGen)return;
    var paint=function(){
      __sigajiPgRenderTunda=false;
      renderPenggajianBody(skipTunjVar,map);
      sigajiRestorePgScroll(kept);
      if(fokusKey&&fokusKey.nik){
        var tb2=document.getElementById('tb-penggajian');
        var again=/** @type {HTMLInputElement|null} */(tb2?tb2.querySelector('.pr-input[data-nik="'+fokusKey.nik.replace(/"/g,'\\"')+'"][data-f="'+fokusKey.f+'"]'):null);
        if(again){
          var fokusLagi=/** @type {any} */(again);
          try{fokusLagi.focus({preventScroll:true});}catch(eF){again.focus();}
          try{again.select();}catch(eS){sigajiCatchWarn("js/modules/app-hr.js",eS);}
          sigajiRestorePgScroll(kept);
        }
      }
    };
    if(instant||typeof sigajiWithSkeleton!=='function'){
      paint();
      return;
    }
    sigajiWithSkeleton('tb-penggajian',12,paint);
  };
  if(p&&list&&list.length)list.forEach(function(k){segarkanProrataBaris(k,p);});
  var needWorker=list.length>=(window.sigajiHitungGajiMassal&&window.sigajiHitungGajiMassal.THRESHOLD||60);
  if(needWorker&&typeof window.sigajiHitungGajiMassal==='function'&&p){
    var el=document.getElementById('tb-penggajian');
    // Baris lama tetap tampil selama worker menghitung; tabel kosong saja yang diberi penanda.
    if(el&&!sudahAdaBaris)el.innerHTML='<tr><td colspan="12" class="text-subtle">Menghitung gaji…</td></tr>';
    window.sigajiHitungGajiMassal(p.nama,list).then(finish,function(){finish(null);});
    return;
  }
  finish(null);
}
function fillPgPenggajianFoot(foot,nKar,hasCab,sums){
  foot.replaceChildren();
  var tr=document.createElement('tr');
  var tdLbl=document.createElement('td');
  tdLbl.colSpan=2;
  tdLbl.className='pg-sticky-no sticky-no';
  var lbl=document.createElement('span');
  lbl.className='foot-total-label';
  lbl.textContent='Total ('+String(nKar)+' karyawan)';
  tdLbl.appendChild(lbl);
  tr.appendChild(tdLbl);
  if(hasCab)tr.appendChild(document.createElement('td'));
  tr.appendChild(document.createElement('td'));
  function moneyTd(val,extraCls){
    var td=document.createElement('td');
    td.className='num cell-money'+(extraCls?' '+extraCls:'');
    td.textContent=fmt(val);
    return td;
  }
  tr.appendChild(moneyTd(sums.gross));
  tr.appendChild(moneyTd(sums.thr,'pg-col-adv'));
  tr.appendChild(moneyTd(sums.thBruto,'pg-col-adv'));
  tr.appendChild(moneyTd(sums.bpjs,'pg-col-adv'));
  var tdPotKh=document.createElement('td');
  tdPotKh.className='num cell-money'+(sums.potKh>0?' cell-deduction':'');
  if(sums.potKh>0){
    var spPot=document.createElement('span');
    spPot.className='ct-danger';
    spPot.textContent='- '+fmt(sums.potKh);
    tdPotKh.appendChild(spPot);
  }else tdPotKh.textContent='\u2014';
  tr.appendChild(tdPotKh);
  tr.appendChild(moneyTd(sums.pph));
  var tdRet=document.createElement('td');
  tdRet.className='pg-col-adv num cell-money';
  if(sums.pphRet>0){
    var sp=document.createElement('span');
    sp.className='ct-success';
    sp.textContent='+'+fmt(sums.pphRet);
    tdRet.appendChild(sp);
  }else tdRet.textContent='\u2014';
  tr.appendChild(tdRet);
  var tdNeto=document.createElement('td');
  tdNeto.className='num cell-neto';
  var strong=document.createElement('strong');
  strong.className='cell-neto-strong';
  strong.textContent=fmt(sums.neto);
  tdNeto.appendChild(strong);
  tr.appendChild(tdNeto);
  var tdTail=document.createElement('td');
  tdTail.colSpan=2;
  tr.appendChild(tdTail);
  foot.appendChild(tr);
}
function renderPenggajianBody(skipTunjVar,gajiByNik){
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
    var pakaiDes=typeof periodePakaiRekonsiliasiTahunan==='function'&&periodePakaiRekonsiliasiTahunan(p);
    if(pakaiDes){
      var lupaTipe=p.tipe_periode!=='desember';
      html+=(lupaTipe
        ?'<div class="info-box info-amber font-12 leading-tight mb-md">Tanggal <strong>bayar</strong> di Desember — PPh 21 memakai <strong>rekonsiliasi tahunan</strong> (masa pajak Desember, bukan tanggal selesai periode). Set tipe ke Desember di Master Periode agar bukti potong A1 jelas.</div>'
        :'<div class="info-box font-12 leading-tight mb-md">Masa pajak Desember (tanggal bayar): PPh 21 direkonsiliasi dengan tarif progresif Pasal 17 (bukan TER).</div>');
    }else if(p.tipe_periode==='desember'){
      html+='<div class="info-box info-amber font-12 leading-tight mb-md">Tipe periode masih Desember, tetapi tanggal bayar bukan Desember — PPh memakai TER. Simpan ulang periode agar tipe mengikuti tanggal bayar.</div>';
    }
    thrInfo.innerHTML=html;
  }
  let prAktif=0;
  var sumGross=0,sumThr=0,sumThBruto=0,sumBpjs=0,sumPph=0,sumPphRet=0,sumNeto=0,sumPotKh=0;
  const rows=karyawanListPeriode(p).map(function(k,idx){
    const pr=segarkanProrataBaris(k,p);
    const g=(gajiByNik&&gajiByNik[k.nik])||hitungGaji(k,p.nama);
    sumGross+=g.grossPPh||0;
    sumThr+=g.thrBruto||0;
    sumThBruto+=g.brutoTH||0;
    sumBpjs+=(g.bpjs.kes_kar||0)+(g.bpjs.jht_kar||0)+(g.bpjs.jp_kar||0);
    sumPph+=g.pph||0;
    sumPphRet+=g.pphRet||0;
    sumNeto+=g.neto||0;
    sumPotKh+=(g.potKehadiran&&g.potKehadiran.total)||0;
    sumPotKh+=(g.koreksiAbsensi&&g.koreksiAbsensi.total)||0;
    const ap=approvals.find(function(a){return a.nik===k.nik&&a.period===p.nama;});
    const st=ap?ap.status:'draft';
    const stBdg={pending:'<span class="bdg b-warn">Pending</span>',approved:'<span class="bdg b-ok">Disetujui</span>',rejected:'<span class="bdg b-err">Ditolak</span>',draft:''}[st]||'';
    if(pr.enabled)prAktif++;
    const prBtn='<button type="button" class="pr-toggle '+(pr.enabled?'on':'off')+'"'+sigajiDataAction('pr-toggle',{nik:k.nik,periode:p.nama,enabled:!pr.enabled?'1':'0'})+'>'+( pr.enabled?'&#9203; Aktif':'&#9711; Off')+'</button>';
    const prAttr=function(field){
      return ' data-nik="'+escapeAttr(k.nik)+'" data-periode="'+escapeAttr(p.nama)+'" data-f="'+field+'"';
    };
    const prInputs=pr.enabled?'<div class="pr-input-row"><span class="u-muted-10">HK:</span><input class="pr-input" type="text" inputmode="numeric" autocomplete="off" enterkeyhint="done" value="'+pr.hk+'"'+prAttr('hk')+'><span class="u-muted-10">HH:</span><input class="pr-input" type="text" inputmode="numeric" autocomplete="off" enterkeyhint="done" value="'+pr.hh+'"'+prAttr('hh')+'></div>':'';
    const thrExplain=g.thrBruto>0?sigajiDataAction('explain',{nik:k.nik,periode:p.nama})+' title="Kenapa angka THR ini?"':'';
    const thrCell=g.thrBruto>0?'<div class="sigaji-money-click ct-purple fw-700"'+thrExplain+'>'+fmt(g.thrBruto)+'</div><div class="font-10 text-purple">PPh THR: '+fmt(g.pphAtasThr)+'</div>'+(typeof sigajiExplainMoneyBtn==='function'?sigajiExplainMoneyBtn(k.nik,p.nama):''):'&#8212;';
    var rowCls=[];
    if(pr.enabled)rowCls.push('pg-row-prorate');
    if(g.neto<0)rowCls.push('pg-row-neto-neg');
    if(st==='pending')rowCls.push('pg-row-pending');
    var cabPg=typeof sigajiCabangColTd==='function'?sigajiCabangColTd(k):'';
    var potKh=(g.potKehadiran&&g.potKehadiran.total)||0;
    var kAbs=(g.koreksiAbsensi&&g.koreksiAbsensi.total)||0;
    var potKhShow=potKh+kAbs;
    var potKhTipParts=[];
    if(g.potKehadiran&&g.potKehadiran.details&&g.potKehadiran.details.length){
      g.potKehadiran.details.forEach(function(d){potKhTipParts.push(d.label+': '+fmt(d.nilai));});
    }
    if(g.koreksiAbsensi&&g.koreksiAbsensi.details&&g.koreksiAbsensi.details.length){
      g.koreksiAbsensi.details.forEach(function(d){potKhTipParts.push(d.label+': '+fmt(d.nilai));});
    }
    var potKhTip=potKhTipParts.length?potKhTipParts.join(' · '):'Tidak ada potongan ketidakhadiran pada periode ini';
    var potKhTd='<td class="num cell-money'+(potKhShow>0?' cell-deduction':'')+'" title="'+escapeAttr(potKhTip)+'">'
      +(potKhShow>0?'<span class="ct-danger fw-700">- '+fmt(potKhShow)+'</span>'+(kAbs>0?'<div class="font-9 ct-warn">inc. koreksi bln lalu</div>':''):'&#8212;')+'</td>';
    return '<tr class="'+rowCls.join(' ')+'">'
      +'<td class="pg-sticky-no text-center fw-700 text-muted">'+(idx+1)+'</td>'
      +'<td class="pg-sticky-name"><div class="fl gap2 items-center"><div class="ka">'+ini(k.nama)+'</div>'
      +'<div><div class="knl"'+sigajiDataAction('open-profile',{nik:k.nik})+'>'+k.nama+'</div><small class="text-muted">'+k.dept+'</small></div></div></td>'
      +cabPg
      +'<td><div>'+prBtn+prInputs+'</div></td>'
      +'<td class="num cell-money"><span class="sigaji-money-click"'+sigajiDataAction('explain',{nik:k.nik,periode:p.nama})+' title="Kenapa gross ini?">'+fmt(g.grossPPh)+'</span>'+(typeof sigajiExplainMoneyBtn==='function'?sigajiExplainMoneyBtn(k.nik,p.nama):'')+'</td><td class="pg-col-adv num cell-money">'+thrCell+'</td>'
      +'<td class="pg-col-adv num cell-money">'+fmt(g.brutoTH)+'</td>'
      +'<td class="pg-col-adv num cell-money">'+fmt(g.bpjs.kes_kar+g.bpjs.jht_kar+g.bpjs.jp_kar)+'</td>'
      +potKhTd
      +'<td class="num cell-money'+(g.reconciliation&&g.reconciliation.kurangBayar>0?' cell-deduction':'')+'"><span class="sigaji-money-click"'+sigajiDataAction('explain',{nik:k.nik,periode:p.nama})+' title="Kenapa angka ini?">'+fmt(g.pph)+'</span>'+(typeof sigajiExplainMoneyBtn==='function'?sigajiExplainMoneyBtn(k.nik,p.nama):'')+(g.reconciliation&&g.reconciliation.lebihBayar>0?'<div class="font-9 text-success fw-700">&#10003; Lebih Bayar '+fmt(g.reconciliation.lebihBayar)+'</div>':g.reconciliation&&g.reconciliation.kurangBayar>0?'<div class="font-9 ct-danger">&#9650; Kurang Bayar '+fmt(g.reconciliation.kurangBayar)+'</div>':'')+'</td>'
      +'<td class="pg-col-adv num cell-money">'+(g.pphRet>0?'<span class="ct-success fw-700">+'+fmt(g.pphRet)+'</span>':'&#8212;')+'</td>'
      +'<td class="num cell-neto"><strong class="sigaji-money-click cell-neto-strong"'+sigajiDataAction('explain',{nik:k.nik,periode:p.nama})+' title="Waterfall THP">'+fmt(g.neto)+'</strong>'+(typeof sigajiExplainMoneyBtn==='function'?sigajiExplainMoneyBtn(k.nik,p.nama):'')+'</td>'
      +'<td>'+stBdg+'</td>'
      +'<td><button class="btn btn-sm btn-out"'+sigajiDataAction('payroll-detail',{nik:k.nik,periode:p.nama})+'>Detail</button></td></tr>';
  });
  var tbPg=document.getElementById('tb-penggajian');
  var tbFoot=document.getElementById('tb-penggajian-foot');
  var hasCab=typeof sigajiMultiBranchEnabled==='function'&&sigajiMultiBranchEnabled()&&!(typeof sigajiInBranchWorkspace==='function'&&sigajiInBranchWorkspace());
  var pgColspan=13+(hasCab?1:0);
  if(!rows.length&&typeof sigajiEmptyState==='function'){
    var emptyPgRow='<tr><td colspan="'+String(pgColspan)+'">'+sigajiEmptyState({illust:'money',title:'Belum ada karyawan di periode ini',desc:'Tambahkan karyawan atau aktifkan periode gaji yang sesuai.',btnLabel:'Buka Master Karyawan',btnAction:'showPg',btnActionArg:'karyawan'})+'</td></tr>';
    if(typeof sigajiSetTbodyRows==='function')sigajiSetTbodyRows(tbPg,[emptyPgRow],1);
    if(tbFoot)tbFoot.replaceChildren();
  }else{
    if(typeof sigajiSetTbodyRows==='function')sigajiSetTbodyRows(tbPg,rows,50);
    if(tbFoot)fillPgPenggajianFoot(tbFoot,rows.length,hasCab,{gross:sumGross,thr:sumThr,thBruto:sumThBruto,bpjs:sumBpjs,potKh:sumPotKh,pph:sumPph,pphRet:sumPphRet,neto:sumNeto});
  }
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
  const rate=rateTerHasil(g,k,p);
  document.getElementById('m-gaji-t').textContent='Detail Gaji - '+k.nama+' ('+pN+')';
  let h='';
  if(g.thrBruto>0)h+='<div class="card-surface-purple p-inset-sm tabs-spaced-lg font-12"><strong>&#127873; THR:</strong> '+fmt(g.thrBruto)+' dibayar full netto. PPh THR: <strong>'+fmt(g.pphAtasThr)+'</strong> dipotong dari gaji ini.</div>';
  h+='<div class="gross-sec"><div class="gross-tit">GROSS INCOME (dasar PPh 21)</div>';
  var gpDet='Gaji Pokok';
  if(g.siklusGaji==='harian')gpDet='Gaji Pokok sebulan ('+fmt(g.gapokRate)+' × '+g.siklusUnits+' hari)';
  else if(g.siklusGaji==='mingguan')gpDet='Gaji Pokok sebulan ('+fmt(g.gapokRate)+' × '+g.siklusUnits+' minggu)';
  else if(g.isPR)gpDet='Gaji Pokok (Pro-Rata '+g.pr.hh+'/'+g.pr.hk+')';
  h+='<div class="cr"><span>'+gpDet+'</span><span>'+fmt(g.gapokEff)+'</span></div>';
  g.tItems.forEach(function(t){h+='<div class="cr"><span>'+t.nama+(t.isHarian?' [masuk PPh, tidak TH]':(t.inTH===false?' [tidak TH]':''))+'</span><span>'+fmt(t.eff)+'</span></div>';});
  if(g.natKP>0)h+='<div class="cr"><span>Natura KP</span><span>'+fmt(g.natKP)+'</span></div>';
  if(g.lb>0)h+='<div class="cr"><span>Lembur</span><span>'+fmt(g.lb)+'</span></div>';
  if(g.bpjsPrsNatKP>0)h+='<div class="cr ct-brand"><span>BPJS Prs JKK+JKM+Kes (Natura KP)</span><span>'+fmt(g.bpjsPrsNatKP)+'</span></div>';
  if(g.thrBruto>0)h+='<div class="cr ct-purple fw-700"><span>THR Bruto</span><span>'+fmt(g.thrBruto)+'</span></div>';
  h+='<div class="cr bold"><span>Total Gross PPh 21</span><span>'+fmt(g.grossPPh)+'</span></div></div>';
  h+='<div class="pph-calc-sec"><div class="pph-calc-tit">PPh 21 - TER PMK 168/2023</div>';
  h+='<div class="cr"><span>Penghasilan Bruto</span><span>'+fmt(g.grossPPh)+'</span></div>';
  if(g.thrBruto>0)h+='<div class="cr ct-purple"><span>Porsi PPh atas THR</span><span>'+fmt(g.pphAtasThr)+'</span></div>';
  h+='<div class="cr result"><span>TER '+(g.ptkpStatus||k.ptkp)+': '+(rate*100).toFixed(2)+'% × '+fmt(g.grossPPh)+' = <strong>PPh 21 bulan ini</strong></span><span><strong>'+fmt(g.pph)+'</strong></span></div></div>';
  h+='<div class="fl mt-lg flex-wrap" style="gap:.75rem">';
  h+='<div class="flex-1"><div class="stit">Take Home Bruto</div><div class="pr-row-info"><span>Gaji + Tunjangan + Lembur</span><span>'+fmt(g.brutoTH)+'</span></div>';
  if(g.natNKP>0)h+='<div class="pr-row-info text-muted"><span>Natura tidak kena pajak (fasilitas, tidak ditransfer)</span><span>'+fmt(g.natNKP)+'</span></div>';
  h+='<div class="pr-row-info fw-700 gs-divider"><span>Total Take Home Bruto</span><span>'+fmt(g.brutoTH)+'</span></div>';
  if(g.thrBruto>0)h+='<div class="font-10 text-purple">THR TIDAK masuk TH (dibayar terpisah)</div>';
  h+='</div>';
  h+='<div class="flex-1"><div class="stit">Potongan</div><div class="pr-row-info"><span>PPh 21</span><span>- '+fmt(g.pph)+'</span></div><div class="pr-row-info"><span>BPJS Kar</span><span>- '+fmt(g.bpjs.kes_kar+g.bpjs.jht_kar+g.bpjs.jp_kar)+'</span></div>';
  (k.potongan||[]).forEach(function(x){h+='<div class="pr-row-info"><span>'+x.nama+'</span><span>- '+fmt(x.nilai)+'</span></div>';});
  var potKh=g.potKehadiran||{total:0,details:[]};
  (potKh.details||[]).forEach(function(d){
    h+='<div class="pr-row-info slip-pot-warn"><span>'+escapeHtml(d.label)+'</span><span>- '+fmt(d.nilai)+'</span></div>';
  });
  var kAbsM=g.koreksiAbsensi||{total:0,details:[]};
  (kAbsM.details||[]).forEach(function(d){
    h+='<div class="pr-row-info slip-pot-warn"><span>'+escapeHtml(d.label)+'</span><span>- '+fmt(d.nilai)+'</span></div>';
  });
  if(potKh.total>0&&potKh.gajiHarian>0)h+='<div class="font-10 text-muted">Dasar potongan: gaji harian '+fmt(potKh.gajiHarian)+' (1/2 hari = '+fmt(Math.round(potKh.gajiHarian/2))+')</div>';
  h+='<div class="pr-row-info fw-700 gs-divider"><span>Total Potongan</span><span>- '+fmt(g.totalPot)+'</span></div>';
  if(g.pphRet>0)h+='<div class="pr-row-info ct-success"><span>Return PPh</span><span>+ '+fmt(g.pphRet)+'</span></div>';
  if(g.refundPph>0)h+='<div class="pr-row-info ct-success"><span>Lebih bayar PPh (dikembalikan)</span><span>+ '+fmt(g.refundPph)+'</span></div>';
  if(g.refundPphBawa>0)h+='<div class="pr-row-info ct-purple"><span>Pengembalian PPh tahun lalu (masuk THP)</span><span>+ '+fmt(g.refundPphBawa)+'</span></div>';
  h+='</div></div>';
  h+='<div class="rounded-sm p-inset-sm fl justify-between fw-800 mt-lg font-14 btn-email"><span>TAKE HOME PAY</span><span>'+fmt(g.neto)+'</span></div>';
  // Tambahkan reconciliation box untuk masa pajak terakhir
  if(g.reconciliation){
    const r=g.reconciliation;
    const isLebih=r.lebihBayar>0;
    h+='<div class="recon-panel '+(isLebih?'is-refund':'is-owe')+'">';
    h+='<div class="fw-800 mb-md recon-panel-title '+(isLebih?'is-refund':'is-owe')+'">&#9654; Rekonsiliasi PPh 21 '+(r.tipePeriode==='resign'?'(Masa Pajak Terakhir - Resign)':'(Desember - Progresif)')+'</div>';
    if(r.saldoAwalBruto>0||r.saldoAwalPph>0||r.saldoAwalIuran>0){
      h+='<div class="cr ct-brand"><span>Saldo migrasi'+(r.saldoSdBulan?' (s/d bln '+r.saldoSdBulan+')':'')+' — bruto / PPh / iuran JHT+JP</span><span>'+fmt(r.saldoAwalBruto)+' / '+fmt(r.saldoAwalPph)+(r.saldoAwalIuran>0?' / '+fmt(r.saldoAwalIuran):'')+'</span></div>';
      if(r.brutoDariPeriode>0||r.pphDariPeriode>0)h+='<div class="cr"><span>+ Dari periode SiGaji (sebelum bulan ini)</span><span>'+fmt(r.brutoDariPeriode)+' / '+fmt(r.pphDariPeriode)+'</span></div>';
    }
    h+='<div class="cr"><span>Total Bruto YTD (kumulatif sebelum bulan ini)</span><span>'+fmt(r.brutoYTD)+'</span></div>';
    h+='<div class="cr"><span>Bruto bulan ini</span><span>'+fmt(g.grossPPh)+'</span></div>';
    h+='<div class="cr bold"><span>Total Bruto Setahun</span><span>'+fmt(r.brutoTahunan)+'</span></div>';
    h+='<div class="cr mt-xs"><span>PPh Tahunan (Progresif Pasal 17)</span><span>'+fmt(r.pphTahunan)+'</span></div>';
    h+='<div class="cr"><span>PPh sudah dipotong (Jan s.d. bulan lalu)</span><span>- '+fmt(r.pphYTD)+'</span></div>';
    h+='<div class="cr bold recon-panel-amount '+(isLebih?'is-refund':'is-owe')+'"><span>'+(isLebih?'&#10003; Lebih Bayar (dikembalikan)':'&#9888; Kurang Bayar (dipotong)')+' </span><span>'+( isLebih?'+ ':'')+fmt(isLebih?r.lebihBayar:r.kurangBayar)+'</span></div>';
    if(isLebih&&r.opsiLebihBayar==='carryover')h+='<div class="font-10 ct-purple mt-xs">&#8594; Lebih bayar tidak masuk THP bulan ini; dibayarkan di take home Januari tahun depan (PPh 21 Januari tetap dihitung normal)</div>';
    if(isLebih&&r.opsiLebihBayar==='refund')h+='<div class="font-10 ct-success mt-xs">&#8594; Lebih bayar '+fmt(r.lebihBayar)+' ditambahkan ke take home bulan ini (PPh bulan ini = Rp 0)</div>';
    h+='</div>';
  }
  document.getElementById('m-gaji-c').innerHTML=h;
  openModal('m-gaji');
}
