function getPTKPTable(){var o=(perusahaan&&perusahaan.ptkp_nilai)||{};var out={};Object.keys(DEFAULT_PTKP).forEach(function(k){var v=o[k];out[k]=(v!=null&&String(v)!==''&&!isNaN(Number(v)))?Number(v):DEFAULT_PTKP[k];});return out;}
function nilaiPTKP(key){return getPTKPTable()[key]??DEFAULT_PTKP[key]??63e6;}
function fmtPTKPVal(n){return'Rp '+Math.round(n).toLocaleString('id-ID');}

/** Jenis kelamin perempuan (P / Perempuan). */
function isJkPerempuan(jk){
  var s=String(jk||'').trim().toUpperCase();
  return s==='P'||s==='PEREMPUAN'||s==='WANITA'||s==='F'||s==='FEMALE';
}
function isSigajiAdminUser(){
  return !!(typeof CU!=='undefined'&&CU&&CU.role==='Admin');
}
/** Nama periode "Januari YYYY" atau rentang yang jatuh di Januari. */
function isNamaPeriodeJanuari(nama){
  return /^januari\b/i.test(String(nama||'').trim());
}
function isPeriodeJanuariAktif(){
  var p=typeof PA==='function'?PA():null;
  if(!p)return false;
  if(isNamaPeriodeJanuari(p.nama))return true;
  var s=String(p.start||'');
  return s.length>=7&&s.substring(5,7)==='01';
}
/**
 * Boleh ubah PTKP?
 * - Perempuan: terkunci TK/0 (Admin boleh override)
 * - Laki-laki: bebas di masa Januari; di luar Januari hanya Admin (override)
 */
function canEditPtkpStatus(jk,opts){
  opts=opts||{};
  if(isJkPerempuan(jk)&&!opts.adminFemaleOverride){
    return{ok:false,reason:'female',msg:'Karyawan perempuan dikunci PTKP TK/0 (aturan perusahaan). Admin dapat override.'};
  }
  if(isPeriodeJanuariAktif())return{ok:true,reason:'januari'};
  if(isSigajiAdminUser())return{ok:true,reason:'admin',needConfirm:true};
  return{ok:false,reason:'locked',msg:'Status PTKP hanya diubah di periode Januari (awal tahun pajak). Hubungi Admin untuk override.'};
}
function ptkpOptionsHtml(selected){
  var keys=typeof PTKP_KEYS!=='undefined'?PTKP_KEYS:['TK0','TK1','TK2','TK3','K0','K1','K2','K3'];
  var lbl=typeof PTKP_LBL!=='undefined'?PTKP_LBL:{};
  return keys.map(function(k){
    var lab=lbl[k]||k;
    return '<option value="'+k+'"'+(k===selected?' selected':'')+'>'+lab+'</option>';
  }).join('');
}
/** Sinkron UI select PTKP di slide panel. */
function applyPtkpFieldState(){
  var sel=document.getElementById('sp-ptkp-f');
  var jkEl=document.getElementById('sp-jk-f');
  var hint=document.getElementById('sp-ptkp-hint');
  var btnOv=document.getElementById('sp-ptkp-override-btn');
  if(!sel)return;
  var jk=jkEl?jkEl.value:'L';
  var female=isJkPerempuan(jk);
  var admin=isSigajiAdminUser();
  var allowFemaleOv=!!(sel.dataset.femaleOverride==='1'&&admin);
  var gate=canEditPtkpStatus(jk,{adminFemaleOverride:allowFemaleOv});
  if(female&&!allowFemaleOv){
    sel.value='TK0';
    sel.disabled=true;
    if(hint)hint.textContent='Perempuan: PTKP dikunci TK/0.'+(admin?' Admin bisa override.':'');
  }else if(!gate.ok){
    sel.disabled=true;
    if(hint)hint.textContent=gate.msg||'PTKP terkunci sampai Januari.';
  }else{
    sel.disabled=false;
    if(hint){
      if(gate.reason==='admin'&&gate.needConfirm)hint.textContent='Di luar Januari: perubahan PTKP oleh Admin akan dikonfirmasi saat simpan.';
      else if(allowFemaleOv)hint.textContent='Override Admin aktif — PTKP perempuan dapat diubah.';
      else hint.textContent='Periode Januari: status PTKP boleh diperbarui (awal tahun pajak).';
    }
  }
  if(btnOv){
    if(female&&admin){
      btnOv.classList.remove('u-hidden');
      btnOv.textContent=allowFemaleOv?'Batalkan override':'Override Admin (buka PTKP)';
    }else{
      btnOv.classList.add('u-hidden');
    }
  }
  if(typeof updatePTKPVal==='function')updatePTKPVal();
}
function togglePtkpFemaleOverride(){
  if(!isSigajiAdminUser()){toast('Hanya Admin');return;}
  var sel=document.getElementById('sp-ptkp-f');
  if(!sel)return;
  if(sel.dataset.femaleOverride==='1')delete sel.dataset.femaleOverride;
  else sel.dataset.femaleOverride='1';
  applyPtkpFieldState();
}
function onJkChange(){
  var jkEl=document.getElementById('sp-jk-f');
  var sel=document.getElementById('sp-ptkp-f');
  if(sel)delete sel.dataset.femaleOverride;
  if(jkEl&&isJkPerempuan(jkEl.value)&&sel)sel.value='TK0';
  applyPtkpFieldState();
}

