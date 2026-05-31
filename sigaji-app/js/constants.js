const fmtDate=d=>{if(!d||d==='-')return'-';const p=d.split('-');return p.length===3?p[2]+'/'+p[1]+'/'+p[0]:d;};
const fmt=n=>{const v=Math.round(n);if(isNaN(v))return'Rp 0';const abs=Math.abs(v).toString().replace(/\B(?=(\d{3})+(?!\d))/g,'.');return(v<0?'-Rp ':'Rp ')+abs;};
/** Parse teks input rupiah (1.500.000 atau 1500000) → angka bulat. */
function parseRpInput(val){
  if(val==null||val==='')return 0;
  var s=String(val).trim().replace(/Rp/gi,'').replace(/\s/g,'');
  if(s.indexOf(',')>=0){
    var p=s.split(',');
    s=p[0].replace(/\./g,'')+(p[1]?'.'+p[1].replace(/\./g,''):'');
    var f=parseFloat(s);
    return isNaN(f)?0:Math.max(0,Math.round(f));
  }
  s=s.replace(/\./g,'');
  var n=parseInt(s,10);
  return isNaN(n)?0:Math.max(0,n);
}
/** Format angka untuk kotak input (pemisah ribuan titik). */
function formatRpInputNum(n){
  var v=Math.max(0,Math.round(Number(n)||0));
  return v.toString().replace(/\B(?=(\d{3})+(?!\d))/g,'.');
}
/** Pasang format rupiah pada input teks (class inp-rp atau data-rp="1"). */
function sigajiBindRpInputs(root){
  var scope=root||document;
  scope.querySelectorAll('input.inp-rp,input[data-rp="1"]').forEach(function(inp){
    if(inp.dataset.rpBound==='1')return;
    inp.dataset.rpBound='1';
    inp.setAttribute('inputmode','numeric');
    inp.setAttribute('autocomplete','off');
    if(inp.type==='number')inp.type='text';
    if(!inp.dataset.rpEditing){
      var init=inp.value;
      if(init!==''&&init!=null)inp.value=formatRpInputNum(parseRpInput(init));
    }
    inp.addEventListener('focus',function(){
      inp.dataset.rpEditing='1';
      inp.value=String(parseRpInput(inp.value)||'');
      try{inp.select();}catch(e){}
    });
    inp.addEventListener('blur',function(){
      delete inp.dataset.rpEditing;
      var n=parseRpInput(inp.value);
      inp.value=formatRpInputNum(n);
      inp.dataset.rpValue=String(n);
      try{inp.dispatchEvent(new Event('change',{bubbles:true}));}catch(e2){
        if(typeof Event==='function')inp.dispatchEvent(new Event('change'));
      }
    });
  });
}
/** Nilai rupiah ke kata Indonesia (untuk terbilang slip) */
function terbilangRupiah(n){
  const num=Math.floor(Math.abs(Number(n)||0));
  if(num===0)return 'nol rupiah';
  const a=['','satu','dua','tiga','empat','lima','enam','tujuh','delapan','sembilan'];
  function puluhan(x){
    if(x<10)return a[x];
    if(x===10)return 'sepuluh';
    if(x===11)return 'sebelas';
    if(x<20)return a[x-10]+' belas';
    const p=Math.floor(x/10),b=x%10;
    return a[p]+' puluh'+(b?' '+a[b]:'');
  }
  function ratusan(x){
    if(x===0)return '';
    if(x<10)return a[x];
    if(x<100)return puluhan(x);
    const r=Math.floor(x/100),b=x%100;
    const head=r===1?'seratus':a[r]+' ratus';
    return head+(b?' '+ratusan(b):'');
  }
  function rek(x){
    if(x<1000)return ratusan(x);
    if(x<1000000){
      const ribu=Math.floor(x/1000),sisa=x%1000;
      const d=ribu===1?'seribu':ratusan(ribu)+' ribu';
      return d+(sisa?' '+rek(sisa):'');
    }
    if(x<1000000000){
      const jt=Math.floor(x/1000000),sisa=x%1000000;
      return ratusan(jt)+' juta'+(sisa?' '+rek(sisa):'');
    }
    const m=Math.floor(x/1000000000),sisa=x%1000000000;
    return ratusan(m)+' milyar'+(sisa?' '+rek(sisa):'');
  }
  return rek(num)+' rupiah';
}
const DEFAULT_PTKP={TK0:54e6,TK1:58.5e6,TK2:63e6,TK3:67.5e6,K0:58.5e6,K1:63e6,K2:67.5e6,K3:72e6};
const PTKP_KEYS=['TK0','TK1','TK2','TK3','K0','K1','K2','K3'];
const PTKP_LBL={TK0:'TK/0',TK1:'TK/1',TK2:'TK/2',TK3:'TK/3',K0:'K/0',K1:'K/1',K2:'K/2',K3:'K/3'};
const BPJS_DEF={'kes-prs':{pct:4,basis:12e6,lbl:'BPJS Kes Perusahaan (4%)'},'kes-kar':{pct:1,basis:12e6,lbl:'BPJS Kes Karyawan (1%)'},'jht-prs':{pct:3.7,basis:null,lbl:'JHT Perusahaan (3,7%)'},'jht-kar':{pct:2,basis:null,lbl:'JHT Karyawan (2%)'},'jp-prs':{pct:2,basis:9559600,lbl:'JP Perusahaan (2%)'},'jp-kar':{pct:1,basis:9559600,lbl:'JP Karyawan (1%)'},'jkk-prs':{pct:0.24,basis:null,lbl:'JKK Perusahaan (0,24%)'},'jkm-prs':{pct:0.3,basis:null,lbl:'JKM Perusahaan (0,3%)'}};
const TUNJ_TYPES={tetap:'Tetap (BPJS+THR+PPh+TH)',tetap_no_bpjs:'Tetap Excl.BPJS',tidak_tetap:'Tidak Tetap',harian_exclude:'Harian Excl.TH'};
// Sub-tab permissions: moduleId.subtabId
const SUBTABS={
  karyawan:['info'],
  kompgaji:['gaji','tunjvar','bpjs','natura','pphret','ring'],
  absensi:['kalender','cuti'],
  master:['prs','periode','umk','libur','potongan','ter'],
  approval:['pend','hist'],
};
const SUBTAB_LBL={
  'karyawan.info':'Info & Jabatan',
  'kompgaji.gaji':'Gaji & Tunjangan','kompgaji.tunjvar':'Tunjangan Variabel','kompgaji.bpjs':'BPJS','kompgaji.natura':'Natura',
  'kompgaji.pphret':'PPh Return','kompgaji.ring':'Ringkasan',
  'absensi.kalender':'Kalender Absensi','absensi.cuti':'Tracking Cuti',
  'master.prs':'Profil Perusahaan','master.periode':'Periode Gaji & THR','master.umk':'UMK',
  'master.libur':'Hari Libur & Kuota Cuti','master.potongan':'Aturan Potongan','master.ter':'PTKP & TER',
  'approval.pend':'Menunggu','approval.hist':'Riwayat',
};
const MODULES=[
  {id:'dashboard',lbl:'Dashboard',icon:'&#9632;',sec:'Utama'},
  {id:'notifikasi',lbl:'Notifikasi',icon:'&#128276;',sec:'Utama'},
  {id:'karyawan',lbl:'Master Karyawan',icon:'&#128100;',sec:'SDM',subtabs:['info']},
  {id:'absensi',lbl:'Absensi & Cuti',icon:'&#128197;',sec:'SDM',subtabs:['kalender','cuti']},
  {id:'kompgaji',lbl:'Komponen Gaji',icon:'&#128178;',sec:'Penggajian',subtabs:['gaji','tunjvar','bpjs','natura','pphret','ring']},
  {id:'thr',lbl:'THR',icon:'&#127873;',sec:'Penggajian'},
  {id:'lembur',lbl:'Lembur',icon:'&#9203;',sec:'Penggajian'},
  {id:'pesangon',lbl:'Pesangon & PHK',icon:'&#9878;',sec:'Penggajian'},
  {id:'penggajian',lbl:'Proses Gaji',icon:'&#128176;',sec:'Penggajian'},
  {id:'slip',lbl:'Slip Gaji',icon:'&#128203;',sec:'Penggajian'},
  {id:'pph',lbl:'PPh 21',icon:'&#128200;',sec:'Laporan'},
  {id:'laporan',lbl:'Rekap',icon:'&#128196;',sec:'Laporan'},
  {id:'master',lbl:'Master Perusahaan',icon:'&#9881;',sec:'Pengaturan',subtabs:['prs','periode','umk','libur','potongan','ter']},
  {id:'backup',lbl:'Backup & Import',icon:'&#128190;',sec:'Pengaturan'},
  {id:'sysstatus',lbl:'Status Sistem',icon:'&#128295;',sec:'Pengaturan',adminOnly:true},
  {id:'users',lbl:'Manajemen User',icon:'&#128101;',sec:'Pengaturan'},
  {id:'myslip',lbl:'Slip Gaji Saya',icon:'&#128203;',sec:'Saya'},
  {id:'mycuti',lbl:'Cuti Saya',icon:'&#127774;',sec:'Saya'},
];
const TER_A=[[5400000,0],[5650000,.0025],[5950000,.005],[6300000,.0075],[6750000,.01],[7500000,.0125],[8550000,.015],[9650000,.0175],[10050000,.02],[10350000,.0225],[10700000,.025],[11050000,.03],[11600000,.035],[12500000,.04],[13750000,.05],[15100000,.06],[16950000,.07],[19750000,.08],[24150000,.09],[26450000,.10],[28000000,.11],[30050000,.12],[32400000,.13],[35400000,.14],[39100000,.15],[43850000,.16],[47800000,.17],[51400000,.18],[56300000,.19],[62200000,.20],[68600000,.21],[77500000,.22],[89000000,.23],[103000000,.24],[125000000,.25],[157000000,.26],[206000000,.27],[337000000,.28],[454000000,.29],[550000000,.30],[695000000,.31],[910000000,.32],[1400000000,.33],[Infinity,.34]];
// Lampiran B: TK/2 & K/1 (63jt); TK/3 & K/2 (67,5jt)
const TER_B=[[6200000,0],[6500000,.0025],[6850000,.005],[7300000,.0075],[9200000,.01],[10750000,.015],[11250000,.02],[11600000,.025],[12600000,.03],[13600000,.04],[14950000,.05],[16400000,.06],[18450000,.07],[21850000,.08],[26000000,.09],[27700000,.10],[29350000,.11],[31450000,.12],[33950000,.13],[37100000,.14],[41100000,.15],[45800000,.16],[49500000,.17],[53800000,.18],[58500000,.19],[64000000,.20],[71000000,.21],[80000000,.22],[93000000,.23],[109000000,.24],[129000000,.25],[163000000,.26],[211000000,.27],[374000000,.28],[459000000,.29],[555000000,.30],[704000000,.31],[957000000,.32],[1405000000,.33],[Infinity,.34]];
// Lampiran C: K/3 (72jt)
const TER_C=[[6600000,0],[6950000,.0025],[7350000,.005],[7800000,.0075],[8850000,.01],[9800000,.0125],[10950000,.015],[11200000,.0175],[12050000,.02],[12950000,.03],[14150000,.04],[15550000,.05],[17050000,.06],[19500000,.07],[22700000,.08],[26600000,.09],[28100000,.10],[30100000,.11],[32600000,.12],[35400000,.13],[38900000,.14],[43000000,.15],[47400000,.16],[51200000,.17],[55800000,.18],[60400000,.19],[66700000,.20],[74500000,.21],[83200000,.22],[95600000,.23],[110000000,.24],[134000000,.25],[169000000,.26],[221000000,.27],[390000000,.28],[463000000,.29],[561000000,.30],[709000000,.31],[965000000,.32],[1419000000,.33],[Infinity,.34]];
/** Opsi alasan PHK — faktor pengali UP+UPMK (PP 35/2021 Pasal 50). Resign sukarela: 0 (tidak ada UP/UPMK). */
const PHK_ALASAN_OPTS=[
  {id:'',lbl:'— Belum dipilih —',f:null,uphOnly:false,manual:false},
  {id:'resign_30hr',lbl:'Mengundurkan diri — sudah pemberitahuan >=30 hari',f:0,uphOnly:true,manual:false},
  {id:'resign_belum30',lbl:'Mengundurkan diri — tanpa / belum 30 hari pemberitahuan',f:0,uphOnly:false,manual:false},
  {id:'pensiun',lbl:'Pensiun',f:1.75,uphOnly:false,manual:false},
  {id:'meninggal',lbl:'Meninggal dunia (dibayar kepada ahli waris)',f:2,uphOnly:false,manual:false},
  {id:'phk_1x',lbl:'PHK perusahaan (faktor 1x — contoh: merger, penutupan tanpa rugi)',f:1,uphOnly:false,manual:false},
  {id:'phk_05x',lbl:'PHK — faktor 0,5x (rugi, efisiensi tertentu, FM tutup, pelanggaran berat)',f:0.5,uphOnly:false,manual:false},
  {id:'phk_075x',lbl:'PHK — faktor 0,75x (force majeure, perusahaan tetap beroperasi)',f:0.75,uphOnly:false,manual:false},
  {id:'manual',lbl:'Manual — isi UP / UPMK / UPH sendiri',f:null,uphOnly:false,manual:true}
];
function phkOpt(id){return PHK_ALASAN_OPTS.find(function(o){return o.id===id;})||PHK_ALASAN_OPTS[0];}
/** Masa kerja dalam bulan (tanggal masuk → tanggal berhenti). */
function masaKerjaBulanPHK(k){
  if(!k||!k.tgl_berhenti||!k.masuk)return 0;
  const end=new Date(k.tgl_berhenti),start=new Date(k.masuk);
  if(isNaN(end.getTime())||isNaN(start.getTime())||end<start)return 0;
  let m=(end.getFullYear()-start.getFullYear())*12+(end.getMonth()-start.getMonth());
  if(end.getDate()<start.getDate())m--;
  return Math.max(0,m);
}
/** Uang Pesangon — lamanya bulan upah (PP 35 Pasal 40). */
function bulanUPPasal40(months){
  if(months<12)return 1;if(months<24)return 2;if(months<36)return 3;if(months<48)return 4;
  if(months<60)return 5;if(months<72)return 6;if(months<84)return 7;if(months<96)return 8;return 9;
}
/** Uang Penghargaan Masa Kerja — bulan upah (PP 35 Pasal 41). */
function bulanUPMKPasal41(months){
  if(months<36)return 0;if(months<72)return 2;if(months<108)return 3;if(months<144)return 4;
  if(months<180)return 5;if(months<216)return 6;if(months<252)return 7;if(months<288)return 8;return 10;
}
const SCHEMA_VERSION=12;
/** Versi tampilan & backup (v10 = modul Komponen Gaji terpisah dari Master Karyawan). */
const SIGAJI_APP_LABEL='SiGaji v10';
/** Harus sama dengan ?v= semua js/modules/* di index.html (cache bust deploy). */
const SIGAJI_MODULES_CACHE='11.0.7';
