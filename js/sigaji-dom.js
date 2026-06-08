/**
 * SiGaji — DOM aman (escape XSS) + render tabel bertahap.
 */
(function () {
  /** Escape teks untuk innerHTML. */
  window.escapeHtml = function (s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  };

  /** Escape nilai atribut HTML / string dalam onclick. */
  window.escapeAttr = function (s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;')
      .replace(/</g, '&lt;');
  };

  /** Alias singkat — field karyawan ke HTML. */
  window.escKar = function (k, field) {
    return escapeHtml(k && field ? k[field] : '');
  };

  /** NIK aman untuk atribut data-* / string legacy. */
  window.escNik = function (nik) {
    return escapeAttr(nik);
  };

  /** Bandingkan id periode/approval (string vs number dari DOM/JSON). */
  window.sigajiSameId = function (a, b) {
    if (a == null || b == null) return a === b;
    return String(a).trim() === String(b).trim();
  };

  /** Log catch yang sebelumnya kosong — jangan telan error cloud/UI. */
  window.sigajiCatchWarn = function (tag, e) {
    if (e == null) return;
    var label = tag ? 'SiGaji [' + tag + ']' : 'SiGaji';
    console.warn(label + ':', e);
  };

  /**
   * Atribut data-sigaji-action + data-* untuk event delegation (tanpa onclick).
   * @param {string} action
   * @param {Record<string, string|number|boolean|null|undefined>} [attrs]
   */
  window.sigajiDataAction = function (action, attrs) {
    var s = ' data-sigaji-action="' + escapeAttr(action) + '"';
    if (attrs) {
      Object.keys(attrs).forEach(function (k) {
        var v = attrs[k];
        if (v != null && v !== '') s += ' data-' + k + '="' + escapeAttr(String(v)) + '"';
      });
    }
    return s;
  };

  /**
   * Isi tbody tanpa freeze UI — chunk via requestAnimationFrame jika banyak baris.
   * @param {HTMLElement} tbody
   * @param {string[]} rowHtml
   * @param {number} [chunkSize]
   */
  window.sigajiSetTbodyRows = function (tbody, rowHtml, chunkSize) {
    if (!tbody) return;
    var rows = rowHtml || [];
    var chunk = chunkSize || 80;
    if (!rows.length) {
      tbody.innerHTML = '';
      return;
    }
    if (rows.length <= chunk || typeof requestAnimationFrame !== 'function') {
      tbody.innerHTML = rows.join('');
      return;
    }
    tbody.innerHTML = '';
    var i = 0;
    function step() {
      var end = Math.min(i + chunk, rows.length);
      tbody.insertAdjacentHTML('beforeend', rows.slice(i, end).join(''));
      i = end;
      if (i < rows.length) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  };

  /** <option> dari daftar karyawan — NIK & nama di-escape. */
  window.sigajiKarOptionsHtml = function (list, emptyLabel) {
    emptyLabel = emptyLabel || '-- Pilih --';
    var h = '<option value="">' + escapeHtml(emptyLabel) + '</option>';
    (list || []).forEach(function (k) {
      h +=
        '<option value="' +
        escapeAttr(k.nik) +
        '">' +
        escapeHtml(k.nik) +
        ' — ' +
        escapeHtml(k.nama) +
        '</option>';
    });
    return h;
  };
})();
