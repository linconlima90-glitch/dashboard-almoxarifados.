// Pure managerial allocation. It attributes a previously recorded purchase
// comparison to uses; it never creates additional savings or an ERP transfer value.
const SCALE=1_000_000;
const ELIGIBLE=new Set(['DISTRIBUICAO','CONSUMO_CHUA']);
const TYPES=new Set(['DISTRIBUICAO','CONSUMO_CHUA','CONSUMO_COMPARTILHADO',
  'CONSUMO_OUTROS','CONSUMO_NAO_IDENTIFICADO','PERDA_D410']);
const fail=message=>{throw new Error('CDI allocation: '+message);};
const assert=(condition,message)=>{if(!condition)fail(message);};
const text=value=>String(value??'');
const cents=(value,label,nullable=false)=>{
  if(nullable&&value==null)return null;
  assert(Number.isSafeInteger(value),label+' must be integer cents');
  return value;
};
const units=(value,label)=>{
  assert(Number.isFinite(value)&&value>0,label+' must be positive');
  const result=Math.round(value*SCALE);
  assert(Number.isSafeInteger(result)&&Math.abs(result/SCALE-value)<1e-9,label+' exceeds supported quantity precision');
  return result;
};
const quantity=value=>value/SCALE;
const sku=row=>text(row.code)+'|'+text(row.unit).trim().toUpperCase();
const receipt=status=>{
  const normalized=text(status).normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim().toUpperCase();
  if(normalized==='LANC.RECEB.')return 'received';
  if(normalized==='NAO LANC.RECEB.')return 'pending';
  return 'unknown';
};
const numericText=(a,b)=>{
  if(a==null)return b==null?0:1;
  if(b==null)return -1;
  const x=text(a),y=text(b);
  if(/^\d+$/.test(x)&&/^\d+$/.test(y)){
    const nx=x.replace(/^0+(?=\d)/,''),ny=y.replace(/^0+(?=\d)/,'');
    return nx.length-ny.length||(nx<ny?-1:nx>ny?1:0);
  }
  return x<y?-1:x>y?1:0;
};
const order=(a,b)=>text(a.date).localeCompare(text(b.date))||numericText(a.doc,b.doc)||
  numericText(a.seq,b.seq)||text(a.id).localeCompare(text(b.id));
// Exact equivalent of Math.round(cents*cumulativeQuantity/lotQuantity), including
// negative half-cent ties. Cumulative rounding conserves every lot's cents.
function prorata(value,numerator,denominator){
  const a=2n*BigInt(value)*BigInt(numerator)+BigInt(denominator);
  const b=2n*BigInt(denominator);
  let result=a/b;
  if(a<0n&&a%b!==0n)result--;
  const number=Number(result);
  assert(Number.isSafeInteger(number),'monetary allocation exceeds safe range');
  return number;
}
const portion=(value,before,after,total)=>value==null?null:
  prorata(value,after,total)-prorata(value,before,total);
const sum=(rows,field)=>rows.reduce((total,row)=>total+(row[field]??0),0);
const date=value=>assert(/^\d{4}-\d{2}-\d{2}$/.test(text(value)),'invalid ISO date '+value);

/**
 * Input: {meta,purchases:[{id,date,doc,seq,code,unit,qty,totalCents,status,local}],
 * comparison:[{purchaseId,code,unit,qty,totalCents,referenceMicro,netCents,
 * favorableCents,unfavorableCents}],events:[{id,type,date,doc,seq,code,unit,qty,
 * amountERPCents,originLocal,destinationCode,destinationName}]}.
 *
 * Both modes are hypotheses, not physical lot traceability. `all` additionally
 * allows invoices with receipt pending. Same-day invoices are flagged because
 * the sources contain no receiving time. No opening balance is invented.
 * An unmatched outflow remains unmatched; a later purchase never fills it.
 *
 * allocatedNetCents is a portion of the existing approved comparison. Excluded
 * event types reserve that portion but benefitEligible=false, so they never
 * increase the utilization benefit. The purchase headline stays unchanged.
 */
