// Controle de estoque maximo. Usa as mesmas baixas ERP e saldos do estoque minimo.
(function(){
  'use strict';
  if(window.DB_STOCK_MAXIMUM)return;
  const state={months:4,year:'',mode:'excess',local:'',group:''};
  const number=x=>Number(x)||0;
  const clean=x=>String(x??'');
  const norm=x=>clean(x).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toUpperCase();
  const esc=x=>clean(x).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const money=x=>new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(number(x));
  const quantity=x=>new Intl.NumberFormat('pt-BR',{maximumFractionDigits:2}).format(number(x));
  const integer=x=>new Intl.NumberFormat('pt-BR',{maximumFractionDigits:0}).format(number(x));
  const special=new Set(['KG','LT','ML','MT','M2','M3','CM','GR']);
  const virtual=x=>x?.network_scope===true||norm(x?.local)==='CDI DE PECAS CHUA';
  const productKey=x=>clean(x.codigo_local)+'|'+clean(x.codigo);
  const matchKey=x=>clean(x.codigo)+'|'+norm(x.un);
  const excluded=x=>typeof window.DB_MINIMUM_EXCLUDED==='function'
    ?window.DB_MINIMUM_EXCLUDED(x):/\b(PNEUS?|CAMARAS?|CIMENTOS?)\b/.test(norm(x.grupo)+' '+norm(x.produto));
  const roundUp=(value,un)=>{
    const v=Math.max(0,number(value));
    if(typeof minimumRoundUp==='function')return minimumRoundUp(v,un);
    return special.has(norm(un))?Math.ceil((v-1e-10)*100)/100:Math.ceil(v-1e-10);
  };
  const roundQty=(value,un)=>special.has(norm(un))?Math.round(value*100)/100:Math.round(value);
  const suitableYear=y=>['2025','2026'].includes(y)&&(!state.year||state.year===y);
  const stockDate=()=>clean(window.CURRENT_STOCK_META?.emissao||'');

  function monthCounts(){
    const physical=new Map(),network=new Map(),mixed=new Set();
    for(const m of window.MOVEMENTS_REVISED_META?.mixedUnits||[])mixed.add(productKey(m));
    function accumulate(list,map,isNetwork){
      if(!Array.isArray(list))return;
      for(const entry of list){
        const year=clean(entry.year);
        if(!suitableYear(year))continue;
        const key=isNetwork?clean(entry.k??entry.codigo):productKey(entry);
        if(!key||key==='undefined|undefined')continue;
        let found=map.get(key);
        if(!found){found=new Set();map.set(key,found);}
        const months=Array.isArray(entry.months)?entry.months:[];
        const limit=year==='2026'?10:12; // Novembro/2026 ainda e parcial.
        for(let i=0;i<limit;i++)if(number(months[i])>0)found.add(year+'-'+i);
      }
    }
    accumulate(typeof MOVEMENTS_YEARLY==='undefined'?[]:MOVEMENTS_YEARLY,physical,false);
    accumulate(typeof CDI_NETWORK_YEARLY==='undefined'?[]:CDI_NETWORK_YEARLY,network,true);
    return {physical,network,mixed};
  }

  function calculate(){
    const rows=typeof minimumBaseRows==='function'?minimumBaseRows():
      (typeof MOVEMENTS==='undefined'?[]:MOVEMENTS);
    const base=Array.isArray(rows)?rows:[];
    const selected=state.year&&typeof minimumRowsForYear==='function'
      ?minimumRowsForYear(base,state.year):base;
    const counts=monthCounts(),seen=new Set(),result=[];
    for(const row of selected){
      if(!row||excluded(row)||!clean(row.codigo)||!clean(row.local))continue;
      const k=clean(row.local)+'|'+clean(row.codigo)+'|'+norm(row.un);
      if(seen.has(k))continue;
      seen.add(k);
      const network=virtual(row),avg=Math.max(0,number(row.avg)),stock=number(row.stock);
      const monthSet=network?counts.network.get(clean(row.codigo)):counts.physical.get(productKey(row));
      const active=monthSet?monthSet.size:Math.max(0,number(row.active_month_buckets));
      const mixed=!network&&counts.mixed.has(productKey(row));
      // Itens esporadicos e unidades inconsistentes exigem revisao manual.
      const reliable=avg>0&&number(row.total)>0&&active>=3&&!mixed;
      const maximum=reliable?roundUp(avg*state.months,row.un):null;
      const minimum=number(row.minimum)||roundUp(avg*2,row.un);
      const excess=reliable&&stock>maximum+1e-9
        ?Math.max(0,roundQty(stock-maximum,row.un)):0;
      const cost=Math.max(0,number(row.cost));
      const status=!reliable?'HISTÓRICO INSUFICIENTE':
        excess>0?'ACIMA DO MÁXIMO':
        stock<minimum-1e-9?'ABAIXO DO MÍNIMO':'DENTRO DA FAIXA';
      result.push({
        local:clean(row.local),grupo:clean(row.grupo||'SEM GRUPO'),codigo:clean(row.codigo),
        produto:clean(row.produto),un:clean(row.un),avg,stock,minimum,maximum,excess,cost,
        amount:cost*excess,need:Math.max(0,number(row.need)),status,active,
        network,hasCost:cost>0,mixed,transfers:[]
      });
    }
    // Transferencia e apenas uma oportunidade a verificar, nao uma movimentacao automatica.
    const demand=new Map();
    for(const row of result){
      if(row.network||!(row.need>0))continue;
      const key=matchKey(row);
      if(!demand.has(key))demand.set(key,[]);
      demand.get(key).push(row);
    }
    for(const row of result){
      if(row.network||!(row.excess>0))continue;
      const options=(demand.get(matchKey(row))||[])
        .filter(other=>other.local!==row.local&&other.need>0)
        .sort((a,b)=>b.need-a.need).slice(0,3);
      row.transfers=options.map(other=>({local:other.local,qty:Math.min(row.excess,other.need)}));
    }
    return result;
  }

  function warehouses(rows){
    const map=new Map();
    if(typeof STOCK!=='undefined'&&Array.isArray(STOCK)){
      for(const s of STOCK){
        const name=clean(s.local);
        if(name&&!map.has(name))map.set(name,{local:name,rows:[],excess:0,unknown:0,amount:0,uncosted:0,network:false});
      }
    }
    for(const row of rows){
      let entry=map.get(row.local);
      if(!entry){
        entry={local:row.local,rows:[],excess:0,unknown:0,amount:0,uncosted:0,network:row.network};
        map.set(row.local,entry);
      }
      entry.rows.push(row);
      if(row.excess>0){entry.excess++;entry.amount+=row.amount;if(!row.hasCost)entry.uncosted++;}
      if(row.status==='HISTÓRICO INSUFICIENTE'&&row.stock>0)entry.unknown++;
    }
    return [...map.values()].sort((a,b)=>b.amount-a.amount||b.excess-a.excess||a.local.localeCompare(b.local,'pt-BR'));
  }

  function visible(row){
    return state.mode==='all'||(state.mode==='excess'&&row.excess>0)||
      (state.mode==='unknown'&&row.status==='HISTÓRICO INSUFICIENTE'&&row.stock>0);
  }
  function groups(rows){
    const grouped=new Map();
    for(const row of rows.filter(visible)){
      const group=row.grupo||'SEM GRUPO';
      if(!grouped.has(group))grouped.set(group,{name:group,rows:[],amount:0,excess:0,unknown:0});
      const entry=grouped.get(group);entry.rows.push(row);entry.amount+=row.amount;
      if(row.excess>0)entry.excess++;
      if(row.status==='HISTÓRICO INSUFICIENTE')entry.unknown++;
    }
    return [...grouped.values()].sort((a,b)=>b.amount-a.amount||b.excess-a.excess||a.name.localeCompare(b.name,'pt-BR'));
  }
  function productTable(rows){
    const sorted=rows.slice().sort((a,b)=>b.amount-a.amount||b.excess-a.excess||a.produto.localeCompare(b.produto,'pt-BR'));
    return '<div class="dbmx-scroll"><table><thead><tr>'+
      '<th>Código</th><th>Produto</th><th>UN</th><th>Média/mês</th><th>Mínimo (2 meses)</th>'+
      '<th>Máximo ('+state.months+' meses)</th><th>Saldo atual</th><th>Qtd. excedente</th>'+
      '<th>Custo unit. ERP</th><th>Valor excedente</th><th>Meses com baixas</th><th>Situação / possível destino</th>'+
      '</tr></thead><tbody>'+sorted.map(row=>{
        const transfer=row.transfers.length?' · Verificar transferência para '+row.transfers
          .map(t=>t.local+' ('+quantity(t.qty)+' '+row.un+')').join('; '):'';
        const condition=row.status+(row.mixed?' · unidades divergentes':'')+transfer;
        return '<tr><td>'+esc(row.codigo)+'</td><td>'+esc(row.produto)+'</td>'+
          '<td>'+esc(row.un)+'</td><td class="num">'+quantity(row.avg)+'</td>'+
          '<td class="num">'+quantity(row.minimum)+'</td>'+
          '<td class="num">'+(row.maximum===null?'—':quantity(row.maximum))+'</td>'+
          '<td class="num">'+quantity(row.stock)+'</td>'+
          '<td class="num '+(row.excess?'dbmx-warn':'')+'">'+quantity(row.excess)+'</td>'+
          '<td class="num">'+(row.hasCost?money(row.cost):'Não informado')+'</td>'+
          '<td class="num dbmx-warn">'+(row.excess&&!row.hasCost?'Não estimado':money(row.amount))+'</td>'+
          '<td class="num">'+integer(row.active)+'</td>'+
          '<td>'+esc(condition)+'</td></tr>';
      }).join('')+'</tbody></table></div>';
  }

  let timer=0,rendered=false;
  function ensurePanel(){
    const view=document.getElementById('view-minimo');
    if(!view)return null;
    let panel=document.getElementById('db-stock-maximum');
    if(!panel){
      panel=document.createElement('section');panel.id='db-stock-maximum';
      const sibling=document.getElementById('db-minimum-all-locals');
      if(sibling&&sibling.parentElement===view)sibling.after(panel);
      else view.appendChild(panel);
      panel.addEventListener('change',event=>{
        const target=event.target;
        if(target.id==='dbmx-months')state.months=[3,4,6].includes(Number(target.value))?Number(target.value):4;
        else if(target.id==='dbmx-year')state.year=['2025','2026'].includes(target.value)?target.value:'';
        else if(target.id==='dbmx-mode')state.mode=['excess','all','unknown'].includes(target.value)?target.value:'excess';
        else return;
        state.group='';draw();
      });
      panel.addEventListener('click',event=>{
        const local=event.target.closest('button[data-dbmx-local]');
        if(local){
          state.local=state.local===local.dataset.dbmxLocal?'':local.dataset.dbmxLocal;
          state.group='';draw();
          return;
        }
        const group=event.target.closest('button[data-dbmx-group]');
        if(group){
          state.group=state.group===group.dataset.dbmxGroup?'':group.dataset.dbmxGroup;
          draw();
        }
      });
    }
    if(!document.getElementById('db-stock-maximum-css')){
      const style=document.createElement('style');style.id='db-stock-maximum-css';
      style.textContent=[
        '#db-stock-maximum{margin:20px 0;border:1px solid #d3e2d7;border-radius:14px;background:#fff;overflow:hidden;color:#203c2c;font:12px Arial,Helvetica,sans-serif}',
        '#db-stock-maximum .dbmx-head{padding:17px 19px;background:#eaf5ed;border-bottom:1px solid #d5e3d9}',
        '#db-stock-maximum h2{font-size:19px;margin:0 0 6px;color:#145a34}',
        '#db-stock-maximum .dbmx-sub{color:#587262;font-size:12px;line-height:1.5}',
        '#db-stock-maximum .dbmx-filters{display:flex;gap:12px;flex-wrap:wrap;padding:14px 19px}',
        '#db-stock-maximum label{display:flex;flex-direction:column;gap:5px;font-size:11px;font-weight:700}',
        '#db-stock-maximum select{min-height:35px;min-width:165px;padding:6px 8px;border:1px solid #bccfc3;border-radius:7px;background:#fff;color:#235638}',
        '#db-stock-maximum .dbmx-kpis{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px;padding:0 19px 15px}',
        '#db-stock-maximum .dbmx-kpi{background:#f6faf7;border:1px solid #dbe8df;border-radius:9px;padding:13px}',
        '#db-stock-maximum .dbmx-kpi span{font-size:11px;color:#5b7464;display:block}',
        '#db-stock-maximum .dbmx-kpi strong{display:block;margin-top:7px;font-size:20px;color:#11582f;overflow-wrap:anywhere}',
        '#db-stock-maximum .dbmx-list{padding:0 19px 14px}',
        '#db-stock-maximum .dbmx-list h3{font-size:13px;margin:7px 0 11px;color:#225d39}',
        '#db-stock-maximum .dbmx-local,#db-stock-maximum .dbmx-group{display:grid;grid-template-columns:minmax(160px,2fr) minmax(95px,4fr) 115px 110px;gap:11px;align-items:center;width:100%;border:0;border-bottom:1px solid #e4ece6;padding:9px 5px;background:#fff;text-align:left;cursor:pointer;font-size:11px;color:#2d4135}',
        '#db-stock-maximum .dbmx-local:hover,#db-stock-maximum .dbmx-group:hover,#db-stock-maximum button[aria-expanded="true"]{background:#eef8f1}',
        '#db-stock-maximum .dbmx-track{height:13px;background:#ebeff0;border-radius:12px;overflow:hidden}',
        '#db-stock-maximum .dbmx-bar{height:100%;display:block;background:linear-gradient(90deg,#edbc65,#d3840b);border-radius:12px}',
        '#db-stock-maximum .dbmx-num{font-weight:800;text-align:right;color:#1d5b38}',
        '#db-stock-maximum .dbmx-detail{margin:0 19px 16px;padding:14px;background:#f8fbf8;border:1px solid #dce9df;border-radius:9px}',
        '#db-stock-maximum .dbmx-detail h3{margin:0 0 10px;font-size:14px}',
        '#db-stock-maximum .dbmx-group{grid-template-columns:minmax(170px,2fr) minmax(100px,4fr) 105px 105px}',
        '#db-stock-maximum .dbmx-scroll{max-height:430px;overflow:auto;background:#fff;border:1px solid #e0eae3}',
        '#db-stock-maximum table{border-collapse:collapse;width:100%;min-width:1310px;font-size:10px}',
        '#db-stock-maximum th,#db-stock-maximum td{padding:9px;border-bottom:1px solid #e8eee9;text-align:left}',
        '#db-stock-maximum th{position:sticky;top:0;background:#eaf5ed;z-index:1}',
        '#db-stock-maximum td.num{text-align:right;white-space:nowrap}',
        '#db-stock-maximum .dbmx-warn{color:#a4580a;font-weight:750}',
        '#db-stock-maximum .dbmx-note{padding:12px 19px;border-top:1px solid #e2e9e4;color:#577063;line-height:1.5;font-size:11px}',
        '@media(max-width:900px){#db-stock-maximum .dbmx-kpis{grid-template-columns:repeat(2,minmax(0,1fr))}#db-stock-maximum .dbmx-local,#db-stock-maximum .dbmx-group{min-width:520px}#db-stock-maximum .dbmx-list,#db-stock-maximum .dbmx-detail{overflow-x:auto}}',
        '@media(max-width:520px){#db-stock-maximum .dbmx-kpis{grid-template-columns:1fr}#db-stock-maximum .dbmx-filters label,#db-stock-maximum select{width:100%}}'
      ].join('\n');
      document.head.appendChild(style);
    }
    return panel;
  }

  function draw(){
    const panel=ensurePanel();
    if(!panel)return;
    if(!window.CURRENT_STOCK_META||!window.MOVEMENTS_REVISED_META){panel.textContent='Preparando controle de estoque máximo...';return;}
    const rows=calculate(),locations=warehouses(rows);
    const physical=rows.filter(row=>!row.network),above=physical.filter(row=>row.excess>0);
    const unknown=physical.filter(row=>row.status==='HISTÓRICO INSUFICIENTE'&&row.stock>0);
    const realAmount=above.reduce((sum,row)=>sum+row.amount,0);
    const missingCosts=above.filter(row=>!row.hasCost).length;
    const needLocals=new Set(above.map(row=>row.local)).size;
    const period=state.year==='2025'?'2025 · 12 meses completos':
      state.year==='2026'?'2026 · janeiro a outubro (10 meses fechados)':
      '2025 e 2026 · 22 meses completos (até outubro/2026)';
    const found=locations.find(l=>l.local===state.local);
    const maxAmount=Math.max(1,...locations.map(l=>l.amount));
    const selected=found?groups(found.rows):[];
    if(state.group&&!selected.some(g=>g.name===state.group))state.group='';
    const openGroup=selected.find(g=>g.name===state.group);
    panel.innerHTML='<div class="dbmx-head"><h2>Controle de estoque máximo</h2>'+
      '<div class="dbmx-sub">Evite capital parado e compras desnecessárias. Mínimo permanece em 2 meses; máximo inicial em 4 meses, ajustável. '+esc(period)+'.</div></div>'+
      '<div class="dbmx-filters"><label>Limite máximo<select id="dbmx-months">'+
      [3,4,6].map(m=>'<option value="'+m+'"'+(state.months===m?' selected':'')+'>'+m+' meses de consumo</option>').join('')+
      '</select></label><label>Ano das baixas<select id="dbmx-year"><option value="">2025 + 2026</option>'+
      ['2025','2026'].map(y=>'<option value="'+y+'"'+(state.year===y?' selected':'')+'>'+y+'</option>').join('')+
      '</select></label><label>Produtos exibidos<select id="dbmx-mode">'+
      [['excess','Acima do máximo'],['all','Todos os produtos'],['unknown','Sem histórico confiável']].map(p=>
        '<option value="'+p[0]+'"'+(state.mode===p[0]?' selected':'')+'>'+p[1]+'</option>').join('')+
      '</select></label></div>'+
      '<div class="dbmx-kpis">'+
      '<div class="dbmx-kpi"><span>Produtos acima do máximo</span><strong>'+integer(above.length)+'</strong></div>'+
      '<div class="dbmx-kpi"><span>Valor estimado do excedente</span><strong>'+money(realAmount)+'</strong></div>'+
      '<div class="dbmx-kpi"><span>Almoxarifados com excedente</span><strong>'+integer(needLocals)+'</strong></div>'+
      '<div class="dbmx-kpi"><span>Com estoque, sem histórico confiável</span><strong>'+integer(unknown.length)+'</strong></div></div>'+
      '<div class="dbmx-list"><h3>Excedente por almoxarifado · clique para abrir os grupos</h3>'+
      locations.map(local=>{
        const width=(local.amount/maxAmount*100).toFixed(2)+'%';
        return '<button type="button" class="dbmx-local" data-dbmx-local="'+esc(local.local)+'" aria-expanded="'+(state.local===local.local)+'">'+
          '<span title="'+esc(local.local)+'">'+esc(local.local)+(local.network?' (rede / informativo)':'')+'</span>'+
          '<span class="dbmx-track"><span class="dbmx-bar" style="width:'+width+'"></span></span>'+
          '<span class="dbmx-num">'+integer(local.excess)+' itens</span>'+
          '<span class="dbmx-num">'+money(local.amount)+'</span></button>';
      }).join('')+'</div>'+
      (found?'<div class="dbmx-detail"><h3>'+esc(found.local)+' · '+integer(found.excess)+' produtos excedentes · '+money(found.amount)+'</h3>'+
        (selected.length?selected.map(group=>{
          return '<button type="button" class="dbmx-group" data-dbmx-group="'+esc(group.name)+'" aria-expanded="'+(state.group===group.name)+'">'+
            '<span>'+esc(group.name)+'</span><span>'+integer(group.rows.length)+' itens selecionados</span>'+
            '<span class="dbmx-num">'+integer(group.excess)+' excedentes</span>'+
            '<span class="dbmx-num">'+money(group.amount)+'</span></button>';
        }).join(''):'<p>Não há produtos neste filtro para este almoxarifado.</p>')+
        (openGroup?'<h3 style="margin-top:15px">Produtos · '+esc(openGroup.name)+'</h3>'+productTable(openGroup.rows):'')+
        '</div>':'')+
      '<div class="dbmx-note">Cálculo: máximo = média mensal das baixas ERP × meses selecionados; excedente = saldo físico menos máximo, quando positivo. '+
      'O valor do excedente usa o custo unitário ERP e representa capital estimado no estoque, não economia realizada. '+
      'Os alertas exigem ao menos 3 meses fechados com baixas e unidade de medida consistente; produtos sem esse histórico ficam separados. '+
      'Pneus, câmaras e cimento não entram no cálculo. Novembro/2026 parcial e o ano de 2024 não compõem a média. '+
      'CDI de Peças Chuá é visão da rede e não é somado aos indicadores físicos, para evitar duplicidade com Chuá. '+
      'Possíveis transferências exigem conferência de unidade, empresa fiscal e disponibilidade. Posição do estoque: '+esc(stockDate())+'.'+
      (missingCosts?' '+integer(missingCosts)+' itens excedentes sem custo ERP não integram o valor estimado.':'')+
      '</div>';
    window.DB_STOCK_MAXIMUM.meta={months:state.months,year:state.year||'2025+2026',
      warehouseCount:locations.length,physicalExcessItems:above.length,physicalExcessValue:realAmount,
      warehousesWithExcess:needLocals,insufficientHistoryItems:unknown.length,
      missingCostItems:missingCosts,networkExcludedFromTotals:true,stockDate:stockDate(),
      locations:locations.map(l=>({local:l.local,excessItems:l.excess,amount:l.amount,virtual:l.network}))};
    rendered=true;
  }
  function schedule(){
    clearTimeout(timer);
    timer=setTimeout(draw,75);
  }
  window.DB_STOCK_MAXIMUM={meta:null,render:draw,refresh:schedule,version:'20261103-v1'};
  window.addEventListener('stock-position-updated',schedule);
  window.addEventListener('movements-updated',schedule);
  window.addEventListener('minimum-policy-updated',schedule);
  window.addEventListener('dashboard-ready',schedule);
  document.addEventListener('click',event=>{
    if(event.target?.closest?.('.tab[data-view="minimo"],.clean-sub-btn[data-view="minimo"]'))schedule();
  });
  document.addEventListener('change',event=>{
    if(event.target?.closest?.('#fEmpresa,#fLocal,#fGrupo,#fUn,#fBusca'))schedule();
  });
  draw();
})();
