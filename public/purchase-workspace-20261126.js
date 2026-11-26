// Reúne as consultas de preços sem alterar suas fontes, filtros ou cálculos.
(function () {
  'use strict';
  if (document.documentElement.dataset.dbPilot === '1' || window.DB_PURCHASE_WORKSPACE) return;

  const modes = [
    {
      view: 'produtos',
      label: 'Preços por produto',
      heading: '.tablehead h2',
      hint: 'Saldos e referências consolidados por produto. Empresa e almoxarifado selecionam os produtos presentes no estoque.'
    },
    {
      view: 'variacao',
      label: 'Variação de preços',
      heading: '.variation-table .tablehead h2',
      hint: 'Compare os preços das compras nos filtros ativos. Pneus e câmaras não entram nesta comparação.'
    },
    {
      view: 'atualizacao-custos',
      label: 'Conferir custos',
      heading: '.cu-head h2',
      hint: 'Use os filtros próprios abaixo para conferir custos, compras e referências por produto e almoxarifado.'
    }
  ];
  const tables = [
    { id: 'tbodyProdutos', columns: 21, code: 0, product: 1, unit: 3 },
    { id: 'variationRows', columns: 14, code: 1, product: 2, unit: 4 }
  ];
  const observers = new Map();
  let purchaseKeys = new Set();
  let decorationQueued = false;
  const keyOf = (code, unit) => JSON.stringify([String(code).trim(), String(unit).trim()]);

  const style = document.createElement('style');
  style.id = 'purchase-workspace-style';
  style.textContent = `
    .purchase-workspace-modes{margin:0 0 13px;padding:12px 14px;border:1px solid #d8e7dc;border-radius:12px;background:#fff}
    .purchase-workspace-buttons{display:flex;align-items:center;flex-wrap:wrap;gap:7px}
    .purchase-workspace-modes .clean-mode-btn{display:inline-flex;align-items:center;justify-content:center;min-height:40px;padding:9px 13px;border:1px solid #cbdfd1;border-radius:8px;background:#f5faf6;color:#1c5c35;font:700 12px/1.35 Arial,Helvetica,sans-serif;cursor:pointer}
    .purchase-workspace-modes .clean-mode-btn:hover{background:#e8f3eb;border-color:#90b99d}
    .purchase-workspace-modes .clean-mode-btn.active{border-color:#126236;background:#126236;color:#fff;box-shadow:inset 0 -3px 0 #e6c731}
    .purchase-workspace-modes .clean-mode-btn:focus-visible,.pw-history-link:focus-visible{outline:3px solid #e2b91e;outline-offset:3px}
    .purchase-workspace-hint{margin:9px 0 0;font:11px/1.5 Arial,Helvetica,sans-serif;color:#5c7164}
    #tbodyProdutos .pw-history-link,#variationRows .pw-history-link{display:inline-flex;align-items:center;min-height:28px;margin:3px 0 3px 8px;padding:4px 7px;border:1px solid #c5dccd;border-radius:6px;background:#f4faf6;color:#155d34;font:700 10px/1.3 Arial,Helvetica,sans-serif;white-space:nowrap;vertical-align:middle;cursor:pointer}
    #tbodyProdutos .pw-history-link:hover,#variationRows .pw-history-link:hover{background:#e6f2e9;border-color:#79a78a}
    @media(max-width:600px){.purchase-workspace-modes{padding:10px}.purchase-workspace-buttons{display:grid;grid-template-columns:1fr}.purchase-workspace-modes .clean-mode-btn{min-height:42px;justify-content:flex-start}.purchase-workspace-hint{font-size:11px}}
  `;
  document.head.appendChild(style);

  function originalTab(view) {
    return Array.from(document.querySelectorAll('.tabs .tab[data-view]')).find(button => button.dataset.view === view);
  }

  function go(view) {
    const tab = originalTab(view);
    if (!tab) return false;
    if (window.DB_NAVIGATION && typeof window.DB_NAVIGATION.go === 'function') {
      window.DB_NAVIGATION.go(view);
    } else {
      tab.click();
    }
    return true;
  }

  function mountModes(mode) {
    const section = document.getElementById('view-' + mode.view);
    if (!section || section.querySelector('.purchase-workspace-modes')) return;
    const host = document.createElement('div');
    host.className = 'purchase-workspace-modes';
    host.dataset.pwSection = mode.view;
    const buttons = document.createElement('div');
    buttons.className = 'purchase-workspace-buttons';
    buttons.setAttribute('role', 'group');
    buttons.setAttribute('aria-label', 'Modos de consulta de preços');
    for (const target of modes) {
      const current = target.view === mode.view;
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'clean-mode-btn' + (current ? ' active' : '');
      button.dataset.view = target.view;
      button.dataset.pwView = target.view;
      button.textContent = target.label;
      button.setAttribute('aria-pressed', String(current));
      button.setAttribute('aria-controls', 'view-' + target.view);
      button.addEventListener('click', () => {
        if (!go(target.view)) return;
        // Keep keyboard focus on the chosen mode after its previous section hides.
        const next = document.querySelector('#view-' + target.view + ' .purchase-workspace-modes [data-pw-view="' + target.view + '"]');
        if (next) next.focus({ preventScroll: true });
      });
      buttons.appendChild(button);
    }
    const hint = document.createElement('p');
    hint.className = 'purchase-workspace-hint';
    hint.textContent = mode.hint;
    host.append(buttons, hint);
    section.prepend(host);
    const heading = section.querySelector(mode.heading);
    if (heading) heading.textContent = mode.label;
  }

  function refreshPurchaseKeys() {
    // PURCHASES is a classic-script lexical global in the original dashboard.
    const purchases = typeof PURCHASES !== 'undefined' && Array.isArray(PURCHASES) ? PURCHASES : [];
    purchaseKeys = new Set(purchases.filter(row => row && row.codigo != null && row.un != null)
      .map(row => keyOf(row.codigo, row.un)));
  }

  function unitAvailable(unit) {
    const control = document.getElementById('fUn');
    return !!control && Array.from(control.options).some(option => option.value === unit);
  }

  function openHistory(code, unit) {
    code = String(code ?? '').trim();
    unit = String(unit ?? '').trim();
    const search = document.getElementById('fBusca');
    const unitControl = document.getElementById('fUn');
    if (!code || !unit || !purchaseKeys.has(keyOf(code, unit)) || !search || !unitAvailable(unit) || !originalTab('historico')) return false;

    // Reuse the dashboard's search semantics, including its existing NF search.
    // The other global filters stay selected; no result data or prices are rewritten.
    const unitChanged = unitControl.value !== unit;
    unitControl.value = unit;
    search.value = code;
    if (unitChanged) unitControl.dispatchEvent(new Event('change', { bubbles: true }));
    search.dispatchEvent(new Event('input', { bubbles: true }));
    if (!go('historico')) return false;
    const heading = document.querySelector('#view-historico .tablehead h2');
    if (heading) {
      if (!heading.hasAttribute('tabindex')) heading.setAttribute('tabindex', '-1');
      heading.focus({ preventScroll: true });
    }
    return true;
  }

  function decorateTable(table) {
    const body = document.getElementById(table.id);
    if (!body || !document.getElementById('fBusca') || !originalTab('historico')) return;
    const unitControl = document.getElementById('fUn');
    const units = new Set(unitControl ? Array.from(unitControl.options, option => option.value) : []);
    for (const row of body.rows) {
      // Skip placeholders and keep the original 21/14 column structures intact.
      if (row.cells.length !== table.columns) continue;
      const product = row.cells[table.product];
      if (product.querySelector('[data-pw-history]')) continue;
      const code = row.cells[table.code].textContent.trim();
      const unit = row.cells[table.unit].textContent.trim();
      if (!code || !unit || !units.has(unit) || !purchaseKeys.has(keyOf(code, unit))) continue;
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'pw-history-link';
      button.dataset.pwHistory = code;
      button.dataset.pwUnit = unit;
      button.textContent = 'Pesquisar compras';
      const label = 'Pesquisar código ' + code + ', unidade ' + unit + ', no histórico de compras';
      button.title = label;
      button.setAttribute('aria-label', label);
      button.addEventListener('click', () => openHistory(code, unit));
      product.appendChild(button);
    }
  }

  function decorateTables() {
    decorationQueued = false;
    for (const table of tables) decorateTable(table);
  }

  function queueDecoration() {
    if (decorationQueued) return;
    decorationQueued = true;
    window.requestAnimationFrame(decorateTables);
  }

  function refresh() {
    for (const mode of modes) mountModes(mode);
    refreshPurchaseKeys();
    for (const table of tables) {
      const body = document.getElementById(table.id);
      if (!body || observers.has(body)) continue;
      // Renderers replace tbody rows; observing only direct children avoids loops
      // when this addon appends its action inside an existing product cell.
      const observer = new MutationObserver(queueDecoration);
      observer.observe(body, { childList: true });
      observers.set(body, observer);
    }
    decorateTables();
  }

  window.DB_PURCHASE_WORKSPACE = { version: '20261126', refresh, go, openHistory };
  window.addEventListener('purchases-updated', refresh);
  window.addEventListener('db-navigation-change', queueDecoration);
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', refresh, { once: true });
  refresh();
})();
