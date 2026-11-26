import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import {gunzipSync} from 'node:zlib';
import {fileURLToPath} from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = name => fs.readFileSync(path.join(root, name), 'utf8');
const policy = read('public/cdi-current-stock-policy-20261126.js');
const norm = value => String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase();
const excluded = row => /\b(PNEUS?|CAMARAS?|CIMENTOS?)\b/.test(norm(row.grupo) + ' ' + norm(row.produto));
const round = (value, unit) => ['KG', 'LT', 'ML', 'MT', 'M2', 'M3', 'CM', 'GR'].includes(norm(unit))
  ? Math.max(0, Math.ceil((value - 1e-10) * 100) / 100) : Math.max(0, Math.ceil(value - 1e-10));
function fixture() {
  const data = {STOCK: [], PURCHASES: [], MOVEMENTS: [], source: [],
    DB_MINIMUM_EXCLUDED: excluded, minimumRoundUp: round,
    CURRENT_STOCK_META: {emissao: '25/11/2026 15:59:16'},
    cdiNetworkAllRows() { return this.source; },
    addEventListener() {}, renderCDI() {}};
  data.window = data;
  return vm.createContext(data);
}
const row = (code, unit = 'PC') => ({codigo: code, un: unit, produto: 'PEÇA ' + code, grupo: 'PEÇAS',
  codigo_local: '30115', local: 'ALMOXARIFADO GERAL F CHUA', avg: 2.5, total: 55,
  months: [1, 2, 3], complete_total: 55, complete_months: 22, stock: 0, cost: 999, network_scope: true});
const stock = (code, unit, quantity, cost, company = 'A', local = '30115') => ({codigo: code, un: unit,
  empresa: company, codigo_local: local, local: local === '30115' ? 'ALMOXARIFADO GERAL F CHUA' : 'OUTRO LOCAL',
  estoque: quantity, custo_estoque: cost, valor_estoque: quantity * cost, produto: 'PEÇA ATUAL ' + code, grupo: 'PEÇAS'});
const run = context => vm.runInContext(policy, context, {timeout: 10000});

test('CDI lê saldo atual por unidade, soma posições fiscais legítimas e não soma linha virtual', () => {
  const c = fixture();
  c.source = [row('novo'), row('sem-saldo')];
  c.STOCK = [stock('novo', 'PC', 2, 10, 'A'), stock('novo', 'PC', 3, 20, 'B'),
    stock('novo', 'KG', 100, 50), stock('novo', 'PC', 900, 5, 'A', '50115'),
    {...stock('novo', 'PC', 5, 16), network_scope: true}];
  const original = JSON.stringify(c.STOCK);
  run(c);
  const result = c.cdiNetworkAllRows();
  assert.equal(result[0].stock, 5);
  assert.equal(result[0].cost, 16);
  assert.equal(result[0].stock_value, 80);
  assert.equal(result[0].need, 0);
  assert.equal(result[0].produto, 'PEÇA ATUAL novo');
  assert.equal(result[1].stock, 0);
  assert.equal(result[1].need, 5);
  assert.equal(result[1].cost, 0, 'Não reutilizar custo do mapa antigo quando não há referência verificável');
  assert.equal(JSON.stringify(c.STOCK), original);
  assert.equal(c.source[0].stock, 0, 'A fonte histórica não é alterada');
  c.STOCK[0].estoque = 1;
  c.STOCK[0].valor_estoque = 10;
  assert.equal(c.cdiNetworkAllRows()[0].stock, 4, 'Cada consulta deve ler a posição corrente');
  assert.equal(c.cdiNetworkAllRows()[0].need, 1);
});

