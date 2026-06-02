/* SiGaji — inti: helper, snapshot, hitung gaji, BPJS, THR calc */
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
/** Nilai <select> periode selalu string; id di memori (JSON) bisa number — jangan pakai === mentah. */
function periodesFindById(id){
  if(id==null||id==='')return null;
  var s=String(id).trim();
  return (periodes||[]).find(function(x){return String(x.id).trim()===s;})||null;
}
/** Urut kronologis Jan→Des menurut tanggal mulai periode (untuk dropdown). */
function periodesSortedByStart(list){
  return (list||periodes||[]).slice().sort(function(a,b){
    var ak=typeof toIsoDate==='function'?toIsoDate(a.start):String(a.start||'');
    var bk=typeof toIsoDate==='function'?toIsoDate(b.start):String(b.start||'');
    if(ak&&bk&&ak!==bk)return ak.localeCompare(bk);
    return String(a.nama||'').localeCompare(String(b.nama||''),'id');
  });
}
const isHL=d=>hariLibur.some(l=>l.tgl===d);
const namaHL=d=>{const l=hariLibur.find(x=>x.tgl===d);return l?l.nama:'';};
function isHariLiburKerja(dow){const hk=perusahaan.hariKerja||6;return hk===5?(dow===0||dow===6):(dow===0);}
const ini=n=>(n||'?').split(' ').map(w=>w[0]).join('').substring(0,2).toUpperCase();
/** Normalisasi ke YYYY-MM-DD untuk bandingkan kunci absensi / periode (hindari gagal karena sufiks T/Z). */
function toIsoDate(v){
  if(v==null||v==='')return'';
  var t=String(v).trim();
  if(t.length>=10)t=t.substring(0,10);
  // dd/mm/yyyy (sering dari copy-paste / input manual)
  if(/^\d{2}\/\d{2}\/\d{4}$/.test(t)){
    var p=t.split('/');
    return p[2]+'-'+p[1]+'-'+p[0];
  }
  // yyyy/mm/dd
  if(/^\d{4}\/\d{2}\/\d{2}$/.test(t)){
    var p2=t.split('/');
    return p2[0]+'-'+p2[1]+'-'+p2[2];
  }
  // dd-mm-yyyy
  if(/^\d{2}-\d{2}-\d{4}$/.test(t)){
    var p3=t.split('-');
    return p3[2]+'-'+p3[1]+'-'+p3[0];
  }
  // dd.mm.yyyy
  if(/^\d{2}\.\d{2}\.\d{4}$/.test(t)){
    var p4=t.split('.');
    return p4[2]+'-'+p4[1]+'-'+p4[0];
  }
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
/** Ambil daftar rentang tanggal "ekor tahun lalu" yang termasuk dalam periode gaji yang menyilang tahun `yr`. */
function getCrossYearTailRanges(yr){
  const y=String(yr);
  const yearStart=y+'-01-01';
  const tails=[];
  // Hitung "tanggal sebelum 1 Jan" dengan aman pakai Date
  const prevDay=(function(){
    const d=new Date(yearStart+'T12:00:00');
    d.setDate(d.getDate()-1);
    return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
  })();
  (periodes||[]).forEach(function(p){
    const s=toIsoDate(p&&p.start),e=toIsoDate(p&&p.end);
    if(!s||!e)return;
    if(!(s<yearStart&&e>=yearStart))return;
    const tailStart=s;
    const tailEnd=e<yearStart?e:prevDay;
    if(tailStart<=tailEnd)tails.push({start:tailStart,end:tailEnd});
  });
  return tails;
}
/** Manual cuti untuk Tracking tahun `yr`: cuti di tahun `yr` + cuti di "ekor tahun lalu" yang masuk periode gaji silang tahun `yr`. */
function cutiManualTrackingYear(nik,yr){
  const y=String(yr);
  let n=cutiManual(nik,yr);
  const tails=getCrossYearTailRanges(yr);
  if(!tails.length)return n;
  const ab=absensi[nik]||{};
  for(const raw of Object.keys(ab)){
    if(ab[raw]!=='cuti')continue;
    const d=toIsoDate(raw);
    if(!d||d>=y+'-01-01')continue;
    if(isCutiBersamaPotongKuotaTgl(d))continue;
    for(const r of tails){
      if(d>=r.start&&d<=r.end){n++;break;}
    }
  }
  return n;
}
/** Cuti bersama untuk Tracking tahun `yr`: CB tahun `yr` + CB di ekor tahun lalu yang masuk periode silang tahun `yr`. */
function countCutiBersamaTrackingYear(yr){
  let n=countCutiBersama(yr);
  const tails=getCrossYearTailRanges(yr);
  if(!tails.length||!masterCuti.cbPotong)return n;
  const y=String(yr);
  const extra=hariLibur.filter(function(l){
    if(l.tipe!=='cuti-bersama')return false;
    const d=toIsoDate(l.tgl);
    if(!d||d>=y+'-01-01')return false;
    if(isHariLiburKerja(new Date(d+'T12:00:00').getDay()))return false;
    return tails.some(function(r){return d>=r.start&&d<=r.end;});
  }).length;
  return n+extra;
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

/** Saldo migrasi payroll manual (bruto PPh + PPh terpotong) per tahun — field k.pph_ytd_awal[tahun]. */
function getPphYtdAwal(k,thn){
  const aw=k&&k.pph_ytd_awal;
  if(!aw||typeof aw!=='object')return{bruto:0,pph:0,sd_bulan:0};
  const slot=aw[String(thn)];
  if(!slot||typeof slot!=='object')return{bruto:0,pph:0,sd_bulan:0};
  return{
    bruto:Math.round(slot.bruto||0),
    pph:Math.round(slot.pph||0),
    sd_bulan:Math.min(12,Math.max(0,parseInt(slot.sd_bulan,10)||0))
  };
}
function setPphYtdAwal(k,thn,bruto,pph,sdBulan){
  if(!k)return;
  if(!k.pph_ytd_awal||typeof k.pph_ytd_awal!=='object')k.pph_ytd_awal={};
  const key=String(thn);
  const b=Math.round(bruto||0),p=Math.round(pph||0);
  if(b<=0&&p<=0&&!sdBulan){delete k.pph_ytd_awal[key];if(!Object.keys(k.pph_ytd_awal).length)delete k.pph_ytd_awal;return;}
  k.pph_ytd_awal[key]={bruto:b,pph:p,sd_bulan:sdBulan?Math.min(12,Math.max(1,parseInt(sdBulan,10)||0)):undefined};
}
// Hitung total bruto karyawan dari saldo migrasi + periodes sebelumnya dalam tahun yg sama
function getBrutoYTD(k,pNama){
  const p=periodes.find(x=>x.nama===pNama)||PA();
  const thn=new Date(p.bayar||p.end||p.start).getFullYear();
  const saldo=getPphYtdAwal(k,thn);
  let totalBruto=saldo.bruto,totalPPh=saldo.pph;
  periodes.forEach(function(per){
    const perThn=new Date(per.bayar||per.end||per.start).getFullYear();
    if(perThn!==thn||per.nama===pNama)return;
    // Hanya hitung periode sebelum periode ini (urut bayar)
    if((per.bayar||'')>=(p.bayar||''))return;
    const g=hitungGaji(k,per.nama);
    totalBruto+=g.grossPPh;
    totalPPh+=g.pph;
  });
  return{totalBruto,totalPPh,thn,saldoAwal:saldo};
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
function sortKaryawanByNik(list){
  return list.slice().sort(function(a,b){
    return String(a.nik||'').localeCompare(String(b.nik||''),'id',{numeric:true,sensitivity:'base'});
  });
}
/** NIK baru per tipe: Kxxxx (tetap) atau NTxxxx (tidak tetap). */
function nextNikOtomatis(tipe){
  if(typeof sigajiNextNik==='function')return sigajiNextNik(tipe||'tetap');
  return 'K0001';
}
function karyawanListPeriode(p){
  return sortKaryawanByNik(karyawan.filter(function(k){return karyawanInPeriode(k,p);}));
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

function syncPphReturnFieldState(){
  var p=PA();
  var ro=isPayrollSnapshotMode()&&p&&isPeriodeLocked(p.nama);
  var rv=document.getElementById('sp-pphret-val');
  var rk=document.getElementById('sp-pphret-ket');
  if(rv)rv.readOnly=!!ro;
  if(rk)rk.readOnly=!!ro;
  var hint=document.getElementById('sp-pphret-mode-hint');
  if(hint){
    if(isPayrollSnapshotMode()){
      hint.innerHTML='Mengedit <strong>snapshot '+escapeHtml(p&&p.nama?p.nama:'-')+'</strong>. Nilai ini hanya untuk periode aktif.';
    }else{
      hint.innerHTML='Mode <strong>Master global</strong>: kosongkan jika masih ada sisa nilai lama. Periode baru <em>tidak</em> menyalin PPh Return dari master.';
    }
    hint.style.display='block';
  }
}
function onPPhRetChange(){
  if(!cpNik)return;
  if(!guardPayrollEditUnlocked())return;
  var vEl=document.getElementById('sp-pphret-val');
  var kEl=document.getElementById('sp-pphret-ket');
  var val=parseFloat((vEl&&vEl.value)||'')||0;
  if(val<0)val=0;
  var ket=(kEl&&kEl.value)||'';
  var k;
  if(isPayrollSnapshotMode()){
    k=getPayrollTargetByNik(cpNik,true,'periode');
  }else{
    k=karyawan.find(function(x){return x.nik===cpNik;});
  }
  if(!k)return;
  var before=(k.pph_return&&k.pph_return.nilai)||0;
  k.pph_return={nilai:val,ket:ket};
  logPayrollAudit(cpNik,'Update PPh Return',(isPayrollSnapshotMode()?'snapshot':'master')+` ${before} → ${val} | ${ket}`);
  saveAll();
  renderPPhRetPanel(k);
  updateGajiSummary();
}
function clearPphReturnPanel(){
  if(!cpNik)return;
  if(!guardPayrollEditUnlocked())return;
  var vEl=document.getElementById('sp-pphret-val');
  var kEl=document.getElementById('sp-pphret-ket');
  if(vEl)vEl.value='0';
  if(kEl)kEl.value='';
  onPPhRetChange();
  toast('PPh Return dikosongkan');
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
    pph_return:{nilai:0,ket:''},
  };
}
/** Snapshot periode baru: salin dari periode sebelumnya jika ada (tunjangan/gapok tidak kembali ke master global). */
function snapshotKarForPeriodeEntry(k,pNama){
  var prev=prevPeriodeChrono(pNama);
  var prevSnap=prev&&karSnapshot&&karSnapshot[prev]&&karSnapshot[prev][k.nik];
  if(prevSnap){
    return{
      gapok:prevSnap.gapok!==undefined?Math.round(prevSnap.gapok):Math.round(k.gapok||0),
      tunjangan:deepCloneLite(prevSnap.tunjangan||[]),
      potongan:deepCloneLite(prevSnap.potongan||[]),
      natura:deepCloneLite(prevSnap.natura||[]),
      bpjs_aktif:deepCloneLite(prevSnap.bpjs_aktif||k.bpjs_aktif||{}),
      bpjs_manual:deepCloneLite(prevSnap.bpjs_manual||{}),
      pph_return:deepCloneLite(prevSnap.pph_return||{nilai:0,ket:''}),
    };
  }
  return snapshotKarFromMaster(k);
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
      karSnapshot[pNama][k.nik]=snapshotKarForPeriodeEntry(k,pNama);
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
/** Sinkronkan snapshot periode dari master (semua karyawan di periode). */
function refreshKarSnapshotFromMaster(pNama,list){
  if(!pNama||isPeriodeLocked(pNama))return false;
  var p=getPeriodeByNama(pNama)||PA();
  var arr=list||karyawanListPeriode(p);
  arr.forEach(function(k){if(k&&k.nik)upsertKarSnapshotForPeriode(k.nik,pNama);});
  saveAll();
  return true;
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
    karSnapshot[p.nama][nik]=snapshotKarForPeriodeEntry(k,p.nama);
  }
  const tgt=karSnapshot[p.nama][nik];
  if(tgt.potongan===undefined)tgt.potongan=deepCloneLite(k.potongan||[]);
  if(tgt.tunjangan===undefined)tgt.tunjangan=deepCloneLite(k.tunjangan||[]);
  if(tgt.natura===undefined)tgt.natura=deepCloneLite(k.natura||[]);
  if(tgt.bpjs_aktif===undefined)tgt.bpjs_aktif=deepCloneLite(k.bpjs_aktif||{});
  if(tgt.bpjs_manual===undefined)tgt.bpjs_manual=deepCloneLite(k.bpjs_manual||{});
  if(tgt.pph_return===undefined)tgt.pph_return={nilai:0,ket:''};
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
  var hint=document.getElementById('kg-sp-saved-lbl');
  if(hint){
    hint.textContent=spPayrollView==='periode'
      ?'Mode Snapshot: nominal payroll yang diedit hanya berlaku untuk periode aktif.'
      :'Mode Master: kelola struktur/jenis komponen; nominal payroll dikelola di Snapshot Periode.';
  }
  if(!cpNik)return;
  var src=getPayrollTargetByNik(cpNik,true,spPayrollView);
  if(!src)return;
  syncGapokRpInput(document.getElementById('sp-gapok-f'),src.gapok||0);
  var gap=document.getElementById('sp-gapok-f');if(gap)gap.readOnly=!isPayrollSnapshotMode();
  syncPphRetRpInput(document.getElementById('sp-pphret-val'),(src.pph_return&&src.pph_return.nilai)||0);
  var rk=document.getElementById('sp-pphret-ket');if(rk)rk.value=(src.pph_return&&src.pph_return.ket)||'';
  syncPphReturnFieldState();
  if(document.getElementById('sp-gaji').style.display!=='none'){renderTunjPanel(src);renderPotPanel(src);}
  if(document.getElementById('sp-bpjs').style.display!=='none')loadBPJSPanel(src);
  if(document.getElementById('sp-natura').style.display!=='none')renderNaturaPanel(src);
  if(document.getElementById('sp-pphret').style.display!=='none')renderPPhRetPanel(src);
  bindPayrollRpInputs();
  updateGajiSummary();
}
function syncGapokRpInput(el,val){
  if(!el)return;
  el.value=typeof formatRpInputNum==='function'?formatRpInputNum(val||0):String(val||0);
  delete el.dataset.rpBound;
  delete el.dataset.rpEditing;
}
function syncPphRetRpInput(el,val){
  if(!el)return;
  el.value=typeof formatRpInputNum==='function'?formatRpInputNum(val||0):String(val||0);
  delete el.dataset.rpBound;
  delete el.dataset.rpEditing;
}
function bindPayrollRpInputs(){
  var root=document.getElementById('slide-panel-payroll');
  if(root&&typeof sigajiBindRpInputs==='function')sigajiBindRpInputs(root);
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
  const alasan=(k.phk&&k.phk.alasan)?String(k.phk.alasan):'';
  const hasPhkAlasan=!!alasan.trim();
  const isResign=alasan.indexOf('resign')===0;
  let phkCtx=null;
  if(tglStopIso&&isStopInPeriode&&hasPhkAlasan&&typeof hitungPesangon==='function'){
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
  const isBpjsFullMonth=!!(tglStopIso&&isStopInPeriode&&hasPhkAlasan);
  const gapokBpjs=isBpjsFullMonth?Math.round(k.gapok||0):gapokEff;
  const tunjBpjs=isBpjsFullMonth?0:tBPJS;
  const bpjs=calcBPJS(k,gapokBpjs,tunjBpjs);
  // BPJS Perusahaan (JKK+JKM+Kes) = natura kena pajak per PMK 168/2023
  const bpjsPrsNatKP=bpjs.jkk_prs+bpjs.jkm_prs+bpjs.kes_prs;
  const grossPPhRegular=gapokEff+tGross+natKP+lb+bpjsPrsNatKP;
  const grossPPh=grossPPhRegular+thrBruto; // PPh dihitung termasuk THR
  const brutoTH=gapokEff+tTH+natNKP+lb;   // Take Home TIDAK termasuk THR
  // Deteksi masa pajak terakhir per karyawan:
  // - Desember: rekonsiliasi tahunan seluruh karyawan aktif di periode itu
  // - Resign/PHK: otomatis di periode yang memuat tgl. berhenti (asal alasan PHK sudah diisi)
  const isMasaPajakTerakhir=
    p.tipe_periode==='desember'||
    (!!tglStopIso&&isStopInPeriode&&hasPhkAlasan);
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
      saldoAwalBruto:ytd.saldoAwal?ytd.saldoAwal.bruto:0,
      saldoAwalPph:ytd.saldoAwal?ytd.saldoAwal.pph:0,
      saldoSdBulan:ytd.saldoAwal?ytd.saldoAwal.sd_bulan:0,
      brutoDariPeriode:Math.max(0,ytd.totalBruto-(ytd.saldoAwal?ytd.saldoAwal.bruto:0)),
      pphDariPeriode:Math.max(0,ytd.totalPPh-(ytd.saldoAwal?ytd.saldoAwal.pph:0)),
      brutoTahunan,pphTahunan,
      pphBulanIni:selisih,
      lebihBayar:selisih<0?Math.abs(selisih):0,
      kurangBayar:selisih>0?selisih:0,
      opsiLebihBayar:p.opsi_lebih_bayar||'refund', // 'refund' | 'carryover'
      isPajakTerakhir:true,
      tipePeriode:tipeLabel,
      reason:isStopReason?'stop_in_period':(p.tipe_periode==='desember'?'desember':'other'),
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
