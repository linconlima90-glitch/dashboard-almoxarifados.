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
 movements: MOVEMENTS.map(x=>[x.local,x.codigo,x.total,x.avg,x.qtd_set_20261015,x.valor_set_20261015]).sort((a,b)=>JSON.stringify(a).localeCompare(JSON.stringify(b))),
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
        page.wait_for_function("window.CURRENT_STOCK_META && window.STOCK_MINIMUM_MONTHS===2 && window.MOVEMENTS_REVISED_META?.records===4227", timeout=90000)
        if optimized:
            page.wait_for_function("document.documentElement.dataset.fastReady==='1'")
        page.wait_for_timeout(600)

        purchase_checks = page.evaluate("""() => ({
          sep: PURCHASES.filter(x=>x.data.slice(3)==='09/2026').length,
          oct: PURCHASES.filter(x=>x.data.slice(3)==='10/2026').length,
          sepValue: Math.round(PURCHASES.filter(x=>x.data.slice(3)==='09/2026').reduce((s,x)=>s+x.valor,0)*100)/100,
          octValue: Math.round(PURCHASES.filter(x=>x.data.slice(3)==='10/2026').reduce((s,x)=>s+x.valor,0)*100)/100,
          monthlyOct: MONTHLY.find(x=>x.mes==='10/2026')?.valor||0,
          distinctNewSuppliers: [...document.querySelector('#fFornecedor').options].some(x=>x.value==='MARTINS COM.SERV.DISTRIBUICAO S/A'),
          correctMeta: window.LATEST_PURCHASE_META?.rowsSinceAugust===484 && window.LATEST_PURCHASE_META?.duplicateRowsRemoved===4
        })""")
        assert purchase_checks['sep']==252 and purchase_checks['oct']==25, purchase_checks
        assert abs(purchase_checks['sepValue']-147326.33)<0.02 and abs(purchase_checks['octValue']-10523.76)<0.02, purchase_checks
        assert abs(purchase_checks['monthlyOct']-10523.76)<0.02, purchase_checks
        assert purchase_checks['distinctNewSuppliers'] and purchase_checks['correctMeta'], purchase_checks

        snapshots[name] = page.evaluate(SNAPSHOT)
        results[name] = {
            'stockRows': len(snapshots[name]['stock']),
            'stockValue': round(sum(x[9] for x in snapshots[name]['stock']), 2),
            'requests': len(requests),
            'errors': errors.copy(),
            'navigationMs': page.evaluate("performance.getEntriesByType('navigation')[0].loadEventEnd"),
            'rendering': page.evaluate("window.DB_FAST?.stats || null")
        }

        if optimized:
            stockmeta=page.evaluate("""() => ({
                emitted:window.CURRENT_STOCK_META?.emissao,
                total:STOCK.reduce((s,x)=>s+(Number(x.valor_estoque)||0),0),
                warehouses:new Set(STOCK.map(x=>x.local)).size,
                preserveHistory:window.MOVEMENTS_REVISED_META?.records===4227,
                preserveMin:window.STOCK_MINIMUM_MONTHS===2
            })""")
            assert stockmeta['emitted']=='15/10/2026 13:40:03', stockmeta
            assert abs(stockmeta['total']-2214346.67)<0.01 and stockmeta['warehouses']==8, stockmeta
            assert stockmeta['preserveHistory'] and stockmeta['preserveMin'], stockmeta
        if optimized and 'Pilot' not in name:
            for view in ['geral', 'estoque', 'sem-baixas', 'baixas', 'minimo', 'produtos', 'fornecedores', 'historico', 'cdi', 'variacao', 'economia', 'orcamentos']:
                selector = f'.tab[data-view="{view}"]'
                if not page.locator(selector).count():
                    continue
                page.locator(selector).evaluate('(el)=>el.click()')
                page.wait_for_timeout(120)
                assert page.locator('#view-' + view).evaluate("el=>el.classList.contains('active')"), view

            # A aba e criada dinamicamente antes do layout e usa o historico reconciliado.
            assert page.locator('.clean-sub-btn[data-view="sem-baixas"]').count() >= 0
            page.locator('.tab[data-view="sem-baixas"]').evaluate('(el)=>el.click()')
            page.wait_for_function("window.STOCK_NO_WITHDRAWAL_META && window.STOCK_NO_WITHDRAWAL_META.filteredRows >= 0", timeout=20000)
            no_withdrawals = page.evaluate("""() => {
              const m=window.STOCK_NO_WITHDRAWAL_META;
              const source=window.STOCK_NO_WITHDRAWAL.getRows();
              const displayed=[...document.querySelectorAll('#ns-rows tr[data-ns-value]')].map(x=>Number(x.dataset.nsValue));
              const mixed=new Set((window.MOVEMENTS_REVISED_META.mixedUnits||[]).map(x=>String(x.codigo_local)+'|'+String(x.codigo)));
              const movementKeys=new Set(MOVEMENTS.filter(x=>Number(x.total)>0).map(x=>String(x.local)+'|'+String(x.codigo)));
              return {
                rows:source.length,filtered:m.filteredRows,position:m.stockDate,
                anyItems:source.length>0,
                noWithdrawals:source.every(x=>!movementKeys.has(x.local+'|'+x.codigo)),
                noMixed:source.every(x=>!STOCK.some(s=>String(s.codigo)===x.codigo&&s.local===x.local&&mixed.has(String(s.codigo_local)+'|'+x.codigo))),
                sortedByValue:displayed.every((x,i)=>!i||displayed[i-1]>=x),
                firstPage:displayed.length<=100,
                header:document.querySelector('#view-sem-baixas h2')?.textContent,
                purchaseHistoryAvailable:source.some(x=>x.historyCount>0),
                groupLabel:[...document.querySelectorAll('.clean-primary-btn')].some(x=>x.textContent==='Estoque')
              };
            }""")
            assert no_withdrawals['anyItems'] and no_withdrawals['noWithdrawals'] and no_withdrawals['noMixed'], no_withdrawals
            assert no_withdrawals['sortedByValue'] and no_withdrawals['firstPage'], no_withdrawals
            assert no_withdrawals['filtered']==no_withdrawals['rows'] and no_withdrawals['purchaseHistoryAvailable'], no_withdrawals
            assert no_withdrawals['position']=='15/10/2026 13:40:03', no_withdrawals
            assert no_withdrawals['header']=='Estoque sem baixas registradas' and no_withdrawals['groupLabel'], no_withdrawals
            page.locator('#ns-order').select_option('quantidade')
            sorted_qty=page.evaluate("() => [...document.querySelectorAll('#ns-rows tr[data-ns-quantity]')].map(x=>Number(x.dataset.nsQuantity)).every((x,i,a)=>!i||a[i-1]>=x)")
            assert sorted_qty, 'Quantity ordering failed'
            page.locator('#ns-order').select_option('unitario')
            sorted_unit = page.evaluate("""() => {
              const values=[...document.querySelectorAll('#ns-rows tr[data-ns-unit-value]')].map(x=>Number(x.dataset.nsUnitValue));
              return {
                count:values.length,
                ordered:values.every((x,i)=>!i||values[i-1]>=x),
                heading:[...document.querySelectorAll('#view-sem-baixas thead th')].some(x=>x.textContent.trim()==='Valor unitário'),
                caption:document.querySelector('#ns-caption').textContent.includes('maior valor unitário')
              };
            }""")
            assert sorted_unit['count']>1 and sorted_unit['ordered'] and sorted_unit['heading'] and sorted_unit['caption'], sorted_unit
            page.locator('#ns-scope').select_option('rede')
            strict=page.evaluate("""() => ({count:window.STOCK_NO_WITHDRAWAL_META.filteredRows,
              rows:window.STOCK_NO_WITHDRAWAL.getRows().filter(x=>!MOVEMENTS.some(m=>String(m.codigo)===x.codigo&&Number(m.total)>0)).length})""")
            assert strict['count']<=no_withdrawals['rows'], strict
            page.locator('#ns-scope').select_option('local')
            page.locator('#ns-order').select_option('valor')
            local = page.locator('#ns-local option').nth(1).get_attribute('value')
            page.locator('#ns-local').select_option(local)
            filtered_local=page.evaluate("() => [...document.querySelectorAll('#ns-rows tr[data-ns-local]')].every(x=>x.dataset.nsLocal===document.querySelector('#ns-local').value)")
            assert filtered_local, 'Local filter failed'
            page.locator('#ns-local').select_option('')
            hist=page.locator('#ns-rows .ns-history').first
            if hist.count():
                hist.locator('summary').click()
                assert hist.locator('table tbody tr').count()>0, 'Purchase history did not expand'
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
        if 'Pilot' in name:
            assert page.locator('#view-sem-baixas').count()==0, 'Do not alter Sao Joao operational pilot'
        if optimized and 'Pilot' in name:
            for tab in ['stock', 'replenishment', 'consumption', 'overview']:
                page.locator(f'[data-sj-tab="{tab}"]').click()
                page.wait_for_timeout(80)
                assert page.locator('#sj-content').inner_text().strip()
            assert page.locator('#sj-pilot-root h1').inner_text() == 'Almoxarifado S\u00e3o Jo\u00e3o'
        results[name]['errors'] = errors.copy()
        page.close()
    assert results['fast']['stockRows'] == 4087, 'Unexpected stock positions'
    assert results['fastPilot']['stockRows'] == 4087, 'Unexpected Sao Joao stock positions'
    assert abs(results['fast']['stockValue'] - 2214346.67) < 0.01, 'Unexpected stock value'
    assert snapshots['legacy'] == snapshots['fast'], 'Management data changed'
    assert snapshots['legacyPilot'] == snapshots['fastPilot'], 'Pilot data changed'
    assert not results['fast']['errors'], results['fast']['errors']
    assert not results['fastPilot']['errors'], results['fastPilot']['errors']
    browser.close()
server.shutdown()
results['rawDataIdentical'] = True
(root / 'browser-test-report.json').write_text(json.dumps(results, ensure_ascii=False, indent=2))
print(json.dumps(results, ensure_ascii=False, indent=2))
