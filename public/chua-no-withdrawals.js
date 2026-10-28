// Estoque sem baixas para o painel isolado do Almoxarifado Chua.
// Usa a mesma posicao atual e historico conciliado do dashboard de gestao.
(function () {
  if (window.CHUA_NO_WITHDRAWAL) return;
  const LOCAL_CODE = '30115';
  const LOCAL_NAME = 'ALMOXARIFADO GERAL F CHUA';
  const state = { query:'', group:'', sort:'valor', scope:'local', limit:100 };
  const esc = v => String(v == null ? '' : v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const norm = v => String(v || '').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toUpperCase().trim();
  const money = v => new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(Number(v)||0);
  const qty = v => new Intl.NumberFormat('pt-BR',{maximumFractionDigits:2}).format(Number(v)||0);
  const num = v => Number(v)||0;
  const dateValue = v => { const m=String(v||'').match(/^(\d{2})\/(\d{2})\/(\d{4})/);return m?num(m[3])*10000+num(m[2])*100+num(m[1]):0; };
  const isLocal = x => String(x?.codigo_local||'')===LOCAL_CODE || norm(x?.local)===LOCAL_NAME;
  const stockKey = x => String(x.local)+'|'+String(x.codigo);
  const localCode = x => String(x.codigo_local)+'|'+String(x.codigo);
  const purchaseKey = x => String(x.codigo)+'|'+norm(x.un);
  let histories = new Map();
  let currentRows = [];
  let lastMeta = null;

  function collect() {
    if(typeof STOCK==='undefined'||!Array.isArray(STOCK)||
       typeof MOVEMENTS==='undefined'||!Array.isArray(MOVEMENTS)||
       typeof PURCHASES==='undefined'||!Array.isArray(PURCHASES)||
       window.MOVEMENTS_REVISED_META?.records!==4593||!window.CURRENT_STOCK_META) return null;
    const localMovements = new Set(), networkMovements = new Set(), pending = new Set();
    const allMovements = MOVEMENTS.concat(typeof MOVEMENTS_YEARLY!=='undefined'&&Array.isArray(MOVEMENTS_YEARLY)?MOVEMENTS_YEARLY:[]);
    for(const m of allMovements){
      const positive=num(m.total)>0||num(m.complete_total)>0||
        (Array.isArray(m.months)&&m.months.some(v=>num(v)>0));
      if(positive){networkMovements.add(String(m.codigo));if(isLocal(m))localMovements.add(stockKey(m));}
      if(m.reconciliacao_pendente&&isLocal(m))pending.add(stockKey(m));
    }
    const mixed = new Set((window.MOVEMENTS_REVISED_META.mixedUnits||[]).map(localCode));
    histories = new Map();
    for(const p of PURCHASES){
      if(!isLocal(p))continue;
      const key=purchaseKey(p);
      if(!histories.has(key))histories.set(key,[]);
      histories.get(key).push(p);
    }
    for(const a of histories.values())a.sort((a,b)=>dateValue(b.data)-dateValue(a.data)||num(b.nrounico)-num(a.nrounico));
    const rows=[];
    let excludedPending=0,excludedMixed=0;
    for(const s of STOCK){
      if(!isLocal(s)||num(s.estoque)<=0||localMovements.has(stockKey(s)))continue;
      if(mixed.has(localCode(s))){excludedMixed++;continue;}
      if(pending.has(stockKey(s))){excludedPending++;continue;}
      const purchases=histories.get(purchaseKey(s))||[];
      rows.push({ codigo:String(s.codigo), produto:String(s.produto||''),
        grupo:String(s.grupo||''), empresa:String(s.empresa||''),
        local:String(s.local||''), un:String(s.un||''),
        quantidade:num(s.estoque), custo:num(s.custo_estoque), valor:num(s.valor_estoque),
        latest:purchases[0]||null,historyCount:purchases.length,
        networkHadWithdrawal:networkMovements.has(String(s.codigo)) });
    }
    lastMeta={ excludedPending,excludedMixed,position:String(window.CURRENT_STOCK_META.emissao||'28/10/2026'),
      allRows:rows.length, networkRows:rows.filter(x=>!x.networkHadWithdrawal).length };
    currentRows=rows;
    window.CHUA_NO_WITHDRAWAL_META=lastMeta;
    return rows;
  }

  function filtered(source) {
    const q=norm(state.query);
    const rows=source.filter(x=>(state.scope!=='rede'||!x.networkHadWithdrawal)&&
      (!state.group||x.grupo===state.group)&&
      (!q||norm([x.codigo,x.produto,x.grupo,x.un,x.latest?.fornecedor,x.latest?.nota].join(' ')).includes(q)));
    if(state.sort==='unitario')rows.sort((a,b)=>b.custo-a.custo||b.valor-a.valor);
    else if(state.sort==='quantidade')rows.sort((a,b)=>b.quantidade-a.quantidade||b.valor-a.valor);
    else if(state.sort==='compra')rows.sort((a,b)=>dateValue(b.latest?.data)-dateValue(a.latest?.data)||b.valor-a.valor);
    else rows.sort((a,b)=>b.valor-a.valor||b.quantidade-a.quantidade);
    return rows;
  }

  function options(values,selected,defaultLabel) {
    return '<option value="">'+defaultLabel+'</option>'+
      [...new Set(values)].filter(Boolean).sort((a,b)=>a.localeCompare(b,'pt-BR'))
      .map(x=>'<option value="'+esc(x)+'"'+(x===selected?' selected':'')+'>'+esc(x)+'</option>').join('');
  }
  const sel=(value,selected)=>value===selected?' selected':'';

  function render() {
    const source=collect();
    if(!source)return '<section class="sj-section active"><div class="sj-note">Aguardando a posicao de estoque e a conciliacao das baixas de Chua.</div></section>';
    const rows=filtered(source), visible=rows.slice(0,state.limit), total=rows.reduce((s,x)=>s+x.valor,0);
    const rowHtml=visible.map((x,i)=>{
      const p=x.latest;
      const last=p?'<b>'+esc(p.data)+'</b><span class="sj-nw-sub">'+esc(p.fornecedor||'Fornecedor nao informado')+'</span><span class="sj-nw-sub">NF '+esc(p.nota||'-')+' · '+money(p.preco)+'/un</span>':'<span class="sj-nw-sub">Sem compra encontrada em Chua</span>';
      return '<tr data-sj-nw-code="'+esc(x.codigo)+'" data-sj-nw-unit="'+x.custo+'" data-sj-nw-value="'+x.valor+'">'+
        '<td><b>'+esc(x.codigo)+'</b></td><td>'+esc(x.produto)+'</td><td>'+esc(x.grupo)+'</td>'+
        '<td>'+esc(x.un)+'</td><td class="num">'+qty(x.quantidade)+'</td>'+
        '<td class="num">'+money(x.custo)+'</td><td class="num"><b>'+money(x.valor)+'</b></td>'+
        '<td>'+last+'</td><td>'+(x.historyCount?
          '<details class="sj-nw-history" data-purchase-key="'+esc(purchaseKey(x))+'"><summary>'+x.historyCount+' compra(s)</summary><div class="sj-nw-historical">Abrindo histórico...</div></details>':
          '<span class="sj-nw-sub">Sem histórico no local</span>')+'</td></tr>';
    }).join('');
    const groups=options(source.map(x=>x.grupo),state.group,'Todos os grupos');
    return '<section class="sj-section active" id="sj-nw-view">'+
      '<div class="sj-hero"><h2>Estoque sem baixas — Chua</h2><p>Produtos com saldo positivo sem saidas registradas no historico disponivel. Somente o Almoxarifado Chua. Última compra indica a data da nota fiscal, nao o recebimento fisico.</p></div>'+
      '<div class="sj-nw-kpis"><div class="sj-kpi"><div class="k">Posicoes sem baixas</div><div class="v">'+qty(rows.length)+'</div></div>'+
      '<div class="sj-kpi"><div class="k">Capital sem baixas</div><div class="v">'+money(total)+'</div></div>'+
      '<div class="sj-kpi"><div class="k">Sem compra identificada em Chua</div><div class="v">'+qty(rows.filter(x=>!x.historyCount).length)+'</div></div></div>'+
      '<div class="sj-nw-filters">'+
      '<label>Buscar produto<input id="sj-nw-query" type="search" placeholder="Código, produto ou NF" value="'+esc(state.query)+'"></label>'+
      '<label>Grupo<select id="sj-nw-group">'+groups+'</select></label>'+
      '<label>Ordenar<select id="sj-nw-sort">'+
       '<option value="valor"'+sel('valor',state.sort)+'>Maior valor em estoque</option>'+
       '<option value="unitario"'+sel('unitario',state.sort)+'>Maior valor unitário</option>'+
       '<option value="quantidade"'+sel('quantidade',state.sort)+'>Maior quantidade</option>'+
       '<option value="compra"'+sel('compra',state.sort)+'>Última compra mais recente</option>'+
      '</select></label>'+
      '<label>Baixas<select id="sj-nw-scope">'+
       '<option value="local"'+sel('local',state.scope)+'>Sem baixas em Chuá</option>'+
       '<option value="rede"'+sel('rede',state.scope)+'>Sem baixas em toda a rede</option>'+
      '</select></label>'+
      '<button type="button" id="sj-nw-export">Exportar CSV</button></div>'+
      '<div class="sj-note">Estoque de '+esc(lastMeta.position)+
      ' · '+qty(lastMeta.excludedPending)+' posição(ões) com conciliação pendente e '+
      qty(lastMeta.excludedMixed)+' com unidades incompatíveis excluídas. Valor unitário é o custo do estoque, não o preço da última compra. O histórico apresentado de compras é somente o de Chuá.</div>'+
      '<div class="sj-card"><div class="sj-card-head"><h3>Produtos sem baixas registradas</h3><span>'+qty(rows.length)+' posições · ordenadas pelo critério selecionado</span></div>'+
      '<div class="sj-table-wrap"><table class="sj-table sj-nw-table"><thead><tr><th>Código</th><th>Produto</th><th>Grupo</th><th>Un.</th><th class="num">Quantidade</th><th class="num">Valor unitário</th><th class="num">Valor total</th><th>Última compra em Chuá</th><th>Histórico de compras</th></tr></thead><tbody>'+
      (rowHtml||'<tr><td colspan="9" class="sj-empty">Nenhum produto encontrado para os filtros.</td></tr>')+
      '</tbody></table></div><div class="sj-nw-bottom"><span>Mostrando '+qty(visible.length)+' de '+qty(rows.length)+' posições</span>'+
      (rows.length>state.limit?'<button type="button" id="sj-nw-more">Exibir mais 100</button>':'')+'</div></div></section>';
  }

  function update(focusQuery=false) {
    const target=document.getElementById('sj-content');
    const active=document.querySelector('.sj-nav [data-sj-tab="no-withdrawals"].active');
    if(!target||!active)return;
    target.innerHTML=render();
    if(focusQuery){
      const input=document.getElementById('sj-nw-query');
      if(input){input.focus();try{input.setSelectionRange(input.value.length,input.value.length);}catch(e){}}
    }
  }

  function exportCSV() {
    const rows=filtered(collect()||[]);
    const header=['Código','Produto','Grupo','Almoxarifado','Quantidade','Unidade','Custo unitário (R$)','Valor estoque (R$)','Última compra','Fornecedor','Nota fiscal','Preço última compra (R$)','Compras no local','Posição estoque'];
    const all=[header,...rows.map(x=>[x.codigo,x.produto,x.grupo,'Chuá',x.quantidade,x.un,x.custo,x.valor,x.latest?.data||'',x.latest?.fornecedor||'',x.latest?.nota||'',x.latest?.preco??'',x.historyCount,lastMeta?.position||''])];
    const q=v=>'"'+String(v==null?'':v).replace(/"/g,'""')+'"';
    const csv='\ufeff'+all.map(row=>row.map(q).join(';')).join('\r\n');
    const url=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'}));
    const a=document.createElement('a');a.href=url;a.download='chua_estoque_sem_baixas.csv';a.click();
    setTimeout(()=>URL.revokeObjectURL(url),500);
  }

  function renderHistory(details) {
    const records=histories.get(details.dataset.purchaseKey)||[];
    const header='<table class="sj-nw-history-table"><thead><tr><th>Data</th><th>Fornecedor</th><th>NF</th><th>Quantidade</th><th>Valor unit.</th><th>Total</th><th>Situação</th></tr></thead><tbody>';
    const lines=records.map(p=>'<tr><td>'+esc(p.data)+'</td><td>'+esc(p.fornecedor)+'</td><td>'+esc(p.nota)+'</td><td>'+qty(p.qtd)+' '+esc(p.un)+'</td><td>'+money(p.preco)+'</td><td>'+money(p.valor)+'</td><td>'+esc(p.status)+'</td></tr>').join('');
    details.querySelector('.sj-nw-historical').innerHTML=header+lines+'</tbody></table>';
  }

  document.addEventListener('input',e=>{
    if(e.target.id!=='sj-nw-query')return;
    state.query=e.target.value;state.limit=100;update(true);
  },true);
  document.addEventListener('change',e=>{
    const id=e.target.id;
    if(id==='sj-nw-group')state.group=e.target.value;
    else if(id==='sj-nw-sort')state.sort=e.target.value;
    else if(id==='sj-nw-scope')state.scope=e.target.value;
    else return;
    state.limit=100;update();
  },true);
  document.addEventListener('click',e=>{
    if(e.target.id==='sj-nw-more'){state.limit+=100;update();}
    if(e.target.id==='sj-nw-export')exportCSV();
  },true);
  document.addEventListener('toggle',e=>{
    const details=e.target;
    if(details.matches?.('.sj-nw-history')&&details.open&&details.dataset.loaded!=='1'){
      details.dataset.loaded='1';renderHistory(details);
    }
  },true);
  const style=document.createElement('style');
  style.textContent='#sj-nw-view .sj-nw-kpis{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:9px;margin-bottom:12px}'+
    '#sj-nw-view .sj-nw-kpis .v{font-size:18px}#sj-nw-view .sj-nw-filters{display:grid;grid-template-columns:minmax(180px,2fr) repeat(3,minmax(140px,1fr)) auto;gap:9px;align-items:end;background:white;border:1px solid #d5e3d9;border-radius:12px;padding:12px;margin-bottom:11px}'+
    '#sj-nw-view .sj-nw-filters label{font-size:10px;font-weight:850;color:#596c5f}'+
    '#sj-nw-view .sj-nw-filters input,#sj-nw-view .sj-nw-filters select{box-sizing:border-box;width:100%;min-height:35px;padding:7px;border:1px solid #d5e3d9;border-radius:7px;display:block;margin-top:5px;font-size:11px}'+
    '#sj-nw-view .sj-nw-filters button,#sj-nw-view .sj-nw-bottom button{background:#e4f4e9;border:1px solid #b9d9c2;color:#145c33;font-weight:850;border-radius:8px;min-height:35px;cursor:pointer;padding:8px 11px}'+
    '#sj-nw-view .sj-nw-table{min-width:1100px}#sj-nw-view .sj-nw-sub{display:block;font-size:8px;color:#758179;margin-top:4px}'+
    '#sj-nw-view .sj-nw-history summary{cursor:pointer;color:#0b6735;font-weight:850;white-space:nowrap}'+
    '#sj-nw-view .sj-nw-historical{margin-top:7px;max-width:550px;overflow-x:auto}'+
    '#sj-nw-view .sj-nw-history-table{border-collapse:collapse;font-size:8px;width:100%;min-width:500px}'+
    '#sj-nw-view .sj-nw-history-table th{background:#e9f4ed;color:#155b34}#sj-nw-view .sj-nw-history-table th,#sj-nw-view .sj-nw-history-table td{padding:6px;border-bottom:1px solid #e2ece5}'+
    '#sj-nw-view .sj-nw-bottom{display:flex;justify-content:space-between;align-items:center;padding:12px;gap:9px;font-size:10px}'+
    '@media(max-width:1100px){#sj-nw-view .sj-nw-filters{grid-template-columns:repeat(2,minmax(0,1fr))}}'+
    '@media(max-width:720px){#sj-nw-view .sj-nw-kpis{grid-template-columns:1fr}#sj-nw-view .sj-nw-filters{grid-template-columns:1fr}}';
  document.head.appendChild(style);
  window.CHUA_NO_WITHDRAWAL={render,refresh:update,getRows:()=>currentRows.slice(),getFiltered:()=>filtered(currentRows)};
})();