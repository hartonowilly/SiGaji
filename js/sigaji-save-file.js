/* SiGaji — unduh file; di iPhone mode layar utama buka menu Bagikan. */
function sigajiIsIosStandalone() {
  var ua = navigator.userAgent || '';
  var ios = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  var stand = (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches)
    || window.navigator.standalone === true;
  return !!(ios && stand);
}

function sigajiSaveFileFallback(blob, filename) {
  var a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(function () {
    URL.revokeObjectURL(a.href);
  }, 4000);
}

function sigajiSaveFile(data, filename, mime) {
  var blob = data instanceof Blob
    ? data
    : new Blob([data], { type: mime || 'application/octet-stream' });
  filename = filename || 'unduh';
  if (sigajiIsIosStandalone() && navigator.share && navigator.canShare) {
    try {
      var file = new File([blob], filename, { type: blob.type || mime || 'application/octet-stream' });
      if (navigator.canShare({ files: [file] })) {
        return navigator.share({ files: [file], title: filename }).catch(function () {
          sigajiSaveFileFallback(blob, filename);
        });
      }
    } catch (e) { /* fallback */ }
  }
  sigajiSaveFileFallback(blob, filename);
}

function sigajiWriteXlsx(wb, filename) {
  if (typeof XLSX === 'undefined' || !XLSX.write) {
    if (typeof XLSX !== 'undefined' && XLSX.writeFile) XLSX.writeFile(wb, filename);
    return;
  }
  var out = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  return sigajiSaveFile(out, filename, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
}

function sigajiReloadApp() {
  window.location.reload();
}

if (typeof window !== 'undefined') {
  window.sigajiIsIosStandalone = sigajiIsIosStandalone;
  window.sigajiSaveFile = sigajiSaveFile;
  window.sigajiWriteXlsx = sigajiWriteXlsx;
  window.sigajiReloadApp = sigajiReloadApp;
}
