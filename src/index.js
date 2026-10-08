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

class DashboardHeadInjector {
  constructor(pilot = false) { this.pilot = pilot; }
  element(element) {
    element.append(`
      <script>document.documentElement.classList.add('db-booting');</script>
      <style id="db-boot-style">
        html.db-booting body{margin:0;background:#f2f6f3;overflow:hidden}
        html.db-booting body>*:not(#db-boot-screen){visibility:hidden!important}
        #db-boot-screen{display:none}
        html.db-booting #db-boot-screen{
          position:fixed;inset:0;z-index:2147483647;display:flex;align-items:flex-start;justify-content:center;
          background:#f2f6f3;padding:0;font-family:Arial,Helvetica,sans-serif;color:#2a2a29
        }
        .db-boot-shell{width:100%}
        .db-boot-head{
          height:92px;background:linear-gradient(112deg,#0d4726,#16733b);border-bottom:4px solid #faca04;
          box-shadow:0 6px 20px rgba(13,71,38,.22);display:flex;align-items:center;padding:0 26px;box-sizing:border-box
        }
        .db-boot-mark{
          width:86px;height:48px;border-radius:11px;background:#fff;display:grid;place-items:center;
          font-size:25px;font-weight:900;color:#1e8747;box-shadow:0 5px 16px rgba(0,0,0,.14)
        }
        .db-boot-title{margin-left:17px;color:#fff;font-size:21px;font-weight:900}
        .db-boot-sub{display:block;margin-top:4px;font-size:10px;font-weight:600;opacity:.82}
        .db-boot-content{max-width:1680px;margin:0 auto;padding:16px 22px}
        .db-boot-nav{height:53px;border:1px solid #cdded3;border-radius:14px;background:#fff;box-shadow:0 7px 22px rgba(13,71,38,.08)}
        .db-boot-card{margin-top:12px;height:360px;border:1px solid #d5e3d9;border-radius:14px;background:#fff;box-shadow:0 7px 24px rgba(17,92,49,.07);position:relative;overflow:hidden}
        .db-boot-card:before{content:'';position:absolute;left:0;top:0;bottom:0;width:4px;background:#1e8747}
        .db-boot-line{height:10px;border-radius:999px;background:#edf3ef;margin:18px 20px 0}
        .db-boot-line.short{width:34%}.db-boot-line.mid{width:62%}
        .db-boot-status{margin:18px 2px 0;color:#617066;font-size:11px;font-weight:700}
        @media(max-width:760px){
          .db-boot-head{height:78px;padding:0 14px}.db-boot-mark{width:68px;height:40px;font-size:21px}
          .db-boot-title{font-size:17px;margin-left:11px}.db-boot-content{padding:11px 10px}.db-boot-card{height:300px}
        }
      </style>
      <link rel="preload" href="/layout-clean-v2.js?v=20261008-1" as="script">
      <link rel="preload" href="/db-brand-theme.js?v=20261008-1" as="script">
      <link rel="preload" href="/db-brand-fixes.js?v=20261008-1" as="script">
    `, { html: true });
  }
}

