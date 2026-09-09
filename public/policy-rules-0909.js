// Regras operacionais de análise - 09/09/2026
// 1) Lubrificantes e pneus/câmaras não entram em "sem giro".
// 2) Pneus/câmaras continuam visíveis no estoque, mas NÃO entram em reposição de estoque em nenhum almoxarifado.
// 3) Pneus/câmaras também não fazem parte da política de estoque-alvo do CDI Chua.
(function(){
  const norm=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toUpperCase();
  const isLub=x=>norm(x?.grupo).includes('LUBRIFIC');
  const isTire=x=>norm(x?.grupo).includes('PNEU')||norm(x?.produto).startsWith('PNEU ')||norm(x?.grupo).includes('CAMARAS DE AR');
  const isCdi=x=>norm(x?.local)==='ALMOXARIFADO GERAL F CHUA'||String(x?.codigo_local||'')==='30115'||String(x?.codigo_local||'')==='3015';
  window.DASHBOARD_POLICY={isLubricant:isLub,isTire,isCdi,notes:{semGiro:'Lubrificantes, pneus e câmaras de ar excluídos da análise de sem giro.',replenishment:'Pneus e câmaras de ar excluídos de toda reposição de estoque. Permanecem apenas para controle do saldo existente.',cdi:'Pneus e câmaras de ar excluídos do estoque-alvo do CDI Chua por decisão de política de abastecimento.'}};

  if(typeof window.cdiNetworkAllRows==='function'&&!window.__cdiNetworkAllRowsBeforePolicy){
    window.__cdiNetworkAllRowsBeforePolicy=window.cdiNetworkAllRows;
    window.cdiNetworkAllRows=function(){return window.__cdiNetworkAllRowsBeforePolicy.apply(this,arguments).filter(x=>!isTire(x));};
  }

  if(typeof window.minimumBaseRows==='function'&&!window.__minimumBaseRowsBeforePolicy){
    window.__minimumBaseRowsBeforePolicy=window.minimumBaseRows;
    window.minimumBaseRows=function(){return window.__minimumBaseRowsBeforePolicy.apply(this,arguments).filter(x=>!isTire(x));};
  }

  try{if(typeof window.renderMinimum==='function')window.renderMinimum();}catch(e){console.warn('Regra pneus: renderMinimum',e)}
  try{if(typeof window.renderCDI==='function')window.renderCDI();}catch(e){console.warn('Regra pneus: renderCDI',e)}

  function patchPolicyViews(){
    if(typeof STOCK==='undefined'||typeof MOVEMENTS==='undefined')return;
    const mm=new Map(MOVEMENTS.map(x=>[String(x.local)+'|'+String(x.codigo),x]));
    const rows=STOCK.filter(x=>!isLub(x)&&!isTire(x)&&!((Number(mm.get(String(x.local)+'|'+String(x.codigo))?.total)||0)>0));
    const value=rows.reduce((a,x)=>a+(Number(x.valor_estoque)||0),0);
    const total=STOCK.reduce((a,x)=>a+(Number(x.valor_estoque)||0),0);
    const tireStock=STOCK.filter(isTire);
    const tireValue=tireStock.reduce((a,x)=>a+(Number(x.valor_estoque)||0),0);
    const br=v=>new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(Number(v)||0);
    const n0=v=>new Intl.NumberFormat('pt-BR',{maximumFractionDigits:0}).format(Number(v)||0);
    const pct=v=>new Intl.NumberFormat('pt-BR',{style:'percent',minimumFractionDigits:1,maximumFractionDigits:1}).format(Number(v)||0);
    const esc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));

    const cards=[...document.querySelectorAll('#view-executivo .board-kpi')];
    for(const c of cards){const label=c.querySelector('.label')?.textContent.trim();if(label==='Capital sem giro'){const v=c.querySelector('.value'),sub=c.querySelector('.sub');if(v)v.textContent=br(value);if(sub)sub.textContent=`${n0(rows.length)} itens • ${pct(total?value/total:0)} do estoque • lubrificantes e pneus fora do critério.`;}}
    const readings=[...document.querySelectorAll('#view-executivo .board-reading>div')];
    for(const r of readings){if(r.querySelector('b')?.textContent.trim()==='Capital'){const s=r.querySelector('span');if(s)s.innerHTML=`A posição atual é de <b>${br(total)}</b> em estoque. Deste total, <b>${br(value)}</b> (${pct(total?value/total:0)}) está sem giro na base analisada, <b>desconsiderando lubrificantes, pneus e câmaras de ar</b>.` ;}}
    const decisions=[...document.querySelectorAll('#view-executivo .board-decision')];
    for(const d of decisions){if(d.textContent.includes('Revisar capital sem giro')){const a=d.querySelector('.amount');if(a)a.textContent=br(value);const strong=d.querySelector('strong');if(strong)strong.textContent='Revisar capital sem giro, excluindo lubrificantes, pneus e câmaras de ar desta análise.';}}
    const panels=[...document.querySelectorAll('#view-executivo .board-panel')];
    for(const p of panels){if(p.querySelector('.board-title h3')?.textContent.trim()==='Maior capital sem giro'){const hint=p.querySelector('.board-title span');if(hint)hint.textContent='Itens para revisão • lubrificantes e pneus excluídos';const tbody=p.querySelector('tbody');if(tbody)tbody.innerHTML=rows.slice().sort((a,b)=>(Number(b.valor_estoque)||0)-(Number(a.valor_estoque)||0)).slice(0,5).map(x=>`<tr><td>${esc(x.local)}</td><td>${esc(x.codigo)} - ${esc(x.produto)}</td><td class="num">${br(x.valor_estoque)}</td></tr>`).join('')||'<tr><td colspan="3">Sem itens no critério.</td></tr>';}}

    const method=document.querySelector('#view-executivo .board-method');
    if(method&&!method.querySelector('.policy-tires')){
      const d=document.createElement('div');d.className='policy-tires';d.innerHTML=`<b>Política de pneus e câmaras</b><p>${n0(tireStock.length)} posições, somando ${br(tireValue)}, permanecem no estoque para controle do saldo existente, mas não entram em sem giro, estoque mínimo, necessidade de reposição, itens críticos ou compra recomendada.</p>`;method.appendChild(d);
    }

    for(const el of document.querySelectorAll('#view-executivo .exec-kpi')){const k=el.querySelector('.k')?.textContent.trim(),v=el.querySelector('.v');if(k==='Estoque sem giro no histórico'&&v)v.textContent=br(value);if(k==='Itens sem giro'&&v)v.textContent=n0(rows.length);}
    const oldTitle=[...document.querySelectorAll('#view-executivo .exec-section h3')].find(x=>x.textContent.trim()==='Maior capital sem giro');
    const oldBody=oldTitle?.nextElementSibling?.querySelector('tbody');if(oldBody)oldBody.innerHTML=rows.slice().sort((a,b)=>(Number(b.valor_estoque)||0)-(Number(a.valor_estoque)||0)).slice(0,10).map(x=>`<tr><td>${esc(x.local)}</td><td>${esc(x.codigo)} - ${esc(x.produto)}</td><td class="num">${br(x.valor_estoque)}</td></tr>`).join('');
  }

  setTimeout(patchPolicyViews,0);
  document.addEventListener('click',e=>{if(e.target?.closest?.('.tab[data-view="executivo"],.clean-primary-btn[data-group="resumo"],.tab[data-view="minimo"],.tab[data-view="cdi"]'))setTimeout(patchPolicyViews,20)});
})();
