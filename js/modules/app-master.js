/* SiGaji — periode, master perusahaan, backup, import */
// ── PERIODE & MASTER ─────────────────────────────
function toggleThrFields(){var aktif=document.getElementById('p-thr-aktif')&&document.getElementById('p-thr-aktif').checked;var f=document.getElementById('thr-fields');if(f)f.style.display=aktif?'block':'none';}
function renderPeriodes(){
  if(typeof sigajiWithSkeleton==='function'){
    return sigajiWithSkeleton('tb-periode',8,renderPeriodesBody);
  }
  renderPeriodesBody();
}
function renderPeriodesBody(){
  renderPBanner('pb-master');
  var p=PA();var pn=document.getElementById('p-nama');
  if(pn&&!pn.value){
    pn.value=p.nama;
    if(document.getElementById('p-start'))document.getElementById('p-start').value=p.start;
    if(document.getElementById('p-end'))document.getElementById('p-end').value=p.end;
    if(document.getElementById('p-bayar'))document.getElementById('p-bayar').value=p.bayar;
    if(document.getElementById('p-status'))document.getElementById('p-status').value=p.status;
    var thrEl=document.getElementById('p-thr-aktif');if(thrEl)thrEl.checked=!!p.thr_aktif;
    toggleThrFields();
    if(p.thr_aktif){
      if(document.getElementById('p-thr-nama'))document.getElementById('p-thr-nama').value=p.thr_nama||'Idul Fitri 1447 H';
      if(document.getElementById('p-thr-bayar'))document.getElementById('p-thr-bayar').value=p.thr_bayar||'';
      if(document.getElementById('p-thr-hariraya'))document.getElementById('p-thr-hariraya').value=p.thr_hariraya||'';
    }
  }
  document.getElementById('tb-periode').innerHTML=periodes.map(function(p){
    var lockBdg=p.snapshot_locked?'<span class="bdg b-err" style="margin-left:6px">Snapshot Terkunci</span>':'<span class="bdg b-gray" style="margin-left:6px">Snapshot Terbuka</span>';
    var lockBtn='<button class="btn btn-sm '+(p.snapshot_locked?'btn-out':'btn-r')+'"'+sigajiDataAction('periode-lock',{id:p.id})+'>'+(p.snapshot_locked?'Buka Kunci':'Kunci')+'</button>';
    var rebuildBtn='<button class="btn btn-sm btn-out"'+sigajiDataAction('periode-rebuild',{id:p.id})+'>Rebuild Snapshot</button>';
    return '<tr><td><strong>'+p.nama+'</strong></td><td>'+p.start+'</td><td>'+p.end+'</td><td>'+p.bayar+'</td>'
      +'<td>'+(p.thr_aktif?'<div class="font-11 ct-purple fw-700">&#127873; '+(p.thr_nama||'THR')+'<br><span class="text-subtle" style="font-weight:400">Bayar: '+fmtDate(p.thr_bayar||'-')+'</span></div>':'&#8212;')+'</td>'
      +'<td><span class="bdg '+(p.status==='aktif'?'b-ok':'b-gray')+'">'+(p.status==='aktif'?'Aktif':'Tutup')+'</span>'+lockBdg+'</td>'
      +'<td><div class="fl gap1"><button class="btn btn-sm btn-out"'+sigajiDataAction('periode-aktifkan',{id:p.id})+'>Aktifkan</button>'+lockBtn+rebuildBtn+'<button class="btn btn-sm btn-r"'+sigajiDataAction('periode-hapus',{id:p.id})+'>Hapus</button></div></td></tr>';
  }).join('');
  renderPeriodeSnapshotGuardUi(false);
  updatePeriodeSimpanButtonState();
}
function renderPBanner(id){var p=PA();var el=document.getElementById(id);if(!el)return;var hP=Math.max(0,Math.ceil((new Date(p.bayar)-Date.now())/86400000));var html='<div class="pb mb2"><div><div class="font-10 opacity-75">Periode Aktif</div><div class="font-17 fw-800">'+escapeHtml(p.nama)+(p.thr_aktif?' <span class="font-12 rounded-pill" style="background:rgba(255,255,255,.2); padding:2px 8px">&#127873; THR</span>':'')+'</div><div class="font-11 opacity-80">'+fmtDate(p.start)+' - '+fmtDate(p.end)+'</div></div><div class="text-right"><div class="fw-800 font-28">'+String(hP)+'</div><div class="font-10 opacity-75">hari</div></div></div>';el.innerHTML=html;}
function toggleOpsiLebihBayar(){
  const tipe=document.getElementById('p-tipe-periode')&&document.getElementById('p-tipe-periode').value;
  const el=document.getElementById('fg-opsi-lebih-bayar');
  if(el)el.style.display=(tipe==='desember'||tipe==='resign')?'block':'none';
}
function isPeriodeSnapshotTerbuka(p){
  if(!p)return false;
  return p.snapshot_locked!==true;
}
function findPeriodeByNama(nama){
  var n=String(nama||'').trim().toLowerCase();
  if(!n)return null;
  return (periodes||[]).find(function(p){return String(p.nama||'').trim().toLowerCase()===n;})||null;
}
function isNamaPeriodeBaru(nama){
  return !findPeriodeByNama(nama);
}
/** Periode yang snapshot-nya masih terbuka (belum dikunci). */
function getPeriodesSnapshotTerbuka(excludeNama){
  var exNorm=excludeNama?String(excludeNama).trim().toLowerCase():'';
  return (periodes||[]).filter(function(p){
    if(!isPeriodeSnapshotTerbuka(p))return false;
    if(exNorm&&String(p.nama||'').trim().toLowerCase()===exNorm)return false;
    return true;
  });
}
function renderPeriodeSnapshotGuardUi(blocking){
  var el=document.getElementById('periode-guard-msg');
  if(!el)return;
  var open=getPeriodesSnapshotTerbuka();
  if(!open.length){el.style.display='none';el.innerHTML='';return;}
  var items=open.map(function(p){
    var aktif=p.status==='aktif'?' <span class="bdg b-ok font-9" style="vertical-align:middle">aktif</span>':'';
    return '<li style="margin:.2rem 0"><strong>'+escapeHtml(p.nama)+'</strong>'+aktif+' — snapshot terbuka</li>';
  }).join('');
  var names=open.map(function(p){return p.nama;}).join(', ');
  var guardCls=blocking?'snap-guard-blocking':'snap-guard-warn';
  var title=blocking?'<strong>Periode baru ditolak.</strong> ':'<strong>Perhatian:</strong> ';
  var sub=blocking
    ?'Kunci snapshot periode berikut (tombol <em>Kunci</em> di tabel Riwayat Periode) sebelum menambah periode baru:'
    :'Sebelum menambah periode baru, kunci snapshot periode berikut:';
  el.style.display='block';
  var html='<div class="rounded-md mt-lg font-12 leading-tight '+guardCls+'" style="border:1.5px solid; padding:.75rem 1rem">'
    +title+sub+'<ul style="margin:.45rem 0 .55rem 1.15rem">'+items+'</ul>'
    +'<button type="button" class="btn btn-sm btn-p"'+sigajiDataAction('invoke',{fn:'goToDaftarPeriode'})+'>Ke daftar periode</button></div>';
  el.innerHTML=html;
  if(blocking)toast('Kunci dulu: '+names+' (snapshot terbuka)');
}
function goToDaftarPeriode(){
  if(!canAccessModule('master')){toast('Tidak punya akses Master Perusahaan');return;}
  sigajiCloseNavDrawer();
  showPg('master');
  setTimeout(function(){
    var tab=document.querySelector('#pg-master .tab[data-mstab="periode"]');
    if(tab&&canAccessSubTab('master','periode'))switchTab(tab,'m-periode');
    var tb=document.getElementById('tb-periode');
    if(tb){try{tb.scrollIntoView({behavior:'smooth',block:'nearest'});}catch(e){tb.scrollIntoView(true);}}
  },100);
}
function guardCanBuatPeriodeBaru(nama){
  if(nama!=null&&nama!==''&&!isNamaPeriodeBaru(nama)){
    updatePeriodeSimpanButtonState();
    return true;
  }
  var open=getPeriodesSnapshotTerbuka();
  if(!open.length){
    renderPeriodeSnapshotGuardUi(false);
    updatePeriodeSimpanButtonState();
    return true;
  }
  renderPeriodeSnapshotGuardUi(true);
  updatePeriodeSimpanButtonState();
  return false;
}
function updatePeriodeSimpanButtonState(){
  var btn=document.getElementById('btn-simpan-periode');
  var namaEl=document.getElementById('p-nama');
  if(!btn||!namaEl)return;
  var nama=namaEl.value.trim();
  var blockBaru=isNamaPeriodeBaru(nama)&&getPeriodesSnapshotTerbuka().length>0;
  btn.disabled=blockBaru;
  btn.style.opacity=blockBaru?'.55':'';
  btn.style.cursor=blockBaru?'not-allowed':'';
  btn.title=blockBaru?'Kunci semua snapshot terbuka dulu sebelum menambah periode baru':'';
}
function simpanPeriode(){
  var nama=document.getElementById('p-nama').value.trim();var start=document.getElementById('p-start').value;var end=document.getElementById('p-end').value;var bayar=document.getElementById('p-bayar').value;var status=document.getElementById('p-status').value;
  if(!nama||!start||!end||!bayar){toast('Wajib diisi');return;}
  if(isNamaPeriodeBaru(nama)&&!guardCanBuatPeriodeBaru(nama))return;
  var tipeP=(document.getElementById('p-tipe-periode')&&document.getElementById('p-tipe-periode').value)||'normal';
  var opsiLB=(document.getElementById('p-opsi-lebih-bayar')&&document.getElementById('p-opsi-lebih-bayar').value)||'refund';
  var thrAktif=!!(document.getElementById('p-thr-aktif')&&document.getElementById('p-thr-aktif').checked);
  var thrNama=thrAktif&&document.getElementById('p-thr-nama')?document.getElementById('p-thr-nama').value:'';
  var thrBayar=thrAktif&&document.getElementById('p-thr-bayar')?document.getElementById('p-thr-bayar').value:'';
  var thrHR=thrAktif&&document.getElementById('p-thr-hariraya')?document.getElementById('p-thr-hariraya').value:'';
  var obj={nama:nama,start:start,end:end,bayar:bayar,status:status,tipe_periode:tipeP,opsi_lebih_bayar:opsiLB,thr_aktif:thrAktif,thr_nama:thrNama,thr_bayar:thrBayar,thr_hariraya:thrHR};
  var ex=findPeriodeByNama(nama);
  var isNew=!ex;
  if(ex)Object.assign(ex,obj);
  else periodes.push(Object.assign({id:Date.now(),snapshot_locked:false},obj));
  if(status==='aktif')periodes.forEach(function(p){if(p.nama!==nama)p.status='tutup';});
  if(isNew){
    var list=karyawanListPeriode({nama:nama,start:start,end:end,status:status});
    ensureKarSnapshotPeriode(nama,list);
  }
  saveAll();renderPeriodes();document.getElementById('top-periode').textContent=PA().nama;renderKar();renderPenggajian();renderDash();renderPPH();renderLaporan();renderPeriodeSelects();populateSelects();toast('Periode disimpan'+(thrAktif?' dengan THR':''));
}
function aktifkanPeriode(id){periodes.forEach(function(p){p.status=sigajiSameId(p.id,id)?'aktif':'tutup';});saveAll();renderPeriodes();document.getElementById('top-periode').textContent=PA().nama;renderKar();renderPenggajian();renderDash();renderPPH();renderLaporan();renderPeriodeSelects();populateSelects();toast('Diaktifkan');}
function toggleLockPeriode(id){
  var p=periodesFindById(id);
  if(!p)return;
  if(!p.snapshot_locked){
    var list=karyawanListPeriode(p);
    ensureKarSnapshotPeriode(p.nama,list);
    var prog=getKarSnapshotProgress(p.nama,list);
    if(!prog.ok){toast('Snapshot belum lengkap: '+prog.done+'/'+prog.total);return;}
    if(!confirm('Kunci snapshot periode "'+p.nama+'"? Setelah dikunci, perubahan master tidak akan mengubah perhitungan periode ini.'))return;
    p.snapshot_locked=true;
    saveAll();renderPeriodes();renderPeriodeSnapshotGuardUi(false);updatePeriodeSimpanButtonState();toast('Periode '+p.nama+' terkunci');
  }else{
    if(!confirm('Buka kunci snapshot periode "'+p.nama+'"? Perubahan berikutnya pada periode ini bisa mengubah snapshot.'))return;
    p.snapshot_locked=false;
    saveAll();renderPeriodes();updatePeriodeSimpanButtonState();toast('Kunci periode dibuka');
  }
}
function rebuildSnapshotPeriode(id){
  var p=periodesFindById(id);
  if(!p)return;
  if(p.snapshot_locked){toast('Periode '+p.nama+' terkunci. Buka kunci dulu untuk rebuild snapshot.');return;}
  if(!confirm('Rebuild snapshot periode "'+p.nama+'"? Snapshot lama periode ini akan ditimpa dari Master saat ini.'))return;
  if(!karSnapshot)karSnapshot={};
  karSnapshot[p.nama]={};
  ensureKarSnapshotPeriode(p.nama,karyawanListPeriode(p));
  saveAll();
  renderPeriodes();
  if(sigajiSameId(PA().id,p.id)){renderDash();renderPenggajian();renderPPH();renderLaporan();}
  toast('Snapshot '+p.nama+' berhasil di-rebuild dari Master saat ini');
}
function hapusPeriode(id){var p=periodesFindById(id);if(!p)return;sigajiConfirm({title:'Hapus periode',message:'Apakah Anda yakin ingin menghapus periode "'+(p.nama||String(id))+'"?',danger:true,okText:'Ya, hapus'}).then(function(ok){if(!ok)return;periodes=periodes.filter(function(x){return !sigajiSameId(x.id,id);});saveAll();renderPeriodes();toast('Periode dihapus');});}
function updatePolaPeriode(){var pola=document.getElementById('p-pola').value;if(pola==='25-24'){document.getElementById('p-start').value='2026-02-25';document.getElementById('p-end').value='2026-03-24';document.getElementById('p-bayar').value='2026-03-25';}else if(pola==='21-20'){document.getElementById('p-start').value='2026-02-21';document.getElementById('p-end').value='2026-03-20';document.getElementById('p-bayar').value='2026-03-21';}else if(pola==='1-akhir'){document.getElementById('p-start').value='2026-03-01';document.getElementById('p-end').value='2026-03-31';document.getElementById('p-bayar').value='2026-03-31';}}
function simpanPerusahaan(){perusahaan.nama=document.getElementById('prs-nama').value;perusahaan.npwp=document.getElementById('prs-npwp').value;perusahaan.nitku=(document.getElementById('prs-nitku')&&document.getElementById('prs-nitku').value.trim())||'';perusahaan.alamat=document.getElementById('prs-alamat').value;perusahaan.telp=document.getElementById('prs-telp').value;perusahaan.email=document.getElementById('prs-email').value;perusahaan.web=document.getElementById('prs-web').value;perusahaan.a1_kota=(document.getElementById('prs-a1-kota')&&document.getElementById('prs-a1-kota').value)||'';perusahaan.a1_prefix=(document.getElementById('prs-a1-prefix')&&document.getElementById('prs-a1-prefix').value.trim())||'A1';perusahaan.a1_ttd_nama=(document.getElementById('prs-a1-ttd')&&document.getElementById('prs-a1-ttd').value)||'';perusahaan.a1_ttd_jabatan=(document.getElementById('prs-a1-jab')&&document.getElementById('prs-a1-jab').value)||'';perusahaan.jamMasuk=(document.getElementById('prs-jam-masuk')&&document.getElementById('prs-jam-masuk').value)||'08:00';var hk=document.querySelector('input[name="hk-radio"]:checked');perusahaan.hariKerja=hk?parseInt(hk.value)||6:6;saveAll();applyBranding();updateHKRadioStyle();renderPenggajian();renderDash();toast('Data perusahaan disimpan');}
function loadPrsForm(){['nama','npwp','nitku','alamat','telp','email','web'].forEach(function(f){var e=document.getElementById('prs-'+f);if(e)e.value=perusahaan[f]||'';});try{if(typeof sigajiTogglePrsNitkuField==='function')sigajiTogglePrsNitkuField();}catch(eNt){sigajiCatchWarn("js/modules/app-master.js",eNt);}try{if(typeof sigajiRenderLicenseQuotaUi==='function')sigajiRenderLicenseQuotaUi();}catch(eLq){sigajiCatchWarn("js/modules/app-master.js",eLq);}var a1k=document.getElementById('prs-a1-kota');if(a1k)a1k.value=perusahaan.a1_kota||'';var a1p=document.getElementById('prs-a1-prefix');if(a1p)a1p.value=perusahaan.a1_prefix!=null?perusahaan.a1_prefix:'A1';var a1t=document.getElementById('prs-a1-ttd');if(a1t)a1t.value=perusahaan.a1_ttd_nama||'';var a1j=document.getElementById('prs-a1-jab');if(a1j)a1j.value=perusahaan.a1_ttd_jabatan||'';var jm=document.getElementById('prs-jam-masuk');if(jm)jm.value=perusahaan.jamMasuk||'08:00';var hk=perusahaan.hariKerja||6;var r=document.getElementById('hk-'+hk);if(r)r.checked=true;updateHKRadioStyle();renderPTKPForm();}
var __umkEditing=false;
function ensurePerusahaanUmk(){if(!perusahaan.umk||typeof perusahaan.umk!=='object')perusahaan.umk={};}
function renderUmkYearSelect(){
  ensurePerusahaanUmk();
  var sel=document.getElementById('umk-year-sel');if(!sel)return;
  var yr=new Date().getFullYear();
  var years={};
  var minY=yr-8;
  var maxY=yr+15;
  for(var y=minY;y<=maxY;y++)years[y]=1;
  Object.keys(perusahaan.umk||{}).forEach(function(y){var n=parseInt(y,10);if(!isNaN(n)&&n>=2000&&n<2100)years[n]=1;});
  (periodes||[]).forEach(function(p){
    [p.start,p.end,p.bayar].forEach(function(d){
      if(!d)return;
      var m=String(d).match(/^(\d{4})/);
      if(m){var ny=parseInt(m[1],10);if(!isNaN(ny))years[ny]=1;}
    });
  });
  var list=Object.keys(years).map(Number).filter(function(y){return y>=2000&&y<2100;}).sort(function(a,b){return b-a;});
  if(!list.length)list=[yr];
  var prev=sel.value;
  sel.innerHTML=list.map(function(y){return'<option value="'+y+'">'+y+'</option>';}).join('');
  if(prev&&list.indexOf(parseInt(prev,10))>=0)sel.value=prev;
  else if(list.indexOf(yr)>=0)sel.value=String(yr);
}
function renderUmkPanel(){
  ensurePerusahaanUmk();
  renderUmkYearSelect();
  var sel=document.getElementById('umk-year-sel');
  var inp=document.getElementById('umk-nilai');
  var btn=document.getElementById('umk-btn-edit');
  if(!sel||!inp)return;
  var y=sel.value||String(new Date().getFullYear());
  var raw=perusahaan.umk[y];
  var v=raw!=null&&raw!==''?Number(raw):0;
  if(!__umkEditing||document.activeElement!==inp){
    __umkEditing=false;
    inp.readOnly=true;
    if(btn){btn.textContent='Edit';btn.className='btn btn-sm btn-out';}
    syncGapokRpInput(inp,v);
  }
  var wrap=document.getElementById('umk-history-wrap');
  if(wrap){
    var keys=Object.keys(perusahaan.umk).filter(function(k){return perusahaan.umk[k]!=null&&perusahaan.umk[k]!=='';}).sort(function(a,b){return Number(b)-Number(a);});
    wrap.innerHTML=keys.length?'<div class="font-11 fw-700 text-muted mb-sm">Riwayat UMK tersimpan</div><table class="font-12 select-inline" style="min-width:280px; border-collapse:collapse"><thead><tr class="bg-surface-2"><th class="text-left" style="padding:6px 10px; border:1px solid var(--bd)">Tahun</th><th class="text-right" style="padding:6px 10px; border:1px solid var(--bd)">UMK</th></tr></thead><tbody>'+keys.map(function(yr){return'<tr><td style="padding:6px 10px;border:1px solid var(--bd)">'+yr+'</td><td class="text-right fw-700" style="padding:6px 10px; border:1px solid var(--bd)">'+fmt(perusahaan.umk[yr]||0)+'</td></tr>';}).join('')+'</tbody></table>':'<div class="u-muted-12">Belum ada UMK tersimpan. Pilih tahun, Edit, isi nilai, lalu Simpan &amp; Kunci.</div>';
  }
  var root=document.getElementById('m-umk');
  if(root&&typeof sigajiBindRpInputs==='function')sigajiBindRpInputs(root);
}
function toggleUmkEdit(){
  if(!canAccessSubTab('master','umk')){toast('Tidak punya akses tab UMK');return;}
  var inp=document.getElementById('umk-nilai');
  var btn=document.getElementById('umk-btn-edit');
  if(!inp||!btn)return;
  if(__umkEditing){
    var sel=document.getElementById('umk-year-sel');
    var y=sel&&sel.value?String(sel.value):String(new Date().getFullYear());
    var n=parseRpInput(inp.value);
    if(n<=0){toast('Isi nilai UMK lebih dari 0');return;}
    ensurePerusahaanUmk();
    perusahaan.umk[y]=n;
    saveAll();
    __umkEditing=false;
    inp.readOnly=true;
    btn.textContent='Edit';
    btn.className='btn btn-sm btn-out';
    renderUmkPanel();
    toast('UMK '+y+' disimpan & dikunci');
    return;
  }
  __umkEditing=true;
  inp.readOnly=false;
  btn.textContent='Simpan & Kunci';
  btn.className='btn btn-sm btn-p';
  inp.value=String(parseRpInput(inp.value)||'');
  delete inp.dataset.rpBound;
  try{inp.focus();inp.select();}catch(e){sigajiCatchWarn("js/modules/app-master.js",e);}
}
function applyUmkToAllGapok(){
  if(!canAccessSubTab('master','umk')){toast('Tidak punya akses tab UMK');return;}
  ensurePerusahaanUmk();
  var sel=document.getElementById('umk-year-sel');
  var y=sel&&sel.value?String(sel.value):String(new Date().getFullYear());
  var umk=perusahaan.umk[y];
  var n=umk!=null?Math.round(Number(umk)||0):0;
  if(n<=0){toast('UMK tahun '+y+' belum diisi. Tab UMK → Edit → Simpan & Kunci.');return;}
  if(!confirm('Terapkan UMK '+y+' ('+fmt(n)+') ke gaji pokok SEMUA karyawan (master)?\n\nSnapshot periode terkunci tidak diubah. Periode aktif yang tidak terkunci ikut diperbarui.'))return;
  var cnt=0;
  (karyawan||[]).forEach(function(k){if(!k||!k.nik)return;k.gapok=n;cnt++;});
  var p=PA();
  var snapN=0;
  if(p&&p.nama&&!isPeriodeLocked(p.nama)){
    var list=karyawanListPeriode(p);
    ensureKarSnapshotPeriode(p.nama,list);
    list.forEach(function(k){
      if(karSnapshot[p.nama]&&karSnapshot[p.nama][k.nik]){karSnapshot[p.nama][k.nik].gapok=n;snapN++;}
    });
  }
  saveAll();
  renderKompgaji();
  renderPenggajian();
  try{renderDash();}catch(e){sigajiCatchWarn("js/modules/app-master.js",e);}
  toast(cnt+' karyawan: gaji pokok = '+fmt(n)+(snapN?' ('+snapN+' snapshot periode aktif)':''));
}
function renderPTKPForm(){
  var tb=document.getElementById('tb-ptkp-master');if(!tb)return;
  var t=getPTKPTable();
  var hint={TK0:'Tidak kawin, tanggungan 0',TK1:'Tidak kawin, tanggungan 1',TK2:'Tidak kawin, tanggungan 2',TK3:'Tidak kawin, tanggungan 3',K0:'Kawin, tanggungan 0',K1:'Kawin, tanggungan 1',K2:'Kawin, tanggungan 2',K3:'Kawin, tanggungan 3'};
  tb.innerHTML=PTKP_KEYS.map(function(k){
    return'<tr><td class="fw-700" style="white-space:nowrap">'+PTKP_LBL[k]+'</td><td class="text-muted font-11">'+hint[k]+'</td>'
      +'<td><input class="w-full font-12" type="number" min="0" step="1000" id="ptkp-val-'+k+'" value="'+Math.round(t[k])+'" style="max-width:200px; padding:6px 10px; border:1.5px solid #dde1e9; border-radius:6px; font-family:inherit"></td></tr>';
  }).join('');
}
function simpanPTKP(){
  if(!perusahaan.ptkp_nilai)perusahaan.ptkp_nilai={};
  var next={},ok=true;
  PTKP_KEYS.forEach(function(k){
    var el=document.getElementById('ptkp-val-'+k);if(!el)return;
    var n=parseFloat(el.value);
    if(isNaN(n)||n<0){ok=false;}
    else next[k]=n;
  });
  if(!ok){toast('Semua nilai PTKP harus angka ≥ 0');return;}
  PTKP_KEYS.forEach(function(k){
    var n=next[k],def=DEFAULT_PTKP[k];
    if(Math.round(n)===Math.round(def))delete perusahaan.ptkp_nilai[k];else perusahaan.ptkp_nilai[k]=n;
  });
  if(!Object.keys(perusahaan.ptkp_nilai).length)perusahaan.ptkp_nilai={};
  saveAll();toast('Tabel PTKP disimpan');renderPenggajian();renderPPH();renderPTKPForm();
}
function resetPTKP(){if(!confirm('Reset semua nilai PTKP ke default (seperti PMK umum)?'))return;perusahaan.ptkp_nilai={};saveAll();renderPTKPForm();renderPenggajian();renderPPH();toast('PTKP direset');}
function updateHKRadioStyle(){var hk=perusahaan.hariKerja||6;var l5=document.getElementById('hk-5-lbl');var l6=document.getElementById('hk-6-lbl');if(l5){l5.className='fl items-center gap-sm cursor-pointer rounded-sm flex-1 hk-radio-label '+(hk===5?'hk-radio-active':'hk-radio-idle');}if(l6){l6.className='fl items-center gap-sm cursor-pointer rounded-sm flex-1 hk-radio-label '+(hk===6?'hk-radio-active':'hk-radio-idle');}}
document.addEventListener('change',function(e){if(e.target.name==='hk-radio'){perusahaan.hariKerja=parseInt(e.target.value)||6;updateHKRadioStyle();}});
// ── ATURAN POTONGAN ──────────────────────────────
var JENIS_POT=[{key:'cuti_dalam_kuota',lbl:'Cuti (dalam kuota)',ket:'Dalam saldo'},{key:'cuti_luar_kuota',lbl:'Cuti (luar kuota)',ket:'Saldo habis'},{key:'izin',lbl:'Izin 1 hari',ket:'Izin tertulis'},{key:'sakit',lbl:'Sakit 1 hari',ket:'Dengan/tanpa surat'},{key:'setengah_sakit',lbl:'1/2 Sakit',ket:'Hadir 1/2 hari'},{key:'setengah_ijin',lbl:'1/2 Izin',ket:'Hadir 1/2 hari'},{key:'alpha',lbl:'Alpha/Mangkir',ket:'Tanpa keterangan'}];
var MODE_OPTS='<option value="tidak_dipotong">Tidak Dipotong</option><option value="prorata">Pro-Rata (1 hari)</option><option value="prorata_setengah">Pro-Rata (1/2 hari)</option><option value="nominal">Nominal Tetap (Rp)</option><option value="persen">Persentase Harian (%)</option>';
function loadAturanPotongan(){
  var ap=perusahaan.aturan_potongan||{};
  document.getElementById('tb-aturan-pot').innerHTML=JENIS_POT.map(function(j){
    var rule=ap[j.key]||{mode:'prorata',nilai:0};var show=rule.mode==='nominal'||rule.mode==='persen';
    return '<tr><td class="fw-700 border-bottom-muted"><span class="master-jab-badge">'+j.lbl+'</span></td>'
      +'<td class="font-11 text-muted border-bottom-muted">'+j.ket+'</td>'
      +'<td class="border-bottom-muted"><select class="w-full font-11 comp-inp" id="ap-mode-'+j.key+'" onchange="onApModeChange(\''+j.key+'\')">'+MODE_OPTS+'</select></td>'
      +'<td class="border-bottom-muted"><div class="fl items-center gap-xs"><span class="u-muted-11" id="ap-pfx-'+j.key+'">'+(rule.mode==='persen'?'%':rule.mode==='nominal'?'Rp':'')+'</span><input class="w-full font-12 comp-inp" type="number" id="ap-val-'+j.key+'" value="'+(rule.nilai||0)+'" style="display:'+(show?'block':'none')+'"></div></td></tr>';
  }).join('');
  JENIS_POT.forEach(function(j){var sel=document.getElementById('ap-mode-'+j.key);var rule=ap[j.key]||{mode:'prorata'};if(sel)sel.value=rule.mode;});
}
function onApModeChange(key){var mode=document.getElementById('ap-mode-'+key)&&document.getElementById('ap-mode-'+key).value;var el=document.getElementById('ap-val-'+key);var pfx=document.getElementById('ap-pfx-'+key);if(el)el.style.display=(mode==='nominal'||mode==='persen')?'block':'none';if(pfx)pfx.textContent=mode==='persen'?'%':mode==='nominal'?'Rp':'';}
function simpanAturanPotongan(){if(!perusahaan.aturan_potongan)perusahaan.aturan_potongan={};JENIS_POT.forEach(function(j){var mode=(document.getElementById('ap-mode-'+j.key)&&document.getElementById('ap-mode-'+j.key).value)||'prorata';var nilai=parseFloat((document.getElementById('ap-val-'+j.key)&&document.getElementById('ap-val-'+j.key).value))||0;perusahaan.aturan_potongan[j.key]={mode:mode,nilai:nilai};});saveAll();toast('Aturan potongan disimpan');renderPenggajian();}
function resetAturanPotongan(){perusahaan.aturan_potongan={cuti_dalam_kuota:{mode:'tidak_dipotong',nilai:0},cuti_luar_kuota:{mode:'prorata',nilai:0},izin:{mode:'prorata',nilai:0},sakit:{mode:'prorata',nilai:0},setengah_sakit:{mode:'prorata_setengah',nilai:0},setengah_ijin:{mode:'prorata_setengah',nilai:0},alpha:{mode:'prorata',nilai:0}};saveAll();loadAturanPotongan();toast('Reset ke default');}
// ── NOTIFIKASI ───────────────────────────────────
function renderNotif(){
  if(typeof sigajiWithSkeleton==='function'){
    return sigajiWithSkeleton('notif-list',1,renderNotifBody);
  }
  renderNotifBody();
}
function renderNotifBody(){
  var el=document.getElementById('notif-list');if(!el)return;
  el.innerHTML=notifikasi.length?notifikasi.map(function(n){
    return '<div class="notif-item'+(n.read?'':' notif-unread')+'">'+
      '<span class="notif-dot" aria-hidden="true"></span>'+
      '<div class="notif-body"><div class="notif-title">'+n.title+'</div><div class="notif-text">'+n.body+'</div></div>'+
      '<button type="button" class="btn btn-sm btn-r"'+sigajiDataAction('hapus-notif',{id:n.id})+' aria-label="Hapus">&#10007;</button></div>';
  }).join(''):'<div class="notif-empty">Belum ada notifikasi</div>';
}
function hapusNotif(id){notifikasi=notifikasi.filter(function(n){return n.id!==id;});saveAll();renderNotif();updateNotifBadge();}
function hapusNotifSemua(){
  var n=(notifikasi||[]).length;
  var go=typeof sigajiConfirmBulkDelete==='function'
    ?sigajiConfirmBulkDelete({title:'Hapus semua notifikasi',count:n,noun:'notifikasi',okText:'Ya, hapus semua'})
    :sigajiConfirm({title:'Hapus semua notifikasi',message:'Hapus '+n+' notifikasi?',danger:true,okText:'Ya, hapus semua'});
  Promise.resolve(go).then(function(ok){
    if(!ok)return;
    notifikasi=[];saveAll();renderNotif();updateNotifBadge();toast(n+' notifikasi dihapus');
  });
}
function markAllRead(){notifikasi.forEach(function(n){n.read=true;});saveAll();renderNotif();updateNotifBadge();}
function updateNotifBadge(){var u=notifikasi.filter(function(n){return !n.read;}).length;var d=document.getElementById('ndot');if(d)d.className=u>0?'ndot on':'ndot';var b=document.getElementById('nc-badge');if(b){b.style.display=u>0?'inline':'none';b.textContent=u;}}
// ── MY CUTI ──────────────────────────────────────
function renderMyCuti(){
  if(!CU||!CU.nik)return;var k=karyawan.find(function(x){return x.nik===CU.nik;});if(!k)return;
  var yr=new Date().getFullYear();
  var kuota=masterCuti.kuota||12;
  var manual=cutiManual(k.nik,yr);var cb=countCutiBersama(yr);var total=manual+cb;
  var sisa=kuota-total;
  var sisaCls=sisa<=0?'cuti-sisa-danger':sisa<=3?'cuti-sisa-warn':'cuti-sisa-ok';
  var cutiDays=Object.entries(absensi[k.nik]||{}).filter(function(e){return e[1]==='cuti'&&e[0].startsWith(String(yr));}).sort();
  var html='<div class="card card-surface-purple"><div class="fl-between-wrap"><div><strong class="font-14 ct-purple">Saldo Cuti '+String(yr)+' - '+escapeHtml(k.nama)+'</strong></div><div class="fl gap2"><div class="text-center"><div class="font-22 fw-800 ct-purple">'+String(kuota)+'</div><div class="u-muted-10">Kuota</div></div><div class="text-center"><div class="font-22 fw-800 ct-warn">'+String(manual)+'</div><div class="u-muted-10">Cuti Manual</div></div>'+(cb>0?'<div class="text-center"><div class="font-22 fw-800 ct-purple">'+String(cb)+'</div><div class="u-muted-10">Cuti Bersama</div></div>':'')+'<div class="text-center"><div class="font-22 fw-800 '+sisaCls+'">'+String(sisa)+'</div><div class="u-muted-10">Sisa</div></div></div></div></div><div class="card"><div class="ct">Riwayat Cuti '+String(yr)+'</div>'+(cutiDays.length?'<table class="sigaji-table"><thead><tr><th>Tanggal</th><th>Status</th></tr></thead><tbody>'+cutiDays.map(function(e){return '<tr><td>'+escapeHtml(e[0])+'</td><td><span class="bdg b-pu">Cuti</span></td></tr>';}).join('')+'</tbody></table>':'<div class="text-muted font-12">Belum ada cuti.</div>')+'</div>';
  document.getElementById('my-cuti-content').innerHTML=html;
}
// ── SELECTS & BACKUP ─────────────────────────────
function populateSelects(){
  var pid=document.getElementById('slip-per')&&document.getElementById('slip-per').value;
  var p=periodesFindById(pid)||PA();
  var list=karyawanListPeriode(p);
  var opts=list.map(function(k){return '<option value="'+escapeAttr(k.nik)+'">'+escapeHtml(k.nik)+' — '+escapeHtml(k.nama)+'</option>';}).join('');
  var sc=document.getElementById('slip-kar');
  if(sc){
    var html='<option value="">-- Pilih Karyawan --</option>'+opts;
    sc.innerHTML=html;
    if(sc.value&&!list.find(function(k){return k.nik===sc.value;}))sc.value='';
    renderSlipSendBatchChecklist();
  }
  var simNik=document.getElementById('sim-nik');
  if(simNik){
    var cur=simNik.value;
    var h='<option value="">Semua karyawan</option>'+opts;
    simNik.innerHTML=h;
    if(cur&&list.find(function(k){return k.nik===cur;}))simNik.value=cur;
  }
}
function renderPeriodeSelects(){
  var aktif = PA().id;
  var sorted=typeof periodesSortedByStart==='function'?periodesSortedByStart():periodes;
  var opts = sorted
    .map(function (p) {
      return '<option value="' + escapeAttr(String(p.id)) + '">' + escapeHtml(p.nama) + '</option>';
    })
    .join('');
  var slipEl = document.getElementById('slip-per');
  var prevSlip = slipEl && slipEl.value;
  ['slip-per', 'my-period'].forEach(function (id) {
    var el = document.getElementById(id);
    if (!el) return;
    var html = opts;
    el.innerHTML = html;
    if (id === 'slip-per') {
      if (prevSlip && periodes.some(function (p) { return String(p.id).trim() === String(prevSlip).trim(); })) {
        var keep = periodesFindById(prevSlip);
        el.value = keep ? String(keep.id) : String(prevSlip).trim();
      } else el.value = String(aktif);
    } else el.value = String(aktif);
  });
}
var DATA_KEYS=['karyawan','periodes','hariLibur','masterCuti','absensi','lembur','prorata','approvals','notifikasi','perusahaan','users','roles','thrManual','tunjVarBulan','tunjVarLabels','tunjVarColumns','karSnapshot','auditLog'];
var DATA_LABELS={karyawan:'Karyawan',periodes:'Periode',hariLibur:'Hari Libur',masterCuti:'Setting Cuti',absensi:'Absensi',lembur:'Lembur',prorata:'Pro-Rata',approvals:'Approval',notifikasi:'Notifikasi',perusahaan:'Perusahaan',users:'Users',roles:'Roles',thrManual:'THR Manual',tunjVarBulan:'Tunjangan variabel per periode',tunjVarLabels:'Label kolom tunj. variabel',tunjVarColumns:'Definisi kolom tunj. variabel',karSnapshot:'Snapshot karyawan per periode',auditLog:'Audit trail payroll'};
/** Salinan dalam memori agar backup identik dengan data tersimpan & tidak ada field yang terpotong */
function sigajiDeepClone(o){try{if(o===undefined)return undefined;return JSON.parse(JSON.stringify(o));}catch(e){console.warn('sigajiDeepClone',e);return o;}}
function buildExportData(){
  saveAll();
  var snapPeriods=Object.keys(karSnapshot||{});
  var snapRows=snapPeriods.reduce(function(s,pn){return s+Object.keys((karSnapshot&&karSnapshot[pn])||{}).length;},0);
  var meta={
    versi:typeof SIGAJI_APP_LABEL!=='undefined'?SIGAJI_APP_LABEL:'SiGaji v10',
    schemaVersion:typeof SCHEMA_VERSION!=='undefined'?SCHEMA_VERSION:3,
    tanggal:new Date().toISOString(),
    catatan:(document.getElementById('backup-catatan')&&document.getElementById('backup-catatan').value)||'',
    totalKaryawan:karyawan.length,
    periodeAktif:PA().nama,
    snapshotPeriodeCount:snapPeriods.length,
    snapshotRowCount:snapRows,
    blokData:DATA_KEYS.slice(),
    keterangan:'Backup lengkap semua komponen basis data lokal (setara isi sigaji_db)'
  };
  return{
    _meta:meta,
    karyawan:sigajiDeepClone(karyawan),
    periodes:sigajiDeepClone(periodes),
    hariLibur:sigajiDeepClone(hariLibur),
    masterCuti:sigajiDeepClone(masterCuti),
    absensi:sigajiDeepClone(absensi),
    lembur:sigajiDeepClone(lembur),
    prorata:sigajiDeepClone(prorata),
    approvals:sigajiDeepClone(approvals),
    notifikasi:sigajiDeepClone(notifikasi),
    perusahaan:sigajiDeepClone(perusahaan),
    users:sigajiDeepClone(users),
    roles:sigajiDeepClone(roles),
    thrManual:sigajiDeepClone(thrManual),
    tunjVarBulan:sigajiDeepClone(tunjVarBulan),
    tunjVarLabels:sigajiDeepClone(tunjVarLabels),
    tunjVarColumns:sigajiDeepClone(tunjVarColumns),
    karSnapshot:sigajiDeepClone(karSnapshot||{}),
    auditLog:sigajiDeepClone(auditLog||[])
  };
}
function exportBackup(){var data=buildExportData();var json=JSON.stringify(data,null,2);var blob=new Blob([json],{type:'application/json;charset=utf-8'});var a=document.createElement('a');var fn=((document.getElementById('backup-filename')&&document.getElementById('backup-filename').value)||'SiGaji_Backup').trim();var tgl=new Date().toISOString().split('T')[0];a.href=URL.createObjectURL(blob);a.download=fn+'_'+tgl+'.json';a.click();simpanRiwayatBackup(data._meta);var inf=document.getElementById('backup-info');if(inf)inf.textContent='Backup lengkap diunduh ('+DATA_KEYS.length+' jenis data, '+data._meta.totalKaryawan+' karyawan, snapshot '+(data._meta.snapshotPeriodeCount||0)+' periode / '+(data._meta.snapshotRowCount||0)+' baris): '+a.download;toast('Backup lengkap diunduh');}
function sigajiIsAdminOrHrd(){
  return !!(CU&&(CU.role==='Admin'||CU.role==='HRD'));
}
function sigajiCloudBackupAvailable(){
  if(typeof sigajiIsCloudConfigured==='function'&&sigajiIsCloudConfigured())return true;
  if(window.sigajiSupabase)return true;
  if(window.sigajiCloudOnlyMode)return true;
  return false;
}
function sigajiUpdateCloudBackupUi(){
  var staff=sigajiIsAdminOrHrd();
  var btn=document.getElementById('btn-cloud-db-export');
  var wrap=document.getElementById('backup-exclude-logo-wrap');
  if(btn)btn.style.display=staff?'inline-block':'none';
  if(wrap)wrap.style.display=staff?'flex':'none';
}
async function exportCloudDatabaseBackup(){
  var inf=document.getElementById('backup-info');
  var btn=document.getElementById('btn-cloud-db-export');
  try{
    if(inf)inf.textContent='Memproses backup database cloud…';
    toast('Memproses backup database…');
    if(btn){btn.disabled=true;btn.textContent='Mengunduh…';}
    if(window.sigajiCloudBootPromise){
      try{await window.sigajiCloudBootPromise;}catch(eBoot){console.warn(eBoot);}
    }
    if(!sigajiIsAdminOrHrd()){toast('Hanya Admin/HRD');if(inf)inf.textContent='';return;}
    if(!sigajiCloudBackupAvailable()&&!window.sigajiSupabase){
      toast('Mode cloud belum aktif — pastikan config.js di server & login email Supabase');
      if(inf)inf.textContent='Cloud belum aktif (config.js / login).';
      return;
    }
    if(!window.sigajiSupabase){
      toast('Supabase belum siap — tunggu beberapa detik lalu coba lagi');
      if(inf)inf.textContent='Menunggu koneksi Supabase…';
      return;
    }
    if(location.protocol==='file:'){
      toast('Backup cloud butuh situs https (Cloudflare), bukan file:// lokal');
      if(inf)inf.textContent='Buka lewat https://www.cemerlang.online';
      return;
    }
    var sess=await window.sigajiSupabase.auth.getSession();
    if(!sess.data||!sess.data.session){
      toast('Login dengan email Supabase (bukan login cepat lokal)');
      if(inf)inf.textContent='Belum ada sesi cloud.';
      return;
    }
    var ex=document.getElementById('backup-exclude-logo');
    var q=ex&&ex.checked?'?exclude_logo=1':'';
    var apiBase=typeof sigajiFunctionUrl==='function'?sigajiFunctionUrl('backup-database-export'):'/api/backup-database-export';
    var apiUrl=apiBase+q;
    if(inf)inf.textContent='Menghubungi server backup…';
    var r=await fetch(apiUrl,{headers:{authorization:'Bearer '+sess.data.session.access_token}});
    var text=await r.text();
    if(!r.ok){
      var errMsg=text;
      try{var ej=JSON.parse(text);if(ej&&ej.error)errMsg=ej.error;}catch(eJ){sigajiCatchWarn("js/modules/app-master.js",eJ);}
      if(r.status===404)errMsg='API backup belum deploy — push functions/api/backup-database-export.js + env Cloudflare';
      else if(/<html class="fl justify-between items-center p-inset-xs rounded-sm mb-sm font-12"/i.test(text))errMsg='API mengembalikan HTML (bukan JSON) — cek /api/backup-database-export di deploy';
      toast('Gagal: '+errMsg);
      if(inf)inf.textContent='Error: '+errMsg;
      return;
    }
    var disp=r.headers.get('content-disposition')||'';
    var m=/filename="([^"]+)"/i.exec(disp);
    var fn=m?m[1]:'Sigaji_DB_Export_'+new Date().toISOString().split('T')[0]+'.json';
    var a=document.createElement('a');
    a.href=URL.createObjectURL(new Blob([text],{type:'application/json;charset=utf-8'}));
    a.download=fn;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(a.href);
    var detail='';
    try{
      var parsed=JSON.parse(text);
      if(parsed&&parsed._meta&&parsed._meta.row_counts)detail=' — '+JSON.stringify(parsed._meta.row_counts);
    }catch(eP){sigajiCatchWarn("js/modules/app-master.js",eP);}
    if(inf)inf.textContent='Backup database cloud: '+fn+' ('+Math.round(text.length/1024)+' KB)'+detail;
    toast('Backup database diunduh — cek folder Downloads');
  }catch(e){
    console.error('exportCloudDatabaseBackup',e);
    toast('Gagal: '+(e.message||e));
    if(inf)inf.textContent='Gagal: '+(e.message||e);
  }finally{
    if(btn){btn.disabled=false;btn.innerHTML='&#9729; Unduh backup database (cloud)';}
  }
}
if(typeof window!=='undefined')window.exportCloudDatabaseBackup=exportCloudDatabaseBackup;
function simpanRiwayatBackup(meta){try{var r=JSON.parse(localStorage.getItem('sigaji_backup_riwayat')||'[]');r.unshift(Object.assign({},meta,{tanggalDisplay:new Date().toLocaleString('id-ID')}));r=r.slice(0,3);localStorage.setItem('sigaji_backup_riwayat',JSON.stringify(r));}catch(e){sigajiCatchWarn("js/modules/app-master.js",e);}}
function renderBackupRiwayat(){try{var r=JSON.parse(localStorage.getItem('sigaji_backup_riwayat')||'[]');var el=document.getElementById('backup-riwayat');if(!el)return;el.innerHTML=r.length?r.map(function(x,i){return '<div class="border-default'+(i===0?' backup-latest-row':'')+'"><div><div class="fw-700">'+(x.tanggalDisplay||x.tanggal)+'</div><div class="u-muted-10">'+(x.versi||'SiGaji')+' - '+(x.totalKaryawan||'?')+' karyawan'+(x.catatan?' - "'+x.catatan+'"':'')+'</div></div>'+(i===0?'<span class="bdg b-ok">Terakhir</span>':'')+'</div>';}).join(''):'<div class="font-12 text-muted p-empty-sm">Belum ada.</div>';}catch(e){sigajiCatchWarn("js/modules/app-master.js",e);}}
function renderAuditLog(){
  var wrap=document.getElementById('audit-log');
  var sel=document.getElementById('audit-periode');
  if(!wrap||!sel)return;
  var q=(document.getElementById('audit-q')&&document.getElementById('audit-q').value||'').toLowerCase();
  // isi opsi periode
  var perList=['(Semua)'].concat((typeof periodesSortedByStart==='function'?periodesSortedByStart():periodes||[]).map(function(p){return p.nama;}));
  if(!sel.options.length){
    sel.innerHTML=perList.map(function(n){return '<option value="'+n+'">'+n+'</option>';}).join('');
    sel.value='(Semua)';
  }
  var pPick=sel.value||'(Semua)';
  var list=(auditLog||[]).filter(function(e){
    if(pPick!=='(Semua)'&&e.periode!==pPick)return false;
    if(!q)return true;
    var s=(e.ts+' '+e.periode+' '+e.nik+' '+e.by+' '+e.action+' '+e.detail).toLowerCase();
    return s.indexOf(q)>=0;
  }).slice(0,200);
  if(!list.length){
    wrap.innerHTML=typeof sigajiEmptyState==='function'?sigajiEmptyState({icon:'&#128221;',title:'Belum ada jejak audit',desc:'Perubahan komponen gaji, tunjangan, dan potongan akan tercatat otomatis.',btnLabel:'Buka Komponen Gaji',btnAction:'showPg',btnActionArg:'kompgaji'}):'<div class="text-muted font-12" style="padding:12px">Belum ada audit log.</div>';
    return;
  }
  wrap.innerHTML='<div class="sigaji-audit-timeline-inner">'+list.map(function(e,idx){
    var t=typeof sigajiFmtAuditTimeline==='function'?sigajiFmtAuditTimeline(e):escapeHtml(e.action||'-');
    var ts=typeof sigajiFmtAuditTimeline==='function'&&e.ts?new Date(e.ts).toLocaleString('id-ID',{day:'numeric',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'}):String(e.ts||'').replace('T',' ').substring(0,16);
    return '<div class="sigaji-audit-item'+(idx===0?' is-latest':'')+'">'
      +'<div class="sigaji-audit-dot" aria-hidden="true"></div>'
      +'<div class="sigaji-audit-body">'
      +'<div class="sigaji-audit-line">'+t+'</div>'
      +'<div class="sigaji-audit-meta">'
      +'<span class="bdg b-gray">'+escapeHtml(e.periode||'-')+'</span> '
      +'<span>'+escapeHtml(ts)+'</span>'
      +(e.role?(' · <span class="text-subtle">'+escapeHtml(e.role)+'</span>'):'')
      +'</div></div></div>';
  }).join('')+'</div>';
}
function renderMigrationStatus(){
  var el=document.getElementById('migration-status');
  if(!el)return;
  var pers=periodes||[];
  var totalPer=pers.length;
  var aktifPer=0;
  var totalRows=0;
  var totalExpected=0;
  var snap=karSnapshot||{};
  pers.forEach(function(p){
    var pn=(p&&p.nama)||'';
    var ps=(p&&p.start)||'';
    if(!pn||!ps)return;
    var list=karyawanListPeriode(p);
    var exp=list.length;
    var got=Object.keys((snap[pn]||{})).length;
    totalExpected+=exp;
    totalRows+=got;
    if(exp>0&&got>=exp)aktifPer++;
  });
  var pct=totalExpected>0?Math.min(100,Math.round((totalRows/totalExpected)*100)):100;
  var html=
    '<div class="fl flex-wrap gap-sm mb-sm">'
    +'<span class="bdg b-info">Periode: '+String(totalPer)+'</span>'
    +'<span class="bdg '+(pct===100?'b-ok':'b-warn')+'">Progress: '+String(pct)+'%</span>'
    +'<span class="bdg b-pu">Snapshot rows: '+String(totalRows)+'</span>'
    +'<span class="bdg b-teal">Expected rows: '+String(totalExpected)+'</span>'
    +'</div>'
    +'<div class="u-muted-11">Periode lengkap: '+String(aktifPer)+'/'+String(totalPer)+'. Periode dianggap lengkap jika seluruh karyawan aktif di periode tersebut punya snapshot payroll.</div>';
  el.innerHTML=html;
}
var importData=null;
function readImportFile(input){var f=input.files[0];if(!f)return;var r=new FileReader();r.onload=function(e){try{var data=JSON.parse(e.target.result);importData=data;var meta=data._meta||{};var el=document.getElementById('import-info');var html='';if(el){html='<strong>File:</strong> '+escapeHtml(meta.versi||'SiGaji')+' - '+String((data.karyawan||[]).length)+' karyawan'+(meta.snapshotPeriodeCount!=null?' | snapshot '+String(meta.snapshotPeriodeCount)+' periode / '+String(meta.snapshotRowCount||0)+' baris':'');el.innerHTML=html;}var cl=document.getElementById('import-checklist');if(cl){html=DATA_KEYS.map(function(k){var ada=data[k]!==undefined;return '<label class="fl items-center gap-xs font-12" style="cursor:'+(ada?'pointer':'default')+'; opacity:'+(ada?1:.4)+'"><input class="chk-brand" type="checkbox" id="imp-'+escapeAttr(k)+'" '+(ada?'checked':'')+' '+(ada?'':'disabled')+'> '+escapeHtml(DATA_LABELS[k]||k)+'</label>';}).join('');cl.innerHTML=html;}document.getElementById('import-preview').style.display='block';toast('File dibaca');}catch(err){toast('Gagal baca file: '+err.message);}};r.readAsText(f);}
/** Import: salin utuh tanpa membuang field (thr_ikut, tgl_berhenti, natura.kp, dll.). */
function normalisasiData(key,val){
  var v=sigajiDeepClone(val);
  if(v===undefined)return v;
  if(key==='karyawan')return Array.isArray(v)?v:[];
  return v;
}
function eksekusiImport(){
  if(!importData){toast('Pilih file dulu');return;}
  var mode=document.getElementById('import-mode').value;
  var dipilih=DATA_KEYS.filter(function(k){return document.getElementById('imp-'+k)&&document.getElementById('imp-'+k).checked;});
  if(!dipilih.length){toast('Pilih minimal satu');return;}
  if(mode==='overwrite'&&!confirm('Semua data akan DITIMPA. Lanjutkan?'))return;
  dipilih.forEach(function(k){
    if(importData[k]===undefined)return;
    var val=normalisasiData(k,importData[k]);
    if(mode==='merge'){
      if(k==='karyawan'){var ex=karyawan.map(function(x){return x.nik;});var baru=val.filter(function(x){return !ex.includes(x.nik);});var upd=val.filter(function(x){return ex.includes(x.nik);});var baruAktif=baru.filter(function(x){return !String((x&&x.tgl_berhenti)||'').trim();});if(typeof sigajiCanAddActiveEmployees==='function'){var chk=sigajiCanAddActiveEmployees(baruAktif.length);if(!chk.ok){toast(chk.message);return;}}upd.forEach(function(nk){var i=karyawan.findIndex(function(x){return x.nik===nk.nik;});if(i>=0)karyawan[i]=Object.assign({},karyawan[i],nk);});karyawan.push.apply(karyawan,baru);if(typeof sigajiSortKaryawanByNik==='function')karyawan=sigajiSortKaryawanByNik(karyawan);}
      else if(k==='periodes'){var en=periodes.map(function(x){return x.nama;});periodes.push.apply(periodes,val.filter(function(x){return !en.includes(x.nama);}));}
      else if(k==='hariLibur'){var et=hariLibur.map(function(x){return x.tgl;});hariLibur.push.apply(hariLibur,val.filter(function(x){return !et.includes(x.tgl);}));}
      else if(k==='absensi'||k==='lembur'||k==='prorata'){var cur=k==='absensi'?absensi:k==='lembur'?lembur:prorata;Object.keys(val).forEach(function(n){if(!cur[n])cur[n]=val[n];else Object.assign(cur[n],val[n]);});}
      else if(k==='karSnapshot'){if(!karSnapshot)karSnapshot={};Object.keys(val||{}).forEach(function(pn){if(!karSnapshot[pn])karSnapshot[pn]={};Object.assign(karSnapshot[pn],val[pn]||{});});}
      else if(k==='auditLog'){if(!auditLog)auditLog=[];auditLog=(auditLog||[]).concat(val||[]).slice(0,3000);}
      else if(k==='tunjVarColumns'&&Array.isArray(val))tunjVarColumns=val;
      else if(typeof val==='object'&&!Array.isArray(val)){var cur2=k==='masterCuti'?masterCuti:k==='perusahaan'?perusahaan:k==='roles'?roles:k==='tunjVarBulan'?tunjVarBulan:k==='tunjVarLabels'?tunjVarLabels:{};Object.assign(cur2,val);}
    }else{
      if(k==='karyawan')karyawan=val;else if(k==='periodes')periodes=val;else if(k==='hariLibur')hariLibur=val;else if(k==='masterCuti')masterCuti=val;else if(k==='absensi')absensi=val;else if(k==='lembur')lembur=val;else if(k==='prorata')prorata=val;else if(k==='approvals')approvals=val;else if(k==='notifikasi')notifikasi=val;else if(k==='perusahaan')perusahaan=val;else if(k==='users')users=val;else if(k==='roles')roles=val;else if(k==='thrManual')thrManual=val;else if(k==='tunjVarBulan')tunjVarBulan=val;else if(k==='tunjVarLabels')tunjVarLabels=val;else if(k==='tunjVarColumns')tunjVarColumns=val;else if(k==='karSnapshot')karSnapshot=val||{};else if(k==='auditLog')auditLog=val||[];
    }
  });
  if(dipilih.indexOf('roles')>=0&&typeof window.sigajiMigrateRolePerms==='function')window.sigajiMigrateRolePerms(roles);
  saveAll();renderAll();updateNotifBadge();applyBranding();renderSidebar();toast('Import selesai');
  document.getElementById('import-preview').style.display='none';importData=null;
  var inp=document.getElementById('import-file-input');if(inp)inp.value='';
}
function exportCSVAll(){var rows=[['NIK','Nama','Dept','Jabatan','Gaji Pokok','Gross PPh','THR','TH Bruto','BPJS Kar','PPh 21','Neto','PTKP','Status','Tgl Masuk']];sortKaryawanByNik(karyawan||[]).forEach(function(k){var g=hitungGaji(k);rows.push([k.nik,k.nama,k.dept,k.jabatan,k.gapok,Math.round(g.grossPPh),Math.round(g.thrBruto),Math.round(g.brutoTH),Math.round(g.bpjs.kes_kar+g.bpjs.jht_kar+g.bpjs.jp_kar),g.pph,Math.round(g.neto),k.ptkp,k.status,k.masuk]);});var csv=rows.map(function(r){return r.map(function(v){return '"'+String(v).replace(/"/g,'""')+'"';}).join(',');}).join('\n');var b=new Blob(['\uFEFF'+csv],{type:'text/csv'});var a=document.createElement('a');a.href=URL.createObjectURL(b);a.download='SiGaji_v10_'+new Date().toISOString().split('T')[0]+'.csv';a.click();toast('CSV diunduh');}
