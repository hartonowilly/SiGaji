/**
 * Modul Pesangon — estimasi hak PHK (UU Cipta Kerja / PP 35 Tahun 2021).
 * Bukan pengganti saran hukum; periksa PK/PKWT & keadaan konkret.
 */
(function(){
  function dasarUpahPesangon(k){
    if(!k)return 0;
    var t=(k.tunjangan||[]).filter(function(x){
      return (x.tipe==='tetap'||x.tipe==='tetap_no_bpjs')&&x.thr_ikut!==false;
    }).reduce(function(s,x){return s+(parseFloat(x.nilai)||0);},0);
    return Math.round((parseFloat(k.gapok)||0)+t);
  }
  function sisaCutiOtomatis(nik,tglBerhenti){
    if(!nik||!tglBerhenti)return 0;
    var thn=new Date(tglBerhenti).getFullYear();
    var pakai=typeof cutiTerpakai==='function'?cutiTerpakai(nik,thn):0;
    var kuota=(typeof masterCuti!=='undefined'&&masterCuti)?(masterCuti.kuota||12):12;
    return Math.max(0,kuota-pakai);
  }
  window.dasarUpahPesangon=dasarUpahPesangon;
  window.hitungPesangon=function(k){
    if(!k||!k.tgl_berhenti){
      return{ok:false,pesan:'Isi tanggal berhenti di profil karyawan.',dasar:0,mk:0,bUp:0,bUpmk:0,up:0,upmk:0,uph:0,pisah:0,total:0,sisaCuti:0,sisaCutiAuto:0,opt:null};
    }
    var phk=k.phk||{};
    var opt=typeof phkOpt==='function'?phkOpt(phk.alasan||''):{f:1,uphOnly:false,manual:false};
    var dasar=dasarUpahPesangon(k);
    var mk=typeof masaKerjaBulanPHK==='function'?masaKerjaBulanPHK(k):0;
    var bUp=typeof bulanUPPasal40==='function'?bulanUPPasal40(mk):0;
    var bUpmk=typeof bulanUPMKPasal41==='function'?bulanUPMKPasal41(mk):0;
    var sisaAuto=sisaCutiOtomatis(k.nik,k.tgl_berhenti);
    var sisaCuti=sisaAuto;
    if(phk.sisa_cuti_hari!==undefined&&phk.sisa_cuti_hari!==null&&String(phk.sisa_cuti_hari).trim()!==''){
      sisaCuti=Math.max(0,parseFloat(phk.sisa_cuti_hari)||0);
    }
    var uphCuti=Math.round(dasar/25*Math.max(0,sisaCuti));
    var upAuto=0,upmkAuto=0;
    if(opt.manual){
      upAuto=Math.round(parseFloat(phk.up_manual)||0);
      upmkAuto=Math.round(parseFloat(phk.upmk_manual)||0);
    }else if(opt.f===0||opt.uphOnly){
      upAuto=0;upmkAuto=0;
    }else if(opt.f!=null){
      upAuto=Math.round(bUp*dasar*opt.f);
      upmkAuto=Math.round(bUpmk*dasar*opt.f);
    }
    var up=(phk.up_manual!==undefined&&phk.up_manual!==null&&String(phk.up_manual).trim()!=='')?Math.round(parseFloat(phk.up_manual)):upAuto;
    var upmk=(phk.upmk_manual!==undefined&&phk.upmk_manual!==null&&String(phk.upmk_manual).trim()!=='')?Math.round(parseFloat(phk.upmk_manual)):upmkAuto;
    var uph=(phk.uph_manual!==undefined&&phk.uph_manual!==null&&String(phk.uph_manual).trim()!=='')?Math.round(parseFloat(phk.uph_manual)):uphCuti;
    uph+=Math.round(parseFloat(phk.uph_tambahan)||0);
    var pisah=Math.round(parseFloat(phk.pisah)||0);
    var total=up+upmk+uph+pisah;
    return{
      ok:true,dasar:dasar,mk:mk,bUp:bUp,bUpmk:bUpmk,up:up,upmk:upmk,uph:uph,pisah:pisah,total:total,
      sisaCuti:sisaCuti,sisaCutiAuto:sisaAuto,uphCuti:uphCuti,opt:opt,faktor:opt.f
    };
  };
  var selNik=null;
  function optHtml(){
    return PHK_ALASAN_OPTS.map(function(o){
      return '<option value="'+o.id+'">'+(o.lbl||o.id)+'</option>';
    }).join('');
  }
  function applyPhkToKaryawan(nik){
    var k=karyawan.find(function(x){return x.nik===nik;});if(!k)return;
    if(!k.phk)k.phk={};
    var al=document.getElementById('psg-alasan');if(al)k.phk.alasan=al.value;
    var sc=document.getElementById('psg-sisa-cuti');if(sc&&String(sc.value).trim()!=='')k.phk.sisa_cuti_hari=parseFloat(sc.value)||0;else delete k.phk.sisa_cuti_hari;
    function numOrDel(id,key){
      var e=document.getElementById(id);if(!e)return;
      var v=String(e.value||'').trim();
      if(v==='')delete k.phk[key];else k.phk[key]=parseFloat(v)||0;
    }
    numOrDel('psg-up-manual','up_manual');
    numOrDel('psg-upmk-manual','upmk_manual');
    numOrDel('psg-uph-manual','uph_manual');
    numOrDel('psg-uph-tambahan','uph_tambahan');
    numOrDel('psg-pisah','pisah');
    var ket=document.getElementById('psg-ket');if(ket)k.phk.keterangan=ket.value||'';
  }
  function renderDetail(){
    var wrap=document.getElementById('psg-detail');if(!wrap)return;
    if(!selNik){wrap.innerHTML='<div class="info-box info-blue" style="font-size:12px">Pilih karyawan di tabel.</div>';return;}
    var k=karyawan.find(function(x){return x.nik===selNik;});
    if(!k){wrap.innerHTML='';return;}
    var phk=k.phk||{};
    var h='';
    h+='<div class="stit">'+escapeHtml(k.nama)+' <span style="font-size:11px;color:#6b7280;font-weight:600">'+escapeHtml(k.nik)+'</span></div>';
    h+='<div class="fg2" style="margin-top:.5rem">';
    h+='<div class="fg"><label>Tgl. berhenti</label><input type="date" id="psg-tgl" value="'+(k.tgl_berhenti||'')+'" onchange="pesangonTglChange()"></div>';
    h+='<div class="fg ff"><label>Alasan PHK</label><select id="psg-alasan" onchange="pesangonRefresh()">'+optHtml()+'</select></div>';
    h+='<div class="fg"><label>Sisa cuti (hari) — kosongkan = otomatis dari absensi</label><input type="number" min="0" step="1" id="psg-sisa-cuti" placeholder="Otomatis" value="'+(phk.sisa_cuti_hari!==undefined&&phk.sisa_cuti_hari!==null&&String(phk.sisa_cuti_hari)!==''?phk.sisa_cuti_hari:'')+'" onchange="pesangonRefresh()"></div>';
    h+='<div class="fg"><label>Override UP (Rp)</label><input type="number" min="0" step="1" id="psg-up-manual" placeholder="Opsional" value="'+(phk.up_manual!=null&&phk.up_manual!==''?phk.up_manual:'')+'" onchange="pesangonRefresh()"></div>';
    h+='<div class="fg"><label>Override UPMK (Rp)</label><input type="number" min="0" step="1" id="psg-upmk-manual" placeholder="Opsional" value="'+(phk.upmk_manual!=null&&phk.upmk_manual!==''?phk.upmk_manual:'')+'" onchange="pesangonRefresh()"></div>';
    h+='<div class="fg"><label>Override UPH total (Rp)</label><input type="number" min="0" step="1" id="psg-uph-manual" placeholder="Kosong = dari cuti" value="'+(phk.uph_manual!=null&&phk.uph_manual!==''?phk.uph_manual:'')+'" onchange="pesangonRefresh()"></div>';
    h+='<div class="fg"><label>UPH tambahan (ongkos dll., Rp)</label><input type="number" min="0" step="1" id="psg-uph-tambahan" value="'+(phk.uph_tambahan||0)+'" onchange="pesangonRefresh()"></div>';
    h+='<div class="fg"><label>Uang pisah PK (Rp)</label><input type="number" min="0" step="1" id="psg-pisah" value="'+(phk.pisah||0)+'" onchange="pesangonRefresh()"></div>';
    h+='<div class="fg ff"><label>Keterangan</label><input id="psg-ket" value="'+escapeHtml(phk.keterangan||'')+'" onchange="pesangonRefresh()"></div>';
    h+='</div>';
    h+='<div class="fl gap1" style="margin:.75rem 0"><button class="btn btn-sm btn-p" onclick="pesangonSimpan()">&#128190; Simpan ke profil</button><button class="btn btn-sm btn-out" onclick="openPanel(\''+escJsStr(k.nik)+'\')">Profil karyawan</button></div>';
    h+='<div id="psg-breakdown"></div>';
    wrap.innerHTML=h;
    var al2=document.getElementById('psg-alasan');if(al2)al2.value=phk.alasan||'';
    applyPhkToKaryawan(selNik);
    var r=hitungPesangon(karyawan.find(function(x){return x.nik===selNik;}));
    var bd=document.getElementById('psg-breakdown');if(!bd)return;
    var hb='';
    if(r.ok){
      hb+='<div class="info-box info-amber" style="font-size:11px;line-height:1.55;margin-bottom:.6rem">Dasar upah = gaji pokok + tunjangan tetap yang ikut THR (sama logika kolom THR). UPH cuti: <strong>(dasar ÷ 25) × sisa cuti</strong>. UP/UPMK mengikuti <strong>PP 35/2021</strong> × faktor alasan. Verifikasi dengan HR/legal.</div>';
      hb+='<table style="width:100%;font-size:12px;border-collapse:collapse"><tbody>';
      hb+='<tr><td style="padding:6px;border-bottom:1px solid var(--bd)">Masa kerja</td><td style="padding:6px;border-bottom:1px solid var(--bd);text-align:right">'+r.mk+' bln</td></tr>';
      hb+='<tr><td style="padding:6px;border-bottom:1px solid var(--bd)">Dasar upah</td><td style="padding:6px;border-bottom:1px solid var(--bd);text-align:right">'+fmt(r.dasar)+'</td></tr>';
      hb+='<tr><td style="padding:6px;border-bottom:1px solid var(--bd)">Lama UP / UPMK (bulan upah)</td><td style="padding:6px;border-bottom:1px solid var(--bd);text-align:right">'+r.bUp+' / '+r.bUpmk+'</td></tr>';
      hb+='<tr><td style="padding:6px;border-bottom:1px solid var(--bd)">Faktor pengali</td><td style="padding:6px;border-bottom:1px solid var(--bd);text-align:right">'+(r.faktor==null?'—':String(r.faktor))+(r.opt&&r.opt.uphOnly?' <span style="color:#7d4800">(UP/UPMK = 0; fokus UPH)</span>':'')+'</td></tr>';
      hb+='<tr><td style="padding:6px;border-bottom:1px solid var(--bd)">Sisa cuti (hari)</td><td style="padding:6px;border-bottom:1px solid var(--bd);text-align:right">'+r.sisaCuti+(r.sisaCuti!==r.sisaCutiAuto?' <span style="font-size:10px;color:#6b7280">(auto '+r.sisaCutiAuto+')</span>':'')+'</td></tr>';
      hb+='<tr><td style="padding:6px;border-bottom:1px solid var(--bd)">UPH dari cuti (jika tidak di-override)</td><td style="padding:6px;border-bottom:1px solid var(--bd);text-align:right">'+fmt(r.uphCuti)+'</td></tr>';
      hb+='<tr style="font-weight:700"><td style="padding:8px;border-bottom:1px solid var(--bd)">Uang Pesangon</td><td style="padding:8px;border-bottom:1px solid var(--bd);text-align:right">'+fmt(r.up)+'</td></tr>';
      hb+='<tr style="font-weight:700"><td style="padding:8px;border-bottom:1px solid var(--bd)">Uang Penghargaan Masa Kerja</td><td style="padding:8px;border-bottom:1px solid var(--bd);text-align:right">'+fmt(r.upmk)+'</td></tr>';
      hb+='<tr style="font-weight:700"><td style="padding:8px;border-bottom:1px solid var(--bd)">Uang Penggantian Hak (setelah tambahan)</td><td style="padding:8px;border-bottom:1px solid var(--bd);text-align:right">'+fmt(r.uph)+'</td></tr>';
      hb+='<tr style="font-weight:700"><td style="padding:8px;border-bottom:1px solid var(--bd)">Uang pisah</td><td style="padding:8px;border-bottom:1px solid var(--bd);text-align:right">'+fmt(r.pisah)+'</td></tr>';
      hb+='<tr style="font-weight:800;background:#f0f9ff"><td style="padding:10px">Total estimasi</td><td style="padding:10px;text-align:right;color:#1a56a0">'+fmt(r.total)+'</td></tr>';
      hb+='</tbody></table>';
    }else hb+='<div class="info-box info-red">'+(r.pesan||'')+'</div>';
    bd.innerHTML=hb;
  }
  function escapeHtml(s){
    return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }
  function escJsStr(s){
    return String(s||'').replace(/\\/g,'\\\\').replace(/'/g,"\\'").replace(/\r?\n/g,' ');
  }
  window.renderPesangon=function(){
    try{
    var tb=document.getElementById('tb-pesangon');if(!tb)return;
    var list=karyawan.filter(function(k){return k.tgl_berhenti&&String(k.tgl_berhenti).trim();});
    list.sort(function(a,b){return String(b.tgl_berhenti).localeCompare(String(a.tgl_berhenti));});
    if(!list.length){
      tb.innerHTML='<tr><td colspan="6" style="padding:1rem;color:#6b7280;font-size:12px">Belum ada karyawan dengan tanggal berhenti. Isi di profil (Info & Jabatan).</td></tr>';
      selNik=null;renderDetail();return;
    }
    tb.innerHTML=list.map(function(k){
      var phk=k.phk||{};
      var opt=phkOpt(phk.alasan||'');
      var r=hitungPesangon(k);
      var al=opt.lbl||'—';
      var cls=selNik===k.nik?'style="background:#eff6ff"':'';
      return '<tr '+cls+' class="psg-row" data-nik="'+escapeHtml(k.nik)+'" onclick="pesangonPilih(\''+escJsStr(k.nik)+'\')"><td><strong>'+escapeHtml(k.nama)+'</strong><div style="font-size:10px;color:#6b7280">'+escapeHtml(k.nik)+'</div></td><td>'+fmtDate(k.tgl_berhenti)+'</td><td style="font-size:11px;max-width:180px">'+escapeHtml(al)+'</td><td style="text-align:right">'+(r.ok?fmt(r.total):'—')+'</td><td style="text-align:center">'+(phk.alasan?'&#10003;':'<span style="color:#b45309">!</span>')+'</td><td><button class="btn btn-xs btn-out" onclick="event.stopPropagation();openPanel(\''+escJsStr(k.nik)+'\')">Profil</button></td></tr>';
    }).join('');
    if(selNik&&!list.find(function(k){return k.nik===selNik;}))selNik=list[0].nik;
    if(!selNik&&list.length)selNik=list[0].nik;
    renderDetail();
    }catch(e){console.error('renderPesangon',e);if(typeof toast==='function')toast('Error modul Pesangon — lihat konsol (F12).');}
  };
  window.pesangonPilih=function(nik){selNik=nik;renderPesangon();};
  window.pesangonRefresh=function(){
    if(!selNik)return;
    applyPhkToKaryawan(selNik);
    renderDetail();
  };
  window.pesangonTglChange=function(){
    var k=karyawan.find(function(x){return x.nik===selNik;});if(!k)return;
    var e=document.getElementById('psg-tgl');
    var v=e&&e.value?e.value.trim():'';
    if(v)k.tgl_berhenti=v;else delete k.tgl_berhenti;
    pesangonRefresh();renderKar();
  };
  window.pesangonSimpan=function(){
    if(!selNik)return;
    applyPhkToKaryawan(selNik);
    var k=karyawan.find(function(x){return x.nik===selNik;});
    if(!k)return;
    if(k.tgl_berhenti&&!k.phk||!k.phk.alasan){toast('Pilih alasan PHK sebelum menyimpan.');return;}
    saveAll();toast('Data pesangon disimpan');renderPesangon();renderKar();
  };
})();
