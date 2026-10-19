import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { createHash } from 'node:crypto';
import { gunzipSync, gzipSync } from 'node:zlib';
import assert from 'node:assert/strict';

const root = process.cwd(), input = path.join(root, 'public'), out = path.join(root, 'dist');
const read = name => fs.readFileSync(path.join(root, name), 'utf8');
const source = read('public/index.html');
const legacy = read('src/index.js');
const report = { originalHtmlBytes: Buffer.byteLength(source), datasets: [], routes: {} };
fs.rmSync(out, { recursive: true, force: true });
fs.cpSync(input, out, { recursive: true });
fs.mkdirSync(path.join(out, '_fast'), { recursive: true });
fs.mkdirSync(path.join(out, '_legacy'), { recursive: true });
fs.writeFileSync(path.join(out, '_legacy/index.html'), source);
function asset(label, code) {
  new vm.Script(code, { filename: label });
  const hash = createHash('sha256').update(code).digest('hex').slice(0, 16);
  const url = `/_fast/${label}-${hash}.js`;
  fs.writeFileSync(path.join(out, url), code);
  return url;
}
function localAsset(url) {
  const pathname = new URL(url, 'https://dashboard.invalid').pathname;
  assert(!pathname.includes('..'), 'Invalid asset path');
  const originalPath=path.join(input,pathname);
  return fs.readFileSync(fs.existsSync(originalPath)?originalPath:path.join(out,pathname),'utf8');
}

// Preserve the certified July–October withdrawals contained in the previous ERP position.
// New stock spreadsheets only contain balances; the movement snapshot must not be discarded.
function buildCertifiedMovements() {
  let b64='';
  for(let i=1;i<=16;i++){
    const file='public/stock-current-20261015-1340-'+String(i).padStart(2,'0')+'.js';
    const code=read(file),match=code.match(/window\.CURRENT_STOCK_GZ\+='([^']+)';/);
    assert(match,'Missing historical stock data chunk '+file);
    b64+=match[1];
  }
  const oldText=gunzipSync(Buffer.from(b64,'base64')).toString('utf8');
  const marker='window.CURRENT_STOCK_20260911=';
  assert(oldText.startsWith(marker),'Old certified position has unknown format');
  const old=JSON.parse(oldText.slice(marker.length).trim().replace(/;$/,''));
  assert(old.revised_monthly_rows?.length===1954 && Array.isArray(old.revised_monthly_cols),
    'Expected certified 1,954 monthly movement positions');
  fs.mkdirSync(path.join(out,'_data'),{recursive:true});
  const data='window.STOCK_REVISED_MONTHLY_20261015='+JSON.stringify({
    cols:old.revised_monthly_cols,rows:old.revised_monthly_rows
  })+';\n';
  fs.writeFileSync(path.join(out,'_data/revised-monthly-20261019.js'),data);
  return {cols:old.revised_monthly_cols,rows:old.revised_monthly_rows,bytes:Buffer.byteLength(data)};
}
const certifiedMovements=buildCertifiedMovements();
report.certifiedMovements={rows:certifiedMovements.rows.length,bytes:certifiedMovements.bytes};

// The legacy injectors remain authoritative for stock/movement file versions.
const context = vm.createContext({});
vm.runInContext(legacy.replace('export default', 'globalThis.worker =') +
  '\nglobalThis.BodyInjector=DashboardInjector;globalThis.HeadInjector=DashboardHeadInjector;', context, { timeout: 2000 });
