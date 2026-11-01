/**
 * POST /api/csp-report — penampung laporan Content-Security-Policy (report-uri di _headers).
 * Hanya dicatat ke log Functions (Cloudflare → Pages → Functions → Real-time logs);
 * tidak disimpan ke database dan tidak butuh autentikasi. Dibatasi 8 KB agar tidak jadi
 * sasaran spam.
 */
export async function onRequestPost({ request }) {
  try {
    const len = parseInt(request.headers.get('content-length') || '0', 10);
    if (len > 8192) return new Response(null, { status: 413 });
    const text = await request.text();
    if (text.length > 8192) return new Response(null, { status: 413 });
    let body = null;
    try {
      body = JSON.parse(text);
    } catch (_e) {
      body = { raw: text.slice(0, 500) };
    }
    const r = (body && (body['csp-report'] || body)) || {};
    console.warn(
      'CSP-REPORT',
      JSON.stringify({
        doc: r['document-uri'] || r.documentURL || '',
        directive: r['violated-directive'] || r.effectiveDirective || '',
        blocked: r['blocked-uri'] || r.blockedURL || '',
        src: r['source-file'] || r.sourceFile || '',
        line: r['line-number'] || r.lineNumber || '',
        sample: String(r['script-sample'] || r.sample || '').slice(0, 80),
      })
    );
  } catch (e) {
    console.warn('CSP-REPORT gagal dibaca:', e && e.message);
  }
  return new Response(null, { status: 204 });
}

export async function onRequestGet() {
  return new Response('csp-report: kirim POST', { status: 405 });
}
