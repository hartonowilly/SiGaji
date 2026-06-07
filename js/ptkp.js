function getPTKPTable(){var o=(perusahaan&&perusahaan.ptkp_nilai)||{};var out={};Object.keys(DEFAULT_PTKP).forEach(function(k){var v=o[k];out[k]=(v!=null&&String(v)!==''&&!isNaN(Number(v)))?Number(v):DEFAULT_PTKP[k];});return out;}
function nilaiPTKP(key){return getPTKPTable()[key]??DEFAULT_PTKP[key]??63e6;}
function fmtPTKPVal(n){return'Rp '+Math.round(n).toLocaleString('id-ID');}
