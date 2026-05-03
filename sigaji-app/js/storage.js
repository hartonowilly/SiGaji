function migrateRolePerms(r){
  if(!r||typeof r!=='object')return;
  Object.keys(r).forEach(function(roleName){
    if(roleName==='Admin')return;
    var p=r[roleName];
    if(!Array.isArray(p))return;
    Object.keys(SUBTABS).forEach(function(mid){
      var subs=SUBTABS[mid];
      if(!subs||!subs.length)return;
      if(p.indexOf(mid)<0)return;
      var hasExplicit=subs.some(function(s){return p.indexOf(mid+'.'+s)>=0;});
      if(!hasExplicit){
        var toAdd=subs;
        if(mid==='karyawan')toAdd=subs.filter(function(s){return s!=='gaji';});
        toAdd.forEach(function(s){var k=mid+'.'+s;if(p.indexOf(k)<0)p.push(k);});
      }
    });
    r[roleName]=p.filter(function(x){
      for(var mid in SUBTABS){
        if(!SUBTABS[mid]||!SUBTABS[mid].length)continue;
        if(x===mid)return false;
      }
      return true;
    });
  });
}
if(typeof window!=='undefined')window.sigajiMigrateRolePerms=migrateRolePerms;
function migrateStorage(db){
  if(!db||typeof db!=='object')return db;
  var v=db.schemaVersion|0;
  if(v<2){
    db.perusahaan=db.perusahaan||{};
    if(db.perusahaan.ptkp_nilai===undefined)db.perusahaan.ptkp_nilai={};
    v=2;
  }
  if(v<3){
    if(db.roles)migrateRolePerms(db.roles);
    v=3;
  }
  if(v<4){
    if(db.roles&&db.roles.HRD&&Array.isArray(db.roles.HRD)&&db.roles.HRD.indexOf('pesangon')<0)db.roles.HRD.push('pesangon');
    v=4;
  }
  if(v<5){
    if(db.karSnapshot===undefined)db.karSnapshot={};
    v=5;
  }
  if(v<6){
    // Migrator legacy → payroll per periode (snapshot).
    // Buat snapshot untuk periode/karyawan yang belum punya agar histori tidak hilang.
    if(db.karSnapshot===undefined)db.karSnapshot={};
    var ks=db.karSnapshot||{};
    var kars=Array.isArray(db.karyawan)?db.karyawan:[];
    var pers=Array.isArray(db.periodes)?db.periodes:[];
    pers.forEach(function(p){
      var pn=(p&&p.nama)||'';
      var ps=(p&&p.start)||'';
      if(!pn||!ps)return;
      if(!ks[pn])ks[pn]={};
      kars.forEach(function(k){
        if(!k||!k.nik)return;
        var t=String(k.tgl_berhenti||'').trim();
        if(t&&t<ps)return; // sudah keluar sebelum periode mulai
        if(ks[pn][k.nik]!==undefined)return; // sudah ada snapshot
        ks[pn][k.nik]={
          gapok:Math.round(k.gapok||0),
          tunjangan:JSON.parse(JSON.stringify(k.tunjangan||[])),
          potongan:JSON.parse(JSON.stringify(k.potongan||[])),
          natura:JSON.parse(JSON.stringify(k.natura||[])),
          bpjs_aktif:JSON.parse(JSON.stringify(k.bpjs_aktif||{})),
          bpjs_manual:JSON.parse(JSON.stringify(k.bpjs_manual||{})),
          pph_return:JSON.parse(JSON.stringify(k.pph_return||{nilai:0,ket:''})),
        };
      });
    });
    db.karSnapshot=ks;
    v=6;
  }
  db.schemaVersion=v;
  // Idempotent: backup import / schema sudah 4 bisa kehilangan entri pesangon di HRD
  if(db.roles&&db.roles.HRD&&Array.isArray(db.roles.HRD)&&db.roles.HRD.indexOf('pesangon')<0)db.roles.HRD.push('pesangon');
  if(db.karSnapshot===undefined)db.karSnapshot={};
  return db;
}
const DB_KEY='sigaji_db';
/** Pulihkan sigaji_db dari salinan sigaji_universal (backup ringan tiap simpan). */
function recoverDbFromUniversal(){
  try{
    if(localStorage.getItem(DB_KEY))return false;
    const u=localStorage.getItem('sigaji_universal');
    if(!u)return false;
    const o=JSON.parse(u);
    const db={
      schemaVersion:6,
      karyawan:o.karyawan||[],
      periodes:o.periodes||[],
      hariLibur:o.hariLibur||[],
      masterCuti:o.masterCuti||{kuota:12,masaMin:12,carryover:'no',cbPotong:true},
      absensi:o.absensi||{},
      lembur:o.lembur||{},
      prorata:o.prorata||{},
      approvals:o.approvals||[],
      notifikasi:o.notifikasi||[],
      perusahaan:o.perusahaan||{},
      users:o.users||[],
      roles:o.roles||{},
      thrManual:o.thrManual||{},
      tunjVarBulan:o.tunjVarBulan||{},
      tunjVarLabels:o.tunjVarLabels||{v1:'Bonus',v2:'Uang Makan',v3:'Lain-lain'},
      karSnapshot:o.karSnapshot||{}
    };
    localStorage.setItem(DB_KEY,JSON.stringify(migrateStorage(db)));
    return true;
  }catch(e){console.error('recoverDbFromUniversal',e);return false;}
}
function dbLoad(){
  try{
    if(!localStorage.getItem(DB_KEY))recoverDbFromUniversal();
    const raw=localStorage.getItem(DB_KEY);
    if(!raw)return null;
    let db=JSON.parse(raw);
    const snap=JSON.stringify(db);
    db=migrateStorage(db);
    if(JSON.stringify(db)!==snap){
      try{localStorage.setItem(DB_KEY,JSON.stringify(db));}catch(e){}
    }
    return db;
  }catch(e){
    console.error('dbLoad error:',e);
    try{localStorage.removeItem(DB_KEY);}catch(x){}
    if(recoverDbFromUniversal()){
      try{
        const raw3=localStorage.getItem(DB_KEY);
        if(raw3){
          let db2=JSON.parse(raw3);
          return migrateStorage(db2);
        }
      }catch(e2){console.error('dbLoad retry failed',e2);}
    }
    return null;
  }
}
function dbSave(o){
  try{
    const payload=Object.assign({schemaVersion:SCHEMA_VERSION},o);
    localStorage.setItem(DB_KEY,JSON.stringify(payload));
    showSI();
  }catch(e){}
}
function LS(k,d){const db=dbLoad();return db&&db[k]!==undefined?db[k]:d;}
let karyawan=LS('karyawan',[]);
let periodes=LS('periodes',[]);
let hariLibur=LS('hariLibur',[]);
let masterCuti=LS('masterCuti',{kuota:12,masaMin:12,carryover:'no',cbPotong:true});
let absensi=LS('absensi',{});
let lembur=LS('lembur',{});
let prorata=LS('prorata',{});
let approvals=LS('approvals',[]);
let notifikasi=LS('notifikasi',[]);
let perusahaan=LS('perusahaan',{nama:'',npwp:'',alamat:'',telp:'',email:'',web:'',logo:'',hariKerja:6,ptkp_nilai:{},aturan_potongan:{cuti_dalam_kuota:{mode:'tidak_dipotong',nilai:0},cuti_luar_kuota:{mode:'prorata',nilai:0},izin:{mode:'prorata',nilai:0},sakit:{mode:'prorata',nilai:0},setengah_sakit:{mode:'prorata_setengah',nilai:0},setengah_ijin:{mode:'prorata_setengah',nilai:0},alpha:{mode:'prorata',nilai:0}}});
let users=LS('users',[{username:'admin',password:'admin123',role:'Admin',nama:'Administrator',nik:null,aktif:true},{username:'hrd',password:'hrd123',role:'HRD',nama:'Budi HR',nik:null,aktif:true},{username:'karyawan',password:'kar123',role:'Karyawan',nama:'Sari Dewi',nik:null,aktif:true}]);
let roles=LS('roles',{Admin:MODULES.map(m=>m.id),HRD:['dashboard','notifikasi','karyawan.info','karyawan.bpjs','karyawan.ring','absensi.kalender','absensi.cuti','absensi.lembur','absensi.libur','master.prs','master.periode','master.libur','master.potongan','master.ter','approval.pend','approval.hist','thr','pesangon','penggajian','slip','pph','laporan'],Karyawan:['myslip','mycuti','notifikasi']});
let thrManual=LS('thrManual',{});
let tunjVarBulan=LS('tunjVarBulan',{});
let tunjVarLabels=LS('tunjVarLabels',{v1:'Bonus',v2:'Uang Makan',v3:'Lain-lain'});
let karSnapshot=LS('karSnapshot',{});
let CU=null,cpNik=null;
const bmState={};
function saveAll(){
  try{
    dbSave({karyawan,periodes,hariLibur,masterCuti,absensi,lembur,prorata,approvals,notifikasi,perusahaan,users,roles,thrManual,tunjVarBulan,tunjVarLabels,karSnapshot});
  }catch(e){console.error('saveAll error:',e);}
  try{
    localStorage.setItem('sigaji_universal',JSON.stringify({_meta:{versi:'SiGaji v9',tanggal:new Date().toISOString(),totalKaryawan:karyawan.length},karyawan,periodes,hariLibur,masterCuti,absensi,lembur,prorata,approvals,notifikasi,perusahaan,users,roles,thrManual,tunjVarBulan,tunjVarLabels,karSnapshot}));
  }catch(e){}
  try{
    if(window.sigajiApplyingCloud)return;
    if(typeof window.sigajiQueueCloudSave==='function')window.sigajiQueueCloudSave();
  }catch(e){}
}
/** Terapkan JSON dari kolom payload Supabase ke variabel memori + localStorage (tanpa memicu sync balik). */
function applyDbFromCloudPayload(payload){
  if(!payload||typeof payload!=='object')return;
  window.sigajiApplyingCloud=true;
  try{
    var o=migrateStorage(Object.assign({schemaVersion:SCHEMA_VERSION},payload));
    if(o.karyawan!==undefined)karyawan=o.karyawan;
    if(o.periodes!==undefined)periodes=o.periodes;
    if(o.hariLibur!==undefined)hariLibur=o.hariLibur;
    if(o.masterCuti!==undefined)masterCuti=o.masterCuti;
    if(o.absensi!==undefined)absensi=o.absensi;
    if(o.lembur!==undefined)lembur=o.lembur;
    if(o.prorata!==undefined)prorata=o.prorata;
    if(o.approvals!==undefined)approvals=o.approvals;
    if(o.notifikasi!==undefined)notifikasi=o.notifikasi;
    if(o.perusahaan!==undefined)perusahaan=o.perusahaan;
    if(o.users!==undefined)users=o.users;
    if(o.roles!==undefined)roles=o.roles;
    if(o.thrManual!==undefined)thrManual=o.thrManual;
    if(o.tunjVarBulan!==undefined)tunjVarBulan=o.tunjVarBulan;
    if(o.tunjVarLabels!==undefined)tunjVarLabels=o.tunjVarLabels;
    if(o.karSnapshot!==undefined)karSnapshot=o.karSnapshot;
    dbSave({karyawan,periodes,hariLibur,masterCuti,absensi,lembur,prorata,approvals,notifikasi,perusahaan,users,roles,thrManual,tunjVarBulan,tunjVarLabels,karSnapshot});
    try{
      localStorage.setItem('sigaji_universal',JSON.stringify({_meta:{versi:'SiGaji v9',tanggal:new Date().toISOString(),totalKaryawan:karyawan.length},karyawan,periodes,hariLibur,masterCuti,absensi,lembur,prorata,approvals,notifikasi,perusahaan,users,roles,thrManual,tunjVarBulan,tunjVarLabels,karSnapshot}));
    }catch(e2){}
    showSI();
  }finally{
    window.sigajiApplyingCloud=false;
  }
}
function getPayloadForCloud(){
  return migrateStorage(Object.assign({schemaVersion:SCHEMA_VERSION},{
    karyawan:karyawan,
    periodes:periodes,
    hariLibur:hariLibur,
    masterCuti:masterCuti,
    absensi:absensi,
    lembur:lembur,
    prorata:prorata,
    approvals:approvals,
    notifikasi:notifikasi,
    perusahaan:perusahaan,
    users:users,
    roles:roles,
    thrManual:thrManual,
    tunjVarBulan:tunjVarBulan,
    tunjVarLabels:tunjVarLabels,
    karSnapshot:karSnapshot
  }));
}
if(typeof window!=='undefined'){
  window.applyDbFromCloudPayload=applyDbFromCloudPayload;
  window.getPayloadForCloud=getPayloadForCloud;
}
let siT;
function showSI(){const e=document.getElementById('save-ind');if(!e)return;e.textContent='✓ Tersimpan';clearTimeout(siT);siT=setTimeout(()=>e.textContent='',2000);}
