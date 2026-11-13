// Controle de custos - fontes e propostas para conferencia, sem alterar o ERP.
(function(){
'use strict';
if(window.DB_COST_UPDATE || document.documentElement.dataset.dbPilot==='1')return;
const tabs=document.querySelector('.tabs'), root=document.querySelector('.wrap');
if(!tabs||!root)return;
const tab=document.createElement('button');
tab.type='button';tab.className='tab';tab.dataset.view='atualizacao-custos';
tab.textContent='Atualização de Custos';tabs.appendChild(tab);
const view=document.createElement('section');
view.id='view-atualizacao-custos';view.className='view';root.appendChild(view);
const norm=x=>String(x??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toUpperCase().trim();
const str=x=>String(x??'');
const esc=x=>str(x).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const number=x=>Number(x)||0;
const money=new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL',minimumFractionDigits:2,maximumFractionDigits:4});
const whole=new Intl.NumberFormat('pt-BR',{maximumFractionDigits:0});
const totalMoney=new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL',minimumFractionDigits:2,maximumFractionDigits:2});
const fmt=x=>x==null||!Number.isFinite(Number(x))?'—':money.format(Number(x));
const fmtTotal=x=>totalMoney.format(number(x));
const dateKey=x=>{const s=str(x);return /^\d{2}\/\d{2}\/\d{4}$/.test(s)?s.slice(6)+s.slice(3,5)+s.slice(0,2):s};
const storageKey='db-cost-update-drafts-v1';
const state={local:'',group:'',product:'',query:'',only:'all',page:0};
const expandedGroups=new Set(),expandedProducts=new Set();
const productKey=r=>JSON.stringify([r.group,r.code,r.unit]);
let records=[],known=new Map(),editing=null,loaded=false,dirty=true;
let drafts=[];
try{const saved=JSON.parse(localStorage.getItem(storageKey)||'[]');if(Array.isArray(saved))drafts=saved.filter(x=>x&&x.code&&x.unit&&x.scope&&x.proposed>0).slice(0,2000)}catch(_){}
const style=document.createElement('style');
style.textContent=[
'#view-atualizacao-custos{font:12px Arial,Helvetica,sans-serif;color:#234a34;padding:0 0 28px}',
'#view-atualizacao-custos *{box-sizing:border-box}',
'#view-atualizacao-custos .cu-head{padding:22px;border-radius:12px;border-bottom:4px solid #e5bd1c;background:linear-gradient(110deg,#0d4728,#177240);color:white}',
'#view-atualizacao-custos .cu-head h2{font-size:22px;margin:0 0 8px;color:white}',
'#view-atualizacao-custos .cu-head p{margin:0;line-height:1.55;color:#e6f4e9}',
'#view-atualizacao-custos .cu-note{padding:12px 14px;border:1px solid #e1d5a8;background:#fff9eb;border-radius:9px;margin:13px 0;line-height:1.6;color:#765918}',
'#view-atualizacao-custos .cu-card{border:1px solid #dce8df;border-radius:10px;background:#fff;margin:13px 0;padding:15px}',
'#view-atualizacao-custos .cu-stats{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:8px;margin:13px 0}',
'#view-atualizacao-custos .cu-stat{background:#fff;border:1px solid #dbe8dd;border-radius:9px;padding:13px;min-width:0}',
'#view-atualizacao-custos .cu-stat small{display:block;color:#688270;line-height:1.45;min-height:29px}',
'#view-atualizacao-custos .cu-stat strong{display:block;font-size:21px;color:#135f36;margin-top:6px}',
'#view-atualizacao-custos .cu-fields{display:flex;flex-wrap:wrap;gap:11px;align-items:flex-end}',
'#view-atualizacao-custos .cu-fields label{display:flex;flex-direction:column;gap:5px;font-weight:700;font-size:11px;flex:1;min-width:145px}',
'#view-atualizacao-custos .cu-fields label.wide{flex:2;min-width:220px}',
'#view-atualizacao-custos input,#view-atualizacao-custos select,#view-atualizacao-custos textarea{width:100%;min-height:35px;border:1px solid #bed1c4;background:#fff;border-radius:6px;padding:8px;font:12px Arial;color:#204d30}',
'#view-atualizacao-custos textarea{min-height:54px;resize:vertical}',
'#view-atualizacao-custos button.cu-btn{border:1px solid #abceb7;border-radius:7px;padding:9px 12px;background:#edf7ef;color:#1a6639;font:700 11px Arial;cursor:pointer}',
'#view-atualizacao-custos button.cu-btn.primary{background:#157341;color:white;border-color:#157341}',
'#view-atualizacao-custos button.cu-btn:disabled{opacity:.55;cursor:not-allowed}',
'#view-atualizacao-custos .cu-buttons{display:flex;flex-wrap:wrap;gap:8px;margin-top:13px;align-items:center}',
'#view-atualizacao-custos h3{color:#155c34;margin:0 0 12px;font-size:15px}',
'#view-atualizacao-custos .cu-scroll{overflow:auto;max-height:455px;border:1px solid #dfe9e1;border-radius:8px}',
'#view-atualizacao-custos table{border-collapse:collapse;width:100%;min-width:1070px;font-size:11px}',
'#view-atualizacao-custos th{background:#eaf5ed;color:#165431;position:sticky;top:0;z-index:1;text-align:left;padding:10px 9px;white-space:nowrap}',
'#view-atualizacao-custos td{padding:10px 9px;border-bottom:1px solid #edf2ee;vertical-align:top;line-height:1.4}',
'#view-atualizacao-custos td.num{text-align:right;white-space:nowrap}',
'#view-atualizacao-custos td .light{color:#76887c;font-size:10px}',
'#view-atualizacao-custos .cu-pagination{display:flex;align-items:center;gap:11px;justify-content:flex-end;flex-wrap:wrap;margin-top:11px}',
'#view-atualizacao-custos .cu-hint{color:#637a6b;font-size:11px;line-height:1.55;margin:9px 0 0}',
'#view-atualizacao-custos .cu-drafts{margin-top:20px}',
'#view-atualizacao-custos .cu-message{margin:10px 0 0;color:#235b38;font-weight:700;line-height:1.5}',
'#view-atualizacao-custos .cu-message.error{color:#a63b31}',
'#view-atualizacao-custos .cu-source{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:9px;margin:12px 0}',
'#view-atualizacao-custos .cu-source>div{background:#f7faf7;border:1px solid #dfe9df;padding:12px;border-radius:8px;line-height:1.5}',
'#view-atualizacao-custos .cu-source small{display:block;color:#657b69}',
'#view-atualizacao-custos .cu-source strong{display:block;color:#1a6038;font-size:16px;margin:4px 0}',
'#view-atualizacao-custos .cu-edit[hidden]{display:none}',
'#view-atualizacao-custos .cu-tree-tools{display:flex;flex-wrap:wrap;gap:8px;justify-content:space-between;align-items:center;margin:13px 0 10px}',
'#view-atualizacao-custos .cu-tree-tools strong{font-size:12px;color:#235d39}',
'#view-atualizacao-custos .cu-tree{display:flex;flex-direction:column;gap:9px;max-height:610px;overflow:auto;padding:3px 3px 10px}',
'#view-atualizacao-custos .cu-tree > .cu-group{flex:0 0 auto;min-height:0}',
'#view-atualizacao-custos .cu-group{border:1px solid #d1e2d7;border-radius:10px;background:#fff;overflow:hidden}',
'#view-atualizacao-custos .cu-node{display:flex;width:100%;height:auto;min-height:52px;align-items:center;justify-content:space-between;gap:13px;text-align:left;border:0;cursor:pointer;color:#194d2e;font:700 12px/1.4 Arial;background:#f5faf6;padding:13px 14px}',
'#view-atualizacao-custos .cu-node:hover{background:#eaf5ed}',
'#view-atualizacao-custos .cu-node:focus-visible{outline:3px solid #e5bd1c;outline-offset:-3px}',
'#view-atualizacao-custos .cu-node-left{display:flex;gap:9px;align-items:center;min-width:0}',
'#view-atualizacao-custos .cu-node-left .cu-arrow{width:15px;flex-shrink:0;font-size:13px;color:#13743d}',
'#view-atualizacao-custos .cu-node-label{display:flex;flex-direction:column;gap:4px;min-width:0}',
'#view-atualizacao-custos .cu-node-label small{font-size:10px;font-weight:400;color:#668470}',
'#view-atualizacao-custos .cu-node-value{white-space:nowrap;font-size:13px;color:#0e6036}',
'#view-atualizacao-custos .cu-group-products{padding:8px 10px 12px;background:#fbfdfb;display:flex;flex-direction:column;gap:7px}',
'#view-atualizacao-custos .cu-group-products > .cu-product{flex:0 0 auto}',
'#view-atualizacao-custos .cu-product{border:1px solid #e2ebe5;border-radius:8px;overflow:hidden;background:white}',
'#view-atualizacao-custos .cu-product .cu-node{background:white;padding:10px 12px;font-size:11px;min-height:48px}',
'#view-atualizacao-custos .cu-product .cu-node:hover{background:#f1f8f3}',
'#view-atualizacao-custos .cu-product .cu-node-value{font-size:12px}',
'#view-atualizacao-custos .cu-details-scroll{overflow:auto;max-height:340px;border-top:1px solid #e3ece5}',
'#view-atualizacao-custos .cu-details-scroll table{min-width:1020px}',
'#view-atualizacao-custos .cu-tree-empty{background:#f9fcfa;padding:25px;border:1px solid #dce8df;border-radius:8px;text-align:center;color:#697e70}',
'@media(max-width:920px){#view-atualizacao-custos .cu-stats{grid-template-columns:repeat(3,minmax(0,1fr))}#view-atualizacao-custos .cu-source{grid-template-columns:1fr}}',
'@media(max-width:600px){#view-atualizacao-custos .cu-stats{grid-template-columns:repeat(2,minmax(0,1fr))}}'
].join('\n');
document.head.appendChild(style);
view.innerHTML=[
'<header class="cu-head"><h2>Atualização de Custos</h2>',
'<p>Confira qual preço está sendo usado em cada análise: <b>custo do estoque ERP</b>, <b>última compra por nota fiscal</b> e <b>maior referência gerencial da Tabela Custo</b>.</p></header>',
'<div class="cu-note"><b>Controle de alterações:</b> os novos valores lançados aqui ficam como <b>propostas pendentes de conferência, salvas somente neste navegador</b>. Não modificam o Sankhya, o estoque físico, a Tabela Custo ou os indicadores de economia. Exporte o CSV para auditar e incorporar as correções aprovadas à base oficial.</div>',
'<div id="cu-stats" class="cu-stats" aria-live="polite"></div>',
'<section class="cu-card"><h3>Filtro em cascata · Grupo → Produto → Almoxarifado</h3><div class="cu-fields">',
'<label>1. Grupo (maior valor primeiro)<select id="cu-group"></select></label>',
'<label>2. Produto (maior valor primeiro)<select id="cu-product"></select></label>',
'<label>Almoxarifado (opcional)<select id="cu-local"></select></label>',
'<label class="wide">Busca adicional<input id="cu-search" type="search" placeholder="Código, descrição, nota ou fornecedor"></label>',
'<label>Situação<select id="cu-only"><option value="all">Todos</option><option value="noref">Sem Tabela Custo</option><option value="draft">Com proposta pendente</option></select></label>',
'</div><div class="cu-buttons"><button id="cu-clear" class="cu-btn" type="button">Limpar filtros</button>',
'<button id="cu-export-reference" class="cu-btn" type="button">Exportar custos consultados (CSV)</button>',
'<button id="cu-template" class="cu-btn" type="button">Baixar modelo de atualização</button></div>',
'<p class="cu-hint"><b>Critério de ordenação:</b> valor total do estoque físico no ERP (saldo × custo unitário). Grupos e produtos sem estoque físico ficam ao final. O custo unitário e a referência gerencial permanecem visíveis para conferência.</p>',
'<p class="cu-hint" id="cu-asof">Os preços de compras são conferidos por código e unidade; a Tabela Custo pode não identificar a unidade na fonte original. Custos de estoque e compras não devem ser substituídos automaticamente pelo maior preço.</p>',
'<p class="cu-hint"><b>Como consultar:</b> clique no grupo para abrir os produtos em ordem de maior valor. Clique no produto para conferir cada almoxarifado, o custo ERP, a última compra e a referência gerencial.</p>',
'<div class="cu-tree-tools"><strong id="cu-count" aria-live="polite">Carregando grupos...</strong>',
'<div class="cu-buttons" style="margin:0"><button type="button" class="cu-btn" id="cu-expand-groups">Abrir todos os grupos</button>',
'<button type="button" class="cu-btn" id="cu-collapse-all">Recolher tudo</button></div></div>',
'<div id="cu-rows" class="cu-tree" aria-label="Grupos, produtos e almoxarifados ordenados por valor em estoque"></div></section>',
'<section class="cu-card cu-edit" id="cu-edit" hidden><h3>Registrar proposta de correção</h3>',
'<p id="cu-selected" class="cu-hint"></p><div id="cu-sources" class="cu-source"></div>',
'<div class="cu-fields">',
'<label>Campo a revisar<select id="cu-scope"><option value="GERENCIAL">Referência da Tabela Custo</option><option value="ESTOQUE_ERP">Custo unitário do estoque ERP</option></select></label>',
'<label>Valor vigente (R$/un.)<input id="cu-current" type="text" readonly></label>',
'<label>Novo valor proposto (R$/un.)<input id="cu-price" type="text" inputmode="decimal" placeholder="Ex.: 24,235"></label>',
'<label>Data do documento<input id="cu-date" type="date"></label>',
'<label class="wide">Documento de origem / nota fiscal<input id="cu-document" type="text" maxlength="150" placeholder="Ex.: Tabela Custo, linha 182 / NF 123456"></label>',
'<label class="wide">Justificativa da alteração<textarea id="cu-reason" maxlength="700" placeholder="Ex.: custo lançado incorretamente; valor confirmado no ERP"></textarea></label>',
'</div><div class="cu-buttons"><button class="cu-btn primary" id="cu-save" type="button">Salvar proposta para conferência</button>',
'<button class="cu-btn" id="cu-cancel" type="button">Cancelar</button></div>',
'<p id="cu-feedback" class="cu-message" role="status"></p></section>',
'<section class="cu-card cu-drafts"><h3>Atualizações pendentes de conferência</h3>',
'<div class="cu-buttons"><button id="cu-export-drafts" class="cu-btn primary" type="button">Exportar propostas em CSV</button>',
'<label style="font-size:11px;color:#476651;font-weight:bold">Importar CSV de propostas <input id="cu-import-file" type="file" accept=".csv,text/csv" style="max-width:280px"></label></div>',
'<p class="cu-hint">A importação também cria rascunhos locais. Nenhum valor é publicado sem validação posterior na base de origem.</p>',
'<div class="cu-scroll" style="margin-top:12px;max-height:300px"><table><thead><tr><th>Código</th><th>Produto</th><th>Campo</th><th>Local</th><th>Anterior</th><th>Proposto</th><th>Data fonte</th><th>Documento / justificativa</th><th>Ação</th></tr></thead><tbody id="cu-drafts"></tbody></table></div>',
'<p id="cu-message" class="cu-message" role="status"></p></section>'
].join('');
const $=id=>view.querySelector('#'+id);
function parsePrice(raw){
  let s=str(raw).replace(/R\$/gi,'').replace(/\s/g,'');
  if(s.includes(','))s=s.replace(/\./g,'').replace(',','.');
  const n=Number(s);
  return Number.isFinite(n)&&n>0&&n<1e10?Math.round(n*1000000)/1000000:null;
}
function download(name,rows){
  const q=x=>{let s=str(x??'');if(/^[=+@\-\t\r]/.test(s))s="'"+s;return '"'+s.replace(/"/g,'""')+'"'};
  const csv='\ufeff'+rows.map(r=>r.map(q).join(';')).join('\r\n');
  const url=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'}));
  const link=document.createElement('a');link.href=url;link.download=name;link.click();
  setTimeout(()=>URL.revokeObjectURL(url),700);
}
function saveLocal(){
  try{localStorage.setItem(storageKey,JSON.stringify(drafts));return true}catch(_){return false}
}
function keyOf(r){return str(r.code)+'|'+str(r.unit)+'|'+str(r.local)}
function stockDate(){return window.CURRENT_STOCK_META?.emissao||'Data do estoque não informada'}
function stockSource(){return window.CURRENT_STOCK_META?.sourceFile||window.CURRENT_STOCK_META?.source||'Relatório de posição do estoque ERP'}
function build(){
  const stock=typeof STOCK!=='undefined'&&Array.isArray(STOCK)?STOCK:[];
  const purchases=typeof PURCHASES!=='undefined'&&Array.isArray(PURCHASES)?PURCHASES:[];
  const table=window.DB_APPROVED_COST_COMPARISON?.ready?window.DB_APPROVED_COST_COMPARISON.getProducts():[];
  const cost=new Map();
  for(const p of table)if(p&&p[1])cost.set(str(p[1])+'|'+norm(p[4]),p);
  const m=new Map();
  function get(code,unit,local){
    const k=str(code)+'|'+norm(unit)+'|'+str(local||'SEM POSIÇÃO FÍSICA');
    let r=m.get(k);
    if(!r){
      r={code:str(code),unit:norm(unit),local:str(local||'SEM POSIÇÃO FÍSICA'),group:'SEM GRUPO',
        product:'',balance:0,stockValue:0,stockCost:null,hasStock:false,
        last:null,purchaseLines:0,reference:null,refDate:'',refLine:'',refOverride:'',referenceSource:''};
      m.set(k,r);
    }
    return r;
  }
  for(const x of stock){
    if(!x||!x.codigo)return;
    const r=get(x.codigo,x.un,x.local);
    r.group=str(x.grupo||r.group);r.product=str(x.produto||r.product);
    r.balance+=number(x.estoque);r.stockValue+=number(x.valor_estoque);
    r.stockCost=number(x.custo_estoque)>0?number(x.custo_estoque):r.stockCost;
    r.hasStock=true;
  }
  for(const x of purchases){
    if(!x||!x.codigo)return;
    const r=get(x.codigo,x.un,x.local);
    r.group=str(x.grupo||r.group);r.product=str(x.produto||r.product);
    const incoming={date:str(x.data||''),price:number(x.preco),supplier:str(x.fornecedor||''),
      invoice:str(x.nota||''),document:str(x.nrounico||''),seq:str(x.seq||''),
      status:str(x.status||''),local:str(x.local||'')};
    if(!r.last||dateKey(incoming.date)>dateKey(r.last.date)||
       dateKey(incoming.date)===dateKey(r.last.date)&&incoming.document>r.last.document)r.last=incoming;
    r.purchaseLines++;
  }
  for(const p of table)if(![...m.values()].some(r=>r.code===str(p[1])&&r.unit===norm(p[4]))){
    const r=get(p[1],p[4],'SEM POSIÇÃO FÍSICA');
    r.group=str(p[3]||r.group);r.product=str(p[2]||r.product);
  }
  for(const r of m.values()){
    if(r.hasStock&&r.balance>0&&r.stockValue>0)r.stockCost=r.stockValue/r.balance;
    const p=cost.get(r.code+'|'+r.unit);
    if(p){
      r.reference=p[6]!=null&&number(p[6])>0?number(p[6])/1e6:null;
      r.refDate=str(p[7]||'');
      r.refLine=str(p[9]??'');
      const approved=window.DB_COST_TABLE_REFERENCE_OVERRIDES?.[r.code];
      r.refOverride=approved&&number(approved.approvedMaxMicro)===number(p[6])?str(approved.source||'Ajuste gerencial aprovado'):'';
      r.referenceSource=r.refOverride?'AJUSTE GERENCIAL APROVADO':'Tabela Custo.xlsx';
    }
    const manual=window.DB_APPROVED_PRODUCT_COSTS?.[r.code];
    if(manual&&r.unit===manual.unidade){
      r.reference=manual.custoUnitario;
      r.refDate=manual.dataAprovacao;
      r.refLine='Ajuste gerencial do gestor';
      r.refOverride=manual.fonte;
      r.referenceSource='CUSTO GERENCIAL APROVADO';
    }
  }
  records=[...m.values()].sort((a,b)=>b.stockValue-a.stockValue||a.code.localeCompare(b.code,'pt-BR')||a.local.localeCompare(b.local,'pt-BR'));
  known=new Map(records.map(r=>[keyOf(r),r]));
  loaded=true;dirty=false;
  return records;
}
function stat(label,value){return '<div class="cu-stat"><small>'+esc(label)+'</small><strong>'+esc(value)+'</strong></div>'}
function preserve(id,options,placeholder,chosen){
  const el=$(id);const html='<option value="">'+esc(placeholder)+'</option>'+options.map(x=>
    '<option value="'+esc(x[0])+'"'+(str(chosen)===str(x[0])?' selected':'')+'>'+esc(x[1])+'</option>').join('');
  if(el.innerHTML!==html)el.innerHTML=html;
  el.value=options.some(x=>str(x[0])===str(chosen))?str(chosen):'';
  return el.value;
}
function filters(){
  // O local e opcional. Grupo -> Produto e a cascata principal, ambos
  // classificados pelo valor total em estoque (sem contar compras como saldo).
  const localNames=[...new Set(records.map(r=>r.local))].sort((a,b)=>a.localeCompare(b,'pt-BR'));
  state.local=preserve('cu-local',localNames.map(x=>[x,x]),'Todos os almoxarifados',state.local);
  const byLocal=records.filter(r=>!state.local||r.local===state.local);
  const groupTotals=new Map();
  for(const r of byLocal)groupTotals.set(r.group,(groupTotals.get(r.group)||0)+r.stockValue);
  const orderedGroups=[...groupTotals].sort((a,b)=>b[1]-a[1]||a[0].localeCompare(b[0],'pt-BR'));
  state.group=preserve('cu-group',orderedGroups.map(([name,total])=>
    [name,name+' · '+fmtTotal(total)]),'Todos os grupos',state.group);
  const products=new Map();
  for(const r of byLocal){
    if(state.group&&r.group!==state.group)continue;
    const key=r.code+'|'+r.unit;
    const item=products.get(key)||{code:r.code,product:r.product,unit:r.unit,total:0};
    item.total+=r.stockValue;
    products.set(key,item);
  }
  const orderedProducts=[...products].sort((a,b)=>b[1].total-a[1].total||
    a[1].product.localeCompare(b[1].product,'pt-BR')||a[0].localeCompare(b[0],'pt-BR'));
  state.product=preserve('cu-product',orderedProducts.map(([key,item])=>
    [key,item.code+' · '+item.product+' ('+item.unit+') · '+fmtTotal(item.total)]),
    'Todos os produtos',state.product);
}
function visible(){
  const q=norm(state.query);
  const keys=new Set(drafts.map(x=>x.code+'|'+x.unit));
  return records.filter(r=>(!state.local||r.local===state.local)&&(!state.group||r.group===state.group)&&
    (!state.product||r.code+'|'+r.unit===state.product)&&
    (state.only==='all'||state.only==='noref'&&!r.reference||state.only==='draft'&&keys.has(r.code+'|'+r.unit))&&
    (!q||norm([r.code,r.product,r.group,r.local,r.unit,r.last?.invoice,r.last?.supplier].join(' ')).includes(q)));
}
function renderDrafts(){
  const sorted=drafts.slice().sort((a,b)=>str(b.savedAt).localeCompare(str(a.savedAt)));
  $('cu-drafts').innerHTML=sorted.length?sorted.map(x=>
    '<tr><td>'+esc(x.code)+'<div class="light">'+esc(x.unit)+'</div></td><td>'+esc(x.product)+'</td>'+
    '<td>'+esc(x.scope==='GERENCIAL'?'Tabela Custo':'Custo estoque ERP')+'</td>'+
    '<td>'+esc(x.local)+'</td><td class="num">'+fmt(x.current)+'</td><td class="num"><b>'+fmt(x.proposed)+'</b></td>'+
    '<td>'+esc(x.date)+'</td><td>'+esc(x.document)+'<div class="light">'+esc(x.reason)+'</div></td>'+
    '<td><button class="cu-btn" data-cu-remove="'+esc(x.id)+'" type="button">Excluir</button></td></tr>').join(''):
    '<tr><td colspan="9">Nenhuma proposta pendente.</td></tr>';
  $('cu-export-drafts').disabled=!sorted.length;
}
function groupTree(rows){
  const groups=new Map();
  for(const r of rows){
    let group=groups.get(r.group);
    if(!group){group={name:r.group,total:0,positions:0,products:new Map()};groups.set(r.group,group)}
    group.total+=r.stockValue;group.positions++;
    const key=productKey(r);
    let product=group.products.get(key);
    if(!product){
      product={key,code:r.code,name:r.product,unit:r.unit,total:0,rows:[]};
      group.products.set(key,product);
    }
    product.total+=r.stockValue;
    product.rows.push(r);
  }
  return [...groups.values()].sort((a,b)=>b.total-a.total||a.name.localeCompare(b.name,'pt-BR'));
}
function detailRow(r,hasDraft){
  const last=r.last;
  const origin=r.refOverride||(r.reference>0?'Tabela Custo · linha '+(r.refLine||'não informada')+
    (r.refDate?' · '+r.refDate:''):'Sem referência válida na Tabela Custo');
  return '<tr data-cu-stock-value="'+r.stockValue+'">'+
    '<td><b>'+esc(r.code)+'</b><div>'+esc(r.product)+'</div><div class="light">'+esc(r.unit)+'</div></td>'+
    '<td>'+esc(r.local)+'</td>'+
    '<td class="num">'+(r.hasStock?whole.format(r.balance):'—')+'</td>'+
    '<td class="num"><b>'+fmtTotal(r.stockValue)+'</b></td>'+
    '<td class="num">'+fmt(r.stockCost)+'</td>'+
    '<td class="num">'+(last?fmt(last.price)+'<div class="light">'+esc(last.date)+' · NF '+esc(last.invoice)+'</div>':'—')+'</td>'+
    '<td class="num">'+fmt(r.reference)+'</td>'+
    '<td>'+esc(origin)+'<div class="light">'+(last?'Fornecedor: '+esc(last.supplier):'')+'</div></td>'+
    '<td>'+(hasDraft?'<div class="light">Revisão pendente</div>':'')+
    '<button class="cu-btn" type="button" data-cu-edit="'+esc(keyOf(r))+'">Conferir / atualizar</button></td></tr>';
}
function paint(){
  if(!view.classList.contains('active'))return;
  if(dirty||!loaded)build();
  filters();
  const shown=visible(), groups=groupTree(shown), draftKeys=new Set(drafts.map(x=>x.code+'|'+x.unit));
  $('cu-stats').innerHTML=[
    stat('Posições e referências consultáveis',whole.format(records.length)),
    stat('Com custo físico ERP',whole.format(records.filter(r=>r.hasStock&&r.stockCost>0).length)),
    stat('Com histórico de compras',whole.format(records.filter(r=>r.purchaseLines>0).length)),
    stat('Com maior Tabela Custo',whole.format(records.filter(r=>r.reference>0).length)),
    stat('Propostas locais pendentes',whole.format(drafts.length))
  ].join('');
  $('cu-asof').textContent='Custo físico: '+stockSource()+' · '+stockDate()+
    '. Compras: '+(window.LATEST_PURCHASE_META?.source||'histórico ERP')+
    '. Referências gerenciais: Tabela Custo.xlsx (5.374 registros) e correções aprovadas, incluindo a correia 124928 a R$ 7.982,58/PC. A origem fiscal do ERP e as notas de compra não são regravadas.';
  const productCount=groups.reduce((sum,g)=>sum+g.products.size,0);
  $('cu-count').textContent=whole.format(groups.length)+' grupos · '+whole.format(productCount)+
    ' produtos por grupo · '+whole.format(shown.length)+' posições · '+fmtTotal(shown.reduce((sum,r)=>sum+r.stockValue,0));
  let detailsCount=0;
  $('cu-rows').innerHTML=groups.length?groups.map(g=>{
    const opened=expandedGroups.has(g.name);
    const products=[...g.products.values()].sort((a,b)=>b.total-a.total||
      a.name.localeCompare(b.name,'pt-BR')||a.code.localeCompare(b.code,'pt-BR'));
    return '<section class="cu-group" data-cu-group="'+esc(g.name)+'" data-cu-stock-value="'+g.total+'">'+
      '<button type="button" class="cu-node" data-cu-toggle-group="'+esc(g.name)+
      '" aria-expanded="'+opened+'"><span class="cu-node-left">'+
      '<span class="cu-arrow">'+(opened?'▾':'▸')+'</span><span class="cu-node-label"><b>'+esc(g.name)+'</b>'+
      '<small>'+whole.format(products.length)+' produtos · '+whole.format(g.positions)+' posições</small></span></span>'+
      '<strong class="cu-node-value">'+fmtTotal(g.total)+'</strong></button>'+
      (opened?'<div class="cu-group-products">'+products.map(p=>{
        const productOpened=expandedProducts.has(p.key);
        if(productOpened)detailsCount+=p.rows.length;
        const rows=p.rows.slice().sort((a,b)=>b.stockValue-a.stockValue||
          a.local.localeCompare(b.local,'pt-BR'));
        return '<section class="cu-product" data-cu-product="'+esc(p.key)+'" data-cu-stock-value="'+p.total+'">'+
          '<button type="button" class="cu-node" data-cu-toggle-product="'+esc(p.key)+
          '" aria-expanded="'+productOpened+'"><span class="cu-node-left"><span class="cu-arrow">'+
          (productOpened?'▾':'▸')+'</span><span class="cu-node-label"><b>'+esc(p.code)+' · '+esc(p.name||'Produto sem descrição')+
          '</b><small>'+esc(p.unit)+' · '+whole.format(rows.length)+' almoxarifado(s)/posição(ões)</small></span></span>'+
          '<strong class="cu-node-value">'+fmtTotal(p.total)+'</strong></button>'+
          (productOpened?'<div class="cu-details-scroll"><table><thead><tr>'+
            '<th>Código / produto</th><th>Almoxarifado</th><th>Saldo físico</th>'+
            '<th>Valor em estoque</th><th>Custo unit. ERP</th><th>Última compra</th>'+
            '<th>Maior Tabela Custo</th><th>Origem / data</th><th>Revisão</th>'+
            '</tr></thead><tbody>'+rows.map(r=>detailRow(r,draftKeys.has(r.code+'|'+r.unit))).join('')+
            '</tbody></table></div>':'')+'</section>';
      }).join('')+'</div>':'')+'</section>';
  }).join(''):'<div class="cu-tree-empty">Nenhum grupo ou produto corresponde aos filtros.</div>';
  renderDrafts();
  window.DB_COST_UPDATE.meta={loaded:true,rows:records.length,filtered:shown.length,
    filterOrder:['Grupo','Produto','Almoxarifado (opcional)'],sortBy:'valor_estoque_desc',
    cascade:true,visualCascade:true,groups:groups.length,products:productCount,
    visibleDetailRows:detailsCount,
    approvedCorreia124928:records.filter(r=>r.code==='124928'&&r.unit==='PC').every(r=>Math.abs((r.reference||0)-7982.58)<0.001),
    physicalWithCost:records.filter(r=>r.hasStock&&r.stockCost>0).length,
    gerencialWithReference:records.filter(r=>r.reference>0).length,drafts:drafts.length,
    stockDate:stockDate(),purchaseSource:window.LATEST_PURCHASE_META?.source||null,
    officialCostsChanged:false,source:'ERP / Tabela Custo',autoPublish:false};
}
function expandMatchingProducts(){
  expandedGroups.clear();expandedProducts.clear();
  const rows=visible();
  if(rows.length<=24){
    for(const r of rows){expandedGroups.add(r.group);expandedProducts.add(productKey(r))}
  }else if(state.group){expandedGroups.add(state.group)}
}
function feedback(message,error){
  const target=$('cu-feedback');target.textContent=message;target.classList.toggle('error',!!error);
}
function presentEditing(){
  if(!editing)return;
  $('cu-selected').textContent='Produto '+editing.code+' · '+editing.product+' · '+editing.unit+
    ' · '+editing.local+' · grupo '+editing.group;
  $('cu-sources').innerHTML=[
    '<div><small>Estoque ERP · '+esc(stockDate())+'</small><strong>'+fmt(editing.stockCost)+'</strong><small>'+esc(stockSource())+'</small></div>',
    '<div><small>Última compra · '+esc(editing.last?.date||'sem histórico')+'</small><strong>'+fmt(editing.last?.price)+'</strong><small>'+esc(editing.last?'NF '+editing.last.invoice+' · '+editing.last.supplier:'Sem documento de compra')+'</small></div>',
    '<div><small>Maior custo gerencial · '+esc(editing.refDate||'data não informada')+'</small><strong>'+fmt(editing.reference)+'</strong><small>'+esc(editing.refOverride||('Tabela Custo, linha '+(editing.refLine||'não identificada')))+'</small></div>'
  ].join('');
  const scope=$('cu-scope').value;
  $('cu-current').value=scope==='GERENCIAL'?fmt(editing.reference):fmt(editing.stockCost);
}
function edit(key){
  editing=known.get(key)||null;if(!editing)return;
  $('cu-edit').hidden=false;
  $('cu-scope').value=editing.reference>0?'GERENCIAL':editing.hasStock?'ESTOQUE_ERP':'GERENCIAL';
  $('cu-price').value='';$('cu-date').value='';
  $('cu-document').value='';$('cu-reason').value='';
  feedback('',false);presentEditing();
  $('cu-edit').scrollIntoView({block:'nearest',behavior:'smooth'});
}
function draftId(x){return [x.scope,x.code,x.unit,x.scope==='GERENCIAL'?'REDE':x.local].join('|')}
function saveDraft(row,quiet){
  row.id=draftId(row);
  const index=drafts.findIndex(x=>x.id===row.id);
  if(index>=0)drafts[index]=row;else drafts.push(row);
  if(drafts.length>2000)drafts=drafts.slice(-2000);
  const persisted=saveLocal();
  if(!quiet){
    feedback(persisted?'Proposta registrada neste navegador. Exporte o CSV para validar e publicar na base oficial.':
      'Proposta registrada nesta sessão, mas o navegador bloqueou o armazenamento. Exporte o CSV antes de sair.',!persisted);
  }
  paint();
}
function parseCSV(text){
  const lines=[],row=[];let value='',inside=false;
  const src=str(text).replace(/^\ufeff/,'');
  for(let i=0;i<src.length;i++){
    const c=src[i];
    if(c==='"'){
      if(inside&&src[i+1]==='"'){value+='"';i++}else inside=!inside;
    }else if(c===';'&&!inside){row.push(value);value=''}
    else if((c==='\n'||c==='\r')&&!inside){if(c==='\r'&&src[i+1]==='\n')i++;
      row.push(value);if(row.some(x=>x!==''))lines.push(row.slice());row.length=0;value='';
    }else value+=c;
  }
  if(inside)throw Error('CSV possui aspas sem fechamento.');
  row.push(value);if(row.some(x=>x!==''))lines.push(row);
  return lines;
}
function exportDrafts(){
  const header=['Tipo','Codigo','Produto','Grupo','Unidade','Local','CustoAtual','CustoProposto',
    'DataFonte','DocumentoFonte','Justificativa','Situacao'];
  const rows=drafts.map(x=>[x.scope,x.code,x.product,x.group,x.unit,x.local,
    x.current==null?'':x.current,x.proposed,x.date,x.document,x.reason,'PENDENTE_CONFERENCIA']);
  download('propostas_atualizacao_custos_DB.csv',[header,...rows]);
}
view.addEventListener('click',e=>{
  const groupBtn=e.target.closest('[data-cu-toggle-group]');
  if(groupBtn){
    const key=groupBtn.dataset.cuToggleGroup;
    if(expandedGroups.has(key))expandedGroups.delete(key);else expandedGroups.add(key);
    paint();return;
  }
  const productBtn=e.target.closest('[data-cu-toggle-product]');
  if(productBtn){
    const key=productBtn.dataset.cuToggleProduct;
    if(expandedProducts.has(key))expandedProducts.delete(key);else expandedProducts.add(key);
    paint();return;
  }
  const editBtn=e.target.closest('[data-cu-edit]');
  if(editBtn){edit(editBtn.dataset.cuEdit);return}
  const del=e.target.closest('[data-cu-remove]');
  if(del){
    drafts=drafts.filter(x=>x.id!==del.dataset.cuRemove);saveLocal();paint();
    $('cu-message').textContent='Proposta excluída apenas deste navegador.';return;
  }
});
$('cu-local').addEventListener('change',e=>{
  state.local=e.target.value;state.product='';expandMatchingProducts();paint();
});
$('cu-group').addEventListener('change',e=>{
  state.group=e.target.value;state.product='';expandedGroups.clear();expandedProducts.clear();
  if(state.group)expandedGroups.add(state.group);
  paint();
});
$('cu-product').addEventListener('change',e=>{
  state.product=e.target.value;expandMatchingProducts();paint();
});
$('cu-search').addEventListener('input',e=>{
  state.query=e.target.value;expandMatchingProducts();paint();
});
$('cu-only').addEventListener('change',e=>{
  state.only=e.target.value;expandMatchingProducts();paint();
});
$('cu-expand-groups').addEventListener('click',()=>{
  for(const r of visible())expandedGroups.add(r.group);
  paint();
});
$('cu-collapse-all').addEventListener('click',()=>{
  expandedGroups.clear();expandedProducts.clear();paint();
});
$('cu-clear').addEventListener('click',()=>{
  Object.assign(state,{local:'',group:'',product:'',query:'',only:'all',page:0});
  expandedGroups.clear();expandedProducts.clear();
  $('cu-search').value='';$('cu-only').value='all';paint();
});
$('cu-scope').addEventListener('change',presentEditing);
$('cu-cancel').addEventListener('click',()=>{$('cu-edit').hidden=true;editing=null});
$('cu-save').addEventListener('click',()=>{
  if(!editing)return;
  const proposed=parsePrice($('cu-price').value),date=$('cu-date').value,doc=$('cu-document').value.trim(),
    reason=$('cu-reason').value.trim(),scope=$('cu-scope').value;
  if(!proposed){feedback('Informe um novo custo válido, maior que zero.',true);return}
  if(!/^\d{4}-\d{2}-\d{2}$/.test(date)){feedback('Informe a data do documento que comprova o custo.',true);return}
  if(!doc){feedback('Informe a nota fiscal, linha da Tabela Custo ou documento que comprova o valor.',true);return}
  if(!reason){feedback('Preencha a justificativa da atualização.',true);return}
  saveDraft({scope,code:editing.code,product:editing.product,group:editing.group,unit:editing.unit,
    local:scope==='GERENCIAL'?'REDE':editing.local,
    current:scope==='GERENCIAL'?editing.reference:editing.stockCost,
    proposed,date,document:doc,reason,status:'PENDENTE_CONFERENCIA',savedAt:new Date().toISOString()},false);
});
$('cu-export-drafts').addEventListener('click',exportDrafts);
$('cu-export-reference').addEventListener('click',()=>{
  const header=['Codigo','Produto','Grupo','Unidade','Local','Saldo','CustoEstoqueERP','DataEstoque',
    'UltimaCompra','DataUltimaCompra','FornecedorUltimaCompra','NotaUltimaCompra','DocumentoUltimaCompra',
    'MaiorTabelaCusto','LinhaTabelaCusto','DataReferencia','CorrecaoAprovada'];
  download('consulta_fontes_custos_DB.csv',[header,...visible().map(r=>
    [r.code,r.product,r.group,r.unit,r.local,r.balance,r.stockCost??'',stockDate(),
      r.last?.price??'',r.last?.date??'',r.last?.supplier??'',r.last?.invoice??'',r.last?.document??'',
      r.reference??'',r.refLine,r.refDate,r.refOverride])]);
});
$('cu-template').addEventListener('click',()=>download('modelo_atualizacao_custo_DB.csv',[
  ['Tipo','Codigo','Produto','Grupo','Unidade','Local','CustoAtual','CustoProposto','DataFonte','DocumentoFonte','Justificativa','Situacao'],
  ['GERENCIAL','105090','ELETRODO 6013 2.5MM','ELETRODOS','KG','REDE','','24,235','2026-11-09','Tabela Custo linha correspondente','EXEMPLO - não importar como ajuste real','EXEMPLO']
]));
$('cu-import-file').addEventListener('change',async e=>{
  const f=e.target.files?.[0];if(!f)return;
  try{
    if(f.size>1500000)throw Error('O CSV excede 1,5 MB.');
    const lines=parseCSV(await f.text()),headers=lines.shift()?.map(x=>norm(x))||[];
    const expected=['TIPO','CODIGO','PRODUTO','GRUPO','UNIDADE','LOCAL','CUSTOATUAL','CUSTOPROPOSTO','DATAFONTE','DOCUMENTOFONTE','JUSTIFICATIVA','SITUACAO'];
    if(expected.some((x,i)=>headers[i]!==x))throw Error('Cabeçalho diferente do modelo da aba.');
    if(lines.length>1000)throw Error('Limite de 1.000 atualizações por arquivo.');
    if(dirty||!loaded)build();
    const next=[];const errors=[];
    for(let i=0;i<lines.length;i++){
      const z=lines[i];if(z[11]==='EXEMPLO')continue;
      const [scope,code,product,group,unit,local,old,raw,date,document,reason]=z;
      const p=parsePrice(raw);const knownCode=records.find(r=>r.code===str(code)&&r.unit===norm(unit)&&
        (scope==='GERENCIAL'||r.local===str(local)));
      if(!['GERENCIAL','ESTOQUE_ERP'].includes(scope)||!knownCode||!p||
        !/^\d{4}-\d{2}-\d{2}$/.test(date)||!str(document).trim()||!str(reason).trim()){
        errors.push(i+2);continue;
      }
      next.push({scope,code:str(code),product:knownCode.product,group:knownCode.group,unit:norm(unit),
        local:scope==='GERENCIAL'?'REDE':str(local),current:scope==='GERENCIAL'?knownCode.reference:knownCode.stockCost,
        proposed:p,date,document:str(document).trim(),reason:str(reason).trim(),
        status:'PENDENTE_CONFERENCIA',savedAt:new Date().toISOString()});
    }
    if(errors.length)throw Error('Linhas inválidas: '+errors.slice(0,15).join(', ')+
      (errors.length>15?' e outras':'')+'. Nenhuma linha foi importada.');
    if(!next.length)throw Error('Nenhuma proposta válida encontrada.');
    for(const item of next){item.id=draftId(item);const idx=drafts.findIndex(x=>x.id===item.id);if(idx>=0)drafts[idx]=item;else drafts.push(item)}
    const ok=saveLocal();paint();
    $('cu-message').textContent=next.length+' propostas importadas para conferência'+(ok?' neste navegador.':'. Exporte o CSV: armazenamento indisponível.');
  }catch(error){$('cu-message').textContent='Importação rejeitada: '+error.message}
  finally{e.target.value=''}
});
tab.addEventListener('click',()=>{
  document.querySelectorAll('.tab').forEach(x=>x.classList.remove('active'));
  document.querySelectorAll('.view').forEach(x=>x.classList.remove('active'));
  tab.classList.add('active');view.classList.add('active');paint();
});
for(const event of ['purchases-updated','stock-position-updated','cost-references-updated'])
  window.addEventListener(event,()=>{dirty=true;if(view.classList.contains('active'))paint()});
window.DB_COST_UPDATE={open:()=>tab.click(),refresh:()=>{dirty=true;paint()},
  getRows:()=>records.slice(),getDrafts:()=>drafts.map(x=>({...x})),
  meta:{loaded:false,rows:0,drafts:drafts.length,officialCostsChanged:false,autoPublish:false},
  version:'20261113-cascata-visual-grupo-produto-v2'};
})();
