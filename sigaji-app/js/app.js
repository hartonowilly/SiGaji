// ── HELPERS ─────────────────────────────────────
const PA=()=>{
  const aktif=periodes.find(p=>p.status==='aktif');
  if(aktif)return aktif;
  // Jika tidak ada yang aktif (mis. user set semua "tutup"), ambil periode paling baru berdasarkan tgl bayar/start
  const sorted=(periodes||[]).slice().sort(function(a,b){
    const ak=String(a.bayar||a.end||a.start||'');
    const bk=String(b.bayar||b.end||b.start||'');
    return ak.localeCompare(bk);
  });
  return sorted.at(-1)||{id:0,nama:'Maret 2026',start:'2026-02-25',end:'2026-03-24',bayar:'2026-03-25',status:'aktif',thr_aktif:false};
};
const isHL=d=>hariLibur.some(l=>l.tgl===d);
const namaHL=d=>{const l=hariLibur.find(x=>x.tgl===d);return l?l.nama:'';};
function isHariLiburKerja(dow){const hk=perusahaan.hariKerja||6;return hk===5?(dow===0||dow===6):(dow===0);}
const ini=n=>(n||'?').split(' ').map(w=>w[0]).join('').substring(0,2).toUpperCase();
/** Normalisasi ke YYYY-MM-DD untuk bandingkan kunci absensi / periode (hindari gagal karena sufiks T/Z). */
function toIsoDate(v){
  if(v==null||v==='')return'';
  var t=String(v).trim();
  if(t.length>=10)t=t.substring(0,10);
  if(/^\d{4}-\d{2}-\d{2}$/.test(t))return t;
  var d=new Date(t);
  if(isNaN(d.getTime()))return'';
  return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
}
// Cuti bersama mengurangi kuota (NEW v9)
function countCutiBersama(yr){
  if(!masterCuti.cbPotong)return 0;
  const y=String(yr);
  return hariLibur.filter(function(l){
    if(l.tipe!=='cuti-bersama')return false;
    const t=toIsoDate(l.tgl);
    if(!t||!t.startsWith(y))return false;
    return !isHariLiburKerja(new Date(t+'T12:00:00').getDay());
  }).length;
}
/** Cuti bersama di tahun `yr` plus hari libur cuti-bersama di tahun sebelumnya yang jatuh dalam periode gaji (penyilang tahun). */
function countCutiBersamaUntukTahunDanPeriode(yr,periode){
  var n=countCutiBersama(yr);
  if(!periode||!periode.start||!periode.end||!masterCuti.cbPotong)return n;
  var y=String(yr);
  var s=toIsoDate(periode.start),e=toIsoDate(periode.end);
  if(!s||!e||!(e>=y+'-01-01'&&s<=y+'-12-31'))return n;
  var extra=hariLibur.filter(function(l){
    if(l.tipe!=='cuti-bersama')return false;
    var t=toIsoDate(l.tgl);
    if(!t||t<s||t>e)return false;
    if(t.startsWith(y))return false;
    if(!(t<y+'-01-01'))return false;
    return !isHariLiburKerja(new Date(t+'T12:00:00').getDay());
  }).length;
  return n+extra;
}
/** Tanggal ini memotong kuota lewat master cuti bersama (sama aturan dengan countCutiBersama per hari). */
function isCutiBersamaPotongKuotaTgl(tglIso){
  if(!tglIso||!masterCuti.cbPotong)return false;
  var d=toIsoDate(tglIso);
  if(!d)return false;
  var l=hariLibur.find(function(x){return toIsoDate(x.tgl)===d&&x.tipe==='cuti-bersama';});
  if(!l)return false;
  return !isHariLiburKerja(new Date(d+'T12:00:00').getDay());
}
/** Cuti dari absensi yang memakai kuota (hari cuti bersama di absen sebagai C tidak dihitung ganda). */
function cutiManual(nik,yr){
  const pfx=String(yr);
  return Object.entries(absensi[nik]||{}).filter(function(ent){
    var dn=toIsoDate(ent[0]);
    return dn.startsWith(pfx)&&ent[1]==='cuti'&&!isCutiBersamaPotongKuotaTgl(dn);
  }).length;
}
/**
 * Cuti manual untuk tahun kuota `tahun`, plus hari cuti di tahun sebelumnya yang masih dalam
 * rentang periode gaji bila periode beririsan dengan kalender `tahun` (mis. 29 Des 2025–27 Jan 2026
 * untuk tampilan kuota 2026: hari Des 2025 di dalam rentang ikut terhitung).
 */
function cutiManualUntukTahunDanPeriode(nik,tahun,periode){
  const y=String(tahun);
  let n=cutiManual(nik,tahun);
  if(!periode||!periode.start||!periode.end)return n;
  const s=toIsoDate(periode.start),e=toIsoDate(periode.end);
  if(!s||!e||!(e>=y+'-01-01'&&s<=y+'-12-31'))return n;
  const ab=absensi[nik]||{};
  for(const raw of Object.keys(ab)){
    if(ab[raw]!=='cuti')continue;
    const d=toIsoDate(raw);
    if(!d)continue;
    if(isCutiBersamaPotongKuotaTgl(d))continue;
    if(d<s||d>e)continue;
    if(d.startsWith(y))continue;
    if(d<y+'-01-01')n++;
  }
  return n;
}
const cutiTerpakai=(nik,yr)=>cutiManual(nik,yr)+countCutiBersama(yr);
const masaKerjaBulan=k=>Math.floor((Date.now()-new Date(k.masuk||'2020-01-01'))/(86400000*30.44));
function hariKerjaRange(s,e){const sd=new Date(s),ed=new Date(e);let c=0;for(let d=new Date(sd);d<=ed;d.setDate(d.getDate()+1)){const dow=d.getDay();const ds=d.toISOString().split('T')[0];if(!isHariLiburKerja(dow)&&!isHL(ds))c++;}return c;}
function hariHadirBulan(nik,yr,bln){const pfx=`${yr}-${String(bln).padStart(2,'0')}-`;return Object.entries(absensi[nik]||{}).filter(([d,s])=>d.startsWith(pfx)&&s==='hadir').length;}
function getPR(nik,pN){if(!prorata[nik])prorata[nik]={};if(!prorata[nik][pN]){const p=PA();const ed=new Date(p.end||'2026-03-24');const hk=hariKerjaRange(p.start,p.end);const hh=hariHadirBulan(nik,ed.getFullYear(),ed.getMonth()+1);prorata[nik][pN]={enabled:false,hk,hh,manual:false};}return prorata[nik][pN];}
function setPREnabled(nik,pN,v){getPR(nik,pN).enabled=v;saveAll();renderPenggajian();}
function setPRField(nik,pN,f,v){const pr=getPR(nik,pN);pr[f]=v;pr.manual=true;saveAll();renderPenggajian();}
// ── BPJS ─────────────────────────────────────────
function bpjsKompAktif(k,key){
  const ak=k.bpjs_aktif||{};
  // Deteksi format: format baru pakai key dengan dash seperti 'kes-prs'
  const isNewFormat=Object.keys(ak).some(function(k){return k.indexOf('-')>-1;});
  if(isNewFormat) return ak[key]===true; // format baru: harus explicit true
  // Format lama: {kes:true, tk:true}
  const isKes=key==='kes-prs'||key==='kes-kar';
  return isKes?(ak.kes!==false):(ak.tk!==false);
}
function calcBPJS(k,gapokEff,tunjBPJS){
  const basis=gapokEff+tunjBPJS;const bm=k.bpjs_manual||{};
  const get=key=>{if(!bpjsKompAktif(k,key))return 0;if(bm[key]!==undefined)return bm[key];const def=BPJS_DEF[key];const b=def.basis?Math.min(basis,def.basis):basis;return Math.round(b*def.pct/100);};
  return{kes_prs:get('kes-prs'),kes_kar:get('kes-kar'),jht_prs:get('jht-prs'),jht_kar:get('jht-kar'),jp_prs:get('jp-prs'),jp_kar:get('jp-kar'),jkk_prs:get('jkk-prs'),jkm_prs:get('jkm-prs')};
}
// ── THR helper ───────────────────────────────────
function hitungTHRBruto(k,pNama){
  const mb=masaKerjaBulan(k);
  if(mb<1)return{mb,nilai:0,eligible:false,pl:'<1bln',dasar:0,isManual:false};
  const tTHR=(k.tunjangan||[]).filter(t=>(t.tipe==='tetap'||t.tipe==='tetap_no_bpjs')&&t.thr_ikut!==false).reduce((s,t)=>s+t.nilai,0);
  const dasar=k.gapok+tTHR;const pr=mb>=12?1:mb/12;const pl=mb>=12?'12/12':mb+'/12';
  const nilaiOto=Math.round(dasar*pr);
  // Cek manual override
  const pKey=pNama||PA().nama;
  const man=(thrManual[pKey]||{})[k.nik];
  if(man&&man.aktif&&man.nilai>0){
    return{mb,nilai:man.nilai,eligible:true,pl,dasar,isManual:true,nilaiOto};
  }
  return{mb,nilai:nilaiOto,eligible:true,pl,dasar,isManual:false,nilaiOto};
}
function getTERTable(ptkpKey){
  // PMK 168/2023: Lampiran A = TK/0, TK/1, K/0 (PTKP 54jt & 58.5jt)
  if(ptkpKey==='TK0'||ptkpKey==='TK1'||ptkpKey==='K0')return TER_A;
  // Lampiran C = K/3 (PTKP 72jt)
  if(ptkpKey==='K3')return TER_C;
  // Lampiran B = TK/2, TK/3, K/1, K/2 (PTKP 63jt & 67.5jt)
  return TER_B;
}
// PMK 168/2023: metode TER untuk pemotongan bulanan (masa pajak 1-11)
// Desember: idealnya rekonsiliasi tahunan — untuk saat ini TER dipakai sepanjang tahun
function hitungPPhBln(bruto,ptkpKey){
  if(bruto<=0)return 0;
  const tbl=getTERTable(ptkpKey);
  const idx=tbl.findIndex(function(r){return bruto<=r[0];});
  const found=idx>=0?tbl[idx]:tbl[tbl.length-1];
  // Cek custom rate override dari master perusahaan
  const lmpKey=ptkpKey==='TK0'||ptkpKey==='TK1'||ptkpKey==='K0'?'A':ptkpKey==='K3'?'C':'B';
  const customRate=perusahaan&&perusahaan.ter_custom&&perusahaan.ter_custom[lmpKey]&&perusahaan.ter_custom[lmpKey][idx>=0?idx:tbl.length-1];
  const rate=customRate!==undefined?customRate:found[1];
  return Math.round(bruto*rate);
}
// Fungsi progresif tahunan (untuk referensi / rekonsiliasi Desember)
// Hitung PPh tahunan progresif dari bruto akumulasi setahun
// Dipakai untuk: masa pajak terakhir (Des) dan masa pajak terakhir resign
function hitungPPhTahunanProgresif(brutoTahunan,ptkpKey){
  const bj=Math.min(brutoTahunan*.05,6e6);
  const pv=nilaiPTKP(ptkpKey);
  const pkp=Math.max(0,Math.floor((brutoTahunan-bj-pv)/1000)*1000);
  let pph=0;
  if(pkp<=60e6)pph=pkp*.05;
  else if(pkp<=250e6)pph=3e6+(pkp-60e6)*.15;
  else if(pkp<=500e6)pph=31.5e6+(pkp-250e6)*.25;
  else pph=94e6+(pkp-500e6)*.30;
  return Math.round(pph);
}
function hitungPPhProgresif(bruto,ptkpKey){
  // Single month annualized estimate (legacy - masih dipakai di beberapa tempat)
  return Math.round(hitungPPhTahunanProgresif(bruto*12,ptkpKey)/12);
}

// PPh 21 FINAL untuk pesangon/THT/JHT dibayar sekaligus (tarif berlapis PP 68/2009)
function hitungPPhFinalPesangon(bruto){
  const x=Math.max(0,Math.round(bruto||0));
  let pph=0;
  const lap=[
    {cap:50e6,rate:0},
    {cap:100e6,rate:.05},
    {cap:500e6,rate:.15},
    {cap:Infinity,rate:.25},
  ];
  let prev=0;
  for(const l of lap){
    const upTo=Math.min(x,l.cap);
    const base=Math.max(0,upTo-prev);
    if(base>0)pph+=base*l.rate;
    prev=upTo;
    if(x<=l.cap)break;
  }
  return Math.round(pph);
}

// Hitung total bruto karyawan dari periodes sebelumnya dalam tahun yg sama
function getBrutoYTD(k,pNama){
  const p=periodes.find(x=>x.nama===pNama)||PA();
  const thn=new Date(p.bayar||p.end||p.start).getFullYear();
  let totalBruto=0,totalPPh=0;
  periodes.forEach(function(per){
    const perThn=new Date(per.bayar||per.end||per.start).getFullYear();
    if(perThn!==thn||per.nama===pNama)return;
    // Hanya hitung periode sebelum periode ini (urut bayar)
    if((per.bayar||'')>=(p.bayar||''))return;
    const g=hitungGaji(k,per.nama);
    totalBruto+=g.grossPPh;
    totalPPh+=g.pph;
  });
  return{totalBruto,totalPPh,thn};
}
// Tunjangan variabel per periode (bonus, uang makan, dll.) — input HR di Proses Gaji
function getTunjVarColumnsResolved(){
  if(typeof tunjVarColumns!=='undefined'&&tunjVarColumns&&tunjVarColumns.length)return tunjVarColumns;
  var L=tunjVarLabels||{};
  return [{id:'v1',nama:L.v1||'Bonus'},{id:'v2',nama:L.v2||'Uang Makan'},{id:'v3',nama:L.v3||'Lain-lain'}];
}
function syncTunjVarLabelsFromColumns(){
  var cols=getTunjVarColumnsResolved();
  if(!tunjVarLabels)tunjVarLabels={};
  if(cols[0])tunjVarLabels.v1=cols[0].nama;
  if(cols[1])tunjVarLabels.v2=cols[1].nama;
  if(cols[2])tunjVarLabels.v3=cols[2].nama;
}
function getTunjVariabelForHitung(nik,pNama){
  const row=(tunjVarBulan[pNama]||{})[nik]||{};
  const cols=getTunjVarColumnsResolved();
  const out=[];
  cols.forEach(function(col){
    var nilai=parseFloat(row[col.id]);
    if(isNaN(nilai))nilai=0;
    if(nilai>0)out.push({nama:col.nama||col.id,nilai:nilai,tipe:'tidak_tetap',prorata_ikut:false});
  });
  return out;
}
function prevPeriodeChrono(pnama){
  if(!periodes||!periodes.length)return null;
  var sorted=periodes.slice().sort(function(a,b){return new Date(a.start||0)-new Date(b.start||0);});
  var i=sorted.findIndex(function(p){return p.nama===pnama;});
  if(i<=0)return null;
  return sorted[i-1].nama;
}

// Karyawan tampil di periode jika masih aktif pada awal periode,
// atau resign/PHK terjadi di dalam periode tsb (untuk gaji terakhir).
function karyawanInPeriode(k,p){
  var t=String((k&&k.tgl_berhenti)||'').trim();
  if(!t)return true;
  if(!p||!p.start)return true;
  // ISO date string compare aman untuk format YYYY-MM-DD
  return t>=String(p.start);
}
function karyawanListPeriode(p){
  return karyawan.filter(function(k){return karyawanInPeriode(k,p);});
}
/** Batas atas (inklusif) tgl berhenti masuk periode untuk PHK / rekonsiliasi PPh.
 *  Absensi & komponen gaji memakai start–end. Tgl bayar boleh **lebih awal** dari end (transfer bank hari kerja);
 *  dalam kasus itu cutoff tetap **end**. Jika bayar **setelah** end (legacy), cutoff memakai **bayar**. */
function periodeTglCutoffPhk(p){
  if(!p)return '';
  var e=String(p.end||'').trim();
  var b=String(p.bayar||'').trim();
  var s=String(p.start||'').trim();
  if(!e&&!b)return s;
  if(e&&b&&b>e)return b;
  return e||b||s;
}

function deepCloneLite(o){
  if(o===undefined)return undefined;
  if(o===null)return null;
  try{return JSON.parse(JSON.stringify(o));}catch(e){return o;}
}

function nowIso(){return new Date().toISOString();}
function auditPush(entry){
  if(!auditLog)auditLog=[];
  auditLog.unshift(entry);
  // batasi ukuran agar tidak membengkak
  if(auditLog.length>3000)auditLog=auditLog.slice(0,3000);
}
function logPayrollAudit(nik,action,detail){
  try{
    var p=PA();
    auditPush({
      ts:nowIso(),
      periode:(p&&p.nama)||'',
      nik:nik||'',
      by:(CU&&CU.nama)||'',
      role:(CU&&CU.role)||'',
      action:action||'',
      detail:detail||''
    });
  }catch(e){}
}

function onPPhRetChange(){
  if(!cpNik)return;
  if(!isPayrollSnapshotMode())return; // PPh return hanya boleh di snapshot periode
  if(!guardPayrollEditUnlocked())return;
  var p=PA();if(!p||!p.nama)return;
  var k=getPayrollTargetByNik(cpNik,true,'periode');if(!k)return;
  var vEl=document.getElementById('sp-pphret-val');
  var kEl=document.getElementById('sp-pphret-ket');
  var val=parseFloat((vEl&&vEl.value)||'')||0;
  var ket=(kEl&&kEl.value)||'';
  var before=(k.pph_return&&k.pph_return.nilai)||0;
  k.pph_return={nilai:val,ket:ket};
  logPayrollAudit(cpNik,'Update PPh Return',`${before} → ${val} | ${ket}`);
  saveAll();
  renderPPhRetPanel(k);
  updateGajiSummary();
}

