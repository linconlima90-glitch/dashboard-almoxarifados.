// Visao unica de economias do projeto CDI/Almoxarifados - 09/11/2026.
// Negociacao de compras e calculada uma unica vez, na nota fiscal. Realocacao nao e
// economia financeira comprovada; distribuicoes CDI sao movimentacoes internas.
(function () {
  'use strict';
  if (document.documentElement.dataset.dbPilot === '1' || document.getElementById('db-economia-unificada')) return;
  const anchor = document.getElementById('cdi-transfer-panel');
  if (!anchor) return;
  const moneyBR = new Intl.NumberFormat('pt-BR', {style:'currency',currency:'BRL'});
  const priceBR = new Intl.NumberFormat('pt-BR', {style:'currency',currency:'BRL',minimumFractionDigits:2,maximumFractionDigits:4});
  const integerBR = new Intl.NumberFormat('pt-BR', {maximumFractionDigits:0});
  const quantityBR = new Intl.NumberFormat('pt-BR', {maximumFractionDigits:4});
  const money = cents => moneyBR.format((Number(cents)||0)/100);
  const price = micro => micro == null ? '—' : priceBR.format(Number(micro)/1000000);
  const esc = x => String(x == null ? '' : x).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const normal = s => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
  const dateBR = x => String(x || '').split('-').reverse().join('/');
  const sum = (rows,field) => rows.reduce((n,r) => n + (Number(r[field])||0), 0);
  const labels = {
    direct:'Compras diretas para as unidades',
    cdi:'Compras centralizadas pelo CDI de Peças',
    reuse:'Materiais realocados entre fazendas'
  };
  const panel = document.createElement('section');
  panel.id='db-economia-unificada';
  panel.setAttribute('aria-labelledby','eu-title');
  panel.innerHTML = [
    '<header class="eu-heading"><div><span class="eu-kicker">GESTÃO DE ALMOXARIFADOS / VISÃO CONSOLIDADA</span>',
    '<h2 id="eu-title">Economias e reaproveitamento de materiais</h2>',
    '<p>Uma única visão do projeto aprovado em <b>07/05/2026</b>, com resultados de compras, CDI e realocações sem somar duas vezes o mesmo benefício.</p></div>',
    '<span class="eu-asof">Base conferida em 09/11/2026</span></header>',
    '<div class="eu-filter-row">',
    '<label>Ano<select id="eu-year"><option value="">Todos os anos</option></select></label>',
    '<label>Local da compra / destino<select id="eu-local"><option value="">Todas as unidades</option></select></label>',
    '<label>Grupo / classificação<select id="eu-group"><option value="">Todos os grupos</option></select></label>',
    '<label>Produto<select id="eu-product"><option value="">Todos os produtos</option></select></label>',
    '<label>Pesquisar código ou material<input id="eu-search" type="search" placeholder="Código, produto, NF..."></label>',
    '<button type="button" id="eu-clear">Limpar</button></div>',
    '<div id="eu-status" class="eu-status" role="status">Conferindo as bases aprovadas...</div>',
    '<div class="eu-metrics">',
    '<article class="eu-kpi eu-primary"><span>Saldo comparativo das compras</span><strong id="eu-net">—</strong><small>Compras diretas + compras CDI, sem duplicar nas saídas</small></article>',
    '<article class="eu-kpi"><span>Diferenças favoráveis</span><strong id="eu-pos">—</strong><small>Máximo da Tabela Custo × compras elegíveis</small></article>',
    '<article class="eu-kpi"><span>Diferenças desfavoráveis</span><strong id="eu-neg">—</strong><small>Preços pagos acima do referencial</small></article>',
    '<article class="eu-kpi eu-potential"><span>Reaproveitamento potencial</span><strong id="eu-reuse">—</strong><small>Valor ERP de compras potencialmente evitadas · não somado</small></article>',
    '</div>',
    '<div class="eu-graph-head"><div><h3>De onde vêm os resultados</h3><p>Selecione uma barra para detalhar os materiais. A barra de reaproveitamento usa uma base diferente da economia de preços.</p></div>',
    '<span>Valores em R$ · desde 07/05/2026</span></div>',
    '<div class="eu-chart" id="eu-chart" aria-label="Gráfico horizontal das três origens do resultado"></div>',
    '<p class="eu-method" id="eu-method">Saldo das compras = diferenças favoráveis menos desfavoráveis. O custo de materiais reaproveitados não integra esse saldo e as saídas CDI não geram uma segunda economia.</p>',
    '<div id="eu-drill" class="eu-drill" aria-live="polite"><p>Selecione uma categoria do gráfico para consultar os itens.</p></div>',
    '<details id="eu-audit" class="eu-audit"><summary>Conferências e documentos completos por origem <span>+</span></summary>',
    '<div class="eu-audit-body"><p>As análises originais continuam disponíveis para consulta, sem alterar estoques nem lançamentos do ERP.</p>',
    '<div id="eu-source-panels"></div></div></details>'
  ].join('');
  anchor.parentNode.insertBefore(panel, anchor);
  const css=document.createElement('style');
  css.id='db-economia-unificada-css';
  css.textContent=[
    '#db-economia-unificada{box-sizing:border-box;background:#fff;border:1px solid #d6e5db;border-radius:16px;',
    'padding:22px 24px;margin:14px 0 21px;color:#193f2c;box-shadow:0 4px 23px rgba(12,69,31,.045);font-family:inherit}',
    '#db-economia-unificada *{box-sizing:border-box}',
    '#db-economia-unificada .eu-heading{display:flex;justify-content:space-between;gap:18px;align-items:start;margin-bottom:17px}',
    '#db-economia-unificada .eu-kicker{font-size:10px;color:#398257;font-weight:900;letter-spacing:.07em}',
    '#db-economia-unificada h2{font-size:23px;letter-spacing:-.025em;color:#16452d;margin:6px 0 8px;font-weight:900}',
    '#db-economia-unificada h3{font-size:15px;margin:0 0 6px;color:#205339;font-weight:900}',
    '#db-economia-unificada p{font-size:11px;line-height:1.55;color:#647c6a;margin:0}',
    '#db-economia-unificada .eu-asof{border:1px solid #d5e6d9;border-radius:20px;padding:8px 11px;',
    'font-size:10px;font-weight:800;color:#50765d;white-space:nowrap}',
    '#db-economia-unificada .eu-filter-row{display:grid;grid-template-columns:.7fr 1.3fr 1.05fr 1.25fr 1.3fr auto;',
    'align-items:end;gap:8px;background:#f7faf7;border:1px solid #e3eee6;padding:12px;border-radius:11px;margin:0 0 14px}',
    '#db-economia-unificada label{min-width:0;font-weight:800;font-size:10px;color:#567560}',
    '#db-economia-unificada select,#db-economia-unificada input{height:36px;width:100%;min-width:0;display:block;',
    'font-size:11px;padding:6px 8px;margin-top:5px;border:1px solid #cfdfd4;border-radius:7px;background:#fff;color:#294a36}',
    '#db-economia-unificada button{font-family:inherit;cursor:pointer}',
    '#db-economia-unificada #eu-clear,#db-economia-unificada .eu-btn{height:36px;border-radius:7px;',
    'padding:0 12px;font-weight:850;font-size:11px;background:#e8f4ec;color:#1b6039;border:1px solid #b8d4c1}',
    '#db-economia-unificada .eu-status{font-size:10px;color:#8c671f;background:#fffaf0;',
    'border:1px solid #efe0bf;border-radius:7px;padding:8px 11px;margin-bottom:12px}',
    '#db-economia-unificada .eu-status.eu-ready{background:#eff9f2;color:#296743;border-color:#d1e8d8}',
    '#db-economia-unificada .eu-metrics{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:9px}',
    '#db-economia-unificada .eu-kpi{border:1px solid #e1ebe3;background:#fcfdfc;border-radius:11px;padding:15px 14px;min-width:0}',
    '#db-economia-unificada .eu-kpi.eu-primary{background:#e8f5ec;border-color:#bdddc7}',
    '#db-economia-unificada .eu-kpi.eu-potential{background:#fffaf0;border-color:#f0e3c8}',
    '#db-economia-unificada .eu-kpi span{display:block;font-size:10px;font-weight:800;color:#52705d;min-height:28px}',
    '#db-economia-unificada .eu-kpi strong{font-size:clamp(17px,2.1vw,27px);display:block;margin:6px 0;color:#145b34;',
    'overflow-wrap:anywhere;line-height:1.24;font-variant-numeric:tabular-nums}',
    '#db-economia-unificada .eu-kpi.eu-potential strong{color:#8b6118}',
    '#db-economia-unificada .eu-kpi small{font-size:10px;color:#728477;line-height:1.5;display:block}',
    '#db-economia-unificada .eu-graph-head{display:flex;justify-content:space-between;gap:12px;align-items:end;margin:23px 0 12px}',
    '#db-economia-unificada .eu-graph-head span{white-space:nowrap;font-size:10px;color:#7a8a7d}',
    '#db-economia-unificada .eu-chart{display:grid;gap:9px}',
    '#db-economia-unificada .eu-bar{width:100%;display:grid;grid-template-columns:minmax(210px,1.1fr) minmax(100px,2fr) 145px;',
    'gap:12px;align-items:center;padding:12px;border:1px solid #e1ebe3;border-radius:9px;background:#fff;text-align:left}',
    '#db-economia-unificada .eu-bar:hover,#db-economia-unificada .eu-bar:focus-visible{border-color:#85b89a;background:#f8fcf9;outline:none}',
    '#db-economia-unificada .eu-bar[aria-pressed=true]{background:#edf8f0;border-color:#4da574}',
    '#db-economia-unificada .eu-bar-name{font-size:12px;font-weight:850;color:#274f38}',
    '#db-economia-unificada .eu-bar-name small{display:block;font-size:10px;font-weight:600;color:#779081;margin-top:4px}',
    '#db-economia-unificada .eu-track{height:19px;width:100%;background:#edf3ef;border-radius:7px;overflow:hidden}',
    '#db-economia-unificada .eu-track i{height:100%;min-width:0;display:block;background:#15763f;border-radius:7px}',
    '#db-economia-unificada .eu-bar[data-kind=cdi] .eu-track i{background:#60a977}',
    '#db-economia-unificada .eu-bar[data-kind=reuse] .eu-track i{background:repeating-linear-gradient(45deg,#dbac55,#dbac55 8px,#f0d398 8px,#f0d398 14px)}',
    '#db-economia-unificada .eu-bar.eu-negative .eu-track i{background:#bc6252}',
    '#db-economia-unificada .eu-value{font-size:15px;font-weight:900;color:#225b38;text-align:right;font-variant-numeric:tabular-nums}',
    '#db-economia-unificada .eu-bar[data-kind=reuse] .eu-value{color:#98691e}',
    '#db-economia-unificada .eu-method{padding:11px 0 0!important;font-size:10px!important;color:#77897b!important}',
    '#db-economia-unificada .eu-drill{margin:18px 0 0;padding-top:17px;border-top:1px solid #e4ede6}',
    '#db-economia-unificada .eu-drill-head{display:flex;align-items:center;justify-content:space-between;gap:13px;margin-bottom:10px}',
    '#db-economia-unificada .eu-drill-sub{font-size:10px;color:#788c7c;margin-bottom:11px}',
    '#db-economia-unificada .eu-table{overflow:auto;max-height:450px;border:1px solid #dfe9e2;border-radius:8px}',
    '#db-economia-unificada .eu-table table{border-collapse:collapse;min-width:1080px;width:100%;font-size:10px}',
    '#db-economia-unificada .eu-table th{background:#e9f4ed;color:#285d3e;padding:10px 8px;position:sticky;top:0;white-space:nowrap;text-align:left}',
    '#db-economia-unificada .eu-table td{padding:9px 8px;border-bottom:1px solid #e6eee8;vertical-align:top;color:#365b43}',
    '#db-economia-unificada .eu-table .eu-num{text-align:right;white-space:nowrap}',
    '#db-economia-unificada .eu-table .eu-negative{color:#ae5548}',
    '#db-economia-unificada .eu-pages{display:flex;gap:8px;justify-content:flex-end;align-items:center;margin-top:10px;color:#6c8372;font-size:10px}',
    '#db-economia-unificada .eu-pages button{background:#e9f5ed;border:1px solid #bdd9c7;border-radius:6px;padding:7px 10px;font-size:10px;color:#225b39}',
    '#db-economia-unificada button:disabled{opacity:.4;cursor:default}',
    '#db-economia-unificada .eu-audit{margin-top:19px;border:1px solid #e0eae3;border-radius:9px;overflow:hidden}',
    '#db-economia-unificada .eu-audit>summary{list-style:none;cursor:pointer;padding:13px 15px;font-size:11px;font-weight:850;background:#f2f8f4;color:#255a3b}',
    '#db-economia-unificada .eu-audit>summary::-webkit-details-marker{display:none}',
    '#db-economia-unificada .eu-audit>summary span{float:right}',
    '#db-economia-unificada .eu-audit[open]>summary span{transform:rotate(45deg)}',
    '#db-economia-unificada .eu-audit-body{padding:13px 14px}',
    '#db-economia-unificada #eu-source-panels>section{max-width:100%;margin:14px 0!important}',
    '@media(max-width:1150px){#db-economia-unificada .eu-filter-row{grid-template-columns:repeat(3,minmax(0,1fr))}',
    '#db-economia-unificada .eu-metrics{grid-template-columns:repeat(2,minmax(0,1fr))}}',
    '@media(max-width:720px){#db-economia-unificada{padding:16px 13px}',
    '#db-economia-unificada .eu-heading,#db-economia-unificada .eu-graph-head{display:block}',
    '#db-economia-unificada .eu-asof{display:inline-block;margin-top:10px}',
    '#db-economia-unificada .eu-filter-row{grid-template-columns:repeat(2,minmax(0,1fr))}',
    '#db-economia-unificada .eu-bar{grid-template-columns:1fr;gap:8px}',
    '#db-economia-unificada .eu-value{text-align:left}}',
    '@media(max-width:480px){#db-economia-unificada .eu-filter-row{grid-template-columns:1fr}',
    '#db-economia-unificada .eu-metrics{grid-template-columns:1fr}}'
  ].join('');
  document.head.appendChild(css);
  // Mover paineis existentes para uma unica area de auditoria, preservando todos
  // os seus IDs, eventos, filtros e tabelas de apoio.
  const auditHost = panel.querySelector('#eu-source-panels');
  [
    'db-cost-table-approved-panel',
    'cdi-distribution-purchases',
    'cdi-economy-audit-panel',
    'cdi-transfer-panel',
    'reallocation-reuse-panel'
  ].forEach(id => {
    const el=document.getElementById(id);
    if (el) auditHost.appendChild(el);
  });
  const $=id=>panel.querySelector('#'+id);
  const state={category:'',year:'',local:'',group:'',product:'',query:'',page:0};
  let purchases=[],reused=[],all=[],farmNames={},meta=null,transferRows=[],ready=false;
  const lookupLocal = code => farmNames[code] || ({
    '30115':'Fazenda Chuá',
    '50115':'Fazenda São João',
    '160115':'Saco São Francisco',
    '570115':'Saco da Tapera'
  })[code] || 'Local '+code;
  function option(select,v,label){
    const el=document.createElement('option');el.value=String(v);el.textContent=label;select.appendChild(el);
  }
  function fill(id,values,placeholder) {
    const select=$(id),keep=select.value;
    select.replaceChildren();option(select,'',placeholder);
    values.forEach(x=>option(select,x.value,x.label));
    select.value=values.some(x=>x.value===keep)?keep:'';
    return select.value;
  }
  function prepare(){
    const api=window.DB_APPROVED_COST_COMPARISON;
    const reuse=window.DB_REALLOCATION_REUSE;
    const cdi=window.CDI_TRANSFER_LEDGER;
    if (!api || !api.ready) return false;
    if (!reuse || reuse.schemaVersion!==1 || reuse.approvalDate!=='2026-05-07' ||
        !cdi || cdi.schemaVersion!==1 || cdi.approvalDate!=='2026-05-07') throw Error('Bases de reaproveitamento ou CDI indisponíveis');
    meta=api.summary;
    if (meta.schemaVersion!==2 || meta.projectFrom!=='2026-05-07') throw Error('Referência de compras incorreta');
    farmNames=meta.localNames || {};
    const productRows=api.getProducts(), raw=api.getPurchases();
    const products=new Map(productRows.map(p=>[p[0],p]));
    purchases=raw.map(t=>({
      kind:String(t[6])==='30115'?'cdi':'direct', date:String(t[1]),year:String(t[1]).slice(0,4),
      local:String(t[6]), group:String(t[4]||''),code:String(t[2]||''),product:String(t[3]||''),
      unit:String(t[5]||''),qty:Number(t[8])||0,paid:Number(t[9])||0,
      positive:Number(t[11])||0,negative:Number(t[12])||0,net:Number(t[13])||0,
      supplier:String(t[7]||''),invoice:String(t[15]||''),document:String(t[16]||''),
      costMicro:t[10],maxMicro:products.get(t[0])?.[6]??null, sourceId:String(t[0])
    }));
    if (raw.length!==meta.purchaseLines || sum(purchases,'paid')!==meta.purchaseCents ||
        sum(purchases,'positive')!==meta.positiveCents || sum(purchases,'negative')!==meta.negativeCents ||
        sum(purchases,'net')!==meta.netCents ||
        purchases.some(t=>t.date<'2026-05-07'||t.net!==t.positive+t.negative)) {
      throw Error('Compras não reconciliadas com a Tabela Custo corrigida');
    }
    reused=(reuse.transfers||[]).map(r=>({
      kind:'reuse',year:String(r.date).slice(0,4),date:String(r.date),
      local:String(r.destinationCode),group:r.classification==='USO_FINAL_CHUA'?'Uso final na Chuá':'Reaproveitamento em outra unidade',
      code:String(r.productCode||''),product:String(r.product||''),unit:String(r.unit||''),
      qty:Number(r.quantity)||0, paid:0,positive:0,negative:0,net:0,
      costCents:Number(r.costCents)||0,origin:String(r.origin||''),destination:String(r.destination||''),
      invoice:String(r.invoice||''),document:String(r.document||'')
    }));
    if (reused.length!==reuse.audit.eligibleRows ||
        sum(reused,'costCents')!==reuse.audit.eligibleValueCents ||
        reused.some(r=>r.local==='10551'||r.date<'2026-05-07') ||
        new Set(reuse.transfers.map(r=>r.id)).size!==reused.length) {
      throw Error('Reaproveitamento não reconciliado ou transferência duplicada');
    }
    transferRows=cdi.transfers || [];
    if (transferRows.length!==cdi.audit.importedRecords ||
        transferRows.reduce((n,r)=>n+(Number(r.sourceValueCents)||0),0)!==cdi.audit.importedValueCents ||
        transferRows.some(r=>String(r.destinationLocal)==='10551')) {
      throw Error('Movimentações CDI não conciliadas');
    }
    all=purchases.concat(reused);ready=true;return true;
  }
  function source(){
    return all.filter(r=>!state.year||r.year===state.year);
  }
  function relevantForOptions() {
    const base=state.category ? all.filter(r=>r.kind===state.category) : all;
    return base;
  }
  function updateFilters() {
    const base=relevantForOptions();
    const years=[...new Set(base.map(r=>r.year))].sort().reverse();
    state.year=fill('eu-year',years.map(x=>({value:x,label:x})),'Todos os anos');
    const yr=base.filter(r=>!state.year||r.year===state.year);
    const locals=[...new Set(yr.map(r=>r.local))].sort((a,b)=>lookupLocal(a).localeCompare(lookupLocal(b),'pt-BR'));
    state.local=fill('eu-local',locals.map(x=>({value:x,label:lookupLocal(x)+' · '+x})),'Todas as unidades');
    const loc=yr.filter(r=>!state.local||r.local===state.local);
    const groups=[...new Set(loc.map(r=>r.group).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'pt-BR'));
    state.group=fill('eu-group',groups.map(x=>({value:x,label:x})),'Todos os grupos');
    const gr=loc.filter(r=>!state.group||r.group===state.group);
    const products=[...new Map(gr.map(r=>[r.code,{value:r.code,label:r.product+' · '+r.code}])).values()]
      .sort((a,b)=>a.label.localeCompare(b.label,'pt-BR'));
    state.product=fill('eu-product',products,'Todos os produtos');
  }
  function match(r){
    if (state.year&&r.year!==state.year) return false;
    if (state.local&&r.local!==state.local) return false;
    if (state.group&&r.group!==state.group) return false;
    if (state.product&&r.code!==state.product) return false;
    const q=normal(state.query);
    return !q || normal([r.code,r.product,r.supplier,r.invoice,r.document,r.origin,r.destination].join(' ')).includes(q);
  }
  function summary(rows) {
    const direct=rows.filter(r=>r.kind==='direct'),cdi=rows.filter(r=>r.kind==='cdi'),reuse=rows.filter(r=>r.kind==='reuse');
    const a={direct:sum(direct,'net'),cdi:sum(cdi,'net'),reuse:sum(reuse,'costCents')};
    return {direct,cdi,reuse,values:a,net:a.direct+a.cdi,positive:sum(direct,'positive')+sum(cdi,'positive'),
      negative:sum(direct,'negative')+sum(cdi,'negative')};
  }
  function bar(kind,value,note,max) {
    const width=max>0?Math.min(100,Math.max(0,100*Math.abs(value)/max)):0;
    return '<button type="button" class="eu-bar'+(value<0?' eu-negative':'')+'" data-kind="'+kind+
      '" data-eu-kind="'+kind+'" aria-pressed="'+(state.category===kind)+'" title="Abrir materiais e documentos desta origem">'+
      '<span class="eu-bar-name">'+esc(labels[kind])+'<small>'+esc(note)+'</small></span>'+
      '<span class="eu-track"><i style="width:'+width.toFixed(2)+'%"></i></span>'+
      '<span class="eu-value">'+esc(money(value))+'</span></button>';
  }
  function renderChart(data) {
    const values=data.values,max=Math.max(1,Math.abs(values.direct),Math.abs(values.cdi),Math.abs(values.reuse));
    $('eu-net').textContent=money(data.net);
    $('eu-pos').textContent=money(data.positive);
    $('eu-neg').textContent=money(data.negative);
    $('eu-reuse').textContent=money(values.reuse);
    $('eu-chart').innerHTML=[
      bar('direct',values.direct,integerBR.format(data.direct.length)+' linhas de compra · saldo líquido estimado',max),
      bar('cdi',values.cdi,integerBR.format(data.cdi.length)+' linhas do local 30115 · compra reconhecida uma única vez',max),
      bar('reuse',values.reuse,integerBR.format(data.reuse.length)+' realocações · compra potencialmente evitada, não homologada',max)
    ].join('');
    const isFull=!state.year&&!state.local&&!state.group&&!state.product&&!state.query;
    const moved = isFull ? transferRows : transferRows.filter(r=>
      (!state.year||String(r.date).slice(0,4)===state.year) &&
      (!state.local||String(r.destinationLocal)===state.local) &&
      (!state.product||String(r.code)===state.product) &&
      (!state.query||normal([r.code,r.product,r.document,r.destination].join(' ')).includes(normal(state.query))));
    const movedCents=moved.reduce((n,r)=>n+(Number(r.sourceValueCents)||0),0);
    $('eu-method').innerHTML='No comparativo de compras, <b>'+money(data.positive)+'</b> favoráveis '+
      'e <b>'+money(data.negative)+'</b> desfavoráveis formam o saldo de <b>'+money(data.net)+'</b>. '+
      'As '+integerBR.format(moved.length)+' transferências CDI representam <b>'+money(movedCents)+'</b> em custo ERP '+
      '(não entram como nova economia). Reaproveitamento de <b>'+money(values.reuse)+'</b> corresponde a compra '+
      'potencialmente evitada, <b>fora do saldo de preços</b>. As duas bases não constituem economia financeira homologada.';
  }
  function csvExport(rows) {
    const cols=state.category==='reuse'?
      ['Data','Origem','Destino','Codigo','Produto','Qtd','Unidade','Custo ERP centavos','Documento']:
      ['Data','Local','Grupo','Codigo','Produto','Qtd','Unidade','Valor compra centavos','Preco pago micro','Maior Tabela micro','Favoravel centavos','Desfavoravel centavos','Saldo centavos','NF','Fornecedor'];
    const values=r=>state.category==='reuse'?
      [r.date,r.origin,r.destination,r.code,r.product,r.qty,r.unit,r.costCents,r.document]:
      [r.date,lookupLocal(r.local),r.group,r.code,r.product,r.qty,r.unit,r.paid,r.costMicro,r.maxMicro,r.positive,r.negative,r.net,r.invoice,r.supplier];
    const safe=x=>{let s=String(x==null?'':x);if(/^[=+\-@\t\r]/.test(s))s="'"+s;return '"'+s.replace(/"/g,'""')+'"';};
    const file='\ufeff'+[cols,...rows.map(values)].map(a=>a.map(safe).join(';')).join('\r\n');
    const url=URL.createObjectURL(new Blob([file],{type:'text/csv;charset=utf-8'}));
    const a=document.createElement('a');a.href=url;a.download='economias_consolidadas_'+state.category+'.csv';a.click();
    setTimeout(()=>URL.revokeObjectURL(url),750);
  }
  function renderDetail(data) {
    const host=$('eu-drill');
    if (!state.category) {
      host.innerHTML='<p>Selecione uma das três barras acima para abrir, nesta mesma tela, todos os itens e seus documentos.</p>';
      return;
    }
    const rows=data[state.category].slice().sort((a,b)=>
      state.category==='reuse' ? b.costCents-a.costCents : b.net-a.net || b.positive-a.positive);
    const per=80,pages=Math.max(1,Math.ceil(rows.length/per));
    state.page=Math.max(0,Math.min(state.page,pages-1));
    const visible=rows.slice(state.page*per,(state.page+1)*per);
    const cols=state.category==='reuse'?
      ['Data','Origem','Destino','Código / material','Qtd.','Valor ERP','Classificação']:
      ['Data','Local','Grupo','Código / material','NF / fornecedor','Qtd.','Preço pago','Maior ref.','Favorável','Saldo'];
    const display = state.category==='reuse' ? r =>
      '<tr><td>'+dateBR(r.date)+'</td><td>'+esc(r.origin)+'</td><td>'+esc(lookupLocal(r.local))+
      '</td><td><b>'+esc(r.code)+'</b> · '+esc(r.product)+'</td><td class="eu-num">'+quantityBR.format(r.qty)+' '+esc(r.unit)+
      '</td><td class="eu-num">'+money(r.costCents)+'</td><td>'+esc(r.group)+'</td></tr>' : r =>
      '<tr><td>'+dateBR(r.date)+'</td><td>'+esc(lookupLocal(r.local))+'</td><td>'+esc(r.group)+
      '</td><td><b>'+esc(r.code)+'</b> · '+esc(r.product)+'</td><td>'+esc(r.invoice)+'<div>'+esc(r.supplier)+
      '</div></td><td class="eu-num">'+quantityBR.format(r.qty)+' '+esc(r.unit)+'</td><td class="eu-num">'+price(r.costMicro)+
      '</td><td class="eu-num">'+price(r.maxMicro)+'</td><td class="eu-num">'+money(r.positive)+
      '</td><td class="eu-num'+(r.net<0?' eu-negative':'')+'">'+money(r.net)+'</td></tr>';
    host.innerHTML=[
      '<div class="eu-drill-head"><div><h3>'+esc(labels[state.category])+'</h3>',
      '<p>'+integerBR.format(rows.length)+' lançamentos no filtro. '+(state.category==='reuse'?
        'Custo de reaproveitamento, não economia de preço comprovada.':
        'Diferenças calculadas na aquisição, com máximo da Tabela Custo corrigida.')+'</p></div>',
      '<div><button class="eu-btn" type="button" id="eu-return">Voltar ao resumo</button> ',
      '<button class="eu-btn" type="button" id="eu-export" '+(!rows.length?'disabled':'')+'>Exportar CSV</button></div></div>',
      '<div class="eu-table"><table><thead><tr>'+cols.map(x=>'<th>'+esc(x)+'</th>').join('')+'</tr></thead><tbody>',
      visible.length?visible.map(display).join(''):'<tr><td colspan="'+cols.length+'" style="padding:20px;text-align:center">Sem itens para o filtro selecionado.</td></tr>',
      '</tbody></table></div><div class="eu-pages">',
      '<span>Mostrando '+integerBR.format(visible.length)+' de '+integerBR.format(rows.length)+' registros · Página '+(state.page+1)+' de '+pages+'</span>',
      '<button type="button" id="eu-prev" '+(state.page===0?'disabled':'')+'>Anterior</button>',
      '<button type="button" id="eu-next" '+(state.page===pages-1?'disabled':'')+'>Próximo</button></div>'
    ].join('');
    $('eu-return').addEventListener('click',()=>{
      state.category='';state.local='';state.group='';state.product='';state.query='';$('eu-search').value='';
      state.page=0;updateFilters();render();
    });
    $('eu-export').addEventListener('click',()=>csvExport(rows));
    $('eu-prev').addEventListener('click',()=>{state.page--;render()});
    $('eu-next').addEventListener('click',()=>{state.page++;render()});
  }
  function render() {
    if (!ready) return;
    const rows=all.filter(match),data=summary(rows);
    $('eu-status').classList.add('eu-ready');
    $('eu-status').textContent=integerBR.format(data.direct.length+data.cdi.length)+' compras e '+
      integerBR.format(data.reuse.length)+' realocações dentro dos filtros. '+
      'Saldo de preços = estimativa gerencial, sem homologação contábil.';
    renderChart(data);renderDetail(data);
    window.DB_UNIFIED_ECONOMY={
      ready:true,projectFrom:'2026-05-07',summary:()=>summary(all),
      filteredSummary:()=>summary(all.filter(match)),getPurchases:()=>purchases.slice(),
      getReuse:()=>reused.slice()
    };
  }
  panel.addEventListener('click',e=>{
    const b=e.target.closest('[data-eu-kind]');if(!b)return;
    const kind=b.dataset.euKind;
    state.category=state.category===kind?'':kind;
    state.local='';state.group='';state.product='';state.page=0;
    updateFilters();render();
    if(state.category){$('eu-drill').scrollIntoView({behavior:'smooth',block:'nearest'});}
  });
  ['eu-year','eu-local','eu-group','eu-product'].forEach(id=>{
    $(id).addEventListener('change',()=>{
      state.year=$('eu-year').value;state.local=$('eu-local').value;
      state.group=$('eu-group').value;state.product=$('eu-product').value;
      updateFilters();state.page=0;render();
    });
  });
  $('eu-search').addEventListener('input',e=>{state.query=e.target.value;state.page=0;render()});
  $('eu-clear').addEventListener('click',()=>{
    state.year='';state.local='';state.group='';state.product='';state.query='';state.category='';state.page=0;
    $('eu-search').value='';updateFilters();render();
  });
  let tries=0;
  function boot(){
    try {
      if (!prepare()) {
        if (++tries<70) {setTimeout(boot,200);return;}
        throw Error('A comparação da Tabela Custo não carregou ou não foi validada.');
      }
      updateFilters();render();
    } catch(e) {
      $('eu-status').textContent='Dados não disponíveis: '+String(e.message||e)+'. Nenhum total incompleto será divulgado.';
      $('eu-status').classList.remove('eu-ready');
      console.error('Economias consolidadas',e);
    }
  }
  boot();
})();