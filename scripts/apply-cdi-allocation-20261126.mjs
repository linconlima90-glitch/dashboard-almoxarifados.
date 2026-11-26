import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {createHash} from 'node:crypto';
import {gzipSync,gunzipSync} from 'node:zlib';
import {allocateCdi} from './cdi-allocation.mjs';
import {readCdiTransferUpdate} from './apply-cdi-transfers-20261126.mjs';

const INPUT_SHA='fefeef8150df98af6778b4e27d64dc5483b79c99c978d2f133d98e37d3b98988';
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const sum=(rows,key)=>rows.reduce((n,r)=>n+(r[key]??0),0);

export function readCdiAllocationInput(root){
  const raw=gunzipSync(Buffer.from(fs.readFileSync(path.join(root,'data/cdi-allocation-input-20261126.b64'),'utf8').trim(),'base64'));
  assert.equal(hash(raw),INPUT_SHA,'Fonte da atribuicao CDI alterada');
  const input=JSON.parse(raw);
  // The normalized snapshot must be regenerated if any contributing source changes.
  for(const source of input.meta.sourceInputs){
    const file=path.join(root,source.file);
    if(source.file==='potencial_economia_3.csv')continue;
    assert(fs.existsSync(file),'Fonte de atribuicao ausente: '+source.file);
    assert.equal(hash(fs.readFileSync(file)),source.sha256,'Reconciliar novamente a fonte: '+source.file);
  }
  const ledger=readCdiTransferUpdate(root),transfers=input.events.filter(r=>r.type==='DISTRIBUICAO');
  assert.equal(transfers.length,ledger.transfers.length);
  const byId=new Map(transfers.map(r=>[r.id,r]));
  for(const source of ledger.transfers){
    const row=byId.get('D|'+source.id);
    assert(row,'Transferencia ausente da atribuicao: '+source.id);
    assert.equal(row.logicalKey,source.logicalKey);
    assert.equal(row.date,source.date);assert.equal(row.doc,String(source.erpUniqueNote));
    assert.equal(row.code,String(source.code));assert.equal(row.unit,source.unit);
    assert.equal(row.qty,source.quantity);assert.equal(row.amountERPCents,source.sourceValueCents);
    assert.equal(row.destinationCode,String(source.destinationLocal));
    assert.equal(row.seq,source.erpSequence==null?null:String(source.erpSequence));
  }
  assert.equal(input.events.length,901);assert.equal(input.purchases.length,270);
  assert.equal(sum(input.purchases,'totalCents'),15430869);
  assert.equal(input.comparison.length,176);assert.equal(sum(input.comparison,'netCents'),6596317);
  assert.equal(input.meta.allPurchaseComparison.netCents,9294618);
  return input;
}

export function buildCdiAllocationPack(input){
  const pack=allocateCdi(input),received=allocateCdi(input,{receiptMode:'received'});
  const priorDate=allocateCdi(input,{allowSameDayPurchases:false});
  assert.equal(pack.categories.DISTRIBUICAO.events,228);
  assert.equal(pack.categories.DISTRIBUICAO.allocatedNetCents,4390993);
  assert.equal(pack.categories.CONSUMO_CHUA.allocatedNetCents,179333);
  assert.equal(pack.purchaseGain.excludedReservedNetCents,447906);
  assert.equal(pack.purchaseGain.residualNetCents,1578085);
  assert.equal(pack.purchaseGain.netCents,6596317);
  assert.equal(pack.categories.DISTRIBUICAO.missingERPEvents,44);
  assert.equal(received.categories.DISTRIBUICAO.allocatedNetCents,288211);
  assert.equal(received.categories.CONSUMO_CHUA.allocatedNetCents,902);
  pack.scenarios={receivedOnly:{meta:received.meta,rows:received.rows,categories:received.categories,purchaseGain:received.purchaseGain},
    priorPurchaseDate:{meta:{allowSameDayPurchases:false},categories:priorDate.categories,purchaseGain:priorDate.purchaseGain}};
  pack.meta.normalizedInputSha256=INPUT_SHA;
  const additions=pack.rows.filter(r=>r.type==='DISTRIBUICAO'&&r.amountERPCents===null);
  pack.meta.newTransferAllocation={records:additions.length,matched:additions.filter(r=>r.matchedQty>0).length,
    withReference:additions.filter(r=>r.referenceQty>0).length,allocatedCostCents:sum(additions,'allocatedCostCents'),
    allocatedNetCents:sum(additions,'allocatedNetCents'),receivedNetCents:sum(additions,'receivedNetCents'),pendingNetCents:sum(additions,'pendingNetCents')};
  return pack;
}

