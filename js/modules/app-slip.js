/* SiGaji — slip, kirim, PDF */
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
  h+='<div class="pph-calc-sec"><div class="pph-calc-tit">PPh 21'+(g.reconciliation?' — Rekonsiliasi Masa Pajak Terakhir':' - PMK 168/2023 Metode TER')+'</div>';
  h+='<div class="cr"><span>Penghasilan Bruto bulan ini</span><span>'+fmt(g.grossPPh)+'</span></div>';
  if(g.reconciliation){
    const r=g.reconciliation;
    if(r.saldoAwalBruto>0||r.saldoAwalPph>0){
      h+='<div class="cr" style="color:#1a56a0"><span>Saldo migrasi'+(r.saldoSdBulan?' (s/d bln '+r.saldoSdBulan+')':'')+'</span><span>'+fmt(r.saldoAwalBruto)+' / PPh '+fmt(r.saldoAwalPph)+'</span></div>';
    }
    h+='<div class="cr"><span>Bruto YTD (kumulatif sebelum bulan ini)</span><span>'+fmt(r.brutoYTD)+'</span></div>';
    h+='<div class="cr bold"><span>Total Bruto Setahun</span><span>'+fmt(r.brutoTahunan)+'</span></div>';
    h+='<div class="cr"><span>PPh Tahunan (Progresif)</span><span>'+fmt(r.pphTahunan)+'</span></div>';
    h+='<div class="cr"><span>PPh sudah dipotong YTD</span><span>- '+fmt(r.pphYTD)+'</span></div>';
    h+='<div class="cr result"><span><strong>PPh 21 bulan ini</strong> (selisih rekonsiliasi)</span><span><strong>'+fmt(g.pph)+'</strong></span></div>';
  }else{
    h+='<div class="cr result"><span>TER '+k.ptkp+': '+(rate*100).toFixed(2)+'% × '+fmt(g.grossPPh)+' = <strong>PPh 21 bulan ini</strong></span><span><strong>'+fmt(g.pph)+'</strong></span></div>';
  }
  h+='</div>';
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
function isSlipKirimTabActive(){
  var k=document.getElementById('slip-tab-kirim');
  return !!(k&&k.style.display!=='none');
}
function switchSlipTab(el,panelId){
  if(el&&el.parentElement){
    el.parentElement.querySelectorAll('.tab').forEach(function(t){t.classList.remove('active');});
    el.classList.add('active');
  }
  var gaji=document.getElementById('slip-tab-gaji');
  var kirim=document.getElementById('slip-tab-kirim');
  if(gaji)gaji.style.display=panelId==='slip-tab-gaji'?'block':'none';
  if(kirim)kirim.style.display=panelId==='slip-tab-kirim'?'block':'none';
  if(panelId==='slip-tab-kirim')renderSlipSendBatchChecklist();
  previewSlip();
}
function onSlipPeriodeChange(){
  const pid=document.getElementById('slip-per')&&document.getElementById('slip-per').value;
  const p=periodesFindById(pid)||PA();
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
  renderSlipSendBatchChecklist();
  previewSlip();
}
function previewSlip(){
  renderSlipSendBatchChecklist();
  const nik=document.getElementById('slip-kar')&&document.getElementById('slip-kar').value;
  var sbEarly=document.getElementById('slip-share-bar');
  if(!nik){
    if(sbEarly)sbEarly.style.display='none';
    return;
  }
  const pid=document.getElementById('slip-per')&&document.getElementById('slip-per').value;
  const p=periodesFindById(pid)||PA();
  const k=karyawan.find(function(x){return x.nik===nik;});
  if(!k)return;
  const type=(document.getElementById('slip-type')&&document.getElementById('slip-type').value)||'gaji';
  document.getElementById('slip-preview').innerHTML=(type==='thr'&&p.thr_aktif)?makeSlipTHR(k,p):makeSlip(k,p.nama);
  var sb=document.getElementById('slip-share-bar');
  var nikSel=document.getElementById('slip-kar')&&document.getElementById('slip-kar').value;
  if(sb)sb.style.display=(isSlipKirimTabActive()&&nikSel)?'block':'none';
}

