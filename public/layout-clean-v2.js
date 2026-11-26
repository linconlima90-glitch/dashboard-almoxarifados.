// Navegação por tarefa — Gestão de Almoxarifados, 26/11/2026.
(function(){
  if (document.documentElement.dataset.cleanLayoutV2 === '1') return;
  document.documentElement.dataset.cleanLayoutV2 = '1';
  const $=(s,r=document)=>r.querySelector(s), $$=(s,r=document)=>[...r.querySelectorAll(s)];
  const style=document.createElement('style');
  style.textContent=`
    :root{--clean-surface:#fff;--clean-soft:#f7f9fc;--clean-shadow:0 6px 22px rgba(23,54,93,.06)}
    body.clean-layout{background:#f5f7fa}body.clean-layout header{padding:16px 26px 15px;background:linear-gradient(115deg,#17365d,#214f78);box-shadow:0 2px 12px rgba(23,54,93,.12)}body.clean-layout header h1{font-size:22px}body.clean-layout header p{margin-top:5px;font-size:11px;opacity:.92}body.clean-layout .wrap{max-width:1680px;padding:14px 22px 38px}
    .clean-toolbar{position:sticky;top:0;z-index:50;margin:0 -2px 12px;padding:8px;border:1px solid #dfe6ef;border-radius:14px;background:rgba(245,247,250,.96);backdrop-filter:blur(10px);box-shadow:0 5px 18px rgba(23,54,93,.05)}.clean-toolbar-main{display:flex;align-items:center;justify-content:space-between;gap:12px}.clean-primary{display:flex;gap:5px;align-items:center;flex-wrap:wrap}.clean-primary-btn{border:0;background:transparent;color:#526173;border-radius:9px;padding:9px 13px;font-size:12px;font-weight:850;cursor:pointer}.clean-primary-btn:hover{background:#eaf0f6;color:#17365d}.clean-primary-btn.active{background:#17365d;color:#fff;box-shadow:0 2px 7px rgba(23,54,93,.18)}.clean-toolbar-actions{display:flex;align-items:center;gap:7px}.clean-action-btn{border:1px solid #d7e0ea;background:#fff;color:#17365d;border-radius:9px;padding:8px 11px;font-size:11px;font-weight:850;cursor:pointer}.clean-action-btn:hover{background:#f0f5fa}.clean-filter-count{display:inline-grid;place-items:center;min-width:18px;height:18px;margin-left:5px;padding:0 5px;border-radius:999px;background:#17365d;color:#fff;font-size:9px}.clean-subnav{display:flex;gap:6px;align-items:center;flex-wrap:wrap;margin-top:7px;padding-top:7px;border-top:1px solid #e5ebf2}.clean-sub-btn{border:1px solid transparent;background:transparent;color:#667085;border-radius:8px;padding:6px 9px;font-size:10px;font-weight:800;cursor:pointer}.clean-sub-btn:hover{background:#edf3f8;color:#17365d}.clean-sub-btn.active{background:#e8f0f8;border-color:#cddced;color:#17365d}
    body.clean-layout .tabs{display:none!important}body.clean-layout .filters{display:none;margin:0 0 12px;padding:11px;background:#fff;border:1px solid #dfe6ef;border-radius:14px;box-shadow:var(--clean-shadow);grid-template-columns:repeat(3,minmax(0,1fr));gap:8px}body.clean-layout .filters.clean-open{display:grid}body.clean-layout .filter{border:0;background:#f7f9fc;border-radius:9px;padding:9px 11px;box-shadow:none}body.clean-layout .filter label{font-size:9px;margin-bottom:4px}body.clean-layout .filter select,body.clean-layout .filter input{font-size:11px}
    body.clean-layout .card,body.clean-layout .panel,body.clean-layout .tablepanel,body.clean-layout .exec-kpi,body.clean-layout .exec-section,body.clean-layout .quote-kpi{border-color:#e0e6ee;box-shadow:var(--clean-shadow)}body.clean-layout .card,body.clean-layout .panel,body.clean-layout .tablepanel,body.clean-layout .exec-kpi,body.clean-layout .exec-section{border-radius:14px}body.clean-layout .tablehead{padding:12px 14px;background:#fff}body.clean-layout .tablehead h2,body.clean-layout .panel h2{font-size:13px}body.clean-layout table{font-size:10px}body.clean-layout thead th{background:#eef3f8;color:#17365d;border-bottom:1px solid #d8e1ec;padding:8px 7px}body.clean-layout tbody td{padding:7px;border-bottom-color:#eef1f5}body.clean-layout tbody tr:hover{background:#f8fafc}
    body.clean-layout .cards{grid-template-columns:repeat(4,1fr);gap:9px}body.clean-layout .card{padding:12px}body.clean-layout .card .v{font-size:20px}
    body.clean-layout .exec-hero{padding:15px 17px;margin-bottom:11px;border-radius:14px;background:linear-gradient(115deg,#17365d,#245982);box-shadow:0 8px 24px rgba(23,54,93,.14)}body.clean-layout .exec-hero h2{font-size:18px}body.clean-layout .exec-hero p{font-size:10px;max-width:980px}body.clean-layout .official-badge{font-size:10px;padding:5px 8px;margin-bottom:8px}body.clean-layout .exec-nav{display:none}body.clean-layout .exec-kpis{grid-template-columns:repeat(3,1fr);gap:9px;margin-bottom:9px}body.clean-layout .exec-kpi{padding:11px 12px;min-height:76px}body.clean-layout .exec-kpi .k{font-size:8.5px}body.clean-layout .exec-kpi .v{font-size:18px}body.clean-layout .exec-kpi.clean-secondary{display:none}body.clean-layout .exec-kpis.clean-show-all .exec-kpi.clean-secondary{display:block}.clean-kpi-toggle-wrap{display:flex;justify-content:flex-end;margin:-1px 0 11px}.clean-kpi-toggle{border:0;background:transparent;color:#1f4e78;font-size:10px;font-weight:850;cursor:pointer;padding:4px 3px}.clean-kpi-toggle:hover{text-decoration:underline}
    body.clean-layout .exec-section{margin-bottom:8px;overflow:hidden;box-shadow:none}body.clean-layout .exec-section-head{position:relative;padding:11px 40px 11px 14px;background:#fff;color:#17365d;border-bottom:0;font-size:11px;cursor:pointer;user-select:none}body.clean-layout .exec-section-head:after{content:'+';position:absolute;right:14px;top:50%;transform:translateY(-50%);font-size:18px;font-weight:400;color:#7b8797}body.clean-layout .exec-section.clean-open .exec-section-head{border-bottom:1px solid #e8edf3}body.clean-layout .exec-section.clean-open .exec-section-head:after{content:'−'}body.clean-layout .exec-section-body{display:none;padding:12px 13px}body.clean-layout .exec-section.clean-open .exec-section-body{display:block}body.clean-layout .exec-note{font-size:9px}body.clean-layout .exec-table{font-size:9.5px}body.clean-layout .exec-table th{background:#f1f5f9;color:#17365d;border-bottom:1px solid #dbe4ee}body.clean-layout .exec-table td{padding:6px 7px}body.clean-layout .exec-action{font-size:9.5px;padding:8px 9px}
    body.clean-layout .grid2{gap:10px;margin-bottom:10px}body.clean-layout .panel{padding:12px}body.clean-layout .tablepanel{margin-bottom:10px}body.clean-layout .notice{background:#fbfcfd;border-color:#e1e7ee;border-left-color:#9bb6c8;color:#6b7788}
    .clean-subnav[hidden],.clean-mode-bar[hidden],.clean-toolbar [hidden],.clean-context [hidden],body.clean-layout .filters[hidden]{display:none!important}
    .clean-context{margin:0 0 11px;padding:11px 14px;background:#f8fbf8;border:1px solid #dce8df;border-radius:11px;color:#365842;font-size:11px;line-height:1.5}
    .clean-context-heading{display:flex;align-items:center;flex-wrap:wrap;gap:8px;margin-bottom:5px}.clean-context-heading strong{font-size:12px;color:#164d2e}.clean-context-scope{font-size:10px;font-weight:750;color:#607767}
    .clean-context-filters,.clean-context-saved{display:flex;align-items:center;flex-wrap:wrap;gap:5px 7px}.clean-context-chip{display:inline-block;padding:3px 7px;border:1px solid #d2e3d7;background:#fff;border-radius:6px;overflow-wrap:anywhere;max-width:100%}
    .clean-context-note{margin:6px 0 0!important;color:#607767;font-size:10px}.clean-context-saved{margin-top:6px;color:#758077;font-size:10px}.clean-context-saved .clean-context-chip{background:transparent;border-color:#e0e5e1}
    .clean-mode-bar{display:flex;align-items:center;flex-wrap:wrap;gap:8px 12px;padding:10px 13px;margin:0 0 12px;background:#fff;border:1px solid #d5e4d9;border-radius:11px}.clean-mode-label{font-size:11px;font-weight:800;color:#4b6654}.clean-modes{display:flex;align-items:center;flex-wrap:wrap;gap:5px}
    .clean-mode-btn{border:1px solid #d0e1d5;border-radius:8px;padding:8px 11px;background:#fff;color:#28593b;font:inherit;font-size:11px;font-weight:800;cursor:pointer}.clean-mode-btn:hover{background:#edf7f0}.clean-mode-btn.active{background:#145f35;border-color:#145f35;color:#fff}.clean-mode-btn:focus-visible,.clean-primary-btn:focus-visible,.clean-sub-btn:focus-visible{outline:3px solid #e5b919;outline-offset:2px}
    @media(max-width:1150px){body.clean-layout .filters{grid-template-columns:repeat(2,1fr)}body.clean-layout .cards{grid-template-columns:repeat(2,1fr)}body.clean-layout .exec-kpis{grid-template-columns:repeat(2,1fr)}}
    @media(max-width:760px){body.clean-layout header{padding:14px 15px 13px}body.clean-layout header h1{font-size:18px}body.clean-layout .wrap{padding:10px 10px 30px}.clean-toolbar{position:static;padding:7px}.clean-toolbar-main{align-items:flex-start;flex-direction:column}.clean-primary{width:100%;display:grid;grid-template-columns:repeat(2,1fr)}.clean-primary-btn{text-align:center;padding:8px 7px}.clean-toolbar-actions{width:100%;justify-content:flex-end}body.clean-layout .filters{grid-template-columns:1fr}body.clean-layout .cards,body.clean-layout .exec-kpis{grid-template-columns:1fr}}
  `;
  document.head.appendChild(style);document.body.classList.add('clean-layout');
  // A data de atualizacao vem do ultimo carregamento ERP; nao sobrescrever com data fixa antiga.
  const wrap=$('.wrap'),oldTabs=$('.tabs'),filters=$('.filters');if(!wrap||!oldTabs)return;
  // Os pilotos locais têm sua própria navegação e não recebem os menus de gestão.
  const pilot=document.documentElement.dataset.dbPilot==='1'||/^\/(?:sao-joao|chua|fazenda-chua)\/?$/.test(window.location?.pathname||'');
  if(pilot)return;
  const groups=[
    {id:'resumo',label:'Resumo',views:['geral','executivo'],sections:[
      {view:'geral',label:'Resumo',views:['geral','executivo']}
    ]},
    {id:'estoque',label:'Estoque',views:['estoque','sem-baixas','minimo','cdi','baixas','inventarios'],sections:[
      {view:'estoque',label:'Posição de estoque',views:['estoque','sem-baixas'],modes:[['estoque','Todos os itens'],['sem-baixas','Sem baixas']]},
      {view:'minimo',label:'Reposição',views:['minimo','cdi'],modes:[['minimo','Almoxarifados'],['cdi','CDI / rede']]},
      {view:'baixas',label:'Movimentações',views:['baixas']},
      {view:'inventarios',label:'Inventários',views:['inventarios']}
    ]},
    {id:'compras',label:'Compras',views:['historico','fornecedores','produtos','variacao','atualizacao-custos','compras-programadas','orcamentos'],sections:[
      {view:'historico',label:'Histórico',views:['historico','fornecedores'],modes:[['historico','Documentos'],['fornecedores','Fornecedores']]},
      {view:'produtos',label:'Preços',views:['produtos','variacao','atualizacao-custos']},
      {view:'compras-programadas',label:'Solicitações CDI',views:['compras-programadas']},
      {view:'orcamentos',label:'Orçamentos',views:['orcamentos']}
    ]},
    {id:'resultados',label:'Economia e resultados',views:['resultados','economia'],sections:[
      {view:'resultados',label:'Resultado das compras',views:['resultados']},
      {view:'economia',label:'Oportunidades',views:['economia']}
    ]}
  ];
  const filterLabels={fEmpresa:'Empresa',fLocal:'Almoxarifado',fGrupo:'Grupo',fUn:'Unidade',fFornecedor:'Fornecedor',fBusca:'Busca'};
  const filterIds=Object.keys(filterLabels),physicalFilterIds=filterIds.filter(id=>id!=='fFornecedor');
  const profiles={
    geral:{scope:'mixed',ids:filterIds,note:'Estoque, capital e compras seguem os filtros gerais; os cartões de sem baixas, reposição e resultados indicam o recorte da respectiva análise.'},
    estoque:{scope:'mixed',ids:filterIds,note:'A posição considera os filtros gerais e a seleção de almoxarifado, grupo e produto desta consulta.'},
    'sem-baixas':{scope:'own',ids:[],note:'Use os filtros próprios abaixo. O modo distingue ausência de baixas em toda a rede e somente no almoxarifado selecionado.'},
    minimo:{scope:'mixed',ids:physicalFilterIds,note:'A demanda de reposição considera empresa, almoxarifado, grupo, unidade e busca dos filtros gerais. A consulta também inclui saldos sem demanda para revisão. Período, situação e estoque máximo têm controles próprios; Chuá e CDI compartilham um único saldo físico.'},
    cdi:{scope:'own',ids:[],note:'Demanda consolidada da rede e saldo compartilhado da Chuá/CDI. Use os filtros próprios de ano e situação; selecionar um local nos filtros gerais não restringe esta análise.'},
    baixas:{scope:'mixed',ids:physicalFilterIds,note:'As baixas seguem os filtros gerais de empresa, almoxarifado, grupo, unidade e busca, além do período desta consulta. Fornecedor não filtra baixas.'},
    inventarios:{scope:'own',ids:[],note:'Use os filtros próprios de inventário, almoxarifado, grupo e diferença. Ajustes de inventário e saldo atual são consultas distintas.'},
    historico:{scope:'global',ids:filterIds,note:'Documentos de compra no recorte dos filtros gerais. Recebimento lançado e recebimento pendente permanecem identificados nos documentos.'},
    fornecedores:{scope:'global',ids:filterIds,note:'Fornecedores e documentos no recorte dos filtros gerais. Abra um fornecedor para consultar seus produtos e compras.'},
    produtos:{scope:'mixed',ids:filterIds,note:'Consulta consolidada por produto. Almoxarifado e empresa selecionam produtos presentes nesses locais; os saldos e as referências continuam consolidados por produto.'},
    variacao:{scope:'global',ids:filterIds,note:'Histórico de compras filtrado por código e unidade. Com fornecedor selecionado, a variação considera somente suas compras.'},
    'atualizacao-custos':{scope:'own',ids:[],note:'Use os filtros próprios de custos abaixo. Custo original ERP, custo do dashboard, última compra e referência gerencial permanecem separados; correções são propostas para conferência.'},
    'compras-programadas':{scope:'own',ids:[],note:'Solicitações para o CDI Chuá, local 30115, com busca e situação próprias. Solicitação emitida não comprova compra, aprovação nem recebimento.'},
    orcamentos:{scope:'own',ids:[],note:'Use a pesquisa e o fornecedor desta consulta. Orçamentos são referências comerciais, separados das compras efetivas.'},
    resultados:{scope:'own',ids:[],note:'Use os filtros próprios do resultado das compras. Comparativo de preços, atribuição do CDI e reaproveitamento mantêm suas bases e não devem ser somados como novos ganhos.'},
    economia:{scope:'mixed',ids:filterIds,note:'As oportunidades nas compras registradas seguem os filtros gerais. O cenário amplo de preços usa uma base histórica própria e não segue esses filtros; seus grupos e itens são consultados separadamente.'}
  };
  const localControls={
    estoque:{'dbsc-local':'Almoxarifado da consulta','dbsc-group':'Grupo da consulta','dbsc-product':'Produto','dbsc-search':'Busca da consulta'},
    'sem-baixas':{'ns-local':'Almoxarifado','ns-group':'Grupo','ns-search':'Busca','ns-scope':'Verificar baixas'},
    minimo:{'dbmx-year':'Período das baixas','dbmx-months':'Estoque máximo','dbmx-mode':'Situação','dbmx-search':'Busca da consulta'},
    cdi:{cdiMinimumYear:'Ano da demanda',cdiTransferYearFilter:'Ano das transferências'},
    baixas:{'dbx-period':'Período das baixas','dbx-local':'Almoxarifado da consulta','dbx-group':'Grupo da consulta','dbx-item':'Produto'},
    inventarios:{'iv-session':'Inventário','iv-local':'Almoxarifado','iv-group':'Grupo','iv-type':'Diferença','iv-q':'Busca'},
    'atualizacao-custos':{'cu-group':'Grupo','cu-product':'Produto','cu-local':'Almoxarifado','cu-only':'Situação','cu-search':'Busca'},
    'compras-programadas':{'sc-search':'Busca','sc-status':'Situação'},
    orcamentos:{qProduto:'Produto',qFornecedor:'Fornecedor'},
    resultados:{'eu-year':'Ano','eu-local':'Local da compra / destino','eu-group':'Grupo','eu-product':'Produto','eu-search':'Busca'}
  };
  const toolbar=document.createElement('div');toolbar.className='clean-toolbar';
  toolbar.innerHTML='<div class="clean-toolbar-main"><nav class="clean-primary" aria-label="Áreas do dashboard"></nav><div class="clean-toolbar-actions"><button type="button" class="clean-action-btn clean-clear" hidden>Limpar gerais</button><button type="button" class="clean-action-btn clean-filter-toggle" aria-expanded="false"><span class="clean-filter-label">Filtros gerais</span> <span class="clean-filter-count" hidden>0</span></button></div></div><nav class="clean-subnav" aria-label="Consultas da área"></nav>';
  wrap.insertBefore(toolbar,filters||oldTabs);
  const context=document.createElement('div');context.id='db-navigation-context';context.className='clean-context';
  context.innerHTML='<div class="clean-context-heading"><strong></strong><span class="clean-context-scope"></span></div><div class="clean-context-filters" aria-live="polite"></div><p class="clean-context-note"></p><div class="clean-context-saved" hidden></div>';
  wrap.insertBefore(context,filters||oldTabs);
  const modeBar=document.createElement('div');modeBar.id='db-navigation-modes';modeBar.className='clean-mode-bar';modeBar.hidden=true;
  modeBar.innerHTML='<span class="clean-mode-label">Mostrar</span><div class="clean-modes" role="group"></div>';
  wrap.insertBefore(modeBar,oldTabs);
  const primary=$('.clean-primary',toolbar),subnav=$('.clean-subnav',toolbar),modes=$('.clean-modes',modeBar);
  const filterToggle=$('.clean-filter-toggle',toolbar),filterCount=$('.clean-filter-count',toolbar),clearFilters=$('.clean-clear',toolbar);
  const originalTab=view=>$$('.tab',oldTabs).find(tab=>tab.dataset.view===view);
  const canonical=view=>view==='executivo'?'geral':String(view||'geral');
  const activeView=()=>canonical($('.tab.active',oldTabs)?.dataset.view||'geral');
  const existingViews=group=>group.views.filter(view=>view!=='executivo'&&originalTab(view));
  const groupForView=view=>groups.find(group=>group.views.includes(view))||groups[0];
  const sectionForView=(group,view)=>group.sections.find(section=>section.views.includes(view))||group.sections[0];
  let pending=0,syncing=false,primarySignature='',subSignature='',modeSignature='',lastContextSignature='';

  function readControl(id,label){
    const element=document.getElementById(id),value=String(element?.value||'').trim();
    if(!element||!value)return null;
    const text=element.tagName==='SELECT'?element.selectedOptions?.[0]?.textContent.trim()||value:value;
    return {id,label,value,text};
  }
  function getContext(){
    const view=activeView(),group=groupForView(view),section=sectionForView(group,view),profile=profiles[view]||profiles.geral;
    const globalFilters=filterIds.map(id=>readControl(id,filterLabels[id])).filter(Boolean)
      .map(filter=>({...filter,applies:profile.ids.includes(filter.id)}));
    const ownFilters=Object.entries(localControls[view]||{}).map(([id,label])=>readControl(id,label))
      .filter(filter=>filter&&!['all','todos'].includes(filter.value));
    return {view,group:group.id,section:section.view,filterScope:profile.scope,note:profile.note,
      filters:globalFilters,appliedFilters:globalFilters.filter(filter=>filter.applies),
      savedFilters:globalFilters.filter(filter=>!filter.applies),ownFilters};
  }
  function makeButton(className,label,key,value,callback){
    const button=document.createElement('button');button.type='button';button.className=className;
    button.dataset[key]=value;button.textContent=label;button.addEventListener('click',callback);return button;
  }
  function activateButtons(container,key,value,pressed=false){
    $$('button',container).forEach(button=>{
      const active=button.dataset[key]===value;button.classList.toggle('active',active);
      if(pressed)button.setAttribute('aria-pressed',String(active));
      else if(active)button.setAttribute('aria-current','page');else button.removeAttribute('aria-current');
    });
  }
  function renderPrimary(group){
    const available=groups.filter(item=>existingViews(item).length),signature=available.map(item=>item.id).join('|');
    if(signature!==primarySignature){
      primarySignature=signature;
      primary.replaceChildren(...available.map(item=>makeButton('clean-primary-btn',item.label,'group',item.id,()=>{
        const current=activeView();go(item.views.includes(current)&&originalTab(current)?current:existingViews(item)[0]);
      })));
    }
    activateButtons(primary,'group',group.id);
  }
  function renderSubnav(group,view){
    const sections=group.id==='resumo'?[]:group.sections.filter(section=>section.views.some(item=>originalTab(item)));
    const signature=group.id+'|'+sections.map(section=>section.view).join('|');
    if(signature!==subSignature){
      subSignature=signature;
      subnav.replaceChildren(...sections.map(section=>makeButton('clean-sub-btn',section.label,'view',section.view,()=>{
        go(section.views.find(item=>originalTab(item)));
      })));
    }
    subnav.hidden=!sections.length;
    activateButtons(subnav,'view',sectionForView(group,view).view);
  }
  function renderModes(section,view){
    const choices=(section.modes||[]).filter(([item])=>originalTab(item));
    const signature=section.view+'|'+choices.map(([item])=>item).join('|');
    if(signature!==modeSignature){
      modeSignature=signature;
      modes.replaceChildren(...choices.map(([item,label])=>makeButton('clean-mode-btn',label,'view',item,()=>go(item))));
    }
    modes.setAttribute('aria-label','Modo de consulta: '+section.label);
    modeBar.hidden=choices.length<2;activateButtons(modes,'view',view,true);
  }
  function chip(filter){
    const item=document.createElement('span');item.className='clean-context-chip';
    item.textContent=filter.label+': '+filter.text;return item;
  }
  function renderContext(current,section){
    const own=current.filterScope==='own',globalCount=current.filters.length;
    context.dataset.scope=current.filterScope;context.dataset.view=current.view;
    const mode=section.modes?.find(([view])=>view===current.view);
    $('.clean-context-heading strong',context).textContent=section.label+(mode?' · '+mode[1]:'');
    $('.clean-context-scope',context).textContent=own?'Filtros próprios desta consulta':current.filterScope==='mixed'?'Confira o alcance dos filtros':'Filtros gerais';
    const active=[...current.appliedFilters,...current.ownFilters],list=$('.clean-context-filters',context);
    list.replaceChildren(...active.map(chip));
    if(!active.length)list.textContent=own?'Nenhum filtro adicional selecionado nesta consulta.':'Sem filtros gerais selecionados.';
    $('.clean-context-note',context).textContent=current.note;
    const saved=$('.clean-context-saved',context);saved.hidden=!current.savedFilters.length;
    saved.replaceChildren();
    if(current.savedFilters.length){
      const label=document.createElement('span');label.textContent='Filtros gerais guardados para outras consultas:';
      saved.append(label,...current.savedFilters.map(chip));
    }
    filterToggle.hidden=own;clearFilters.hidden=own||!globalCount;filterCount.hidden=!globalCount;
    filterCount.textContent=String(globalCount);
    if(filters)filters.hidden=own;
    const open=!!filters?.classList.contains('clean-open');
    filterToggle.setAttribute('aria-expanded',String(!own&&open));
    $('.clean-filter-label',toolbar).textContent=open?'Fechar filtros gerais':'Filtros gerais';
    const signature=JSON.stringify(current);
    if(signature!==lastContextSignature){
      lastContextSignature=signature;window.dispatchEvent(new CustomEvent('db-navigation-change',{detail:current}));
    }
  }
  function refresh(){
    if(syncing)return;
    syncing=true;
    try{
      // O botão antigo continua existindo para atalhos e integrações, mas abre o resumo único.
      if($('.tab.active',oldTabs)?.dataset.view==='executivo')originalTab('geral')?.click();
      const view=activeView(),group=groupForView(view),section=sectionForView(group,view);
      renderPrimary(group);renderSubnav(group,view);renderModes(section,view);renderContext(getContext(),section);
    }finally{syncing=false;}
  }
  function schedule(){clearTimeout(pending);pending=setTimeout(refresh,0);}
  function go(view){
    const target=originalTab(canonical(view));if(!target)return false;
    target.click();refresh();return true;
  }
  window.DB_NAVIGATION={go,refresh,getContext};
  oldTabs.addEventListener('click',event=>{
    const tab=event.target.closest?.('.tab');
    if(tab?.dataset.view!=='executivo'||!originalTab('geral'))return;
    event.preventDefault();event.stopImmediatePropagation();go('geral');
  },true);
  oldTabs.addEventListener('click',event=>{if(event.target.closest?.('.tab'))schedule();});
  // Observar apenas as abas de origem evita ciclos causados pelo redesenho do toolbar.
  new MutationObserver(records=>{
    const changed=records.some(record=>record.type==='childList'?
      record.target===oldTabs||[...record.addedNodes,...record.removedNodes].some(node=>node.nodeType===1&&(node.matches?.('.tab')||node.querySelector?.('.tab'))):
      record.target.matches?.('.tab')&&String(record.oldValue||'').split(/\s+/).includes('active')!==record.target.classList.contains('active'));
    if(changed)schedule();
  }).observe(oldTabs,{childList:true,subtree:true,attributes:true,attributeFilter:['class'],attributeOldValue:true});
  filterToggle.addEventListener('click',()=>{if(filters){filters.classList.toggle('clean-open');refresh();}});
  clearFilters.addEventListener('click',()=>{
    for(const id of filterIds){const element=document.getElementById(id);if(element&&element.value!==''){
      element.value='';element.dispatchEvent(new Event(element.tagName==='INPUT'?'input':'change',{bubbles:true}));
    }}refresh();
  });
  for(const id of filterIds){const element=document.getElementById(id);if(element)element.addEventListener(element.tagName==='INPUT'?'input':'change',schedule);}
  for(const name of ['input','change','click'])wrap.addEventListener(name,event=>{
    if(event.target.closest?.('.view.active'))schedule();
  });
  const execKpis=$('#view-executivo .exec-kpis');if(execKpis){const primaryLabels=new Set(['Valor em estoque','Necessidade bruta de reposição','Potencial de transferência interna','Compra após transferências','Economia potencial em compras','Itens abaixo do mínimo']);$$('.exec-kpi',execKpis).forEach(k=>{const label=$('.k',k)?.textContent.trim();if(!primaryLabels.has(label))k.classList.add('clean-secondary')});const tw=document.createElement('div');tw.className='clean-kpi-toggle-wrap';const tb=document.createElement('button');tb.type='button';tb.className='clean-kpi-toggle';tb.textContent='Mostrar todos os indicadores';tb.addEventListener('click',()=>{const show=execKpis.classList.toggle('clean-show-all');tb.textContent=show?'Mostrar somente os principais':'Mostrar todos os indicadores'});tw.appendChild(tb);execKpis.insertAdjacentElement('afterend',tw)}
  $$('#view-executivo .exec-section').forEach((section,i)=>{const head=$('.exec-section-head',section);if(!head)return;head.setAttribute('role','button');head.setAttribute('tabindex','0');const toggle=()=>section.classList.toggle('clean-open');head.addEventListener('click',toggle);head.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();toggle()}});if(i===0)section.classList.add('clean-open')});
  refresh();
})();
