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
  if(!file||!window.sigajiSupabase){toast('Upload butuh Supabase + bucket sigaji-mobile');return null;}
  var tenant=(window.SIGAJI_TENANT_KEY||'main').trim()||'main';
  var nik=(CU&&CU.nik)||'unknown';
  var ext=(file.name&&file.name.indexOf('.')>=0)?file.name.split('.').pop():'jpg';
  var path=tenant+'/'+subfolder+'/'+nik+'/'+Date.now()+'.'+ext;
  var bucket='sigaji-mobile';
  var up=await window.sigajiSupabase.storage.from(bucket).upload(path,file,{upsert:false});
  if(up.error){toast('Upload gagal: '+(up.error.message||''));return null;}
  return path;
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
async function renderMobileAssignments(){
  var el=document.getElementById('mob-assign-wrap');if(!el)return;
  el.innerHTML='<div style="color:#6b7280;padding:1rem">Memuat…</div>';
  var j=await sigajiMobileFetch('mobile-locations?kind=assignments',{method:'GET'});
  if(!j||!j.ok){el.innerHTML='<div class="info-box info-red">'+(j&&j.error||'Gagal memuat penugasan')+'</div>';return;}
  var items=j.items||[];
  var rows=items.map(function(a){
    var loc=a.sigaji_work_locations||{};
    return '<tr><td>'+escapeHtml(a.nik)+'</td><td>'+escapeHtml(loc.nama||'-')+'</td><td>'+a.date_from+' → '+a.date_to+'</td><td>'+(a.works_saturday?'Ya':'Tidak')+'</td><td><button class="btn btn-sm btn-r" onclick="deleteMobileAssignment(\''+a.id+'\')">Hapus</button></td></tr>';
  }).join('');
  el.innerHTML='<div class="card"><div class="flb mb2"><div class="ct" style="margin:0;border:0;padding:0">Penugasan lokasi (HRD)</div><button class="btn btn-sm btn-p" onclick="addMobileAssignment()">+ Penugasan</button></div>'
    +'<p style="font-size:11px;color:#6b7280;margin:0 0 .75rem">Karyawan menginap luar kota: set rentang tanggal + lokasi mess/site. <strong>Sabtu ikut kerja</strong> (default).</p>'
    +'<table><thead><tr><th>NIK</th><th>Lokasi</th><th>Rentang</th><th>Sabtu</th><th></th></tr></thead><tbody>'
    +(rows||'<tr><td colspan="5" style="text-align:center;color:#9ca3af">Belum ada penugasan</td></tr>')+'</tbody></table></div>';
}
async function addMobileAssignment(){
  var nik=prompt('NIK karyawan');if(!nik)return;
  var j=await sigajiMobileFetch('mobile-locations',{method:'GET'});
  if(!j||!j.ok||!(j.items||[]).length){toast('Buat lokasi kerja dulu');return;}
  var list=(j.items||[]).map(function(l,i){return (i+1)+'. '+l.nama+' ['+l.id+']';}).join('\n');
  var pick=prompt('Pilih location_id:\n'+list);if(!pick)return;
  var df=prompt('Tanggal mulai (YYYY-MM-DD)');if(!df)return;
  var dt=prompt('Tanggal akhir (YYYY-MM-DD)');if(!dt)return;
  var sat=confirm('Sabtu termasuk hari kerja di lokasi ini?');
  var r=await sigajiMobileFetch('mobile-locations',{method:'POST',body:{action:'save_assignment',nik:nik.trim(),location_id:pick.trim(),date_from:df,date_to:dt,works_saturday:sat}});
  if(r&&r.ok){toast('Penugasan disimpan');renderMobileAssignments();}else toast((r&&r.error)||'Gagal');
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
