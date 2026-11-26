"""Compare the actual legacy and optimized application in Chromium."""
import csv
import base64
import functools
import gzip
import http.server
import json
import os
import math
import posixpath
import re
import tempfile
import threading
import zipfile
import xml.etree.ElementTree as ET
from datetime import date
from pathlib import Path
from playwright.sync_api import sync_playwright

root = Path(__file__).resolve().parents[1]


def verify_variation_xlsx(path, expected, supplier=None):
    """Read the actual browser download using only Python's standard library."""
    ns = {'m': 'http://schemas.openxmlformats.org/spreadsheetml/2006/main'}
    relation_ns = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships'
    with zipfile.ZipFile(path) as archive:
        assert archive.testzip() is None, 'XLSX ZIP checksum failed'
        assert '[Content_Types].xml' in archive.namelist()
        workbook = ET.fromstring(archive.read('xl/workbook.xml'))
        sheets = workbook.findall('m:sheets/m:sheet', ns)
        assert [sheet.get('name') for sheet in sheets] == ['Variação de compras', 'Filtros']
        relationships = ET.fromstring(archive.read('xl/_rels/workbook.xml.rels'))
        targets = {rel.get('Id'): rel.get('Target') for rel in relationships}
        assert all(rel.get('TargetMode') != 'External' for rel in relationships)
        shared = []
        if 'xl/sharedStrings.xml' in archive.namelist():
            strings = ET.fromstring(archive.read('xl/sharedStrings.xml'))
            shared = [''.join(item.itertext()) for item in strings]

        def worksheet(sheet):
            target = targets[sheet.get('{' + relation_ns + '}id')]
            name = target.lstrip('/') if target.startswith('/') else posixpath.normpath('xl/' + target)
            return ET.fromstring(archive.read(name))

        def text(cell):
            if cell.get('t') == 'inlineStr':
                return ''.join(node.text or '' for node in cell.findall('.//m:t', ns))
            value = cell.findtext('m:v', default='', namespaces=ns)
            return shared[int(value)] if cell.get('t') == 's' else value

        def number(cell):
            assert cell.get('t') in (None, 'n'), 'Excel numeric value exported as text'
            value = float(cell.findtext('m:v', namespaces=ns))
            assert math.isfinite(value)
            return value

        style = ET.fromstring(archive.read('xl/styles.xml'))
        custom_formats = {int(item.get('numFmtId')): item.get('formatCode')
                          for item in style.findall('m:numFmts/m:numFmt', ns)}
        cell_formats = style.findall('m:cellXfs/m:xf', ns)

        def format_of(cell):
            index = int(cell.get('s', '0'))
            assert index < len(cell_formats)
            code = int(cell_formats[index].get('numFmtId', '0'))
            return code, custom_formats.get(code, '')

        main = worksheet(sheets[0])
        assert not main.findall('.//m:f', ns), 'Export must contain literal values, not formulas'
        rows = main.findall('m:sheetData/m:row', ns)
        assert len(rows) == len(expected) + 1, 'XLSX omitted filtered rows'
        header = [text(cell) for cell in rows[0].findall('m:c', ns)]
        assert header == ['#', 'Código', 'Produto', 'Grupo', 'UN', 'Menor preço',
                          'Data menor', 'Fornecedor menor', 'Maior preço', 'Data maior',
                          'Fornecedor maior', 'Variação R$', 'Variação %', 'Compras'], header
        assert main.find('m:autoFilter', ns).get('ref') == f'A1:N{len(rows)}'
        pane = main.find('m:sheetViews/m:sheetView/m:pane', ns)
        assert pane is not None and pane.get('state') == 'frozen' and pane.get('ySplit') == '1'
        for index, (record, original) in enumerate(zip(rows[1:], expected), 1):
            cells = record.findall('m:c', ns)
            assert len(cells) == 14, f'Incomplete XLSX row {index}'
            assert number(cells[0]) == index
            for column, field in ((1, 'codigo'), (2, 'produto'), (3, 'grupo'), (4, 'un')):
                assert text(cells[column]) == str(original.get(field) or ''), (index, field)
            assert cells[1].get('t') in ('s', 'inlineStr'), 'Product codes must remain text'
            for column, field in ((5, 'minPrice'), (8, 'maxPrice'), (11, 'diff'), (12, 'varPct')):
                assert math.isclose(number(cells[column]), original[field], rel_tol=1e-12, abs_tol=1e-12), (index, field)
            assert number(cells[13]) == original['count']
            assert text(cells[7]) == original['min']['fornecedor']
            assert text(cells[10]) == original['max']['fornecedor']
            for column, source in ((6, original['min']), (9, original['max'])):
                day, month, year = map(int, source['data'].split('/'))
                serial = (date(year, month, day) - date(1899, 12, 30)).days
                assert number(cells[column]) == serial, (index, 'date')
                builtin, pattern = format_of(cells[column])
                assert builtin in range(14, 23) or all(part in pattern.lower() for part in ['d', 'm', 'y'])
            builtin, pattern = format_of(cells[12])
            assert builtin in (9, 10) or '%' in pattern, 'Excel percentage format missing'
        filters = worksheet(sheets[1])
        filter_values = [text(cell) for cell in filters.findall('.//m:c', ns)]
        if supplier:
            assert supplier in filter_values, 'Applied supplier missing from Excel filters'
    return {'rows': len(expected), 'columns': 14, 'sheets': 2}


def check_variation_excel_export(page):
    filter_ids = ['fEmpresa', 'fLocal', 'fGrupo', 'fUn', 'fFornecedor', 'fBusca']
    previous = page.evaluate("""ids => ({view:document.querySelector('.tab.active')?.dataset.view,
      filters:Object.fromEntries(ids.map(id=>[id,document.getElementById(id)?.value||'']))})""", filter_ids)

    def set_filters(values):
        page.evaluate("""values => {
          for(const [id,value] of Object.entries(values))document.getElementById(id).value=value;
          document.getElementById('fGrupo').dispatchEvent(new Event('change',{bubbles:true}));
          document.getElementById('fBusca').dispatchEvent(new Event('input',{bubbles:true}));
        }""", values)

    def current_rows():
        return page.evaluate("""() => window.DB_PURCHASE_VARIATION_EXPORT.getRows().map(r=>({
          codigo:String(r.codigo),produto:r.produto,grupo:r.grupo,un:r.un,
          minPrice:r.minPrice,maxPrice:r.maxPrice,diff:r.diff,varPct:r.varPct,count:r.count,
          min:{data:r.min.data,fornecedor:r.min.fornecedor},
          max:{data:r.max.data,fornecedor:r.max.fornecedor}}))""")

    try:
        page.locator('.tab[data-view="variacao"]').evaluate('(el)=>el.click()')
        page.wait_for_function("window.DB_PURCHASE_VARIATION_EXPORT && document.querySelector('#view-variacao.active')")
        button = page.locator('#variationExportExcel')
        button.wait_for(state='visible')
        assert button.inner_text().strip() == 'Exportar para Excel'
        set_filters({key: '' for key in filter_ids})
        page.wait_for_function("!document.getElementById('variationExportExcel').disabled && "
                               "document.querySelectorAll('#variationRows tr').length===window.DB_PURCHASE_VARIATION_EXPORT.getRows().length")
        complete = current_rows()
        assert len(complete) > 1
        visible_keys = page.locator('#variationRows').evaluate("""body => Array.from(body.rows)
          .map(row=>row.cells[1].textContent.trim()+'|'+row.cells[4].textContent.trim())""")
        assert visible_keys == [row['codigo'] + '|' + row['un'] for row in complete]
        supplier = page.evaluate("""() => {
          const totals=new Map();
          for(const row of PURCHASES.filter(r=>!window.DB_IS_TIRE_OR_CAMERA(r)&&Number(r.preco)>0))
            totals.set(row.fornecedor,(totals.get(row.fornecedor)||0)+1);
          return [...totals].sort((a,b)=>b[1]-a[1])[0][0];
        }""")
        with tempfile.TemporaryDirectory(prefix='variation-export-') as directory:
            with page.expect_download(timeout=15000) as pending:
                button.click()
            downloaded = pending.value
            assert re.fullmatch(r'variacao_compras_\d{4}-\d{2}-\d{2}\.xlsx', downloaded.suggested_filename)
            assert downloaded.failure() is None
            path = Path(directory) / 'all.xlsx'
            downloaded.save_as(path)
            assert path.read_bytes().startswith(b'PK\x03\x04')
            all_result = verify_variation_xlsx(path, complete)
            set_filters({**{key: '' for key in filter_ids}, 'fFornecedor': supplier})
            page.wait_for_function("""supplier => {
              const rows=window.DB_PURCHASE_VARIATION_EXPORT.getRows();
              return rows.length>0&&!document.getElementById('variationExportExcel').disabled&&
                rows.every(r=>r.min.fornecedor===supplier&&r.max.fornecedor===supplier)&&
                document.querySelectorAll('#variationRows tr').length===rows.length;
            }""", arg=supplier)
            filtered = current_rows()
            assert 0 < len(filtered) < len(complete)
            with page.expect_download(timeout=15000) as pending:
                button.click()
            downloaded = pending.value
            assert downloaded.failure() is None
            path = Path(directory) / 'supplier.xlsx'
            downloaded.save_as(path)
            supplier_result = verify_variation_xlsx(path, filtered, supplier)
            set_filters({**{key: '' for key in filter_ids}, 'fBusca': '__nenhum_produto_exportacao_excel__'})
            page.wait_for_function("window.DB_PURCHASE_VARIATION_EXPORT.getRows().length===0 && document.getElementById('variationExportExcel').disabled")
            assert button.is_disabled()
            assert 'Sem compras' in page.locator('#variationRows').inner_text()
            return {'all': all_result, 'supplier': supplier_result, 'emptyDisabled': True}
    finally:
        set_filters(previous['filters'])
        if previous['view']:
            page.locator('.tab[data-view="' + previous['view'] + '"]').evaluate('(el)=>el.click()')


