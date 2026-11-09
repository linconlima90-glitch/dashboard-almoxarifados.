// Apuracao auditavel das compras evitadas (reuso) e comparacoes de preco (CDI).
// Marco do projeto 07/05/2026. Referencia: compras ERP 2025-2026 do proprio destino
// em ate 365 dias antes da transferencia; ausencia de evidencias => NAO VALIDADA.
// Diferencas negativas sao mantidas e jamais compensadas apenas pelas positivas.
(function(){
'use strict';
if(document.documentElement.dataset.dbPilot==='1')return;
const cdi=window.CDI_TRANSFER_LEDGER, reuse=window.DB_REALLOCATION_REUSE;
const loaded=typeof PURCHASES!=='undefined' && Array.isArray(PURCHASES) && window.DB_AUDITED_PURCHASE_READY===true;
if(!cdi||!reuse||!loaded){
  window.DB_ECONOMY_AUDIT={error:'Historico ERP de compras ou transferencias nao carregado',ready:false};
  return;
}
const DAY=86400000, limitDays=365;
const asNumber=x=>Number(x)||0;
const cents=n=>Math.round(asNumber(n)*100+1e-7);
const norm=x=>String(x??'').trim().toUpperCase();
const id=x=>{const n=Number(x);return Number.isFinite(n)?String(Math.trunc(n)):String(x??'').trim()};
const iso=x=>{const s=String(x??'').slice(0,10);const br=s.match(/^(\d\d)\/(\d\d)\/(\d{4})$/);return br?br[3]+'-'+br[2]+'-'+br[1]:/^\d{4}-\d\d-\d\d$/.test(s)?s:''};
const epoch=x=>{const d=iso(x);return d?Date.parse(d+'T12:00:00Z'):NaN};
const sum=(rows,key)=>rows.reduce((a,r)=>a+asNumber(r[key]),0);
const itemKey=(code,unit)=>id(code)+'|'+norm(unit);
const purchaseRows=[],byProduct=new Map(),seenPurchase=new Set();
for(const p of PURCHASES){
  const qty=asNumber(p.qtd),amountCents=cents(p.valor),date=iso(p.data),code=id(p.codigo),unit=norm(p.un),local=id(p.codigo_local);
  if(!(qty>0&&amountCents>0&&date&&code&&unit&&local))continue;
  const doc=id(p.nrounico),seq=id(p.seq),purchaseKey=[doc,seq,code,local].join('|');
  if(seenPurchase.has(purchaseKey))continue;seenPurchase.add(purchaseKey);
  const line={date,epoch:epoch(date),code,unit,local,qty,amountCents,
    supplier:String(p.fornecedor||''),invoice:id(p.nota),document:doc,sequence:seq,
    receiptStatus:String(p.status||''),group:String(p.grupo||'')};
  purchaseRows.push(line);
  const key=itemKey(code,unit);
  let arr=byProduct.get(key);if(!arr){arr=[];byProduct.set(key,arr)}arr.push(line);
}
function newest(a,b){
  if(a.epoch!==b.epoch)return b.epoch-a.epoch;
  if(Number(a.document)!==Number(b.document))return Number(b.document)-Number(a.document);
  return Number(b.sequence)-Number(a.sequence);
}
for(const list of byProduct.values())list.sort(newest);
function reference(t){
  const dateEpoch=epoch(t.date),min=dateEpoch-DAY*limitDays;
  const options=(byProduct.get(itemKey(t.code,t.unit))||[])
    .filter(p=>p.epoch<=dateEpoch&&p.epoch>=min);
  const local=options.find(p=>p.local===t.destinationCode);
  if(local)return{kind:'MESMO_DESTINO',purchase:local};
  const network=options.find(p=>p.local!==t.destinationCode&&p.local!==t.originCode);
  return network?{kind:'OUTRA_UNIDADE',purchase:network}:{kind:'SEM_REFERENCIA',purchase:null};
}
function lineFromCDI(r){
  return{id:'CDI|'+r.id,rawId:String(r.id),type:'CDI',date:r.date,
    origin:String(r.origin),originCode:id(r.originLocal||'30115'),
    destination:String(r.destination),destinationCode:id(r.destinationLocal),
    code:id(r.code),product:String(r.product||''),group:String(r.group||''),
    unit:norm(r.unit),quantity:asNumber(r.quantity),erpCents:asNumber(r.sourceValueCents),
    invoice:String(r.erpNote||''),document:String(r.erpUniqueNote||''),
    sequence:String(r.erpSequence||''),classification:'DISTRIBUICAO_CDI'};
}
function lineFromReuse(r){
  return{id:'REUSO|'+r.id,rawId:String(r.id),type:'REUSO',date:r.date,
    origin:String(r.origin),originCode:id(r.originCode),
    destination:String(r.destination),destinationCode:id(r.destinationCode),
    code:id(r.productCode),product:String(r.product||''),group:String(r.group||''),
    unit:norm(r.unit),quantity:asNumber(r.quantity),erpCents:asNumber(r.costCents),
    invoice:String(r.invoice||''),document:String(r.document||''),
    sequence:String(r.seq||''),classification:String(r.classification||'')};
}
const cdiRows=(cdi.transfers||[]).map(lineFromCDI),reuseRows=(reuse.transfers||[]).map(lineFromReuse);
const cdiCost=sum(cdiRows,'erpCents'),reuseCost=sum(reuseRows,'erpCents');
if(cdiRows.length!==cdi.audit?.importedRecords||cdiCost!==cdi.audit?.importedValueCents||
   reuseRows.length!==reuse.audit?.eligibleRows||reuseCost!==reuse.audit?.eligibleValueCents||
   [...cdiRows,...reuseRows].some(t=>t.destinationCode==='10551'||t.date<'2026-05-07'||
     !(t.quantity>0&&Number.isInteger(t.erpCents)&&t.erpCents>0&&t.code&&t.unit))||
   new Set([...cdiRows,...reuseRows].map(t=>t.rawId)).size!==cdiRows.length+reuseRows.length){
  window.DB_ECONOMY_AUDIT={error:'Falha na conferencia das transferencias ou duplicidade entre fontes',ready:false};
  throw Error(window.DB_ECONOMY_AUDIT.error);
}
const all=[...cdiRows,...reuseRows];
for(const t of all){
  const ref=reference(t),p=ref.purchase;
  t.referenceKind=ref.kind;
  t.referenceDocument=p?.document||'';
  t.referenceInvoice=p?.invoice||'';
  t.referenceDate=p?.date||'';
  t.referenceSupplier=p?.supplier||'';
  t.referenceLocation=p?.local||'';
  t.referenceReceiptStatus=p?.receiptStatus||'';
  t.referenceQuantity=p?.qty??null;
  t.referenceTotalOriginalCents=p?.amountCents??null;
  t.referenceUnitPrice=p?(p.amountCents/100)/p.qty:null;
  t.referenceTotalCents=p?Math.round(p.amountCents*t.quantity/p.qty+1e-7):null;
  // Apenas a compra do DESTINO pode fundamentar o comparativo; compras de
  // outras unidades sao proxy para consulta, jamais economia validada.
  t.grossComparisonCents=t.type==='CDI'&&ref.kind==='MESMO_DESTINO'
    ? t.referenceTotalCents-t.erpCents:null;
  // No reaproveitamento, custo historico do material ja foi pago.
  // O gasto evitavel seria a compra alternativa inteira, nao so a diferenca.
  t.avoidedPurchaseReferenceCents=t.type==='REUSO'&&ref.kind==='MESMO_DESTINO'
    ?t.referenceTotalCents:null;
  t.reviewStatus=ref.kind==='MESMO_DESTINO'?'COMPARATIVO_HISTORICO_PENDENTE':
    ref.kind==='OUTRA_UNIDADE'?'PROXY_REDE_PENDENTE':'SEM_PRECO_COMPARAVEL';
  t.validationReason=ref.kind==='MESMO_DESTINO'
    ?'Preco baseado na nota historica do destino. Confirmar compra evitada, demanda e custos adicionais.'
    :ref.kind==='OUTRA_UNIDADE'
      ?'Existe compra de outra unidade; falta referencia da fazenda que recebeu.'
      :'Sem compra do mesmo codigo e unidade no periodo de 365 dias.';
}
const split=(type)=>{
  const entries=all.filter(r=>r.type===type),own=entries.filter(r=>r.referenceKind==='MESMO_DESTINO'),
    network=entries.filter(r=>r.referenceKind==='OUTRA_UNIDADE'),
    missing=entries.filter(r=>r.referenceKind==='SEM_REFERENCIA');
  const comp=own.filter(r=>r.grossComparisonCents!==null);
  const gross=sum(comp,'grossComparisonCents'),positive=comp.reduce((a,x)=>a+Math.max(0,x.grossComparisonCents),0),
    negative=comp.reduce((a,x)=>a+Math.min(0,x.grossComparisonCents),0);
  return{
    count:entries.length,erpCents:sum(entries,'erpCents'),
    destinationComparisons:own.length,destinationComparedCents:sum(own,'erpCents'),
    referencePurchasesCents:sum(own,'referenceTotalCents'),
    networkProxies:network.length,networkProxyCostCents:sum(network,'erpCents'),
    withoutReference:missing.length,withoutReferenceCostCents:sum(missing,'erpCents'),
    grossComparisonCents:gross,positiveCents:positive,negativeCents:negative,
    positiveLines:comp.filter(x=>x.grossComparisonCents>0).length,
    negativeLines:comp.filter(x=>x.grossComparisonCents<0).length,
    zeroLines:comp.filter(x=>x.grossComparisonCents===0).length,
    validatedCents:null,validatedCount:0,
    confidence:'Indicativo; exigem comprovacao de demanda substituida e logistica'
  };
};
const cdiSummary=split('CDI'),reuseSummary=split('REUSO');
const reporting={
  from:'2026-05-07',purchaseReferenceWindowDays:365,
  purchasesAuditThrough:window.DB_AUDITED_PURCHASE_META?.fim||'29/10/2026',
  purchaseInputRows:purchaseRows.length,
  transferRows:all.length,
  cdi:cdiSummary,reuse:{
    ...reuseSummary,finalUseChuaCents:sum(reuseRows.filter(x=>x.classification==='USO_FINAL_CHUA'),'erpCents'),
    avoidedPurchaseERPProxyCents:reuseCost,
    historicalAvoidedPurchaseCents:sum(reuseRows,'avoidedPurchaseReferenceCents')
  },
  // Valor misto apenas como cenario GERENCIAL, nunca chamar de economia comprovada.
  provisionalManagementCents:reuseCost+cdiSummary.grossComparisonCents,
  validatedCents:null,validatedCount:0,
  unconfirmedAdditionalLogistics:true,unconfirmedAvoidedBuying:true,
  priceEvidence:'Ultima compra anterior no proprio destino, mesmo codigo/unidade, janela de 365 dias, valor total / quantidade',
  networkProxyEvidence:'Consulta apenas; nao compoe a comparacao de preco do CDI',
  excludedD410:true,noDoubleCounting:true
};
if(cdiSummary.count!==cdiRows.length||reuseSummary.count!==reuseRows.length||
  cdiSummary.destinationComparisons+cdiSummary.networkProxies+cdiSummary.withoutReference!==cdiSummary.count||
  reuseSummary.destinationComparisons+reuseSummary.networkProxies+reuseSummary.withoutReference!==reuseSummary.count||
  cdiSummary.positiveCents+cdiSummary.negativeCents!==cdiSummary.grossComparisonCents)
  throw Error('Auditoria economica nao fecha com os documentos');
window.DB_ECONOMY_AUDIT={ready:true,summary:reporting,rows:all,
  purchaseReferenceLines:purchaseRows.length,
  refresh(){return this.summary},
  getRows(){return this.rows.slice()}};
window.dispatchEvent(new CustomEvent('cdi-economy-audit-ready',{detail:reporting}));
})();