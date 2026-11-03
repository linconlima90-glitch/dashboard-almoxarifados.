// Consolidated ERP withdrawal history, 14/03/2024 - 03/11/2026, no transfers.
// 2024 is consultative only; min/max replenishment uses complete 2025 + Jan-Oct 2026.
// This replaces older June-November add-on batches. Never add them a second time.
(function(){
  function install(){
    if(window.__MOVEMENT_COMPLETE_20261103_APPLIED)return true;
    const P=window.MOVEMENTS_COMPLETE_20261103;
    if(!P||!P.dict||!Array.isArray(P.rows)||typeof MOVEMENTS==='undefined'||
       typeof MOVEMENTS_YEARLY==='undefined'||typeof STOCK==='undefined'||
       !window.CURRENT_STOCK_META)return false;
    const n=x=>Number(x)||0;
    const digits=(v,d=2)=>Math.round((Number(v)||0)*Math.pow(10,d))/Math.pow(10,d);
    const key=x=>String(x.codigo_local)+'|'+String(x.codigo);
    const meta=P.meta||{},D=P.dict;
    const completeMonths=22, minMonths=2;
    if(meta.records!==19387||Math.abs(meta.value-1780317.03)>.01||
       meta.sha256!=='e2a6605e7856dcfd558b2222cf1f55c52e54073a886457b97702e6a32f78455f'||
       P.rows.length!==8331||D.month.length!==33||D.product.length!==1447)
      throw Error('Baixas ERP 2024-2026: fonte nao confere');

    const annualActual={'2024':{records:0,cents:0},'2025':{records:0,cents:0},'2026':{records:0,cents:0}};
    const monthActual=new Map(),decoded=[];
    const expectedByYear={'2024':[2298,15107795],'2025':[6220,55201535],'2026':[10869,107722373]};
    const preferredUnit=new Map();
    for(const s of STOCK)if(!preferredUnit.has(key(s)))preferredUnit.set(key(s),String(s.un||''));
    for(const m of MOVEMENTS)if(!preferredUnit.has(key(m)))preferredUnit.set(key(m),String(m.un||''));
    const products=new Map(),mixedUnits=[],monthsByYearKey=new Map(),monthCosts=new Map();
    const monthByNetwork=new Map(),networkUnit=new Map();
    if(typeof CDI_NETWORK_YEARLY!=='undefined')for(const x of CDI_NETWORK_YEARLY)
      if(!networkUnit.has(String(x.k)))networkUnit.set(String(x.k),String(x.un||''));
    const preferredForProduct=new Map();
    for(const [mi,li,fi,pi,ui,qty,cents,records,different] of P.rows){
      const month=D.month[mi],year=String(month||'').slice(0,4),index=Number(String(month).slice(-2))-1;
      const loc=D.local[li],product=D.product[pi],unit=D.unit[ui];
      if(!annualActual[year]||index<0||index>11||!loc||!product||!unit||
         !(Number(qty)>0)||!Number.isInteger(cents)||cents<0||
         !Number.isInteger(records)||records<1||!Number.isInteger(different)||different<0||different>records)
        throw Error('Baixa ERP invalida em '+month);
      const record={year,month,index,empresa:String(D.company[fi]),codigo_local:String(loc[0]),local:String(loc[1]),
        codigo:String(product[0]),produto:String(product[1]),grupo:String(D.group[product[2]]),un:String(unit),
        qtd:Number(qty),cents,records,different};
      decoded.push(record);
      annualActual[year].records+=records;annualActual[year].cents+=cents;
      const stat=monthActual.get(month)||{records:0,cents:0};stat.records+=records;stat.cents+=cents;monthActual.set(month,stat);
      const rk=key(record);
      if(!products.has(rk))products.set(rk,record);
      if(year==='2024')continue; // 2024 must not enter stock minimum at any stage.
      if(!preferredUnit.has(rk))preferredUnit.set(rk,unit);
      const expected=preferredUnit.get(rk);
      if(expected&&expected!==unit){
        mixedUnits.push({mes:month,codigo_local:record.codigo_local,codigo:record.codigo,un:unit,
          qtd:record.qtd,valor:cents/100,records,unidadeEstoque:expected});
        continue; // Do not sum KG into SC, FD or another unit.
      }
      const yrkey=year+'|'+rk,arr=monthsByYearKey.get(yrkey)||Array(12).fill(0);
      arr[index]+=record.qtd;monthsByYearKey.set(yrkey,arr);
      const costMonths=monthCosts.get(yrkey)||Array(12).fill(0);
      costMonths[index]+=cents;monthCosts.set(yrkey,costMonths);
      const netUnit=networkUnit.get(record.codigo)||preferredForProduct.get(record.codigo);
      if(netUnit&&netUnit!==unit)continue;
      preferredForProduct.set(record.codigo,unit);
      const nk=year+'|'+record.codigo,network=monthByNetwork.get(nk)||{months:Array(12).fill(0),cost:Array(12).fill(0),info:record};
      network.months[index]+=record.qtd;network.cost[index]+=cents;monthByNetwork.set(nk,network);
    }
    for(const year of ['2024','2025','2026']){
      const actual=annualActual[year],expect=expectedByYear[year];
      if(actual.records!==expect[0]||actual.cents!==expect[1])
        throw Error('Divergencia no ano '+year+' na fonte ERP');
    }
    if(monthActual.get('2026-10')?.records!==1376||monthActual.get('2026-10')?.cents!==11276930||
       monthActual.get('2026-11')?.records!==63||monthActual.get('2026-11')?.cents!==323789||
       monthActual.get('2025-01')?.records!==336)
      throw Error('Baixas mensais do ERP inconsistentes');

    const stockByKey=new Map(),annual=new Map(),movement=new Map();
    for(const s of STOCK){
      const rk=key(s),found=stockByKey.get(rk)||{qtd:0,custo:0,valor:0,s};
      found.qtd+=n(s.estoque);found.valor+=n(s.valor_estoque);found.custo=n(s.custo_estoque)||found.custo;
      stockByKey.set(rk,found);
    }
    // Replace legacy annual snapshots entirely, including duplicate year/local/product keys.
    MOVEMENTS_YEARLY.length=0;
    if(typeof MINIMUM_YEAR_MAP!=='undefined')MINIMUM_YEAR_MAP.clear();
    for(const m of MOVEMENTS)movement.set(key(m),m);
    // Create year entries for all product/local combinations with documented consumption.
    for(const [yrk,arr] of monthsByYearKey){
      const year=yrk.slice(0,4),rk=yrk.slice(5),sample=products.get(rk),stocks=stockByKey.get(rk),base=movement.get(rk);
      if(!annual.has(yrk)){
        const y={empresa:sample.empresa,codigo_local:sample.codigo_local,local:sample.local,grupo:sample.grupo,
          codigo:sample.codigo,produto:sample.produto,un:preferredUnit.get(rk)||sample.un,year,
          months:Array(12).fill(0),total:0,active_months:0,cost:n(base?.cost)||n(stocks?.custo),value:0};
        MOVEMENTS_YEARLY.push(y);annual.set(yrk,y);
        if(typeof MINIMUM_YEAR_MAP!=='undefined')MINIMUM_YEAR_MAP.set(yrk,y);
      }
      const y=annual.get(yrk);y.months=arr.map(x=>digits(x,4));
      y.total=digits(arr.reduce((a,v)=>a+n(v),0),4);
      y.value=digits((monthCosts.get(yrk)||[]).reduce((a,v)=>a+n(v),0)/100);
      y.active_months=y.months.filter(v=>v>0).length;
      y.quality='ERP CONCILIADO '+year;y.source='BAIXAS ERP HISTORICO INTEGRAL';
      y.un=preferredUnit.get(rk)||y.un;
    }
    // Replace all existing mixed legacy monthly totals; do not add new source to old months.
    for(const [rk,sample] of products){
      if(!monthsByYearKey.has('2025|'+rk)&&!monthsByYearKey.has('2026|'+rk))continue;
      if(movement.has(rk))continue;
      const stock=stockByKey.get(rk),unit=preferredUnit.get(rk)||sample.un;
      const m={empresa:stock?.s?.empresa||sample.empresa,codigo_local:sample.codigo_local,local:sample.local,
        grupo:sample.grupo,codigo:sample.codigo,produto:sample.produto,un:unit,
        months:Array(12).fill(0),total:0,complete_total:0,complete_months:completeMonths,avg:0,
        minimum:0,stock:n(stock?.qtd),cost:n(stock?.custo),stock_value:n(stock?.valor),coverage:null,
        need:0,need_value:0,excess:0,active_month_buckets:0,consumption_value:0,
        status:'SEM DADOS DE BAIXA',source:'BAIXAS ERP · 2025-2026',unit_source:'ESTOQUE ATUAL',
        cost_source:'CUSTO MEDIO DO ESTOQUE LOCAL'};
      MOVEMENTS.push(m);movement.set(rk,m);
    }
    if(typeof MOVEMENT_YEAR_PENDING!=='undefined'&&Array.isArray(MOVEMENT_YEAR_PENDING))
      MOVEMENT_YEAR_PENDING.length=0;
    if(typeof MINIMUM_YEAR_PENDING_KEYS!=='undefined'&&MINIMUM_YEAR_PENDING_KEYS?.clear)
      MINIMUM_YEAR_PENDING_KEYS.clear();
    const roundUp=(v,un)=>{
      if(!(v>0))return 0;
      if(typeof minimumRoundUp==='function')return minimumRoundUp(v,un);
      return ['KG','LT','ML','MT','M2','M3','CM','GR'].includes(String(un||'').toUpperCase())?
        Math.ceil((v-1e-10)*100)/100:Math.ceil(v-1e-10);
    };
    for(const m of MOVEMENTS){
      const rk=key(m),y25=annual.get('2025|'+rk),y26=annual.get('2026|'+rk),s=stockByKey.get(rk);
      const a25=y25?.months||Array(12).fill(0),a26=y26?.months||Array(12).fill(0);
      m.months=Array.from({length:12},(_,i)=>digits(n(a25[i])+n(a26[i]),4));
      m.total=digits(m.months.reduce((v,x)=>v+n(x),0),4);
      m.complete_total=digits(a25.reduce((v,x)=>v+n(x),0)+a26.slice(0,10).reduce((v,x)=>v+n(x),0),4);
      m.complete_months=completeMonths;m.avg=m.complete_total/completeMonths;
      m.stock=n(s?.qtd);m.stock_value=n(s?.valor);m.cost=s&&s.qtd>0?s.valor/s.qtd:n(s?.custo)||n(m.cost);
      m.minimum=roundUp(m.avg*minMonths,m.un);
      m.need=roundUp(Math.max(0,m.minimum-m.stock),m.un);
      m.need_value=m.need*n(m.cost);m.excess=Math.max(0,m.stock-m.minimum);
      m.coverage=m.avg>0?m.stock/m.avg:null;
      m.active_month_buckets=m.months.filter(x=>x>0).length;
      m.consumption_value=deltasum(year=>annual.get(year+'|'+rk)?.value,['2025','2026']);
      m.status=m.avg>0?(m.stock<=0?'SEM ESTOQUE':m.stock<m.minimum?'ABAIXO DO MÍNIMO':m.stock<m.minimum*1.25?'ATENÇÃO':'OK'):'SEM DADOS DE BAIXA';
      m.source='BAIXAS ERP CONCILIADAS · 2025/2026 (2024 FORA DO MINIMO)';
      m.reconciliacao_pendente=false;
      const costs26=monthCosts.get('2026|'+rk)||[];
      m.qtd_set_20261015=n(a26[9]);m.valor_set_20261015=n(costs26[9])/100;
      m.qtd_set_202609=n(a26[8]);m.valor_set_202609=n(costs26[8])/100;
    }
    function deltasum(fn,years){return digits(years.reduce((sum,y)=>sum+n(fn(y)),0));}
    if(typeof CDI_NETWORK_YEARLY!=='undefined'&&typeof CDI_NETWORK_YEAR_MAP!=='undefined'&&
       typeof CDI_NETWORK_ALL_MAP!=='undefined'){
      const byYear=new Map();
      // Replace stale network annual rows; the ERP is now the single authoritative history.
      CDI_NETWORK_YEARLY.length=0;
      CDI_NETWORK_YEAR_MAP.clear();
      for(const [nk,group] of monthByNetwork){
        let y=byYear.get(nk);
        if(!y){
          const i=group.info;
          y={k:String(i.codigo),year:String(i.year),produto:i.produto,grupo:i.grupo,un:i.un,
            months:Array(12).fill(0),total:0,legacy_complete_total:0};
          CDI_NETWORK_YEARLY.push(y);CDI_NETWORK_YEAR_MAP.set(nk,y);byYear.set(nk,y);
        }
        y.months=group.months.map(x=>digits(x,4));
        y.total=digits(y.months.reduce((sum,q)=>sum+n(q),0),4);
        y.legacy_complete_total=String(y.year)==='2026'?digits(y.months.slice(0,10).reduce((sum,q)=>sum+n(q),0),4):y.total;
        y.quality='ERP CONCILIADO 2025-2026';
      }
      CDI_NETWORK_ALL_MAP.clear();
      for(const y of CDI_NETWORK_YEARLY){
        if(!['2025','2026'].includes(String(y.year)))continue;
        const code=String(y.k);let t=CDI_NETWORK_ALL_MAP.get(code);
        if(!t){t={codigo:code,produto:y.produto,grupo:y.grupo,un:y.un,months:Array(12).fill(0),total:0,complete_total:0};
          CDI_NETWORK_ALL_MAP.set(code,t)}
        for(let i=0;i<12;i++)t.months[i]+=n(y.months?.[i]);
        t.total+=n(y.total);t.complete_total+=n(y.legacy_complete_total);
      }
    }
    window.MOVEMENTS_OCTOBER_META={from:'01/10/2026',to:'31/10/2026',records:1376,value:112769.30};
    window.MOVEMENTS_NOVEMBER_META={from:'01/11/2026',to:'03/11/2026',records:63,value:3237.89,partial:true};
    window.MOVEMENTS_2024_META={from:'14/03/2024',to:'31/12/2024',records:2298,value:151077.95,forMinimum:false};
    window.MOVEMENTS_REVISED_META={from:meta.from,to:meta.to,records:meta.records,value:meta.value,
      years:meta.years,months:meta.months,monthlyRows:P.rows.length,sourceFile:meta.sourceFile,sourceSHA256:meta.sha256,
      costField:meta.costField,forMinimum:{from:'01/01/2025',years:[2025,2026],through:'31/10/2026',
        months:22,partialMonthExcluded:'2026-11',minMonths:2,records:17026},
      excludedMinimumYear:2024,completedThrough:'31/10/2026',openMonth:'2026-11',
      replacedOldOctober:true,reconciliation:'ERP INTEGRAL 2024-2026 · SUBSTITUI HISTORICO ANTERIOR',
      snapshot:true,mixedUnits,pendingHistoricalKeys:0,statusDifferent:(meta.status?.DIFERENTE??null)};
    for(const s of STOCK){const m=movement.get(key(s));
      s.qtd_baixada=n(m?.total);s.media_mensal=n(m?.avg);s.cobertura=s.media_mensal>0?n(s.estoque)/s.media_mensal:null;
      s.status_consumo=s.qtd_baixada>0?'COM BAIXA NO PERIODO':'SEM BAIXA EM 2025/2026';
    }
    window.__MOVEMENT_COMPLETE_20261103_APPLIED=true;
    const summary=document.querySelector('#view-baixas');
    if(summary&&!document.getElementById('baixas-snapshot-2024-2026')){
      const box=document.createElement('div');box.id='baixas-snapshot-2024-2026';
      box.style.cssText='background:#f5f9f6;border:1px solid #cfe3d3;border-left:4px solid #1e8747;padding:12px 15px;border-radius:10px;color:#214e32;font-size:12px;margin:10px 0 14px;line-height:1.65';
      box.innerHTML='<b>Baixas ERP detalhadas: 14/03/2024 a 03/11/2026</b> · 19.387 lancamentos · <b>R$ 1.780.317,03</b>.'+
        '<div style="color:#657366;font-size:11px">2024: 2.298 lancamentos, R$ 151.077,95 (apenas consulta; nao entra na media). 2025: 6.220, R$ 552.015,35. 2026 ate 03/11: 10.869, R$ 1.077.223,73. Consumo para minimo de 2 meses: janeiro/2025 a outubro/2026, 22 meses completos; novembro parcial nao entra na media. Dados do ERP substituem as fotografias anteriores sem duplicacao. Estoque fisico atualizado em 03/11/2026 15:58:21.</div>';
      summary.prepend(box);
    }
    try{if(typeof render==='function')render()}catch(e){console.warn('Histórico ERP: render',e)}
    window.dispatchEvent(new CustomEvent('movements-updated',{detail:window.MOVEMENTS_REVISED_META}));
    return true;
  }
  window.addEventListener('stock-position-updated',install);
  install();
})();