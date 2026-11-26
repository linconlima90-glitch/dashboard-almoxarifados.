import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source=fs.readFileSync(new URL('../public/baixas-erp-conferido-20261106.js',import.meta.url),'utf8');
function fixture(){
  const from=source.indexOf('  function summarize('),to=source.indexOf('  function cascadeOptions(',from);
  assert(from>0&&to>from,'funcoes de resumo e tabela presentes');
  const c={
    state:{sort:'value',item:''},
    esc:v=>String(v??''),
    number:v=>String(v),
    qty:v=>String(v),
    brlCents:v=>String(v),
  };
  vm.createContext(c);
  vm.runInContext(source.slice(from,to)+'\nthis.tableItems=tableItems;',c,{timeout:3000});
  return c;
}
const rows=[
 {codigo:'100',produto:'CARO',un:'PC',local:'A',grupo:'X',cents:10000,records:1,quantidade:1},
 {codigo:'200',produto:'BARATO',un:'PC',local:'A',grupo:'X',cents:1000,records:2,quantidade:20},
 {codigo:'300',produto:'UNIDADES',un:'UN',local:'B',grupo:'X',cents:500,records:1,quantidade:9},
];
function firstCode(html){return html.match(/<td>1<\/td><td>([^<]+)<\/td>/)?.[1]}

test('arquivo Javascript e interface de filtros validos',()=>{
  new vm.Script(source);
  assert.match(source,/id="dbx-sort-items"/);
  assert.match(source,/Maior quantidade baixada/);
  assert.match(source,/Maior valor baixado/);
  assert.match(source,/sortSelect\.addEventListener\('change'/);
});

test('ordenacao por valor privilegia custo total ERP sem alterar valores',()=>{
  const c=fixture();
  const html=c.tableItems(rows,true);
  assert.equal(firstCode(html),'100');
  assert.match(html,/10000/);
  assert.match(html,/1000/);
});

test('ordenacao por quantidade considera baixas por codigo e unidade',()=>{
  const c=fixture();
  c.state.sort='quantity';
  const html=c.tableItems(rows,true);
  assert.equal(firstCode(html),'200');
  assert.match(html,/Maior quantidade baixada/);
  assert.match(html,/20/);
});
