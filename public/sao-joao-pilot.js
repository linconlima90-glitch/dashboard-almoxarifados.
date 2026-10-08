// Piloto operacional - Almoxarifado Sao Joao
(function(){
  if(document.documentElement.dataset.saoJoaoPilot==='1')return;
  document.documentElement.dataset.saoJoaoPilot='1';
  document.documentElement.classList.add('sj-pilot-route');

  const LOCAL_CODE='50115';
  const LOCAL_NAME='ALMOXARIFADO GERAL F SJ';
  const norm=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toUpperCase().trim();
  const esc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  const br=v=>new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(Number(v)||0);
  const n=v=>new Intl.NumberFormat('pt-BR',{maximumFractionDigits:2}).format(Number(v)||0);
  const n0=v=>new Intl.NumberFormat('pt-BR',{maximumFractionDigits:0}).format(Number(v)||0);
  const pct=v=>new Intl.NumberFormat('pt-BR',{style:'percent',minimumFractionDigits:1,maximumFractionDigits:1}).format(Number(v)||0);
  const isLocal=x=>String(x?.codigo_local||'')===LOCAL_CODE||norm(x?.local)===LOCAL_NAME;
  const isTire=x=>window.DASHBOARD_POLICY?.isTire?window.DASHBOARD_POLICY.isTire(x):(norm(x?.grupo).includes('PNEU')||norm(x?.produto).startsWith('PNEU ')||norm(x?.grupo).includes('CAMARAS DE AR'));
  const isLub=x=>window.DASHBOARD_POLICY?.isLubricant?window.DASHBOARD_POLICY.isLubricant(x):norm(x?.grupo).includes('LUBRIFIC');
  const coverage=v=>Number.isFinite(Number(v))?n(Number(v))+' meses':'-';

  const style=document.createElement('style');
  style.id='sj-pilot-style';
  style.textContent=`
    html.sj-pilot-route body{margin:0;background:#f2f6f3;color:#29342d;font-family:Arial,Helvetica,sans-serif;overflow:auto!important}
    html.sj-pilot-route body>*:not(#db-boot-screen):not(#sj-pilot-root){display:none!important}
    #sj-pilot-root{display:block;min-height:100vh;background:#f2f6f3}
    .sj-head{background:linear-gradient(112deg,#0d4726,#16733b 70%,#1e8747);border-bottom:4px solid #faca04;color:#fff;box-shadow:0 6px 20px rgba(13,71,38,.2)}
    .sj-head-in{max-width:1680px;margin:auto;padding:15px 24px;display:flex;align-items:center;gap:16px}
    .sj-logo{background:#fff;color:#168a48;font-weight:950;font-size:26px;letter-spacing:-1px;border-radius:11px;padding:10px 17px;box-shadow:0 5px 16px rgba(0,0,0,.14)}
    .sj-title{min-width:0}.sj-title h1{margin:0;font-size:22px;line-height:1.15}.sj-title p{margin:5px 0 0;font-size:10.5px;opacity:.86}
    .sj-status{margin-left:auto;text-align:right;font-size:9px;line-height:1.55;opacity:.9}
    .sj-wrap{max-width:1680px;margin:auto;padding:14px 22px 38px}
    .sj-nav{position:sticky;top:0;z-index:20;display:flex;gap:6px;align-items:center;padding:8px;background:rgba(255,255,255,.97);border:1px solid #cdded3;border-radius:14px;box-shadow:0 7px 22px rgba(13,71,38,.08);backdrop-filter:blur(10px)}
    .sj-nav button{border:0;background:transparent;color:#57645c;border-radius:9px;padding:9px 13px;font-size:11px;font-weight:900;cursor:pointer}
    .sj-nav button:hover{background:#eaf5ed;color:#0d4726}.sj-nav button.active{background:linear-gradient(110deg,#125c31,#1e8747);color:#fff;box-shadow:0 3px 9px rgba(30,135,71,.22)}
    .sj-badge{margin-left:auto;border-radius:999px;background:#fff6c7;color:#0d4726;border:1px solid #efd76b;padding:6px 9px;font-size:9px;font-weight:900}
    .sj-section{display:none}.sj-section.active{display:block}
    .sj-hero{margin:12px 0;background:linear-gradient(118deg,#0d4726,#16733b 64%,#1e8747);border-radius:15px;color:#fff;padding:17px 19px;position:relative;overflow:hidden;box-shadow:0 9px 25px rgba(13,71,38,.16)}
    .sj-hero:after{content:'';position:absolute;right:0;top:0;width:150px;height:6px;background:#faca04}.sj-hero h2{margin:0 0 6px;font-size:18px}.sj-hero p{margin:0;font-size:10px;line-height:1.5;opacity:.9}
    .sj-kpis{display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:9px;margin-bottom:11px}
    .sj-kpi{background:#fff;border:1px solid #d5e3d9;border-radius:13px;padding:12px 13px;box-shadow:0 6px 18px rgba(17,92,49,.055);position:relative;overflow:hidden}
    .sj-kpi:before{content:'';position:absolute;left:0;top:0;bottom:0;width:4px;background:#1e8747}.sj-kpi.warn:before{background:#faca04}.sj-kpi.risk:before{background:#b64c4c}
    .sj-kpi .k{font-size:8px;text-transform:uppercase;letter-spacing:.04em;font-weight:900;color:#6d7971}.sj-kpi .v{margin:6px 0 3px;font-size:19px;font-weight:950;color:#0d4726}.sj-kpi.risk .v{color:#9d3838}.sj-kpi .s{font-size:8.5px;color:#7a857e;line-height:1.35}
    .sj-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:10px}.sj-card{background:#fff;border:1px solid #d5e3d9;border-radius:14px;overflow:hidden;box-shadow:0 6px 18px rgba(17,92,49,.05)}
    .sj-card-head{padding:11px 13px;border-bottom:1px solid #e5eee8;display:flex;align-items:center;justify-content:space-between;gap:10px}.sj-card-head h3{margin:0;font-size:12px;color:#0d4726}.sj-card-head span{font-size:8.5px;color:#77847b}
    .sj-actions{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;padding:12px}.sj-action{border:1px solid #dce8e0;background:#fbfdfb;border-radius:11px;padding:11px;text-align:left;cursor:pointer}.sj-action:hover{background:#f1f8f3}.sj-action b{display:block;font-size:20px;color:#0d4726}.sj-action span{display:block;margin-top:3px;font-size:8.5px;color:#69766e}
    .sj-table-wrap{overflow:auto}.sj-table{width:100%;border-collapse:collapse;font-size:9px}.sj-table th{background:#0d4726;color:#fff;text-align:left;padding:8px 9px;font-size:8px;text-transform:uppercase;white-space:nowrap}.sj-table td{padding:8px 9px;border-bottom:1px solid #e8f0eb;vertical-align:top}.sj-table tbody tr:nth-child(even){background:#fbfdfb}.sj-table tbody tr:hover{background:#edf8f1}.sj-table .num{text-align:right;white-space:nowrap}
    .sj-chip{display:inline-block;border-radius:999px;padding:3px 6px;font-size:7.5px;font-weight:900}.sj-chip.red{background:#fbeaea;color:#9c3737}.sj-chip.orange{background:#fff0da;color:#955c0f}.sj-chip.green{background:#e8f5ed;color:#176b39}.sj-chip.gray{background:#eef2ef;color:#67736b}
    .sj-tools{display:flex;gap:8px;align-items:center;padding:11px 12px;background:#fff;border:1px solid #d5e3d9;border-radius:13px;margin:12px 0 9px}.sj-tools input{flex:1;min-width:180px;border:1px solid #cfded4;border-radius:9px;padding:9px 10px;font-size:10px;outline:none}.sj-tools input:focus{border-color:#1e8747;box-shadow:0 0 0 3px rgba(30,135,71,.1)}.sj-tools span{font-size:9px;color:#6d786f}
    .sj-note{padding:10px 12px;border:1px solid #d9e6dd;border-left:4px solid #1e8747;background:#f7fbf8;border-radius:10px;font-size:9px;line-height:1.5;color:#5f6c64;margin-top:10px}
    .sj-empty{padding:26px;text-align:center;color:#7a867e;font-size:10px}
    .sj-loading{min-height:360px;display:grid;place-items:center}.sj-loading-box{text-align:center;color:#66736b;font-size:11px}.sj-spin{width:28px;height:28px;border:3px solid #dce9e0;border-top-color:#1e8747;border-radius:50%;margin:0 auto 11px;animation:sjspin .8s linear infinite}@keyframes sjspin{to{transform:rotate(360deg)}}
    @media(max-width:1200px){.sj-kpis{grid-template-columns:repeat(3,1fr)}.sj-actions{grid-template-columns:repeat(2,1fr)}}
    @media(max-width:760px){.sj-head-in{padding:12px 14px}.sj-logo{font-size:20px;padding:8px 12px}.sj-title h1{font-size:16px}.sj-status{display:none}.sj-wrap{padding:10px}.sj-nav{position:static;display:grid;grid-template-columns:repeat(2,1fr)}.sj-badge{display:none}.sj-nav button{text-align:center}.sj-kpis{grid-template-columns:repeat(2,1fr)}.sj-grid{grid-template-columns:1fr}.sj-actions{grid-template-columns:1fr 1fr}}
  `;
  document.head.appendChild(style);

  const root=document.createElement('div');
  root.id='sj-pilot-root';
  root.innerHTML=`
    <div class="sj-head"><div class="sj-head-in">
      <div class="sj-logo">DB</div>
      <div class="sj-title"><h1>Almoxarifado São João</h1><p>Painel operacional do responsável • visão exclusiva do local</p></div>
      <div class="sj-status">Posição de estoque: <b>08/10/2026</b><br>Baixas atualizadas até: <b>08/10/2026</b></div>
    </div></div>
    <main class="sj-wrap">
      <nav class="sj-nav">
        <button type="button" class="active" data-sj-tab="overview">Visão geral</button>
        <button type="button" data-sj-tab="stock">Estoque</button>
        <button type="button" data-sj-tab="replenishment">Reposição</button>
        <button type="button" data-sj-tab="consumption">Consumo / Baixas</button>
        <span class="sj-badge">50115 • São João</span>
      </nav>
      <div id="sj-content"><div class="sj-loading"><div class="sj-loading-box"><div class="sj-spin"></div>Carregando dados de São João...</div></div></div>
    </main>
  `;
  document.body.appendChild(root);

  let active='overview',search='';
  const content=document.getElementById('sj-content');

  function statusChip(s){
    if(s==='SEM ESTOQUE'||s==='ABAIXO DO MÍNIMO')return '<span class="sj-chip red">'+esc(s)+'</span>';
    if(s==='ATENÇÃO')return '<span class="sj-chip orange">ATENÇÃO</span>';
    if(s==='OK')return '<span class="sj-chip green">OK</span>';
    return '<span class="sj-chip gray">'+esc(s||'-')+'</span>';
  }

  function data(){
    if(typeof STOCK==='undefined'||!Array.isArray(STOCK)||typeof MOVEMENTS==='undefined'||!Array.isArray(MOVEMENTS))return null;
    const stock=STOCK.filter(isLocal);
    if(!stock.length)return null;
    const movements=MOVEMENTS.filter(isLocal);
    const mm=new Map(movements.map(x=>[String(x.codigo),x]));
    const totalValue=stock.reduce((a,x)=>a+(Number(x.valor_estoque)||0),0);
    const totalQty=stock.reduce((a,x)=>a+(Number(x.estoque)||0),0);
    const products=new Set(stock.map(x=>String(x.codigo))).size;
    const replenishment=movements.filter(x=>!isTire(x)&&['SEM ESTOQUE','ABAIXO DO MÍNIMO','ATENÇÃO'].includes(String(x.status||'')));
    const critical=replenishment.filter(x=>x.status==='SEM ESTOQUE'||x.status==='ABAIXO DO MÍNIMO');
    const noStock=critical.filter(x=>x.status==='SEM ESTOQUE');
    const attention=replenishment.filter(x=>x.status==='ATENÇÃO');
    const needValue=critical.reduce((a,x)=>a+(Number(x.need_value)||0),0);
    const noTurn=stock.filter(x=>!isTire(x)&&!isLub(x)&&!((Number(mm.get(String(x.codigo))?.total)||0)>0));
    const noTurnValue=noTurn.reduce((a,x)=>a+(Number(x.valor_estoque)||0),0);
    const consumption=movements.reduce((a,x)=>a+(Number(x.total)||0),0);
    const october=movements.reduce((a,x)=>a+(Number(x.qtd_set_20261008)||0),0);
    const octoberValue=movements.reduce((a,x)=>a+(Number(x.valor_set_20261008)||0),0);
    const groups=new Map();
    for(const x of stock){
      const k=String(x.grupo||'SEM GRUPO'),g=groups.get(k)||{grupo:k,value:0,qty:0,products:new Set()};
      g.value+=Number(x.valor_estoque)||0;g.qty+=Number(x.estoque)||0;g.products.add(String(x.codigo));groups.set(k,g);
    }
    return {stock,movements,mm,totalValue,totalQty,products,replenishment,critical,noStock,attention,needValue,noTurn,noTurnValue,consumption,october,octoberValue,groups:[...groups.values()].sort((a,b)=>b.value-a.value)};
  }

  function renderOverview(d){
    const criticalTop=d.critical.slice().sort((a,b)=>(Number(b.need_value)||0)-(Number(a.need_value)||0)).slice(0,10);
    const consTop=d.movements.slice().sort((a,b)=>(Number(b.total)||0)-(Number(a.total)||0)).slice(0,10);
    return `
      <section class="sj-section active">
        <div class="sj-hero"><h2>Visão operacional de São João</h2><p>Indicadores para acompanhamento diário do estoque, reposição para 2 meses e consumo. Pneus e câmaras permanecem visíveis no estoque, mas não entram no cálculo de reposição; lubrificantes, pneus e câmaras ficam fora da análise de sem giro.</p></div>
        <div class="sj-kpis">
          <div class="sj-kpi"><div class="k">Valor em estoque</div><div class="v">${br(d.totalValue)}</div><div class="s">${n0(d.products)} produtos cadastrados no local.</div></div>
          <div class="sj-kpi"><div class="k">Saldo total</div><div class="v">${n(d.totalQty)}</div><div class="s">Soma das unidades em estoque.</div></div>
          <div class="sj-kpi risk"><div class="k">Itens críticos</div><div class="v">${n0(d.critical.length)}</div><div class="s">${n0(d.noStock.length)} sem estoque + ${n0(d.critical.length-d.noStock.length)} abaixo do mínimo.</div></div>
          <div class="sj-kpi risk"><div class="k">Reposição estimada</div><div class="v">${br(d.needValue)}</div><div class="s">Política de 2 meses de consumo médio mensal.</div></div>
          <div class="sj-kpi warn"><div class="k">Sem giro</div><div class="v">${n0(d.noTurn.length)}</div><div class="s">${br(d.noTurnValue)} em capital para revisão.</div></div>
          <div class="sj-kpi"><div class="k">Baixas de outubro</div><div class="v">${n(d.october)}</div><div class="s">${br(d.octoberValue)} no período de 01 a 08/10.</div></div>
        </div>
        <div class="sj-card" style="margin-bottom:10px"><div class="sj-card-head"><h3>Ações do almoxarifado</h3><span>Prioridades para conferência</span></div><div class="sj-actions">
          <button class="sj-action" data-open-tab="replenishment"><b>${n0(d.noStock.length)}</b><span>Itens sem estoque</span></button>
          <button class="sj-action" data-open-tab="replenishment"><b>${n0(d.critical.length-d.noStock.length)}</b><span>Abaixo do mínimo</span></button>
          <button class="sj-action" data-open-tab="replenishment"><b>${n0(d.attention.length)}</b><span>Itens em atenção</span></button>
          <button class="sj-action" data-show-noturn="1"><b>${n0(d.noTurn.length)}</b><span>Itens sem giro para revisar</span></button>
        </div></div>
        <div class="sj-grid">
          <div class="sj-card"><div class="sj-card-head"><h3>Maiores necessidades de reposição</h3><span>Top 10 por valor</span></div><div class="sj-table-wrap"><table class="sj-table"><thead><tr><th>Produto</th><th>Status</th><th class="num">Estoque</th><th class="num">Mínimo</th><th class="num">Comprar</th><th class="num">Valor</th></tr></thead><tbody>
            ${criticalTop.map(x=>`<tr><td><b>${esc(x.codigo)}</b> - ${esc(x.produto)}</td><td>${statusChip(x.status)}</td><td class="num">${n(x.stock)}</td><td class="num">${n(x.minimum)}</td><td class="num">${n(x.need)}</td><td class="num">${br(x.need_value)}</td></tr>`).join('')||'<tr><td colspan="6" class="sj-empty">Sem itens críticos.</td></tr>'}
          </tbody></table></div></div>
          <div class="sj-card"><div class="sj-card-head"><h3>Produtos com maior consumo</h3><span>Histórico analisado</span></div><div class="sj-table-wrap"><table class="sj-table"><thead><tr><th>Produto</th><th class="num">Baixas</th><th class="num">Média/mês</th><th class="num">Estoque</th><th class="num">Cobertura</th></tr></thead><tbody>
            ${consTop.map(x=>`<tr><td><b>${esc(x.codigo)}</b> - ${esc(x.produto)}</td><td class="num">${n(x.total)}</td><td class="num">${n(x.avg)}</td><td class="num">${n(x.stock)}</td><td class="num">${coverage(x.coverage)}</td></tr>`).join('')||'<tr><td colspan="5" class="sj-empty">Sem consumo registrado.</td></tr>'}
          </tbody></table></div></div>
        </div>
        <div class="sj-card"><div class="sj-card-head"><h3>Capital por grupo</h3><span>Distribuição do estoque local</span></div><div class="sj-table-wrap"><table class="sj-table"><thead><tr><th>Grupo</th><th class="num">Produtos</th><th class="num">Saldo</th><th class="num">Valor</th><th class="num">% do capital</th></tr></thead><tbody>
          ${d.groups.map(g=>`<tr><td>${esc(g.grupo)}</td><td class="num">${n0(g.products.size)}</td><td class="num">${n(g.qty)}</td><td class="num">${br(g.value)}</td><td class="num">${pct(d.totalValue?g.value/d.totalValue:0)}</td></tr>`).join('')}
        </tbody></table></div></div>
        <div class="sj-note">Este piloto é uma visão exclusiva do Almoxarifado São João. O responsável não precisa selecionar local e não recebe comparações com os demais almoxarifados nesta tela.</div>
      </section>
    `;
  }

  function renderStock(d){
    const q=norm(search);
    const rows=d.stock.filter(x=>!q||norm([x.codigo,x.produto,x.grupo,x.un].join(' ')).includes(q)).sort((a,b)=>(Number(b.valor_estoque)||0)-(Number(a.valor_estoque)||0));
    return `
      <section class="sj-section active">
        <div class="sj-tools"><input id="sj-stock-search" type="search" placeholder="Buscar código, produto ou grupo..." value="${esc(search)}"><span>${n0(rows.length)} posições encontradas</span></div>
        <div class="sj-card"><div class="sj-card-head"><h3>Estoque de São João</h3><span>Posição de 08/10/2026</span></div><div class="sj-table-wrap"><table class="sj-table"><thead><tr><th>Código</th><th>Produto</th><th>Grupo</th><th>Un.</th><th class="num">Estoque</th><th class="num">Média/mês</th><th class="num">Cobertura</th><th class="num">Custo</th><th class="num">Valor</th></tr></thead><tbody>
          ${rows.slice(0,300).map(x=>`<tr><td><b>${esc(x.codigo)}</b></td><td>${esc(x.produto)}</td><td>${esc(x.grupo)}</td><td>${esc(x.un)}</td><td class="num">${n(x.estoque)}</td><td class="num">${n(x.media_mensal)}</td><td class="num">${coverage(x.cobertura)}</td><td class="num">${br(x.custo_estoque)}</td><td class="num">${br(x.valor_estoque)}</td></tr>`).join('')||'<tr><td colspan="9" class="sj-empty">Nenhum item encontrado.</td></tr>'}
        </tbody></table></div></div>
        ${rows.length>300?'<div class="sj-note">Exibindo as 300 primeiras posições. Use a busca para localizar itens específicos.</div>':''}
      </section>
    `;
  }

  function renderReplenishment(d){
    const rows=d.replenishment.slice().sort((a,b)=>{
      const rank=s=>s==='SEM ESTOQUE'?0:s==='ABAIXO DO MÍNIMO'?1:2;
      return rank(a.status)-rank(b.status)||(Number(b.need_value)||0)-(Number(a.need_value)||0);
    });
    return `
      <section class="sj-section active">
        <div class="sj-hero"><h2>Reposição de São João</h2><p>Estoque mínimo de 2 meses: prioriza ruptura e itens abaixo da meta. Pneus e câmaras de ar permanecem fora desta recomendação.</p></div>
        <div class="sj-kpis">
          <div class="sj-kpi risk"><div class="k">Sem estoque</div><div class="v">${n0(d.noStock.length)}</div><div class="s">Itens com histórico de consumo e saldo zerado.</div></div>
          <div class="sj-kpi risk"><div class="k">Abaixo do mínimo</div><div class="v">${n0(d.critical.length-d.noStock.length)}</div><div class="s">Itens abaixo da cobertura mínima.</div></div>
          <div class="sj-kpi warn"><div class="k">Em atenção</div><div class="v">${n0(d.attention.length)}</div><div class="s">Estoque próximo do nível mínimo.</div></div>
          <div class="sj-kpi"><div class="k">Valor de reposição</div><div class="v">${br(d.needValue)}</div><div class="s">Estimativa para itens críticos.</div></div>
        </div>
        <div class="sj-card"><div class="sj-card-head"><h3>Lista de reposição e atenção</h3><span>${n0(rows.length)} itens</span></div><div class="sj-table-wrap"><table class="sj-table"><thead><tr><th>Status</th><th>Código</th><th>Produto</th><th>Un.</th><th class="num">Estoque</th><th class="num">Média/mês</th><th class="num">Mínimo</th><th class="num">Necessidade</th><th class="num">Valor</th></tr></thead><tbody>
          ${rows.map(x=>`<tr><td>${statusChip(x.status)}</td><td><b>${esc(x.codigo)}</b></td><td>${esc(x.produto)}</td><td>${esc(x.un)}</td><td class="num">${n(x.stock)}</td><td class="num">${n(x.avg)}</td><td class="num">${n(x.minimum)}</td><td class="num">${n(x.need)}</td><td class="num">${br(x.need_value)}</td></tr>`).join('')||'<tr><td colspan="9" class="sj-empty">Nenhuma necessidade de reposição.</td></tr>'}
        </tbody></table></div></div>
      </section>
    `;
  }

  function renderConsumption(d){
    const rows=d.movements.slice().sort((a,b)=>(Number(b.total)||0)-(Number(a.total)||0));
    return `
      <section class="sj-section active">
        <div class="sj-hero"><h2>Consumo e baixas de São João</h2><p>O histórico acumulado orienta cobertura e estoque mínimo. As baixas de outubro já aparecem no consumo acumulado, mas outubro ainda parcial não altera a média mensal usada no mínimo.</p></div>
        <div class="sj-kpis">
          <div class="sj-kpi"><div class="k">Baixas acumuladas</div><div class="v">${n(d.consumption)}</div><div class="s">Unidades no histórico analisado.</div></div>
          <div class="sj-kpi"><div class="k">Baixas de outubro</div><div class="v">${n(d.october)}</div><div class="s">Período de 01 a 08/10.</div></div>
          <div class="sj-kpi"><div class="k">Custo das baixas de outubro</div><div class="v">${br(d.octoberValue)}</div><div class="s">Valor registrado no período de 01 a 08/10.</div></div>
        </div>
        <div class="sj-card"><div class="sj-card-head"><h3>Consumo por produto</h3><span>Ordenado pelo maior volume acumulado</span></div><div class="sj-table-wrap"><table class="sj-table"><thead><tr><th>Código</th><th>Produto</th><th>Grupo</th><th class="num">Baixas acumuladas</th><th class="num">01 a 08/10</th><th class="num">Média/mês</th><th class="num">Estoque</th><th class="num">Cobertura</th><th>Status</th></tr></thead><tbody>
          ${rows.map(x=>`<tr><td><b>${esc(x.codigo)}</b></td><td>${esc(x.produto)}</td><td>${esc(x.grupo)}</td><td class="num">${n(x.total)}</td><td class="num">${n(x.qtd_set_20261008)}</td><td class="num">${n(x.avg)}</td><td class="num">${n(x.stock)}</td><td class="num">${coverage(x.coverage)}</td><td>${statusChip(x.status)}</td></tr>`).join('')||'<tr><td colspan="9" class="sj-empty">Sem histórico de consumo.</td></tr>'}
        </tbody></table></div></div>
      </section>
    `;
  }

  function renderNoTurn(d){
    const rows=d.noTurn.slice().sort((a,b)=>(Number(b.valor_estoque)||0)-(Number(a.valor_estoque)||0));
    return `
      <section class="sj-section active">
        <div class="sj-tools"><button type="button" class="sj-action" data-open-tab="overview" style="max-width:180px"><span>← Voltar para visão geral</span></button><span>${n0(rows.length)} itens sem giro • ${br(d.noTurnValue)}</span></div>
        <div class="sj-card"><div class="sj-card-head"><h3>Itens sem giro para revisão</h3><span>Lubrificantes, pneus e câmaras excluídos</span></div><div class="sj-table-wrap"><table class="sj-table"><thead><tr><th>Código</th><th>Produto</th><th>Grupo</th><th>Un.</th><th class="num">Estoque</th><th class="num">Valor</th></tr></thead><tbody>
          ${rows.map(x=>`<tr><td><b>${esc(x.codigo)}</b></td><td>${esc(x.produto)}</td><td>${esc(x.grupo)}</td><td>${esc(x.un)}</td><td class="num">${n(x.estoque)}</td><td class="num">${br(x.valor_estoque)}</td></tr>`).join('')||'<tr><td colspan="6" class="sj-empty">Sem itens neste critério.</td></tr>'}
        </tbody></table></div></div>
      </section>
    `;
  }

  function render(){
    const d=data();
    if(!d){content.innerHTML='<div class="sj-loading"><div class="sj-loading-box"><div class="sj-spin"></div>Carregando dados de São João...</div></div>';return false}
    if(active==='stock')content.innerHTML=renderStock(d);
    else if(active==='replenishment')content.innerHTML=renderReplenishment(d);
    else if(active==='consumption')content.innerHTML=renderConsumption(d);
    else if(active==='noturn')content.innerHTML=renderNoTurn(d);
    else content.innerHTML=renderOverview(d);
    return true;
  }

  root.addEventListener('click',e=>{
    const tab=e.target.closest('[data-sj-tab]');
    if(tab){
      active=tab.dataset.sjTab;search='';
      root.querySelectorAll('[data-sj-tab]').forEach(b=>b.classList.toggle('active',b.dataset.sjTab===active));
      render();window.scrollTo({top:0,behavior:'smooth'});return;
    }
    const open=e.target.closest('[data-open-tab]');
    if(open){
      active=open.dataset.openTab;root.querySelectorAll('[data-sj-tab]').forEach(b=>b.classList.toggle('active',b.dataset.sjTab===active));
      render();window.scrollTo({top:0,behavior:'smooth'});return;
    }
    if(e.target.closest('[data-show-noturn]')){active='noturn';root.querySelectorAll('[data-sj-tab]').forEach(b=>b.classList.remove('active'));render();window.scrollTo({top:0,behavior:'smooth'});}
  });
  root.addEventListener('input',e=>{if(e.target.id==='sj-stock-search'){search=e.target.value;render();const inp=document.getElementById('sj-stock-search');if(inp){inp.focus();inp.setSelectionRange(inp.value.length,inp.value.length)}}});

  let tries=0;
  const timer=setInterval(()=>{tries++;if(render()||tries>150)clearInterval(timer)},100);
  window.addEventListener('stock-position-updated',()=>setTimeout(render,30));
  window.addEventListener('movements-updated',()=>setTimeout(render,30));
})();