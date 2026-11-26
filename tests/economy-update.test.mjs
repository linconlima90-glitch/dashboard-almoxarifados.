import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import {fileURLToPath} from 'node:url';
import {gunzipSync} from 'node:zlib';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const read=file=>fs.readFileSync(path.join(root,file),'utf8');
const block=(source,start,end)=>{
  const a=source.indexOf(start),b=source.indexOf(end,a);
  assert(a>=0&&b>a,'Calculation block missing: '+start);
  return source.slice(a,b);
};
function comparisonContext(){
  const context=vm.createContext({window:{}});
  for(const file of ['public/approved-product-costs-20261113.js',
    'public/economia-tabela-custo-aprovada-data-20261109.js'])
    vm.runInContext(read(file),context,{filename:file});
  context.window.DB_PURCHASES_20261110_DELTA=JSON.parse(gunzipSync(Buffer.from(
    read('data/purchases-changes-20261110.b64').trim(),'base64')).toString());
  context.window.DB_PURCHASES_20261113_DELTA=JSON.parse(read('data/purchases-day-20261113.json'));
  context.window.DB_PURCHASES_20261117_DELTA=JSON.parse(read('data/purchases-day-20261117.json'));
  context.data=JSON.parse(gunzipSync(Buffer.from(
    context.window.DB_COST_TABLE_COMPARE_CORRECTED_GZIP,'base64')).toString());
  const source=read('public/economia-tabela-custo-aprovada-ui-20261109.js');
  vm.runInContext(block(source,'  function comparisonFromTotal','  function show(data)'),context);
  return context;
}

test('all 24 ERP purchases join the comparison once, with amounts and receipt statuses preserved',()=>{
  const context=comparisonContext();
  const original=structuredClone(context.data.purchases);
  vm.runInContext('prepareComparison(data)',context);
  const {meta,products,purchases}=context.data;
  assert.equal(purchases.length,441);
  assert.equal(meta.purchaseCents,24522074);
  assert.equal(meta.positiveCents,9926664);
  assert.equal(meta.negativeCents,-632046);
  assert.equal(meta.netCents,9294618);
  assert.equal(meta.matchedLines+meta.unmatchedLines,441);
  assert.equal(meta.financialSavingsCertified,false);
  assert.equal(meta.receiptSummary.received.rows,147);
  assert.equal(meta.receiptSummary.pending.rows,294);
  assert.equal(meta.receiptSummary.received.paidCents+meta.receiptSummary.pending.paidCents,24522074);
  assert.equal(meta.purchaseUpdates['20261113'].netCents,-31029);
  assert.equal(meta.purchaseUpdates['20261117'].netCents,36488);
  assert.equal(meta.purchaseUpdates['20261117'].matchedReference,2);
  assert.equal(meta.purchaseUpdates['20261117'].missingReference,22);
  const key=t=>[t[16],t[17],t[2],t[6]].join('|');
  const byKey=new Map(purchases.map(t=>[key(t),t]));
  assert.equal(byKey.size,441);
  for(const previous of original){
    const current=byKey.get(key(previous));
    assert(current,'Historical purchase retained');
    for(const col of [1,2,5,6,8,9,10,15,16,17,18])
      assert.equal(current[col],previous[col],'Fiscal value/status preserved at '+key(previous));
  }
  const refs=new Map(products.map(p=>[String(p[1])+'|'+p[4],p[6]]));
  assert.equal(refs.get('124928|PC'),7982580000);
  assert.equal(refs.get('105090|KG'),24235000);
  for(const row of context.window.DB_PURCHASES_20261117_DELTA.added){
    const t=byKey.get([row[1],row[2],row[3],row[4]].join('|'));
    assert(t);assert.equal(t[9],row[15]);assert.equal(t[18],row[16]);
    const reference=refs.get(String(row[3])+'|'+row[12]);
    const expected=reference>0?Math.round(reference*row[13]/10000)-row[15]:0;
    assert.equal(t[13],expected,'Difference uses invoice total, not rounded unit price');
    if(!(reference>0))assert.match(t[19],/REFERENCIA INDISPONIVEL/);
    if(row[16]==='NÃO LANC.RECEB.'){
      assert.equal(t[13],0);assert.match(t[19],/RECEBIMENTO PENDENTE/);
    }
  }
  assert.equal(byKey.get('2723145|10|117755|50115')[13],33104);
  assert.equal(byKey.get('2723145|12|119725|50115')[13],3384);
});