test('mesma exclusão de pneus, câmaras e cimento no CDI; arredondamento contínuo preservado', () => {
  const c = fixture();
  c.source = ['CIMENTO CP-32', 'CÂMARA AR CARRINHO DE MÃO', 'PNEU AGRÍCOLA'].map((name, i) =>
    ({...row(String(i)), produto: name, grupo: 'MATERIAL DE CONSTRUÇÃO'}));
  c.source.push({...row('metro', 'MT'), avg: 0.634, total: 13.948});
  c.STOCK.push(stock('metro', 'MT', 0.25, 10));
  run(c);
  const result = c.cdiNetworkAllRows();
  assert.equal(result.length, 1);
  assert.equal(result[0].codigo, 'metro');
  assert.equal(result[0].minimum, 1.27);
  assert.equal(result[0].need, 1.02);
});

test('custos atuais, compra recebida com precisão do total e override aprovado preservam unidade e origem', () => {
  const c = fixture();
  c.source = [row('rede'), row('compra'), row('historico'), row('124928'), row('105090', 'KG')];
  c.STOCK = [stock('rede', 'PC', 2, 25, 'A', '50115'), stock('compra', 'KG', 10, 900),
    stock('124928', 'PC', 1, 9391.27), stock('105090', 'KG', 10, 18)];
  c.PURCHASES = [
    {codigo: 'compra', un: 'PC', status: 'LANC.RECEB.', qtd: 3, valor: 10, preco: 3.33, data: '20/11/2026'},
    {codigo: 'compra', un: 'PC', status: 'NÃO LANC.RECEB.', qtd: 1, valor: 999, data: '25/11/2026'},
    {codigo: 'compra', un: 'KG', status: 'LANC.RECEB.', qtd: 1, valor: 800, data: '25/11/2026'}];
  c.MOVEMENTS = [{...row('historico'), cost: 17, network_scope: false}];
  c.DB_APPROVED_PRODUCT_COSTS = {'124928': {unidade: 'PC', custoUnitario: 7982.58, fonte: 'Aprovado pelo gestor'}};
  c.DB_COST_TABLE_REFERENCE_OVERRIDES = {'105090': 24.235};
  run(c);
  const result = new Map(c.cdiNetworkAllRows().map(x => [x.codigo, x]));
  assert.equal(result.get('rede').cost, 25);
  assert.equal(result.get('compra').cost, 10 / 3);
  assert.match(result.get('compra').cost_source, /COMPRA RECEBIDA/);
  assert.equal(result.get('historico').cost, 17);
  assert.match(result.get('historico').cost_source, /HISTÓRICO/);
  assert.equal(result.get('124928').cost, 7982.58);
  assert.match(result.get('124928').cost_source, /GERENCIAL APROVADO/);
  assert.equal(result.get('105090').cost, 18, 'Referência de economia não substitui custo do saldo');
  assert.equal(c.STOCK.find(x => x.codigo === '124928').custo_estoque, 9391.27, 'Não alterar ERP no módulo CDI');
});

