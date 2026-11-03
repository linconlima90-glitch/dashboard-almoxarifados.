// Opcao de visualizacao consolidada para o grafico de baixas por local.
// Reutiliza a mesma base e os mesmos filtros do grafico original: nao altera
// valores, estoque minimo, movimentacoes ou a consulta detalhada do ERP.
(function () {
  'use strict';

  if (window.DB_BAIXAS_CONSOLIDADAS) return;

  var mode = 'local';
  var selectedGroup = '';
  var selectedItem = '';
  var view = null;
  var chart = null;
  var detail = null;
  var heading = null;
  var hint = null;
  var stat = null;
  var buttons = [];

  var formatMoney = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
  var formatInteger = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 0 });
  var formatQuantity = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
  function money(value) { return formatMoney.format(Number(value) || 0); }
  function number(value) { return formatInteger.format(Number(value) || 0); }
  function quantity(value) { return formatQuantity.format(Number(value) || 0); }
  function escapeHtml(value) {
    return String(value == null ? '' : value).replace(/[&<>"']/g, function (ch) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch];
    });
  }
  function groupName(row) { return row.grupo || 'SEM GRUPO'; }
  function itemKey(row) { return String(row.codigo) + '|' + String(row.un || ''); }
  function availableRows() {
    if (typeof movementFiltered !== 'function') return [];
    return movementFiltered().filter(function (row) { return Number(row.total) > 0; });
  }
  function groupTotals(rows) {
    var map = new Map();
    rows.forEach(function (row) {
      var key = groupName(row);
      if (!map.has(key)) map.set(key, {
        key: key, value: 0, positions: 0, products: new Set(), locals: new Set()
      });
      var current = map.get(key);
      current.value += Number(row.consumption_value) || 0;
      current.positions++;
      current.products.add(itemKey(row));
      current.locals.add(row.local || 'SEM LOCAL');
    });
    return Array.from(map.values()).sort(function (a, b) {
      return b.value - a.value || a.key.localeCompare(b.key, 'pt-BR');
    });
  }
  function itemTotals(rows, group) {
    var map = new Map();
    rows.forEach(function (row) {
      if (groupName(row) !== group) return;
      var key = itemKey(row);
      if (!map.has(key)) map.set(key, {
        key: key, codigo: row.codigo, produto: row.produto, un: row.un || '',
        value: 0, qty: 0, locals: new Map()
      });
      var item = map.get(key);
      var value = Number(row.consumption_value) || 0;
      var qty = Number(row.total) || 0;
      item.value += value;
      item.qty += qty;
      var local = row.local || 'SEM LOCAL';
      if (!item.locals.has(local)) item.locals.set(local, { local: local, value: 0, qty: 0 });
      item.locals.get(local).value += value;
      item.locals.get(local).qty += qty;
    });
    return Array.from(map.values()).sort(function (a, b) {
      return b.value - a.value || String(a.produto).localeCompare(String(b.produto), 'pt-BR');
    });
  }

  function renderDetail(rows) {
    if (!selectedGroup) {
      detail.hidden = true;
      detail.innerHTML = '';
      return;
    }
    var items = itemTotals(rows, selectedGroup);
    if (!items.length) {
      selectedGroup = '';
      selectedItem = '';
      detail.hidden = true;
      detail.innerHTML = '';
      return;
    }
    detail.hidden = false;
    var groupValue = items.reduce(function (sum, row) { return sum + row.value; }, 0);
    var groupLocals = new Set();
    items.forEach(function (item) { item.locals.forEach(function (_, key) { groupLocals.add(key); }); });
    var tableRows = items.map(function (item, index) {
      var active = selectedItem === item.key ? ' active' : '';
      return '<tr class="db-baixas-item' + active + '" role="button" tabindex="0" data-item-index="' + index +
        '" aria-label="Ver baixas por local do produto ' + escapeHtml(item.produto) + '">' +
        '<td class="num">' + number(index + 1) + '</td>' +
        '<td>' + escapeHtml(item.codigo) + '</td>' +
        '<td>' + escapeHtml(item.produto) + '</td>' +
        '<td>' + escapeHtml(item.un || '-') + '</td>' +
        '<td class="num">' + quantity(item.qty) + '</td>' +
        '<td class="num"><b>' + money(item.value) + '</b></td>' +
        '<td class="num">' + number(item.locals.size) + '</td></tr>';
    }).join('');
    var item = items.find(function (entry) { return entry.key === selectedItem; });
    if (!item) selectedItem = '';
    var breakdown = '';
    if (item) {
      var locals = Array.from(item.locals.values()).sort(function (a, b) {
        return b.value - a.value || a.local.localeCompare(b.local, 'pt-BR');
      });
      breakdown = '<div class="db-baixas-local-breakdown" id="dbBaixasLocalBreakdown">' +
        '<h4>' + escapeHtml(item.codigo) + ' · ' + escapeHtml(item.produto) + '</h4>' +
        '<p>Baixas deste produto por almoxarifado, ordenadas pelo maior valor.</p>' +
        '<div class="db-baixas-table-scroll"><table><thead><tr><th>Almoxarifado</th><th class="num">Quantidade (' +
        escapeHtml(item.un || '-') + ')</th><th class="num">Valor estimado</th></tr></thead><tbody>' +
        locals.map(function (local) {
          return '<tr><td>' + escapeHtml(local.local) + '</td><td class="num">' +
            quantity(local.qty) + '</td><td class="num">' + money(local.value) + '</td></tr>';
        }).join('') + '</tbody></table></div></div>';
    }

    detail.innerHTML = '<div class="db-baixas-detail-title"><div><h3>Grupo: ' +
      escapeHtml(selectedGroup) + '</h3><p>Todos os almoxarifados incluídos nos filtros. Itens do maior para o menor valor de baixa.</p></div>' +
      '<button type="button" id="dbBaixasCloseGroup">Recolher grupo</button></div>' +
      '<div class="db-baixas-metrics"><div><span>Valor estimado</span><b>' + money(groupValue) + '</b></div>' +
      '<div><span>Produtos distintos</span><b>' + number(items.length) + '</b></div>' +
      '<div><span>Almoxarifados</span><b>' + number(groupLocals.size) + '</b></div></div>' +
      '<p class="db-baixas-small-note">Clique em um produto para consultar em quais almoxarifados ocorreram as baixas.</p>' +
      '<div class="db-baixas-table-scroll"><table><thead><tr><th>#</th><th>Código</th><th>Produto</th><th>UN</th>' +
      '<th class="num">Qtd. baixada</th><th class="num">Valor estimado</th><th class="num">Locais</th></tr></thead><tbody>' +
      tableRows + '</tbody></table></div>' + breakdown;

    detail.querySelector('#dbBaixasCloseGroup').addEventListener('click', function () {
      selectedGroup = '';
      selectedItem = '';
      renderAll();
    });
    detail.querySelectorAll('[data-item-index]').forEach(function (row) {
      function openItem() {
        var current = items[Number(row.dataset.itemIndex)];
        if (!current) return;
        selectedItem = selectedItem === current.key ? '' : current.key;
        renderDetail(availableRows());
        if (selectedItem) {
          requestAnimationFrame(function () {
            var el = document.getElementById('dbBaixasLocalBreakdown');
            if (el) el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
          });
        }
      }
      row.addEventListener('click', openItem);
      row.addEventListener('keydown', function (event) {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          openItem();
        }
      });
    });
  }

  function renderAll() {
    if (mode !== 'all' || !chart || typeof renderBars !== 'function') return;
    var rows = availableRows();
    var groups = groupTotals(rows);
    if (selectedGroup && !groups.some(function (group) { return group.key === selectedGroup; })) {
      selectedGroup = '';
      selectedItem = '';
    }
    var total = rows.reduce(function (sum, row) {
      return sum + (Number(row.consumption_value) || 0);
    }, 0);
    var distinctProducts = new Set(rows.map(itemKey)).size;
    var distinctLocals = new Set(rows.map(function (row) { return row.local || 'SEM LOCAL'; })).size;
    stat.textContent = number(distinctLocals) + ' locais · ' + number(groups.length) +
      ' grupos · ' + number(distinctProducts) + ' produtos · ' + money(total);
    renderBars(chart, groups.map(function (group) {
      return { k: group.key, v: group.value };
    }), money, 'teal', function (clicked) {
      selectedGroup = selectedGroup === clicked.k ? '' : clicked.k;
      selectedItem = '';
      renderAll();
      if (selectedGroup) {
        requestAnimationFrame(function () {
          if (detail) detail.scrollIntoView({ behavior: 'smooth', block: 'start' });
        });
      }
    }, selectedGroup);
    renderDetail(rows);
  }

  function setMode(value) {
    mode = value === 'all' ? 'all' : 'local';
    selectedGroup = '';
    selectedItem = '';
    // "Todas juntas" realmente inclui todos os locais, mesmo se o filtro global
    // estiver preso ao ultimo almoxarifado consultado.
    if (mode === 'all') {
      var localFilter = document.getElementById('fLocal');
      if (localFilter && localFilter.value) {
        localFilter.value = '';
        localFilter.dispatchEvent(new Event('change', { bubbles: true }));
      }
    }
    view.classList.toggle('db-baixas-all', mode === 'all');
    buttons.forEach(function (button) {
      var active = button.dataset.baixasMode === mode;
      button.classList.toggle('active', active);
      button.setAttribute('aria-pressed', active ? 'true' : 'false');
    });
    heading.textContent = mode === 'all'
      ? 'Baixas consolidadas por grupo · valor estimado'
      : 'Baixas por local · valor estimado';
    hint.textContent = mode === 'all'
      ? 'Clique no grupo para abrir os itens de todos os locais'
      : 'Clique no local para abrir Grupo → Itens';
    renderAll();
  }

  function install() {
    if (document.getElementById('dbBaixasModeSwitch')) return true;
    view = document.getElementById('view-baixas');
    var originalChart = document.getElementById('barsBaixasLocais');
    if (!view || !originalChart) return false;
    var panel = originalChart.closest('.panel');
    var titleRow = panel && panel.querySelector('.panel-title-row');
    heading = titleRow && titleRow.querySelector('h2');
    hint = titleRow && titleRow.querySelector('.chart-click-hint');
    if (!panel || !titleRow || !heading || !hint) return false;

    var style = document.createElement('style');
    style.id = 'dbBaixasConsolidadasStyle';
    style.textContent =
      '#view-baixas .db-baixas-controls{display:flex;align-items:center;flex-wrap:wrap;gap:9px;justify-content:flex-end}' +
      '#view-baixas .db-baixas-mode{display:inline-flex;border:1px solid #bcdac7;border-radius:9px;overflow:hidden;background:#f2f8f4}' +
      '#view-baixas .db-baixas-mode button{border:0;padding:8px 11px;background:transparent;color:#1b5b38;cursor:pointer;font-size:11px;font-weight:800;white-space:nowrap}' +
      '#view-baixas .db-baixas-mode button+button{border-left:1px solid #bcdac7}' +
      '#view-baixas .db-baixas-mode button.active{background:#146b3c;color:#fff}' +
      '#view-baixas .db-baixas-mode button:focus-visible,#view-baixas .db-baixas-item:focus-visible{outline:3px solid #dbb515;outline-offset:2px}' +
      '#view-baixas.db-baixas-all #barsBaixasLocais,#view-baixas.db-baixas-all #movementDrilldownPanel{display:none!important}' +
      '#view-baixas:not(.db-baixas-all) #dbBaixasConsolidated{display:none!important}' +
      '#view-baixas #dbBaixasConsolidated{padding:0 0 10px}' +
      '#view-baixas .db-baixas-stat{font-size:11px;color:#335b43;padding:10px 4px 11px;font-weight:800}' +
      '#view-baixas #dbBaixasGroupBars{max-height:500px;overflow:auto;scrollbar-width:thin}' +
      '#view-baixas .db-baixas-help{font-size:10px;color:#688174;margin:11px 4px 1px}' +
      '#view-baixas .db-baixas-detail{margin:12px 0 16px;border:1px solid #dbe8df;background:#fff;border-radius:12px;padding:16px;box-shadow:0 4px 14px #123c2510}' +
      '#view-baixas .db-baixas-detail-title{display:flex;align-items:start;justify-content:space-between;gap:12px;flex-wrap:wrap}' +
      '#view-baixas .db-baixas-detail-title h3{margin:0 0 5px;color:#125d32;font-size:15px}' +
      '#view-baixas .db-baixas-detail-title p,#view-baixas .db-baixas-local-breakdown p{font-size:11px;color:#687d6f;margin:0}' +
      '#view-baixas .db-baixas-detail-title button{cursor:pointer;border:1px solid #bcdbc6;color:#155d34;background:#eff8f2;padding:8px 12px;border-radius:8px;font-size:11px;font-weight:800}' +
      '#view-baixas .db-baixas-metrics{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px;margin:13px 0}' +
      '#view-baixas .db-baixas-metrics>div{background:#f4faf6;border:1px solid #e0ede4;padding:12px;border-radius:9px}' +
      '#view-baixas .db-baixas-metrics span{font-size:10px;display:block;color:#698071;font-weight:700}' +
      '#view-baixas .db-baixas-metrics b{font-size:16px;color:#125e34;display:block;margin-top:5px}' +
      '#view-baixas .db-baixas-small-note{font-size:11px;color:#617568;margin:7px 0 11px}' +
      '#view-baixas .db-baixas-table-scroll{max-width:100%;max-height:480px;overflow:auto}' +
      '#view-baixas .db-baixas-table-scroll table{border-collapse:collapse;width:100%;min-width:680px;font-size:11px}' +
      '#view-baixas .db-baixas-table-scroll th{position:sticky;top:0;background:#115832;color:white;text-align:left;padding:9px 10px;white-space:nowrap}' +
      '#view-baixas .db-baixas-table-scroll td{padding:9px 10px;border-bottom:1px solid #e9efea}' +
      '#view-baixas .db-baixas-table-scroll .num{text-align:right;white-space:nowrap}' +
      '#view-baixas .db-baixas-item{cursor:pointer}' +
      '#view-baixas .db-baixas-item:hover,#view-baixas .db-baixas-item.active{background:#eaf6ee}' +
      '#view-baixas .db-baixas-local-breakdown{margin-top:15px;border-top:1px solid #dae9df;padding-top:13px}' +
      '#view-baixas .db-baixas-local-breakdown h4{margin:0 0 5px;color:#155f36;font-size:13px}' +
      '#view-baixas .db-baixas-local-breakdown .db-baixas-table-scroll{margin-top:11px;max-height:330px}' +
      '@media(max-width:900px){#view-baixas .db-baixas-controls{justify-content:flex-start}#view-baixas .db-baixas-metrics{grid-template-columns:1fr}#view-baixas .db-baixas-mode button{font-size:10px;padding:7px 9px}}';
    document.head.appendChild(style);

    var controls = document.createElement('div');
    controls.className = 'db-baixas-controls';
    controls.innerHTML = '<div id="dbBaixasModeSwitch" class="db-baixas-mode" role="group" aria-label="Modo de visualização das baixas">' +
      '<button type="button" data-baixas-mode="local" aria-pressed="true" class="active">Por almoxarifado</button>' +
      '<button type="button" data-baixas-mode="all" aria-pressed="false">Todas as baixas juntas</button></div>';
    titleRow.appendChild(controls);
    buttons = Array.from(controls.querySelectorAll('[data-baixas-mode]'));
    buttons.forEach(function (button) {
      button.addEventListener('click', function () { setMode(button.dataset.baixasMode); });
    });
    var consolidated = document.createElement('div');
    consolidated.id = 'dbBaixasConsolidated';
    consolidated.innerHTML = '<div class="db-baixas-stat" id="dbBaixasConsolidatedStat"></div>' +
      '<div class="bars movement-bars-scroll" id="dbBaixasGroupBars"></div>' +
      '<p class="db-baixas-help">Consolidação por grupo de todas as unidades do filtro. ' +
      'Usa os mesmos valores estimados do gráfico original, sem somar transferências como consumo. ' +
      'O histórico detalhado de 2024 permanece disponível para consulta abaixo.</p>' +
      '<div class="db-baixas-detail" id="dbBaixasGroupDetail" hidden></div>';
    originalChart.after(consolidated);
    chart = consolidated.querySelector('#dbBaixasGroupBars');
    stat = consolidated.querySelector('#dbBaixasConsolidatedStat');
    detail = consolidated.querySelector('#dbBaixasGroupDetail');

    ['fEmpresa', 'fLocal', 'fGrupo', 'fUn', 'fBusca'].forEach(function (id) {
      var filter = document.getElementById(id);
      if (!filter) return;
      filter.addEventListener('change', renderAll);
      if (id === 'fBusca') filter.addEventListener('input', renderAll);
    });
    window.addEventListener('stock-position-updated', renderAll);
    window.addEventListener('movements-updated', renderAll);
    window.addEventListener('dashboard-ready', renderAll);
    window.DB_BAIXAS_CONSOLIDADAS = {
      mode: function () { return mode; },
      setMode: setMode,
      refresh: renderAll,
      aggregate: groupTotals
    };
    return true;
  }
  if (!install()) {
    document.addEventListener('DOMContentLoaded', install, { once: true });
    window.addEventListener('dashboard-ready', install, { once: true });
  }
})();