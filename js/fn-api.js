/**
 * URL Functions SiGaji:
 * - Cloudflare Pages (pages.dev, cemerlang.online, …): /api/...
 * - Netlify (*.netlify.app): /.netlify/functions/...
 */
(function (global) {
  var _prefix = null;

  function isNetlifyAppHost(host) {
    return /\.netlify\.app$/i.test(host);
  }

  function isCloudflareApiHost(host) {
    if (!host) return false;
    if (/\.pages\.dev$/i.test(host) || host === 'pages.dev') return true;
    if (/cemerlang\.online$/i.test(host)) return true;
    return false;
  }

  function detectPrefix() {
    if (_prefix) return _prefix;
    var host = (global.location && global.location.hostname) || '';
    if (isNetlifyAppHost(host)) {
      _prefix = '/.netlify/functions';
    } else if (isCloudflareApiHost(host)) {
      _prefix = '/api';
    } else {
      _prefix = '/api';
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
          'API tidak aktif — pastikan deploy terbaru (URL /api/...) dan env SIGAJI_SUPABASE_* di Cloudflare.',
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
