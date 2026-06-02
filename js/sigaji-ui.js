/**
 * SiGaji — modal konfirmasi & util UI bersama.
 */
(function () {
  var _resolve = null;

  function el(id) {
    return document.getElementById(id);
  }

  window.sigajiConfirm = function (opts) {
    opts = opts || {};
    return new Promise(function (resolve) {
      _resolve = resolve;
      var title = el('confirm-title');
      var body = el('confirm-body');
      var okBtn = el('confirm-ok');
      var modal = el('m-confirm');
      if (!modal || !title || !body || !okBtn) {
        resolve(window.confirm(String(opts.message || opts.title || 'Lanjutkan?')));
        return;
      }
      title.textContent = opts.title || 'Konfirmasi';
      body.textContent = opts.message || '';
      okBtn.textContent = opts.okText || 'Ya, lanjutkan';
      okBtn.className = 'btn btn-sm ' + (opts.danger ? 'btn-r' : 'btn-p');
      var cancelBtn = el('confirm-cancel');
      if (cancelBtn) cancelBtn.textContent = opts.cancelText || 'Batal';
      modal.classList.add('show');
      document.body.style.overflow = 'hidden';
      setTimeout(function () {
        if (opts.danger && okBtn) okBtn.focus();
        else if (cancelBtn) cancelBtn.focus();
      }, 80);
    });
  };

  window.sigajiConfirmClose = function (result) {
    var modal = el('m-confirm');
    if (modal) modal.classList.remove('show');
    document.body.style.overflow = '';
    if (typeof _resolve === 'function') {
      var r = _resolve;
      _resolve = null;
      r(!!result);
    }
  };

  document.addEventListener('keydown', function (e) {
    var modal = el('m-confirm');
    if (!modal || !modal.classList.contains('show')) return;
    if (e.key === 'Escape') {
      e.preventDefault();
      sigajiConfirmClose(false);
    }
  });
})();
