import test from 'node:test';
import assert from 'node:assert/strict';
import {allocateCdi} from '../scripts/cdi-allocation.mjs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {readCdiAllocationInput,buildCdiAllocationPack,buildCdiPurchaseDetail} from '../scripts/apply-cdi-allocation-20261126.mjs';

const p=(id,date,qty,cost,status='LANC.RECEB.')=>({id,date,doc:id,seq:'1',code:'123',unit:'PC',qty,totalCents:cost,status,local:'30115'});
const c=(purchase,net)=>({purchaseId:purchase.id,code:purchase.code,unit:purchase.unit,qty:purchase.qty,
  totalCents:purchase.totalCents,netCents:net,favorableCents:Math.max(net,0),unfavorableCents:Math.min(net,0),
  referenceMicro:1_000_000,status:purchase.status});
const e=(id,date,qty,type='DISTRIBUICAO',unit='PC')=>({id,date,doc:id,seq:'1',code:'123',unit,qty,type,
  originLocal:'30115',destinationCode:type==='PERDA_D410'?'10551':'50115',destinationName:'Destino',amountERPCents:null});
const input=(purchases,comparison,events)=>({meta:{projectFrom:'2026-05-07'},purchases,comparison,events});

test('a loss reserves the same pool; future purchases cannot fill earlier outflows and units stay exact',()=>{
  const purchase=p('200','2026-05-08',3,300),comp=c(purchase,300);
  const source=input([purchase],[comp],[
    e('100','2026-05-07',1),e('201','2026-05-09',1,'PERDA_D410'),
    e('202','2026-05-10',2,'CONSUMO_CHUA'),e('203','2026-05-11',1),e('204','2026-05-09',1,'DISTRIBUICAO','UN')]);
  const snapshot=structuredClone(source),result=allocateCdi(source);
  assert.deepEqual(source,snapshot,'pure function does not mutate evidence');
  const rows=new Map(result.rows.map(r=>[r.id,r]));
  assert.equal(rows.get('100').matchedQty,0);assert.equal(rows.get('203').matchedQty,0);assert.equal(rows.get('204').matchedQty,0);
  assert.equal(rows.get('201').matchedQty,1);assert.equal(rows.get('201').benefitEligible,false);
  assert.equal(rows.get('202').matchedQty,2);
  assert.equal(result.purchaseGain.netCents,300);
  assert.equal(result.purchaseGain.eligibleAllocatedNetCents,200);
  assert.equal(result.purchaseGain.excludedReservedNetCents,100);
  assert.equal(result.purchaseGain.residualNetCents,0);
  assert.equal(rows.get('202').amountERPCents,null,'allocation does not invent an ERP transfer value');
});

test('negative fractional-cent allocations conserve the original purchase difference',()=>{
  const purchase=p('200','2026-05-08',3,100),comp=c(purchase,-1);
  const result=allocateCdi(input([purchase],[comp],[e('201','2026-05-09',1),e('202','2026-05-10',1),e('203','2026-05-11',1)]));
  assert.deepEqual(result.rows.map(r=>r.allocatedCostCents),[33,34,33]);
  assert.deepEqual(result.rows.map(r=>r.allocatedNetCents),[0,-1,0]);
  assert.equal(result.purchaseGain.netCents,-1);assert.equal(result.purchaseGain.residualNetCents,0);
});

test('receipt and same-day scenarios preserve pending status and the frozen purchase headline',()=>{
  const pending=p('200','2026-05-08',1,100,'NÃO LANC.RECEB.'),received=p('201','2026-05-09',1,200);
  const source=input([pending,received],[c(pending,100),c(received,-20)],[e('202','2026-05-08',1),e('203','2026-05-10',1)]);
  const all=allocateCdi(source),strict=allocateCdi(source,{receiptMode:'received'}),prior=allocateCdi(source,{allowSameDayPurchases:false});
  assert.equal(all.rows[0].pendingQty,1);assert.equal(all.rows[0].sameDayQty,1);
  assert.equal(strict.rows[0].matchedQty,0);assert.equal(strict.rows[1].links[0].purchaseId,'201');
  assert.equal(strict.purchaseGain.pending.residualNetCents,100);
  assert.equal(prior.rows[0].matchedQty,0);assert.equal(prior.rows[1].links[0].purchaseId,'200');
  assert.equal(prior.meta.sameDayPurchasesAreAssumed,false);
  for(const scenario of [all,strict,prior])assert.equal(scenario.purchaseGain.netCents,80);
  assert.throws(()=>allocateCdi(input([pending,pending],[],[])),/duplicate purchase/);
  assert.throws(()=>allocateCdi(input([pending],[],[e('202','2026-05-09',1),e('202','2026-05-09',1)])),/duplicate event/);
});

