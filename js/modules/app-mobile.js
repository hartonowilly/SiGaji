/* SiGaji — mobile absensi API (web HRD + Cuti Saya) */
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
function sigajiEnumerateWorkDates(dateFrom,dateTo,worksSaturday){
  var hk=(perusahaan&&perusahaan.hariKerja)||6;
  var hlMap={};
  (hariLibur||[]).forEach(function(l){if(l&&l.tgl)hlMap[String(l.tgl).substring(0,10)]=l.tipe||'';});
  var out=[],cur=dateFrom;
  function addDays(iso,n){var d=new Date(iso+'T12:00:00');d.setDate(d.getDate()+n);return d.toISOString().substring(0,10);}
  while(cur<=dateTo){
    var dow=new Date(cur+'T12:00:00').getDay();
    if(dow===0){cur=addDays(cur,1);continue;}
    if(dow===6){if(!(worksSaturday||hk===6)){cur=addDays(cur,1);continue;}}
    var tp=hlMap[cur];
    if(tp==='libnas'||tp==='cuti-bersama'){cur=addDays(cur,1);continue;}
    out.push(cur);cur=addDays(cur,1);
  }
  return out;
}
function sigajiApplyLeaveLocal(nik,dateFrom,dateTo,status,worksSaturday){
  var dates=sigajiEnumerateWorkDates(dateFrom,dateTo,worksSaturday!==false);
  if(!absensi[nik])absensi[nik]={};
  dates.forEach(function(d){absensi[nik][d]=status;});
  saveAll();
  return dates;
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
function mobAttStatusLbl(st){
  var map={ok:['OK','b-teal'],pending_review:['Review','b-warn'],outside_geofence:['Luar radius','b-err'],rejected:['Ditolak','b-err']};
  var x=map[st]||[st||'-','b-gray'];
  return '<span class="bdg '+x[1]+'">'+x[0]+'</span>';
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
  return ' <a href="https://www.google.com/maps?q='+lat+','+lon+'" target="_blank" rel="noopener" style="font-size:10px">Peta</a>';
}
async function renderMobileAttendanceLog(){
  var el=document.getElementById('mob-att-log-wrap');if(!el)return;
  var today=new Date().toISOString().substring(0,10);
  el.innerHTML='<div class="card"><div class="flb mb2" style="flex-wrap:wrap;gap:.5rem">'
    +'<div class="ct" style="margin:0;border:0;padding:0">Siapa sudah check-in / check-out</div>'
    +'<div class="fl gap1" style="align-items:center">'
    +'<label style="font-size:11px;font-weight:700;color:#6b7280">Tanggal:</label>'
    +'<input type="date" id="mob-log-date" value="'+today+'" style="width:auto;padding:6px 10px;border-radius:8px;border:1.5px solid #dde1e9">'
    +'<button type="button" class="btn btn-sm btn-out" onclick="renderMobileAttendanceLog()">&#8635; Muat</button>'
    +'</div></div><div id="mob-log-table">Memuat…</div></div>';
  var dateEl=document.getElementById('mob-log-date');
  var workDate=dateEl?dateEl.value:today;
  var j=await sigajiMobileFetch('mobile-attendance?work_date='+encodeURIComponent(workDate),{method:'GET'});
  var host=document.getElementById('mob-log-table');if(!host)return;
  if(!j||!j.ok){
    host.innerHTML='<div class="info-box info-red">'+(j&&j.error||'Gagal memuat log — deploy API mobile-attendance GET')+'</div>';
    return;
  }
  var items=j.items||[];
  if(!items.length){
    host.innerHTML='<p style="color:#6b7280;font-size:12px;padding:.5rem 0">Belum ada check-in/check-out pada tanggal '+escapeHtml(workDate)+'.</p>';
    return;
  }
  var byNik={};
  items.forEach(function(row){
    if(!byNik[row.nik])byNik[row.nik]={nik:row.nik,cin:null,cout:null};
    if(row.event_type==='check_in')byNik[row.nik].cin=row;
    if(row.event_type==='check_out')byNik[row.nik].cout=row;
  });
  var rows=Object.keys(byNik).sort().map(function(nik){
    var g=byNik[nik];
    var k=(karyawan||[]).find(function(x){return x&&x.nik===nik;});
    var nama=k?(k.nama+' <span style="color:#9ca3af;font-weight:400">('+nik+')</span>'):nik;
    function cell(r,label){
      if(!r)return '<span style="color:#9ca3af">—</span>';
      var loc=r.location_nama?escapeHtml(r.location_nama):'<span style="color:#9ca3af">Lokasi tidak cocok</span>';
      return '<div style="font-size:11px"><strong>'+label+'</strong> '+mobFmtTimeIso(r.created_at)+'<br>'+loc+mobMapLink(r.lat,r.lon)+'<br>'+mobAttStatusLbl(r.validation_status)+(r.is_mock?' <span class="bdg b-warn">GPS mock?</span>':'')+'</div>';
    }
    var st='';
    if(g.cin&&g.cout)st='<span class="bdg b-teal">Lengkap</span>';
    else if(g.cin)st='<span class="bdg b-warn">Belum check-out</span>';
    else st='<span class="bdg b-gray">—</span>';
    return '<tr><td>'+nama+'</td><td>'+cell(g.cin,'Masuk')+'</td><td>'+cell(g.cout,'Pulang')+'</td><td>'+st+'</td></tr>';
  }).join('');
  host.innerHTML='<table><thead><tr><th>Karyawan</th><th>Check-in</th><th>Check-out</th><th>Status hari</th></tr></thead><tbody>'+rows+'</tbody></table>'
    +'<p style="font-size:10px;color:#9ca3af;margin-top:.5rem">Foto tersimpan di cloud (path di database). Status <em>Review</em> = perlu dicek HRD (GPS mock / di luar radius).</p>';
}
// ── HRD: Lokasi kerja ───────────────────────────
async function renderMobileLocations(){
  var el=document.getElementById('mob-locations-wrap');if(!el)return;
  el.innerHTML='<div style="color:#6b7280;padding:1rem">Memuat…</div>';
  var j=await sigajiMobileFetch('mobile-locations',{method:'GET'});
  if(!j||!j.ok){el.innerHTML='<div class="info-box info-red">'+(j&&j.error||'Gagal memuat lokasi — jalankan SQL mobile + deploy API')+'</div>';return;}
  var items=j.items||[];
  var rows=items.map(function(loc){
    return '<tr><td>'+escapeHtml(loc.nama)+'</td><td>'+escapeHtml(loc.tipe||'')+'</td><td style="font-size:10px">'+loc.lat.toFixed(5)+', '+loc.lon.toFixed(5)+'</td><td>'+loc.radius_m+' m</td><td>'+(loc.aktif?'<span class="bdg b-teal">Aktif</span>':'<span class="bdg b-gray">Off</span>')+'</td><td><button class="btn btn-sm btn-out" onclick="editMobileLocation(\''+loc.id+'\')">Edit</button></td></tr>';
  }).join('');
  el.innerHTML='<div class="card"><div class="flb mb2"><div class="ct" style="margin:0;border:0;padding:0">Lokasi check-in GPS</div><button class="btn btn-sm btn-p" onclick="editMobileLocation()">+ Lokasi</button></div>'
    +'<table><thead><tr><th>Nama</th><th>Tipe</th><th>Koordinat</th><th>Radius</th><th>Status</th><th></th></tr></thead><tbody>'
    +(rows||'<tr><td colspan="6" style="text-align:center;color:#9ca3af">Belum ada lokasi</td></tr>')+'</tbody></table></div>';
}
async function editMobileLocation(id){
  var loc=null;
  if(id){
    var j=await sigajiMobileFetch('mobile-locations',{method:'GET'});
    if(j&&j.ok)loc=(j.items||[]).find(function(x){return x.id===id;});
  }
  var nama=prompt('Nama lokasi',loc?loc.nama:'Site luar kota');if(nama===null)return;
  var lat=prompt('Latitude',loc?String(loc.lat):'-6.2');if(lat===null)return;
  var lon=prompt('Longitude',loc?String(loc.lon):'106.8');if(lon===null)return;
  var radius=prompt('Radius (meter)',loc?String(loc.radius_m):'250');if(radius===null)return;
  var tipe=prompt('Tipe: kantor|site|mess|dinas|lainnya',loc?loc.tipe:'site');if(tipe===null)return;
  var body={action:'save_location',id:loc?loc.id:null,nama:nama,lat:parseFloat(lat),lon:parseFloat(lon),radius_m:parseInt(radius,10)||200,tipe:tipe,aktif:true};
  var r=await sigajiMobileFetch('mobile-locations',{method:'POST',body:body});
  if(r&&r.ok){toast('Lokasi disimpan');renderMobileLocations();}else toast((r&&r.error)||'Gagal simpan');
}
// ── HRD: Penugasan ──────────────────────────────
function mobKarSelectHtml(selectedNik){
  var list=(karyawan||[]).slice().sort(function(a,b){return String(a.nama||'').localeCompare(String(b.nama||''));});
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
  return '<div id="mob-assign-form" class="card" style="background:#f8fafc;border:1px solid #e2e8f0;margin-bottom:.85rem">'
    +'<div class="ct" style="margin:0 0 .75rem;border:0;padding:0">'+(editRow?'Edit penugasan':'Tambah penugasan baru')+'</div>'
    +'<input type="hidden" id="mob-assign-edit-id" value="'+(editRow?escapeHtml(editRow.id):'')+'">'
    +'<div class="fg"><label>Karyawan</label><select id="mob-assign-nik" style="width:100%">'+mobKarSelectHtml(editRow?editRow.nik:'')+'</select></div>'
    +'<div class="fg"><label>Lokasi check-in</label><select id="mob-assign-loc" style="width:100%">'+mobLocSelectHtml(locations,editRow?editRow.location_id:'')+'</select></div>'
    +'<div class="fg2"><div class="fg"><label>Tanggal mulai</label><input type="date" id="mob-assign-from" value="'+escapeHtml(df)+'"></div>'
    +'<div class="fg"><label>Tanggal selesai</label><input type="date" id="mob-assign-to" value="'+escapeHtml(dt)+'"></div></div>'
    +'<label style="display:flex;align-items:center;gap:.4rem;font-size:12px;margin-bottom:.65rem;cursor:pointer">'
    +'<input type="checkbox" id="mob-assign-sat" '+(sat?'checked':'')+' style="width:16px;height:16px"> Sabtu termasuk hari kerja di lokasi ini</label>'
    +'<div class="fg"><label>Catatan (opsional)</label><input type="text" id="mob-assign-cat" value="'+escapeHtml(cat)+'" placeholder="Mis. proyek Site B"></div>'
    +'<div class="fl gap1"><button type="button" class="btn btn-sm btn-p" onclick="saveMobileAssignment()">Simpan penugasan</button>'
    +(editRow?'<button type="button" class="btn btn-sm btn-out" onclick="renderMobileAssignments()">Batal</button>':'')
    +'</div></div>';
}
async function renderMobileAssignments(){
  var el=document.getElementById('mob-assign-wrap');if(!el)return;
  el.innerHTML='<div style="color:#6b7280;padding:1rem">Memuat…</div>';
  var jAssign=await sigajiMobileFetch('mobile-locations?kind=assignments',{method:'GET'});
  var jLoc=await sigajiMobileFetch('mobile-locations',{method:'GET'});
  if(!jAssign||!jAssign.ok){el.innerHTML='<div class="info-box info-red">'+(jAssign&&jAssign.error||'Gagal memuat penugasan')+'</div>';return;}
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
    return '<tr><td>'+escapeHtml(lbl)+'</td><td>'+escapeHtml(loc.nama||'-')+'</td><td>'+escapeHtml(a.date_from)+' → '+escapeHtml(a.date_to)+'</td><td>'+(a.works_saturday?'Ya':'Tidak')+'</td><td><div class="fl gap1"><button type="button" class="btn btn-sm btn-out" onclick="editMobileAssignment(\''+a.id+'\')">Edit</button><button type="button" class="btn btn-sm btn-r" onclick="deleteMobileAssignment(\''+a.id+'\')">Hapus</button></div></td></tr>';
  }).join('');
  el.innerHTML=mobAssignFormHtml(locations,null)
    +'<div class="card"><div class="ct" style="margin:0 0 .5rem;border:0;padding:0">Daftar penugasan</div>'
    +'<p style="font-size:11px;color:#6b7280;margin:0 0 .75rem">Tim menginap luar kota: pilih karyawan, lokasi mess/site, dan rentang tanggal.</p>'
    +'<table><thead><tr><th>Karyawan</th><th>Lokasi</th><th>Rentang</th><th>Sabtu</th><th></th></tr></thead><tbody>'
    +(rows||'<tr><td colspan="5" style="text-align:center;color:#9ca3af">Belum ada penugasan</td></tr>')
    +'</tbody></table></div>';
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
    return '<tr><td>'+escapeHtml(lbl)+'</td><td>'+escapeHtml(loc.nama||'-')+'</td><td>'+escapeHtml(a.date_from)+' → '+escapeHtml(a.date_to)+'</td><td>'+(a.works_saturday?'Ya':'Tidak')+'</td><td><div class="fl gap1"><button type="button" class="btn btn-sm btn-out" onclick="editMobileAssignment(\''+a.id+'\')">Edit</button><button type="button" class="btn btn-sm btn-r" onclick="deleteMobileAssignment(\''+a.id+'\')">Hapus</button></div></td></tr>';
  }).join('');
  el.innerHTML=mobAssignFormHtml(locations,row)
    +'<div class="card"><div class="ct" style="margin:0 0 .5rem;border:0;padding:0">Daftar penugasan</div>'
    +'<table><thead><tr><th>Karyawan</th><th>Lokasi</th><th>Rentang</th><th>Sabtu</th><th></th></tr></thead><tbody>'
    +(rows||'<tr><td colspan="5" style="text-align:center;color:#9ca3af">Belum ada</td></tr>')
    +'</tbody></table></div>';
  try{document.getElementById('mob-assign-form')&&document.getElementById('mob-assign-form').scrollIntoView({behavior:'smooth',block:'start'});}catch(e){}
}
async function deleteMobileAssignment(id){
  if(!confirm('Hapus penugasan ini?'))return;
  var r=await sigajiMobileFetch('mobile-locations',{method:'POST',body:{action:'delete_assignment',id:id}});
  if(r&&r.ok){toast('Dihapus');renderMobileAssignments();}else toast((r&&r.error)||'Gagal');
}
// ── HRD: Approve cuti ───────────────────────────
async function renderMobileLeavePending(){
  var el=document.getElementById('mob-leave-wrap');if(!el)return;
  el.innerHTML='<div style="color:#6b7280;padding:1rem">Memuat…</div>';
  var j=await sigajiMobileFetch('mobile-leave?status=pending',{method:'GET'});
  if(!j||!j.ok){el.innerHTML='<div class="info-box info-red">'+(j&&j.error||'Gagal memuat pengajuan')+'</div>';return;}
  var items=j.items||[];
  if(!items.length){el.innerHTML='<div class="card"><div class="ct">Pengajuan cuti / izin / sakit</div><p style="color:#6b7280;font-size:12px">Tidak ada antrian pending.</p></div>';return;}
  el.innerHTML='<div class="card"><div class="ct">Pengajuan menunggu persetujuan</div>'
    +items.map(function(r){
      var att=r.attachment_path?'<div style="font-size:10px;color:#1a56a0">📎 Surat: '+escapeHtml(r.attachment_path)+'</div>':'';
      return '<div class="mob-leave-card" style="border:1px solid #e5e7eb;border-radius:10px;padding:.75rem;margin-bottom:.6rem">'
        +'<div style="font-weight:700">'+escapeHtml(r.nama_karyawan||r.nik)+' <span class="bdg b-info">'+escapeHtml(r.request_type)+'</span></div>'
        +'<div style="font-size:12px;color:#374151">'+r.date_from+' → '+r.date_to+'</div>'
        +'<div style="font-size:11px;color:#6b7280;margin-top:4px">'+escapeHtml(r.reason||'-')+'</div>'+att
        +'<div class="fl gap1" style="margin-top:.5rem">'
        +'<button class="btn btn-sm btn-g" onclick="mobileLeaveDecide(\''+r.id+'\',\'approve\')">Setujui</button>'
        +'<button class="btn btn-sm btn-r" onclick="mobileLeaveDecide(\''+r.id+'\',\'reject\')">Tolak</button></div></div>';
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
  if(decide==='approve'){
    var rowEl=document.getElementById('mob-leave-wrap');
    toast('API gagal — coba sinkron manual dari kalender');
  }else toast((r&&r.error)||'Gagal');
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
    +(cloud?'<p style="font-size:11px;color:#6b7280">Sakit wajib upload surat dokter sejak hari pertama. Setelah disetujui HRD, kalender absensi ter-update otomatis.</p>'
      :'<p style="font-size:11px;color:#6b7280">Mode lokal: pengajuan disimpan di browser (cloud diperlukan untuk antrian HRD penuh).</p>')
    +'<div class="fg2"><div class="fg"><label>Jenis</label><select id="mycuti-type"><option value="cuti">Cuti tahunan</option><option value="izin">Izin</option><option value="sakit">Sakit (wajib surat dokter)</option></select></div>'
    +'<div class="fg"><label>Dari</label><input type="date" id="mycuti-from"></div><div class="fg"><label>Sampai</label><input type="date" id="mycuti-to"></div></div>'
    +'<div class="fg"><label>Alasan</label><textarea id="mycuti-reason" rows="2" style="width:100%"></textarea></div>'
    +'<div class="fg" id="mycuti-file-wrap" style="display:none"><label>Surat dokter (wajib)</label><input type="file" id="mycuti-file" accept="image/*,.pdf"></div>'
    +'<button class="btn btn-p btn-sm" onclick="submitMyCutiRequest()">Kirim pengajuan</button>'
    +'<div id="mycuti-requests-list" class="mt1"></div></div>';
  var sel=document.getElementById('mycuti-type');
  if(sel)sel.onchange=function(){
    var w=document.getElementById('mycuti-file-wrap');
    if(w)w.style.display=sel.value==='sakit'?'block':'none';
  };
  loadMyCutiRequests();
}
async function loadMyCutiRequests(){
  var el=document.getElementById('mycuti-requests-list');if(!el)return;
  var j=await sigajiMobileFetch('mobile-leave',{method:'POST',body:{action:'my_list'}});
  if(!j||!j.ok){el.innerHTML='<div style="font-size:11px;color:#9ca3af">Riwayat pengajuan (cloud): '+(j&&j.error||'-')+'</div>';return;}
  var items=j.items||[];
  el.innerHTML='<div style="font-size:11px;font-weight:700;color:#6b7280;margin-bottom:.35rem">Riwayat pengajuan</div>'
    +(items.length?items.map(function(r){
      var st=r.status==='approved'?'b-teal':r.status==='rejected'?'b-err':'b-warn';
      return '<div style="font-size:11px;padding:.4rem 0;border-bottom:1px solid #f3f4f6">'
        +'<span class="bdg '+st+'">'+r.status+'</span> '+r.request_type+' '+r.date_from+'–'+r.date_to+'</div>';
    }).join(''):'<div style="color:#9ca3af">Belum ada</div>');
}
async function submitMyCutiRequest(){
  var type=(document.getElementById('mycuti-type')&&document.getElementById('mycuti-type').value)||'cuti';
  var df=document.getElementById('mycuti-from')&&document.getElementById('mycuti-from').value;
  var dt=document.getElementById('mycuti-to')&&document.getElementById('mycuti-to').value;
  var reason=(document.getElementById('mycuti-reason')&&document.getElementById('mycuti-reason').value)||'';
  if(!df||!dt){toast('Isi tanggal');return;}
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
