// O CDI consulta a posição atual 30115; mapas do carregamento inicial não são saldos.
// A demanda continua vindo do histórico consolidado de 2025/2026, sem transferências.
(function () {
  'use strict';
  if (window.DB_CDI_CURRENT_STOCK_POLICY) return;
  const previousRows = window.cdiNetworkAllRows;
  if (typeof previousRows !== 'function') throw Error('Base de demanda CDI indisponível');

  const number = value => Number(value) || 0;
  const text = value => String(value ?? '');
  const norm = value => text(value).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().trim();
  const key = row => text(row.codigo) + '|' + norm(row.un);
  const excluded = row => typeof window.DB_MINIMUM_EXCLUDED === 'function'
    ? window.DB_MINIMUM_EXCLUDED(row)
    : /\b(PNEUS?|CAMARAS?|CIMENTOS?)\b/.test(norm(row.grupo) + ' ' + norm(row.produto));
  const round = (value, unit) => typeof minimumRoundUp === 'function'
    ? minimumRoundUp(value, unit)
    : ['KG', 'LT', 'ML', 'MT', 'M2', 'M3', 'CM', 'GR'].includes(norm(unit))
      ? Math.max(0, Math.ceil((value - 1e-10) * 100) / 100)
      : Math.max(0, Math.ceil(value - 1e-10));
  const dateKey = value => {
    const date = text(value).match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    return date ? Number(date[3] + date[2] + date[1]) : 0;
  };

  function indexes() {
    const local = new Map(), network = new Map(), purchases = new Map(), historical = new Map();
    const add = (map, row) => {
      const k = key(row), found = map.get(k) || {quantity: 0, value: 0, row};
      // Posições fiscais distintas do mesmo local/produto/unidade compõem o saldo físico.
      // Unidades diferentes nunca são somadas e linhas virtuais não são posições ERP.
      found.quantity += number(row.estoque);
      found.value += number(row.valor_estoque);
      map.set(k, found);
    };
    for (const row of typeof STOCK === 'undefined' ? [] : STOCK) {
      if (row.network_scope || norm(row.local) === 'CDI DE PECAS CHUA') continue;
      add(network, row);
      if (text(row.codigo_local) === '30115') add(local, row);
    }
    for (const row of typeof PURCHASES === 'undefined' ? [] : PURCHASES) {
      if (row.status !== 'LANC.RECEB.' || !(number(row.qtd) > 0) || !(number(row.valor) > 0)) continue;
      const k = key(row), previous = purchases.get(k);
      if (!previous || dateKey(row.data) >= dateKey(previous.data)) purchases.set(k, row);
    }
    for (const row of typeof MOVEMENTS === 'undefined' ? [] : MOVEMENTS) {
      if (row.network_scope || !(number(row.cost) > 0)) continue;
      const k = key(row), previous = historical.get(k);
      if (!previous || text(row.codigo_local) === '30115') historical.set(k, row);
    }
    return {local, network, purchases, historical};
  }

  function reference(row, index) {
    const k = key(row), approved = window.DB_APPROVED_PRODUCT_COSTS?.[text(row.codigo)];
    if (approved && norm(approved.unidade) === norm(row.un) && number(approved.custoUnitario) > 0)
      return {cost: number(approved.custoUnitario), source: 'CUSTO GERENCIAL APROVADO · ' + (approved.fonte || row.codigo)};
    for (const [map, source] of [[index.local, 'CUSTO MÉDIO DO ESTOQUE ATUAL CHUÁ'],
      [index.network, 'CUSTO MÉDIO DO ESTOQUE ATUAL DA REDE']]) {
      const current = map.get(k);
      if (current && current.quantity > 0 && current.value > 0)
        return {cost: current.value / current.quantity, source};
    }
    const purchase = index.purchases.get(k);
    if (purchase) return {cost: number(purchase.valor) / number(purchase.qtd),
      source: 'ÚLTIMA COMPRA RECEBIDA · ' + purchase.data};
    const history = index.historical.get(k);
    return history ? {cost: number(history.cost), source: 'CUSTO HISTÓRICO DE REFERÊNCIA · ' + text(history.local)}
      : {cost: 0, source: 'SEM CUSTO DE REFERÊNCIA'};
  }

  const api = {version: '20261126-current-stock-v1', locationCode: '30115', minimumMonths: 2, meta: null};
  window.DB_CDI_CURRENT_STOCK_POLICY = api;
  window.cdiNetworkAllRows = function () {
    const index = indexes(), source = previousRows.apply(this, arguments), rows = [];
    for (const original of source) {
      const balance = index.local.get(key(original));
      const current = balance?.row;
      const row = {...original,
        produto: current?.produto || original.produto,
        grupo: current?.grupo || original.grupo};
      if (excluded(original) || excluded(row)) continue;
      const stock = balance ? balance.quantity : 0, average = Math.max(0, number(row.avg));
      const minimum = round(average * 2, row.un), need = round(Math.max(0, minimum - stock), row.un);
      const price = reference(row, index);
      const status = !(number(row.total) > 0) ? 'SEM DADOS DE BAIXA'
        : !(average > 0) ? 'HISTÓRICO PARCIAL'
        : stock <= 0 ? 'SEM ESTOQUE'
        : stock < minimum - 1e-9 ? 'ABAIXO DO MÍNIMO'
        : stock < minimum * 1.25 - 1e-9 ? 'ATENÇÃO' : 'OK';
      rows.push({...row, stock, cost: price.cost, cost_source: price.source,
        stock_value: balance ? balance.value : 0,
        minimum, need, need_value: need * price.cost,
        coverage: average > 0 ? stock / average : null,
        excess: Math.max(0, stock - minimum), status,
        consumption_value: number(row.total) * price.cost,
        network_scope: true, stock_source: 'ESTOQUE ATUAL ERP · LOCAL 30115 · CÓDIGO + UNIDADE'});
    }
    api.meta = {rows: rows.length, excludedRows: source.length - rows.length,
      stockDate: window.CURRENT_STOCK_META?.emissao || '', physicalLocation: '30115',
      separateUnits: true, sharedPhysicalStock: true, minimumMonths: 2};
    return rows;
  };

  function refresh() {
    if (typeof window.renderCDI === 'function') window.renderCDI();
    window.DB_STOCK_UNIFIED?.refresh();
  }
  window.addEventListener('stock-position-updated', refresh);
  window.addEventListener('movements-updated', refresh);
  refresh();
})();
