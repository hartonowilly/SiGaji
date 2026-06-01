/**
 * URL Functions SiGaji:
 * - Cloudflare Pages: /api/... (hindari bentrok folder statis netlify/)
 * - Netlify: /.netlify/functions/...
 */
(function (global) {
  var _prefix = null;

  function isCloudflareHost(host) {
    return /\.pages\.dev$/i.test(host) || /\.cemerlang\.online$/i.test(host);
  }

  function detectPrefix() {
    if (_prefix) return _prefix;
    var host = (global.location && global.location.hostname) || '';
    if (isCloudflareHost(host)) {
      _prefix = '/api';
    } else {
      _prefix = '/.netlify/functions';
    }
    return _prefix;
  }

  function sigajiFunctionUrl(name) {
    var base = detectPrefix();
    var n = String(name || '').replace(/^\//, '');
    return base + '/' + n;
  }

  async function sigajiParseFunctionJson(response) {
    var ct = (response.headers && response.headers.get('content-type')) || '';
    if (ct.indexOf('application/json') >= 0) {
      return response.json().catch(function () {
        return null;
      });
    }
    if (ct.indexOf('text/html') >= 0 || response.status === 404) {
      return {
        ok: false,
        error:
          'API tidak aktif (deploy Cloudflare Functions /api/ atau cek env SIGAJI_SUPABASE_*).',
      };
    }
    return response.json().catch(function () {
      return null;
    });
  }

  global.sigajiFunctionUrl = sigajiFunctionUrl;
  global.sigajiFunctionsPrefix = detectPrefix;
  global.sigajiParseFunctionJson = sigajiParseFunctionJson;
})(typeof window !== 'undefined' ? window : globalThis);