export function allocateCdi(input,options={}){
  const receiptMode=options.receiptMode??'all';
  const allowSameDayPurchases=options.allowSameDayPurchases??true;
  assert(['all','received'].includes(receiptMode),'unsupported receipt mode');
  const projectFrom=input.meta?.projectFrom??'2026-05-07';
  date(projectFrom);
  assert(Array.isArray(input.purchases)&&Array.isArray(input.comparison)&&Array.isArray(input.events),'input arrays missing');
  const purchaseIds=new Set(),comparisonIds=new Set(),eventIds=new Set();
  const comparisons=new Map();
  for(const c of input.comparison){
    assert(c.purchaseId&&!comparisonIds.has(c.purchaseId),'duplicate comparison '+c.purchaseId);
    comparisonIds.add(c.purchaseId);
    cents(c.totalCents,'comparison total');
    assert(c.totalCents>=0,'negative comparison purchase total');
    cents(c.netCents,'comparison net',true);
    cents(c.favorableCents,'comparison favorable',true);
    cents(c.unfavorableCents,'comparison unfavorable',true);
    assert((c.favorableCents??0)>=0&&(c.unfavorableCents??0)<=0,'comparison sign invalid');
    assert((c.netCents??0)===(c.favorableCents??0)+(c.unfavorableCents??0),'comparison signs do not reconcile');
    if(c.referenceMicro==null||c.referenceMicro<=0)
      assert((c.netCents??0)===0,'nonzero comparison has no approved reference');
    comparisons.set(c.purchaseId,c);
  }
  const lots=input.purchases.map(source=>{
    const p={...source};
    assert(p.id&&!purchaseIds.has(p.id),'duplicate purchase '+p.id);purchaseIds.add(p.id);
    date(p.date);assert(p.date>=projectFrom,'purchase before project '+p.id);
    assert(text(p.local)==='30115','purchase outside 30115 '+p.id);
    assert(p.code&&p.unit&&p.doc&&p.seq!=null,'purchase identity incomplete '+p.id);
    cents(p.totalCents,'purchase total');assert(p.totalCents>=0,'negative purchase total');
    const totalUnits=units(p.qty,'purchase quantity'),c=comparisons.get(p.id)??null;
    if(c){
      assert(sku(c)===sku(p)&&units(c.qty,'comparison quantity')===totalUnits,'comparison SKU/quantity differs '+p.id);
      assert(receipt(c.status)===receipt(p.status),'comparison receipt status differs '+p.id);
    }
    const state=receipt(p.status);
    const referenceKnown=!!c&&c.referenceMicro>0&&c.netCents!=null;
    return {p,c,totalUnits,usedUnits:0,receipt:state,referenceKnown,
      available:receiptMode==='all'||state==='received',allocations:[]};
  }).sort((a,b)=>order(a.p,b.p));
  assert([...comparisonIds].every(id=>purchaseIds.has(id)),'comparison purchase missing from physical input');
  const bySku=new Map();
  for(const lot of lots){const key=sku(lot.p);if(!bySku.has(key))bySku.set(key,[]);bySku.get(key).push(lot);}
  const eventSources=input.events.map(source=>{
    const e={...source};
    assert(e.id&&!eventIds.has(e.id),'duplicate event '+e.id);eventIds.add(e.id);
    date(e.date);assert(e.date>=projectFrom,'event before project '+e.id);
    assert(text(e.originLocal)==='30115','event outside origin30115 '+e.id);
    assert(TYPES.has(e.type),'unknown event type '+e.type);
    assert(e.code&&e.unit&&e.doc,'event identity incomplete '+e.id);
    units(e.qty,'event quantity');cents(e.amountERPCents,'event ERP value',true);
    assert(e.amountERPCents==null||e.amountERPCents>=0,'negative ERP event value');
    if(text(e.destinationCode)==='10551')assert(e.type==='PERDA_D410','D410 must be excluded as loss');
    if(e.usageCenterKnown===false)assert(e.type==='CONSUMO_NAO_IDENTIFICADO','unknown center cannot be own-farm use');
    return e;
  }).sort(order);
  const rows=eventSources.map(e=>{
    const totalUnits=units(e.qty,'event quantity');let remaining=totalUnits;
    const links=[];
    for(const lot of bySku.get(sku(e))??[]){
      if(!remaining)break;
      if(!lot.available||lot.usedUnits===lot.totalUnits)continue;
      if(lot.p.date>e.date||(!allowSameDayPurchases&&lot.p.date===e.date))continue;
      const take=Math.min(remaining,lot.totalUnits-lot.usedUnits),before=lot.usedUnits,after=before+take;
      const hasReference=lot.referenceKnown;
      const link={purchaseId:lot.p.id,doc:lot.p.doc,seq:lot.p.seq,invoice:lot.p.invoice,
        date:lot.p.date,status:lot.p.status,receipt:lot.receipt,qty:quantity(take),
        sameDay:lot.p.date===e.date,code:lot.p.code,unit:lot.p.unit,
        totalPurchaseQty:lot.p.qty,purchaseTotalCents:lot.p.totalCents,
        comparisonPurchaseTotalCents:lot.c?.totalCents??null,
        allocatedCostCents:portion(lot.p.totalCents,before,after,lot.totalUnits),
        allocatedComparisonCostCents:lot.c?portion(lot.c.totalCents,before,after,lot.totalUnits):null,
        approvedReferencePrice:hasReference?lot.c.referenceMicro/1_000_000:null,
        approvedReferenceMicro:hasReference?lot.c.referenceMicro:null,
        referenceDate:lot.c?.referenceDate??null,referenceSourceRow:lot.c?.referenceSourceRow??null,
        comparisonAvailable:hasReference,
        comparisonScope:lot.c?'APPROVED_COMPARISON':'OUTSIDE_APPROVED_COMPARISON',
        comparisonUnavailableReason:hasReference?null:lot.c?
          'REFERENCIA_INDISPONIVEL_NA_BASE_DO_COMPARATIVO':'COMPRA_FORA_DO_COMPARATIVO_APROVADO',
        allocatedNetCents:hasReference?portion(lot.c.netCents,before,after,lot.totalUnits):null,
        allocatedFavorableCents:hasReference?portion(lot.c.favorableCents,before,after,lot.totalUnits):null,
        allocatedUnfavorableCents:hasReference?portion(lot.c.unfavorableCents,before,after,lot.totalUnits):null,
        costSourceConflict:!!lot.p.costSourceConflict,
        comparisonCostDiffers:!!lot.c&&lot.c.totalCents!==lot.p.totalCents};
      links.push(link);lot.allocations.push({eventId:e.id,type:e.type,...link});
      lot.usedUnits=after;remaining-=take;
    }
    const refLinks=links.filter(l=>l.comparisonAvailable);
    const referencePrices=[...new Set(refLinks.map(l=>l.approvedReferencePrice))];
    const qsum=(predicate=()=>true)=>links.filter(predicate).reduce((n,l)=>n+Math.round(l.qty*SCALE),0)/SCALE;
    const split=kind=>sum(refLinks.filter(l=>l.receipt===kind),'allocatedNetCents');
    return {...e,benefitEligible:ELIGIBLE.has(e.type),
      matchedQty:quantity(totalUnits-remaining),unmatchedQty:quantity(remaining),referenceQty:qsum(l=>l.comparisonAvailable),
      matchedWithoutReferenceQty:qsum(l=>!l.comparisonAvailable),receivedQty:qsum(l=>l.receipt==='received'),
      pendingQty:qsum(l=>l.receipt==='pending'),unknownReceiptQty:qsum(l=>l.receipt==='unknown'),sameDayQty:qsum(l=>l.sameDay),
      allocatedCostCents:sum(links,'allocatedCostCents'),
      allocatedComparisonCostCents:links.some(l=>l.allocatedComparisonCostCents!=null)?sum(links,'allocatedComparisonCostCents'):null,
      allocatedNetCents:refLinks.length?sum(refLinks,'allocatedNetCents'):null,
      allocatedFavorableCents:refLinks.length?sum(refLinks,'allocatedFavorableCents'):null,
      allocatedUnfavorableCents:refLinks.length?sum(refLinks,'allocatedUnfavorableCents'):null,
      receivedNetCents:split('received'),pendingNetCents:split('pending'),unknownReceiptNetCents:split('unknown'),
      receivedCostCents:sum(links.filter(l=>l.receipt==='received'),'allocatedCostCents'),
      pendingCostCents:sum(links.filter(l=>l.receipt==='pending'),'allocatedCostCents'),
      approvedReferencePrice:referencePrices.length===1?referencePrices[0]:null,
      approvedReferencePrices:referencePrices,comparisonCostDiffers:links.some(l=>l.comparisonCostDiffers),links};
  });
  const categories={};
  for(const type of TYPES){
    const list=rows.filter(r=>r.type===type);if(!list.length)continue;
    const byUnit={};
    for(const r of list){
      const u=byUnit[r.unit]??={qty:0,matchedQty:0,unmatchedQty:0,referenceQty:0,receivedQty:0,pendingQty:0,sameDayQty:0};
      for(const key of Object.keys(u))u[key]=Math.round((u[key]+r[key])*SCALE)/SCALE;
    }
    categories[type]={events:list.length,benefitEligible:ELIGIBLE.has(type),
      knownERPEvents:list.filter(r=>r.amountERPCents!=null).length,
      missingERPEvents:list.filter(r=>r.amountERPCents==null).length,
      amountERPCents:sum(list,'amountERPCents'),erpAmountComplete:list.every(r=>r.amountERPCents!=null),
      matchedEvents:list.filter(r=>r.matchedQty>0).length,
      fullyMatchedEvents:list.filter(r=>r.unmatchedQty===0).length,
      partlyMatchedEvents:list.filter(r=>r.matchedQty>0&&r.unmatchedQty>0).length,
      unmatchedEvents:list.filter(r=>r.matchedQty===0).length,
      referenceEvents:list.filter(r=>r.referenceQty>0).length,
      fullyReferencedEvents:list.filter(r=>r.referenceQty===r.qty).length,
      allocatedCostCents:sum(list,'allocatedCostCents'),
      allocatedComparisonCostCents:sum(list,'allocatedComparisonCostCents'),
      allocatedNetCents:sum(list,'allocatedNetCents'),
      allocatedFavorableCents:sum(list,'allocatedFavorableCents'),
      allocatedUnfavorableCents:sum(list,'allocatedUnfavorableCents'),
      receivedNetCents:sum(list,'receivedNetCents'),pendingNetCents:sum(list,'pendingNetCents'),
      unknownReceiptNetCents:sum(list,'unknownReceiptNetCents'),
      receivedCostCents:sum(list,'receivedCostCents'),pendingCostCents:sum(list,'pendingCostCents'),
      sameDayEvents:list.filter(r=>r.sameDayQty>0).length,
      pendingEvents:list.filter(r=>r.pendingQty>0).length,
      receivedEvents:list.filter(r=>r.receivedQty>0).length,byUnit};
  }
  const purchaseBalances=lots.map(lot=>{
    const allocatedCostCents=sum(lot.allocations,'allocatedCostCents');
    const allocatedNetCents=sum(lot.allocations,'allocatedNetCents');
    const allocatedFavorableCents=sum(lot.allocations,'allocatedFavorableCents');
    const allocatedUnfavorableCents=sum(lot.allocations,'allocatedUnfavorableCents');
    const net=lot.c?.netCents??0;
    const result={purchaseId:lot.p.id,doc:lot.p.doc,seq:lot.p.seq,date:lot.p.date,code:lot.p.code,unit:lot.p.unit,
      status:lot.p.status,receipt:lot.receipt,qty:lot.p.qty,allocatedQty:quantity(lot.usedUnits),residualQty:quantity(lot.totalUnits-lot.usedUnits),
      availableInScenario:lot.available,totalCents:lot.p.totalCents,allocatedCostCents,residualCostCents:lot.p.totalCents-allocatedCostCents,
      inApprovedComparison:!!lot.c,referenceAvailable:lot.referenceKnown,
      comparisonTotalCents:lot.c?.totalCents??null,netCents:lot.c?.netCents??null,
      allocatedNetCents,residualNetCents:net-allocatedNetCents,
      favorableCents:lot.c?.favorableCents??null,unfavorableCents:lot.c?.unfavorableCents??null,
      allocatedFavorableCents,residualFavorableCents:(lot.c?.favorableCents??0)-allocatedFavorableCents,
      allocatedUnfavorableCents,residualUnfavorableCents:(lot.c?.unfavorableCents??0)-allocatedUnfavorableCents,
      eventIds:lot.allocations.map(a=>a.eventId)};
    assert(lot.usedUnits<=lot.totalUnits,'purchase overallocated '+lot.p.id);
    if(lot.usedUnits===lot.totalUnits){
      assert(result.residualCostCents===0,'fully allocated purchase cost not conserved');
      assert(result.residualNetCents===0,'fully allocated comparison not conserved');
    }
    return result;
  });
  const gainBalances=purchaseBalances.filter(p=>p.inApprovedComparison);
  const gainFor=list=>({rows:list.length,netCents:sum(list,'netCents'),
    allocatedNetCents:sum(list,'allocatedNetCents'),residualNetCents:sum(list,'residualNetCents'),
    favorableCents:sum(list,'favorableCents'),unfavorableCents:sum(list,'unfavorableCents')});
  const purchaseGain={...gainFor(gainBalances),referenceRows:gainBalances.filter(p=>p.referenceAvailable).length,
    missingReferenceRows:gainBalances.filter(p=>!p.referenceAvailable).length,
    eligibleAllocatedNetCents:sum(rows.filter(r=>r.benefitEligible),'allocatedNetCents'),
    excludedReservedNetCents:sum(rows.filter(r=>!r.benefitEligible),'allocatedNetCents'),
    received:gainFor(gainBalances.filter(p=>p.receipt==='received')),
    pending:gainFor(gainBalances.filter(p=>p.receipt==='pending')),
    unknown:gainFor(gainBalances.filter(p=>p.receipt==='unknown'))};
  assert(purchaseGain.allocatedNetCents===sum(rows,'allocatedNetCents'),'event/purchase allocations do not reconcile');
  assert(purchaseGain.netCents===purchaseGain.allocatedNetCents+purchaseGain.residualNetCents,'comparison not conserved');
  assert(purchaseGain.netCents===purchaseGain.eligibleAllocatedNetCents+
    purchaseGain.excludedReservedNetCents+purchaseGain.residualNetCents,'eligible/excluded/residual do not reconcile');
  if(input.meta?.allPurchaseComparison?.cdiNetCents!=null)
    assert(purchaseGain.netCents===input.meta.allPurchaseComparison.cdiNetCents,'approved CDI headline changed');
  const purchasesCdi={lines:lots.length,totalCents:sum(input.purchases,'totalCents'),
    allocatedCostCents:sum(purchaseBalances,'allocatedCostCents'),residualCostCents:sum(purchaseBalances,'residualCostCents'),
    from:lots[0]?.p.date??null,to:lots.at(-1)?.p.date??null,
    distinctSkuUnits:new Set(lots.map(l=>sku(l.p))).size,
    receivingStatus:Object.fromEntries(['received','pending','unknown'].map(kind=>[kind,{
      lines:lots.filter(l=>l.receipt===kind).length,totalCents:sum(lots.filter(l=>l.receipt===kind).map(l=>l.p),'totalCents')}]))};
  return {v:2,updated:input.meta?.generatedFor??null,
    meta:{...input.meta,receiptMode,allowSameDayPurchases,
      method:'FIFO estimado por data, NUNOTA, sequência e ID; produto e unidade exatos; arredondamento acumulado por lote',
      financialSavingsCertified:false,physicalLotTraceability:false,
      noAdditionalSavings:true,sameDayPurchasesAreAssumed:allowSameDayPurchases,
      costBasis:'Custo atribuído das compras; não é valor ERP da transferência',
      comparisonBasis:'Parcela do comparativo aprovado já reconhecido na compra; não somar ao total',
      receiptBasis:'Status atual de lançamento do recebimento; não comprova data ou hora de entrada física'},
    rows,categories,purchasesCdi,purchaseGain,purchaseBalances};
}