test('the real source reconciles every purchase quantity, signed benefit and missing ERP transfer cost',()=>{
  const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
  const source=readCdiAllocationInput(root),before=structuredClone(source);
  const result=buildCdiAllocationPack(source);
  assert.deepEqual(source,before);
  assert.equal(result.rows.length,901);
  const D=result.categories.DISTRIBUICAO;
  assert.equal(D.events,228);assert.equal(D.matchedEvents,124);assert.equal(D.referenceEvents,119);
  assert.equal(D.knownERPEvents,184);assert.equal(D.missingERPEvents,44);
  assert.equal(D.allocatedNetCents,4390993);assert.equal(D.receivedNetCents,90927);assert.equal(D.pendingNetCents,4300066);
  assert.equal(result.purchaseGain.eligibleAllocatedNetCents,4570326);
  assert.equal(result.purchaseGain.excludedReservedNetCents,447906);
  assert.equal(result.purchaseGain.residualNetCents,1578085);
  assert.equal(result.meta.newTransferAllocation.allocatedNetCents,394948);
  assert.equal(result.meta.newTransferAllocation.allocatedCostCents,738295);
  const links=result.rows.flatMap(r=>r.links.map(l=>({...l,eventDate:r.date,eventCode:r.code,eventUnit:r.unit})));
  assert.equal(links.length,412);
  for(const lot of result.purchaseBalances){
    const used=links.filter(l=>l.purchaseId===lot.purchaseId);
    const quantity=used.reduce((n,l)=>n+Math.round(l.qty*1e6),0)/1e6;
    assert.equal(quantity,lot.allocatedQty);
    assert(quantity<=lot.qty);
    assert.equal(Math.round((lot.allocatedQty+lot.residualQty)*1e6),Math.round(lot.qty*1e6));
    assert.equal(lot.allocatedCostCents+lot.residualCostCents,lot.totalCents);
    assert.equal(lot.allocatedNetCents+lot.residualNetCents,lot.netCents??0);
    assert.equal(lot.allocatedUnfavorableCents+lot.residualUnfavorableCents,lot.unfavorableCents??0);
    for(const link of used){assert(link.date<=link.eventDate);assert.equal(link.code,link.eventCode);assert.equal(link.unit,link.eventUnit)}
  }
  assert.equal(result.purchaseBalances.reduce((n,p)=>n+p.allocatedUnfavorableCents,0),-85105);
  assert.equal(result.purchaseBalances.reduce((n,p)=>n+p.residualUnfavorableCents,0),-174957);
  const newRows=result.rows.filter(r=>r.type==='DISTRIBUICAO'&&r.amountERPCents===null);
  assert.equal(newRows.length,44);assert(newRows.every(r=>r.seq===null));
  const received=result.scenarios.receivedOnly;
  assert.equal(received.categories.DISTRIBUICAO.allocatedNetCents,288211);
  assert.equal(received.purchaseGain.eligibleAllocatedNetCents,289113);
  assert(received.rows.flatMap(r=>r.links).every(l=>l.receipt==='received'));
  assert(result.rows.filter(r=>r.type==='CONSUMO_NAO_IDENTIFICADO').every(r=>!r.benefitEligible));
  const reference=links.filter(l=>l.code==='105090'&&l.comparisonAvailable);
  assert(reference.length>0);assert(reference.every(l=>l.approvedReferenceMicro===24235000));
  const knownWithoutReference=result.rows.find(r=>r.id==='B|2700194:3');
  assert.equal(knownWithoutReference.allocatedComparisonCostCents,180779);
  assert.equal(knownWithoutReference.referenceQty,0);assert.equal(knownWithoutReference.allocatedNetCents,null);
  const purchase=buildCdiPurchaseDetail(source);
  assert.equal(purchase.meta.lines,270);assert.equal(purchase.meta.totalCents,15430869);
  assert.equal(purchase.meta.distinctSkuUnits,218);
  assert.equal(purchase.groups.reduce((s,g)=>s+g[2],0),15430869);
  assert.equal(purchase.months.reduce((s,m)=>s+m[2],0),15430869);
});