export function buildCdiPurchaseDetail(input){
  const purchases=input.purchases,d={group:[],product:[],unit:[],supplier:[],status:[],buyCompany:[]};
  const intern=(key,value)=>{const values=d[key];let i=values.indexOf(value);if(i<0){i=values.length;values.push(value)}return i};
  const r=purchases.map(p=>[p.date.replaceAll('-',''),p.doc,p.invoice,p.seq,p.code,intern('group',p.group),
    intern('product',p.product),intern('unit',p.unit),intern('supplier',p.supplier),p.qty,
    Math.round(p.totalCents*100/p.qty),p.totalCents,intern('status',p.status),intern('buyCompany',p.buyer),null]);
  const aggregate=key=>{
    const result=new Map();for(const p of purchases){const value=key(p),row=result.get(value)||[value,0,0];row[1]++;row[2]+=p.totalCents;result.set(value,row)}
    return [...result.values()];
  };
  const groups=aggregate(p=>p.group).sort((a,b)=>b[2]-a[2]||a[0].localeCompare(b[0]));
  const months=aggregate(p=>p.date.slice(0,7)).sort((a,b)=>a[0].localeCompare(b[0]));
  const received=purchases.filter(p=>p.status==='LANC.RECEB.').length;
  const pending=purchases.filter(p=>String(p.status).normalize('NFD').replace(/[\u0300-\u036f]/g,'')==='NAO LANC.RECEB.').length;
  assert.equal(received+pending,purchases.length);
  const meta={schemaVersion:1,classification:'COMPRA_PARA_DISTRIBUICAO',
    classificationRule:'Compra para estoque no local 30115, independentemente da empresa compradora',
    from:'2026-05-07',to:input.meta.purchaseThrough,localCode:'30115',local:'ALMOXARIFADO GERAL F CHUA',project:'CDI DE PECAS',
    source:'Base consolidada de compras do dashboard e remessas conciliadas até 17/11/2026',
    sourceSha256:INPUT_SHA,emission:'26/11/2026',updatedAt:'2026-11-26',lines:purchases.length,
    totalCents:sum(purchases,'totalCents'),distinctSkuUnits:new Set(purchases.map(p=>p.code+'|'+p.unit)).size,
    groups:groups.length,suppliers:d.supplier.length,uniqueIDs:new Set(purchases.map(p=>p.id)).size,
    receivingStatus:{'LANC.RECEB.':received,'NAO LANC.RECEB.':pending},
    note:'Valores da base atual de compras preservados; preco unitario calculado pelo total ERP/quantidade. Divergencias historicas entre fontes registradas na apuracao. Compra nao equivale a transferencia ou economia.'};
  assert.equal(meta.lines,270);assert.equal(meta.totalCents,15430869);assert.equal(meta.distinctSkuUnits,218);
  return {detail:{v:1,d,r},groups,months,meta};
}

export function applyCdiAllocation20261126(root,out){
  const input=readCdiAllocationInput(root),pack=buildCdiAllocationPack(input),purchase=buildCdiPurchaseDetail(input);
  const encoded=gzipSync(Buffer.from(JSON.stringify(pack)),{level:9}).toString('base64');
  fs.writeFileSync(path.join(out,'cdi-bulk-audit-data-20261109.js'),
    '// Apuracao v2 recomposta em 26/11/2026: custos ERP ausentes permanecem null.\n'+
    'window.DB_CDI_BULK_AUDIT_GZIP='+JSON.stringify(encoded)+';\n');
  fs.writeFileSync(path.join(out,'cdi-distribution-detail-data-20261106.js'),
    'window.CDI_DISTRIBUTION_DETAIL_GZIP='+JSON.stringify(gzipSync(Buffer.from(JSON.stringify(purchase.detail)),{level:9}).toString('base64'))+';\n');
  let source=fs.readFileSync(path.join(root,'public/cdi-distribution-purchases.js'),'utf8');
  const start=source.indexOf('  const groups=['),end=source.indexOf('  const rowDate=',start);
  assert(start>0&&end>start,'Revisar blocos das compras CDI');
  source=source.slice(0,start)+'  const groups='+JSON.stringify(purchase.groups)+';\n'+
    '  const months='+JSON.stringify(purchase.months)+';\n  const meta='+JSON.stringify(purchase.meta)+';\n'+source.slice(end);
  new vm.Script(source);
  fs.writeFileSync(path.join(out,'cdi-distribution-purchases.js'),source);
  return {version:pack.v,events:pack.rows.length,purchases:pack.purchasesCdi,
    distribution:pack.categories.DISTRIBUICAO,purchaseGain:pack.purchaseGain,
    receivedDistribution:pack.scenarios.receivedOnly.categories.DISTRIBUICAO,
    newTransfers:pack.meta.newTransferAllocation,normalizedInputSha256:INPUT_SHA,compressedBytes:Buffer.byteLength(encoded)};
}
