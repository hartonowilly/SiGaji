/**
 * Tes logika kuota cuti penyilang tahun (tanpa browser).
 * Jalankan: node tests/cuti-tracking.test.mjs
 */
function toIsoDate(v){
  if(v==null||v==='')return'';
  var t=String(v).trim();
  if(t.length>=10)t=t.substring(0,10);
  if(/^\d{2}\/\d{2}\/\d{4}$/.test(t)){
    var p=t.split('/');
    return p[2]+'-'+p[1]+'-'+p[0];
  }
  if(/^\d{4}\/\d{2}\/\d{2}$/.test(t)){
    var p2=t.split('/');
    return p2[0]+'-'+p2[1]+'-'+p2[2];
  }
  if(/^\d{2}-\d{2}-\d{4}$/.test(t)){
    var p3=t.split('-');
    return p3[2]+'-'+p3[1]+'-'+p3[0];
  }
  if(/^\d{2}\.\d{2}\.\d{4}$/.test(t)){
    var p4=t.split('.');
    return p4[2]+'-'+p4[1]+'-'+p4[0];
  }
  if(/^\d{4}-\d{2}-\d{2}$/.test(t))return t;
  var d=new Date(t);
  if(isNaN(d.getTime()))return'';
  return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
}

function countCutiBersama(yr,hariLibur,masterCuti){
  if(!masterCuti.cbPotong)return 0;
  const y=String(yr);
  return hariLibur.filter(function(l){
    if(l.tipe!=='cuti-bersama')return false;
    const t=toIsoDate(l.tgl);
    if(!t||!t.startsWith(y))return false;
    return t!=='Sat'&&t!=='Sun';
  }).length;
}

function countCutiBersamaUntukTahunDanPeriode(yr,periode,hariLibur,masterCuti){
  var n=countCutiBersama(yr,hariLibur,masterCuti);
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
    return true;
  }).length;
  return n+extra;
}

function getCrossYearTailRanges(yr,periodes){
  const y=String(yr);
  const yearStart=y+'-01-01';
  const prevDay=(function(){
    const d=new Date(yearStart+'T12:00:00');
    d.setDate(d.getDate()-1);
    return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
  })();
  const tails=[];
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
function cutiManualTrackingYear(nik,yr,absensi,hariLibur,masterCuti,periodes){
  const y=String(yr);
  let n=cutiManual(nik,yr,absensi,hariLibur,masterCuti);
  const tails=getCrossYearTailRanges(yr,periodes);
  const ab=absensi[nik]||{};
  for(const raw of Object.keys(ab)){
    if(ab[raw]!=='cuti')continue;
    const d=toIsoDate(raw);
    if(!d||d>=y+'-01-01')continue;
    if(isCutiBersamaPotongKuotaTgl(d,hariLibur,masterCuti))continue;
    for(const r of tails){
      if(d>=r.start&&d<=r.end){n++;break;}
    }
  }
  return n;
}
function countCutiBersamaTrackingYear(yr,hariLibur,masterCuti,periodes){
  let n=countCutiBersama(yr,hariLibur,masterCuti);
  const tails=getCrossYearTailRanges(yr,periodes);
  if(!tails.length||!masterCuti.cbPotong)return n;
  const y=String(yr);
  const extra=hariLibur.filter(function(l){
    if(l.tipe!=='cuti-bersama')return false;
    const d=toIsoDate(l.tgl);
    if(!d||d>=y+'-01-01')return false;
    return tails.some(function(r){return d>=r.start&&d<=r.end;});
  }).length;
  return n+extra;
}

function isCutiBersamaPotongKuotaTgl(tglIso,hariLibur,masterCuti){
  if(!tglIso||!masterCuti.cbPotong)return false;
  var d=toIsoDate(tglIso);
  if(!d)return false;
  var l=hariLibur.find(function(x){return toIsoDate(x.tgl)===d&&x.tipe==='cuti-bersama';});
  return !!l;
}

function cutiManual(nik,yr,absensi,hariLibur,masterCuti){
  const pfx=String(yr);
  return Object.entries(absensi[nik]||{}).filter(function(ent){
    var dn=toIsoDate(ent[0]);
    return dn.startsWith(pfx)&&ent[1]==='cuti'&&!isCutiBersamaPotongKuotaTgl(dn,hariLibur,masterCuti);
  }).length;
}

function cutiManualUntukTahunDanPeriode(nik,tahun,periode,absensi,hariLibur,masterCuti){
  const y=String(tahun);
  let n=cutiManual(nik,y,absensi,hariLibur,masterCuti);
  if(!periode||!periode.start||!periode.end)return n;
  const s=toIsoDate(periode.start),e=toIsoDate(periode.end);
  if(!s||!e||!(e>=y+'-01-01'&&s<=y+'-12-31'))return n;
  const ab=absensi[nik]||{};
  for(const raw of Object.keys(ab)){
    if(ab[raw]!=='cuti')continue;
    const d=toIsoDate(raw);
    if(!d)continue;
    if(isCutiBersamaPotongKuotaTgl(d,hariLibur,masterCuti))continue;
    if(d<s||d>e)continue;
    if(d.startsWith(y))continue;
    if(d<y+'-01-01')n++;
  }
  return n;
}

function assert(name,cond){
  if(!cond)throw new Error('FAIL: '+name);
  console.log('OK: '+name);
}

const masterCuti={cbPotong:true,kuota:12};
const absensi={
  A:{ '29-12-2025':'cuti','30-12-2025':'cuti','31-12-2025':'cuti','2026-01-10':'cuti' },
  B:{ '2025-12-29T00:00:00.000Z':'cuti' },
};
const periodes=[{id:1,nama:'Jan 2026',start:'29/12/2025',end:'27/01/2026'}];
const hariLiburCb=[
  {tgl:'2025-12-29',tipe:'cuti-bersama',nama:'CB'},
  {tgl:'2025-12-30',tipe:'cuti-bersama',nama:'CB2'},
  {tgl:'2025-12-31',tipe:'cuti-bersama',nama:'CB3'},
];

// Tracking year: 3 hari Des 2025 ikut ke tahun 2026 jika ada periode silang tahun
let m=cutiManualTrackingYear('A',2026,absensi,[],masterCuti,periodes);
assert('A manual tanpa CB libur = 4',m===4);

// A dengan kunci ISO panjang
m=cutiManualTrackingYear('B',2026,absensi,[],masterCuti,periodes);
assert('B normalisasi kunci ISO = 1 hari Des',m===1);

// Cuti bersama Des: absensi cuti tidak masuk manual, harus masuk lewat count CB tail
m=cutiManualTrackingYear('A',2026,absensi,hariLiburCb,masterCuti,periodes);
assert('A manual dengan CB Des (absensi C diabaikan di manual)',m===1);

var cb=countCutiBersamaTrackingYear(2026,hariLiburCb,masterCuti,periodes);
assert('CB tail: 3 hari cuti-bersama Des dalam periode',cb===3);

var total=m+cb;
assert('Total terpakai A (1 manual Jan + 3 CB Des)=4',total===4);

var cbPeriode=countCutiBersamaUntukTahunDanPeriode(2026,periodes[0],hariLiburCb,masterCuti);
assert('CB helper per periode (Des dalam rentang)',cbPeriode===3);

var cmPeriode=cutiManualUntukTahunDanPeriode('A',2026,periodes[0],absensi,hariLiburCb,masterCuti);
assert('Cuti manual helper per periode',cmPeriode===1);

console.log('\nSemua tes lulus.');
