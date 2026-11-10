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
BAIXAS_AUDIT = json.loads((root / 'build-baixas-audit.json').read_text(encoding='utf-8'))
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
            page.wait_for_function("window.CURRENT_STOCK_META && window.STOCK_MINIMUM_MONTHS===2 && window.MOVEMENTS_REVISED_META?.records>19387", timeout=90000)
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

        if optimized and 'Pilot' not in name:
            # Modulo CDI sem planilha: nao deve assumir economia, nem alterar outras bases.
            page.wait_for_function("window.CDI_TRANSFER_CONTROL && document.querySelector('#cdi-transfer-panel')", timeout=20000)
            cdi=page.evaluate("""() => {
              const api=window.CDI_TRANSFER_CONTROL, m=api.summary();
              const r={id:'TEST-TRANSFER',date:'2026-05-07',document:'TOP-1',origin:'CDI CHUA',
                destination:'FAZENDA SAO JOAO',code:'107385',product:'ROLAMENTO',group:'ROLAMENTOS',
                unit:'PC',quantity:2,cdiUnitCost:40,alternativePurchasePrice:55,
                transferCost:10,evidence:'TOP 94 e comprovacao da compra evitada',reviewStatus:'VALIDADO'};
              const fixture={schemaVersion:1,approvalDate:'2026-05-07',transfers:[r]};
              const verified=api.validate(fixture);
              let beforeRejected=false,duplicateRejected=false;
              try{api.validate({...fixture,transfers:[{...r,date:'2026-05-06'}]})}catch(e){beforeRejected=true}
              try{api.validate({...fixture,transfers:[r,r]})}catch(e){duplicateRejected=true}
              return {m,cost:verified[0].comparisonCents,verified:verified[0].validatedCents,
                beforeRejected,duplicateRejected,card:document.querySelector('#cdi-transfer-panel #cdtr-count').textContent};
            }""")
            assert cdi['m']['approvalDate']=='2026-05-07' and cdi['m']['rows']==184 and cdi['m']['status']=='REGISTRADO', cdi
            assert cdi['cost']==2000 and cdi['verified']==2000 and cdi['beforeRejected'] and cdi['duplicateRejected'], cdi
            assert cdi['card'].strip()=='184', cdi
            # Todas as compras para estoque do 30115 sao para distribuicao, nao transferencias.
            purchase30115=page.evaluate("""() => {
              const base=window.CDI_DISTRIBUTION_PURCHASES,panel=document.getElementById('cdi-distribution-purchases');
              return {meta:base.meta,hasPanel:!!panel,groups:base.groups.length,
                sumGroups:base.groups.reduce((s,x)=>s+x.valueCents,0),
                sumMonths:base.months.reduce((s,x)=>s+x.valueCents,0),
                ruleYes:base.qualifies({codigo_local:30115,top:89,data:'07/05/2026'}),
                ruleNoOtherLocal:base.qualifies({codigo_local:50115,top:89,data:'07/05/2026'}),
                ruleNoOtherType:base.qualifies({codigo_local:30115,top:94,data:'07/05/2026'}),
                ruleNoBefore:base.qualifies({codigo_local:30115,top:89,data:'06/05/2026'})};
            }""")
            assert purchase30115['meta']['classification']=='COMPRA_PARA_DISTRIBUICAO', purchase30115
            assert purchase30115['meta']['localCode']=='30115' and purchase30115['meta']['lines']==256, purchase30115
            assert purchase30115['meta']['totalCents']==15019467 and purchase30115['meta']['distinctSkuUnits']==208, purchase30115
            assert purchase30115['groups']==14 and purchase30115['sumGroups']==15019467, purchase30115
            assert purchase30115['sumMonths']==15019467 and purchase30115['hasPanel'], purchase30115
            assert purchase30115['ruleYes'] and not purchase30115['ruleNoOtherLocal'], purchase30115
            assert not purchase30115['ruleNoOtherType'] and not purchase30115['ruleNoBefore'], purchase30115
            # Cascata real baseada nas 256 linhas XLSX (nao somente nos totais agregados).
            page.wait_for_function("window.CDI_DISTRIBUTION_PURCHASES?.cascade?.getRows()?.length===256", timeout=20000)
            cascade_initial=page.evaluate("""() => {
              const x=window.CDI_DISTRIBUTION_PURCHASES;
              return {rows:x.cascade.getRows().length,summary:x.filteredSummary,months:document.querySelectorAll('#dp-month option').length,
                groups:document.querySelectorAll('#dp-group option').length,products:document.querySelectorAll('#dp-product option').length,
                hasDocTable:document.querySelectorAll('#dp-records tr').length===256};
            }""")
            assert cascade_initial['rows']==256 and cascade_initial['summary']['cents']==15019467, cascade_initial
            assert cascade_initial['months']==8 and cascade_initial['groups']==15 and cascade_initial['products']==209, cascade_initial
            assert cascade_initial['hasDocTable'], cascade_initial
            page.locator('#dp-month').evaluate("(el)=>{el.value='2026-05';el.dispatchEvent(new Event('change',{bubbles:true}));}")
            month_summary=page.evaluate('window.CDI_DISTRIBUTION_PURCHASES.filteredSummary')
            assert month_summary['lines']==37 and month_summary['cents']==4001950, month_summary
            first_group=page.locator('#dp-group option').nth(1).get_attribute('value')
            page.locator('#dp-group').evaluate("(el,v)=>{el.value=v;el.dispatchEvent(new Event('change',{bubbles:true}));}", first_group)
            group_summary=page.evaluate('window.CDI_DISTRIBUTION_PURCHASES.filteredSummary')
            assert group_summary['lines']>0 and group_summary['lines']<=37, group_summary
            first_product=page.locator('#dp-product option').nth(1).get_attribute('value')
            page.locator('#dp-product').evaluate("(el,v)=>{el.value=v;el.dispatchEvent(new Event('change',{bubbles:true}));}", first_product)
            product_summary=page.evaluate('window.CDI_DISTRIBUTION_PURCHASES.filteredSummary')
            assert product_summary['lines']>0 and product_summary['lines']<=group_summary['lines'], product_summary
            page.locator('#dp-reset').evaluate("(el)=>el.click()")
            assert page.evaluate('window.CDI_DISTRIBUTION_PURCHASES.filteredSummary.cents')==15019467



        # O usuario removeu o painel de pneus e camaras do rodape do Resumo.
        # Os pneus continuam no cadastro e devem ser consultaveis no Estoque.
        tire_panel_check=page.evaluate("""() => ({
            removed:document.querySelector('#tire-stock-panel')===null,
            tireItemsStillInStock:STOCK.some(x =>
                String(x.grupo||'').normalize('NFD').replace(/[\\u0300-\\u036f]/g,'').toUpperCase().includes('PNEU'))
        })""")
        assert tire_panel_check['removed'] and tire_panel_check['tireItemsStillInStock'], tire_panel_check

        if optimized and 'Pilot' not in name:
            page.locator('.tab[data-view="inventarios"]').evaluate('(el)=>el.click()')
            page.wait_for_function('document.querySelector(\'.clean-sub-btn[data-view="inventarios"]\')!==null')
            assert page.locator('.clean-sub-btn[data-view="inventarios"]').count()==1
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
            actual_inventory=page.evaluate("""() => ({
              rows:window.INVENTORY_HISTORY.getRows().length,
              entries:window.INVENTORY_LEDGER.entries.length,
              positive:window.INVENTORY_LEDGER.entries.filter(x=>x.quantidadeAjuste>0).length,
              negative:window.INVENTORY_LEDGER.entries.filter(x=>x.quantidadeAjuste<0).length,
              distinct:new Set(window.INVENTORY_LEDGER.entries.map(x=>x.codigo)).size,
              correctMissing:window.INVENTORY_HISTORY.getRows().filter(x=>x.tipoRegistro==='AJUSTE').every(x=>x.saldoAnterior===null&&x.quantidadeContada===null),
              impact:window.INVENTORY_HISTORY.getRows().reduce((sum,x)=>sum+x.impacto,0),
              previousInventory:window.INVENTORY_LEDGER.entries.filter(x=>x.inventoryId==='INV-2026-10-30-SJ-CORREIAS-001').length,
              patos:(() => {
                const rows=window.INVENTORY_HISTORY.getRows().filter(x=>x.inventoryId==='INV-2026-11-06-CHUA-PATOS-FILTROS-001');
                return {count:rows.length,positive:rows.filter(x=>x.delta>0).length,
                  negative:rows.filter(x=>x.delta<0).length,
                  netCents:rows.reduce((sum,x)=>sum+Math.round(x.impacto*100),0),
                  correct:rows.every(x=>x.local==='ALMOXARIFADO OFICINA CAMINHOES PATOS'&&
                    x.empresaFiscal==='DECIO BRUXEL E OUTROS - FAZENDA CHUA'&&
                    x.grupo==='FILTROS'&&x.statusERP==='PENDENTE'&&
                    x.saldoAnterior===null&&x.quantidadeContada===null)}
              })()
            })""")
            assert actual_inventory['rows']==216 and actual_inventory['entries']==216, actual_inventory
            assert actual_inventory['positive']==59 and actual_inventory['negative']==64, actual_inventory
            assert actual_inventory['distinct']==214 and actual_inventory['correctMissing'], actual_inventory
            assert actual_inventory['previousInventory']==199, actual_inventory
            assert actual_inventory['patos']=={'count':17,'positive':6,'negative':11,'netCents':-326619,'correct':True}, actual_inventory
            ok_rows=page.evaluate("""() => window.INVENTORY_HISTORY.getRows().filter(x=>x.tipoRegistro==='SEM_DIFERENCA_DECLARADA').map(x=>[x.delta,x.saldoReferencia,x.statusERP])""")
            assert len(ok_rows)==93 and all(x[0]==0 and x[1]>0 and x[2]=='SEM_DIFERENCA' for x in ok_rows), ok_rows[:4]
            assert abs(actual_inventory['impact']+4922.35)<0.02, actual_inventory
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
          total: Math.round(PURCHASES.reduce((s,x)=>s+(Number(x.valor)||0),0)*100)/100,
          rows: PURCHASES.length,
          historical2025: PURCHASES.filter(x=>x.data.endsWith('/2025')).length,
          historical2026: PURCHASES.filter(x=>x.data.endsWith('/2026')).length,
          octoberUnique: (() => {const rows=PURCHASES.filter(x=>x.data.slice(3)==='10/2026');return new Set(rows.map(x=>[x.nrounico,x.seq,x.codigo,x.codigo_local].join('|'))).size===rows.length;})(),
          rollerRef: PURCHASES.find(x=>x.codigo===107385 && String(x.nota)==='138466')?.preco,
          correctMeta: window.LATEST_PURCHASE_META?.audited===true &&
            window.LATEST_PURCHASE_META?.sourceRows===2873 &&
            window.LATEST_PURCHASE_META?.source==='COMPRAS_DE_INSUMOS_POR_LOCAL(1).xlsx'
        })""")
        assert purchase_checks['aug']==197 and purchase_checks['sep']==241 and purchase_checks['oct']==126, purchase_checks
        assert abs(purchase_checks['sepValue']-118631.41)<0.02 and abs(purchase_checks['octValue']-56071.19)<0.02, purchase_checks
        assert abs(purchase_checks['monthlyOct']-56071.19)<0.02 and abs(purchase_checks['total']-1814454.14)<0.02, purchase_checks
        assert purchase_checks['rows']==2873 and purchase_checks['historical2025']==1149 and purchase_checks['historical2026']==1724, purchase_checks
        assert abs(purchase_checks['rollerRef']-62.11)<0.01 and purchase_checks['correctMeta'] and purchase_checks['octoberUnique'], purchase_checks

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
                preserveHistory:window.MOVEMENTS_REVISED_META?.records>19387,
                preserveMin:window.STOCK_MINIMUM_MONTHS===2
            })""")
            assert stockmeta['emitted']=='09/11/2026 10:29:10', stockmeta
            assert abs(stockmeta['total']-2292215.23)<0.01 and stockmeta['warehouses']==9, stockmeta
            assert stockmeta['preserveHistory'] and stockmeta['preserveMin'], stockmeta
            october=page.evaluate("""() => ({
                month:window.MOVEMENTS_OCTOBER_META,
                full:window.MOVEMENTS_REVISED_META && {
                    records:window.MOVEMENTS_REVISED_META.records,
                    value:window.MOVEMENTS_REVISED_META.value,
                    replaced:window.MOVEMENTS_REVISED_META.replacedOldOctober
                }
            })""")
            assert october['month']['records']==BAIXAS_AUDIT['october']['records'] and abs(october['month']['value']-BAIXAS_AUDIT['october']['value'])<0.02, october
            assert october['full']['records']==BAIXAS_AUDIT['revisedRecords'] and abs(october['full']['value']-BAIXAS_AUDIT['totalValue'])<0.02, october
            assert october['full']['replaced'], october
            november=page.evaluate("""() => ({
              meta:window.MOVEMENTS_NOVEMBER_META,
              completed:window.MOVEMENTS_REVISED_META?.completedThrough,
              data:window.MOVEMENTS_REVISED_META?.months,
              hasNovemberYearly:MOVEMENTS_YEARLY.some(x=>String(x.year)==='2026'&&(Number(x.months?.[10])>0))
            })""")
            assert november['meta']['records']==BAIXAS_AUDIT['november']['records'] and abs(november['meta']['value']-BAIXAS_AUDIT['november']['value'])<0.02, november
            assert november['meta']['partial'] and november['completed']=='31/10/2026', november
            assert november['data']['2026-10']['records']==BAIXAS_AUDIT['october']['records'] and november['hasNovemberYearly'], november
            historical=page.evaluate("""() => {
                const meta=window.MOVEMENTS_REVISED_META;
                const target=MOVEMENTS.find(x=>String(x.codigo_local)==='50115'&&String(x.codigo)==='105099');
                const annual=MOVEMENTS_YEARLY.filter(x=>String(x.codigo_local)==='50115'&&String(x.codigo)==='105099');
                return {years:meta.years,minimum:meta.forMinimum,first:meta.from,
                    year2024:annual.some(x=>String(x.year)==='2024'),
                    target:target && {total:target.total,complete:target.complete_total,average:target.avg},
                    annual:annual.map(x=>({year:String(x.year),total:x.total})),
                    historyPanel:!!document.querySelector('#full-movement-history')};
            }""")
            assert historical['years']['2024']['records']==BAIXAS_AUDIT['annual']['2024']['records'] and historical['first']=='2024-03-14', historical
            assert historical['years']['2025']['records']==BAIXAS_AUDIT['annual']['2025']['records'] and historical['years']['2026']['records']==BAIXAS_AUDIT['annual']['2026']['records'], historical
            assert historical['minimum']['years']==[2025,2026] and historical['minimum']['months']==22, historical
            assert not historical['year2024'] and len(historical['annual'])==2, historical
            assert abs(historical['target']['complete']-11)<0.00001 and abs(historical['target']['average']-0.5)<0.00001, historical
            if 'Pilot' not in name:
                page.wait_for_function("document.querySelector('#full-movement-history') !== null", timeout=20000)
                assert page.locator('#full-movement-history').count()==1, historical
            else:
                assert not historical['historyPanel'], 'Consulta consolidada nao pertence ao piloto'




            # The same product/local can have two fiscal-company positions.
            fiscal_positions=page.evaluate("""() => STOCK.filter(x =>
                String(x.codigo_local)==='50115' && String(x.codigo)==='106763' &&
                String(x.un)==='PC').map(x=>String(x.empresa))""")
            assert len(fiscal_positions)==2 and len(set(fiscal_positions))==2, fiscal_positions
        if optimized and 'Pilot' not in name:
            # O cartao de baixas usa o Custo_Total do ERP (Dt.Neg.), nao a
            # estimativa do custo medio do estoque nem o consumo do minimo.
            page.wait_for_function("window.DB_BAIXAS_ERP_CONFERIDO && document.querySelector('#db-baixas-erp-conferido')", timeout=20000)
            erp = page.evaluate("""() => {
              const p=window.MOVEMENTS_COMPLETE_20261103;
              const D=p.dict,rows=p.rows;
              const local=(i)=>String(D.local[i]?.[1]||'');
              const visible=rows.filter(r=>!['ALMOXARIFADO GERAL G GERIBA','ALMOXARIFADO GERAL G S CRUZ'].includes(
                local(r[1]).normalize('NFD').replace(/[\\u0300-\\u036f]/g,'').toUpperCase()));
              const cost=visible.reduce((v,r)=>v+Number(r[6]),0), count=visible.reduce((v,r)=>v+Number(r[7]),0);
              const meta=window.DB_BAIXAS_ERP_CONFERIDO.getMeta();
              return {cost,count,meta,source:p.meta.dateBasis,
                legacyHidden:getComputedStyle(document.querySelector('#barsBaixasLocais').closest('.panel')).display==='none',
                localCount:new Set(visible.map(r=>local(r[1]))).size};
            }""")
            assert erp['source']=='Dt.Neg.' and erp['meta']['cents']==round(BAIXAS_AUDIT['totalValue']*100), erp
            assert erp['meta']['filteredCents']==erp['cost'] and erp['meta']['filteredRecords']==erp['count'], erp
            assert erp['meta']['localCount']==erp['localCount'] and erp['legacyHidden'], erp
            page.locator('.tab[data-view="baixas"]').evaluate('(el)=>el.click()')
            page.wait_for_function("document.querySelector('#view-baixas.active') !== null")
            page.locator('#dbx-period').select_option('2025-2026')
            year_cost=page.evaluate('window.DB_BAIXAS_ERP_CONFERIDO.getMeta().filteredCents')
            assert year_cost==round(sum(BAIXAS_AUDIT['annual'][k]['value'] for k in ('2025','2026'))*100), year_cost
            page.locator('#dbx-period').select_option('all')
            assert page.locator('#db-baixas-erp-conferido').is_visible()
            assert page.locator('#dbx-group').is_disabled()
            assert page.locator('#dbx-item').is_disabled()
            first_local=page.locator('#dbx-local option').nth(1).get_attribute('value')
            assert first_local, 'Nenhum almoxarifado no filtro em cascata'
            page.locator('#dbx-local').select_option(first_local)
            assert page.locator('#dbx-group').is_enabled()
            first_group=page.locator('#dbx-group option').nth(1).get_attribute('value')
            assert first_group, 'Nenhum grupo para o almoxarifado selecionado'
            page.locator('#dbx-group').select_option(first_group)
            assert page.locator('#dbx-item').is_enabled()
            first_product=page.locator('#dbx-item option').nth(1).get_attribute('value')
            assert first_product, 'Nenhum produto para o grupo selecionado'
            page.locator('#dbx-item').select_option(first_product)
            assert page.evaluate("window.DB_BAIXAS_ERP_CONFERIDO.getMeta().filteredRecords")>0
            page.locator('[data-dbx-action="reset"]').click()
            assert page.locator('#dbx-group').is_disabled()
            assert page.locator('#dbx-item').is_disabled()
            page.locator('.tab[data-view="executivo"]').evaluate('(el)=>el.click()')

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

            # Analise unica: preserva o minimo, adiciona o maximo e elimina a duplicacao visual.
            page.locator('.tab[data-view="minimo"]').evaluate('(el)=>el.click()')
            page.wait_for_function("window.DB_MINIMUM_LOCALS_COVERAGE_META?.totalLocals>=9", timeout=15000)
            locs=page.evaluate("window.DB_MINIMUM_LOCALS_COVERAGE_META")
            assert locs['needLocals']>0 and locs['needLocals']+locs['noNeedLocals']==locs['totalLocals'], locs
            assert locs['below']>0 and locs['amount']>0, locs
            assert locs['nativeReady'] is True and locs['duplicated'] is False, locs
            # Graficos antigos permanecem no DOM para os renderizadores legados, mas invisiveis.
            assert page.locator('#view-minimo .db-min-top-chart').count()==2
            assert page.locator('#view-minimo .db-min-top-chart').first.is_hidden()
            assert page.locator('#db-minimum-all-locals').is_hidden()
            page.wait_for_function("window.DB_STOCK_UNIFIED?.meta?.integrated===true", timeout=15000)
            meta4=page.evaluate("window.DB_STOCK_UNIFIED.meta")
            assert meta4['warehouseCount']>=9 and meta4['networkExcludedFromTotals'], meta4
            assert meta4['stockDate']=='09/11/2026 10:29:10', meta4
            assert meta4['minimumMonths']==2 and meta4['months']==4, meta4
            assert meta4['physicalNeedItems']>0 and meta4['physicalNeedValue']>0, meta4
            assert meta4['physicalExcessItems']>=0 and meta4['physicalExcessValue']>=0, meta4
            assert meta4['insufficientHistoryItems']>=0, meta4
            assert any(x['virtual'] for x in meta4['locations']), meta4
            assert len(meta4['locations'])==meta4['warehouseCount']
            panel=page.locator('#db-stock-maximum')
            assert panel.is_visible(), 'Unified dashboard should be the only visible stock analysis'
            assert panel.get_by_text('Estoque mínimo / Estoque máximo', exact=True).count()==1
            assert page.locator('.tab[data-view="minimo"]').inner_text().strip()=='Estoque mínimo / Estoque máximo'
            assert page.locator('.clean-sub-btn[data-view="minimo"]').inner_text().strip()=='Estoque mínimo / Estoque máximo'
            assert page.evaluate("window.DB_STOCK_UNIFIED.meta.screenshotCardLayout") is True
            assert page.evaluate("window.DB_STOCK_UNIFIED.meta.tabLabel") == 'Estoque mínimo / Estoque máximo'
            assert panel.locator('.dbmx-kpi').count()==6
            assert panel.locator('#dbmx-months').input_value()=='4'
            assert panel.locator('#dbmx-year').input_value()==''
            assert panel.locator('#dbmx-mode').input_value()=='all'
            assert panel.locator('.dbmx-local').count()==meta4['warehouseCount']
            assert all(x['needItems']>=0 and x['excessItems']>=0 for x in meta4['locations'])
            assert abs(sum(x['needValue'] for x in meta4['locations'] if not x['virtual']) -
                       meta4['physicalNeedValue'])<0.02, meta4
            assert abs(sum(x['amount'] for x in meta4['locations'] if not x['virtual']) -
                       meta4['physicalExcessValue'])<0.02, meta4
            panel.locator('#dbmx-months').select_option('3')
            page.wait_for_function("window.DB_STOCK_UNIFIED.meta.months===3")
            meta3=page.evaluate("window.DB_STOCK_UNIFIED.meta")
            panel.locator('#dbmx-months').select_option('6')
            page.wait_for_function("window.DB_STOCK_UNIFIED.meta.months===6")
            meta6=page.evaluate("window.DB_STOCK_UNIFIED.meta")
            assert meta3['physicalExcessItems']>=meta4['physicalExcessItems']>=meta6['physicalExcessItems'], (meta3,meta4,meta6)
            assert meta3['physicalExcessValue']+0.05>=meta4['physicalExcessValue']>=meta6['physicalExcessValue']-0.05, (meta3,meta4,meta6)
            assert abs(meta3['physicalNeedValue']-meta6['physicalNeedValue'])<0.01
            panel.locator('#dbmx-months').select_option('4')
            page.wait_for_function("window.DB_STOCK_UNIFIED.meta.months===4")
            panel.locator('#dbmx-mode').select_option('all')
            assert panel.locator('.dbmx-legend--need').count()==1
            assert panel.locator('.dbmx-legend--excess').count()==1
            assert panel.locator('.dbmx-legend--ok').count()==0
            assert panel.locator('.dbmx-legend--history').count()==0
            assert panel.get_by_text('Amarelo: Repor', exact=True).count()==1
            assert panel.get_by_text('Verde: Excedente', exact=True).count()==1
            assert page.evaluate("window.DB_STOCK_UNIFIED.meta.inlineCascade") is True
            assert page.evaluate("window.DB_STOCK_UNIFIED.meta.colorCoding") is True
            assert page.evaluate("window.DB_STOCK_UNIFIED.meta.statusColors") == {
                'need':'db-yellow','excess':'db-green-dark','ok':'db-green-soft','history':'db-muted'}
            assert page.evaluate("window.DB_STOCK_UNIFIED.meta.brandPalette") == 'DB verde/amarelo'
            assert page.evaluate("window.DB_STOCK_UNIFIED.meta.withdrawalsFrom") == 'ERP_MOVEMENTS_YEARLY'
            assert page.evaluate("window.DB_STOCK_UNIFIED.meta.withdrawalPeriodMonths") == 22
            assert page.evaluate("window.DB_STOCK_UNIFIED.meta.withdrawalTotalsPhysical") is not None
            # Resumo compacto: somente nome, repor e excedente, com quantidade de itens e valor.
            assert panel.locator('.dbmx-withdrawals').count() == 0
            assert panel.locator('.dbmx-state-summary').count() == 0
            assert page.evaluate("window.DB_STOCK_UNIFIED.meta.compactSummary") is True
            assert page.evaluate("window.DB_STOCK_UNIFIED.meta.withdrawalDetailOnly") is True
            local_rows=panel.locator('.dbmx-local')
            assert local_rows.count()==meta4['warehouseCount']
            assert local_rows.first.locator('.dbmx-name').count()==1
            assert local_rows.first.locator('.dbmx-metric--need').count()==1
            assert local_rows.first.locator('.dbmx-metric--excess').count()==1
            assert 'REPOR' in local_rows.first.locator('.dbmx-metric--need').inner_text().upper()
            assert 'EXCEDENTE' in local_rows.first.locator('.dbmx-metric--excess').inner_text().upper()
            assert 'R$' in local_rows.first.locator('.dbmx-metric--need').inner_text()
            assert 'R$' in local_rows.first.locator('.dbmx-metric--excess').inner_text()
            assert 'Qtd. baixada' not in local_rows.first.inner_text()
            assert 'Sem histórico' not in local_rows.first.inner_text()
            assert 'Adequado' not in local_rows.first.inner_text()
            assert panel.locator('.dbmx-list-heading').count()==1
            assert panel.locator('.dbmx-list-heading h3').inner_text()=='1. Almoxarifados'
            card_styles=page.evaluate("""() => {
                const card=document.querySelector('#db-stock-maximum .dbmx-local');
                const name=card.querySelector('.dbmx-name');
                const need=card.querySelector('.dbmx-metric--need');
                const excess=card.querySelector('.dbmx-metric--excess');
                const rect=card.getBoundingClientRect();
                const needRect=need.getBoundingClientRect();
                const excessRect=excess.getBoundingClientRect();
                return {
                  bg:getComputedStyle(card).backgroundColor,
                  border:getComputedStyle(card).borderStyle,
                  radius:getComputedStyle(card).borderRadius,
                  grid:getComputedStyle(card).display,
                  metricBg:getComputedStyle(need).backgroundColor,
                  metricBorder:getComputedStyle(need).borderLeftStyle,
                  aligned:needRect.left>name.getBoundingClientRect().left&&excessRect.left>needRect.left,
                  width:rect.width
                };
              }""")
            assert card_styles['bg']=='rgb(255, 255, 255)', card_styles
            assert card_styles['border']=='solid', card_styles
            assert card_styles['grid']=='grid' and card_styles['width']>700, card_styles
            assert card_styles['metricBg']=='rgba(0, 0, 0, 0)', card_styles
            assert card_styles['metricBorder'] in ('none','hidden'), card_styles
            assert card_styles['aligned'], card_styles
            assert all('withdrawalTotals' in x for x in
                       page.evaluate("window.DB_STOCK_UNIFIED.meta.locations"))
            brand_visual=page.evaluate("""() => ({
                header:getComputedStyle(document.querySelector('#db-stock-maximum .dbmx-head')).backgroundImage,
                yellow:getComputedStyle(document.querySelector('#db-stock-maximum .dbmx-legend--need')).backgroundColor,
                rootYellow:getComputedStyle(document.documentElement).getPropertyValue('--db-yellow').trim()
              })""")
            assert 'gradient' in brand_visual['header'], brand_visual
            assert brand_visual['yellow']=='rgb(250, 202, 4)', brand_visual
            assert brand_visual['rootYellow']=='#faca04', brand_visual
            panel.locator('.dbmx-local').first.click()
            assert panel.locator('.dbmx-detail').count()==1
            assert panel.locator('.dbmx-group').count()>0
            assert panel.locator('.dbmx-inner-heading').count()==1
            assert panel.locator('.dbmx-inner-heading h3').inner_text()=='Grupos de produtos'
            assert panel.locator('.dbmx-local-block').first.locator(':scope > .dbmx-detail').count()==1
            assert panel.locator('.dbmx-local-block').first.locator(':scope > .dbmx-detail .dbmx-group').count()>0
            assert panel.locator('.dbmx-products').count()==0
            assert panel.locator('.dbmx-withdrawals').count()==0
            assert panel.locator('.dbmx-state-summary').count()==0
            assert 'Total baixado neste almoxarifado:' not in panel.locator('.dbmx-detail').inner_text()
            assert panel.locator('.dbmx-group').first.locator('.dbmx-metric--need').count()==1
            assert panel.locator('.dbmx-group').first.locator('.dbmx-metric--excess').count()==1
            assert 'Qtd. baixada' not in panel.locator('.dbmx-group').first.inner_text()
            panel.locator('.dbmx-group').first.click()
            assert panel.locator('.dbmx-scroll table').count()==1
            assert panel.locator('.dbmx-group-wrap').first.locator(':scope > .dbmx-products').count()==1
            assert panel.get_by_text('Qtd. baixada no período', exact=True).count()==1
            assert panel.locator('td.dbmx-withdrawn-cell').count() > 0
            assert panel.locator('.dbmx-status').count() > 0
            # Ordem por quantidade efetivamente baixada, nao por valor financeiro do excedente.
            assert page.evaluate("window.DB_STOCK_UNIFIED.meta.sortedByWithdrawalsDesc") is True
            assert page.evaluate("window.DB_STOCK_UNIFIED.meta.fullWidthProducts") is True
            assert page.evaluate("window.DB_STOCK_UNIFIED.meta.allProductColumnsHorizontal") is True
            assert page.evaluate("window.DB_STOCK_UNIFIED.meta.purchaseValueColumnHidden") is True
            def inspect_products_layout():
                return page.evaluate("""() => {
                    const box=document.querySelector('#db-stock-maximum .dbmx-scroll');
                    const table=box.querySelector('table');
                    const rows=[...table.querySelectorAll('tbody tr')];
                    const quantities=rows.map(r=>Number(r.dataset.dbmxWithdrawalSort));
                    const cell=rows[0]?.querySelectorAll('td')||[];
                    const last=cell[cell.length-1];
                    const tableRect=table.getBoundingClientRect();
                    const boxRect=box.getBoundingClientRect();
                    return {
                        widths:{box:box.clientWidth,scroll:box.scrollWidth,table:tableRect.width,
                          viewport:window.innerWidth},
                        sorted:quantities.every((q,i)=>i===0||quantities[i-1]+1e-6>=q),
                        count:rows.length,columns:cell.length,
                        lastColumn:!!last && last.getAttribute('data-label')==='Situação / possíveis transferências',
                        hasExcess:rows.some(r=>r.querySelector('[data-label="Valor excedente"]')),
                        allCellsLabeled:rows.every(r=>[...r.querySelectorAll('td')].length===13&&
                          [...r.querySelectorAll('td')].every(c=>c.hasAttribute('data-label'))),
                        removedPurchaseValue: !table.textContent.includes('Valor a comprar'),
                        headers:[...table.querySelectorAll('th')].length,
                        boxScrollHorizontal:box.scrollWidth>box.clientWidth+2,
                        tableFits:tableRect.right<=boxRect.right+2,
                        tableMode:getComputedStyle(table).display,
                        rowMode:getComputedStyle(rows[0]).display,
                        headerMode:getComputedStyle(table.tHead).display
                    };
                }""")
            layout1440=inspect_products_layout()
            assert layout1440['sorted'] and layout1440['count']>4,layout1440
            assert layout1440['columns']==13 and layout1440['lastColumn'],layout1440
            assert layout1440['headers']==13 and layout1440['removedPurchaseValue'],layout1440
            assert layout1440['allCellsLabeled'] and layout1440['hasExcess'],layout1440
            assert layout1440['tableMode']=='table' and layout1440['rowMode']=='table-row',layout1440
            assert layout1440['headerMode']=='table-header-group',layout1440
            assert not layout1440['boxScrollHorizontal'] and layout1440['tableFits'],layout1440
            for test_width in (1700,1280,900,768):
                page.set_viewport_size({'width':test_width,'height':1000})
                page.wait_for_timeout(90)
                current=inspect_products_layout()
                assert current['count']==layout1440['count'] and current['sorted'],(test_width,current)
                assert current['columns']==13 and current['allCellsLabeled'],(test_width,current)
                assert current['headers']==13 and current['removedPurchaseValue'],(test_width,current)
                assert current['tableMode']=='table' and current['rowMode']=='table-row',(test_width,current)
                assert current['headerMode']=='table-header-group',(test_width,current)
                assert not current['boxScrollHorizontal'] and current['tableFits'],(test_width,current)
            page.set_viewport_size({'width':1440,'height':1000})
            assert page.evaluate("""() => Array.from(document.querySelectorAll(
                '#db-stock-maximum .dbmx-withdrawn-cell')).every(el =>
                  Array.isArray(JSON.parse(el.dataset.dbmxWithdrawn)))""")
            brand_rows=page.evaluate("""() => Array.from(document.querySelectorAll(
                '#db-stock-maximum tbody tr')).map(el=>getComputedStyle(el).backgroundColor)""")
            assert all(x in ('rgba(0, 0, 0, 0)','rgb(247, 250, 248)','rgb(243, 249, 245)','rgb(255, 255, 255)') for x in brand_rows),brand_rows
            assert panel.locator('.dbmx-state-summary').count()==0
            assert panel.locator('.dbmx-status').count()>0
            statuses=page.evaluate("""() => Array.from(document.querySelectorAll('#db-stock-maximum tbody tr'))
                .map(row => ({kind:row.dataset.dbmxColor,label:row.querySelector('.dbmx-status')?.textContent||''}))
                .filter(row=>row.kind)""")
            assert all(x['kind'] in ['need','excess','ok','history'] for x in statuses),statuses
            assert all(x['label'] in ['REPOR','EXCEDENTE DISPONÍVEL','ESTOQUE ADEQUADO',
                'SEM BAIXAS','HISTÓRICO INSUFICIENTE'] for x in statuses),statuses
            # Os produtos devem expandir abaixo do respectivo grupo, sem painel de detalhe apartado.
            panel.locator('.dbmx-group').first.click()
            assert panel.locator('.dbmx-products').count()==0
            panel.locator('.dbmx-local').first.click()
            assert panel.locator('.dbmx-detail').count()==0
            panel.locator('.dbmx-local').first.click()
            assert panel.locator('.dbmx-detail').count()==1
            panel.locator('.dbmx-group').first.click()
            for header in ['Mínimo (2 meses)','Máximo (4 meses)','Saldo atual','Qtd. a repor',
                           'Qtd. excedente','Valor excedente','Custo unit. ERP']:
                assert panel.get_by_text(header, exact=True).count()>0, header
            assert panel.locator('.dbmx-scroll th').count()==13
            assert panel.locator('.dbmx-scroll th', has_text='Valor a comprar').count()==0
            # Filtro diretamente no cabecalho Situacao / possiveis transferencias.
            header_filter=panel.locator('.dbmx-scroll th:last-child #dbmx-table-status')
            assert header_filter.count()==1 and header_filter.is_visible()
            assert header_filter.input_value()=='all'
            assert header_filter.locator('option').all_text_contents()==['Todos','Repor','Excedente']
            assert page.evaluate("window.DB_STOCK_UNIFIED.meta.columnStatusFilter") is True
            assert page.evaluate("window.DB_STOCK_UNIFIED.meta.columnStatusOptions")==['all','need','excess']
            assert panel.locator('.dbmx-filter-count').count()==1
            total_rows=panel.locator('.dbmx-scroll tbody tr').count()
            initial_counts=page.evaluate("""() => {
                const rows=[...document.querySelectorAll('#db-stock-maximum .dbmx-scroll tbody tr')];
                return ['need','excess','ok','history'].reduce((o,k)=>
                  (o[k]=rows.filter(r=>r.dataset.dbmxColor===k).length,o),{});
            }""")
            assert sum(initial_counts.values())==total_rows
            meta_before=page.evaluate("window.DB_STOCK_UNIFIED.meta")
            for status in ('need','excess'):
                header_filter.select_option(status)
                snapshot=page.evaluate("""() => {
                    const select=document.querySelector('#dbmx-table-status');
                    const rows=[...document.querySelectorAll('#db-stock-maximum .dbmx-scroll tbody tr')];
                    return {
                        selected:select.value,
                        rows:rows.length,
                        visible:rows.filter(r=>!r.hidden).length,
                        correctlyFiltered:rows.every(r=>r.hidden===(r.dataset.dbmxColor!==select.value)),
                        noneShown:document.querySelector('.dbmx-filter-empty').hidden===false,
                        countText:document.querySelector('.dbmx-filter-count').textContent,
                        allHiddenHaveNoDisplay:rows.filter(r=>r.hidden).every(r=>getComputedStyle(r).display==='none')
                    };
                }""")
                assert snapshot['selected']==status and snapshot['rows']==total_rows,snapshot
                assert snapshot['visible']==initial_counts[status],snapshot
                assert snapshot['correctlyFiltered'] and snapshot['allHiddenHaveNoDisplay'],snapshot
                assert snapshot['noneShown']==(initial_counts[status]==0),snapshot
                assert str(total_rows) in snapshot['countText'],snapshot
                assert panel.locator('.dbmx-products').count()==1
                assert page.evaluate("window.DB_STOCK_UNIFIED.meta.physicalNeedValue")==meta_before['physicalNeedValue']
                assert page.evaluate("window.DB_STOCK_UNIFIED.meta.physicalExcessValue")==meta_before['physicalExcessValue']
            header_filter.select_option('all')
            assert panel.locator('.dbmx-scroll tbody tr:not([hidden])').count()==total_rows
            assert panel.locator('.dbmx-filter-empty').is_hidden()
            assert panel.locator('.dbmx-scroll th').count()==13
            assert page.evaluate("window.STOCK_MINIMUM_MONTHS") == 2
            assert page.evaluate("window.DB_MINIMUM_LOCALS_COVERAGE_META.totalLocals") == locs['totalLocals']
            panel.locator('#dbmx-year').select_option('2025')
            page.wait_for_function("window.DB_STOCK_UNIFIED.meta.year==='2025'")
            data25=page.evaluate("window.DB_STOCK_UNIFIED.meta")
            assert data25['withdrawalPeriodMonths']==12, data25
            panel.locator('#dbmx-year').select_option('2026')
            page.wait_for_function("window.DB_STOCK_UNIFIED.meta.year==='2026'")
            data26=page.evaluate("window.DB_STOCK_UNIFIED.meta")
            assert data26['withdrawalPeriodMonths']==10, data26
            panel.locator('#dbmx-year').select_option('')
            page.wait_for_function("window.DB_STOCK_UNIFIED.meta.year==='2025+2026'")
            dataAll=page.evaluate("window.DB_STOCK_UNIFIED.meta")
            unit_dict=lambda data: {x['un']:x['value'] for x in data['withdrawalTotalsPhysical']}
            all_qty=unit_dict(dataAll)
            qty25=unit_dict(data25)
            qty26=unit_dict(data26)
            assert all(abs(total - qty25.get(unit,0) - qty26.get(unit,0))<0.03
                       for unit,total in all_qty.items()), (all_qty,qty25,qty26)
            assert set(qty25).union(qty26)==set(all_qty), (all_qty,qty25,qty26)
            panel.locator('#dbmx-mode').select_option('unknown')
            assert panel.get_by_text('Revisar histórico', exact=True).count()>=1
            panel.locator('#dbmx-mode').select_option('need')
            assert panel.get_by_text('Precisa repor', exact=True).count()>=1
            panel.locator('#dbmx-mode').select_option('excess')
            assert panel.get_by_text('Acima do máximo', exact=True).count()>=1
            panel.locator('#dbmx-mode').select_option('all')
            assert page.evaluate("window.DB_STOCK_UNIFIED.meta.integrated") is True

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
                rows:source.length,filtered:m.filteredRows,networkRows:m.semBaixaNaRede,networkDefault:document.querySelector('#ns-scope')?.value==='rede',position:m.stockDate,
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
            assert no_withdrawals['networkDefault'] and no_withdrawals['filtered']==no_withdrawals['networkRows'] and no_withdrawals['purchaseHistoryAvailable'], no_withdrawals\n            assert no_withdrawals['rows']==2637 and no_withdrawals['filtered']==2295, no_withdrawals
            assert no_withdrawals['position']=='09/11/2026 10:29:10', no_withdrawals
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

            page.locator('#ns-scope').evaluate("(el)=>{el.value='rede';el.dispatchEvent(new Event('change',{bubbles:true}));}")
            page.wait_for_function("window.STOCK_NO_WITHDRAWAL_META.filteredRows < window.STOCK_NO_WITHDRAWAL.getRows().length", timeout=10000)
            strict=page.evaluate("""() => {
              const moved=new Set([...MOVEMENTS,...MOVEMENTS_YEARLY].filter(x=>
                Number(x.total)>0||Number(x.complete_total)>0||(x.months||[]).some(q=>Number(q)>0))
                .map(x=>String(x.codigo)));
              for(const code of (window.DB_WITHDRAWAL_HISTORY_2024_2026?.networkCodes||[])) moved.add(String(code));
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
            values = page.evaluate("""() => ({local:MOVEMENTS.filter(x=>!window.DB_MINIMUM_EXCLUDED?.(x)).every(x=>Math.abs(x.minimum-minimumRoundUp((Number(x.avg)||0)*2,x.un))<1e-8),cdi:cdiNetworkAllRows().every(x=>Math.abs(x.minimum-minimumRoundUp(x.avg*2,x.un))<1e-8),annual:minimumRowsForYear(minimumBaseRows(),'2026').every(x=>Math.abs(x.minimum-minimumRoundUp(x.avg*2,x.un))<1e-8) , sample:MOVEMENTS.filter(x=>!window.DB_MINIMUM_EXCLUDED?.(x)&&Math.abs(x.minimum-minimumRoundUp((Number(x.avg)||0)*2,x.un))>=1e-8).slice(0,12).map(x=>({codigo:x.codigo,local:x.local,un:x.un,total:x.total,avg:x.avg,minimum:x.minimum,expected:minimumRoundUp((Number(x.avg)||0)*2,x.un)}))})""")
            assert all(values[k] for k in ['local','cdi','annual']), values
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
            assert minimum_view['meta']['months']==2 and minimum_view['totalHistory']==BAIXAS_AUDIT['revisedRecords'] and minimum_view['noOldNav'], minimum_view
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
            assert sj_no_withdrawals['purchaseLocal'] and sj_no_withdrawals['meta']==BAIXAS_AUDIT['revisedRecords'], sj_no_withdrawals
            assert sj_no_withdrawals['date']=='09/11/2026 10:29:10', sj_no_withdrawals\n            assert page.locator('#sj-nw-scope').input_value()=='rede', 'Sao Joao deve iniciar sem baixas em toda a rede'
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
            assert minimum_view['meta']['months']==2 and minimum_view['totalHistory']==BAIXAS_AUDIT['revisedRecords'] and minimum_view['noOldNav'], minimum_view
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
            assert chua_no_withdrawals['purchasesOnlyChua'] and chua_no_withdrawals['date']==chua_no_withdrawals['stockDate'], chua_no_withdrawals\n            assert page.locator('#sj-nw-scope').input_value()=='rede', 'Chua deve iniciar sem baixas em toda a rede'
            assert 'São João' not in page.locator('#sj-pilot-root').inner_text()
        results[name]['errors'] = errors.copy()
        page.close()
    assert results['fast']['stockRows'] == 4380, 'Unexpected stock positions'
    assert results['fastPilot']['stockRows'] == 4380, 'Unexpected Sao Joao stock positions'
    assert results['fastChuaPilot']['stockRows'] == 4380, 'Unexpected Chua stock positions'
    assert abs(results['fast']['stockValue'] - 2292215.23) < 0.01, 'Unexpected stock value'
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
