// Cascata da tabela "Onde existe cada produto e referencia de precos".
// Almoxarifado -> grupo -> itens, sem alterar estoque ou custo do ERP.
(function(){
'use strict';
if(window.DB_STOCK_LOCATION_CASCADE)return;
const norm=x=>String(x??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toUpperCase().replace(/\s+/g,' ').trim();
const str=x=>String(x??'');
const esc=x=>str(x).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const val=x=>Number(x)||0;
const money=x=>new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(val(x));
const integer=x=>new Intl.NumberFormat('pt-BR',{maximumFractionDigits:0}).format(val(x));
const qty=x=>new Intl.NumberFormat('pt-BR',{maximumFractionDigits:3}).format(val(x));
const sortBR=(a,b)=>str(a).localeCompare(str(b),'pt-BR');
const state={local:'',group:'',product:'',text:'',openLoc:new Set(),openGroup:new Set(),
  showMore:new Map(),initial:false,installed:false,source:[],sourceTick:0};
const getKey=x=>str(x.codigo)+'|'+str(x.un||'')+'|'+str(x.produto||'');
const dollars=x=>val(x.valor_estoque);
let view=null,legacyPanel=null,section=null,timer=0;
const style=document.createElement('style');style.id='db-stock-cascade-style';style.textContent=[
'#view-estoque .dbsc-panel{border:1px solid #d9e7dc;background:#fff;border-radius:13px;overflow:hidden;margin:11px 0}',
'#view-estoque .dbsc-head{display:flex;justify-content:space-between;align-items:center;gap:12px;padding:14px 16px;background:#f7faf8;border-bottom:1px solid #dce9df;flex-wrap:wrap}',
'#view-estoque .dbsc-head h2{font-size:14px;color:#145e32;margin:0}',
'#view-estoque .dbsc-count{font-size:11px;color:#5e7567}',
'#view-estoque .dbsc-filter{padding:12px 14px;display:flex;align-items:end;gap:10px;flex-wrap:wrap;border-bottom:1px solid #e0eae2}',
'#view-estoque .dbsc-filter label{display:flex;flex-direction:column;gap:5px;font-size:10px;font-weight:bold;color:#1d5b35;flex:1;min-width:160px}',
'#view-estoque .dbsc-filter select,#view-estoque .dbsc-filter input{width:100%;min-height:35px;border:1px solid #c1d6c6;border-radius:7px;color:#2d4f37;background:#fff;padding:7px;font-size:11px}',
'#view-estoque .dbsc-btn{border:1px solid #bddac5;border-radius:7px;background:#edf7f0;color:#185f36;padding:9px 12px;cursor:pointer;font-size:11px;font-weight:bold}',
'#view-estoque .dbsc-btn:hover{background:#e0f1e5}',
'#view-estoque .dbsc-list{padding:11px 13px}',
'#view-estoque .dbsc-warehouse{border:1px solid #d9e6dd;border-radius:9px;overflow:hidden;margin-bottom:9px}',
'#view-estoque .dbsc-warehouse-toggle{background:#f2f8f4;color:#1a5c35;border:0;width:100%;padding:14px 15px;cursor:pointer;display:flex;justify-content:space-between;align-items:center;gap:12px;text-align:left;flex-wrap:wrap}',
'#view-estoque .dbsc-warehouse-toggle[aria-expanded=true]{background:#e7f4ea;border-bottom:1px solid #cddfd1}',
'#view-estoque .dbsc-warehouse-toggle:hover,#view-estoque .dbsc-group-toggle:hover{background:#e7f2e9}',
'#view-estoque .dbsc-key{font-size:12px;font-weight:850;color:#175b32}',
'#view-estoque .dbsc-minor{display:flex;flex-wrap:wrap;gap:13px;font-size:10px;color:#567660;align-items:center}',
'#view-estoque .dbsc-minor b{font-size:13px;color:#125f33}',
'#view-estoque .dbsc-groups{padding:10px}',
'#view-estoque .dbsc-group{border:1px solid #e0e9e1;border-radius:7px;margin:7px 0;overflow:hidden}',
'#view-estoque .dbsc-group-toggle{border:0;background:#fcfdfc;cursor:pointer;text-align:left;display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap;width:100%;padding:11px 14px}',
'#view-estoque .dbsc-group-toggle[aria-expanded=true]{background:#edf7f0;border-bottom:1px solid #d3e7d8}',
'#view-estoque .dbsc-group-toggle strong{color:#185b34;font-size:11px}',
'#view-estoque .dbsc-scroll{overflow-x:auto;max-height:455px;overflow-y:auto}',
'#view-estoque .dbsc-scroll table{border-collapse:collapse;width:100%;min-width:1090px;font-size:10px}',
'#view-estoque .dbsc-scroll th,#view-estoque .dbsc-scroll td{padding:9px 8px;border-bottom:1px solid #e7eee9;text-align:left}',
'#view-estoque .dbsc-scroll th{background:#13502f;color:white;position:sticky;top:0;z-index:1;white-space:nowrap}',
'#view-estoque .dbsc-scroll tbody tr:hover{background:#f5faf6}',
'#view-estoque .dbsc-scroll td.num{text-align:right;white-space:nowrap}',
'#view-estoque .dbsc-scroll td.product{min-width:230px}',
'#view-estoque .dbsc-footer{display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap;padding:10px 12px;color:#648171;font-size:10px}',
'#view-estoque .dbsc-empty{padding:24px;text-align:center;color:#7a8d7f}',
'#view-estoque .dbsc-explain{padding:11px 15px;color:#697d6e;font-size:10px;border-top:1px solid #e6eee9;line-height:1.6}',
'@media(max-width:680px){#view-estoque .dbsc-filter label{min-width:100%}#view-estoque .dbsc-minor{width:100%}}'
].join('');
document.head.appendChild(style);

function getSource(){
  try {
    if(typeof stockFiltered==='function'){
      const source=stockFiltered();
      if(Array.isArray(source))return source;
    }
  }catch(e){console.warn('[stock cascade] original filter unavailable',e)}
  if(typeof STOCK!=='undefined'&&Array.isArray(STOCK)){
    const get=id=>document.getElementById(id)?.value||'';
    const e=norm(get('fEmpresa')),l=get('fLocal'),g=get('fGrupo'),u=get('fUn'),f=norm(get('fFornecedor')),q=norm(get('fBusca'));
    return STOCK.filter(x=>(!e||norm(x.empresa).includes(e))&&(!l||x.local===l)&&
      (!g||x.grupo===g)&&(!u||x.un===u)&&(!f||norm(x.forn_min).includes(f))&&
      (!q||norm(x.produto+' '+x.codigo+' '+x.grupo+' '+x.local).includes(q)));
  }
  return [];
}
function selectOptions(id,items,label,selected,text){
  const control=section.querySelector(id);if(!control)return;
  const options='<option value="">'+esc(label)+'</option>'+items.map(x=>
    '<option value="'+esc(x)+'"'+(selected===x?' selected':'')+'>'+esc(text?text(x):x)+'</option>').join('');
  if(control.innerHTML!==options)control.innerHTML=options;
  control.value=selected;
}
function groupRows(rows,selector){
  const map=new Map();
  for(const x of rows){
    const id=selector(x)||'SEM IDENTIFICAÇÃO';
    let item=map.get(id);
    if(!item){item={id,rows:[],value:0};map.set(id,item)}
    item.rows.push(x);item.value+=dollars(x);
  }
  return [...map.values()].sort((a,b)=>b.value-a.value||sortBR(a.id,b.id));
}
const groupId=(local,group)=>local+'|'+group;
function tableRow(x){
  return '<tr><td>'+esc(x.empresa||'—')+'</td><td>'+esc(x.codigo)+'</td>'+
    '<td class="product">'+esc(x.produto)+'</td><td>'+esc(x.un||'—')+'</td>'+
    '<td class="num">'+qty(x.estoque)+'</td><td class="num">'+money(x.custo_estoque)+'</td>'+
    '<td class="num">'+money(x.valor_estoque)+'</td>'+
    '<td class="num">'+(val(x.min_preco)>0?money(x.min_preco):'—')+'</td>'+
    '<td>'+esc(x.forn_min||'—')+'</td></tr>';
}
function paint(){
  if(!section||!section.isConnected)return;
  const all=getSource();
  state.source=all;
  const locals=[...new Set(all.map(x=>x.local||'SEM ALMOXARIFADO'))].sort(sortBR);
  if(state.local&&!locals.includes(state.local)){state.local='';state.group='';state.product=''}
  selectOptions('#dbsc-local',locals,'Todos os almoxarifados',state.local);
  const localRows=all.filter(x=>!state.local||x.local===state.local);
  const groupNames=[...new Set(localRows.map(x=>x.grupo||'SEM GRUPO'))].sort(sortBR);
  if(state.group&&!groupNames.includes(state.group)){state.group='';state.product=''}
  selectOptions('#dbsc-group',groupNames,'Todos os grupos',state.group);
  const groupData=localRows.filter(x=>!state.group||(x.grupo||'SEM GRUPO')===state.group);
  const productsMap=new Map();
  for(const row of groupData)productsMap.set(getKey(row),str(row.codigo)+' · '+str(row.produto)+' ('+str(row.un)+')');
  const productKeys=[...productsMap.keys()].sort((a,b)=>sortBR(productsMap.get(a),productsMap.get(b)));
  if(state.product&&!productsMap.has(state.product))state.product='';
  selectOptions('#dbsc-product',productKeys,'Todos os produtos',state.product,id=>productsMap.get(id));
  const needle=norm(state.text);
  const filtered=groupData.filter(x=>(!state.product||getKey(x)===state.product)&&
    (!needle||norm(x.codigo+' '+x.produto+' '+x.local+' '+x.grupo).includes(needle)));
  const warehouses=groupRows(filtered,x=>x.local||'SEM ALMOXARIFADO');
  if(!state.initial){
    if(warehouses.length)state.openLoc.add(warehouses[0].id);
    state.initial=true;
  }
  if(state.local)state.openLoc.add(state.local);
  if(state.local&&state.group)state.openGroup.add(groupId(state.local,state.group));
  const count=section.querySelector('#dbsc-count');
  if(count)count.textContent=integer(filtered.length)+' de '+integer(all.length)+' posições · '+money(filtered.reduce((sum,x)=>sum+dollars(x),0));
  const markup=warehouses.map(loc=>{
    const expanded=state.openLoc.has(loc.id);
    const grouped=expanded?groupRows(loc.rows,x=>x.grupo||'SEM GRUPO'):[];
    const groupsHtml=grouped.map(gr=>{
      const id=groupId(loc.id,gr.id),open=state.openGroup.has(id);
      const rows=open?gr.rows.slice().sort((a,b)=>dollars(b)-dollars(a)||sortBR(a.produto,b.produto)):[];
      const limit=state.showMore.get(id)||120,shown=open?rows.slice(0,limit):[];
      const th='<thead><tr><th>Empresa fiscal</th><th>Código</th><th>Produto</th><th>UN</th>'+
        '<th>Estoque</th><th>Custo estoque</th><th>Valor estoque</th><th>Menor preço</th><th>Fornecedor menor</th></tr></thead>';
      const body=open?'<div class="dbsc-scroll"><table>'+th+'<tbody>'+shown.map(tableRow).join('')+
        '</tbody></table></div><div class="dbsc-footer"><span>Exibindo '+integer(shown.length)+' de '+integer(rows.length)+
        ' posições do grupo</span>'+(shown.length<rows.length?'<button class="dbsc-btn" type="button" data-dbsc-more="'+esc(id)+
        '">Mostrar mais 120</button>':'')+'</div>':'';
      return '<section class="dbsc-group"><button class="dbsc-group-toggle" type="button" data-dbsc-group="'+esc(id)+
        '" aria-expanded="'+(open?'true':'false')+'"><strong>'+(open?'▾':'▸')+' '+esc(gr.id)+'</strong>'+
        '<span class="dbsc-minor"><span>'+integer(gr.rows.length)+' itens</span>'+
        '<b>'+money(gr.value)+'</b></span></button>'+body+'</section>';
    }).join('');
    return '<section class="dbsc-warehouse"><button class="dbsc-warehouse-toggle" type="button" data-dbsc-loc="'+esc(loc.id)+
      '" aria-expanded="'+(expanded?'true':'false')+'"><span class="dbsc-key">'+(expanded?'▾':'▸')+' '+esc(loc.id)+'</span>'+
      '<span class="dbsc-minor"><span>'+integer(loc.rows.length)+' posições</span><b>'+money(loc.value)+'</b></span></button>'+
      (expanded?'<div class="dbsc-groups">'+groupsHtml+'</div>':'')+'</section>';
  }).join('');
  section.querySelector('#dbsc-list').innerHTML=markup||'<div class="dbsc-empty">Nenhum produto encontrado com os filtros selecionados.</div>';
  window.DB_STOCK_LOCATION_CASCADE.meta={
    rows:all.length,visiblePositions:filtered.length,visibleValue:filtered.reduce((sum,x)=>sum+dollars(x),0),
    warehouses:warehouses.length,groupCount:warehouses.reduce((v,w)=>v+new Set(w.rows.map(x=>x.grupo||'SEM GRUPO')).size,0),
    selectedLocal:state.local,selectedGroup:state.group,selectedProduct:state.product,
    viewLevels:['Almoxarifado','Grupo','Produto'],sort:'valor_estoque_desc',
    preservedFields:['empresa','codigo','produto','un','estoque','custo_estoque','valor_estoque','min_preco','forn_min']
  };
}
function mount(){
  view=document.querySelector('#view-estoque');if(!view)return false;
  const headings=[...view.querySelectorAll('h2,h3')];
  // Evitar selecionar nosso proprio titulo quando mount() for chamado novamente.
  // Caso contrario a cascata se esconderia ao tentar ocultar a tabela antiga.
  const header=headings.find(h=>!h.closest('#db-stock-cascade')&&
    norm(h.textContent).includes('ONDE EXISTE CADA PRODUTO E REFERENCIA DE PRECOS'));
  if(!header)return false;
  const panel=header.closest('.tablepanel')||header.closest('.panel');
  if(!panel)return false;
  legacyPanel=panel;
  if(!section||!section.isConnected){
    section=document.createElement('section');section.id='db-stock-cascade';section.className='dbsc-panel tablepanel';
    section.innerHTML='<div class="dbsc-head"><h2>Onde existe cada produto e referência de preços</h2>'+
      '<span class="dbsc-count" id="dbsc-count"></span></div>'+
      '<div class="dbsc-filter"><label>1. Almoxarifado<select id="dbsc-local"><option value="">Todos os almoxarifados</option></select></label>'+
      '<label>2. Grupo<select id="dbsc-group"><option value="">Todos os grupos</option></select></label>'+
      '<label>3. Produto<select id="dbsc-product"><option value="">Todos os produtos</option></select></label>'+
      '<label>Busca complementar<input id="dbsc-search" type="search" placeholder="Código ou descrição"></label>'+
      '<button type="button" class="dbsc-btn" id="dbsc-clear">Limpar filtros</button></div>'+
      '<div id="dbsc-list" class="dbsc-list"></div>'+
      '<div class="dbsc-explain">Abra um almoxarifado para ver os grupos; abra o grupo para consultar os produtos. '+
      'Valores e referências preservados da posição ERP. Grupos e itens ordenados pelo maior valor em estoque. '+
      'Os filtros gerais da plataforma continuam valendo.</div>';
    panel.parentNode.insertBefore(section,panel);
    section.querySelector('#dbsc-local').addEventListener('change',e=>{
      state.local=e.target.value;state.group='';state.product='';state.openLoc.clear();state.openGroup.clear();
      if(state.local)state.openLoc.add(state.local);paint();
    });
    section.querySelector('#dbsc-group').addEventListener('change',e=>{
      state.group=e.target.value;state.product='';state.openGroup.clear();
      if(state.group){
        const targets=state.local?[state.local]:[...new Set(state.source.filter(x=>x.grupo===state.group).map(x=>x.local))];
        for(const target of targets){state.openLoc.add(target);state.openGroup.add(groupId(target,state.group))}
      }
      paint();
    });
    section.querySelector('#dbsc-product').addEventListener('change',e=>{state.product=e.target.value;
      if(state.product)for(const x of state.source.filter(x=>getKey(x)===state.product)){
        state.openLoc.add(x.local);state.openGroup.add(groupId(x.local,x.grupo||'SEM GRUPO'));
      }
      paint();
    });
    section.querySelector('#dbsc-search').addEventListener('input',e=>{state.text=e.target.value;paint()});
    section.querySelector('#dbsc-clear').addEventListener('click',()=>{
      state.local='';state.group='';state.product='';state.text='';
      state.openLoc.clear();state.openGroup.clear();state.initial=false;
      section.querySelector('#dbsc-search').value='';paint();
    });
    section.addEventListener('click',e=>{
      const l=e.target.closest('[data-dbsc-loc]');if(l){
        const id=l.dataset.dbscLoc;if(state.openLoc.has(id))state.openLoc.delete(id);else state.openLoc.add(id);
        paint();return;
      }
      const g=e.target.closest('[data-dbsc-group]');if(g){
        const id=g.dataset.dbscGroup;if(state.openGroup.has(id))state.openGroup.delete(id);else state.openGroup.add(id);
        paint();return;
      }
      const b=e.target.closest('[data-dbsc-more]');if(b){
        const id=b.dataset.dbscMore;state.showMore.set(id,(state.showMore.get(id)||120)+120);
        paint();
      }
    });
  }
  panel.style.display='none';
  return true;
}
function refresh(){
  if(mount())paint();
}
let attempts=0;
function initialize(){
  if(mount()){refresh();return}
  if(attempts++<12)setTimeout(initialize,200);
}
for(const id of ['fEmpresa','fLocal','fGrupo','fUn','fFornecedor','fBusca']){
  const control=document.getElementById(id);
  if(control){control.addEventListener('change',()=>setTimeout(refresh,0));
    if(control.tagName==='INPUT')control.addEventListener('input',()=>setTimeout(refresh,0))}
}
document.addEventListener('click',e=>{
  if(e.target.closest('.tab[data-view="estoque"],.clean-sub-btn[data-view="estoque"]'))setTimeout(refresh,30);
},true);
for(const event of ['stock-position-updated','purchase-updated','stocks-updated'])window.addEventListener(event,()=>setTimeout(refresh,0));
window.DB_STOCK_LOCATION_CASCADE={refresh,meta:null,version:'20261112-where-stock-local-group-product-v1'};
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',initialize,{once:true});else initialize();
})();