def check_management_navigation(page):
    """Exercise the visible, consolidated menus without altering the business data."""
    filter_ids = ['fEmpresa', 'fLocal', 'fGrupo', 'fUn', 'fFornecedor', 'fBusca']
    previous = page.evaluate("""ids => ({view:document.querySelector('.tab.active')?.dataset.view,
      filters:Object.fromEntries(ids.map(id=>[id,document.getElementById(id)?.value||''])),
      filtersOpen:document.querySelector('.filters')?.classList.contains('clean-open')||false})""", filter_ids)
    fingerprint = """() => ({stockRows:STOCK.length,
      stockCents:Math.round(STOCK.reduce((n,r)=>n+Number(r.valor_estoque||0),0)*100),
      purchaseRows:PURCHASES.length,purchaseCents:Math.round(PURCHASES.reduce((n,r)=>n+Number(r.valor||0),0)*100),
      movementRows:MOVEMENTS.length,comparison:window.DB_UNIFIED_ECONOMY.summary().net})"""
    before = page.evaluate(fingerprint)

    def expect_view(view, group):
        page.wait_for_function("""({view,group}) =>
          document.querySelector('.tab.active')?.dataset.view===view &&
          document.querySelector('.clean-primary-btn.active')?.dataset.group===group &&
          document.getElementById('view-'+view)?.classList.contains('active')""",
                               arg={'view': view, 'group': group})
        assert page.locator('.view.active').count() == 1
        assert page.locator('#view-' + view).is_visible()

    def set_filters(values):
        page.evaluate("""values => {
          for(const [id,value] of Object.entries(values))document.getElementById(id).value=value;
          document.getElementById('fGrupo').dispatchEvent(new Event('change',{bubbles:true}));
          document.getElementById('fBusca').dispatchEvent(new Event('input',{bubbles:true}));
        }""", values)

    def filters():
        return page.evaluate("ids=>Object.fromEntries(ids.map(id=>[id,document.getElementById(id).value]))", filter_ids)

    try:
        page.wait_for_function("window.DB_NAVIGATION && document.querySelector('#view-resultados #db-economia-unificada')")
        primary = page.locator('.clean-primary-btn')
        assert primary.all_text_contents() == ['Resumo', 'Estoque', 'Compras', 'Economia e resultados']
        assert primary.evaluate_all("items=>items.map(item=>item.dataset.group)") == ['resumo', 'estoque', 'compras', 'resultados']
        groups = {
            'estoque': ['estoque', 'minimo', 'baixas', 'inventarios'],
            'compras': ['historico', 'produtos', 'compras-programadas', 'orcamentos'],
            'resultados': ['resultados', 'economia'],
        }
        for group, views in groups.items():
            page.locator('.clean-primary-btn[data-group="' + group + '"]').click()
            page.wait_for_function("group=>document.querySelector('.clean-primary-btn.active')?.dataset.group===group", arg=group)
            actual = page.locator('.clean-sub-btn').evaluate_all("items=>items.map(item=>item.dataset.view)")
            assert actual == views, (group, actual)
            assert len(actual) == len(set(actual)), 'Duplicated secondary destinations'
            for view in views:
                page.locator('.clean-sub-btn[data-view="' + view + '"]').click()
                expect_view(view, group)

        # One physical economy panel, with its audit still available on demand.
        page.locator('.clean-sub-btn[data-view="resultados"]').click()
        expect_view('resultados', 'resultados')
        assert page.locator('#db-economia-unificada').count() == 1
        assert page.locator('#view-geral #db-economia-unificada').count() == 0
        assert page.locator('#view-resultados #db-economia-unificada').is_visible()
        assert not page.locator('#eu-audit').evaluate('el=>el.open')
        assert page.locator('#eu-source-panels > section').count() == 5
        assert page.locator('#db-navigation-context').get_attribute('data-scope') in ['own', 'mixed']
        assert page.locator('#db-navigation-context .clean-context-note').inner_text().strip()

        # The former executive route now opens the same summary as the main menu.
        page.locator('.tab[data-view="executivo"]').evaluate('(el)=>el.click()')
        expect_view('geral', 'resumo')
        assert page.locator('#db-management-summary').is_visible()
        assert page.locator('#view-geral .capital-hierarchy').is_visible()
        assert page.locator('.clean-sub-btn[data-view="executivo"]').count() == 0
        assert not page.locator('#view-executivo').evaluate("el=>el.classList.contains('view')")
        cards = page.locator('#db-management-summary .db-summary-card[data-target]')
        assert cards.count() == 5
        assert not page.locator('#db-summary-extra').evaluate('el=>el.open')
        for view, group in [('estoque', 'estoque'), ('sem-baixas', 'estoque'),
                            ('minimo', 'estoque'), ('historico', 'compras'),
                            ('resultados', 'resultados')]:
            page.locator('.clean-primary-btn[data-group="resumo"]').click()
            page.locator('#db-management-summary .db-summary-card[data-target="' + view + '"]').click()
            expect_view(view, group)

        # The stock modes are reachable from one position/replenishment destination.
        for canonical, mode in [('estoque', 'sem-baixas'), ('minimo', 'cdi')]:
            page.locator('.clean-primary-btn[data-group="estoque"]').click()
            page.locator('.clean-sub-btn[data-view="' + canonical + '"]').click()
            page.locator('#db-navigation-modes .clean-mode-btn[data-view="' + mode + '"]').click()
            expect_view(mode, 'estoque')
            assert page.locator('.clean-sub-btn.active').get_attribute('data-view') == canonical
            assert page.locator('.clean-sub-btn[data-view="' + mode + '"]').count() == 0

        # Select a real product in both current stock and purchase history.
        fixture = page.evaluate("""() => {
          const allowed=id=>new Set([...document.getElementById(id).options].map(o=>o.value));
          const locals=allowed('fLocal'),groups=allowed('fGrupo'),units=allowed('fUn');
          const row=PURCHASES.find(r=>Number(r.preco)>0&&!window.DB_IS_TIRE_OR_CAMERA(r)&&
            locals.has(r.local)&&groups.has(r.grupo)&&units.has(r.un)&&
            STOCK.some(s=>String(s.codigo)===String(r.codigo)&&s.local===r.local&&s.un===r.un&&Number(s.estoque)>0));
          return row?{code:String(row.codigo),local:row.local,group:row.grupo,unit:row.un}:null;
        }""")
        assert fixture, 'Expected a current product with comparable purchases'
        selected = {**{key: '' for key in filter_ids}, 'fLocal': fixture['local'],
                    'fGrupo': fixture['group'], 'fUn': fixture['unit'], 'fBusca': fixture['code']}
        set_filters(selected)
        page.evaluate("window.DB_NAVIGATION.go('estoque')")
        expect_view('estoque', 'estoque')
        assert filters() == selected
        page.locator('.clean-primary-btn[data-group="compras"]').click()
        page.locator('.clean-sub-btn[data-view="historico"]').click()
        expect_view('historico', 'compras')
        page.wait_for_function("document.querySelectorAll('#tbodyHistorico tr').length>0")
        assert filters() == selected
        assert page.evaluate("p=>purchasesFiltered().every(r=>r.local===p.local&&r.grupo===p.group&&r.un===p.unit)", fixture)
        page.locator('#db-navigation-modes .clean-mode-btn[data-view="fornecedores"]').click()
        expect_view('fornecedores', 'compras')
        assert page.locator('.clean-sub-btn.active').get_attribute('data-view') == 'historico'
        assert filters() == selected
        page.locator('.clean-sub-btn[data-view="produtos"]').click()
        expect_view('produtos', 'compras')
        assert filters() == selected
        assert page.locator('#db-navigation-context').get_attribute('data-scope') == 'mixed'
        assert page.locator('#db-navigation-context .clean-context-note').inner_text().strip()
        page.locator('#view-produtos .purchase-workspace-modes [data-pw-view="variacao"]').click()
        expect_view('variacao', 'compras')
        page.wait_for_function("window.DB_PURCHASE_VARIATION_EXPORT.getRows().length>0 && !document.getElementById('variationExportExcel').disabled")
        assert filters() == selected
        assert page.locator('.clean-sub-btn.active').get_attribute('data-view') == 'produtos'
        assert page.locator('#variationExportExcel').is_visible()
        visible_filters = page.locator('#db-navigation-context .clean-context-filters').inner_text()
        assert fixture['local'] in visible_filters and fixture['code'] in visible_filters
        history_link = page.locator('#variationRows [data-pw-history]').first
        history_link.wait_for(state='visible')
        selected['fBusca'] = history_link.get_attribute('data-pw-history')
        selected['fUn'] = history_link.get_attribute('data-pw-unit')
        history_link.click()
        expect_view('historico', 'compras')
        assert filters() == selected, 'Product history lost the selected warehouse/group'
        page.wait_for_function("document.querySelectorAll('#tbodyHistorico tr').length>0")
        page.locator('.clean-sub-btn[data-view="produtos"]').click()
        page.locator('#view-produtos .purchase-workspace-modes [data-pw-view="variacao"]').click()
        expect_view('variacao', 'compras')
        page.locator('#view-variacao .purchase-workspace-modes [data-pw-view="atualizacao-custos"]').click()
        expect_view('atualizacao-custos', 'compras')
        assert filters() == selected
        assert page.locator('#db-navigation-context').get_attribute('data-scope') in ['own', 'mixed']
        assert page.locator('#db-navigation-context .clean-context-note').inner_text().strip()
        assert page.evaluate(fingerprint) == before, 'Navigation changed source totals'
        assert not page.evaluate('DB_FAST.stats.errors'), page.evaluate('DB_FAST.stats.errors')
        # Check responsive geometry and controls without creating image artifacts.
        viewport = page.viewport_size
        try:
            page.set_viewport_size({'width': 430, 'height': 932})
            page.evaluate("window.DB_NAVIGATION.go('geral');window.DB_MANAGEMENT_OVERVIEW.refresh();window.scrollTo(0,0)")
            expect_view('geral', 'resumo')
            page.evaluate('()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))')
            mobile_summary = page.evaluate("""() => {
              const fits=selector=>[...document.querySelectorAll(selector)].every(el=>{
                const r=el.getBoundingClientRect();return r.width>0&&r.height>0&&r.left>=-1&&r.right<=innerWidth+1;
              });
              return {width:innerWidth,menus:document.querySelectorAll('.clean-primary-btn').length,
                cards:document.querySelectorAll('#db-management-summary .db-summary-card').length,
                menuFits:fits('.clean-primary-btn'),cardsFit:fits('#db-management-summary .db-summary-card'),
                bodyFits:Math.max(document.documentElement.scrollWidth,document.body.scrollWidth)<=innerWidth+1};
            }""")
            assert mobile_summary == {'width': 430, 'menus': 4, 'cards': 5,
                                      'menuFits': True, 'cardsFit': True, 'bodyFits': True}, mobile_summary
            assert filters() == selected
            page.locator('.clean-primary-btn[data-group="compras"]').click()
            page.locator('.clean-sub-btn[data-view="produtos"]').click()
            expect_view('produtos', 'compras')
            for source, target in [('produtos', 'variacao'), ('variacao', 'atualizacao-custos'),
                                   ('atualizacao-custos', 'produtos')]:
                mode = page.locator('#view-' + source + ' .purchase-workspace-modes [data-pw-view="' + target + '"]')
                assert mode.is_visible()
                mode.click()
                expect_view(target, 'compras')
                assert filters() == selected, 'Mobile price navigation changed the selected filters'
                assert page.evaluate("Math.max(document.documentElement.scrollWidth,document.body.scrollWidth)<=innerWidth+1"), target
            assert page.evaluate(fingerprint) == before, 'Responsive navigation changed source totals'
        finally:
            if viewport:
                page.set_viewport_size(viewport)
        return {'primaryMenus': 4, 'secondaryDestinations': sum(map(len, groups.values())),
                'singleEconomyPanel': True, 'executiveAlias': 'geral',
                'summaryShortcuts': 5, 'filtersPreserved': True,
                'priceModes': 3, 'productHistoryShortcut': True, 'dataUnchanged': True,
                'responsive': {'width': 430, 'menus': 4, 'summaryCards': 5,
                               'priceModesReachable': True, 'noBodyOverflow': True}}
    finally:
        set_filters(previous['filters'])
        if previous['view']:
            page.evaluate('view=>window.DB_NAVIGATION.go(view)', previous['view'])
        page.evaluate("open=>{document.querySelector('.filters').classList.toggle('clean-open',open);window.DB_NAVIGATION.refresh();}", previous['filtersOpen'])


