"""Compare the actual legacy and optimized application in Chromium."""
import functools
import http.server
import json
import os
import threading
from pathlib import Path
from playwright.sync_api import sync_playwright

root = Path(__file__).resolve().parents[1]
class QuietHandler(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *args):
        pass
server = http.server.ThreadingHTTPServer(('127.0.0.1', 0), functools.partial(QuietHandler, directory=str(root / 'dist')))
threading.Thread(target=server.serve_forever, daemon=True).start()
base = f'http://127.0.0.1:{server.server_port}'
SNAPSHOT = """() => ({
 stock: STOCK.map(x=>[x.empresa,x.codigo_local,x.local,x.codigo,x.produto,x.grupo,x.un,x.estoque,x.custo_estoque,x.valor_estoque]).sort((a,b)=>JSON.stringify(a).localeCompare(JSON.stringify(b))),
 movements: MOVEMENTS.map(x=>[x.local,x.codigo,x.total,x.avg,x.qtd_set_20261008,x.valor_set_20261008]).sort((a,b)=>JSON.stringify(a).localeCompare(JSON.stringify(b))),
 purchases: PURCHASES,
 quotes: QUOTES,
 meta: window.CURRENT_STOCK_META,
 months: window.STOCK_MINIMUM_MONTHS
})"""
results = {}
with sync_playwright() as p:
    options = {'headless': True, 'args': ['--no-sandbox']}
    executable = os.environ.get('CHROMIUM_PATH')
    if executable:
        options['executable_path'] = executable
    browser = p.chromium.launch(**options)
    snapshots = {}
    for name, route, optimized in [
        ('legacy', '/_benchmark/general.html', False),
        ('fast', '/', True),
        ('legacyPilot', '/_benchmark/pilot.html', False),
        ('fastPilot', '/_fast-sao-joao/', True)
    ]:
        page = browser.new_page(viewport={'width': 1440, 'height': 1000})
        errors, requests = [], []
        page.on('pageerror', lambda error: errors.append(str(error)))
        page.on('request', lambda request: requests.append(request.url))
        page.goto(base + route, wait_until='load', timeout=120000)
        page.wait_for_function("window.CURRENT_STOCK_META && window.STOCK_MINIMUM_MONTHS===2", timeout=90000)
        if optimized:
            page.wait_for_function("document.documentElement.dataset.fastReady==='1'")
        page.wait_for_timeout(600)
        snapshots[name] = page.evaluate(SNAPSHOT)
        results[name] = {
            'stockRows': len(snapshots[name]['stock']),
            'stockValue': round(sum(x[9] for x in snapshots[name]['stock']), 2),
            'requests': len(requests),
            'errors': errors.copy(),
            'navigationMs': page.evaluate("performance.getEntriesByType('navigation')[0].loadEventEnd"),
            'rendering': page.evaluate("window.DB_FAST?.stats || null")
        }
        if optimized and 'Pilot' not in name:
            for view in ['geral', 'estoque', 'baixas', 'minimo', 'produtos', 'fornecedores', 'historico', 'cdi', 'variacao', 'economia', 'orcamentos']:
                selector = f'.tab[data-view="{view}"]'
                if not page.locator(selector).count():
                    continue
                page.locator(selector).evaluate('(el)=>el.click()')
                page.wait_for_timeout(120)
                assert page.locator('#view-' + view).evaluate("el=>el.classList.contains('active')"), view
            page.locator('.tab[data-view="estoque"]').evaluate('(el)=>el.click()')
            if not page.locator('#fBusca').is_visible():
                page.locator('.clean-filter-toggle').click()
            page.locator('#fBusca').fill('ROLAMENTO')
            page.wait_for_timeout(150)
            page.locator('#fBusca').fill('')
            page.wait_for_timeout(100)
            values = page.evaluate("""() => ({local:MOVEMENTS.every(x=>Math.abs(x.minimum-(Number(x.avg)||0)*2)<1e-8),cdi:cdiNetworkAllRows().every(x=>Math.abs(x.minimum-minimumRoundUp(x.avg*2,x.un))<1e-8),annual:minimumRowsForYear(minimumBaseRows(),'2026').every(x=>Math.abs(x.minimum-minimumRoundUp(x.avg*2,x.un))<1e-8)})""")
            assert all(values.values()), values
            results[name]['minimumChecks'] = values
            assert not page.evaluate('DB_FAST.stats.errors'), page.evaluate('DB_FAST.stats.errors')
        if optimized and 'Pilot' in name:
            for tab in ['stock', 'replenishment', 'consumption', 'overview']:
                page.locator(f'[data-sj-tab="{tab}"]').click()
                page.wait_for_timeout(80)
                assert page.locator('#sj-content').inner_text().strip()
            assert page.locator('#sj-pilot-root h1').inner_text() == 'Almoxarifado S\u00e3o Jo\u00e3o'
        results[name]['errors'] = errors.copy()
        page.close()
    assert snapshots['legacy'] == snapshots['fast'], 'Management data changed'
    assert snapshots['legacyPilot'] == snapshots['fastPilot'], 'Pilot data changed'
    assert not results['fast']['errors'], results['fast']['errors']
    assert not results['fastPilot']['errors'], results['fastPilot']['errors']
    browser.close()
server.shutdown()
results['rawDataIdentical'] = True
(root / 'browser-test-report.json').write_text(json.dumps(results, ensure_ascii=False, indent=2))
print(json.dumps(results, ensure_ascii=False, indent=2))
