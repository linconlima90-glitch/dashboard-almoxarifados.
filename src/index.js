function unauthorized() {
  return new Response('Acesso restrito.', {
    status: 401,
    headers: {
      'WWW-Authenticate': 'Basic realm="Dashboard de Almoxarifados", charset="UTF-8"',
      'Cache-Control': 'no-store'
    }
  });
}

function safeEqual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

class DashboardInjector {
  element(element) {
    element.append('<script src="/stock-update.js?v=20260908"></script><script src="/stock-latest-data.js?v=20260908-1530"></script><script src="/stock-latest.js?v=20260908-1530"></script><script src="/purchase-update.js?v=20260908-2"></script><script src="/purchase-variation.js?v=20260908-2"></script>', { html: true });
  }
}

export default {
  async fetch(request, env) {
    if (env.DASHBOARD_PASSWORD) {
      const auth = request.headers.get('Authorization') || '';
      if (!auth.startsWith('Basic ')) return unauthorized();

      let decoded = '';
      try {
        decoded = atob(auth.slice(6));
      } catch {
        return unauthorized();
      }

      const sep = decoded.indexOf(':');
      if (sep < 0) return unauthorized();

      const user = decoded.slice(0, sep);
      const password = decoded.slice(sep + 1);
      const expectedUser = env.DASHBOARD_USER || 'gestao';

      if (!safeEqual(user, expectedUser) || !safeEqual(password, env.DASHBOARD_PASSWORD)) {
        return unauthorized();
      }
    }

    let response = await env.ASSETS.fetch(request);

    const url = new URL(request.url);
    const contentType = response.headers.get('content-type') || '';
    if ((url.pathname === '/' || url.pathname.endsWith('.html')) && contentType.includes('text/html')) {
      response = new HTMLRewriter().on('body', new DashboardInjector()).transform(response);
    }

    const headers = new Headers(response.headers);
    headers.set('Cache-Control', 'private, no-store');
    headers.set('X-Robots-Tag', 'noindex, nofollow, noarchive');
    headers.set('X-Content-Type-Options', 'nosniff');
    headers.set('Referrer-Policy', 'no-referrer');
    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers
    });
  }
};