class DashboardInjector {
  constructor(pilot = false) { this.pilot = pilot; }
  element(element) {
    element.prepend(`
      <div id="db-boot-screen" aria-live="polite">
        <div class="db-boot-shell">
          <div class="db-boot-head">
            <div class="db-boot-mark">DB</div>
            <div class="db-boot-title">${this.pilot ? "Almoxarifado São João" : "Gestão de Almoxarifados"}<span class="db-boot-sub">${this.pilot ? "Carregando a visão operacional do local..." : "Carregando a visão atualizada do dashboard..."}</span></div>
          </div>
          <div class="db-boot-content">
            <div class="db-boot-nav"></div>
            <div class="db-boot-card">
              <div class="db-boot-line short"></div>
              <div class="db-boot-line mid"></div>
              <div class="db-boot-line"></div>
            </div>
            <div class="db-boot-status">Preparando estoque, baixas e indicadores.</div>
          </div>
        </div>
      </div>
    `, { html: true });

    element.append(
      '<script src="/layout-clean-v2.js?v=20261008-1"></script>' +
      '<script src="/db-brand-theme.js?v=20261008-1"></script>' +
      '<script src="/db-brand-fixes.js?v=20261008-1"></script>' +
      (this.pilot ? '<script src="/sao-joao-pilot.js?v=20261008-1"></script>' : '') +
      '<script>(function(){var s=document.getElementById("db-boot-screen");if(s)s.remove();document.documentElement.classList.remove("db-booting");})();</script>' +
      '<script src="/stock-update.js?v=20260908"></script>' +
      '<script src="/stock-latest-data.js?v=20260908-1530"></script>' +
      '<script src="/stock-latest.js?v=20260908-1530"></script>' +
      '<script src="/purchase-data-1.js?v=20260909"></script>' +
      '<script src="/purchase-data-2.js?v=20260909"></script>' +
      '<script src="/purchase-data-3.js?v=20260909"></script>' +
      '<script src="/purchase-data-4.js?v=20260909"></script>' +
      '<script src="/purchase-update.js?v=20260909"></script>' +
      '<script src="/purchase-variation.js?v=20260908-2"></script>' +
      '<script src="/quote-update-newfix-45978601.js?v=20260908"></script>' +
      '<script src="/quote-update-lima-ferramentas-03092026.js?v=20260908"></script>' +
      '<script src="/quote-update-casa-parafusos-24796.js?v=20260908"></script>' +
      '<script src="/quote-update-amev-26093.js?v=20260908"></script>' +
      '<script src="/economy-potential-init.js?v=20260909"></script>' +
      '<script src="/econ-chunk-1.js?v=20260909"></script>' +
      '<script src="/econ-chunk-2.js?v=20260909"></script>' +
      '<script src="/econ-chunk-3.js?v=20260909"></script>' +
      '<script src="/econ-chunk-4.js?v=20260909"></script>' +
      '<script src="/econ-chunk-5.js?v=20260909"></script>' +
      '<script src="/econ-chunk-6.js?v=20260909"></script>' +
      '<script src="/econ-chunk-7.js?v=20260909"></script>' +
      '<script src="/economy-potential-full-loader.js?v=20260910-fast"></script>' +
      '<script src="/economy-potential-ui.js?v=20260910-fast"></script>' +
      '<script src="/policy-rules-0909.js?v=20260909-3"></script>' +
      '<script src="/executive-board-v3.js?v=20260909-2"></script>' +
      '<script src="/executive-product-filter.js?v=20260909"></script>' +
      '<script src="/executive-interactive.js?v=20260909"></script>' +
      '<script src="/capital-hierarchy.js?v=20260911-3"></script>' +
      '<script src="/executive-only-capital.js?v=20260911-1"></script>' +
      '<script src="/movement-update-20260930.js?v=20260930-1"></script><script src="/movement-update-20261001.js?v=20261001-1"></script>' +
      '<script src="/stock-current-b64-init.js?v=20261008-1"></script>' +
      '<script src="/stock-current-20261008-01.js?v=20261008-1"></script>' +
      '<script src="/stock-current-20261008-02.js?v=20261008-1"></script>' +
      '<script src="/stock-current-20261008-03.js?v=20261008-1"></script>' +
      '<script src="/stock-current-20261008-04.js?v=20261008-1"></script>' +
      '<script src="/stock-current-20261008-05.js?v=20261008-1"></script>' +
      '<script src="/stock-current-20261008-06.js?v=20261008-1"></script>' +
      '<script src="/stock-current-20261008-07.js?v=20261008-1"></script>' +
      '<script src="/stock-current-20261008-08.js?v=20261008-1"></script>' +
      '<script src="/stock-current-20261008-09.js?v=20261008-1"></script>' +
      '<script src="/current-stock-loader-20260911.js?v=20261008-1"></script>' +
      '<script src="/tire-stock-dashboard-20260930.js?v=20261008-1"></script>',
      { html: true }
    );
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

    const url = new URL(request.url);
    const isPilot = url.pathname === '/sao-joao' || url.pathname === '/sao-joao/';
    let response;
    if (isPilot) {
      const assetUrl = new URL(request.url);
      assetUrl.pathname = '/';
      assetUrl.search = '';
      response = await env.ASSETS.fetch(new Request(assetUrl.toString(), request));
    } else {
      response = await env.ASSETS.fetch(request);
    }

    const contentType = response.headers.get('content-type') || '';
    const isHtml = (isPilot || url.pathname === '/' || url.pathname.endsWith('.html')) && contentType.includes('text/html');

    if (isHtml) {
      response = new HTMLRewriter()
        .on('head', new DashboardHeadInjector(isPilot))
        .on('body', new DashboardInjector(isPilot))
        .transform(response);
    }

    const headers = new Headers(response.headers);
    const fastUiAsset = /^\/(?:layout-clean-v2|db-brand-theme|db-brand-fixes|sao-joao-pilot)\.js$/.test(url.pathname) || url.pathname === '/db-logo.svg';
    if (isHtml) {
      headers.set('Cache-Control', 'private, no-store');
    } else if (fastUiAsset) {
      headers.set('Cache-Control', 'private, max-age=604800, immutable');
    } else {
      headers.set('Cache-Control', 'private, no-store');
    }
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
