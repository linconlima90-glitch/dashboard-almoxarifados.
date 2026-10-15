// Aba dedicada a saldos sem baixas registradas por local no historico disponivel.
// Ultima compra e a data da NF no historico de compras, nao a entrada fisica no almoxarifado.
(function () {
  if (/^\/sao-joao\/?$/.test(location.pathname) || document.documentElement.dataset.dbPilot === '1') return;
  if (window.__STOCK_NO_WITHDRAWAL_TAB_INSTALLED) return;
  const tabs = document.querySelector('.tabs');
  const wrap = document.querySelector('.wrap');
  if (!tabs || !wrap) return;
  window.__STOCK_NO_WITHDRAWAL_TAB_INSTALLED = true;

  const tab = document.createElement('button');
  tab.type = 'button';
  tab.className = 'tab';
  tab.dataset.view = 'sem-baixas';
  tab.textContent = 'Estoque sem baixas';
  tabs.appendChild(tab);

  const section = document.createElement('section');
  section.id = 'view-sem-baixas';
  section.className = 'view';
  section.innerHTML = `
    <div class="ns-header">
      <h2>Estoque sem baixas registradas</h2>
      <p>Produtos com saldo positivo, mas sem consumo registrado no período histórico disponível. A classificação é feita por almoxarifado, com opção de exigir ausência de baixas em toda a rede.</p>
    </div>
    <div class="ns-cards" aria-live="polite">
      <div class="ns-card"><span>Posições encontradas</span><strong id="ns-count">—</strong></div>
      <div class="ns-card"><span>Capital sem baixas</span><strong id="ns-total">—</strong></div>
      <div class="ns-card"><span>Locais com itens</span><strong id="ns-locals">—</strong></div>
      <div class="ns-card"><span>Sem compra identificada</span><strong id="ns-unpurchased">—</strong></div>
    </div>
    <div class="ns-filter-panel">
      <label>Pesquisar código ou produto<input id="ns-search" type="search" placeholder="Código, descrição, fornecedor ou nota fiscal" autocomplete="off"></label>
      <label>Almoxarifado<select id="ns-local"><option value="">Todos os locais</option></select></label>
      <label>Grupo de produto<select id="ns-group"><option value="">Todos os grupos</option></select></label>
      <label>Ordenar<select id="ns-order"><option value="valor">Maior valor em estoque</option><option value="quantidade">Maior quantidade em estoque</option><option value="compra">Última compra mais recente</option></select></label>
      <label>Verificar baixas<select id="ns-scope"><option value="local">Sem baixa neste almoxarifado</option><option value="rede">Sem baixa em toda a rede</option></select></label>
      <button type="button" class="ns-export" id="ns-export">Exportar CSV</button>
    </div>
    <div class="ns-note" id="ns-note">A data da <b>última compra</b> representa a data informada na NF e não comprova recebimento físico. A posição de estoque é apresentada separadamente. Histórico anterior sem ano definido permanece sujeito à conciliação.</div>
    <div class="ns-table-panel">
      <div class="ns-table-title"><strong>Produtos por almoxarifado</strong><span id="ns-caption">Preparando dados...</span></div>
      <div class="ns-table-wrap"><table class="ns-table">
        <thead><tr><th>#</th><th>Código e produto</th><th>Grupo</th><th>Local do estoque</th><th class="ns-num">Quantidade</th><th class="ns-num">Valor em estoque</th><th>Última compra identificada</th><th>Histórico de compras</th></tr></thead>
        <tbody id="ns-rows"><tr><td colspan="8">O levantamento será calculado quando esta aba for aberta.</td></tr></tbody>
      </table></div>
      <div class="ns-footer"><span id="ns-progress"></span><button type="button" class="ns-more" id="ns-more" hidden>Exibir mais 100 posições</button></div>
    </div>
  `;
  wrap.appendChild(section);
  const style = document.createElement('style');
  style.id = 'ns-style';
  style.textContent = `
    #view-sem-baixas{--ns-green:#16663b;--ns-line:#e2e9e5;color:#273a31}
    #view-sem-baixas .ns-header{padding:15px 18px 12px;border:1px solid var(--ns-line);border-radius:14px;background:#fff;margin-bottom:12px}
    #view-sem-baixas .ns-header h2{font-size:18px;font-weight:900;color:#175c36;margin:0 0 7px}
    #view-sem-baixas .ns-header p{margin:0;line-height:1.55;color:#66766d;font-size:12px}
    #view-sem-baixas .ns-cards{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:9px;margin-bottom:12px}
    #view-sem-baixas .ns-card{background:#fff;border:1px solid var(--ns-line);border-radius:13px;padding:12px 14px;min-width:0}
    #view-sem-baixas .ns-card span{display:block;font-size:10px;font-weight:850;text-transform:uppercase;color:#74847b}
    #view-sem-baixas .ns-card strong{display:block;font-size:22px;line-height:1.3;margin-top:7px;color:#145a32;overflow-wrap:anywhere}
    #view-sem-baixas .ns-filter-panel{display:grid;grid-template-columns:minmax(210px,1.5fr) repeat(3,minmax(135px,1fr)) minmax(165px,1.2fr) auto;gap:9px;align-items:end;border:1px solid var(--ns-line);border-radius:13px;background:#fff;padding:12px;margin-bottom:10px}
    #view-sem-baixas .ns-filter-panel label{display:block;font-weight:800;font-size:10px;color:#6a776e;min-width:0}
    #view-sem-baixas .ns-filter-panel input,#view-sem-baixas .ns-filter-panel select{display:block;box-sizing:border-box;width:100%;margin-top:5px;border:1px solid #d7e2da;border-radius:8px;background:#fafcfb;color:#243b2a;padding:9px;font:inherit;font-size:12px;min-height:36px}
    #view-sem-baixas .ns-export,#view-sem-baixas .ns-more{border:1px solid #bfd9c7;background:#ebf6ee;color:#16633c;padding:10px 13px;border-radius:8px;cursor:pointer;font-size:12px;font-weight:850;min-height:36px}
    #view-sem-baixas .ns-export:hover,#view-sem-baixas .ns-more:hover{background:#dbf0e1}
    #view-sem-baixas .ns-note{padding:11px 13px;margin-bottom:10px;border-left:3px solid #cca145;border-radius:9px;background:#fff9ed;color:#72674f;font-size:11px;line-height:1.6}
    #view-sem-baixas .ns-table-panel{background:#fff;border:1px solid var(--ns-line);border-radius:13px;overflow:hidden}
    #view-sem-baixas .ns-table-title{display:flex;align-items:center;justify-content:space-between;gap:8px;padding:13px 14px;border-bottom:1px solid var(--ns-line)}
    #view-sem-baixas .ns-table-title strong{font-size:13px;color:#234530}
    #view-sem-baixas .ns-table-title span{font-size:11px;color:#748078}
    #view-sem-baixas .ns-table-wrap{overflow-x:auto;max-height:750px}
    #view-sem-baixas .ns-table{width:100%;border-collapse:collapse;font-size:11px;min-width:1080px}
    #view-sem-baixas .ns-table th{text-align:left;position:sticky;top:0;z-index:1;background:#f1f7f3;color:#3d6650;border-bottom:1px solid #d7e5dc;padding:11px 10px;white-space:nowrap}
    #view-sem-baixas .ns-table td{padding:10px;border-bottom:1px solid #edf1ee;vertical-align:top;line-height:1.45}
    #view-sem-baixas .ns-table tr:hover td{background:#f8fbf8}
    #view-sem-baixas .ns-table .ns-num{text-align:right;white-space:nowrap;font-variant-numeric:tabular-nums}
    #view-sem-baixas .ns-main{font-weight:850;color:#2d4132}
    #view-sem-baixas .ns-sub{display:block;font-size:10px;color:#87938b;margin-top:3px}
    #view-sem-baixas .ns-date{font-weight:850;color:#244a30}
    #view-sem-baixas .ns-chip{display:inline-block;border-radius:6px;padding:3px 6px;background:#eef5ef;color:#447454;font-size:9px;font-weight:800;margin-top:4px}
    #view-sem-baixas .ns-chip.ns-elsewhere{background:#fff5e3;color:#94682c}
    #view-sem-baixas .ns-history summary{cursor:pointer;color:#1b7347;font-weight:800;white-space:nowrap}
    #view-sem-baixas .ns-history-box{margin:7px 0;max-width:550px;min-width:300px;border:1px solid #e4eee7;border-radius:8px;overflow-x:auto}
    #view-sem-baixas .ns-history-box table{font-size:10px;width:100%;border-collapse:collapse;min-width:550px}
    #view-sem-baixas .ns-history-box td,#view-sem-baixas .ns-history-box th{padding:6px;position:static;white-space:nowrap;border-bottom:1px solid #eef3ee}
    #view-sem-baixas .ns-footer{display:flex;justify-content:space-between;align-items:center;gap:12px;padding:11px 14px;font-size:11px;color:#738177}
    @media(max-width:1200px){#view-sem-baixas .ns-filter-panel{grid-template-columns:repeat(3,minmax(0,1fr))}}
    @media(max-width:720px){#view-sem-baixas .ns-cards{grid-template-columns:repeat(2,minmax(0,1fr))}#view-sem-baixas .ns-filter-panel{grid-template-columns:1fr 1fr}#view-sem-baixas .ns-filter-panel label:first-child{grid-column:1/-1}#view-sem-baixas .ns-filter-panel .ns-export{grid-column:1/-1}}
  `;
  document.head.appendChild(style);

  const $ = sel => section.querySelector(sel);
  const num = v => Number(v) || 0;
  const money = v => new Intl.NumberFormat('pt-BR', {style:'currency',currency:'BRL'}).format(num(v));
  const qty = v => new Intl.NumberFormat('pt-BR', {maximumFractionDigits:2}).format(num(v));
  const integer = v => new Intl.NumberFormat('pt-BR', {maximumFractionDigits:0}).format(num(v));
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const norm = s => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toUpperCase();
  const asDate = s => {const m=String(s||'').match(/^(\d{2})\/(\d{2})\/(\d{4})/);return m?Number(m[3])*10000+Number(m[2])*100+Number(m[1]):0};
  const stockKey = x => String(x.local)+'|'+String(x.codigo);
  const localCodeKey = x => String(x.codigo_local)+'|'+String(x.codigo);
  const productKey = x => String(x.codigo)+'|'+norm(x.un);
  const localProductKey = x => String(x.local)+'|'+productKey(x);
  const stockDataReady = () => typeof STOCK !== 'undefined' && Array.isArray(STOCK) && typeof MOVEMENTS !== 'undefined' && Array.isArray(MOVEMENTS) && typeof PURCHASES !== 'undefined' && Array.isArray(PURCHASES) && window.CURRENT_STOCK_META && window.MOVEMENTS_REVISED_META?.records === 4227;
  const latestFirst = (a, b) => asDate(b.data)-asDate(a.data) || num(b.nrounico)-num(a.nrounico);
  let sourceRows=[], hasMovementsInNetwork=new Set(), historyByProduct=new Map(), renderedRows=[], limit=100, dirty=true;
  let excludedPending=0, mixedUnitsExcluded=0;
  const getFilters=()=>({local:$('#ns-local').value,group:$('#ns-group').value,query:norm($('#ns-search').value.trim()),sort:$('#ns-order').value,scope:$('#ns-scope').value});

  function refreshSource(){
    if (!stockDataReady()) return false;
    const movementByLocal=new Map();
    const pendingLocal=new Set();
    hasMovementsInNetwork=new Set();
    const rememberMovement=m=>{
      const positive=num(m.total)>0 || num(m.complete_total)>0 || (Array.isArray(m.months)&&m.months.some(v=>num(v)>0));
      if(positive){movementByLocal.set(stockKey(m),true);hasMovementsInNetwork.add(String(m.codigo));}
      if(m.reconciliacao_pendente)pendingLocal.add(stockKey(m));
    };
    for(const m of MOVEMENTS)rememberMovement(m);
    if(typeof MOVEMENTS_YEARLY !== 'undefined' && Array.isArray(MOVEMENTS_YEARLY)) for(const m of MOVEMENTS_YEARLY)rememberMovement(m);
    const mixed=new Set((window.MOVEMENTS_REVISED_META?.mixedUnits||[]).map(localCodeKey));
    const byLocal=new Map();historyByProduct=new Map();
    for(const p of PURCHASES){
      const key=productKey(p),lkey=localProductKey(p);
      if(!historyByProduct.has(key))historyByProduct.set(key,[]);
      historyByProduct.get(key).push(p);
      if(!byLocal.has(lkey))byLocal.set(lkey,[]);
      byLocal.get(lkey).push(p);
    }
    for(const records of historyByProduct.values())records.sort(latestFirst);
    for(const records of byLocal.values())records.sort(latestFirst);
    excludedPending=0;mixedUnitsExcluded=0;
    sourceRows=[];
    for(const s of STOCK){
      if(num(s.estoque)<=0)continue;
      if(movementByLocal.has(stockKey(s)))continue;
      if(mixed.has(localCodeKey(s))){mixedUnitsExcluded++;continue;}
      if(pendingLocal.has(stockKey(s))){excludedPending++;continue;}
      const productHistory=historyByProduct.get(productKey(s))||[];
      const localHistory=byLocal.get(localProductKey(s))||[];
      const newest=localHistory[0]||productHistory[0]||null;
      sourceRows.push({
        codigo:String(s.codigo),produto:String(s.produto||''),grupo:String(s.grupo||''),empresa:String(s.empresa||''),local:String(s.local||''),un:String(s.un||''),
        quantidade:num(s.estoque),valor:num(s.valor_estoque),custo:num(s.custo_estoque),
        localHistoryCount:localHistory.length,historyCount:productHistory.length,
        newest,localPurchase:localHistory[0]||null,latestAcrossNetwork:productHistory[0]||null,latestElsewhere:!localHistory.length && !!newest
      });
    }
    fillOptions('#ns-local', sourceRows.map(x=>x.local));
    fillOptions('#ns-group', sourceRows.map(x=>x.grupo));
    dirty=false;
    window.STOCK_NO_WITHDRAWAL_META={
      scope:'por almoxarifado',rows:sourceRows.length,semBaixaNaRede:sourceRows.filter(x=>!hasMovementsInNetwork.has(x.codigo)).length,
      excludedPending,excludedMixedUnits:mixedUnitsExcluded,stockDate:window.CURRENT_STOCK_META.emissao||'15/10/2026',
      historyStart:'01/01/2025',historyEnd:'15/10/2026',purchaseLatest:'08/10/2026'
    };
    return true;
  }
  function fillOptions(selector,values){
    const select=$(selector),current=select.value;
    while(select.options.length>1)select.remove(1);
    for(const val of [...new Set(values)].filter(Boolean).sort((a,b)=>a.localeCompare(b,'pt-BR'))){const o=new Option(val,val);select.add(o);}
    select.value=[...select.options].some(o=>o.value===current)?current:'';
  }
  function filteredRows(){
    const f=getFilters();
    const result=sourceRows.filter(x=>{
      if(f.scope==='rede'&&hasMovementsInNetwork.has(x.codigo))return false;
      if(f.local&&f.local!==x.local)return false;
      if(f.group&&f.group!==x.grupo)return false;
      if(f.query){
        const fields=[x.codigo,x.produto,x.grupo,x.local,x.newest?.fornecedor,x.newest?.nota];
        if(!fields.some(v=>norm(v).includes(f.query)))return false;
      }
      return true;
    });
    if(f.sort==='quantidade')result.sort((a,b)=>b.quantidade-a.quantidade||b.valor-a.valor);
    else if(f.sort==='compra')result.sort((a,b)=>asDate(b.newest?.data)-asDate(a.newest?.data)||b.valor-a.valor);
    else result.sort((a,b)=>b.valor-a.valor||b.quantidade-a.quantidade);
    return result;
  }
  function purchaseHTML(p,local){
    if(!p)return '<span class="ns-sub">Nenhuma compra identificada no histórico disponível</span>';
    const localOrder=String(local)===String(p.local);
    return `<span class="ns-date">${esc(p.data)}</span><span class="ns-sub">${esc(p.fornecedor||'Fornecedor não informado')}</span>
      <span class="ns-sub">${qty(p.qtd)} ${esc(p.un)} × ${money(p.preco)} · NF ${esc(p.nota||'—')}</span>
      <span class="ns-chip ${localOrder?'':'ns-elsewhere'}">${localOrder?'Compra no mesmo local':'Compra em outro almoxarifado'}</span>`;
  }
  function rowHTML(x,i){
    const f=x.newest;
    return `<tr data-ns-code="${esc(x.codigo)}" data-ns-value="${x.valor}" data-ns-quantity="${x.quantidade}" data-ns-local="${esc(x.local)}">
      <td>${integer(i+1)}</td>
      <td><span class="ns-main">${esc(x.codigo)} — ${esc(x.produto)}</span><span class="ns-sub">Unidade: ${esc(x.un)} · Estoque: ${money(x.custo)}/un</span></td>
      <td>${esc(x.grupo)}</td>
      <td><span class="ns-main">${esc(x.local)}</span><span class="ns-sub">${esc(x.empresa)}</span></td>
      <td class="ns-num"><strong>${qty(x.quantidade)}</strong> ${esc(x.un)}</td>
      <td class="ns-num"><strong>${money(x.valor)}</strong></td>
      <td>${purchaseHTML(f,x.local)}</td>
      <td>${x.historyCount?`<details class="ns-history" data-history-key="${esc(productKey(x))}"><summary>Ver ${integer(x.historyCount)} compra(s)</summary><div class="ns-history-box">Carregando histórico...</div></details>`:'<span class="ns-sub">Sem compras registradas</span>'}</td>
    </tr>`;
  }
  function renderList(resetLimit=true){
    if(resetLimit)limit=100;
    if(dirty&&!refreshSource()){
      $('#ns-caption').textContent='Dados ainda não disponíveis';
      $('#ns-rows').innerHTML='<tr><td colspan="8">Aguardando a posição de estoque e o histórico de baixas conferido.</td></tr>';
      return;
    }
    renderedRows=filteredRows();
    const visible=renderedRows.slice(0,limit);
    const sum=renderedRows.reduce((total,x)=>total+x.valor,0);
    $('#ns-count').textContent=integer(renderedRows.length);
    $('#ns-total').textContent=money(sum);
    $('#ns-locals').textContent=integer(new Set(renderedRows.map(x=>x.local)).size);
    $('#ns-unpurchased').textContent=integer(renderedRows.filter(x=>!x.historyCount).length);
    const meta=window.STOCK_NO_WITHDRAWAL_META||{};
    const position=String(meta.stockDate||'15/10/2026').slice(0,10);
    $('#ns-caption').textContent=`Posição de estoque: ${position} · ${renderedRows.length} posição(ões) · ordenação: ${getFilters().sort==='quantidade'?'quantidade':getFilters().sort==='compra'?'última compra':'maior valor'}`;
    $('#ns-note').innerHTML=`<b>Critério:</b> saldo positivo e nenhuma baixa no escopo selecionado, dentro do histórico disponível (a partir de jan/2025, mais revisão 01/07–15/10/2026). <b>Última compra:</b> data de NF, não data de entrada física. <b>Estoque:</b> posição de ${esc(position)}. <b>Conciliação:</b> ${integer(excludedPending)} posições com histórico pendente e ${integer(mixedUnitsExcluded)} com baixas em outra unidade foram retiradas desta lista para evitar falso “nunca baixado”. Pneus, câmaras, lubrificantes e cimento são exibidos se atenderem ao critério. Quantidades de unidades distintas não são somadas.`;
    $('#ns-rows').innerHTML=visible.length?visible.map(rowHTML).join(''):'<tr><td colspan="8" style="text-align:center;padding:20px">Nenhum item encontrado para os filtros.</td></tr>';
    $('#ns-progress').textContent=`Mostrando ${integer(visible.length)} de ${integer(renderedRows.length)} posições`;
    $('#ns-more').hidden=limit>=renderedRows.length;
    window.STOCK_NO_WITHDRAWAL_META.filteredRows=renderedRows.length;
    window.STOCK_NO_WITHDRAWAL_META.filteredValue=Math.round(sum*100)/100;
  }
  tab.addEventListener('click',()=>{
    document.querySelectorAll('.tab').forEach(t=>t.classList.remove('active'));
    document.querySelectorAll('.view').forEach(v=>v.classList.remove('active'));
    tab.classList.add('active');section.classList.add('active');
    renderList();
  });
  for(const sel of ['#ns-local','#ns-group','#ns-order','#ns-scope'])$(sel).addEventListener('change',()=>renderList());
  let queryTimer=0;
  $('#ns-search').addEventListener('input',()=>{clearTimeout(queryTimer);queryTimer=setTimeout(()=>renderList(),140)});
  $('#ns-more').addEventListener('click',()=>{limit+=100;renderList(false)});
  section.addEventListener('toggle',e=>{
    const details=e.target;
    if(!details?.matches?.('.ns-history')||!details.open||details.dataset.loaded==='1')return;
    details.dataset.loaded='1';
    const records=historyByProduct.get(details.dataset.historyKey)||[];
    const content=details.querySelector('.ns-history-box');
    const data=records.map(p=>`<tr><td>${esc(p.data)}</td><td>${esc(p.local)}</td><td>${esc(p.fornecedor)}</td><td>${esc(p.nota)}</td><td>${qty(p.qtd)} ${esc(p.un)}</td><td>${money(p.preco)}</td><td>${money(p.valor)}</td><td>${esc(p.status)}</td></tr>`).join('');
    content.innerHTML=`<table><thead><tr><th>Data da compra</th><th>Local de compra</th><th>Fornecedor</th><th>Nota fiscal</th><th>Qtd.</th><th>Preço unit.</th><th>Total</th><th>Situação</th></tr></thead><tbody>${data}</tbody></table>`;
  },true);
  $('#ns-export').addEventListener('click',()=>{
    if(dirty&&!refreshSource())return;
    const rows=filteredRows();
    const sep=';';
    const csvField=v=>'"'+String(v==null?'':v).replace(/"/g,'""')+'"';
    const values=[['Código','Produto','Grupo','Empresa fiscal','Local do estoque','Quantidade','Unidade','Valor em estoque (R$)','Data última compra identificada','Fornecedor','NF','Local da última compra','Preço unitário (R$)','Quantidade comprada','Qtd. de compras no histórico','Posição do estoque']];
    for(const x of rows){const p=x.newest;values.push([x.codigo,x.produto,x.grupo,x.empresa,x.local,x.quantidade,x.un,x.valor,p?.data||'',p?.fornecedor||'',p?.nota||'',p?.local||'',p?.preco??'',p?.qtd??'',x.historyCount,String(window.CURRENT_STOCK_META?.emissao||'15/10/2026')]);}
    const content='\ufeff'+values.map(row=>row.map(csvField).join(sep)).join('\r\n');
    const url=URL.createObjectURL(new Blob([content],{type:'text/csv;charset=utf-8'}));
    const a=document.createElement('a');a.href=url;a.download='estoque_sem_baixas_15-10-2026.csv';a.click();setTimeout(()=>URL.revokeObjectURL(url),500);
  });
  const invalidate=()=>{dirty=true;if(section.classList.contains('active'))renderList();};
  window.addEventListener('stock-position-updated',invalidate);
  window.addEventListener('movements-updated',invalidate);
  window.addEventListener('purchases-updated',invalidate);
  window.STOCK_NO_WITHDRAWAL={open:()=>tab.click(),getRows:()=>sourceRows.slice(),refresh:invalidate};
})();