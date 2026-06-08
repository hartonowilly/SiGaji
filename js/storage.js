function migrateKompgajiRolePerms(r){
  if(!r||typeof r!=='object')return;
  var map={'karyawan.gaji':'kompgaji.gaji','karyawan.bpjs':'kompgaji.bpjs','karyawan.natura':'kompgaji.natura','karyawan.pphret':'kompgaji.pphret','karyawan.ring':'kompgaji.ring'};
  Object.keys(r).forEach(function(roleName){
    if(roleName==='Admin')return;
    var p=r[roleName];
    if(!Array.isArray(p))return;
    Object.keys(map).forEach(function(oldKey){
      var idx=p.indexOf(oldKey);
      if(idx>=0){
        p.splice(idx,1);
        var newKey=map[oldKey];
        if(p.indexOf(newKey)<0)p.push(newKey);
      }
    });
  });
}
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
        toAdd.forEach(function(s){var k=mid+'.'+s;if(p.indexOf(k)<0)p.push(k);});
      }
    });
    r[roleName]=p.filter(function(x){
      for(var mid in SUBTABS){
        if(!SUBTABS[mid]||!SUBTABS[mid].length)continue;
        if(x===mid)return false;
      }
      if(x==='absensi.libur')return false;
      return true;
    });
  });
}
/** Menu digabung: PPh→laporan, Status→backup (Admin). THR tetap modul sendiri. */
function migrateUiMenuMerge(r){
  if(!r||typeof r!=='object')return;
  Object.keys(r).forEach(function(roleName){
    if(roleName==='Admin')return;
    var p=r[roleName];
    if(!Array.isArray(p))return;
    if(p.indexOf('pph')>=0){
      if(p.indexOf('laporan')<0)p.push('laporan');
      if(p.indexOf('laporan.pph')<0)p.push('laporan.pph');
    }
    if(p.indexOf('laporan')>=0&&p.indexOf('laporan.rekap')<0)p.push('laporan.rekap');
    if(p.indexOf('laporan')>=0&&p.indexOf('laporan.variance')<0)p.push('laporan.variance');
    if((p.indexOf('lembur')>=0||p.indexOf('slip')>=0||p.indexOf('penggajian')>=0)&&p.indexOf('thr')<0)p.push('thr');
    r[roleName]=p.filter(function(x){return x!=='pph'&&x!=='sysstatus';});
  });
}
function migrateRoleV11(r){
  if(!r||typeof r!=='object')return;
  Object.keys(r).forEach(function(roleName){
    if(roleName==='Admin')return;
    var p=r[roleName];
    if(!Array.isArray(p))return;
    if(p.indexOf('absensi.lembur')>=0&&p.indexOf('lembur')<0)p.push('lembur');
    if(p.indexOf('kompgaji')>=0&&p.indexOf('kompgaji.tunjvar')<0)p.push('kompgaji.tunjvar');
    r[roleName]=p.filter(function(x){
      return x!=='absensi.lembur'&&x!=='approval'&&x!=='approval.pend'&&x!=='approval.hist';
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
  if(v<7){
    if(db.auditLog===undefined)db.auditLog=[];
    v=7;
  }
  if(v<8){
    if(!db.tunjVarColumns||!Array.isArray(db.tunjVarColumns)||!db.tunjVarColumns.length){
      var L8=db.tunjVarLabels||{};
      db.tunjVarColumns=[
        {id:'v1',nama:(L8.v1!==undefined&&L8.v1!=='')?L8.v1:'Bonus'},
        {id:'v2',nama:(L8.v2!==undefined&&L8.v2!=='')?L8.v2:'Uang Makan'},
        {id:'v3',nama:(L8.v3!==undefined&&L8.v3!=='')?L8.v3:'Lain-lain'}
      ];
    }
    v=8;
  }
  if(v<9){
    if(db.roles)migrateRolePerms(db.roles);
    v=9;
  }
  if(v<10){
    if(db.roles){
      migrateKompgajiRolePerms(db.roles);
      migrateRolePerms(db.roles);
    }
    v=10;
  }
  if(v<11){
    if(db.roles){
      migrateRoleV11(db.roles);
      migrateRolePerms(db.roles);
    }
    v=11;
  }
  if(v<12){
    db.perusahaan=db.perusahaan||{};
    if(db.perusahaan.umk===undefined||typeof db.perusahaan.umk!=='object')db.perusahaan.umk={};
    if(db.roles){
      migrateRolePerms(db.roles);
      if(db.roles.HRD&&Array.isArray(db.roles.HRD)&&db.roles.HRD.indexOf('master.umk')<0)db.roles.HRD.push('master.umk');
    }
    v=12;
  }
  if(v<13){
    (Array.isArray(db.karyawan)?db.karyawan:[]).forEach(function(k){
      if(!k||typeof k!=='object')return;
      if(k.pph_ytd_awal!==undefined&&typeof k.pph_ytd_awal!=='object')delete k.pph_ytd_awal;
    });
    v=13;
  }
  if(v<14){
    if(typeof sigajiMigrateKaryawanTipeKerja==='function')sigajiMigrateKaryawanTipeKerja(db.karyawan);
    else if(Array.isArray(db.karyawan)){
      db.karyawan.forEach(function(k){
        if(!k||typeof k!=='object')return;
        if(k.tipe_kerja==='tidak_tetap'||k.tipe_kerja==='tetap')return;
        var n=String(k.nik||'').trim().toUpperCase();
        k.tipe_kerja=/^NT\d/.test(n)?'tidak_tetap':'tetap';
      });
    }
    v=14;
  }
  if(v<15){
    if(db.roles&&db.roles.HRD&&Array.isArray(db.roles.HRD)){
      ['absensi.lokasi','absensi.pengajuan'].forEach(function(p){
        if(db.roles.HRD.indexOf(p)<0)db.roles.HRD.push(p);
      });
    }
    v=15;
  }
  if(v<16){
    if(Array.isArray(db.karyawan)&&typeof sigajiSortKaryawanByNik==='function'){
      db.karyawan=sigajiSortKaryawanByNik(db.karyawan);
    }
    v=16;
  }
  if(v<17){
    if(db.bentoLayouts===undefined||typeof db.bentoLayouts!=='object')db.bentoLayouts={};
    v=17;
  }
  if(v<18){
    if(!Array.isArray(db.cabang))db.cabang=[];
    if(db.license&&typeof db.license==='object'){
      if(db.license.multiBranchEnabled===undefined)db.license.multiBranchEnabled=false;
      if(db.license.maxBranches===undefined)db.license.maxBranches=1;
    }
    v=18;
  }
  if(v<19){
    var prs19=db.perusahaan||{};
    if(!Array.isArray(db.cabang))db.cabang=[];
    db.cabang.forEach(function(c,i){
      if(!c||typeof c!=='object')return;
      if(c.id==='utama'||i===0){
        if(!c.npwp&&prs19.npwp)c.npwp=prs19.npwp;
        if(c.nitku==null||c.nitku==='')c.nitku=prs19.nitku||'000000';
        if(!c.alamat&&prs19.alamat)c.alamat=prs19.alamat;
        if(!c.namaPemotong&&prs19.nama)c.namaPemotong=prs19.nama;
        if(!c.a1_kota&&prs19.a1_kota)c.a1_kota=prs19.a1_kota;
        if(!c.a1_ttd_nama&&prs19.a1_ttd_nama)c.a1_ttd_nama=prs19.a1_ttd_nama;
        if(!c.a1_ttd_jabatan&&prs19.a1_ttd_jabatan)c.a1_ttd_jabatan=prs19.a1_ttd_jabatan;
        if(c.a1_prefix==null||c.a1_prefix==='')c.a1_prefix=prs19.a1_prefix!=null?prs19.a1_prefix:'A1';
      }
    });
    v=19;
  }
  if(v<20){
    var prs20=db.perusahaan||{};
    var pusatNit=String(prs20.nitku||'000000').trim();
    if(!Array.isArray(db.cabang))db.cabang=[];
    db.cabang.forEach(function(c,i){
      if(!c||typeof c!=='object')return;
      if(c.id==='utama'||i===0)return;
      var n=String(c.nitku!=null?c.nitku:'').trim();
      if(!n||n===pusatNit||n==='000000')c.nitku='';
    });
    v=20;
  }
  db.schemaVersion=v;
  // Idempotent: backup import / schema sudah 4 bisa kehilangan entri pesangon di HRD
  if(db.roles&&db.roles.HRD&&Array.isArray(db.roles.HRD)&&db.roles.HRD.indexOf('pesangon')<0)db.roles.HRD.push('pesangon');
  if(db.roles&&db.roles.HRD&&Array.isArray(db.roles.HRD)&&db.roles.HRD.indexOf('simulasi')<0)db.roles.HRD.push('simulasi');
  if(db.roles)migrateUiMenuMerge(db.roles);
  if(db.karSnapshot===undefined)db.karSnapshot={};
  if(db.auditLog===undefined)db.auditLog=[];
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
      schemaVersion:8,
      karyawan:o.karyawan||[],
      periodes:o.periodes||[],
      hariLibur:o.hariLibur||[],
      masterCuti:o.masterCuti||{kuota:12,carryover:'no',cbPotong:true},
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
      tunjVarColumns:o.tunjVarColumns||[
        {id:'v1',nama:(o.tunjVarLabels&&o.tunjVarLabels.v1)||'Bonus'},
        {id:'v2',nama:(o.tunjVarLabels&&o.tunjVarLabels.v2)||'Uang Makan'},
        {id:'v3',nama:(o.tunjVarLabels&&o.tunjVarLabels.v3)||'Lain-lain'}
      ],
      karSnapshot:o.karSnapshot||{},
      auditLog:o.auditLog||[]
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
      try{localStorage.setItem(DB_KEY,JSON.stringify(db));}catch(e){sigajiCatchWarn("js/storage.js",e);}
    }
    return db;
  }catch(e){
    console.error('dbLoad error:',e);
    try{localStorage.removeItem(DB_KEY);}catch(x){sigajiCatchWarn("js/storage.js",x);}
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
    try{
      var prevRaw=localStorage.getItem(DB_KEY);
      if(prevRaw)localStorage.setItem('sigaji_db_prev',prevRaw);
    }catch(e0){sigajiCatchWarn("js/storage.js",e0);}
    const payload=Object.assign({schemaVersion:SCHEMA_VERSION},o);
    localStorage.setItem(DB_KEY,JSON.stringify(payload));
    showSI();
  }catch(e){sigajiCatchWarn("js/storage.js",e);}
}
function LS(k,d){const db=dbLoad();return db&&db[k]!==undefined?db[k]:d;}
let karyawan=LS('karyawan',[]);
if(typeof sigajiSortKaryawanByNik==='function')karyawan=sigajiSortKaryawanByNik(karyawan);
let periodes=LS('periodes',[]);
let hariLibur=LS('hariLibur',[]);
let masterCuti=LS('masterCuti',{kuota:12,carryover:'no',cbPotong:true});
let absensi=LS('absensi',{});
let lembur=LS('lembur',{});
let prorata=LS('prorata',{});
let approvals=LS('approvals',[]);
let notifikasi=LS('notifikasi',[]);
let perusahaan=LS('perusahaan',{nama:'',npwp:'',alamat:'',telp:'',email:'',web:'',logo:'',hariKerja:6,ptkp_nilai:{},umk:{},aturan_potongan:{cuti_dalam_kuota:{mode:'tidak_dipotong',nilai:0},cuti_luar_kuota:{mode:'prorata',nilai:0},izin:{mode:'prorata',nilai:0},sakit:{mode:'prorata',nilai:0},setengah_sakit:{mode:'prorata_setengah',nilai:0},setengah_ijin:{mode:'prorata_setengah',nilai:0},alpha:{mode:'prorata',nilai:0}}});
let users=LS('users',[{username:'admin',password:'admin123',role:'Admin',nama:'Administrator',nik:null,aktif:true},{username:'hrd',password:'hrd123',role:'HRD',nama:'Budi HR',nik:null,aktif:true},{username:'karyawan',password:'kar123',role:'Karyawan',nama:'Sari Dewi',nik:null,aktif:true}]);
let roles=LS('roles',{Admin:MODULES.map(function(m){return m.id;}),HRD:['dashboard','notifikasi','karyawan.info','kompgaji.tunjvar','kompgaji.bpjs','kompgaji.gaji','absensi.kalender','absensi.cuti','absensi.lokasi','absensi.pengajuan','lembur','thr','master.prs','master.periode','master.umk','master.libur','master.potongan','master.ter','pesangon','kompgaji','penggajian','simulasi','slip','laporan','laporan.rekap','laporan.variance','laporan.pph'],Karyawan:['myslip','mycuti','notifikasi']});
let thrManual=LS('thrManual',{});
let tunjVarBulan=LS('tunjVarBulan',{});
let tunjVarLabels=LS('tunjVarLabels',{v1:'Bonus',v2:'Uang Makan',v3:'Lain-lain'});
let tunjVarColumns=LS('tunjVarColumns',[
  {id:'v1',nama:'Bonus'},
  {id:'v2',nama:'Uang Makan'},
  {id:'v3',nama:'Lain-lain'}
]);
let karSnapshot=LS('karSnapshot',{});
let auditLog=LS('auditLog',[]);
let bentoLayouts=LS('bentoLayouts',{});
if(!bentoLayouts||typeof bentoLayouts!=='object')bentoLayouts={};
let cabang=LS('cabang',[]);
if(!Array.isArray(cabang))cabang=[];
let tenantLicense=LS('license',{maxEmployees:0,planLabel:'',multiBranchEnabled:false,maxBranches:1});
if(!tenantLicense||typeof tenantLicense!=='object')tenantLicense={maxEmployees:0,planLabel:'',multiBranchEnabled:false,maxBranches:1};
tenantLicense.maxEmployees=parseInt(tenantLicense.maxEmployees,10)>0?parseInt(tenantLicense.maxEmployees,10):0;
tenantLicense.planLabel=String(tenantLicense.planLabel||'').trim();
tenantLicense.multiBranchEnabled=!!tenantLicense.multiBranchEnabled;
tenantLicense.maxBranches=parseInt(tenantLicense.maxBranches,10)>0?parseInt(tenantLicense.maxBranches,10):1;
let CU=null,cpNik=null;
const bmState={};
function currentPayloadLite(){
  return {karyawan,periodes,hariLibur,masterCuti,absensi,lembur,prorata,approvals,notifikasi,perusahaan,users,roles,thrManual,tunjVarBulan,tunjVarLabels,tunjVarColumns,karSnapshot,auditLog,bentoLayouts,cabang,license:tenantLicense};
}
function markRecoveryBackup(tag){
  try{
    var p=Object.assign({_tag:tag||'manual',_ts:new Date().toISOString(),schemaVersion:SCHEMA_VERSION},currentPayloadLite());
    localStorage.setItem('sigaji_recovery_last',JSON.stringify(p));
  }catch(e){sigajiCatchWarn("js/storage.js",e);}
}
function saveAll(){
  try{if(typeof sigajiSaveFeedback==='function')sigajiSaveFeedback('saving');}catch(eSf){sigajiCatchWarn("js/storage.js",eSf);}
  try{
    if(typeof sigajiSortKaryawanByNik==='function')karyawan=sigajiSortKaryawanByNik(karyawan||[]);
    dbSave({karyawan,periodes,hariLibur,masterCuti,absensi,lembur,prorata,approvals,notifikasi,perusahaan,users,roles,thrManual,tunjVarBulan,tunjVarLabels,tunjVarColumns,karSnapshot,auditLog,bentoLayouts,cabang,license:tenantLicense});
  }catch(e){
    console.error('saveAll error:',e);
    try{if(typeof sigajiSaveFeedback==='function')sigajiSaveFeedback('error');}catch(eSf2){sigajiCatchWarn("js/storage.js",eSf2);}
  }
  try{
    try{
      var prevUni=localStorage.getItem('sigaji_universal');
      if(prevUni)localStorage.setItem('sigaji_universal_prev',prevUni);
    }catch(e0){sigajiCatchWarn("js/storage.js",e0);}
    localStorage.setItem('sigaji_universal',JSON.stringify({_meta:{versi:typeof SIGAJI_APP_LABEL!=='undefined'?SIGAJI_APP_LABEL:'SiGaji v10',tanggal:new Date().toISOString(),totalKaryawan:karyawan.length},karyawan,periodes,hariLibur,masterCuti,absensi,lembur,prorata,approvals,notifikasi,perusahaan,users,roles,thrManual,tunjVarBulan,tunjVarLabels,tunjVarColumns,karSnapshot,auditLog,bentoLayouts,cabang,license:tenantLicense}));
  }catch(e){sigajiCatchWarn("js/storage.js",e);}
  try{
    if(window.sigajiApplyingCloud)return;
    if(typeof window.sigajiQueueCloudSave==='function')window.sigajiQueueCloudSave();
  }catch(e){sigajiCatchWarn("js/storage.js",e);}
}
/** True jika menerima payload ini akan mengosongkan data penting yang sudah ada di perangkat (cegah “hilang” setelah login awan). */
function cloudPayloadWouldWipeMeaningfulLocal(o){
  if(!o||typeof o!=='object')return false;
  var locK=(karyawan||[]).length,locP=(periodes||[]).length,locU=(users||[]).length;
  if(locK===0&&locP===0)return false;
  if(Array.isArray(o.karyawan)&&o.karyawan.length===0&&locK>0)return true;
  if(Array.isArray(o.periodes)&&o.periodes.length===0&&locP>0)return true;
  if(Array.isArray(o.users)&&o.users.length===0&&locU>0)return true;
  return false;
}
/** Terapkan JSON dari kolom payload Supabase ke variabel memori + localStorage (tanpa memicu sync balik). */
function applyDbFromCloudPayload(payload){
  if(!payload||typeof payload!=='object')return;
  markRecoveryBackup('before_cloud_apply');
  var o=migrateStorage(Object.assign({schemaVersion:SCHEMA_VERSION},payload));
  if(cloudPayloadWouldWipeMeaningfulLocal(o)){
    var msg='Sinkron awan ditolak: data di cloud tampak kosong (0 karyawan/periode/user) sementara di perangkat ini masih ada data. Lokal tidak ditimpa. Periksa baris di Supabase atau unggah cadangan. Cadangan ringan: localStorage key sigaji_universal / sigaji_db.';
    try{if(typeof toast==='function')toast(msg);}catch(e){sigajiCatchWarn("js/storage.js",e);}
    console.warn('Sigaji:',msg);
    return;
  }
  window.sigajiApplyingCloud=true;
  try{
    if(Array.isArray(o.karyawan)){
      karyawan=typeof sigajiSortKaryawanByNik==='function'?sigajiSortKaryawanByNik(o.karyawan):o.karyawan;
    }
    if(Array.isArray(o.periodes))periodes=o.periodes;
    if(Array.isArray(o.hariLibur))hariLibur=o.hariLibur;
    if(o.masterCuti&&typeof o.masterCuti==='object')masterCuti=o.masterCuti;
    if(o.absensi&&typeof o.absensi==='object')absensi=o.absensi;
    if(o.lembur&&typeof o.lembur==='object')lembur=o.lembur;
    if(o.prorata&&typeof o.prorata==='object')prorata=o.prorata;
    if(Array.isArray(o.approvals))approvals=o.approvals;
    if(Array.isArray(o.notifikasi))notifikasi=o.notifikasi;
    if(o.perusahaan&&typeof o.perusahaan==='object')perusahaan=o.perusahaan;
    if(Array.isArray(o.users))users=o.users;
    if(o.roles&&typeof o.roles==='object')roles=o.roles;
    if(o.thrManual&&typeof o.thrManual==='object')thrManual=o.thrManual;
    if(o.tunjVarBulan&&typeof o.tunjVarBulan==='object')tunjVarBulan=o.tunjVarBulan;
    if(o.tunjVarLabels&&typeof o.tunjVarLabels==='object')tunjVarLabels=o.tunjVarLabels;
    if(Array.isArray(o.tunjVarColumns))tunjVarColumns=o.tunjVarColumns;
    if(o.karSnapshot&&typeof o.karSnapshot==='object')karSnapshot=o.karSnapshot;
    if(Array.isArray(o.auditLog))auditLog=o.auditLog;
    if(o.bentoLayouts&&typeof o.bentoLayouts==='object')bentoLayouts=o.bentoLayouts;
    if(Array.isArray(o.cabang))cabang=o.cabang;
    if(o.license&&typeof o.license==='object'){
      tenantLicense.maxEmployees=parseInt(o.license.maxEmployees,10)>0?parseInt(o.license.maxEmployees,10):0;
      tenantLicense.planLabel=String(o.license.planLabel||'').trim();
      tenantLicense.multiBranchEnabled=!!o.license.multiBranchEnabled;
      tenantLicense.maxBranches=parseInt(o.license.maxBranches,10)>0?parseInt(o.license.maxBranches,10):1;
      try{if(typeof window.sigajiApplyLicenseFromObject==='function')window.sigajiApplyLicenseFromObject(tenantLicense);}catch(eL){sigajiCatchWarn("js/storage.js",eL);}
      try{if(typeof window.sigajiApplyBranchPolicyFromObject==='function')window.sigajiApplyBranchPolicyFromObject(o.license);}catch(eBr){sigajiCatchWarn("js/storage.js",eBr);}
    }
    dbSave({karyawan,periodes,hariLibur,masterCuti,absensi,lembur,prorata,approvals,notifikasi,perusahaan,users,roles,thrManual,tunjVarBulan,tunjVarLabels,tunjVarColumns,karSnapshot,auditLog,bentoLayouts,cabang,license:tenantLicense});
    try{
      localStorage.setItem('sigaji_universal',JSON.stringify({_meta:{versi:typeof SIGAJI_APP_LABEL!=='undefined'?SIGAJI_APP_LABEL:'SiGaji v10',tanggal:new Date().toISOString(),totalKaryawan:karyawan.length},karyawan,periodes,hariLibur,masterCuti,absensi,lembur,prorata,approvals,notifikasi,perusahaan,users,roles,thrManual,tunjVarBulan,tunjVarLabels,tunjVarColumns,karSnapshot,auditLog,bentoLayouts,cabang,license:tenantLicense}));
    }catch(e2){sigajiCatchWarn("js/storage.js",e2);}
    showSI();
    try{if(typeof applyBranding==='function')applyBranding();}catch(eB){sigajiCatchWarn("js/storage.js",eB);}
    try{if(o.perusahaan&&typeof o.perusahaan==='object')window.sigajiLoginBranding={nama:o.perusahaan.nama||'',logo:o.perusahaan.logo||''};}catch(eC){sigajiCatchWarn("js/storage.js",eC);}
    try{if(typeof window.sigajiRenderLicenseQuotaUi==='function')window.sigajiRenderLicenseQuotaUi();}catch(eR){sigajiCatchWarn("js/storage.js",eR);}
  }finally{
    window.sigajiApplyingCloud=false;
  }
}
/** Jangan unggah ke Supabase jika isinya masih “template kosong” — bisa menimpa satu payload tenant penuh. */
function shouldSkipCloudUpload(payload){
  if(!payload||typeof payload!=='object')return true;
  if((payload.karyawan||[]).length>0||(payload.periodes||[]).length>0)return false;
  if(Object.keys(payload.absensi||{}).length>0)return false;
  var u=payload.users||[];
  if(u.length!==3)return false;
  if(u.map(function(x){return String(x.username||'')}).sort().join(',')!=='admin,hrd,karyawan')return false;
  return true;
}
function getPayloadForCloud(){
  var p=migrateStorage(Object.assign({schemaVersion:SCHEMA_VERSION},{
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
    tunjVarColumns:tunjVarColumns,
    karSnapshot:karSnapshot,
    auditLog:auditLog,
    bentoLayouts:bentoLayouts,
    cabang:cabang
  }));
  delete p.license;
  return p;
}
if(typeof window!=='undefined'){
  window.applyDbFromCloudPayload=applyDbFromCloudPayload;
  window.getPayloadForCloud=getPayloadForCloud;
  window.cloudPayloadWouldWipeMeaningfulLocal=cloudPayloadWouldWipeMeaningfulLocal;
  window.sigajiShouldSkipCloudUpload=shouldSkipCloudUpload;
  window.sigajiRestoreEmergencyLocalBackup=function(){
    try{
      var raw=localStorage.getItem('sigaji_recovery_last')||localStorage.getItem('sigaji_db_prev');
      if(!raw)return false;
      var o=JSON.parse(raw);
      applyDbFromCloudPayload(o);
      if(typeof renderAll==='function')renderAll();
      if(typeof toast==='function')toast('Backup lokal darurat dipulihkan');
      return true;
    }catch(e){
      console.error('restore emergency backup',e);
      return false;
    }
  };
}
let siT;
function showSI(){
  if(typeof sigajiSaveFeedback==='function'){sigajiSaveFeedback('saved');return;}
  if(typeof sigajiSetSyncStatus==='function')sigajiSetSyncStatus('local');
  const e=document.getElementById('save-ind');if(!e)return;e.textContent='✓ Tersimpan';clearTimeout(siT);siT=setTimeout(()=>e.textContent='',2000);
}
