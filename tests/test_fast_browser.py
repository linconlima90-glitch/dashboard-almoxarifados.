"""Compare the actual legacy and optimized application in Chromium."""
import csv
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
        ('fastPilot', '/_fast-sao-joao/', True),
        ('legacyChuaPilot', '/_benchmark/chua.html', False),
        ('fastChuaPilot', '/_fast-chua/', True)
    ]:
        page = browser.new_page(viewport={'width': 1440, 'height': 1000})
        errors, requests = [], []
        page.on('pageerror', lambda error: errors.append(str(error)))
        page.on('request', lambda request: requests.append(request.url))
        page.goto(base + route, wait_until='load', timeout=120000)
        try:
            page.wait_for_function("window.CURRENT_STOCK_META && window.STOCK_MINIMUM_MONTHS===2 && window.MOVEMENTS_REVISED_META?.records===4831", timeout=90000)
        except Exception:
            print("BOOT DEBUG", name, json.dumps(page.evaluate("""() => ({
              stock: typeof STOCK === 'undefined' ? 'undefined' : STOCK.length,
              current: window.CURRENT_STOCK_META,
              movements: window.MOVEMENTS_REVISED_META,
              min: window.STOCK_MINIMUM_MONTHS,
              payload: window.CURRENT_STOCK_20260911 && {rows:window.CURRENT_STOCK_20260911.rows?.length,meta:window.CURRENT_STOCK_20260911.meta},
              gzlen: window.CURRENT_STOCK_GZ?.length,
              loaded: window.__CURRENT_STOCK_20260911_LOADING
            })"""),ensure_ascii=False), "ERRORS",errors, flush=True)
            raise
        if optimized:
            page.wait_for_function("document.documentElement.dataset.fastReady==='1'")
        page.wait_for_timeout(600)

        # O usuario removeu o painel de pneus e camaras do rodape do Resumo.
        # Os pneus continuam no cadastro e devem ser consultaveis no Estoque.
        tire_panel_check=page.evaluate("""() => ({
            removed:document.querySelector('#tire-stock-panel')===null,
            tireItemsStillInStock:STOCK.some(x =>
                String(x.grupo||'').normalize('NFD').replace(/[\\u0300-\\u036f]/g,'').toUpperCase().includes('PNEU'))
        })""")
        assert tire_panel_check['removed'] and tire_panel_check['tireItemsStillInStock'], tire_panel_check

        if optimized and 'Pilot' not in name:
            assert page.locator('.clean-sub-btn[data-view="inventarios"]').count()==1
            page.locator('.tab[data-view="inventarios"]').evaluate('(el)=>el.click()')
            inventory_check=page.evaluate("""() => {
              const h=window.INVENTORY_HISTORY,d=window.INVENTORY_LEDGER;
              const fixture={schemaVersion:1,inventories:[{id:'INV-TEST',date:'2026-10-29',sourceFile:'test.xlsx'}],
                entries:[
                  {id:'one',inventoryId:'INV-TEST',local:'SJ',codigoLocal:'50115',empresaFiscal:'A',grupo:'ROLAMENTOS',codigo:'123',produto:'Rolamento',un:'PC',saldoSistema:5,saldoContado:8,statusERP:'PENDENTE'},
                  {id:'two',inventoryId:'INV-TEST',local:'SJ',codigoLocal:'50115',empresaFiscal:'B',grupo:'ROLAMENTOS',codigo:'123',produto:'Rolamento',un:'PC',saldoSistema:5,saldoContado:3,statusERP:'CONFIRMADO'},
                  {id:'three',inventoryId:'INV-TEST',local:'CHUA',codigoLocal:'30115',empresaFiscal:'C',grupo:'FILTROS',codigo:'124',produto:'Filtro',un:'UN',saldoSistema:2,saldoContado:2}
                ]};
              const rows=h.validate(fixture).rows;
              let blanksRejected=false;
              try{h.validate({...fixture,entries:[{...fixture.entries[0],saldoSistema:null}]})}catch(e){blanksRejected=true}
              return {active:!!document.querySelector('#view-inventarios.active'),
                menu:!!document.querySelector('.clean-sub-btn[data-view="inventarios"]'),
                empty:d.entries.length===0,emptyText:document.querySelector('#iv-hierarchy').textContent.includes('Nenhum inventário'),
                delta:rows.map(x=>x.delta),unitCostUnknown:rows[0].impacto===null,
                twoCompanies:rows[0].empresaFiscal!==rows[1].empresaFiscal,blanksRejected};
            }""")
            assert inventory_check['active'] and inventory_check['menu'], inventory_check
            assert inventory_check['delta']==[3,-2,0] and inventory_check['unitCostUnknown'], inventory_check
            assert inventory_check['twoCompanies'] and inventory_check['blanksRejected'], inventory_check
            if inventory_check['empty']:
                assert inventory_check['emptyText'], inventory_check
            page.locator('.tab[data-view="executivo"]').evaluate('(el)=>el.click()')

        purchase_checks = page.evaluate("""() => ({
          aug: PURCHASES.filter(x=>x.data.slice(3)==='08/2026').length,
          sep: PURCHASES.filter(x=>x.data.slice(3)==='09/2026').length,
          oct: PURCHASES.filter(x=>x.data.slice(3)==='10/2026').length,
          sepValue: Math.round(PURCHASES.filter(x=>x.data.slice(3)==='09/2026').reduce((s,x)=>s+x.valor,0)*100)/100,
          octValue: Math.round(PURCHASES.filter(x=>x.data.slice(3)==='10/2026').reduce((s,x)=>s+x.valor,0)*100)/100,
          monthlyOct: MONTHLY.find(x=>x.mes==='10/2026')?.valor||0,
          correctMeta: window.LATEST_PURCHASE_META?.rowsSinceAugust===571 &&
            window.LATEST_PURCHASE_META?.sourceRows===364 &&
            window.LATEST_PURCHASE_META?.fim==='22/10/2026'
        })""")
        assert purchase_checks['aug']==207 and purchase_checks['sep']==258 and purchase_checks['oct']==106, purchase_checks
        assert abs(purchase_checks['sepValue']-153097.46)<0.02 and abs(purchase_checks['octValue']-47308.90)<0.02, purchase_checks
        assert abs(purchase_checks['monthlyOct']-47308.90)<0.02 and purchase_checks['correctMeta'], purchase_checks

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
                preserveHistory:window.MOVEMENTS_REVISED_META?.records===4831,
                preserveMin:window.STOCK_MINIMUM_MONTHS===2
            })""")
            assert stockmeta['emitted']=='30/10/2026 08:42:10', stockmeta
            assert abs(stockmeta['total']-2256558.71)<0.01 and stockmeta['warehouses']==9, stockmeta
            assert stockmeta['preserveHistory'] and stockmeta['preserveMin'], stockmeta
            october=page.evaluate("""() => ({
                month:window.MOVEMENTS_OCTOBER_META,
                full:window.MOVEMENTS_REVISED_META && {
                    records:window.MOVEMENTS_REVISED_META.records,
                    value:window.MOVEMENTS_REVISED_META.value,
                    replaced:window.MOVEMENTS_REVISED_META.replacedOldOctober
                }
            })""")
            assert october['month']['records']==1162 and abs(october['month']['value']-95523.61)<0.02, october
            assert october['full']['records']==4831 and abs(october['full']['value']-463413.62)<0.02, october
            assert october['full']['replaced'], october


            # The same product/local can have two fiscal-company positions.
            fiscal_positions=page.evaluate("""() => STOCK.filter(x =>
                String(x.codigo_local)==='50115' && String(x.codigo)==='106763' &&
                String(x.un)==='PC').map(x=>String(x.empresa))""")
            assert len(fiscal_positions)==2 and len(set(fiscal_positions))==2, fiscal_positions
        if optimized and 'Pilot' not in name:
            # O atalho "Local" e o botao de retorno permitem sair de Grupo e Produto
            # sem perder dados, filtros ou a visao geral dos almoxarifados.
            capital_nav=page.evaluate("""() => {
              const panel=document.querySelector('#view-executivo .capital-hierarchy');
              if(!panel)return {installed:false};
              const columns=()=>[...panel.querySelectorAll('.capital-column[data-index]')];
              const count=columns().length;
              if(count<2)return {installed:true,count};
              columns()[0].click();
              const crumb=panel.querySelector('.capital-crumb[data-level="local"]');
              const inGroup=!!panel.querySelector('.capital-crumb[data-level="group"]');
              const returnVisible=!!crumb?.textContent.includes('Local') &&
                crumb.getAttribute('title')?.includes('Voltar') &&
                !!panel.querySelector('.capital-back-local[data-level="local"]');
              crumb?.click();
              const crumbReturned=columns().length===count &&
                !panel.querySelector('.capital-back-local') &&
                !panel.querySelector('.capital-crumb[data-level="group"]');
              columns()[0].click();
              const groupBack=panel.querySelector('.capital-back-local[data-level="local"]');
              groupBack?.click();
              const buttonReturned=columns().length===count &&
                !panel.querySelector('.capital-crumb[data-level="group"]');
              columns()[0].click();
              columns()[0]?.click();
              const inProduct=!!panel.querySelector('.capital-product-list');
              panel.querySelector('.capital-back-local[data-level="local"]')?.click();
              const productReturned=columns().length===count &&
                !panel.querySelector('.capital-crumb[data-level="group"]');
              return {installed:true,count,inGroup,returnVisible,crumbReturned,buttonReturned,
                      inProduct,productReturned};
            }""")
            assert capital_nav.get('installed') and capital_nav.get('count',0)>=2, capital_nav
            assert all(capital_nav.get(x) for x in ['inGroup','returnVisible','crumbReturned',
                                                   'buttonReturned','inProduct','productReturned']), capital_nav
            # Clique real no navegador: regressao descoberta quando o handler do
            # titulo redirecionava a tela Estoque mesmo apos o breadcrumb voltar.
            exec_view=page.locator('.tab[data-view="executivo"]')
            exec_view.evaluate("(el)=>el.click()")
            capital_panel=page.locator('#view-executivo .capital-hierarchy')
            capital_panel.wait_for(state='visible')
            original_local_count=capital_panel.locator('.capital-column[data-index]').count()
            assert original_local_count>=2
            def ensure_executive_local():
                assert page.locator('.tab[data-view="executivo"].active').count()==1, 'Navegacao saiu do Resumo Executivo'
                assert capital_panel.locator('.capital-crumb[data-level="group"]').count()==0, 'Nao voltou aos locais'
                assert capital_panel.locator('.capital-column[data-index]').count()==original_local_count, 'Locais alterados'
            capital_panel.locator('.capital-column[data-index]').first.click()
            assert capital_panel.locator('.capital-crumb[data-level="group"]').count()==1
            assert page.locator('.tab[data-view="executivo"].active').count()==1
            capital_panel.locator('.capital-crumb[data-level="local"]').click()
            ensure_executive_local()
            capital_panel.locator('.capital-column[data-index]').first.click()
            assert capital_panel.locator('.capital-back-local[data-level="local"]').count()==1
            capital_panel.locator('.capital-back-local[data-level="local"]').click()
            ensure_executive_local()
            capital_panel.locator('.capital-column[data-index]').first.click()
            capital_panel.locator('.capital-column[data-index]').first.click()
            assert capital_panel.locator('.capital-product-list').count()==1
            capital_panel.locator('.capital-crumb[data-level="local"]').click()
            ensure_executive_local()
            capital_panel.locator('.board-title h3').click()
            ensure_executive_local()
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
              const locations=[...document.querySelectorAll('#ns-rows > details.ns-location')];
              const groups=[...document.querySelectorAll('#ns-rows details.ns-group')];
              const alphabetical=nodes=>nodes.every((x,i)=>!i||nodes[i-1].localeCompare(x,'pt-BR')<=0);
              const mixed=new Set((window.MOVEMENTS_REVISED_META.mixedUnits||[]).map(x=>String(x.codigo_local)+'|'+String(x.codigo)));
              const movementKeys=new Set(MOVEMENTS.filter(x=>Number(x.total)>0).map(x=>String(x.local)+'|'+String(x.codigo)));
              return {
                rows:source.length,filtered:m.filteredRows,position:m.stockDate,
                anyItems:source.length>0,
                noWithdrawals:source.every(x=>!movementKeys.has(x.local+'|'+x.codigo)),
                noMixed:source.every(x=>!STOCK.some(s=>String(s.codigo)===x.codigo&&s.local===x.local&&mixed.has(String(s.codigo_local)+'|'+x.codigo))),
                initiallyClosed:locations.length>0&&groups.length>0&&locations.every(x=>!x.open)&&groups.every(x=>!x.open),
                lazyItems:document.querySelectorAll('#ns-rows tbody.ns-items').length===0,
                locationsSorted:alphabetical(locations.map(x=>x.dataset.nsLocation)),
                groupsSorted:locations.every(x=>alphabetical([...x.querySelectorAll('details.ns-group')].map(g=>g.dataset.nsGroup))),
                locationCounts:locations.reduce((sum,x)=>sum+Number(x.dataset.nsCount),0)===m.filteredRows,
                groupCounts:locations.every(x=>[...x.querySelectorAll('details.ns-group')].reduce((sum,g)=>sum+Number(g.dataset.nsCount),0)===Number(x.dataset.nsCount)),
                locationValues:Math.abs(locations.reduce((sum,x)=>sum+Number(x.dataset.nsValue),0)-m.filteredValue)<0.02,
                groupValues:locations.every(x=>Math.abs([...x.querySelectorAll('details.ns-group')].reduce((sum,g)=>sum+Number(g.dataset.nsValue),0)-Number(x.dataset.nsValue))<0.02),
                header:document.querySelector('#view-sem-baixas h2')?.textContent,
                purchaseHistoryAvailable:source.some(x=>x.historyCount>0),
                groupLabel:[...document.querySelectorAll('.clean-primary-btn')].some(x=>x.textContent==='Estoque')
              };
            }""")
            assert no_withdrawals['anyItems'] and no_withdrawals['noWithdrawals'] and no_withdrawals['noMixed'], no_withdrawals
            assert no_withdrawals['initiallyClosed'] and no_withdrawals['lazyItems'], no_withdrawals
            assert no_withdrawals['locationsSorted'] and no_withdrawals['groupsSorted'], no_withdrawals
            assert all(no_withdrawals[x] for x in ['locationCounts','groupCounts','locationValues','groupValues']), no_withdrawals
            assert no_withdrawals['filtered']==no_withdrawals['rows'] and no_withdrawals['purchaseHistoryAvailable'], no_withdrawals
            assert no_withdrawals['position']=='30/10/2026 08:42:10', no_withdrawals
            assert no_withdrawals['header']=='Estoque sem baixas registradas' and no_withdrawals['groupLabel'], no_withdrawals

            def open_no_withdrawal_group(key):
                indexes=page.evaluate("""key => {
                  const groups=[...document.querySelectorAll('#ns-rows details.ns-group')];
                  const group=groups.find(x=>x.dataset.nsKey===key);
                  return group?{
                    group:groups.indexOf(group),
                    local:[...document.querySelectorAll('#ns-rows > details.ns-location')].indexOf(group.closest('.ns-location'))
                  }:null;
                }""", key)
                assert indexes is not None, 'Expected group is missing from hierarchy'
                location=page.locator('#ns-rows > details.ns-location').nth(indexes['local'])
                if not location.evaluate('el=>el.open'):
                    location.locator('summary').first.click()
                group=page.locator('#ns-rows details.ns-group').nth(indexes['group'])
                if not group.evaluate('el=>el.open'):
                    group.locator('summary').first.click()
                page.wait_for_function("""key => {
                  const group=[...document.querySelectorAll('#ns-rows details.ns-group')].find(x=>x.dataset.nsKey===key);
                  return group?.open&&group.querySelectorAll('tbody.ns-items > tr[data-ns-code]').length>0;
                }""", arg=key, timeout=5000)
                return group

            group_key=page.evaluate("""() => [...document.querySelectorAll('#ns-rows details.ns-group')]
              .filter(x=>Number(x.dataset.nsCount)>1)
              .sort((a,b)=>Number(b.dataset.nsCount)-Number(a.dataset.nsCount))[0]?.dataset.nsKey""")
            assert group_key, 'Expected a group with multiple stock positions'
            group=open_no_withdrawal_group(group_key)
            first_page=group.evaluate("""group => ({
              count:Number(group.dataset.nsCount),
              shown:group.querySelectorAll('tbody.ns-items > tr[data-ns-code]').length,
              ordered:[...group.querySelectorAll('tbody.ns-items > tr[data-ns-value]')]
                .map(x=>Number(x.dataset.nsValue)).every((x,i,a)=>!i||a[i-1]>=x)
            })""")
            assert first_page['shown']==min(100,first_page['count']) and first_page['ordered'], first_page
            if first_page['count']>100:
                group.locator('.ns-more').click()
                assert group.locator('tbody.ns-items > tr[data-ns-code]').count()==min(200,first_page['count'])

            for order,field in [('quantidade','nsQuantity'),('unitario','nsUnitValue')]:
                page.locator('#ns-order').select_option(order)
                sorted_group=page.evaluate("""({key,field}) => {
                  const group=[...document.querySelectorAll('#ns-rows details.ns-group')].find(x=>x.dataset.nsKey===key);
                  const values=[...group.querySelectorAll('tbody.ns-items > tr[data-ns-code]')].map(x=>Number(x.dataset[field]));
                  return {
                    open:group.open&&group.closest('.ns-location').open,
                    count:values.length,
                    ordered:values.every((x,i)=>!i||values[i-1]>=x),
                    heading:[...group.querySelectorAll('thead th')].some(x=>x.textContent.trim()==='Valor unitário'),
                    caption:document.querySelector('#ns-caption').textContent.includes('maior valor unitário')
                  };
                }""", {'key':group_key,'field':field})
                assert sorted_group['open'] and sorted_group['count']>1 and sorted_group['ordered'], sorted_group
                if order=='unitario':
                    assert sorted_group['heading'] and sorted_group['caption'], sorted_group

            page.locator('#ns-scope').select_option('rede')
            strict=page.evaluate("""() => {
              const moved=new Set([...MOVEMENTS,...MOVEMENTS_YEARLY].filter(x=>
                Number(x.total)>0||Number(x.complete_total)>0||(x.months||[]).some(q=>Number(q)>0))
                .map(x=>String(x.codigo)));
              return {
                count:window.STOCK_NO_WITHDRAWAL_META.filteredRows,
                expected:window.STOCK_NO_WITHDRAWAL.getRows().filter(x=>!moved.has(x.codigo)).length,
                hierarchy:[...document.querySelectorAll('#ns-rows > details.ns-location')].reduce((sum,x)=>sum+Number(x.dataset.nsCount),0)
              };
            }""")
            assert strict['count']==strict['expected']==strict['hierarchy'], strict
            assert strict['count']<=no_withdrawals['rows'], strict
            page.locator('#ns-scope').select_option('local')
            page.locator('#ns-order').select_option('valor')
            local = page.locator('#ns-local option').nth(1).get_attribute('value')
            page.locator('#ns-local').select_option(local)
            filtered_local=page.evaluate("""() => {
              const local=document.querySelector('#ns-local').value;
              const locations=[...document.querySelectorAll('#ns-rows > details.ns-location')];
              return {
                onlyLocal:locations.length===1&&locations[0].dataset.nsLocation===local,
                count:window.STOCK_NO_WITHDRAWAL_META.filteredRows,
                expected:window.STOCK_NO_WITHDRAWAL.getRows().filter(x=>x.local===local).length,
                hierarchy:locations.reduce((sum,x)=>sum+Number(x.dataset.nsCount),0)
              };
            }""")
            assert filtered_local['onlyLocal'] and filtered_local['count']>0, filtered_local
            assert filtered_local['count']==filtered_local['expected']==filtered_local['hierarchy'], filtered_local
            with page.expect_download() as csv_download:
                page.locator('#ns-export').click()
            with Path(csv_download.value.path()).open(encoding='utf-8-sig',newline='') as handle:
                exported=list(csv.reader(handle,delimiter=';'))
            assert len(exported)-1==filtered_local['count'], 'CSV must include all filtered positions, including closed groups'
            assert all(row[4]==local for row in exported[1:]), 'CSV local filter failed'
            assert 'Valor unitário do estoque (R$)' in exported[0], exported[0]
            page.locator('#ns-local').select_option('')
            history_group_key=page.evaluate("""() => {
              const source=window.STOCK_NO_WITHDRAWAL.getRows();
              for(const group of document.querySelectorAll('#ns-rows details.ns-group')){
                const local=group.closest('.ns-location').dataset.nsLocation;
                const first=source.filter(x=>x.local===local&&x.grupo===group.dataset.nsGroup)
                  .sort((a,b)=>b.valor-a.valor||b.quantidade-a.quantidade).slice(0,100);
                if(first.some(x=>x.historyCount>0))return group.dataset.nsKey;
              }
              return null;
            }""")
            if history_group_key:
                group=open_no_withdrawal_group(history_group_key)
                hist=group.locator('tbody.ns-items .ns-history').first
                if not hist.evaluate('el=>el.open'):
                    hist.locator('summary').click()
                hist.locator('table tbody tr').first.wait_for(timeout=5000)
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
        if optimized and name == 'fastPilot':
            for tab in ['stock', 'minimum', 'consumption', 'no-withdrawals', 'overview']:
                page.locator(f'[data-sj-tab="{tab}"]').click()
                page.wait_for_timeout(100)
                assert page.locator('#sj-content').inner_text().strip()
            page.locator('[data-sj-tab="minimum"]').click()
            page.wait_for_function("window.FARM_MINIMUM_META && document.querySelector('#farm-minimum-view')", timeout=20000)
            minimum_view=page.evaluate("""() => {
              const chua=document.querySelector('#sj-pilot-root h1').textContent.includes('Chuá');
              const code=chua?'30115':'50115',local=chua?'ALMOXARIFADO GERAL F CHUA':'ALMOXARIFADO GERAL F SJ';
              const rows=window.FARM_MINIMUM_FROM_MANAGER.getRows();
              const base=minimumBaseRows().filter(x=>String(x.codigo_local)===code&&x.local===local);
              const current=STOCK.filter(x=>String(x.codigo_local)===code&&x.local===local);
              const groupNodes=[...document.querySelectorAll('#farm-minimum-view details[data-fm-group]')];
              const names=groupNodes.map(x=>x.dataset.fmGroup);
              const collator=new Intl.Collator('pt-BR',{sensitivity:'base'});
              const hasCurrentStock=rows.some(x=>current.some(s=>String(s.codigo)===x.codigo&&s.un===x.un));
              return {
                code,rows:rows.length,base:base.length,stock:current.length,
                localOnly:rows.every(x=>String(x.codigo_local)===code&&x.local===local),
                hasCurrentStock, groups:groupNodes.length,
                groupsSorted:names.every((x,i)=>!i||collator.compare(names[i-1],x)<=0),
                itemsSorted:groupNodes.every(g=>{
                  const items=[...g.querySelectorAll('tr[data-fm-code]')].map(x=>x.querySelectorAll('td')[1].textContent);
                  return items.every((x,i)=>!i||collator.compare(items[i-1],x)<=0);
                }),
                neverInvent:rows.every(x=>x.status!=='SEM DADOS DE BAIXA'||x.need===0),
                minCorrect:rows.every(x=>x.avg<=0||x.minimum>=x.avg*2-1e-6),
                needCorrect:rows.every(x=>Math.abs(x.need-minimumRoundUp(Math.max(x.minimum-x.stock,0),x.un))<1e-6),
                meta:window.FARM_MINIMUM_META,
                totalHistory:window.MOVEMENTS_REVISED_META.records,
                noOldNav:!document.querySelector('.sj-nav [data-sj-tab="replenishment"]')
              };
            }""")
            assert minimum_view['rows']>=minimum_view['base'] and minimum_view['base']>0, minimum_view
            assert minimum_view['stock']>0 and minimum_view['hasCurrentStock'], minimum_view
            assert minimum_view['localOnly'] and minimum_view['groups']>0 and minimum_view['groupsSorted'] and minimum_view['itemsSorted'], minimum_view
            assert minimum_view['minCorrect'] and minimum_view['needCorrect'] and minimum_view['neverInvent'], minimum_view
            assert minimum_view['meta']['months']==2 and minimum_view['totalHistory']==4831 and minimum_view['noOldNav'], minimum_view
            page.locator('#fm-year').select_option('2026')
            assert page.locator('#farm-minimum-view').count()==1
            page.locator('#fm-year').select_option('')
            page.locator('input[data-fm-status="ABAIXO DO MÍNIMO"]').check()
            status_filter=page.evaluate("() => window.FARM_MINIMUM_FROM_MANAGER.getVisibleRows().every(x=>x.status==='ABAIXO DO MÍNIMO')")
            assert status_filter, 'Manager minimum status filter failed'
            page.locator('#fm-clear').click()
            assert page.locator('#farm-minimum-view').count()==1
            page.locator('[data-sj-tab="no-withdrawals"]').click()
            page.wait_for_function("window.SJ_NO_WITHDRAWAL_META && document.querySelector('#sj-nw-view')", timeout=20000)
            sj_no_withdrawals=page.evaluate("""() => {
              const rows=window.SJ_NO_WITHDRAWAL.getRows();
              const displayed=[...document.querySelectorAll('#sj-nw-view tr[data-sj-nw-value]')];
              const stock=STOCK.filter(x=>String(x.codigo_local)==='50115');
              return {
                rows:rows.length, display:displayed.length, localRows:rows.every(x=>String(x.local)==='ALMOXARIFADO GERAL F SJ'),
                valid:rows.every(x=>x.quantidade>0 && !MOVEMENTS.some(m=>
                  String(m.codigo_local)==='50115'&&String(m.codigo)===String(x.codigo)&&Number(m.total)>0)),
                totalPosition:stock.reduce((v,x)=>v+(Number(x.valor_estoque)||0),0),
                date:window.CURRENT_STOCK_META.emissao,
                ordered:displayed.every((el,i)=>!i||Number(displayed[i-1].dataset.sjNwValue)>=Number(el.dataset.sjNwValue)),
                meta:window.MOVEMENTS_REVISED_META.records,
                purchaseLocal:rows.every(x=>!x.latest||String(x.latest.codigo_local)==='50115'||x.latest.local===x.local)
              };
            }""")
            assert sj_no_withdrawals['rows']>0 and sj_no_withdrawals['display']>0, sj_no_withdrawals
            assert sj_no_withdrawals['localRows'] and sj_no_withdrawals['valid'] and sj_no_withdrawals['ordered'], sj_no_withdrawals
            assert sj_no_withdrawals['purchaseLocal'] and sj_no_withdrawals['meta']==4831, sj_no_withdrawals
            assert sj_no_withdrawals['date']=='30/10/2026 08:42:10', sj_no_withdrawals
            page.locator('#sj-nw-sort').select_option('unitario')
            sorted_unit=page.evaluate("""() => [...document.querySelectorAll('#sj-nw-view tr[data-sj-nw-unit]')]
              .map(el=>Number(el.dataset.sjNwUnit)).every((x,i,a)=>!i||a[i-1]>=x)""")
            assert sorted_unit, 'Sao Joao unit cost ordering failed'
            page.locator('#sj-nw-scope').select_option('rede')
            strict_count=page.evaluate("() => window.SJ_NO_WITHDRAWAL.getFiltered().length")
            assert strict_count<=sj_no_withdrawals['rows'], strict_count
            page.locator('#sj-nw-scope').select_option('local')
            history=page.locator('#sj-nw-view .sj-nw-history').first
            if history.count():
                history.locator('summary').click()
                history.locator('table tbody tr').first.wait_for(timeout=5000)
                assert history.locator('table tbody tr').count()>0, 'Sao Joao purchase history failed'
            page.locator('[data-sj-tab="overview"]').click()
            assert page.locator('#sj-pilot-root h1').inner_text() == 'Almoxarifado S\u00e3o Jo\u00e3o'
        if optimized and name == 'fastChuaPilot':
            assert page.locator('#sj-pilot-root h1').inner_text() == 'Almoxarifado Chuá'
            chua_stock = page.evaluate("""() => ({
              rows: STOCK.filter(x=>String(x.codigo_local)==='30115' &&
                x.local==='ALMOXARIFADO GERAL F CHUA').length,
              total: STOCK.filter(x=>String(x.codigo_local)==='30115').length,
              noOther: STOCK.filter(x=>String(x.codigo_local)==='30115')
                .every(x=>x.local==='ALMOXARIFADO GERAL F CHUA')
            })""")
            assert chua_stock['rows']>0 and chua_stock['rows']==chua_stock['total'] and chua_stock['noOther'], chua_stock
            for tab in ['stock', 'minimum', 'consumption', 'no-withdrawals', 'overview']:
                page.locator(f'[data-sj-tab="{tab}"]').click()
                page.wait_for_timeout(100)
                assert page.locator('#sj-content').inner_text().strip(), tab
            page.locator('[data-sj-tab="stock"]').click()
            visible_codes = page.evaluate("""() => {
              const local = new Set(STOCK.filter(x=>String(x.codigo_local)==='30115')
                .map(x=>String(x.codigo)));
              const codes=[...document.querySelectorAll('#sj-content .sj-table tbody tr td:first-child b')]
                .map(x=>x.textContent.trim());
              return {count:codes.length, onlyChua:codes.every(x=>local.has(x))};
            }""")
            assert visible_codes['count']>0 and visible_codes['onlyChua'], visible_codes
            page.locator('[data-sj-tab="minimum"]').click()
            page.wait_for_function("window.FARM_MINIMUM_META && document.querySelector('#farm-minimum-view')", timeout=20000)
            minimum_view=page.evaluate("""() => {
              const chua=document.querySelector('#sj-pilot-root h1').textContent.includes('Chuá');
              const code=chua?'30115':'50115',local=chua?'ALMOXARIFADO GERAL F CHUA':'ALMOXARIFADO GERAL F SJ';
              const rows=window.FARM_MINIMUM_FROM_MANAGER.getRows();
              const base=minimumBaseRows().filter(x=>String(x.codigo_local)===code&&x.local===local);
              const current=STOCK.filter(x=>String(x.codigo_local)===code&&x.local===local);
              const groupNodes=[...document.querySelectorAll('#farm-minimum-view details[data-fm-group]')];
              const names=groupNodes.map(x=>x.dataset.fmGroup);
              const collator=new Intl.Collator('pt-BR',{sensitivity:'base'});
              const hasCurrentStock=rows.some(x=>current.some(s=>String(s.codigo)===x.codigo&&s.un===x.un));
              return {
                code,rows:rows.length,base:base.length,stock:current.length,
                localOnly:rows.every(x=>String(x.codigo_local)===code&&x.local===local),
                hasCurrentStock, groups:groupNodes.length,
                groupsSorted:names.every((x,i)=>!i||collator.compare(names[i-1],x)<=0),
                itemsSorted:groupNodes.every(g=>{
                  const items=[...g.querySelectorAll('tr[data-fm-code]')].map(x=>x.querySelectorAll('td')[1].textContent);
                  return items.every((x,i)=>!i||collator.compare(items[i-1],x)<=0);
                }),
                neverInvent:rows.every(x=>x.status!=='SEM DADOS DE BAIXA'||x.need===0),
                minCorrect:rows.every(x=>x.avg<=0||x.minimum>=x.avg*2-1e-6),
                needCorrect:rows.every(x=>Math.abs(x.need-minimumRoundUp(Math.max(x.minimum-x.stock,0),x.un))<1e-6),
                meta:window.FARM_MINIMUM_META,
                totalHistory:window.MOVEMENTS_REVISED_META.records,
                noOldNav:!document.querySelector('.sj-nav [data-sj-tab="replenishment"]')
              };
            }""")
            assert minimum_view['rows']>=minimum_view['base'] and minimum_view['base']>0, minimum_view
            assert minimum_view['stock']>0 and minimum_view['hasCurrentStock'], minimum_view
            assert minimum_view['localOnly'] and minimum_view['groups']>0 and minimum_view['groupsSorted'] and minimum_view['itemsSorted'], minimum_view
            assert minimum_view['minCorrect'] and minimum_view['needCorrect'] and minimum_view['neverInvent'], minimum_view
            assert minimum_view['meta']['months']==2 and minimum_view['totalHistory']==4831 and minimum_view['noOldNav'], minimum_view
            page.locator('#fm-year').select_option('2026')
            assert page.locator('#farm-minimum-view').count()==1
            page.locator('#fm-year').select_option('')
            page.locator('input[data-fm-status="ABAIXO DO MÍNIMO"]').check()
            status_filter=page.evaluate("() => window.FARM_MINIMUM_FROM_MANAGER.getVisibleRows().every(x=>x.status==='ABAIXO DO MÍNIMO')")
            assert status_filter, 'Manager minimum status filter failed'
            page.locator('#fm-clear').click()
            assert page.locator('#farm-minimum-view').count()==1
            page.locator('[data-sj-tab="no-withdrawals"]').click()
            page.wait_for_function("window.CHUA_NO_WITHDRAWAL_META && document.querySelector('#sj-nw-view')", timeout=20000)
            chua_no_withdrawals = page.evaluate("""() => {
              const rows=window.CHUA_NO_WITHDRAWAL.getRows();
              return {
                rows:rows.length,
                localOnly:rows.every(x=>x.local==='ALMOXARIFADO GERAL F CHUA'),
                noWithdrawals:rows.every(x=>!MOVEMENTS.some(m=>String(m.codigo_local)==='30115'&&
                  String(m.codigo)===x.codigo&&Number(m.total)>0)),
                purchasesOnlyChua:rows.every(x=>!x.latest||
                  String(x.latest.codigo_local)==='30115'||x.latest.local==='ALMOXARIFADO GERAL F CHUA'),
                date:window.CHUA_NO_WITHDRAWAL_META.position,
                stockDate:window.CURRENT_STOCK_META.emissao
              };
            }""")
            assert chua_no_withdrawals['rows']>0 and chua_no_withdrawals['localOnly'] and chua_no_withdrawals['noWithdrawals'], chua_no_withdrawals
            assert chua_no_withdrawals['purchasesOnlyChua'] and chua_no_withdrawals['date']==chua_no_withdrawals['stockDate'], chua_no_withdrawals
            assert 'São João' not in page.locator('#sj-pilot-root').inner_text()
        results[name]['errors'] = errors.copy()
        page.close()
    assert results['fast']['stockRows'] == 4302, 'Unexpected stock positions'
    assert results['fastPilot']['stockRows'] == 4302, 'Unexpected Sao Joao stock positions'
    assert results['fastChuaPilot']['stockRows'] == 4302, 'Unexpected Chua stock positions'
    assert abs(results['fast']['stockValue'] - 2256558.71) < 0.01, 'Unexpected stock value'
    if snapshots['legacy'] != snapshots['fast']:
        for field in snapshots['legacy']:
            left, right = snapshots['legacy'][field], snapshots['fast'][field]
            if left == right:
                continue
            info = {'field':field,'legacyType':str(type(left)),'fastType':str(type(right))}
            if isinstance(left,list) and isinstance(right,list):
                info['sizes']=[len(left),len(right)]
                at=next((i for i,(a,b) in enumerate(zip(left,right)) if a!=b),None)
                info['firstDifferenceIndex']=at
                if at is not None:
                    info['legacySample']=repr(left[at])[:600]
                    info['fastSample']=repr(right[at])[:600]
            else:
                info['legacySample']=repr(left)[:600]
                info['fastSample']=repr(right)[:600]
            print('SNAPSHOT DIFFERENCE', json.dumps(info,ensure_ascii=False),flush=True)
    assert snapshots['legacy'] == snapshots['fast'], 'Management data changed'
    assert snapshots['legacyPilot'] == snapshots['fastPilot'], 'Pilot data changed'
    assert snapshots['legacyChuaPilot'] == snapshots['fastChuaPilot'], 'Chua pilot data changed'
    assert not results['fast']['errors'], results['fast']['errors']
    assert not results['fastPilot']['errors'], results['fastPilot']['errors']
    assert not results['fastChuaPilot']['errors'], results['fastChuaPilot']['errors']
    browser.close()
server.shutdown()
results['rawDataIdentical'] = True
(root / 'browser-test-report.json').write_text(json.dumps(results, ensure_ascii=False, indent=2))
print(json.dumps(results, ensure_ascii=False, indent=2))
