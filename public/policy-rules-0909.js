// Regras operacionais de análise - 09/09/2026
// 1) Lubrificantes não entram em "sem giro": consumo ocorre fora da base de baixas recebida.
// 2) Pneus/câmaras não fazem parte da política de estoque-alvo do CDI Chua.
(function(){
  const norm=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toUpperCase();
  const isLub=x=>norm(x?.grupo).includes('LUBRIFIC');
  const isTire=x=>norm(x?.grupo).includes('PNEU')||norm(x?.produto).startsWith('PNEU ')||norm(x?.grupo).includes('CAMARAS DE AR');
  const isCdi=x=>norm(x?.local)==='ALMOXARIFADO GERAL F CHUA'||String(x?.codigo_local||'')==='30115'||String(x?.codigo_local||'')==='3015';
  window.DASHBOARD_POLICY={isLubricant:isLub,isTire,isCdi,notes:{semGiro:'Lubrificantes excluídos: o consumo desta família não está representado na base de baixas recebida.',cdi:'Pneus e câmaras de ar excluídos do estoque-alvo do CDI Chua por decisão de política de abastecimento.'}};

  // Retira pneus/câmaras da demanda consolidada usada como estoque-alvo do CDI Chua.
  if(typeof window.cdiNetworkAllRows==='function'&&!window.__cdiNetworkAllRowsBeforePolicy){
    window.__cdiNetworkAllRowsBeforePolicy=window.cdiNetworkAllRows;
    window.cdiNetworkAllRows=function(){return window.__cdiNetworkAllRowsBeforePolicy.apply(this,arguments).filter(x=>!isTire(x));};
  }
  // Camada adicional de segurança para a tela de estoque mínimo.
  if(typeof window.minimumBaseRows==='function'&&!window.__minimumBaseRowsBeforePolicy){
    window.__minimumBaseRowsBeforePolicy=window.minimumBaseRows;
    window.minimumBaseRows=function(){return window.__minimumBaseRowsBeforePolicy.apply(this,arguments).filter(x=>!(isCdi(x)&&isTire(x)));};
  }

  // Atualiza telas que já possam ter sido renderizadas antes desta regra.
  try{if(typeof window.renderMinimum==='function')window.renderMinimum();}catch(e){console.warn('Regra CDI: renderMinimum',e)}
  try{if(typeof window.renderCDI==='function')window.renderCDI();}catch(e){console.warn('Regra CDI: renderCDI',e)}

  function patchSemGiro(){
    if(typeof STOCK==='undefined'||typeof MOVEMENTS==='undefined')return;
    const mm=new Map(MOVEMENTS.map(x=>[String(x.local)+'|'+String(x.codigo),x]));
    const rows=STOCK.filter(x=>!isLub(x)&&!((Number(mm.get(String(x.local)+'|'+String(x.codigo))?.total)||0)>0));
    const value=rows.reduce((a,x)=>a+(Number(x.valor_estoque)||0),0);
    const total=STOCK.reduce((a,x)=>a+(Number(x.valor_estoque)||0),0);
    const br=v=>new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(Number(v)||0);
    const n0=v=>new Intl.NumberFormat('pt-BR',{maximumFractionDigits:0}).format(Number(v)||0);
    const pct=v=>new Intl.NumberFormat('pt-BR',{style:'percent',minimumFractionDigits:1,maximumFractionDigits:1}).format(Number(v)||0);
    const esc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));

    // Resumo executivo novo.
    const cards=[...document.querySelectorAll('#view-executivo .board-kpi')];
    for(const c of cards){const label=c.querySelector('.label')?.textContent.trim();if(label==='Capital sem giro'){const v=c.querySelector('.value'),sub=c.querySelector('.sub');if(v)v.textContent=br(value);if(sub)sub.textContent=`${n0(rows.length)} itens • ${pct(total?value/total:0)} do estoque • lubrificantes fora do critério.`;}}
    const readings=[...document.querySelectorAll('#view-executivo .board-reading>div')];
    for(const r of readings){if(r.querySelector('b')?.textContent.trim()==='Capital'){const s=r.querySelector('span');if(s)s.innerHTML=`A posição atual é de <b>${br(total)}</b> em estoque. Deste total, <b>${br(value)}</b> (${pct(total?value/total:0)}) está sem giro na base analisada, <b>desconsiderando lubrificantes</b>, cujo consumo não está refletido nos relatórios de baixas recebidos.`;}}
    const decisions=[...document.querySelectorAll('#view-executivo .board-decision')];
    for(const d of decisions){if(d.textContent.includes('Revisar capital sem giro')){const a=d.querySelector('.amount');if(a)a.textContent=br(value);const strong=d.querySelector('strong');if(strong)strong.textContent='Revisar capital sem giro, excluindo lubrificantes da análise por ausência das baixas dessa família.';}}
    const panels=[...document.querySelectorAll('#view-executivo .board-panel')];
    for(const p of panels){if(p.querySelector('.board-title h3')?.textContent.trim()==='Maior capital sem giro'){const hint=p.querySelector('.board-title span');if(hint)hint.textContent='Itens para revisão • lubrificantes excluídos';const tbody=p.querySelector('tbody');if(tbody)tbody.innerHTML=rows.sort((a,b)=>(Number(b.valor_estoque)||0)-(Number(a.valor_estoque)||0)).slice(0,5).map(x=>`<tr><td>${esc(x.local)}</td><td>${esc(x.codigo)} - ${esc(x.produto)}</td><td class="num">${br(x.valor_estoque)}</td></tr>`).join('')||'<tr><td colspan="3">Sem itens no critério.</td></tr>';}}

    // Compatibilidade com o resumo executivo anterior, caso apareça em alguma renderização.
    for(const el of document.querySelectorAll('#view-executivo .exec-kpi')){const k=el.querySelector('.k')?.textContent.trim(),v=el.querySelector('.v');if(k==='Estoque sem giro no histórico'&&v)v.textContent=br(value);if(k==='Itens sem giro'&&v)v.textContent=n0(rows.length);}
    const oldTitle=[...document.querySelectorAll('#view-executivo .exec-section h3')].find(x=>x.textContent.trim()==='Maior capital sem giro');
    const oldBody=oldTitle?.nextElementSibling?.querySelector('tbody');if(oldBody)oldBody.innerHTML=rows.slice().sort((a,b)=>(Number(b.valor_estoque)||0)-(Number(a.valor_estoque)||0)).slice(0,10).map(x=>`<tr><td>${esc(x.local)}</td><td>${esc(x.codigo)} - ${esc(x.produto)}</td><td class="num">${br(x.valor_estoque)}</td></tr>`).join('');
  }

  // O resumo para diretoria é carregado logo depois deste arquivo.
  setTimeout(patchSemGiro,0);
  document.addEventListener('click',e=>{if(e.target?.closest?.('.tab[data-view="executivo"],.clean-primary-btn[data-group="resumo"]'))setTimeout(patchSemGiro,20)});
})();
