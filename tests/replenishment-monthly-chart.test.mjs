import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import {fileURLToPath} from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const file=fs.readFileSync(path.join(root,'public/stock-min-max-unified-20261103.js'),'utf8');

function fixture(){
  // Compile o script completo para validar a sintaxe antes do teste isolado.
  new vm.Script(file,{filename:'stock-min-max-unified-20261103.js'});
  const from=file.indexOf('  const monthlyNames=');
  const to=file.indexOf('  function itemTable(rows){',from);
  assert(from>0&&to>from,'Funcoes do grafico mensal presentes');
  const context={
    window:{CURRENT_STOCK_META:{emissao:'26/11/2026 10:04:55'}},
    MOVEMENTS_YEARLY:[
      {year:'2025',codigo:'105600',codigo_local:'50115',un:'PC',months:[5,0,9,...Array(9).fill(0)]},
      {year:'2026',codigo:'105600',codigo_local:'50115',un:'PC',months:[2,0,4,...Array(9).fill(0)]},
      {year:'2026',codigo:'105600',codigo_local:'30115',un:'PC',months:[900,...Array(11).fill(0)]},
      {year:'2026',codigo:'105600',codigo_local:'50115',un:'KG',months:[3,...Array(11).fill(0)]}
    ],
    CDI_NETWORK_YEARLY:[],
    config:{year:''},
    str:v=>String(v??''),
    norm:v=>String(v??'').toUpperCase(),
    n:v=>Number(v)||0,
    esc:v=>String(v??'').replace(/&/g,'&amp;').replace(/</g,'&lt;'),
    qty:v=>String(v)
  };
  vm.createContext(context);
  vm.runInContext(file.slice(from,to)+'\nthis.monthlyHistory=monthlyHistory;this.monthlyChartHtml=monthlyChartHtml;',context,
    {timeout:5000});
  return context;
}

test('grafico mensal separa almoxarifado e unidade e apresenta meses sem baixa',()=>{
  const c=fixture();
  const product={codigo:'105600',codigo_local:'50115',local:'ALMOXARIFADO GERAL F SJ',
    produto:'FILTRO DE AR EXTERNO',un:'PC',network:false};
  const series=c.monthlyHistory(product);
  assert.equal(series.length,2);
  assert.equal(series[0].un,'PC');
  assert.equal(series[0].months[2025][0],5);
  assert.equal(series[0].months[2026][0],2);
  assert.equal(series[0].months[2026][1],0);
  assert.equal(series[1].un,'KG');
  const html=c.monthlyChartHtml(product);
  assert.match(html,/FILTRO|Código:|105600/);
  assert.match(html,/data-year="2025"/);
  assert.match(html,/data-year="2026"/);
  assert.match(html,/data-value="0"/);
  assert.match(html,/data-unit="KG"/);
  const chart2026=html.split('data-year="2026"')[1]||'';
  assert.doesNotMatch(chart2026,/data-month="11"/,'Novembro parcial nao vira zero ficticio');
  assert.doesNotMatch(html,/900/,'Nao agrega outro almoxarifado');
});

test('periodo selecionado limita os graficos sem alterar as quantidades',()=>{
  const c=fixture();
  const product={codigo:'105600',codigo_local:'50115',local:'São João',produto:'FILTRO',un:'PC',network:false};
  c.config.year='2025';
  const html=c.monthlyChartHtml(product);
  assert.match(html,/data-year="2025"/);
  assert.doesNotMatch(html,/data-year="2026"/);
  assert.match(html,/data-month="12"/);
  c.config.year='2026';
  const html26=c.monthlyChartHtml(product);
  assert.doesNotMatch(html26,/data-year="2025"/);
  assert.match(html26,/data-month="10"/);
  assert.doesNotMatch(html26,/data-month="11"/);
});

test('clique no produto preserva cabecalho e filtro da tabela',()=>{
  assert.match(file,/class="dbmx-product-chart"/);
  assert.match(file,/panel\.addEventListener\('click'/);
  assert.match(file,/function openMonthlyChart\(/);
  assert.match(file,/function itemTable\(/);
  assert.match(file,/id="dbmx-table-sort"/);
  assert.match(file,/id="dbmx-table-status"/);
});