// Reorganiza as consultas existentes; os dados e os calculos continuam nas fontes originais.
(function(){
  'use strict';
  if(document.documentElement.dataset.dbPilot==='1'||window.DB_MANAGEMENT_OVERVIEW)return;
  const $=id=>document.getElementById(id);
  const overview=$('view-geral'),executive=$('view-executivo'),tabs=document.querySelector('.tabs');
  if(!overview||!executive||!tabs)return;
  const money=new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'});
  const integer=new Intl.NumberFormat('pt-BR',{maximumFractionDigits:0});
  const originalChildren=[...overview.children];
  const originalCards=overview.querySelector(':scope > .cards');
  const go=view=>window.DB_NAVIGATION?.go(view)??!!document.querySelector('.tab[data-view="'+view+'"]')?.click();

  // O resultado consolidado ganha um destino proprio, com os mesmos controles e documentos.
  const results=document.createElement('section');
  results.id='view-resultados';results.className='view';
  const resultsTab=document.createElement('button');
  resultsTab.type='button';resultsTab.className='tab';resultsTab.dataset.view='resultados';
  resultsTab.textContent='Resultado das compras';tabs.appendChild(resultsTab);
  overview.parentNode.appendChild(results);
  resultsTab.addEventListener('click',()=>{
    document.querySelectorAll('.tab').forEach(tab=>tab.classList.toggle('active',tab===resultsTab));
    document.querySelectorAll('.view').forEach(view=>view.classList.toggle('active',view===results));
    window.DB_NAVIGATION?.refresh();
  });
  const consolidated=$('db-economia-unificada');
  if(consolidated)results.appendChild(consolidated);

  // Uma entrada unica, preservando o grafico e seus handlers de Local > Grupo > Produto.
  executive.classList.remove('view','active');
  executive.classList.add('db-summary-capital');
  overview.classList.add('db-management-overview');
  const summary=document.createElement('section');
  summary.id='db-management-summary';summary.setAttribute('aria-labelledby','db-summary-title');
  summary.innerHTML='<div class="db-summary-heading"><div><span class="db-summary-eyebrow">GESTÃO DE ALMOXARIFADOS</span>'+
    '<h2 id="db-summary-title">Resumo da gestão</h2><p>Selecione um indicador para abrir a consulta correspondente.</p></div>'+
    '<div id="db-summary-dates" class="db-summary-dates"></div></div>'+
    '<div class="db-summary-cards">'+[
      ['estoque','Valor em estoque','stock','Filtros gerais'],
      ['sem-baixas','Estoque sem baixas','unused','Escopo da consulta Sem baixas'],
      ['minimo','Necessidade de reposição','need','Mínimo de 2 meses · almoxarifados'],
      ['historico','Compras no histórico','purchases','Filtros gerais · documentos de compra'],
      ['resultados','Resultado comparativo','result','Filtros de Economia e resultados']
    ].map(([target,label,key,note])=>'<button type="button" class="db-summary-card" data-target="'+target+'">'+
      '<span class="db-summary-label">'+label+'</span><strong id="db-summary-'+key+'">—</strong>'+
      '<small id="db-summary-'+key+'-note">'+note+'</small><span class="db-summary-open">Consultar <span aria-hidden="true">→</span></span></button>').join('')+
    '</div><div class="db-summary-actions"><span>Acompanhar:</span>'+
    '<button type="button" data-target="compras-programadas">Solicitações de reposição CDI</button>'+
    '<button type="button" data-target="inventarios">Inventários e pendências</button>'+
    '<button type="button" data-target="baixas">Baixas e movimentações</button></div>';
  overview.prepend(summary);
  summary.after(executive);
  const extra=document.createElement('details');extra.id='db-summary-extra';
  extra.innerHTML='<summary>Indicadores adicionais do cadastro e dos custos</summary><div class="db-summary-extra-body"></div>';
  overview.appendChild(extra);
  const extraBody=extra.querySelector('.db-summary-extra-body');

  // As oportunidades ficam na sua propria area, inclusive o comparativo detalhado ja existente.
  const opportunities=$('view-economia');
  if(opportunities){
    const section=document.createElement('section');section.id='db-purchase-opportunities';
    section.className='db-workspace-section';
    section.innerHTML='<div class="db-area-heading"><h2>Oportunidades nas compras registradas</h2>'+
      '<p>Comparação com o menor preço histórico. Os indicadores seguem os filtros gerais; o detalhamento permite escolher seu próprio período e local.</p></div><div class="cards"></div>';
    for(const id of ['kEconomiaPotencial','kEconomiaPct']){
      const card=$(id)?.closest('.card');if(card)section.querySelector('.cards').appendChild(card);
    }
    opportunities.prepend(section);
    const charts=$('barsEconomiaFornecedores')?.closest('.grid2');if(charts)section.appendChild(charts);
    const explanation=originalChildren.find(el=>el.classList.contains('notice'));
    if(explanation)section.appendChild(explanation);
    const broad=document.createElement('div');broad.className='db-area-heading db-broad-heading';
    broad.innerHTML='<h2>Cenário amplo de preços</h2><p>Base histórica própria de maior e menor custo, incluindo compras diretas. Este cenário é independente do comparativo acima.</p>';
    section.after(broad);
  }

  // Os graficos de compras passam a acompanhar os documentos e a carteira de fornecedores.
  function prependPanels(viewId,ids){
    const view=$(viewId);if(!view)return;
    const host=document.createElement('div');host.className='db-purchase-context';
    for(const id of ids){const el=$(id);if(el)host.appendChild(id.startsWith('bars')?el.closest('.panel'):el);}
    if(host.children.length)view.prepend(host);
  }
  prependPanels('view-historico',['barsMeses','monthOverviewDrilldownPanel']);
  prependPanels('view-fornecedores',['barsFornecedores','supplierOverviewDrilldownPanel']);
  // Um grafico de capital e uma consulta de estoque; os antigos receptores ficam fora da exibicao.
  for(const id of ['barsLocais','warehouseDrilldownPanel']){
    const el=$(id);if(el)(id==='barsLocais'?el.closest('.panel'):el).classList.add('db-retired-summary');
  }
  for(const id of ['kValorEstoque','kValorComprado'])$(id)?.closest('.card')?.classList.add('db-retired-summary');
  if(originalCards)extraBody.appendChild(originalCards);
  for(const child of originalChildren){
    if(child.parentNode===overview&&child!==summary&&child!==executive&&child!==extra){
      if(child.children.length||child.textContent.trim())extraBody.appendChild(child);
      else child.remove();
    }
  }
  window.DB_FAST?.addViews('renderOverview',['historico','fornecedores','economia']);

  const style=document.createElement('style');style.id='db-management-overview-style';
  style.textContent=`
    .db-retired-summary{display:none!important}
    #db-management-summary{margin:2px 0 16px}
    .db-summary-heading{display:flex;justify-content:space-between;gap:22px;align-items:flex-start;margin-bottom:15px}
    .db-summary-eyebrow{font-size:10px;font-weight:850;letter-spacing:.09em;color:#4b7b5b}
    .db-summary-heading h2{font-size:25px;line-height:1.2;margin:6px 0;color:#124c2b}
    .db-summary-heading p{font-size:12px;color:#657b6b;margin:0}
    .db-summary-dates{font-size:10px;color:#627768;line-height:1.65;text-align:right;max-width:340px}
    .db-summary-cards{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:10px}
    .db-summary-card{font:inherit;min-width:0;display:flex;flex-direction:column;align-items:flex-start;text-align:left;cursor:pointer;
      padding:16px 15px 12px;background:#fff;border:1px solid #d4e3d9;border-radius:13px;box-shadow:0 4px 14px rgba(19,80,42,.045)}
    .db-summary-card:hover{border-color:#73a987;background:#fbfefb}
    .db-summary-card:focus-visible,.db-summary-actions button:focus-visible{outline:3px solid #faca04;outline-offset:3px}
    .db-summary-label{font-size:11px;line-height:1.4;font-weight:800;color:#4d6857;min-height:31px}
    .db-summary-card strong{font-size:clamp(17px,1.6vw,25px);line-height:1.3;letter-spacing:-.025em;color:#125b32;margin:7px 0 9px;overflow-wrap:anywhere}
    .db-summary-card strong.is-negative{color:#ae5145}
    .db-summary-card small{font-size:10px;line-height:1.5;color:#6d7c72;min-height:44px;overflow-wrap:anywhere}
    .db-summary-open{font-size:10px;font-weight:850;color:#247046;margin-top:auto;padding-top:12px;display:flex;justify-content:space-between;width:100%}
    .db-summary-actions{display:flex;align-items:center;flex-wrap:wrap;gap:8px;margin-top:13px;font-size:11px;color:#6d7c72}
    .db-summary-actions button{border:1px solid #d5e4da;border-radius:8px;background:#eff7f1;color:#205f39;padding:8px 10px;font:inherit;font-weight:750;cursor:pointer}
    #view-geral #view-executivo{display:block!important;margin-bottom:13px}
    #view-geral #view-executivo .exec-capital-keep,#view-geral #view-executivo .exec-capital-keep .capital-chart-scroll{min-height:0!important}
    #db-summary-extra{background:#fff;border:1px solid #dbe6df;border-radius:11px;margin-top:14px;overflow:hidden}
    #db-summary-extra>summary{cursor:pointer;font-size:11px;font-weight:750;color:#486b55;padding:13px 15px}
    .db-summary-extra-body{padding:0 13px 13px}
    .db-summary-extra-body>.grid2{grid-template-columns:1fr}
    .db-area-heading{padding:15px 2px 11px}
    .db-area-heading h2{font-size:18px;line-height:1.3;color:#164e2d;margin:0 0 6px}
    .db-area-heading p{font-size:11px;color:#687f70;line-height:1.6;margin:0;max-width:1040px}
    #db-purchase-opportunities{margin-bottom:20px;padding:0 0 16px;border-bottom:1px solid #d5e3da}
    #db-purchase-opportunities>.cards{grid-template-columns:repeat(2,minmax(0,1fr));max-width:850px}
    .db-purchase-context{margin-bottom:15px}.db-purchase-context>.panel{max-width:100%;margin-bottom:10px}
    #view-resultados #db-economia-unificada{margin-top:2px}
    @media(max-width:1100px){.db-summary-cards{grid-template-columns:repeat(3,minmax(0,1fr))}.db-summary-card strong{font-size:22px}}
    @media(max-width:720px){.db-summary-heading{display:block}.db-summary-dates{text-align:left;max-width:none;margin-top:9px}.db-summary-heading h2{font-size:22px}
      .db-summary-cards{grid-template-columns:repeat(2,minmax(0,1fr))}.db-summary-card{padding:13px 11px}.db-summary-card strong{font-size:19px}.db-summary-card:last-child{grid-column:1/-1}
      .db-summary-card:last-child small{min-height:0}#db-purchase-opportunities>.cards{grid-template-columns:1fr}}
  `;document.head.appendChild(style);

  const caption=(id,value)=>{const el=$(id);if(el&&el.textContent!==String(value))el.textContent=String(value);};
  function selected(id){const el=$(id);return el?.value?el.selectedOptions?.[0]?.textContent||el.value:'';}
  function dateLabel(value){const s=String(value||'');return /^\d{4}-\d{2}-\d{2}$/.test(s)?s.split('-').reverse().join('/'):s;}
  function purchaseDate(rows){
    const dated=rows.map(row=>String(row.data||'')).filter(date=>/^\d{2}\/\d{2}\/\d{4}$/.test(date));
    return dated.sort((a,b)=>b.split('/').reverse().join('').localeCompare(a.split('/').reverse().join('')))[0]||'não informada';
  }
  function refresh(){
    if(!overview.classList.contains('active')||!window.CURRENT_STOCK_META||typeof stockFiltered!=='function'||typeof purchasesFiltered!=='function')return;
    const stocks=stockFiltered(),purchases=purchasesFiltered();
    caption('db-summary-stock',money.format(stocks.reduce((sum,row)=>sum+(Number(row.valor_estoque)||0),0)));
    caption('db-summary-stock-note',integer.format(new Set(stocks.map(row=>String(row.codigo))).size)+' produtos · filtros gerais');
    caption('db-summary-purchases',money.format(purchases.reduce((sum,row)=>sum+(Number(row.valor)||0),0)));
    caption('db-summary-purchases-note',integer.format(purchases.length)+' linhas · filtros gerais · recebimentos no histórico');
    const unused=window.STOCK_NO_WITHDRAWAL?.getSummary?.();
    if(unused){
      caption('db-summary-unused',money.format(unused.value));
      caption('db-summary-unused-note',integer.format(unused.items)+' posições · '+
        (unused.filters.scope==='rede'?'sem baixa em toda a rede':'sem baixa no almoxarifado')+
        (unused.filters.local?' · '+unused.filters.local:'')+(unused.filters.group?' · '+unused.filters.group:'')+
        (unused.filters.query?' · busca '+unused.filters.query:''));
    }
    const need=window.DB_STOCK_UNIFIED?.getSummary?.();
    if(need){
      caption('db-summary-need',money.format(need.value));
      caption('db-summary-need-note',integer.format(need.items)+' itens · mínimo 2 meses · '+need.year+
        (need.missingCostItems?' · '+integer.format(need.missingCostItems)+' sem custo':'')+' · CDI separado');
    }
    const economy=window.DB_UNIFIED_ECONOMY?.filteredSummary?.();
    if(economy){
      caption('db-summary-result',money.format(economy.net/100));
      $('db-summary-result').classList.toggle('is-negative',economy.net<0);
      const scope=['eu-year','eu-local','eu-group','eu-product'].map(selected).filter(Boolean);
      const query=$('eu-search')?.value.trim();if(query)scope.push('busca '+query);
      caption('db-summary-result-note','Comparativo gerencial · '+(scope.join(' · ')||'desde 07/05/2026 · todas as unidades'));
    }
    caption('db-summary-dates','Estoque: '+dateLabel(window.CURRENT_STOCK_META.emissao)+
      ' · Baixas até: '+dateLabel(window.MOVEMENTS_REVISED_META?.to||'não informado')+
      ' · Compras até: '+purchaseDate(typeof PURCHASES==='undefined'?[]:PURCHASES));
  }
  let timer=0;
  const schedule=()=>{clearTimeout(timer);timer=setTimeout(refresh,80);};
  if($('eu-net'))new MutationObserver(schedule).observe($('eu-net'),{childList:true,characterData:true,subtree:true});
  summary.addEventListener('click',event=>{const button=event.target.closest('[data-target]');if(button)go(button.dataset.target);});
  document.addEventListener('change',event=>{
    if(event.target.closest('.filters,#view-sem-baixas,#view-minimo,#db-economia-unificada'))schedule();
  });
  document.addEventListener('input',event=>{
    if(event.target.closest('.filters,#view-sem-baixas,#view-minimo,#db-economia-unificada'))schedule();
  });
  for(const event of ['dashboard-ready','stock-position-updated','stocks-updated','movements-updated','purchases-updated'])window.addEventListener(event,()=>{
    window.DB_CAPITAL_HIERARCHY?.refresh();schedule();
  });
  window.addEventListener('db-navigation-change',schedule);
  window.DB_MANAGEMENT_OVERVIEW={version:'20261126',refresh,schedule,go};
  document.documentElement.dataset.managementOverview='1';
  window.DB_NAVIGATION?.refresh();
  if(document.querySelector('.tab.active')?.dataset.view==='executivo')go('geral');
  schedule();setTimeout(schedule,500);setTimeout(schedule,1500);
})();