function injection(pilot) {
  let before = '', after = '', head = '';
  new context.BodyInjector(pilot).element({ prepend: value => before += value, append: value => after += value });
  new context.HeadInjector(pilot).element({ append: value => head += value });
  const urls = [...after.matchAll(/<script\s+src="([^"]+)"\s*><\/script>/g)].map(m => m[1]);
  assert(urls.length > 10, 'Unexpected injection format');
  return { before, after, head, urls };
}
const scriptPattern = /<script\b([^>]*)>([\s\S]*?)<\/script\s*>/gi;
const inline = [...source.matchAll(scriptPattern)];
assert(inline.length === 1 && !inline[0][1].includes('src='), 'Review changed base HTML before building');
let core = inline[0][2];
const renderAll = 'function render(){renderOverview();renderStock();renderBaixas();renderMinimum();renderProducts();renderSuppliers();renderHistory();renderCDI()}';
assert(core.includes(renderAll), 'Core renderer changed; review optimizer');
core = core.replace(renderAll, 'function render(){window.DB_FAST.requestAll()}');
const renderers = { renderOverview: 'geral', renderStock: 'estoque', renderBaixas: 'baixas', renderMinimum: 'minimo', renderProducts: 'produtos', renderSuppliers: 'fornecedores', renderHistory: 'historico', renderCDI: 'cdi', renderQuotes: 'orcamentos' };
const registration = Object.entries(renderers).map(([name, view]) => `${name}=window.DB_FAST.wrap('${name}','${view}',${name});`).join('\n');
core = registration + '\n' + core;
// Honor two months of minimum stock and the completed months through Sep/2026 (Oct partial).
core = core.replaceAll('minimumRoundUp(avg*4,', 'minimumRoundUp(avg*(window.STOCK_MINIMUM_MONTHS||2),');
core = core.replace("completeMonths=y==='2026'?8:12", "completeMonths=y==='2026'?9:12");
core = core.replace('avg=complete/19,minimum', 'avg=complete/21,minimum');
core = core.replace('complete_months:19,avg', 'complete_months:21,avg');
core = core.replaceAll('Set*', 'Set');
function unpack(keys, rows) {
  return rows.map(values => Object.fromEntries(keys.map((key, index) => [key, values[index]])));
}
const unpackSource = 'function __dbFastUnpack(keys,rows){return rows.map(values=>Object.fromEntries(keys.map((key,index)=>[key,values[index]])))}\n';
// Remove repeated field names, not data. Reject any reconstruction mismatch.
core = core.replace(/^const ([A-Z_]+)=(\[.*\]);$/gm, (declaration, name, text) => {
  if (text.length < 40000) return declaration;
  let values; try { values = JSON.parse(text); } catch { return declaration; }
  if (!values.length || !values[0] || Array.isArray(values[0]) || typeof values[0] !== 'object') return declaration;
  const keys = Object.keys(values[0]), signature = JSON.stringify(keys);
  if (!values.every(row => row && JSON.stringify(Object.keys(row)) === signature)) return declaration;
  const packed = values.map(row => keys.map(key => row[key]));
  assert.deepEqual(unpack(keys, JSON.parse(JSON.stringify(packed))), values, 'Dataset mismatch: ' + name);
  const compiled = `const ${name}=__dbFastUnpack(${JSON.stringify(keys)},${JSON.stringify(packed)});`;
  report.datasets.push({ name, rows: values.length, before: Buffer.byteLength(declaration), after: Buffer.byteLength(compiled) });
  return compiled;
});
core = unpackSource + core;
const coreUrl = asset('core', core);
const runtimeUrl = asset('runtime', read('scripts/fast-runtime.js'));
for (const pilot of [false, true, 'chua']) {
  const injected = injection(pilot);
  const codes = injected.urls.map(url => ({ url, code: localAsset(url) }));
  const stockContext = vm.createContext({ window: {} });
  for (const { code } of codes.filter(x => x.url.startsWith('/stock-current-') && /window\.CURRENT_STOCK_GZ\s*(?:\+)?=/.test(x.code)))
    vm.runInContext(code, stockContext, { timeout: 2000 });
  assert(stockContext.window.CURRENT_STOCK_GZ, 'Current stock chunks missing');
  const stockText = gunzipSync(Buffer.from(stockContext.window.CURRENT_STOCK_GZ, 'base64')).toString('utf8');
  const prefix = 'window.CURRENT_STOCK_20260911=';
  assert(stockText.includes(prefix), 'Unknown stock payload');
  const payload = JSON.parse(stockText.slice(stockText.indexOf(prefix) + prefix.length).trim().replace(/;$/, ''));
  assert(Array.isArray(payload.rows) && payload.rows.length === Number(payload.meta.registros ?? payload.meta.posicoes), 'Invalid stock row count');
  payload.revised_monthly_cols=certifiedMovements.cols;
  payload.revised_monthly_rows=certifiedMovements.rows;
  let loaderCount = 0;
  const compiled = codes.map(({ url, code }) => {
    if(url.startsWith('/_data/revised-monthly-'))return '';
    if (url.startsWith('/stock-current-') && /window\.CURRENT_STOCK_GZ\s*(?:\+)?=/.test(code)) return '';
    if (url.includes('/current-stock-loader-')) {
      loaderCount++;
      const applyUrl = code.match(/script\.src\s*=\s*['"]([^'"]+)['"]/);
      assert(applyUrl, 'Stock application script missing');
      return 'window.__CURRENT_STOCK_20260911_LOADING=true;window.CURRENT_STOCK_20260911=' + JSON.stringify(payload) + ';\n' + localAsset(applyUrl[1]);
    }
    if (url.includes('/purchase-variation.js')) {
      assert(code.includes('  btn.addEventListener(\'click\''), 'Variation layout changed');
      code = code.replace("  btn.addEventListener('click'", "  renderVariation=window.DB_FAST.wrap('renderVariation','variacao',renderVariation);\n  btn.addEventListener('click'");
    }
    assert(!code.includes('document.currentScript'), 'Review currentScript dependency in ' + url);
    return '\n/* ' + url + ' */\n' + code;
  }).filter(Boolean).join('\n;\n');
  assert.equal(loaderCount, 1, 'Expected exactly one stock loader');
  const addons = compiled + '\n;window.DB_FAST.finish();\n';
  const addonUrl = asset(pilot === 'chua' ? 'chua' : pilot ? 'sao-joao' : 'gestao', addons);
  const links = [runtimeUrl, coreUrl, addonUrl];
  let html = source.replace(scriptPattern, '');
  html = html.replace(/<html\b([^>]*)>/i, `<html$1 class="db-booting" data-db-pilot="${pilot ? '1' : '0'}">`);
  const bootHead = injected.head.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '').replace(/<link\b[^>]*rel="preload"[^>]*>/gi, '');
  const scripts = links.map(url => `<script defer src="${url}"></script>`).join('');
  html = html.replace(/<\/head>/i, bootHead + scripts + '</head>');
  html = html.replace(/<body\b([^>]*)>/i, '<body$1>' + injected.before);
  const filename = pilot === 'chua' ? '_fast-chua/index.html' : pilot ? '_fast-sao-joao/index.html' : 'index.html';
  fs.mkdirSync(path.dirname(path.join(out, filename)), { recursive: true });
  fs.writeFileSync(path.join(out, filename), html);
  if (process.argv.includes('--test')) {
    const baseline = source.replace(/<\/head>/i, injected.head + '</head>').replace(/<body\b([^>]*)>/i, '<body$1>' + injected.before).replace(/<\/body>/i, injected.after + '</body>');
    fs.mkdirSync(path.join(out, '_benchmark'), { recursive: true });
    fs.writeFileSync(path.join(out, '_benchmark', pilot === 'chua' ? 'chua.html' : pilot ? 'pilot.html' : 'general.html'), baseline);
  }
  report.routes[pilot === 'chua' ? 'chua' : pilot ? 'saoJoao' : 'management'] = { htmlBytes: Buffer.byteLength(html), scriptRequests: links.length, previousScriptRequests: injected.urls.length + 1, scriptBytes: links.reduce((n, url) => n + fs.statSync(path.join(out, url)).size, 0), gzipScriptBytes: links.reduce((n, url) => n + gzipSync(fs.readFileSync(path.join(out, url))).length, 0), stockRows: payload.rows.length, stockDate: payload.meta.emissao };
}
fs.writeFileSync(path.join(root, 'build-report.json'), JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