test('duplicate documents or a changed receipt status stop the financial comparison',()=>{
  const duplicate=comparisonContext();
  duplicate.window.DB_PURCHASES_20261117_DELTA.added[1]=
    structuredClone(duplicate.window.DB_PURCHASES_20261117_DELTA.added[0]);
  assert.throws(()=>vm.runInContext('prepareComparison(data)',duplicate),/Compra repetida/);
  const status=comparisonContext();
  status.window.DB_PURCHASES_20261117_DELTA.added[0][16]='RECEBIDO';
  assert.throws(()=>vm.runInContext('prepareComparison(data)',status),/fora da remessa conciliada/);
});

test('cost lookup, CSV and ERP correction form distinguish original and approved costs',()=>{
  const source=read('public/cost-reference-update-tab.js');
  const inputs={};
  const context=vm.createContext({
    window:{CURRENT_STOCK_META:{emissao:'25/11/2026 15:59:16'}},
    STOCK:[
      {codigo:124928,produto:'CORREIA HXE46027',grupo:'CORREIAS',un:'PC',local:'TAPERA',
        estoque:1,custo_estoque:7982.58,valor_estoque:7982.58,custo_erp_original:9391.27,
        valor_erp_original:9391.27,custo_corrigido_aprovado:true,custo_correcao_fonte:'Ajuste gerencial aprovado pelo gestor'},
      {codigo:102427,produto:'ABRACADEIRA',grupo:'ABRACADEIRAS',un:'PC',local:'CHUA',
        estoque:41,custo_estoque:1.50,valor_estoque:61.50}
    ],PURCHASES:[],
    $:id=>inputs[id]||(inputs[id]={value:'',innerHTML:'',textContent:''})
  });
  vm.runInContext(read('public/approved-product-costs-20261113.js'),context);
  vm.runInContext(block(source,'const norm=','const storageKey=')+
    '\nlet records=[],known=new Map(),loaded=false,dirty=true,editing=null;\n'+
    block(source,'function keyOf(r)','function stat(label,value)')+
    block(source,'function referenceExportRows(rows)','view.addEventListener')+
    block(source,'function presentEditing()','function edit(key)')+
    '\nthis.result=build();this.csv=referenceExportRows(result);',context);
  const row=context.result.find(r=>r.code==='124928');
  assert.equal(row.stockCost,9391.27);
  assert.equal(row.managementCost,7982.58);
  assert.equal(row.stockValueERP,9391.27);
  assert.equal(row.stockValue,7982.58);
  assert.equal(row.stockCostAdjusted,true);
  assert.match(row.stockCostSource,/gerencial aprovado/);
  const normal=context.result.find(r=>r.code==='102427');
  assert.equal(normal.stockCost,1.5);assert.equal(normal.managementCost,1.5);
  assert.equal(normal.stockValueERP,normal.stockValue);
  assert.equal(normal.stockCostAdjusted,false);
  const [header,...rows]=context.csv;
  const exported=rows.find(r=>r[0]==='124928');
  assert.equal(exported[header.indexOf('CustoEstoqueERPOriginal')],9391.27);
  assert.equal(exported[header.indexOf('CustoUsadoDashboard')],7982.58);
  assert.equal(exported[header.indexOf('ValorEstoqueERPOriginal')],9391.27);
  assert.equal(exported[header.indexOf('ValorEstoqueGerencial')],7982.58);
  assert.equal(exported[header.indexOf('CustoEstoqueAjustado')],'SIM');
  context.$('cu-scope').value='ESTOQUE_ERP';
  vm.runInContext("editing=result.find(r=>r.code==='124928');presentEditing();",context);
  assert.match(inputs['cu-current'].value,/9\.391,27/);
  assert.match(inputs['cu-sources'].innerHTML,/Custo original ERP/);
  assert.match(inputs['cu-sources'].innerHTML,/7\.982,58/);
  context.$('cu-scope').value='GERENCIAL';
  vm.runInContext('presentEditing()',context);
  assert.match(inputs['cu-current'].value,/7\.982,58/);
});
