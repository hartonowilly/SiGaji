/**
 * URL Functions SiGaji: Netlify (/.netlify/functions) atau Cloudflare Pages (/netlify/functions).
 */
(function (global) {
  var _prefix = null;

  function detectPrefix() {
    if (_prefix) return _prefix;
    var host = (global.location && global.location.hostname) || '';
    if (/\.pages\.dev$/i.test(host) || host === 'pages.dev') {
      _prefix = '/netlify/functions';
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

  global.sigajiFunctionUrl = sigajiFunctionUrl;
  global.sigajiFunctionsPrefix = detectPrefix;
})(typeof window !== 'undefined' ? window : globalThis);