// ── SHARE / KIRIM SLIP ────────────────────────────
function getSlipContext(){
  var nik=document.getElementById('slip-kar')&&document.getElementById('slip-kar').value;
  if(!nik)return null;
  var pid=document.getElementById('slip-per')&&document.getElementById('slip-per').value;
  var p=periodesFindById(pid)||PA();
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
  /** Satu blok TER = PPh (satu baris angka kanan; teks kiri dipotong baris agar tidak menabrak nominal). */
  function rowTerPphCombined(){
    chk();
    doc.setFont(undefined,'bold');
    doc.setFontSize(8);
    doc.setTextColor(0,0,0);
    var rhs=fmt(g.pph);
    var lbl='TER '+k.ptkp+': '+(rate*100).toFixed(2)+'% × '+fmt(g.grossPPh)+' = PPh 21 bulan ini';
    var rhsW=doc.getTextWidth(rhs);
    var maxW=Math.max(40,pw-28-rhsW-6);
    var lines=doc.splitTextToSize(lbl,maxW);
    var y0=y;
    var lineH=4;
    lines.forEach(function(ln){
      doc.text(ln,14,y);
      y+=lineH;
    });
    var blockH=lines.length*lineH;
    var rY=y0+Math.max(0,blockH/2-2);
    doc.text(rhs,pw-14,rY,{align:'right'});
    if(y<y0+5)y=y0+5;
    doc.setFont(undefined,'normal');
    doc.setFontSize(8.5);
  }

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

  sec('PPh 21'+(g.reconciliation?' — Rekonsiliasi Masa Pajak Terakhir':' - PMK 168/2023 Metode TER'));
  rowL('Penghasilan Bruto bulan ini',fmt(g.grossPPh));
  if(g.reconciliation){
    var r=g.reconciliation;
    if(r.saldoAwalBruto>0||r.saldoAwalPph>0){
      rowL('Saldo migrasi'+(r.saldoSdBulan?' s/d bln '+r.saldoSdBulan:''),fmt(r.saldoAwalBruto)+' (PPh '+fmt(r.saldoAwalPph)+')');
    }
    rowL('Bruto YTD (kumulatif sebelum bulan ini)',fmt(r.brutoYTD));
    rowL('Total Bruto Setahun',fmt(r.brutoTahunan),true);
    rowL('PPh Tahunan (Progresif)',fmt(r.pphTahunan));
    rowM('PPh sudah dipotong YTD',r.pphYTD);
    rowL('PPh 21 bulan ini (selisih rekonsiliasi)',fmt(g.pph),true);
  }else{
    rowTerPphCombined();
  }
  y+=1;

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
  var thr=hitungTHRBruto(k,p.nama);if(!thr.eligible)throw new Error('Belum eligible THR');
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
  var p=periodesFindById(pid)||PA();
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
  const p=periodesFindById(pid)||PA();
  if(k)document.getElementById('my-slip-content').innerHTML=makeSlip(k,p.nama);
}
function exportPDF(){
  const nik=document.getElementById('slip-kar')&&document.getElementById('slip-kar').value;
  const k=nik?karyawan.find(function(x){return x.nik===nik;}):null;
  if(!k){toast('Pilih karyawan');return;}
  const pid=document.getElementById('slip-per')&&document.getElementById('slip-per').value;
  const p=periodesFindById(pid)||PA();
  const type=(document.getElementById('slip-type')&&document.getElementById('slip-type').value)||'gaji';
  if(type==='thr'&&p.thr_aktif)generateTHRPDF(k,p);else generatePDF(k,p.nama,p.bayar);
}
function exportPDFMe(){
  if(!CU||!CU.nik)return;
  const k=karyawan.find(function(x){return x.nik===CU.nik;});
  const pid=document.getElementById('my-period')&&document.getElementById('my-period').value;
  const p=periodesFindById(pid)||PA();
  if(k)generatePDF(k,p.nama,p.bayar);
}
function exportAllTHRPDF(){
  const pid=document.getElementById('slip-per')&&document.getElementById('slip-per').value;
  const p=periodesFindById(pid)||PA();
  if(!p.thr_aktif){toast('Periode ini tidak ada THR');return;}
  sortKaryawanByNik(karyawan||[]).forEach(function(k){if(hitungTHRBruto(k).eligible)generateTHRPDF(k,p);});
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
