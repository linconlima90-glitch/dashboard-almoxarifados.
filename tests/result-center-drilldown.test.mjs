import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const source=fs.readFileSync(new URL('../public/stock-min-max-unified-20261103.js',import.meta.url),'utf8');

test('script do grafico de baixas e do detalhamento por centro tem sintaxe valida',()=>{
  new vm.Script(source);
  assert.match(source,/button type="button" class="dbmx-monthly-month"/);
  assert.match(source,/data-year="/);
  assert.match(source,/function showResultCenters/);
  assert.match(source,/window.DB_RESULT_CENTER_DATA/);
  assert.match(source,/resultCenterHtml\(monthlySelection/);
});

function getDetail(){
  const from=source.indexOf('  function resultCenterHtml(');
  const to=source.indexOf('  function showResultCenters(',from);
  assert(from>0&&to>from);
  const c={
    window:{DB_RESULT_CENTER_DATA:null},
    monthlyNames:['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'],
    str:x=>String(x??''),norm:x=>String(x??'').toUpperCase(),
    n:x=>Number(x)||0,qty:x=>String(x),
    esc:x=>String(x??'').replace(/&/g,'&amp;').replace(/</g,'&lt;')
  };
  vm.createContext(c);
  vm.runInContext(source.slice(from,to)+'\nthis.detail=resultCenterHtml;',c);
  return c;
}
const product={codigo:'100411',codigo_local:'30115',produto:'ROLAMENTO 6206',un:'PC',network:false};

test('na falta do campo CR, informa ausencia e nao inventa destinacao',()=>{
  const c=getDetail();
  assert.match(c.detail(product,2026,9,'PC',13),/não informa o centro de resultado/);
  assert.doesNotMatch(c.detail(product,2026,9,'PC',13),/<table>/);
});

test('fonte parcial mostra centro real e alerta quando quantidade nao fecha',()=>{
  const c=getDetail();
  c.window.DB_RESULT_CENTER_DATA={
    source:'ERP de exemplo',from:'2026-07-01',to:'2026-10-15',
    centers:['IMPLEMENTO  DISTRIBUIDOR','OFICINA FAZENDA CHUA'],
    rows:[[9,'30115','100411','PC',0,3],[9,'30115','100411','PC',1,2],
      [9,'50115','100411','PC',0,900],[9,'30115','100411','KG',0,800]]
  };
  const partial=c.detail(product,2026,9,'PC',13);
  assert.match(partial,/IMPLEMENTO  DISTRIBUIDOR/);
  assert.match(partial,/OFICINA FAZENDA CHUA/);
  assert.match(partial,/Diferença de 8 PC/);
  assert.doesNotMatch(partial,/900 PC/);
  assert.doesNotMatch(partial,/800 PC/);
  const unavailable=c.detail(product,2026,4,'PC',8);
  assert.match(unavailable,/não está coberto pela fonte/);
  const matched=c.detail(product,2026,9,'PC',5);
  assert.match(matched,/Quantidades coincidem/);
});