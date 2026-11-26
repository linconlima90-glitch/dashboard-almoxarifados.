// Visao unica: estoque minimo e maximo pela mesma base ERP (2025-2026).
(function(){
  'use strict';
  if(window.DB_STOCK_UNIFIED)return;
  const config={months:4,year:'',mode:'all',local:'',group:'',query:'',tableStatus:'all',tableSort:'value'};
  const n=v=>Number(v)||0;
  const str=v=>String(v??'');
  const norm=v=>str(v).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toUpperCase();
  // Granjas fora do escopo atual de controle, sem alterar o historico do ERP.
  const outOfScopeLocal=v=>{
    const local=norm(v).replace(/\s+/g,' ').trim();
    return local==='ALMOXARIFADO GERAL G GERIBA'||local==='ALMOXARIFADO GERAL G S CRUZ';
  };
  const esc=v=>str(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  // Reusar formatadores: a lista de 4 mil posicoes nao precisa criar um
  // Intl.NumberFormat novo para cada valor exibido.
  const moneyFormatter=new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'});
  const qtyFormatter=new Intl.NumberFormat('pt-BR',{maximumFractionDigits:2});
  const intFormatter=new Intl.NumberFormat('pt-BR',{maximumFractionDigits:0});
  const brl=v=>moneyFormatter.format(n(v));
  const qty=v=>qtyFormatter.format(n(v));
  const int=v=>intFormatter.format(n(v));
  const units=new Set(['KG','LT','ML','MT','M2','M3','CM','GR']);
  const virtual=x=>x?.network_scope===true||norm(x?.local)==='CDI DE PECAS CHUA';
  const exclude=x=>typeof window.DB_MINIMUM_EXCLUDED==='function'
    ?window.DB_MINIMUM_EXCLUDED(x):/\b(PNEUS?|CAMARAS?|CIMENTOS?)\b/.test(norm(x.grupo)+' '+norm(x.produto));
  const key=x=>str(x.codigo_local)+'|'+str(x.codigo);
  const rowKey=x=>str(x.local)+'|'+str(x.codigo)+'|'+norm(x.un);
  const matchKey=x=>str(x.codigo)+'|'+norm(x.un);
  const ceil=(v,un)=>{
    const value=Math.max(0,n(v));
    if(typeof minimumRoundUp==='function')return minimumRoundUp(value,un);
    return units.has(norm(un))?Math.ceil((value-1e-10)*100)/100:Math.ceil(value-1e-10);
  };
  const remaining=(v,un)=>units.has(norm(un))?Math.round(v*100)/100:Math.round(v);
  const activityYears=y=>!config.year||config.year===y;

  function activeMonths(){
    const locals=new Map(),network=new Map();
    // Quantidades de baixa por codigo/unidade, sem misturar medidas diferentes.
    const localQty=new Map(),networkQty=new Map();
    const mix=new Set((window.MOVEMENTS_REVISED_META?.mixedUnits||[]).map(key));
    function scan(list,dest,amounts,isNetwork){
      if(!Array.isArray(list))return;
      for(const x of list){
        const year=str(x.year);
        if(!['2025','2026'].includes(year)||!activityYears(year))continue;
        const k=isNetwork?str(x.k??x.codigo):key(x);
        if(!k||k==='undefined|undefined')continue;
        const seen=dest.get(k)||new Set();
        const end=year==='2026'?10:12;
        let withdrawn=0;
        for(let i=0;i<end;i++){
          const value=n(x.months?.[i]);
          withdrawn+=value;
          if(value>0)seen.add(year+'-'+i);
        }
        dest.set(k,seen);
        // Deduplicacao de unidade: mesmo codigo pode ter registros em UN, KG, LT etc.
        if(withdrawn){
          const un=norm(x.un)||'UN NÃO INFORMADA';
          const byUnit=amounts.get(k)||new Map();
          byUnit.set(un,(byUnit.get(un)||0)+withdrawn);
          amounts.set(k,byUnit);
        }
      }
    }
    scan(typeof MOVEMENTS_YEARLY==='undefined'?[]:MOVEMENTS_YEARLY,locals,localQty,false);
    scan(typeof CDI_NETWORK_YEARLY==='undefined'?[]:CDI_NETWORK_YEARLY,network,networkQty,true);
    return {locals,network,mix,localQty,networkQty};
  }

  function stockPositions(){
    const positions=new Map();
    if(typeof STOCK==='undefined'||!Array.isArray(STOCK))return positions;
    for(const s of STOCK){
      if(exclude(s)||outOfScopeLocal(s.local)||!str(s.local)||!str(s.codigo))continue;
      const k=rowKey(s),old=positions.get(k)||{
        local:str(s.local),codigo_local:str(s.codigo_local),grupo:str(s.grupo||'SEM GRUPO'),
        codigo:str(s.codigo),produto:str(s.produto),un:str(s.un),stock:0,value:0,cost:0
      };
      old.stock+=n(s.estoque);
      old.value+=n(s.valor_estoque);
      if(n(s.custo_estoque)>0)old.cost=n(s.custo_estoque);
      positions.set(k,old);
    }
    for(const s of positions.values())if(s.stock>0&&s.value>0)s.cost=s.value/s.stock;
    return positions;
  }

  function items(){
    const snapshots=stockPositions(),activity=activeMonths();
    const raw=typeof minimumBaseRows==='function'?minimumBaseRows():(
      typeof MOVEMENTS==='undefined'?[]:MOVEMENTS);
    const base=(Array.isArray(raw)?raw:[]).filter(x=>!exclude(x));
    const chosen=config.year&&typeof minimumRowsForYear==='function'
      ?minimumRowsForYear(base,config.year):base;
    const result=new Map(),assignedWithdrawals=new Set();
    function push(x){
      if(!x||!str(x.codigo)||!str(x.local)||outOfScopeLocal(x.local))return;
      const vk=virtual(x),k=rowKey(x),stock=snapshots.get(k);
      if(result.has(k))return;
      const sourceKey=(vk?'REDE|':'LOCAL|')+(vk?str(x.codigo):key(x));
      const avg=Math.max(0,n(x.avg));
      const minimum=Math.max(0,n(x.minimum)||ceil(avg*2,x.un));
      const balance=vk?n(x.stock):(stock?stock.stock:n(x.stock));
      const cost=vk?n(x.cost):(stock?.cost||Math.max(0,n(x.cost)));
      const months=vk?activity.network.get(str(x.codigo)):activity.locals.get(key(x));
      const perUnit=vk?activity.networkQty.get(str(x.codigo)):activity.localQty.get(key(x));
      const withdrawals=!assignedWithdrawals.has(sourceKey)&&perUnit?
        [...perUnit.entries()].map(([un,value])=>({un,value})).filter(x=>Math.abs(x.value)>1e-9):[];
      // Se o ERP listar o mesmo codigo/local em mais de uma unidade, mostrar as
      // quantidades por unidade em uma unica linha para nao duplicar o total.
      if(withdrawals.length)assignedWithdrawals.add(sourceKey);
      const count=months?.size??Math.max(0,n(x.active_month_buckets));
      const mixed=!vk&&activity.mix.has(key(x));
      // Menos de 3 meses com baixas: saldo classificado como excedente
      // PROVISORIO, sem gerar pedido ou transferencia automatica.
      const historyInsufficient=!(avg>0&&n(x.total)>0&&count>=3);
      const reliable=!historyInsufficient&&!mixed;
      const provisionalExcess=!vk&&historyInsufficient&&balance>0;
      const maximum=reliable?ceil(avg*config.months,x.un):null;
      const need=historyInsufficient||mixed?0:ceil(Math.max(0,minimum-balance),x.un);
      const excess=provisionalExcess?Math.max(0,remaining(balance,x.un)):
        reliable&&balance>maximum?Math.max(0,remaining(balance-maximum,x.un)):0;
      const condition=provisionalExcess?'EXCEDENTE SEM HISTÓRICO':
        need>0?'REPOR':excess>0?'ACIMA DO MÁXIMO':
        !reliable?'REVISAR HISTÓRICO':(balance<minimum*1.25?'ATENÇÃO':'DENTRO DA FAIXA');
      const item={
        local:str(x.local),codigo_local:str(x.codigo_local),grupo:str(x.grupo||'SEM GRUPO'),
        codigo:str(x.codigo),produto:str(x.produto),un:str(x.un),
        avg,minimum,stock:balance,maximum,need,excess,cost,
        purchaseValue:need*cost,excessValue:excess*cost,condition,reliable,
        historyInsufficient,provisionalExcess,
        active:count,withdrawals,hasCost:cost>0,network:vk,mixed,transfer:[]
      };
      result.set(k,item);
    }
    for(const x of Array.isArray(chosen)?chosen:[])push(x);
    // Posicoes sem baixa entram no excedente a revisar, sem inventar teto de consumo.
    for(const [k,s] of snapshots){
      if(result.has(k))continue;
      push({local:s.local,codigo_local:s.codigo_local,codigo:s.codigo,produto:s.produto,
        grupo:s.grupo,un:s.un,stock:s.stock,cost:s.cost,avg:0,total:0,minimum:0});
    }
    const all=[...result.values()];
    const demand=new Map();
    for(const row of all){
      if(row.network||row.need<=0)continue;
      const k=matchKey(row);
      if(!demand.has(k))demand.set(k,[]);
      demand.get(k).push(row);
    }
    for(const row of all){
      if(row.network||row.excess<=0||row.provisionalExcess)continue;
      row.transfer=(demand.get(matchKey(row))||[])
        .filter(x=>x.local!==row.local).sort((a,b)=>b.need-a.need).slice(0,3)
        .map(x=>({local:x.local,qty:Math.min(row.excess,x.need)}));
    }
    return all;
  }


  // Regra aprovada em 12/11: ERP 30115 e um unico estoque fisico, dividido
  // operacionalmente entre a reserva para consumo local Chua e saldo CDI.
  // Nao usar as linhas virtuais de demanda da rede como outro estoque.
  function sharedChuaPlan(physical,months){
    const byItem=new Map();
    for(const x of physical){
      if(!x||x.network||outOfScopeLocal(x.local)||exclude(x))continue;
      const k=matchKey(x);
      let entry=byItem.get(k);
      if(!entry){entry={codigo:str(x.codigo),un:norm(x.un),produto:str(x.produto),chua:null,others:[]};byItem.set(k,entry);}
      if(str(x.codigo_local)==='30115')entry.chua=x;
      else entry.others.push(x);
    }
    const total={minGross:0,minCover:0,minBuy:0,maxGross:0,maxCover:0,maxBuy:0,
      coveredProducts:0,missingPriceProducts:0,unverifiedUnitProducts:0,coveredLocations:new Set(),
      coveredValue:0,minGrossValue:0,minBuyValue:0,maxCoverValue:0,maxGrossValue:0,maxBuyValue:0};
    const lines=[];
    for(const entry of byItem.values()){
      const local=entry.chua;
      const s=local?Math.max(0,n(local.stock)):0;
      const minLocal=local?Math.max(0,n(local.minimum)):0;
      const maxLocal=local?(local.reliable&&local.maximum!==null?Math.max(minLocal,n(local.maximum)):minLocal):0;
      // Chuá preserva sua reserva de consumo mesmo quando a serie e curta.
      // Historico insuficiente nao cria pedido de compra automatico.
      const localShortMin=local?.historyInsufficient||local?.mixed?0:Math.max(0,minLocal-s);
      const freeMin=Math.max(0,s-minLocal);
      const localShortMax=local?.historyInsufficient||local?.mixed?0:Math.max(0,maxLocal-s);
      const freeMax=Math.max(0,s-maxLocal);
      let othersMin=0,othersMax=0,eligibleMin=0,eligibleMax=0;
      for(const o of entry.others){
        const needMin=Math.max(0,n(o.need));
        const top=o.reliable&&o.maximum!==null?Math.max(n(o.minimum),n(o.maximum)):n(o.minimum);
        const needMax=o.historyInsufficient||o.mixed?0:Math.max(0,top-n(o.stock));
        othersMin+=needMin;othersMax+=needMax;
        if(!o.mixed){eligibleMin+=needMin;eligibleMax+=needMax;}
      }
      // Historico misto KG/FD, PC/MT etc. impede transferencia automatica.
      const compatible=!(local&&local.mixed);
      const coverMin=compatible?Math.min(freeMin,eligibleMin):0;
      const coverMax=compatible?Math.min(freeMax,eligibleMax):0;
      const buyMin=localShortMin+othersMin-coverMin;
      const buyMax=localShortMax+othersMax-coverMax;
      const itemPrice=local&&n(local.cost)>0?n(local.cost):
        (entry.others.find(o=>n(o.cost)>0)?.cost||0);
      if((buyMin>0||buyMax>0)&&!(itemPrice>0))total.missingPriceProducts++;
      if(local?.mixed||entry.others.some(o=>o.mixed))total.unverifiedUnitProducts++;
      total.minGross+=localShortMin+othersMin;total.minCover+=coverMin;total.minBuy+=buyMin;
      total.maxGross+=localShortMax+othersMax;total.maxCover+=coverMax;total.maxBuy+=buyMax;
      total.minGrossValue+=(localShortMin+othersMin)*itemPrice;
      total.minBuyValue+=buyMin*itemPrice;total.coveredValue+=coverMin*itemPrice;
      total.maxGrossValue+=(localShortMax+othersMax)*itemPrice;
      total.maxBuyValue+=buyMax*itemPrice;total.maxCoverValue+=coverMax*itemPrice;
      if(coverMin>0){
        total.coveredProducts++;
        for(const o of entry.others)if(n(o.need)>0&&!o.mixed)total.coveredLocations.add(str(o.local));
      }
      if(buyMin>1e-9||coverMin>1e-9||buyMax>1e-9||coverMax>1e-9){
        lines.push({codigo:entry.codigo,produto:entry.produto,un:entry.un,
          stockChua:s,minChua:minLocal,freeMin,shortOthers:othersMin,coverMin,buyMin,
          maxChua:maxLocal,freeMax,shortOtherMax:othersMax,coverMax,buyMax,price:itemPrice,
          score:Math.max(buyMin*itemPrice,coverMin*itemPrice,buyMax*itemPrice/2)});
      }
    }
    // Quantidades de diferentes unidades nao sao somadas para exibir totais:
    // apenas valores monetarios com referencias existentes e quantidade de codigos.
    lines.sort((a,b)=>b.score-a.score||a.codigo.localeCompare(b.codigo,'pt-BR'));
    const top=lines.slice(0,100);
    const money=x=>brl(x);
    const cells=top.map(x=>'<tr><td>'+esc(x.codigo)+'</td><td>'+esc(x.produto)+'</td>'+
      '<td>'+esc(x.un)+'</td><td class="num">'+qty(x.stockChua)+'</td>'+
      '<td class="num">'+qty(x.minChua)+'</td><td class="num">'+qty(x.freeMin)+'</td>'+
      '<td class="num">'+qty(x.shortOthers)+'</td><td class="num">'+qty(x.coverMin)+'</td>'+
      '<td class="num">'+qty(x.buyMin)+'</td><td class="num">'+qty(x.maxChua)+'</td>'+
      '<td class="num">'+qty(x.freeMax)+'</td><td class="num">'+qty(x.coverMax)+'</td>'+
      '<td class="num">'+qty(x.buyMax)+'</td></tr>').join('');
    const html='<section class="dbmx-chua-projection" aria-label="Projecao Chuá CDI">'+
      '<div class="dbmx-chua-head"><h3>Projeção integrada · Chuá + CDI</h3>'+
      '<p>O saldo físico 30115 é único. Primeiro reservamos '+(config.year?'o consumo medio filtrado':'o consumo medio de 2025 + jan–out/2026')+
      ' da Fazenda Chuá; só o excedente fica disponível para atender faltas das outras unidades. <b>Não se soma um segundo estoque para o CDI.</b></p></div>'+
      '<div class="dbmx-chua-kpis">'+
      '<div><span>Faltas brutas da rede · mínimo 2 meses</span><strong>'+money(total.minGrossValue)+'</strong></div>'+
      '<div><span>Atendimento pelo saldo livre da Chuá</span><strong>'+money(total.coveredValue)+'</strong><small>'+int(total.coveredProducts)+' códigos/unidades</small></div>'+
      '<div><span>Compra líquida · mínimo 2 meses</span><strong>'+money(total.minBuyValue)+'</strong></div>'+
      '<div><span>Projeção até máximo '+months+' meses*</span><strong>'+money(total.maxBuyValue)+'</strong></div>'+
      '</div><details class="dbmx-chua-detail"><summary>Conferir reservas, saldo CDI e compras por código · '+int(lines.length)+' itens com demanda</summary>'+
      '<div class="dbmx-chua-scroll"><table><thead><tr><th>Código</th><th>Produto</th><th>UN</th>'+
      '<th>Saldo Chuá</th><th>Reserva Chuá 2m</th><th>Disponível CDI 2m</th><th>Faltas demais unidades 2m</th>'+
      '<th>Coberto CDI 2m</th><th>Comprar 2m</th><th>Reserva Chuá '+months+'m*</th>'+
      '<th>Disponível CDI '+months+'m*</th><th>Coberto CDI '+months+'m*</th><th>Comprar '+months+'m*</th></tr></thead>'+
      '<tbody>'+cells+'</tbody></table></div><p>Exibidos os '+int(top.length)+
      ' itens de maior impacto; detalhamento integral disponível na auditoria por produto.</p></details>'+
      '<p class="dbmx-chua-note"><b>Regra:</b> reserva Chuá = mínimo local, 2 meses; CDI disponível = máx(0, saldo 30115 − reserva Chuá); '+
      'compra líquida = falta local Chuá + faltas das demais unidades − volume coberto pelo saldo livre CDI (mesmo código e unidade). '+
      '*Na simulação de '+months+' meses, reservas e metas máximas exigem 3 meses com baixas e unidade compatível; casos não validados mantêm mínimo de 2 meses. '+
      'Não redistribuir automaticamente códigos com unidades divergentes ('+int(total.unverifiedUnitProducts)+' sob revisão). '+
      'Referências monetárias usam o custo disponível na unidade de consumo, com as conversões conferidas; '+int(total.missingPriceProducts)+' produtos em demanda não têm referência e não entram no valor. '+
      'Esta projeção usa uma referência por código e unidade, priorizando o custo da Chuá quando disponível. O cartão de reposição dos almoxarifados usa o custo de cada local. '+
      'Itens sem 3 meses com baixas são excedentes provisórios na análise física e não geram compra automática; '+
      'a reserva de consumo da Chuá é mantida até validação. '+
      'Transferências dependem de confirmação da disponibilidade e formalização fiscal. Valores são projeções, não economia realizada.</p></section>';
    return {summary:{minGrossValue:total.minGrossValue,minCoverValue:total.coveredValue,
      minPurchaseValue:total.minBuyValue,maxGrossValue:total.maxGrossValue,
      maxCoverValue:total.maxCoverValue,maxPurchaseValue:total.maxBuyValue,
      coveredProducts:total.coveredProducts,missingPriceProducts:total.missingPriceProducts,
      mixedUnitProducts:total.unverifiedUnitProducts,physical30115Only:true,
      minimumMonths:2,maximumMonths:months,productRows:lines.length},html};
  }

  function aggregates(rows){
    const map=new Map();
    if(typeof STOCK!=='undefined'&&Array.isArray(STOCK)){
      for(const s of STOCK){
        const local=str(s.local);
        if(local&&!outOfScopeLocal(local)&&!map.has(local))map.set(local,{local,rows:[],needCount:0,excessCount:0,
          needValue:0,excessValue:0,withoutHistory:0,withoutCost:0,network:false});
      }
    }
    for(const x of rows){
      if(outOfScopeLocal(x.local))continue;
      if(!map.has(x.local))map.set(x.local,{local:x.local,rows:[],needCount:0,
        excessCount:0,needValue:0,excessValue:0,withoutHistory:0,withoutCost:0,network:x.network});
      const a=map.get(x.local);
      a.rows.push(x);
      if(x.need>0){a.needCount++;a.needValue+=x.purchaseValue;if(!x.hasCost)a.withoutCost++;}
      if(x.excess>0){a.excessCount++;a.excessValue+=x.excessValue;if(!x.hasCost)a.withoutCost++;}
      if(!x.reliable&&x.stock>0)a.withoutHistory++;
    }
    return [...map.values()].sort((a,b)=>b.needValue-a.needValue||
      b.needCount-a.needCount||b.excessValue-a.excessValue||a.local.localeCompare(b.local,'pt-BR'));
  }

  function visible(row){
    if(config.query){
      const needle=norm(config.query);
      if(!norm(row.codigo+' '+row.produto+' '+row.grupo).includes(needle))return false;
    }
    return config.mode==='all'||config.mode==='actions'&&(row.need>0||row.excess>0)||
      config.mode==='need'&&row.need>0||config.mode==='excess'&&row.excess>0||
      config.mode==='unknown'&&!row.reliable&&row.stock>0;
  }
  function groups(rows){
    const out=new Map();
    for(const x of rows.filter(visible)){
      if(!out.has(x.grupo))out.set(x.grupo,{name:x.grupo,rows:[],needCount:0,excessCount:0,
        needValue:0,excessValue:0});
      const a=out.get(x.grupo);a.rows.push(x);
      if(x.need>0){a.needCount++;a.needValue+=x.purchaseValue;}
      if(x.excess>0){a.excessCount++;a.excessValue+=x.excessValue;}
    }
    return [...out.values()].sort((a,b)=>b.needValue-a.needValue||
      b.needCount-a.needCount||b.excessValue-a.excessValue||a.name.localeCompare(b.name,'pt-BR'));
  }

  // Vermelho: repor; azul: excedente; verde: estoque adequado; roxo: sem baixa/historico insuficiente.
  function statusKind(row){
    if(row.need>0)return 'need';
    if(row.excess>0)return 'excess';
    if(!row.reliable)return 'history';
    return 'ok';
  }
  function statusLabel(row){
    const kind=statusKind(row);
    if(kind==='need')return 'REPOR';
    if(row.provisionalExcess)return 'EXCEDENTE · HISTÓRICO INSUFICIENTE';
    if(kind==='excess')return 'EXCEDENTE DISPONÍVEL';
    if(kind==='history')return row.mixed?'REVISAR UNIDADE':(row.active===0?'SEM BAIXAS':'HISTÓRICO INSUFICIENTE');
    return 'ESTOQUE ADEQUADO';
  }
  function statusCounts(rows){
    const c={need:0,excess:0,ok:0,history:0};
    for(const row of rows)c[statusKind(row)]++;
    return c;
  }
  function withdrawalsByUnit(rows){
    const sums=new Map();
    for(const row of rows)for(const x of row.withdrawals||[]){
      if(!x.value)continue;
      const un=norm(x.un)||'UN NÃO INFORMADA';
      sums.set(un,(sums.get(un)||0)+n(x.value));
    }
    return [...sums.entries()].filter(([,v])=>Math.abs(v)>1e-9)
      .sort((a,b)=>a[0].localeCompare(b[0],'pt-BR'))
      .map(([un,value])=>({un,value}));
  }
  function withdrawalText(values){
    return values.length?values.map(x=>qty(x.value)+' '+x.un).join(' · '):'0 (sem baixa)';
  }
  function withdrawalSummary(rows,label){
    const data=withdrawalsByUnit(rows);
    return '<span class="dbmx-withdrawals" data-dbmx-withdrawals="'+esc(JSON.stringify(data))+
      '" title="'+esc(withdrawalText(data))+'"><b>'+esc(label||'Baixas')+':</b> '+
      esc(withdrawalText(data))+'</span>';
  }
  function statusSummary(rows){
    const c=statusCounts(rows);
    return '<span class="dbmx-state-summary">'+
      '<span class="dbmx-summary-need">Repor '+int(c.need)+'</span>'+
      '<span class="dbmx-summary-excess">Excedente '+int(c.excess)+'</span>'+
      '<span class="dbmx-summary-ok">Adequado '+int(c.ok)+'</span>'+
      '<span class="dbmx-summary-history">Sem histórico '+int(c.history)+'</span>'+
      '</span>';
  }

  // Ordenacao da tabela por valor de reposicao ou quantidade baixada, sem alterar os calculos.
  // Quantidades baixadas continuam detalhadas por unidade, sem somar PC com KG/LT.
  function withdrawalSortQuantity(row){
    const records=Array.isArray(row.withdrawals)?row.withdrawals:[];
    const sameUnit=records.find(x=>norm(x.un)===norm(row.un));
    if(sameUnit)return Math.max(0,n(sameUnit.value));
    return Math.max(0,...records.map(x=>n(x.value)));
  }

  // Grafico sob demanda: mesmas baixas mensais da reposicao; nunca somar
  // quantidades de unidades de medida diferentes ou de outros almoxarifados.
  const monthlyNames=['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];

  // Planilha 26/11: resumo por mes/produto/local/unidade/centro, sem documentos
  // individuais. Carregamento sob demanda para nao atrasar o dashboard.
  const resultYears=new Map(),resultInFlight=new Map();
  const centerSourceSHA256='e163e240a08fc4477932905abccec791f894ac925d0ab12247b0e4610cd55678';
  async function loadResultYear(year){
    if(resultYears.has(year))return resultYears.get(year);
    if(resultInFlight.has(year))return resultInFlight.get(year);
    const task=(async()=>{
      const url='/centros-resultado-20261126-'+year+'.b64';
      const response=await fetch(url,{cache:'force-cache'});
      if(!response.ok)throw Error('Arquivo de centros indisponivel ('+response.status+')');
      const b64=(await response.text()).trim();
      if(!/^[A-Za-z0-9+/=]+$/.test(b64))throw Error('Formato de centros invalido');
      if(typeof DecompressionStream==='undefined')throw Error('Navegador sem suporte a descompactacao');
      const bytes=Uint8Array.from(atob(b64),c=>c.charCodeAt(0));
      const data=await new Response(new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'))).json();
      if(data.schema!==2||data.year!==year||data.sourceSHA256!==centerSourceSHA256||
         !data.dict||!Array.isArray(data.rows)||!Array.isArray(data.dict.center)||
         data.totalRecords!==(year===2025?7315:13988))
        throw Error('Fonte de centros nao confere com a planilha auditada');
      resultYears.set(year,data);
      return data;
    })();
    resultInFlight.set(year,task);
    try{return await task;}finally{resultInFlight.delete(year);}
  }
  function centerRowsForItem(item,year,month,un){
    const data=resultYears.get(year);
    if(!data)return null;
    const D=data.dict;
    const localIndex=new Map(D.local.map((value,index)=>[str(value),index]));
    const productIndex=D.product.indexOf(str(item.codigo)),unitIndex=D.unit.indexOf(norm(un));
    const warehouseIndex=localIndex.get(str(item.codigo_local));
    if(productIndex<0||unitIndex<0||(!item.network&&warehouseIndex===undefined))return [];
    const mapped=new Map();
    for(const [m,li,pi,ui,ci,q] of data.rows){
      if(m!==month||pi!==productIndex||ui!==unitIndex||(!item.network&&li!==warehouseIndex))continue;
      const center=str(D.center[ci]||'CENTRO NAO INFORMADO');
      const local=str(D.local[li]);
      const key=(item.network?local+'|':'')+center;
      const row=mapped.get(key)||{local,center,qty:0};
      row.qty+=n(q);mapped.set(key,row);
    }
    return [...mapped.values()].sort((a,b)=>b.qty-a.qty||a.center.localeCompare(b.center,'pt-BR'));
  }
  function centerMonthlyHistory(item){
    const years=config.year?[Number(config.year)]:[2025,2026];
    const byUnit=new Map();
    for(const year of years){
      const data=resultYears.get(year);
      if(!data)continue;
      const D=data.dict,pi=D.product.indexOf(str(item.codigo));
      if(pi<0)continue;
      const li=D.local.indexOf(str(item.codigo_local));
      for(const [m,loc,prod,unit,center,q] of data.rows){
        if(prod!==pi||(!item.network&&loc!==li))continue;
        const un=norm(D.unit[unit])||'UN NAO INFORMADA';
        if(!byUnit.has(un))byUnit.set(un,{un,months:{2025:Array(12).fill(0),2026:Array(12).fill(0)}});
        byUnit.get(un).months[year][m-1]+=n(q);
      }
    }
    return [...byUnit.values()].sort((a,b)=>
      (a.un===norm(item.un)?-1:0)-(b.un===norm(item.un)?-1:0)||
      a.un.localeCompare(b.un,'pt-BR'));
  }

  function monthlyHistory(item){
    if(resultYears.size&&(config.year?resultYears.has(Number(config.year)):resultYears.has(2025)&&resultYears.has(2026)))
      return centerMonthlyHistory(item);
    const annual=item.network
      ?(typeof CDI_NETWORK_YEARLY==='undefined'?[]:CDI_NETWORK_YEARLY)
      :(typeof MOVEMENTS_YEARLY==='undefined'?[]:MOVEMENTS_YEARLY);
    const byUnit=new Map();
    for(const x of annual){
      const year=Number(x.year);
      if(year!==2025&&year!==2026)continue;
      const code=item.network?str(x.k??x.codigo):str(x.codigo);
      if(code!==str(item.codigo)||(!item.network&&str(x.codigo_local)!==str(item.codigo_local)))continue;
      const un=norm(x.un)||'UN NÃO INFORMADA';
      if(!byUnit.has(un))byUnit.set(un,{un,months:{2025:Array(12).fill(0),2026:Array(12).fill(0)}});
      const values=byUnit.get(un).months[year];
      for(let month=0;month<12;month++)values[month]+=n(x.months?.[month]);
    }
    return [...byUnit.values()].sort((a,b)=>
      (a.un===norm(item.un)?-1:0)-(b.un===norm(item.un)?-1:0)||
      a.un.localeCompare(b.un,'pt-BR'));
  }
  function monthlyChartHtml(item){
    const rows=monthlyHistory(item);
    const years=config.year?[Number(config.year)]:[2025,2026];
    // MOVEMENTS_YEARLY encerra o ultimo ano em outubro de 2026. Meses
    // parciais nao devem aparecer como "zero baixas" no historico.
    const updated=resultYears.has(2026);
    const endMonth=year=>year===2026?(updated?11:10):12;
    const intro='<div class="dbmx-monthly-context">Almoxarifado: <b>'+esc(item.local)+
      '</b> · Código: <b>'+esc(item.codigo)+'</b> · Período do filtro: <b>'+
      esc(config.year||'2025 + 2026')+'</b></div>'+
      '<p class="dbmx-monthly-note">Cada barra representa as baixas do produto naquele mês. '+
      'Os meses sem baixa aparecem zerados. Transferências não são somadas ao consumo. '+
      'As unidades são exibidas separadamente, quando diferentes. '+
      (updated?'As baixas de novembro de 2026 são parciais; a média da reposição permanece calculada com meses completos até outubro. ':'2026 contém janeiro a outubro (meses completos). ')+
      'Os totais do gráfico atualizado são da planilha ERP de 26/11/2026 e podem divergir da média de reposição até a conciliação completa.'+
      '</p>';
    if(!rows.length)return intro+
      '<p class="dbmx-monthly-empty">Não há baixas mensais identificadas para este produto neste '+
      (item.network?'recorte da rede.':'almoxarifado.')+'</p>';
    return intro+rows.map(series=>{
      const max=Math.max(0,...years.flatMap(year=>series.months[year].slice(0,endMonth(year)).map(Math.abs)));
      const total=years.reduce((sum,year)=>sum+
        series.months[year].slice(0,endMonth(year)).reduce((a,b)=>a+b,0),0);
      const blocks=years.map(year=>{
        const count=endMonth(year);
        const bars=series.months[year].slice(0,count).map((amount,index)=>{
          const isPartial=year===2026&&index===10&&updated;
          const height=max?Math.max(amount?4:0,Math.round(Math.abs(amount)/max*142)):0;
          const label=monthlyNames[index]+' '+year+': '+qty(amount)+' '+series.un+
            (isPartial?' (mês parcial)':'');
          return '<button type="button" class="dbmx-monthly-month" data-year="'+year+'" data-month="'+(index+1)+'" data-value="'+amount+'" data-unit="'+esc(series.un)+'" aria-label="'+esc('Ver centros de resultado de '+monthlyNames[index]+' '+year+', '+qty(amount)+' '+series.un)+'" title="Clique para conferir os centros de resultado"+
            '" aria-label="'+esc(label)+'" title="'+esc(label)+'">'+
            '<span class="dbmx-monthly-amount">'+(amount?esc(qty(amount)):'0')+'</span>'+
            '<div class="dbmx-monthly-bar-zone"><span class="dbmx-monthly-bar'+
              (!amount?' is-zero':amount<0?' is-negative':'')+
              (isPartial?' is-partial':'')+'" style="height:'+height+'px"></span></div>'+
            '<span class="dbmx-monthly-month-label">'+monthlyNames[index]+
            (isPartial?'*':'')+'</span></button>';
        }).join('');
        return '<section class="dbmx-monthly-year" data-year="'+year+'">'+
          '<h4>'+year+'</h4><div class="dbmx-monthly-horizontal">'+
          '<div class="dbmx-monthly-bars" role="group" aria-label="Consumo mensal de '+year+
            ', unidade '+esc(series.un)+'">'+bars+'</div></div></section>';
      }).join('');
      return '<section class="dbmx-monthly-unit" data-unit="'+esc(series.un)+'">'+
        '<h3>Baixas em '+esc(series.un)+' <small>Total exibido: '+esc(qty(total))+' '+esc(series.un)+'</small></h3>'+
        blocks+'</section>';
    }).join('');
  }

  // Drilldown por centro de resultado: os totais do grafico sempre vem da base
  // consolidada, e o detalhamento apenas da origem que contem o destino real.
  let monthlySelection=null;
  function resultCenterHtml(item,year,month,un,total){
    const label=monthlyNames[month-1]+' / '+year;
    const title='<h3>Destinação das baixas · '+esc(label)+'</h3>'+
      '<p class="dbmx-center-caption">Produto '+esc(item.codigo)+' · '+esc(item.produto)+
      ' · total do gráfico: <b>'+esc(qty(total))+' '+esc(un)+'</b>.</p>';
    if(!total)return title+'<p class="dbmx-center-empty">Não há baixas neste mês para essa unidade.</p>';
    const found=centerRowsForItem(item,year,month,un);
    if(found===null)return title+'<p class="dbmx-center-empty">Dados por centro ainda não carregados.</p>';
    if(!found.length)return title+
      '<p class="dbmx-center-empty">Não há centro de resultado identificado para esse produto, unidade e mês na planilha atualizada.</p>';
    const covered=found.reduce((sum,x)=>sum+x.qty,0),delta=total-covered;
    const matched=Math.abs(delta)<=Math.max(.01,Math.abs(total)*.00001);
    const status=matched?'O total por centro confere com o gráfico.':
      'Total do gráfico: '+qty(total)+' '+esc(un)+' · total por centros: '+
      qty(covered)+' '+esc(un)+'. Diferença a conferir: '+qty(delta)+' '+esc(un)+'.';
    return title+
      '<div class="dbmx-center-coverage '+(matched?'is-matched':'is-partial')+'">'+status+'</div>'+
      '<div class="dbmx-center-scroll"><table><thead><tr><th>Centro de resultado</th>'+
      (item.network?'<th>Local de origem</th>':'')+
      '<th>Quantidade baixada</th><th>% identificado</th></tr></thead><tbody>'+
      found.map(x=>'<tr><td>'+esc(x.center)+'</td>'+
        (item.network?'<td>'+esc(x.local)+'</td>':'')+
        '<td class="num">'+qty(x.qty)+' '+esc(un)+'</td>'+
        '<td class="num">'+(covered>0?qty(100*x.qty/covered):'0')+'%</td></tr>').join('')+
      '</tbody></table></div>'+
      '<p class="dbmx-center-source">Fonte: Conferência de custo X baixas · 26/11/2026 (Dt.Neg.). '+
      'Centro de resultado informado pelo ERP. Não inclui transferências; não altera estoque ou reposição.</p>';
  }
  async function showResultCenters(dialog,monthButton){
    if(!monthlySelection)return;
    const year=Number(monthButton.dataset.year),month=Number(monthButton.dataset.month);
    const un=str(monthButton.dataset.unit);
    const total=n(monthButton.dataset.value);
    const area=dialog.querySelector('#dbmx-result-centers');
    if(!area)return;
    area.hidden=false;
    area.innerHTML='<p class="dbmx-center-empty">Consultando os centros de resultado...</p>';
    try {
      await loadResultYear(year);
      if(!dialog.open||monthlySelection.codigo!==dialog.dataset.dbmxActiveProduct)return;
      area.innerHTML=resultCenterHtml(monthlySelection,year,month,un,total);
    } catch (error) {
      area.innerHTML='<p class="dbmx-center-empty">Não foi possível consultar os centros de resultado: '+
        esc(error.message)+'</p>';
    }
    dialog.querySelectorAll('.dbmx-monthly-month').forEach(b=>
      b.setAttribute('aria-pressed',b===monthButton?'true':'false'));
    area.hidden=false;
    area.scrollIntoView({block:'nearest',behavior:'smooth'});
  }

  let lastMonthlyTrigger=null;
  function openMonthlyChart(item,trigger){
    let dialog=document.getElementById('dbmx-monthly-dialog');
    if(!dialog){
      dialog=document.createElement('dialog');
      dialog.id='dbmx-monthly-dialog';dialog.className='dbmx-monthly-dialog';
      dialog.setAttribute('aria-labelledby','dbmx-monthly-title');
      dialog.addEventListener('click',e=>{
        const month=e.target.closest('button.dbmx-monthly-month');
        if(month){showResultCenters(dialog,month);return;}
        if(e.target.closest('[data-dbmx-monthly-close]')||e.target===dialog)dialog.close();
      });
      dialog.addEventListener('close',()=>lastMonthlyTrigger?.focus());
      document.body.appendChild(dialog);
    }
    monthlySelection=item;
    dialog.dataset.dbmxActiveProduct=item.codigo;
    dialog.innerHTML='<div class="dbmx-monthly-head"><div><span>HISTÓRICO DE BAIXAS</span>'+
      '<h2 id="dbmx-monthly-title">'+esc(item.produto)+'</h2></div>'+
      '<button type="button" data-dbmx-monthly-close aria-label="Fechar gráfico mensal">Fechar ×</button></div>'+
      '<div class="dbmx-monthly-content"><p class="dbmx-monthly-tip">Clique em uma barra ou no mês para conferir os centros de resultado da baixa.</p>'+monthlyChartHtml(item)+
      '<section id="dbmx-result-centers" class="dbmx-result-centers" aria-live="polite" hidden></section></div>';
    lastMonthlyTrigger=trigger;
    if(typeof dialog.showModal==='function')dialog.showModal();
    else dialog.setAttribute('open','');
    // Carregar o histórico mais recente e reexibir o gráfico para conciliar
    // seus totais com os centros. Os parâmetros de reposição não mudam.
    const years=config.year?[Number(config.year)]:[2025,2026];
    Promise.all(years.map(loadResultYear)).then(()=>{
      if(!dialog.open||dialog.dataset.dbmxActiveProduct!==item.codigo)return;
      const content=dialog.querySelector('.dbmx-monthly-content');
      if(content)content.innerHTML='<p class="dbmx-monthly-tip">Clique em uma barra ou mês para conferir os centros de resultado.</p>'+
        monthlyChartHtml(item)+'<section id="dbmx-result-centers" class="dbmx-result-centers" aria-live="polite" hidden></section>';
    }).catch(error=>{
      const content=dialog.querySelector('.dbmx-monthly-content');
      if(content&&dialog.open)content.insertAdjacentHTML('afterbegin',
        '<p class="dbmx-center-coverage">A consulta dos centros está indisponível: '+esc(error.message)+'</p>');
    });
  }

  function itemTable(rows){
    const sorted=rows.slice().sort((a,b)=>
      (config.tableSort==='withdrawals'
        ?withdrawalSortQuantity(b)-withdrawalSortQuantity(a)
        :b.purchaseValue-a.purchaseValue)||
      b.purchaseValue-a.purchaseValue||b.need-a.need||b.excessValue-a.excessValue||
      a.produto.localeCompare(b.produto,'pt-BR')||
      a.codigo.localeCompare(b.codigo,'pt-BR'));
    const columns=[6,18,3,10,6,6,5,6,6,8,6,8,12];
    const colgroup='<colgroup>'+columns.map(width=>'<col style="width:'+width+'%">').join('')+'</colgroup>';
    const cell=(label,html,classes='',attr='')=>
      '<td data-label="'+esc(label)+'" class="'+esc(classes)+'"'+attr+'>'+html+'</td>';
    return '<div class="dbmx-order-note">Ordenar produtos por <select id="dbmx-table-sort" aria-label="Ordenar produtos da reposição">'+
      [['value','Maior valor de reposição'],['withdrawals','Maior quantidade baixada']].map(([value,label])=>
        '<option value="'+value+'"'+(config.tableSort===value?' selected':'')+'>'+label+'</option>').join('')+
      '</select> · '+(config.tableSort==='withdrawals'
        ?'quantidade baixada no período em ordem decrescente, respeitando a unidade de cada produto.'
        :'necessidade de compra × custo unitário de referência, do maior para o menor valor.')+' '+
      'Baixas apresentadas por unidade de medida. '+
      '<span class="dbmx-filter-count" aria-live="polite"></span></div>'+
      '<div class="dbmx-scroll"><table>'+colgroup+'<thead><tr>'+
      '<th>Código</th><th>Produto</th><th>UN</th><th>Qtd. baixada no período</th><th>Média/mês</th>'+
      '<th>Mínimo (2 meses)</th><th>Saldo atual</th><th>Máximo ('+config.months+' meses)</th>'+
      '<th>Qtd. a repor</th><th>Custo unit. de referência</th>'+
      '<th>Qtd. excedente</th><th>Valor excedente</th>'+
      '<th class="dbmx-status-filter-th">Situação / possíveis transferências'+
      '<select id="dbmx-table-status" aria-label="Filtrar por situação: Todos, Repor ou Excedente">'+
      [['all','Todos'],['need','Repor'],['excess','Excedente']].map(([value,label])=>
        '<option value="'+value+'"'+(config.tableStatus===value?' selected':'')+'>'+label+'</option>').join('')+
      '</select></th>'+
      '</tr></thead><tbody>'+sorted.map(x=>{
        const note=x.transfer.length?' · Possível transferência para '+x.transfer
          .map(o=>o.local+' ('+qty(o.qty)+' '+x.un+')').join('; '):'';
        const kind=statusKind(x);
        const warning=x.provisionalExcess?
          'Saldo integral considerado excedente provisório: menos de 3 meses com baixas. Confirmar uso antes de transferir. '+
          (x.mixed?'Unidade de medida divergente. ':''):
          (x.mixed?'Unidade de medida divergente. ':
          (!x.reliable&&x.need>0?'Estoque máximo depende de revisão do histórico. ':''));
        const explanation=kind==='ok'&&x.condition==='ATENÇÃO'?
          'Próximo do mínimo, mas sem compra necessária. ':(
            kind==='history'?'Não gerar alerta automático de máximo sem consumo suficiente. ':'');
        return '<tr class="dbmx-state-'+kind+'" data-dbmx-situation="'+esc(x.condition)+
          '" data-dbmx-color="'+kind+'" data-dbmx-provisional="'+(x.provisionalExcess?'true':'false')+
          '" data-dbmx-withdrawal-sort="'+withdrawalSortQuantity(x)+
           '" data-dbmx-replenishment-sort="'+x.purchaseValue+
          '" data-dbmx-code="'+esc(x.codigo)+
          '" data-dbmx-local-code="'+esc(x.codigo_local)+
          '" data-dbmx-un="'+esc(x.un)+
          '" data-dbmx-product="'+esc(x.produto)+
          '" data-dbmx-network="'+(x.network?'true':'false')+'">'+
          cell('Código',esc(x.codigo),'dbmx-code')+
          cell('Produto','<button type="button" class="dbmx-product-chart" title="Ver gráfico mensal de baixas" aria-label="Ver gráfico mensal de baixas de '+esc(x.produto)+'">'+esc(x.produto)+'</button>','dbmx-product')+
          cell('UN',esc(x.un))+
          cell('Qtd. baixada no período',esc(withdrawalText(x.withdrawals)),'num dbmx-withdrawn-cell',
            ' data-dbmx-withdrawn="'+esc(JSON.stringify(x.withdrawals))+'"')+
          cell('Média/mês',x.avg>0?qty(x.avg):'—','num')+
          cell('Mínimo (2 meses)',x.avg>0?qty(x.minimum):'—','num')+
          cell('Saldo atual',qty(x.stock),'num')+
          cell('Máximo ('+config.months+' meses)',x.maximum===null?'—':qty(x.maximum),'num')+
          cell('Qtd. a repor',qty(x.need),'num'+(x.need>0?' dbmx-need':''))+
          cell('Custo unit. de referência',x.hasCost?brl(x.cost):'Não informado','num')+
          cell('Qtd. excedente',qty(x.excess),'num'+(x.excess>0?' dbmx-warn':''))+
          cell('Valor excedente',x.excess>0&&!x.hasCost?'Sem custo':brl(x.excessValue),'num dbmx-warn')+
          cell('Situação / possíveis transferências',
            '<strong class="dbmx-status dbmx-status--'+kind+'">'+esc(statusLabel(x))+'</strong>'+
            (warning||explanation||note?'<small class="dbmx-status-help">'+esc(warning+explanation+note.trim())+'</small>':''),'dbmx-status-cell')+
          '</tr>';
      }).join('')+'</tbody></table></div>'+
      '<p class="dbmx-filter-empty" hidden>Nenhum produto nesta situação neste grupo.</p>';
  }

  // Filtro somente na tabela aberta. Nao muda totais, calculos nem filtros gerais.
  function filterProductRows(panel){
    const rows=[...panel.querySelectorAll('.dbmx-products .dbmx-scroll tbody tr[data-dbmx-color]')];
    if(!rows.length)return;
    let visible=0;
    for(const row of rows){
      const show=config.tableStatus==='all'||row.dataset.dbmxColor===config.tableStatus;
      row.hidden=!show;
      if(show)visible++;
    }
    const count=panel.querySelector('.dbmx-filter-count');
    if(count)count.textContent='Mostrando '+int(visible)+' de '+int(rows.length)+' produtos';
    const empty=panel.querySelector('.dbmx-filter-empty');
    if(empty)empty.hidden=visible!==0;
  }

  function ensurePanel(){
    const view=document.getElementById('view-minimo');
    if(!view)return null;
    // Renomeia somente a aba de gestao. As visoes operacionais locais permanecem inalteradas.
    const tabName='Estoque mínimo / Estoque máximo';
    const oldTab=document.querySelector('.tabs .tab[data-view="minimo"]');
    if(oldTab&&oldTab.textContent.trim()!==tabName)oldTab.textContent=tabName;
    if(!window.DB_NAVIGATION)document.querySelectorAll('.clean-sub-btn[data-view="minimo"]').forEach(button=>{
      if(button.textContent.trim()!==tabName)button.textContent=tabName;
    });
    // Mantem o DOM da analise antiga para compatibilidade, mas a exibicao e unica.
    view.classList.add('db-unified-stock');
    let panel=document.getElementById('db-stock-maximum');
    if(!panel){panel=document.createElement('section');panel.id='db-stock-maximum';view.appendChild(panel);}
    if(panel.parentElement!==view)view.appendChild(panel);
    if(!panel.dataset.dbmxEvents){
      panel.dataset.dbmxEvents='1';
      panel.addEventListener('change',e=>{
        const target=e.target;
        if(target.id==='dbmx-table-sort'){
          config.tableSort=target.value==='withdrawals'?'withdrawals':'value';
          render();return;
        }
        if(target.id==='dbmx-table-status'){
          config.tableStatus=['all','need','excess'].includes(target.value)?target.value:'all';
          filterProductRows(panel);
          return;
        }
        if(target.id==='dbmx-months')config.months=[3,4,6].includes(Number(target.value))?Number(target.value):4;
        else if(target.id==='dbmx-year')config.year=['2025','2026'].includes(target.value)?target.value:'';
        else if(target.id==='dbmx-mode')config.mode=['all','actions','need','excess','unknown'].includes(target.value)?target.value:'all';
        else return;
        config.group='';config.tableStatus='all';render();
      });
      panel.addEventListener('input',e=>{
        if(e.target.id!=='dbmx-search')return;
        config.query=e.target.value;
        clearTimeout(timer);timer=setTimeout(()=>render('search'),160);
      });
      panel.addEventListener('click',e=>{
        const product=e.target.closest('button.dbmx-product-chart');
        if(product){
          const tr=product.closest('tr');
          if(tr)openMonthlyChart({codigo:tr.dataset.dbmxCode,codigo_local:tr.dataset.dbmxLocalCode,
            un:tr.dataset.dbmxUn,produto:tr.dataset.dbmxProduct,local:config.local,
            network:tr.dataset.dbmxNetwork==='true'},product);
          return;
        }
        const local=e.target.closest('button[data-dbmx-local]');
        if(local){config.local=config.local===local.dataset.dbmxLocal?'':local.dataset.dbmxLocal;config.group='';config.tableStatus='all';render();return;}
        const group=e.target.closest('button[data-dbmx-group]');
        if(group){config.group=config.group===group.dataset.dbmxGroup?'':group.dataset.dbmxGroup;config.tableStatus='all';render();return;}
      });
    }
    if(!document.getElementById('db-stock-unified-css')){
      const style=document.createElement('style');style.id='db-stock-unified-css';
      style.textContent=[
        '#view-minimo.db-unified-stock > :not(#db-stock-maximum){display:none!important}',
        '#db-stock-maximum{display:block;margin:0 0 20px;border:1px solid #d4e4d9;border-radius:14px;background:#fff;overflow:hidden;color:#253b2e;font:12px Arial,Helvetica,sans-serif}',
        '#db-stock-maximum .dbmx-head{padding:21px 22px;background:linear-gradient(110deg,#e8f5eb,#f9fcfa);border-bottom:1px solid #d5e5d9}',
        '#db-stock-maximum h2{margin:0 0 6px;font-size:21px;color:#125c32}',
        '#db-stock-maximum .dbmx-sub{font-size:12px;color:#547160;line-height:1.5}',
        '#db-stock-maximum .dbmx-filters{display:flex;align-items:flex-end;flex-wrap:wrap;gap:12px;padding:15px 22px}',
        '#db-stock-maximum label{display:flex;flex-direction:column;gap:5px;min-width:170px;font-weight:700;font-size:11px;color:#315b40}',
        '#db-stock-maximum select,#db-stock-maximum input{box-sizing:border-box;width:100%;min-height:36px;padding:8px 10px;border:1px solid #bdcfc3;border-radius:7px;background:#fff;color:#235838;font-size:12px}',
        '#db-stock-maximum .dbmx-search{min-width:210px;flex:1}',
        '#db-stock-maximum .dbmx-kpis{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px;padding:0 22px 16px}',
        '#db-stock-maximum .dbmx-kpi{border:1px solid #d8e7db;border-radius:10px;padding:13px;background:#f8fbf9}',
        '#db-stock-maximum .dbmx-kpi span{display:block;font-size:11px;color:#567161}',
        '#db-stock-maximum .dbmx-kpi strong{display:block;font-size:19px;margin-top:7px;color:#135634;overflow-wrap:anywhere}',
        '#db-stock-maximum .dbmx-kpi.need strong{color:#a35618}',
        '#db-stock-maximum .dbmx-kpi.excess strong{color:#93471f}',
        '#db-stock-maximum .dbmx-list{padding:0 22px 17px}',
        '#db-stock-maximum .dbmx-list h3{margin:6px 0 11px;font-size:14px;color:#225a36}',
        '#db-stock-maximum .dbmx-legend{display:flex;gap:16px;flex-wrap:wrap;font-size:11px;color:#5a7262;margin:2px 0 12px}',
        '#db-stock-maximum .dbmx-local,#db-stock-maximum .dbmx-group{display:grid;grid-template-columns:minmax(175px,2fr) minmax(150px,3fr) minmax(150px,3fr);gap:14px;align-items:center;width:100%;padding:12px 7px;border:0;border-bottom:1px solid #e3ede6;background:#fff;text-align:left;cursor:pointer;font-size:12px;color:#314b3a}',
        '#db-stock-maximum .dbmx-local:hover,#db-stock-maximum .dbmx-group:hover,#db-stock-maximum button[aria-expanded="true"]{background:#eef8f1}',
        '#db-stock-maximum .dbmx-name{font-weight:700;overflow-wrap:anywhere}',
        '#db-stock-maximum .dbmx-metric{display:flex;gap:7px;flex-direction:column;font-size:10px;color:#607565}',
        '#db-stock-maximum .dbmx-metric strong{font-size:12px;color:#315d3d}',
        '#db-stock-maximum .dbmx-track{display:block;height:8px;background:#ebf1ed;border-radius:99px;overflow:hidden}',
        '#db-stock-maximum .dbmx-bar{display:block;height:100%;border-radius:99px}',
        '#db-stock-maximum .dbmx-bar--need{background:#dc9852}',
        '#db-stock-maximum .dbmx-bar--excess{background:#ae5b46}',
        '#db-stock-maximum .dbmx-detail{margin:0 22px 18px;padding:15px;background:#f8fbf9;border:1px solid #d7e6db;border-radius:10px}',
        '#db-stock-maximum .dbmx-detail h3{font-size:14px;margin:0 0 11px;color:#235738}',
        '#db-stock-maximum .dbmx-group{grid-template-columns:minmax(175px,2fr) minmax(135px,3fr) minmax(135px,3fr);font-size:11px}',
        '#db-stock-maximum .dbmx-scroll{max-height:460px;overflow:auto;background:#fff;border:1px solid #dfe9e2;border-radius:5px}',
        '#db-stock-maximum table{border-collapse:collapse;min-width:1620px;width:100%;font-size:10px}',
        '#db-stock-maximum th,#db-stock-maximum td{padding:9px;border-bottom:1px solid #e7eeea;text-align:left}',
        '#db-stock-maximum th{position:sticky;top:0;background:#eaf5ec;color:#325a3d;z-index:1}',
        '#db-stock-maximum td.num{text-align:right;white-space:nowrap}',
        '#db-stock-maximum .dbmx-need{color:#ad3035;font-weight:750}',
        '#db-stock-maximum .dbmx-warn{color:#1b65b5;font-weight:750}',
        '#db-stock-maximum .dbmx-local-block>.dbmx-detail{margin:0 4px 15px 20px;padding:15px}',
        '#db-stock-maximum .dbmx-group-wrap{border-bottom:1px solid #e2eae3}',
        '#db-stock-maximum .dbmx-group-wrap .dbmx-group{border-bottom:0}',
        '#db-stock-maximum .dbmx-products{margin:0 0 15px 12px;padding:12px;border-left:3px solid #cbded1;background:#fff}',
        '#db-stock-maximum .dbmx-arrow{font-size:14px;margin-right:6px;color:#497b5a}',
        '#db-stock-maximum .dbmx-state-summary{display:flex;gap:7px 12px;flex-wrap:wrap;margin-top:7px;font-size:10px;font-weight:650}',
        '#db-stock-maximum .dbmx-summary-need{color:#ba2c32}',
        '#db-stock-maximum .dbmx-summary-excess{color:#1b67bd}',
        '#db-stock-maximum .dbmx-summary-ok{color:#16824d}',
        '#db-stock-maximum .dbmx-summary-history{color:#7850ae}',
        '#db-stock-maximum .dbmx-legend{align-items:center}',
        '#db-stock-maximum .dbmx-legend span{display:inline-flex;gap:5px;align-items:center}',
        '#db-stock-maximum .dbmx-legend b{width:9px;height:9px;border-radius:50%;display:inline-block}',
        '#db-stock-maximum .dbmx-legend--need{background:#c4343b}',
        '#db-stock-maximum .dbmx-legend--excess{background:#246db7}',
        '#db-stock-maximum .dbmx-legend--ok{background:#208754}',
        '#db-stock-maximum .dbmx-legend--history{background:#8054b8}',
        '#db-stock-maximum tr.dbmx-state-need{background:#fff0f0}',
        '#db-stock-maximum tr.dbmx-state-excess{background:#edf5ff}',
        '#db-stock-maximum tr.dbmx-state-ok{background:#ecf9f0}',
        '#db-stock-maximum tr.dbmx-state-history{background:#f5f0ff}',
        '#db-stock-maximum tr.dbmx-state-need td:first-child{border-left:4px solid #c4343b}',
        '#db-stock-maximum tr.dbmx-state-excess td:first-child{border-left:4px solid #246db7}',
        '#db-stock-maximum tr.dbmx-state-ok td:first-child{border-left:4px solid #208754}',
        '#db-stock-maximum tr.dbmx-state-history td:first-child{border-left:4px solid #8054b8}',
        '#db-stock-maximum .dbmx-status{font-size:10px;font-weight:850;white-space:nowrap}',
        '#db-stock-maximum .dbmx-status--need{color:#b52931}',
        '#db-stock-maximum .dbmx-status--excess{color:#175aa9}',
        '#db-stock-maximum .dbmx-status--ok{color:#126d42}',
        '#db-stock-maximum .dbmx-status--history{color:#68439b}',
        '#db-stock-maximum .dbmx-status-help{display:block;margin-top:4px;color:#52675c;line-height:1.45}',
        '#db-stock-maximum .dbmx-note{padding:12px 22px;border-top:1px solid #dfe9e2;color:#5c7262;line-height:1.6;font-size:11px}',
        // A identidade DB usa verde institucional e amarelo: sem pintar linhas inteiras de quatro cores.
        '#db-stock-maximum{border-color:var(--db-line,#d8e4dc);background:var(--db-surface,#fff);color:var(--db-ink,#2a2a29)}',
        '#db-stock-maximum .dbmx-head{background:linear-gradient(110deg,var(--db-green-deep,#0d4726),var(--db-green-strong,#16733b));border-bottom:4px solid var(--db-yellow,#faca04)}',
        '#db-stock-maximum .dbmx-head h2{color:#fff}',
        '#db-stock-maximum .dbmx-head .dbmx-sub{color:#e4f4e8}',
        '#db-stock-maximum .dbmx-filters{background:var(--db-green-pale,#f3f9f5);border-bottom:1px solid var(--db-line,#d8e4dc)}',
        '#db-stock-maximum select:focus,#db-stock-maximum input:focus{border-color:var(--db-green,#1e8747);outline:2px solid #c5e9d0}',
        '#db-stock-maximum .dbmx-kpi{background:#fff;border-color:var(--db-line,#d8e4dc);border-top:3px solid var(--db-green,#1e8747)}',
        '#db-stock-maximum .dbmx-kpi:nth-child(2n){border-top-color:var(--db-yellow,#faca04)}',
        '#db-stock-maximum .dbmx-chua-projection{margin:0 22px 20px;border:1px solid #cbded1;border-radius:11px;overflow:hidden;background:#fff}',
        '#db-stock-maximum .dbmx-chua-head{background:#edf7ef;padding:15px 18px;color:#215a37}',
        '#db-stock-maximum .dbmx-chua-head h3{margin:0 0 4px;font-size:16px;color:#125c31}',
        '#db-stock-maximum .dbmx-chua-head p{margin:0;font-size:11px;line-height:1.6}',
        '#db-stock-maximum .dbmx-chua-kpis{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px;padding:13px 15px}',
        '#db-stock-maximum .dbmx-chua-kpis>div{padding:10px 12px;background:#f8fbf9;border:1px solid #e0ebe2;border-top:3px solid #1e8747;border-radius:7px;min-width:0}',
        '#db-stock-maximum .dbmx-chua-kpis>div:nth-child(3){border-top-color:#faca04}',
        '#db-stock-maximum .dbmx-chua-kpis span{display:block;font-size:10px;line-height:1.5;color:#557060}',
        '#db-stock-maximum .dbmx-chua-kpis strong{display:block;font-size:17px;color:#125c31;margin-top:5px;overflow-wrap:anywhere}',
        '#db-stock-maximum .dbmx-chua-kpis small{display:block;font-size:10px;color:#59715e;margin-top:3px}',
        '#db-stock-maximum .dbmx-chua-detail{padding:0 15px 12px}',
        '#db-stock-maximum .dbmx-chua-detail summary{cursor:pointer;padding:12px 3px;color:#125c31;font-weight:800}',
        '#db-stock-maximum .dbmx-chua-scroll{overflow-x:auto;max-height:410px;overflow-y:auto}',
        '#db-stock-maximum .dbmx-chua-scroll table{border-collapse:collapse;width:100%;min-width:1350px;font-size:10px}',
        '#db-stock-maximum .dbmx-chua-scroll th,#db-stock-maximum .dbmx-chua-scroll td{padding:8px;border-bottom:1px solid #e5ede7;text-align:left}',
        '#db-stock-maximum .dbmx-chua-scroll th{background:#f0f7f2;position:sticky;top:0;z-index:1}',
        '#db-stock-maximum .dbmx-chua-scroll td.num{text-align:right;white-space:nowrap}',
        '#db-stock-maximum .dbmx-chua-detail p{font-size:10px;color:#66766d}',
        '#db-stock-maximum .dbmx-chua-note{margin:0;padding:12px 17px;background:#f7faf8;border-top:1px solid #e2eae4;color:#54705d;font-size:10px;line-height:1.65}',
        '@media(max-width:950px){#db-stock-maximum .dbmx-chua-kpis{grid-template-columns:repeat(2,minmax(0,1fr))}}',
        '@media(max-width:620px){#db-stock-maximum .dbmx-chua-projection{margin:0 9px 14px}#db-stock-maximum .dbmx-chua-kpis{grid-template-columns:1fr}}',

        '#db-stock-maximum .dbmx-kpi strong{color:var(--db-green-dark,#125c31)}',
        '#db-stock-maximum .dbmx-kpi.need strong,#db-stock-maximum .dbmx-kpi.excess strong{color:var(--db-green-dark,#125c31)}',
        '#db-stock-maximum .dbmx-local:hover,#db-stock-maximum .dbmx-group:hover,#db-stock-maximum button[aria-expanded="true"]{background:var(--db-green-pale,#f3f9f5)}',
        '#db-stock-maximum .dbmx-local[aria-expanded="true"]{border-left:3px solid var(--db-yellow,#faca04)}',
        '#db-stock-maximum .dbmx-bar--need{background:var(--db-yellow-strong,#e9b900)}',
        '#db-stock-maximum .dbmx-bar--excess{background:var(--db-green,#1e8747)}',
        '#db-stock-maximum .dbmx-summary-need{color:#85640b}',
        '#db-stock-maximum .dbmx-summary-excess{color:var(--db-green-deep,#0d4726)}',
        '#db-stock-maximum .dbmx-summary-ok{color:var(--db-green-strong,#16733b)}',
        '#db-stock-maximum .dbmx-summary-history{color:var(--db-muted,#67716b)}',
        '#db-stock-maximum .dbmx-legend--need{background:var(--db-yellow,#faca04)}',
        '#db-stock-maximum .dbmx-legend--excess{background:var(--db-green-dark,#125c31)}',
        '#db-stock-maximum .dbmx-legend--ok{background:#add6b8}',
        '#db-stock-maximum .dbmx-legend--history{background:#9ba69f}',
        '#db-stock-maximum tr.dbmx-state-need,#db-stock-maximum tr.dbmx-state-excess,#db-stock-maximum tr.dbmx-state-ok,#db-stock-maximum tr.dbmx-state-history{background:transparent}',
        '#db-stock-maximum table tbody tr:nth-child(2n){background:#f7faf8!important}',
        '#db-stock-maximum tr.dbmx-state-need td:first-child,#db-stock-maximum tr.dbmx-state-excess td:first-child,#db-stock-maximum tr.dbmx-state-ok td:first-child,#db-stock-maximum tr.dbmx-state-history td:first-child{border-left:0}',
        '#db-stock-maximum .dbmx-status{display:inline-block;white-space:normal;padding:4px 7px;border-radius:5px;font-size:10px;border:1px solid var(--db-line,#d8e4dc)}',
        '#db-stock-maximum .dbmx-status--need{background:var(--db-yellow-soft,#fff6c7);border-color:#f1d95f;color:#775703}',
        '#db-stock-maximum .dbmx-status--excess{background:var(--db-green-soft,#e6f3eb);color:var(--db-green-deep,#0d4726)}',
        '#db-stock-maximum .dbmx-status--ok{background:#f1f8f3;color:var(--db-green-dark,#125c31)}',
        '#db-stock-maximum .dbmx-status--history{background:#f4f6f4;color:var(--db-muted,#67716b)}',
        '#db-stock-maximum .dbmx-need{color:#86620a}',
        '#db-stock-maximum .dbmx-warn{color:var(--db-green-dark,#125c31)}',
        '#db-stock-maximum .dbmx-detail,#db-stock-maximum .dbmx-products{background:var(--db-green-pale,#f3f9f5)}',
        '#db-stock-maximum .dbmx-withdrawals{display:block;margin-top:7px;font-size:10px;font-weight:500;line-height:1.5;color:var(--db-green-deep,#0d4726);max-width:100%;overflow-wrap:anywhere}',
        '#db-stock-maximum .dbmx-withdrawals b{font-weight:800}',
        '#db-stock-maximum .dbmx-period-withdrawals{line-height:1.6;color:var(--db-green-dark,#125c31);font-weight:600}',
        '#db-stock-maximum .dbmx-withdrawn-cell{font-weight:750;color:var(--db-green-dark,#125c31);white-space:normal;min-width:110px}',
        '#db-stock-maximum .dbmx-local,#db-stock-maximum .dbmx-group{grid-template-columns:minmax(210px,2fr) minmax(160px,1fr) minmax(160px,1fr);gap:12px;padding:10px 12px}',
        '#db-stock-maximum .dbmx-local .dbmx-name,#db-stock-maximum .dbmx-group .dbmx-name{font-size:12px;color:var(--db-green-deep,#0d4726)}',
        '#db-stock-maximum .dbmx-metric{display:flex;gap:3px;flex-direction:column;border-left:3px solid;padding:5px 11px;border-radius:3px;font-size:10px;line-height:1.4}',
        '#db-stock-maximum .dbmx-metric strong{font-size:13px;font-weight:850}',
        '#db-stock-maximum .dbmx-metric--need{background:var(--db-yellow-soft,#fff6c7);border-color:var(--db-yellow,#faca04);color:#6e5706}',
        '#db-stock-maximum .dbmx-metric--need strong{color:#6e5706}',
        '#db-stock-maximum .dbmx-metric--excess{background:var(--db-green-soft,#e6f3eb);border-color:var(--db-green-dark,#125c31);color:var(--db-green-deep,#0d4726)}',
        '#db-stock-maximum .dbmx-metric--excess strong{color:var(--db-green-deep,#0d4726)}',
        '#db-stock-maximum .dbmx-local-block>.dbmx-detail{margin:0 4px 12px 18px;padding:6px 12px}',
        '#db-stock-maximum .dbmx-legend{margin-bottom:12px}',
        // Tabela no tamanho do painel, sem rolagem horizontal. Todas as colunas permanecem acessiveis.
        '#db-stock-maximum .dbmx-products{box-sizing:border-box;min-width:0;max-width:100%;container-type:inline-size;container-name:dbmx-itemspace}',
        '#db-stock-maximum .dbmx-scroll{box-sizing:border-box;max-width:100%;width:100%;min-width:0;overflow-x:hidden;overflow-y:auto}',
        '#db-stock-maximum .dbmx-scroll table{table-layout:fixed;min-width:0!important;width:100%!important;max-width:100%;border-collapse:collapse}',
        '#db-stock-maximum .dbmx-scroll th,#db-stock-maximum .dbmx-scroll td{box-sizing:border-box;min-width:0;max-width:none;padding:8px 4px;text-align:center;white-space:normal!important;overflow-wrap:anywhere;line-height:1.35;vertical-align:middle}',
        '#db-stock-maximum .dbmx-scroll td.num{white-space:normal!important;text-align:center!important}',
        '#db-stock-maximum .dbmx-scroll th{font-size:9px;letter-spacing:0;hyphens:auto}',
        '#db-stock-maximum .dbmx-scroll td{font-size:10px}',
        '#db-stock-maximum .dbmx-scroll td.dbmx-product,#db-stock-maximum .dbmx-scroll th:nth-child(2){text-align:left}',
        '#db-stock-maximum .dbmx-scroll td.dbmx-status-cell{text-align:left}',
        '#db-stock-maximum .dbmx-scroll .dbmx-status{max-width:100%;overflow-wrap:anywhere}',
        '#db-stock-maximum .dbmx-order-note{padding:7px 10px;background:var(--db-green-pale,#f3f9f5);color:var(--db-green-dark,#125c31);font-size:10px;line-height:1.5;border:1px solid var(--db-line,#d8e4dc);border-bottom:0}',
        // A tabela de produtos permanece na horizontal, com colunas proporcionais ao espaço.
        '#db-stock-maximum .dbmx-scroll table{display:table!important;table-layout:fixed;min-width:0!important;width:100%!important;max-width:100%}',
        '#db-stock-maximum .dbmx-scroll thead{display:table-header-group!important}',
        '#db-stock-maximum .dbmx-scroll tbody{display:table-row-group!important}',
        '#db-stock-maximum .dbmx-scroll colgroup{display:table-column-group!important}',
        '#db-stock-maximum .dbmx-scroll tbody tr{display:table-row!important;background:transparent;border:0;margin:0}',
        '#db-stock-maximum .dbmx-scroll tbody td{display:table-cell!important;width:auto;min-height:0;vertical-align:middle}',
        '#db-stock-maximum .dbmx-scroll tbody td::before{content:none!important}',
        '#db-stock-maximum .dbmx-scroll th{padding:8px 4px;background:var(--db-green-deep,#0d4726);color:#fff}',
        '#db-stock-maximum .dbmx-scroll tbody tr:nth-child(2n){background:var(--db-green-pale,#f3f9f5)!important}',
        '#db-stock-maximum .dbmx-scroll tbody tr:nth-child(2n+1){background:#fff!important}',
        '#db-stock-maximum .dbmx-scroll tbody tr[hidden]{display:none!important}',
        '#db-stock-maximum .dbmx-scroll th.dbmx-status-filter-th{vertical-align:middle}',
        '#db-stock-maximum .dbmx-scroll th #dbmx-table-status{box-sizing:border-box;display:block;min-width:0;width:100%;max-width:100%;min-height:25px!important;margin:6px 0 0;padding:2px 3px!important;border-radius:5px;border:1px solid #a7cfb6;background:#fff;color:var(--db-green-deep,#0d4726);font-size:10px;font-weight:750;line-height:1.3;cursor:pointer}',
        '#db-stock-maximum .dbmx-scroll th #dbmx-table-status:focus-visible{outline:2px solid var(--db-yellow,#faca04);outline-offset:1px}',
        '#db-stock-maximum .dbmx-product-chart{display:inline;background:transparent;border:0;padding:2px 0;text-align:left;color:var(--db-green-deep,#0d4726);font:inherit;font-weight:800;line-height:1.4;text-decoration:underline;text-decoration-color:#a4cdb5;text-underline-offset:3px;cursor:pointer}',
        '#db-stock-maximum .dbmx-product-chart:hover{color:#167b41;text-decoration-color:#167b41}',
        '#db-stock-maximum .dbmx-product-chart:focus-visible{outline:2px solid var(--db-yellow,#faca04);outline-offset:2px;border-radius:2px}',
        '.dbmx-monthly-dialog{box-sizing:border-box;width:min(850px,calc(100vw - 24px));max-width:none;max-height:calc(100dvh - 32px);margin:auto;padding:0;border:1px solid #bddec8;border-radius:14px;background:#fff;color:#174e30;box-shadow:0 20px 60px rgba(0,0,0,.22);overflow:auto}',
        '.dbmx-monthly-dialog::backdrop{background:rgba(8,39,24,.65)}',
        '.dbmx-monthly-head{display:flex;align-items:flex-start;justify-content:space-between;gap:16px;padding:17px 22px;border-bottom:3px solid #faca04;background:#0d542e;color:#fff}',
        '.dbmx-monthly-head span{font-size:10px;font-weight:800;letter-spacing:.08em;color:#d8ebde}',
        '.dbmx-monthly-head h2{margin:6px 0 0;font-size:20px;line-height:1.35;color:#fff}',
        '.dbmx-monthly-head button{flex:none;padding:7px 12px;border:1px solid #b3d2bf;border-radius:7px;background:#fff;color:#114e2c;font-size:12px;font-weight:750;cursor:pointer}',
        '.dbmx-monthly-content{padding:18px 22px 24px}',
        '.dbmx-monthly-context{margin-bottom:10px;font-size:12px;line-height:1.6}',
        '.dbmx-monthly-note,.dbmx-monthly-footnote{font-size:11px;line-height:1.65;color:#536d5d}',
        '.dbmx-monthly-empty{padding:20px;border:1px dashed #bdd5c5;border-radius:8px;font-size:13px}',
        '.dbmx-monthly-unit{margin:22px 0 0;border-top:1px solid #e0ebe4;padding-top:13px}',
        '.dbmx-monthly-unit h3{display:flex;justify-content:space-between;gap:15px;flex-wrap:wrap;margin:0 0 16px;font-size:15px}',
        '.dbmx-monthly-unit h3 small{font-size:12px;font-weight:650;color:#526d5e}',
        '.dbmx-monthly-year{margin:0 0 20px}',
        '.dbmx-monthly-year h4{margin:0 0 8px;font-size:13px;color:#124d2c}',
        '.dbmx-monthly-horizontal{width:100%;overflow-x:auto;padding:2px 0 8px}',
        '.dbmx-monthly-bars{display:grid;grid-template-columns:repeat(12,minmax(44px,1fr));gap:8px;align-items:end;min-width:600px;border-bottom:2px solid #d7e6dc;background:repeating-linear-gradient(to top,#eef4ef 0,#eef4ef 1px,transparent 1px,transparent 40px)}',
        '.dbmx-monthly-month{display:flex;flex-direction:column;justify-content:flex-end;align-items:center;min-width:0;text-align:center;border:0;background:transparent;color:inherit;cursor:pointer;padding:0;font:inherit}',
        '.dbmx-monthly-month:hover .dbmx-monthly-bar,.dbmx-monthly-month[aria-pressed="true"] .dbmx-monthly-bar{outline:3px solid #e7b512;outline-offset:2px}',
        '.dbmx-monthly-month:focus-visible{outline:2px solid #e7b512;outline-offset:2px;border-radius:5px}',
        '.dbmx-monthly-tip{font-size:12px;font-weight:750;color:#14653a;background:#e8f5eb;border:1px solid #c6ddcc;border-radius:7px;padding:8px 10px}',
        '.dbmx-result-centers{margin-top:20px;padding:14px 16px;border:1px solid #bcd9c4;border-radius:10px;background:#f8fbf8}',
        '.dbmx-result-centers[hidden]{display:none!important}',
        '.dbmx-result-centers h3{margin:0 0 6px;font-size:16px}',
        '.dbmx-center-caption,.dbmx-center-source{font-size:11px;color:#4f6e5a;line-height:1.55}',
        '.dbmx-center-coverage{font-size:12px;line-height:1.65;padding:10px;border-radius:6px;margin:10px 0;border-left:4px solid #dba900;background:#fff8db}',
        '.dbmx-center-coverage.is-matched{background:#e9f6ed;border-left-color:#188049}',
        '.dbmx-center-empty{font-size:12px;line-height:1.6;padding:14px;background:#fff;border:1px dashed #c6d8c8;border-radius:6px}',
        '.dbmx-center-scroll{overflow-x:auto;max-height:300px;overflow-y:auto}',
        '.dbmx-center-scroll table{border-collapse:collapse;width:100%;font-size:12px}',
        '.dbmx-center-scroll th{background:#0d542e;color:#fff;text-align:left;padding:9px;position:sticky;top:0}',
        '.dbmx-center-scroll td{border-bottom:1px solid #dce9dd;padding:9px}',
        '.dbmx-center-scroll td.num{text-align:right;white-space:nowrap}',
        '.dbmx-monthly-amount{font-size:10px;font-weight:750;white-space:nowrap;color:#214b33}',
        '.dbmx-monthly-bar-zone{height:145px;width:70%;display:flex;align-items:flex-end;justify-content:center}',
        '.dbmx-monthly-bar{display:block;width:100%;min-height:0;border-radius:5px 5px 0 0;background:#188049}',
        '.dbmx-monthly-bar.is-zero{height:2px!important;background:#c4d8ca}',
        '.dbmx-monthly-bar.is-negative{background:#c36c3b}',
        '.dbmx-monthly-bar.is-partial{background:#d9aa17}',
        '.dbmx-monthly-month-label{font-size:11px;padding:6px 0;color:#365743;font-weight:700}',
        '@media(max-width:600px){.dbmx-monthly-head{padding:13px 14px}.dbmx-monthly-head h2{font-size:16px}.dbmx-monthly-content{padding:12px}.dbmx-monthly-bars{gap:5px}}',
        '#db-stock-maximum .dbmx-filter-count{font-weight:700;color:var(--db-green-dark,#125c31)}',
        '#db-stock-maximum .dbmx-filter-empty{margin:9px 0 0;padding:9px 10px;border:1px solid var(--db-line,#d8e4dc);background:#fff;font-size:11px;color:var(--db-muted,#67716b)}',
        '@media(max-width:1320px){#db-stock-maximum .dbmx-scroll th{font-size:9px;padding:6px 2px}#db-stock-maximum .dbmx-scroll td{font-size:10px;padding:6px 2px}}',
        '@media(max-width:920px){#db-stock-maximum .dbmx-scroll th{font-size:8px;padding:5px 1px}#db-stock-maximum .dbmx-scroll td{font-size:9px;padding:5px 1px}#db-stock-maximum .dbmx-scroll .dbmx-status{padding:2px 3px;font-size:8px}}',
        '@media(max-width:900px){#db-stock-maximum .dbmx-kpis{grid-template-columns:repeat(2,minmax(0,1fr))}#db-stock-maximum .dbmx-local,#db-stock-maximum .dbmx-group{min-width:640px}#db-stock-maximum .dbmx-list,#db-stock-maximum .dbmx-detail{overflow-x:auto}}',
        '@media(max-width:560px){#db-stock-maximum .dbmx-kpis{grid-template-columns:1fr}#db-stock-maximum .dbmx-filters{flex-direction:column;align-items:stretch}#db-stock-maximum label{min-width:0;width:100%}}',
        // Cartoes brancos e indicadores alinhados a direita, como o modelo CDI Chua fornecido.,
        '#db-stock-maximum .dbmx-list{background:#f8fafb;padding:18px 20px 24px;border-top:1px solid #e0e8e3}',,
        '#db-stock-maximum .dbmx-list-heading,#db-stock-maximum .dbmx-inner-heading{display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px;padding:4px 0 13px}',,
        '#db-stock-maximum .dbmx-list-heading h3,#db-stock-maximum .dbmx-inner-heading h3{margin:0;font-size:14px;color:var(--db-green-deep,#0d4726);font-weight:900}',,
        '#db-stock-maximum .dbmx-list-heading span,#db-stock-maximum .dbmx-inner-heading span{font-size:11px;color:#6d7e74}',,
        '#db-stock-maximum .dbmx-list .dbmx-local-block{margin:0 0 9px;min-width:0}',,
        '#db-stock-maximum .dbmx-list .dbmx-local,#db-stock-maximum .dbmx-list .dbmx-group{display:grid;grid-template-columns:minmax(240px,1fr) minmax(135px,165px) minmax(135px,165px);gap:16px;align-items:center;width:100%;box-sizing:border-box;min-width:0;min-height:62px;margin:0;padding:12px 16px;border:1px solid #d7e3e8!important;border-radius:10px;background:#fff!important;box-shadow:0 1px 3px rgba(21,61,43,.025);text-align:left}',,
        '#db-stock-maximum .dbmx-local:hover,#db-stock-maximum .dbmx-group:hover{border-color:#a9cdb8!important;background:#fbfdfb!important}',,
        '#db-stock-maximum .dbmx-local[aria-expanded="true"],#db-stock-maximum .dbmx-group[aria-expanded="true"]{border-color:#acd1b7!important;box-shadow:inset 3px 0 0 var(--db-yellow,#faca04)}',,
        '#db-stock-maximum .dbmx-list .dbmx-local .dbmx-name,#db-stock-maximum .dbmx-list .dbmx-group .dbmx-name{font-size:13px;line-height:1.45;font-weight:900;color:var(--db-green-deep,#0d4726)}',,
        '#db-stock-maximum .dbmx-arrow{color:var(--db-green,#1e8747);margin-right:9px;font-size:12px}',,
        '#db-stock-maximum .dbmx-list .dbmx-metric{display:flex;flex-direction:column;align-items:flex-start;justify-content:center;gap:6px;background:transparent!important;border:0!important;border-radius:0;padding:0!important;margin:0;min-height:35px}',,
        '#db-stock-maximum .dbmx-list .dbmx-metric span{font-size:9px;line-height:1.2;text-transform:uppercase;font-weight:850;letter-spacing:.025em;color:#65766c}',,
        '#db-stock-maximum .dbmx-list .dbmx-metric strong{font-size:14px;line-height:1.3;font-weight:900;color:var(--db-green-deep,#0d4726)}',,
        '#db-stock-maximum .dbmx-list .dbmx-metric--need span{color:#997100}',,
        '#db-stock-maximum .dbmx-list .dbmx-metric--excess span{color:var(--db-green-strong,#16733b)}',,
        '#db-stock-maximum .dbmx-detail{background:#fff;border:1px solid #e0e9e3;border-top:0;border-radius:0 0 10px 10px}',,
        '#db-stock-maximum .dbmx-local-block>.dbmx-detail{margin:0 3px 11px 17px;padding:12px 14px}',,
        '#db-stock-maximum .dbmx-group-wrap{margin:0 0 8px;border-bottom:0}',,
        '#db-stock-maximum .dbmx-group-wrap .dbmx-group{min-height:56px}',,
        '#db-stock-maximum .dbmx-products{max-width:100%;margin:0 0 14px 10px;padding:12px;border:1px solid #e0ebe3;border-left:3px solid #c3dacb;border-radius:0 0 9px 9px;background:#fff}',,
        '#db-stock-maximum .dbmx-legend{display:flex;gap:14px;margin:0 0 13px;font-size:10px}',,
        '@media(max-width:950px){#db-stock-maximum .dbmx-list .dbmx-local,#db-stock-maximum .dbmx-list .dbmx-group{grid-template-columns:minmax(180px,1fr) minmax(105px,135px) minmax(105px,135px);gap:12px;padding:11px 12px;min-width:0}#db-stock-maximum .dbmx-list,#db-stock-maximum .dbmx-detail{overflow-x:visible}}',,
        '@media(max-width:620px){#db-stock-maximum .dbmx-list .dbmx-local,#db-stock-maximum .dbmx-list .dbmx-group{grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}#db-stock-maximum .dbmx-list .dbmx-name{grid-column:1/-1}#db-stock-maximum .dbmx-list .dbmx-metric{grid-row:2}#db-stock-maximum .dbmx-list{padding:12px 9px 16px}#db-stock-maximum .dbmx-local-block>.dbmx-detail{margin:0 0 9px 8px;padding:10px 7px}}',,
        '#db-stock-maximum .dbmx-local:focus-visible,#db-stock-maximum .dbmx-group:focus-visible{outline:2px solid var(--db-yellow,#faca04);outline-offset:2px}'
      ].join('\n');
      document.head.appendChild(style);
    }
    return panel;
  }

  let timer=0;
  function normalizationNote(physical){
    const keys=new Set(physical.map(x=>str(x.codigo_local)+'|'+str(x.codigo)+'|'+norm(x.un)));
    const changes=(window.DB_APPROVED_STOCK_UNIT_AUDIT?.changes||[]).filter(x=>
      keys.has(str(x.codigo_local)+'|'+str(x.codigo)+'|'+norm(x.unidade)));
    if(!changes.length)return '';
    const precise=new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL',minimumFractionDigits:6,maximumFractionDigits:6});
    return '<details id="dbmx-unit-normalization-note" style="margin:0 18px 14px;padding:12px 16px;border:1px solid #c8dfd1;border-radius:8px;background:#f5faf7;color:#24523a;font-size:12px;line-height:1.6">'+
      '<summary style="cursor:pointer;font-weight:700">Unidade de estoque conferida · ver conversão aplicada</summary>'+
      changes.map(x=>'<p style="margin:8px 0 0"><b>'+esc(x.codigo)+' · '+esc(x.produto)+'</b> · '+esc(x.local)+': '+
        qty(x.saldoErpOriginal)+' rolos × '+qty(x.fator)+' metros = <b>'+qty(x.saldoNormalizado)+' metros</b>. '+
        'Custo por metro: '+precise.format(n(x.custoNormalizado))+'. Valor do estoque preservado: '+brl(x.valorNormalizado)+'.</p>').join('')+
      '</details>';
  }

  const renderPerformance={completed:0,skippedHidden:0,lastMs:0,maxMs:0};
  function render(reason){
    const panel=ensurePanel();
    if(!panel)return;
    // O painel antigo era recalculado em background toda vez que chegavam dados
    // do estoque/baixas, mesmo com o usuario em outra aba.
    if(!document.getElementById('view-minimo')?.classList.contains('active')){
      renderPerformance.skippedHidden++;
      return;
    }
    const started=performance.now();
    if(!window.CURRENT_STOCK_META||!window.MOVEMENTS_REVISED_META){
      panel.innerHTML='<p style="padding:20px">Preparando análise de estoque...</p>';
      return;
    }
    const all=items(),locals=aggregates(all);
    const physical=all.filter(x=>!x.network);
    const low=physical.filter(x=>x.need>0),high=physical.filter(x=>x.excess>0);
    const manual=physical.filter(x=>!x.reliable&&x.stock>0);
    const provisional=high.filter(x=>x.provisionalExcess);
    const confirmed=high.filter(x=>!x.provisionalExcess);
    const needValue=low.reduce((v,x)=>v+x.purchaseValue,0);
    const excessValue=high.reduce((v,x)=>v+x.excessValue,0);
    const provisionalValue=provisional.reduce((v,x)=>v+x.excessValue,0);
    const confirmedValue=confirmed.reduce((v,x)=>v+x.excessValue,0);
    const missingNeed=low.filter(x=>!x.hasCost).length;
    const missingExcess=high.filter(x=>!x.hasCost).length;
    const shared=sharedChuaPlan(physical,config.months);
    const found=locals.find(x=>x.local===config.local);
    const included=found?groups(found.rows):[];
    if(config.group&&!included.some(x=>x.name===config.group))config.group='';
    const selected=included.find(x=>x.name===config.group);
    const period=config.year==='2025'?'2025 · 12 meses completos':
      config.year==='2026'?'2026 · 10 meses completos até outubro':
      '2025 e 2026 · 22 meses completos até outubro/2026';
    const searchActive=reason==='search'&&document.activeElement?.id==='dbmx-search';
    const caret=searchActive?document.activeElement.selectionStart:0;
    panel.innerHTML='<div class="dbmx-head"><h2>Estoque mínimo / Estoque máximo</h2>'+
      '<div class="dbmx-sub">Um único comparativo entre o saldo atual, o mínimo de 2 meses, o máximo de '+config.months+
      ' meses, as baixas realizadas e as ações de compra ou redistribuição. '+esc(period)+
      '. Quantidades baixadas apuradas por unidade de medida, sem somar UN com KG ou LT.</div></div>'+
      '<div class="dbmx-filters"><label>Estoque máximo<select id="dbmx-months">'+
      [3,4,6].map(v=>'<option value="'+v+'"'+(v===config.months?' selected':'')+'>'+v+' meses</option>').join('')+
      '</select></label><label>Período das baixas<select id="dbmx-year">'+
      '<option value="">2025 + 2026</option>'+['2025','2026'].map(v=>'<option value="'+v+'"'+
      (v===config.year?' selected':'')+'>'+v+'</option>').join('')+'</select></label>'+
      '<label>Situação dos produtos<select id="dbmx-mode">'+
      [['all','Todos os produtos'],['actions','Repor ou excedente'],['need','Precisa repor'],
       ['excess','Acima do máximo'],['unknown','Revisar histórico']].map(([v,label])=>
         '<option value="'+v+'"'+(v===config.mode?' selected':'')+'>'+label+'</option>').join('')+
      '</select></label><label class="dbmx-search">Buscar código, produto ou grupo'+
      '<input id="dbmx-search" type="search" placeholder="Digite para filtrar" value="'+esc(config.query)+'"></label></div>'+
      '<div class="dbmx-kpis">'+
      '<div class="dbmx-kpi need"><span>Produtos abaixo do mínimo · físico</span><strong>'+int(low.length)+'</strong></div>'+
      '<div class="dbmx-kpi need"><span>Valor estimado de reposição</span><strong>'+brl(needValue)+'</strong></div>'+
      '<div class="dbmx-kpi excess"><span>Produtos com excedente · físico</span><strong>'+int(high.length)+'</strong>'+
      '<small>Confirmados: '+int(confirmed.length)+' · a revisar: '+int(provisional.length)+'</small></div>'+
      '<div class="dbmx-kpi excess"><span>Valor do excedente (inclui revisão)</span><strong>'+brl(excessValue)+'</strong>'+
      '<small>'+brl(provisionalValue)+' sem histórico suficiente</small></div>'+
      '<div class="dbmx-kpi"><span>Almoxarifados com compra ou excedente</span><strong>'+
      int(locals.filter(x=>!x.network&&(x.needCount>0||x.excessCount>0)).length)+'</strong></div>'+
      '<div class="dbmx-kpi"><span>Excedentes por histórico insuficiente</span><strong>'+int(provisional.length)+'</strong>'+
      '<small>Sem 3 meses com baixas; revisar antes de realocar</small></div>'+
      '</div>'+normalizationNote(physical)+shared.html+'<div class="dbmx-list"><div class="dbmx-list-heading"><h3>1. Almoxarifados</h3>'+
      '<span>Ordem: maior valor a repor primeiro. Clique para abrir grupos e produtos.</span></div>'+
      '<div class="dbmx-legend">'+
      '<span><b class="dbmx-legend--need"></b>Amarelo: Repor</span>'+
      '<span><b class="dbmx-legend--excess"></b>Verde: Excedente</span></div>'+
      locals.map(loc=>{
        const opened=loc.local===config.local;
        const row='<div class="dbmx-local-block"><button type="button" class="dbmx-local" data-dbmx-local="'+
          esc(loc.local)+'" aria-expanded="'+opened+'"><span class="dbmx-name">'+
          '<span class="dbmx-arrow" aria-hidden="true">'+(opened?'▾':'▸')+'</span>'+esc(loc.local)+
          (loc.network?' · rede (não somar ao físico)':'')+'</span>'+
          '<span class="dbmx-metric dbmx-metric--need"><span>Repor</span><strong>'+brl(loc.needValue)+'</strong></span>'+
          '<span class="dbmx-metric dbmx-metric--excess"><span>Excedente</span><strong>'+brl(loc.excessValue)+'</strong></span></button>';
        if(!opened)return row+'</div>';
        const expandedGroups=included.length?included.map(g=>{
          const groupOpen=config.group===g.name;
          const groupRow='<div class="dbmx-group-wrap"><button type="button" class="dbmx-group" data-dbmx-group="'+
            esc(g.name)+'" aria-expanded="'+groupOpen+'"><span class="dbmx-name">'+
            '<span class="dbmx-arrow" aria-hidden="true">'+(groupOpen?'▾':'▸')+'</span>'+
            esc(g.name)+'</span>'+
            '<span class="dbmx-metric dbmx-metric--need"><span>Repor</span><strong>'+brl(g.needValue)+'</strong></span>'+
            '<span class="dbmx-metric dbmx-metric--excess"><span>Excedente</span><strong>'+brl(g.excessValue)+'</strong></span></button>';
          return groupRow+(groupOpen?'<div class="dbmx-products" data-dbmx-products-for="'+esc(g.name)+
            '"><h3>Produtos · '+esc(g.name)+'</h3>'+itemTable(g.rows)+'</div>':'')+'</div>';
        }).join(''):'<p>Nenhum produto neste filtro.</p>';
        return row+'<div class="dbmx-detail" data-dbmx-detail-for="'+esc(loc.local)+'">'+
          '<div class="dbmx-inner-heading"><h3>Grupos de produtos</h3>'+
          '<span>Clique para abrir os itens</span></div>'+
          expandedGroups+'</div></div>';
      }).join('')+'</div>'+
      '<div class="dbmx-note"><b>Critérios:</b> mínimo de referência = média das baixas × 2 meses; máximo = média × '+
      config.months+' meses somente com histórico suficiente; a compra automática exige série confiável. '+
      'Excedente confirmado = máximo entre zero e (saldo − máximo); excedente a revisar = saldo físico quando o histórico tiver menos de 3 meses com baixas. '+
      'Valores são estimativas pelo custo de referência na mesma unidade de consumo, não economia já realizada. '+
      'Excedente confirmado = saldo acima do teto de '+config.months+' meses (com 3 ou mais meses com baixas e unidade consistente). '+
      'Com menos de 3 meses com baixas, todo saldo físico é sinalizado como excedente <b>provisório</b>: entra nos indicadores de excedente, '+
      'mas não gera compra nem transferência automática. Unidade divergente exige conferência. Pneus, câmaras e cimento '+
      'continuam excluídos. 2024 e novembro/2026 (parcial) não entram nas médias. '+
      'CDI de Peças Chuá usa demanda consolidada da rede e não integra os totais físicos, evitando dupla contagem. '+
      'Possíveis transferências são sugestões sujeitas a conferência de unidade, empresa fiscal e disponibilidade. '+
      'Identidade visual DB: verde e amarelo; alertas apresentados por etiquetas discretas. '+
      'A quantidade baixada considera somente os meses completos do período selecionado, separada por unidade, e não inclui transferências. Códigos com unidades diferentes são consolidados uma única vez. '+
      'Posição do estoque: '+esc(window.CURRENT_STOCK_META?.emissao||'não informada')+'. '+
      ((missingNeed||missingExcess)?'Sem custo ERP estimável: '+int(missingNeed)+' a repor e '+int(missingExcess)+
        ' em excesso (não incluídos nos valores).':'')+'</div>';
    if(searchActive){
      const input=panel.querySelector('#dbmx-search');
      input?.focus();
      try{input?.setSelectionRange(caret,caret);}catch(e){}
    }
    filterProductRows(panel);
    const meta={
      months:config.months,year:config.year||'2025+2026',stockDate:window.CURRENT_STOCK_META?.emissao||'',
      warehouseCount:locals.length,networkExcludedFromTotals:true,
      physicalNeedItems:low.length,physicalNeedValue:needValue,
      physicalExcessItems:high.length,physicalExcessValue:excessValue,
      provisionalExcessItems:provisional.length,provisionalExcessValue:provisionalValue,
      verifiedExcessItems:confirmed.length,verifiedExcessValue:confirmedValue,
      provisionalExcessNeedsValidation:true,provisionalExcessAutoTransfers:false,
      minimumHistoryActiveMonths:3,
      warehousesWithExcess:locals.filter(x=>!x.network&&x.excessCount>0).length,
      insufficientHistoryItems:manual.length,missingCostItems:missingExcess,
      minimumMonths:2,integrated:true,inlineCascade:true,colorCoding:true,brandPalette:'DB verde/amarelo',
      sharedChua:shared.summary,
      compactSummary:true,withdrawalDetailOnly:true,sortedByWithdrawalsDesc:config.tableSort==='withdrawals',sortedByReplenishmentValueDesc:config.tableSort==='value',tableSort:config.tableSort,fullWidthProducts:true,
      columnStatusFilter:true,columnStatusOptions:['all','need','excess'],
      screenshotCardLayout:true,tabLabel:'Estoque mínimo / Estoque máximo',
      allProductColumnsHorizontal:true,purchaseValueColumnHidden:true,
      withdrawalsFrom:'ERP_MOVEMENTS_YEARLY',withdrawalPeriodMonths:config.year==='2025'?12:config.year==='2026'?10:22,
      withdrawalTotalsPhysical:withdrawalsByUnit(physical),
      statusColors:{need:'db-yellow',excess:'db-green-dark',ok:'db-green-soft',history:'db-muted'},
      selectedLocal:config.local,selectedGroup:config.group,
      locations:locals.map(x=>({local:x.local,needItems:x.needCount,needValue:x.needValue,
        excessItems:x.excessCount,amount:x.excessValue,virtual:x.network,
        withdrawalTotals:withdrawalsByUnit(x.rows)}))
    };
    window.DB_STOCK_UNIFIED.meta=meta;
    window.DB_STOCK_MAXIMUM.meta=meta;
    renderPerformance.completed++;
    renderPerformance.lastMs=Math.round((performance.now()-started)*10)/10;
    renderPerformance.maxMs=Math.max(renderPerformance.maxMs,renderPerformance.lastMs);
  }

  function schedule(){clearTimeout(timer);timer=setTimeout(render,90);}
  const api={render,refresh:schedule,meta:null,performance:renderPerformance,
    getSummary(){
      if(!window.CURRENT_STOCK_META||!window.MOVEMENTS_REVISED_META)return null;
      const physical=items().filter(row=>!row.network),low=physical.filter(row=>row.need>0);
      return {value:low.reduce((sum,row)=>sum+row.purchaseValue,0),items:low.length,
        missingCostItems:low.filter(row=>!row.hasCost).length,
        minimumMonths:2,year:config.year||'2025 + 2026',networkExcludedFromTotals:true};
    },
    version:'20261113-lazy-min-max-performance-v1'};
  window.DB_STOCK_UNIFIED=api;
  window.DB_STOCK_MAXIMUM=api; // Retem os pontos de observacao da versao anterior.
  window.addEventListener('movements-updated',schedule);
  window.addEventListener('stock-position-updated',schedule);
  window.addEventListener('minimum-policy-updated',schedule);
  window.addEventListener('dashboard-ready',schedule);
  document.addEventListener('click',e=>{
    if(e.target?.closest?.('.tab[data-view="minimo"],.clean-sub-btn[data-view="minimo"]'))schedule();
  });
  render();
})();