// Snapshot master karyawan per periode agar revisi bulan lain tidak mengubah periode yang sudah dikerjakan.
function snapshotKarFromMaster(k){
  return{
    gapok:Math.round(k.gapok||0),
    tunjangan:deepCloneLite(k.tunjangan||[]),
    potongan:deepCloneLite(k.potongan||[]),
    natura:deepCloneLite(k.natura||[]),
    bpjs_aktif:deepCloneLite(k.bpjs_aktif||{}),
    bpjs_manual:deepCloneLite(k.bpjs_manual||{}),
    pph_return:deepCloneLite(k.pph_return||{nilai:0,ket:''}),
  };
}
function getPeriodeByNama(pNama){
  return periodes.find(function(p){return p.nama===pNama;})||null;
}
function isPeriodeLocked(pNama){
  var p=getPeriodeByNama(pNama);
  return !!(p&&p.snapshot_locked);
}
function guardPayrollEditUnlocked(){
  if(spPayrollView==='master')return true;
  var p=PA();
  if(p&&isPeriodeLocked(p.nama)){
    toast('Periode '+p.nama+' terkunci. Buka kunci jika ingin mengubah komponen payroll.');
    return false;
  }
  return true;
}
/** Periode gaji dengan snapshot terkunci yang rentangnya mencakup tanggal ISO (inklusif). */
function periodeSnapshotLockedUntukTanggal(tglIso){
  if(!tglIso||String(tglIso).trim()===''||!periodes||!periodes.length)return null;
  var t=String(tglIso).trim();
  for(var i=0;i<periodes.length;i++){
    var p=periodes[i];
    if(!p||!p.snapshot_locked||!p.start||!p.end)continue;
    if(t>=String(p.start)&&t<=String(p.end))return p;
  }
  return null;
}
/** Absensi/lembur per tanggal: Admin selalu boleh; role lain tidak jika tanggal di periode terkunci. */
function canEditDataPadaTanggalIso(tglIso){
  if(!CU)return false;
  if(CU.role==='Admin')return true;
  return !periodeSnapshotLockedUntukTanggal(tglIso);
}
function ensureKarSnapshotPeriode(pNama,list){
  if(!pNama)return;
  if(!karSnapshot)karSnapshot={};
  if(!karSnapshot[pNama])karSnapshot[pNama]={};
  let changed=false;
  (list||[]).forEach(function(k){
    if(!k||!k.nik)return;
    if(karSnapshot[pNama][k.nik]===undefined){
      karSnapshot[pNama][k.nik]=snapshotKarFromMaster(k);
      changed=true;
    }
  });
  if(changed)saveAll();
}
function resolveKarForPeriode(k,pNama){
  if(!k||!pNama)return k;
  const snap=karSnapshot&&karSnapshot[pNama]&&karSnapshot[pNama][k.nik];
  if(!snap)return k;
  const out=Object.assign({},k);
  if(snap.gapok!==undefined)out.gapok=snap.gapok;
  if(snap.tunjangan!==undefined)out.tunjangan=deepCloneLite(snap.tunjangan);
  if(snap.potongan!==undefined)out.potongan=deepCloneLite(snap.potongan);
  if(snap.natura!==undefined)out.natura=deepCloneLite(snap.natura);
  if(snap.bpjs_aktif!==undefined)out.bpjs_aktif=deepCloneLite(snap.bpjs_aktif);
  if(snap.bpjs_manual!==undefined)out.bpjs_manual=deepCloneLite(snap.bpjs_manual);
  if(snap.pph_return!==undefined)out.pph_return=deepCloneLite(snap.pph_return);
  return out;
}
function upsertKarSnapshotForPeriode(nik,pNama){
  if(!nik||!pNama)return;
  if(isPeriodeLocked(pNama))return;
  var k=karyawan.find(function(x){return x.nik===nik;});
  if(!k)return;
  if(!karSnapshot)karSnapshot={};
  if(!karSnapshot[pNama])karSnapshot[pNama]={};
  karSnapshot[pNama][nik]=snapshotKarFromMaster(k);
}
let spPayrollView='periode'; // 'periode' | 'master'
function isPayrollSnapshotMode(){return spPayrollView==='periode';}
function getPayrollTargetByNik(nik,createIfMissing,sourceMode){
  var mode=sourceMode||spPayrollView||'periode';
  const p=PA();
  const k=karyawan.find(function(x){return x.nik===nik;});
  if(!k)return null;
  if(mode==='master')return k;
  if(!p||!p.nama)return k;
  if(!karSnapshot)karSnapshot={};
  if(!karSnapshot[p.nama])karSnapshot[p.nama]={};
  if(!karSnapshot[p.nama][nik]){
    if(!createIfMissing)return k;
    karSnapshot[p.nama][nik]=snapshotKarFromMaster(k);
  }
  const tgt=karSnapshot[p.nama][nik];
  if(tgt.potongan===undefined)tgt.potongan=deepCloneLite(k.potongan||[]);
  if(tgt.tunjangan===undefined)tgt.tunjangan=deepCloneLite(k.tunjangan||[]);
  if(tgt.natura===undefined)tgt.natura=deepCloneLite(k.natura||[]);
  if(tgt.bpjs_aktif===undefined)tgt.bpjs_aktif=deepCloneLite(k.bpjs_aktif||{});
  if(tgt.bpjs_manual===undefined)tgt.bpjs_manual=deepCloneLite(k.bpjs_manual||{});
  if(tgt.pph_return===undefined)tgt.pph_return=deepCloneLite(k.pph_return||{nilai:0,ket:''});
  if(tgt.gapok===undefined)tgt.gapok=Math.round(k.gapok||0);
  // Penting: kembalikan REFERENCE snapshot asli (bukan copy),
  // agar perubahan (mis. pph_return=0) benar-benar tersimpan ke karSnapshot.
  tgt.nik=k.nik;
  tgt.nama=k.nama;
  return tgt;
}
function setSpPayrollView(mode){
  spPayrollView=mode==='master'?'master':'periode';
  var p=PA();
  var bP=document.getElementById('sp-mode-periode');
  var bM=document.getElementById('sp-mode-master');
  if(bP){
    bP.style.borderColor=spPayrollView==='periode'?'#5b21b6':'';
    bP.style.background=spPayrollView==='periode'?'#f5f0ff':'';
    bP.style.color=spPayrollView==='periode'?'#4c1d95':'';
  }
  if(bM){
    bM.style.borderColor=spPayrollView==='master'?'#1f2937':'';
    bM.style.background=spPayrollView==='master'?'#f3f4f6':'';
    bM.style.color=spPayrollView==='master'?'#111827':'';
  }
  var lbl=document.getElementById('sp-mode-lbl');
  if(lbl)lbl.textContent=spPayrollView==='periode'?('Periode aktif: '+(p&&p.nama?p.nama:'-')):'Perubahan ke Master global';
  var bdg=document.getElementById('sp-mode-badge');
  if(bdg){
    if(spPayrollView==='periode'){
      bdg.textContent='EDIT SNAPSHOT PERIODE';
      bdg.style.background='#ede9fe';
      bdg.style.color='#4c1d95';
      bdg.style.border='1px solid #c4b5fd';
    }else{
      bdg.textContent='EDIT MASTER GLOBAL';
      bdg.style.background='#f3f4f6';
      bdg.style.color='#111827';
      bdg.style.border='1px solid #d1d5db';
    }
  }
  var hint=document.getElementById('sp-saved-lbl');
  if(hint){
    hint.textContent=spPayrollView==='periode'
      ?'Mode Snapshot: nominal payroll yang diedit hanya berlaku untuk periode aktif.'
      :'Mode Master: kelola struktur/jenis komponen; nominal payroll dikelola di Snapshot Periode.';
  }
  if(!cpNik)return;
  var src=getPayrollTargetByNik(cpNik,true,spPayrollView);
  if(!src)return;
  var gap=document.getElementById('sp-gapok-f');if(gap)gap.value=src.gapok||0;
  if(gap)gap.readOnly=!isPayrollSnapshotMode();
  var rv=document.getElementById('sp-pphret-val');if(rv)rv.value=(src.pph_return&&src.pph_return.nilai)||0;
  var rk=document.getElementById('sp-pphret-ket');if(rk)rk.value=(src.pph_return&&src.pph_return.ket)||'';
  if(rv)rv.readOnly=!isPayrollSnapshotMode();
  if(rk)rk.readOnly=!isPayrollSnapshotMode();
  if(document.getElementById('sp-gaji').style.display!=='none'){renderTunjPanel(src);renderPotPanel(src);}
  if(document.getElementById('sp-bpjs').style.display!=='none')loadBPJSPanel(src);
  if(document.getElementById('sp-natura').style.display!=='none')renderNaturaPanel(src);
  if(document.getElementById('sp-pphret').style.display!=='none')renderPPhRetPanel(src);
  updateGajiSummary();
}
function getKarSnapshotProgress(pNama,list){
  var total=(list||[]).length;
  var snapMap=(karSnapshot&&karSnapshot[pNama])||{};
  var done=(list||[]).filter(function(k){return !!(k&&k.nik&&snapMap[k.nik]);}).length;
  return{done:done,total:total,ok:total>0&&done===total};
}
// ── HITUNG GAJI (dengan integrasi THR v9) ────────
function hitungGaji(k,pNama){
  const pn=pNama||PA().nama;const p=periodes.find(x=>x.nama===pn)||PA();
  // Pastikan snapshot periode ada sebelum hitung (sekali saja per periode/karyawan)
  ensureKarSnapshotPeriode(pn,[k]);
  k=resolveKarForPeriode(k,pn);
  const hkP=hariKerjaRange(p.start,p.end);
  const pr=prorata[k.nik]?.[pn];const isPR=pr?.enabled&&pr.hk>0;
  const prF=isPR?pr.hh/pr.hk:1;const gapokEff=Math.round(k.gapok*prF);
  let tBPJS=0,tGross=0,tTH=0;const tItems=[];
  let tBPJSFull=0; // basis tunjangan BPJS 1 bulan penuh (untuk bulan resign/berhenti)
  var tunjGabungan=[].concat(k.tunjangan||[]).concat(getTunjVariabelForHitung(k.nik,pn));
  for(const t of tunjGabungan){
    const prMul=isPR&&t.prorata_ikut===false?1:prF;
    const eff=Math.round(t.nilai*prMul);
    switch(t.tipe){
      case'tetap':
        tBPJS+=eff;
        // BPJS basis full-month hanya dari tunjangan tetap (bukan variabel)
        tBPJSFull+=Math.round(t.nilai||0);
        tGross+=eff;tTH+=eff;tItems.push({...t,eff,inTH:true});break;
      case'tetap_no_bpjs':tGross+=eff;tTH+=eff;tItems.push({...t,eff,inTH:true});break;
      case'tidak_tetap':tGross+=eff;tTH+=eff;tItems.push({...t,eff,inTH:true});break;
      case'harian_exclude':{const tot=Math.round(t.nilai*prMul);tGross+=tot;tItems.push({...t,eff:tot,inTH:false,isHarian:true});break;}
      default:tGross+=eff;tTH+=eff;tItems.push({...t,eff,inTH:true});
    }
  }
  const natKP=(k.natura||[]).filter(n=>n.kp).reduce((s,n)=>s+n.nilai,0);
  const natNKP=(k.natura||[]).filter(n=>!n.kp).reduce((s,n)=>s+n.nilai,0);
  const upj=k.gapok/173;
  const lb=(lembur[k.nik]||[]).reduce((s,r)=>{const j=parseFloat(r.jam)||0;let h=0;if(j>=1)h+=upj*1.5;if(j>=2)h+=upj*2*(j-1);return s+Math.round(h);},0);
  // THR: jika periode aktif ada THR, gabung ke gross PPh
  const periodeAdaTHR=!!p.thr_aktif;
  const thrObj=periodeAdaTHR?hitungTHRBruto(k,pNama):null;
  const thrBruto=(thrObj&&thrObj.eligible)?thrObj.nilai:0;

  // ── PEMBAYARAN BERHENTI (UPH / PHK) ────────────
  // Sumber data: k.tgl_berhenti + k.phk + hitungPesangon() (pesangon.js)
  const tglStopIso=k.tgl_berhenti?String(k.tgl_berhenti).trim():'';
  // Cutoff: lihat periodeTglCutoffPhk — mendukung bayar lebih awal dari end (bank hari kerja).
  const stopCutoff=periodeTglCutoffPhk(p);
  const isStopInPeriode=!!(tglStopIso&&p.start&&stopCutoff&&tglStopIso>=p.start&&tglStopIso<=stopCutoff);
  const isPeriodeResign=p.tipe_periode==='resign';
  const alasan=(k.phk&&k.phk.alasan)?String(k.phk.alasan):'';
  const isResign=alasan.indexOf('resign')===0;
  let phkCtx=null;
  if(tglStopIso&&(isStopInPeriode||isPeriodeResign)&&typeof hitungPesangon==='function'){
    const r=hitungPesangon(k);
    if(r&&r.ok){
      const items=[
        {nama:'Uang Pesangon',nilai:Math.round(r.up||0)},
        {nama:'Uang Penghargaan Masa Kerja',nilai:Math.round(r.upmk||0)},
        {nama:'Uang Penggantian Hak',nilai:Math.round(r.uph||0)},
        {nama:'Uang pisah',nilai:Math.round(r.pisah||0)},
      ].filter(it=>it.nilai>0);
      const bruto=items.reduce((s,it)=>s+it.nilai,0);
      if(bruto>0){
        if(isResign){
          // Resign: UPH ikut PPh 21 biasa (non-final) → masuk grossPPh & take home
          const uphOnly=(items.find(it=>it.nama==='Uang Penggantian Hak')||{}).nilai||0;
          if(uphOnly>0){
            tGross+=uphOnly;
            tTH+=uphOnly;
            tItems.push({nama:'Uang Penggantian Hak (Resign)',nilai:uphOnly,tipe:'tidak_tetap',eff:uphOnly,inTH:true,isHarian:false});
          }
          phkCtx={mode:'resign',tgl:tglStopIso,items:items,bruto:bruto,pphFinal:0,pphFinalBase:0};
        }else{
          // PHK: dipisah, PPh 21 final pesangon dihitung sendiri
          const pphFinal=hitungPPhFinalPesangon(bruto);
          phkCtx={mode:'phk',tgl:tglStopIso,items:items,bruto:bruto,pphFinal:pphFinal,pphFinalBase:bruto};
        }
      }
    }
  }
  // BPJS pada bulan resign/berhenti: basis hanya GAPOK FULL (tanpa tunjangan),
  // walaupun take home prorata.
  const isBpjsFullMonth=!!(tglStopIso&&(isStopInPeriode||isPeriodeResign));
  const gapokBpjs=isBpjsFullMonth?Math.round(k.gapok||0):gapokEff;
  const tunjBpjs=isBpjsFullMonth?0:tBPJS;
  const bpjs=calcBPJS(k,gapokBpjs,tunjBpjs);
  // BPJS Perusahaan (JKK+JKM+Kes) = natura kena pajak per PMK 168/2023
  const bpjsPrsNatKP=bpjs.jkk_prs+bpjs.jkm_prs+bpjs.kes_prs;
  const grossPPhRegular=gapokEff+tGross+natKP+lb+bpjsPrsNatKP;
  const grossPPh=grossPPhRegular+thrBruto; // PPh dihitung termasuk THR
  const brutoTH=gapokEff+tTH+natNKP+lb;   // Take Home TIDAK termasuk THR
  // Deteksi masa pajak terakhir:
  // - Desember (rekonsiliasi tahunan)
  // - Periode bertipe 'resign'
  // - Atau karyawan berhenti di dalam periode ini (rekonsiliasi saat pegawai keluar tengah tahun)
  const isMasaPajakTerakhir=
    p.tipe_periode==='desember'||
    p.tipe_periode==='resign'||
    (!!tglStopIso&&isStopInPeriode);
  let pph,reconciliation=null;
  if(isMasaPajakTerakhir){
    const ytd=getBrutoYTD(k,pn);
    const brutoTahunan=ytd.totalBruto+grossPPh;
    const pphTahunan=hitungPPhTahunanProgresif(brutoTahunan,k.ptkp);
    const pphBulanIni=pphTahunan-ytd.totalPPh;
    pph=Math.max(0,pphBulanIni);
    const selisih=pphBulanIni; // negatif = lebih bayar
    const isStopReason=!!(tglStopIso&&isStopInPeriode);
    const tipeLabel=(p.tipe_periode==='desember')?'desember':(p.tipe_periode==='resign'||isStopReason)?'resign':p.tipe_periode;
    reconciliation={
      brutoYTD:ytd.totalBruto,pphYTD:ytd.totalPPh,
      brutoTahunan,pphTahunan,
      pphBulanIni:selisih,
      lebihBayar:selisih<0?Math.abs(selisih):0,
      kurangBayar:selisih>0?selisih:0,
      opsiLebihBayar:p.opsi_lebih_bayar||'refund', // 'refund' | 'carryover'
      isPajakTerakhir:true,
      tipePeriode:tipeLabel,
      reason:isStopReason?'stop_in_period':(p.tipe_periode==='resign'?'periode_resign':(p.tipe_periode==='desember'?'desember':'other')),
      tglBerhenti:isStopReason?tglStopIso:''
    };
    if(selisih<0&&p.opsi_lebih_bayar==='refund') pph=0; // lebih bayar → PPh bulan ini 0
  } else {
    pph=hitungPPhBln(grossPPh,k.ptkp);
  }
  const pphTanpaThr=hitungPPhBln(grossPPhRegular,k.ptkp);
  const pphAtasThr=pph-pphTanpaThr;
  const potT=(k.potongan||[]).reduce((s,x)=>s+x.nilai,0);
  const potKehadiran=hitungPotonganKehadiran(k.nik,p,hkP,gapokEff);
  const pphRet=k.pph_return?.nilai||0;
  const totalPot=bpjs.kes_kar+bpjs.jht_kar+bpjs.jp_kar+potT+pph+potKehadiran.total;
  const netoRegular=brutoTH-totalPot+pphRet;
  const phkNet=(phkCtx&&phkCtx.mode==='phk')?(phkCtx.bruto-phkCtx.pphFinal):0;
  const neto=netoRegular+phkNet;
  const bebanPrs=bpjs.kes_prs+bpjs.jht_prs+bpjs.jp_prs+bpjs.jkk_prs+bpjs.jkm_prs;
  return{gapokEff,gapokFull:k.gapok,tBPJS,tGross,tTH,tItems,natKP,natNKP,lb,bpjsPrsNatKP,grossPPhRegular,grossPPh,brutoTH,bpjs,pph,pphTanpaThr,pphAtasThr,potT,potKehadiran,pphRet,totalPot,netoRegular,neto,bebanPrs,isPR,pr,thrBruto,thrObj,periodeAdaTHR,reconciliation,isMasaPajakTerakhir,phk:phkCtx};
}
function hitungPotonganKehadiran(nik,periode,hkPeriode,gapokEff){
  const ap=perusahaan.aturan_potongan||{};const gajiHarian=hkPeriode>0?Math.round(gapokEff/hkPeriode):0;
  const abNik=absensi[nik]||{};
  // Fallback: jika browser memuat app.js versi campur (cache), pastikan helper tanggal ada
  const toIso=(typeof toIsoDate==='function')?toIsoDate:function(v){
    if(v==null||v==='')return'';
    var t=String(v).trim();if(t.length>=10)t=t.substring(0,10);
    if(/^\d{4}-\d{2}-\d{2}$/.test(t))return t;
    var d=new Date(t);if(isNaN(d.getTime()))return'';
    return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
  };
  const pStart=toIso((periode&&periode.start)||'2026-01-01'),pEnd=toIso((periode&&periode.end)||'2026-12-31');
  let nIzin=0,nSakit=0,n05S=0,n05I=0,nAlpha=0,nCuti=0;
  for(const[tglRaw,st]of Object.entries(abNik)){
    const tgl=toIso(tglRaw);
    if(!tgl||tgl<pStart||tgl>pEnd)continue;
    if(st==='izin')nIzin++;else if(st==='sakit')nSakit++;else if(st==='setengah_sakit')n05S++;else if(st==='setengah_ijin')n05I++;else if(st==='alpha')nAlpha++;else if(st==='cuti')nCuti++;
  }
  const end=new Date((periode&&periode.end?String(periode.end):'2026-12-31')+'T12:00:00');
  const yr=end.getFullYear();const kuota=masterCuti.kuota||12;
  const cb=(typeof countCutiBersamaUntukTahunDanPeriode==='function')?countCutiBersamaUntukTahunDanPeriode(yr,periode):countCutiBersama(yr);
  const totalSudahCuti=cutiManualUntukTahunDanPeriode(nik,yr,periode)+cb;
  const cutiDalamKuota=Math.min(nCuti,Math.max(0,kuota-(totalSudahCuti-nCuti)));const cutiLuarKuota=nCuti-cutiDalamKuota;
  function pot(mode,nilai,hari){if(hari<=0)return 0;switch(mode){case'tidak_dipotong':return 0;case'prorata':return Math.round(gajiHarian*hari);case'prorata_setengah':return Math.round(gajiHarian*hari*.5);case'nominal':return Math.round((nilai||0)*hari);case'persen':return Math.round(gajiHarian*(nilai||0)/100*hari);default:return 0;}}
  const pCDK=pot(ap.cuti_dalam_kuota?.mode||'tidak_dipotong',ap.cuti_dalam_kuota?.nilai||0,cutiDalamKuota);
  const pCLK=pot(ap.cuti_luar_kuota?.mode||'prorata',ap.cuti_luar_kuota?.nilai||0,cutiLuarKuota);
  const pIzin=pot(ap.izin?.mode||'prorata',ap.izin?.nilai||0,nIzin);const pSakit=pot(ap.sakit?.mode||'prorata',ap.sakit?.nilai||0,nSakit);
  const p05S=pot(ap.setengah_sakit?.mode||'prorata_setengah',ap.setengah_sakit?.nilai||0,n05S);
  const p05I=pot(ap.setengah_ijin?.mode||'prorata_setengah',ap.setengah_ijin?.nilai||0,n05I);
  const pAlpha=pot(ap.alpha?.mode||'prorata',ap.alpha?.nilai||0,nAlpha);
  const total=pCDK+pCLK+pIzin+pSakit+p05S+p05I+pAlpha;const details=[];
  if(pCDK>0)details.push({label:`Cuti dlm kuota (${cutiDalamKuota}hr)`,nilai:pCDK});if(pCLK>0)details.push({label:`Cuti luar kuota (${cutiLuarKuota}hr)`,nilai:pCLK});
  if(pIzin>0)details.push({label:`Izin (${nIzin}hr)`,nilai:pIzin});if(pSakit>0)details.push({label:`Sakit (${nSakit}hr)`,nilai:pSakit});
  if(p05S>0)details.push({label:`1/2 Sakit (${n05S}hr)`,nilai:p05S});if(p05I>0)details.push({label:`1/2 Izin (${n05I}hr)`,nilai:p05I});if(pAlpha>0)details.push({label:`Alpha (${nAlpha}hr)`,nilai:pAlpha});
  return{total,details,gajiHarian,nIzin,nSakit,n05S,n05I,nAlpha,nCuti,cutiDalamKuota,cutiLuarKuota};
}
// ── PERMISSIONS & SIDEBAR ────────────────────────
function canAccessModule(mid){
  if(!CU)return false;
  if(CU.role==='Admin')return true;
  const p=roles[CU.role]||[];
  const subs=SUBTABS[mid];
  if(subs&&subs.length)return subs.some(s=>p.includes(mid+'.'+s));
  return p.includes(mid);
}
function canAccess(id){return canAccessModule(id);}
function canAccessSubTab(moduleId,subTabId){
  if(!CU)return false;
  if(CU.role==='Admin')return true;
  return(roles[CU.role]||[]).includes(moduleId+'.'+subTabId);
}
function renderSidebar(){
  const secs={};
  MODULES.forEach(m=>{
    if(!canAccessModule(m.id))return;
    if(!secs[m.sec])secs[m.sec]=[];
    secs[m.sec].push(m);
  });
  let h='';Object.entries(secs).forEach(([sec,mods])=>{h+=`<div class="nsec">${sec}</div>`;mods.forEach(m=>{h+=`<div class="ni" data-pg="${m.id}" onclick="showPg('${m.id}')"><span class="nic">${m.icon}</span>${m.lbl}${m.id==='notifikasi'?'<span class="nbadge" id="nc-badge" style="display:none">0</span>':''}</div>`;});});
  document.getElementById('nav-dynamic').innerHTML=h;
  document.getElementById('nav-bottom').innerHTML=CU.role==='Admin'?`<div class="ni danger" onclick="openModal('m-reset')"><span class="nic">&#9888;</span>Reset Semua Data</div>`:'';
}
// ── USER MANAGEMENT ──────────────────────────────
function renderUsers(){
  const tb=document.getElementById('tb-users');if(!tb)return;
  tb.innerHTML=users.map((u,i)=>`<tr><td><strong>${u.username}</strong></td><td style="font-size:11px;max-width:140px;word-break:break-all">${u.email?escapeHtml(u.email):'&#8212;'}</td><td>${u.nama}</td><td><span class="bdg ${u.role==='Admin'?'b-err':u.role==='HRD'?'b-warn':'b-ok'}">${u.role}</span></td><td>${u.nik?`<span class="bdg b-info">${u.nik}</span>`:'&#8212;'}</td><td><span class="bdg ${u.aktif!==false?'b-ok':'b-gray'}">${u.aktif!==false?'Aktif':'Nonaktif'}</span></td><td><div class="fl gap1"><button class="btn btn-sm btn-out" onclick="openUserModal(${i})">Edit</button>${u.username!=='admin'?`<button class="btn btn-sm btn-r" onclick="hapusUser(${i})">Hapus</button>`:''}</div></td></tr>`).join('');
}
function escapeHtml(s){
  return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
function openUserModal(idx=-1){
  var cloud=typeof sigajiIsCloudConfigured==='function'&&sigajiIsCloudConfigured();
  var pwWrap=document.getElementById('u-password-wrap');
  if(pwWrap)pwWrap.style.display=cloud?'none':'';
  document.getElementById('u-idx').value=idx;
  const u=idx>=0?users[idx]:{username:'',password:'',nama:'',role:'HRD',nik:null,aktif:true,email:''};
  document.getElementById('m-user-tit').textContent=idx>=0?'Edit User':'Tambah User';
  document.getElementById('u-username').value=u.username||'';
  document.getElementById('u-email').value=u.email||'';
  document.getElementById('u-password').value=cloud?'':(u.password||'');
  document.getElementById('u-nama').value=u.nama||'';
  document.getElementById('u-aktif').checked=u.aktif!==false;
  const rs=document.getElementById('u-role');rs.innerHTML=Object.keys(roles).map(r=>`<option value="${r}">${r}</option>`).join('');rs.value=u.role||'HRD';
  const ns=document.getElementById('u-nik');ns.innerHTML='<option value="">-- Tidak tertaut --</option>'+karyawan.map(k=>`<option value="${k.nik}">${k.nik} &#8212; ${k.nama}</option>`).join('');ns.value=u.nik||'';
  openModal('m-user');
}
function simpanUser(){
  const idx=parseInt(document.getElementById('u-idx').value);
  const uname=document.getElementById('u-username').value.trim().toLowerCase();
  const emailRaw=document.getElementById('u-email').value.trim().toLowerCase();
  const passRaw=document.getElementById('u-password').value;
  const nama=document.getElementById('u-nama').value.trim();
  const role=document.getElementById('u-role').value;const nik=document.getElementById('u-nik').value||null;
  const aktif=document.getElementById('u-aktif').checked;
  const cloud=typeof sigajiIsCloudConfigured==='function'&&sigajiIsCloudConfigured();
  if(!uname||!nama){toast('Username dan nama lengkap wajib');return;}
  if(cloud){
    if(!emailRaw){toast('Mode cloud: isi Email Supabase untuk tiap user yang boleh login.');return;}
  }else if(!passRaw){toast('Password wajib untuk login lokal');return;}
  if(emailRaw){
    const clash=users.find(function(u,i){return i!==idx&&u.email&&String(u.email).toLowerCase()===emailRaw;});
    if(clash){toast('Email Supabase ini sudah dipakai user: '+clash.username);return;}
  }
  var pass=passRaw;
  if(cloud){
    if(idx>=0&&users[idx]){
      pass=passRaw||(users[idx].password||'')||'\u2014cloud\u2014';
    }else{
      pass=passRaw||'\u2014cloud\u2014';
    }
  }
  if(idx<0){
    if(users.find(u=>u.username===uname)){toast('Username sudah dipakai');return;}
    const o={username:uname,password:pass,nama,role,nik,aktif};
    if(emailRaw)o.email=emailRaw;
    users.push(o);
  }else{
    users[idx]={...users[idx],username:uname,password:pass,nama,role,nik,aktif};
    if(emailRaw)users[idx].email=emailRaw;else delete users[idx].email;
  }
  saveAll();renderUsers();closeModal('m-user');toast('User disimpan');
}
function hapusUser(i){if(!confirm('Hapus user '+users[i].username+'?'))return;users.splice(i,1);saveAll();renderUsers();toast('User dihapus');}
function renderPermMatrix(){
  const el=document.getElementById('perm-matrix-wrap');if(!el)return;
  const roleKeys=Object.keys(roles);
  let h=`<div class="perm-grid"><div class="perm-hdr"><div class="perm-hdr-cell" style="min-width:200px;text-align:left;flex:2">Modul / Sub-tab</div>`;
  roleKeys.forEach(r=>h+=`<div class="perm-hdr-cell">${r}</div>`);h+=`</div>`;
  MODULES.forEach(m=>{
    const subs=SUBTABS[m.id];
    if(subs&&subs.length){
      h+=`<div class="perm-row perm-mod-head"><div class="perm-cell" style="min-width:200px;flex:2;font-weight:700;flex-direction:column;align-items:flex-start">${m.icon} ${m.lbl}<span style="font-size:10px;font-weight:600;color:#6b7280;margin-top:3px">Centang per sub-tab di bawah (atau semua sekaligus)</span></div>`;
      roleKeys.forEach(r=>{
        const isAdmin=r==='Admin';
        const allOn=isAdmin||subs.every(s=>(roles[r]||[]).includes(m.id+'.'+s));
        h+=`<div class="perm-cell"><input type="checkbox" ${allOn?'checked':''} ${isAdmin?'disabled':''} title="Aktifkan semua sub-tab modul ini" onchange="togglePermModuleAll('${r}','${m.id}',this.checked)"></div>`;
      });
      h+=`</div>`;
      subs.forEach(sub=>{
        const key=m.id+'.'+sub;
        const lbl=SUBTAB_LBL[key]||sub;
        h+=`<div class="perm-row perm-sub"><div class="perm-cell" style="min-width:200px;flex:2;padding-left:1.1rem;font-size:12px;color:#4b5563;font-weight:500">${lbl}</div>`;
        roleKeys.forEach(r=>{
          const isAdmin=r==='Admin';
          const chk=isAdmin||(roles[r]||[]).includes(key);
          h+=`<div class="perm-cell"><input type="checkbox" ${chk?'checked':''} ${isAdmin?'disabled':''} onchange="toggleSubPerm('${r}','${m.id}','${sub}',this.checked)"></div>`;
        });
        h+=`</div>`;
      });
    }else{
      h+=`<div class="perm-row"><div class="perm-cell" style="min-width:200px;flex:2;font-weight:600">${m.icon} ${m.lbl}</div>`;
      roleKeys.forEach(r=>{const isAdmin=r==='Admin';const chk=isAdmin||(roles[r]||[]).includes(m.id);h+=`<div class="perm-cell"><input type="checkbox" ${chk?'checked':''} ${isAdmin?'disabled':''} onchange="togglePerm('${r}','${m.id}',this.checked)"></div>`;});
      h+=`</div>`;
    }
  });h+=`</div>`;el.innerHTML=h;
}
function togglePermModuleAll(role,moduleId,val){
  if(role==='Admin')return;
  if(!roles[role])roles[role]=[];
  const subs=SUBTABS[moduleId];
  if(!subs||!subs.length)return;
  if(val)subs.forEach(s=>{const k=moduleId+'.'+s;if(!roles[role].includes(k))roles[role].push(k);});
  else roles[role]=roles[role].filter(x=>!x.startsWith(moduleId+'.'));
  saveAll();renderPermMatrix();toast('Hak akses diperbarui');
}
function toggleSubPerm(role,moduleId,subId,val){
  if(role==='Admin')return;
  if(!roles[role])roles[role]=[];
  const key=moduleId+'.'+subId;
  if(val){if(!roles[role].includes(key))roles[role].push(key);}
  else roles[role]=roles[role].filter(x=>x!==key);
  saveAll();renderPermMatrix();toast('Hak akses diperbarui');
}
function togglePerm(role,moduleId,val){
  if(role==='Admin')return;if(!roles[role])roles[role]=[];
  if(val){if(!roles[role].includes(moduleId))roles[role].push(moduleId);}else{roles[role]=roles[role].filter(x=>x!==moduleId);}
  saveAll();renderPermMatrix();toast('Hak akses diperbarui');
}
function openRoleModal(){openModal('m-role');document.getElementById('r-nama').value='';}
function simpanRole(){const nama=document.getElementById('r-nama').value.trim();if(!nama){toast('Nama wajib');return;}if(roles[nama]){toast('Role sudah ada');return;}roles[nama]=[];saveAll();renderPermMatrix();closeModal('m-role');toast('Role "'+nama+'" ditambahkan');}
function switchUsrTab(el,tid){el.parentElement.querySelectorAll('.tab').forEach(t=>t.classList.remove('active'));el.classList.add('active');['um-daftar','um-roles'].forEach(id=>{const d=document.getElementById(id);if(d)d.style.display=id===tid?'block':'none';});if(tid==='um-roles')renderPermMatrix();}
// ── BRANDING ────────────────────────────────────
function applyBranding(){
  const logo=perusahaan.logo||'';const nama=perusahaan.nama||'SiGaji';
  ['login-logo','topbar-logo'].forEach(id=>{const e=document.getElementById(id);if(e){e.src=logo;e.style.display=logo?'block':'none';}});
  const ln=document.getElementById('login-nama');if(ln)ln.textContent=logo?'':('\u25C6 '+nama.split(' ')[0]);
  const tn=document.getElementById('topbar-nama');if(tn)tn.style.display=logo?'none':'inline';
  const lp=document.getElementById('logo-preview');if(lp){if(logo){lp.src=logo;lp.style.display='block';}else lp.style.display='none';}
}
// ── LOGIN ────────────────────────────────────────
function ql(u,p){document.getElementById('lu').value=u;document.getElementById('lp').value=p;}
function sigajiIsCloudConfigured(){
  return !!(window.SIGAJI_SUPABASE_URL||'').trim() && !!(window.SIGAJI_SUPABASE_ANON_KEY||'').trim();
}
/** Dipanggil setelah config.js: sembunyikan login lokal, wajibkan email Supabase. */
function sigajiApplyCloudLoginUi(){
  if(!sigajiIsCloudConfigured())return;
  window.sigajiCloudOnlyMode=true;
  var lu=document.getElementById('lu');
  var lp=document.getElementById('lp');
  if(lu){lu.value='';lu.removeAttribute('value');lu.placeholder='nama@perusahaan.com';}
  if(lp){lp.value='';lp.removeAttribute('value');lp.type='password';lp.placeholder='';}
  var l1=document.getElementById('lu-lbl');if(l1)l1.textContent='Email';
  var l2=document.getElementById('lp-lbl');if(l2)l2.textContent='Kata sandi';
  var q=document.getElementById('login-quick-local');
  if(q)q.style.display='none';
  var h=document.getElementById('cloud-login-hint');
  if(h){
    h.style.display='block';
    h.innerHTML='Login memakai <strong>email + sandi Supabase</strong> (Authentication). Setelah sukses, data di perangkat digabung dengan salinan di awan. <strong>Cadangan:</strong> F12 → Application → Local Storage → salin <code style="background:#e5e7eb;padding:1px 4px;border-radius:4px">sigaji_db</code> atau <code style="background:#e5e7eb;padding:1px 4px;border-radius:4px">sigaji_universal</code>.';
  }
  // Jika fitur "ingat username" aktif, aplikasikan lagi setelah UI cloud membersihkan input
  try{if(typeof initRememberUsername==='function')initRememberUsername();}catch(e){}
}
if(typeof window!=='undefined'){
  window.sigajiApplyCloudLoginUi=sigajiApplyCloudLoginUi;
  window.sigajiIsCloudConfigured=sigajiIsCloudConfigured;
}
/** Dipakai login lokal + login Supabase (cloud-sync.js). */
function enterAppWithUser(user){
  if(!user)return;
  CU={...user};
  // Remember username (localStorage)
  try{
    var cb=document.getElementById('remember-username');
    var lu=document.getElementById('lu');
    if(cb){
      localStorage.setItem('sigaji_remember_username',cb.checked?'1':'0');
      if(cb.checked&&lu&&lu.value!=null)localStorage.setItem('sigaji_last_username',String(lu.value||''));
      if(!cb.checked)localStorage.removeItem('sigaji_last_username');
    }
  }catch(e){}
  document.getElementById('login').style.display='none';document.getElementById('app').style.display='flex';
  document.getElementById('uav').textContent=ini(CU.nama);document.getElementById('uname').textContent=CU.nama;document.getElementById('urbadge').textContent=CU.role;
  document.getElementById('top-periode').textContent=PA().nama;
  applyBranding();renderSidebar();renderAll();
  const firstPg=MODULES.map(m=>m.id).find(id=>canAccessModule(id))||'notifikasi';
  showPg(canAccessModule('dashboard')?'dashboard':firstPg);
  updateNotifBadge();
}
function doLogin(){
  const rawU=document.getElementById('lu').value.trim();
  const u=rawU.toLowerCase();
  const pw=document.getElementById('lp').value;
  // Persist remember-username choice early (before async cloud login)
  try{
    var cb=document.getElementById('remember-username');
    if(cb){
      localStorage.setItem('sigaji_remember_username',cb.checked?'1':'0');
      if(cb.checked)localStorage.setItem('sigaji_last_username',rawU);
      else localStorage.removeItem('sigaji_last_username');
    }
  }catch(e){}
  const cloudOn=sigajiIsCloudConfigured();
  if(cloudOn||window.sigajiCloudOnlyMode){
    if(!cloudOn){
      toast('Isi js/config.js (URL + anon key Supabase) lalu deploy ulang.');
      return;
    }
    if(rawU.indexOf('@')<0){
      toast('Gunakan email lengkap untuk masuk (contoh: anda@gmail.com). Mode ini terhubung ke Supabase, bukan username admin/hrd lokal.');
      return;
    }
    if(typeof window.sigajiTryCloudLogin!=='function'){
      toast('File js/cloud-sync.js tidak termuat. Periksa deploy / urutan script di index.html.');
      return;
    }
    if(!pw){toast('Isi sandi akun Supabase Anda.');return;}
    window.sigajiTryCloudLogin(rawU,pw);
    return;
  }
  const user=users.find(x=>x.username.toLowerCase()===u&&x.password===pw&&x.aktif!==false);
  if(!user){toast('Username/password salah atau user tidak aktif');return;}
  enterAppWithUser(user);
}

function initRememberUsername(){
  try{
    var cb=document.getElementById('remember-username');
    var lu=document.getElementById('lu');
    if(!cb||!lu)return;
    var on=localStorage.getItem('sigaji_remember_username')==='1';
    cb.checked=on;
    if(on){
      var last=localStorage.getItem('sigaji_last_username')||'';
      if(last)lu.value=last;
    }
    // Persist preference changes immediately
    cb.onchange=function(){
      try{
        localStorage.setItem('sigaji_remember_username',cb.checked?'1':'0');
        if(cb.checked)localStorage.setItem('sigaji_last_username',String(lu.value||''));
        else localStorage.removeItem('sigaji_last_username');
      }catch(e){}
    };
    // If enabled, keep saving latest username as user types
    lu.oninput=function(){
      try{
        if(localStorage.getItem('sigaji_remember_username')==='1'){
          localStorage.setItem('sigaji_last_username',String(lu.value||''));
        }
      }catch(e){}
    };
  }catch(e){}
}
function doLogout(){
  try{if(typeof window.sigajiCloudLogout==='function')window.sigajiCloudLogout().catch(function(){});}catch(e){}
  document.getElementById('login').style.display='flex';document.getElementById('app').style.display='none';CU=null;
}
if(typeof window!=='undefined')window.enterAppWithUser=enterAppWithUser;
function uploadLogo(inp){const f=inp.files[0];if(!f)return;if(f.size>2097152){toast('Maks 2MB');return;}const r=new FileReader();r.onload=e=>{perusahaan.logo=e.target.result;saveAll();applyBranding();toast('Logo diupload');};r.readAsDataURL(f);}
function hapusLogo(){perusahaan.logo='';saveAll();applyBranding();toast('Logo dihapus');}
function populatePhkAlasanSelect(){
  try{
    var el=document.getElementById('sp-phk-alasan');if(!el||typeof PHK_ALASAN_OPTS==='undefined')return;
    el.innerHTML=PHK_ALASAN_OPTS.map(function(o){return '<option value="'+String(o.id).replace(/"/g,'&quot;')+'">'+(String(o.lbl||'').replace(/</g,'&lt;'))+'</option>';}).join('');
  }catch(e){console.error('populatePhkAlasanSelect',e);}
}
function toggleSpPhkWrap(){
  var ber=document.getElementById('sp-berhenti-f');
  var w=document.getElementById('sp-phk-wrap');
  if(!w)return;
  var on=ber&&String(ber.value||'').trim();
  w.style.display=on?'':'none';
  if(on&&(!document.getElementById('sp-phk-alasan')||!document.getElementById('sp-phk-alasan').options.length))populatePhkAlasanSelect();
}
function renderAll(){renderDash();renderKar();renderPenggajian();renderPPH();renderLaporan();renderApproval();renderNotif();renderPeriodes();renderHariLibur();renderCutiRekap();renderTHR();try{if(typeof renderPesangon==='function')renderPesangon();}catch(e){console.error('renderPesangon',e);}populateSelects();renderPeriodeSelects();loadPrsForm();applyBranding();renderUsers();renderPermMatrix();populatePhkAlasanSelect();renderMigrationStatus();}
// ── DASHBOARD ───────────────────────────────────
function renderDash(){
  const p=PA();const hP=Math.max(0,Math.ceil((new Date(p.bayar)-Date.now())/86400000));
  const thrTag=p.thr_aktif?`<span style="background:#5b21b6;color:#fff;padding:2px 8px;border-radius:20px;font-size:10px;font-weight:700;margin-left:6px">&#127873; THR ${p.thr_nama||''}</span>`:'';
  document.getElementById('pb-dash').innerHTML=`<div class="pb mb2"><div><div style="font-size:10px;opacity:.75">Periode Aktif</div><div style="font-size:18px;font-weight:800">${p.nama}${thrTag}</div><div style="font-size:11px;opacity:.8">${fmtDate(p.start)} &#8212; ${fmtDate(p.end)} | Bayar: ${fmtDate(p.bayar)}${p.thr_aktif?` | THR: ${fmtDate(p.thr_bayar||'-')}`:''}</div></div><div style="text-align:right"><div style="font-size:28px;font-weight:800">${hP}</div><div style="font-size:10px;opacity:.75">hari menuju penggajian</div></div></div>`;
  let tB=0,tP=0,tN=0,tT=0;const depts={};
  const list=karyawanListPeriode(p);
  ensureKarSnapshotPeriode(p.nama,list);
  list.forEach(k=>{const g=hitungGaji(k,p.nama);tB+=g.grossPPh;tP+=g.pph;tN+=g.neto;tT+=g.thrBruto;if(!depts[k.dept])depts[k.dept]={n:0,b:0,n2:0};depts[k.dept].n++;depts[k.dept].b+=g.grossPPh;depts[k.dept].n2+=g.neto;});
  document.getElementById('d-kar').textContent=list.length;document.getElementById('d-bruto').textContent=fmt(tB);document.getElementById('d-pph').textContent=fmt(tP);document.getElementById('d-neto').textContent=fmt(tN);
  document.getElementById('d-table').innerHTML=Object.entries(depts).map(([d,v])=>`<tr><td><strong>${d}</strong></td><td>${v.n}</td><td>${fmt(v.b)}</td><td>${fmt(v.n2)}</td></tr>`).join('');
  const pRet=list.reduce((s,k)=>s+(k.pph_return?.nilai||0),0);
  const pAp=approvals.filter(a=>a.status==='pending'&&a.period===p.nama).length;
  document.getElementById('d-alerts').innerHTML=`${p.thr_aktif?`<div style="padding:10px 14px;background:#f5f0ff;border-radius:7px;border-left:3px solid #5b21b6;font-size:12px;margin-bottom:5px">&#127873; <strong>Periode ini ada THR (${p.thr_nama||''})</strong> &#8212; Total THR Bruto: <strong>${fmt(tT)}</strong> | Bayar THR: <strong>${p.thr_bayar||'-'}</strong> | PPh THR digabung ke gaji akhir bulan.</div>`:''}${pAp>0?`<div style="padding:8px 12px;background:#fef3e2;border-radius:7px;border-left:3px solid #7d4800;font-size:12px;margin-bottom:5px"><strong>${pAp} Approval Tertunda</strong></div>`:''}${pRet>0?`<div style="padding:8px 12px;background:#e8f4de;border-radius:7px;border-left:3px solid #2d6a0a;font-size:12px;margin-bottom:5px"><strong>Pengembalian PPh 21:</strong> ${fmt(pRet)}</div>`:''}`;
}
// ── MASTER KARYAWAN ─────────────────────────────
function karRowHtml(k,no){
  const showGaji=CU&&(CU.role==='Admin'||canAccessSubTab('karyawan','gaji'));
  const yrKar=new Date().getFullYear();
  const t=cutiTerpakai(k.nik,yrKar);
  const kuotaCut=masterCuti.kuota||12;
  const s=kuotaCut-t;
  const sCls=s<=0?'b-err':s<=3?'b-warn':'b-teal';
  const sLbl=s+'/'+kuotaCut;
  const bpjsKeys=['kes-prs','kes-kar','jht-prs','jht-kar','jp-prs','jp-kar','jkk-prs','jkm-prs'];
  const bpjsOn=bpjsKeys.filter(function(key){return bpjsKompAktif(k,key);}).length;
  const bst=bpjsOn===8?'b-ok':bpjsOn>0?'b-warn':'b-err';
  const bpjsLbl=bpjsOn===8?'Lengkap':bpjsOn===0?'Off':bpjsOn+'/8 aktif';
  const stCls=k.status==='Tetap'?'b-ok':k.status==='Kontrak'?'b-warn':'b-gray';
  return`<tr><td style="text-align:center;color:#6b7280;font-weight:700">${no}</td><td><div class="fl gap2" style="align-items:center"><div class="ka">${ini(k.nama)}</div><div><div class="knl" onclick="openPanel('${k.nik}')">${k.nama} &#8599;</div><div style="font-size:10px;color:#6b7280">${k.nik}</div></div></div></td><td>${k.dept}</td><td>${k.jabatan}</td><td><span class="bdg ${stCls}">${k.status}</span></td>${showGaji?`<td>${fmt(k.gapok)}</td>`:''}<td><span class="bdg b-info">${k.ptkp}</span></td><td><span class="bdg ${bst}">${bpjsLbl}</span></td><td><span class="bdg ${sCls}" title="Saldo cuti tahun ${yrKar}">${sLbl}</span></td><td><div class="fl gap1"><button class="btn btn-sm btn-p" onclick="openPanel('${k.nik}')">Profil</button><button class="btn btn-sm btn-r" onclick="hapusKar('${k.nik}')">Hapus</button></div></td></tr>`;
}
function renderKar(){
  const p=PA();
  const list=karyawan.filter(function(k){return karyawanInPeriode(k,p);});
  const el=document.getElementById('kar-count');if(el)el.textContent=list.length+' karyawan • Master global (bukan histori periode)';
  const th=document.getElementById('kar-thead-row');
  if(th){
    const showGaji=CU&&(CU.role==='Admin'||canAccessSubTab('karyawan','gaji'));
    th.innerHTML='<th>No</th><th>Karyawan</th><th>Dept</th><th>Jabatan</th><th>Status</th>'+(showGaji?'<th>Gaji Pokok</th>':'')+'<th>PTKP</th><th>BPJS</th><th>Saldo Cuti</th><th>Aksi</th>';
  }
  const tb=document.getElementById('tb-kar');if(!tb)return;
  tb.innerHTML=list.map((k,i)=>karRowHtml(k,i+1)).join('');
}
function filterKar(q){
  const p=PA();
  const r=karyawan
    .filter(function(k){return karyawanInPeriode(k,p);})
    .filter(function(k){return (k.nama+k.nik+k.jabatan+k.dept).toLowerCase().includes(q.toLowerCase());});
  document.getElementById('kar-count').textContent=r.length+' ditampilkan';
  document.getElementById('tb-kar').innerHTML=r.map((k,i)=>karRowHtml(k,i+1)).join('');
}
function hapusKar(nik){const k=karyawan.find(x=>x.nik===nik);if(!k||!confirm('Hapus '+k.nama+'?'))return;karyawan=karyawan.filter(x=>x.nik!==nik);delete absensi[nik];delete lembur[nik];saveAll();renderKar();renderDash();populateSelects();toast('Karyawan dihapus');}
function openNewKar(){if(!canAccessSubTab('karyawan','info')){toast('Tidak punya akses menambah profil karyawan');return;}const nik='K'+String(karyawan.length+1).padStart(4,'0');karyawan.push({nik,nama:'Karyawan Baru',dept:'Operasional',jabatan:'Staff',status:'Tetap',masuk:new Date().toISOString().split('T')[0],ptkp:'TK0',jk:'L',agama:'Islam',ktp:'',npwp:'',hp:'',email:'',alamat:'',atasan:'',lokasi:'',bank:'BCA',norek:'',reknam:'',gapok:5000000,tunjangan:[],potongan:[],bpjs_aktif:{'kes-prs':true,'kes-kar':true,'jht-prs':true,'jht-kar':true,'jp-prs':true,'jp-kar':true,'jkk-prs':true,'jkm-prs':true},bpjs_manual:{},natura:[],pph_return:{nilai:0,ket:''}});saveAll();renderKar();populateSelects();openPanel(nik);toast('Karyawan baru dibuat');}
// ── SLIDE PANEL ──────────────────────────────────
const KAR_SP_TABS=[['sp-info','info'],['sp-gaji','gaji'],['sp-bpjs','bpjs'],['sp-natura','natura'],['sp-pphret','pphret'],['sp-ring','ring']];
function applyKarSlideTabsVisibility(){
  let first=null;
  KAR_SP_TABS.forEach(function(pair){
    var tid=pair[0],sub=pair[1];
    var ok=canAccessSubTab('karyawan',sub);
    var btn=document.querySelector('#slide-panel .spt[data-kstab="'+sub+'"]');
    if(btn){btn.style.display=ok?'':'none';if(ok&&!first)first={btn:btn,tid:tid};}
    var d=document.getElementById(tid);if(d)d.style.display='none';
  });
  if(!first){toast('Role Anda tidak punya akses tab pada profil karyawan.');return false;}
  switchSpTab(first.btn,first.tid);
  return true;
}
function openPanel(nik){
  if(!canAccessModule('karyawan')){toast('Tidak punya akses modul Master Karyawan');return;}
  const k=karyawan.find(x=>x.nik===nik);if(!k)return;cpNik=nik;
  spPayrollView='periode';
  document.getElementById('sp-nik').textContent=k.nik;document.getElementById('sp-name').textContent=k.nama;document.getElementById('sp-sub').textContent=k.jabatan+' &#8212; '+k.dept;document.getElementById('sp-saved-lbl').textContent='ID: '+k.nik;
  const sv=(id,v)=>{const e=document.getElementById(id);if(e)e.value=v??'';};
  const isNew=k._new;
  if(isNew)delete k._new;
  sv('sp-nik-f',k.nik);sv('sp-nama-f',isNew?'':k.nama);sv('sp-jk-f',k.jk);sv('sp-agama-f',k.agama);
  sv('sp-ktp-f',isNew?'':k.ktp);sv('sp-npwp-f',isNew?'':k.npwp);sv('sp-hp-f',isNew?'':k.hp);sv('sp-email-f',isNew?'':k.email);sv('sp-alamat-f',isNew?'':k.alamat);
  sv('sp-dept-f',k.dept);sv('sp-jabatan-f',isNew?'':k.jabatan);sv('sp-status-f',k.status);sv('sp-masuk-f',isNew?'':k.masuk);sv('sp-berhenti-f',k.tgl_berhenti||'');
  populatePhkAlasanSelect();
  var spa=document.getElementById('sp-phk-alasan');if(spa)spa.value=(k.phk&&k.phk.alasan)?k.phk.alasan:'';
  toggleSpPhkWrap();
  sv('sp-ptkp-f',k.ptkp);sv('sp-atasan-f',isNew?'':k.atasan);sv('sp-lokasi-f',isNew?'':k.lokasi);
  sv('sp-bank-f',k.bank||'BCA');sv('sp-norek-f',isNew?'':k.norek||'');
  sv('sp-reknam-f',k.reknam||k.nama||'');
  var kp=getPayrollTargetByNik(k.nik,true,'periode')||k;
  if(canAccessSubTab('karyawan','gaji'))sv('sp-gapok-f',isNew?'':kp.gapok);else sv('sp-gapok-f','');
  const re=document.getElementById('sp-reknam-f');if(re)re.dataset.manualEdit=(k.reknam&&k.reknam!==k.nama)?'1':'';
  if(canAccessSubTab('karyawan','pphret')){sv('sp-pphret-val',kp.pph_return?.nilai||0);sv('sp-pphret-ket',kp.pph_return?.ket||'');}
  else{sv('sp-pphret-val','');sv('sp-pphret-ket','');}
  updatePTKPVal();
  if(canAccessSubTab('karyawan','gaji')){renderTunjPanel(kp);renderPotPanel(kp);}else{const tj=document.getElementById('tunj-list'),pt=document.getElementById('pot-list');if(tj)tj.innerHTML='';if(pt)pt.innerHTML='';}
  if(canAccessSubTab('karyawan','bpjs'))loadBPJSPanel(kp);else{const k1=document.getElementById('bpjs-kes-rows'),k2=document.getElementById('bpjs-tk-rows');if(k1)k1.innerHTML='';if(k2)k2.innerHTML='';}
  if(canAccessSubTab('karyawan','natura')){renderNaturaPanel(kp);document.getElementById('natura-kar-lbl').textContent=k.nama;}
  else{const nl=document.getElementById('natura-list'),nt=document.getElementById('natura-total');if(nl)nl.innerHTML='';if(nt)nt.innerHTML='';}
  if(canAccessSubTab('karyawan','pphret'))renderPPhRetPanel(kp);else{const el=document.getElementById('pphret-preview');if(el)el.innerHTML='';}
  document.getElementById('slide-panel').classList.add('show');document.getElementById('panel-overlay').classList.add('show');
  if(!applyKarSlideTabsVisibility()){closePanel();return;}
  setSpPayrollView('periode');
  updateGajiSummary();
}
function closePanel(){document.getElementById('slide-panel').classList.remove('show');document.getElementById('panel-overlay').classList.remove('show');cpNik=null;}
function simpanKarPanel(){
  const k=karyawan.find(x=>x.nik===cpNik);if(!k)return;
  const gv=id=>{const e=document.getElementById(id);return e?e.value:'';};
  const oldNik=k.nik,newNik=gv('sp-nik-f').trim()||k.nik;
  var tbh=gv('sp-berhenti-f').trim();
  var phkAl=document.getElementById('sp-phk-alasan');
  if(tbh){
    if(!phkAl||!String(phkAl.value||'').trim()){toast('Jika tanggal berhenti diisi, wajib pilih alasan PHK (sesuai UU Cipta Kerja).');return;}
    if(!k.phk)k.phk={};
    k.phk.alasan=phkAl.value;
  }else{
    delete k.tgl_berhenti;
    delete k.phk;
  }
  Object.assign(k,{nik:newNik,nama:gv('sp-nama-f'),dept:gv('sp-dept-f'),jabatan:gv('sp-jabatan-f'),status:gv('sp-status-f'),masuk:gv('sp-masuk-f'),tgl_berhenti:tbh||undefined,ptkp:gv('sp-ptkp-f'),atasan:gv('sp-atasan-f'),lokasi:gv('sp-lokasi-f'),bank:gv('sp-bank-f'),norek:gv('sp-norek-f'),reknam:gv('sp-reknam-f'),jk:gv('sp-jk-f'),agama:gv('sp-agama-f'),ktp:gv('sp-ktp-f'),npwp:gv('sp-npwp-f'),hp:gv('sp-hp-f'),email:gv('sp-email-f'),alamat:gv('sp-alamat-f')});
  var pAktif=PA();
  var locked=!!(pAktif&&pAktif.nama&&isPeriodeLocked(pAktif.nama));
  var tgt=(pAktif&&pAktif.nama)?getPayrollTargetByNik(k.nik,true,'periode'):k;
  if(!locked){
    if(canAccessSubTab('karyawan','gaji'))tgt.gapok=parseFloat(gv('sp-gapok-f'))||0;
    // PPh Return adalah komponen payroll-periode → hanya disimpan ke snapshot periode aktif
    if(canAccessSubTab('karyawan','pphret'))tgt.pph_return={nilai:parseFloat(gv('sp-pphret-val'))||0,ket:gv('sp-pphret-ket')};
    logPayrollAudit(k.nik,'Simpan Payroll Panel',`gapok=${tgt.gapok} pph_return=${(tgt.pph_return&&tgt.pph_return.nilai)||0}`);
  }
  if(newNik!==oldNik){if(absensi[oldNik]){absensi[newNik]=absensi[oldNik];delete absensi[oldNik];}if(lembur[oldNik]){lembur[newNik]=lembur[oldNik];delete lembur[oldNik];}cpNik=newNik;}
  if(locked&&typeof toast==='function')toast('Periode '+pAktif.nama+' terkunci: snapshot tidak diubah.');
  saveAll();document.getElementById('sp-nik').textContent=k.nik;document.getElementById('sp-name').textContent=k.nama;document.getElementById('sp-sub').textContent=k.jabatan+' &#8212; '+k.dept;
  renderKar();renderDash();renderPenggajian();renderPPH();if(typeof renderPesangon==='function')renderPesangon();populateSelects();updateGajiSummary();toast('Data '+k.nama+' disimpan');
}
function hapusKarFromPanel(){const k=karyawan.find(x=>x.nik===cpNik);if(!k||!confirm('Hapus '+k.nama+'?'))return;karyawan=karyawan.filter(x=>x.nik!==cpNik);delete absensi[cpNik];delete lembur[cpNik];saveAll();closePanel();renderKar();renderDash();populateSelects();toast('Karyawan dihapus');}
function renderTunjPanel(k){
  const list=k.tunjangan||[];
  const nik=k.nik;
  const snapMode=isPayrollSnapshotMode();
  const nilaiStyle=snapMode?'':'background:#f3f4f6;color:#6b7280;cursor:not-allowed';
  document.getElementById('tunj-list').innerHTML=list.length?list.map(function(t,i){
    const showThr=t.tipe==='tetap'||t.tipe==='tetap_no_bpjs';
    const thrIkut=showThr&&t.thr_ikut!==false;
    const prIkut=t.prorata_ikut!==false;
    const sel1=Object.entries(TUNJ_TYPES).map(function(e){return'<option value="'+e[0]+'" '+(t.tipe===e[0]?'selected':'')+'>'+e[1]+'</option>';}).join('');
    return '<div class="tr-row" style="grid-template-columns:1.25fr 1fr 1fr 0.58fr 0.72fr auto">'
      +'<input value="'+t.nama+'" style="padding:5px 8px;border:1.5px solid #dde1e9;border-radius:6px;font-size:12px;font-family:inherit;outline:none" data-nik="'+nik+'" data-i="'+i+'" data-f="nama" onchange="updTunjEl(this)">'
      +'<input type="number" value="'+t.nilai+'" '+(snapMode?'':'readonly title="Nominal tunjangan diisi pada mode Snapshot Periode"')+' style="padding:5px 8px;border:1.5px solid #dde1e9;border-radius:6px;font-size:12px;font-family:inherit;outline:none;'+nilaiStyle+'" data-nik="'+nik+'" data-i="'+i+'" data-f="nilai" data-num="1" onchange="updTunjEl(this)">'
      +'<select style="padding:5px 8px;border:1.5px solid #dde1e9;border-radius:6px;font-size:11px;font-family:inherit;outline:none" data-nik="'+nik+'" data-i="'+i+'" data-f="tipe" onchange="updTunjEl(this);refreshTunjPanel(this.dataset.nik)">'+sel1+'</select>'
      +'<select title="Ikut THR?" style="padding:5px 8px;border:1.5px solid #dde1e9;border-radius:6px;font-size:10px;font-family:inherit;outline:none;'+(showThr?'':'opacity:.35;pointer-events:none')+'" data-nik="'+nik+'" data-i="'+i+'" data-f="thr_ikut" onchange="updTunjEl(this)">'
        +'<option value="ya" '+(thrIkut?'selected':'')+'>&#127873;THR</option>'
        +'<option value="tidak" '+(!thrIkut?'selected':'')+'>Excl</option>'
      +'</select>'
      +'<select title="Ikut Pro-Rata gaji?" style="padding:5px 8px;border:1.5px solid #dde1e9;border-radius:6px;font-size:10px;font-family:inherit;outline:none" data-nik="'+nik+'" data-i="'+i+'" data-f="prorata_ikut" onchange="updTunjEl(this)">'
        +'<option value="ya" '+(prIkut?'selected':'')+'>Ikat</option>'
        +'<option value="tidak" '+(!prIkut?'selected':'')+'>Penuh</option>'
      +'</select>'
      +'<button class="btn btn-xs btn-r" data-nik="'+nik+'" data-i="'+i+'" onclick="delTunjEl(this)">&#10007;</button>'
    +'</div>';
  }).join(''):'<div style="font-size:12px;color:#6b7280;padding:.5rem">Belum ada tunjangan.</div>';
}
function refreshTunjPanel(nik){
  const k=getPayrollTargetByNik(nik,true);
  if(k)renderTunjPanel(k);
}
function updTunjEl(el){
  if(el.dataset.f==='nilai'&&!isPayrollSnapshotMode()){toast('Nominal tunjangan diubah pada mode Snapshot Periode');el.blur();return;}
  if(!guardPayrollEditUnlocked())return;
  const nik=el.dataset.nik;const i=parseInt(el.dataset.i);const f=el.dataset.f;
  let v=el.value;
  if(el.dataset.num)v=parseFloat(v)||0;
  if(f==='thr_ikut'||f==='prorata_ikut')v=v==='ya';
  updTunj(nik,i,f,v);
}
function delTunjEl(el){delTunj(el.dataset.nik,parseInt(el.dataset.i));}
function renderPotPanel(k){const list=k.potongan||[];document.getElementById('pot-list').innerHTML=list.length?list.map((p,i)=>`<div style="display:grid;grid-template-columns:2fr 1fr 1fr auto;gap:.4rem;align-items:center;padding:.5rem .6rem;background:#fdeaea;border-radius:7px;border:1px solid #f5a3a3;margin-bottom:.4rem"><input value="${p.nama}" style="padding:5px 8px;border:1.5px solid #dde1e9;border-radius:6px;font-size:12px;width:100%;font-family:inherit;outline:none" onchange="updPot('${k.nik}',${i},'nama',this.value)"><input type="number" value="${p.nilai}" style="padding:5px 8px;border:1.5px solid #dde1e9;border-radius:6px;font-size:12px;width:100%;font-family:inherit;outline:none" onchange="updPot('${k.nik}',${i},'nilai',parseFloat(this.value)||0)"><input value="${p.ket||''}" placeholder="Ket." style="padding:5px 8px;border:1.5px solid #dde1e9;border-radius:6px;font-size:12px;width:100%;font-family:inherit;outline:none" onchange="updPot('${k.nik}',${i},'ket',this.value)"><button class="btn btn-xs btn-r" onclick="delPot('${k.nik}',${i})">&#10007;</button></div>`).join(''):'<div style="font-size:12px;color:#6b7280;padding:.5rem">Belum ada.</div>';}
function addTunj(){
  if(!canAccessSubTab('karyawan','gaji'))return;
  if(!guardPayrollEditUnlocked())return;
  const k=getPayrollTargetByNik(cpNik,true);if(!k)return;
  if(!k.tunjangan)k.tunjangan=[];
  k.tunjangan.push({nama:'Komponen Baru',nilai:0,tipe:'tetap',thr_ikut:true,prorata_ikut:true});
  logPayrollAudit(cpNik,'Tambah Tunjangan','Komponen Baru');
  saveAll();
  renderTunjPanel(k);updateGajiSummary();
}
function addPot(){
  if(!canAccessSubTab('karyawan','gaji'))return;
  if(!guardPayrollEditUnlocked())return;
  const k=getPayrollTargetByNik(cpNik,true);if(!k)return;
  if(!k.potongan)k.potongan=[];
  k.potongan.push({nama:'Potongan Baru',nilai:0,ket:''});
  logPayrollAudit(cpNik,'Tambah Potongan','Potongan Baru');
  saveAll();
  renderPotPanel(k);updateGajiSummary();
}
function updTunj(nik,i,f,v){
  if(!guardPayrollEditUnlocked())return;
  const k=getPayrollTargetByNik(nik,true);if(!k)return;
  const before=deepCloneLite(k.tunjangan&&k.tunjangan[i]?k.tunjangan[i][f]:undefined);
  k.tunjangan[i][f]=v;
  logPayrollAudit(nik,'Update Tunjangan',`idx=${i} field=${f} ${String(before)} → ${String(v)}`);
  saveAll();
  updateGajiSummary();
}
function updPot(nik,i,f,v){
  if(!guardPayrollEditUnlocked())return;
  const k=getPayrollTargetByNik(nik,true);if(!k)return;
  const before=deepCloneLite(k.potongan&&k.potongan[i]?k.potongan[i][f]:undefined);
  k.potongan[i][f]=v;
  logPayrollAudit(nik,'Update Potongan',`idx=${i} field=${f} ${String(before)} → ${String(v)}`);
  saveAll();
  updateGajiSummary();
}
function delTunj(nik,i){
  if(!guardPayrollEditUnlocked())return;
  const k=getPayrollTargetByNik(nik,true);if(!k)return;
  const before=deepCloneLite((k.tunjangan||[])[i]||{});
  k.tunjangan.splice(i,1);
  logPayrollAudit(nik,'Hapus Tunjangan',`idx=${i} ${before&&before.nama?before.nama:''}`);
  saveAll();
  renderTunjPanel(k);updateGajiSummary();
}
function delPot(nik,i){
  if(!guardPayrollEditUnlocked())return;
  const k=getPayrollTargetByNik(nik,true);if(!k)return;
  const before=deepCloneLite((k.potongan||[])[i]||{});
  k.potongan.splice(i,1);
  logPayrollAudit(nik,'Hapus Potongan',`idx=${i} ${before&&before.nama?before.nama:''}`);
  saveAll();
  renderPotPanel(k);updateGajiSummary();
}
function updatePTKPVal(){const e=document.getElementById('sp-ptkp-f');const v=document.getElementById('sp-ptkp-val-f');if(!e||!v)return;v.value=fmtPTKPVal(nilaiPTKP(e.value));}
function onNamaChange(){const n=document.getElementById('sp-nama-f')?.value||'';const r=document.getElementById('sp-reknam-f');if(r&&!r.dataset.manualEdit)r.value=n;}
function onReknamEdit(){const e=document.getElementById('sp-reknam-f');if(e)e.dataset.manualEdit='1';}
function formatNPWP(input){let v=input.value.replace(/[^0-9]/g,'');if(v.length>15)v=v.slice(0,15);let r='';if(v.length>0)r+=v.slice(0,2);if(v.length>2)r+='.'+v.slice(2,5);if(v.length>5)r+='.'+v.slice(5,8);if(v.length>8)r+='.'+v.slice(8,9);if(v.length>9)r+='-'+v.slice(9,12);if(v.length>12)r+='.'+v.slice(12,15);input.value=r;}
// ── BPJS PANEL ──────────────────────────────────
function loadBPJSPanel(k){
  const tB=(k.tunjangan||[]).filter(function(t){return t.tipe==='tetap';}).reduce(function(s,t){return s+t.nilai;},0);
  const basis=k.gapok+tB;const bm=k.bpjs_manual||{};
  const KOMP=[
    {key:'kes-prs',tarif:'4%',lbl:'BPJS Kes Perusahaan (4%)',sec:'kes'},
    {key:'kes-kar',tarif:'1%',lbl:'BPJS Kes Karyawan (1%)',sec:'kes'},
    {key:'jht-prs',tarif:'3,7%',lbl:'JHT Perusahaan (3,7%)',sec:'tk'},
    {key:'jht-kar',tarif:'2%',lbl:'JHT Karyawan (2%)',sec:'tk'},
    {key:'jp-prs',tarif:'2%',lbl:'JP Perusahaan (2%)',sec:'tk'},
    {key:'jp-kar',tarif:'1%',lbl:'JP Karyawan (1%)',sec:'tk'},
    {key:'jkk-prs',tarif:'0,24%',lbl:'JKK Perusahaan (0,24%)',sec:'tk'},
    {key:'jkm-prs',tarif:'0,3%',lbl:'JKM Perusahaan (0,3%)',sec:'tk'}
  ];
  const mkRow=function(c){
    const ok=bpjsKompAktif(k,c.key);
    const def=BPJS_DEF[c.key];const b=def.basis?Math.min(basis,def.basis):basis;
    const autoV=Math.round(b*def.pct/100);const isMn=bm[c.key]!==undefined;bmState[c.key]=isMn;
    const chk='<label style="display:flex;align-items:center;cursor:pointer;margin:0"><input type="checkbox" data-nik="'+k.nik+'" data-key="'+c.key+'" '+(ok?'checked':'')+' onchange="onBPJSKompChange(this)" style="accent-color:#1a56a0;width:15px;height:15px;cursor:pointer;margin:0"></label>';
    const nomEl='<input class="bi '+(isMn?'manual':'')+'" id="b-'+c.key+'-v" value="'+(ok?(isMn?bm[c.key]:autoV):0)+'" '+(!isMn||!ok?'readonly':'')+' data-nik="'+k.nik+'" data-key="'+c.key+'" oninput="onBMChange2(this)">';
    const modeEl=ok?('<button class="tm '+(isMn?'manual':'auto')+'" id="tm-'+c.key+'" data-key="'+c.key+'" onclick="toggleManual(this.dataset.key)">'+(isMn?'Manual':'Auto')+'</button>'):'<span class="bdg b-gray" style="font-size:10px">Off</span>';
    return '<div class="bpjs-row '+(ok?'':'off')+'">'+chk+'<div style="font-size:11px;font-weight:600">'+c.lbl+'</div><div><input class="bi" value="'+c.tarif+'" readonly style="font-size:11px"></div>'+nomEl+modeEl+'</div>';
  };
  document.getElementById('bpjs-kes-rows').innerHTML=KOMP.filter(function(c){return c.sec==='kes';}).map(mkRow).join('');
  document.getElementById('bpjs-tk-rows').innerHTML=KOMP.filter(function(c){return c.sec==='tk';}).map(mkRow).join('');
}
function onBPJSKompChange(el){
  if(!canAccessSubTab('karyawan','bpjs'))return;
  if(!guardPayrollEditUnlocked()){
    const kb=karyawan.find(function(x){return x.nik===el.dataset.nik;});
    if(kb)loadBPJSPanel(kb);
    return;
  }
  const nik=el.dataset.nik;const key=el.dataset.key;
  const k=getPayrollTargetByNik(nik,true);if(!k)return;
  const before=!!(k.bpjs_aktif&&k.bpjs_aktif[key]===true);
  if(!k.bpjs_aktif)k.bpjs_aktif={};
  k.bpjs_aktif[key]=el.checked;
  if(!el.checked&&k.bpjs_manual)delete k.bpjs_manual[key];
  logPayrollAudit(nik,'Update BPJS Aktif',`${key} ${before?'on':'off'} → ${el.checked?'on':'off'}`);
  saveAll();loadBPJSPanel(k);updateGajiSummary();
}
function onBMChange2(el){
  const nik=el.dataset.nik;const key=el.dataset.key;
  onBMChange(nik,key,el.value);
}
function bpjsSetAll(aktif){
  if(!canAccessSubTab('karyawan','bpjs'))return;
  if(!guardPayrollEditUnlocked())return;
  const k=getPayrollTargetByNik(cpNik,true);if(!k)return;
  if(!k.bpjs_aktif)k.bpjs_aktif={};
  ['kes-prs','kes-kar','jht-prs','jht-kar','jp-prs','jp-kar','jkk-prs','jkm-prs'].forEach(function(key){k.bpjs_aktif[key]=aktif;});
  saveAll();loadBPJSPanel(k);updateGajiSummary();toast(aktif?'Semua BPJS diaktifkan':'Semua BPJS dinonaktifkan');
}
function bpjsSetPreset(preset){
  if(!canAccessSubTab('karyawan','bpjs'))return;
  if(!guardPayrollEditUnlocked())return;
  const k=getPayrollTargetByNik(cpNik,true);if(!k)return;
  if(!k.bpjs_aktif)k.bpjs_aktif={};
  if(preset==='jkk-jkm'){
    ['kes-prs','kes-kar','jht-prs','jht-kar','jp-prs','jp-kar','jkk-prs','jkm-prs'].forEach(function(key){
      k.bpjs_aktif[key]=(key==='jkk-prs'||key==='jkm-prs');
    });
  }
  saveAll();loadBPJSPanel(k);updateGajiSummary();toast('Preset diterapkan');
}
function onBPJSAktifChange(){const k=karyawan.find(function(x){return x.nik===cpNik;});if(k){loadBPJSPanel(k);updateGajiSummary();}}
function onBMChange(nik,key,val){
  if(!canAccessSubTab('karyawan','bpjs'))return;
  if(!guardPayrollEditUnlocked())return;
  const k=getPayrollTargetByNik(nik,true);if(!k||!bmState[key])return;
  if(!k.bpjs_manual)k.bpjs_manual={};
  const before=k.bpjs_manual[key];
  k.bpjs_manual[key]=parseInt(val)||0;
  logPayrollAudit(nik,'Update BPJS Manual',`${key} ${String(before)} → ${String(k.bpjs_manual[key])}`);
  saveAll();
  updateGajiSummary();
}
function toggleManual(key){
  if(!canAccessSubTab('karyawan','bpjs'))return;
  if(!guardPayrollEditUnlocked())return;
  const k=getPayrollTargetByNik(cpNik,true);if(!k)return;if(!k.bpjs_manual)k.bpjs_manual={};
  const isNow=!bmState[key];bmState[key]=isNow;const ve=document.getElementById('b-'+key+'-v');const te=document.getElementById('tm-'+key);
  if(isNow){ve.readOnly=false;ve.className='bi manual';te.textContent='Manual';te.className='tm manual';k.bpjs_manual[key]=parseInt(ve.value)||0;ve.oninput=()=>{k.bpjs_manual[key]=parseInt(ve.value)||0;updateGajiSummary();};}
  else{delete k.bpjs_manual[key];ve.readOnly=true;ve.className='bi';ve.oninput=null;te.textContent='Auto';te.className='tm auto';const ok=bpjsKompAktif(k,key);if(!ok){ve.value=0;}else{const tB2=(k.tunjangan||[]).filter(t=>t.tipe==='tetap').reduce((s,t)=>s+t.nilai,0);const b2=k.gapok+tB2;const def=BPJS_DEF[key];const bas=def.basis?Math.min(b2,def.basis):b2;ve.value=Math.round(bas*def.pct/100);}}
  logPayrollAudit(cpNik,'Toggle BPJS Manual',`${key} → ${isNow?'manual':'auto'}`);
  saveAll();
  updateGajiSummary();
}
// ── NATURA PANEL ─────────────────────────────────
function renderNaturaPanel(k){const list=k.natura||[];document.getElementById('natura-list').innerHTML=list.length?list.map((n,i)=>`<div class="nat-row ${n.kp?'kp':''}"><input value="${n.nama}" style="padding:5px 8px;border:1.5px solid #dde1e9;border-radius:6px;font-size:12px;width:100%;font-family:inherit;outline:none" onchange="updNat('${k.nik}',${i},'nama',this.value)"><input type="number" value="${n.nilai}" style="padding:5px 8px;border:1.5px solid #dde1e9;border-radius:6px;font-size:12px;width:100%;font-family:inherit;outline:none" onchange="updNat('${k.nik}',${i},'nilai',parseFloat(this.value)||0)"><select style="padding:5px 8px;border:1.5px solid #dde1e9;border-radius:6px;font-size:11px;font-family:inherit;outline:none" onchange="updNat('${k.nik}',${i},'kp',this.value==='true');renderNaturaPanel(karyawan.find(x=>x.nik==='${k.nik}'))"><option value="false" ${!n.kp?'selected':''}>Tidak Kena Pajak</option><option value="true" ${n.kp?'selected':''}>Kena Pajak</option></select><button class="btn btn-xs btn-r" onclick="delNat('${k.nik}',${i})">&#10007;</button></div>`).join(''):'<div style="font-size:12px;color:#6b7280;padding:.5rem">Belum ada natura.</div>';const kp=list.filter(n=>n.kp).reduce((s,n)=>s+n.nilai,0);const nkp=list.filter(n=>!n.kp).reduce((s,n)=>s+n.nilai,0);document.getElementById('natura-total').innerHTML=list.length?`<div class="pph-box"><div class="pr-row-info"><span>Natura Tidak KP</span><span style="color:#2d6a0a;font-weight:700">${fmt(nkp)}</span></div><div class="pr-row-info"><span>Natura Kena Pajak</span><span style="color:#9b2121;font-weight:700">${fmt(kp)}</span></div><div class="pph-box-tit"><span>Total</span><span>${fmt(kp+nkp)}</span></div></div>`:'';}
function addNatura(){if(!canAccessSubTab('karyawan','natura'))return;if(!guardPayrollEditUnlocked())return;const k=getPayrollTargetByNik(cpNik,true);if(!k)return;if(!k.natura)k.natura=[];k.natura.push({nama:'Natura Baru',nilai:0,kp:false});renderNaturaPanel(k);updateGajiSummary();}
function addNatTmpl(nama,nilai,kp){if(!canAccessSubTab('karyawan','natura'))return;if(!guardPayrollEditUnlocked())return;const k=getPayrollTargetByNik(cpNik,true);if(!k)return;if(!k.natura)k.natura=[];k.natura.push({nama,nilai,kp});renderNaturaPanel(k);updateGajiSummary();toast(nama+' ditambahkan');}
function updNat(nik,i,f,v){
  if(!guardPayrollEditUnlocked())return;
  const k=getPayrollTargetByNik(nik,true);if(!k)return;
  const before=deepCloneLite(k.natura&&k.natura[i]?k.natura[i][f]:undefined);
  k.natura[i][f]=v;
  logPayrollAudit(nik,'Update Natura',`idx=${i} field=${f} ${String(before)} → ${String(v)}`);
  saveAll();
  renderNaturaPanel(k);updateGajiSummary();
}
function delNat(nik,i){
  if(!guardPayrollEditUnlocked())return;
  const k=getPayrollTargetByNik(nik,true);if(!k)return;
  const before=deepCloneLite((k.natura||[])[i]||{});
  k.natura.splice(i,1);
  logPayrollAudit(nik,'Hapus Natura',`idx=${i} ${before&&before.nama?before.nama:''}`);
  saveAll();
  renderNaturaPanel(k);updateGajiSummary();
}
function renderPPhRetPanel(k){const val=k.pph_return?.nilai||0;const el=document.getElementById('pphret-preview');if(!el)return;el.innerHTML=val>0?`<div class="pr-row-info mt1"><span>Pengembalian ke Take Home</span><span style="color:#2d6a0a;font-weight:700">${fmt(val)}</span></div>`:'';}
// ── GAJI SUMMARY PANEL ──────────────────────────
function updateGajiSummary(){
  const km=karyawan.find(x=>x.nik===cpNik);if(!km)return;
  const k=getPayrollTargetByNik(cpNik,true)||km;
  const gpEl=document.getElementById('sp-gapok-f');if(gpEl&&isPayrollSnapshotMode())k.gapok=parseFloat(gpEl.value)||k.gapok;
  let prv=0;
  if(isPayrollSnapshotMode()){
    prv=parseFloat(document.getElementById('sp-pphret-val')?.value)||0;
    k.pph_return={nilai:prv,ket:document.getElementById('sp-pphret-ket')?.value||''};
  }
  renderPPhRetPanel(k);const g=hitungGaji(km,PA().nama);const el=document.getElementById('gaji-summary-panel');if(!el)return;
  el.innerHTML=`<div class="gs"><div class="stit" style="margin-top:0">Gross Income (Dasar PPh 21)</div><div class="gs-row"><span>Gaji Pokok</span><span>${fmt(k.gapok)}</span></div>${g.tItems.map(t=>`<div class="gs-row"><span>${t.nama}${t.isHarian?' [Lump Sum]':''}</span><span>${fmt(t.eff)}</span></div>`).join('')}${g.natKP>0?`<div class="gs-row"><span>Natura Kena Pajak</span><span>${fmt(g.natKP)}</span></div>`:''}${g.lb>0?`<div class="gs-row"><span>Uang Lembur</span><span>${fmt(g.lb)}</span></div>`:''}${g.thrBruto>0?`<div class="gs-row" style="color:#5b21b6;font-weight:700"><span>THR Bruto (digabung ke Gross PPh)</span><span>${fmt(g.thrBruto)}</span></div>`:''}
<div class="gs-row" style="font-weight:700;border-top:1px solid #c5d9f5;margin-top:3px;padding-top:3px"><span>Total Gross PPh 21</span><span>${fmt(g.grossPPh)}</span></div>${g.thrBruto>0?`<div style="font-size:10px;color:#5b21b6;margin-top:2px;background:#f5f0ff;padding:4px 6px;border-radius:4px">THR sudah digabung ke Gross PPh. Take Home akhir bulan = gaji saja (THR dibayar full netto terpisah).</div>`:''}
<div class="stit">Take Home Bruto (akhir bulan)</div><div class="gs-row"><span>Gaji + Tunjangan + Lembur</span><span>${fmt(g.brutoTH-g.natNKP)}</span></div>${g.natNKP>0?`<div class="gs-row"><span>Natura Tidak KP</span><span>${fmt(g.natNKP)}</span></div>`:''}
<div class="gs-row" style="font-weight:700"><span>Total Take Home Bruto</span><span>${fmt(g.brutoTH)}</span></div>
<div class="stit">Potongan</div><div class="gs-row"><span>PPh 21${g.thrBruto>0?` (incl. PPh THR ${fmt(g.pphAtasThr)})`:''}${''}</span><span>&#8212; ${fmt(g.pph)}</span></div><div class="gs-row"><span>BPJS Kes Karyawan</span><span>&#8212; ${fmt(g.bpjs.kes_kar)}</span></div><div class="gs-row"><span>BPJS JHT Karyawan</span><span>&#8212; ${fmt(g.bpjs.jht_kar)}</span></div><div class="gs-row"><span>BPJS JP Karyawan</span><span>&#8212; ${fmt(g.bpjs.jp_kar)}</span></div>${(k.potongan||[]).map(p=>`<div class="gs-row"><span>${p.nama}</span><span>&#8212; ${fmt(p.nilai)}</span></div>`).join('')}${prv>0?`<div class="gs-row" style="color:#2d6a0a"><span>&#9312; Pengembalian PPh</span><span>+ ${fmt(prv)}</span></div>`:''}
<div class="gs-total"><span>TAKE HOME PAY (akhir bulan)</span><span>${fmt(g.neto)}</span></div>${g.thrBruto>0?`<div style="background:#f5f0ff;border-radius:7px;padding:8px 10px;margin-top:6px;font-size:11px;color:#5b21b6;font-weight:700">&#127873; THR ${fmt(g.thrBruto)} dibayar full netto terpisah pada ${PA()?.thr_bayar||'H-7 lebaran'}</div>`:''}
<div class="stit">Beban Perusahaan</div><div class="gs-row"><span>BPJS Kes Prs</span><span>${fmt(g.bpjs.kes_prs)}</span></div><div class="gs-row"><span>BPJS JHT+JP Prs</span><span>${fmt(g.bpjs.jht_prs+g.bpjs.jp_prs)}</span></div><div class="gs-row"><span>JKK+JKM Prs</span><span>${fmt(g.bpjs.jkk_prs+g.bpjs.jkm_prs)}</span></div><div class="gs-row" style="font-weight:700"><span>Total Cost of Employment</span><span>${fmt(g.brutoTH+g.bebanPrs)}</span></div></div>`;
}
// ── PENGGAJIAN ───────────────────────────────────
function switchPenggajianTab(el,tid){
  if(el&&el.parentElement){
    el.parentElement.querySelectorAll('.tab').forEach(function(t){t.classList.remove('active');});
    el.classList.add('active');
  }
  var pro=document.getElementById('pg-gaji-proses');
  var tv=document.getElementById('pg-gaji-tunjvar');
  if(pro)pro.style.display=tid==='pg-gaji-proses'?'block':'none';
  if(tv)tv.style.display=tid==='pg-gaji-tunjvar'?'block':'none';
  if(tid==='pg-gaji-tunjvar')renderTunjVariabelBulan();
}
function renderTunjVarColEditor(){
  var wrap=document.getElementById('tunjvar-col-editor');
  if(!wrap)return;
  var cols=getTunjVarColumnsResolved();
  wrap.innerHTML='<div style="display:flex;flex-wrap:wrap;gap:.65rem;align-items:flex-end">'+cols.map(function(c){
    var idEsc=String(c.id).replace(/\\/g,'\\\\').replace(/'/g,"\\'");
    return '<div class="fg" style="margin:0;min-width:160px"><label style="font-size:10px">Nama kolom</label><div style="display:flex;gap:4px;align-items:center">'
      +'<input value="'+escapeHtml(c.nama)+'" placeholder="Nama" style="flex:1;padding:5px 8px;border:1.5px solid #dde1e9;border-radius:6px;font-size:12px;font-family:inherit;outline:none" onchange="setTunjVarColNama(\''+idEsc+'\',this.value)">'
      +(cols.length>1?'<button type="button" class="btn btn-xs btn-r" title="Hapus kolom" onclick="hapusTunjVarColumn(\''+idEsc+'\')">&#10007;</button>':'')
      +'</div></div>';
  }).join('')+'</div>';
}
function setTunjVarColNama(id,nama){
  var cols=tunjVarColumns||[];
  var c=cols.find(function(x){return x.id===id;});
  if(c)c.nama=String(nama||'').trim()||c.nama;
  syncTunjVarLabelsFromColumns();
  saveAll();renderTunjVariabelBulan();renderPenggajian(true);
}
function addTunjVarColumn(){
  if(!tunjVarColumns)tunjVarColumns=[];
  var n=tunjVarColumns.length+1;
  tunjVarColumns.push({id:'tv_'+Date.now()+'_'+Math.random().toString(36).slice(2,5),nama:'Tunjangan '+n});
  syncTunjVarLabelsFromColumns();
  saveAll();renderTunjVariabelBulan();toast('Kolom ditambahkan');
}
function hapusTunjVarColumn(id){
  if(!tunjVarColumns||tunjVarColumns.length<=1){toast('Minimal satu kolom');return;}
  if(!confirm('Hapus kolom ini beserta nilai terkait di semua periode?'))return;
  tunjVarColumns=tunjVarColumns.filter(function(x){return x.id!==id;});
  var pn,s;
  for(pn in tunjVarBulan){
    if(!tunjVarBulan[pn])continue;
    for(s in tunjVarBulan[pn]){
      if(tunjVarBulan[pn][s]&&tunjVarBulan[pn][s][id]!==undefined)delete tunjVarBulan[pn][s][id];
    }
  }
  syncTunjVarLabelsFromColumns();
  saveAll();renderTunjVariabelBulan();renderPenggajian(true);toast('Kolom dihapus');
}
function refreshTunjVarTotals(){
  var pn=PA().nama;
  var cols=getTunjVarColumnsResolved();
  var Lsum={};
  cols.forEach(function(c){Lsum[c.id]=0;});
  if(!tunjVarBulan[pn])return;
  karyawan.forEach(function(k){
    var r=tunjVarBulan[pn][k.nik]||{};
    var sum=0;
    cols.forEach(function(c){
      var v=parseFloat(r[c.id]);if(isNaN(v))v=0;
      Lsum[c.id]+=v;sum+=v;
    });
    var el=document.querySelector('[data-tunjvar-sum="'+k.nik+'"]');
    if(el)el.textContent=fmt(sum);
  });
  var foot=document.getElementById('tunjvar-foot');
  if(foot){
    var parts=cols.map(function(c){return '<strong>'+escapeHtml(c.nama)+'</strong> '+fmt(Lsum[c.id]||0);});
    var grand=cols.reduce(function(s,c){return s+(Lsum[c.id]||0);},0);
    foot.innerHTML='Ringkasan periode ini: '+parts.join(' · ')+' · Total keseluruhan <strong>'+fmt(grand)+'</strong>';
  }
}
function setTunjVarNilai(nik,vKey,val){
  var pn=PA().nama;if(!tunjVarBulan[pn])tunjVarBulan[pn]={};
  if(!tunjVarBulan[pn][nik])tunjVarBulan[pn][nik]={};
  tunjVarBulan[pn][nik][vKey]=Math.max(0,parseFloat(val)||0);
  saveAll();refreshTunjVarTotals();renderPenggajian(true);
}
function salinTunjVarDariPeriodeLalu(){
  var pn=PA().nama;var prev=prevPeriodeChrono(pn);
  if(!prev){toast('Tidak ada periode sebelumnya di data');return;}
  if(!confirm('Salin nilai tunjangan variabel dari "'+prev+'" ke periode aktif "'+pn+'"?'))return;
  if(!tunjVarBulan[pn])tunjVarBulan[pn]={};
  var src=tunjVarBulan[prev]||{};
  karyawan.forEach(function(k){
    if(src[k.nik])tunjVarBulan[pn][k.nik]=JSON.parse(JSON.stringify(src[k.nik]));
  });
  saveAll();renderPenggajian();toast('Disalin dari '+prev);
}
function renderTunjVariabelBulan(){
  var card=document.getElementById('tunjvar-card'),wrap=document.getElementById('tunjvar-tabel-wrap'),foot=document.getElementById('tunjvar-foot');
  if(!card||!wrap)return;
  if(!periodes.length){card.style.display='none';return;}
  card.style.display='';
  var p=PA(),pn=p.nama;
  var cols=getTunjVarColumnsResolved();
  if(!tunjVarColumns||!tunjVarColumns.length){tunjVarColumns=cols.slice();syncTunjVarLabelsFromColumns();saveAll();}
  renderTunjVarColEditor();
  var sub=document.getElementById('tunjvar-per-lbl');if(sub)sub.textContent=pn;
  var listK=karyawan.filter(function(k){return karyawanInPeriode(k,p);});
  if(!listK.length){wrap.innerHTML='<div style="color:#6b7280;font-size:12px">Belum ada karyawan aktif untuk periode ini.</div>';if(foot)foot.textContent='';return;}
  if(!tunjVarBulan[pn])tunjVarBulan[pn]={};
  var thead='<th style="min-width:42px;text-align:center">No</th><th>Karyawan</th>'
    +cols.map(function(c){return '<th style="min-width:110px">'+escapeHtml(c.nama)+'</th>';}).join('')
    +'<th>Jumlah</th>';
  var rows=listK.map(function(k,idx){
    var r=tunjVarBulan[pn][k.nik]||{};
    var sum=0;
    var nikes=k.nik.replace(/'/g,"\\'");
    var tds=cols.map(function(c){
      var v=parseFloat(r[c.id]);if(isNaN(v))v=0;
      sum+=v;
      var idEsc=String(c.id).replace(/\\/g,'\\\\').replace(/'/g,"\\'");
      return '<td><input type="number" min="0" step="1" class="tunjvar-inp" style="max-width:130px" value="'+v+'" onchange="setTunjVarNilai(\''+nikes+'\',\''+idEsc+'\',this.value)"></td>';
    }).join('');
    return '<tr><td style="text-align:center;font-weight:700;color:#6b7280">'+(idx+1)+'</td><td><div class="fl gap2" style="align-items:center"><div class="ka">'+ini(k.nama)+'</div><div><div style="font-weight:600;font-size:12px">'+escapeHtml(k.nama)+'</div><div style="font-size:10px;color:#6b7280">'+escapeHtml(k.nik)+'</div></div></div></td>'
      +tds
      +'<td style="font-size:11px;font-weight:700;color:#1a56a0" data-tunjvar-sum="'+k.nik+'">'+fmt(sum)+'</td></tr>';
  }).join('');
  wrap.innerHTML='<table><thead><tr>'+thead+'</tr></thead><tbody>'+rows+'</tbody></table>';
  refreshTunjVarTotals();
}
function renderPenggajian(skipTunjVar){
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
    thrInfo.innerHTML=p.thr_aktif?
      '<div style="background:#f5f0ff;border:1.5px solid #c4b5fd;border-radius:10px;padding:.85rem 1rem;margin-bottom:.75rem">'+
      '<div style="font-weight:700;color:#5b21b6;margin-bottom:.35rem">&#127873; Periode ini ada THR - '+(p.thr_nama||'Hari Raya')+'</div>'+
      '<div style="font-size:12px;color:#5b21b6">Tgl Bayar THR: <strong>'+(p.thr_bayar||'-')+'</strong> &nbsp;|&nbsp; PPh THR digabung ke PPh 21</div></div>':
      '';
  }
  let prAktif=0;
  const rows=karyawan.filter(function(k){return karyawanInPeriode(k,p);}).map(function(k,idx){
    const g=hitungGaji(k,p.nama);
    const ap=approvals.find(function(a){return a.nik===k.nik&&a.period===p.nama;});
    const st=ap?ap.status:'draft';
    const stBdg={pending:'<span class="bdg b-warn">Pending</span>',approved:'<span class="bdg b-ok">Disetujui</span>',rejected:'<span class="bdg b-err">Ditolak</span>',draft:'<span class="bdg b-gray">Draft</span>'}[st];
    const pr=getPR(k.nik,p.nama);
    if(!pr.manual){pr.hk=hk;const ed=new Date(p.end);pr.hh=hariHadirBulan(k.nik,ed.getFullYear(),ed.getMonth()+1);}
    if(pr.enabled)prAktif++;
    const prBtn='<button class="pr-toggle '+(pr.enabled?'on':'off')+'" onclick="setPREnabled(\''+k.nik+'\',\''+p.nama+'\','+(!pr.enabled)+')">'+( pr.enabled?'&#9203; Aktif':'&#9711; Off')+'</button>';
    const prInputs=pr.enabled?'<div style="margin-top:4px;display:flex;gap:5px;align-items:center"><span style="font-size:10px;color:#6b7280">HK:</span><input class="pr-input" type="number" value="'+pr.hk+'" min="1" max="31" onchange="setPRField(\''+k.nik+'\',\''+p.nama+'\',\'hk\',parseInt(this.value)||1)"><span style="font-size:10px;color:#6b7280">HH:</span><input class="pr-input" type="number" value="'+pr.hh+'" min="0" max="31" onchange="setPRField(\''+k.nik+'\',\''+p.nama+'\',\'hh\',parseInt(this.value)||0)"></div>':'';
    const thrCell=g.thrBruto>0?'<div style="color:#5b21b6;font-weight:700">'+fmt(g.thrBruto)+'</div><div style="font-size:10px;color:#5b21b6">PPh THR: '+fmt(g.pphAtasThr)+'</div>':'&#8212;';
    return '<tr class="'+(pr.enabled?'pr-row-tbl':'')+'">'
      +'<td style="text-align:center;font-weight:700;color:#6b7280">'+(idx+1)+'</td>'
      +'<td><div class="fl gap2" style="align-items:center"><div class="ka">'+ini(k.nama)+'</div>'
      +'<div><div class="knl" onclick="openPanel(\''+k.nik+'\')">'+k.nama+'</div><small style="color:#6b7280">'+k.dept+'</small></div></div></td>'
      +'<td><div>'+prBtn+prInputs+'</div></td>'
      +'<td>'+fmt(g.grossPPh)+'</td><td>'+thrCell+'</td>'
      +'<td>'+fmt(g.brutoTH)+'</td>'
      +'<td>'+fmt(g.bpjs.kes_kar+g.bpjs.jht_kar+g.bpjs.jp_kar)+'</td>'
      +'<td>'+fmt(g.pph)+(g.reconciliation&&g.reconciliation.lebihBayar>0?'<div style="font-size:9px;color:#2d6a0a;font-weight:700">&#10003; Lebih Bayar '+fmt(g.reconciliation.lebihBayar)+'</div>':g.reconciliation&&g.reconciliation.kurangBayar>0?'<div style="font-size:9px;color:#9b2121">&#9650; Kurang Bayar '+fmt(g.reconciliation.kurangBayar)+'</div>':'')+'</td>'
      +'<td>'+(g.pphRet>0?'<span style="color:#2d6a0a;font-weight:700">+'+fmt(g.pphRet)+'</span>':'&#8212;')+'</td>'
      +'<td><strong style="color:#2d6a0a">'+fmt(g.neto)+'</strong></td>'
      +'<td>'+stBdg+'</td>'
      +'<td><button class="btn btn-sm btn-out" onclick="detailGaji(\''+k.nik+'\')">Detail</button></td></tr>';
  });
  document.getElementById('tb-penggajian').innerHTML=rows.join('');
  const ae=document.getElementById('pr-aktif');if(ae)ae.textContent=prAktif+' karyawan';
  if(!skipTunjVar){
    var tv=document.getElementById('pg-gaji-tunjvar');
    if(tv&&tv.style.display!=='none')renderTunjVariabelBulan();
  }
}
function kirimApproval(){
  const p=PA();let added=0;
  karyawan.filter(function(k){return karyawanInPeriode(k,p);}).forEach(function(k){
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
    return '<div style="border:1px solid var(--bd);border-radius:8px;border-left:3px solid #7d4800;padding:.85rem;margin-bottom:.5rem;display:flex;gap:.75rem;align-items:flex-start;flex-wrap:wrap">'
      +'<div style="flex:1"><div style="font-weight:700;font-size:12px">'+a.nama+' - '+a.period+'</div>'
      +'<div style="font-size:11px;color:#6b7280">'+a.time+' | Neto: <strong>'+(g?fmt(g.neto):fmt(a.neto))+'</strong></div></div>'
      +'<div class="fl gap1"><button class="btn btn-sm btn-g" onclick="approveItem('+a.id+')">&#10003; Setujui</button><button class="btn btn-sm btn-r" onclick="rejectItem('+a.id+')">&#10007; Tolak</button></div></div>';
  }).join(''):'<div style="text-align:center;color:#6b7280;padding:1.5rem">Tidak ada yang tertunda</div>';
  document.getElementById('ap-hist-list').innerHTML=hist.map(function(a){
    return '<div style="border:1px solid var(--bd);border-radius:8px;border-left:3px solid '+(a.status==='approved'?'#2d6a0a':'#9b2121')+';padding:.75rem;margin-bottom:.4rem;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:.4rem">'
      +'<div><div style="font-weight:700;font-size:12px">'+a.nama+' - '+a.period+'</div>'
      +'<div style="font-size:11px;color:#6b7280">'+a.time+(a.approvedBy?' | '+a.approvedBy:'')+'</div></div>'
      +'<span class="bdg '+(a.status==='approved'?'b-ok':'b-err')+'">'+(a.status==='approved'?'Disetujui':'Ditolak')+'</span></div>';
  }).join('');
}
function approveItem(id){const a=approvals.find(function(x){return x.id==id;});if(!a)return;a.status='approved';a.approvedBy=CU.nama;saveAll();renderApproval();renderPenggajian();toast('Disetujui');}
function rejectItem(id){const a=approvals.find(function(x){return x.id==id;});if(!a)return;a.status='rejected';a.approvedBy=CU.nama;saveAll();renderApproval();renderPenggajian();toast('Ditolak');}
function hapusApproval(){if(!confirm('Hapus riwayat?'))return;approvals=[];saveAll();renderApproval();toast('Dihapus');}
function detailGaji(nik){
  const k=karyawan.find(function(x){return x.nik===nik;});if(!k)return;
  const p=PA();const g=hitungGaji(k,p.nama);
  const tbl=getTERTable(k.ptkp);
  const rate=(tbl.find(function(r){return g.grossPPh<=r[0];})||[0,.34])[1];
  document.getElementById('m-gaji-t').textContent='Detail Gaji - '+k.nama;
  let h='';
  if(g.thrBruto>0)h+='<div style="background:#f5f0ff;border:1px solid #c4b5fd;border-radius:7px;padding:10px 14px;margin-bottom:.75rem;font-size:12px"><strong>&#127873; THR:</strong> '+fmt(g.thrBruto)+' dibayar full netto. PPh THR: <strong>'+fmt(g.pphAtasThr)+'</strong> dipotong dari gaji ini.</div>';
  h+='<div class="gross-sec"><div class="gross-tit">GROSS INCOME</div>';
  h+='<div class="cr"><span>Gaji Pokok'+(g.isPR?' (Pro-Rata '+g.pr.hh+'/'+g.pr.hk+')':'')+'</span><span>'+fmt(g.gapokEff)+'</span></div>';
  g.tItems.forEach(function(t){h+='<div class="cr"><span>'+t.nama+'</span><span>'+fmt(t.eff)+'</span></div>';});
  if(g.natKP>0)h+='<div class="cr"><span>Natura KP</span><span>'+fmt(g.natKP)+'</span></div>';
  if(g.lb>0)h+='<div class="cr"><span>Lembur</span><span>'+fmt(g.lb)+'</span></div>';
  if(g.bpjsPrsNatKP>0)h+='<div class="cr" style="color:#1a56a0"><span>BPJS Prs JKK+JKM+Kes (Natura KP)</span><span>'+fmt(g.bpjsPrsNatKP)+'</span></div>';
  if(g.thrBruto>0)h+='<div class="cr" style="color:#5b21b6;font-weight:700"><span>THR Bruto</span><span>'+fmt(g.thrBruto)+'</span></div>';
  h+='<div class="cr bold"><span>Total Gross PPh 21</span><span>'+fmt(g.grossPPh)+'</span></div></div>';
  h+='<div class="pph-calc-sec"><div class="pph-calc-tit">PPh 21 - TER PMK 168/2023</div>';
  h+='<div class="cr"><span>Penghasilan Bruto</span><span>'+fmt(g.grossPPh)+'</span></div>';
  h+='<div class="cr"><span>TER '+k.ptkp+': '+(rate*100).toFixed(2)+'%</span><span>= '+fmt(g.pph)+'</span></div>';
  if(g.thrBruto>0)h+='<div class="cr" style="color:#5b21b6"><span>Porsi PPh atas THR</span><span>'+fmt(g.pphAtasThr)+'</span></div>';
  h+='<div class="cr result"><span>PPh 21 bulan ini</span><span>'+fmt(g.pph)+'</span></div></div>';
  h+='<div style="display:flex;gap:.75rem;margin-top:.75rem;flex-wrap:wrap">';
  h+='<div style="flex:1"><div class="stit">Take Home Bruto</div><div class="pr-row-info"><span>Gaji+Tunjangan+Lembur</span><span>'+fmt(g.brutoTH)+'</span></div>'+(g.thrBruto>0?'<div style="font-size:10px;color:#5b21b6">THR TIDAK masuk TH (dibayar terpisah)</div>':'')+'</div>';
  h+='<div style="flex:1"><div class="stit">Potongan</div><div class="pr-row-info"><span>PPh 21</span><span>- '+fmt(g.pph)+'</span></div><div class="pr-row-info"><span>BPJS Kar</span><span>- '+fmt(g.bpjs.kes_kar+g.bpjs.jht_kar+g.bpjs.jp_kar)+'</span></div>';
  (k.potongan||[]).forEach(function(x){h+='<div class="pr-row-info"><span>'+x.nama+'</span><span>- '+fmt(x.nilai)+'</span></div>';});
  if(g.pphRet>0)h+='<div class="pr-row-info" style="color:#2d6a0a"><span>Return PPh</span><span>+ '+fmt(g.pphRet)+'</span></div>';
  h+='</div></div>';
  h+='<div style="background:#1a56a0;color:#fff;border-radius:8px;padding:10px 14px;display:flex;justify-content:space-between;font-weight:800;margin-top:.75rem;font-size:14px"><span>TAKE HOME PAY</span><span>'+fmt(g.neto)+'</span></div>';
  // Tambahkan reconciliation box untuk masa pajak terakhir
  if(g.reconciliation){
    const r=g.reconciliation;
    const isLebih=r.lebihBayar>0;
    h+='<div style="background:'+(isLebih?'#e8f4de':'#fef3e2')+';border:1.5px solid '+(isLebih?'#2d6a0a':'#7d4800')+';border-radius:10px;padding:1rem;margin-top:.75rem">';
    h+='<div style="font-weight:800;color:'+(isLebih?'#2d6a0a':'#7d4800')+';margin-bottom:.5rem">&#9654; Rekonsiliasi PPh 21 '+(r.tipePeriode==='resign'?'(Masa Pajak Terakhir - Resign)':'(Desember - Progresif)')+'</div>';
    h+='<div class="cr"><span>Total Bruto YTD (Jan s.d. bulan lalu)</span><span>'+fmt(r.brutoYTD)+'</span></div>';
    h+='<div class="cr"><span>Bruto bulan ini</span><span>'+fmt(g.grossPPh)+'</span></div>';
    h+='<div class="cr bold"><span>Total Bruto Setahun</span><span>'+fmt(r.brutoTahunan)+'</span></div>';
    h+='<div class="cr" style="margin-top:6px"><span>PPh Tahunan (Progresif Pasal 17)</span><span>'+fmt(r.pphTahunan)+'</span></div>';
    h+='<div class="cr"><span>PPh sudah dipotong (Jan s.d. bulan lalu)</span><span>- '+fmt(r.pphYTD)+'</span></div>';
    h+='<div class="cr bold" style="color:'+(isLebih?'#2d6a0a':'#9b2121')+'"><span>'+(isLebih?'&#10003; Lebih Bayar (dikembalikan)':'&#9888; Kurang Bayar (dipotong)')+' </span><span>'+( isLebih?'+ ':'')+fmt(isLebih?r.lebihBayar:r.kurangBayar)+'</span></div>';
    if(isLebih&&r.opsiLebihBayar==='carryover')h+='<div style="font-size:10px;color:#5b21b6;margin-top:4px">&#8594; Lebih bayar di-carry over ke Januari tahun depan</div>';
    if(isLebih&&r.opsiLebihBayar==='refund')h+='<div style="font-size:10px;color:#2d6a0a;margin-top:4px">&#8594; Lebih bayar dikembalikan langsung bulan ini (PPh = Rp 0)</div>';
    h+='</div>';
  }
  document.getElementById('m-gaji-c').innerHTML=h;
  openModal('m-gaji');
}
// ── SLIP GAJI ─────────────────────────────────────
function makeSlip(k,pNama){
  const g=hitungGaji(k,pNama);
  const p=periodes.find(function(x){return x.nama===pNama;})||PA();
  const tbl=getTERTable(k.ptkp);
  const rate=(tbl.find(function(r){return g.grossPPh<=r[0];})||[0,.34])[1];
  const logo=perusahaan.logo||'';
  let h='<div class="slip">';
  h+='<div class="slip-head">';
  h+='<div>'+(logo?'<img src="'+logo+'" class="slip-logo"><br>':'')+'<strong style="font-size:14px;color:#1a56a0">&#9670; '+(perusahaan.nama||'Perusahaan')+'</strong><div style="font-size:10px;color:#6b7280">'+(perusahaan.alamat||'')+'</div></div>';
  h+='<div style="text-align:right"><strong style="font-size:13px">SLIP GAJI</strong><div style="font-size:10px;color:#6b7280">Periode: '+pNama+'</div><div style="font-size:10px;color:#6b7280">Bayar: '+fmtDate(p.bayar||'-')+'</div>'+(g.isPR?'<div style="font-size:10px;background:#fef3e2;color:#7d4800;padding:2px 7px;border-radius:5px;margin-top:3px">Pro-Rata '+g.pr.hh+'/'+g.pr.hk+'</div>':'')+'</div>';
  h+='</div>';
  h+='<div class="semp"><div><span style="color:#6b7280;font-size:9px">NIK</span><br><strong>'+k.nik+'</strong></div><div><span style="color:#6b7280;font-size:9px">Nama</span><br><strong>'+k.nama+'</strong></div><div><span style="color:#6b7280;font-size:9px">Jabatan</span><br>'+k.jabatan+'</div><div><span style="color:#6b7280;font-size:9px">Dept</span><br>'+k.dept+'</div><div><span style="color:#6b7280;font-size:9px">PTKP</span><br>'+k.ptkp+'</div><div><span style="color:#6b7280;font-size:9px">Rekening</span><br>'+(k.bank||'')+' '+(k.norek||'-')+'</div></div>';
  if(g.thrBruto>0){
    h+='<div style="background:#f5f0ff;border:1.5px solid #c4b5fd;border-radius:8px;padding:10px 14px;margin-bottom:.75rem">';
    h+='<div style="font-weight:700;color:#5b21b6;font-size:12px;margin-bottom:4px">&#127873; THR '+(p.thr_nama||'Hari Raya')+' - Dibayar Terpisah</div>';
    h+='<div style="display:flex;justify-content:space-between;font-size:11px"><span>THR Bruto (full netto tgl '+fmtDate(p.thr_bayar||'-')+')</span><span><strong>'+fmt(g.thrBruto)+'</strong></span></div></div>';
  }
  // Note hanya muncul jika PPh betul-betul dihitung sebagai Masa Pajak Terakhir (pegawai berhenti di periode ini / periode resign)
  if(g.reconciliation&&g.reconciliation.isPajakTerakhir&&(g.reconciliation.tipePeriode==='resign'||g.reconciliation.reason==='stop_in_period')){
    const tStop=g.reconciliation.tglBerhenti?fmtDate(g.reconciliation.tglBerhenti):'';
    h+='<div style="background:#eef2ff;border:1.5px solid #c7d2fe;border-radius:8px;padding:8px 12px;margin-bottom:.75rem;font-size:10px;color:#3730a3">';
    h+='<strong>Catatan Masa Pajak Terakhir:</strong> PPh 21 bulan ini dihitung dengan rekonsiliasi tahunan (seperti Desember) karena pegawai berhenti'+(tStop?' per '+tStop:'')+'.';
    h+='</div>';
  }
  h+='<div class="gross-sec"><div class="gross-tit">PENGHASILAN BRUTO (Dasar PPh 21)</div>';
  h+='<div class="cr"><span>Gaji Pokok'+(g.isPR?' (Pro-Rata)':'')+'</span><span>'+fmt(g.gapokEff)+'</span></div>';
  g.tItems.forEach(function(t){h+='<div class="cr"><span>'+t.nama+(t.isHarian?' [Lump Sum]':'')+'</span><span>'+fmt(t.eff)+'</span></div>';});
  if(g.natKP>0)h+='<div class="cr"><span>Natura Kena Pajak</span><span>'+fmt(g.natKP)+'</span></div>';
  if(g.lb>0)h+='<div class="cr"><span>Uang Lembur</span><span>'+fmt(g.lb)+'</span></div>';
  if(g.bpjsPrsNatKP>0)h+='<div class="cr" style="color:#1a56a0"><span>BPJS Prs - JKK+JKM+Kes (Natura KP)</span><span>'+fmt(g.bpjsPrsNatKP)+'</span></div>';
  if(g.thrBruto>0)h+='<div class="cr" style="color:#5b21b6;font-weight:700"><span>THR Bruto (digabung ke Gross PPh)</span><span>'+fmt(g.thrBruto)+'</span></div>';
  h+='<div class="cr bold"><span>TOTAL GROSS INCOME</span><span>'+fmt(g.grossPPh)+'</span></div></div>';
  h+='<div class="pph-calc-sec"><div class="pph-calc-tit">PPh 21 - PMK 168/2023 Metode TER</div>';
  h+='<div class="cr"><span>Penghasilan Bruto bulan ini</span><span>'+fmt(g.grossPPh)+'</span></div>';
  h+='<div class="cr"><span>TER '+k.ptkp+': '+(rate*100).toFixed(2)+'% x '+fmt(g.grossPPh)+'</span><span>'+fmt(g.pph)+'</span></div>';
  h+='<div class="cr result"><span>PPh 21 Bulan Ini</span><span>'+fmt(g.pph)+'</span></div></div>';
  h+='<div class="ssec">Potongan dari Take Home</div>';
  h+='<div class="sr"><span>PPh 21</span><span>- '+fmt(g.pph)+'</span></div>';
  h+='<div class="sr"><span>BPJS Kesehatan Karyawan (1%)</span><span>- '+fmt(g.bpjs.kes_kar)+'</span></div>';
  h+='<div class="sr"><span>BPJS JHT Karyawan (2%)</span><span>- '+fmt(g.bpjs.jht_kar)+'</span></div>';
  h+='<div class="sr"><span>BPJS JP Karyawan (1%)</span><span>- '+fmt(g.bpjs.jp_kar)+'</span></div>';
  (k.potongan||[]).forEach(function(pt){h+='<div class="sr indent"><span>'+pt.nama+'</span><span>- '+fmt(pt.nilai)+'</span></div>';});
  if(g.potKehadiran&&g.potKehadiran.details){g.potKehadiran.details.forEach(function(d){h+='<div class="sr indent" style="color:#b45309"><span>'+d.label+'</span><span>- '+fmt(d.nilai)+'</span></div>';});}
  h+='<div class="sr bold"><span>Total Potongan</span><span>- '+fmt(g.totalPot)+'</span></div>';
  if(g.natNKP>0){h+='<div class="ssec">Natura Tidak KP</div>';(k.natura||[]).filter(function(n){return !n.kp;}).forEach(function(n){h+='<div class="sr"><span>'+n.nama+'</span><span>+ '+fmt(n.nilai)+'</span></div>';});}
  if(g.pphRet>0)h+='<div class="ssec" style="color:#2d6a0a">Pengembalian PPh</div><div class="sr pph-return"><span>&#9312; '+((k.pph_return&&k.pph_return.ket)||'PPh Return')+'</span><span>+ '+fmt(g.pphRet)+'</span></div>';
  h+='<div class="ssec">Kontribusi Perusahaan</div>';
  h+='<div class="sr"><span>BPJS Kes Prs (4%)</span><span>'+fmt(g.bpjs.kes_prs)+'</span></div>';
  h+='<div class="sr"><span>BPJS JHT+JP Prs</span><span>'+fmt(g.bpjs.jht_prs+g.bpjs.jp_prs)+'</span></div>';
  h+='<div class="sr"><span>JKK+JKM Prs</span><span>'+fmt(g.bpjs.jkk_prs+g.bpjs.jkm_prs)+'</span></div>';
  if(g.phk&&g.phk.mode==='phk'){
    h+='<div class="ssec" style="margin-top:10px">Pembayaran PHK (PPh 21 Final)</div>';
    (g.phk.items||[]).forEach(function(it){h+='<div class="sr"><span>'+it.nama+'</span><span>+ '+fmt(it.nilai)+'</span></div>';});
    h+='<div class="sr bold"><span>Total PHK</span><span>+ '+fmt(g.phk.bruto)+'</span></div>';
    h+='<div class="sr" style="color:#9b2121"><span>PPh 21 Final Pesangon</span><span>- '+fmt(g.phk.pphFinal)+'</span></div>';
    h+='<div class="sr bold" style="color:#1a56a0"><span>PHK Diterima (Netto)</span><span>+ '+fmt(g.phk.bruto-g.phk.pphFinal)+'</span></div>';
  }
  h+='<div class="stotal"><span>TAKE HOME PAY</span><span>'+fmt(g.neto)+'</span></div>';
  h+='<div style="margin-top:8px;font-size:10px;line-height:1.55;color:#374151;border:1px solid #e5e7eb;border-radius:6px;padding:8px 10px"><strong>Terbilang</strong> <span style="color:#6b7280;font-style:italic">'+terbilangRupiah(g.neto)+'</span></div>';
  if(g.thrBruto>0)h+='<div style="background:#f5f0ff;border:1px solid #c4b5fd;border-radius:7px;padding:8px 12px;margin-top:6px;font-size:10px;color:#5b21b6;text-align:center;font-weight:700">&#127873; THR '+fmt(g.thrBruto)+' sudah dibayar terpisah pada '+fmtDate(p.thr_bayar||'-')+' (full netto)</div>';
  if(g.reconciliation){
    const r=g.reconciliation;const isLebih=r.lebihBayar>0;
    h+='<div style="background:'+(isLebih?'#e8f4de':'#fef3e2')+';border:1px solid '+(isLebih?'#b3d98f':'#f6c76b')+';border-radius:7px;padding:8px 12px;font-size:10px;margin-top:6px">';
    h+='<strong>Rekonsiliasi PPh 21 '+(r.tipePeriode==='resign'?'(Resign)':'(Desember)')+':</strong> ';
    h+='PPh Tahunan Progresif: '+fmt(r.pphTahunan)+' | Sudah dipotong: '+fmt(r.pphYTD)+' | ';
    h+=isLebih?'<strong style="color:#2d6a0a">Lebih Bayar: +'+fmt(r.lebihBayar)+'</strong>':'<strong style="color:#9b2121">Kurang Bayar: '+fmt(r.kurangBayar)+'</strong>';
    h+='</div>';
  }
  h+='<div style="margin-top:.6rem;font-size:10px;color:#6b7280;text-align:center">Slip gaji elektronik - sah tanpa tanda tangan basah</div></div>';
  return h;
}
// ── SLIP THR ─────────────────────────────────────
function makeSlipTHR(k,p){
  const thr=hitungTHRBruto(k);
  if(!thr.eligible)return '<div style="text-align:center;color:#9b2121;padding:2rem;background:#fdeaea;border-radius:8px">'+k.nama+' belum eligible THR (masa kerja '+thr.mb+' bulan)</div>';
  const g=hitungGaji(k,p.nama);
  const logo=perusahaan.logo||'';
  const namaHR=p.thr_nama||'Hari Raya';
  const mb=Math.floor(thr.mb/12)+'thn '+thr.mb%12+'bln';
  let h='<div class="slip">';
  h+='<div class="slip-head"><div>'+(logo?'<img src="'+logo+'" class="slip-logo"><br>':'')+'<strong style="font-size:14px;color:#5b21b6">&#9670; '+(perusahaan.nama||'Perusahaan')+'</strong></div>';
  h+='<div style="text-align:right"><strong style="font-size:13px;color:#5b21b6">SLIP THR</strong><div style="font-size:10px;color:#6b7280">'+namaHR+'</div><div style="font-size:10px;color:#6b7280">Tgl Bayar: '+(p.thr_bayar||'-')+'</div></div></div>';
  h+='<div class="semp"><div><span style="color:#6b7280;font-size:9px">NIK</span><br><strong>'+k.nik+'</strong></div><div><span style="color:#6b7280;font-size:9px">Nama</span><br><strong>'+k.nama+'</strong></div><div><span style="color:#6b7280;font-size:9px">Jabatan</span><br>'+k.jabatan+'</div><div><span style="color:#6b7280;font-size:9px">Dept</span><br>'+k.dept+'</div><div><span style="color:#6b7280;font-size:9px">Masa Kerja</span><br>'+mb+'</div><div><span style="color:#6b7280;font-size:9px">Rekening</span><br>'+(k.bank||'')+' '+(k.norek||'-')+'</div></div>';
  h+='<div style="background:#f5f0ff;border:1.5px solid #c4b5fd;border-radius:8px;padding:1rem;margin-bottom:.75rem">';
  h+='<div style="font-size:10px;font-weight:800;color:#4c1d95;text-transform:uppercase;margin-bottom:.6rem">&#127873; Perhitungan THR - '+namaHR+'</div>';
  h+='<div class="cr"><span>Gaji Pokok</span><span>'+fmt(k.gapok)+'</span></div>';
  (k.tunjangan||[]).filter(function(t){return t.tipe==='tetap'||t.tipe==='tetap_no_bpjs';}).forEach(function(t){h+='<div class="cr"><span>'+t.nama+' (Tunjangan Tetap)</span><span>'+fmt(t.nilai)+'</span></div>';});
  h+='<div class="cr bold" style="color:#4c1d95;border-top:1px solid #c4b5fd;margin-top:4px;padding-top:4px"><span>Dasar THR</span><span>'+fmt(thr.dasar)+'</span></div>';
  h+='<div class="cr"><span>Proporsi</span><span>'+thr.pl+'</span></div>';
  h+='<div class="cr bold" style="color:#5b21b6;font-size:13px;border-top:1.5px solid #5b21b6;margin-top:6px;padding-top:6px"><span>THR Bruto</span><span>'+fmt(thr.nilai)+'</span></div></div>';
  h+='<div style="background:#e8f4de;color:#1e4a07;border-left:3px solid #2d6a0a;border-radius:6px;padding:.65rem .9rem;font-size:11px;margin-bottom:.75rem">';
  h+='<strong>Catatan PPh 21:</strong> THR dibayarkan <strong>FULL NETTO</strong>. PPh atas THR sebesar <strong>'+fmt(g.pphAtasThr)+'</strong> akan dipotong dari gaji akhir bulan '+p.nama+'.';
  h+='</div>';
  h+='<div class="sr"><span>THR Bruto</span><span>'+fmt(thr.nilai)+'</span></div>';
  h+='<div class="sr" style="color:#2d6a0a"><span>Potongan PPh saat bayar THR</span><span>Rp 0</span></div>';
  h+='<div class="stotal" style="background:linear-gradient(90deg,#5b21b6,#7c3aed)"><span>TOTAL THR DITERIMA (FULL NETTO)</span><span>'+fmt(thr.nilai)+'</span></div>';
  h+='<div style="margin-top:.6rem;font-size:10px;color:#6b7280;text-align:center">Slip THR elektronik - sah tanpa tanda tangan basah</div></div>';
  return h;
}
// ── SLIP CONTROLS ─────────────────────────────────
function onSlipPeriodeChange(){
  const pid=document.getElementById('slip-per')&&document.getElementById('slip-per').value;
  const p=periodes.find(function(x){return x.id==pid;})||PA();
  const typeEl=document.getElementById('slip-type');
  const btnAll=document.getElementById('btn-pdf-all-thr');
  const banner=document.getElementById('slip-thr-banner');
  if(p.thr_aktif){
    if(typeEl)typeEl.style.display='inline-block';
    if(btnAll)btnAll.style.display='inline-block';
    if(banner)banner.innerHTML='<div style="background:#f5f0ff;border:1.5px solid #c4b5fd;border-radius:10px;padding:10px 14px;margin-bottom:.75rem;font-size:12px;color:#5b21b6"><strong>&#127873; Periode ini ada THR ('+(p.thr_nama||'')+') - Tgl Bayar THR: '+(p.thr_bayar||'-')+'</strong><br>Pilih jenis slip di atas.</div>';
  } else {
    if(typeEl){typeEl.value='gaji';typeEl.style.display='none';}
    if(btnAll)btnAll.style.display='none';
    if(banner)banner.innerHTML='';
  }
  populateSelects();
  previewSlip();
}
function previewSlip(){
  const nik=document.getElementById('slip-kar')&&document.getElementById('slip-kar').value;
  if(!nik)return;
  const pid=document.getElementById('slip-per')&&document.getElementById('slip-per').value;
  const p=periodes.find(function(x){return x.id==pid;})||PA();
  const k=karyawan.find(function(x){return x.nik===nik;});
  if(!k)return;
  const type=(document.getElementById('slip-type')&&document.getElementById('slip-type').value)||'gaji';
  document.getElementById('slip-preview').innerHTML=(type==='thr'&&p.thr_aktif)?makeSlipTHR(k,p):makeSlip(k,p.nama);
  var sb=document.getElementById('slip-share-bar');if(sb)sb.style.display='block';
}

// ── SHARE / KIRIM SLIP ────────────────────────────
function getSlipContext(){
  var nik=document.getElementById('slip-kar')&&document.getElementById('slip-kar').value;
  if(!nik)return null;
  var pid=document.getElementById('slip-per')&&document.getElementById('slip-per').value;
  var p=periodes.find(function(x){return x.id==pid;})||PA();
  var k=karyawan.find(function(x){return x.nik===nik;});
  if(!k)return null;
  var type=(document.getElementById('slip-type')&&document.getElementById('slip-type').value)||'gaji';
  var isThr=type==='thr'&&p.thr_aktif;
  return{k:k,p:p,isThr:isThr};
}
function sanitizePdfFileName(s){return String(s||'x').replace(/[^\w\u00C0-\u024f\d\-]+/g,'_').replace(/_+/g,'_').substring(0,80);}
function formatHPWhatsApp(hp){
  var d=String(hp||'').replace(/[^0-9]/g,'');
  if(d.startsWith('62'))return d;
  if(d.startsWith('0'))return '62'+d.slice(1);
  if(d.length>=9)return '62'+d;
  return '';
}
/** Membangun dokumen PDF slip gaji — struktur & angka sama dengan makeSlip() / pratinjau di layar */
function buildGajiSlipPDF(k,pNama,tglBayar){
  var g=hitungGaji(k,pNama);
  var p=periodes.find(function(x){return x.nama===pNama;})||PA();
  var tbl=getTERTable(k.ptkp);
  var rate=(tbl.find(function(r){return g.grossPPh<=r[0];})||[0,.34])[1];
  var doc=new window.jspdf.jsPDF({format:'a4',unit:'mm'});
  var pw=doc.internal.pageSize.getWidth();
  var ph=doc.internal.pageSize.getHeight();
  var y=18;
  function chk(){if(y>ph-14){doc.addPage();y=18;}}
  function sec(t){
    chk();doc.setTextColor(26,86,160);doc.setFont(undefined,'bold');doc.setFontSize(9);
    doc.text(t,14,y);y+=4;doc.setDrawColor(26,86,160);doc.setLineWidth(0.3);doc.line(14,y,pw-14,y);y+=5;
    doc.setTextColor(0,0,0);doc.setFont(undefined,'normal');doc.setFontSize(8.5);
  }
  function rowL(l,r,b){
    chk();doc.setFont(undefined,b?'bold':'normal');doc.setFontSize(8.5);doc.setTextColor(0,0,0);
    doc.text(l,14,y);doc.text(r,pw-14,y,{align:'right'});y+=5;doc.setFont(undefined,'normal');
  }
  function rowM(l,v){rowL(l,'- '+fmt(v));}
  function rowP(l,v){rowL(l,'+ '+fmt(v));}

  doc.setFillColor(26,86,160);doc.rect(0,0,pw,32,'F');doc.setTextColor(255,255,255);
  doc.setFontSize(12);doc.setFont(undefined,'bold');doc.text('SLIP GAJI',14,11);
  doc.setFontSize(10);doc.text(String(perusahaan.nama||'Perusahaan'),14,18);
  doc.setFontSize(8);doc.setFont(undefined,'normal');
  doc.text('Periode: '+pNama,pw-14,11,{align:'right'});
  doc.text('Bayar: '+fmtDate(tglBayar||p.bayar||'-'),pw-14,17,{align:'right'});
  if(g.isPR)doc.text('Pro-Rata '+g.pr.hh+'/'+g.pr.hk,pw-14,23,{align:'right'});
  if(perusahaan.alamat){
    doc.setFontSize(7.5);doc.setTextColor(230,240,255);
    var al=doc.splitTextToSize(String(perusahaan.alamat),pw-85);var ay=22;
    al.slice(0,2).forEach(function(ln){doc.text(ln,14,ay);ay+=3;});
  }
  doc.setTextColor(0,0,0);
  y=36;

  chk();
  doc.setFillColor(248,249,252);doc.rect(10,y,pw-20,20,'F');
  var cardTop=y;
  doc.setFontSize(8.5);doc.setFont(undefined,'bold');
  doc.text('NIK: '+k.nik,14,cardTop+6);doc.text('PTKP: '+k.ptkp,pw/2+2,cardTop+6);
  doc.text('Nama: '+k.nama,14,cardTop+12);doc.text('Dept: '+k.dept,pw/2+2,cardTop+12);
  doc.text('Jabatan: '+(k.jabatan||'-'),14,cardTop+18);doc.text('Rekening: '+(k.bank||'')+' '+(k.norek||'-'),pw/2+2,cardTop+18);
  y=cardTop+24;

  if(g.thrBruto>0){
    chk();doc.setFillColor(245,240,255);doc.rect(10,y,pw-20,16,'F');
    doc.setFont(undefined,'bold');doc.setFontSize(9);doc.setTextColor(91,33,182);
    doc.text('THR '+(p.thr_nama||'Hari Raya')+' - Dibayar Terpisah',14,y+6);
    doc.setFontSize(8.5);doc.setFont(undefined,'normal');
    doc.text('THR Bruto (full netto tgl '+fmtDate(p.thr_bayar||'-')+')',14,y+11);
    doc.text(fmt(g.thrBruto),pw-14,y+11,{align:'right'});
    doc.setTextColor(0,0,0);y+=20;
  }
  if(g.reconciliation&&g.reconciliation.isPajakTerakhir&&(g.reconciliation.tipePeriode==='resign'||g.reconciliation.reason==='stop_in_period')){
    chk();
    doc.setFillColor(238,242,255);doc.rect(10,y,pw-20,14,'F');
    doc.setFontSize(8);doc.setFont(undefined,'bold');doc.setTextColor(55,48,163);
    doc.text('Catatan Masa Pajak Terakhir',14,y+5);
    doc.setFont(undefined,'normal');doc.setFontSize(7.5);doc.setTextColor(55,65,81);
    var tStop=g.reconciliation.tglBerhenti?fmtDate(g.reconciliation.tglBerhenti):'';
    var note='PPh 21 bulan ini dihitung dengan rekonsiliasi tahunan (seperti Desember) karena pegawai berhenti'+(tStop?' per '+tStop:'')+'.';
    doc.splitTextToSize(note,pw-28).slice(0,2).forEach(function(ln,i){doc.text(ln,14,y+9+i*3.2);});
    doc.setTextColor(0,0,0);y+=18;
  }

  sec('PENGHASILAN BRUTO (Dasar PPh 21)');
  rowL('Gaji Pokok'+(g.isPR?' (Pro-Rata)':''),fmt(g.gapokEff));
  g.tItems.forEach(function(t){rowL(t.nama+(t.isHarian?' [Lump Sum]':''),fmt(t.eff));});
  if(g.natKP>0)rowL('Natura Kena Pajak',fmt(g.natKP));
  if(g.lb>0)rowL('Uang Lembur',fmt(g.lb));
  if(g.bpjsPrsNatKP>0){doc.setTextColor(26,86,160);rowL('BPJS Prs - JKK+JKM+Kes (Natura KP)',fmt(g.bpjsPrsNatKP));doc.setTextColor(0,0,0);}
  if(g.thrBruto>0){doc.setTextColor(91,33,182);doc.setFont(undefined,'bold');rowL('THR Bruto (digabung ke Gross PPh)',fmt(g.thrBruto));doc.setTextColor(0,0,0);doc.setFont(undefined,'normal');}
  rowL('TOTAL GROSS INCOME',fmt(g.grossPPh),true);y+=2;

  sec('PPh 21 - PMK 168/2023 Metode TER');
  rowL('Penghasilan Bruto bulan ini',fmt(g.grossPPh));
  chk();
  var terKiri='TER '+k.ptkp+': '+(rate*100).toFixed(2)+'% x '+fmt(g.grossPPh);
  doc.text(terKiri,14,y);doc.text(fmt(g.pph),pw-14,y,{align:'right'});y+=5;
  doc.setFont(undefined,'bold');rowL('PPh 21 Bulan Ini',fmt(g.pph));doc.setFont(undefined,'normal');y+=2;

  sec('Potongan dari Take Home');
  rowM('PPh 21',g.pph);
  rowM('BPJS Kesehatan Karyawan (1%)',g.bpjs.kes_kar);
  rowM('BPJS JHT Karyawan (2%)',g.bpjs.jht_kar);
  rowM('BPJS JP Karyawan (1%)',g.bpjs.jp_kar);
  (k.potongan||[]).forEach(function(pt){rowM(pt.nama,pt.nilai);});
  if(g.potKehadiran&&g.potKehadiran.details)g.potKehadiran.details.forEach(function(d){rowM(d.label,d.nilai);});
  doc.setFont(undefined,'bold');rowM('Total Potongan',g.totalPot);doc.setFont(undefined,'normal');y+=2;

  if(g.natNKP>0){
    sec('Natura Tidak KP');
    (k.natura||[]).filter(function(n){return !n.kp;}).forEach(function(n){rowP(n.nama,n.nilai);});
    y+=2;
  }
  if(g.pphRet>0){
    sec('Pengembalian PPh');
    rowP('(1) '+((k.pph_return&&k.pph_return.ket)||'PPh Return'),g.pphRet);
    y+=2;
  }

  sec('Kontribusi Perusahaan');
  rowL('BPJS Kes Prs (4%)',fmt(g.bpjs.kes_prs));
  rowL('BPJS JHT+JP Prs',fmt(g.bpjs.jht_prs+g.bpjs.jp_prs));
  rowL('JKK+JKM Prs',fmt(g.bpjs.jkk_prs+g.bpjs.jkm_prs));
  if(g.phk&&g.phk.mode==='phk'){
    y+=2;
    sec('Pembayaran PHK (PPh 21 Final)');
    (g.phk.items||[]).forEach(function(it){rowL(it.nama,fmt(it.nilai));});
    rowL('Total PHK',fmt(g.phk.bruto),true);
    rowM('PPh 21 Final Pesangon',g.phk.pphFinal);
    rowL('PHK Diterima (Netto)',fmt(g.phk.bruto-g.phk.pphFinal),true);
  }
  y+=4;

  chk();
  doc.setFillColor(26,86,160);doc.rect(10,y-2,pw-20,12,'F');doc.setTextColor(255,255,255);
  doc.setFontSize(11);doc.setFont(undefined,'bold');
  doc.text('TAKE HOME PAY',14,y+5);doc.text(fmt(g.neto),pw-14,y+5,{align:'right'});
  doc.setTextColor(0,0,0);doc.setFont(undefined,'normal');doc.setFontSize(8.5);y+=14;

  chk();doc.setFontSize(8);doc.setFont(undefined,'bold');doc.setTextColor(55,65,81);
  doc.text('Terbilang',14,y);y+=4;
  doc.setFont(undefined,'normal');doc.setFontSize(7.5);doc.setTextColor(107,114,128);
  doc.splitTextToSize(terbilangRupiah(g.neto),pw-28).forEach(function(ln){chk();doc.text(ln,14,y);y+=3.6;});
  doc.setTextColor(0,0,0);doc.setFontSize(8.5);y+=2;

  if(g.thrBruto>0){
    chk();doc.setFillColor(245,240,255);doc.rect(10,y,pw-20,10,'F');
    doc.setFontSize(8);doc.setFont(undefined,'bold');doc.setTextColor(91,33,182);
    var tn=doc.splitTextToSize('THR '+fmt(g.thrBruto)+' sudah dibayar terpisah pada '+fmtDate(p.thr_bayar||'-')+' (full netto)',pw-24);
    var ty=y+4;tn.forEach(function(ln){doc.text(ln,14,ty);ty+=3.5;});
    doc.setTextColor(0,0,0);doc.setFont(undefined,'normal');y+=12;
  }
  if(g.reconciliation){
    var r=g.reconciliation;var isLb=r.lebihBayar>0;
    chk();
    var rx='Rekonsiliasi PPh 21 '+(r.tipePeriode==='resign'?'(Resign)':'(Desember)')+': PPh Tahunan Progresif: '+fmt(r.pphTahunan)+' | Sudah dipotong: '+fmt(r.pphYTD)+' | '+(isLb?'Lebih Bayar: +'+fmt(r.lebihBayar):'Kurang Bayar: '+fmt(r.kurangBayar));
    doc.setFontSize(8);doc.setTextColor(60,60,60);
    var rlines=doc.splitTextToSize(rx,pw-24);
    var boxH=6+rlines.length*3.6;
    doc.setFillColor(isLb?232:254,isLb?244:243,isLb?222:226);
    doc.rect(10,y,pw-20,boxH,'F');
    doc.setDrawColor(isLb?179:246,isLb?217:199,isLb?143:107);
    doc.rect(10,y,pw-20,boxH,'S');
    var ty=y+4;
    rlines.forEach(function(ln){doc.text(ln,12,ty);ty+=3.6;});
    y+=boxH+4;
    doc.setFontSize(8.5);doc.setTextColor(0,0,0);
  }

  chk();doc.setFontSize(8);doc.setTextColor(107,114,128);
  doc.text('Slip gaji elektronik - sah tanpa tanda tangan basah',pw/2,ph-10,{align:'center'});
  var fileName='Slip_'+sanitizePdfFileName(k.nama)+'_'+sanitizePdfFileName(pNama)+'.pdf';
  return{doc:doc,fileName:fileName};
}
function buildTHRSlipPDF(k,p){
  var thr=hitungTHRBruto(k);if(!thr.eligible)throw new Error('Belum eligible THR');
  var g=hitungGaji(k,p.nama);
  var namaHR=p.thr_nama||'Hari Raya';
  var mbStr=Math.floor(thr.mb/12)+'thn '+thr.mb%12+'bln';
  var doc=new window.jspdf.jsPDF({format:'a4',unit:'mm'});var pw=doc.internal.pageSize.getWidth();var ph=doc.internal.pageSize.getHeight();
  doc.setFillColor(91,33,182);doc.rect(0,0,pw,32,'F');doc.setTextColor(255,255,255);
  doc.setFontSize(12);doc.setFont(undefined,'bold');doc.text('SLIP THR',14,11);
  doc.setFontSize(10);doc.text(String(perusahaan.nama||'Perusahaan'),14,18);
  doc.setFontSize(8);doc.setFont(undefined,'normal');
  doc.text(namaHR,pw-14,11,{align:'right'});doc.text('Tgl Bayar: '+(p.thr_bayar||'-'),pw-14,17,{align:'right'});
  doc.setTextColor(0,0,0);
  doc.setFillColor(245,240,255);doc.rect(10,34,pw-20,22,'F');
  doc.setFontSize(8.5);doc.setFont(undefined,'bold');
  doc.text('NIK: '+k.nik,14,41);doc.text('Jabatan: '+(k.jabatan||'-'),pw/2+2,41);
  doc.text('Nama: '+k.nama,14,47);doc.text('Dept: '+k.dept,pw/2+2,47);
  doc.text('Masa Kerja: '+mbStr,14,53);doc.text('Rekening: '+(k.bank||'')+' '+(k.norek||'-'),pw/2+2,53);
  var y=60;
  var sec=function(t){doc.setFont(undefined,'bold');doc.setFontSize(9);doc.setTextColor(76,29,149);doc.text(t,14,y);y+=4;doc.setDrawColor(91,33,182);doc.line(14,y,pw-14,y);y+=5;doc.setFont(undefined,'normal');doc.setFontSize(8.5);doc.setTextColor(0,0,0);};
  var row=function(l,v,b){doc.setFont(undefined,b?'bold':'normal');doc.text(l,14,y);doc.text(v,pw-14,y,{align:'right'});y+=5;doc.setFont(undefined,'normal');};
  sec('Perhitungan THR - '+namaHR);
  row('Gaji Pokok',fmt(k.gapok));
  (k.tunjangan||[]).filter(function(t){return t.tipe==='tetap'||t.tipe==='tetap_no_bpjs';}).forEach(function(t){row(t.nama+' (Tunjangan Tetap)',fmt(t.nilai));});
  doc.setFont(undefined,'bold');row('Dasar THR',fmt(thr.dasar));doc.setFont(undefined,'normal');
  row('Proporsi',thr.pl);
  doc.setFont(undefined,'bold');doc.setTextColor(91,33,182);doc.setFontSize(10);row('THR Bruto',fmt(thr.nilai));doc.setFontSize(8.5);doc.setTextColor(0,0,0);doc.setFont(undefined,'normal');
  y+=4;
  var cat=doc.splitTextToSize('Catatan PPh 21: THR dibayarkan FULL NETTO. PPh atas THR sebesar '+fmt(g.pphAtasThr)+' akan dipotong dari gaji akhir bulan '+p.nama+'.',pw-24);
  var catH=6+cat.length*3.5;
  doc.setFillColor(232,244,222);doc.setDrawColor(45,106,10);
  doc.rect(10,y,pw-20,catH,'FD');
  doc.setFontSize(8);doc.setTextColor(30,74,7);
  var cy=y+4;cat.forEach(function(ln){doc.text(ln,14,cy);cy+=3.5;});
  doc.setTextColor(0,0,0);y+=catH+4;
  row('THR Bruto',fmt(thr.nilai));
  doc.setTextColor(45,106,10);row('Potongan PPh saat bayar THR','Rp 0');doc.setTextColor(0,0,0);
  y+=4;
  doc.setFillColor(91,33,182);doc.rect(10,y-2,pw-20,12,'F');doc.setTextColor(255,255,255);
  doc.setFontSize(11);doc.setFont(undefined,'bold');
  doc.text('TOTAL THR DITERIMA (FULL NETTO)',14,y+5);doc.text(fmt(thr.nilai),pw-14,y+5,{align:'right'});
  doc.setTextColor(107,114,128);doc.setFontSize(8);doc.setFont(undefined,'normal');
  doc.text('Slip THR elektronik - sah tanpa tanda tangan basah',pw/2,ph-10,{align:'center'});
  return{doc:doc,fileName:'SlipTHR_'+sanitizePdfFileName(k.nama)+'.pdf'};
}
function shareSlipNativePDF(){
  var ctx=getSlipContext();if(!ctx){toast('Pilih karyawan dulu');return;}
  var k=ctx.k,p=ctx.p,isThr=ctx.isThr;
  try{
    var o=isThr?buildTHRSlipPDF(k,p):buildGajiSlipPDF(k,p.nama,p.bayar);
    var blob=o.doc.output('blob');
    var file=new File([blob],o.fileName,{type:'application/pdf'});
    if(navigator.canShare&&navigator.canShare({files:[file]})){
      navigator.share({files:[file],title:o.fileName,text:'Slip '+(isThr?'THR':'gaji')+' '+ (isThr?(p.thr_nama||''):p.nama)}).then(function(){toast('Dibagikan');}).catch(function(){toast('Dibatalkan atau gagal');});
    }else{toast('Perangkat/browser tidak mendukung bagikan file — gunakan WA + unduh PDF');}
  }catch(e){toast(e.message||'Gagal');}
}
function shareSlipWhatsAppWithPDF(){
  var ctx=getSlipContext();if(!ctx){toast('Pilih karyawan dulu');return;}
  var k=ctx.k,p=ctx.p,isThr=ctx.isThr;
  try{
    var o=isThr?buildTHRSlipPDF(k,p):buildGajiSlipPDF(k,p.nama,p.bayar);
    o.doc.save(o.fileName);
    var no=formatHPWhatsApp(k.hp);
    var judul=isThr?('THR '+(p.thr_nama||'')):('gaji periode '+p.nama);
    var msg='Yth. '+k.nama+', berikut slip '+judul+'. File PDF sudah diunduh — mohon lampirkan file PDF ini di chat WhatsApp.';
    var url=no?'https://wa.me/'+no+'?text='+encodeURIComponent(msg):'https://wa.me/?text='+encodeURIComponent(msg);
    window.open(url,'_blank');
    if(!no)toast('Nomor HP kosong — tambahkan di profil karyawan. PDF sudah diunduh.');
    else toast('PDF diunduh. WhatsApp dibuka — lampirkan file dari folder Unduhan.');
  }catch(e){toast(e.message||'Gagal');}
}
function shareSlipEmailWithPDF(){
  var ctx=getSlipContext();if(!ctx){toast('Pilih karyawan dulu');return;}
  var k=ctx.k,p=ctx.p,isThr=ctx.isThr;
  try{
    var o=isThr?buildTHRSlipPDF(k,p):buildGajiSlipPDF(k,p.nama,p.bayar);
    o.doc.save(o.fileName);
    var subj=isThr?('Slip THR - '+k.nama+' - '+(p.thr_nama||'')):('Slip Gaji '+p.nama+' - '+k.nama);
    var body='Yth. '+k.nama+'\n\nFile slip PDF telah diunduh di perangkat ini. Mohon lampirkan file PDF tersebut ke email ini sebelum mengirim.\n\nDetail lengkap ada di lampiran PDF.';
    window.location.href='mailto:'+encodeURIComponent(k.email||'')+'?subject='+encodeURIComponent(subj)+'&body='+encodeURIComponent(body);
    toast('PDF diunduh. Buka klien email — lampirkan file PDF secara manual.');
  }catch(e){toast(e.message||'Gagal');}
}
function getMySlipCtx(){
  if(!CU||!CU.nik)return null;
  var k=karyawan.find(function(x){return x.nik===CU.nik;});
  var pid=document.getElementById('my-period')&&document.getElementById('my-period').value;
  var p=periodes.find(function(x){return x.id==pid;})||PA();
  if(!k)return null;
  return{k:k,p:p};
}
function shareMySlipNativePDF(){
  var ctx=getMySlipCtx();if(!ctx){toast('Tidak dapat memuat slip');return;}
  try{
    var o=buildGajiSlipPDF(ctx.k,ctx.p.nama,ctx.p.bayar);
    var blob=o.doc.output('blob');
    var file=new File([blob],o.fileName,{type:'application/pdf'});
    if(navigator.canShare&&navigator.canShare({files:[file]})){
      navigator.share({files:[file],title:o.fileName,text:'Slip gaji '+ctx.p.nama}).catch(function(){toast('Dibatalkan');});
    }else toast('Bagikan file tidak didukung — gunakan tombol WA / Email + PDF');
  }catch(e){toast(e.message||'Gagal');}
}
function shareMySlipWhatsAppWithPDF(){
  var ctx=getMySlipCtx();if(!ctx)return;
  try{
    var o=buildGajiSlipPDF(ctx.k,ctx.p.nama,ctx.p.bayar);
    o.doc.save(o.fileName);
    var no=formatHPWhatsApp(ctx.k.hp);
    var msg='Slip gaji periode '+ctx.p.nama+'. File PDF sudah diunduh — lampirkan file PDF di chat ini.';
    window.open((no?'https://wa.me/'+no:'https://wa.me/')+'?text='+encodeURIComponent(msg),'_blank');
    toast('PDF diunduh. Lampirkan file ke WhatsApp.');
  }catch(e){toast(e.message||'Gagal');}
}
function shareMySlipEmailWithPDF(){
  var ctx=getMySlipCtx();if(!ctx)return;
  try{
    var o=buildGajiSlipPDF(ctx.k,ctx.p.nama,ctx.p.bayar);
    o.doc.save(o.fileName);
    var g=hitungGaji(ctx.k,ctx.p.nama);
    var subj='Slip Gaji '+ctx.p.nama+' - '+ctx.k.nama;
    var body='File slip PDF sudah diunduh. Mohon dilampirkan ke email ini.\n\nPeriode: '+ctx.p.nama+'\nTake home: '+fmt(g.neto);
    window.location.href='mailto:'+encodeURIComponent(ctx.k.email||'')+'?subject='+encodeURIComponent(subj)+'&body='+encodeURIComponent(body);
    toast('PDF diunduh — lampirkan manual di email.');
  }catch(e){toast(e.message||'Gagal');}
}

function loadMySlip(){
  if(!CU||!CU.nik)return;
  const k=karyawan.find(function(x){return x.nik===CU.nik;});
  const pid=document.getElementById('my-period')&&document.getElementById('my-period').value;
  const p=periodes.find(function(x){return x.id==pid;})||PA();
  if(k)document.getElementById('my-slip-content').innerHTML=makeSlip(k,p.nama);
}
function exportPDF(){
  const nik=document.getElementById('slip-kar')&&document.getElementById('slip-kar').value;
  const k=nik?karyawan.find(function(x){return x.nik===nik;}):null;
  if(!k){toast('Pilih karyawan');return;}
  const pid=document.getElementById('slip-per')&&document.getElementById('slip-per').value;
  const p=periodes.find(function(x){return x.id==pid;})||PA();
  const type=(document.getElementById('slip-type')&&document.getElementById('slip-type').value)||'gaji';
  if(type==='thr'&&p.thr_aktif)generateTHRPDF(k,p);else generatePDF(k,p.nama,p.bayar);
}
function exportPDFMe(){
  if(!CU||!CU.nik)return;
  const k=karyawan.find(function(x){return x.nik===CU.nik;});
  const pid=document.getElementById('my-period')&&document.getElementById('my-period').value;
  const p=periodes.find(function(x){return x.id==pid;})||PA();
  if(k)generatePDF(k,p.nama,p.bayar);
}
function exportAllTHRPDF(){
  const pid=document.getElementById('slip-per')&&document.getElementById('slip-per').value;
  const p=periodes.find(function(x){return x.id==pid;})||PA();
  if(!p.thr_aktif){toast('Periode ini tidak ada THR');return;}
  karyawan.forEach(function(k){if(hitungTHRBruto(k).eligible)generateTHRPDF(k,p);});
  toast('PDF THR semua karyawan diunduh');
}
// ── PDF GENERATORS ────────────────────────────────
function generateTHRPDF(k,p){
  try{
    var thr=hitungTHRBruto(k);if(!thr.eligible){toast(k.nama+' belum eligible');return;}
    var o=buildTHRSlipPDF(k,p);
    o.doc.save(o.fileName);
  }catch(e){toast('Gagal PDF THR: '+e.message);}
}
function generatePDF(k,pNama,tglBayar){
  try{
    var o=buildGajiSlipPDF(k,pNama,tglBayar);
    o.doc.save(o.fileName);
    toast('PDF diunduh');
  }catch(e){toast('Gagal: '+e.message);}
}
function getTahunPajakList(){
  var s={};
  (periodes||[]).forEach(function(p){s[new Date(p.bayar||p.end||p.start).getFullYear()]=1;});
  var arr=Object.keys(s).map(Number).sort(function(a,b){return a-b;});
  if(!arr.length)arr.push(new Date().getFullYear());
  return arr;
}
function namaBulanIndo(i){var B=['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'];return B[i]||'';}
/** Label masa pajak untuk 1721-A1 dari daftar periode teraggregation */
function labelMasaPajak1721(bulanList,tahun){
  if(!bulanList||!bulanList.length)return{singkat:'-',panjang:'Belum ada periode',urutan:0};
  var ms=bulanList.map(function(b){return new Date((b.tgl||tahun+'-01-01')+'T12:00:00').getMonth();});
  var mn=Math.min.apply(null,ms),mx=Math.max.apply(null,ms);
  var n=bulanList.length;
  var fullYear=n>=12&&mn===0&&mx===11;
  var singkat=fullYear?'1 s.d. 12':('1 s.d. '+n);
  var panjang=singkat+' — '+namaBulanIndo(mn)+' s.d. '+namaBulanIndo(mx)+' '+tahun;
  return{singkat,panjang,urutan:n};
}
function aggregatePajakTahun(k,tahun){
  var bruto=0,pph=0,thrBruto=0,pphThr=0,pphRet=0;
  var bulan=[];
  var tStop=k.tgl_berhenti?String(k.tgl_berhenti).trim():'';
  var sorted=(periodes||[]).slice().sort(function(a,b){return new Date(a.bayar||a.start||0)-new Date(b.bayar||b.start||0);});
  var lastBayarIso=null;
  sorted.forEach(function(per){
    if(new Date(per.bayar||per.end||per.start).getFullYear()!==tahun)return;
    var bayarIso=per.bayar||per.end||per.start;
    if(tStop&&bayarIso>tStop)return;
    var g=hitungGaji(k,per.nama);
    bruto+=g.grossPPh;pph+=g.pph;thrBruto+=g.thrBruto||0;pphThr+=g.pphAtasThr||0;pphRet+=g.pphRet||0;
    bulan.push({nama:per.nama,tgl:bayarIso,bruto:Math.round(g.grossPPh),pph:Math.round(g.pph)});
    if(!lastBayarIso||bayarIso>lastBayarIso)lastBayarIso=bayarIso;
  });
  var masa=labelMasaPajak1721(bulan,tahun);
  return{bruto,pph,thrBruto,pphThr,pphRet,bulan,masa,lastBayarIso,tglBerhentiFilter:!!tStop};
}
/** Urutan nomor bukti potong A1 per tahun pajak (tersimpan di data perusahaan). */
function nextBuktiA1Nomor(tahun){
  if(!perusahaan.a1_seq)perusahaan.a1_seq={};
  var ys=String(tahun);
  perusahaan.a1_seq[ys]=(perusahaan.a1_seq[ys]||0)+1;
  saveAll();
  var pref=(perusahaan.a1_prefix!=null&&String(perusahaan.a1_prefix).trim()!=='')?String(perusahaan.a1_prefix).trim():'A1';
  return pref+'/'+ys+'/'+String(perusahaan.a1_seq[ys]).padStart(5,'0');
}
/** PDF Form acuan 1721-A1 — judul mengikuti PER-16/PJ/2016; data dari SiGaji (TER PMK 168/2023) */
function build1721A1PDF(k,tahun,agg,nomorBukti){
  nomorBukti=nomorBukti||'-';
  var doc=new window.jspdf.jsPDF({format:'a4',unit:'mm'});
  var pw=doc.internal.pageSize.getWidth();var ph=doc.internal.pageSize.getHeight();
  var m=14;var LM=m;var RM=pw-m;
  var y=m;
  var tx=function(lines,x,yy){lines.forEach(function(l,i){doc.text(l,x,yy+i*4);});return yy+lines.length*4+1;};
  doc.setTextColor(0,0,0);
  doc.setFontSize(10.5);doc.setFont(undefined,'bold');
  var judul=[
    'BUKTI PEMOTONGAN PAJAK PENGHASILAN',
    'PASAL 21 BAGI PEGAWAI TETAP ATAU',
    'PENERIMA PENSIUN ATAU TUNJANGAN HARI',
    'TUA/JAMINAN HARI TUA BERKALA'
  ];
  judul.forEach(function(ln,i){doc.text(ln,pw/2,y+i*5.2,{align:'center'});});
  doc.setFontSize(8.5);doc.text('Nomor: '+nomorBukti,RM,m+12,{align:'right'});
  y+=24;
  doc.setFontSize(8);doc.setFont(undefined,'normal');
  doc.text('FORMULIR 1721 A1 — Bukti Pemotong (bentuk acuan / arsip internal)',pw/2,y,{align:'center'});y+=5;
  doc.setDrawColor(30);doc.setLineWidth(0.4);doc.line(LM,y,RM,y);y+=6;

  doc.setFontSize(9);doc.setFont(undefined,'bold');doc.text('A. PEMOTONG',LM,y);y+=5;
  doc.setFont(undefined,'normal');doc.setFontSize(8.5);
  doc.text('NPWP Pemotong : '+(perusahaan.npwp||'-'),LM,y);y+=4.5;
  doc.text('Nama Pemotong : '+(perusahaan.nama||'-'),LM,y);y+=4.5;
  y=tx(doc.splitTextToSize('Alamat Pemotong : '+(perusahaan.alamat||'-'),pw-2*m),LM,y);
  y+=3;

  doc.setFont(undefined,'bold');doc.text('B. PENERIMA PENGHASILAN (PEGAWAI TETAP / PENSIUN / JHT)',LM,y);y+=5;
  doc.setFont(undefined,'normal');
  doc.text('NIK / Nomor Identitas : '+(k.nik||'-'),LM,y);y+=4.5;
  doc.text('NPWP : '+(k.npwp||'-'),LM,y);y+=4.5;
  doc.text('Nama : '+(k.nama||'-'),LM,y);y+=4.5;
  y=tx(doc.splitTextToSize('Alamat : '+(k.alamat||'-'),pw-2*m),LM,y);
  doc.text('Jabatan : '+(k.jabatan||'-')+'    |    Departemen : '+(k.dept||'-')+'    |    Status : '+(k.status||'-'),LM,y);y+=4.5;
  doc.text('PTKP / Kelompok TER : '+(k.ptkp||'-')+' (PMK 168/2023)',LM,y);y+=6;

  doc.setFont(undefined,'bold');doc.text('C. MASA PAJAK & TAHUN PAJAK',LM,y);y+=5;
  doc.setFont(undefined,'normal');
  doc.text('Masa Pajak : '+agg.masa.singkat+'    ('+agg.masa.panjang+')',LM,y);y+=4.5;
  doc.text('Tahun Pajak : '+tahun,LM,y);y+=4.5;
  var tglBukti=agg.lastBayarIso||new Date().toISOString().split('T')[0];
  doc.text('Tanggal pembuatan bukti (acuan — tgl bayar gaji terakhir yang termasuk) : '+tglIndoLaporan(tglBukti),LM,y);y+=4.5;
  if(agg.tglBerhentiFilter)y=tx(doc.splitTextToSize('Catatan: Periode dibatasi sesuai Tgl. berhenti di profil karyawan (pegawai keluar tengah tahun).',pw-2*m),LM,y)+2;

  var bjTahun=agg.bulan.reduce(function(s,r){return s+Math.min(r.bruto*0.05,500000);},0);
  var pkpRef=Math.max(0,Math.floor(agg.bruto-bjTahun-nilaiPTKP(k.ptkp)));
  doc.setFont(undefined,'bold');doc.text('D. PENGHASILAN DAN PEMOTONGAN (rekap data SiGaji)',LM,y);y+=5;
  doc.setFont(undefined,'normal');
  var rowT=function(a,c,y0){doc.text(a,LM,y0);doc.text(c,RM,y0,{align:'right'});return y0+5;};
  y=rowT('Penghasilan bruto dalam tahun pajak (jumlah bruto per periode)',fmt(agg.bruto),y);
  if(agg.thrBruto>0)y=rowT('  Termasuk bagian THR (bruto)',fmt(agg.thrBruto),y);
  y=rowT('PPh Pasal 21 yang dipotong (jumlah TER per bulan)',fmt(agg.pph),y);
  if(agg.pphThr>0)y=rowT('  Referensi porsi PPh terkait THR (estimasi)',fmt(agg.pphThr),y);
  if(agg.pphRet>0)y=rowT('Pengembalian PPh ke pegawai',fmt(agg.pphRet),y);
  y+=3;
  doc.setFontSize(7.8);doc.setTextColor(70);
  y=tx(doc.splitTextToSize('Referensi (bukan baris pemotongan resmi): biaya jabatan tahunan ~'+fmt(Math.round(bjTahun))+', PKP referensi ~'+fmt(pkpRef)+'. Metode TER: total kolom 3 mengikuti penjumlahan PPh bulanan di aplikasi.',pw-2*m),LM,y);
  doc.setTextColor(0);y+=4;
  doc.setFontSize(7.5);
  y=tx(doc.splitTextToSize('Peringatan: Untuk pelaporan dan lampiran SPT ke DJP gunakan bukti potong resmi dari e-Bupot Unifikasi/Coretax. Dokumen ini untuk arsip internal berdasarkan data SiGaji.',pw-2*m),LM,y);
  y+=8;
  if(y>ph-58){doc.addPage();y=m;}
  var tglBuktiSig=agg.lastBayarIso||new Date().toISOString().split('T')[0];
  var kotaTtd=(perusahaan.a1_kota||'').trim();
  var xMid=pw/2+10;
  doc.setFontSize(9);doc.setFont(undefined,'bold');doc.setTextColor(0);
  doc.text('E. TANDA TANGAN',LM,y);y+=6;
  doc.setFont(undefined,'normal');doc.setFontSize(8.5);
  doc.text('Tempat dan tanggal,',LM,y);y+=5;
  doc.text((kotaTtd||'_______________')+', '+tglIndoLaporan(tglBuktiSig),LM,y);y+=14;
  doc.text('Pemotong,',LM,y);
  doc.text('Yang menerima penghasilan,',xMid,y);y+=18;
  doc.setDrawColor(100);doc.setLineWidth(0.3);
  doc.line(LM,y,LM+75,y);doc.line(xMid,y,Math.min(xMid+75,RM),y);y+=5;
  doc.setFont(undefined,'bold');
  doc.text((perusahaan.a1_ttd_nama||'( .................................... )'),LM,y);
  doc.text(k.nama,xMid,y);y+=4.5;
  doc.setFont(undefined,'normal');doc.setFontSize(7.8);doc.setTextColor(80);
  doc.text((perusahaan.a1_ttd_jabatan||'Jabatan'),LM,y);
  doc.text('Pegawai / Penerima penghasilan',xMid,y);y+=10;
  doc.setTextColor(0);
  if(y>ph-28){doc.addPage();y=m;}
  doc.setFontSize(7);doc.setTextColor(90);
  doc.text('Lampiran rincian per periode gaji → halaman berikut.',LM,y);y+=6;
  doc.setFontSize(8);doc.setTextColor(120);
  doc.text('Diekspor dari SiGaji — '+new Date().toISOString().split('T')[0],LM,y);

  doc.addPage();y=m;
  doc.setFontSize(10);doc.setFont(undefined,'bold');doc.setTextColor(0);
  doc.text('LAMPIRAN — RINCIAN PER PERIODE TAHUN PAJAK '+tahun,LM,y);y+=5;
  doc.setFontSize(8.5);doc.setFont(undefined,'normal');doc.text('Nomor: '+nomorBukti,LM,y);y+=7;
  doc.setFont(undefined,'normal');doc.setFontSize(8);
  doc.text('Nama pegawai: '+k.nama+'    |    NIK: '+k.nik,LM,y);y+=6;
  doc.text('Periode',LM,y);doc.text('Tgl. bayar',pw/2-5,y);doc.text('Penghasilan bruto',RM-42,y);doc.text('PPh 21',RM,y,{align:'right'});y+=4;
  doc.line(LM,y,RM,y);y+=4;
  agg.bulan.forEach(function(b){
    if(y>ph-22){doc.addPage();y=m+6;}
    doc.text(String(b.nama).substring(0,44),LM,y);
    doc.text(fmtDate(b.tgl||'-'),pw/2-5,y);
    doc.text(fmt(b.bruto),RM-42,y,{align:'right'});
    doc.text(fmt(b.pph),RM,y,{align:'right'});
    y+=4.8;
  });
  doc.setFontSize(7.5);doc.setTextColor(90);
  tx(doc.splitTextToSize('Catatan: Satu baris = satu periode gaji di Master Periode. Total harus sama dengan ringkasan halaman 1 (selisih pembulatan diperbolehkan).',pw-2*m),LM,y+4);
  return doc;
}
function exportPDF1721A1(){
  var ty=document.getElementById('a1-tahun');var tk=document.getElementById('a1-kar');
  if(!ty||!tk){toast('Form tidak ditemukan');return;}
  var tahun=parseInt(ty.value,10);var nik=tk.value;
  var k=karyawan.find(function(x){return x.nik===nik;});
  if(!k||!tahun){toast('Pilih tahun pajak dan karyawan');return;}
  var agg=aggregatePajakTahun(k,tahun);
  if(!agg.bulan.length){toast('Tidak ada periode gaji untuk tahun '+tahun+(k.tgl_berhenti?' (cek Tgl. berhenti — mungkin terlalu awal atau salah tahun)':''));return;}
  try{
    var nomor=nextBuktiA1Nomor(tahun);
    var doc=build1721A1PDF(k,tahun,agg,nomor);
    doc.save('1721-A1_'+sanitizePdfFileName(k.nama)+'_'+tahun+'.pdf');
    toast('PDF 1721-A1 diunduh — Nomor '+nomor);
  }catch(e){toast('Gagal: '+e.message);}
}
// ── PPH & LAPORAN ────────────────────────────────
function renderPPH(){
  var list=karyawanListPeriode(PA());
  document.getElementById('tb-pph').innerHTML=list.map(function(k,idx){
    const g=hitungGaji(k);
    const tbl=getTERTable(k.ptkp);const rate=(tbl.find(function(r){return g.grossPPh<=r[0];})||[0,.34])[1];
    const bj=Math.min(g.grossPPh*12*.05,6e6);const pv=nilaiPTKP(k.ptkp);const pkp=Math.max(0,g.grossPPh*12-bj-pv);
    return '<tr><td style="text-align:center;font-weight:700;color:#6b7280">'+(idx+1)+'</td><td><div class="fl gap2" style="align-items:center"><div class="ka">'+ini(k.nama)+'</div><div class="knl" onclick="openPanel(\''+k.nik+'\')">'+k.nama+'</div></div></td>'
      +'<td><span class="bdg b-info">'+k.ptkp+'</span></td><td>'+fmt(g.grossPPh)+'</td>'
      +'<td>'+(g.thrBruto>0?'<span style="color:#5b21b6;font-weight:700">'+fmt(g.thrBruto)+'</span>':'&#8212;')+'</td>'
      +'<td>'+(rate*100).toFixed(2)+'%</td><td>'+fmt(pkp)+'</td><td>'+fmt(g.pph*12)+'</td>'
      +'<td><strong>'+fmt(g.pph)+'</strong></td>'
      +'<td>'+(g.pphRet>0?'<span class="bdg b-ok">+ '+fmt(g.pphRet)+'</span>':'&#8212;')+'</td></tr>';
  }).join('');
  var ys=getTahunPajakList();
  var selY=document.getElementById('a1-tahun');
  if(selY){
    var curY=parseInt(selY.value,10)||0;
    selY.innerHTML=ys.map(function(y){return '<option value="'+y+'">'+y+'</option>';}).join('');
    if(ys.indexOf(curY)>=0)selY.value=String(curY);
    else selY.value=String(ys.indexOf(new Date().getFullYear())>=0?new Date().getFullYear():ys[ys.length-1]);
  }
  var selK=document.getElementById('a1-kar');
  if(selK){
    var prev=selK.value;
    selK.innerHTML='<option value="">-- Pilih karyawan --</option>'+karyawan.map(function(k){return '<option value="'+k.nik+'">'+k.nik+' — '+k.nama+'</option>';}).join('');
    if(prev&&karyawan.some(function(k){return k.nik===prev;}))selK.value=prev;
  }
}
function renderLaporan(){
  document.getElementById('tb-lap').innerHTML=periodes.map(function(p){
    let tB=0,tP=0,tN=0,tT=0;
    var list=karyawanListPeriode(p);
    list.forEach(function(k){const g=hitungGaji(k,p.nama);tB+=g.grossPPh;tP+=g.pph;tN+=g.neto;tT+=g.thrBruto;});
    return '<tr '+(p.status==='aktif'?'style="background:#e8f4de"':'')+'>'
      +'<td><strong>'+p.nama+'</strong>'+(p.thr_aktif?' <span class="bdg b-pu">THR</span>':'')+'</td>'
      +'<td>'+list.length+'</td><td>'+fmt(tB)+'</td><td>'+(tT>0?fmt(tT):'&#8212;')+'</td>'
      +'<td>'+fmt(tP)+'</td><td>'+fmt(tN)+'</td>'
      +'<td><span class="bdg '+(p.status==='aktif'?'b-warn':'b-ok')+'">'+(p.status==='aktif'?'Proses':'Selesai')+'</span></td></tr>';
  }).join('');
}
function exportCSV(){
  const rows=[['No','Nama','Dept','Gaji Pokok','Gross PPh','THR','TH Bruto','BPJS Kar','PPh 21','PPh Return','Neto']];
  var list=karyawanListPeriode(PA());
  list.forEach(function(k,i){const g=hitungGaji(k);rows.push([i+1,k.nama,k.dept,k.gapok,Math.round(g.grossPPh),Math.round(g.thrBruto),Math.round(g.brutoTH),Math.round(g.bpjs.kes_kar+g.bpjs.jht_kar+g.bpjs.jp_kar),g.pph,g.pphRet,Math.round(g.neto)]);});
  const csv=rows.map(function(r){return r.map(function(v){return '"'+v+'"';}).join(',');}).join('\n');
  const b=new Blob(['\uFEFF'+csv],{type:'text/csv'});const a=document.createElement('a');a.href=URL.createObjectURL(b);a.download='Rekap_SiGaji9.csv';a.click();toast('CSV diunduh');
}
function tglIndoLaporan(iso){
  if(!iso)return'';
  var bln=['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'];
  var d=new Date(iso+'T12:00:00');
  if(isNaN(d.getTime()))return'';
  return d.getDate()+' '+bln[d.getMonth()]+' '+d.getFullYear();
}
function ensureXLSX(fn){
  if(typeof XLSX!=='undefined'){fn();return;}
  var s=document.createElement('script');
  s.src='https://cdn.sheetjs.com/xlsx-0.20.2/package/dist/xlsx.full.min.js';
  s.onload=function(){fn();};
  s.onerror=function(){toast('Gagal memuat library Excel. Cek koneksi internet.');};
  document.head.appendChild(s);
}
function xlsxSetNumFmtRange(ws,col,rowStart,rowEnd,fmt){
  fmt=fmt||'#,##0';
  if(!ws)return;
  for(var R=rowStart;R<=rowEnd;R++){
    var addr=XLSX.utils.encode_cell({r:R,c:col});
    if(ws[addr]&&typeof ws[addr].v==='number')ws[addr].z=fmt;
  }
}
/** Excel: DAFTAR REKENING PENGGAJIAN — seperti form transfer bank */
function exportExcelDaftarRekening(){
  var p=PA();
  var list=karyawanListPeriode(p);
  if(!list.length){toast('Belum ada karyawan aktif untuk periode ini');return;}
  ensureXLSX(function(){
    try{
      var pNama=p.nama;
      var pt=(perusahaan.nama||'PERUSAHAAN').toUpperCase();
      var wb=XLSX.utils.book_new();
      var rows=[];
      rows.push(['DAFTAR REKENING PENGGAJIAN '+pt]);
      rows.push([]);
      rows.push(['NO','NAMA','NO REKENING','KET']);
      var totalNeto=0;
      list.forEach(function(k,i){
        var g=hitungGaji(k,pNama);
        var net=Math.round(g.neto);
        totalNeto+=net;
        rows.push([i+1,(k.nama||'').toUpperCase(),String(k.norek||'').replace(/\s/g,''),net]);
      });
      rows.push([]);
      rows.push(['','','TOTAL',totalNeto]);
      rows.push([]);
      rows.push([]);
      var kota='_______________';
      var tglBay=tglIndoLaporan(p.bayar||p.end||p.start);
      rows.push(['','','',kota+', '+tglBay]);
      rows.push(['','','','']);
      rows.push(['','','','(nama penandatangan)']);
      var ws=XLSX.utils.aoa_to_sheet(rows);
      ws['!merges']=[{s:{r:0,c:0},e:{r:0,c:3}}];
      ws['!cols']=[{wch:6},{wch:28},{wch:22},{wch:18}];
      var n=list.length;
      xlsxSetNumFmtRange(ws,3,3,2+n,'#,##0');
      xlsxSetNumFmtRange(ws,3,4+n,4+n,'#,##0');
      XLSX.utils.book_append_sheet(wb,ws,'Daftar Rekening');
      var fn='Daftar_Rekening_'+pNama.replace(/[^\w\d]+/g,'_')+'_'+new Date().toISOString().split('T')[0]+'.xlsx';
      XLSX.writeFile(wb,fn);
      toast('Excel daftar rekening diunduh');
    }catch(e){toast('Gagal: '+e.message);}
  });
}
/** Excel: rekap iuran BPJS (kar + prs) per karyawan — periode aktif */
function exportExcelBPJS(){
  var p=PA();
  var list=karyawanListPeriode(p);
  if(!list.length){toast('Belum ada karyawan aktif untuk periode ini');return;}
  ensureXLSX(function(){
    try{
      var pNama=p.nama;
      var pt=(perusahaan.nama||'PERUSAHAAN').toUpperCase();
      var hdr=['NO','NIK','NAMA','BPJS KES (KAR)','JHT (KAR)','JP (KAR)','JKK (PRS)','JKM (PRS)','BPJS KES (PRS)','JHT (PRS)','JP (PRS)','JUMLAH POT. KAR','JUMLAH BEBAN PRS'];
      var rows=[];
      rows.push(['REKAP IURAN BPJS — '+pt]);
      rows.push(['Periode penggajian: '+pNama+' | Bayar: '+tglIndoLaporan(p.bayar||p.end||p.start)]);
      rows.push([]);
      rows.push(hdr);
      var sum=new Array(10).fill(0);
      list.forEach(function(k,i){
        var g=hitungGaji(k,pNama);var b=g.bpjs;
        var potKar=Math.round(b.kes_kar+b.jht_kar+b.jp_kar);
        var bebanPrs=Math.round(b.jkk_prs+b.jkm_prs+b.kes_prs+b.jht_prs+b.jp_prs);
        var line=[i+1,k.nik,(k.nama||'').toUpperCase(),
          Math.round(b.kes_kar),Math.round(b.jht_kar),Math.round(b.jp_kar),
          Math.round(b.jkk_prs),Math.round(b.jkm_prs),Math.round(b.kes_prs),Math.round(b.jht_prs),Math.round(b.jp_prs),
          potKar,bebanPrs];
        for(var j=3;j<hdr.length;j++)sum[j-3]+=line[j];
        rows.push(line);
      });
      rows.push([]);
      var totLab=['TOTAL','',''];
      for(var t=0;t<sum.length;t++)totLab.push(sum[t]);
      rows.push(totLab);
      rows.push([]);
      rows.push([]);
      var tglBay=tglIndoLaporan(p.bayar||p.end||p.start);
      var footRow=function(text){
        var r=new Array(hdr.length).fill('');
        r[hdr.length-1]=text;
        return r;
      };
      rows.push(footRow(''));
      rows.push(footRow('_______________'+', '+tglBay));
      rows.push(footRow(''));
      rows.push(footRow('(nama penandatangan)'));
      var ws=XLSX.utils.aoa_to_sheet(rows);
      var wb=XLSX.utils.book_new();
      ws['!merges']=[{s:{r:0,c:0},e:{r:0,c:hdr.length-1}},{s:{r:1,c:0},e:{r:1,c:hdr.length-1}}];
      ws['!cols']=[{wch:5},{wch:14},{wch:26},{wch:14},{wch:12},{wch:12},{wch:12},{wch:12},{wch:14},{wch:12},{wch:12},{wch:16},{wch:16}];
      var n=karyawan.length;
      var lastDataRow=3+n;
      var totalRowIdx=5+n;
      for(var c=3;c<=12;c++){
        xlsxSetNumFmtRange(ws,c,4,lastDataRow,'#,##0');
        xlsxSetNumFmtRange(ws,c,totalRowIdx,totalRowIdx,'#,##0');
      }
      XLSX.utils.book_append_sheet(wb,ws,'BPJS');
      var fn='Rekap_BPJS_'+pNama.replace(/[^\w\d]+/g,'_')+'_'+new Date().toISOString().split('T')[0]+'.xlsx';
      XLSX.writeFile(wb,fn);
      toast('Excel BPJS diunduh');
    }catch(e){toast('Gagal: '+e.message);}
  });
}
/** Rincian potongan kehadiran per jenis (label dari hitungPotonganKehadiran.details) */
function potKhDetailCols(details){
  var z={dk:0,lk:0,izin:0,sakit:0,s05:0,i05:0,alpha:0};
  (details||[]).forEach(function(d){
    var L=String(d.label||'');
    if(L.indexOf('luar kuota')>=0)z.lk=Math.round(d.nilai||0);
    else if(L.indexOf('dlm kuota')>=0||L.indexOf('dalam kuota')>=0)z.dk=Math.round(d.nilai||0);
    else if(L.indexOf('1/2 Sakit')>=0)z.s05=Math.round(d.nilai||0);
    else if(L.indexOf('1/2 Izin')>=0)z.i05=Math.round(d.nilai||0);
    else if(L.indexOf('Alpha (')===0)z.alpha=Math.round(d.nilai||0);
    else if(L.indexOf('Izin (')===0)z.izin=Math.round(d.nilai||0);
    else if(L.indexOf('Sakit (')===0)z.sakit=Math.round(d.nilai||0);
  });
  return z;
}
function terInfoForExport(ptkpKey,grossPPh){
  var tbl=getTERTable(ptkpKey);
  var idx=tbl.findIndex(function(r){return grossPPh<=r[0];});
  var found=idx>=0?tbl[idx]:tbl[tbl.length-1];
  var lmpKey=ptkpKey==='TK0'||ptkpKey==='TK1'||ptkpKey==='K0'?'A':ptkpKey==='K3'?'C':'B';
  var customRate=perusahaan&&perusahaan.ter_custom&&perusahaan.ter_custom[lmpKey]&&perusahaan.ter_custom[lmpKey][idx>=0?idx:tbl.length-1];
  var rate=customRate!==undefined?customRate:found[1];
  return{lampiran:'Lampiran '+lmpKey,ratePct:Math.round(rate*10000)/100,batasBrutoTer:found[0]};
}
/** Excel: kertas kerja PPh 21 & THP — per karyawan, periode aktif */
function exportExcelKertasKerjaPPh(){
  var p=PA();
  var list=karyawan.filter(function(k){return karyawanInPeriode(k,p);});
  if(!list.length){toast('Belum ada karyawan untuk periode aktif');return;}
  ensureXLSX(function(){
    try{
      var pNama=p.nama;
      var pt=(perusahaan.nama||'PERUSAHAAN');
      var tunjNames={};
      var potNames={};
      list.forEach(function(k){
        var g=hitungGaji(k,pNama);
        (g.tItems||[]).forEach(function(t){if(t.nama)tunjNames[t.nama]=true;});
        (k.potongan||[]).forEach(function(x){if(x.nama)potNames[x.nama]=true;});
      });
      var tunjCols=Object.keys(tunjNames).sort();
      var potCols=Object.keys(potNames).sort();
      var baseHdr=['No','NIK','Nama','Dept','Jabatan','Status','PTKP','NPWP','Pro-rata aktif','HK prorata','HH prorata','Gaji pokok efektif'];
      var tunjHdr=tunjCols.map(function(n){return 'Tunj: '+n;});
      var midHdr=[
        'Natura KP (Gross PPh)','Natura NKP (TH saja)','Lembur','BPJS Prs JKK+JKM+Kes (natura KP)',
        'Gross PPh regular (tanpa THR)','THR Bruto','Gross PPh 21 total','TER (lampiran PMK 168)','TER tarif %','Batas bruto kategori TER',
        'PPh 21 bulan ini','PPh tanpa THR','PPh atas THR',
        'BPJS Kes (Kar)','BPJS JHT (Kar)','BPJS JP (Kar)','Jumlah potongan tunjangan (master)'
      ];
      var potHdr=potCols.map(function(n){return 'Pot: '+n;});
      var pkHdr=[
        'Pot keh: Cuti dlm kuota','Pot keh: Cuti luar kuota','Pot keh: Izin','Pot keh: Sakit','Pot keh: 1/2 Sakit','Pot keh: 1/2 Izin','Pot keh: Alpha','Total pot kehadiran'
      ];
      var tailHdr=[
        'PPh return (penambah THP)','Total potongan','Bruto Take Home','PHK bruto','PPh final PHK','PHK netto',
        'Rekons PPh (tipe)','Lebih bayar PPh','Kurang bayar PPh','Take Home Pay (THP)'
      ];
      var hdr=baseHdr.concat(tunjHdr).concat(midHdr).concat(potHdr).concat(pkHdr).concat(tailHdr);
      var rows=[];
      rows.push(['KERTAS KERJA PPh 21 & THP — '+pt]);
      rows.push(['Periode: '+pNama+' | Mulai-Selesai: '+(p.start||'')+' s.d. '+(p.end||'')+' | Bayar: '+(p.bayar||'')]);
      rows.push(['Dicetak: '+new Date().toISOString().split('T')[0]]);
      rows.push([]);
      rows.push(hdr);
      list.forEach(function(k,idx){
        var g=hitungGaji(k,pNama);
        var pr=getPR(k.nik,pNama);
        var terI=terInfoForExport(k.ptkp,g.grossPPh);
        var pk=potKhDetailCols(g.potKehadiran.details);
        var r=new Array(hdr.length).fill('');
        var j=0;
        r[j++]=idx+1;r[j++]=k.nik;r[j++]=k.nama||'';r[j++]=k.dept||'';r[j++]=k.jabatan||'';r[j++]=k.status||'';
        r[j++]=k.ptkp||'';r[j++]=k.npwp||'';r[j++]=g.isPR?'Ya':'Tidak';
        r[j++]=g.isPR&&g.pr?g.pr.hk:'';r[j++]=g.isPR&&g.pr?g.pr.hh:'';
        r[j++]=Math.round(g.gapokEff);
        tunjCols.forEach(function(nm){
          var t=(g.tItems||[]).find(function(x){return x.nama===nm;});
          r[j++]=t?Math.round(t.eff):0;
        });
        r[j++]=Math.round(g.natKP);r[j++]=Math.round(g.natNKP);r[j++]=Math.round(g.lb);r[j++]=Math.round(g.bpjsPrsNatKP);
        r[j++]=Math.round(g.grossPPhRegular);r[j++]=Math.round(g.thrBruto);r[j++]=Math.round(g.grossPPh);
        r[j++]=terI.lampiran;r[j++]=terI.ratePct;r[j++]=terI.batasBrutoTer===Infinity?'>':Math.round(terI.batasBrutoTer);
        r[j++]=Math.round(g.pph);r[j++]=Math.round(g.pphTanpaThr);r[j++]=Math.round(g.pphAtasThr);
        r[j++]=Math.round(g.bpjs.kes_kar);r[j++]=Math.round(g.bpjs.jht_kar);r[j++]=Math.round(g.bpjs.jp_kar);
        r[j++]=Math.round(g.potT);
        potCols.forEach(function(nm){
          var t=(k.potongan||[]).find(function(x){return x.nama===nm;});
          r[j++]=t?Math.round(t.nilai):0;
        });
        r[j++]=pk.dk;r[j++]=pk.lk;r[j++]=pk.izin;r[j++]=pk.sakit;r[j++]=pk.s05;r[j++]=pk.i05;r[j++]=pk.alpha;
        r[j++]=Math.round(g.potKehadiran.total||0);
        r[j++]=Math.round(g.pphRet);
        r[j++]=Math.round(g.totalPot);
        r[j++]=Math.round(g.brutoTH);
        if(g.phk&&g.phk.mode==='phk'){
          r[j++]=Math.round(g.phk.bruto||0);r[j++]=Math.round(g.phk.pphFinal||0);r[j++]=Math.round((g.phk.bruto||0)-(g.phk.pphFinal||0));
        }else{r[j++]='';r[j++]='';r[j++]='';}
        if(g.reconciliation){
          r[j++]=String(g.reconciliation.tipePeriode||'');
          r[j++]=g.reconciliation.lebihBayar>0?Math.round(g.reconciliation.lebihBayar):'';
          r[j++]=g.reconciliation.kurangBayar>0?Math.round(g.reconciliation.kurangBayar):'';
        }else{r[j++]='';r[j++]='';r[j++]='';}
        r[j++]=Math.round(g.neto);
        rows.push(r);
      });
      var ws=XLSX.utils.aoa_to_sheet(rows);
      var wb=XLSX.utils.book_new();
      var ncol=hdr.length;
      ws['!merges']=[{s:{r:0,c:0},e:{r:0,c:ncol-1}},{s:{r:1,c:0},e:{r:1,c:ncol-1}},{s:{r:2,c:0},e:{r:2,c:ncol-1}}];
      var cols=[{wch:4},{wch:12},{wch:26},{wch:12},{wch:18},{wch:10},{wch:8},{wch:18},{wch:10},{wch:8},{wch:8},{wch:14}];
      for(var t=0;t<tunjHdr.length;t++)cols.push({wch:16});
      for(var m=0;m<midHdr.length;m++)cols.push({wch:14});
      for(var p0=0;p0<potHdr.length;p0++)cols.push({wch:14});
      for(var q=0;q<pkHdr.length;q++)cols.push({wch:12});
      for(var u=0;u<tailHdr.length;u++)cols.push({wch:16});
      while(cols.length<ncol)cols.push({wch:12});
      ws['!cols']=cols.slice(0,ncol);
      var firstDataRow=5;
      var lastDataRow=firstDataRow+list.length-1;
      for(var c=11;c<ncol;c++){
        xlsxSetNumFmtRange(ws,c,firstDataRow,lastDataRow,'#,##0');
      }
      XLSX.utils.book_append_sheet(wb,ws,'Kertas Kerja PPh');
      var fn='Kertas_Kerja_PPh_'+pNama.replace(/[^\w\d]+/g,'_')+'_'+new Date().toISOString().split('T')[0]+'.xlsx';
      XLSX.writeFile(wb,fn);
      toast('Excel kertas kerja diunduh');
    }catch(e){toast('Gagal: '+e.message);}
  });
}
// ── THR RENDER ───────────────────────────────────
function setTHRManual(el){
  var nik=el.dataset.nik;var pNama=el.dataset.pnama;var aktif=el.dataset.aktif==='1';
  if(!thrManual[pNama])thrManual[pNama]={};
  if(!thrManual[pNama][nik])thrManual[pNama][nik]={aktif:false,nilai:0};
  thrManual[pNama][nik].aktif=aktif;
  if(!aktif)thrManual[pNama][nik].nilai=0;
  saveAll();renderTHR();
}
function simpanTHRManualEl(el){
  var nik=el.dataset.nik;var pNama=el.dataset.pnama;
  var v=parseInt(String(el.value).replace(/[^0-9]/g,''))||0;
  if(!thrManual[pNama])thrManual[pNama]={};
  thrManual[pNama][nik]={aktif:true,nilai:v};
  saveAll();renderTHR();
}
function renderTHR(){
  const hari=(document.getElementById('thr-hari')&&document.getElementById('thr-hari').value)||'Idul Fitri';
  const lbl=document.getElementById('thr-hari-lbl');if(lbl)lbl.textContent=hari;
  let total=0,eligible=0;const p=PA();const periodeAdaTHR=!!p.thr_aktif;
  const pNama=p.nama;
  document.getElementById('tb-thr').innerHTML=karyawan.map(function(k,idx){
    const t=hitungTHRBruto(k,pNama);const isE=t.eligible;if(isE){total+=t.nilai;eligible++;}
    const mb=Math.floor(t.mb/12)+'thn '+t.mb%12+'bln';
    const g=isE&&periodeAdaTHR?hitungGaji(k,pNama):null;const pphEst=g?g.pphAtasThr:0;
    const manData=(thrManual[pNama]||{})[k.nik]||{aktif:false,nilai:0};
    const isManual=manData.aktif;
    // Kolom input manual
    var manCell='';
    if(isE){
      var nikE=k.nik.replace(/'/g,"\\'");
      var pNE=pNama.replace(/'/g,"\\'");
      manCell='<div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap">'
        +'<button onclick="setTHRManual(this)" data-nik="'+k.nik+'" data-pnama="'+pNama+'" data-aktif="'+(isManual?'0':'1')+'" '
        +'style="padding:3px 10px;border-radius:20px;border:1.5px solid '+(isManual?'#5b21b6':'#dde1e9')+';'
        +'background:'+(isManual?'#5b21b6':'#fff')+';color:'+(isManual?'#fff':'#6b7280')+';'
        +'font-size:10px;font-weight:700;cursor:pointer;white-space:nowrap">'
        +(isManual?'&#9998; Manual':'&#9711; Otomatis')+'</button>';
      if(isManual){
        manCell+='<input type="text" id="thr-inp-'+k.nik+'" '
          +'value="'+(manData.nilai>0?manData.nilai.toLocaleString('id-ID'):'')+'" '
          +'placeholder="Nominal Rp" '
          +'style="width:120px;padding:4px 8px;border:1.5px solid #c4b5fd;border-radius:6px;font-size:12px;font-family:inherit;outline:none;color:#5b21b6;font-weight:700" '
          +'data-nik="'+k.nik+'" data-pnama="'+pNama+'" '
          +'onchange="simpanTHRManualEl(this)" '
          +'onkeydown="if(event.key===\'Enter\')simpanTHRManualEl(this)">';
        if(t.nilaiOto)manCell+='<span style="font-size:9px;color:#9ca3af">Otomatis: '+fmt(t.nilaiOto)+'</span>';
      }
      manCell+='</div>';
    }else{
      manCell='<span style="color:#d1d5db;font-size:11px">&#8212;</span>';
    }
    return '<tr><td style="text-align:center;font-weight:700;color:#6b7280">'+(idx+1)+'</td><td><div class="fl gap2" style="align-items:center"><div class="ka">'+ini(k.nama)+'</div><div><strong>'+k.nama+'</strong><br><small style="color:#6b7280">'+k.nik+'</small></div></div></td>'
      +'<td>'+mb+'</td>'
      +'<td>'+fmt(t.dasar)+'</td>'
      +'<td>'+(isE?t.pl:'<span class="bdg b-err">Belum eligible</span>')+'</td>'
      +'<td>'+manCell+'</td>'
      +'<td><strong style="color:'+(isManual?'#5b21b6':'#1a56a0')+'">'+(isE?fmt(t.nilai+(isManual?0:0)):'&#8212;')+'</strong>'
        +(isManual?'<div style="font-size:9px;color:#5b21b6">&#9998; Manual</div>':'')+'</td>'
      +'<td>'+(isE&&periodeAdaTHR?'<span style="color:#7d4800">'+fmt(pphEst)+'</span>':'<span style="color:#9ca3af">'+(periodeAdaTHR?'&#8212;':'Set THR di Periode')+'</span>')+'</td>'
      +'<td><strong style="color:#2d6a0a">'+(isE?fmt(t.nilai):'&#8212;')+'</strong>'+(isE?'<div style="font-size:9px;color:#2d6a0a">(full netto)</div>':'')+'</td></tr>';
  }).join('');
  document.getElementById('thr-summary').innerHTML='<div class="fl gap2" style="flex-wrap:wrap">'
    +'<div><div style="font-size:22px;font-weight:800;color:#2d6a0a">'+eligible+'</div><div style="font-size:11px;color:#6b7280">Eligible</div></div>'
    +'<div><div style="font-size:22px;font-weight:800;color:#5b21b6">'+fmt(total)+'</div><div style="font-size:11px;color:#6b7280">Total THR Bruto</div></div>'
    +'<div><div style="font-size:22px;font-weight:800;color:#2d6a0a">'+fmt(total)+'</div><div style="font-size:11px;color:#6b7280">Dibayar Full Netto</div></div></div>'
    +(periodeAdaTHR?'<div class="info-box info-pu" style="margin-top:.5rem;margin-bottom:0;font-size:11px">&#10003; Periode aktif ada THR. PPh THR digabung ke gaji akhir bulan.</div>':'<div class="info-box info-amber" style="margin-top:.5rem;margin-bottom:0;font-size:11px">Aktifkan THR di Master Periode untuk menggabungkan PPh THR ke gaji.</div>');
}
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
  karyawan.forEach(function(k){if(!absensi[k.nik])absensi[k.nik]={};});
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
  karyawan.forEach(function(k,ki){
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
      html+='<td style="background:'+bg+';color:'+tx+';padding:0;text-align:center;border-right:1px solid rgba(0,0,0,.06);border-bottom:1px solid #f3f4f6;opacity:'+(canCell?'1':cc?'0.88':'1')+';'+(canCell?'cursor:pointer;':cc?'cursor:not-allowed;':'')+'font-weight:700;font-size:10px" '+(canCell?'onclick="toggleAb(\''+k.nik+'\',\''+x.date+'\',this)"':cc?'title="Periode terkunci — hubungi Admin"':'')+'>'+lbl+'</td>';
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
  document.getElementById('ab-rekap-wrap').innerHTML='<div class="card" style="display:flex;gap:1rem;flex-wrap:wrap;align-items:center"><span style="font-size:11px;font-weight:700;color:#6b7280">'+escapeHtml(pAbs.nama)+':</span><span style="background:#e8f4de;color:#2d6a0a;padding:3px 12px;border-radius:20px;font-weight:700">Hari Kerja (dalam rentang): '+hkP+'</span>'+(cbB>0?'<span style="background:#ede9fe;color:#5b21b6;padding:3px 12px;border-radius:20px;font-weight:700">Cuti Bersama (dalam rentang): '+cbB+' hari</span>':'')+'<span style="font-size:10px;color:#9ca3af;margin-left:auto">Pola: Senin-'+((perusahaan.hariKerja||6)===6?'Sabtu':'Jumat')+'</span></div>';
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
  populateAbsensiPeriodeSelect();
  var pid=document.getElementById('ab-periode-sel')&&document.getElementById('ab-periode-sel').value;
  var pAbs=periodes.find(function(x){return String(x.id)===String(pid);})||PA();
  const cb=countCutiBersamaUntukTahunDanPeriode(yr,pAbs);
  var list=karyawanListPeriode(pAbs);
  if(!list.length){
    tb.innerHTML='<tr><td colspan="10" style="text-align:center;color:#9ca3af;padding:1.25rem">Tidak ada karyawan untuk periode gaji ini (mis. semua sudah berhenti sebelum tanggal mulai periode).</td></tr>';
    return;
  }
  tb.innerHTML=list.map(function(k,idx){
    const mb=masaKerjaBulan(k);const manual=cutiManualUntukTahunDanPeriode(k.nik,yr,pAbs);const total=manual+cb;
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
  el.innerHTML=karyawan.map(function(k){
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
// ── PERIODE & MASTER ─────────────────────────────
function toggleThrFields(){var aktif=document.getElementById('p-thr-aktif')&&document.getElementById('p-thr-aktif').checked;var f=document.getElementById('thr-fields');if(f)f.style.display=aktif?'block':'none';}
function renderPeriodes(){
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
    var lockBtn='<button class="btn btn-sm '+(p.snapshot_locked?'btn-out':'btn-r')+'" onclick="toggleLockPeriode(\''+p.id+'\')">'+(p.snapshot_locked?'Buka Kunci':'Kunci')+'</button>';
    var rebuildBtn='<button class="btn btn-sm btn-out" onclick="rebuildSnapshotPeriode(\''+p.id+'\')">Rebuild Snapshot</button>';
    return '<tr><td><strong>'+p.nama+'</strong></td><td>'+p.start+'</td><td>'+p.end+'</td><td>'+p.bayar+'</td>'
      +'<td>'+(p.thr_aktif?'<div style="font-size:11px;color:#5b21b6;font-weight:700">&#127873; '+(p.thr_nama||'THR')+'<br><span style="color:#9ca3af;font-weight:400">Bayar: '+fmtDate(p.thr_bayar||'-')+'</span></div>':'&#8212;')+'</td>'
      +'<td><span class="bdg '+(p.status==='aktif'?'b-ok':'b-gray')+'">'+(p.status==='aktif'?'Aktif':'Tutup')+'</span>'+lockBdg+'</td>'
      +'<td><div class="fl gap1"><button class="btn btn-sm btn-out" onclick="aktifkanPeriode(\''+p.id+'\')">Aktifkan</button>'+lockBtn+rebuildBtn+'<button class="btn btn-sm btn-r" onclick="hapusPeriode(\''+p.id+'\')">Hapus</button></div></td></tr>';
  }).join('');
}
function renderPBanner(id){var p=PA();var el=document.getElementById(id);if(!el)return;var hP=Math.max(0,Math.ceil((new Date(p.bayar)-Date.now())/86400000));el.innerHTML='<div class="pb mb2"><div><div style="font-size:10px;opacity:.75">Periode Aktif</div><div style="font-size:17px;font-weight:800">'+p.nama+(p.thr_aktif?' <span style="font-size:12px;background:rgba(255,255,255,.2);padding:2px 8px;border-radius:20px">&#127873; THR</span>':'')+'</div><div style="font-size:11px;opacity:.8">'+fmtDate(p.start)+' - '+fmtDate(p.end)+'</div></div><div style="text-align:right"><div style="font-size:28px;font-weight:800">'+hP+'</div><div style="font-size:10px;opacity:.75">hari</div></div></div>';}
function toggleOpsiLebihBayar(){
  const tipe=document.getElementById('p-tipe-periode')&&document.getElementById('p-tipe-periode').value;
  const el=document.getElementById('fg-opsi-lebih-bayar');
  if(el)el.style.display=(tipe==='desember'||tipe==='resign')?'block':'none';
}
function simpanPeriode(){
  var nama=document.getElementById('p-nama').value.trim();var start=document.getElementById('p-start').value;var end=document.getElementById('p-end').value;var bayar=document.getElementById('p-bayar').value;var status=document.getElementById('p-status').value;
  if(!nama||!start||!end||!bayar){toast('Wajib diisi');return;}
  var tipeP=(document.getElementById('p-tipe-periode')&&document.getElementById('p-tipe-periode').value)||'normal';
  var opsiLB=(document.getElementById('p-opsi-lebih-bayar')&&document.getElementById('p-opsi-lebih-bayar').value)||'refund';
  var thrAktif=!!(document.getElementById('p-thr-aktif')&&document.getElementById('p-thr-aktif').checked);
  var thrNama=thrAktif&&document.getElementById('p-thr-nama')?document.getElementById('p-thr-nama').value:'';
  var thrBayar=thrAktif&&document.getElementById('p-thr-bayar')?document.getElementById('p-thr-bayar').value:'';
  var thrHR=thrAktif&&document.getElementById('p-thr-hariraya')?document.getElementById('p-thr-hariraya').value:'';
  var obj={nama:nama,start:start,end:end,bayar:bayar,status:status,tipe_periode:tipeP,opsi_lebih_bayar:opsiLB,thr_aktif:thrAktif,thr_nama:thrNama,thr_bayar:thrBayar,thr_hariraya:thrHR};
  var ex=periodes.find(function(p){return p.nama===nama;});
  if(ex)Object.assign(ex,obj);else periodes.push(Object.assign({id:Date.now()},obj));
  if(status==='aktif')periodes.forEach(function(p){if(p.nama!==nama)p.status='tutup';});
  saveAll();renderPeriodes();document.getElementById('top-periode').textContent=PA().nama;renderKar();renderPenggajian();renderDash();renderPPH();renderLaporan();renderPeriodeSelects();populateSelects();toast('Periode disimpan'+(thrAktif?' dengan THR':''));
}
function aktifkanPeriode(id){periodes.forEach(function(p){p.status=p.id==id?'aktif':'tutup';});saveAll();renderPeriodes();document.getElementById('top-periode').textContent=PA().nama;renderKar();renderPenggajian();renderDash();renderPPH();renderLaporan();renderPeriodeSelects();populateSelects();toast('Diaktifkan');}
function toggleLockPeriode(id){
  var p=periodes.find(function(x){return x.id==id;});
  if(!p)return;
  if(!p.snapshot_locked){
    var list=karyawanListPeriode(p);
    ensureKarSnapshotPeriode(p.nama,list);
    var prog=getKarSnapshotProgress(p.nama,list);
    if(!prog.ok){toast('Snapshot belum lengkap: '+prog.done+'/'+prog.total);return;}
    if(!confirm('Kunci snapshot periode "'+p.nama+'"? Setelah dikunci, perubahan master tidak akan mengubah perhitungan periode ini.'))return;
    p.snapshot_locked=true;
    saveAll();renderPeriodes();toast('Periode '+p.nama+' terkunci');
  }else{
    if(!confirm('Buka kunci snapshot periode "'+p.nama+'"? Perubahan berikutnya pada periode ini bisa mengubah snapshot.'))return;
    p.snapshot_locked=false;
    saveAll();renderPeriodes();toast('Kunci periode dibuka');
  }
}
function rebuildSnapshotPeriode(id){
  var p=periodes.find(function(x){return x.id==id;});
  if(!p)return;
  if(p.snapshot_locked){toast('Periode '+p.nama+' terkunci. Buka kunci dulu untuk rebuild snapshot.');return;}
  if(!confirm('Rebuild snapshot periode "'+p.nama+'"? Snapshot lama periode ini akan ditimpa dari Master saat ini.'))return;
  if(!karSnapshot)karSnapshot={};
  karSnapshot[p.nama]={};
  ensureKarSnapshotPeriode(p.nama,karyawanListPeriode(p));
  saveAll();
  renderPeriodes();
  if(PA().id==p.id){renderDash();renderPenggajian();renderPPH();renderLaporan();}
  toast('Snapshot '+p.nama+' berhasil di-rebuild dari Master saat ini');
}
function hapusPeriode(id){if(!confirm('Hapus periode?'))return;periodes=periodes.filter(function(p){return p.id!=id;});saveAll();renderPeriodes();toast('Dihapus');}
function updatePolaPeriode(){var pola=document.getElementById('p-pola').value;if(pola==='25-24'){document.getElementById('p-start').value='2026-02-25';document.getElementById('p-end').value='2026-03-24';document.getElementById('p-bayar').value='2026-03-25';}else if(pola==='21-20'){document.getElementById('p-start').value='2026-02-21';document.getElementById('p-end').value='2026-03-20';document.getElementById('p-bayar').value='2026-03-21';}else if(pola==='1-akhir'){document.getElementById('p-start').value='2026-03-01';document.getElementById('p-end').value='2026-03-31';document.getElementById('p-bayar').value='2026-03-31';}}
function simpanPerusahaan(){perusahaan.nama=document.getElementById('prs-nama').value;perusahaan.npwp=document.getElementById('prs-npwp').value;perusahaan.alamat=document.getElementById('prs-alamat').value;perusahaan.telp=document.getElementById('prs-telp').value;perusahaan.email=document.getElementById('prs-email').value;perusahaan.web=document.getElementById('prs-web').value;perusahaan.a1_kota=(document.getElementById('prs-a1-kota')&&document.getElementById('prs-a1-kota').value)||'';perusahaan.a1_prefix=(document.getElementById('prs-a1-prefix')&&document.getElementById('prs-a1-prefix').value.trim())||'A1';perusahaan.a1_ttd_nama=(document.getElementById('prs-a1-ttd')&&document.getElementById('prs-a1-ttd').value)||'';perusahaan.a1_ttd_jabatan=(document.getElementById('prs-a1-jab')&&document.getElementById('prs-a1-jab').value)||'';var hk=document.querySelector('input[name="hk-radio"]:checked');perusahaan.hariKerja=hk?parseInt(hk.value)||6:6;saveAll();applyBranding();updateHKRadioStyle();renderPenggajian();renderDash();toast('Data perusahaan disimpan');}
function loadPrsForm(){['nama','npwp','alamat','telp','email','web'].forEach(function(f){var e=document.getElementById('prs-'+f);if(e)e.value=perusahaan[f]||'';});var a1k=document.getElementById('prs-a1-kota');if(a1k)a1k.value=perusahaan.a1_kota||'';var a1p=document.getElementById('prs-a1-prefix');if(a1p)a1p.value=perusahaan.a1_prefix!=null?perusahaan.a1_prefix:'A1';var a1t=document.getElementById('prs-a1-ttd');if(a1t)a1t.value=perusahaan.a1_ttd_nama||'';var a1j=document.getElementById('prs-a1-jab');if(a1j)a1j.value=perusahaan.a1_ttd_jabatan||'';var hk=perusahaan.hariKerja||6;var r=document.getElementById('hk-'+hk);if(r)r.checked=true;updateHKRadioStyle();renderPTKPForm();}
function renderPTKPForm(){
  var tb=document.getElementById('tb-ptkp-master');if(!tb)return;
  var t=getPTKPTable();
  var hint={TK0:'Tidak kawin, tanggungan 0',TK1:'Tidak kawin, tanggungan 1',TK2:'Tidak kawin, tanggungan 2',TK3:'Tidak kawin, tanggungan 3',K0:'Kawin, tanggungan 0',K1:'Kawin, tanggungan 1',K2:'Kawin, tanggungan 2',K3:'Kawin, tanggungan 3'};
  tb.innerHTML=PTKP_KEYS.map(function(k){
    return'<tr><td style="font-weight:700;white-space:nowrap">'+PTKP_LBL[k]+'</td><td style="color:#6b7280;font-size:11px">'+hint[k]+'</td>'
      +'<td><input type="number" min="0" step="1000" id="ptkp-val-'+k+'" value="'+Math.round(t[k])+'" style="width:100%;max-width:200px;padding:6px 10px;border:1.5px solid #dde1e9;border-radius:6px;font-size:12px;font-family:inherit"></td></tr>';
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
function updateHKRadioStyle(){var hk=perusahaan.hariKerja||6;var l5=document.getElementById('hk-5-lbl');var l6=document.getElementById('hk-6-lbl');if(l5){l5.style.borderColor=hk===5?'#1a56a0':'#dde1e9';l5.style.background=hk===5?'#e8f0fb':'#fff';}if(l6){l6.style.borderColor=hk===6?'#1a56a0':'#dde1e9';l6.style.background=hk===6?'#e8f0fb':'#fff';}}
document.addEventListener('change',function(e){if(e.target.name==='hk-radio'){perusahaan.hariKerja=parseInt(e.target.value)||6;updateHKRadioStyle();}});
// ── ATURAN POTONGAN ──────────────────────────────
var JENIS_POT=[{key:'cuti_dalam_kuota',lbl:'Cuti (dalam kuota)',ket:'Dalam saldo'},{key:'cuti_luar_kuota',lbl:'Cuti (luar kuota)',ket:'Saldo habis'},{key:'izin',lbl:'Izin 1 hari',ket:'Izin tertulis'},{key:'sakit',lbl:'Sakit 1 hari',ket:'Dengan/tanpa surat'},{key:'setengah_sakit',lbl:'1/2 Sakit',ket:'Hadir 1/2 hari'},{key:'setengah_ijin',lbl:'1/2 Izin',ket:'Hadir 1/2 hari'},{key:'alpha',lbl:'Alpha/Mangkir',ket:'Tanpa keterangan'}];
var MODE_OPTS='<option value="tidak_dipotong">Tidak Dipotong</option><option value="prorata">Pro-Rata (1 hari)</option><option value="prorata_setengah">Pro-Rata (1/2 hari)</option><option value="nominal">Nominal Tetap (Rp)</option><option value="persen">Persentase Harian (%)</option>';
function loadAturanPotongan(){
  var ap=perusahaan.aturan_potongan||{};
  document.getElementById('tb-aturan-pot').innerHTML=JENIS_POT.map(function(j){
    var rule=ap[j.key]||{mode:'prorata',nilai:0};var show=rule.mode==='nominal'||rule.mode==='persen';
    return '<tr><td style="padding:8px 10px;border-bottom:1px solid #f3f4f6;font-weight:700"><span style="background:#e8f0fb;color:#1a56a0;padding:2px 8px;border-radius:5px;font-size:11px">'+j.lbl+'</span></td>'
      +'<td style="padding:8px 10px;border-bottom:1px solid #f3f4f6;font-size:11px;color:#6b7280">'+j.ket+'</td>'
      +'<td style="padding:8px 10px;border-bottom:1px solid #f3f4f6"><select id="ap-mode-'+j.key+'" style="width:100%;padding:5px 8px;border:1.5px solid #dde1e9;border-radius:6px;font-size:11px;font-family:inherit;outline:none" onchange="onApModeChange(\''+j.key+'\')">'+MODE_OPTS+'</select></td>'
      +'<td style="padding:8px 10px;border-bottom:1px solid #f3f4f6"><div style="display:flex;align-items:center;gap:4px"><span id="ap-pfx-'+j.key+'" style="font-size:11px;color:#6b7280">'+(rule.mode==='persen'?'%':rule.mode==='nominal'?'Rp':'')+'</span><input type="number" id="ap-val-'+j.key+'" value="'+(rule.nilai||0)+'" style="width:100%;padding:5px 8px;border:1.5px solid #dde1e9;border-radius:6px;font-size:12px;font-family:inherit;outline:none;display:'+(show?'block':'none')+'"></div></td></tr>';
  }).join('');
  JENIS_POT.forEach(function(j){var sel=document.getElementById('ap-mode-'+j.key);var rule=ap[j.key]||{mode:'prorata'};if(sel)sel.value=rule.mode;});
}
function onApModeChange(key){var mode=document.getElementById('ap-mode-'+key)&&document.getElementById('ap-mode-'+key).value;var el=document.getElementById('ap-val-'+key);var pfx=document.getElementById('ap-pfx-'+key);if(el)el.style.display=(mode==='nominal'||mode==='persen')?'block':'none';if(pfx)pfx.textContent=mode==='persen'?'%':mode==='nominal'?'Rp':'';}
function simpanAturanPotongan(){if(!perusahaan.aturan_potongan)perusahaan.aturan_potongan={};JENIS_POT.forEach(function(j){var mode=(document.getElementById('ap-mode-'+j.key)&&document.getElementById('ap-mode-'+j.key).value)||'prorata';var nilai=parseFloat((document.getElementById('ap-val-'+j.key)&&document.getElementById('ap-val-'+j.key).value))||0;perusahaan.aturan_potongan[j.key]={mode:mode,nilai:nilai};});saveAll();toast('Aturan potongan disimpan');renderPenggajian();}
function resetAturanPotongan(){perusahaan.aturan_potongan={cuti_dalam_kuota:{mode:'tidak_dipotong',nilai:0},cuti_luar_kuota:{mode:'prorata',nilai:0},izin:{mode:'prorata',nilai:0},sakit:{mode:'prorata',nilai:0},setengah_sakit:{mode:'prorata_setengah',nilai:0},setengah_ijin:{mode:'prorata_setengah',nilai:0},alpha:{mode:'prorata',nilai:0}};saveAll();loadAturanPotongan();toast('Reset ke default');}
// ── NOTIFIKASI ───────────────────────────────────
function renderNotif(){document.getElementById('notif-list').innerHTML=notifikasi.length?notifikasi.map(function(n){return '<div style="padding:.75rem 1rem;border-bottom:1px solid #f3f4f6;display:flex;gap:.6rem;align-items:flex-start;'+(n.read?'':'background:#f0f6ff')+'"><div style="width:7px;height:7px;border-radius:50%;background:'+(n.read?'#d1d5db':'#1a56a0')+';margin-top:4px;flex-shrink:0"></div><div style="flex:1"><div style="font-size:12px;font-weight:700">'+n.title+'</div><div style="font-size:11px;color:#6b7280">'+n.body+'</div></div><button class="btn btn-sm btn-r" onclick="hapusNotif('+n.id+')" style="font-size:10px;padding:2px 7px">&#10007;</button></div>';}).join(''):'<div style="text-align:center;color:#6b7280;padding:1.5rem">Belum ada notifikasi</div>';}
function hapusNotif(id){notifikasi=notifikasi.filter(function(n){return n.id!==id;});saveAll();renderNotif();updateNotifBadge();}
function hapusNotifSemua(){if(!confirm('Hapus semua?'))return;notifikasi=[];saveAll();renderNotif();updateNotifBadge();toast('Dihapus');}
function markAllRead(){notifikasi.forEach(function(n){n.read=true;});saveAll();renderNotif();updateNotifBadge();}
function updateNotifBadge(){var u=notifikasi.filter(function(n){return !n.read;}).length;var d=document.getElementById('ndot');if(d)d.className=u>0?'ndot on':'ndot';var b=document.getElementById('nc-badge');if(b){b.style.display=u>0?'inline':'none';b.textContent=u;}}
// ── MY CUTI ──────────────────────────────────────
function renderMyCuti(){
  if(!CU||!CU.nik)return;var k=karyawan.find(function(x){return x.nik===CU.nik;});if(!k)return;
  var yr=new Date().getFullYear();
  var kuota=masterCuti.kuota||12;
  var manual=cutiManual(k.nik,yr);var cb=countCutiBersama(yr);var total=manual+cb;
  var sisa=kuota-total;
  var sisaCol=sisa<=0?'#9b2121':sisa<=3?'#7d4800':'#2d6a0a';
  var cutiDays=Object.entries(absensi[k.nik]||{}).filter(function(e){return e[1]==='cuti'&&e[0].startsWith(String(yr));}).sort();
  document.getElementById('my-cuti-content').innerHTML='<div class="card" style="background:#ede9fe;border-color:#c4b5fd"><div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:.5rem"><div><strong style="font-size:14px;color:#5b21b6">Saldo Cuti '+yr+' - '+k.nama+'</strong></div><div class="fl gap2"><div style="text-align:center"><div style="font-size:22px;font-weight:800;color:#5b21b6">'+kuota+'</div><div style="font-size:10px;color:#6b7280">Kuota</div></div><div style="text-align:center"><div style="font-size:22px;font-weight:800;color:#7d4800">'+manual+'</div><div style="font-size:10px;color:#6b7280">Cuti Manual</div></div>'+(cb>0?'<div style="text-align:center"><div style="font-size:22px;font-weight:800;color:#5b21b6">'+cb+'</div><div style="font-size:10px;color:#6b7280">Cuti Bersama</div></div>':'')+'<div style="text-align:center"><div style="font-size:22px;font-weight:800;color:'+sisaCol+'">'+sisa+'</div><div style="font-size:10px;color:#6b7280">Sisa</div></div></div></div></div><div class="card"><div class="ct">Riwayat Cuti '+yr+'</div>'+(cutiDays.length?'<table><thead><tr><th>Tanggal</th><th>Status</th></tr></thead><tbody>'+cutiDays.map(function(e){return '<tr><td>'+e[0]+'</td><td><span class="bdg b-pu">Cuti</span></td></tr>';}).join('')+'</tbody></table>':'<div style="color:#6b7280;font-size:12px">Belum ada cuti.</div>')+'</div>';
}
// ── SELECTS & BACKUP ─────────────────────────────
function populateSelects(){
  var sc=document.getElementById('slip-kar');
  if(!sc)return;
  var pid=document.getElementById('slip-per')&&document.getElementById('slip-per').value;
  var p=periodes.find(function(x){return x.id==pid;})||PA();
  var list=karyawan.filter(function(k){return karyawanInPeriode(k,p);});
  var opts=list.map(function(k){return '<option value="'+k.nik+'">'+k.nama+'</option>';}).join('');
  sc.innerHTML='<option value="">-- Pilih Karyawan --</option>'+opts;
  // Jika pilihan sebelumnya sudah tidak valid utk periode ini, kosongkan agar tidak "nyangkut"
  if(sc.value&&!list.find(function(k){return k.nik===sc.value;}))sc.value='';
}
function renderPeriodeSelects(){var aktif=PA().id;var opts=periodes.map(function(p){return '<option value="'+p.id+'">'+p.nama+'</option>';}).join('');['slip-per','my-period'].forEach(function(id){var el=document.getElementById(id);if(!el)return;el.innerHTML=opts;el.value=aktif;});}
var DATA_KEYS=['karyawan','periodes','hariLibur','masterCuti','absensi','lembur','prorata','approvals','notifikasi','perusahaan','users','roles','thrManual','tunjVarBulan','tunjVarLabels','tunjVarColumns','karSnapshot','auditLog'];
var DATA_LABELS={karyawan:'Karyawan',periodes:'Periode',hariLibur:'Hari Libur',masterCuti:'Setting Cuti',absensi:'Absensi',lembur:'Lembur',prorata:'Pro-Rata',approvals:'Approval',notifikasi:'Notifikasi',perusahaan:'Perusahaan',users:'Users',roles:'Roles',thrManual:'THR Manual',tunjVarBulan:'Tunjangan variabel per periode',tunjVarLabels:'Label kolom tunj. variabel',tunjVarColumns:'Definisi kolom tunj. variabel',karSnapshot:'Snapshot karyawan per periode',auditLog:'Audit trail payroll'};
/** Salinan dalam memori agar backup identik dengan data tersimpan & tidak ada field yang terpotong */
function sigajiDeepClone(o){try{if(o===undefined)return undefined;return JSON.parse(JSON.stringify(o));}catch(e){console.warn('sigajiDeepClone',e);return o;}}
function buildExportData(){
  saveAll();
  var snapPeriods=Object.keys(karSnapshot||{});
  var snapRows=snapPeriods.reduce(function(s,pn){return s+Object.keys((karSnapshot&&karSnapshot[pn])||{}).length;},0);
  var meta={
    versi:'SiGaji v9',
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
function simpanRiwayatBackup(meta){try{var r=JSON.parse(localStorage.getItem('sigaji_backup_riwayat')||'[]');r.unshift(Object.assign({},meta,{tanggalDisplay:new Date().toLocaleString('id-ID')}));r=r.slice(0,3);localStorage.setItem('sigaji_backup_riwayat',JSON.stringify(r));}catch(e){}}
function renderBackupRiwayat(){try{var r=JSON.parse(localStorage.getItem('sigaji_backup_riwayat')||'[]');var el=document.getElementById('backup-riwayat');if(!el)return;el.innerHTML=r.length?r.map(function(x,i){return '<div style="display:flex;justify-content:space-between;align-items:center;padding:8px 12px;border-radius:7px;border:1px solid var(--bd);margin-bottom:.35rem;font-size:12px;'+(i===0?'background:#e8f4de;border-color:#b3d98f':'')+'"><div><div style="font-weight:700">'+(x.tanggalDisplay||x.tanggal)+'</div><div style="font-size:10px;color:#6b7280">'+(x.versi||'SiGaji')+' - '+(x.totalKaryawan||'?')+' karyawan'+(x.catatan?' - "'+x.catatan+'"':'')+'</div></div>'+(i===0?'<span class="bdg b-ok">Terakhir</span>':'')+'</div>';}).join(''):'<div style="font-size:12px;color:#6b7280;padding:.5rem">Belum ada.</div>';}catch(e){}}
function renderAuditLog(){
  var wrap=document.getElementById('audit-log');
  var sel=document.getElementById('audit-periode');
  if(!wrap||!sel)return;
  var q=(document.getElementById('audit-q')&&document.getElementById('audit-q').value||'').toLowerCase();
  // isi opsi periode
  var perList=['(Semua)'].concat((periodes||[]).map(function(p){return p.nama;}).sort());
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
  if(!list.length){wrap.innerHTML='<div style="padding:12px;color:#6b7280;font-size:12px">Belum ada audit log.</div>';return;}
  wrap.innerHTML=list.map(function(e){
    var t=String(e.ts||'').replace('T',' ').replace('Z','');
    return '<div style="padding:10px 12px;border-bottom:1px solid #f3f4f6;font-size:12px">'
      +'<div style="display:flex;justify-content:space-between;gap:8px;flex-wrap:wrap">'
      +'<div><strong>'+escapeHtml(e.action||'-')+'</strong> <span style="color:#6b7280">('+escapeHtml(e.periode||'')+')</span></div>'
      +'<div style="color:#6b7280;font-size:11px">'+escapeHtml(t)+'</div>'
      +'</div>'
      +'<div style="margin-top:4px;color:#374151"><span class="bdg b-info" style="margin-right:6px">'+escapeHtml(e.nik||'-')+'</span>'
      +'<span style="color:#6b7280">oleh</span> <strong>'+escapeHtml(e.by||'-')+'</strong> <span style="color:#6b7280">('+escapeHtml(e.role||'')+')</span></div>'
      +'<div style="margin-top:4px;color:#6b7280;font-size:11px">'+escapeHtml(e.detail||'')+'</div>'
      +'</div>';
  }).join('');
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
  el.innerHTML=
    '<div style="display:flex;flex-wrap:wrap;gap:8px;margin-bottom:8px">'
    +'<span class="bdg b-info">Periode: '+totalPer+'</span>'
    +'<span class="bdg '+(pct===100?'b-ok':'b-warn')+'">Progress: '+pct+'%</span>'
    +'<span class="bdg b-pu">Snapshot rows: '+totalRows+'</span>'
    +'<span class="bdg b-teal">Expected rows: '+totalExpected+'</span>'
    +'</div>'
    +'<div style="font-size:11px;color:#6b7280">Periode lengkap: '+aktifPer+'/'+totalPer+'. Periode dianggap lengkap jika seluruh karyawan aktif di periode tersebut punya snapshot payroll.</div>';
}
var importData=null;
function readImportFile(input){var f=input.files[0];if(!f)return;var r=new FileReader();r.onload=function(e){try{var data=JSON.parse(e.target.result);importData=data;var meta=data._meta||{};var el=document.getElementById('import-info');if(el)el.innerHTML='<strong>File:</strong> '+(meta.versi||'SiGaji')+' - '+((data.karyawan||[]).length)+' karyawan'+(meta.snapshotPeriodeCount!=null?' | snapshot '+meta.snapshotPeriodeCount+' periode / '+(meta.snapshotRowCount||0)+' baris':'');var cl=document.getElementById('import-checklist');if(cl)cl.innerHTML=DATA_KEYS.map(function(k){var ada=data[k]!==undefined;return '<label style="display:flex;align-items:center;gap:.4rem;font-size:12px;cursor:'+(ada?'pointer':'default')+';opacity:'+(ada?1:.4)+'"><input type="checkbox" id="imp-'+k+'" '+(ada?'checked':'')+' '+(ada?'':'disabled')+' style="accent-color:#1a56a0"> '+(DATA_LABELS[k]||k)+'</label>';}).join('');document.getElementById('import-preview').style.display='block';toast('File dibaca');}catch(err){toast('Gagal baca file: '+err.message);}};r.readAsText(f);}
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
      if(k==='karyawan'){var ex=karyawan.map(function(x){return x.nik;});var baru=val.filter(function(x){return !ex.includes(x.nik);});var upd=val.filter(function(x){return ex.includes(x.nik);});upd.forEach(function(nk){var i=karyawan.findIndex(function(x){return x.nik===nk.nik;});if(i>=0)karyawan[i]=Object.assign({},karyawan[i],nk);});karyawan.push.apply(karyawan,baru);}
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
function exportCSVAll(){var rows=[['NIK','Nama','Dept','Jabatan','Gaji Pokok','Gross PPh','THR','TH Bruto','BPJS Kar','PPh 21','Neto','PTKP','Status','Tgl Masuk']];karyawan.forEach(function(k){var g=hitungGaji(k);rows.push([k.nik,k.nama,k.dept,k.jabatan,k.gapok,Math.round(g.grossPPh),Math.round(g.thrBruto),Math.round(g.brutoTH),Math.round(g.bpjs.kes_kar+g.bpjs.jht_kar+g.bpjs.jp_kar),g.pph,Math.round(g.neto),k.ptkp,k.status,k.masuk]);});var csv=rows.map(function(r){return r.map(function(v){return '"'+String(v).replace(/"/g,'""')+'"';}).join(',');}).join('\n');var b=new Blob(['\uFEFF'+csv],{type:'text/csv'});var a=document.createElement('a');a.href=URL.createObjectURL(b);a.download='SiGaji_v9_'+new Date().toISOString().split('T')[0]+'.csv';a.click();toast('CSV diunduh');}
// ── NAVIGASI ─────────────────────────────────────
function showPg(pg){
  if(!canAccess(pg)){toast('Tidak punya akses ke modul ini');return;}
  document.querySelectorAll('.pg').forEach(function(p){p.classList.remove('active');});
  document.querySelectorAll('.ni').forEach(function(n){n.classList.remove('active');});
  var el=document.getElementById('pg-'+pg);if(el)el.classList.add('active');
  document.querySelectorAll('.ni').forEach(function(n){if(n.dataset.pg===pg)n.classList.add('active');});
  if(pg==='notifikasi'){notifikasi.forEach(function(n){n.read=true;});saveAll();renderNotif();updateNotifBadge();}
  if(pg==='absensi')setTimeout(function(){applyAbsensiSubtabVisibility();renderAbsensi();},50);
  if(pg==='slip')setTimeout(function(){renderPeriodeSelects();populateSelects();onSlipPeriodeChange();},50);
  if(pg==='master'){renderPeriodes();renderHariLibur();renderCutiRekap();loadPrsForm();applyBranding();initLibnasYearSelect();applyMasterSubtabVisibility();}
  if(pg==='thr')renderTHR();
  if(pg==='mycuti')renderMyCuti();
  if(pg==='myslip')loadMySlip();
  if(pg==='pph')renderPPH();
  if(pg==='laporan')renderLaporan();
  if(pg==='backup'){renderBackupRiwayat();renderMigrationStatus();renderAuditLog();}
  if(pg==='users'){renderUsers();renderPermMatrix();}
  if(pg==='approval')applyApprovalSubtabVisibility();
  if(pg==='pesangon')try{if(typeof renderPesangon==='function')renderPesangon();}catch(e){console.error('renderPesangon',e);toast('Modul Pesangon error — cek konsol (F12).');}
  if(pg==='penggajian'){
    var t0=document.querySelector('#pg-penggajian .tab[data-pgtab="proses"]');
    if(t0)switchPenggajianTab(t0,'pg-gaji-proses');
    setTimeout(function(){renderPenggajian();},0);
  }
}
function applyMasterSubtabVisibility(){
  var tabs=document.querySelectorAll('#pg-master .tabs .tab');
  var first=null;
  tabs.forEach(function(t){
    var sub=t.dataset.mstab;if(!sub)return;
    var ok=canAccessSubTab('master',sub);
    t.style.display=ok?'':'none';
    if(ok&&!first)first=t;
  });
  ['m-prs','m-periode','m-libur','m-potongan','m-ter'].forEach(function(id){var d=document.getElementById(id);if(d)d.style.display='none';});
  if(first&&first.dataset.panel)switchTab(first,first.dataset.panel);
  else toast('Tidak ada sub-tab Master Perusahaan yang diizinkan untuk role ini.');
}
function applyApprovalSubtabVisibility(){
  var tabs=document.querySelectorAll('#pg-approval .tabs .tab');
  var first=null;
  tabs.forEach(function(t){
    var sub=t.dataset.aptab;if(!sub)return;
    var ok=canAccessSubTab('approval',sub);
    t.style.display=ok?'':'none';
    if(ok&&!first)first=t;
  });
  ['ap-pend','ap-hist'].forEach(function(id){var d=document.getElementById(id);if(d)d.style.display='none';});
  if(first&&first.dataset.panel)switchTab(first,first.dataset.panel);
  else toast('Tidak ada sub-tab Approval yang diizinkan untuk role ini.');
}
function applyAbsensiSubtabVisibility(){
  var tabs=document.querySelectorAll('#pg-absensi .tabs .tab');
  var first=null;
  tabs.forEach(function(t){
    var sub=t.dataset.abtab;if(!sub)return;
    var ok=canAccessSubTab('absensi',sub);
    t.style.display=ok?'':'none';
    if(ok&&!first)first=t;
  });
  ['abt-kalender','abt-cuti','abt-lembur'].forEach(function(id){var d=document.getElementById(id);if(d)d.style.display='none';});
  if(first&&first.dataset.abpanel)switchAbTab(first,first.dataset.abpanel);
  else toast('Tidak ada sub-tab Absensi yang diizinkan untuk role ini.');
}
function switchTab(el,tid){
  var masterSubs={'m-prs':'prs','m-periode':'periode','m-libur':'libur','m-potongan':'potongan','m-ter':'ter'};
  var apprSubs={'ap-pend':'pend','ap-hist':'hist'};
  if(masterSubs[tid]&&!canAccessSubTab('master',masterSubs[tid])){toast('Tidak punya akses ke tab ini');return;}
  if(apprSubs[tid]&&!canAccessSubTab('approval',apprSubs[tid])){toast('Tidak punya akses ke tab ini');return;}
  el.parentElement.querySelectorAll('.tab').forEach(function(t){t.classList.remove('active');});el.classList.add('active');['m-prs','m-periode','m-libur','m-potongan','m-ter','ap-pend','ap-hist'].forEach(function(id){var d=document.getElementById(id);if(d)d.style.display=id===tid?'block':'none';});
  if(tid==='m-potongan')loadAturanPotongan();
  if(tid==='m-ter'){renderPTKPForm();renderTERTable();}
  if(tid==='m-libur'){initLibnasYearSelect();renderHariLibur();renderCutiRekap();}
}
function switchAbTab(el,tid){
  var abSubs={'abt-kalender':'kalender','abt-cuti':'cuti','abt-lembur':'lembur'};
  if(abSubs[tid]&&!canAccessSubTab('absensi',abSubs[tid])){toast('Tidak punya akses ke tab ini');return;}
  el.parentElement.querySelectorAll('.tab').forEach(function(t){t.classList.remove('active');});el.classList.add('active');['abt-kalender','abt-cuti','abt-lembur'].forEach(function(id){var d=document.getElementById(id);if(d)d.style.display=id===tid?'block':'none';});if(tid==='abt-cuti')renderCutiRekap();if(tid==='abt-lembur'){var ls=document.getElementById('lembur-kar-sel');if(ls)ls.innerHTML=karyawan.map(function(k){return'<option value="'+k.nik+'">'+k.nama+'</option>';}).join('');renderLemburList();}}
function switchSpTab(el,tid){
  // Cek sub-tab permission
  const tabMap={'sp-info':'info','sp-gaji':'gaji','sp-bpjs':'bpjs','sp-natura':'natura','sp-pphret':'pphret','sp-ring':'ring'};
  const subId=tabMap[tid];
  if(subId&&!canAccessSubTab('karyawan',subId)){toast('Tidak punya akses ke tab ini');return;}
  document.querySelectorAll('.spt').forEach(function(t){t.classList.remove('active');});
  el.classList.add('active');
  ['sp-info','sp-gaji','sp-bpjs','sp-natura','sp-pphret','sp-ring'].forEach(function(id){var d=document.getElementById(id);if(d)d.style.display=id===tid?'block':'none';});
  if(tid==='sp-ring')updateGajiSummary();
  if(tid==='sp-bpjs'){var k=getPayrollTargetByNik(cpNik,true);if(k)loadBPJSPanel(k);}
  if(tid==='sp-gaji'){var k2=getPayrollTargetByNik(cpNik,true);if(k2){renderTunjPanel(k2);renderPotPanel(k2);}}
  if(tid==='sp-natura'){var k3=getPayrollTargetByNik(cpNik,true);if(k3)renderNaturaPanel(k3);}
  if(tid==='sp-pphret'){var k4=getPayrollTargetByNik(cpNik,true);if(k4)renderPPhRetPanel(k4);}
}
function openModal(id){document.getElementById(id).classList.add('show');}
function closeModal(id){document.getElementById(id).classList.remove('show');}
var tT;function toast(msg){var t=document.getElementById('toast9');if(!t){try{console.warn(msg);}catch(e){}return;}t.textContent=msg;t.classList.add('show');clearTimeout(tT);tT=setTimeout(function(){t.classList.remove('show');},3200);}
function execReset(){
  karyawan=[];periodes=[];hariLibur=[];masterCuti={kuota:12,carryover:'no',cbPotong:true};absensi={};lembur={};prorata={};approvals=[];notifikasi=[];
  perusahaan={nama:'',npwp:'',alamat:'',telp:'',email:'',web:'',logo:'',hariKerja:6,aturan_potongan:{cuti_dalam_kuota:{mode:'tidak_dipotong',nilai:0},cuti_luar_kuota:{mode:'prorata',nilai:0},izin:{mode:'prorata',nilai:0},sakit:{mode:'prorata',nilai:0},setengah_sakit:{mode:'prorata_setengah',nilai:0},setengah_ijin:{mode:'prorata_setengah',nilai:0},alpha:{mode:'prorata',nilai:0}}};
  users=[{username:'admin',password:'admin123',role:'Admin',nama:'Administrator',nik:null,aktif:true},{username:'hrd',password:'hrd123',role:'HRD',nama:'Budi HR',nik:null,aktif:true},{username:'karyawan',password:'kar123',role:'Karyawan',nama:'Sari Dewi',nik:null,aktif:true}];
  roles={Admin:MODULES.map(function(m){return m.id;}),HRD:['dashboard','notifikasi','karyawan.info','karyawan.bpjs','karyawan.ring','absensi.kalender','absensi.cuti','absensi.lembur','master.prs','master.periode','master.libur','master.potongan','master.ter','approval.pend','approval.hist','thr','pesangon','penggajian','slip','pph','laporan'],Karyawan:['myslip','mycuti','notifikasi']};
  thrManual={};tunjVarBulan={};tunjVarLabels={v1:'Bonus',v2:'Uang Makan',v3:'Lain-lain'};tunjVarColumns=[{id:'v1',nama:'Bonus'},{id:'v2',nama:'Uang Makan'},{id:'v3',nama:'Lain-lain'}];localStorage.removeItem(DB_KEY);localStorage.removeItem('sigaji_universal');saveAll();closeModal('m-reset');renderSidebar();renderAll();updateNotifBadge();applyBranding();
  document.getElementById('reset-inp').value='';document.getElementById('btn-reset').disabled=true;toast('Reset selesai');
}
// ── LIBUR NASIONAL DATABASE ──────────────────────
function getLiburNasionalTahun(yr){
  var tetap=[{tgl:yr+'-01-01',nama:'Tahun Baru Masehi',tipe:'nasional'},{tgl:yr+'-05-01',nama:'Hari Buruh Internasional',tipe:'nasional'},{tgl:yr+'-06-01',nama:'Hari Lahir Pancasila',tipe:'nasional'},{tgl:yr+'-08-17',nama:'HUT RI ke-'+(yr-1945),tipe:'nasional'},{tgl:yr+'-12-25',nama:'Hari Natal',tipe:'nasional'}];
  var variabel={
    2025:[{tgl:'2025-01-27',nama:'Isra Mikraj 1446 H',tipe:'nasional'},{tgl:'2025-01-29',nama:'Tahun Baru Imlek 2576',tipe:'nasional'},{tgl:'2025-03-29',nama:'Hari Raya Nyepi 1947',tipe:'nasional'},{tgl:'2025-03-28',nama:'Cuti Bersama Idul Fitri',tipe:'cuti-bersama'},{tgl:'2025-03-31',nama:'Idul Fitri 1446 H (1)',tipe:'nasional'},{tgl:'2025-04-01',nama:'Idul Fitri 1446 H (2)',tipe:'nasional'},{tgl:'2025-04-02',nama:'Cuti Bersama Idul Fitri',tipe:'cuti-bersama'},{tgl:'2025-04-03',nama:'Cuti Bersama Idul Fitri',tipe:'cuti-bersama'},{tgl:'2025-04-04',nama:'Cuti Bersama Idul Fitri',tipe:'cuti-bersama'},{tgl:'2025-04-18',nama:'Wafat Isa Almasih',tipe:'nasional'},{tgl:'2025-05-12',nama:'Hari Raya Waisak',tipe:'nasional'},{tgl:'2025-05-29',nama:'Kenaikan Isa Almasih',tipe:'nasional'},{tgl:'2025-06-07',nama:'Idul Adha 1446 H',tipe:'nasional'},{tgl:'2025-06-27',nama:'Tahun Baru Islam 1447 H',tipe:'nasional'},{tgl:'2025-09-05',nama:'Maulid Nabi 1447 H',tipe:'nasional'},{tgl:'2025-12-26',nama:'Cuti Bersama Natal',tipe:'cuti-bersama'}],
    2026:[{tgl:'2026-01-17',nama:'Isra Mikraj 1447 H',tipe:'nasional'},{tgl:'2026-01-29',nama:'Tahun Baru Imlek 2577',tipe:'nasional'},{tgl:'2026-03-11',nama:'Hari Raya Nyepi 1948',tipe:'nasional'},{tgl:'2026-03-17',nama:'Cuti Bersama Idul Fitri',tipe:'cuti-bersama'},{tgl:'2026-03-18',nama:'Cuti Bersama Idul Fitri',tipe:'cuti-bersama'},{tgl:'2026-03-19',nama:'Cuti Bersama Idul Fitri',tipe:'cuti-bersama'},{tgl:'2026-03-20',nama:'Idul Fitri 1447 H (1)',tipe:'nasional'},{tgl:'2026-03-21',nama:'Idul Fitri 1447 H (2)',tipe:'nasional'},{tgl:'2026-03-23',nama:'Cuti Bersama Idul Fitri',tipe:'cuti-bersama'},{tgl:'2026-03-24',nama:'Cuti Bersama Idul Fitri',tipe:'cuti-bersama'},{tgl:'2026-04-02',nama:'Wafat Isa Almasih',tipe:'nasional'},{tgl:'2026-05-14',nama:'Kenaikan Isa Almasih',tipe:'nasional'},{tgl:'2026-05-23',nama:'Hari Raya Waisak',tipe:'nasional'},{tgl:'2026-05-27',nama:'Idul Adha 1447 H',tipe:'nasional'},{tgl:'2026-07-16',nama:'Tahun Baru Islam 1448 H',tipe:'nasional'},{tgl:'2026-09-25',nama:'Maulid Nabi 1448 H',tipe:'nasional'},{tgl:'2026-12-26',nama:'Cuti Bersama Natal',tipe:'cuti-bersama'}],
    2027:[{tgl:'2027-01-06',nama:'Isra Mikraj 1448 H',tipe:'nasional'},{tgl:'2027-02-17',nama:'Tahun Baru Imlek 2578',tipe:'nasional'},{tgl:'2027-03-01',nama:'Hari Raya Nyepi 1949',tipe:'nasional'},{tgl:'2027-03-10',nama:'Idul Fitri 1448 H (1)',tipe:'nasional'},{tgl:'2027-03-11',nama:'Idul Fitri 1448 H (2)',tipe:'nasional'},{tgl:'2027-03-08',nama:'Cuti Bersama Idul Fitri',tipe:'cuti-bersama'},{tgl:'2027-03-09',nama:'Cuti Bersama Idul Fitri',tipe:'cuti-bersama'},{tgl:'2027-03-12',nama:'Cuti Bersama Idul Fitri',tipe:'cuti-bersama'},{tgl:'2027-03-26',nama:'Wafat Isa Almasih',tipe:'nasional'},{tgl:'2027-05-03',nama:'Kenaikan Isa Almasih',tipe:'nasional'},{tgl:'2027-05-10',nama:'Hari Raya Waisak',tipe:'nasional'},{tgl:'2027-05-17',nama:'Idul Adha 1448 H',tipe:'nasional'},{tgl:'2027-07-06',nama:'Tahun Baru Islam 1449 H',tipe:'nasional'},{tgl:'2027-09-14',nama:'Maulid Nabi 1449 H',tipe:'nasional'},{tgl:'2027-12-27',nama:'Cuti Bersama Natal',tipe:'cuti-bersama'}]
  };
  var varTahun=variabel[yr]||[];
  var semua=tetap.concat(varTahun);
  var seen={};
  return semua.filter(function(l){if(seen[l.tgl])return false;seen[l.tgl]=true;return true;}).sort(function(a,b){return a.tgl.localeCompare(b.tgl);});
}

// ── TER TABLE DISPLAY & EDIT ──────────────────────────
function getTERDisplayData(lbl,tbl){
  return tbl.map(function(r,i){
    const prev=i===0?0:tbl[i-1][0];
    const max=r[0]===Infinity?'~tak terbatas':r[0].toLocaleString('id-ID');
    const from=prev===0?'0':prev.toLocaleString('id-ID');
    const rate=(r[1]*100).toFixed(2);
    return{from:from,to:max,rate:rate,idx:i,lbl:lbl};
  });
}
function renderTERTable(){
  const custom=perusahaan.ter_custom||{};
  const TER_TABLES={A:TER_A,B:TER_B,C:TER_C};
  const ids={A:'ter-a-table',B:'ter-b-table',C:'ter-c-table'};
  Object.entries(TER_TABLES).forEach(function(e){
    const lmp=e[0];const tbl=e[1];const elId=ids[lmp];
    const el=document.getElementById(elId);if(!el)return;
    const rows=getTERDisplayData(lmp,tbl);
    el.innerHTML='<table style="font-size:11px;width:100%"><thead><tr><th>Bruto dari</th><th>s.d.</th><th>TER (%)</th></tr></thead><tbody>'+
      rows.map(function(r){
        const customRate=(custom[lmp]||{})[r.idx];
        const displayRate=customRate!==undefined?(customRate*100).toFixed(2):r.rate;
        return'<tr><td style="color:#6b7280">'+r.from+'</td><td style="color:#6b7280">'+r.to+'</td>'+
          '<td><input type="number" step="0.01" min="0" max="100" value="'+displayRate+'" '+
          'data-lmp="'+lmp+'" data-idx="'+r.idx+'" '+
          'style="width:70px;padding:2px 5px;border:1px solid #dde1e9;border-radius:4px;font-size:11px;font-family:inherit;text-align:right" '+
          'onchange="onTERCellChange(this)">%</td></tr>';
      }).join('')+
    '</tbody></table>';
  });
}
function onTERCellChange(el){
  if(!perusahaan.ter_custom)perusahaan.ter_custom={};
  const lmp=el.dataset.lmp;const idx=parseInt(el.dataset.idx);
  if(!perusahaan.ter_custom[lmp])perusahaan.ter_custom[lmp]={};
  perusahaan.ter_custom[lmp][idx]=parseFloat(el.value)/100;
}
function saveTERCustom(){saveAll();toast('Tabel TER disimpan');renderTERTable();}
function resetTERCustom(){
  if(!confirm('Reset tabel TER ke nilai default PMK 168/2023?'))return;
  perusahaan.ter_custom={};saveAll();renderTERTable();toast('TER direset ke default PMK 168/2023');
}

// ── INIT ─────────────────────────────────────────
setInterval(function(){try{var d=buildExportData();localStorage.setItem('sigaji_autobackup',JSON.stringify(Object.assign({},d,{_meta:Object.assign({},d._meta,{catatan:'Auto backup'})})));}catch(e){}},30*60*1000);
initLibnasYearSelect();
if(typeof document!=='undefined'){
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',initRememberUsername);
  else initRememberUsername();
}
if(typeof window!=='undefined'){
  try{window.addEventListener('load',initRememberUsername);}catch(e){}
}
