// Politica de estoque minimo: dois meses de consumo medio, a partir de 08/10/2026.
// Mantem historico/medias inalterados; altera somente minimo, reposicao, alertas e estimativas.
(function(){
  if(window.__MINIMUM_POLICY_TWO_MONTHS_INSTALLED)return;
  window.__MINIMUM_POLICY_TWO_MONTHS_INSTALLED=true;
  const MONTHS=2;
  window.STOCK_MINIMUM_MONTHS=MONTHS;
  if(window.DASHBOARD_POLICY)window.DASHBOARD_POLICY.minimumMonths=MONTHS;
  const key=x=>String(x.local)+'|'+String(x.codigo);
  const num=x=>Number(x)||0;
  const br=x=>new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(num(x));
  const n0=x=>new Intl.NumberFormat('pt-BR',{maximumFractionDigits:0}).format(num(x));
  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const norm=x=>String(x??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toUpperCase();
  // Granjas ainda sem controle de almoxarifado: excluir somente das visoes gerenciais.
  const outOfScopeLocal=v=>{
    const local=norm(v).replace(/\s+/g,' ').trim();
    return local==='ALMOXARIFADO GERAL G GERIBA'||local==='ALMOXARIFADO GERAL G S CRUZ';
  };
  const excludedFromMinimum=x=>{
    const group=norm(x?.grupo),item=norm(x?.produto);
    return /\bPNEUS?\b|\bCAMARAS?\b|\bCIMENTOS?\b/.test(group)||
      /\b(?:PNEUS?|CAMARAS?|CIMENTOS?)\b/.test(item);
  };
  window.DB_MINIMUM_EXCLUDED=excludedFromMinimum;
  const exclusion=x=>typeof window.EXECUTIVE_PRODUCT_EXCLUDED==='function'&&window.EXECUTIVE_PRODUCT_EXCLUDED(x);

  function recalc(){
    if(typeof MOVEMENTS==='undefined'||!Array.isArray(MOVEMENTS))return false;
    const balances=new Map();
    if(typeof STOCK!=='undefined'&&Array.isArray(STOCK)){
      for(const s of STOCK){
        const k=key(s),a=balances.get(k)||{q:0,v:0,cost:0};
        a.q+=num(s.estoque);a.v+=num(s.valor_estoque);
        a.cost=a.q>0?a.v/a.q:(num(s.custo_estoque)||a.cost);balances.set(k,a);
      }
    }
    const byMovement=new Map();
    for(const m of MOVEMENTS){
      const k=key(m),b=balances.get(k);
      const average=Math.max(0,num(m.avg));
      const minimum=excludedFromMinimum(m)?0:(typeof minimumRoundUp==='function'
        ? minimumRoundUp(average*MONTHS,m.un)
        : (typeof MINIMUM_CONTINUOUS_UNITS!=='undefined'&&MINIMUM_CONTINUOUS_UNITS.has(String(m.un||'').toUpperCase())
          ? Math.ceil((average*MONTHS-1e-10)*100)/100
          : Math.ceil(average*MONTHS-1e-10)));
      const stock=b?b.q:num(m.stock);
      const cost=b&&b.cost>0?b.cost:num(m.cost);
      const total=num(m.total);
      const continuous=typeof MINIMUM_CONTINUOUS_UNITS!=='undefined'&&MINIMUM_CONTINUOUS_UNITS.has(String(m.un||'').toUpperCase());
      const gap=excludedFromMinimum(m)?0:Math.max(0,minimum-stock);
      const need=continuous?Math.ceil((gap-1e-10)*100)/100:Math.ceil(gap-1e-10);
      m.minimum=minimum;
      m.stock=stock;m.cost=cost;m.stock_value=stock*cost;
      m.coverage=average>0?stock/average:null;
      m.need=Math.max(0,need);m.need_value=m.need*cost;
      m.excess=Math.max(0,stock-minimum);
      if(excludedFromMinimum(m))m.status='FORA DO ESCOPO';
      else if(!(total>0))m.status='SEM DADOS DE BAIXA';
      else if(!(average>0))m.status='HISTÓRICO PARCIAL';
      else if(stock<=0)m.status='SEM ESTOQUE';
      else if(stock<minimum-1e-9)m.status='ABAIXO DO MÍNIMO';
      else if(stock<minimum*1.25-1e-9)m.status='ATENÇÃO';
      else m.status='OK';
      if('consumption_value' in m)m.consumption_value=total*cost;
      byMovement.set(k,m);
    }
    if(typeof STOCK!=='undefined'&&Array.isArray(STOCK))for(const s of STOCK){
      const m=byMovement.get(key(s));
      s.qtd_baixada=num(m?.total);s.media_mensal=num(m?.avg);
      s.cobertura=s.media_mensal>0?num(s.estoque)/s.media_mensal:null;
    }
    return true;
  }

  function rows(){
    let list=[];
    try{list=typeof window.minimumBaseRows==='function'?window.minimumBaseRows():MOVEMENTS}catch(e){list=MOVEMENTS}
    return Array.isArray(list)?list.filter(x=>!excludedFromMinimum(x)&&!outOfScopeLocal(x.local)):[];
  }

  function transfers(mins){
    const needs=new Map(),sources=new Map();
    for(const x of mins){
      const k=String(x.codigo)+'|'+String(x.un||'');
      if(num(x.need)>0){if(!needs.has(k))needs.set(k,[]);needs.get(k).push({...x,left:num(x.need)})}
      if(num(x.excess)>0){if(!sources.has(k))sources.set(k,[]);sources.get(k).push({...x,left:num(x.excess)})}
    }
    let value=0;
    for(const [k,items] of needs){
      const src=sources.get(k)||[];
      for(const d of items.sort((a,b)=>num(b.need_value)-num(a.need_value))){
        for(const o of src.sort((a,b)=>num(b.excess)-num(a.excess))){
          if(d.local===o.local||d.left<=0||o.left<=0)continue;
          const q=Math.min(d.left,o.left);
          if(q<=0)continue;
          value+=q*(num(d.cost)||num(o.cost));
          d.left-=q;o.left-=q;
        }
      }
    }
    return value;
  }

  function patchExecutive(){
    const mins=rows();
    const need=mins.reduce((a,x)=>a+num(x.need_value),0);
    const below=mins.filter(x=>x.status==='ABAIXO DO MÍNIMO').length;
    const empty=mins.filter(x=>x.status==='SEM ESTOQUE').length;
    const attention=mins.filter(x=>x.status==='ATENÇÃO').length;
    const transfer=transfers(mins);
    const buy=Math.max(0,need-transfer);
    const kpis=[...document.querySelectorAll('#view-executivo .board-kpi')];
    const map={
      'Necessidade bruta de reposição':br(need),
      'Transferir antes de comprar':br(transfer),
      'Compra estimada após transferências':br(buy),
      'Itens críticos de abastecimento':n0(below+empty)
    };
    for(const el of kpis){
      const label=el.querySelector('.label')?.textContent.trim();
      if(Object.prototype.hasOwnProperty.call(map,label)){
        const val=el.querySelector('.value');if(val)val.textContent=map[label];
      }
      const sub=el.querySelector('.sub');
      if(!sub)continue;
      if(label==='Necessidade bruta de reposição')sub.textContent='Baseada na política de cobertura de 2 meses.';
      if(label==='Transferir antes de comprar')sub.textContent='Potencial de redução de '+(need?(100*transfer/need).toFixed(1).replace('.',','):'0,0')+'% da necessidade bruta.';
      if(label==='Itens críticos de abastecimento')sub.textContent=n0(empty)+' sem estoque + '+n0(below)+' abaixo do mínimo • '+n0(attention)+' em atenção.';
    }
    for(const box of document.querySelectorAll('#view-executivo .board-reading>div')){
      if(box.querySelector('b')?.textContent.trim()==='Abastecimento'){
        const span=box.querySelector('span');
        if(span)span.innerHTML='Com a política de <b>2 meses</b>, a necessidade bruta de reposição é de <b>'+br(need)+'</b>. Antes de comprar, há <b>'+br(transfer)+'</b> de potencial de transferência interna, reduzindo a compra estimada para <b>'+br(buy)+'</b>.';
      }
    }
    for(const row of document.querySelectorAll('#view-executivo .board-decision')){
      const t=row.querySelector('strong')?.textContent||'';
      const amount=row.querySelector('.amount');
      if(!amount)continue;
      if(t.includes('Evitar ruptura'))amount.textContent=n0(below+empty)+' itens';
      if(t.includes('Realocar saldo'))amount.textContent=br(transfer);
    }
    for(const panel of document.querySelectorAll('#view-executivo .board-panel')){
      if(panel.querySelector('.board-title h3')?.textContent.trim()!=='Maiores necessidades de reposição')continue;
      const body=panel.querySelector('tbody');
      if(!body)continue;
      const top=mins.filter(x=>num(x.need_value)>0&&!exclusion(x)).sort((a,b)=>num(b.need_value)-num(a.need_value)).slice(0,5);
      body.innerHTML=top.map(x=>'<tr><td>'+esc(x.local)+'</td><td>'+esc(x.codigo)+' - '+esc(x.produto)+'</td><td class="num">'+br(x.need_value)+'</td></tr>').join('')||'<tr><td colspan="3">Sem necessidades calculadas.</td></tr>';
    }
    for(const el of document.querySelectorAll('#view-executivo .exec-kpi')){
      const label=el.querySelector('.k')?.textContent.trim(),v=el.querySelector('.v');
      if(!v)continue;
      if(label==='Necessidade bruta de reposição')v.textContent=br(need);
      if(label==='Itens abaixo do mínimo')v.textContent=n0(below+empty);
      if(label==='Itens sem estoque com consumo')v.textContent=n0(empty);
    }
    window.STOCK_MINIMUM_POLICY_META={months:MONTHS,needValue:need,transferValue:transfer,estimatedPurchase:buy,below,empty,attention,items:mins.length};
  }

  function patchCopy(){
    for(const selector of ['#view-minimo','#view-executivo']){
      const area=document.querySelector(selector);if(!area)continue;
      const walker=document.createTreeWalker(area,NodeFilter.SHOW_TEXT);
      let node;
      while((node=walker.nextNode())){
        // O modulo de maximo tem prazo proprio; nunca reescrever 4 meses nele.
        if(node.parentElement?.closest('#db-stock-maximum'))continue;
        if(!node.nodeValue||!/(\b4\s*meses\b|\bquatro\s+meses\b)/i.test(node.nodeValue))continue;
        node.nodeValue=node.nodeValue.replace(/\b(?:4|quatro)\s+meses\b/gi,'2 meses');
      }
    }
  }




  // Grafico e relacao completa por almoxarifado, preservando minimo e consumo ERP.
  let expandedMinimumLocal='';
  function patchMinimumLocations(){
    const view=document.getElementById('view-minimo');
    if(!view||!window.CURRENT_STOCK_META||!window.MOVEMENTS_REVISED_META)return;
    const base=rows();
    const yearSelect=[...view.querySelectorAll('select')].find(select=>
      [...select.options].some(o=>o.value==='2025')&&[...select.options].some(o=>o.value==='2026'));
    const year=yearSelect?.value||'';
    let list=year&&typeof minimumRowsForYear==='function'?minimumRowsForYear(base,year):base;
    const allowed=new Set(['SEM ESTOQUE','ABAIXO DO MÍNIMO','ATENÇÃO','OK','HISTÓRICO PARCIAL','SEM DADOS DE BAIXA']);
    const statuses=[...view.querySelectorAll('input[type="checkbox"]:checked')]
      .map(input=>input.value).filter(status=>allowed.has(status));
    if(statuses.length)list=list.filter(x=>statuses.includes(x.status));
    const globalFiltered=['fEmpresa','fLocal','fGrupo','fUn','fBusca'].some(
      k=>String(document.getElementById(k)?.value||'').trim());
    const names=new Set(globalFiltered?base.map(x=>String(x.local||'')):
      (typeof STOCK==='undefined'?[]:STOCK.map(x=>String(x.local||''))));
    if(!globalFiltered&&base.some(x=>x.network_scope||x.local==='CDI DE PECAS CHUA'))
      names.add('CDI DE PECAS CHUA');
    for(const x of list)names.add(String(x.local||''));
    for(const local of names)if(outOfScopeLocal(local))names.delete(local);
    names.delete('');
    const fresh=local=>({local,items:0,need:0,critical:0,above:0,attention:0,unknown:0,amount:0,uncosted:0,rows:[]});
    const data=new Map([...names].map(local=>[local,fresh(local)]));
    for(const x of list){
      const local=String(x.local||'');if(!local)continue;
      if(!data.has(local))data.set(local,fresh(local));
      const d=data.get(local);d.rows.push(x);d.items++;
      if(num(x.need)>0){d.need++;if(!(num(x.cost)>0))d.uncosted++;}
      if(x.status==='SEM ESTOQUE'||x.status==='ABAIXO DO MÍNIMO')d.critical++;
      else if(x.status==='ATENÇÃO'){d.attention++;d.above++;}
      else if(x.status==='OK')d.above++;
      else d.unknown++;
      d.amount+=num(x.need_value);
    }
    const entries=[...data.values()].sort((a,b)=>b.amount-a.amount||b.need-a.need||
      b.critical-a.critical||a.local.localeCompare(b.local,'pt-BR'));
    const positive=entries.filter(x=>x.need>0);
    const fmt=x=>new Intl.NumberFormat('pt-BR',{maximumFractionDigits:2}).format(num(x));
    const known=x=>num(x.total)>0&&num(x.avg)>0;
    const rank=x=>num(x.need)>0?0:x.status==='ATENÇÃO'?1:x.status==='OK'?2:3;
    const state=x=>num(x.need)>0?(x.status==='SEM ESTOQUE'?'REPOR · SEM ESTOQUE':'REPOR · ABAIXO DO MÍNIMO'):
      x.status==='ATENÇÃO'?'ATENÇÃO':x.status==='OK'?'SEM REPOSIÇÃO · OK':x.status||'SEM HISTÓRICO';
    const klass=x=>num(x.need)>0?'dl-risk':x.status==='ATENÇÃO'?'dl-warn':x.status==='OK'?'dl-safe':'dl-na';
    function groups(d){
      const map=new Map();
      for(const x of d.rows){
        const name=String(x.grupo||'SEM GRUPO').trim()||'SEM GRUPO';
        if(!map.has(name))map.set(name,{name,rows:[],amount:0,need:0,attention:0,ok:0,uncosted:0});
        const g=map.get(name);g.rows.push(x);g.amount+=num(x.need_value);
        if(num(x.need)>0){g.need++;if(!(num(x.cost)>0))g.uncosted++;}
        else if(x.status==='ATENÇÃO')g.attention++;
        else if(x.status==='OK')g.ok++;
      }
      return [...map.values()].sort((a,b)=>b.amount-a.amount||b.need-a.need||
        b.attention-a.attention||a.name.localeCompare(b.name,'pt-BR'));
    }
    function detail(d){
      const blocks=groups(d).map((g,i)=>{
        const table=g.rows.slice().sort((a,b)=>rank(a)-rank(b)||
          (rank(a)===0?num(b.need_value)-num(a.need_value):0)||
          String(a.produto||'').localeCompare(String(b.produto||''),'pt-BR')||
          String(a.codigo||'').localeCompare(String(b.codigo||''),'pt-BR')).map(x=>{
          const diff=known(x)?num(x.stock)-num(x.minimum):null;
          const need=num(x.need),cost=num(x.cost);
          const price=need>0?(cost>0?br(num(x.need_value)):'Custo não informado'):'—';
          return '<tr><td>'+esc(x.codigo)+'</td><td>'+esc(x.produto)+'</td>'+
            '<td>'+esc(x.un)+'</td><td class="dl-num">'+(known(x)?fmt(x.avg):'—')+'</td>'+
            '<td class="dl-num">'+(known(x)?fmt(x.minimum):'—')+'</td>'+
            '<td class="dl-num">'+fmt(x.stock)+'</td>'+
            '<td class="dl-num">'+(diff===null?'—':(diff>0?'+':'')+fmt(diff))+'</td>'+
            '<td class="'+klass(x)+'">'+esc(state(x))+'</td>'+
            '<td class="dl-num">'+fmt(need)+'</td>'+
            '<td class="dl-num">'+(cost>0?br(cost):'—')+'</td>'+
            '<td class="dl-num '+(need>0?'dl-risk':'')+'">'+price+'</td></tr>';
        }).join('');
        return '<details class="dl-group" data-minimum-group="'+esc(g.name)+'"'+(i===0?' open':'')+'>'+
          '<summary><strong>'+esc(g.name)+'</strong><span>'+n0(g.rows.length)+' produtos · '+
          n0(g.need)+' a repor · '+n0(g.attention)+' em atenção · '+n0(g.ok)+' OK · '+
          '<b>'+br(g.amount)+'</b>'+(g.uncosted?' · '+n0(g.uncosted)+' sem custo':'')+'</span></summary>'+
          '<div class="dl-scroll"><table><thead><tr><th>Código</th><th>Produto</th><th>UN</th>'+
          '<th>Média/mês</th><th>Mínimo 2 meses</th><th>Saldo atual</th><th>Saldo − mínimo</th>'+
          '<th>Situação</th><th>Qtd. a repor</th><th>Custo unit. ERP</th>'+
          '<th>Total estimado da compra</th></tr></thead><tbody>'+table+'</tbody></table></div></details>';
      }).join('');
      return '<div class="dl-detail"><p><b>Grupos de '+esc(d.local)+'</b> · Em cada grupo: '+
        'reposição, atenção, sem necessidade e sem histórico. '+
        'Total de compra estimado por item = quantidade a repor × custo unitário ERP.</p>'+
        '<div class="dl-groups">'+(blocks||'<p>Sem produtos nos filtros atuais.</p>')+'</div>'+
        '<div class="dl-subtotal">Total estimado deste almoxarifado: <b>'+br(d.amount)+'</b>'+
        (d.uncosted?' · '+n0(d.uncosted)+' itens sem custo cadastrado (fora deste valor)':'')+'</div></div>';
    }

    // Usa exclusivamente os dois cartoes visuais do topo, com todas as unidades.
    // Os grupos e produtos sao montados apenas quando o usuario seleciona um local.
    function chartRows(type){
      const max=Math.max(1,...entries.map(d=>type==='value'?d.amount:d.critical));
      return entries.map(d=>{
        const val=type==='value'?d.amount:d.critical;
        const width=Math.max(0,Math.min(100,100*val/max)).toFixed(2)+'%';
        return '<button class="db-min-top-row" type="button" data-minimum-chart="'+esc(d.local)+'" '+
          'aria-expanded="'+(expandedMinimumLocal===d.local)+'" '+
          'aria-label="Abrir grupos e produtos de '+esc(d.local)+'">'+
          '<span class="db-min-top-local" title="'+esc(d.local)+'">'+esc(d.local)+'</span>'+
          '<span class="db-min-top-track"><span class="db-min-top-fill '+(type==='value'?'db-min-value':'db-min-count')+
          '" style="width:'+width+'"></span></span>'+
          '<strong class="db-min-top-number">'+(type==='value'?br(val):n0(val))+'</strong></button>';
      }).join('');
    }
    function nativeChart(label,side){
      const old=view.querySelector('[data-db-min-top-card="'+side+'"]');
      if(old)return old;
      const labelNorm=norm(label);
      const other=norm(side==='value'?'Itens abaixo do mínimo por local':'Necessidade de reposição por local');
      const titles=[...view.querySelectorAll('h2,h3,h4,strong,b,span,.card-title,.chart-title')];
      const heading=titles.find(el=>!el.closest('#db-minimum-all-locals')&&
        norm(el.textContent||'').trim()===labelNorm&&el.children.length===0);
      if(!heading)return null;
      let fallback=null;
      for(let node=heading.parentElement;node&&node!==view;node=node.parentElement){
        const content=norm(node.textContent||'');
        if(content.includes(other))break;
        if(entries.some(d=>content.includes(norm(d.local))))return node;
        if(node.children.length>1&&/(card|chart|panel)/i.test(String(node.className||'')))fallback=node;
      }
      return fallback;
    }
    function chartMarkup(type){
      const value=type==='value';
      return '<div class="db-min-top-chart" data-db-min-chart="'+type+'">'+
        '<div class="db-min-top-head"><h3>'+(value?'Necessidade de reposição por local':'Itens abaixo do mínimo por local')+'</h3>'+
        (value?'<span class="db-min-top-badge">Ordenado pelo maior valor de necessidade</span>':'')+
        '</div><div class="db-min-top-list">'+chartRows(type)+'</div></div>';
    }
    let topValue=nativeChart('Necessidade de reposição por local','value');
    let topCount=nativeChart('Itens abaixo do mínimo por local','count');
    if(topValue===topCount){topValue=null;topCount=null;}
    const nativeReady=!!(topValue&&topCount);
    if(nativeReady){
      // Keep hidden original DOM nodes alive: renderMinimum still updates their IDs.
      // Replacing the card innerHTML caused downstream redraw errors.
      function preserveAndDraw(card,side){
        card.dataset.dbMinTopCard=side;
        let host=[...card.children].find(el=>el.classList.contains('db-min-top-host'));
        if(!host){
          host=document.createElement('div');
          host.className='db-min-top-host';
          card.appendChild(host);
        }
        for(const child of card.children)if(child!==host)child.style.display='none';
        host.innerHTML=chartMarkup(side);
      }
      preserveAndDraw(topValue,'value');
      preserveAndDraw(topCount,'count');
    }
    if(!view.dataset.dbMinClicks){
      view.dataset.dbMinClicks='1';
      view.addEventListener('click',event=>{
        const btn=event.target.closest('button[data-minimum-chart],button[data-minimum-close]');
        if(!btn||!view.contains(btn))return;
        event.preventDefault();
        expandedMinimumLocal=btn.hasAttribute('data-minimum-close')?'':(
          expandedMinimumLocal===btn.dataset.minimumChart?'':btn.dataset.minimumChart);
        patchMinimumLocations();
        if(expandedMinimumLocal){
          const p=document.getElementById('db-minimum-all-locals');
          if(p&&!p.hidden)p.scrollIntoView({behavior:'smooth',block:'nearest'});
        }
      });
    }
    let panel=document.getElementById('db-minimum-all-locals');
    if(!panel){
      panel=document.createElement('section');
      panel.id='db-minimum-all-locals';
    }
    if(nativeReady){
      const host=topValue.parentElement===topCount.parentElement?topValue.parentElement:topCount;
      if(panel.previousElementSibling!==host)host.after(panel);
    }else if(!panel.isConnected){
      const note=[...view.querySelectorAll('.notice')].find(el=>el.textContent.includes('Regra do estoque mínimo'));
      if(note)note.before(panel);else view.appendChild(panel);
    }
    if(!document.getElementById('db-minimum-all-locals-style')){
      const style=document.createElement('style');
      style.id='db-minimum-all-locals-style';
      style.textContent=[
        '#view-minimo .db-min-top-chart{min-width:0}',
        '#view-minimo .db-min-top-head{display:flex;justify-content:space-between;flex-wrap:wrap;align-items:center;gap:8px;margin-bottom:12px}',
        '#view-minimo .db-min-top-head h3{font-size:13px;color:#145231;margin:0;font-weight:850}',
        '#view-minimo .db-min-top-badge{color:#15518c;background:#edf4ff;border-radius:22px;padding:5px 9px;font-size:10px;font-weight:800}',
        '#view-minimo .db-min-top-list{max-height:510px;overflow:auto;padding-right:4px}',
        '#view-minimo .db-min-top-row{display:grid;grid-template-columns:minmax(165px,2.5fr) minmax(130px,5fr) minmax(94px,1.4fr);gap:10px;align-items:center;width:100%;min-width:415px;min-height:34px;padding:5px 0;border:0;background:transparent;text-align:left;cursor:pointer;color:#2f3944;font-size:11px}',
        '#view-minimo .db-min-top-row:hover,#view-minimo .db-min-top-row[aria-expanded="true"]{background:#f2f8f4}',
        '#view-minimo .db-min-top-local{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
        '#view-minimo .db-min-top-track{height:16px;background:#e8eff8;border-radius:99px;overflow:hidden}',
        '#view-minimo .db-min-top-fill{display:block;height:100%;border-radius:99px}',
        '#view-minimo .db-min-value{background:linear-gradient(90deg,#f7c078,#df7c05)}',
        '#view-minimo .db-min-count{background:linear-gradient(90deg,#6accc5,#15a09a)}',
        '#view-minimo .db-min-top-number{font-size:11px;color:#0e497d;font-weight:850;text-align:right;white-space:nowrap}',
        '#db-minimum-all-locals[hidden]{display:none!important}',
        '#db-minimum-all-locals{border:1px solid #d7e6db;border-radius:12px;background:#fff;margin:14px 0;overflow:hidden}',
        '#db-minimum-all-locals .dl-selected-head{display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:12px;padding:14px 16px}',
        '#db-minimum-all-locals .dl-selected-head h3{font-size:14px;color:#145b32;margin:0}',
        '#db-minimum-all-locals .dl-selected-head small{display:block;margin-top:5px;color:#637568;font-size:10px}',
        '#db-minimum-all-locals .dl-open{border:1px solid #bddbc7;border-radius:6px;background:#e8f4ed;color:#145b32;padding:7px 10px;font-size:10px;cursor:pointer}',
        '#db-minimum-all-locals .dl-risk{color:#b23b33;font-weight:700}',
        '#db-minimum-all-locals .dl-warn{color:#925c05;font-weight:700}',
        '#db-minimum-all-locals .dl-safe{color:#257544;font-weight:700}',
        '#db-minimum-all-locals .dl-na{color:#607a6a}',
        '#db-minimum-all-locals .dl-detail{padding:12px 15px 15px;border-top:1px solid #d7e6db;background:#f8fbf9}',
        '#db-minimum-all-locals .dl-detail p{font-size:11px;color:#637568;line-height:1.5;margin:4px 0 8px}',
        '#db-minimum-all-locals .dl-groups{display:grid;gap:8px;padding-top:9px}',
        '#db-minimum-all-locals .dl-group{border:1px solid #d5e3d9;border-radius:8px;overflow:hidden;background:#fff}',
        '#db-minimum-all-locals .dl-group summary{display:flex;justify-content:space-between;flex-wrap:wrap;gap:12px;align-items:center;cursor:pointer;background:#eef6f0;padding:10px 12px;font-size:11px;color:#165730}',
        '#db-minimum-all-locals .dl-group summary span{font-size:10px;color:#5b7463}',
        '#db-minimum-all-locals .dl-scroll{overflow-x:auto;max-height:440px;overflow-y:auto;background:#fff}',
        '#db-minimum-all-locals table{border-collapse:collapse;width:100%;min-width:1170px;font-size:10px}',
        '#db-minimum-all-locals th,#db-minimum-all-locals td{padding:8px 9px;border-bottom:1px solid #e9efeb;text-align:left}',
        '#db-minimum-all-locals th{position:sticky;top:0;background:#edf6f0;color:#315e3f;z-index:1}',
        '#db-minimum-all-locals td.dl-num{text-align:right;white-space:nowrap}',
        '#db-minimum-all-locals .dl-subtotal{padding-top:10px;font-size:11px;color:#395946}',
        '#db-minimum-all-locals .dl-foot{padding:10px 15px 14px;border-top:1px solid #e5ede6;font-size:10px;line-height:1.5;color:#627669}',
        '@media(max-width:750px){#view-minimo .db-min-top-row{min-width:410px}}'
      ].join('\n');
      document.head.appendChild(style);
    }
    const selected=entries.find(d=>d.local===expandedMinimumLocal);
    panel.hidden=!selected;
    if(selected){
      panel.innerHTML='<div class="dl-selected-head"><div><h3>'+esc(selected.local)+'</h3>'+
        '<small>'+n0(selected.items)+' produtos · '+n0(selected.need)+' a repor · '+
        n0(selected.attention)+' em atenção · '+br(selected.amount)+' estimados</small></div>'+
        '<button type="button" class="dl-open" data-minimum-close>Fechar detalhamento</button></div>'+
        detail(selected)+
        '<p class="dl-foot">Cálculo: diferença positiva entre estoque mínimo de 2 meses e saldo atual, '+
        'multiplicada pelo custo ERP. Itens sem custo registrado não entram na estimativa. '+
        'Pneus, câmaras e cimento estão excluídos. CDI de Peças Chuá é uma visão da rede, '+
        'com estoque compartilhado: não somar ao Chuá físico.</p>';
    }else if(panel.innerHTML)panel.innerHTML='';
    window.DB_MINIMUM_LOCALS_COVERAGE_META={
      totalLocals:entries.length,needLocals:positive.length,noNeedLocals:entries.length-positive.length,
      below:entries.reduce((a,x)=>a+x.critical,0),above:entries.reduce((a,x)=>a+x.above,0),
      attention:entries.reduce((a,x)=>a+x.attention,0),unknown:entries.reduce((a,x)=>a+x.unknown,0),
      amount:entries.reduce((a,x)=>a+x.amount,0),chartRows:entries.length,grouped:true,estimatedByItem:true,
      nativeReady,duplicated:false,selectedLocal:expandedMinimumLocal,
      items:entries.map(x=>({local:x.local,items:x.items,need:x.need,below:x.critical,
        above:x.above,attention:x.attention,unknown:x.unknown,uncosted:x.uncosted,amount:x.amount}))
    };
  }

  function refresh(repaint){
    if(!recalc())return;
    if(repaint){
      try{if(typeof render==='function')render()}catch(e){console.warn('Mínimo 2 meses: render',e)}
      try{if(typeof renderMinimum==='function')renderMinimum()}catch(e){console.warn('Mínimo 2 meses: renderMinimum',e)}
      try{if(typeof renderCDI==='function')renderCDI()}catch(e){console.warn('Mínimo 2 meses: renderCDI',e)}
    }
    patchExecutive();
    patchCopy();
    patchMinimumLocations();
    window.dispatchEvent(new CustomEvent('minimum-policy-updated',{detail:window.STOCK_MINIMUM_POLICY_META}));
  }

  refresh(true);
  window.addEventListener('stock-position-updated',()=>refresh(true));
  window.addEventListener('movements-updated',()=>refresh(true));
  document.addEventListener('change',e=>{if(e.target.closest('#view-minimo,#fEmpresa,#fLocal,#fGrupo,#fUn,#fBusca'))setTimeout(patchMinimumLocations,60)});
  document.addEventListener('input',e=>{if(e.target.matches('#fBusca'))setTimeout(patchMinimumLocations,120)});
  document.addEventListener('click',e=>{
    if(e.target?.closest?.('.tab[data-view="minimo"],.tab[data-view="executivo"],.clean-primary-btn[data-group="resumo"],.clean-primary-btn[data-group="estoque"],.clean-sub-btn')){
      setTimeout(()=>{recalc();patchExecutive();patchCopy();patchMinimumLocations()},35);
    }
  });
})();
