// Baixas por data de negociacao, conferidas com Custo_Total do ERP.
// A consulta financeira e independente do algoritmo de estoque minimo/maximo.
(function(){
  'use strict';
  if(window.DB_BAIXAS_ERP_CONFERIDO)return;
  const rootId='db-baixas-erp-conferido';
  const periodSet={all:['2024','2025','2026'],'2024':['2024'],'2025':['2025'],'2026':['2026'],'2025-2026':['2025','2026']};
  const state={period:'all',mode:'local',local:'',group:'',item:''};
  const norm=v=>String(v??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toUpperCase().replace(/\s+/g,' ').trim();
  const outsideScope=v=>['ALMOXARIFADO GERAL G GERIBA','ALMOXARIFADO GERAL G S CRUZ'].includes(norm(v));
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const money=new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'});
  const integer=new Intl.NumberFormat('pt-BR',{maximumFractionDigits:0});
  const decimals=new Intl.NumberFormat('pt-BR',{minimumFractionDigits:0,maximumFractionDigits:4});
  const brlCents=v=>money.format((Number(v)||0)/100);
  const number=v=>integer.format(Number(v)||0);
  const qty=v=>decimals.format(Number(v)||0);
  let panel=null,rows=null,source=null,filtered=[],companyByLocal=new Map(),localGroups=[],allGroups=[];
  function readSource(){
    const P=window.MOVEMENTS_COMPLETE_20261103;
    if(!P||!P.dict||!Array.isArray(P.rows)||P.meta?.dateBasis!=='Dt.Neg.'||!window.__MOVEMENT_COMPLETE_20261103_APPLIED)return false;
    const D=P.dict;
    if(rows&&source===P)return true;
    const values=[];let count=0,totalCents=0;
    for(const record of P.rows){
      const [mi,li,fi,pi,ui,amount,cents,records]=record;
      const month=D.month?.[mi],local=D.local?.[li],prod=D.product?.[pi];
      const company=D.company?.[fi],un=D.unit?.[ui],grp=D.group?.[prod?.[2]];
      if(!month||!local||!prod||!un||!Number.isInteger(cents)||!Number.isInteger(records)||records<1)return false;
      const name=String(local[1]||'');
      values.push({year:month.slice(0,4),month,local:name,codigoLocal:String(local[0]),
        grupo:String(grp||'SEM GRUPO'),codigo:String(prod[0]),produto:String(prod[1]),un:String(un),
        empresa:String(company||''),quantidade:Number(amount)||0,cents,records});
      count+=records;totalCents+=cents;
    }
    if(count!==Number(P.meta.records)||totalCents!==Math.round(Number(P.meta.value)*100))return false;
    rows=values;source=P;
    companyByLocal=new Map();
    if(typeof MOVEMENTS!=='undefined')for(const x of MOVEMENTS){
      if(!companyByLocal.has(x.local))companyByLocal.set(x.local,String(x.empresa||''));
    }
    return true;
  }
  function criteria(){
    const v=id=>String(document.getElementById(id)?.value||'').trim();
    return {local:v('fLocal'),empresa:v('fEmpresa'),grupo:v('fGrupo'),un:v('fUn'),q:norm(v('fBusca'))};
  }
  function selected(){
    const valid=periodSet[state.period]||periodSet.all,f=criteria();
    return rows.filter(x=>valid.includes(x.year)&&!outsideScope(x.local)&&
      (!f.local||x.local===f.local)&&(!f.grupo||x.grupo===f.grupo)&&(!f.un||x.un===f.un)&&
      (!f.empresa||norm(x.empresa).includes(norm(f.empresa))||norm(companyByLocal.get(x.local)).includes(norm(f.empresa)))&&
      (!f.q||norm([x.codigo,x.produto,x.grupo,x.local].join(' ')).includes(f.q)));
  }
  function summarize(list,keyFn){
    const output=new Map();
    for(const r of list){
      const key=keyFn(r);let x=output.get(key);
      if(!x){x={key,cents:0,records:0,quantidade:0,rows:[],products:new Set(),groups:new Set(),locals:new Set()};output.set(key,x)}
      x.cents+=r.cents;x.records+=r.records;x.quantidade+=r.quantidade;x.rows.push(r);
      x.products.add([r.local,r.codigo,r.un].join('|'));
      x.groups.add([r.local,r.grupo].join('|'));
      x.locals.add(r.local);
    }
    return [...output.values()].sort((a,b)=>b.cents-a.cents||a.key.localeCompare(b.key,'pt-BR'));
  }
  function totals(list){
    const x={records:0,cents:0,products:new Set(),groups:new Set(),locals:new Set()};
    for(const r of list){x.records+=r.records;x.cents+=r.cents;
      x.products.add([r.local,r.codigo,r.un].join('|'));x.groups.add([r.local,r.grupo].join('|'));x.locals.add(r.local)}
    return x;
  }
  function itemRows(list){
    const items=summarize(list,r=>[r.codigo,r.un].join('|'));
    return items.map(x=>({...x,codigo:x.rows[0].codigo,produto:x.rows[0].produto,un:x.rows[0].un,
      locais:new Set(x.rows.map(r=>r.local)).size}));
  }
  function tableItems(list,withLocals){
    const items=itemRows(list);
    if(!items.length)return '<p class="dbx-muted">Nenhum produto nesta seleção.</p>';
    return '<div class="dbx-scroll"><table class="dbx-table"><thead><tr><th>#</th><th>Código</th><th>Produto</th><th>UN</th><th class="dbx-num">Qtd. baixada</th><th class="dbx-num">Lançamentos</th>'+
      (withLocals?'<th class="dbx-num">Locais</th>':'')+
      '<th class="dbx-num">Custo_Total ERP</th></tr></thead><tbody>'+
      items.map((x,i)=>'<tr><td>'+number(i+1)+'</td><td>'+esc(x.codigo)+'</td><td>'+esc(x.produto)+'</td><td>'+esc(x.un)+
      '</td><td class="dbx-num">'+qty(x.quantidade)+'</td><td class="dbx-num">'+number(x.records)+'</td>'+
      (withLocals?'<td class="dbx-num">'+number(x.locais)+'</td>':'')+
      '<td class="dbx-num dbx-value">'+brlCents(x.cents)+'</td></tr>').join('')+'</tbody></table></div>';
  }
  function bars(groups,type){
    const max=Math.max(1,...groups.map(x=>x.cents));
    if(!groups.length)return '<p class="dbx-muted">Nenhuma baixa registrada com esses filtros.</p>';
    return groups.map(x=>{
      const active=type==='local'?state.local===x.key:state.group===x.key;
      const width=Math.max(1,Math.round(100*x.cents/max*100)/100);
      return '<button type="button" class="dbx-bar'+(active?' dbx-active':'')+'" data-dbx-action="'+type+'" data-dbx-key="'+esc(x.key)+'" aria-expanded="'+active+'">'+
        '<span class="dbx-name">'+esc(x.key)+'</span><span class="dbx-track"><span class="dbx-fill" style="width:'+width+'%"></span></span>'+
        '<strong class="dbx-money">'+brlCents(x.cents)+'</strong></button>';
    }).join('');
  }
  function localDetails(){
    const local=localGroups.find(x=>x.key===state.local);
    if(!local)return '';
    const groups=summarize(local.rows,r=>r.grupo);
    const group=groups.find(x=>x.key===state.group);
    return '<div class="dbx-details"><div class="dbx-detail-head"><div><h3>'+esc(local.key)+'</h3><p>'+number(local.records)+' baixas · '+brlCents(local.cents)+' · clique no grupo para ver os produtos</p></div>'+
      '<button data-dbx-action="close" type="button">Voltar aos locais</button></div><div class="dbx-groups">'+
      groups.map(g=>'<button type="button" data-dbx-action="local-group" data-dbx-key="'+esc(g.key)+'" class="dbx-group'+(g.key===state.group?' dbx-selected':'')+'">'+
        '<span>'+esc(g.key)+' <small>'+number(g.products.size)+' itens</small></span><b>'+brlCents(g.cents)+'</b></button>').join('')+'</div>'+
      (group?'<h4 class="dbx-section-title">Produtos · '+esc(group.key)+' · maior custo primeiro</h4>'+tableItems(group.rows,false):'')+'</div>';
  }
  function consolidatedDetails(){
    const group=allGroups.find(x=>x.key===state.group);
    if(!group)return '';
    const locals=summarize(group.rows,r=>r.local);
    return '<div class="dbx-details"><div class="dbx-detail-head"><div><h3>Grupo: '+esc(group.key)+'</h3><p>'+number(group.records)+' baixas · '+brlCents(group.cents)+' · '+number(locals.length)+' almoxarifados</p></div>'+
      '<button data-dbx-action="close" type="button">Voltar aos grupos</button></div>'+tableItems(group.rows,true)+
      '<h4 class="dbx-section-title">Distribuição por almoxarifado</h4><div class="dbx-groups">'+
      locals.map(l=>'<div class="dbx-group dbx-static"><span>'+esc(l.key)+'</span><b>'+brlCents(l.cents)+'</b></div>').join('')+'</div></div>';
  }
  function render(){
    if(!panel||!readSource())return;
    filtered=selected();const stat=totals(filtered);
    localGroups=summarize(filtered,r=>r.local);allGroups=summarize(filtered,r=>r.grupo);
    if(!localGroups.some(x=>x.key===state.local))state.local='';
    if(state.mode==='all'){if(!allGroups.some(x=>x.key===state.group))state.group='';}
    else if(state.local&&!localGroups.find(x=>x.key===state.local)?.rows.some(x=>x.grupo===state.group))state.group='';
    panel.innerHTML='<div class="dbx-head"><div><h2>Baixas conferidas no ERP</h2><p>Valores efetivos de <b>Custo_Total</b> por <b>data de negociação (Dt.Neg.)</b>, sem transferências e sem estimativas pelo custo do estoque.</p></div>'+
      '<label class="dbx-year">Período<select id="dbx-period"><option value="all">Todo o histórico · 2024 a 2026</option><option value="2025-2026">2025 + 2026</option><option value="2024">Somente 2024</option><option value="2025">Somente 2025</option><option value="2026">Somente 2026</option></select></label></div>'+
      '<div class="dbx-kpis"><div><small>Locais com baixas</small><strong>'+number(stat.locals.size)+'</strong></div>'+ 
      '<div><small>Posições movimentadas</small><strong>'+number(stat.products.size)+'</strong></div>'+ 
      '<div><small>Grupos movimentados</small><strong>'+number(stat.groups.size)+'</strong></div>'+ 
      '<div><small>Lançamentos ERP</small><strong>'+number(stat.records)+'</strong></div>'+ 
      '<div class="dbx-total"><small>Valor efetivo das baixas</small><strong>'+brlCents(stat.cents)+'</strong></div></div>'+ 
      '<div class="dbx-card"><div class="dbx-toolbar"><div><h3>'+(state.mode==='all'?'Baixas consolidadas por grupo':'Baixas por almoxarifado')+'</h3><p>Clique para abrir grupos e itens · valores ordenados do maior para o menor</p></div>'+ 
      '<div class="dbx-toggle"><button type="button" data-dbx-action="mode-local" class="'+(state.mode==='local'?'dbx-picked':'')+'">Por almoxarifado</button>'+ 
      '<button type="button" data-dbx-action="mode-all" class="'+(state.mode==='all'?'dbx-picked':'')+'">Todas as baixas juntas</button></div></div>'+ 
      '<div class="dbx-bars">'+(state.mode==='all'?bars(allGroups,'group'):bars(localGroups,'local'))+'</div>'+ 
      (state.mode==='all'?consolidatedDetails():localDetails())+'</div>'+ 
      '<p class="dbx-audit">Fonte: '+esc(source.meta.sourceFile)+' · histórico até 06/11/2026. '+
      '2024 é consultivo e <b>não entra no cálculo do estoque mínimo</b>. Estoque mínimo: 2025 e janeiro–outubro/2026, cobertura de 2 meses. '+
      'Dados financeiros reconciliados pelo Custo_Total do ERP. Os saldos físicos não são alterados nesta tela.</p>';
    panel.querySelector('#dbx-period').value=state.period;
    panel.querySelector('#dbx-period').addEventListener('change',ev=>{
      state.period=ev.target.value;state.local='';state.group='';state.item='';render();
    });
  }
  function install(){
    if(panel)return true;
    const view=document.getElementById('view-baixas'),P=window.MOVEMENTS_COMPLETE_20261103;
    if(!view||!P||!readSource())return false;
    const legacyBars=document.getElementById('barsBaixasLocais');
    const cards=view.querySelector('.cards'),legacyChart=legacyBars?.closest('.panel');
    if(!cards||!legacyChart)return false;
    const div=document.createElement('section');div.id=rootId;div.setAttribute('aria-label','Baixas ERP conferidas');
    const style=document.createElement('style');style.id='dbx-audit-styles';style.textContent=`
      #view-baixas .dbx-legacy-hidden{display:none!important}
      #${rootId}{margin:14px 0 16px;color:#194b30;font-family:inherit}
      #${rootId} *{box-sizing:border-box}
      #${rootId} .dbx-head{background:#fff;border:1px solid #d7e5da;border-left:4px solid #16733b;border-radius:12px;padding:15px 17px;display:flex;justify-content:space-between;gap:16px;align-items:center}
      #${rootId} h2{font-size:17px;margin:0 0 5px;color:#115830;font-weight:900}
      #${rootId} h3{font-size:14px;margin:0 0 5px;color:#115830;font-weight:900}
      #${rootId} p{font-size:11px;line-height:1.5;margin:0;color:#65796b}
      #${rootId} .dbx-year{display:block;min-width:240px;font-size:10px;font-weight:850;color:#536d5c}
      #${rootId} select{display:block;width:100%;margin-top:5px;padding:9px;border:1px solid #c9dfce;background:#fbfdfb;border-radius:8px;color:#125530;font-weight:800;font-size:12px}
      #${rootId} .dbx-kpis{display:grid;grid-template-columns:repeat(4,minmax(0,1fr)) minmax(190px,1.4fr);gap:10px;margin:12px 0}
      #${rootId} .dbx-kpis>div{padding:13px 12px;border:1px solid #d7e6dc;border-radius:12px;background:#fff;min-width:0;box-shadow:0 3px 15px #14371c09}
      #${rootId} .dbx-kpis small{display:block;text-transform:uppercase;font-size:9px;letter-spacing:.02em;font-weight:850;color:#6a7a6f;margin-bottom:6px}
      #${rootId} .dbx-kpis strong{display:block;font-size:21px;color:#0d512b;overflow-wrap:anywhere}
      #${rootId} .dbx-kpis .dbx-total{border-left:4px solid #f4c530}
      #${rootId} .dbx-kpis .dbx-total strong{font-size:18px}
      #${rootId} .dbx-card{background:#fff;border:1px solid #d7e5db;border-radius:14px;padding:14px 16px;overflow:hidden}
      #${rootId} .dbx-toolbar{display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;margin-bottom:15px}
      #${rootId} .dbx-toggle{display:inline-flex;align-items:center;border:1px solid #b5dac5;border-radius:9px;overflow:hidden}
      #${rootId} button{font:inherit;cursor:pointer}
      #${rootId} .dbx-toggle button{background:#f4f9f5;color:#17623b;border:0;padding:9px 12px;font-size:11px;font-weight:800}
      #${rootId} .dbx-toggle button+button{border-left:1px solid #c7dfcf}
      #${rootId} .dbx-toggle .dbx-picked{background:#146a3b;color:white}
      #${rootId} .dbx-bars{display:grid;gap:7px}
      #${rootId} .dbx-bar{display:grid;grid-template-columns:minmax(220px,31%) minmax(170px,1fr) minmax(105px,135px);align-items:center;gap:15px;padding:8px;border:1px solid transparent;background:transparent;border-radius:8px;text-align:left;width:100%}
      #${rootId} .dbx-bar:hover,#${rootId} .dbx-bar.dbx-active{background:#f1f8f3;border-color:#c7e1d0}
      #${rootId} .dbx-bar.dbx-active{background:#f1f8f3;border-color:#c7e1d0}
      #${rootId} .dbx-name{font-size:11px;color:#37493d;overflow-wrap:anywhere}
      #${rootId} .dbx-track{height:13px;border-radius:20px;background:#e9f0f5;overflow:hidden}
      #${rootId} .dbx-fill{display:block;height:100%;background:linear-gradient(90deg,#49b6ad,#078b84);border-radius:20px}
      #${rootId} .dbx-money{text-align:right;font-size:11px;white-space:nowrap;color:#214969}
      #${rootId} .dbx-details{margin-top:16px;background:#f8fbf9;border:1px solid #d9e9df;border-radius:11px;padding:15px}
      #${rootId} .dbx-detail-head{display:flex;justify-content:space-between;gap:12px;align-items:flex-start;margin-bottom:12px}
      #${rootId} .dbx-detail-head button{font-size:11px;font-weight:800;border:1px solid #b6d6c4;color:#156038;background:#ebf7ef;padding:8px 11px;border-radius:8px}
      #${rootId} .dbx-groups{display:grid;gap:7px}
      #${rootId} .dbx-group{display:flex;align-items:center;justify-content:space-between;gap:12px;border:1px solid #d4e3d9;border-radius:9px;background:white;padding:11px 13px;color:#195331;text-align:left;font-size:12px}
      #${rootId} .dbx-group b{white-space:nowrap}
      #${rootId} .dbx-group small{font-size:10px;color:#7a897f;margin-left:8px}
      #${rootId} .dbx-group:hover,#${rootId} .dbx-group.dbx-selected{background:#eef8f2;border-color:#9eceb0}
      #${rootId} .dbx-section-title{font-size:13px;margin:16px 0 10px;color:#135732}
      #${rootId} .dbx-scroll{overflow:auto;max-height:500px;border:1px solid #e0eae2;border-radius:8px}
      #${rootId} .dbx-table{width:100%;min-width:800px;border-collapse:collapse;font-size:11px;background:white}
      #${rootId} .dbx-table th{position:sticky;top:0;text-align:left;background:#17613b;color:white;font-size:10px;padding:10px 8px;white-space:nowrap}
      #${rootId} .dbx-table td{padding:10px 8px;border-bottom:1px solid #e9efeb}
      #${rootId} .dbx-table .dbx-num{text-align:right;white-space:nowrap}
      #${rootId} .dbx-table .dbx-value{font-weight:800;color:#145f35}
      #${rootId} .dbx-muted{padding:15px 2px}
      #${rootId} .dbx-audit{margin-top:11px;padding:12px 14px;background:#f7fbf8;border:1px solid #dcece0;border-left:3px solid #1a8a4a;border-radius:8px}
      #${rootId} button:focus-visible{outline:3px solid #d5a80d;outline-offset:2px}
      @media(max-width:1100px){#${rootId} .dbx-kpis{grid-template-columns:repeat(3,minmax(0,1fr))}#${rootId} .dbx-bar{grid-template-columns:minmax(160px,35%) minmax(120px,1fr) minmax(100px,125px);gap:8px}}
      @media(max-width:700px){#${rootId} .dbx-head{flex-direction:column;align-items:stretch}#${rootId} .dbx-year{min-width:0}#${rootId} .dbx-kpis{grid-template-columns:repeat(2,minmax(0,1fr))}#${rootId} .dbx-kpis .dbx-total{grid-column:1/-1}#${rootId} .dbx-bar{grid-template-columns:minmax(0,1fr) minmax(90px,120px);gap:8px}#${rootId} .dbx-track{grid-row:2;grid-column:1/-1}#${rootId} .dbx-money{grid-column:2;grid-row:1}}
    `;
    document.head.appendChild(style);
    const summary=document.getElementById('baixas-snapshot-2024-2026');
    if(summary?.parentElement===view)summary.after(div);else view.insertBefore(div,cards);
    [cards,legacyChart,document.getElementById('movementDrilldownPanel')].filter(Boolean).forEach(x=>x.classList.add('dbx-legacy-hidden'));
    const legacyNotice=[...view.querySelectorAll('.notice')].find(x=>x.textContent.includes('Leitura das baixas:'));
    if(legacyNotice)legacyNotice.classList.add('dbx-legacy-hidden');
    panel=div;
    panel.addEventListener('click',event=>{
      const btn=event.target.closest('button[data-dbx-action]');if(!btn||!panel.contains(btn))return;
      const action=btn.dataset.dbxAction,key=btn.dataset.dbxKey||'';
      if(action==='mode-local'||action==='mode-all'){
        state.mode=action==='mode-all'?'all':'local';state.local='';state.group='';
      }else if(action==='local'){
        state.local=state.local===key?'':key;state.group='';
      }else if(action==='group'||action==='local-group'){
        state.group=state.group===key?'':key;
      }else if(action==='close'){
        state.local='';state.group='';
      }
      render();
    });
    ['fEmpresa','fLocal','fGrupo','fUn','fBusca'].forEach(id=>{
      const input=document.getElementById(id);if(input){input.addEventListener('change',render);if(id==='fBusca')input.addEventListener('input',render)}
    });
    window.DB_BAIXAS_ERP_CONFERIDO={getMeta:()=>({dateBasis:'Dt.Neg.',records:source.meta.records,cents:Math.round(source.meta.value*100),period:state.period,
       filteredRecords:totals(filtered).records,filteredCents:totals(filtered).cents,localCount:totals(filtered).locals.size}),refresh:render,setPeriod:p=>{if(periodSet[p]){state.period=p;state.local='';state.group='';render()}}};
    render();return true;
  }
  if(!install()){
    document.addEventListener('DOMContentLoaded',install,{once:true});
    window.addEventListener('dashboard-ready',install);
    window.addEventListener('movements-updated',install);
    window.addEventListener('stock-position-updated',install);
  }
})();