/**
 * Branding halaman login dari Supabase (online) — tanpa login, tanpa localStorage.
 */
(function () {
  var TK =
    typeof window.SIGAJI_TENANT_KEY === 'string' && window.SIGAJI_TENANT_KEY.trim()
      ? window.SIGAJI_TENANT_KEY.trim()
      : 'main';

  function pickBranding(obj) {
    if (!obj || typeof obj !== 'object') return null;
    var nama = String(obj.nama || '').trim();
    var logo = String(obj.logo || '').trim();
    if (!nama && !logo) return null;
    return { nama: nama, logo: logo };
  }

  async function fetchLoginBranding(sb) {
    if (!sb) return null;

    try {
      var rpc = await sb.rpc('sigaji_get_login_branding');
      if (!rpc.error) {
        var b = pickBranding(rpc.data);
        if (b) return b;
      }
    } catch (e) {
      console.warn('Sigaji branding RPC:', e);
    }

    try {
      var row = await sb
        .from('sigaji_store')
        .select('data')
        .eq('tenant_key', TK)
        .eq('store_key', 'perusahaan')
        .maybeSingle();
      if (!row.error && row.data) {
        var b2 = pickBranding(row.data.data);
        if (b2) return b2;
      }
    } catch (e2) {
      console.warn('Sigaji branding store:', e2);
    }

    return null;
  }

  window.sigajiFetchLoginBranding = async function (sb) {
    if (!sb) return;
    var b = await fetchLoginBranding(sb);
    if (!b) return;
    window.sigajiLoginBranding = b;
    if (typeof applyBranding === 'function') applyBranding();
  };
})();