test('regressão com o build real: remove saldos zero indevidos e exclusões, preservando demanda e filtro anual', () => {
  const dir = path.join(root, 'dist/_fast');
  assert(fs.existsSync(dir), 'Execute node scripts/build-fast.mjs antes desta auditoria integrada');
  const coreFile = fs.readdirSync(dir).find(name => /^core-.*\.js$/.test(name));
  const core = fs.readFileSync(path.join(dir, coreFile), 'utf8');
  const context = {console, Intl, Map, Set, CustomEvent: class {constructor(type, data) {this.type = type; this.detail = data?.detail;}},
    setTimeout() {return 0;}, clearTimeout() {}, addEventListener() {}, dispatchEvent() {},
    document: {querySelectorAll() {return [];}, querySelector() {return null;}, getElementById() {return null;}, addEventListener() {}},
    render() {}, renderCDI() {}, renderMinimum() {}, norm,
    criteria() {return {empresa: '', local: '', grupo: '', un: '', q: ''};}};
  context.window = context;
  const c = vm.createContext(context);
  const evaluate = (code, name) => vm.runInContext(code, c, {filename: name, timeout: 10000});
  evaluate('function __dbFastUnpack(keys,rows){return rows.map(values=>Object.fromEntries(keys.map((key,i)=>[key,values[i]])))}', 'unpack');
  for (const line of core.split('\n')) if (/^const [A-Z_]+\s*=/.test(line)) evaluate(line, 'core-data');
  for (const name of ['minimumRoundUp', 'cdiFallbackCost', 'cdiNetworkAllRows', 'minimumRowsForYear']) {
    const line = core.split('\n').find(x => x.startsWith('function ' + name + '('));
    assert(line, name);
    evaluate(line, name);
  }
  let b64 = '';
  for (let i = 1; i <= 12; i++) b64 += read('dist/stock-current-20261103-1558-' + String(i).padStart(2, '0') + '.js')
    .match(/window\.CURRENT_STOCK_GZ(?:\+)?='([^']+)';/)[1];
  evaluate(gunzipSync(Buffer.from(b64, 'base64')).toString('utf8'), 'stock-data');
  evaluate(read('public/approved-product-costs-20261113.js'), 'approved-costs');
  evaluate(read('public/approved-stock-units-20261126.js'), 'approved-stock-units');
  evaluate(read('public/current-stock-apply-20260911.js'), 'stock-apply');
  for (const p of ['base', '01', '02', '03', '04']) evaluate(read('dist/movement-full-' + p + '-20261103.js'), 'movements-' + p);
  evaluate(read('dist/movement-reconcile-full-20261103.js'), 'reconciliation');
  evaluate(read('public/policy-rules-0909.js'), 'old-policy');
  evaluate(read('public/minimum-policy-2months-20261008.js'), 'minimum-policy');
  const before = evaluate('cdiNetworkAllRows()', 'before');
  const snapshot = evaluate('JSON.stringify(STOCK)', 'snapshot');
  run(c);
  const after = evaluate('cdiNetworkAllRows()', 'after');
  const stocks = evaluate('STOCK', 'current-stock');
  const physical = new Map();
  for (const s of stocks.filter(x => String(x.codigo_local) === '30115')) {
    const k = String(s.codigo) + '|' + norm(s.un);
    physical.set(k, (physical.get(k) || 0) + Number(s.estoque));
  }
  const wrongBefore = before.filter(x => !excluded(x) && Math.abs(x.stock - (physical.get(String(x.codigo) + '|' + norm(x.un)) || 0)) > 1e-8);
  assert(wrongBefore.length > 0, 'Fixture deve reproduzir o defeito do mapa antigo');
  assert(before.some(x => String(x.codigo) === '100234'), 'Fixture deve conter o cimento incluído indevidamente');
  assert(after.every(x => !excluded(x)));
  const previous = new Map(before.map(x => [String(x.codigo) + '|' + norm(x.un), x]));
  for (const x of after) {
    const k = String(x.codigo) + '|' + norm(x.un);
    assert.equal(x.stock, physical.get(k) || 0, 'Saldo CDI divergente: ' + k);
    const old = previous.get(k);
    for (const field of ['avg', 'total', 'complete_total', 'complete_months', 'un']) assert.equal(x[field], old[field], k + ':' + field);
    assert.equal(JSON.stringify(x.months), JSON.stringify(old.months));
    assert.equal(x.minimum, round(x.avg * 2, x.un));
    assert.equal(x.need, round(Math.max(0, x.minimum - x.stock), x.un));
  }
  c.correctedRows = after;
  for (const year of ['2025', '2026']) {
    const selected = evaluate('minimumRowsForYear(correctedRows,"' + year + '")', 'annual-' + year);
    const count = year === '2025' ? 12 : 10;
    for (const x of selected) {
      assert(!excluded(x));
      assert.equal(x.stock, physical.get(String(x.codigo) + '|' + norm(x.un)) || 0);
      assert.equal(x.avg, x.months.slice(0, count).reduce((sum, q) => sum + Number(q || 0), 0) / count);
      assert.equal(x.minimum, round(x.avg * 2, x.un));
    }
  }
  assert.equal(evaluate('JSON.stringify(STOCK)', 'unchanged-stock'), snapshot);
});
