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
    return Array.isArray(list)?list.filter(x=>!excludedFromMinimum(x)):[];
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
        if(!node.nodeValue||!/(\b4\s*meses\b|\bquatro\s+meses\b)/i.test(node.nodeValue))continue;
        node.nodeValue=node.nodeValue.replace(/\b(?:4|quatro)\s+meses\b/gi,'2 meses');
      }
    }
  }


  // O grafico de reposicao exibe apenas locais com necessidade positiva.
  // Mostra tambem os demais locais avaliados, sem inventar compras.
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
    const globalFiltered=['fEmpresa','fLocal','fGrupo','fUn','fBusca']
      .some(key=>String(document.getElementById(key)?.value||'').trim());
    const names=new Set(globalFiltered?base.map(x=>String(x.local||'')):
      (typeof STOCK==='undefined'?[]:STOCK.map(x=>String(x.local||''))));
    if(!globalFiltered&&base.some(x=>x.network_scope||x.local==='CDI DE PECAS CHUA'))
      names.add('CDI DE PECAS CHUA');
    for(const x of list)names.add(String(x.local||''));
    names.delete('');
    const data=new Map([...names].map(local=>[local,{local,items:0,need:0,critical:0,amount:0}]));
    for(const x of list){
      const loc=String(x.local||'');
      if(!data.has(loc))data.set(loc,{local:loc,items:0,need:0,critical:0,amount:0});
      const d=data.get(loc);d.items++;
      if(num(x.need)>0)d.need++;
      if(x.status==='SEM ESTOQUE'||x.status==='ABAIXO DO MÍNIMO')d.critical++;
      d.amount+=num(x.need_value);
    }
    const entries=[...data.values()].sort((a,b)=>b.amount-a.amount||b.critical-a.critical||a.local.localeCompare(b.local,'pt-BR'));
    const positive=entries.filter(x=>x.need>0);
    let panel=document.getElementById('db-minimum-all-locals');
    if(!panel){
      panel=document.createElement('section');panel.id='db-minimum-all-locals';
      const note=[...view.querySelectorAll('.notice')].find(x=>x.textContent.includes('Regra do estoque mínimo'));
      if(note)note.before(panel);else view.appendChild(panel);
    }
    if(!document.getElementById('db-minimum-all-locals-style')){
      const style=document.createElement('style');style.id='db-minimum-all-locals-style';
      style.textContent=[
        '#db-minimum-all-locals{border:1px solid #d7e6db;border-radius:12px;background:white;margin:14px 0;overflow:hidden}',
        '#db-minimum-all-locals .dl-head{display:flex;align-items:center;justify-content:space-between;gap:15px;flex-wrap:wrap;padding:14px 16px}',
        '#db-minimum-all-locals h3{color:#145b32;font-size:14px;margin:0}',
        '#db-minimum-all-locals p{font-size:11px;color:#637568;line-height:1.5;margin:4px 0 0}',
        '#db-minimum-all-locals .dl-head strong{color:#145b32;font-size:12px}',
        '#db-minimum-all-locals .dl-columns,#db-minimum-all-locals .dl-row{display:grid;grid-template-columns:minmax(235px,3fr) minmax(95px,1fr) minmax(110px,1fr) minmax(140px,1.2fr);gap:10px;align-items:center;padding:11px 15px;font-size:11px}',
        '#db-minimum-all-locals .dl-columns{background:#edf6f0;font-size:10px;font-weight:bold;color:#4b7357}',
        '#db-minimum-all-locals .dl-row{border-top:1px solid #e9efeb}',
        '#db-minimum-all-locals .dl-row b{color:#26563b}',
        '#db-minimum-all-locals .dl-row small{display:block;font-size:10px;color:#607a6a;margin-top:4px}',
        '#db-minimum-all-locals .dl-row .need{color:#925c05}',
        '#db-minimum-all-locals .dl-row .ok{color:#257544}',
        '#db-minimum-all-locals .dl-foot{padding:10px 15px 14px;border-top:1px solid #e5ede6}',
        '@media(max-width:700px){#db-minimum-all-locals .dl-columns{display:none}#db-minimum-all-locals .dl-row{grid-template-columns:1fr 1fr}#db-minimum-all-locals .dl-row>div:first-child{grid-column:span 2}}'
      ].join('\n');document.head.appendChild(style);
    }
    panel.innerHTML='<div class="dl-head"><div><h3>Todos os locais analisados</h3>'+
      '<p>Os gráficos acima mostram somente locais com reposição. Os demais também foram avaliados.</p></div>'+
      '<strong>'+n0(positive.length)+' com reposição · '+n0(entries.length-positive.length)+' sem reposição</strong></div>'+
      '<div class="dl-columns"><span>Almoxarifado</span><span>Produtos a repor</span><span>Abaixo / sem estoque</span><span>Valor de reposição</span></div>'+
      entries.map(d=>'<div class="dl-row"><div><b>'+esc(d.local)+'</b><small>'+
        n0(d.items)+' produtos analisados'+(d.local==='CDI DE PECAS CHUA'?' · visão da rede':'')+'</small></div>'+
        '<div class="'+(d.need?'need':'ok')+'">'+n0(d.need)+' · '+(d.need?'Repor':'Sem reposição')+'</div>'+
        '<div>'+n0(d.critical)+'</div><div><b>'+br(d.amount)+'</b></div></div>').join('')+
      '<p class="dl-foot"><b>Importante:</b> o CDI de Peças Chuá é uma análise de demanda da rede e compartilha o saldo ERP com o almoxarifado físico Chuá. '+
      'Não somar as necessidades dos dois sem separar esse saldo.</p>';
    window.DB_MINIMUM_LOCALS_COVERAGE_META={
      totalLocals:entries.length,needLocals:positive.length,noNeedLocals:entries.length-positive.length,
      below:entries.reduce((a,x)=>a+x.critical,0),amount:entries.reduce((a,x)=>a+x.amount,0),
      items:entries.map(x=>({local:x.local,need:x.need,below:x.critical,amount:x.amount}))
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
