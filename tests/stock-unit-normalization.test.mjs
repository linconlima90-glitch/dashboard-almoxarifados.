import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import {gunzipSync} from 'node:zlib';
import {fileURLToPath} from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = name => fs.readFileSync(path.join(root, name), 'utf8');
const policy = read('public/approved-stock-units-20261126.js');
const norm = value => String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase();
const sourceHash = '2bf5b629272579755311ba542da173431f0420ed57e28152065c9c6a192a6211';
const metadata = () => ({emissao: '26/11/2026 10:04:55', sourceSHA256: sourceHash});
const position = () => ({empresa: 'EMPRESA FISCAL DO ERP', codigo_local: '50115',
  local: 'ALMOXARIFADO GERAL F SJ', codigo: '102793', produto: 'ARAME LISO OVALADO',
  grupo: 'MATERIAL DE CONSTRUCAO', un: 'MT', estoque: 5, custo_estoque: 483.84,
  valor_estoque: 2419.21});

function fixture() {
  const context = {DB_COST_TABLE_REFERENCE_OVERRIDES: {'105090': 24.235}};
  context.window = context;
  const c = vm.createContext(context);
  vm.runInContext(policy, c, {filename: 'approved-stock-units', timeout: 10000});
  assert.equal(typeof c.DB_NORMALIZE_STOCK_UNIT, 'function');
  return c;
}

test('cinco rolos equivalem a 5.000 metros, preservando valor e dados originais do ERP', () => {
  const c = fixture();
  const original = Object.freeze(position());
  const meta = Object.freeze(metadata());
  const before = JSON.stringify({original, meta});
  const normalized = c.DB_NORMALIZE_STOCK_UNIT(original, meta);
  assert.notEqual(normalized, original);
  assert.equal(normalized.estoque, 5 * 1000);
  assert.equal(normalized.un, 'MT');
  assert.equal(normalized.valor_estoque, 2419.21);
  assert.equal(normalized.custo_estoque, 2419.21 / 5000);
  assert.equal(Math.round(normalized.estoque * normalized.custo_estoque * 100), 241921);
  assert.equal(normalized.estoque_erp_original, 5);
  assert.equal(normalized.custo_erp_original, 483.84);
  assert.equal(normalized.valor_erp_original, 2419.21);
  assert.equal(normalized.unidade_erp_original, 'MT');
  assert.equal(normalized.normalizacao_unidade_aprovada, true);
  assert.equal(normalized.fator_conversao_unidade, 1000);
  assert(normalized.normalizacao_unidade_fonte?.length > 0);
  assert.equal(JSON.stringify({original, meta}), before, 'A fonte fiscal não pode ser reescrita');
  assert.equal(c.DB_NORMALIZE_STOCK_UNIT(normalized, meta), normalized,
    'Reaplicar a política não pode multiplicar novamente o saldo');
});

test('a conversão depende da fotografia aprovada, do almoxarifado e da posição exata', () => {
  const c = fixture();
  const cases = [
    ['outro código', {codigo: '107293'}],
    ['outro almoxarifado', {codigo_local: '30115'}],
    ['outro nome de almoxarifado', {local: 'ALMOXARIFADO GERAL F CHUA'}],
    ['outro produto', {produto: 'ARAME FARPADO'}],
    ['outra unidade', {un: 'RL'}],
    ['saldo já normalizado', {estoque: 5000}],
    ['outro saldo', {estoque: 6}],
    ['saldo zero', {estoque: 0}],
    ['saldo negativo', {estoque: -5}],
    ['outro custo', {custo_estoque: 483.85}],
    ['custo nulo', {custo_estoque: 0}],
    ['outro valor', {valor_estoque: 2419.22}],
    ['valor nulo', {valor_estoque: 0}],
    ['valor negativo', {valor_estoque: -2419.21}],
    ['valor não finito', {valor_estoque: Infinity}],
    ['quantidade não finita', {estoque: NaN}],
  ];
  for (const [label, patch] of cases) {
    const row = Object.freeze({...position(), ...patch});
    assert.equal(c.DB_NORMALIZE_STOCK_UNIT(row, metadata()), row, label);
  }
  for (const meta of [undefined, {}, {emissao: '26/11/2026'},
    {...metadata(), emissao: '25/11/2026 10:04:55'},
    {...metadata(), sourceSHA256: 'outra-fotografia'},
    {...metadata(), sourceSHA256: ''}]) {
    const row = Object.freeze(position());
    assert.equal(c.DB_NORMALIZE_STOCK_UNIT(row, meta), row, JSON.stringify(meta));
  }
});

