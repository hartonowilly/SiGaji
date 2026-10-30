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
  if(v<21){
    var normSik=typeof sigajiNormalizeSiklusGaji==='function'?sigajiNormalizeSiklusGaji:function(x){
      var s=String(x==null?'':x).toLowerCase().replace(/[\s-]+/g,'_');
      if(s==='harian'||s==='mingguan'||s==='dua_mingguan')return s;
      return 'bulanan';
    };
    if(typeof sigajiMigrateKaryawanSiklusGaji==='function')sigajiMigrateKaryawanSiklusGaji(db.karyawan);
    else (Array.isArray(db.karyawan)?db.karyawan:[]).forEach(function(k){
      if(!k||typeof k!=='object')return;
      k.siklus_gaji=normSik(k.siklus_gaji);
    });
    var snaps21=db.karSnapshot&&typeof db.karSnapshot==='object'?db.karSnapshot:{};
    Object.keys(snaps21).forEach(function(pn){
      var per=snaps21[pn];
      if(!per||typeof per!=='object')return;
      Object.keys(per).forEach(function(nik){
        var snap=per[nik];
        if(!snap||typeof snap!=='object')return;
        snap.siklus_gaji=normSik(snap.siklus_gaji);
      });
    });
    v=21;
  }
  if(v<22){
    var remapSik=typeof sigajiNormalizeSiklusGaji==='function'?sigajiNormalizeSiklusGaji:function(x){
      var s=String(x==null?'':x).toLowerCase().replace(/[\s-]+/g,'_');
      if(s==='harian')return 'harian';
      if(s==='mingguan'||s==='dua_mingguan'||s==='2_mingguan'||s==='biweekly')return 'mingguan';
      return 'bulanan';
    };
    if(typeof sigajiMigrateKaryawanSiklusGaji==='function')sigajiMigrateKaryawanSiklusGaji(db.karyawan);
    else (Array.isArray(db.karyawan)?db.karyawan:[]).forEach(function(k){
      if(!k||typeof k!=='object')return;
      k.siklus_gaji=remapSik(k.siklus_gaji);
    });
    var snaps22=db.karSnapshot&&typeof db.karSnapshot==='object'?db.karSnapshot:{};
    Object.keys(snaps22).forEach(function(pn){
      var per=snaps22[pn];
      if(!per||typeof per!=='object')return;
      Object.keys(per).forEach(function(nik){
        var snap=per[nik];
        if(!snap||typeof snap!=='object')return;
        snap.siklus_gaji=remapSik(snap.siklus_gaji);
      });
    });
    v=22;
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
/** Salinan penuh di localStorage hanya di bawah batas ini; kuota browser ±5 jt karakter dibagi dengan sesi login. */
const LS_FULL_MAX_CHARS=2000000;
/** Field besar yang dibuang dari salinan ringkas localStorage — isi lengkapnya di IndexedDB. */
const LS_SLIM_OMIT=['absensi','lembur','prorata','karSnapshot','auditLog','approvals','notifikasi','tunjVarBulan','thrManual'];
const IDB_KEY_DB='db',IDB_KEY_PREV='db_prev',IDB_KEY_RECOVERY='recovery_last';
const LEGACY_LS_COPY_KEYS=['sigaji_universal','sigaji_universal_prev'];
const LEGACY_LS_BACKUP_KEYS=[['sigaji_recovery_last',IDB_KEY_RECOVERY],['sigaji_db_prev',IDB_KEY_PREV],['sigaji_autobackup','autobackup']];
/** hydrating=true: memori belum lengkap (salinan ringkas) — jangan tulis lokal/awan agar data lengkap tidak tertimpa. */
var sigajiLocalState={lsSlim:false,hydrating:false,cloudApplied:false,prevSaved:false,idbTimer:null,idbFailed:false,warned:false};
function sigajiIsQuotaError(e){
  return !!e&&(e.name==='QuotaExceededError'||e.name==='NS_ERROR_DOM_QUOTA_REACHED'||e.code===22||e.code===1014);
}
function sigajiIdbUsable(){
  return !sigajiLocalState.idbFailed&&!!window.sigajiIdb&&window.sigajiIdb.available();
}
function slimPayload(p){
  var o=Object.assign({},p);
  LS_SLIM_OMIT.forEach(function(k){delete o[k];});
  o._partial=true;
  return o;
}
/** Pulihkan sigaji_db dari salinan sigaji_universal (format lama, sebelum v11.5.98). */
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
let dbLoadCache;
function dbLoad(){
  if(dbLoadCache===undefined)dbLoadCache=dbLoadFromLocalStorage();
  return dbLoadCache;
}
function dbLoadFromLocalStorage(){
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
/** Satu salinan di localStorage: penuh jika muat, ringkas (tanpa field besar) jika IndexedDB memegang salinan lengkap. */
function writeLocalStorageCopy(payload){
  var idbOk=sigajiIdbUsable();
  if(!sigajiLocalState.lsSlim||!idbOk){
    try{
      var raw=JSON.stringify(payload);
      if(raw.length<=LS_FULL_MAX_CHARS||!idbOk){
        localStorage.setItem(DB_KEY,raw);
        sigajiLocalState.lsSlim=false;
        return true;
      }
    }catch(e){
      if(!idbOk){sigajiCatchWarn("js/storage.js",e);return false;}
      if(!sigajiIsQuotaError(e))sigajiCatchWarn("js/storage.js",e);
    }
    sigajiLocalState.lsSlim=true;
  }
  try{
    localStorage.setItem(DB_KEY,JSON.stringify(slimPayload(payload)));
  }catch(e2){
    try{localStorage.removeItem(DB_KEY);}catch(x){sigajiCatchWarn("js/storage.js",x);}
    sigajiCatchWarn("js/storage.js",e2);
  }
  return true;
}
function buildLocalPayload(){
  var p=Object.assign({schemaVersion:SCHEMA_VERSION},currentPayloadLite());
  if(typeof window.sigajiPayloadForLocalSave==='function')p=window.sigajiPayloadForLocalSave(p);
  p._savedAt=Date.now();
  return p;
}
function queueIdbWrite(){
  if(!sigajiIdbUsable())return;
  clearTimeout(sigajiLocalState.idbTimer);
  sigajiLocalState.idbTimer=setTimeout(flushIdbWrite,300);
}
/** Tulis memori ke IndexedDB. Salinan sesi sebelumnya disimpan sekali sebagai db_prev. */
function flushIdbWrite(){
  clearTimeout(sigajiLocalState.idbTimer);
  sigajiLocalState.idbTimer=null;
  if(!sigajiIdbUsable()||sigajiLocalState.hydrating)return Promise.resolve(false);
  var idb=window.sigajiIdb;
  var keepPrev=!sigajiLocalState.prevSaved;
  sigajiLocalState.prevSaved=true;
  var chain=keepPrev
    ?idb.get(IDB_KEY_DB).then(function(old){if(old)return idb.put(IDB_KEY_PREV,old);}).catch(function(e){sigajiCatchWarn("js/storage.js",e);})
    :Promise.resolve();
  return chain.then(function(){
    var p=buildLocalPayload();
    return idb.put(IDB_KEY_DB,p).then(function(){return true;});
  }).catch(function(e){
    sigajiLocalState.idbFailed=true;
    var lsWasSlim=sigajiLocalState.lsSlim;
    sigajiLocalState.lsSlim=false;
    var lsOk=writeLocalStorageCopy(buildLocalPayload());
    if(lsWasSlim||!lsOk)sigajiWarnLocalSaveFailed(e);
    return false;
  });
}
function sigajiWarnLocalSaveFailed(err){
  console.error('Sigaji: simpan lokal gagal',err);
  try{if(typeof sigajiSaveFeedback==='function')sigajiSaveFeedback('error');}catch(e){sigajiCatchWarn("js/storage.js",e);}
  if(sigajiLocalState.warned)return;
  sigajiLocalState.warned=true;
  var cloudOn=typeof window.sigajiQueueCloudSave==='function';
  var msg=cloudOn
    ?'Penyimpanan di perangkat ini penuh — perubahan tetap dikirim ke awan. Jangan tutup halaman sebelum muncul "Cloud tersimpan".'
    :'Penyimpanan di perangkat ini penuh — perubahan bisa hilang saat halaman ditutup. Unduh Backup JSON sekarang.';
  try{if(typeof toast==='function')toast(msg);}catch(e){sigajiCatchWarn("js/storage.js",e);}
}
/** @returns {boolean} false jika tidak ada salinan lokal yang berhasil disimpan. */
function dbSave(o){
  if(sigajiLocalState.hydrating)return true;
  try{
    var payload=Object.assign({schemaVersion:SCHEMA_VERSION},o);
    if(typeof window.sigajiPayloadForLocalSave==='function'){
      payload=window.sigajiPayloadForLocalSave(payload);
    }
    payload._savedAt=Date.now();
    var lsOk=writeLocalStorageCopy(payload);
    queueIdbWrite();
    if(!lsOk&&!sigajiIdbUsable()){
      sigajiWarnLocalSaveFailed(new Error('localStorage penuh dan IndexedDB tidak tersedia'));
      return false;
    }
    showSI();
    return true;
  }catch(e){
    sigajiWarnLocalSaveFailed(e);
    return false;
  }
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
let roles=LS('roles',{Admin:MODULES.map(function(m){return m.id;}),HRD:['dashboard','notifikasi','karyawan.info','kompgaji.tunjvar','kompgaji.bpjs','kompgaji.gaji','absensi.kalender','absensi.cuti','absensi.lokasi','absensi.pengajuan','lembur','thr','master.prs','master.periode','master.umk','master.libur','master.potongan','master.ter','pesangon','kompgaji','penggajian','simulasi','slip','laporan','laporan.rekap','laporan.variance','laporan.pph'],Karyawan:['myslip','mycuti','notifikasi'],Absen:[]});
if(!roles.Absen)roles.Absen=[];
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
/** Salinan memori sebelum ditimpa data awan — disimpan di IndexedDB (bukan localStorage, agar kuota tidak habis). */
function markRecoveryBackup(tag){
  try{
    if(window.sigajiKaryawanRestricted||sigajiLocalState.hydrating||!sigajiIdbUsable())return;
    var p=Object.assign({_tag:tag||'manual',_ts:new Date().toISOString(),schemaVersion:SCHEMA_VERSION},currentPayloadLite());
    if(typeof window.sigajiPayloadForLocalSave==='function')p=window.sigajiPayloadForLocalSave(p);
    var snap=typeof structuredClone==='function'?structuredClone(p):JSON.parse(JSON.stringify(p));
    window.sigajiIdb.put(IDB_KEY_RECOVERY,snap).catch(function(e){sigajiCatchWarn("js/storage.js",e);});
  }catch(e){sigajiCatchWarn("js/storage.js",e);}
}
function saveAll(){
  if(window.sigajiKaryawanRestricted){
    try{
      if(typeof sigajiSortKaryawanByNik==='function')karyawan=sigajiSortKaryawanByNik(karyawan||[]);
      dbSave({karyawan,periodes,hariLibur,masterCuti,absensi,lembur,prorata,approvals,notifikasi,perusahaan,users,roles,thrManual,tunjVarBulan,tunjVarLabels,tunjVarColumns,karSnapshot,auditLog,bentoLayouts,cabang,license:tenantLicense});
    }catch(eKr){sigajiCatchWarn("js/storage.js",eKr);}
    return;
  }
  try{if(typeof sigajiSaveFeedback==='function')sigajiSaveFeedback('saving');}catch(eSf){sigajiCatchWarn("js/storage.js",eSf);}
  try{
    if(typeof sigajiSortKaryawanByNik==='function')karyawan=sigajiSortKaryawanByNik(karyawan||[]);
    dbSave({karyawan,periodes,hariLibur,masterCuti,absensi,lembur,prorata,approvals,notifikasi,perusahaan,users,roles,thrManual,tunjVarBulan,tunjVarLabels,tunjVarColumns,karSnapshot,auditLog,bentoLayouts,cabang,license:tenantLicense});
  }catch(e){
    console.error('saveAll error:',e);
    try{if(typeof sigajiSaveFeedback==='function')sigajiSaveFeedback('error');}catch(eSf2){sigajiCatchWarn("js/storage.js",eSf2);}
  }
  try{
    if(window.sigajiApplyingCloud)return;
    if(sigajiLocalState.hydrating)return;
    if(typeof window.sigajiCanUploadCloudPayload==='function'&&!window.sigajiCanUploadCloudPayload())return;
    if(typeof window.sigajiQueueCloudSave==='function')window.sigajiQueueCloudSave();
  }catch(e){sigajiCatchWarn("js/storage.js",e);}
}
/* ── Jurnal absensi yang belum sampai awan ─────────────────────────────────
 * Klik absensi tersimpan lokal seketika, tetapi baru dikirim ke awan ±2 detik kemudian (debounce + RPC).
 * Bila halaman di-refresh/ditutup sebelum itu selesai, data awan yang dimuat ulang menimpa memori dan
 * klik tadi hilang walau salinan lokalnya ada. Jurnal ini mencatat klik tersebut, memutarnya kembali
 * setelah data awan termuat, lalu mengirimnya lagi. Entri dihapus begitu unggahan berikutnya berhasil. */
var JURNAL_ABSENSI_KEY='sigaji_jurnal_absensi';
var JURNAL_ABSENSI_MAX=300;
var JURNAL_ABSENSI_UMUR_MS=3*24*60*60*1000;
function sigajiJurnalAbsensiBaca(){
  try{
    var raw=localStorage.getItem(JURNAL_ABSENSI_KEY);
    var a=raw?JSON.parse(raw):[];
    return Array.isArray(a)?a:[];
  }catch(e){return [];}
}
function sigajiJurnalAbsensiTulis(list){
  try{
    if(!list.length)localStorage.removeItem(JURNAL_ABSENSI_KEY);
    else localStorage.setItem(JURNAL_ABSENSI_KEY,JSON.stringify(list.slice(-JURNAL_ABSENSI_MAX)));
  }catch(e){sigajiCatchWarn("js/storage.js",e);}
}
/** Catat satu klik absensi (status null = sel dikosongkan). Hanya bila ada awan dan akun boleh mengunggah. */
function sigajiJurnalAbsensiCatat(nik,tgl,status){
  if(typeof window.sigajiQueueCloudSave!=='function')return;
  if(typeof window.sigajiCanUploadCloudPayload==='function'&&!window.sigajiCanUploadCloudPayload())return;
  if(!nik||!tgl)return;
  var list=sigajiJurnalAbsensiBaca().filter(function(e){return !(e&&e.nik===nik&&e.tgl===tgl);});
  list.push({nik:String(nik),tgl:String(tgl),status:status==null?null:String(status),t:Date.now()});
  sigajiJurnalAbsensiTulis(list);
}
/** Unggahan yang payload-nya dibangun pada waktu `sampai` sudah berhasil: entri yang lebih tua tidak perlu lagi. */
function sigajiJurnalAbsensiSelesai(sampai){
  var list=sigajiJurnalAbsensiBaca();
  if(!list.length)return;
  sigajiJurnalAbsensiTulis(list.filter(function(e){return e&&(e.t||0)>sampai;}));
}
/**
 * Putar ulang jurnal ke memori setelah data awan termuat, lalu simpan (= unggah ulang).
 * Entri untuk karyawan yang tidak ada di memori atau tanggal yang sudah terkunci dibuang.
 * @returns {number} jumlah klik yang dipulihkan
 */
function sigajiJurnalAbsensiPutar(){
  var now=Date.now();
  var list=sigajiJurnalAbsensiBaca();
  if(!list.length)return 0;
  var niks=Object.create(null);
  (karyawan||[]).forEach(function(k){if(k&&k.nik)niks[String(k.nik)]=true;});
  var sisa=[];
  list.forEach(function(e){
    if(!e||!e.nik||!e.tgl)return;
    if(now-(e.t||0)>JURNAL_ABSENSI_UMUR_MS)return;
    if(!niks[e.nik])return;
    if(typeof canEditAbsensiPadaTanggalIso==='function'&&!canEditAbsensiPadaTanggalIso(e.tgl))return;
    if(!absensi[e.nik])absensi[e.nik]={};
    if(e.status==null)delete absensi[e.nik][e.tgl];
    else absensi[e.nik][e.tgl]=e.status;
    sisa.push(e);
  });
  sigajiJurnalAbsensiTulis(sisa);
  if(sisa.length)saveAll();
  return sisa.length;
}
if(typeof window!=='undefined'){
  window.sigajiJurnalAbsensiCatat=sigajiJurnalAbsensiCatat;
  window.sigajiJurnalAbsensiSelesai=sigajiJurnalAbsensiSelesai;
  window.sigajiJurnalAbsensiPutar=sigajiJurnalAbsensiPutar;
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
/** Salin field payload (sudah dimigrasi) ke variabel memori. */
function assignDbToMemory(o){
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
  if(!roles.Absen)roles.Absen=[];
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
}
/**
 * Terapkan JSON dari kolom payload Supabase ke variabel memori + penyimpanan lokal (tanpa memicu sync balik).
 * @param {object} payload
 * @param {{skipRecovery?: boolean}} [opts] skipRecovery: jangan timpa salinan pemulihan (dipakai saat memulihkan salinan itu sendiri).
 */
function applyDbFromCloudPayload(payload,opts){
  if(!payload||typeof payload!=='object')return;
  opts=opts||{};
  if(!opts.skipRecovery)markRecoveryBackup('before_cloud_apply');
  var o=migrateStorage(Object.assign({schemaVersion:SCHEMA_VERSION},payload));
  if(cloudPayloadWouldWipeMeaningfulLocal(o)){
    var msg='Sinkron awan ditolak: data di cloud tampak kosong (0 karyawan/periode/user) sementara di perangkat ini masih ada data. Lokal tidak ditimpa. Periksa baris di Supabase atau unggah cadangan (Master → Backup).';
    try{if(typeof toast==='function')toast(msg);}catch(e){sigajiCatchWarn("js/storage.js",e);}
    console.warn('Sigaji:',msg);
    return;
  }
  sigajiLocalState.cloudApplied=true;
  sigajiLocalState.hydrating=false;
  window.sigajiApplyingCloud=true;
  try{
    assignDbToMemory(o);
    var lite={karyawan,periodes,hariLibur,masterCuti,absensi,lembur,prorata,approvals,notifikasi,perusahaan,users,roles,thrManual,tunjVarBulan,tunjVarLabels,tunjVarColumns,karSnapshot,auditLog,bentoLayouts,cabang,license:tenantLicense};
    if(typeof window.sigajiPayloadForLocalSave==='function')lite=window.sigajiPayloadForLocalSave(lite);
    dbSave(lite);
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
  window.sigajiLocalDataIncomplete=function(){return sigajiLocalState.hydrating;};
  window.sigajiFlushLocalSave=flushIdbWrite;
  /** Pulihkan salinan sebelum sinkron awan terakhir (atau salinan awal sesi sebelumnya). @returns {Promise<boolean>} */
  window.sigajiRestoreEmergencyLocalBackup=async function(){
    try{
      var o=null;
      if(sigajiIdbUsable()){
        o=(await window.sigajiIdb.get(IDB_KEY_RECOVERY))||(await window.sigajiIdb.get(IDB_KEY_PREV))||null;
      }
      if(!o){
        var raw=localStorage.getItem('sigaji_recovery_last')||localStorage.getItem('sigaji_db_prev');
        if(raw)o=JSON.parse(raw);
      }
      if(!o)return false;
      o=Object.assign({},o);
      delete o._tag;delete o._ts;delete o._savedAt;delete o._partial;
      applyDbFromCloudPayload(o,{skipRecovery:true});
      if(typeof renderAll==='function')renderAll();
      if(typeof toast==='function')toast('Backup lokal darurat dipulihkan');
      return true;
    }catch(e){
      console.error('restore emergency backup',e);
      return false;
    }
  };
}
/** Salinan ringkas tanpa salinan lengkap: simpan ditahan sampai data awan termuat (login). */
function sigajiWarnPartialLocal(){
  var msg='Data lengkap di perangkat ini tidak ditemukan — menunggu data dari awan. Perubahan belum disimpan sampai login berhasil.';
  console.warn('Sigaji:',msg);
  setTimeout(function(){
    if(!sigajiLocalState.hydrating)return;
    try{if(typeof toast==='function')toast(msg);}catch(e){sigajiCatchWarn("js/storage.js",e);}
  },0);
}
/** Pindahkan cadangan lama dari localStorage ke IndexedDB, lalu hapus salinan dobel agar kuota lega. */
function migrateLegacyLocalCopies(){
  if(dbLoadCache){
    LEGACY_LS_COPY_KEYS.forEach(function(k){try{localStorage.removeItem(k);}catch(e){sigajiCatchWarn("js/storage.js",e);}});
  }
  if(!sigajiIdbUsable())return Promise.resolve();
  var idb=window.sigajiIdb;
  return LEGACY_LS_BACKUP_KEYS.reduce(function(chain,pair){
    return chain.then(function(){
      var raw=localStorage.getItem(pair[0]);
      if(!raw)return;
      var o=null;
      try{o=JSON.parse(raw);}catch(e){o=null;}
      return idb.get(pair[1]).then(function(cur){
        if(!cur&&o)return idb.put(pair[1],o);
      }).then(function(){localStorage.removeItem(pair[0]);});
    });
  },Promise.resolve()).catch(function(e){sigajiCatchWarn("js/storage.js",e);});
}
/**
 * Saat dibuka: jika localStorage hanya punya salinan ringkas / lebih lama, muat salinan lengkap dari IndexedDB.
 * Data awan (login) selalu menang; selama menunggu, simpan lokal & unggah awan ditahan.
 */
function sigajiHydrateLocalAtBoot(){
  var local=dbLoadCache;
  var partial=!!(local&&local._partial);
  if(!sigajiIdbUsable()){
    if(partial){
      sigajiLocalState.hydrating=true;
      sigajiWarnPartialLocal();
    }
    return Promise.resolve(false);
  }
  if(local&&!partial){
    return migrateLegacyLocalCopies().then(function(){return false;});
  }
  sigajiLocalState.hydrating=true;
  return window.sigajiIdb.get(IDB_KEY_DB).then(function(full){
    if(sigajiLocalState.cloudApplied)return false;
    if(!full||typeof full!=='object'){
      if(partial)sigajiWarnPartialLocal();
      else sigajiLocalState.hydrating=false;
      return false;
    }
    var merged=Object.assign({},full);
    if(partial&&(local._savedAt||0)>(full._savedAt||0)){
      Object.keys(local).forEach(function(k){if(LS_SLIM_OMIT.indexOf(k)<0)merged[k]=local[k];});
    }
    delete merged._partial;
    assignDbToMemory(migrateStorage(merged));
    sigajiLocalState.hydrating=false;
    try{
      if(typeof CU!=='undefined'&&CU&&typeof renderAll==='function')renderAll();
    }catch(eR){sigajiCatchWarn("js/storage.js",eR);}
    return true;
  }).catch(function(e){
    sigajiCatchWarn("js/storage.js",e);
    if(partial)sigajiWarnPartialLocal();
    else sigajiLocalState.hydrating=false;
    return false;
  }).then(function(applied){
    return migrateLegacyLocalCopies().then(function(){return applied;});
  });
}
if(typeof window!=='undefined'){
  window.sigajiLocalReady=sigajiHydrateLocalAtBoot();
  window.addEventListener('pagehide',function(){if(sigajiLocalState.idbTimer)flushIdbWrite();});
  document.addEventListener('visibilitychange',function(){
    if(document.visibilityState==='hidden'&&sigajiLocalState.idbTimer)flushIdbWrite();
  });
}
let siT;
function showSI(){
  if(typeof sigajiSaveFeedback==='function'){sigajiSaveFeedback('saved');return;}
  if(typeof sigajiSetSyncStatus==='function')sigajiSetSyncStatus('local');
  const e=document.getElementById('save-ind');if(!e)return;e.textContent='✓ Tersimpan';clearTimeout(siT);siT=setTimeout(()=>e.textContent='',2000);
}