def check_replenishment_units(page, meta):
    """Use the independently audited 26/11 snapshot as a monetary regression oracle."""
    audit = page.evaluate("""() => {
      const same = row => String(row.codigo)==='102793' && String(row.codigo_local)==='50115';
      const stock=STOCK.filter(same),movement=MOVEMENTS.find(same);
      const raw=window.CURRENT_STOCK_20260911.rows.filter(row=>
        String(row[3])==='102793' && String(row[1])==='50115');
      return {stock,raw,movement,units:window.DB_APPROVED_STOCK_UNIT_AUDIT,
        summary:window.DB_STOCK_UNIFIED.getSummary(),
        normalization:window.CURRENT_STOCK_META.normalizacaoUnidades};
    }""")
    assert len(audit['stock']) == len(audit['raw']) == 1, audit
    wire = audit['stock'][0]
    original = audit['raw'][0]
    assert original[6:10] == ['MT', 5, 483.84, 2419.21], original
    assert wire['un'] == 'MT' and wire['estoque'] == 5000, wire
    assert wire['estoque_erp_original'] == 5 and wire['custo_erp_original'] == 483.84, wire
    assert wire['valor_estoque'] == wire['valor_erp_original'] == 2419.21, wire
    assert math.isclose(wire['custo_estoque'], 2419.21 / (5 * 1000), abs_tol=1e-12), wire
    assert wire['normalizacao_unidade_aprovada'] and wire['fator_conversao_unidade'] == 1000, wire
    units = audit['units']
    assert units['positions'] == 1 and units['deltaCents'] == 0, units
    assert units['originalCents'] == units['normalizedCents'] == 241921, units
    assert len(units['changes']) == len(audit['normalization']) == 1, units
    movement = audit['movement']
    assert movement['complete_total'] == 45000, movement
    assert math.isclose(movement['avg'], 45000 / 22, abs_tol=1e-10), movement
    assert movement['minimum'] == 4090.91 and movement['stock'] == 5000, movement
    assert movement['need'] == movement['need_value'] == 0, movement
    assert math.isclose(movement['cost'], 2419.21 / 5000, abs_tol=1e-12), movement

    # These expected values come from the source audit, not the displayed totals.
    # The former 5 MT / R$ 483.842 basis alone generated R$ 1,976,934.86622.
    assert meta['physicalNeedItems'] == 160, meta
    assert math.isclose(meta['physicalNeedValue'], 22027.12823036052, abs_tol=0.0001), meta
    assert audit['summary']['items'] == 160, audit['summary']
    assert math.isclose(audit['summary']['value'], 22027.12823036052, abs_tol=0.0001), audit['summary']
    shared = meta['sharedChua']
    for field, expected in [('minGrossValue', 22683.44425772809),
                            ('minCoverValue', 1312.2530700999419),
                            ('minPurchaseValue', 21371.19118762815),
                            ('maxPurchaseValue', 57220.51073632259)]:
        assert math.isclose(shared[field], expected, abs_tol=0.0001), (field, shared)

    panel = page.locator('#db-stock-maximum')
    note = panel.locator('#dbmx-unit-normalization-note')
    assert note.count() == 1 and note.locator('summary').is_visible()
    assert note.evaluate('el=>el.open') is False
    note.locator('summary').click()
    assert '102793' in note.inner_text() and '5.000' in note.inner_text(), note.inner_text()
    note.locator('summary').click()
    local = panel.locator('.dbmx-local[data-dbmx-local="ALMOXARIFADO GERAL F SJ"]')
    assert local.get_attribute('aria-expanded') == 'false'
    local.click()
    group_selector = '.dbmx-group[data-dbmx-group=' + json.dumps(wire['grupo'], ensure_ascii=False) + ']'
    panel.locator(group_selector).click()
    displayed = panel.locator('.dbmx-code', has_text=re.compile(r'^102793$')).locator('..')
    assert displayed.count() == 1 and displayed.is_visible()

    def quantity(label):
        text = displayed.locator('td[data-label=' + json.dumps(label, ensure_ascii=False) + ']').inner_text()
        return float(re.sub(r'[^0-9,-]', '', text).replace(',', '.'))

    assert quantity('Mínimo (2 meses)') == 4090.91
    assert quantity('Saldo atual') == 5000
    assert quantity('Qtd. a repor') == 0
    assert quantity('Custo unit. de referência') == 0.48
    assert float(displayed.get_attribute('data-dbmx-replenishment-sort')) == 0
    assert displayed.get_attribute('data-dbmx-color') == 'ok'
    local.click()
    page.locator('.tab[data-view="geral"]').evaluate('(el)=>el.click()')
    page.wait_for_function("""() => {
      const text=document.getElementById('db-summary-need')?.textContent||'';
      return Number(text.replace(/[^0-9,]/g,'').replace(',','.'))===22027.13;
    }""")
    page.locator('.tab[data-view="minimo"]').evaluate('(el)=>el.click()')
    page.wait_for_function("window.DB_STOCK_UNIFIED.meta.physicalNeedItems===160")
    return {'physicalItems': 160, 'physicalValue': meta['physicalNeedValue'],
            'netNetworkPurchaseValue': shared['minPurchaseValue'], 'wireStockMeters': wire['estoque']}


BAIXAS_AUDIT = json.loads((root / 'build-baixas-audit.json').read_text(encoding='utf-8'))
# The runtime is checked against the audited inputs of the current build,
# rather than keeping an obsolete stock value in several unrelated tests.
for batch in ('20261117', '20261119', '20261122', '20261126'):
    imported = json.loads((root / f'build-remessa-{batch}.json').read_text(encoding='utf-8'))
    withdrawals = imported['withdrawals']
    BAIXAS_AUDIT['revisedRecords'] = withdrawals['totalRecords']
    BAIXAS_AUDIT['totalValue'] = withdrawals['totalCents'] / 100
    for period in (BAIXAS_AUDIT['annual']['2026'], BAIXAS_AUDIT['november']):
        period['records'] += withdrawals['added']
        period['value'] = round(period['value'] + withdrawals['addedCents'] / 100, 2)
CURRENT_REMESSA = imported
WITHDRAWAL_INPUT = json.loads(gzip.decompress(base64.b64decode(
    (root / 'data/remessa-delta-20261126.b64').read_text(encoding='utf-8'))))
CURRENT_INPUT = json.loads(gzip.decompress(base64.b64decode(
    (root / 'data/stock-snapshot-20261126.b64').read_text(encoding='utf-8'))))
CURRENT_STOCK_AUDIT = json.loads((root / 'build-stock-20261126.json').read_text(encoding='utf-8'))
CDI_ALLOCATION_INPUT = json.loads(gzip.decompress(base64.b64decode(
    (root / 'data/cdi-allocation-input-20261126.b64').read_text(encoding='utf-8'))))
