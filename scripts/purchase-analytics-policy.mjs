import assert from 'node:assert/strict';

// Aplica a mesma politica a pagina de recuperacao e as rotas rapidas.
// Mantem o grafico "Compras por mes" e seu drilldown com todas as compras.
export function applyPurchaseAnalyticsPolicy(source){
  function change(oldText,newText,label){
    const count=source.split(oldText).length-1;
    assert.equal(count,1,'Revisar trecho de compras: '+label+' ('+count+')');
    source=source.replace(oldText,newText);
  }
  change('<script>\nconst STOCK=', '<script>\n'+"// Politica dos indicadores de compra e economia. Os dados originais nao sao removidos.\nwindow.DB_IS_TIRE_OR_CAMERA=function(item){\n  const normalize=value=>String(value??'').normalize('NFD').replace(/[\\u0300-\\u036f]/g,'').toUpperCase();\n  const isTireOrTube=/(?:^|[^A-Z0-9])(?:PNEUS?|CAMARAS?)(?=$|[^A-Z0-9])/;\n  return isTireOrTube.test(normalize(item?.grupo))||isTireOrTube.test(normalize(item?.produto));\n};\n"+'const STOCK=', 'regra da familia');
  change(
    'function benchmarkRowsFiltered(){const f=criteria();return PURCHASES.filter(x=>(!f.empresa',
    'function benchmarkRowsFiltered(){const f=criteria();return PURCHASES.filter(x=>!window.DB_IS_TIRE_OR_CAMERA(x)&&(!f.empresa',
    'base de menor preco');
  change(
    'function renderOverview(){const s=stockFiltered(),p=purchasesFiltered(),pr=productFiltered(),bench=buildPriceBench(benchmarkRowsFiltered());const totalComprado=p.reduce((a,x)=>a+(x.valor||0),0);',
    'function renderOverview(){const s=stockFiltered(),pTotal=purchasesFiltered(),p=pTotal.filter(x=>!window.DB_IS_TIRE_OR_CAMERA(x)),pr=productFiltered(),bench=buildPriceBench(benchmarkRowsFiltered());const totalComprado=pTotal.reduce((a,x)=>a+(x.valor||0),0),totalBaseEconomia=p.reduce((a,x)=>a+(x.valor||0),0);',
    'resumo e compras mes');
  change(
    "$('kEconomiaPct').textContent=totalComprado?pct.format(economia/totalComprado):'—';",
    "$('kEconomiaPct').textContent=totalBaseEconomia?pct.format(economia/totalBaseEconomia):'—';",
    'porcentagem sobre compras elegiveis');
  change(
    'const bySku=new Map();for(const x of s)if(!bySku.has(x.codigo))',
    'const bySku=new Map();for(const x of s.filter(x=>!window.DB_IS_TIRE_OR_CAMERA(x)))if(!bySku.has(x.codigo))',
    'contadores de historico de preco');
  change(
    'const monthly={};for(const x of p){const k=purchaseMonth(x);',
    'const monthly={};for(const x of pTotal){const k=purchaseMonth(x);',
    'mensal inclui pneus');
  change(
    'renderMonthOverviewDrilldown(p);const pm={};for(const x of s){',
    'renderMonthOverviewDrilldown(pTotal);const pm={};for(const x of s.filter(x=>!window.DB_IS_TIRE_OR_CAMERA(x))){',
    'detalhe do mes preservado e diferencas por item filtradas');
  change(
    "$('kDif').textContent=brl.format(s.reduce((a,x)=>a+x.dif_estoque_min,0));",
    "$('kDif').textContent=brl.format(s.filter(x=>!window.DB_IS_TIRE_OR_CAMERA(x)).reduce((a,x)=>a+x.dif_estoque_min,0));",
    'diferencas de custo');
  change(
    'function renderProducts(){const d=productFiltered().sort((a,b)=>b.valor_estoque-a.valor_estoque);',
    'function renderProducts(){const d=productFiltered().filter(x=>!window.DB_IS_TIRE_OR_CAMERA(x)).sort((a,b)=>b.valor_estoque-a.valor_estoque);',
    'tabela comparativa por produto');
  change(
    'const p=purchasesFiltered().filter(x=>x.fornecedor===name);if(!p.length)',
    'const p=purchasesFiltered().filter(x=>!window.DB_IS_TIRE_OR_CAMERA(x)&&x.fornecedor===name);if(!p.length)',
    'detalhe de fornecedor');
  change(
    'function renderSuppliers(){const p=purchasesFiltered(),bench=buildPriceBench(benchmarkRowsFiltered()),map={};',
    'function renderSuppliers(){const p=purchasesFiltered().filter(x=>!window.DB_IS_TIRE_OR_CAMERA(x)),bench=buildPriceBench(benchmarkRowsFiltered()),map={};',
    'tabela de fornecedor');
  change(
    'function renderHistory(){const d=purchasesFiltered(),bench=buildPriceBench(benchmarkRowsFiltered());',
    'function renderHistory(){const d=purchasesFiltered().filter(x=>!window.DB_IS_TIRE_OR_CAMERA(x)),bench=buildPriceBench(benchmarkRowsFiltered());',
    'tabela historico de compras');
  change(
    '<h2>Histórico detalhado de compras</h2>',
    '<h2>Histórico detalhado de compras <small style="font-size:11px;color:#5f7467">(sem pneus e câmaras)</small></h2>',
    'legenda do historico');
  change(
    'É um benchmark teórico e deve ser validado com cotação atual, marca, especificação, frete, impostos, prazo e condição comercial.</div>',
    'É um benchmark teórico e deve ser validado com cotação atual, marca, especificação, frete, impostos, prazo e condição comercial. <b>Pneus e câmaras são excluídos destes comparativos, mas permanecem nas Compras por mês.</b></div>',
    'aviso da analise');
  return source;
}
