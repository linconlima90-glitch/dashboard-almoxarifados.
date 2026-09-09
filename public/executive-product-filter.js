// Filtro de produtos exibidos no Resumo Executivo - 09/09/2026
(function(){
  const norm=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toUpperCase();
  const excluded=x=>{
    const g=norm(x?.grupo),p=norm(x?.produto);
    return g.includes('LUBRIFIC')||g.includes('PNEU')||g.includes('CAMARA DE AR')||p.includes('LUBRIFIC')||p.includes('PNEU')||p.includes('CAMARA DE AR')||p.startsWith('OLEO ')||p.includes(' OLEO ')||g.includes('OLEO');
  };
  window.EXECUTIVE_PRODUCT_EXCLUDED=excluded;
  const br=v=>new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(Number(v)||0);
  const n0=v=>new Intl.NumberFormat('pt-BR',{maximumFractionDigits:0}).format(Number(v)||0);
  const pct=v=>new Intl.NumberFormat('pt-BR',{style:'percent',minimumFractionDigits:1,maximumFractionDigits:1}).format(Number(v)||0);
  const esc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));

  function panelByTitle(title){return [...document.querySelectorAll('#view-executivo .board-panel')].find(p=>p.querySelector('.board-title h3')?.textContent.trim()===title);}
  function refreshExecutiveProducts(){
    if(typeof STOCK==='undefined')return;
    const movements=Array.isArray(window.MOVEMENTS)?window.MOVEMENTS:[];
    const mm=new Map(movements.map(x=>[String(x.local)+'|'+String(x.codigo),x]));

    // Capital sem giro: óleo/lubrificantes/pneus/câmaras ficam totalmente fora.
    const dead=STOCK.filter(x=>!excluded(x)&&!((Number(mm.get(String(x.local)+'|'+String(x.codigo))?.total)||0)>0)).sort((a,b)=>(Number(b.valor_estoque)||0)-(Number(a.valor_estoque)||0));
    const deadValue=dead.reduce((a,x)=>a+(Number(x.valor_estoque)||0),0);
    const stockTotal=STOCK.reduce((a,x)=>a+(Number(x.valor_estoque)||0),0);
    const deadPanel=panelByTitle('Maior capital sem giro');
    if(deadPanel){
      const hint=deadPanel.querySelector('.board-title span');if(hint)hint.textContent='5 maiores por valor • óleo, lubrificantes e pneus excluídos';
      const tbody=deadPanel.querySelector('tbody');if(tbody)tbody.innerHTML=dead.slice(0,5).map(x=>`<tr><td>${esc(x.local)}</td><td>${esc(x.codigo)} - ${esc(x.produto)}</td><td class="num">${br(x.valor_estoque)}</td></tr>`).join('')||'<tr><td colspan="3">Sem itens no critério.</td></tr>';
    }
    for(const c of document.querySelectorAll('#view-executivo .board-kpi')){
      if(c.querySelector('.label')?.textContent.trim()==='Capital sem giro'){
        const v=c.querySelector('.value'),s=c.querySelector('.sub');if(v)v.textContent=br(deadValue);if(s)s.textContent=`${n0(dead.length)} itens • ${pct(stockTotal?deadValue/stockTotal:0)} do estoque • óleo, lubrificantes e pneus excluídos.`;
      }
    }
    for(const r of document.querySelectorAll('#view-executivo .board-reading>div')){
      if(r.querySelector('b')?.textContent.trim()==='Capital'){
        const s=r.querySelector('span');if(s)s.innerHTML=`A posição atual é de <b>${br(stockTotal)}</b> em estoque. Deste total, <b>${br(deadValue)}</b> (${pct(stockTotal?deadValue/stockTotal:0)}) está sem giro na base analisada. <b>Óleo, lubrificantes, pneus e câmaras de ar não entram nesta análise executiva.</b>`;
      }
    }
    for(const d of document.querySelectorAll('#view-executivo .board-decision')){
      if(d.textContent.includes('Revisar capital sem giro')){const a=d.querySelector('.amount');if(a)a.textContent=br(deadValue);}
    }

    // Necessidades de reposição: também não mostrar essas famílias no destaque executivo.
    let mins=[];try{mins=typeof window.minimumBaseRows==='function'?window.minimumBaseRows():movements}catch(e){mins=movements}
    const needs=mins.filter(x=>!excluded(x)&&(Number(x.need_value)||0)>0).sort((a,b)=>(Number(b.need_value)||0)-(Number(a.need_value)||0));
    const needPanel=panelByTitle('Maiores necessidades de reposição');
    if(needPanel){
      const hint=needPanel.querySelector('.board-title span');if(hint)hint.textContent='5 maiores por valor • famílias excluídas não aparecem';
      const tbody=needPanel.querySelector('tbody');if(tbody)tbody.innerHTML=needs.slice(0,5).map(x=>`<tr><td>${esc(x.local)}</td><td>${esc(x.codigo)} - ${esc(x.produto)}</td><td class="num">${br(x.need_value)}</td></tr>`).join('')||'<tr><td colspan="3">Sem necessidades calculadas.</td></tr>';
    }

    // Compatibilidade com a versão executiva anterior: top produtos por valor.
    const oldProductTitle=[...document.querySelectorAll('#view-executivo .exec-section h3')].find(x=>x.textContent.trim()==='Produtos de maior valor');
    const oldProductBody=oldProductTitle?.nextElementSibling?.querySelector('tbody');
    if(oldProductBody&&typeof PRODUCTS!=='undefined')oldProductBody.innerHTML=[...PRODUCTS].filter(x=>!excluded(x)).sort((a,b)=>(Number(b.valor_estoque)||0)-(Number(a.valor_estoque)||0)).slice(0,8).map(p=>`<tr><td>${esc(p.codigo)} - ${esc(p.produto)}</td><td>${esc(p.grupo)}</td><td class="num">${br(p.valor_estoque)}</td></tr>`).join('');

    // Potencial de economia por grupo no resumo: não destacar grupos dessas famílias.
    const gp=panelByTitle('Potencial de economia por grupo');
    const groups=(window.ECONOMY_POTENTIAL_DATA?.groups||[]).filter(x=>{const g=norm(x?.[0]);return !(g.includes('LUBRIFIC')||g.includes('PNEU')||g.includes('CAMARA DE AR')||g.includes('OLEO'));}).sort((a,b)=>(Number(b[3])||0)-(Number(a[3])||0));
    if(gp){const tbody=gp.querySelector('tbody');if(tbody)tbody.innerHTML=groups.slice(0,5).map(x=>`<tr><td>${esc(x[0])}</td><td class="num">${br(x[3])}</td><td class="num">${n0(x[6])}</td></tr>`).join('')||'<tr><td colspan="3">Sem dados.</td></tr>';}
  }

  setTimeout(refreshExecutiveProducts,0);
  setTimeout(refreshExecutiveProducts,80);
  document.addEventListener('click',e=>{if(e.target?.closest?.('.tab[data-view="executivo"],.clean-primary-btn[data-group="resumo"]'))setTimeout(refreshExecutiveProducts,30)});
})();
