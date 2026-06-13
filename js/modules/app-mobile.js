/* SiGaji — mobile absensi API (web HRD + Cuti Saya) */
function sigajiBrandColor(){
  try{
    var v=getComputedStyle(document.documentElement).getPropertyValue('--color-primary').trim();
    return v||'#1a56a0';
  }catch(e){return '#1a56a0';}
}
function sigajiMobileApiUrl(name){
  return typeof sigajiFunctionUrl==='function'?sigajiFunctionUrl(name):'/api/'+name;
}
async function sigajiMobileFetch(name,opts){
  opts=opts||{};
  var t=typeof getCloudAccessToken==='function'?await getCloudAccessToken():'';
  if(!t){toast('Login cloud diperlukan');return null;}
  var headers=Object.assign({'authorization':'Bearer '+t},opts.headers||{});
  if(opts.body&&!(opts.body instanceof FormData))headers['content-type']='application/json';
  var r=await fetch(sigajiMobileApiUrl(name),{
    method:opts.method||(opts.body?'POST':'GET'),
    headers:headers,
    body:opts.body?(opts.json!==false?JSON.stringify(opts.body):opts.body):undefined
  });
  return typeof sigajiParseFunctionJson==='function'?await sigajiParseFunctionJson(r):await r.json().catch(function(){return null;});
}
var _mobMapPicker=null;
var _mobLocEditId=null;
function mobFmtDistanceM(m){
  m=Math.round(Number(m)||0);
  if(m>=1000){var km=m/1000;return (km>=10?Math.round(km):Math.round(km*10)/10)+' km';}
  return m+' m';
}
function mobAuditHtml(flags){
  if(!flags||!flags.decided_at)return '';
  var who=flags.decided_by_name||flags.decided_by||'HRD';
  var note=flags.review_note?(' — '+escapeHtml(flags.review_note)):'';
  return '<div class="font-10 text-muted mt-2px">Audit: '+escapeHtml(who)+' · '+mobFmtTimeIso(flags.decided_at)+note+'</div>';
}
async function sigajiUploadMobileFile(file,subfolder){
  if(!file)return null;
  var t=typeof getCloudAccessToken==='function'?await getCloudAccessToken():'';
  if(!t){toast('Login cloud diperlukan');return null;}
  var fd=new FormData();
  var name=file.name||'photo.jpg';
  if(!/\.(jpe?g|png|webp|heic|pdf)$/i.test(name)){
    name=(file.type||'').indexOf('pdf')>=0?'surat.pdf':'photo.jpg';
  }
  fd.append('file',file,name);
  fd.append('subfolder',subfolder||'leave');
  try{
    var r=await fetch(sigajiMobileApiUrl('mobile-upload'),{method:'POST',headers:{authorization:'Bearer '+t},body:fd});
    var j=typeof sigajiParseFunctionJson==='function'?await sigajiParseFunctionJson(r):await r.json().catch(function(){return null;});
    if(j&&j.ok&&j.path)return j.path;
    toast('Upload gagal: '+((j&&j.error)||r.status));
    return null;
  }catch(e){
    toast('Upload gagal: '+(e.message||e));
    return null;
  }
}
// ── HRD: Log check-in / check-out ─────────────────
function mobAttStatusLbl(st,flags){
  if(st==='rejected'&&flags&&flags.fail_code==='mock_gps'){
    return '<span class="bdg b-err">GPS mock</span>';
  }
  var map={ok:['OK','b-teal'],pending_review:['Review','b-warn'],outside_geofence:['Luar radius','b-err'],rejected:['Ditolak','b-err']};
  var x=map[st]||[st||'-','b-gray'];
  return '<span class="bdg '+x[1]+'">'+x[0]+'</span>';
}
function mobFailDetailHtml(flags){
  if(!flags)return '';
  var parts=[];
  if(flags.nearest&&flags.nearest.nama){
    var dl=flags.nearest.distance_label||mobFmtDistanceM(flags.nearest.distance_m);
    var rl=flags.nearest.radius_label||mobFmtDistanceM(flags.nearest.radius_m);
    parts.push('Terdekat: <strong>'+escapeHtml(flags.nearest.nama)+'</strong> — '+escapeHtml(dl)+' (radius '+escapeHtml(rl)+')');
  }else if(flags.distance_m!=null){
    parts.push('Jarak: '+mobFmtDistanceM(flags.distance_m));
  }
  if(flags.fail_message)parts.push('<span class="text-muted">'+escapeHtml(String(flags.fail_message).substring(0,120))+'</span>');
  if(!parts.length)return '';
  return '<div class="font-10 ct-danger mt-2px leading-normal">'+parts.join('<br>')+'</div>';
}
function mobFmtTimeIso(iso){
  if(!iso)return '-';
  try{
    var d=new Date(iso);
    return d.toLocaleString('id-ID',{timeZone:'Asia/Jakarta',hour:'2-digit',minute:'2-digit',hour12:false});
  }catch(e){return String(iso).substring(11,16);}
}
function mobMapLink(lat,lon){
  if(lat==null||lon==null)return '';
  return ' <a class="font-10" href="https://www.google.com/maps?q='+lat+','+lon+'" target="_blank" rel="noopener">Peta</a>';
}
async function renderMobileAttendanceLog(btn){
  var el=document.getElementById('mob-att-log-wrap');if(!el)return;
  var today=new Date().toISOString().substring(0,10);
  var dateEl=document.getElementById('mob-log-date');
  var workDate=dateEl?dateEl.value:today;
  if(!dateEl){
    el.innerHTML='<div class="card"><div class="flb mb2 flex-wrap gap-sm">'
      +'<div class="ct m-0 border-0 p-0">Siapa sudah check-in / check-out</div>'
      +'<div class="fl gap1 items-center flex-wrap">'
      +'<label class="font-11 fw-700 text-muted">Tanggal:</label>'
      +'<input class="rounded-sm select-inline select-inline-bordered" type="date" id="mob-log-date" value="'+escapeAttr(today)+'">'
      +'<select class="rounded-sm select-inline select-inline-bordered" id="mob-log-filter" onchange="mobRenderLogFromCache()">'
      +'<option value="">Semua status</option><option value="ok">OK</option><option value="pending_review">Review</option>'
      +'<option value="outside_geofence">Luar radius</option><option value="rejected">Ditolak / mock</option></select>'
      +'<button type="button" class="btn btn-sm btn-out"'+sigajiDataAction('mob-att-log')+'>&#8635; Muat</button>'
      +'</div></div><div id="mob-log-table">Memuat…</div></div>';
    dateEl=document.getElementById('mob-log-date');
    workDate=dateEl?dateEl.value:today;
  }
  var host=document.getElementById('mob-log-table');
  var j=await sigajiMobileFetch('mobile-attendance?work_date='+encodeURIComponent(workDate),{method:'GET',loadingHost:host,loadingBtn:btn});
  if(!host)return;
  if(!j||!j.ok){
    host.innerHTML='<div class="info-box info-red">'+escapeHtml(j&&j.error||'Gagal memuat log — deploy API mobile-attendance GET')+'</div>';
    return;
  }
  window._mobLogItems=j.items||[];
  window._mobLogDate=workDate;
  mobRenderLogFromCache();
}
function mobLogRowPassesFilter(row,filter){
  if(!filter)return true;
  if(filter==='rejected')return row.validation_status==='rejected'||(row.flags&&row.flags.fail_code==='mock_gps')||row.is_mock;
  return row.validation_status===filter;
}
function mobRenderLogFromCache(){
  var host=document.getElementById('mob-log-table');if(!host)return;
  var items=window._mobLogItems||[];
  var workDate=window._mobLogDate||'';
  var filterEl=document.getElementById('mob-log-filter');
  var filter=filterEl?filterEl.value:'';
  if(!items.length){
    host.innerHTML=typeof sigajiEmptyState==='function'?sigajiEmptyState({icon:'&#128241;',title:'Belum ada absensi mobile',desc:'Tidak ada check-in/check-out pada tanggal '+workDate+'.',btnLabel:'Muat ulang',btnAction:'renderMobileAttendanceLog'}):'<p class="text-muted font-12" style="padding:.5rem 0">Belum ada check-in/check-out pada tanggal '+escapeHtml(workDate)+'.</p>';
    return;
  }
  var byNik={};
  items.forEach(function(row){
    if(!byNik[row.nik])byNik[row.nik]={nik:row.nik,cin:null,cout:null};
    if(row.event_type==='check_in')byNik[row.nik].cin=row;
    if(row.event_type==='check_out')byNik[row.nik].cout=row;
  });
  var nikList=Object.keys(byNik).filter(function(nik){
    var g=byNik[nik];
    if(!filter)return true;
    return mobLogRowPassesFilter(g.cin,filter)||mobLogRowPassesFilter(g.cout,filter);
  });
  if(typeof sortKaryawanByNik==='function'){
    nikList=sortKaryawanByNik(nikList.map(function(n){return{nik:n};})).map(function(x){return x.nik;});
  }else nikList.sort(function(a,b){return String(a).localeCompare(String(b),'id',{numeric:true});});
  function cell(r,label){
    if(!r)return '<span class="text-subtle">—</span>';
    var loc=r.location_nama?escapeHtml(r.location_nama):(r.validation_status==='outside_geofence'?'<span class="text-subtle">Di luar radius</span>':'<span class="text-subtle">—</span>');
    var decideBtns='';
    if(r.id){
      var idEsc=String(r.id).replace(/'/g,"\\'");
      if(r.validation_status==='pending_review'||r.validation_status==='outside_geofence'){
        decideBtns='<div class="fl gap1 mt-xs">'
          +'<button type="button" class="btn btn-xs btn-g"'+sigajiDataAction('mob-attendance-decide',{id:r.id,decision:'approve'})+'>Setujui</button>'
          +'<button type="button" class="btn btn-xs btn-r"'+sigajiDataAction('mob-attendance-decide',{id:r.id,decision:'reject'})+'>Tolak</button></div>';
      }else if(r.validation_status==='ok'){
        decideBtns='<div class="fl gap1 mt-xs flex-wrap">'
          +'<button type="button" class="btn btn-xs btn-r"'+sigajiDataAction('mob-attendance-decide',{id:r.id,decision:'reject'})+'>Tolak (salah lokasi)</button>'
          +'<span class="u-muted-10">Sudah OK GPS — tolak bila lokasi/penugasan salah</span></div>';
      }else if(r.validation_status==='rejected'){
        decideBtns='<div class="font-10 ct-danger mt-2px">Karyawan dapat absen ulang di HP</div>';
      }
    }
    var faceBadge=r.face_verified?' <span class="bdg b-teal">Wajah OK</span>':'';
    if(r.face_verified&&r.face_score!=null)faceBadge+=' <span class="text-muted font-10">'+Math.round(r.face_score*100)+'%</span>';
    var distBadge='';
    var distM=r.flags&&r.flags.distance_m!=null?r.flags.distance_m:r.distance_m;
    if(distM!=null)distBadge=' <span class="text-muted font-10" title="Jarak ke lokasi">'+mobFmtDistanceM(distM)+'</span>';
    var accBadge=mobGpsAccBadge(r.accuracy_m);
    return '<div class="font-11"><strong>'+label+'</strong> '+mobFmtTimeIso(r.created_at)+' '+accBadge+'<br>'+loc+mobMapLink(r.lat,r.lon)+distBadge+'<br>'+mobAttStatusLbl(r.validation_status,r.flags)+faceBadge+(r.is_mock?' <span class="bdg b-warn">GPS mock?</span>':'')+mobFailDetailHtml(r.flags)+decideBtns+mobAuditHtml(r.flags)+'</div>';
  }
  var rows=nikList.map(function(nik){
    var g=byNik[nik];
    var k=(karyawan||[]).find(function(x){return x&&x.nik===nik;});
    var nama=k?(k.nama+' <span class="text-subtle" style="font-weight:400">('+nik+')</span>'):nik;
    var st='';
    if(g.cin&&g.cout)st='<span class="bdg b-teal">Lengkap</span>';
    else if(g.cin)st='<span class="bdg b-warn">Belum check-out</span>';
    else st='<span class="bdg b-gray">—</span>';
    return '<tr><td>'+nama+'</td><td>'+cell(g.cin,'Masuk')+'</td><td>'+cell(g.cout,'Pulang')+'</td><td>'+st+'</td></tr>';
  }).join('');
  var cards=nikList.map(function(nik){
    var g=byNik[nik];
    var k=(karyawan||[]).find(function(x){return x&&x.nik===nik;});
    var nama=k?k.nama:nik;
    return '<div class="mob-log-card"><h4>'+escapeHtml(nama)+' <span class="text-subtle" style="font-weight:400">'+escapeHtml(nik)+'</span></h4>'
      +'<div class="mob-log-ev">'+cell(g.cin,'Masuk')+'</div><div class="mob-log-ev">'+cell(g.cout,'Pulang')+'</div></div>';
  }).join('');
  var h='<div class="mob-log-table-desktop"><table><thead><tr><th>Karyawan</th><th>Check-in</th><th>Check-out</th><th>Status hari</th></tr></thead><tbody>'
    +(rows||'<tr><td class="text-center text-subtle" colspan="4">Tidak ada data untuk filter ini</td></tr>')
    +'</tbody></table></div><div class="mob-log-cards">'+cards+'</div>'
    +'<div class="info-box font-11 leading-tight" style="margin-top:.65rem">'
    +'<strong>Status log absensi</strong><ul class="p-0" style="margin:.35rem 0 0 1rem">'
    +'<li><span class="bdg b-teal">OK</span> — dalam radius; <em>Tolak</em> bila penugasan/koordinat salah</li>'
    +'<li><span class="bdg b-warn">Review</span> — GPS kurang akurat (±80 m) → <em>Setujui</em> atau <em>Tolak</em></li>'
    +'<li><span class="bdg b-err">Luar radius</span> — gagal geofence; tampil jarak ke lokasi terdekat</li>'
    +'<li><span class="bdg b-err">GPS mock / Ditolak</span> — percobaan gagal; karyawan bisa coba lagi di HP</li>'
    +'</ul></div>';
  host.innerHTML=h;
}
var _mobDecideBusy=false;
async function mobAttendanceDecide(id,decide){
  if(_mobDecideBusy){toast('Masih memproses…');return;}
  var note='';
  if(decide==='reject'){note=prompt('Alasan penolakan (opsional) — hanya event ini yang ditolak')||'';}
  else if(!confirm('Setujui absensi ini? Jika check-in & check-out sudah OK, kalender gaji akan diisi hadir.'))return;
  _mobDecideBusy=true;
  var r;
  try{
    r=await sigajiMobileFetch('mobile-attendance',{method:'POST',body:{action:'decide',id:id,decide:decide,note:note}});
  }finally{_mobDecideBusy=false;}
  if(r&&r.ok){
    toast(r.message||(decide==='approve'?'Disetujui':'Ditolak'));
    if(r.synced_hadir&&typeof renderAbsensi==='function')renderAbsensi();
    renderMobileAttendanceLog();
    return;
  }
  var err=(r&&r.error)||'Gagal';
  if(/Forbidden|Invalid auth|tidak terhubung/i.test(err))err+=' — login dengan email Admin/HRD yang tertaut di Manajemen User.';
  else if(/deploy|404|tidak aktif/i.test(err))err+=' — deploy ulang functions/api/mobile-attendance.js lalu Ctrl+F5.';
  toast(err);
}
// ── HRD: Lokasi kerja ───────────────────────────
async function renderMobileLocations(){
  var el=document.getElementById('mob-locations-wrap');if(!el)return;
  var html=typeof sigajiSkeleton==='function'?sigajiSkeleton('table'):'<div class="text-muted p-md">Memuat…</div>';
  el.innerHTML=html;
  var j=await sigajiMobileFetch('mobile-locations',{method:'GET'});
  if(!j||!j.ok){el.innerHTML='<div class="info-box info-red">'+escapeHtml(j&&j.error||'Gagal memuat lokasi — jalankan SQL mobile + deploy API')+'</div>';return;}
  var items=j.items||[];
  var rows=items.map(function(loc){
    var idEsc=String(loc.id).replace(/'/g,"\\'");
    return '<tr><td>'+escapeHtml(loc.nama)+'</td><td>'+escapeHtml(loc.tipe||'')+'</td>'
      +'<td><div id="mob-loc-mini-'+loc.id+'" class="mob-loc-mini" title="Peta lokasi"></div>'
      +'<div class="font-9 text-subtle mt-2px">'+loc.lat.toFixed(5)+', '+loc.lon.toFixed(5)+'</div></td>'
      +'<td>'+loc.radius_m+' m</td><td>'+(loc.aktif?'<span class="bdg b-teal">Aktif</span>':'<span class="bdg b-gray">Off</span>')+'</td>'
      +'<td><div class="fl gap1"><button class="btn btn-sm btn-out"'+sigajiDataAction('invoke',{fn:'editMobileLocation',arg:loc.id})+'>Edit</button><button class="btn btn-sm btn-r"'+sigajiDataAction('invoke',{fn:'deleteMobileLocation',arg:loc.id})+'>Hapus</button></div></td></tr>';
  }).join('');
  el.innerHTML='<div class="card"><div class="flb mb2"><div class="ct m-0 border-0 p-0">Lokasi check-in GPS</div><button class="btn btn-sm btn-p"'+sigajiDataAction('invoke',{fn:'editMobileLocation'})+'>+ Lokasi</button></div>'
    +'<table><thead><tr><th>Nama</th><th>Tipe</th><th>Peta</th><th>Radius</th><th>Status</th><th></th></tr></thead><tbody>'
    +(rows||'<tr><td colspan="6">'+(typeof sigajiEmptyState==='function'?sigajiEmptyState({icon:'&#128205;',title:'Belum ada lokasi GPS',desc:'Tambahkan lokasi kantor/site agar karyawan bisa check-in di APK.',btnLabel:'+ Tambah lokasi',btnAction:'editMobileLocation'}):'<span class="text-subtle">Belum ada lokasi</span>')+'</td></tr>')+'</tbody></table></div>';
  setTimeout(function(){mobInitLocationMiniMaps(items);},200);
}
async function deleteMobileLocation(id){
  if(!id)return;
  var ok=typeof sigajiConfirm==='function'
    ?await sigajiConfirm({title:'Hapus lokasi GPS',message:'Hapus lokasi ini? Jika masih ada penugasan karyawan ke lokasi ini, hapus penugasan di tab Penugasan dulu.',danger:true,okText:'Ya, hapus'})
    :confirm('Hapus lokasi GPS ini?');
  if(!ok)return;
  var r=await sigajiMobileFetch('mobile-locations',{method:'POST',body:{action:'delete_location',id:id}});
  if(r&&r.ok){toast('Lokasi dihapus');renderMobileLocations();}else toast((r&&r.error)||'Gagal menghapus lokasi');
}
function mobLocRadiusToSlider(radiusM){
  var m=parseInt(radiusM,10)||250;
  if(m<50)m=50;if(m>5000)m=5000;
  return m;
}
function mobLocSliderToRadius(v){
  return mobLocRadiusToSlider(v);
}
function mobLocRadiusHint(m){
  m=parseInt(m,10)||250;
  if(m>=200&&m<=300)return ' ≈ setengah lapangan bola';
  if(m>300&&m<=600)return ' ≈ 1 lapangan mini';
  return '';
}
function mobLocRadiusLabel(m){
  m=parseInt(m,10)||250;
  var lbl=mobFmtDistanceM(m);
  var hint=mobLocRadiusHint(m);
  if(hint)lbl+='<span class="ct-brand fw-600">'+hint+'</span>';
  if(m<100)return lbl+' <span class="mob-radius-warn">(sangat kecil — pastikan meter, bukan km)</span>';
  return lbl;
}
function mobGpsAccBadge(m){
  m=parseInt(m,10);
  if(!Number.isFinite(m))return '';
  var cls=m<=40?'good':m<=80?'mid':'bad';
  return '<span class="mob-gps-acc '+cls+'">±'+m+' m</span>';
}
function mobInitLocationMiniMaps(items){
  if(typeof L==='undefined')return;
  (items||[]).forEach(function(loc){
    if(!loc||!loc.id)return;
    var el=document.getElementById('mob-loc-mini-'+loc.id);
    if(!el||el.dataset.inited)return;
    el.dataset.inited='1';
    try{
      var map=L.map(el,{zoomControl:false,attributionControl:false,dragging:false,scrollWheelZoom:false,touchZoom:false,doubleClickZoom:false}).setView([loc.lat,loc.lon],15);
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:18}).addTo(map);
      var bc=sigajiBrandColor();
      L.circleMarker([loc.lat,loc.lon],{radius:5,color:bc,fillColor:bc,fillOpacity:1}).addTo(map);
      L.circle([loc.lat,loc.lon],{radius:loc.radius_m||250,color:bc,fillColor:bc,fillOpacity:0.12,weight:1}).addTo(map);
      setTimeout(function(){try{map.invalidateSize();}catch(e){sigajiCatchWarn("js/modules/app-mobile.js",e);}},120);
    }catch(e){sigajiCatchWarn("js/modules/app-mobile.js",e);}
  });
}
function mobAssignWeekCalendarHtml(items,locations){
  var locMap={};
  (locations||[]).forEach(function(l){if(l&&l.id)locMap[l.id]=l;});
  var today=new Date().toISOString().substring(0,10);
  var start=new Date();
  start.setDate(start.getDate()-start.getDay()+1);
  var dow=['Sen','Sel','Rab','Kam','Jum','Sab','Min'];
  var html='<div class="card" style="margin-bottom:.85rem"><div class="ct border-0 p-0 mb-md m-0">Kalender penugasan minggu ini</div><div class="mob-assign-cal">';
  dow.forEach(function(d){html+='<div class="mob-assign-cal-h">'+d+'</div>';});
  for(var i=0;i<7;i++){
    var d=new Date(start);
    d.setDate(start.getDate()+i);
    var iso=d.toISOString().substring(0,10);
    var tags=[];
    (items||[]).forEach(function(a){
      if(!a||!a.nik)return;
      if(iso<a.date_from||iso>a.date_to)return;
      var dowN=d.getDay();
      if(dowN===0)return;
      if(dowN===6&&!a.works_saturday)return;
      var loc=locMap[a.location_id]||a.sigaji_work_locations||{};
      var kar=(karyawan||[]).find(function(k){return k&&k.nik===a.nik;});
      var nm=kar?(kar.nama.split(' ')[0]):a.nik;
      tags.push(nm+' @ '+(loc.nama||'?'));
    });
    html+='<div class="mob-assign-cal-cell'+(iso===today?' today':'')+'"><div class="mob-assign-cal-day">'+d.getDate()+'</div>';
    tags.slice(0,3).forEach(function(t){html+='<span class="mob-assign-cal-tag" title="'+escapeHtml(t)+'">'+escapeHtml(t)+'</span>';});
    if(tags.length>3)html+='<span class="mob-assign-cal-tag">+'+(tags.length-3)+'</span>';
    html+='</div>';
  }
  return html+'</div></div>';
}
function mobLeaveQuotaPanel(nik,reqType){
  if(reqType&&reqType!=='cuti')return '<div class="mob-leave-quota-panel"><div class="fw-700 text-body">Kuota cuti</div><p class="text-muted" style="margin:.35rem 0 0">Izin/sakit tidak memotong kuota cuti tahunan.</p></div>';
  var yr=new Date().getFullYear();
  var kuota=(typeof masterCuti!=='undefined'&&masterCuti.kuota)||12;
  var t=typeof cutiTerpakai==='function'?cutiTerpakai(nik,yr):0;
  var sisa=Math.max(0,kuota-t);
  var cls=sisa<=0?'b-err':sisa<=3?'b-warn':'b-teal';
  return '<div class="mob-leave-quota-panel"><div class="fw-700 text-body mb-sm">Sisa kuota cuti '+yr+'</div>'
    +'<div><span class="font-14" class="bdg '+cls+'" style="padding:4px 12px">'+sisa+' / '+kuota+' hari</span></div>'
    +'<p class="mt-md text-muted">Terpakai: '+t+' hari · termasuk pengajuan pending di sistem</p></div>';
}
function mobLocUpdateRadiusUi(){
  var sl=document.getElementById('mob-loc-radius');
  var lb=document.getElementById('mob-loc-radius-lbl');
  if(!sl||!lb)return;
  var h=mobLocRadiusLabel(sl.value);
  lb.innerHTML=h;
  if(_mobMapPicker&&_mobMapPicker.circle)_mobMapPicker.circle.setRadius(parseInt(sl.value,10)||250);
}
async function mobLocUseMyPosition(){
  if(!navigator.geolocation){toast('Browser tidak mendukung GPS');return;}
  toast('Mengambil lokasi…');
  navigator.geolocation.getCurrentPosition(function(pos){
    var lat=document.getElementById('mob-loc-lat');
    var lon=document.getElementById('mob-loc-lon');
    if(lat)lat.value=pos.coords.latitude.toFixed(6);
    if(lon)lon.value=pos.coords.longitude.toFixed(6);
    mobLocInitMapPicker();
    toast('Lokasi Anda ditempatkan di peta');
  },function(){toast('Gagal ambil GPS — izinkan lokasi di browser');},{enableHighAccuracy:true,timeout:20000});
}
function mobLocInitMapPicker(){
  var host=document.getElementById('mob-loc-map');
  if(!host||typeof L==='undefined')return;
  var lat=parseFloat((document.getElementById('mob-loc-lat')||{}).value)||-6.2;
  var lon=parseFloat((document.getElementById('mob-loc-lon')||{}).value)||106.816666;
  var rad=mobLocSliderToRadius((document.getElementById('mob-loc-radius')||{}).value);
  if(_mobMapPicker&&_mobMapPicker.map){_mobMapPicker.map.remove();_mobMapPicker=null;}
  var map=L.map(host).setView([lat,lon],15);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'© OSM'}).addTo(map);
  var marker=L.marker([lat,lon],{draggable:true}).addTo(map);
  var bc=sigajiBrandColor();
  var circle=L.circle([lat,lon],{radius:rad,color:bc,fillColor:bc,fillOpacity:0.15}).addTo(map);
  marker.on('dragend',function(){
    var p=marker.getLatLng();
    var latEl=document.getElementById('mob-loc-lat');
    var lonEl=document.getElementById('mob-loc-lon');
    if(latEl)latEl.value=p.lat.toFixed(6);
    if(lonEl)lonEl.value=p.lng.toFixed(6);
    circle.setLatLng(p);
  });
  map.on('click',function(e){
    marker.setLatLng(e.latlng);
    circle.setLatLng(e.latlng);
    var latEl=document.getElementById('mob-loc-lat');
    var lonEl=document.getElementById('mob-loc-lon');
    if(latEl)latEl.value=e.latlng.lat.toFixed(6);
    if(lonEl)lonEl.value=e.latlng.lng.toFixed(6);
  });
  _mobMapPicker={map:map,marker:marker,circle:circle};
  setTimeout(function(){try{map.invalidateSize();}catch(e){sigajiCatchWarn("js/modules/app-mobile.js",e);}},200);
}
async function editMobileLocation(id){
  _mobLocEditId=id||null;
  var loc=null;
  if(id){
    var j=await sigajiMobileFetch('mobile-locations',{method:'GET'});
    if(j&&j.ok)loc=(j.items||[]).find(function(x){return x.id===id;});
  }
  var tit=document.getElementById('mob-loc-modal-title');
  if(tit)tit.textContent=loc?'Edit lokasi GPS':'Tambah lokasi GPS';
  var fields={nama:'mob-loc-nama',lat:'mob-loc-lat',lon:'mob-loc-lon',radius:'mob-loc-radius',tipe:'mob-loc-tipe'};
  if(document.getElementById(fields.nama))document.getElementById(fields.nama).value=loc?loc.nama:'Site luar kota';
  if(document.getElementById(fields.lat))document.getElementById(fields.lat).value=loc?String(loc.lat):'-6.2088';
  if(document.getElementById(fields.lon))document.getElementById(fields.lon).value=loc?String(loc.lon):'106.8456';
  if(document.getElementById(fields.radius))document.getElementById(fields.radius).value=String(mobLocRadiusToSlider(loc?loc.radius_m:250));
  if(document.getElementById(fields.tipe))document.getElementById(fields.tipe).value=loc?loc.tipe:'site';
  mobLocUpdateRadiusUi();
  if(typeof mobLocWizardReset==='function')mobLocWizardReset();
  else if(typeof mobLocWizardGo==='function')mobLocWizardGo(1);
  if(typeof openModal==='function')openModal('m-mob-location');
}
async function saveMobileLocationModal(btn){
  var nama=(document.getElementById('mob-loc-nama')||{}).value.trim();
  var lat=parseFloat((document.getElementById('mob-loc-lat')||{}).value);
  var lon=parseFloat((document.getElementById('mob-loc-lon')||{}).value);
  var radius=mobLocSliderToRadius((document.getElementById('mob-loc-radius')||{}).value);
  var tipe=(document.getElementById('mob-loc-tipe')||{}).value||'site';
  if(!nama){toast('Nama lokasi wajib');return;}
  if(!Number.isFinite(lat)||!Number.isFinite(lon)){toast('Koordinat invalid');return;}
  if(radius<50){toast('Radius minimal 50 meter');return;}
  var body={action:'save_location',id:_mobLocEditId,nama:nama,lat:lat,lon:lon,radius_m:radius,tipe:tipe,aktif:true};
  if(typeof sigajiBtnLoading==='function')sigajiBtnLoading(btn,true,'Menyimpan…');
  var r=await sigajiMobileFetch('mobile-locations',{method:'POST',body:body});
  if(typeof sigajiBtnLoading==='function')sigajiBtnLoading(btn,false);
  if(r&&r.ok){
    toast('Lokasi disimpan');
    if(typeof closeModal==='function')closeModal('m-mob-location');
    renderMobileLocations();
    renderMobileDashboard();
  }else toast((r&&r.error)||'Gagal simpan');
}
async function renderMobileDashboard(){
  var el=document.getElementById('mob-dashboard-wrap');if(!el)return;
  var today=new Date().toISOString().substring(0,10);
  var dateEl=document.getElementById('mob-dash-date');
  var locEl=document.getElementById('mob-dash-loc');
  var workDate=dateEl?dateEl.value:today;
  var locId=locEl?locEl.value:'';
  var html=typeof sigajiSkeleton==='function'?sigajiSkeleton('kpi'):'<div class="text-muted" style="padding:.5rem 0">Memuat ringkasan…</div>';
  el.innerHTML=html;
  var q='mobile-attendance?dashboard=1&work_date='+encodeURIComponent(workDate);
  if(locId)q+='&location_id='+encodeURIComponent(locId);
  var j=await sigajiMobileFetch(q,{method:'GET',loadingHost:el});
  if(!j||!j.ok){el.innerHTML='<div class="info-box info-red">'+escapeHtml(j&&j.error||'Gagal memuat dashboard')+'</div>';return;}
  var s=j.summary||{};
  var pending=s.pending_review||0;
  if(pending>0&&typeof window._mobLastPending!=='number')window._mobLastPending=0;
  if(pending>(window._mobLastPending||0)&&typeof Notification!=='undefined'&&Notification.permission==='granted'){
    try{new Notification('SiGaji — absensi perlu review',{body:pending+' log menunggu persetujuan HRD'});}catch(eN){sigajiCatchWarn("js/modules/app-mobile.js",eN);}
  }
  window._mobLastPending=pending;
  var h='<div class="fl gap1 flex-wrap mb-lg">'
    +'<span class="bdg b-teal">Hadir lengkap: '+String(s.hadir_lengkap||0)+'</span>'
    +'<span class="bdg b-warn">Belum check-out: '+String(s.belum_checkout||0)+'</span>'
    +'<span class="bdg b-warn">Review: '+String(s.pending_review||0)+'</span>'
    +'<span class="bdg b-err">Tidak hadir: '+String(s.tidak_hadir||0)+'</span>'
    +'<span class="bdg b-gray">Total: '+String(s.total_karyawan||0)+'</span></div>';
  el.innerHTML=h;
}
async function renderMobileFaceEnrollments(){
  var el=document.getElementById('mob-face-wrap');if(!el)return;
  el.innerHTML='<div class="text-muted" style="padding:.5rem 0">Memuat enrollment wajah…</div>';
  var j=await sigajiMobileFetch('mobile-face',{method:'GET'});
  if(!j||!j.ok){el.innerHTML='<div class="info-box info-red">'+escapeHtml(j&&j.error||'Gagal memuat enrollment')+'</div>';return;}
  var items=j.items||[];
  var map={};
  items.forEach(function(x){if(x&&x.nik)map[x.nik]=x;});
  var rows=(karyawan||[]).filter(function(k){return k&&k.nik&&k.aktif!==false;}).map(function(k){
    var en=map[k.nik];
    var st=en?'<span class="bdg b-teal">Terdaftar</span>':'<span class="bdg b-gray">Belum</span>';
    var meta=en?('<span class="u-muted-10"> · '+escapeHtml(en.model_version||'')+' · '+mobFmtTimeIso(en.updated_at||en.enrolled_at)+'</span>'):'';
    var nikEsc=String(k.nik).replace(/'/g,"\\'");
    var btn=en?'<button type="button" class="btn btn-xs btn-r"'+sigajiDataAction('invoke',{fn:'deleteMobileFaceEnroll',arg:k.nik})+'>Hapus</button>':'';
    return '<tr><td>'+escapeHtml(k.nik)+'</td><td>'+escapeHtml(k.nama||'')+'</td><td>'+st+meta+'</td><td>'+btn+'</td></tr>';
  }).join('');
  el.innerHTML='<div class="card"><div class="ct border-0 p-0 mb-md m-0">Enrollment wajah (APK)</div>'
    +'<table><thead><tr><th>NIK</th><th>Nama</th><th>Status</th><th></th></tr></thead><tbody>'
    +(rows||'<tr><td class="text-center text-subtle" colspan="4">Tidak ada karyawan</td></tr>')
    +'</tbody></table></div>';
}
async function deleteMobileFaceEnroll(nik){
  if(!confirm('Hapus enrollment wajah '+nik+'? Karyawan harus daftar ulang di HP.'))return;
  var r=await sigajiMobileFetch('mobile-face',{method:'POST',body:{action:'delete',nik:nik}});
  if(r&&r.ok){toast(r.message||'Dihapus');renderMobileFaceEnrollments();}
  else toast((r&&r.error)||'Gagal hapus');
}
async function renderMobileLateReport(){
  var el=document.getElementById('mob-late-wrap');if(!el)return;
  var monthEl=document.getElementById('mob-late-month');
  if(monthEl&&!monthEl.value)monthEl.value=new Date().toISOString().substring(0,7);
  var month=monthEl?monthEl.value:new Date().toISOString().substring(0,7);
  el.innerHTML='<div class="text-muted" style="padding:.5rem 0">Memuat rekap keterlambatan…</div>';
  var j=await sigajiMobileFetch('mobile-attendance?late_report=1&month='+encodeURIComponent(month),{method:'GET'});
  if(!j||!j.ok){el.innerHTML='<div class="info-box info-red">'+escapeHtml(j&&j.error||'Gagal memuat rekap')+'</div>';return;}
  var rekap=j.rekap||[];
  if(!rekap.length){el.innerHTML='<p class="u-muted-12">Tidak ada keterlambatan (jam masuk: '+escapeHtml(j.jam_masuk||'08:00')+').</p>';return;}
  var rows=rekap.map(function(r){
    return '<tr><td>'+escapeHtml(r.nama||r.nik)+'</td><td>'+escapeHtml(r.nik)+'</td><td>'+r.late_days+'</td><td>'+r.total_late_minutes+' mnt</td><td>'+r.max_late_minutes+' mnt</td></tr>';
  }).join('');
  el.innerHTML='<p class="font-11 text-muted mb-md m-0">Jam masuk perusahaan: <strong>'+escapeHtml(j.jam_masuk||'08:00')+'</strong> (atur di Master → Profil Perusahaan)</p>'
    +'<table><thead><tr><th>Nama</th><th>NIK</th><th>Hari telat</th><th>Total menit</th><th>Maks/hari</th></tr></thead><tbody>'+rows+'</tbody></table>';
}
async function mobImportLibnas(){
  var yr=prompt('Tahun libur nasional',String(new Date().getFullYear()));
  if(yr===null)return;
  var r=await sigajiMobileFetch('mobile-calendar',{method:'POST',body:{action:'import_libnas',year:parseInt(yr,10)}});
  if(r&&r.ok){
    toast(r.message||'Libur nasional diimpor');
    if(typeof loadCloudData==='function')await loadCloudData();
    if(typeof renderHariLibur==='function')renderHariLibur();
  }else toast((r&&r.error)||'Gagal impor');
}
async function mobSyncAlpha(){
  var p=typeof PA==='function'?PA():null;
  if(!p||!p.start){toast('Pilih periode gaji aktif');return;}
  if(!confirm('Tandai alpha otomatis untuk hari kerja tanpa check-in valid di periode '+p.nama+'?'))return;
  var r=await sigajiMobileFetch('mobile-calendar',{method:'POST',body:{action:'sync_alpha',date_from:p.start,date_to:p.end}});
  if(r&&r.ok){
    toast(r.message||'Selesai');
    if(typeof loadCloudData==='function')await loadCloudData();
    if(typeof renderAbsensi==='function')renderAbsensi();
  }else toast((r&&r.error)||'Gagal sinkron alpha');
}
async function mobInitLokasiTab(){
  var dashHost=document.getElementById('mob-dashboard-host');
  if(dashHost&&!dashHost.dataset.inited){
    var today=new Date().toISOString().substring(0,10);
    var jLoc=await sigajiMobileFetch('mobile-locations',{method:'GET'});
    var locOpts='<option value="">Semua lokasi</option>';
    if(jLoc&&jLoc.ok)(jLoc.items||[]).forEach(function(l){
      if(l&&l.id&&l.aktif!==false)locOpts+='<option value="'+escapeHtml(l.id)+'">'+escapeHtml(l.nama)+'</option>';
    });
    var h='<div class="card tabs-spaced-lg border-accent-left">'
      +'<div class="flb mb2 flex-wrap gap-sm"><div class="ct m-0 border-0 p-0">Dashboard absensi hari ini</div>'
      +'<div class="fl gap1"><input class="rounded-sm select-inline select-inline-bordered" type="date" id="mob-dash-date" value="'+escapeAttr(today)+'">'
      +'<select class="rounded-sm select-inline select-inline-bordered" id="mob-dash-loc">'+locOpts+'</select>'
      +'<button type="button" class="btn btn-sm btn-out"'+sigajiDataAction('invoke',{fn:'renderMobileDashboard'})+'>Muat</button></div></div>'
      +'<div id="mob-dashboard-wrap"></div></div>';
    dashHost.innerHTML=h;
    dashHost.dataset.inited='1';
    var dEl=document.getElementById('mob-dash-date');
    var lEl=document.getElementById('mob-dash-loc');
    if(dEl)dEl.onchange=renderMobileDashboard;
    if(lEl)lEl.onchange=renderMobileDashboard;
    if(typeof Notification!=='undefined'&&Notification.permission==='default'){
      try{Notification.requestPermission();}catch(eNp){sigajiCatchWarn("js/modules/app-mobile.js",eNp);}
    }
  }
  renderMobileDashboard();
  renderMobileFaceEnrollments();
}
// ── HRD: Penugasan ──────────────────────────────
function mobKarSelectHtml(selectedNik){
  var list=typeof sortKaryawanByNik==='function'?sortKaryawanByNik(karyawan||[]):(karyawan||[]).slice();
  var opts='<option value="">-- Pilih karyawan --</option>';
  list.forEach(function(k){
    if(!k||!k.nik)return;
    var sel=k.nik===selectedNik?' selected':'';
    opts+='<option value="'+escapeHtml(k.nik)+'"'+sel+'>'+escapeHtml(k.nik+' — '+k.nama)+'</option>';
  });
  return opts;
}
function mobLocSelectHtml(locations,selectedId){
  var opts='<option value="">-- Pilih lokasi --</option>';
  (locations||[]).forEach(function(l){
    if(!l||!l.id||l.aktif===false)return;
    var sel=l.id===selectedId?' selected':'';
    opts+='<option value="'+escapeHtml(l.id)+'"'+sel+'>'+escapeHtml(l.nama)+' ('+(l.radius_m||200)+' m)</option>';
  });
  return opts;
}
function mobAssignFormHtml(locations,editRow){
  editRow=editRow||null;
  var today=new Date().toISOString().substring(0,10);
  var df=editRow?editRow.date_from:today;
  var dt=editRow?editRow.date_to:today;
  var sat=editRow?!!editRow.works_saturday:true;
  var cat=editRow?(editRow.catatan||''):'';
  return '<div id="mob-assign-form" class="card card-surface-neutral mob-card-bordered">'
    +'<div class="ct border-0 p-0 mb-lg m-0">'+(editRow?'Edit penugasan':'Tambah penugasan baru')+'</div>'
    +'<input type="hidden" id="mob-assign-edit-id" value="'+(editRow?escapeHtml(editRow.id):'')+'">'
    +'<div class="fg"><label>Karyawan</label><select class="w-full" id="mob-assign-nik">'+mobKarSelectHtml(editRow?editRow.nik:'')+'</select></div>'
    +'<div class="fg"><label>Lokasi check-in</label><select class="w-full" id="mob-assign-loc">'+mobLocSelectHtml(locations,editRow?editRow.location_id:'')+'</select></div>'
    +'<div class="fg2"><div class="fg"><label>Tanggal mulai</label><input type="date" id="mob-assign-from" value="'+escapeHtml(df)+'"></div>'
    +'<div class="fg"><label>Tanggal selesai</label><input type="date" id="mob-assign-to" value="'+escapeHtml(dt)+'"></div></div>'
    +'<label class="fl items-center gap-xs font-12 mb-lg cursor-pointer">'
    +'<input type="checkbox" id="mob-assign-sat" '+(sat?'checked':'')+' style="width:16px;height:16px"> Sabtu termasuk hari kerja di lokasi ini</label>'
    +'<div class="fg"><label>Catatan (opsional)</label><input type="text" id="mob-assign-cat" value="'+escapeHtml(cat)+'" placeholder="Mis. proyek Site B"></div>'
    +'<div class="fl gap1"><button type="button" class="btn btn-sm btn-p"'+sigajiDataAction('invoke',{fn:'saveMobileAssignment'})+'>Simpan penugasan</button>'
    +(editRow?'<button type="button" class="btn btn-sm btn-out"'+sigajiDataAction('invoke',{fn:'renderMobileAssignments'})+'>Batal</button>':'')
    +'</div></div>';
}
async function renderMobileAssignments(){
  var el=document.getElementById('mob-assign-wrap');if(!el)return;
  el.innerHTML='<div class="text-muted p-md">Memuat…</div>';
  var jAssign=await sigajiMobileFetch('mobile-locations?kind=assignments',{method:'GET'});
  var jLoc=await sigajiMobileFetch('mobile-locations',{method:'GET'});
  if(!jAssign||!jAssign.ok){el.innerHTML='<div class="info-box info-red">'+escapeHtml(jAssign&&jAssign.error||'Gagal memuat penugasan')+'</div>';return;}
  var locations=(jLoc&&jLoc.ok)?(jLoc.items||[]):[];
  window._mobLocList=locations;
  var items=jAssign.items||[];
  if(!locations.length){
    el.innerHTML='<div class="info-box info-amber">Buat <strong>lokasi check-in GPS</strong> di tabel atas dulu, baru bisa menambah penugasan.</div>';
    return;
  }
  var rows=items.map(function(a){
    var loc=a.sigaji_work_locations||{};
    var namaKar=(karyawan||[]).find(function(k){return k&&k.nik===a.nik;});
    var lbl=namaKar?(namaKar.nama+' ('+a.nik+')'):a.nik;
    return '<tr><td>'+escapeHtml(lbl)+'</td><td>'+escapeHtml(loc.nama||'-')+'</td><td>'+escapeHtml(a.date_from)+' → '+escapeHtml(a.date_to)+'</td><td>'+(a.works_saturday?'Ya':'Tidak')+'</td><td><div class="fl gap1"><button type="button" class="btn btn-sm btn-out"'+sigajiDataAction('invoke',{fn:'editMobileAssignment',arg:a.id})+'>Edit</button><button type="button" class="btn btn-sm btn-r"'+sigajiDataAction('invoke',{fn:'deleteMobileAssignment',arg:a.id})+'>Hapus</button></div></td></tr>';
  }).join('');
  var h=mobAssignFormHtml(locations,null)
    +mobAssignWeekCalendarHtml(items,locations)
    +'<div class="card"><div class="ct border-0 p-0 mb-md m-0">Daftar penugasan</div>'
    +'<p class="font-11 text-muted mb-lg m-0">Tim menginap luar kota: pilih karyawan, lokasi mess/site, dan rentang tanggal.</p>'
    +'<table><thead><tr><th>Karyawan</th><th>Lokasi</th><th>Rentang</th><th>Sabtu</th><th></th></tr></thead><tbody>'
    +(rows||'<tr><td class="text-center text-subtle" colspan="5">Belum ada penugasan</td></tr>')
    +'</tbody></table></div>';
  el.innerHTML=h;
}
async function saveMobileAssignment(){
  var nikEl=document.getElementById('mob-assign-nik');
  var locEl=document.getElementById('mob-assign-loc');
  var fromEl=document.getElementById('mob-assign-from');
  var toEl=document.getElementById('mob-assign-to');
  var satEl=document.getElementById('mob-assign-sat');
  var catEl=document.getElementById('mob-assign-cat');
  var idEl=document.getElementById('mob-assign-edit-id');
  if(!nikEl||!locEl||!fromEl||!toEl){toast('Form tidak siap — buka tab Lokasi GPS lagi');return;}
  var nik=nikEl.value.trim();
  var location_id=locEl.value.trim();
  var date_from=fromEl.value;
  var date_to=toEl.value;
  if(!nik){toast('Pilih karyawan');return;}
  if(!location_id){toast('Pilih lokasi');return;}
  if(!date_from||!date_to){toast('Isi tanggal mulai dan selesai');return;}
  if(date_to<date_from){toast('Tanggal selesai harus sama atau setelah tanggal mulai');return;}
  var body={
    action:'save_assignment',
    nik:nik,
    location_id:location_id,
    date_from:date_from,
    date_to:date_to,
    works_saturday:!(satEl&&!satEl.checked),
    catatan:catEl?catEl.value.trim():''
  };
  if(idEl&&idEl.value)body.id=idEl.value;
  toast('Menyimpan…');
  var r=await sigajiMobileFetch('mobile-locations',{method:'POST',body:body});
  if(r&&r.ok){toast('Penugasan disimpan');renderMobileAssignments();}
  else toast((r&&r.error)||'Gagal simpan — pastikan login cloud & deploy API terbaru');
}
async function editMobileAssignment(id){
  var j=await sigajiMobileFetch('mobile-locations?kind=assignments',{method:'GET'});
  if(!j||!j.ok){toast((j&&j.error)||'Gagal memuat');return;}
  var row=(j.items||[]).find(function(x){return x.id===id;});
  if(!row){toast('Data tidak ditemukan');return;}
  var locations=window._mobLocList||[];
  if(!locations.length){
    var jLoc=await sigajiMobileFetch('mobile-locations',{method:'GET'});
    locations=(jLoc&&jLoc.ok)?(jLoc.items||[]):[];
  }
  var el=document.getElementById('mob-assign-wrap');if(!el)return;
  var items=j.items||[];
  var rows=items.map(function(a){
    var loc=a.sigaji_work_locations||{};
    var namaKar=(karyawan||[]).find(function(k){return k&&k.nik===a.nik;});
    var lbl=namaKar?(namaKar.nama+' ('+a.nik+')'):a.nik;
    return '<tr><td>'+escapeHtml(lbl)+'</td><td>'+escapeHtml(loc.nama||'-')+'</td><td>'+escapeHtml(a.date_from)+' → '+escapeHtml(a.date_to)+'</td><td>'+(a.works_saturday?'Ya':'Tidak')+'</td><td><div class="fl gap1"><button type="button" class="btn btn-sm btn-out"'+sigajiDataAction('invoke',{fn:'editMobileAssignment',arg:a.id})+'>Edit</button><button type="button" class="btn btn-sm btn-r"'+sigajiDataAction('invoke',{fn:'deleteMobileAssignment',arg:a.id})+'>Hapus</button></div></td></tr>';
  }).join('');
  var h=mobAssignFormHtml(locations,row)
    +mobAssignWeekCalendarHtml(items,locations)
    +'<div class="card"><div class="ct border-0 p-0 mb-md m-0">Daftar penugasan</div>'
    +'<table><thead><tr><th>Karyawan</th><th>Lokasi</th><th>Rentang</th><th>Sabtu</th><th></th></tr></thead><tbody>'
    +(rows||'<tr><td class="text-center text-subtle" colspan="5">Belum ada</td></tr>')
    +'</tbody></table></div>';
  el.innerHTML=h;
  try{document.getElementById('mob-assign-form')&&document.getElementById('mob-assign-form').scrollIntoView({behavior:'smooth',block:'start'});}catch(e){sigajiCatchWarn("js/modules/app-mobile.js",e);}
}
async function deleteMobileAssignment(id){
  if(!confirm('Hapus penugasan ini?'))return;
  var r=await sigajiMobileFetch('mobile-locations',{method:'POST',body:{action:'delete_assignment',id:id}});
  if(r&&r.ok){toast('Dihapus');renderMobileAssignments();}else toast((r&&r.error)||'Gagal');
}
// ── HRD: Approve cuti ───────────────────────────
async function renderMobileLeavePending(){
  var el=document.getElementById('mob-leave-wrap');if(!el)return;
  el.innerHTML='<div class="text-muted p-md">Memuat…</div>';
  var j=await sigajiMobileFetch('mobile-leave?status=pending',{method:'GET'});
  if(!j||!j.ok){el.innerHTML='<div class="info-box info-red">'+escapeHtml(j&&j.error||'Gagal memuat pengajuan')+'</div>';return;}
  var items=j.items||[];
  if(!items.length){el.innerHTML='<div class="card"><div class="ct">Pengajuan cuti / izin / sakit</div><p class="text-muted font-12">Tidak ada antrian pending.</p></div>';return;}
  el.innerHTML='<div class="card"><div class="ct">Pengajuan menunggu persetujuan</div>'
    +items.map(function(r){
      var idEsc=String(r.id).replace(/'/g,"\\'");
      var att=r.attachment_path?'<div class="font-10 ct-brand">Surat: '+escapeHtml(r.attachment_path)+'</div>':'';
      return '<div class="mob-leave-split rounded-md mb-md">'
        +'<div><div class="fw-700 font-14">'+escapeHtml(r.nama_karyawan||r.nik)+' <span class="bdg b-info">'+escapeHtml(r.request_type)+'</span></div>'
        +'<div class="font-12 text-body mt-xs">'+r.date_from+' → '+r.date_to+'</div>'
        +'<div class="font-11 text-muted mt-xs">'+escapeHtml(r.reason||'-')+'</div>'+att
        +'<div class="fl gap1" style="margin-top:.65rem">'
        +'<button class="btn btn-sm btn-g"'+sigajiDataAction('mobile-leave-decide',{id:r.id,decision:'approve'})+'>Setujui</button>'
        +'<button class="btn btn-sm btn-r"'+sigajiDataAction('mobile-leave-decide',{id:r.id,decision:'reject'})+'>Tolak</button></div></div>'
        +mobLeaveQuotaPanel(r.nik,r.request_type)+'</div>';
    }).join('')+'</div>';
}
async function mobileLeaveDecide(id,decide){
  var note='';
  if(decide==='reject'){note=prompt('Alasan penolakan (opsional)')||'';}
  else if(!confirm('Setujui pengajuan? Absensi akan di-update otomatis.'))return;
  var r=await sigajiMobileFetch('mobile-leave',{method:'POST',body:{action:'decide',id:id,decide:decide,note:note}});
  if(r&&r.ok){
    if(decide==='approve'&&r.absensi_patch){
      Object.keys(r.absensi_patch).forEach(function(nik){
        if(!absensi[nik])absensi[nik]={};
        Object.assign(absensi[nik],r.absensi_patch[nik]);
      });
      saveAll();
      if(typeof renderAbsensi==='function')renderAbsensi();
    }else if(decide==='approve'){
      toast('Disetujui di server — sinkron data cloud jika perlu');
    }
    toast(decide==='approve'?'Disetujui — absensi diperbarui':'Ditolak');
    renderMobileLeavePending();
    if(typeof renderCutiRekap==='function')renderCutiRekap();
    return;
  }
  toast((r&&r.error)||(decide==='approve'?'Gagal menyetujui — periksa sisa cuti karyawan':'Gagal'));
}
function renderMobileAbsensiTabs(){
  if(typeof canAccessSubTab!=='function')return;
  var showLoc=canAccessSubTab('absensi','lokasi')||(CU&&CU.role==='Admin');
  var showLeave=canAccessSubTab('absensi','pengajuan')||(CU&&CU.role==='Admin');
  document.querySelectorAll('#pg-absensi .tab[data-abtab="lokasi"]').forEach(function(t){t.style.display=showLoc?'':'none';});
  document.querySelectorAll('#pg-absensi .tab[data-abtab="pengajuan"]').forEach(function(t){t.style.display=showLeave?'':'none';});
}
// ── Karyawan: Cuti Saya + ajuan ──────────────────
async function renderMyCutiPage(){
  var host=document.getElementById('my-cuti-content');if(!host)return;
  if(typeof renderMyCuti==='function')renderMyCuti();
  if(!CU||!CU.nik){
    host.innerHTML+='<div class="info-box info-amber mt1">Akun belum terhubung ke NIK karyawan.</div>';
    return;
  }
  var extra=document.getElementById('my-cuti-mobile-extra');
  if(!extra){
    extra=document.createElement('div');
    extra.id='my-cuti-mobile-extra';
    extra.className='mt1';
    host.appendChild(extra);
  }
  var cloud=typeof sigajiIsCloudConfigured==='function'&&sigajiIsCloudConfigured();
  extra.innerHTML='<div class="card"><div class="ct">Ajuan cuti / izin / sakit</div>'
    +(cloud?'<p class="u-muted-11">Sakit wajib upload surat dokter sejak hari pertama. Cuti tahunan tidak boleh melebihi sisa kuota (termasuk pengajuan pending). Setelah disetujui HRD, kalender absensi ter-update otomatis.</p>'
      :'<p class="u-muted-11">Login cloud diperlukan untuk mengirim pengajuan ke HRD.</p>')
    +'<div id="mycuti-balance-cloud" class="info-box info-amber u-hidden font-11 mb-md" style="line-height:1.5"></div>'
    +'<div class="u-hidden font-11 mb-md card-surface-neutral rounded-sm mob-preview-cloud" id="mycuti-preview-cloud"></div>'
    +'<div class="fg2"><div class="fg"><label>Jenis</label><select id="mycuti-type"><option value="cuti">Cuti tahunan</option><option value="izin">Izin</option><option value="sakit">Sakit (wajib surat dokter)</option></select></div>'
    +'<div class="fg"><label>Dari</label><input type="date" id="mycuti-from"></div><div class="fg"><label>Sampai</label><input type="date" id="mycuti-to"></div></div>'
    +'<div class="fg"><label>Alasan</label><textarea class="w-full" id="mycuti-reason" rows="2"></textarea></div>'
    +'<div class="fg u-hidden" id="mycuti-file-wrap"><label>Surat dokter (wajib)</label><input type="file" id="mycuti-file" accept="image/*,.pdf"></div>'
    +'<button class="btn btn-p btn-sm"'+sigajiDataAction('invoke',{fn:'submitMyCutiRequest'})+'>Kirim pengajuan</button>'
    +'<div id="mycuti-notif-cloud" class="mt1 u-hidden"></div>'
    +'<div id="mycuti-requests-list" class="mt1"></div></div>';
  var sel=document.getElementById('mycuti-type');
  if(sel)sel.onchange=function(){
    var w=document.getElementById('mycuti-file-wrap');
    if(w)w.style.display=sel.value==='sakit'?'block':'none';
    loadMyCutiBalanceCloud();
  };
  var mf=document.getElementById('mycuti-from');
  var mt=document.getElementById('mycuti-to');
  if(mf){mf.onchange=loadMyCutiBalanceCloud;mf.oninput=loadMyCutiBalanceCloud;}
  if(mt){mt.onchange=refreshMyCutiPreviewCloud;mt.oninput=refreshMyCutiPreviewCloud;}
  if(cloud){loadMyCutiBalanceCloud();loadMyCutiNotifCloud();}
  loadMyCutiRequests();
}
async function loadMyCutiNotifCloud(){
  var el=document.getElementById('mycuti-notif-cloud');
  if(!el||typeof sigajiIsCloudConfigured!=='function'||!sigajiIsCloudConfigured())return;
  var j=await sigajiMobileFetch('mobile-notifications',{method:'POST',body:{action:'list',limit:15}});
  if(!j||!j.ok){el.style.display='none';return;}
  var items=j.items||[];
  if(!items.length){el.style.display='none';return;}
  var unread=items.filter(function(n){return !n.read_at;});
  el.style.display='block';
  var h='<div class="font-11 fw-700 text-muted mb-sm">Notifikasi pengajuan'
    +(unread.length?' <span class="bdg b-warn">'+String(unread.length)+' baru</span>':'')+'</div>'
    +items.slice(0,8).map(function(n){
      var st=!n.read_at?' mob-notif-unread':'';
      return '<div class="font-11 mob-list-row'+st+'">'
        +'<div class="fw-700">'+escapeHtml(n.title||'')+'</div>'
        +'<div class="text-muted">'+escapeHtml(n.body||'')+'</div></div>';
    }).join('')
    +(unread.length?'<button type="button" class="btn btn-sm btn-out mt05"'+sigajiDataAction('invoke',{fn:'markMyCutiNotifRead'})+'>Tandai dibaca</button>':'');
  el.innerHTML=h;
}
async function markMyCutiNotifRead(){
  await sigajiMobileFetch('mobile-notifications',{method:'POST',body:{action:'mark_read',all:true}});
  loadMyCutiNotifCloud();
}
function formatMyCutiBalanceCloud(b){
  if(!b)return '';
  var sisa=b.sisa!=null?b.sisa:0;
  return '<strong>Sisa cuti '+String(b.year)+': '+String(Math.max(0,sisa))+' hari</strong> (kuota '+String(b.kuota||12)
    +', terpakai '+String(b.terpakai||0)+(b.pending_pengajuan?', termasuk '+String(b.pending_pengajuan)+' hari pending':'')+')';
}
async function loadMyCutiBalanceCloud(){
  var box=document.getElementById('mycuti-balance-cloud');
  var prev=document.getElementById('mycuti-preview-cloud');
  var sel=document.getElementById('mycuti-type');
  if(!box||!sel)return;
  if(sel.value!=='cuti'){
    box.style.display='none';
    if(prev)prev.style.display='none';
    return;
  }
  if(typeof sigajiIsCloudConfigured!=='function'||!sigajiIsCloudConfigured()){
    box.style.display='none';
    return;
  }
  box.style.display='block';
  box.textContent='Memuat sisa cuti…';
  var yr=new Date().getFullYear();
  var mf=document.getElementById('mycuti-from');
  if(mf&&mf.value)yr=parseInt(String(mf.value).substring(0,4),10)||yr;
  var j=await sigajiMobileFetch('mobile-leave',{method:'POST',body:{action:'cuti_balance',year:yr}});
  if(!j||!j.ok){box.textContent=(j&&j.error)||'Gagal memuat sisa cuti';return;}
  var h=formatMyCutiBalanceCloud(j.balance);
  box.innerHTML=h;
  await refreshMyCutiPreviewCloud();
}
async function refreshMyCutiPreviewCloud(){
  var prev=document.getElementById('mycuti-preview-cloud');
  var sel=document.getElementById('mycuti-type');
  var mf=document.getElementById('mycuti-from');
  var mt=document.getElementById('mycuti-to');
  if(!prev||!sel||!mf||!mt)return;
  if(sel.value!=='cuti'||!mf.value||!mt.value){prev.style.display='none';return;}
  if(mt.value<mf.value){
    prev.style.display='block';
    prev.innerHTML='<span class="text-danger">Tanggal akhir harus ≥ tanggal mulai</span>';
    return;
  }
  prev.style.display='block';
  prev.textContent='Menghitung hari kerja…';
  var j=await sigajiMobileFetch('mobile-leave',{method:'POST',body:{action:'validate_cuti',date_from:mf.value,date_to:mt.value}});
  if(!j||!j.ok){prev.textContent=(j&&j.error)||'Validasi gagal';return;}
  var req=j.requested_work_days||0;
  var sisa=j.balance&&j.balance.sisa!=null?j.balance.sisa:0;
  if(j.allowed){
    prev.innerHTML='Mengajukan <b>'+String(req)+'</b> hari kerja. Sisa setelah ini: <b>'+String(Math.max(0,sisa-req))+'</b> hari.';
    prev.classList.add('text-success');
    prev.classList.remove('text-danger');
  }else{
    prev.innerHTML='<span class="text-danger">'+escapeHtml(j.error||'Melebihi sisa cuti')+'</span> (mengajukan '+String(req)+' hari, sisa '+String(Math.max(0,sisa))+' hari)';
    prev.classList.add('text-danger');
    prev.classList.remove('text-success');
  }
}
async function loadMyCutiRequests(){
  var el=document.getElementById('mycuti-requests-list');if(!el)return;
  var j=await sigajiMobileFetch('mobile-leave',{method:'POST',body:{action:'my_list'}});
  if(!j||!j.ok){el.innerHTML='<div class="font-11 text-subtle">Riwayat pengajuan (cloud): '+escapeHtml(j&&j.error||'-')+'</div>';return;}
  var items=j.items||[];
  el.innerHTML='<div class="font-11 fw-700 text-muted mb-sm">Riwayat pengajuan</div>'
    +(items.length?items.map(function(r){
      var st=r.status==='approved'?'b-teal':r.status==='rejected'?'b-err':'b-warn';
      return '<div class="font-11 mob-list-row-sm">'
        +'<span class="bdg '+st+'">'+r.status+'</span> '+r.request_type+' '+r.date_from+'–'+r.date_to+'</div>';
    }).join(''):'<div class="text-subtle">Belum ada</div>');
}
async function submitMyCutiRequest(){
  var type=(document.getElementById('mycuti-type')&&document.getElementById('mycuti-type').value)||'cuti';
  var df=document.getElementById('mycuti-from')&&document.getElementById('mycuti-from').value;
  var dt=document.getElementById('mycuti-to')&&document.getElementById('mycuti-to').value;
  var reason=(document.getElementById('mycuti-reason')&&document.getElementById('mycuti-reason').value)||'';
  if(!df||!dt){toast('Isi tanggal');return;}
  if(dt<df){toast('Tanggal akhir harus ≥ tanggal mulai');return;}
  if(type==='cuti'&&typeof sigajiIsCloudConfigured==='function'&&sigajiIsCloudConfigured()){
    var v=await sigajiMobileFetch('mobile-leave',{method:'POST',body:{action:'validate_cuti',date_from:df,date_to:dt}});
    if(!v||!v.ok){toast((v&&v.error)||'Validasi gagal');return;}
    if(!v.allowed){toast(v.error||'Cuti melebihi sisa kuota');await refreshMyCutiPreviewCloud();return;}
  }
  var attachment_path=null;
  if(type==='sakit'){
    var f=document.getElementById('mycuti-file')&&document.getElementById('mycuti-file').files[0];
    if(!f){toast('Upload surat dokter wajib untuk sakit');return;}
    toast('Mengunggah surat…');
    attachment_path=await sigajiUploadMobileFile(f,'leave');
    if(!attachment_path)return;
  }
  var body={action:'submit',request_type:type,date_from:df,date_to:dt,reason:reason,attachment_path:attachment_path};
  var r=await sigajiMobileFetch('mobile-leave',{method:'POST',body:body});
  if(r&&r.ok){toast('Pengajuan terkirim — menunggu HRD');loadMyCutiRequests();}
  else toast((r&&r.error)||'Gagal kirim');
}
