// Resumo Executivo para Diretoria v3 - 09/09/2026
(function(){
  const view=document.getElementById('view-executivo');
  if(!view || typeof STOCK==='undefined' || typeof PURCHASES==='undefined') return;
  const br=v=>new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(Number(v)||0);
  const n0=v=>new Intl.NumberFormat('pt-BR',{maximumFractionDigits:0}).format(Number(v)||0);
  const pct=v=>new Intl.NumberFormat('pt-BR',{style:'percent',minimumFractionDigits:1,maximumFractionDigits:1}).format(Number(v)||0);
  const esc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  const dk=s=>{const p=String(s||'').split('/');return p.length===3?Number(p[2])*10000+Number(p[1])*100+Number(p[0]):0};
  const stockTotal=STOCK.reduce((a,x)=>a+(Number(x.valor_estoque)||0),0);
  let mins=[];try{mins=typeof minimumBaseRows==='function'?minimumBaseRows():MOVEMENTS}catch(e){mins=Array.isArray(MOVEMENTS)?MOVEMENTS:[]}
  const needGross=mins.reduce((a,x)=>a+(Number(x.need_value)||0),0);
  const below=mins.filter(x=>x.status==='ABAIXO DO MÍNIMO').length;
  const noStock=mins.filter(x=>x.status==='SEM ESTOQUE').length;
  const attention=mins.filter(x=>x.status==='ATENÇÃO').length;
  const movMap=new Map((Array.isArray(MOVEMENTS)?MOVEMENTS:[]).map(x=>[String(x.local)+'|'+String(x.codigo),x]));
  const deadRows=STOCK.filter(x=>!((Number(movMap.get(String(x.local)+'|'+String(x.codigo))?.total)||0)>0));
  const deadValue=deadRows.reduce((a,x)=>a+(Number(x.valor_estoque)||0),0);
  const needBy=new Map(),srcBy=new Map();
  for(const x of mins){const k=String(x.codigo)+'|'+String(x.un||'');if(Number(x.need)>0){if(!needBy.has(k))needBy.set(k,[]);needBy.get(k).push({...x,left:Number(x.need)||0})}if(Number(x.excess)>0){if(!srcBy.has(k))srcBy.set(k,[]);srcBy.get(k).push({...x,left:Number(x.excess)||0})}}
  const transfers=[];
  for(const [k,needs] of needBy){const srcs=srcBy.get(k)||[];for(const d of needs.sort((a,b)=>(b.need_value||0)-(a.need_value||0))){for(const o of srcs.sort((a,b)=>(b.excess||0)-(a.excess||0))){if(d.local===o.local||d.left<=0||o.left<=0)continue;const q=Math.min(d.left,o.left);if(q<=0)continue;const cost=Number(d.cost)||Number(o.cost)||0;transfers.push({codigo:d.codigo,produto:d.produto,origem:o.local,destino:d.local,qtd:q,valor:q*cost});d.left-=q;o.left-=q;}}}
  const transferValue=transfers.reduce((a,x)=>a+x.valor,0);
  const buyAfter=Math.max(needGross-transferValue,0);
  const bench=new Map();
  for(const x of PURCHASES){const p=Number(x.preco)||0;if(!(p>0))continue;const k=String(x.codigo)+'|'+String(x.un||'');const b=bench.get(k);if(!b||p<b.preco)bench.set(k,x)}
  let histSavings=0,eligible=0,atBest=0;
  for(const x of PURCHASES){const p=Number(x.preco)||0,q=Number(x.qtd)||0;if(!(p>0&&q>0))continue;const b=bench.get(String(x.codigo)+'|'+String(x.un||''));if(!b)continue;eligible++;const d=p-(Number(b.preco)||0);if(Math.abs(d)<.005)atBest++;else if(d>.005)histSavings+=d*q}
  const recent=PURCHASES.filter(x=>dk(x.data)>=20260801);
  const recentValue=recent.reduce((a,x)=>a+(Number(x.valor)||0),0);
  const broad=window.ECONOMY_POTENTIAL_DATA?.summary||{};
  const broadPotential=Number(broad.potential)||0;
  const broadRate=Number(broad.maxTotal)>0?broadPotential/Number(broad.maxTotal):0;
  const broadOpp=Number(broad.opportunities)||0;
  const latestPurchase=PURCHASES.reduce((d,x)=>Math.max(d,dk(x.data)),0);
  const fmtDateKey=k=>k?String(k).replace(/(\d{4})(\d{2})(\d{2})/,'$3/$2/$1'):'';
  const stockRef=(document.querySelector('header p')?.textContent.match(/posição de estoque:\s*([^•]+)/i)||[])[1]?.trim()||'08/09/2026';
  const locMap=new Map();for(const x of STOCK){locMap.set(x.local,(locMap.get(x.local)||0)+(Number(x.valor_estoque)||0))}
  const topLoc=[...locMap.entries()].sort((a,b)=>b[1]-a[1]).slice(0,5);
  const topNeeds=[...mins].filter(x=>(Number(x.need_value)||0)>0).sort((a,b)=>(b.need_value||0)-(a.need_value||0)).slice(0,5);
  const topDead=[...deadRows].sort((a,b)=>(b.valor_estoque||0)-(a.valor_estoque||0)).slice(0,5);
  const groupRows=(window.ECONOMY_POTENTIAL_DATA?.groups||[]).slice().sort((a,b)=>(Number(b[3])||0)-(Number(a[3])||0)).slice(0,5);
  const recentSup=new Map();for(const x of recent)recentSup.set(x.fornecedor,(recentSup.get(x.fornecedor)||0)+(Number(x.valor)||0));const topRecentSup=[...recentSup.entries()].sort((a,b)=>b[1]-a[1]).slice(0,5);
  const css=document.createElement('style');css.textContent=`
    #view-executivo{--b-navy:#17365d;--b-blue:#245982;--b-text:#263548;--b-muted:#697789;--b-line:#e1e7ef;--b-soft:#f7f9fc;--b-red:#a43b3b;--b-orange:#a66012;--b-green:#267052}
    #view-executivo .board-hero{display:grid;grid-template-columns:1.55fr .45fr;gap:16px;padding:20px 22px;margin-bottom:12px;border-radius:16px;background:linear-gradient(118deg,#17365d,#245982);color:#fff;box-shadow:0 8px 24px rgba(23,54,93,.15)}
    #view-executivo .board-hero h2{font-size:22px;margin:0 0 7px}#view-executivo .board-hero p{margin:0;max-width:980px;font-size:11px;line-height:1.55;opacity:.94}#view-executivo .board-ref{text-align:right;align-self:center;font-size:10px;line-height:1.7;opacity:.9}
    #view-executivo .board-reading{display:grid;grid-template-columns:1fr 1fr 1fr;gap:9px;margin-bottom:12px}#view-executivo .board-reading>div{background:#fff;border:1px solid var(--b-line);border-radius:13px;padding:12px 14px}#view-executivo .board-reading b{display:block;font-size:10px;text-transform:uppercase;letter-spacing:.035em;margin-bottom:5px;color:var(--b-navy)}#view-executivo .board-reading span{font-size:10.5px;line-height:1.45;color:var(--b-text)}
    #view-executivo .board-kpis{display:grid;grid-template-columns:repeat(4,1fr);gap:9px;margin-bottom:12px}#view-executivo .board-kpi{background:#fff;border:1px solid var(--b-line);border-radius:13px;padding:12px 13px;box-shadow:0 5px 17px rgba(23,54,93,.04)}#view-executivo .board-kpi .label{font-size:8.5px;text-transform:uppercase;font-weight:850;letter-spacing:.035em;color:var(--b-muted)}#view-executivo .board-kpi .value{font-size:19px;font-weight:900;color:var(--b-navy);margin:5px 0 3px}#view-executivo .board-kpi .sub{font-size:9px;line-height:1.35;color:var(--b-muted)}#view-executivo .board-kpi.risk .value{color:var(--b-red)}#view-executivo .board-kpi.attn .value{color:var(--b-orange)}#view-executivo .board-kpi.opp .value{color:var(--b-green)}
    #view-executivo .board-decisions{background:#fff;border:1px solid var(--b-line);border-radius:14px;margin-bottom:12px;overflow:hidden}#view-executivo .board-title{display:flex;justify-content:space-between;align-items:center;padding:12px 14px;border-bottom:1px solid var(--b-line)}#view-executivo .board-title h3{font-size:13px;margin:0;color:var(--b-navy)}#view-executivo .board-title span{font-size:9px;color:var(--b-muted)}#view-executivo .board-decision{display:grid;grid-template-columns:95px 1fr 160px 160px;gap:10px;align-items:center;padding:10px 14px;border-bottom:1px solid #eef2f6;font-size:10px}#view-executivo .board-decision:last-child{border-bottom:0}#view-executivo .board-badge{display:inline-flex;justify-content:center;border-radius:999px;padding:4px 7px;font-size:8.5px;font-weight:900;text-transform:uppercase}.board-badge.red{background:#fceaea;color:#923939}.board-badge.orange{background:#fff2de;color:#8d570c}.board-badge.green{background:#e8f5ef;color:#27664d}.board-badge.blue{background:#eaf1f8;color:#245982}#view-executivo .board-decision strong{color:var(--b-text)}#view-executivo .board-decision .amount{text-align:right;font-weight:900;color:var(--b-navy)}#view-executivo .board-link{justify-self:end;border:1px solid #d9e2ec;background:#fff;color:var(--b-navy);border-radius:8px;padding:6px 8px;font-size:9px;font-weight:850;cursor:pointer}#view-executivo .board-link:hover{background:#f1f5f9}
    #view-executivo .board-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:12px}#view-executivo .board-panel{background:#fff;border:1px solid var(--b-line);border-radius:14px;overflow:hidden}#view-executivo .board-panel table{width:100%;border-collapse:collapse;font-size:9.5px}#view-executivo .board-panel th{padding:7px 9px;background:#f2f6fa;color:var(--b-navy);text-align:left;font-size:8.5px;text-transform:uppercase}#view-executivo .board-panel td{padding:7px 9px;border-bottom:1px solid #eef2f6;color:var(--b-text)}#view-executivo .board-panel tr:last-child td{border-bottom:0}#view-executivo .num{text-align:right!important;white-space:nowrap}
    #view-executivo .board-method{display:grid;grid-template-columns:1fr 1fr;gap:9px;padding:12px 14px;background:#f7f9fc;border:1px solid var(--b-line);border-radius:13px}#view-executivo .board-method b{display:block;font-size:9px;color:var(--b-navy);margin-bottom:4px;text-transform:uppercase}#view-executivo .board-method p{margin:0;font-size:9px;line-height:1.45;color:var(--b-muted)}
    @media(max-width:1100px){#view-executivo .board-kpis{grid-template-columns:repeat(2,1fr)}#view-executivo .board-grid{grid-template-columns:1fr}#view-executivo .board-reading{grid-template-columns:1fr}#view-executivo .board-decision{grid-template-columns:80px 1fr 120px}#view-executivo .board-decision .board-link{display:none}}
    @media(max-width:700px){#view-executivo .board-hero{grid-template-columns:1fr}#view-executivo .board-ref{text-align:left}#view-executivo .board-kpis{grid-template-columns:1fr}#view-executivo .board-method{grid-template-columns:1fr}#view-executivo .board-decision{grid-template-columns:1fr}#view-executivo .board-decision .amount{text-align:left}}
  `;document.head.appendChild(css);
  const criticalCount=below+noStock;
  const reduction=needGross>0?transferValue/needGross:0;
  const bestRate=eligible>0?atBest/eligible:0;
  const reading1=`A posição atual é de <b>${br(stockTotal)}</b> em estoque. Deste total, <b>${br(deadValue)}</b> (${pct(stockTotal?deadValue/stockTotal:0)}) está sem giro no histórico analisado e deve ser revisado.`;
  const reading2=`A necessidade bruta de reposição é de <b>${br(needGross)}</b>. Antes de comprar, há <b>${br(transferValue)}</b> de potencial de transferência interna, reduzindo a compra estimada para <b>${br(buyAfter)}</b>.`;
  const reading3=`Na frente de compras, o histórico com fornecedor mostra <b>${br(histSavings)}</b> de economia potencial. A análise ampliada, que também captura compra direta, aponta <b>${br(broadPotential)}</b> de potencial teórico.`;
  const locRows=topLoc.map(([l,v])=>`<tr><td>${esc(l)}</td><td class="num">${br(v)}</td><td class="num">${pct(stockTotal?v/stockTotal:0)}</td></tr>`).join('');
  const needRows=topNeeds.map(x=>`<tr><td>${esc(x.local)}</td><td>${esc(x.codigo)} - ${esc(x.produto)}</td><td class="num">${br(x.need_value)}</td></tr>`).join('');
  const deadTable=topDead.map(x=>`<tr><td>${esc(x.local)}</td><td>${esc(x.codigo)} - ${esc(x.produto)}</td><td class="num">${br(x.valor_estoque)}</td></tr>`).join('');
  const ecoRows=groupRows.map(x=>`<tr><td>${esc(x[0])}</td><td class="num">${br(x[3])}</td><td class="num">${n0(x[6])}</td></tr>`).join('');
  const supRows=topRecentSup.map(([s,v])=>`<tr><td>${esc(s)}</td><td class="num">${br(v)}</td><td class="num">${pct(recentValue?v/recentValue:0)}</td></tr>`).join('');
  view.innerHTML=`
    <div class="board-hero"><div><h2>Resumo para Diretoria</h2><p>Visão consolidada para decisão sobre capital em estoque, risco de abastecimento, necessidade de reposição e oportunidades de redução de custo. Os valores abaixo são recalculados com as bases mais recentes carregadas no dashboard.</p></div><div class="board-ref"><b>Posição de estoque</b><br>${esc(stockRef)}<br><b>Compras atualizadas até</b><br>${esc(fmtDateKey(latestPurchase))}</div></div>
    <div class="board-reading"><div><b>Capital</b><span>${reading1}</span></div><div><b>Abastecimento</b><span>${reading2}</span></div><div><b>Compras</b><span>${reading3}</span></div></div>
    <div class="board-kpis">
      <div class="board-kpi"><div class="label">Valor total em estoque</div><div class="value">${br(stockTotal)}</div><div class="sub">Capital atualmente imobilizado nos almoxarifados.</div></div>
      <div class="board-kpi attn"><div class="label">Capital sem giro</div><div class="value">${br(deadValue)}</div><div class="sub">${n0(deadRows.length)} itens • ${pct(stockTotal?deadValue/stockTotal:0)} do estoque.</div></div>
      <div class="board-kpi risk"><div class="label">Necessidade bruta de reposição</div><div class="value">${br(needGross)}</div><div class="sub">Baseada na política de cobertura de 4 meses.</div></div>
      <div class="board-kpi opp"><div class="label">Transferir antes de comprar</div><div class="value">${br(transferValue)}</div><div class="sub">Potencial de redução de ${pct(reduction)} da necessidade bruta.</div></div>
      <div class="board-kpi risk"><div class="label">Compra estimada após transferências</div><div class="value">${br(buyAfter)}</div><div class="sub">Valor a avaliar para reposição após realocação interna.</div></div>
      <div class="board-kpi risk"><div class="label">Itens críticos de abastecimento</div><div class="value">${n0(criticalCount)}</div><div class="sub">${n0(noStock)} sem estoque + ${n0(below)} abaixo do mínimo • ${n0(attention)} em atenção.</div></div>
      <div class="board-kpi"><div class="label">Compras desde 01/08/2026</div><div class="value">${br(recentValue)}</div><div class="sub">Base de compras efetivamente registrada no período.</div></div>
      <div class="board-kpi opp"><div class="label">Potencial amplo de economia</div><div class="value">${br(broadPotential)}</div><div class="sub">${n0(broadOpp)} oportunidades • ${pct(broadRate)} sobre o cenário de maior custo.</div></div>
    </div>
    <div class="board-decisions"><div class="board-title"><h3>Decisões prioritárias</h3><span>Ordem sugerida para discussão em diretoria</span></div>
      <div class="board-decision"><span class="board-badge red">1. Crítico</span><strong>Evitar ruptura: priorizar itens sem estoque e abaixo do mínimo com consumo.</strong><span class="amount">${n0(criticalCount)} itens</span><button class="board-link" data-target="minimo">Abrir estoque mínimo</button></div>
      <div class="board-decision"><span class="board-badge blue">2. Ação</span><strong>Realocar saldo entre almoxarifados antes de liberar novas compras.</strong><span class="amount">${br(transferValue)}</span><button class="board-link" data-target="minimo">Ver transferências</button></div>
      <div class="board-decision"><span class="board-badge orange">3. Atenção</span><strong>Revisar capital sem giro e definir transferência, devolução, baixa ou bloqueio de novas compras.</strong><span class="amount">${br(deadValue)}</span><button class="board-link" data-target="estoque">Abrir estoques</button></div>
      <div class="board-decision"><span class="board-badge green">4. Economia</span><strong>Usar menor custo histórico como referência nas compras, incluindo compra direta.</strong><span class="amount">${br(broadPotential)}</span><button class="board-link" data-target="potencial">Abrir potencial</button></div>
      <div class="board-decision"><span class="board-badge green">5. Compra</span><strong>Acompanhar aderência ao menor preço já praticado por código e unidade.</strong><span class="amount">${pct(bestRate)} no menor preço</span><button class="board-link" data-target="variacao">Abrir variações</button></div>
    </div>
    <div class="board-grid">
      <div class="board-panel"><div class="board-title"><h3>Onde está o capital em estoque</h3><span>5 maiores almoxarifados</span></div><table><thead><tr><th>Almoxarifado</th><th class="num">Estoque</th><th class="num">Participação</th></tr></thead><tbody>${locRows||'<tr><td colspan="3">Sem dados.</td></tr>'}</tbody></table></div>
      <div class="board-panel"><div class="board-title"><h3>Maiores necessidades de reposição</h3><span>Prioridade por valor</span></div><table><thead><tr><th>Local</th><th>Produto</th><th class="num">Reposição</th></tr></thead><tbody>${needRows||'<tr><td colspan="3">Sem necessidades calculadas.</td></tr>'}</tbody></table></div>
      <div class="board-panel"><div class="board-title"><h3>Maior capital sem giro</h3><span>Itens para revisão</span></div><table><thead><tr><th>Local</th><th>Produto</th><th class="num">Valor</th></tr></thead><tbody>${deadTable||'<tr><td colspan="3">Sem dados.</td></tr>'}</tbody></table></div>
      <div class="board-panel"><div class="board-title"><h3>Potencial de economia por grupo</h3><span>Análise ampliada</span></div><table><thead><tr><th>Grupo</th><th class="num">Potencial</th><th class="num">Oportunidades</th></tr></thead><tbody>${ecoRows||'<tr><td colspan="3">Sem dados.</td></tr>'}</tbody></table></div>
      <div class="board-panel"><div class="board-title"><h3>Fornecedores — compras desde 01/08</h3><span>${br(recentValue)} no período</span></div><table><thead><tr><th>Fornecedor</th><th class="num">Valor</th><th class="num">Participação</th></tr></thead><tbody>${supRows||'<tr><td colspan="3">Sem compras no período.</td></tr>'}</tbody></table></div>
      <div class="board-panel"><div class="board-title"><h3>Leitura de compras</h3><span>Indicadores de negociação</span></div><table><tbody><tr><td>Economia potencial nas compras registradas</td><td class="num"><b>${br(histSavings)}</b></td></tr><tr><td>Linhas compradas no menor preço histórico</td><td class="num"><b>${pct(bestRate)}</b></td></tr><tr><td>Potencial ampliado (inclui compra direta)</td><td class="num"><b>${br(broadPotential)}</b></td></tr><tr><td>Compra recente analisada desde 01/08</td><td class="num"><b>${br(recentValue)}</b></td></tr></tbody></table></div>
    </div>
    <div class="board-method"><div><b>Economia nas compras registradas</b><p>Compara cada compra com o menor preço histórico do mesmo código e unidade dentro da base de compras que identifica fornecedor. É uma medida diretamente ligada às compras registradas no histórico do dashboard.</p></div><div><b>Potencial amplo de economia</b><p>Usa o relatório histórico de custos que também captura compra direta. Compara cenários de maior e menor custo e deve ser tratado como potencial teórico para direcionar negociação e padronização, não como economia já realizada.</p></div></div>`;
  view.querySelectorAll('.board-link').forEach(b=>b.addEventListener('click',()=>{const t=document.querySelector(`.tab[data-view="${b.dataset.target}"]`);if(t)t.click()}));
})();
