// Visao unica: estoque minimo e maximo pela mesma base ERP (2025-2026).
(function(){
  'use strict';
  if(window.DB_STOCK_UNIFIED)return;
  const config={months:4,year:'',mode:'all',local:'',group:'',query:''};
  const n=v=>Number(v)||0;
  const str=v=>String(v??'');
  const norm=v=>str(v).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toUpperCase();
  const esc=v=>str(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const brl=v=>new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(n(v));
  const qty=v=>new Intl.NumberFormat('pt-BR',{maximumFractionDigits:2}).format(n(v));
  const int=v=>new Intl.NumberFormat('pt-BR',{maximumFractionDigits:0}).format(n(v));
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
      if(exclude(s)||!str(s.local)||!str(s.codigo))continue;
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
      if(!x||!str(x.codigo)||!str(x.local))return;
      const vk=virtual(x),k=rowKey(x),stock=snapshots.get(k);
      if(result.has(k))return;
      const sourceKey=(vk?'REDE|':'LOCAL|')+(vk?str(x.codigo):key(x));
      const avg=Math.max(0,n(x.avg));
      const minimum=Math.max(0,n(x.minimum)||ceil(avg*2,x.un));
      const balance=vk?n(x.stock):(stock?stock.stock:n(x.stock));
      const cost=vk?n(x.cost):(stock?.cost||Math.max(0,n(x.cost)));
      const need=ceil(Math.max(0,minimum-balance),x.un);
      const months=vk?activity.network.get(str(x.codigo)):activity.locals.get(key(x));
      const perUnit=vk?activity.networkQty.get(str(x.codigo)):activity.localQty.get(key(x));
      const withdrawals=!assignedWithdrawals.has(sourceKey)&&perUnit?
        [...perUnit.entries()].map(([un,value])=>({un,value})).filter(x=>Math.abs(x.value)>1e-9):[];
      // Se o ERP listar o mesmo codigo/local em mais de uma unidade, mostrar as
      // quantidades por unidade em uma unica linha para nao duplicar o total.
      if(withdrawals.length)assignedWithdrawals.add(sourceKey);
      const count=months?.size??Math.max(0,n(x.active_month_buckets));
      const mixed=!vk&&activity.mix.has(key(x));
      // Um item com poucas baixas ou unidade divergente nao gera alerta automatico de maximo.
      const reliable=avg>0&&n(x.total)>0&&count>=3&&!mixed;
      const maximum=reliable?ceil(avg*config.months,x.un):null;
      const excess=reliable&&balance>maximum
        ?Math.max(0,remaining(balance-maximum,x.un)):0;
      const condition=need>0?'REPOR':excess>0?'ACIMA DO MÁXIMO':
        !reliable?'REVISAR HISTÓRICO':(balance<minimum*1.25?'ATENÇÃO':'DENTRO DA FAIXA');
      const item={
        local:str(x.local),codigo_local:str(x.codigo_local),grupo:str(x.grupo||'SEM GRUPO'),
        codigo:str(x.codigo),produto:str(x.produto),un:str(x.un),
        avg,minimum,stock:balance,maximum,need,excess,cost,
        purchaseValue:need*cost,excessValue:excess*cost,condition,reliable,
        active:count,withdrawals,hasCost:cost>0,network:vk,mixed,transfer:[]
      };
      result.set(k,item);
    }
    for(const x of Array.isArray(chosen)?chosen:[])push(x);
    // Posicoes sem baixa tambem precisam de visibilidade: sem teto automatico.
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
      if(row.network||row.excess<=0)continue;
      row.transfer=(demand.get(matchKey(row))||[])
        .filter(x=>x.local!==row.local).sort((a,b)=>b.need-a.need).slice(0,3)
        .map(x=>({local:x.local,qty:Math.min(row.excess,x.need)}));
    }
    return all;
  }

  function aggregates(rows){
    const map=new Map();
    if(typeof STOCK!=='undefined'&&Array.isArray(STOCK)){
      for(const s of STOCK){
        const local=str(s.local);
        if(local&&!map.has(local))map.set(local,{local,rows:[],needCount:0,excessCount:0,
          needValue:0,excessValue:0,withoutHistory:0,withoutCost:0,network:false});
      }
    }
    for(const x of rows){
      if(!map.has(x.local))map.set(x.local,{local:x.local,rows:[],needCount:0,
        excessCount:0,needValue:0,excessValue:0,withoutHistory:0,withoutCost:0,network:x.network});
      const a=map.get(x.local);
      a.rows.push(x);
      if(x.need>0){a.needCount++;a.needValue+=x.purchaseValue;if(!x.hasCost)a.withoutCost++;}
      if(x.excess>0){a.excessCount++;a.excessValue+=x.excessValue;if(!x.hasCost)a.withoutCost++;}
      if(!x.reliable&&x.stock>0)a.withoutHistory++;
    }
    return [...map.values()].sort((a,b)=>b.needValue+b.excessValue-a.needValue-a.excessValue||
      b.needCount+b.excessCount-a.needCount-a.excessCount||a.local.localeCompare(b.local,'pt-BR'));
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
    return [...out.values()].sort((a,b)=>b.needValue+b.excessValue-a.needValue-a.excessValue||
      b.rows.length-a.rows.length||a.name.localeCompare(b.name,'pt-BR'));
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
    if(kind==='excess')return 'EXCEDENTE DISPONÍVEL';
    if(kind==='history')return row.active===0?'SEM BAIXAS':'HISTÓRICO INSUFICIENTE';
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

  function itemTable(rows){
    const sorted=rows.slice().sort((a,b)=>
      (b.need>0?b.purchaseValue:0)+(b.excess>0?b.excessValue:0)-
      ((a.need>0?a.purchaseValue:0)+(a.excess>0?a.excessValue:0))||
      a.produto.localeCompare(b.produto,'pt-BR'));
    return '<div class="dbmx-scroll"><table><thead><tr>'+
      '<th>Código</th><th>Produto</th><th>UN</th><th>Qtd. baixada no período</th><th>Média/mês</th>'+
      '<th>Mínimo (2 meses)</th><th>Saldo atual</th><th>Máximo ('+config.months+' meses)</th>'+
      '<th>Qtd. a repor</th><th>Custo unit. ERP</th><th>Valor a comprar</th>'+
      '<th>Qtd. excedente</th><th>Valor excedente</th><th>Situação / possíveis transferências</th>'+
      '</tr></thead><tbody>'+sorted.map(x=>{
        const note=x.transfer.length?' · Possível transferência para '+x.transfer
          .map(o=>o.local+' ('+qty(o.qty)+' '+x.un+')').join('; '):'';
        const kind=statusKind(x);
        const warning=x.mixed?'Unidade de medida divergente. ':
          (!x.reliable&&x.need>0?'Estoque máximo depende de revisão do histórico. ':'');
        const explanation=kind==='ok'&&x.condition==='ATENÇÃO'?
          'Próximo do mínimo, mas sem compra necessária. ':(
            kind==='history'?'Não gerar alerta automático de máximo sem consumo suficiente. ':'');
        return '<tr class="dbmx-state-'+kind+'" data-dbmx-situation="'+esc(x.condition)+
          '" data-dbmx-color="'+kind+'"><td>'+esc(x.codigo)+'</td>'+
          '<td>'+esc(x.produto)+'</td><td>'+esc(x.un)+'</td>'+
          '<td class="num dbmx-withdrawn-cell" data-dbmx-withdrawn="'+
          esc(JSON.stringify(x.withdrawals))+'">'+esc(withdrawalText(x.withdrawals))+'</td>'+
          '<td class="num">'+(x.avg>0?qty(x.avg):'—')+'</td>'+
          '<td class="num">'+(x.avg>0?qty(x.minimum):'—')+'</td>'+
          '<td class="num">'+qty(x.stock)+'</td>'+
          '<td class="num">'+(x.maximum===null?'—':qty(x.maximum))+'</td>'+
          '<td class="num '+(x.need>0?'dbmx-need':'')+'">'+qty(x.need)+'</td>'+
          '<td class="num">'+(x.hasCost?brl(x.cost):'Não informado')+'</td>'+
          '<td class="num dbmx-need">'+(x.need>0&&!x.hasCost?'Sem custo':brl(x.purchaseValue))+'</td>'+
          '<td class="num '+(x.excess>0?'dbmx-warn':'')+'">'+qty(x.excess)+'</td>'+
          '<td class="num dbmx-warn">'+(x.excess>0&&!x.hasCost?'Sem custo':brl(x.excessValue))+'</td>'+
          '<td><strong class="dbmx-status dbmx-status--'+kind+'">'+esc(statusLabel(x))+'</strong>'+ 
          (warning||explanation||note?'<small class="dbmx-status-help">'+esc(warning+explanation+note.trim())+'</small>':'')+'</td></tr>';
      }).join('')+'</tbody></table></div>';
  }

  function ensurePanel(){
    const view=document.getElementById('view-minimo');
    if(!view)return null;
    // Mantem o DOM da analise antiga para compatibilidade, mas a exibicao e unica.
    view.classList.add('db-unified-stock');
    let panel=document.getElementById('db-stock-maximum');
    if(!panel){panel=document.createElement('section');panel.id='db-stock-maximum';view.appendChild(panel);}
    if(panel.parentElement!==view)view.appendChild(panel);
    if(!panel.dataset.dbmxEvents){
      panel.dataset.dbmxEvents='1';
      panel.addEventListener('change',e=>{
        const target=e.target;
        if(target.id==='dbmx-months')config.months=[3,4,6].includes(Number(target.value))?Number(target.value):4;
        else if(target.id==='dbmx-year')config.year=['2025','2026'].includes(target.value)?target.value:'';
        else if(target.id==='dbmx-mode')config.mode=['all','actions','need','excess','unknown'].includes(target.value)?target.value:'all';
        else return;
        config.group='';render();
      });
      panel.addEventListener('input',e=>{
        if(e.target.id!=='dbmx-search')return;
        config.query=e.target.value;
        clearTimeout(timer);timer=setTimeout(()=>render('search'),160);
      });
      panel.addEventListener('click',e=>{
        const local=e.target.closest('button[data-dbmx-local]');
        if(local){config.local=config.local===local.dataset.dbmxLocal?'':local.dataset.dbmxLocal;config.group='';render();return;}
        const group=e.target.closest('button[data-dbmx-group]');
        if(group){config.group=config.group===group.dataset.dbmxGroup?'':group.dataset.dbmxGroup;render();return;}
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
        '@media(max-width:900px){#db-stock-maximum .dbmx-kpis{grid-template-columns:repeat(2,minmax(0,1fr))}#db-stock-maximum .dbmx-local,#db-stock-maximum .dbmx-group{min-width:640px}#db-stock-maximum .dbmx-list,#db-stock-maximum .dbmx-detail{overflow-x:auto}}',
        '@media(max-width:560px){#db-stock-maximum .dbmx-kpis{grid-template-columns:1fr}#db-stock-maximum .dbmx-filters{flex-direction:column;align-items:stretch}#db-stock-maximum label{min-width:0;width:100%}}'
      ].join('\n');
      document.head.appendChild(style);
    }
    return panel;
  }

  let timer=0;
  function render(reason){
    const panel=ensurePanel();
    if(!panel)return;
    if(!window.CURRENT_STOCK_META||!window.MOVEMENTS_REVISED_META){
      panel.innerHTML='<p style="padding:20px">Preparando análise de estoque...</p>';
      return;
    }
    const all=items(),locals=aggregates(all);
    const physical=all.filter(x=>!x.network);
    const low=physical.filter(x=>x.need>0),high=physical.filter(x=>x.excess>0);
    const manual=physical.filter(x=>!x.reliable&&x.stock>0);
    const needValue=low.reduce((v,x)=>v+x.purchaseValue,0);
    const excessValue=high.reduce((v,x)=>v+x.excessValue,0);
    const missingNeed=low.filter(x=>!x.hasCost).length;
    const missingExcess=high.filter(x=>!x.hasCost).length;
    const found=locals.find(x=>x.local===config.local);
    const included=found?groups(found.rows):[];
    if(config.group&&!included.some(x=>x.name===config.group))config.group='';
    const selected=included.find(x=>x.name===config.group);
    const maxNeed=Math.max(1,...locals.map(x=>x.needValue)),maxExcess=Math.max(1,...locals.map(x=>x.excessValue));
    const period=config.year==='2025'?'2025 · 12 meses completos':
      config.year==='2026'?'2026 · 10 meses completos até outubro':
      '2025 e 2026 · 22 meses completos até outubro/2026';
    const searchActive=reason==='search'&&document.activeElement?.id==='dbmx-search';
    const caret=searchActive?document.activeElement.selectionStart:0;
    panel.innerHTML='<div class="dbmx-head"><h2>Análise integrada de estoque · Mínimo e Máximo</h2>'+
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
      '<div class="dbmx-kpi excess"><span>Produtos acima do máximo · físico</span><strong>'+int(high.length)+'</strong></div>'+
      '<div class="dbmx-kpi excess"><span>Valor estimado do excedente</span><strong>'+brl(excessValue)+'</strong></div>'+
      '<div class="dbmx-kpi"><span>Almoxarifados com compra ou excedente</span><strong>'+
      int(locals.filter(x=>!x.network&&(x.needCount>0||x.excessCount>0)).length)+'</strong></div>'+
      '<div class="dbmx-kpi"><span>Itens com saldo que exigem revisão do histórico</span><strong>'+int(manual.length)+'</strong></div>'+
      '</div><div class="dbmx-list"><h3>Almoxarifados · reposição e excedente na mesma análise</h3>'+
      '<div class="dbmx-legend">'+
      '<span><b class="dbmx-legend--need"></b>Amarelo: precisa repor</span>'+
      '<span><b class="dbmx-legend--excess"></b>Verde escuro: excedente disponível</span>'+
      '<span><b class="dbmx-legend--ok"></b>Verde claro: estoque adequado / atenção</span>'+
      '<span><b class="dbmx-legend--history"></b>Cinza: sem baixas / histórico insuficiente</span></div>'+
      locals.map(loc=>{
        const opened=loc.local===config.local;
        const needWidth=Math.max(0,100*loc.needValue/maxNeed).toFixed(2);
        const excessWidth=Math.max(0,100*loc.excessValue/maxExcess).toFixed(2);
        const row='<div class="dbmx-local-block"><button type="button" class="dbmx-local" data-dbmx-local="'+
          esc(loc.local)+'" aria-expanded="'+opened+'"><span class="dbmx-name">'+
          '<span class="dbmx-arrow" aria-hidden="true">'+(opened?'▾':'▸')+'</span>'+esc(loc.local)+
          (loc.network?' · rede (não somar ao físico)':'')+
          withdrawalSummary(loc.rows,loc.network?'Baixas da rede':'Qtd. baixada')+
          statusSummary(loc.rows)+'</span>'+
          '<span class="dbmx-metric"><span>Repor: '+int(loc.needCount)+' produtos · <strong>'+
          brl(loc.needValue)+'</strong></span><span class="dbmx-track"><span class="dbmx-bar dbmx-bar--need" style="width:'+
          needWidth+'%"></span></span></span>'+
          '<span class="dbmx-metric"><span>Excedente: '+int(loc.excessCount)+' produtos · <strong>'+
          brl(loc.excessValue)+'</strong></span><span class="dbmx-track"><span class="dbmx-bar dbmx-bar--excess" style="width:'+
          excessWidth+'%"></span></span></span></button>';
        if(!opened)return row+'</div>';
        const expandedGroups=included.length?included.map(g=>{
          const groupOpen=config.group===g.name;
          const groupsRow='<div class="dbmx-group-wrap"><button type="button" class="dbmx-group" data-dbmx-group="'+
            esc(g.name)+'" aria-expanded="'+groupOpen+'"><span class="dbmx-name">'+
            '<span class="dbmx-arrow" aria-hidden="true">'+(groupOpen?'▾':'▸')+'</span>'+
            esc(g.name)+' · '+int(g.rows.length)+' produtos'+
            withdrawalSummary(g.rows,'Qtd. baixada')+statusSummary(g.rows)+'</span>'+
            '<span class="dbmx-metric">A repor: '+int(g.needCount)+' · <strong>'+brl(g.needValue)+'</strong></span>'+
            '<span class="dbmx-metric">Em excesso: '+int(g.excessCount)+' · <strong>'+brl(g.excessValue)+
            '</strong></span></button>';
          return groupsRow+(groupOpen?'<div class="dbmx-products" data-dbmx-products-for="'+esc(g.name)+
            '"><h3>Produtos · '+esc(g.name)+'</h3>'+itemTable(g.rows)+'</div>':'')+'</div>';
        }).join(''):'<p>Nenhum produto neste filtro.</p>';
        return row+'<div class="dbmx-detail" data-dbmx-detail-for="'+esc(loc.local)+'">'+
          '<h3>'+esc(loc.local)+' · '+int(loc.needCount)+' produtos para repor ('+
          brl(loc.needValue)+') · '+int(loc.excessCount)+' acima do máximo ('+
          brl(loc.excessValue)+')</h3>'+
          '<p class="dbmx-period-withdrawals">Total baixado neste almoxarifado: '+
          esc(withdrawalText(withdrawalsByUnit(loc.rows)))+
          '. Selecione um grupo para abrir os produtos logo abaixo.</p>'+
          expandedGroups+'</div></div>';
      }).join('')+'</div>'+
      '<div class="dbmx-note"><b>Critérios:</b> mínimo = média das baixas × 2 meses; máximo = média × '+
      config.months+' meses; necessidade = máximo entre zero e (mínimo − saldo); excedente = máximo entre zero e '+
      '(saldo − máximo). Os valores são estimativas pelo custo unitário ERP, não economia já realizada. '+
      'O máximo automático exige pelo menos 3 meses com baixas e unidade consistente. Itens sem histórico '+
      'confiável permanecem visíveis para revisão, sem alerta automático de excesso. Pneus, câmaras e cimento '+
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
    const meta={
      months:config.months,year:config.year||'2025+2026',stockDate:window.CURRENT_STOCK_META?.emissao||'',
      warehouseCount:locals.length,networkExcludedFromTotals:true,
      physicalNeedItems:low.length,physicalNeedValue:needValue,
      physicalExcessItems:high.length,physicalExcessValue:excessValue,
      warehousesWithExcess:locals.filter(x=>!x.network&&x.excessCount>0).length,
      insufficientHistoryItems:manual.length,missingCostItems:missingExcess,
      minimumMonths:2,integrated:true,inlineCascade:true,colorCoding:true,brandPalette:'DB verde/amarelo',
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
  }

  function schedule(){clearTimeout(timer);timer=setTimeout(render,90);}
  const api={render,refresh:schedule,meta:null,version:'20261103-db-baixas-v3'};
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
