/* SiGaji — PPh 21, laporan, THR */
// ── PPH & LAPORAN ────────────────────────────────
function renderPPH(){
  if(typeof sigajiWithSkeleton==='function'){
    return sigajiWithSkeleton('tb-pph',10,renderPPHBody);
  }
  renderPPHBody();
}
function renderPPHBody(){
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
    selK.innerHTML='<option value="">-- Pilih karyawan --</option>'+sortKaryawanByNik(karyawan||[]).map(function(k){return '<option value="'+k.nik+'">'+k.nik+' — '+k.nama+'</option>';}).join('');
    if(prev&&karyawan.some(function(k){return k.nik===prev;}))selK.value=prev;
  }
}
function sortPeriodesByStart(list,desc){
  return (list||[]).slice().sort(function(a,b){
    var ta=new Date(String((a&&a.start)||'1970-01-01')+'T12:00:00').getTime();
    var tb=new Date(String((b&&b.start)||'1970-01-01')+'T12:00:00').getTime();
    if(isNaN(ta))ta=0;if(isNaN(tb))tb=0;
    return desc?tb-ta:ta-tb;
  });
}
function renderLaporan(){
  if(typeof sigajiWithSkeleton==='function'){
    return sigajiWithSkeleton('tb-lap',7,renderLaporanBody);
  }
  renderLaporanBody();
}
function renderLaporanBody(){
  var sorted=sortPeriodesByStart(periodes,false);
  var hint=document.getElementById('lap-rekap-hint');
  if(hint){
    hint.innerHTML='<strong>Cara baca tabel</strong> — baris diurutkan <em>kronologis</em> (Jan → Des) menurut tanggal mulai periode. '
      +'<strong>Proses</strong> = periode gaji <em>aktif</em> (masih berjalan; angka estimasi dari data sekarang). '
      +'<strong>Selesai</strong> = periode sudah <em>tutup</em> di Master → Periode Gaji. '
      +'Total gross/PPh/neto = jumlah hitungGaji semua karyawan periode itu (bukan transfer bank yang sudah cair).';
  }
  document.getElementById('tb-lap').innerHTML=sorted.map(function(p){
    let tB=0,tP=0,tN=0,tT=0;
    var list=karyawanListPeriode(p);
    list.forEach(function(k){const g=hitungGaji(k,p.nama);tB+=g.grossPPh;tP+=g.pph;tN+=g.neto;tT+=g.thrBruto;});
    var rentang=(p.start&&p.end)?('<div style="font-size:10px;color:#9ca3af;font-weight:400">'+fmtDate(p.start)+' – '+fmtDate(p.end)+'</div>'):'';
    var stLbl=p.status==='aktif'?'Proses':'Selesai';
    var stTip=p.status==='aktif'
      ?'Periode aktif — estimasi, bisa berubah sebelum tutup periode'
      :'Periode tutup — rekap arsip periode tersebut';
    return '<tr '+(p.status==='aktif'?'style="background:#e8f4de"':'')+'>'
      +'<td><strong>'+escapeHtml(p.nama)+'</strong>'+(p.thr_aktif?' <span class="bdg b-pu">THR</span>':'')+rentang+'</td>'
      +'<td>'+list.length+'</td><td>'+fmt(tB)+'</td><td>'+(tT>0?fmt(tT):'&#8212;')+'</td>'
      +'<td>'+fmt(tP)+'</td><td>'+fmt(tN)+'</td>'
      +'<td><span class="bdg '+(p.status==='aktif'?'b-warn':'b-ok')+'" title="'+escapeHtml(stTip)+'">'+stLbl+'</span></td></tr>';
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
/** Periode gaji yang memuat tanggal berhenti karyawan */
function findPeriodeForTglBerhenti(k){
  var t=String((k&&k.tgl_berhenti)||'').trim();
  if(!t)return null;
  var found=null;
  periodes.forEach(function(p){
    var cutoff=periodeTglCutoffPhk(p);
    if(p.start&&cutoff&&t>=String(p.start)&&t<=String(cutoff))found=p;
  });
  return found;
}
/** Periode dalam tahun pajak yang sama, Jan s.d. bulan berhenti (urut tgl bayar) */
function getPeriodesResignTahun(k){
  var stopP=findPeriodeForTglBerhenti(k);
  if(!stopP)return [];
  var thn=new Date(stopP.bayar||stopP.end||stopP.start).getFullYear();
  var bayarStop=String(stopP.bayar||'');
  return periodes.filter(function(p){
    var pThn=new Date(p.bayar||p.end||p.start).getFullYear();
    if(pThn!==thn)return false;
    return String(p.bayar||'')<=bayarStop;
  }).sort(function(a,b){return String(a.bayar||'').localeCompare(String(b.bayar||''));});
}
function karyawanEligibleRekonResign(){
  return sortKaryawanByNik(karyawan.filter(function(k){
    var t=String(k.tgl_berhenti||'').trim();
    var a=(k.phk&&k.phk.alasan)?String(k.phk.alasan).trim():'';
    return t&&a&&findPeriodeForTglBerhenti(k);
  }));
}
function phkAlasanLbl(k){
  var id=(k.phk&&k.phk.alasan)||'';
  if(typeof phkOpt==='function'){var o=phkOpt(id);if(o&&o.lbl)return o.lbl;}
  return id||'-';
}
function xlsxSheetNameSafe(s){
  return String(s||'Sheet').replace(/[\\/*?:\[\]]/g,' ').trim().substring(0,31)||'Sheet';
}
/** Excel: rekonsiliasi PPh resign/PHK — per karyawan, Jan s.d. bulan berhenti */
function exportExcelRekonResign(){
  var list=karyawanEligibleRekonResign();
  if(!list.length){toast('Tidak ada karyawan dengan tgl. berhenti + alasan PHK/resign');return;}
  ensureXLSX(function(){
    try{
      var pt=(perusahaan.nama||'PERUSAHAAN');
      var wb=XLSX.utils.book_new();
      var exportThn=new Date().getFullYear();
      list.forEach(function(k){
        var pers=getPeriodesResignTahun(k);
        if(!pers.length)return;
        var stopP=findPeriodeForTglBerhenti(k);
        var thn=new Date(stopP.bayar||stopP.end||stopP.start).getFullYear();
        exportThn=thn;
        var rows=[];
        rows.push(['REKONSILIASI PPh 21 — MASA PAJAK TERAKHIR (RESIGN/PHK)']);
        rows.push(['Perusahaan: '+pt]);
        rows.push(['Karyawan: '+(k.nama||'-')+' | NIK: '+k.nik+' | PTKP: '+(k.ptkp||'-')+' | NPWP: '+(k.npwp||'-')]);
        rows.push(['Tgl. berhenti: '+fmtDate(k.tgl_berhenti)+' | Alasan: '+phkAlasanLbl(k)]);
        rows.push(['Tahun pajak: '+thn+' | Periode terakhir: '+(stopP.nama||'-')+' | Bayar: '+fmtDate(stopP.bayar||'-')]);
        rows.push(['Dicetak: '+new Date().toISOString().split('T')[0]]);
        rows.push([]);
        rows.push(['No','Periode','Tgl mulai','Tgl selesai','Tgl bayar','Bruto PPh 21','Metode PPh','PPh dipotong','Bruto kumulatif','PPh kumulatif','Lebih bayar','Kurang bayar']);
        var cumB=0,cumP=0,lastG=null;
        pers.forEach(function(p,i){
          var g=hitungGaji(k,p.nama);
          lastG=g;
          cumB+=g.grossPPh||0;
          cumP+=g.pph||0;
          var metode=g.reconciliation?'Rekonsiliasi progresif':'TER (PMK 168)';
          var lb=g.reconciliation&&g.reconciliation.lebihBayar>0?Math.round(g.reconciliation.lebihBayar):'';
          var kb=g.reconciliation&&g.reconciliation.kurangBayar>0?Math.round(g.reconciliation.kurangBayar):'';
          rows.push([
            i+1,p.nama||'',p.start||'',p.end||'',p.bayar||'',
            Math.round(g.grossPPh||0),metode,Math.round(g.pph||0),
            Math.round(cumB),Math.round(cumP),lb,kb
          ]);
        });
        rows.push([]);
        if(lastG&&lastG.reconciliation){
          var r=lastG.reconciliation;
          rows.push(['RINGKASAN REKONSILIASI (bulan terakhir: '+(stopP.nama||'-')+')']);
          if(r.saldoAwalBruto>0||r.saldoAwalPph>0){
            rows.push(['Saldo migrasi (payroll manual)',Math.round(r.saldoAwalBruto)]);
            rows.push(['PPh saldo migrasi',Math.round(r.saldoAwalPph)]);
            if(r.saldoSdBulan)rows.push(['Saldo s/d bulan',r.saldoSdBulan]);
          }
          rows.push(['Total bruto YTD (kumulatif sebelum bulan terakhir)',Math.round(r.brutoYTD)]);
          rows.push(['Bruto bulan terakhir',Math.round(lastG.grossPPh)]);
          rows.push(['Total bruto setahun',Math.round(r.brutoTahunan)]);
          rows.push(['PPh tahunan (progresif Pasal 17)',Math.round(r.pphTahunan)]);
          rows.push(['PPh sudah dipotong (Jan s.d. bulan sebelum terakhir)',Math.round(r.pphYTD)]);
          rows.push(['PPh bulan terakhir (selisih rekonsiliasi)',Math.round(lastG.pph)]);
          rows.push(['Lebih bayar PPh',r.lebihBayar>0?Math.round(r.lebihBayar):0]);
          rows.push(['Kurang bayar PPh',r.kurangBayar>0?Math.round(r.kurangBayar):0]);
        }else{
          rows.push(['Catatan: Bulan terakhir belum terdeteksi rekonsiliasi — pastikan alasan PHK/resign sudah diisi.']);
        }
        if(lastG&&lastG.phk){
          rows.push([]);
          rows.push(['PEMBAYARAN PHK / PESANGON (bulan terakhir)']);
          (lastG.phk.items||[]).forEach(function(it){
            rows.push([it.nama,Math.round(it.nilai||0)]);
          });
          if(lastG.phk.mode==='phk'){
            rows.push(['Total bruto pesangon',Math.round(lastG.phk.bruto||0)]);
            rows.push(['PPh 21 Final pesangon (PP 68/2009)',Math.round(lastG.phk.pphFinal||0)]);
            rows.push(['Netto pesangon diterima',Math.round((lastG.phk.bruto||0)-(lastG.phk.pphFinal||0))]);
          }else{
            rows.push(['Mode resign: UPH (jika ada) sudah masuk bruto PPh gaji di atas; UP/UPMK tidak.']);
          }
        }
        var ws=XLSX.utils.aoa_to_sheet(rows);
        var ncol=12;
        ws['!merges']=[
          {s:{r:0,c:0},e:{r:0,c:ncol-1}},
          {s:{r:1,c:0},e:{r:1,c:ncol-1}},
          {s:{r:2,c:0},e:{r:2,c:ncol-1}},
          {s:{r:3,c:0},e:{r:3,c:ncol-1}},
          {s:{r:4,c:0},e:{r:4,c:ncol-1}},
          {s:{r:5,c:0},e:{r:5,c:ncol-1}}
        ];
        ws['!cols']=[{wch:4},{wch:18},{wch:12},{wch:12},{wch:12},{wch:16},{wch:22},{wch:14},{wch:16},{wch:14},{wch:14},{wch:14}];
        var firstDataRow=7;
        var lastDataRow=firstDataRow+pers.length-1;
        for(var c=5;c<=11;c++)xlsxSetNumFmtRange(ws,c,firstDataRow,lastDataRow,'#,##0');
        XLSX.utils.book_append_sheet(wb,ws,xlsxSheetNameSafe(k.nik+'_'+k.nama));
      });
      if(!wb.SheetNames.length){toast('Tidak ada data periode untuk karyawan berhenti');return;}
      var fn='Rekon_Resign_'+exportThn+'_'+new Date().toISOString().split('T')[0]+'.xlsx';
      XLSX.writeFile(wb,fn);
      toast('Excel rekonsiliasi resign diunduh ('+wb.SheetNames.length+' karyawan)');
    }catch(e){toast('Gagal: '+e.message);}
  });
}
/** Excel: kertas kerja PPh 21 & THP — per karyawan, periode aktif */
function exportExcelKertasKerjaPPh(){
  var p=PA();
  var list=sortKaryawanByNik(karyawan.filter(function(k){return karyawanInPeriode(k,p);}));
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
  if(typeof sigajiWithSkeleton==='function'){
    return sigajiWithSkeleton('tb-thr',9,renderTHRBody);
  }
  renderTHRBody();
}
function renderTHRBody(){
  const hari=(document.getElementById('thr-hari')&&document.getElementById('thr-hari').value)||'Idul Fitri';
  const lbl=document.getElementById('thr-hari-lbl');if(lbl)lbl.textContent=hari;
  let total=0,eligible=0;const p=PA();const periodeAdaTHR=!!p.thr_aktif;
  const pNama=p.nama;
  const tbThr=document.getElementById('tb-thr');
  if(!tbThr)return;
  if(!(karyawan||[]).length&&typeof sigajiEmptyState==='function'){
    tbThr.innerHTML='<tr><td colspan="9">'+sigajiEmptyState({icon:'&#128101;',title:'Belum ada karyawan',desc:'Tambah karyawan untuk menghitung preview THR.',btnLabel:'Master karyawan',btnOnclick:"showPg('karyawan')"})+'</td></tr>';
    const sum=document.getElementById('thr-summary');if(sum)sum.innerHTML='';
    return;
  }
  tbThr.innerHTML=sortKaryawanByNik(karyawan||[]).map(function(k,idx){
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
