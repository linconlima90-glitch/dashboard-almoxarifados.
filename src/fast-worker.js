import legacyWorker from './index.js';

function unauthorized() {
  return new Response('Acesso restrito.', { status: 401, headers: {
    'WWW-Authenticate': 'Basic realm="Dashboard de Almoxarifados", charset="UTF-8"',
    'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff'
  }});
}
function safeEqual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return false;
  let difference = 0;
  for (let i = 0; i < a.length; i++) difference |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return difference === 0;
}
export default {
  async fetch(request, env) {
    if (env.DASHBOARD_PASSWORD) {
      const auth = request.headers.get('Authorization') || '';
      if (!auth.startsWith('Basic ')) return unauthorized();
      let decoded;
      try { decoded = atob(auth.slice(6)); } catch { return unauthorized(); }
      const colon = decoded.indexOf(':');
      if (colon < 0 || !safeEqual(decoded.slice(0, colon), env.DASHBOARD_USER || 'gestao') ||
          !safeEqual(decoded.slice(colon + 1), env.DASHBOARD_PASSWORD)) return unauthorized();
    }
    const url = new URL(request.url);
    const isPortal = url.pathname === '/' || url.pathname === '/portal' || url.pathname === '/portal/';
    const isManagement = url.pathname === '/almoxarifados' || url.pathname === '/almoxarifados/';
    const isFuel = url.pathname === '/combustiveis' || url.pathname === '/combustiveis/';
    const chua = ['/chua', '/chua/', '/fazenda-chua', '/fazenda-chua/'].includes(url.pathname);
    const pilot = chua || url.pathname === '/sao-joao' || url.pathname === '/sao-joao/';
    // Recovery route retains the original page and injector, with the same auth.
    if (url.searchParams.get('legacy') === '1' && (isManagement || pilot)) {
      const originalAssets = env.ASSETS;
      return legacyWorker.fetch(request, { ...env, ASSETS: { fetch(assetRequest) {
        const assetUrl = new URL(assetRequest.url);
        if (assetUrl.pathname === '/') { assetUrl.pathname = '/_legacy/'; assetUrl.search = ''; }
        return originalAssets.fetch(new Request(assetUrl, assetRequest));
      }}});
    }
    const assetUrl = new URL(request.url);
    if (isPortal) { assetUrl.pathname = '/portal'; assetUrl.search = ''; }
    else if (isManagement) { assetUrl.pathname = '/'; assetUrl.search = ''; }
    else if (isFuel) { assetUrl.pathname = '/combustiveis'; assetUrl.search = ''; }
    else if (chua) { assetUrl.pathname = '/_fast-chua/'; assetUrl.search = ''; }
    else if (pilot) { assetUrl.pathname = '/_fast-sao-joao/'; assetUrl.search = ''; }
    let response = await env.ASSETS.fetch(new Request(assetUrl, request));
    // One-click return to the DB portal, without changing the dashboards' own tabs.
    if ((isManagement || isFuel || pilot) && response.headers.get('content-type')?.includes('text/html')) {
      response = new HTMLRewriter().on('body', {
        element(el) {
          el.prepend('<a href="/" aria-label="Voltar à Central de Gestão DB" style="position:fixed;right:18px;bottom:17px;z-index:2147483640;background:#0d4726;color:#fff;border:2px solid #faca04;border-radius:999px;padding:11px 17px;font:700 13px Arial,sans-serif;text-decoration:none;box-shadow:0 6px 20px rgba(0,0,0,.2)">&#8592; Central DB</a>', { html: true });
        }
      }).transform(response);
    }
    const headers = new Headers(response.headers);
    const hashedAsset = /^\/_fast\/[a-z0-9-]+-[0-9a-f]{16}\.js$/.test(url.pathname);
    const cacheable = hashedAsset && (response.status === 200 || response.status === 304);
    // HTML stays fresh; only content-addressed files receive a long private cache.
    headers.set('Cache-Control', cacheable ? 'private, max-age=31536000, immutable' : 'private, no-store');
    headers.set('X-Robots-Tag', 'noindex, nofollow, noarchive');
    headers.set('X-Content-Type-Options', 'nosniff');
    headers.set('Referrer-Policy', 'no-referrer');
    headers.set('X-Dashboard-Build', 'fast-20261008');
    return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
  }
};