test('a política não converte custos ou referências de outros produtos', () => {
  const c = fixture();
  const reference = Object.freeze({...position(), codigo: '105090', produto: 'PRODUTO EM KG',
    un: 'KG', estoque: 10, custo_estoque: 24.235, valor_estoque: 242.35});
  assert.equal(c.DB_NORMALIZE_STOCK_UNIT(reference, metadata()), reference);
  assert.equal(reference.custo_estoque, 24.235);
  assert.equal(c.DB_COST_TABLE_REFERENCE_OVERRIDES['105090'], 24.235);
  const adjusted = c.DB_NORMALIZE_STOCK_UNIT(position(), metadata());
  assert.equal(adjusted.estoque, 5000);
  assert.equal(c.DB_COST_TABLE_REFERENCE_OVERRIDES['105090'], 24.235,
    'Normalizar metros não altera a referência monetária aprovada de outro produto');
});

test('build real: necessidade de reposição cai para 160 itens e R$ 22.027,13 sem alterar o valor de estoque', () => {
  const dir = path.join(root, 'dist/_fast');
  assert(fs.existsSync(dir), 'Execute node scripts/build-fast.mjs antes da regressão integrada');
  const coreName = fs.readdirSync(dir).find(name => /^core-.*\.js$/.test(name));
  const core = fs.readFileSync(path.join(dir, coreName), 'utf8');
  const context = {console, Intl, Map, Set, norm,
    CustomEvent: class {constructor(type, data) {this.type = type; this.detail = data?.detail;}},
    setTimeout() {return 0;}, clearTimeout() {}, addEventListener() {}, dispatchEvent() {},
    document: {querySelectorAll() {return [];}, querySelector() {return null;},
      getElementById() {return null;}, addEventListener() {}},
    render() {}, renderCDI() {}, renderMinimum() {},
    criteria() {return {empresa: '', local: '', grupo: '', un: '', q: ''};}};
  context.window = context;
  const c = vm.createContext(context);
  const evaluate = (code, name) => vm.runInContext(code, c, {filename: name, timeout: 10000});
  evaluate('function __dbFastUnpack(keys,rows){return rows.map(values=>Object.fromEntries(keys.map((key,i)=>[key,values[i]])))}', 'unpack');
  for (const line of core.split('\n')) if (/^const [A-Z_]+\s*=/.test(line)) evaluate(line, 'core-data');
  for (const name of ['minimumRoundUp', 'cdiFallbackCost', 'cdiNetworkAllRows', 'minimumRowsForYear']) {
    const definition = core.split('\n').find(line => line.startsWith('function ' + name + '('));
    assert(definition, name);
    evaluate(definition, name);
  }
  const baseRows = core.match(/function minimumBaseRows\(\)\{[\s\S]*?\n\}/)?.[0];
  assert(baseRows, 'minimumBaseRows');
  evaluate(baseRows, 'minimumBaseRows');
  let b64 = '';
  for (let i = 1; i <= 12; i++) b64 += read('dist/stock-current-20261103-1558-' + String(i).padStart(2, '0') + '.js')
    .match(/window\.CURRENT_STOCK_GZ(?:\+)?='([^']+)';/)[1];
  evaluate(gunzipSync(Buffer.from(b64, 'base64')).toString('utf8'), 'stock-data');
  const sourceBefore = evaluate('JSON.stringify(CURRENT_STOCK_20260911)', 'source-before');
  evaluate(read('public/approved-product-costs-20261113.js'), 'approved-costs');
  evaluate(policy, 'approved-stock-units');
  evaluate(read('public/current-stock-apply-20260911.js'), 'stock-apply');
  const stocks = evaluate('STOCK', 'stock');
  const matching = stocks.filter(row => String(row.codigo) === '102793' && String(row.codigo_local) === '50115');
  assert.equal(matching.length, 1);
  const wire = matching[0];
  assert.equal(wire.estoque, 5000);
  assert.equal(wire.custo_estoque, 0.483842);
  assert.equal(wire.valor_estoque, 2419.21);
  assert.equal(wire.estoque_erp_original, 5);
  const audit = c.DB_APPROVED_STOCK_UNIT_AUDIT;
  assert.equal(audit.positions, 1);
  assert.equal(audit.originalCents, 241921);
  assert.equal(audit.normalizedCents, 241921);
  assert.equal(audit.deltaCents, 0);
  assert.equal(audit.changes.length, 1);
  assert.equal(c.CURRENT_STOCK_META.normalizacaoUnidades.length, 1);
  const rawCents = evaluate('CURRENT_STOCK_20260911.rows.reduce((sum,row)=>sum+Math.round(Number(row[9])*100),0)', 'erp-cents');
  const managerialCents = stocks.reduce((sum, row) => sum + Math.round(Number(row.valor_estoque) * 100), 0);
  assert.equal(managerialCents, rawCents + c.DB_APPROVED_PRODUCT_COST_AUDIT.deltaCents,
    'A conversão de unidade não cria valor nem modifica o ajuste de custo já aprovado');
  const appliedBefore = evaluate('JSON.stringify(STOCK)', 'applied-before');
  evaluate(read('public/current-stock-apply-20260911.js'), 'stock-apply-again');
  assert.equal(evaluate('JSON.stringify(STOCK)', 'applied-again'), appliedBefore);
  assert.equal(evaluate('JSON.stringify(CURRENT_STOCK_20260911)', 'source-after'), sourceBefore);

  for (const part of ['base', '01', '02', '03', '04'])
    evaluate(read('dist/movement-full-' + part + '-20261103.js'), 'movements-' + part);
  evaluate(read('dist/movement-reconcile-full-20261103.js'), 'reconciliation');
  evaluate(read('public/policy-rules-0909.js'), 'old-policy');
  evaluate(read('public/minimum-policy-2months-20261008.js'), 'minimum-policy');
  evaluate(read('public/cdi-current-stock-policy-20261126.js'), 'current-cdi');
  evaluate(read('public/stock-min-max-unified-20261103.js'), 'stock-unified');
  const summary = c.DB_STOCK_UNIFIED.getSummary();
  assert.equal(summary.items, 160);
  assert(Math.abs(summary.value - 22027.12823036052) < 0.0001, JSON.stringify(summary));
  assert.equal(Math.round(summary.value * 100), 2202713);
  assert.equal(summary.minimumMonths, 2);
  assert.equal(summary.networkExcludedFromTotals, true);
  const movement = evaluate('MOVEMENTS.find(row=>String(row.codigo)==="102793"&&String(row.codigo_local)==="50115")', 'wire-movement');
  assert(movement);
  assert.equal(movement.complete_total, 45000);
  assert.equal(movement.avg, 45000 / 22);
  assert.equal(movement.minimum, 4090.91);
  assert.equal(movement.stock, 5000);
  assert.equal(movement.cost, 2419.21 / 5000);
  assert.equal(movement.need, 0);
  assert.equal(movement.need_value, 0);
  assert.equal(evaluate('JSON.stringify(CURRENT_STOCK_20260911)', 'source-final'), sourceBefore);
});
