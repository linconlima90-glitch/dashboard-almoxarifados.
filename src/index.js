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

export default {
  async fetch(request, env) {
    // Enquanto a senha secreta ainda não estiver cadastrada na Cloudflare,
    // o dashboard continua acessível para evitar indisponibilidade acidental.
    if (!env.DASHBOARD_PASSWORD) {
      return env.ASSETS.fetch(request);
    }

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

    const response = await env.ASSETS.fetch(request);
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
