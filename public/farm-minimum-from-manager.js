// Tela local de estoque minimo reutilizando os registros e calculos do gestor principal.
// A referencia oficial eh: minimumBaseRows() e minimumRowsForYear() do dashboard de gestao.
(function () {
  if (window.FARM_MINIMUM_FROM_MANAGER) return;

  const MONTHS = 2;
  const STATUSES = [
    'SEM ESTOQUE', 'ABAIXO DO MÍNIMO', 'ATENÇÃO', 'OK',
    'HISTÓRICO PARCIAL', 'SEM DADOS DE BAIXA'
  ];
  const state = { year:'', query:'', statuses:new Set() };
  const esc = value => String(value == null ? '' : value).replace(/[&<>"']/g, c =>
    ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const norm = value => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toUpperCase().trim();
  const number = value => Number(value) || 0;
  const brl = value => new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(number(value));
  const qty = value => new Intl.NumberFormat('pt-BR',{maximumFractionDigits:2}).format(number(value));
  const integer = value => new Intl.NumberFormat('pt-BR',{maximumFractionDigits:0}).format(number(value));
  const continuous = new Set(['KG','LT','ML','MT','M2','M3','CM','GR']);
  const key = row => String(row.codigo) + '|' + norm(row.un);
  const sameLocal = (row,code,local) =>
    String(row.codigo_local) === String(code) && norm(row.local) === norm(local);
  const roundNeed = (value,un) => {
    if (!(value > 0)) return 0;
    return continuous.has(norm(un)) ? Math.ceil((value - 1e-10)*100)/100 : Math.ceil(value-1e-10);
  };

  function calculate(code,local,year) {
    if (typeof STOCK === 'undefined' || !Array.isArray(STOCK) ||
        typeof MOVEMENTS === 'undefined' || !Array.isArray(MOVEMENTS) ||
        typeof minimumBaseRows !== 'function' ||
        typeof minimumRowsForYear !== 'function' ||
        window.STOCK_MINIMUM_MONTHS !== MONTHS ||
        window.MOVEMENTS_REVISED_META?.records !== 4870 ||
        !window.CURRENT_STOCK_META) return null;

    // Sempre partir da mesma base de minimo exibida no gestor principal. Para o
    // CDI Chua, o proprio gestor calcula demanda consolidada de toda a rede.
    const managerBase = minimumBaseRows().filter(x => sameLocal(x,code,local));
    const selected = minimumRowsForYear(managerBase,year);
    const visibleYearKeys = new Set(selected.map(key));
    const managerKeys = new Set(managerBase.map(key));
    const stockByItem = new Map();
    for (const s of STOCK) {
      if (!sameLocal(s,code,local)) continue;
      const k = key(s), current = stockByItem.get(k) || {
        codigo:String(s.codigo), produto:String(s.produto || ''),
        grupo:String(s.grupo || ''), empresa:String(s.empresa || ''),
        local:String(s.local || ''), codigo_local:String(s.codigo_local),
        un:String(s.un || ''), stock:0, value:0, cost:0
      };
      current.stock += number(s.estoque);
      current.value += number(s.valor_estoque);
      if (!current.produto) current.produto = String(s.produto || '');
      if (!current.grupo) current.grupo = String(s.grupo || '');
      if (current.stock > 0) current.cost = current.value/current.stock;
      else if (number(s.custo_estoque)>0) current.cost = number(s.custo_estoque);
      stockByItem.set(k,current);
    }

    const rows = [];
    function normalize(manager,stock) {
      const avg = Math.max(0,number(manager.avg));
      const total = number(manager.total);
      const stockQty = stock ? stock.stock : 0;
      const cost = stock && stock.cost > 0 ? stock.cost : number(manager.cost);
      // Sem historico de baixa comprovado nao existe consumo para justificar reposicao.
      // Uma referencia de minimo legada nao pode inventar necessidade de compra.
      const noHistory = !(total > 0);
      // Calcular sempre a politica de 2 meses a partir da media atual deste local.
      const minimum = noHistory ? 0 : roundNeed(avg*MONTHS,manager.un);
      const need = roundNeed(Math.max(0,minimum-stockQty),manager.un);
      let status = 'SEM DADOS DE BAIXA';
      if (avg > 0 && total > 0) {
        status = stockQty <= 0 ? 'SEM ESTOQUE'
          : stockQty < minimum-1e-9 ? 'ABAIXO DO MÍNIMO'
          : stockQty < minimum*1.25-1e-9 ? 'ATENÇÃO' : 'OK';
      } else if (total > 0) status = 'HISTÓRICO PARCIAL';
      return {
        ...manager,
        codigo:String(manager.codigo), grupo:String(manager.grupo || stock?.grupo || 'SEM GRUPO'),
        produto:String(manager.produto || stock?.produto || ''),
        un:String(manager.un || stock?.un || ''),
        stock:stockQty, cost, stock_value:stockQty*cost, avg, minimum, need,
        need_value:need*cost, total, coverage:avg>0?stockQty/avg:null,
        excess:Math.max(0,stockQty-minimum), status,
        source:String(manager.source || 'GESTOR PRINCIPAL'),
        cost_source:String(manager.cost_source || (stock ? 'CUSTO DO ESTOQUE ATUAL' : 'CUSTO DE REFERÊNCIA')),
        network_scope:!!manager.network_scope
      };
    }
    for (const m of selected) rows.push(normalize(m,stockByItem.get(key(m))));

    // A pagina de estoque minimo deve mostrar tambem produtos com saldo e sem
    // baixa registrada. Nesse caso o minimo nao eh inventado: fica zero e
    // recebe classificacao "SEM DADOS DE BAIXA".
    for (const [k,s] of stockByItem) {
      if (!(s.stock > 0) || managerKeys.has(k) || visibleYearKeys.has(k)) continue;
      rows.push(normalize({
        ...s, avg:0, total:0, minimum:0, stock:s.stock, cost:s.cost,
        source:'ESTOQUE ATUAL · SEM BAIXA REGISTRADA',
        cost_source:'CUSTO DO ESTOQUE ATUAL'
      },s));
    }

    return {
      code:String(code),local,year,rows,
      pendingAnnual:year ? managerBase.length-selected.length : 0,
      managerBaseCount:managerBase.length,
      stockDate:String(window.CURRENT_STOCK_META.emissao || '30/10/2026'),
      usesNetwork:rows.some(x=>x.network_scope) || (String(code)==='30115' && managerBaseCountHasData(managerBase))
    };
  }
  function managerBaseCountHasData(rows) {
    return rows.some(x => String(x.source || '').includes('DEMANDA CONSOLIDADA'));
  }

  function shown(rows) {
    const q=norm(state.query);
    return rows.filter(x =>
      (!state.statuses.size || state.statuses.has(x.status)) &&
      (!q || norm([x.codigo,x.produto,x.grupo,x.un,x.source].join(' ')).includes(q)));
  }
  function statusPill(s) {
    const klass = s === 'SEM ESTOQUE' || s === 'ABAIXO DO MÍNIMO' ? 'red' :
      s === 'ATENÇÃO' ? 'orange' : s === 'OK' ? 'green' : 'gray';
    return '<span class="sj-chip '+klass+'">'+esc(s)+'</span>';
  }

  let current=null, currentVisible=[];
  function render({code,local,farm}) {
    current=calculate(code,local,state.year);
    if (!current) return '<section class="sj-section active"><div class="sj-note">Aguardando o estoque e o histórico de baixas do gestor principal para calcular o mínimo de 2 meses.</div></section>';
    const rows=shown(current.rows);
    currentVisible=rows;
    const below=rows.filter(x=>x.status==='SEM ESTOQUE'||x.status==='ABAIXO DO MÍNIMO');
    const zero=rows.filter(x=>x.status==='SEM ESTOQUE');
    const attention=rows.filter(x=>x.status==='ATENÇÃO');
    const noHistory=rows.filter(x=>x.status==='SEM DADOS DE BAIXA');
    const withoutCost=rows.filter(x=>x.need>0 && !(x.cost>0));
    const value=rows.reduce((sum,x)=>sum+number(x.need_value),0);
    const groups=new Map();
    for(const x of rows){
      const group=x.grupo || 'SEM GRUPO';
      if(!groups.has(group))groups.set(group,[]);
      groups.get(group).push(x);
    }
    const byGroup=[...groups].sort(([a],[b])=>a.localeCompare(b,'pt-BR',{sensitivity:'base'}));
    const groupHtml=byGroup.map(([name,items])=>{
      items.sort((a,b)=>String(a.produto||'').localeCompare(String(b.produto||''),'pt-BR',{sensitivity:'base'}) ||
        String(a.codigo).localeCompare(String(b.codigo),'pt-BR',{numeric:true}));
      const groupNeed=items.reduce((sum,x)=>sum+x.need_value,0);
      const groupCritical=items.filter(x=>x.status==='SEM ESTOQUE'||x.status==='ABAIXO DO MÍNIMO').length;
      const tableRows=items.map(x=>
        '<tr data-fm-code="'+esc(x.codigo)+'" data-fm-unit="'+esc(x.un)+'" data-fm-min="'+x.minimum+'" data-fm-avg="'+x.avg+'" data-fm-need="'+x.need+'" data-fm-status="'+esc(x.status)+'">'+
        '<td><b>'+esc(x.codigo)+'</b></td><td>'+esc(x.produto)+'</td><td>'+esc(x.un)+'</td>'+
        '<td class="num">'+qty(x.total)+'</td><td class="num">'+qty(x.avg)+'</td>'+
        '<td class="num"><b>'+qty(x.minimum)+'</b></td><td class="num">'+qty(x.stock)+'</td>'+
        '<td class="num">'+(x.coverage==null?'—':qty(x.coverage)+' meses')+'</td>'+
        '<td class="num"><b>'+qty(x.need)+'</b></td><td class="num">'+brl(x.need_value)+'</td>'+
        '<td class="num">'+qty(x.excess)+'</td><td>'+statusPill(x.status)+'</td>'+
        '<td class="num">'+(x.cost>0?brl(x.cost):'—')+'</td>'+
        '<td class="fm-source">'+esc(x.source)+'</td></tr>'
      ).join('');
      return '<details class="fm-group" data-fm-group="'+esc(name)+'">'+
        '<summary class="fm-group-summary"><strong>'+esc(name)+'</strong><span>'+integer(items.length)+' itens · '+
        integer(groupCritical)+' abaixo/sem estoque · Necessidade: '+brl(groupNeed)+'</span></summary>'+
        '<div class="sj-table-wrap"><table class="sj-table fm-table"><thead><tr>'+
        '<th>Código</th><th>Produto</th><th>UN</th><th class="num">Qtd. baixada</th><th class="num">Média mensal</th>'+
        '<th class="num">Mínimo 2 meses</th><th class="num">Estoque atual</th><th class="num">Cobertura</th>'+
        '<th class="num">Necessidade</th><th class="num">Valor necessidade</th><th class="num">Excesso vs mínimo</th>'+
        '<th>Status</th><th class="num">Custo unit.</th><th>Fonte</th>'+
        '</tr></thead><tbody>'+tableRows+'</tbody></table></div></details>';
    }).join('');

    const period = state.year==='2025' ? '2025 · 12 meses completos' :
      state.year==='2026' ? '2026 · 9 meses completos (outubro parcial)' :
      'Histórico completo · 21 meses completos (outubro parcial)';
    const extra = current.usesNetwork
      ? '<div class="sj-note fm-network"><b>Critério do gestor principal para o CDI Chuá:</b> demanda consolidada de todos os almoxarifados, comparada com o saldo atual de Chuá. Não confundir com consumo exclusivo da fazenda.</div>' : '';
    const warning = current.pendingAnnual
      ? '<div class="sj-note fm-warning"><b>'+integer(current.pendingAnnual)+' combinações de produto/local com histórico anual pendente</b> não entraram no cálculo deste ano, seguindo a conciliação do gestor principal.</div>' : '';
    const filters=STATUSES.map(s=>
      '<label><input type="checkbox" data-fm-status="'+esc(s)+'"'+
      (state.statuses.has(s)?' checked':'')+'> '+esc(s)+'</label>').join('');
    window.FARM_MINIMUM_META={
      warehouse:current.local,code:current.code,period:state.year||'todos',months:MONTHS,
      rows:current.rows.length,filteredRows:rows.length,groups:byGroup.length,
      source:'minimumBaseRows + minimumRowsForYear',
      network:current.usesNetwork,stockDate:current.stockDate,
      managerBaseCount:current.managerBaseCount,pendingAnnual:current.pendingAnnual
    };
    return '<section class="sj-section active fm-root" id="farm-minimum-view">'+
      '<div class="sj-hero"><h2>Estoque mínimo — '+esc(farm)+'</h2>'+
      '<p>Mesma base e lógica do Estoque Mínimo no gestor principal, restrita a este almoxarifado. Cobertura padrão de <b>2 meses</b> para todos os produtos com consumo conhecido, inclusive pneus e câmaras. Itens sem baixas aparecem como sem histórico, sem demanda presumida.</p></div>'+
      '<div class="fm-kpis">'+
      '<div class="sj-kpi"><div class="k">Produtos avaliados</div><div class="v">'+integer(rows.length)+'</div></div>'+
      '<div class="sj-kpi risk"><div class="k">Abaixo do mínimo</div><div class="v">'+integer(below.length)+'</div></div>'+
      '<div class="sj-kpi risk"><div class="k">Sem estoque com consumo</div><div class="v">'+integer(zero.length)+'</div></div>'+
      '<div class="sj-kpi warn"><div class="k">Em atenção</div><div class="v">'+integer(attention.length)+'</div></div>'+
      '<div class="sj-kpi"><div class="k">Valor de reposição</div><div class="v">'+brl(value)+'</div></div>'+
      '<div class="sj-kpi"><div class="k">Sem dados de baixa</div><div class="v">'+integer(noHistory.length)+'</div></div></div>'+
      '<div class="fm-toolbar">'+
      '<label>Pesquisar produto<input type="search" id="fm-search" value="'+esc(state.query)+'" placeholder="Código, descrição ou grupo"></label>'+
      '<label>Filtrar por ano<select id="fm-year"><option value=""'+(!state.year?' selected':'')+'>Todos os anos</option>'+
      '<option value="2025"'+(state.year==='2025'?' selected':'')+'>2025</option>'+
      '<option value="2026"'+(state.year==='2026'?' selected':'')+'>2026</option></select></label>'+
      '<button id="fm-clear" type="button">Limpar filtros</button>'+
      '<button id="fm-export" type="button">Exportar CSV</button></div>'+
      '<div class="fm-statuses"><strong>Status:</strong>'+filters+'</div>'+
      '<div class="sj-note"><b>Período:</b> '+esc(period)+
      '. <b>Estoque:</b> '+esc(current.stockDate)+
      '. <b>Necessidades sem custo:</b> '+integer(withoutCost.length)+
      '. Estoque mínimo = média mensal de baixas × 2 meses. Necessidade = diferença positiva entre o mínimo e o estoque atual, arredondada conforme a unidade.</div>'+
      extra+warning+
      '<div class="sj-card fm-groups-card"><div class="sj-card-head"><h3>1. Grupos de produtos → 2. Itens</h3><span>'+
      integer(byGroup.length)+' grupos · '+integer(rows.length)+' itens · '+integer(below.length)+' críticos</span></div>'+
      '<div class="fm-groups">'+(groupHtml||'<div class="sj-empty">Nenhum produto atende aos filtros.</div>')+'</div></div>'+
      '<div class="sj-note">Clique no grupo para abrir a relação completa dos itens, seus mínimos de 2 meses, quantidades necessárias, valores e situações. Produtos sem consumo registrado não recebem uma sugestão fictícia de compra.</div>'+
      '</section>';
  }

  function refresh(focus=false) {
    const nav=document.querySelector('.sj-nav [data-sj-tab="minimum"].active');
    const target=document.getElementById('sj-content');
    if(!nav||!target||!current)return;
    target.innerHTML=render({code:current.code,local:current.local,farm:
      document.querySelector('#sj-pilot-root h1')?.textContent.replace(/^Almoxarifado\s+/,'')||'Almoxarifado'});
    if(focus){
      const input=document.getElementById('fm-search');
      if(input){input.focus();input.setSelectionRange(input.value.length,input.value.length);}
    }
  }
  document.addEventListener('change',event=>{
    const t=event.target;
    if(t.id==='fm-year')state.year=t.value;
    else if(t.matches?.('[data-fm-status]')){
      const s=t.dataset.fmStatus;
      if(t.checked)state.statuses.add(s);else state.statuses.delete(s);
    }else return;
    refresh();
  },true);
  document.addEventListener('input',event=>{
    if(event.target.id!=='fm-search')return;
    state.query=event.target.value;
    refresh(true);
  },true);
  document.addEventListener('click',event=>{
    if(event.target.id==='fm-clear'){
      state.year='';state.query='';state.statuses.clear();refresh();
    }
    if(event.target.id==='fm-export' && current){
      const heads=['Código','Produto','Grupo','Local','UN','Qtd. baixada','Média mensal','Mínimo 2 meses','Estoque atual','Cobertura (meses)','Necessidade','Valor necessidade (R$)','Excesso vs mínimo','Status','Custo unitário','Fonte','Posição estoque'];
      const values=[heads,...currentVisible.map(x=>[
        x.codigo,x.produto,x.grupo,x.local,x.un,x.total,x.avg,x.minimum,x.stock,
        x.coverage==null?'':x.coverage,x.need,x.need_value,x.excess,x.status,x.cost,x.source,current.stockDate
      ])];
      const csvField=v=>'"'+String(v==null?'':v).replace(/"/g,'""')+'"';
      const content='\ufeff'+values.map(row=>row.map(csvField).join(';')).join('\r\n');
      const url=URL.createObjectURL(new Blob([content],{type:'text/csv;charset=utf-8'}));
      const a=document.createElement('a');
      a.href=url;a.download='estoque_minimo_2_meses_'+(current.code==='30115'?'chua':'sao_joao')+'.csv';
      a.click();setTimeout(()=>URL.revokeObjectURL(url),500);
    }
  },true);

  const style=document.createElement('style');
  style.id='farm-minimum-style';
  style.textContent=
    '#farm-minimum-view .fm-kpis{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:9px;margin:12px 0}'+
    '#farm-minimum-view .fm-kpis .v{font-size:18px}'+
    '#farm-minimum-view .fm-toolbar{display:grid;grid-template-columns:minmax(250px,2fr) minmax(140px,1fr) auto auto;gap:9px;align-items:end;padding:13px;border:1px solid #d5e3d9;border-radius:12px;background:#fff;margin-bottom:9px}'+
    '#farm-minimum-view .fm-toolbar label{font-size:10px;font-weight:800;color:#56705d}'+
    '#farm-minimum-view .fm-toolbar input,#farm-minimum-view .fm-toolbar select{box-sizing:border-box;width:100%;min-height:37px;padding:8px;margin-top:5px;border:1px solid #cbdfd0;border-radius:8px;color:#1e4f2f;background:#fcfefc}'+
    '#farm-minimum-view .fm-toolbar button{border:1px solid #b9d9c2;border-radius:8px;background:#e4f4e9;color:#135b30;padding:9px 13px;min-height:37px;font-weight:850;font-size:10px;cursor:pointer}'+
    '#farm-minimum-view .fm-statuses{display:flex;flex-wrap:wrap;align-items:center;gap:8px 14px;border:1px solid #d5e3d9;background:#fff;padding:10px 12px;border-radius:10px;margin-bottom:11px;font-size:10px;color:#35573e}'+
    '#farm-minimum-view .fm-statuses label{display:inline-flex;gap:5px;align-items:center;cursor:pointer}'+
    '#farm-minimum-view .fm-groups-card{margin-top:10px}'+
    '#farm-minimum-view .fm-groups{display:grid;gap:9px;padding:12px}'+
    '#farm-minimum-view .fm-group{border:1px solid #d4e2d8;border-radius:11px;background:#fff;overflow:hidden}'+
    '#farm-minimum-view .fm-group-summary{display:flex;justify-content:space-between;align-items:center;gap:10px;cursor:pointer;background:#eaf4ed;padding:13px 14px;color:#174a2b}'+
    '#farm-minimum-view .fm-group-summary:hover{background:#e1efE6}'+
    '#farm-minimum-view .fm-group-summary strong{font-size:12px}'+
    '#farm-minimum-view .fm-group-summary span{font-size:10px;text-align:right;color:#52715b;font-weight:800}'+
    '#farm-minimum-view .fm-group[open]>.fm-group-summary{border-bottom:1px solid #d4e2d8}'+
    '#farm-minimum-view .fm-table{min-width:1540px;font-size:9px}'+
    '#farm-minimum-view .fm-source{font-size:8px;max-width:190px;overflow-wrap:anywhere}'+
    '#farm-minimum-view .fm-warning{border-left-color:#e6a23a}'+
    '#farm-minimum-view .fm-network{border-left-color:#2d78a3}'+
    '@media(max-width:950px){#farm-minimum-view .fm-toolbar{grid-template-columns:repeat(2,minmax(0,1fr))}#farm-minimum-view .fm-kpis{grid-template-columns:repeat(2,minmax(0,1fr))}}'+
    '@media(max-width:650px){#farm-minimum-view .fm-toolbar{grid-template-columns:1fr}#farm-minimum-view .fm-group-summary{flex-direction:column;align-items:flex-start}#farm-minimum-view .fm-group-summary span{text-align:left}}';
  document.head.appendChild(style);

  window.FARM_MINIMUM_FROM_MANAGER={
    render,getRowsForLocal:(code,local,year='')=>calculate(code,local,year),
    getRows:()=>current?.rows.slice()||[],
    getVisibleRows:()=>currentVisible.slice(),
    getMeta:()=>window.FARM_MINIMUM_META
  };
})();
