// Normalização gerencial aprovada: cinco rolos de arame com mil metros cada.
// A fotografia original do ERP permanece intacta, inclusive seu valor contábil.
(function () {
  'use strict';
  if (window.DB_NORMALIZE_STOCK_UNIT) return;
  const text = value => String(value ?? '').trim();
  const norm = value => text(value).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase();
  const source = '2bf5b629272579755311ba542da173431f0420ed57e28152065c9c6a192a6211';
  const note = 'Conferência do gestor em 26/11/2026: 5 rolos de 1.000 metros. Quantidade e custo convertidos para MT, mantendo o valor do estoque.';

  window.DB_NORMALIZE_STOCK_UNIT = function (row, meta) {
    if (!row || row.normalizacao_unidade_aprovada ||
      text(meta?.sourceSHA256) !== source ||
      text(meta?.emissao).slice(0, 10) !== '26/11/2026' ||
      text(row.codigo) !== '102793' || text(row.codigo_local) !== '50115' ||
      norm(row.local) !== 'ALMOXARIFADO GERAL F SJ' ||
      norm(row.produto) !== 'ARAME LISO OVALADO' || norm(row.un) !== 'MT' ||
      Number(row.estoque) !== 5 || Number(row.custo_estoque) !== 483.84 ||
      Number(row.valor_estoque) !== 2419.21) return row;

    const quantity = Number(row.estoque) * 1000;
    return {...row,
      estoque: quantity,
      custo_estoque: Number(row.valor_estoque) / quantity,
      estoque_erp_original: Number(row.estoque),
      custo_erp_original: Number(row.custo_estoque),
      valor_erp_original: Number(row.valor_estoque),
      unidade_erp_original: row.un,
      normalizacao_unidade_aprovada: true,
      fator_conversao_unidade: 1000,
      normalizacao_unidade_fonte: note};
  };
  window.DB_STOCK_UNIT_NORMALIZATION_POLICY = Object.freeze({
    version: '20261126-wire-rolls-v1', sourceSHA256: source,
    date: '26/11/2026', codigo: '102793', codigo_local: '50115', factor: 1000,
    source: note});
})();