EXPECTED_CDI_MAY_PURCHASES = [row for row in CDI_ALLOCATION_INPUT['purchases']
    if row['date'].startswith('2026-05')]
EXPECTED_CDI_MAY_CENTS = sum(row['totalCents'] for row in EXPECTED_CDI_MAY_PURCHASES)
EXPECTED_STOCK_ROWS = len(CURRENT_INPUT['rows'])
EXPECTED_STOCK_DATE = CURRENT_INPUT['meta']['date']
EXPECTED_STOCK_ERP = sum(round(row[9] * 100) for row in CURRENT_INPUT['rows']) / 100
EXPECTED_FISCAL_POSITIONS = sorted([
    [str(row[0]), str(row[1]), str(row[3]), str(row[6]), row[7], round(row[9] * 100)]
    for row in CURRENT_INPUT['rows']
])
EXPECTED_CDI_CORREIA_BALANCE = sum(row[7] for row in CURRENT_INPUT['rows']
    if str(row[1])=='30115' and str(row[3])=='115220' and row[6]=='PC')
assert CURRENT_STOCK_AUDIT['records'] == EXPECTED_STOCK_ROWS
assert CURRENT_STOCK_AUDIT['date'] == EXPECTED_STOCK_DATE
assert CURRENT_STOCK_AUDIT['cents'] == round(EXPECTED_STOCK_ERP * 100)
assert CURRENT_STOCK_AUDIT['historyUntouched'] and CURRENT_STOCK_AUDIT['purchasesUntouched']
assert CURRENT_REMESSA['withdrawals']['added'] == len(WITHDRAWAL_INPUT['withdrawals']['rows'])
assert CURRENT_REMESSA['withdrawals']['addedCents'] == sum(row[9] for row in WITHDRAWAL_INPUT['withdrawals']['rows'])
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
        if name in ('legacy','fast'):
            overview_fn=page.evaluate("""() => ({
              overviewFn: (typeof renderOverview==='function'?renderOverview.toString():'unknown').slice(0,26000),
              currentView:document.querySelector('.tab.active')?.dataset?.view,
              stockCount:STOCK.length,stockProducts:new Set(STOCK.map(x=>String(x.codigo))).size,
              productRows:PRODUCTS.length,productsWithStock:PRODUCTS.filter(x=>Number(x.estoque)>0).length
            })""")
            print('KPI_AUDIT_SOURCE',name,json.dumps(overview_fn,ensure_ascii=False),flush=True)
            if name=='fast':
                page.locator('.tab[data-view="geral"]').evaluate('(el)=>el.click()')
                page.wait_for_timeout(350)
                overview_values=page.evaluate("""() => ({
                  values:[...document.querySelectorAll('#view-geral .card')].map(el=>({
                    label:el.querySelector('.k')?.textContent?.trim(),
                    value:el.querySelector('.v')?.textContent?.trim()
                  })).filter(x=>x.label),
                  stats:window.DB_FAST?.stats
                })""")
                print('KPI_AUDIT_RENDERED',json.dumps(overview_values,ensure_ascii=False),flush=True)


        if optimized and 'Pilot' not in name:
            # O CSV atualiza as transferencias; os 44 custos ausentes permanecem pendentes.
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
                missingCost:api.getRows().filter(x=>x.sourceValueCents===null&&x.movedCents===null).length,
                originalValue:api.getRows().filter(x=>x.sourceValueCents!==null).reduce((n,x)=>n+x.sourceValueCents,0),
                beforeRejected,duplicateRejected,card:document.querySelector('#cdi-transfer-panel #cdtr-count').textContent,
                valueLabel:document.querySelector('#cdtr-value-label').textContent,
                coverageText:document.querySelector('#cdtr-foot').textContent};
            }""")
            assert cdi['m']['approvalDate']=='2026-05-07' and cdi['m']['rows']==228 and cdi['m']['status']=='REGISTRADO', cdi
            assert cdi['m']['pricedRecords']==184 and cdi['m']['unpricedRecords']==44, cdi
            assert cdi['m']['valueCoverage']=='partial' and cdi['m']['latestTransferDate']=='2026-11-25', cdi
            assert cdi['m']['movedCents']==cdi['m']['importedValueCents']==cdi['originalValue']==6277990, cdi
            assert cdi['missingCost']==44 and cdi['m']['validatedCents'] is None, cdi
            assert cdi['cost']==2000 and cdi['verified']==2000 and cdi['beforeRejected'] and cdi['duplicateRejected'], cdi
            assert cdi['card'].strip()=='228' and 'Subtotal conhecido' in cdi['valueLabel'], cdi
            assert '184 com custo conhecido e 44 com custo pendente' in cdi['coverageText'], cdi
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
            assert purchase30115['meta']['localCode']=='30115' and purchase30115['meta']['lines']==270, purchase30115
            assert purchase30115['meta']['totalCents']==15430869 and purchase30115['meta']['distinctSkuUnits']==218, purchase30115
            assert purchase30115['meta']['to']=='2026-11-10', purchase30115
            assert purchase30115['groups']==14 and purchase30115['sumGroups']==15430869, purchase30115
            assert purchase30115['sumMonths']==15430869 and purchase30115['hasPanel'], purchase30115
            assert purchase30115['ruleYes'] and not purchase30115['ruleNoOtherLocal'], purchase30115
            assert not purchase30115['ruleNoOtherType'] and not purchase30115['ruleNoBefore'], purchase30115
            # Cascata das 270 compras conciliadas, incluindo os custos atuais da fonte.
            page.wait_for_function("window.CDI_DISTRIBUTION_PURCHASES?.cascade?.ready===true && window.CDI_DISTRIBUTION_PURCHASES.cascade.getRows().length===270", timeout=20000)
            cascade_initial=page.evaluate("""() => {
              const x=window.CDI_DISTRIBUTION_PURCHASES;
              return {rows:x.cascade.getRows().length,summary:x.filteredSummary,months:document.querySelectorAll('#dp-month option').length,
                groups:document.querySelectorAll('#dp-group option').length,products:document.querySelectorAll('#dp-product option').length,
                hasDocTable:document.querySelectorAll('#dp-records tr').length===270};
            }""")
            assert cascade_initial['rows']==270 and cascade_initial['summary']['cents']==15430869, cascade_initial
            assert cascade_initial['months']==8 and cascade_initial['groups']==15 and cascade_initial['products']==219, cascade_initial
            assert cascade_initial['hasDocTable'], cascade_initial
            page.locator('#dp-month').evaluate("(el)=>{el.value='2026-05';el.dispatchEvent(new Event('change',{bubbles:true}));}")
            month_summary=page.evaluate('window.CDI_DISTRIBUTION_PURCHASES.filteredSummary')
            assert month_summary['lines']==len(EXPECTED_CDI_MAY_PURCHASES) and month_summary['cents']==EXPECTED_CDI_MAY_CENTS, month_summary
            first_group=page.locator('#dp-group option').nth(1).get_attribute('value')
            page.locator('#dp-group').evaluate("(el,v)=>{el.value=v;el.dispatchEvent(new Event('change',{bubbles:true}));}", first_group)
            group_summary=page.evaluate('window.CDI_DISTRIBUTION_PURCHASES.filteredSummary')
            assert group_summary['lines']>0 and group_summary['lines']<=len(EXPECTED_CDI_MAY_PURCHASES), group_summary
            first_product=page.locator('#dp-product option').nth(1).get_attribute('value')
            page.locator('#dp-product').evaluate("(el,v)=>{el.value=v;el.dispatchEvent(new Event('change',{bubbles:true}));}", first_product)
            product_summary=page.evaluate('window.CDI_DISTRIBUTION_PURCHASES.filteredSummary')
            assert product_summary['lines']>0 and product_summary['lines']<=group_summary['lines'], product_summary
            page.locator('#dp-reset').evaluate("(el)=>el.click()")
            assert page.evaluate('window.CDI_DISTRIBUTION_PURCHASES.filteredSummary.cents')==15430869

            # A apuracao tem boot assincrono e deve estar pronta, sem aceitar apenas
            # o painel de erro. Reservas de outras saidas nao viram ganho elegivel.
            page.wait_for_function("window.DB_CDI_BULK_AUDIT?.ready===true && window.DB_UNIFIED_ECONOMY?.ready===true", timeout=20000)
            allocation=page.evaluate("""() => {
              const api=window.DB_CDI_BULK_AUDIT,p=api.data,received=api.getScenario('received');
              return {version:p.v,rows:api.getRows().length,distribution:p.categories.DISTRIBUICAO,
                chua:p.categories.CONSUMO_CHUA,losses:p.categories.PERDA_D410,
                missingERP:p.rows.filter(r=>r.type==='DISTRIBUICAO'&&r.amountERPCents===null).length,
                gain:p.purchaseGain,overall:p.meta.allPurchaseComparison,
                eligible:p.rows.filter(r=>r.benefitEligible).reduce((n,r)=>n+(r.allocatedNetCents??0),0),
                reserved:p.rows.filter(r=>!r.benefitEligible).reduce((n,r)=>n+(r.allocatedNetCents??0),0),
                receivedDistribution:received.categories.DISTRIBUICAO,
                receivedPendingLinks:received.rows.flatMap(r=>r.links).filter(l=>l.receipt!=='received').length,
                certified:p.meta.financialSavingsCertified,noAdditionalSavings:p.meta.noAdditionalSavings,
                unifiedNet:window.DB_UNIFIED_ECONOMY.summary().net};
            }""")
            assert allocation['version']==2 and allocation['rows']==901, allocation
            distribution=allocation['distribution']
            assert distribution['events']==228 and distribution['knownERPEvents']==184, allocation
            assert distribution['missingERPEvents']==allocation['missingERP']==44 and distribution['amountERPCents']==6277990, allocation
            assert distribution['matchedEvents']==124 and distribution['referenceEvents']==119, allocation
            assert distribution['allocatedNetCents']==4390993 and allocation['chua']['allocatedNetCents']==179333, allocation
            assert allocation['losses']['events']==54 and allocation['losses']['benefitEligible'] is False, allocation
            gain=allocation['gain']
            assert gain['netCents']==6596317 and gain['allocatedNetCents']+gain['residualNetCents']==gain['netCents'], allocation
            assert gain['eligibleAllocatedNetCents']==allocation['eligible']==4570326, allocation
            assert gain['excludedReservedNetCents']==allocation['reserved']==447906, allocation
            assert allocation['eligible']+allocation['reserved']==gain['allocatedNetCents'], allocation
            assert allocation['receivedDistribution']['allocatedNetCents']==288211 and allocation['receivedPendingLinks']==0, allocation
            assert allocation['overall']['netCents']==allocation['unifiedNet']==9294618, allocation
            assert gain['netCents']+allocation['overall']['directNetCents']==allocation['overall']['netCents'], allocation
            assert allocation['certified'] is False and allocation['noAdditionalSavings'] is True, allocation

            # Exercise only this panel's details and restore their previous state.
            allocation_details=page.evaluate("""() => ['eu-audit','cea-details'].map(id=>{
              const el=document.getElementById(id),previous={id,open:el.open};el.open=true;return previous;
            })""")
            try:
                page.locator('#cea-scenario').evaluate("el=>{el.value='received';el.dispatchEvent(new Event('change',{bubbles:true}));}")
                assert page.locator('#cea-count').text_content().strip()=='228'
                assert '2.882,11' in page.locator('#cea-difference').text_content()
                page.locator('#cea-scenario').evaluate("el=>{el.value='all';el.dispatchEvent(new Event('change',{bubbles:true}));}")
                assert '43.909,93' in page.locator('#cea-difference').text_content()
                assert 'Não informado' in page.locator('#cea-rows').text_content()
                with page.expect_download() as allocation_download:
                    page.locator('#cea-export').evaluate('el=>el.click()')
                with Path(allocation_download.value.path()).open(encoding='utf-8-sig',newline='') as handle:
                    allocation_csv=list(csv.DictReader(handle,delimiter=';'))
                assert len(allocation_csv)==228, len(allocation_csv)
                missing_cost_csv=[r for r in allocation_csv if r['Custo saida ERP centavos']=='']
                assert len(missing_cost_csv)==44 and all(r['Seq saida']=='' for r in missing_cost_csv), missing_cost_csv
                assert sum(int(r['Custo saida ERP centavos']) for r in allocation_csv if r['Custo saida ERP centavos'])==6277990
                assert all(r['Elegivel utilizacao']=='SIM' and r['Cenario']=='all' for r in allocation_csv)
            finally:
                page.locator('#cea-scenario').evaluate("el=>{el.value='all';el.dispatchEvent(new Event('change',{bubbles:true}));}")
                page.evaluate("states=>states.forEach(s=>{document.getElementById(s.id).open=s.open;})", allocation_details)



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
            window.LATEST_PURCHASE_META?.sourceRows===2954 &&
            window.LATEST_PURCHASE_META?.source==='COMPRAS_DE_INSUMOS_POR_LOCAL(7).xlsx'
        })""")
        if purchase_checks['rows']!=2954:
            print('PURCHASE DEBUG',name,'ERRORS',errors,'DELTA',page.evaluate("""() => ({delta:window.DB_PURCHASES_20261110_DELTA?.meta, audited:window.DB_AUDITED_PURCHASE_META, latest:window.LATEST_PURCHASE_META, loaded:window.DB_AUDITED_PURCHASE_READY})"""),flush=True)
        assert purchase_checks['aug']==197 and purchase_checks['sep']==241 and purchase_checks['oct']==152, purchase_checks
        assert abs(purchase_checks['sepValue']-118631.41)<0.02 and abs(purchase_checks['octValue']-88306.91)<0.02, purchase_checks
        assert abs(purchase_checks['monthlyOct']-88306.91)<0.02 and abs(purchase_checks['total']-1865379.70)<0.02, purchase_checks
        assert purchase_checks['rows']==2954 and purchase_checks['historical2025']==1149 and purchase_checks['historical2026']==1805, purchase_checks
        assert abs(purchase_checks['rollerRef']-62.11)<0.01 and purchase_checks['correctMeta'] and purchase_checks['octoberUnique'], purchase_checks
        nov13=page.evaluate("""() => ({
            rows:PURCHASES.filter(x=>[2720614,2720618].includes(Number(x.nrounico))).map(x=>({
              key:[Number(x.nrounico),Number(x.seq),Number(x.codigo),Number(x.codigo_local)].join('|'),
              cents:Math.round(x.valor*100),status:x.status})),
            delta:window.DB_PURCHASES_20261113_AUDIT
        })""")
        assert len(nov13['rows'])==8 and len(set(r['key'] for r in nov13['rows']))==8,nov13
        assert sum(r['cents'] for r in nov13['rows'])==401105,nov13
        assert all(r['status']=='LANC.RECEB.' for r in nov13['rows']),nov13
        assert nov13['delta']['ready'] is True and nov13['delta']['duplicateLines']==0,nov13
        nov17=page.evaluate("""() => ({
            rows:PURCHASES.filter(x=>[2722117,2723145,2723194,2723206,2723210].includes(Number(x.nrounico)))
              .map(x=>({key:[Number(x.nrounico),Number(x.seq),Number(x.codigo),Number(x.codigo_local)].join('|'),
                         cents:Math.round(x.valor*100),status:x.status})),
            audit:window.DB_PURCHASES_20261117_AUDIT
        })""")
        assert len(nov17['rows'])==24 and len(set(r['key'] for r in nov17['rows']))==24,nov17
        assert sum(r['cents'] for r in nov17['rows'])==784514,nov17
        assert sum(r['cents'] for r in nov17['rows'] if r['status']=='LANC.RECEB.')==667529,nov17
        assert sum(r['cents'] for r in nov17['rows'] if r['status']=='NÃO LANC.RECEB.')==116985,nov17
        assert nov17['audit']['ready'] is True and nov17['audit']['duplicateLines']==0,nov17

        if optimized and name=='fast':
            audit_summary=page.evaluate("""() => {
              const key=x=>String(x.codigo)+'|'+String(x.un||'');
              const stockSku=new Set(STOCK.map(key)),purchaseSku=new Set(PURCHASES.map(key));
              const code=new Set(STOCK.map(x=>String(x.codigo)));
              const withHist=[...stockSku].filter(x=>purchaseSku.has(x));
              const withoutHist=[...stockSku].filter(x=>!purchaseSku.has(x));
              const suppliers=new Set(PURCHASES.map(x=>String(x.fornecedor||'')).filter(Boolean));
              const sum=a=>a.reduce((s,x)=>s+Number(x||0),0);
              const cards=[...document.querySelectorAll('.card')].map(x=>({label:x.querySelector('.k')?.textContent?.trim(),value:x.querySelector('.v')?.textContent?.trim()})).filter(x=>x.label);
              return {stockRows:STOCK.length, stockDistinctCodes:code.size, stockDistinctSku:stockSku.size,
                purchaseRows:PURCHASES.length,purchaseDistinctSku:purchaseSku.size,
                productsRows:PRODUCTS.length,productsWithPrice:PRODUCTS.filter(x=>Number(x.registros)>0).length,
                productsWithoutPrice:PRODUCTS.filter(x=>!(Number(x.registros)>0)).length,
                intersection:withHist.length,noHistory:withoutHist.length,
                stockRowsWithPurchase:STOCK.filter(x=>purchaseSku.has(key(x))).length,
                stockRowsWithoutPurchase:STOCK.filter(x=>!purchaseSku.has(key(x))).length,
                suppliers:SUPPLIERS.length,distinctSupplierNames:suppliers.size,
                stockPriceVarOver50:new Set(STOCK.filter(x=>Number(x.variacao)>.5).map(key)).size,
                productsPriceVarOver50:PRODUCTS.filter(x=>Number(x.variacao)>.5).length,
                stockDiff:sum(STOCK.map(x=>x.dif_estoque_min)),
                stockDiffNoTires:sum(STOCK.filter(x=>!window.DB_IS_TIRE_OR_CAMERA(x)).map(x=>x.dif_estoque_min)),
                priceMinMatching:STOCK.filter(x=>Number(x.min_preco)>0).length,
                cards};
            }""")
            print('OVERVIEW_AUDIT_20261110',audit_summary,flush=True)
            print('OVERVIEW_FUNCTIONS_20261110',page.evaluate("""() => ({
              renderOverview: typeof renderOverview==='function'?renderOverview.toString().slice(0,13000):'absent',
              productFiltered:typeof productFiltered==='function'?productFiltered.toString().slice(0,3000):'absent',
              stockFiltered:typeof stockFiltered==='function'?stockFiltered.toString().slice(0,2500):'absent'
            })"""),flush=True)

        if optimized and name=='fast':
            page.wait_for_function("window.DB_APPROVED_COST_COMPARISON?.ready===true && window.DB_UNIFIED_ECONOMY?.ready===true", timeout=20000)
            economy=page.evaluate("""() => ({
                cost:window.DB_APPROVED_COST_COMPARISON.summary,
                unified:window.DB_UNIFIED_ECONOMY.summary(),
                purchaseRows:window.DB_UNIFIED_ECONOMY.getPurchases().length
            })""")
            nov13=economy['cost']['purchaseUpdates']['20261113']
            nov17=economy['cost']['purchaseUpdates']['20261117']
            assert economy['cost']['purchaseLines']==441 and economy['purchaseRows']==441, economy
            assert economy['cost']['purchaseCents']==24522074, economy
            assert nov13['records']==8 and nov13['cents']==401105, economy
            assert nov13['matchedReference']+nov13['missingReference']==8, economy
            assert nov17['records']==24 and nov17['cents']==784514, economy
            assert economy['cost']['comparisonBasis']=='CUSTO_TOTAL_ERP', economy
            assert economy['cost']['financialSavingsCertified'] is False, economy
            correction=economy['cost']['approvedProductCostCorrections']['124928']
            assert correction['referenceMicro']==7982580000 and correction['originalInvoicesPreserved'] is True,economy
            assert economy['cost']['netCents']==9294618, economy
            assert economy['cost']['positiveCents']==9926664 and economy['cost']['negativeCents']==-632046, economy
            assert economy['unified']['net']==economy['cost']['netCents'], economy
            # A aba de atualizacao consulta tres fontes mas nao edita ERP ou
            # indicadores gerenciais sem auditoria e publicacao oficial.
            cost_tab=page.locator('.tab[data-view="atualizacao-custos"]')
            assert cost_tab.count()==1
            page.locator('.clean-primary-btn[data-group="compras"]').click()
            page.locator('.clean-sub-btn[data-view="produtos"]').click()
            visible_cost=page.locator('#view-produtos .purchase-workspace-modes [data-pw-view="atualizacao-custos"]')
            assert visible_cost.count()==1 and visible_cost.is_visible()
            visible_cost.click()
            assert page.locator('#view-atualizacao-custos.active').count()==1
            page.wait_for_function("window.DB_COST_UPDATE?.meta?.loaded===true",timeout=20000)
            cost_state=page.evaluate("""() => ({
                meta:window.DB_COST_UPDATE.meta,
                officialReference:window.DB_APPROVED_COST_COMPARISON.getProducts()
                  .find(p=>p[1]==='105090'&&p[4]==='KG')?.[6],
                stockTotal:STOCK.reduce((s,x)=>s+(Number(x.valor_estoque)||0),0),
                correction:window.DB_APPROVED_PRODUCT_COST_AUDIT,
                costRows:window.DB_COST_UPDATE.getRows().filter(x=>
                  x.code==='124928'&&x.unit==='PC'&&x.hasStock).map(x=>({
                    erp:x.stockCost,management:x.managementCost,
                    erpValue:x.stockValueERP,managementValue:x.stockValue,
                    adjusted:x.stockCostAdjusted
                  })),
                correiaRows:STOCK.filter(x=>String(x.codigo)==='124928').map(x=>({
                  local:x.local,qty:x.estoque,cost:x.custo_estoque,value:x.valor_estoque,
                  erpCostOriginal:x.custo_erp_original,erpValueOriginal:x.valor_erp_original
                })),
                referenceCorreia:window.DB_APPROVED_COST_COMPARISON.getProducts()
                  .find(p=>p[1]==='124928'&&p[4]==='PC')?.[6],
                allPurchaseHistorical:window.DB_APPROVED_COST_COMPARISON.getPurchases().every(
                  x=>String(x[2])!=='124928'||x[10]!==7982580000)
            })""")
            assert cost_state['meta']['rows']>3000 and cost_state['meta']['gerencialWithReference']>0,cost_state
            assert cost_state['meta']['officialCostsChanged'] is False and cost_state['meta']['autoPublish'] is False,cost_state
            assert cost_state['officialReference']==24235000,cost_state
            assert cost_state['correction']['positions']>=1 and cost_state['correiaRows'],cost_state
            assert all(abs(r['cost']-7982.58)<0.001 and abs(r['value']-r['qty']*7982.58)<0.01
                       for r in cost_state['correiaRows']),cost_state
            assert cost_state['referenceCorreia']==7982580000,cost_state
            assert cost_state['costRows'],cost_state
            assert all(abs(r['erp']-9391.27)<0.001 and abs(r['management']-7982.58)<0.001
                       and r['adjusted'] is True for r in cost_state['costRows']),cost_state
            assert abs(cost_state['stockTotal']-
                       (EXPECTED_STOCK_ERP+cost_state['correction']['deltaCents']/100))<0.01,cost_state
            assert page.locator('#cu-local option').count()>2
            # Filtro em cascata: grupos e produtos ordenados pelo valor do
            # saldo fisico, sem confundir referencias de preco com estoque.
            cascade=page.evaluate("""() => {
                const rows=window.DB_COST_UPDATE.getRows();
                const groups=new Map();
                for(const r of rows)groups.set(r.group,(groups.get(r.group)||0)+r.stockValue);
                const expectedGroups=[...groups].sort((a,b)=>b[1]-a[1]||
                  a[0].localeCompare(b[0],'pt-BR')).map(x=>x[0]);
                const groupOptions=[...document.querySelector('#cu-group').options].slice(1);
                const initialProducts=[...document.querySelector('#cu-product').options].slice(1);
                const totals=new Map();
                for(const r of rows){const k=r.code+'|'+r.unit;totals.set(k,(totals.get(k)||0)+r.stockValue)}
                const actualProductTotals=initialProducts.map(o=>totals.get(o.value)||0);
                return {meta:window.DB_COST_UPDATE.meta,
                  expectedGroups,groupValues:groupOptions.map(x=>x.value),
                  groupLabels:groupOptions.map(x=>x.textContent),
                  productTotals:actualProductTotals,
                  firstValue:document.querySelector('#cu-rows tr')?.dataset?.cuStockValue||null};
            }""")
            assert cascade['meta']['cascade'] is True and cascade['meta']['sortBy']=='valor_estoque_desc',cascade
            assert cascade['groupValues']==cascade['expectedGroups'],cascade
            assert all(cascade['productTotals'][i]>=cascade['productTotals'][i+1]-0.001
                       for i in range(len(cascade['productTotals'])-1)),cascade
            assert any('Valor' not in x and ' ' in x for x in cascade['groupLabels']),cascade
            assert cascade['meta']['visualCascade'] is True,cascade
            visual=page.evaluate("""() => {
              const nodes=[...document.querySelectorAll('#cu-rows > .cu-group')];
              const values=nodes.map(x=>Number(x.dataset.cuStockValue));
              return {groups:nodes.length,open:nodes.filter(x=>x.querySelector('[data-cu-toggle-group]').getAttribute('aria-expanded')==='true').length,
                sorted:values.every((x,i)=>i===0||values[i-1]>=x-0.00001),
                detailRows:document.querySelectorAll('#cu-rows tr[data-cu-stock-value]').length};
            }""")
            assert visual['groups']>3 and visual['open']==0 and visual['sorted'] and visual['detailRows']==0,visual
            # Cada grupo precisa manter altura legivel dentro da lista rolavel.
            # Antes, flex-shrink comprimia cerca de 20 cartoes em 610px.
            card_layout=page.evaluate("""() => {
              const tree=document.querySelector('#cu-rows');
              const nodes=[...tree.querySelectorAll(':scope > .cu-group')];
              const buttons=nodes.map(n=>n.querySelector(':scope > .cu-node'));
              return {groups:nodes.length,overflow:getComputedStyle(tree).overflowY,
                minHeight:Math.min(...buttons.map(b=>b.getBoundingClientRect().height)),
                minVisibleText:Math.min(...buttons.map(b=>{
                  const text=b.querySelector('.cu-node-label b');
                  return text.getBoundingClientRect().height;
                })),
                shrink:nodes.some(n=>getComputedStyle(n).flexShrink!=='0')};
            }""")
            assert card_layout['groups']>3 and card_layout['minHeight']>=48,card_layout
            assert card_layout['minVisibleText']>=12 and card_layout['shrink'] is False,card_layout
            first_group=page.locator('#cu-rows > .cu-group').first
            first_group.locator('[data-cu-toggle-group]').click()
            assert first_group.locator('.cu-product').count()>0
            product_values=first_group.locator('.cu-product').evaluate_all("(nodes)=>nodes.map(n=>Number(n.dataset.cuStockValue))")
            assert all(product_values[i]>=product_values[i+1]-0.001 for i in range(len(product_values)-1)),product_values
            first_group.locator('.cu-product [data-cu-toggle-product]').first.click()
            assert first_group.locator('tr[data-cu-stock-value]').count()>=1
            page.locator('#cu-group').select_option(cascade['groupValues'][0])
            assert page.locator('#cu-product option').count()>1
            page.locator('#cu-product').select_option(index=1)
            assert page.locator('#cu-rows [data-cu-edit]').count()>=1
            page.locator('#cu-clear').click()
            page.locator('#cu-search').fill('105090')
            assert page.locator('#cu-rows [data-cu-edit]').count()>=1
            page.locator('#cu-rows [data-cu-edit]').first.click()
            page.locator('#cu-scope').select_option('GERENCIAL')
            page.locator('#cu-price').fill('24,500')
            page.locator('#cu-date').fill('2026-11-13')
            page.locator('#cu-document').fill('Tabela Custo linha teste')
            page.locator('#cu-reason').fill('Conferencia da origem de custo em teste de navegador')
            page.locator('#cu-save').click()
            cost_draft=page.evaluate("""() => ({
                drafts:window.DB_COST_UPDATE.getDrafts(),
                officialReference:window.DB_APPROVED_COST_COMPARISON.getProducts()
                  .find(p=>p[1]==='105090'&&p[4]==='KG')?.[6],
                officialChanged:window.DB_COST_UPDATE.meta.officialCostsChanged,
                fromLocalStorage:!!localStorage.getItem('db-cost-update-drafts-v1')
            })""")
            assert len(cost_draft['drafts'])==1 and cost_draft['drafts'][0]['proposed']==24.5,cost_draft
            assert cost_draft['officialReference']==24235000 and cost_draft['officialChanged'] is False,cost_draft
            assert cost_draft['fromLocalStorage'] is True,cost_draft
            page.locator('[data-cu-remove]').first.click()
            assert page.evaluate("window.DB_COST_UPDATE.getDrafts().length")==0


        snapshots[name] = page.evaluate(SNAPSHOT)
        results[name] = {
            'stockRows': len(snapshots[name]['stock']),
            'stockValue': round(sum(x[9] for x in snapshots[name]['stock']), 2),
            'approvedCostAudit': page.evaluate("window.DB_APPROVED_PRODUCT_COST_AUDIT || null"),
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
                preserveMin:window.STOCK_MINIMUM_MONTHS===2,
                adjustment:window.DB_APPROVED_PRODUCT_COST_AUDIT?.deltaCents||0
            })""")
            assert stockmeta['emitted']==EXPECTED_STOCK_DATE, stockmeta
            assert abs(stockmeta['total']-(EXPECTED_STOCK_ERP+stockmeta['adjustment']/100))<0.01 and stockmeta['warehouses']==9, stockmeta
            assert stockmeta['preserveHistory'] and stockmeta['preserveMin'], stockmeta
            # CDI demand must read the current physical 30115 stock by product
            # and unit, including products added after the original base.
            cdi_current=page.evaluate("""() => {
              const key=x=>String(x.codigo)+'|'+String(x.un||'').trim().toUpperCase();
              const physical=new Map();
              for(const x of STOCK.filter(x=>String(x.codigo_local)==='30115'))
                physical.set(key(x),(physical.get(key(x))||0)+(Number(x.estoque)||0));
              const rows=cdiNetworkAllRows();
              return {
                mismatches:rows.filter(x=>Math.abs((Number(x.stock)||0)-(physical.get(key(x))||0))>1e-8)
                  .map(x=>({code:x.codigo,unit:x.un,actual:x.stock,expected:physical.get(key(x))||0})),
                excluded:rows.filter(x=>window.DB_MINIMUM_EXCLUDED(x)).map(x=>x.codigo),
                correia:rows.find(x=>String(x.codigo)==='115220'&&x.un==='PC'),
                allTwoMonths:rows.every(x=>Math.abs(x.minimum-minimumRoundUp(x.avg*2,x.un))<1e-8)
              };
            }""")
            assert not cdi_current['mismatches'] and not cdi_current['excluded'],cdi_current
            assert cdi_current['allTwoMonths'],cdi_current
            assert cdi_current['correia']['stock']==EXPECTED_CDI_CORREIA_BALANCE,cdi_current
            assert cdi_current['correia']['minimum']==5,cdi_current
            assert cdi_current['correia']['need']==max(0,5-EXPECTED_CDI_CORREIA_BALANCE),cdi_current
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
                history_labels=page.evaluate("""() => ({
                  total:Number(document.querySelector('#full-movement-history > summary > b')
                    .textContent.replace(/[^0-9]/g,'')),
                  annual:[...document.querySelectorAll('#full-movement-history .erp-h-years > div')]
                    .map(el=>({year:el.querySelector('small').textContent.slice(0,4),
                      records:Number(el.querySelector('b').textContent.replace(/[^0-9]/g,'')),
                      value:Number(el.querySelector('span').textContent.replace(/[^0-9,]/g,'').replace(',','.'))}))
                })""")
                assert history_labels['total']==BAIXAS_AUDIT['revisedRecords'],history_labels
                for annual in history_labels['annual']:
                    expected=BAIXAS_AUDIT['annual'][annual['year']]
                    assert annual['records']==expected['records'],history_labels
                    assert abs(annual['value']-expected['value'])<0.01,history_labels
                # Exercise the on-demand daily file as well as the monthly totals.
                page.locator('.tab[data-view="baixas"]').evaluate('(el)=>el.click()')
                page.locator('#full-movement-history > summary').click()
                page.wait_for_function("window.DB_HISTORICO_BAIXAS.yearLoaded('2024')",timeout=20000)
                page.locator('#erp-h-year').select_option('2026')
                page.wait_for_function("window.DB_HISTORICO_BAIXAS.yearLoaded('2026')",timeout=20000)
                daily_history=page.evaluate("""() => ({
                  records:Number(document.querySelector('#erp-h-stat').textContent.split(' baixas')[0].replace(/[^0-9]/g,'')),
                  value:Number(document.querySelector('#erp-h-value').textContent.replace(/[^0-9,]/g,'').replace(',','.')),
                  lastDate:document.querySelector('#erp-h-body tr td')?.textContent,
                  request:performance.getEntriesByType('resource').some(x=>
                    x.name.endsWith('/baixas-detalhe-2026.json.gz?v=20261126'))
                })""")
                assert daily_history['records']==BAIXAS_AUDIT['annual']['2026']['records'],daily_history
                assert abs(daily_history['value']-BAIXAS_AUDIT['annual']['2026']['value'])<0.01,daily_history
                assert daily_history['lastDate']=='25/11/2026' and daily_history['request'],daily_history
                page.locator('#full-movement-history > summary').click()
            else:
                assert not historical['historyPanel'], 'Consulta consolidada nao pertence ao piloto'




            # Preserve every current fiscal position. A former two-company
            # product is no longer in this snapshot and cannot be a fixed fixture.
            fiscal_positions=page.evaluate("""() => STOCK.map(x=>[
                String(x.empresa),String(x.codigo_local),String(x.codigo),String(x.unidade_erp_original??x.un),
                Number(x.estoque_erp_original??x.estoque),Math.round(Number(x.valor_erp_original??x.valor_estoque)*100)
            ])""")
            assert sorted(fiscal_positions)==EXPECTED_FISCAL_POSITIONS,'ERP fiscal positions differ from the current source'
        if optimized and 'Pilot' not in name:
            # Posicoes de estoque: cascata local -> grupo -> produto preserva
            # quantidade, custo e referencia de precos do ERP.
            page.locator('.tab[data-view="estoque"]').evaluate('(el)=>el.click()')
            page.wait_for_function("window.DB_STOCK_LOCATION_CASCADE?.meta?.rows>0",timeout=20000)
            source_meta=page.evaluate("window.DB_STOCK_LOCATION_CASCADE.meta")
            assert source_meta['viewLevels']==['Almoxarifado','Grupo','Produto'],source_meta
            assert source_meta['rows']==EXPECTED_STOCK_ROWS,source_meta
            assert source_meta['visiblePositions']==source_meta['rows'],source_meta
            cascade=page.locator('#db-stock-cascade')
            print('DBSC_VISIBILITY_DEBUG',page.evaluate("""() => {
              const v=document.querySelector('#view-estoque'),p=document.querySelector('#db-stock-cascade');
              const legacy=[...v.querySelectorAll('.tablepanel')].find(el=>el.textContent.includes('Onde existe cada produto'));
              return {viewClass:v.className,viewDisplay:getComputedStyle(v).display,
                panelParent:p?.parentElement?.className, panelDisplay:p?getComputedStyle(p).display:'absent',
                panelParentDisplay:p?.parentElement?getComputedStyle(p.parentElement).display:'absent',
                panelRect:p?.getBoundingClientRect().toJSON(),
                title:p?.querySelector('h2')?.textContent,legacyHidden:legacy?.style.display,
                activeView:document.querySelector('.tab.active')?.dataset.view,
                otherPanels:[...v.querySelectorAll('.tablepanel')].slice(0,5).map(x=>({txt:x.textContent.slice(0,60),d:getComputedStyle(x).display}))};
            }"""),flush=True)
            assert cascade.is_visible()
            assert cascade.locator('[data-dbsc-loc]').count()>1
            assert cascade.locator('#dbsc-local option').count()>1
            first_stock_local=cascade.locator('#dbsc-local option').nth(1).get_attribute('value')
            cascade.locator('#dbsc-local').select_option(first_stock_local)
            local_meta=page.evaluate("window.DB_STOCK_LOCATION_CASCADE.meta")
            assert local_meta['selectedLocal']==first_stock_local and local_meta['visiblePositions']>0,local_meta
            assert cascade.locator('[data-dbsc-loc]').count()==1
            assert cascade.locator('#dbsc-group option').count()>1
            first_stock_group=cascade.locator('#dbsc-group option').nth(1).get_attribute('value')
            cascade.locator('#dbsc-group').select_option(first_stock_group)
            group_meta=page.evaluate("window.DB_STOCK_LOCATION_CASCADE.meta")
            assert group_meta['selectedGroup']==first_stock_group and group_meta['visiblePositions']>0,group_meta
            assert cascade.locator('#dbsc-product option').count()>1
            first_stock_product=cascade.locator('#dbsc-product option').nth(1).get_attribute('value')
            cascade.locator('#dbsc-product').select_option(first_stock_product)
            item_meta=page.evaluate("window.DB_STOCK_LOCATION_CASCADE.meta")
            assert item_meta['selectedProduct']==first_stock_product and item_meta['visiblePositions']>0,item_meta
            assert cascade.locator('.dbsc-scroll table tbody tr').count()>0
            assert cascade.locator('.dbsc-scroll thead th').count()==9
            cascade.locator('#dbsc-clear').click()
            reset_meta=page.evaluate("window.DB_STOCK_LOCATION_CASCADE.meta")
            assert reset_meta['selectedLocal']=='' and reset_meta['selectedGroup']=='' and reset_meta['selectedProduct']=='',reset_meta
            assert reset_meta['visiblePositions']==reset_meta['rows'],reset_meta
            page.locator('.tab[data-view="executivo"]').evaluate('(el)=>el.click()')

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
              const panel=document.querySelector('#view-geral .capital-hierarchy');
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
            capital_panel=page.locator('#view-geral .capital-hierarchy')
            capital_panel.wait_for(state='visible')
            original_local_count=capital_panel.locator('.capital-column[data-index]').count()
            assert original_local_count>=2
            def ensure_executive_local():
                assert page.locator('.tab[data-view="geral"].active').count()==1, 'Navegacao saiu do Resumo unificado'
                assert capital_panel.locator('.capital-crumb[data-level="group"]').count()==0, 'Nao voltou aos locais'
                assert capital_panel.locator('.capital-column[data-index]').count()==original_local_count, 'Locais alterados'
            capital_panel.locator('.capital-column[data-index]').first.click()
            assert capital_panel.locator('.capital-crumb[data-level="group"]').count()==1
            assert page.locator('.tab[data-view="geral"].active').count()==1
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
            for view in ['geral', 'estoque', 'sem-baixas', 'baixas', 'minimo', 'produtos', 'fornecedores', 'historico', 'cdi', 'variacao', 'resultados', 'economia', 'orcamentos']:
                selector = f'.tab[data-view="{view}"]'
                if not page.locator(selector).count():
                    continue
                page.locator(selector).evaluate('(el)=>el.click()')
                page.wait_for_timeout(120)
                assert page.locator('#view-' + view).evaluate("el=>el.classList.contains('active')"), view

            results[name]['variationExcelExport'] = check_variation_excel_export(page)

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
            assert meta4['stockDate']==EXPECTED_STOCK_DATE, meta4
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
            assert page.locator('.clean-sub-btn[data-view="minimo"]').inner_text().strip()=='Reposição'
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
            results[name]['replenishmentUnits'] = check_replenishment_units(page, meta4)
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
            # Prioridade de compra: ordenacao por valor estimado de reposicao.
            assert page.evaluate("window.DB_STOCK_UNIFIED.meta.sortedByReplenishmentValueDesc") is True
            assert page.evaluate("window.DB_STOCK_UNIFIED.meta.fullWidthProducts") is True
            assert page.evaluate("window.DB_STOCK_UNIFIED.meta.allProductColumnsHorizontal") is True
            assert page.evaluate("window.DB_STOCK_UNIFIED.meta.purchaseValueColumnHidden") is True
            def inspect_products_layout():
                return page.evaluate("""() => {
                    const box=document.querySelector('#db-stock-maximum .dbmx-scroll');
                    const table=box.querySelector('table');
                    const rows=[...table.querySelectorAll('tbody tr')];
                    const quantities=rows.map(r=>Number(r.dataset.dbmxReplenishmentSort));
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
            assert all(x['label'] in ['REPOR','EXCEDENTE DISPONÍVEL',
                'EXCEDENTE · HISTÓRICO INSUFICIENTE','ESTOQUE ADEQUADO',
                'SEM BAIXAS','HISTÓRICO INSUFICIENTE','REVISAR UNIDADE'] for x in statuses),statuses
            # Estoque com menos de 3 meses com baixas entra em excedente
            # provisório: aparece no filtro, mas não gera transferência automática.
            provisional_audit=page.evaluate("""() => {
              const meta=window.DB_STOCK_UNIFIED.meta||{};
              return {
                total:meta.physicalExcessItems,
                provisional:meta.provisionalExcessItems,
                confirmed:meta.verifiedExcessItems,
                amount:meta.physicalExcessValue,
                provisionalValue:meta.provisionalExcessValue,
                confirmedValue:meta.verifiedExcessValue,
                noAutoTransfers:meta.provisionalExcessAutoTransfers===false,
                needsReview:meta.provisionalExcessNeedsValidation===true,
                historyMonths:meta.minimumHistoryActiveMonths
              };
            }""")
            assert provisional_audit['provisional']>0, provisional_audit
            assert provisional_audit['total']==provisional_audit['provisional']+provisional_audit['confirmed'], provisional_audit
            assert abs(provisional_audit['amount']-provisional_audit['provisionalValue']-provisional_audit['confirmedValue'])<0.02, provisional_audit
            assert provisional_audit['noAutoTransfers'] and provisional_audit['needsReview'], provisional_audit
            assert provisional_audit['historyMonths']==3, provisional_audit
            assert page.locator('#db-stock-maximum .dbmx-kpi',has_text='Excedentes por histórico insuficiente').count()==1
            # Os produtos devem expandir abaixo do respectivo grupo, sem painel de detalhe apartado.
            panel.locator('.dbmx-group').first.click()
            assert panel.locator('.dbmx-products').count()==0
            panel.locator('.dbmx-local').first.click()
            assert panel.locator('.dbmx-detail').count()==0
            panel.locator('.dbmx-local').first.click()
            assert panel.locator('.dbmx-detail').count()==1
            panel.locator('.dbmx-group').first.click()
            for header in ['Mínimo (2 meses)','Máximo (4 meses)','Saldo atual','Qtd. a repor',
                           'Qtd. excedente','Valor excedente','Custo unit. de referência']:
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

            # Planejamento de 2 meses: cada saldo fiscal entra uma vez, com
            # reserva da Chua, transferencias propostas e compra liquida.
            # Controle das solicitacoes Sankhya: nao confundir solicitacao emitida
            # com pedido aprovado ou entrega ao estoque.
            purchase_tab=page.locator('.tab[data-view="compras-programadas"]')
            assert purchase_tab.count()==1
            purchase_tab.evaluate('(el)=>el.click()')
            page.wait_for_function("window.DB_CDI_ORDER_TRACKER?.meta?.documents>=1", timeout=15000)
            tracker=page.evaluate("window.DB_CDI_ORDER_TRACKER.meta")
            assert tracker['groups']==3 and tracker['documents']==3,tracker
            assert tracker['lines']==34 and tracker['products']==34,tracker
            assert tracker['latestRequest']=='111044' and tracker['latestDate']=='2026-11-12',tracker
            assert tracker['cadenceMonths']==2 and tracker['alertBeforeDays']==15,tracker
            assert tracker['centralLocal']=='30115' and tracker['source']=='SANKHYA',tracker
            assert tracker['purchasedConfirmed'] is False and tracker['receivedConfirmed'] is False
            assert tracker['groupedBy']==['Grupo','Solicitação','Item'],tracker
            assert tracker['externalNotifications'] is False
            due=tracker['nextDue']
            assert len(due)==3 and {x['group']:x['date'] for x in due}=={
                'CORREIAS':'2027-01-12','FERRAMENTAS':'2027-01-12','ROLAMENTOS':'2027-01-06'},due
            assert page.locator('#view-compras-programadas [data-sc-group="CORREIAS"]').count()==1
            assert page.locator('#view-compras-programadas [data-sc-group="FERRAMENTAS"]').count()==1
            assert page.locator('#view-compras-programadas [data-sc-group="ROLAMENTOS"]').count()==1
            assert page.locator('#view-compras-programadas .sc-scroll tbody tr').count()>=6
            assert page.get_by_text('Solicitação 110546',exact=False).count()>=1
            assert page.locator('#sc-export').count()==1
            page.locator('#sc-search').fill('105098')
            assert page.locator('#view-compras-programadas [data-sc-group="CORREIAS"]').count()==1
            page.locator('#sc-search').fill('inexistente000000')
            assert page.locator('#view-compras-programadas [data-sc-group="CORREIAS"]').count()==0
            page.locator('#sc-search').fill('')
            group=page.locator('#view-compras-programadas [data-sc-group="CORREIAS"]')
            group.locator('[data-sc-toggle]').click()
            assert group.locator('[data-sc-toggle]').get_attribute('aria-expanded')=='true'
            assert group.locator('.sc-scroll tbody tr').count()==18
            assert page.get_by_text('Solicitação 110998',exact=False).count()>=1
            group.locator('[data-sc-toggle]').click()
            assert group.locator('[data-sc-toggle]').get_attribute('aria-expanded')=='false'
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
            assert no_withdrawals['networkDefault'] and no_withdrawals['filtered']==no_withdrawals['networkRows'] and no_withdrawals['purchaseHistoryAvailable'], no_withdrawals
            assert no_withdrawals['rows']>0 and no_withdrawals['filtered']>0 and no_withdrawals['filtered']<=no_withdrawals['rows'], no_withdrawals
            assert no_withdrawals['position']==EXPECTED_STOCK_DATE, no_withdrawals
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
            assert sj_no_withdrawals['date']==EXPECTED_STOCK_DATE, sj_no_withdrawals
            assert page.locator('#sj-nw-scope').input_value()=='rede', 'Sao Joao deve iniciar sem baixas em toda a rede'
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
            assert chua_no_withdrawals['purchasesOnlyChua'] and chua_no_withdrawals['date']==chua_no_withdrawals['stockDate'], chua_no_withdrawals
            assert page.locator('#sj-nw-scope').input_value()=='rede', 'Chua deve iniciar sem baixas em toda a rede'
            assert 'São João' not in page.locator('#sj-pilot-root').inner_text()
        if optimized and name == 'fast':
            results[name]['managementNavigation'] = check_management_navigation(page)
        results[name]['errors'] = errors.copy()
        page.close()
    assert results['fast']['stockRows'] == EXPECTED_STOCK_ROWS, 'Unexpected stock positions'
    assert results['fastPilot']['stockRows'] == EXPECTED_STOCK_ROWS, 'Unexpected Sao Joao stock positions'
    assert results['fastChuaPilot']['stockRows'] == EXPECTED_STOCK_ROWS, 'Unexpected Chua stock positions'
    approved_audit=results['fast']['approvedCostAudit']
    assert approved_audit is not None and approved_audit['positions']>=1, approved_audit
    expected_adjustment=approved_audit['deltaCents']/100
    assert abs(results['fast']['stockValue'] - (EXPECTED_STOCK_ERP + expected_adjustment)) < 0.01, 'Unexpected stock value'
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
