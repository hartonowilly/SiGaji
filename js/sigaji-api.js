/**
 * SiGaji — fetch API/Netlify dengan error handling konsisten.
 */
(function () {
  /**
   * @param {string} url
   * @param {RequestInit} [opts]
   * @returns {Promise<{ok:boolean,status:number,data?:*,error?:string}>}
   */
  window.sigajiFetchJson = async function (url, opts) {
    opts = opts || {};
    try {
      var r = await fetch(url, opts);
      var j = null;
      if (typeof sigajiParseFunctionJson === 'function') {
        j = await sigajiParseFunctionJson(r);
      } else {
        try {
          j = await r.json();
        } catch (eJson) {
          j = null;
        }
      }
      if (!r.ok) {
        var httpErr =
          (j && (j.error || j.message)) ||
          'HTTP ' + r.status + (r.statusText ? ' ' + r.statusText : '');
        return { ok: false, status: r.status, data: j, error: String(httpErr) };
      }
      if (j == null) {
        return { ok: false, status: r.status, error: 'Respons kosong atau bukan JSON' };
      }
      if (j.ok === false) {
        return {
          ok: false,
          status: r.status,
          data: j,
          error: String(j.error || j.message || 'Permintaan ditolak server'),
        };
      }
      return { ok: true, status: r.status, data: j };
    } catch (e) {
      return {
        ok: false,
        status: 0,
        error: e && e.message ? e.message : 'Gagal menghubungi server',
      };
    }
  };

  /** Toast error jika gagal; toast sukses opsional. */
  window.sigajiApiToast = function (result, okMsg) {
    if (!result || !result.ok) {
      if (typeof toast === 'function') {
        toast('Gagal: ' + (result && result.error ? result.error : 'tidak diketahui'));
      }
      return false;
    }
    if (okMsg && typeof toast === 'function') toast(okMsg);
    return true;
  };
})();