function openPtkpJanuariModal(periodeNama){
  var modal=document.getElementById('m-ptkp-januari');
  if(!modal){toast('Modal PTKP tidak ditemukan');return;}
  var tit=document.getElementById('m-ptkp-januari-tit');
  if(tit)tit.textContent='Update Status PTKP — '+(periodeNama||'Januari');
  var tb=document.getElementById('tb-ptkp-januari');
  if(!tb)return;
  var list=(typeof karyawanSortedAll==='function'?karyawanSortedAll():(karyawan||[])).filter(function(k){
    return k&&k.nik&&!String(k.tgl_berhenti||'').trim();
  });
  tb.innerHTML=list.map(function(k,i){
    var female=isJkPerempuan(k.jk);
    var cur=female?'TK0':(k.ptkp||'TK0');
    var dis=female?' disabled':'';
    var note=female?'<span class="font-10 text-muted">Perempuan → TK/0</span>':'';
    return '<tr><td class="text-center text-muted">'+(i+1)+'</td>'
      +'<td><strong>'+escapeHtml(k.nama||'')+'</strong><div class="u-muted-10">'+escapeHtml(k.nik)+'</div></td>'
      +'<td>'+(female?'P':'L')+'</td>'
      +'<td><select class="ptkp-jan-sel" data-nik="'+escapeAttr(k.nik)+'"'+dis+'>'+ptkpOptionsHtml(cur)+'</select> '+note+'</td></tr>';
  }).join('')||'<tr><td colspan="4" class="text-muted p-md">Tidak ada karyawan aktif.</td></tr>';
  openModal('m-ptkp-januari');
}
function simpanPtkpJanuari(){
  var n=0;
  document.querySelectorAll('#tb-ptkp-januari .ptkp-jan-sel').forEach(function(sel){
    var nik=sel.getAttribute('data-nik');
    var k=(karyawan||[]).find(function(x){return x&&x.nik===nik;});
    if(!k)return;
    var v=isJkPerempuan(k.jk)?'TK0':sel.value;
    if(k.ptkp!==v){k.ptkp=v;n++;}
  });
  saveAll();
  closeModal('m-ptkp-januari');
  if(typeof renderKar==='function')renderKar();
  if(typeof renderPenggajian==='function')renderPenggajian();
  if(typeof renderPPH==='function')renderPPH();
  toast(n?('PTKP diperbarui untuk '+n+' karyawan'):'Tidak ada perubahan PTKP');
}
if(typeof window!=='undefined'){
  window.getPTKPTable=getPTKPTable;
  window.nilaiPTKP=nilaiPTKP;
  window.fmtPTKPVal=fmtPTKPVal;
  window.isJkPerempuan=isJkPerempuan;
  window.isSigajiAdminUser=isSigajiAdminUser;
  window.canEditPtkpStatus=canEditPtkpStatus;
  window.applyPtkpFieldState=applyPtkpFieldState;
  window.togglePtkpFemaleOverride=togglePtkpFemaleOverride;
  window.onJkChange=onJkChange;
  window.openPtkpJanuariModal=openPtkpJanuariModal;
  window.simpanPtkpJanuari=simpanPtkpJanuari;
  window.isNamaPeriodeJanuari=isNamaPeriodeJanuari;
}
