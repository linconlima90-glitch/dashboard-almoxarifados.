import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source=fs.readFileSync(new URL('../public/stock-min-max-unified-20261103.js',import.meta.url),'utf8');
const sample={codigo:'100411',codigo_local:'30115',produto:'ROLAMENTO 6206',un:'PC',network:false};

function fixture(){
  const from=source.indexOf('  const monthlyNames=');
  const to=source.indexOf('  function itemTable(rows){',from);
  assert(from>0&&to>from);
  const c={
    window:{},
    Map,Set,Promise,
    config:{year:'2026'},
    str:x=>String(x??''),norm:x=>String(x??'').toUpperCase(),
    n:x=>Number(x)||0,qty:x=>String(x),
    esc:x=>String(x??'').replace(/&/g,'&amp;').replace(/</g,'&lt;'),
    MOVEMENTS_YEARLY:[],CDI_NETWORK_YEARLY:[]
  };
  vm.createContext(c);
  vm.runInContext(source.slice(from,to)+
    '\nthis.renderCenter=resultCenterHtml;this.dataByCenter=centerRowsForItem;'+
    'this.setCenter=(year,data)=>resultYears.set(year,data);'+
    'this.setPlates=(year,data)=>plateYears.set(year,data);',c,{timeout:10000});
  return c;
}

test('codigo valido, grafico clicavel e complemento opcional sem tocar em reposicao',()=>{
  new vm.Script(source);
  assert.match(source,/class="dbmx-monthly-month"/);
  assert.match(source,/async function showResultCenters/);
  assert.match(source,/centros-resultado-placas-20261126-/);
  assert.match(source,/Sem placa informada/);
  assert.match(source,/function centerTableRows/);
});

test('quando placa nao publicada, continua exibindo CR e quantidade',()=>{
  const c=fixture();
  c.setCenter(2026,{
    dict:{local:['30115'],product:['100411'],unit:['PC'],center:['OFICINA FAZENDA CHUA']},
    rows:[[9,0,0,0,0,5]]
  });
  const html=c.renderCenter(sample,2026,9,'PC',5);
  assert.match(html,/OFICINA FAZENDA CHUA/);
  assert.match(html,/5 PC/);
  assert.doesNotMatch(html,/Sem placa informada/);
  assert.doesNotMatch(html,/<th>Placa/);
});

test('com fonte por placa, centro e suas quantidades preservados inclusive sem placa',()=>{
  const c=fixture();
  c.setCenter(2026,{
    dict:{local:['30115'],product:['100411'],unit:['PC'],center:['OFICINA FAZENDA CHUA']},
    rows:[[9,0,0,0,0,5]]
  });
  c.setPlates(2026,{
    dict:{local:['30115'],product:['100411'],unit:['PC'],
      center:['OFICINA FAZENDA CHUA'],plate:['','ABC1D23'],vehicle:['','CAMINHAO']},
    rows:[[9,0,0,0,0,0,0,2],[9,0,0,0,0,1,1,3]]
  });
  const html=c.renderCenter(sample,2026,9,'PC',5);
  assert.match(html,/ABC1D23/);
  assert.match(html,/CAMINHAO/);
  assert.match(html,/Sem placa informada/);
  assert.match(html,/rowspan="2"/);
  assert.match(html,/O total por centro confere com o gráfico/);
  assert.doesNotMatch(html,/Diferença a conferir/);
});

test('nao confunde placa de outro produto nem outra unidade',()=>{
  const c=fixture();
  c.setCenter(2026,{
    dict:{local:['30115'],product:['100411'],unit:['PC'],center:['OFICINA']},
    rows:[[9,0,0,0,0,5]]
  });
  c.setPlates(2026,{
    dict:{local:['30115'],product:['100411','100412'],unit:['PC','KG'],
      center:['OFICINA'],plate:['ABC1D23','OUTRA'],vehicle:['CAMINHAO','TRATOR']},
    rows:[[9,0,0,0,0,0,0,5],[9,0,1,0,0,1,1,100],[9,0,0,1,0,1,1,100]]
  });
  const html=c.renderCenter(sample,2026,9,'PC',5);
  assert.match(html,/ABC1D23/);
  assert.doesNotMatch(html,/OUTRA/);
  assert.doesNotMatch(html,/TRATOR/);
});
