/* SiGaji — migrasi saldo PPh YTD (onboarding tengah tahun) */
function migrasiPphTahunUi(){
  var el=document.getElementById('migrasi-pph-tahun');
  if(!el)return new Date().getFullYear();
  return parseInt(el.value,10)||new Date().getFullYear();
}
function parseMigrasiAngka(v){
  if(v===null||v===undefined||v==='')return 0;
  if(typeof v==='number'&&!isNaN(v))return Math.round(v);
  var s=String(v).trim().replace(/\s/g,'');
  if(!s)return 0;
  if(/^\d{1,3}(\.\d{3})+(,\d+)?$/.test(s)||/^\d{1,3}(\.\d{3})+$/.test(s))s=s.replace(/\./g,'').replace(',','.');
  else if(s.indexOf(',')>=0&&s.indexOf('.')<0)s=s.replace(',','.');
  return Math.round(parseFloat(s)||0);
}
function parseMigrasiTgl(v){
  var s=String(v||'').trim();
  if(!s||/^[-—]+$/.test(s))return '';
  if(/^\d{4}-\d{2}-\d{2}$/.test(s))return s;
  var m=s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
  if(m)return m[3]+'-'+String(m[2]).padStart(2,'0')+'-'+String(m[1]).padStart(2,'0');
  return '';
}
function migrasiPphHeaderIdx(hdr,tests){
  for(var i=0;i<hdr.length;i++){
    var h=String(hdr[i]||'').trim().toLowerCase();
    if(!h)continue;
    for(var t=0;t<tests.length;t++)if(tests[t](h))return i;
  }
  return -1;
}
function karyawanMinimalFromMigrasi(nik,nama,status,tglBerhenti,tahun){
  var tb=parseMigrasiTgl(tglBerhenti);
  var st=String(status||'').toLowerCase();
  var isResign=st.indexOf('resign')>=0||st.indexOf('berhenti')>=0||st.indexOf('phk')>=0||!!tb;
  return{
    nik:nik,
    nama:nama||'Karyawan '+nik,
    dept:'Operasional',
    jabatan:'Staff',
    status:isResign?'Resign':'Tetap',
    masuk:(tahun||new Date().getFullYear())+'-01-01',
    tgl_berhenti:tb||undefined,
    ptkp:'TK0',
    jk:'L',
    agama:'Islam',
    ktp:'',
    npwp:'',
    hp:'',
    email:'',
    alamat:'',
    atasan:'',
    lokasi:'',
    bank:'BCA',
    norek:'',
    reknam:nama||'',
    gapok:0,
    tunjangan:[],
    potongan:[],
    bpjs_aktif:{'kes-prs':true,'kes-kar':true,'jht-prs':true,'jht-kar':true,'jp-prs':true,'jp-kar':true,'jkk-prs':true,'jkm-prs':true},
    bpjs_manual:{},
    natura:[],
    pph_return:{nilai:0,ket:''},
    pph_ytd_awal:{}
  };
}
function renderMigrasiPphSaldo(){
  var wrap=document.getElementById('migrasi-pph-tabel');
  if(!wrap)return;
  var thn=migrasiPphTahunUi();
  var list=typeof sortKaryawanByNik==='function'?sortKaryawanByNik(karyawan||[]):karyawan.slice();
  var withSaldo=0;
  list.forEach(function(k){
    var s=getPphYtdAwal(k,thn);
    if(s.bruto>0||s.pph>0)withSaldo++;
  });
  var sum=document.getElementById('migrasi-pph-ringkasan');
  if(sum)sum.textContent=withSaldo+' / '+list.length+' karyawan punya saldo '+thn;
  if(!list.length){
    wrap.innerHTML='<div class="u-muted-12">Belum ada karyawan. Import Excel atau tambah di Master Karyawan.</div>';
    return;
  }
  var rows=list.map(function(k){
    var s=getPphYtdAwal(k,thn);
    var tb=String(k.tgl_berhenti||'').trim();
    var sd=s.sd_bulan?('s/d bln '+s.sd_bulan):'';
    return '<tr>'
      +'<td class="fw-600">'+escapeHtml(k.nik)+'</td>'
      +'<td>'+escapeHtml(k.nama||'')+'</td>'
      +'<td>'+(tb?'<span class="bdg b-warn">'+escapeHtml(tb)+'</span>':'<span class="bdg b-ok">Aktif</span>')+'</td>'
      +'<td class="text-right">'+(s.bruto>0?fmt(s.bruto):'—')+'</td>'
      +'<td class="text-right">'+(s.pph>0?fmt(s.pph):'—')+'</td>'
      +'<td class="u-muted-11">'+escapeHtml(sd)+'</td>'
      +'<td><button type="button" class="btn btn-xs btn-out" onclick="openPanel(\''+String(k.nik).replace(/'/g,"\\'")+'\')">Profil</button></td>'
      +'</tr>';
  }).join('');
  wrap.innerHTML='<table class="tbl font-12"><thead><tr>'
    +'<th>NIK</th><th>Nama</th><th>Berhenti</th><th>Bruto PPh kum.</th><th>PPh terpotong kum.</th><th>Catatan</th><th></th>'
    +'</tr></thead><tbody>'+rows+'</tbody></table>';
}
function ensureXlsxMigrasi(cb){
  if(typeof ensureXLSX==='function'){ensureXLSX(cb);return;}
  if(typeof XLSX!=='undefined'){cb();return;}
  toast('Pustaka Excel belum dimuat');
}
function exportMigrasiPphTemplate(){
  ensureXlsxMigrasi(function(){
    var thn=migrasiPphTahunUi();
    var hdr=['NIK','Nama','Status','Tgl berhenti','S/d bulan','Bruto PPh kumulatif','PPh terpotong kumulatif','PTKP','Gaji pokok'];
    var aoa=[
      hdr,
      ['K0001','Contoh Aktif','Aktif','',''+thn+'-04','48000000','1200000','TK/0','5000000'],
      ['K0003','Contoh Budi','Resign',''+thn+'-03-31','3','36000000','900000','K/0','5500000']
    ];
    sortKaryawanByNik(karyawan||[]).forEach(function(k){
      var s=getPphYtdAwal(k,thn);
      if(s.bruto<=0&&s.pph<=0&&!String(k.tgl_berhenti||'').trim())return;
      aoa.push([
        k.nik,
        k.nama||'',
        k.tgl_berhenti?'Resign':'Aktif',
        k.tgl_berhenti||'',
        s.sd_bulan||'',
        s.bruto||'',
        s.pph||'',
        k.ptkp||'',
        k.gapok||''
      ]);
    });
    var ws=XLSX.utils.aoa_to_sheet(aoa);
    ws['!cols']=[{wch:10},{wch:22},{wch:10},{wch:12},{wch:10},{wch:18},{wch:18},{wch:8},{wch:12}];
    var wb=XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb,ws,'Migrasi_PPh');
    var note=XLSX.utils.aoa_to_sheet([
      ['PETUNJUK MIGRASI SALDO PPh'],
      ['Tahun pajak: '+thn],
      ['Isi total bruto PPh 21 dan PPh terpotong dari payroll manual (Jan s/d bulan di kolom S/d bulan).'],
      ['Jangan buat periode gaji Jan-Apr di SiGaji jika memakai saldo ini (hindari double).'],
      ['Resign: isi Tgl berhenti — NIK sama seperti payroll lama, jangan buat karyawan baru.'],
      ['Status: Aktif atau Resign (opsional).']
    ]);
    XLSX.utils.book_append_sheet(wb,note,'Petunjuk');
    XLSX.writeFile(wb,'Migrasi_Saldo_PPh_'+thn+'.xlsx');
    toast('Template migrasi diunduh');
  });
}
function importMigrasiPphExcel(inp){
  var f=inp&&inp.files&&inp.files[0];
  if(!f)return;
  ensureXlsxMigrasi(function(){
    var reader=new FileReader();
    reader.onload=function(ev){
      try{
        var wb=XLSX.read(ev.target.result,{type:'array'});
        var sh=wb.Sheets[wb.SheetNames[0]];
        if(!sh){toast('Sheet kosong');inp.value='';return;}
        var rows=XLSX.utils.sheet_to_json(sh,{header:1,defval:''});
        if(!rows.length||rows.length<2){toast('Minimal header + 1 baris data');inp.value='';return;}
        var hdr=rows[0].map(function(x){return String(x||'').trim();});
        var nikIdx=migrasiPphHeaderIdx(hdr,[function(h){return h==='nik';}]);
        if(nikIdx<0){toast('Kolom NIK wajib');inp.value='';return;}
        var namaIdx=migrasiPphHeaderIdx(hdr,[function(h){return h==='nama';}]);
        var statusIdx=migrasiPphHeaderIdx(hdr,[function(h){return h.indexOf('status')===0;}]);
        var tbIdx=migrasiPphHeaderIdx(hdr,[function(h){return h.indexOf('tgl')>=0&&h.indexOf('berhenti')>=0;}]);
        var sdIdx=migrasiPphHeaderIdx(hdr,[function(h){return h.indexOf('s/d')>=0||h.indexOf('sd bulan')>=0||h==='s/d bulan';}]);
        var brutoIdx=migrasiPphHeaderIdx(hdr,[function(h){return h.indexOf('bruto')>=0;}]);
        var pphIdx=migrasiPphHeaderIdx(hdr,[function(h){return h.indexOf('pph')>=0&&h.indexOf('bruto')<0;}]);
        var ptkpIdx=migrasiPphHeaderIdx(hdr,[function(h){return h==='ptkp';}]);
        var gapokIdx=migrasiPphHeaderIdx(hdr,[function(h){return h.indexOf('gaji')>=0||h.indexOf('gapok')>=0;}]);
        var tahunIdx=migrasiPphHeaderIdx(hdr,[function(h){return h==='tahun';}]);
        var thnDef=migrasiPphTahunUi();
        var buatBaru=document.getElementById('migrasi-pph-buat-baru');
        var allowNew=buatBaru?buatBaru.checked:true;
        var byNik={};
        karyawan.forEach(function(k){byNik[String(k.nik)]=k;});
        var ok=0,skip=0,buat=0,upd=0;
        for(var r=1;r<rows.length;r++){
          var row=rows[r];
          if(!row||!row.length)continue;
          var nik=String(row[nikIdx]||'').trim();
          if(!nik||/^contoh/i.test(nik))continue;
          var bruto=brutoIdx>=0?parseMigrasiAngka(row[brutoIdx]):0;
          var pph=pphIdx>=0?parseMigrasiAngka(row[pphIdx]):0;
          if(bruto<=0&&pph<=0){skip++;continue;}
          var thn=thnIdx>=0?parseInt(row[tahunIdx],10):thnDef;
          if(isNaN(thn)||thn<2000)thn=thnDef;
          var nama=namaIdx>=0?String(row[namaIdx]||'').trim():'';
          var status=statusIdx>=0?String(row[statusIdx]||'').trim():'';
          var tb=tbIdx>=0?parseMigrasiTgl(row[tbIdx]):'';
          var sd=sdIdx>=0?parseInt(row[sdIdx],10):0;
          var k=byNik[nik];
          if(!k){
            if(!allowNew){
              if(typeof sigajiAssertCanAddActiveEmployees==='function'&&!sigajiAssertCanAddActiveEmployees(1)){inp.value='';return;}
              skip++;
              continue;
            }
            if(typeof sigajiAssertCanAddActiveEmployees==='function'){
              var chk=sigajiCanAddActiveEmployees(1);
              if(!chk.ok){toast(chk.message);inp.value='';return;}
            }
            k=karyawanMinimalFromMigrasi(nik,nama,status,tb,thn);
            karyawan.push(k);
            byNik[nik]=k;
            buat++;
          }else{
            upd++;
            if(nama)k.nama=nama;
            if(ptkpIdx>=0&&String(row[ptkpIdx]||'').trim())k.ptkp=String(row[ptkpIdx]).trim().replace(/\//g,'').toUpperCase();
            if(gapokIdx>=0){var g0=parseMigrasiAngka(row[gapokIdx]);if(g0>0)k.gapok=g0;}
          }
          if(tb){
            k.tgl_berhenti=tb;
            if(!k.phk)k.phk={};
            if(!k.phk.alasan)k.phk.alasan='resign_30hr';
          }
          setPphYtdAwal(k,thn,bruto,pph,sd||undefined);
          ok++;
        }
        saveAll();
        renderMigrasiPphSaldo();
        renderKar();
        renderDash();
        populateSelects();
        if(typeof renderPPH==='function')renderPPH();
        if(typeof renderLaporan==='function')renderLaporan();
        toast('Import migrasi: '+ok+' baris ('+upd+' update, '+buat+' karyawan baru)'+(skip?' · '+skip+' dilewati':''));
      }catch(e){
        console.error(e);
        toast('Gagal baca Excel: '+(e.message||e));
      }
      inp.value='';
    };
    reader.readAsArrayBuffer(f);
  });
}
function clearMigrasiPphSaldoTahun(){
  var thn=migrasiPphTahunUi();
  if(!confirm('Hapus semua saldo migrasi PPh tahun '+thn+' untuk semua karyawan?'))return;
  var n=0;
  karyawan.forEach(function(k){
    if(k.pph_ytd_awal&&k.pph_ytd_awal[String(thn)]){
      delete k.pph_ytd_awal[String(thn)];
      if(!Object.keys(k.pph_ytd_awal).length)delete k.pph_ytd_awal;
      n++;
    }
  });
  saveAll();
  renderMigrasiPphSaldo();
  toast(n?('Saldo '+thn+' dihapus ('+n+' karyawan)'):'Tidak ada saldo untuk tahun ini');
}
if(typeof window!=='undefined'){
  window.renderMigrasiPphSaldo=renderMigrasiPphSaldo;
  window.exportMigrasiPphTemplate=exportMigrasiPphTemplate;
  window.importMigrasiPphExcel=importMigrasiPphExcel;
  window.clearMigrasiPphSaldoTahun=clearMigrasiPphSaldoTahun;
}
